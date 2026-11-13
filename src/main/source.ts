import type { Language } from '../shared/i18n'
import { strings } from '../shared/i18n'
import { startDemo, stopDemo } from './demo'
import { startPoller, stopPoller, type PollerStatus } from './orca-poller'
import { getSettings } from './settings'

// Starts and stops the session source (Orca poller or demo) according to the settings.

type SourceState = { kind: 'demo' } | { kind: 'connecting' } | { kind: 'poller'; status: PollerStatus }

let state: SourceState = { kind: 'connecting' }
let statusListener: () => void = () => {}

/** Current source status as text, in the given language */
export function sourceStatusText(language: Language): string {
  const t = strings(language)
  switch (state.kind) {
    case 'demo':
      return t.statusDemo
    case 'connecting':
      return t.statusConnecting
    case 'poller': {
      const s = state.status
      if (!s.connected) return t.statusDisconnected
      const remote = s.remotes === 0 ? '' : t.statusRemotes(s.remotes - s.remotesDown, s.remotes)
      return t.statusConnected(remote, s.working, s.shown, s.total)
    }
  }
}

/** listener is called whenever the status changes; read the text with sourceStatusText */
export function onSourceStatus(listener: () => void): void {
  statusListener = listener
}

export function isDemoActive(): boolean {
  return getSettings().demoMode || process.env.TASKBAR_OFFICE_DEMO !== undefined
}

function setState(next: SourceState): void {
  state = next
  statusListener()
}

export function applySource(): void {
  stopPoller()
  stopDemo()
  if (isDemoActive()) {
    startDemo()
    setState({ kind: 'demo' })
  } else {
    setState({ kind: 'connecting' })
    let last = ''
    startPoller((status) => {
      setState({ kind: 'poller', status })
      const text = sourceStatusText('en')
      if (text !== last) console.log(text, status.connected ? '' : `(${status.reason})`)
      last = text
    })
  }
}
