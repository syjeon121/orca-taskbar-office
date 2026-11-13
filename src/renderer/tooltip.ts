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

function duration(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return '1분 미만'
  if (minutes < 60) return `${minutes}분`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 ${minutes % 60}분`
  return `${Math.floor(hours / 24)}일`
}

function statusText(session: SessionInfo, now: number): string {
  const elapsed = duration(Math.max(0, now - session.since))
  switch (session.status) {
    case 'working':
      return `작업 중${session.tool ? ` · ${session.tool}` : ''} · ${elapsed}째`
    case 'waiting':
      return `응답을 기다리는 중 · ${elapsed}째`
    case 'done':
      return `완료 · ${elapsed} 전`
    case 'failed':
      return `실패 · ${elapsed} 전`
    case 'interrupted':
      return `중단됨 · ${elapsed} 전`
  }
}

function render({ session, now }: TooltipData): void {
  const badge = el('badge')
  badge.textContent = AGENT_NAMES[session.agentType] ?? session.agentType
  badge.style.background = AGENT_COLORS[session.agentType] ?? '#b9a0e0'
  el('workspace').textContent = session.host ? `${session.workspace} · 원격 ${session.host}` : session.workspace
  el('title').textContent = session.title || '(제목 없음)'
  const status = el('status')
  status.textContent = statusText(session, now) + (session.unread ? ' · 아직 확인 안 함' : '')
  status.style.color = STATUS_COLORS[session.status]
  const message = el('message')
  message.textContent = session.lastMessage
  message.style.display = session.lastMessage ? '' : 'none'
  const hint = el('hint')
  hint.textContent = session.worktreeId ? '클릭하면 Orca에서 이 워크스페이스를 엽니다' : ''
  hint.style.display = session.worktreeId ? '' : 'none'
  // Report the rendered height so the window can be sized to fit.
  // requestAnimationFrame doesn't run while the window is hidden, so force layout and report right away.
  window.tooltip.reportHeight(el('card').getBoundingClientRect().height)
}

window.tooltip.onData(render)
