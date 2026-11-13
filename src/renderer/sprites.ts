import { addOutline, makeSurface, mix, OUTLINE, OUTLINE_HOVER, shade } from './pixel'
import { CHAR_H, CHAR_W } from './scene'

// Draws characters and speech bubbles from rectangles. Looks and poses are pure code, no image files.

export type Pose = 'stand' | 'walk' | 'run' | 'lift' | 'talk' | 'type' | 'typeStand' | 'lapType' | 'standType' | 'sit' | 'wave' | 'cheer' | 'trouble' | 'drink'
export type ToolKind = 'terminal' | 'edit' | 'read' | 'search' | 'web' | 'agent'
export type BubbleKind = 'dots' | 'bang' | 'check' | 'fail' | 'pause' | 'talk' | ToolKind

/** Maps a tool name to a bubble icon. Tool names differ between agents, so this matches on name fragments */
export function toolKind(tool: string | null): ToolKind | null {
  if (!tool) return null
  const name = tool.toLowerCase()
  if (/task|agent/.test(name)) return 'agent'
  if (/web|fetch|browser|http/.test(name)) return 'web'
  if (/grep|glob|search|find|ls\b/.test(name)) return 'search'
  if (/edit|write|patch|notebook/.test(name)) return 'edit'
  if (/read|view|open|cat/.test(name)) return 'read'
  if (/bash|shell|powershell|exec|terminal|command|cmd/.test(name)) return 'terminal'
  return null
}

export interface Look {
  skin: string
  skinDark: string
  blush: string
  hair: string
  hairLight: string
  hairStyle: number
  /** Hat color. null means no hat */
  hat: string | null
  hatDark: string
  hatLight: string
  beard: boolean
  /** Shirt front detail: 0 none, 1 stripe, 2 tie, 3 suspenders */
  pattern: number
  accent: string
  shirt: string
  shirtDark: string
  shirtLight: string
  pants: string
  pantsDark: string
}

const SKINS = ['#fbe0c4', '#f6d3b0', '#eab98d', '#d9a274', '#c98e62', '#a8714a', '#8f5e3c', '#6e4630']
const HAIRS = [
  '#1f1a18', '#2e2420', '#5a3a26', '#8a5a2c', '#b07a3a', '#c9a24a', '#e0c878',
  '#7a7f8a', '#d8d8dc', '#a8483a', '#c8607a', '#4a6fb0', '#5a9a6a',
]
const SHIRTS = [
  '#d9574a', '#e08a3a', '#e8c440', '#8fbf4a', '#3fa56a', '#3fa5a0', '#4f8df5', '#3a5fb0',
  '#7a5fd0', '#b66ad0', '#d86aa0', '#f2f2ec', '#8a8f98', '#4a4f5a', '#a07850', '#6a8a4a',
]
const PANTS = ['#3a4660', '#4a4a52', '#5a4a3c', '#2f4a4a', '#26262c', '#6a5a48', '#4a5a8a', '#7a6a5a']
const HATS = ['#d9574a', '#3a5fb0', '#e8c440', '#3fa56a', '#2a2a30', '#d86aa0', '#f2f2ec']
const ACCENTS = ['#f2f2ec', '#2a2a30', '#d9574a', '#3a5fb0', '#e8c440']
const HAIR_STYLES = 8
const SHOE = '#22201e'
const EYE = '#2a1e1e'

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Seeds the look from the session id so a session always looks the same. Each part is hashed separately for an even mix */
export function lookFor(id: string): Look {
  const pick = <T>(part: string, list: readonly T[]): T => list[hash(id + ':' + part) % list.length]
  const chance = (part: string, percent: number): boolean => hash(id + ':' + part) % 100 < percent
  const skin = pick('skin', SKINS)
  const hair = pick('hair', HAIRS)
  const shirt = pick('shirt', SHIRTS)
  const pants = pick('pants', PANTS)
  const hairStyle = hash(id + ':style') % HAIR_STYLES
  // Hats are occasional and independent of hair style. Skip the shirt color so the hat doesn't blend in
  const hatChoices = HATS.filter((c) => c !== shirt)
  const hat = chance('hat', 22) ? pick('hatColor', hatChoices) : null
  const accent = pick('accent', ACCENTS.filter((c) => c !== shirt))
  return {
    hat,
    hatDark: hat ? shade(hat, -0.22) : '',
    hatLight: hat ? shade(hat, 0.2) : '',
    beard: chance('beard', 18),
    pattern: chance('pattern', 45) ? 1 + (hash(id + ':patternKind') % 3) : 0,
    accent,
    skin,
    skinDark: shade(skin, -0.16),
    // Cheeks are the skin tone with a touch of red
    blush: mix(skin, '#e2705f', 0.3),
    hair,
    hairLight: shade(hair, 0.28),
    hairStyle,
    shirt,
    shirtDark: shade(shirt, -0.22),
    shirtLight: shade(shirt, 0.2),
    pants,
    pantsDark: shade(pants, -0.25),
  }
}

// Scratch canvas for drawing and outlining a character. Padded because arms, dumbbells and laptops stick out
const PAD_X = 6
const PAD_TOP = 4
const PAD_BOTTOM = 1
const sprite = makeSurface(CHAR_W + PAD_X * 2, CHAR_H + PAD_TOP + PAD_BOTTOM)

/**
 * Draws an outlined character. When highlighted (hovered) the outline turns yellow.
 * (x, feetY) is the character's left edge and the height of its soles.
 */
export function drawCharacterOutlined(
  ctx: Ctx,
  x: number,
  feetY: number,
  look: Look,
  pose: Pose,
  facing: 1 | -1,
  now: number,
  highlighted: boolean,
): void {
  const { canvas, ctx: sctx } = sprite
  sctx.clearRect(0, 0, canvas.width, canvas.height)
  drawCharacter(sctx, PAD_X, PAD_TOP + CHAR_H, look, pose, facing, now)
  addOutline(sprite, highlighted ? OUTLINE_HOVER : OUTLINE)
  ctx.drawImage(canvas, x - PAD_X, feetY - CHAR_H - PAD_TOP)
}

type Ctx = CanvasRenderingContext2D

/**
 * (x, feetY) is the character's left edge and the height of its soles.
 * Part coordinates assume the character faces right; facing -1 mirrors them.
 */
export function drawCharacter(
  ctx: Ctx,
  x: number,
  feetY: number,
  look: Look,
  pose: Pose,
  facing: 1 | -1,
  now: number,
): void {
  const slow = Math.floor(now / 260) % 2
  const fast = Math.floor(now / 130) % 2
  const jump = pose === 'cheer' && slow ? -1 : 0
  const top = feetY - CHAR_H + jump

  const p = (color: string, dx: number, dy: number, w: number, h: number): void => {
    ctx.fillStyle = color
    ctx.fillRect(facing === 1 ? x + dx : x + CHAR_W - dx - w, top + dy, w, h)
  }

  // Legs
  if (pose === 'type' || pose === 'sit' || pose === 'lapType') {
    p(look.pants, 2, 11, 7, 1) // thighs
    p(look.pantsDark, 2, 11, 2, 1)
    p(look.pants, 7, 12, 2, 1) // shins
    p(SHOE, 7, 13, 3, 1)
  } else {
    const stride = (pose === 'walk' && slow) || (pose === 'run' && fast) ? 1 : 0
    p(look.pantsDark, 1 + stride, 11, 2, 2) // back leg is darker
    p(look.pants, 5 - stride, 11, 2, 2)
    p(SHOE, 1 + stride, 13, 2, 1)
    p(SHOE, 5 - stride, 13, 2, 1)
  }

  // Torso: darker back and hem for depth, with the neckline cut out in skin tone
  p(look.shirt, 1, 6, 6, 5)
  p(look.shirtDark, 1, 7, 1, 4)
  p(look.shirtDark, 1, 10, 6, 1)
  p(look.shirtLight, 5, 7, 1, 2)
  p(look.skinDark, 3, 6, 2, 1)
  switch (look.pattern) {
    case 1: // stripe
      p(look.accent, 2, 8, 5, 1)
      break
    case 2: // tie
      p(look.accent, 4, 7, 1, 3)
      break
    case 3: // suspenders
      p(look.accent, 2, 7, 1, 3)
      p(look.accent, 6, 7, 1, 3)
      break
    default:
  }

  // Head
  p(look.skin, 1, 2, 6, 4)
  p(look.skinDark, 1, 5, 6, 1) // chin shadow
  p(EYE, 3, 3, 1, 1)
  p(EYE, 5, 3, 1, 1)
  p(look.blush, 6, 4, 1, 1)
  p(look.blush, 2, 4, 1, 1)
  if (look.beard) {
    p(look.hair, 2, 5, 5, 1)
    p(look.hair, 6, 4, 1, 1)
  }
  switch (look.hairStyle) {
    case 0: // short
      p(look.hair, 1, 0, 6, 2)
      p(look.hair, 1, 2, 1, 2)
      p(look.hairLight, 4, 0, 2, 1)
      break
    case 3: // bob
      p(look.hair, 1, 0, 6, 2)
      p(look.hair, 0, 1, 2, 4)
      p(look.hair, 6, 2, 1, 1)
      p(look.hairLight, 3, 0, 2, 1)
      break
    case 4: // ponytail
      p(look.hair, 1, 0, 6, 2)
      p(look.hair, 1, 2, 1, 1)
      p(look.hair, 0, 1, 1, 2)
      p(look.hair, -1, 2, 1, 3)
      p(look.hairLight, 4, 0, 2, 1)
      break
    case 5: // bun
      p(look.hair, 2, -2, 3, 2)
      p(look.hair, 1, 0, 6, 2)
      p(look.hair, 1, 2, 1, 1)
      p(look.hairLight, 3, -2, 1, 1)
      break
    case 6: // curly
      p(look.hair, 0, 0, 8, 2)
      p(look.hair, 1, -1, 2, 1)
      p(look.hair, 4, -1, 2, 1)
      p(look.hair, 0, 2, 2, 2)
      p(look.hairLight, 2, 0, 1, 1)
      p(look.hairLight, 5, 0, 1, 1)
      break
    case 7: // short with side part
      p(look.hair, 1, 0, 6, 1)
      p(look.hair, 1, 1, 3, 1)
      p(look.hair, 6, 1, 1, 1)
      p(look.hair, 1, 2, 1, 2)
      p(look.hairLight, 2, 0, 3, 1)
      break
    case 1: // long
      p(look.hair, 1, 0, 6, 2)
      p(look.hair, 0, 1, 2, 6)
      p(look.hairLight, 4, 0, 2, 1)
      p(look.hairLight, 0, 3, 1, 2)
      break
    case 2: // spiky
      p(look.hair, 1, 1, 6, 1)
      p(look.hair, 1, 0, 1, 1)
      p(look.hair, 3, 0, 1, 1)
      p(look.hair, 5, 0, 1, 1)
      p(look.hair, 1, 2, 1, 1)
      p(look.hairLight, 5, 0, 1, 1)
      break
    default: // buzz cut
      p(look.hair, 1, 1, 6, 1)
      p(look.hair, 1, 2, 1, 1)
  }
  if (look.hat) {
    // Cap with a brim, drawn over the hair
    p(look.hat, 1, 0, 6, 2)
    p(look.hatLight, 2, 0, 3, 1)
    p(look.hatDark, 1, 1, 6, 1)
    p(look.hatDark, 7, 1, 1, 1)
  }

  // Arms: back arm (dx 0) and front arm (dx 7)
  const armDown = (dx: number): void => {
    p(dx === 0 ? look.shirtDark : look.shirt, dx, 6, 1, 3)
    p(look.skin, dx, 9, 1, 1)
  }
  switch (pose) {
    case 'type':
      p(look.shirt, 7, 8, 2, 1)
      p(look.skin, 9, 8 - fast, 1, 1)
      break
    case 'typeStand': // standing desk: typing on a high keyboard
      p(look.shirt, 7, 7, 2, 1)
      p(look.skin, 9, 6 - fast, 1, 1)
      break
    case 'lapType': // beanbag: laptop on the lap
      p(look.shirt, 7, 8, 1, 1)
      p(look.skin, 7, 9 - fast, 1, 1)
      p('#5a6070', 6, 10, 4, 1)
      p('#5a6070', 10, 7, 1, 3)
      p(fast ? '#bfe9ff' : '#9fd8f5', 9, 7, 1, 3)
      break
    case 'run': // treadmill: arms swing alternately
      if (fast) {
        p(look.shirt, 7, 6, 1, 2)
        p(look.skin, 8, 7, 1, 1)
        p(look.shirt, 0, 6, 1, 3)
        p(look.skin, 0, 9, 1, 1)
      } else {
        p(look.shirt, 7, 6, 1, 3)
        p(look.skin, 7, 9, 1, 1)
        p(look.shirt, 0, 6, 1, 2)
        p(look.skin, -1, 7, 1, 1)
      }
      break
    case 'lift': {
      // Dumbbell: lower, then lift overhead, repeatedly
      const up = Math.floor(now / 520) % 2 === 1
      const bar = '#2c303a'
      if (up) {
        p(look.shirt, 0, 3, 1, 4)
        p(look.skin, 0, 2, 1, 1)
        p(look.shirt, 7, 3, 1, 4)
        p(look.skin, 7, 2, 1, 1)
        p(bar, -1, 1, 3, 1)
        p(bar, 6, 1, 3, 1)
      } else {
        armDown(0)
        armDown(7)
        p(bar, -1, 10, 3, 1)
        p(bar, 6, 10, 3, 1)
      }
      break
    }
    case 'talk': // chat: gesturing while talking
      armDown(0)
      p(look.shirt, 7, 6, 1, 2)
      p(look.skin, 8, 7 - slow, 1, 1)
      break
    case 'standType':
      p(look.shirt, 7, 8, 2, 1)
      p('#2c303a', 9, 6, 1, 3) // tablet
      p(fast ? '#bfe9ff' : '#8fd0f0', 8, 7, 1, 1)
      break
    case 'wave':
      armDown(0)
      p(look.shirt, 7, 6, 1, 1)
      p(look.shirt, 7 + slow, 4, 1, 2)
      p(look.skin, 7 + slow, 3, 1, 1)
      break
    case 'cheer':
      p(look.shirt, 0, 3, 1, 4)
      p(look.skin, 0, 2, 1, 1)
      p(look.shirt, 7, 3, 1, 4)
      p(look.skin, 7, 2, 1, 1)
      break
    case 'trouble':
      armDown(0)
      p(look.shirt, 7, 2, 1, 5)
      p(look.skin, 6 - slow, 1, 1, 1) // hand scratching the head
      break
    case 'drink': {
      armDown(0)
      // Raise the cup to the mouth for 1 second every 4 seconds
      const sipping = now % 4000 < 1000
      p(look.shirt, 7, 6, 1, 2)
      if (sipping) {
        p(look.skin, 7, 5, 1, 1)
        p('#f2f2f2', 6, 4, 2, 2)
      } else {
        p(look.skin, 8, 8, 1, 1)
        p('#f2f2f2', 9, 7, 2, 2)
      }
      break
    }
    default:
      armDown(0)
      armDown(7)
  }
}

const BUBBLE_W = 11
const BUBBLE_H = 9

// 7x5 icons; '#' marks a filled pixel.
// bg/border, when set, replace the white bubble colors so the icon stands out
const ICONS: Record<Exclude<BubbleKind, 'dots'>, { color: string; rows: string[]; bg?: string; border?: string }> = {
  bang: { color: '#e0453a', rows: ['...#...', '...#...', '...#...', '.......', '...#...'] },
  check: { color: '#ffffff', bg: '#2fb35a', border: '#145c2c', rows: ['......#', '.....#.', '#...#..', '.#.#...', '..#....'] },
  fail: { color: '#e0453a', rows: ['.#...#.', '..#.#..', '...#...', '..#.#..', '.#...#.'] },
  pause: { color: '#7a7f8a', rows: ['..#.#..', '..#.#..', '..#.#..', '..#.#..', '..#.#..'] },
  talk: { color: '#6a7080', rows: ['.##.###', '.......', '.#####.', '.......', '.###.#.'] },
  // Tools used while working
  terminal: { color: '#3a4050', rows: ['.#.....', '..#....', '.#.....', '....###', '.......'] },
  edit: { color: '#c9862a', rows: ['.....##', '....##.', '...##..', '.###...', '.#.....'] },
  read: { color: '#3f7fb0', rows: ['.#####.', '.#...#.', '.#.#.#.', '.#...#.', '.#####.'] },
  search: { color: '#7a4fb0', rows: ['.###...', '.#.#...', '.###...', '....#..', '.....#.'] },
  web: { color: '#2f9e8a', rows: ['..###..', '.#.#.#.', '.#####.', '.#.#.#.', '..###..'] },
  agent: { color: '#d97757', rows: ['...#...', '..###..', '...#...', '..###..', '..#.#..'] },
}

/** Speech bubble above a character. (x, headTop) is the character's left edge and top of the head */
export function drawBubble(ctx: Ctx, x: number, headTop: number, kind: BubbleKind, sceneWidth: number, now: number): void {
  const bx = Math.max(0, Math.min(sceneWidth - BUBBLE_W, x - 1))
  const by = Math.max(0, headTop - BUBBLE_H - 2)
  const tailX = Math.max(bx + 2, Math.min(bx + BUBBLE_W - 4, x + 3))
  const icon = kind === 'dots' ? null : ICONS[kind]
  const outline = icon?.border ?? '#2a2a33'

  ctx.fillStyle = outline
  ctx.fillRect(bx + 1, by, BUBBLE_W - 2, BUBBLE_H)
  ctx.fillRect(bx, by + 1, BUBBLE_W, BUBBLE_H - 2)
  ctx.fillRect(tailX, by + BUBBLE_H, 2, 1)
  ctx.fillRect(tailX, by + BUBBLE_H + 1, 1, 1)
  ctx.fillStyle = icon?.bg ?? '#ffffff'
  ctx.fillRect(bx + 1, by + 1, BUBBLE_W - 2, BUBBLE_H - 2)
  ctx.fillRect(tailX, by + BUBBLE_H - 1, 1, 1)

  const ix = bx + 2
  const iy = by + 2
  if (!icon) {
    // Three dots hop in turn
    const active = Math.floor(now / 220) % 4
    ctx.fillStyle = '#4a5060'
    for (let i = 0; i < 3; i++) ctx.fillRect(ix + 1 + i * 2, iy + (i === active ? 1 : 3), 1, 1)
    return
  }
  ctx.fillStyle = icon.color
  icon.rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) if (row[dx] === '#') ctx.fillRect(ix + dx, iy + dy, 1, 1)
  })
}
