import { ipcMain } from 'electron'
import type { SessionInfo } from '../shared/types'
import { sendToRenderer } from './window'

// 세션 목록의 현재 값을 보관하고 렌더러에 전달한다. 공급원은 Orca 폴러 또는 데모.

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

/** 목록이 바뀔 때마다 호출된다 */
export function onSessionsChanged(listener: () => void): void {
  listeners.push(listener)
}

export function registerSessionIpc(): void {
  // 렌더러가 처음 받는 목록은 "이미 자리에 있는" 캐릭터가 된다.
  // 공급원의 첫 결과를 잠깐 기다려, 시작하자마자 전원이 문으로 몰려 들어오는 일을 막는다.
  ipcMain.handle('get-sessions', async () => {
    await Promise.race([ready, new Promise((resolve) => setTimeout(resolve, 3000))])
    return current
  })
}
