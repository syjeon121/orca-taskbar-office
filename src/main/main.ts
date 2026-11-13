import { app, ipcMain, screen } from 'electron'
import { writeFileSync } from 'node:fs'
import { openInOrca } from './orca-actions'
import { findSession, registerSessionIpc } from './session-hub'
import { createTooltip, hideTooltip } from './tooltip'
import { applySource, onSourceStatus } from './source'
import { createTray, refreshTrayMenu, refreshTrayStatus } from './tray'
import { applyLayout, createWindow, registerWindowIpc } from './window'

// The installed app (product name "Taskbar Office") and dev runs share one settings folder (%APPDATA%\orca-taskbar-office)
app.setName('orca-taskbar-office')

// TASKBAR_OFFICE_SNAPSHOT=<png path>: saves the scene canvas as a PNG a few seconds after start
// (TASKBAR_OFFICE_SNAPSHOT_DELAY, default 7000 ms). A dev aid for when you can't see the screen (locked, remote).
const snapshotPath = process.env.TASKBAR_OFFICE_SNAPSHOT
// Keep rendering even when the window is covered
if (snapshotPath) app.commandLine.appendSwitch('disable-features', 'CalcNativeWinOcclusion')

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.whenReady().then(() => {
    registerWindowIpc(refreshTrayMenu)
    registerSessionIpc()
    const win = createWindow()
    if (snapshotPath) {
      const delay = Number(process.env.TASKBAR_OFFICE_SNAPSHOT_DELAY ?? 7000)
      setTimeout(async () => {
        const url: string = await win.webContents.executeJavaScript("document.getElementById('scene').toDataURL('image/png')")
        writeFileSync(snapshotPath, Buffer.from(url.split(',')[1], 'base64'))
      }, delay)
    }
    createTooltip()
    createTray()

    ipcMain.on('character-clicked', (_event, id: string) => {
      const session = findSession(id)
      hideTooltip()
      // Demo sessions have no workspace
      if (session?.worktreeId) void openInOrca(session.worktreeId, session.environmentId)
    })
    onSourceStatus(refreshTrayStatus)
    applySource()

    // Re-place the strip when monitors, resolution, DPI scale or the taskbar size change
    const onDisplaysChanged = (): void => {
      applyLayout()
      refreshTrayMenu()
    }
    screen.on('display-added', onDisplaysChanged)
    screen.on('display-removed', onDisplaysChanged)
    screen.on('display-metrics-changed', onDisplaysChanged)
  })

  // Stay in the tray when windows close. Quitting is only done from the tray menu.
  app.on('window-all-closed', () => {})
}
