import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'node:path'
import type { HoverTarget, TooltipData } from '../shared/types'
import { findSession, onSessionsChanged } from './session-hub'
import { getStripBounds } from './window'

// 캐릭터 위에 뜨는 정보 툴팁. 띠 창은 높이가 낮아 글자를 담을 수 없으므로 별도의 작은 창을 띠 위에 띄운다.

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
      // 숨겨진 동안에도 내용 갱신과 크기 계산이 멈추지 않게 한다
      backgroundThrottling: false,
    },
  })
  tip.setAlwaysOnTop(true, 'screen-saver')
  tip.setIgnoreMouseEvents(true)
  tip.loadFile(join(__dirname, 'tooltip.html'))
  tip.on('closed', () => {
    tip = null
  })

  // 툴팁이 내용을 그린 뒤 실제 높이를 알려오면 그 크기로 캐릭터 위에 배치한다
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
  const data: TooltipData = { session, now: Date.now() }
  tip.webContents.send('tooltip-data', data)
}

export function hideTooltip(): void {
  hover = null
  if (tip?.isVisible()) tip.hide()
}
