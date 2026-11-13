import { app, Menu, screen, Tray, type MenuItemConstructorOptions } from 'electron'
import { MAX_SCALE, MIN_SCALE, SCENE_HEIGHT, type Align, type Settings } from '../shared/types'
import { demo } from './demo'
import { createTrayIcon } from './icon'
import { getEnvironments } from './orca-poller'
import { getSettings, updateSettings } from './settings'
import { applySource, isDemoActive } from './source'
import { applyLayout, resolveDisplay } from './window'

let tray: Tray | null = null
let status = ''

/** 세션 공급원의 상태를 트레이 툴팁과 메뉴 첫 줄에 보여준다 */
export function setTrayStatus(text: string): void {
  if (text === status) return
  status = text
  tray?.setToolTip(`Taskbar Office · ${text}`)
  refreshTrayMenu()
}

const WIDTHS: { label: string; value: number }[] = [
  { label: '전체', value: 1 },
  { label: '3/4', value: 0.75 },
  { label: '절반', value: 0.5 },
  { label: '1/3', value: 1 / 3 },
]

const ALIGNS: { label: string; value: Align }[] = [
  { label: '왼쪽', value: 'left' },
  { label: '가운데', value: 'center' },
  { label: '오른쪽', value: 'right' },
]

const RETIRE_OPTIONS: { label: string; minutes: number }[] = [
  { label: '10분 뒤', minutes: 10 },
  { label: '30분 뒤', minutes: 30 },
  { label: '1시간 뒤', minutes: 60 },
  { label: '3시간 뒤', minutes: 180 },
  { label: '하루 뒤', minutes: 24 * 60 },
  { label: '퇴근시키지 않음', minutes: 0 },
]

const MAX_CHARACTER_OPTIONS = [6, 12, 20, 30]

/**
 * 자동 실행 등록에 쓸 실행 파일과 인자.
 * 설치본은 자기 자신을 등록하면 되지만, 개발 중에는 electron.exe에 프로젝트 폴더를 넘겨야 한다.
 */
function loginItemOptions(): { path: string; args: string[] } {
  return app.isPackaged ? { path: process.execPath, args: [] } : { path: process.execPath, args: [app.getAppPath()] }
}

function change(patch: Partial<Settings>): void {
  updateSettings(patch)
  applyLayout()
  refreshTrayMenu()
}

function displayItems(settings: Settings): MenuItemConstructorOptions[] {
  const primaryId = screen.getPrimaryDisplay().id
  const activeId = resolveDisplay(settings).id
  // 왼쪽에 있는 모니터부터 번호를 매긴다
  const displays = [...screen.getAllDisplays()].sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y)
  return displays.map((d, i) => ({
    label: `모니터 ${i + 1} (${d.size.width}×${d.size.height})${d.id === primaryId ? ' · 주 모니터' : ''}`,
    type: 'radio',
    checked: d.id === activeId,
    click: () => change({ displayId: d.id }),
  }))
}

export function refreshTrayMenu(): void {
  if (!tray) return
  const settings = getSettings()
  const demoActive = isDemoActive()
  const environments = getEnvironments()
  const scales: MenuItemConstructorOptions[] = []
  for (let s = MIN_SCALE; s <= MAX_SCALE; s++) {
    scales.push({
      label: `${s}배 (높이 ${SCENE_HEIGHT * s}px)`,
      type: 'radio',
      checked: settings.scale === s,
      click: () => change({ scale: s }),
    })
  }
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '오피스 보이기', type: 'checkbox', checked: settings.visible, click: (item) => change({ visible: item.checked }) },
      { type: 'separator' },
      { label: '크기', submenu: scales },
      {
        label: '폭',
        submenu: WIDTHS.map((w) => ({
          label: w.label,
          type: 'radio',
          checked: Math.abs(settings.widthFraction - w.value) < 0.001,
          // 드래그로 정한 위치는 폭을 고르면 가운데 정렬로 되돌린다
          click: () => change({ widthFraction: w.value, align: settings.align === 'custom' ? 'center' : settings.align }),
        })),
      },
      {
        label: '위치',
        enabled: settings.widthFraction < 1,
        submenu: [
          ...ALIGNS.map(
            (a): MenuItemConstructorOptions => ({
              label: a.label,
              type: 'radio',
              checked: settings.align === a.value,
              click: () => change({ align: a.value }),
            }),
          ),
          { label: '직접 조절 (띠 끝을 드래그)', type: 'radio', checked: settings.align === 'custom', enabled: false },
        ],
      },
      { label: '모니터', submenu: displayItems(settings) },
      { type: 'separator' },
      {
        label: '퇴근 기준 (작업이 끝난 뒤)',
        submenu: RETIRE_OPTIONS.map((o) => ({
          label: o.label,
          type: 'radio',
          checked: settings.retireMinutes === o.minutes,
          click: () => change({ retireMinutes: o.minutes }),
        })),
      },
      {
        label: '최대 인원',
        submenu: MAX_CHARACTER_OPTIONS.map((n) => ({
          label: `${n}명`,
          type: 'radio',
          checked: settings.maxCharacters === n,
          click: () => change({ maxCharacters: n }),
        })),
      },
      {
        label: 'Windows 시작 시 실행',
        type: 'checkbox',
        checked: app.getLoginItemSettings(loginItemOptions()).openAtLogin,
        click: (item) => {
          app.setLoginItemSettings({ ...loginItemOptions(), openAtLogin: item.checked })
          refreshTrayMenu()
        },
      },
      { type: 'separator' },
      { label: status, enabled: false },
      {
        label: '원격 환경',
        enabled: !demoActive && environments.length > 0,
        submenu: environments.map((e) => ({
          label: e.name,
          type: 'checkbox',
          checked: !settings.disabledEnvironments.includes(e.id),
          click: (item) => {
            const others = getSettings().disabledEnvironments.filter((id) => id !== e.id)
            updateSettings({ disabledEnvironments: item.checked ? others : [...others, e.id] })
            refreshTrayMenu()
          },
        })),
      },
      {
        label: '데모 모드 (가짜 세션)',
        type: 'checkbox',
        checked: demoActive,
        click: (item) => {
          updateSettings({ demoMode: item.checked })
          applySource()
          refreshTrayMenu()
        },
      },
      {
        label: '데모 조작',
        enabled: demoActive,
        submenu: [
          { label: '자동 진행', type: 'checkbox', checked: demo.isAuto(), click: (item) => demo.setAuto(item.checked) },
          { type: 'separator' },
          { label: '세션 추가 (출근)', click: () => demo.add() },
          { label: '작업 시작', click: () => demo.start() },
          { label: '응답 대기', click: () => demo.finish('waiting') },
          { label: '작업 완료', click: () => demo.finish('done') },
          { label: '작업 실패', click: () => demo.finish('failed') },
          { label: '작업 중단', click: () => demo.finish('interrupted') },
          { label: '세션 제거 (퇴근)', click: () => demo.remove() },
        ],
      },
      { type: 'separator' },
      { label: '종료', click: () => app.quit() },
    ]),
  )
}

export function createTray(): void {
  tray = new Tray(createTrayIcon())
  tray.setToolTip('Taskbar Office')
  // 왼쪽 클릭은 보이기/숨기기 전환
  tray.on('click', () => change({ visible: !getSettings().visible }))
  refreshTrayMenu()
}
