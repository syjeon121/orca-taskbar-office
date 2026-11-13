import type { SessionInfo, SessionStatus } from '../shared/types'
import { publishSessions } from './session-hub'

// Fake session source for checking the scene and animations without Orca ("Demo mode" in the tray).

const AGENT_TYPES = ['claude', 'codex', 'antigravity']
const WORKSPACES = ['web-app', 'api-server', 'docs-site', 'orca-taskbar-office']
const TOOLS = ['Bash', 'Edit', 'Read', 'Grep']

let sessions: SessionInfo[] = []
let nextId = 1
let autoTimer: NodeJS.Timeout | null = null

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function publish(): void {
  publishSessions(sessions.map((s) => ({ ...s })))
}

function setStatus(session: SessionInfo, status: SessionStatus): void {
  session.status = status
  session.tool = status === 'working' ? pick(TOOLS) : null
  session.since = Date.now()
}

function withStatus(...statuses: SessionStatus[]): SessionInfo[] {
  return sessions.filter((s) => statuses.includes(s.status))
}

const RESTING: SessionStatus[] = ['done', 'failed', 'interrupted']

function addSession(): void {
  const id = nextId++
  sessions.push({
    id: `demo-${id}`,
    agentType: pick(AGENT_TYPES),
    workspace: pick(WORKSPACES),
    worktreeId: null,
    environmentId: null,
    host: '',
    title: `데모 작업 ${id}`,
    status: 'done',
    quiet: false,
    unread: false,
    tool: null,
    since: Date.now(),
    lastMessage: '데모 세션입니다.',
  })
}

export const demo = {
  add(): void {
    addSession()
    publish()
  },
  /** Moves one resting session to working */
  start(): void {
    const candidates = withStatus(...RESTING, 'waiting')
    if (candidates.length === 0) return
    setStatus(pick(candidates), 'working')
    publish()
  },
  /** Moves one working session to the given status */
  finish(status: Exclude<SessionStatus, 'working'>): void {
    const candidates = withStatus('working', ...(status === 'waiting' ? [] : (['waiting'] as SessionStatus[])))
    if (candidates.length === 0) return
    setStatus(pick(candidates), status)
    publish()
  },
  /** Removes one resting session from the list (it goes home) */
  remove(): void {
    const candidates = withStatus(...RESTING)
    if (candidates.length === 0) return
    const target = pick(candidates)
    sessions = sessions.filter((s) => s !== target)
    publish()
  },
  isAuto(): boolean {
    return autoTimer !== null
  },
  setAuto(on: boolean): void {
    if (autoTimer) clearInterval(autoTimer)
    autoTimer = on ? setInterval(autoStep, 2500) : null
  },
}

function autoStep(): void {
  const resting = withStatus(...RESTING).length
  const busy = withStatus('working', 'waiting').length
  const roll = Math.random()
  // Resolve waiting sessions first half of the time so they don't pile up
  const waiting = withStatus('waiting')
  if (waiting.length > 0 && Math.random() < 0.5) {
    setStatus(pick(waiting), 'working')
    publish()
    return
  }
  if (sessions.length < 4 || (roll < 0.08 && sessions.length < 10)) demo.add()
  else if (roll < 0.15 && resting > 0 && sessions.length > 4) demo.remove()
  else if (roll < 0.55 && resting > 0 && busy < 6) demo.start()
  else if (roll < 0.65) demo.finish('waiting')
  else if (roll < 0.9) demo.finish('done')
  else if (roll < 0.95) demo.finish('failed')
  else demo.finish('interrupted')
}

export function startDemo(): void {
  sessions = []
  // TASKBAR_OFFICE_DEMO=busy: 12 sessions, all working. Shows every desk pose at once
  if (process.env.TASKBAR_OFFICE_DEMO === 'busy') {
    for (let i = 0; i < 12; i++) addSession()
    for (const s of sessions) setStatus(s, 'working')
    publish()
    return
  }
  // TASKBAR_OFFICE_DEMO=idle: 10 sessions, all resting. Shows the lounge activities
  if (process.env.TASKBAR_OFFICE_DEMO === 'idle') {
    for (let i = 0; i < 10; i++) addSession()
    publish()
    return
  }
  // TASKBAR_OFFICE_DEMO=showcase: a fixed mix of every state, used for README screenshots
  if (process.env.TASKBAR_OFFICE_DEMO === 'showcase') {
    for (let i = 0; i < 12; i++) addSession()
    sessions.slice(0, 5).forEach((s) => setStatus(s, 'working'))
    setStatus(sessions[5], 'waiting')
    for (const s of sessions.slice(6, 8)) s.unread = true
    publish()
    return
  }
  for (let i = 0; i < 5; i++) addSession()
  publish()
  demo.setAuto(true)
}

export function stopDemo(): void {
  demo.setAuto(false)
  sessions = []
}
