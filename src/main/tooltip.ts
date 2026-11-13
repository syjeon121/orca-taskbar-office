import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'node:path'
import type { HoverTarget, TooltipData } from '../shared/types'
import { findSession, onSessionsChanged } from './session-hub'
import { getSettings } from './settings'
import { getStripBounds } from './window'

// Info tooltip above a character. The strip window is too short to hold text, so a separate small window floats above it.

const WIDTH = 340
const GAP = 6

let tip: BrowserWindow | null = null
let hover: HoverTarget | null = null

export function createTooltip(): void {
  tip = new BrowserWindow({
    width: WIDTH,
    height: 100,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: join(__dirname, 'tooltip-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Keep updating content and measuring size while hidden
      backgroundThrottling: false,
    },
  })
  tip.setAlwaysOnTop(true, 'screen-saver')
  tip.setIgnoreMouseEvents(true)
  tip.loadFile(join(__dirname, 'tooltip.html'))
  tip.on('closed', () => {
    tip = null
  })

  // Once the tooltip reports its rendered height, place it above the character at that size
  ipcMain.on('tooltip-height', (_event, height: number) => {
    const strip = getStripBounds()
    if (!tip || !hover || !strip) return
    const area = screen.getDisplayMatching(strip).workArea
    const h = Math.ceil(height)
    const centerX = strip.x + hover.x * hover.scale
    const x = Math.round(Math.max(area.x + 4, Math.min(area.x + area.width - WIDTH - 4, centerX - WIDTH / 2)))
    tip.setBounds({ x, y: strip.y - h - GAP, width: WIDTH, height: h })
    if (!tip.isVisible()) tip.showInactive()
  })

  ipcMain.on('hover', (_event, target: HoverTarget | null) => {
    hover = target
    refresh()
  })
  onSessionsChanged(refresh)
}

function refresh(): void {
  if (!tip) return
  const session = hover ? findSession(hover.id) : undefined
  if (!session) {
    hideTooltip()
    return
  }
  const data: TooltipData = { session, now: Date.now(), language: getSettings().language }
  tip.webContents.send('tooltip-data', data)
}

export function hideTooltip(): void {
  hover = null
  if (tip?.isVisible()) tip.hide()
}
