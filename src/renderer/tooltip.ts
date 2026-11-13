import { strings, type Strings } from '../shared/i18n'
import { AGENT_COLORS, type SessionInfo, type TooltipApi, type TooltipData } from '../shared/types'

declare global {
  interface Window {
    tooltip: TooltipApi
  }
}

const AGENT_NAMES: Record<string, string> = {
  claude: 'Claude',
  codex: 'Codex',
  antigravity: 'Antigravity',
  gemini: 'Gemini',
}

const STATUS_COLORS: Record<SessionInfo['status'], string> = {
  working: '#8fd0f0',
  waiting: '#ff8a7a',
  done: '#7fd89a',
  failed: '#ff8a7a',
  interrupted: '#b9b6c4',
}

function el(id: string): HTMLElement {
  return document.getElementById(id)!
}

function statusText(t: Strings, session: SessionInfo, now: number): string {
  const elapsed = t.duration(Math.floor(Math.max(0, now - session.since) / 60000))
  switch (session.status) {
    case 'working':
      return t.working(session.tool, elapsed)
    case 'waiting':
      return t.waiting(elapsed)
    case 'done':
      return t.done(elapsed)
    case 'failed':
      return t.failed(elapsed)
    case 'interrupted':
      return t.interrupted(elapsed)
  }
}

function render({ session, now, language }: TooltipData): void {
  const t = strings(language)
  const badge = el('badge')
  badge.textContent = AGENT_NAMES[session.agentType] ?? session.agentType
  badge.style.background = AGENT_COLORS[session.agentType] ?? '#b9a0e0'
  el('workspace').textContent = session.host ? `${session.workspace} · ${t.remoteHost(session.host)}` : session.workspace
  el('title').textContent = session.title || t.untitled
  const status = el('status')
  status.textContent = statusText(t, session, now) + (session.unread ? t.unread : '')
  status.style.color = STATUS_COLORS[session.status]
  const message = el('message')
  message.textContent = session.lastMessage
  message.style.display = session.lastMessage ? '' : 'none'
  const hint = el('hint')
  hint.textContent = session.worktreeId ? t.clickHint : ''
  hint.style.display = session.worktreeId ? '' : 'none'
  // Report the rendered height so the window can be sized to fit.
  // requestAnimationFrame doesn't run while the window is hidden, so force layout and report right away.
  window.tooltip.reportHeight(el('card').getBoundingClientRect().height)
}

window.tooltip.onData(render)
