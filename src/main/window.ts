import { BrowserWindow, ipcMain, screen, type Display, type Rectangle } from 'electron'
import { join } from 'node:path'
import { MIN_WIDTH_FRACTION, SCENE_HEIGHT, type Layout, type Settings } from '../shared/types'
import { getSettings, updateSettings } from './settings'

let win: BrowserWindow | null = null

/** Finds the configured monitor, falling back to the primary one if it was disconnected */
export function resolveDisplay(settings: Settings): Display {
  const displays = screen.getAllDisplays()
  return displays.find((d) => d.id === settings.displayId) ?? screen.getPrimaryDisplay()
}

/** Position and size of the strip docked to the bottom of the work area (above the taskbar) */
function computeBounds(settings: Settings): Rectangle {
  const area = resolveDisplay(settings).workArea
  const height = SCENE_HEIGHT * settings.scale
  // Round the width to a multiple of the scale so scene pixels aren't cut
  const width = Math.floor((area.width * settings.widthFraction) / settings.scale) * settings.scale
  const free = area.width - width
  const offset =
    settings.align === 'left'
      ? 0
      : settings.align === 'right'
        ? free
        : settings.align === 'custom'
          ? Math.min(free, Math.round(settings.leftFraction * area.width))
          : Math.floor(free / 2)
  return { x: area.x + offset, y: area.y + area.height - height, width, height }
}

function layoutOf(settings: Settings, bounds: Rectangle): Layout {
  return { scale: settings.scale, sceneWidth: bounds.width / settings.scale, sceneHeight: SCENE_HEIGHT }
}

export function createWindow(): BrowserWindow {
  const settings = getSettings()
  win = new BrowserWindow({
    ...computeBounds(settings),
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    // Never take focus, so typing in other windows isn't interrupted
    focusable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  // Click-through by default. The forward option still delivers mouse moves to the renderer for hover detection
  win.setIgnoreMouseEvents(true, { forward: true })
  win.loadFile(join(__dirname, 'index.html'))
  win.once('ready-to-show', () => {
    if (getSettings().visible) win?.showInactive()
  })
  win.on('closed', () => {
    win = null
  })
  return win
}

export function getStripBounds(): Rectangle | null {
  return win ? win.getBounds() : null
}

export function sendToRenderer(channel: string, payload: unknown): void {
  if (win && !win.webContents.isLoading()) win.webContents.send(channel, payload)
}

/** Re-places the window after settings or monitors change and tells the renderer the new scene size */
export function applyLayout(): void {
  if (!win) return
  const settings = getSettings()
  const bounds = computeBounds(settings)
  win.setBounds(bounds)
  win.webContents.send('layout', layoutOf(settings, bounds))
  if (settings.visible && !win.isVisible()) win.showInactive()
  if (!settings.visible && win.isVisible()) win.hide()
}

/** onResized: called after a drag resize has been saved (to refresh the tray menu) */
export function registerWindowIpc(onResized: () => void): void {
  ipcMain.handle('get-layout', () => {
    const settings = getSettings()
    return layoutOf(settings, computeBounds(settings))
  })
  ipcMain.on('set-interactive', (_event, interactive: boolean) => {
    win?.setIgnoreMouseEvents(!interactive, { forward: true })
  })

  // Dragging a strip edge changes its width. The cursor position is read in the main process, in window coordinates
  ipcMain.on('resize-drag', (_event, edge: 'left' | 'right') => {
    if (!win) return
    const settings = getSettings()
    const area = resolveDisplay(settings).workArea
    const current = win.getBounds()
    const minWidth = Math.ceil((area.width * MIN_WIDTH_FRACTION) / settings.scale) * settings.scale
    const cursorX = screen.getCursorScreenPoint().x
    let left = current.x
    let right = current.x + current.width
    if (edge === 'left') left = Math.max(area.x, Math.min(cursorX, right - minWidth))
    else right = Math.min(area.x + area.width, Math.max(cursorX, left + minWidth))
    // Snap the width to a multiple of the scale and keep the opposite edge fixed
    const width = Math.floor((right - left) / settings.scale) * settings.scale
    const x = edge === 'left' ? right - width : left
    if (x === current.x && width === current.width) return
    const bounds = { x, y: current.y, width, height: current.height }
    win.setBounds(bounds)
    win.webContents.send('layout', layoutOf(settings, bounds))
  })
  ipcMain.on('resize-end', () => {
    if (!win) return
    const area = resolveDisplay(getSettings()).workArea
    const bounds = win.getBounds()
    updateSettings({
      align: 'custom',
      leftFraction: (bounds.x - area.x) / area.width,
      widthFraction: Math.min(1, bounds.width / area.width),
    })
    onResized()
  })
}
