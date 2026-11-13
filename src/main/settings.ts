import { app } from 'electron'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { MAX_SCALE, MIN_SCALE, MIN_WIDTH_FRACTION, type Align, type Settings } from '../shared/types'

const DEFAULTS: Settings = {
  scale: 4,
  widthFraction: 1,
  align: 'center',
  leftFraction: 0,
  retireMinutes: 30,
  maxCharacters: 12,
  displayId: null,
  visible: true,
  demoMode: false,
  disabledEnvironments: [],
}

const ALIGNS: Align[] = ['left', 'center', 'right', 'custom']

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

/** 이름을 바꾸기 전(Agent Office)의 설정 파일. 새 설정이 없을 때 한 번 읽어 온다 */
function legacySettingsPath(): string {
  return join(app.getPath('appData'), 'agent-office', 'settings.json')
}

function numberIn(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : fallback
}

/** 저장된 값이 손상됐거나 범위를 벗어나면 해당 항목만 기본값으로 되돌린다 */
function sanitize(raw: unknown): Settings {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  return {
    scale: Number.isInteger(r.scale) ? Math.min(MAX_SCALE, Math.max(MIN_SCALE, r.scale as number)) : DEFAULTS.scale,
    widthFraction: numberIn(r.widthFraction, MIN_WIDTH_FRACTION, 1, DEFAULTS.widthFraction),
    align: ALIGNS.includes(r.align as Align) ? (r.align as Align) : DEFAULTS.align,
    leftFraction: numberIn(r.leftFraction, 0, 1, DEFAULTS.leftFraction),
    retireMinutes: Math.round(numberIn(r.retireMinutes, 0, 7 * 24 * 60, DEFAULTS.retireMinutes)),
    maxCharacters: Math.round(numberIn(r.maxCharacters, 1, 60, DEFAULTS.maxCharacters)),
    displayId: typeof r.displayId === 'number' ? r.displayId : null,
    visible: typeof r.visible === 'boolean' ? r.visible : DEFAULTS.visible,
    demoMode: r.demoMode === true,
    disabledEnvironments: Array.isArray(r.disabledEnvironments)
      ? r.disabledEnvironments.filter((id): id is string => typeof id === 'string')
      : [],
  }
}

let current: Settings | null = null

export function getSettings(): Settings {
  if (!current) {
    current = { ...DEFAULTS }
    for (const path of [settingsPath(), legacySettingsPath()]) {
      try {
        current = sanitize(JSON.parse(readFileSync(path, 'utf8')))
        break
      } catch {
        // 없거나 손상된 파일이면 다음 후보, 다 없으면 기본값
      }
    }
  }
  return current
}

export function updateSettings(patch: Partial<Settings>): Settings {
  current = sanitize({ ...getSettings(), ...patch })
  try {
    const tmp = settingsPath() + '.tmp'
    writeFileSync(tmp, JSON.stringify(current, null, 2))
    renameSync(tmp, settingsPath())
  } catch (err) {
    console.error('설정 저장 실패:', err)
  }
  return current
}
