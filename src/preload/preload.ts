import { contextBridge, ipcRenderer } from 'electron'
import type { Layout, OfficeApi, SessionInfo } from '../shared/types'

const api: OfficeApi = {
  hover: (target) => ipcRenderer.send('hover', target),
  getLayout: () => ipcRenderer.invoke('get-layout'),
  onLayout: (callback) => {
    ipcRenderer.on('layout', (_event, layout: Layout) => callback(layout))
  },
  getSessions: () => ipcRenderer.invoke('get-sessions'),
  onSessions: (callback) => {
    ipcRenderer.on('sessions', (_event, sessions: SessionInfo[]) => callback(sessions))
  },
  setInteractive: (interactive) => ipcRenderer.send('set-interactive', interactive),
  resizeDrag: (edge) => ipcRenderer.send('resize-drag', edge),
  resizeEnd: () => ipcRenderer.send('resize-end'),
  characterClicked: (id) => ipcRenderer.send('character-clicked', id),
}

contextBridge.exposeInMainWorld('office', api)
