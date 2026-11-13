import { contextBridge, ipcRenderer } from 'electron'
import type { TooltipApi, TooltipData } from '../shared/types'

const api: TooltipApi = {
  onData: (callback) => {
    ipcRenderer.on('tooltip-data', (_event, data: TooltipData) => callback(data))
  },
  reportHeight: (height) => ipcRenderer.send('tooltip-height', height),
}

contextBridge.exposeInMainWorld('tooltip', api)
