import { startDemo, stopDemo } from './demo'
import { startPoller, stopPoller, type PollerStatus } from './orca-poller'
import { getSettings } from './settings'

// 세션 공급원(Orca 폴러 / 데모)을 설정에 맞게 켜고 끈다.

let statusListener: (text: string) => void = () => {}

function describe(status: PollerStatus): string {
  if (!status.connected) return 'Orca 연결 안 됨'
  const remote =
    status.remotes === 0
      ? ''
      : status.remotesDown > 0
        ? ` · 원격 ${status.remotes - status.remotesDown}/${status.remotes}`
        : ` · 원격 ${status.remotes}`
  return `Orca 연결됨${remote} · 작업 중 ${status.working} · 표시 ${status.shown}/${status.total}`
}

export function onSourceStatus(listener: (text: string) => void): void {
  statusListener = listener
}

export function isDemoActive(): boolean {
  return getSettings().demoMode || process.env.TASKBAR_OFFICE_DEMO !== undefined
}

export function applySource(): void {
  stopPoller()
  stopDemo()
  if (isDemoActive()) {
    startDemo()
    statusListener('데모 모드')
  } else {
    statusListener('Orca 연결 중')
    let last = ''
    startPoller((status) => {
      const text = describe(status)
      if (text !== last) console.log(text, status.connected ? '' : `(${status.reason})`)
      last = text
      statusListener(text)
    })
  }
}
