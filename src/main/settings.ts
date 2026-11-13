import { app } from 'electron'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { LANGUAGES, type Language } from '../shared/i18n'
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
  language: 'en',
}

const ALIGNS: Align[] = ['left', 'center', 'right', 'custom']

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

/** Settings file from before the rename (Agent Office). Read once when no new settings exist */
function legacySettingsPath(): string {
  return join(app.getPath('appData'), 'agent-office', 'settings.json')
}

function numberIn(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : fallback
}

/** Resets only the fields that are corrupt or out of range back to their defaults */
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
    language: LANGUAGES.some((l) => l.value === r.language) ? (r.language as Language) : DEFAULTS.language,
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
        // Missing or corrupt: try the next candidate, falling back to defaults
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
    console.error('Failed to save settings:', err)
  }
  return current
}
