import type { Layout } from '../shared/types'

// Work labels: a short line of what each working character is doing, drawn in the lane at the top of the strip.
// Drawn on its own canvas at device resolution so text stays sharp and can show any script, Hangul included.

/** Pulls the interesting field out of a JSON-shaped tool input (agents differ in how they report it) */
function fromJson(text: string): string | null {
  try {
    const value = JSON.parse(text) as Record<string, unknown>
    for (const key of ['command', 'cmd', 'file_path', 'path', 'pattern', 'query', 'url', 'description']) {
      const field = value[key]
      if (typeof field === 'string' && field) return field
      if (Array.isArray(field) && field.every((f) => typeof f === 'string')) return field.join(' ')
    }
  } catch {
    // Cut short by Orca: take the first string of a known field by pattern instead
    const match = /"(?:command|cmd|file_path|path|pattern|query|url)"\s*:\s*\[?\s*"((?:[^"\\]|\\.)*)"/.exec(text)
    if (match) return match[1]
  }
  return null
}

/** First two words of a shell command, skipping wrappers such as "cd dir &&", "timeout 20" or "bash -lc" */
function shortCommand(text: string): string {
  let t = text.trim()
  for (let i = 0; i < 10; i++) {
    const next = t
      .replace(/^cd\s+("[^"]*"|'[^']*'|\S+)\s*(&&|;)\s*/, '')
      .replace(/^(sudo|env|time|nohup)\s+/, '')
      .replace(/^timeout\s+\S+\s+/, '')
      .replace(/^\w+=("[^"]*"|'[^']*'|\S*)\s+/, '')
      .replace(/^((ba|z)?sh|cmd(\.exe)?)\s+(-l?c|\/c)\s+/i, '')
      .replace(/^(pwsh|powershell)(\.exe)?\s+(-\w+\s+)*?-(c|command)\s+/i, '')
      .replace(/^["']/, '')
    if (next === t) break
    t = next
  }
  const words = t.split(/\s+/)
  // "npm run build" says more than "npm run"
  const count = /^(run|exec|x)$/.test(words[1] ?? '') ? 3 : 2
  return words.slice(0, count).join(' ').replace(/["']+$/, '')
}

const baseName = (path: string): string => path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || path

/** Short label for a working session: file name for file tools, the first words of a command, and so on */
export function workLabel(tool: string | null, input: string | null, title: string): string {
  let text = (input ?? '').replace(/…$/, '').trim()
  if (text.startsWith('{')) text = fromJson(text) ?? ''
  if (!text) return tool ?? title
  const name = (tool ?? '').toLowerCase()
  if (/edit|write|read|view|notebook|patch/.test(name)) return baseName(text)
  if (/bash|shell|powershell|exec|terminal|command|cmd/.test(name)) return shortCommand(text)
  if (/web|fetch|browser|http/.test(name)) {
    try {
      return new URL(text).hostname
    } catch {
      return text
    }
  }
  return text
}

export interface LabelAnchor {
  id: string
  /** Scene x of the character's center */
  cx: number
  text: string
  /** When the current status started. Newer work wins when labels compete for room */
  since: number
}

/** Widest a label may be, in scene pixels */
const MAX_WIDTH = 90
/** Closest two labels may be (center to center, scene pixels). Closer ones are dropped rather than cut to a stub */
const MIN_SPACING = 32
/** Space kept between neighbouring labels, in scene pixels */
const GAP = 3

/** Truncates with an ellipsis until the text fits */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1)
  return t + '…'
}

/**
 * Draws the labels. ctx is a canvas covering the whole strip at device resolution, already scaled so that
 * one unit is one scene pixel times layout.scale (a CSS pixel).
 */
export function drawLabels(ctx: CanvasRenderingContext2D, anchors: LabelAnchor[], layout: Layout, hoveredId: string | null): void {
  const s = layout.scale
  const boxH = layout.labelLane * s - 2
  const font = Math.round(boxH * 0.64)
  const padX = Math.round(font * 0.45)
  const radius = Math.min(6, boxH / 2)
  ctx.font = `600 ${font}px "Segoe UI", "Malgun Gothic", sans-serif`
  ctx.textBaseline = 'middle'

  // Pick who gets a label: the hovered character first, then the most recent work, skipping anyone too close
  const kept: LabelAnchor[] = []
  const byPriority = [...anchors].sort((a, b) => Number(b.id === hoveredId) - Number(a.id === hoveredId) || b.since - a.since)
  for (const a of byPriority) if (kept.every((k) => Math.abs(k.cx - a.cx) >= MIN_SPACING)) kept.push(a)

  const sorted = kept.sort((a, b) => a.cx - b.cx)
  sorted.forEach((a, i) => {
    // Each label may use up to the distance to its nearest neighbour, so neighbours never overlap
    let room = MAX_WIDTH
    if (i > 0) room = Math.min(room, a.cx - sorted[i - 1].cx - GAP)
    if (i < sorted.length - 1) room = Math.min(room, sorted[i + 1].cx - a.cx - GAP)
    const text = fit(ctx, a.text, room * s - padX * 2)
    const w = Math.ceil(ctx.measureText(text).width) + padX * 2
    const x = Math.max(0, Math.min(layout.sceneWidth * s - w, Math.round(a.cx * s - w / 2)))
    const hovered = a.id === hoveredId

    ctx.fillStyle = 'rgba(30, 26, 40, 0.88)'
    ctx.beginPath()
    ctx.roundRect(x, 1, w, boxH, radius)
    ctx.fill()
    if (hovered) {
      // Same yellow as the hover outline, to tie the label to its character
      ctx.strokeStyle = '#ffe066'
      ctx.lineWidth = 2
      ctx.stroke()
    }
    ctx.fillStyle = '#f2f2ec'
    ctx.fillText(text, x + padX, 1 + boxH / 2 + 1)
  })
}
