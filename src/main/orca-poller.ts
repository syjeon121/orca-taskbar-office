import type { SessionInfo, SessionStatus } from '../shared/types'
import { callOrca } from './orca-cli'
import { publishSessions } from './session-hub'
import { getSettings } from './settings'

// Polls `orca worktree ps --json` to build the list of agent sessions.
// This PC's Orca and each remote environment saved in Orca (`orca environment list`) are queried separately and merged.
// See docs/development.md for how Orca states map to character states.

const POLL_MS = 3000
const ENVIRONMENT_REFRESH_MS = 60000
/** After this many consecutive failures a target is considered disconnected and its sessions are cleared */
const FAILURES_BEFORE_CLEAR = 3

interface OrcaAgent {
  paneKey?: string
  agentType?: string | null
  state?: string
  interrupted?: boolean
  mainAgent?: { outcome?: string }
  stateStartedAt?: number
  conversationName?: string | null
  taskTitle?: string | null
  displayName?: string | null
  prompt?: string | null
  lastAssistantMessage?: string | null
  toolName?: string | null
  activity?: { unread?: boolean }
}

interface OrcaWorktree {
  worktreeId?: string
  displayName?: string | null
  repo?: string | null
  unread?: boolean
  isArchived?: boolean
  agents?: OrcaAgent[]
}

export interface OrcaEnvironment {
  id: string
  name: string
}

export type PollerStatus =
  | { connected: true; working: number; total: number; shown: number; remotes: number; remotesDown: number }
  | { connected: false; reason: string }

function statusOf(agent: OrcaAgent): { status: SessionStatus; quiet: boolean } {
  switch (agent.state) {
    case 'working':
      return { status: 'working', quiet: false }
    case 'blocked':
    case 'waiting':
      return { status: 'waiting', quiet: false }
    default:
  }
  if (agent.interrupted) return { status: 'interrupted', quiet: false }
  switch (agent.mainAgent?.outcome) {
    case 'failure':
      return { status: 'failed', quiet: false }
    case 'cancellation':
    case 'interruption':
      return { status: 'interrupted', quiet: false }
    case 'superseded':
    case 'unconfirmed':
      return { status: 'done', quiet: true }
    default:
      return { status: 'done', quiet: false }
  }
}

function firstLine(text: string | null | undefined): string {
  return (text ?? '').split('\n')[0].trim()
}

interface Candidate {
  info: SessionInfo
}

/** One polling target: this PC (environment is null) or a remote environment */
interface Target {
  environment: OrcaEnvironment | null
  lastGood: Candidate[]
  failures: number
  lastError: string
}

function parse(stdout: string, environment: OrcaEnvironment | null): Candidate[] {
  const data = JSON.parse(stdout) as { ok?: boolean; result?: { worktrees?: OrcaWorktree[] } }
  if (!data.ok || !Array.isArray(data.result?.worktrees)) throw new Error('Unexpected response')
  const candidates: Candidate[] = []
  const seen = new Set<string>()
  for (const worktree of data.result.worktrees) {
    if (worktree.isArchived) continue
    const agents = worktree.agents ?? []
    // Remote queries have no per-session read state (activity), only a per-workspace unread flag.
    // In that case, treat the most recently finished session in the workspace as the unread one.
    let fallbackUnread: string | undefined
    if (worktree.unread === true && agents.every((a) => a.activity?.unread === undefined)) {
      fallbackUnread = agents
        .filter((a) => a.state !== 'working' && a.state !== 'blocked' && a.state !== 'waiting')
        .sort((a, b) => (b.stateStartedAt ?? 0) - (a.stateStartedAt ?? 0))[0]?.paneKey
    }
    for (const agent of agents) {
      if (!agent.paneKey || seen.has(agent.paneKey)) continue
      seen.add(agent.paneKey)
      const { status, quiet } = statusOf(agent)
      const busy = status === 'working' || status === 'waiting'
      const unread = !busy && (agent.activity?.unread ?? agent.paneKey === fallbackUnread)
      candidates.push({
        info: {
          unread,
          // Prefix remote session ids with the environment id so they never collide with another PC's
          id: environment ? `${environment.id}:${agent.paneKey}` : agent.paneKey,
          agentType: agent.agentType ?? 'unknown',
          workspace: worktree.displayName || worktree.repo || '',
          worktreeId: worktree.worktreeId ?? null,
          environmentId: environment?.id ?? null,
          host: environment?.name ?? '',
          title: firstLine(agent.conversationName || agent.taskTitle || agent.displayName || agent.prompt),
          status,
          quiet,
          tool: agent.toolName ?? null,
          since: agent.stateStartedAt ?? Date.now(),
          lastMessage: firstLine(agent.lastAssistantMessage).slice(0, 200),
        },
      })
    }
  }
  return candidates
}

/** Applies the go-home rule and the headcount limit to pick the sessions shown */
function select(candidates: Candidate[], now: number): SessionInfo[] {
  // Busy sessions and finished-but-unread sessions never go home and are always shown, regardless of the limit
  const kept = candidates.filter((c) => c.info.status === 'working' || c.info.status === 'waiting' || c.info.unread)
  const { retireMinutes, maxCharacters } = getSettings()
  const resting = candidates
    .filter((c) => !kept.includes(c) && (retireMinutes === 0 || now - c.info.since < retireMinutes * 60_000))
    .sort((a, b) => b.info.since - a.info.since)
  // Fill the remaining room with the most recently finished sessions
  const room = Math.max(0, maxCharacters - kept.length)
  return [...kept, ...resting.slice(0, room)].map((c) => c.info)
}

let timer: NodeJS.Timeout | null = null
let running = false
let lastPublished = ''
let environments: OrcaEnvironment[] = []
let environmentsCheckedAt = 0
const targets = new Map<string, Target>()

/** Remote environments saved in Orca. Used to toggle them in the tray menu */
export function getEnvironments(): OrcaEnvironment[] {
  return environments
}

async function refreshEnvironments(now: number): Promise<void> {
  if (environmentsCheckedAt !== 0 && now - environmentsCheckedAt < ENVIRONMENT_REFRESH_MS) return
  environmentsCheckedAt = now
  try {
    const data = JSON.parse(await callOrca(['environment', 'list', '--json'])) as {
      ok?: boolean
      result?: { environments?: { id?: string; name?: string }[] }
    }
    if (!data.ok || !Array.isArray(data.result?.environments)) return
    environments = data.result.environments
      .filter((e): e is { id: string; name?: string } => typeof e.id === 'string')
      .map((e) => ({ id: e.id, name: e.name || e.id.slice(0, 8) }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  } catch {
    // Keep the previous list if it can't be read
  }
}

function targetFor(environment: OrcaEnvironment | null): Target {
  const key = environment?.id ?? 'local'
  let target = targets.get(key)
  if (!target) {
    target = { environment, lastGood: [], failures: 0, lastError: '' }
    targets.set(key, target)
  }
  target.environment = environment
  return target
}

async function fetchTarget(target: Target): Promise<void> {
  const args = ['worktree', 'ps', '--json']
  if (target.environment) args.push('--environment', target.environment.id)
  try {
    target.lastGood = parse(await callOrca(args), target.environment)
    target.failures = 0
  } catch (error) {
    target.failures++
    target.lastError = error instanceof Error ? error.message.split('\n')[0] : String(error)
    // Keep the last result on brief failures so characters don't flicker in and out
    if (target.failures >= FAILURES_BEFORE_CLEAR) target.lastGood = []
  }
}

async function poll(onStatus: (status: PollerStatus) => void): Promise<void> {
  const now = Date.now()
  await refreshEnvironments(now)
  const disabled = new Set(getSettings().disabledEnvironments)
  const local = targetFor(null)
  const remotes = environments.filter((e) => !disabled.has(e.id)).map(targetFor)
  await Promise.all([local, ...remotes].map(fetchTarget))
  if (!running) return

  const candidates = [local, ...remotes].flatMap((t) => t.lastGood)
  const sessions = select(candidates, Date.now())
  const serialized = JSON.stringify(sessions)
  if (serialized !== lastPublished) {
    lastPublished = serialized
    publishSessions(sessions)
  }
  if (local.failures >= FAILURES_BEFORE_CLEAR) {
    onStatus({ connected: false, reason: local.lastError })
  } else {
    onStatus({
      connected: true,
      working: candidates.filter((c) => c.info.status === 'working').length,
      total: candidates.length,
      shown: sessions.length,
      remotes: remotes.length,
      remotesDown: remotes.filter((t) => t.failures >= FAILURES_BEFORE_CLEAR).length,
    })
  }
}

export function startPoller(onStatus: (status: PollerStatus) => void): void {
  if (running) return
  running = true
  lastPublished = ''
  targets.clear()
  environmentsCheckedAt = 0
  // Schedule the next poll only after the previous one finishes so calls never overlap
  const loop = async (): Promise<void> => {
    await poll(onStatus)
    if (running) timer = setTimeout(loop, POLL_MS)
  }
  void loop()
}

export function stopPoller(): void {
  running = false
  if (timer) clearTimeout(timer)
  timer = null
}
