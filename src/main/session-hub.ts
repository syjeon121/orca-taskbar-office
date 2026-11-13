import { ipcMain } from 'electron'
import type { SessionInfo } from '../shared/types'
import { sendToRenderer } from './window'

// Holds the current session list and forwards it to the renderer. The source is the Orca poller or the demo.

let current: SessionInfo[] = []
let markReady: () => void = () => {}
const ready = new Promise<void>((resolve) => {
  markReady = resolve
})
const listeners: (() => void)[] = []

export function publishSessions(sessions: SessionInfo[]): void {
  current = sessions
  markReady()
  sendToRenderer('sessions', sessions)
  for (const listener of listeners) listener()
}

export function findSession(id: string): SessionInfo | undefined {
  return current.find((s) => s.id === id)
}

/** Called whenever the list changes */
export function onSessionsChanged(listener: () => void): void {
  listeners.push(listener)
}

export function registerSessionIpc(): void {
  // The first list the renderer receives becomes characters that are "already in place".
  // Wait briefly for the source's first result so everyone doesn't rush in through the door on startup.
  ipcMain.handle('get-sessions', async () => {
    await Promise.race([ready, new Promise((resolve) => setTimeout(resolve, 3000))])
    return current
  })
}
