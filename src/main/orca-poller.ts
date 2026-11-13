import type { SessionInfo, SessionStatus } from '../shared/types'
import { callOrca } from './orca-cli'
import { publishSessions } from './session-hub'
import { getSettings } from './settings'

// `orca worktree ps --json`을 주기적으로 호출해 에이전트 세션 목록을 만든다.
// 이 PC의 Orca와, Orca에 저장된 원격 환경(`orca environment list`) 각각을 따로 조회해 합친다.
// 상태 값과 필드는 docs/PLAN.md 4장의 검증 결과를 따른다.

const POLL_MS = 3000
const ENVIRONMENT_REFRESH_MS = 60000
/** 한 조회 대상이 연속으로 이만큼 실패하면 연결이 끊긴 것으로 보고 그쪽 세션을 비운다 */
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

/** 조회 대상 하나: 이 PC(environment가 null) 또는 원격 환경 */
interface Target {
  environment: OrcaEnvironment | null
  lastGood: Candidate[]
  failures: number
  lastError: string
}

function parse(stdout: string, environment: OrcaEnvironment | null): Candidate[] {
  const data = JSON.parse(stdout) as { ok?: boolean; result?: { worktrees?: OrcaWorktree[] } }
  if (!data.ok || !Array.isArray(data.result?.worktrees)) throw new Error('예상과 다른 응답')
  const candidates: Candidate[] = []
  const seen = new Set<string>()
  for (const worktree of data.result.worktrees) {
    if (worktree.isArchived) continue
    const agents = worktree.agents ?? []
    // 원격 환경 조회에는 세션별 읽음 정보(activity)가 없고 워크스페이스 단위의 unread만 온다.
    // 그 경우 워크스페이스에서 가장 최근에 끝난 세션을 읽지 않은 세션으로 본다.
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
          // 원격 세션은 환경 id를 앞에 붙여 다른 PC의 세션과 겹치지 않게 한다
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

/** 퇴근 규칙과 인원 상한을 적용해 화면에 나올 세션을 고른다 */
function select(candidates: Candidate[], now: number): SessionInfo[] {
  // 일하는 세션과, 끝났지만 아직 확인하지 않은 세션은 퇴근시키지 않고 상한과 관계없이 모두 보여준다
  const kept = candidates.filter((c) => c.info.status === 'working' || c.info.status === 'waiting' || c.info.unread)
  const { retireMinutes, maxCharacters } = getSettings()
  const resting = candidates
    .filter((c) => !kept.includes(c) && (retireMinutes === 0 || now - c.info.since < retireMinutes * 60_000))
    .sort((a, b) => b.info.since - a.info.since)
  // 남는 자리를 최근에 끝난 세션으로 채운다
  const room = Math.max(0, maxCharacters - kept.length)
  return [...kept, ...resting.slice(0, room)].map((c) => c.info)
}

let timer: NodeJS.Timeout | null = null
let running = false
let lastPublished = ''
let environments: OrcaEnvironment[] = []
let environmentsCheckedAt = 0
const targets = new Map<string, Target>()

/** Orca에 저장된 원격 환경 목록. 트레이 메뉴에서 켜고 끄는 데 쓴다 */
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
    // 목록을 못 읽으면 이전 목록을 그대로 쓴다
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
    // 잠깐의 실패에는 직전 결과를 유지해 캐릭터가 들락거리지 않게 한다
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
  // 호출이 겹치지 않게, 이전 호출이 끝난 뒤에 다음 호출을 예약한다
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
