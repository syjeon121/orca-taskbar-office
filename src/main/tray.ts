import { app, Menu, screen, Tray, type MenuItemConstructorOptions } from 'electron'
import { LANGUAGES, strings, type Strings } from '../shared/i18n'
import { MAX_SCALE, MIN_SCALE, SCENE_HEIGHT, type Align, type Settings } from '../shared/types'
import { demo } from './demo'
import { createTrayIcon } from './icon'
import { getEnvironments } from './orca-poller'
import { getSettings, updateSettings } from './settings'
import { applySource, isDemoActive, sourceStatusText } from './source'
import { applyLayout, resolveDisplay } from './window'

let tray: Tray | null = null
let status = ''

/** Shows the session source status in the tray tooltip and the first menu line */
export function refreshTrayStatus(): void {
  const text = sourceStatusText(getSettings().language)
  if (text === status) return
  status = text
  tray?.setToolTip(`Taskbar Office · ${text}`)
  refreshTrayMenu()
}

const WIDTHS: { label: (t: Strings) => string; value: number }[] = [
  { label: (t) => t.widthFull, value: 1 },
  { label: () => '3/4', value: 0.75 },
  { label: (t) => t.widthHalf, value: 0.5 },
  { label: () => '1/3', value: 1 / 3 },
]

const ALIGNS: { label: (t: Strings) => string; value: Align }[] = [
  { label: (t) => t.alignLeft, value: 'left' },
  { label: (t) => t.alignCenter, value: 'center' },
  { label: (t) => t.alignRight, value: 'right' },
]

/** Minutes before finished sessions go home. 0 means never */
const RETIRE_MINUTES = [10, 30, 60, 180, 24 * 60, 0]

const MAX_CHARACTER_OPTIONS = [6, 12, 20, 30]

/**
 * Executable and arguments to register for launch at login.
 * The installed app registers itself; in development electron.exe must be given the project folder.
 */
function loginItemOptions(): { path: string; args: string[] } {
  return app.isPackaged ? { path: process.execPath, args: [] } : { path: process.execPath, args: [app.getAppPath()] }
}

function change(patch: Partial<Settings>): void {
  updateSettings(patch)
  applyLayout()
  refreshTrayMenu()
}

function displayItems(t: Strings, settings: Settings): MenuItemConstructorOptions[] {
  const primaryId = screen.getPrimaryDisplay().id
  const activeId = resolveDisplay(settings).id
  // Number monitors from left to right
  const displays = [...screen.getAllDisplays()].sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y)
  return displays.map((d, i) => ({
    label: t.monitorOption(i + 1, d.size.width, d.size.height, d.id === primaryId),
    type: 'radio',
    checked: d.id === activeId,
    click: () => change({ displayId: d.id }),
  }))
}

export function refreshTrayMenu(): void {
  if (!tray) return
  const settings = getSettings()
  const t = strings(settings.language)
  const demoActive = isDemoActive()
  const environments = getEnvironments()
  const scales: MenuItemConstructorOptions[] = []
  for (let s = MIN_SCALE; s <= MAX_SCALE; s++) {
    scales.push({
      label: t.scaleOption(s, SCENE_HEIGHT * s),
      type: 'radio',
      checked: settings.scale === s,
      click: () => change({ scale: s }),
    })
  }
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: t.showOffice, type: 'checkbox', checked: settings.visible, click: (item) => change({ visible: item.checked }) },
      { type: 'separator' },
      { label: t.size, submenu: scales },
      {
        label: t.width,
        submenu: WIDTHS.map((w) => ({
          label: w.label(t),
          type: 'radio',
          checked: Math.abs(settings.widthFraction - w.value) < 0.001,
          // Picking a width resets a dragged position back to centered
          click: () => change({ widthFraction: w.value, align: settings.align === 'custom' ? 'center' : settings.align }),
        })),
      },
      {
        label: t.position,
        enabled: settings.widthFraction < 1,
        submenu: [
          ...ALIGNS.map(
            (a): MenuItemConstructorOptions => ({
              label: a.label(t),
              type: 'radio',
              checked: settings.align === a.value,
              click: () => change({ align: a.value }),
            }),
          ),
          { label: t.alignCustom, type: 'radio', checked: settings.align === 'custom', enabled: false },
        ],
      },
      { label: t.monitor, submenu: displayItems(t, settings) },
      { type: 'separator' },
      {
        label: t.goHome,
        submenu: RETIRE_MINUTES.map((minutes) => ({
          label: minutes === 0 ? t.goHomeNever : t.goHomeAfter(minutes),
          type: 'radio',
          checked: settings.retireMinutes === minutes,
          click: () => change({ retireMinutes: minutes }),
        })),
      },
      {
        label: t.maxCharacters,
        submenu: MAX_CHARACTER_OPTIONS.map((n) => ({
          label: t.characterCount(n),
          type: 'radio',
          checked: settings.maxCharacters === n,
          click: () => change({ maxCharacters: n }),
        })),
      },
      {
        label: t.launchAtStartup,
        type: 'checkbox',
        checked: app.getLoginItemSettings(loginItemOptions()).openAtLogin,
        click: (item) => {
          app.setLoginItemSettings({ ...loginItemOptions(), openAtLogin: item.checked })
          refreshTrayMenu()
        },
      },
      {
        label: t.language,
        submenu: LANGUAGES.map((l) => ({
          label: l.label,
          type: 'radio',
          checked: settings.language === l.value,
          click: () => {
            updateSettings({ language: l.value })
            status = ''
            refreshTrayStatus()
            refreshTrayMenu()
          },
        })),
      },
      { type: 'separator' },
      { label: status, enabled: false },
      {
        label: t.remoteEnvironments,
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
        label: t.demoMode,
        type: 'checkbox',
        checked: demoActive,
        click: (item) => {
          updateSettings({ demoMode: item.checked })
          applySource()
          refreshTrayMenu()
        },
      },
      {
        label: t.demoControls,
        enabled: demoActive,
        submenu: [
          { label: t.demoAuto, type: 'checkbox', checked: demo.isAuto(), click: (item) => demo.setAuto(item.checked) },
          { type: 'separator' },
          { label: t.demoAdd, click: () => demo.add() },
          { label: t.demoStart, click: () => demo.start() },
          { label: t.demoWaiting, click: () => demo.finish('waiting') },
          { label: t.demoDone, click: () => demo.finish('done') },
          { label: t.demoFailed, click: () => demo.finish('failed') },
          { label: t.demoInterrupted, click: () => demo.finish('interrupted') },
          { label: t.demoRemove, click: () => demo.remove() },
        ],
      },
      { type: 'separator' },
      { label: t.quit, click: () => app.quit() },
    ]),
  )
}

export function createTray(): void {
  tray = new Tray(createTrayIcon())
  tray.setToolTip('Taskbar Office')
  // Left click toggles visibility
  tray.on('click', () => change({ visible: !getSettings().visible }))
  refreshTrayMenu()
}
