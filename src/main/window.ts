import { BrowserWindow, ipcMain, screen, type Display, type Rectangle } from 'electron'
import { join } from 'node:path'
import { MIN_WIDTH_FRACTION, SCENE_HEIGHT, type Layout, type Settings } from '../shared/types'
import { getSettings, updateSettings } from './settings'

let win: BrowserWindow | null = null

/** 설정된 모니터를 찾고, 없으면(분리됨) 주 모니터로 대체 */
export function resolveDisplay(settings: Settings): Display {
  const displays = screen.getAllDisplays()
  return displays.find((d) => d.id === settings.displayId) ?? screen.getPrimaryDisplay()
}

/** 작업 영역(작업표시줄 제외) 하단에 붙는 띠의 위치와 크기 */
function computeBounds(settings: Settings): Rectangle {
  const area = resolveDisplay(settings).workArea
  const height = SCENE_HEIGHT * settings.scale
  // 폭을 배율의 배수로 맞춰 장면 픽셀이 잘리지 않게 한다
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
    // 포커스를 가져가지 않아 작업 중인 창의 입력을 방해하지 않는다
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
  // 기본은 클릭 통과. forward 옵션으로 마우스 이동만 렌더러에 전달해 호버를 감지한다
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

/** 설정이나 모니터 구성이 바뀐 뒤 창을 다시 배치하고 렌더러에 새 장면 크기를 알린다 */
export function applyLayout(): void {
  if (!win) return
  const settings = getSettings()
  const bounds = computeBounds(settings)
  win.setBounds(bounds)
  win.webContents.send('layout', layoutOf(settings, bounds))
  if (settings.visible && !win.isVisible()) win.showInactive()
  if (!settings.visible && win.isVisible()) win.hide()
}

/** onResized: 드래그로 크기가 바뀌어 설정이 저장된 뒤 호출된다 (트레이 메뉴 갱신용) */
export function registerWindowIpc(onResized: () => void): void {
  ipcMain.handle('get-layout', () => {
    const settings = getSettings()
    return layoutOf(settings, computeBounds(settings))
  })
  ipcMain.on('set-interactive', (_event, interactive: boolean) => {
    win?.setIgnoreMouseEvents(!interactive, { forward: true })
  })

  // 띠 끝을 드래그해 폭을 바꾼다. 커서 위치는 창 좌표계와 같은 단위로 메인에서 직접 읽는다
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
    // 폭은 배율의 배수로 맞추고, 드래그하지 않는 쪽 끝은 고정한다
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
