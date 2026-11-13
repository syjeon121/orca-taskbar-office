import { addOutline, makeSurface, shade, type Surface } from './pixel'
import {
  CHAR_H,
  CHAR_W,
  COUNTER_W,
  DOOR_W,
  FLOOR_H,
  SOFA_W,
  TABLE_SEAT_W,
  TREADMILL_H,
  type Geometry,
  type Piece,
} from './scene'

// Scene art. Static furniture is drawn and outlined once per layout change (renderSceneArt);
// each frame pastes that image and draws only the blinking or moving parts on top (drawBackEffects, drawFrontEffects).

type Ctx = CanvasRenderingContext2D

function rect(ctx: Ctx, color: string, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

const WOOD = '#d0a070'
const WOOD_DARK = '#8f6340'
const METAL = '#8a909c'
const METAL_DARK = '#5a6070'
const SCREEN_BODY = '#3a4050'
const SCREEN_OFF = '#1d2028'
const SCREEN_ON = '#bfe9ff'
const CUP = '#f2f2f2'
const CHAIR_COLORS = ['#c0564d', '#4d7ec0', '#4dab7a', '#c9a04d']
const BEANBAG_COLORS = ['#e08a4a', '#5aa0d8', '#d86a8a', '#8fb84a']

export function drawFloor(ctx: Ctx, g: Geometry): void {
  const y = g.floorY
  const loungeX = g.doorX + DOOR_W

  // Office: wooden floor with evenly spaced plank seams
  rect(ctx, '#5a4c40', 0, y, loungeX, FLOOR_H)
  rect(ctx, '#927b63', 0, y, loungeX, 1)
  for (let x = 5; x < loungeX; x += 9) rect(ctx, '#6f5d4c', x, y, 1, 1)

  // Lounge: carpet
  rect(ctx, '#57496a', loungeX, y, g.w - loungeX, FLOOR_H)
  rect(ctx, '#84709a', loungeX, y, g.w - loungeX, 1)
  for (let x = loungeX + 1; x < g.w; x += 4) rect(ctx, '#9a86b0', x, y, 1, 1)

  // Gym: rubber mat
  if (g.gym) {
    rect(ctx, '#39434f', g.gym.x, y, g.w - g.gym.x, FLOOR_H)
    rect(ctx, '#6f8aa6', g.gym.x, y, g.w - g.gym.x, 1)
    for (let x = g.gym.x + 3; x < g.w; x += 6) rect(ctx, '#4f6378', x, y, 1, 1)
  }
}

/** Shadow under a character's feet */
export function drawShadow(ctx: Ctx, x: number, y: number): void {
  rect(ctx, 'rgba(0,0,0,0.28)', x + 1, y, CHAR_W - 2, 1)
}

function drawDoor(ctx: Ctx, g: Geometry): void {
  const x = g.doorX
  const top = g.floorY - 20
  rect(ctx, '#8a6648', x, top, DOOR_W, 20) // door frame
  rect(ctx, '#a88460', x, top, DOOR_W, 1)
  rect(ctx, '#2e2623', x + 1, top + 1, DOOR_W - 2, 19) // darkness inside the doorway
  // The open door leaf
  rect(ctx, '#b08458', x + DOOR_W - 4, top + 1, 3, 19)
  rect(ctx, '#8f6a45', x + DOOR_W - 4, top + 1, 1, 19)
  rect(ctx, '#e8c860', x + DOOR_W - 3, top + 10, 1, 2)
}

function drawPlant(ctx: Ctx, x: number, f: number): void {
  rect(ctx, '#b5653f', x + 1, f - 4, 4, 4)
  rect(ctx, '#94502f', x + 4, f - 4, 1, 4)
  rect(ctx, '#d98a5c', x, f - 5, 6, 1)
  rect(ctx, '#3a8048', x + 2, f - 11, 2, 6)
  rect(ctx, '#4fae5f', x, f - 10, 2, 3)
  rect(ctx, '#4fae5f', x + 4, f - 12, 2, 4)
  rect(ctx, '#74d182', x + 1, f - 13, 2, 2)
  rect(ctx, '#74d182', x + 4, f - 12, 1, 1)
}

/** Monitor, drawn with the screen off. drawFrontEffects draws the lit screen on top */
function drawMonitor(ctx: Ctx, x: number, y: number): void {
  rect(ctx, SCREEN_BODY, x, y, 8, 6)
  rect(ctx, '#565e72', x, y, 8, 1)
  rect(ctx, SCREEN_OFF, x + 1, y + 1, 6, 4)
}

/** Office furniture behind the characters: chairs, stools, beanbags and decor */
function drawPieceBack(ctx: Ctx, g: Geometry, piece: Piece): void {
  const f = g.floorY
  const top = f - CHAR_H
  const x = piece.x
  switch (piece.kind) {
    case 'desk': {
      const color = CHAIR_COLORS[piece.variant % CHAIR_COLORS.length]
      rect(ctx, color, x, top + 5, 2, 6) // backrest
      rect(ctx, shade(color, -0.25), x, top + 5, 1, 6)
      rect(ctx, color, x, top + 11, 7, 1) // seat
      rect(ctx, '#3a3f4c', x, top + 12, 7, 1)
      rect(ctx, '#3a3f4c', x + 1, f - 1, 5, 1)
      break
    }
    case 'standing':
      rect(ctx, '#5f9a7a', x - 1, f - 1, 10, 1) // foot mat
      break
    case 'table':
      for (const s of piece.stations) {
        const cx = g.stations[s].x
        rect(ctx, '#d8a24a', cx + 1, top + 11, 6, 1) // stool seat
        rect(ctx, '#8a7458', cx + 1, top + 12, 6, 1)
        rect(ctx, '#6a5a48', cx + 3, top + 13, 2, 1)
      }
      break
    case 'beanbag': {
      const color = BEANBAG_COLORS[piece.variant % BEANBAG_COLORS.length]
      rect(ctx, color, x + 2, f - 9, 8, 1)
      rect(ctx, color, x + 1, f - 8, 11, 3)
      rect(ctx, color, x, f - 5, 13, 5)
      rect(ctx, shade(color, -0.22), x, f - 2, 13, 2)
      rect(ctx, shade(color, -0.12), x + 10, f - 7, 2, 5)
      rect(ctx, shade(color, 0.3), x + 3, f - 8, 4, 1)
      break
    }
    case 'plant':
      drawPlant(ctx, x, f)
      break
    case 'whiteboard':
      rect(ctx, METAL, x + 2, top + 9, 1, 5)
      rect(ctx, METAL, x + 11, top + 9, 1, 5)
      rect(ctx, METAL, x, top - 2, 14, 11)
      rect(ctx, '#f7f7f2', x + 1, top - 1, 12, 9)
      rect(ctx, '#e0453a', x + 2, top, 5, 1)
      rect(ctx, '#3f7fb0', x + 2, top + 2, 8, 1)
      rect(ctx, '#3f7fb0', x + 2, top + 4, 3, 1)
      rect(ctx, '#2f9e52', x + 6, top + 4, 3, 1)
      rect(ctx, '#f6d77a', x + 9, top + 5, 3, 2) // sticky note
      rect(ctx, METAL_DARK, x + 3, top + 8, 8, 1) // pen tray
      break
    default:
  }
}

/** Office furniture in front of the characters: desktops, monitors and laptops */
function drawPieceFront(ctx: Ctx, g: Geometry, piece: Piece): void {
  const f = g.floorY
  const top = f - CHAR_H
  const x = piece.x
  switch (piece.kind) {
    case 'desk': {
      const d = x + 9
      rect(ctx, WOOD, d, top + 9, 17, 1) // desktop
      rect(ctx, WOOD_DARK, d, top + 10, 17, 1)
      rect(ctx, WOOD_DARK, d + 1, top + 11, 1, 3)
      rect(ctx, '#a87850', d + 10, top + 11, 6, 3) // drawer
      rect(ctx, WOOD_DARK, d + 10, top + 12, 6, 1)
      rect(ctx, '#e6c99a', d + 12, top + 11, 2, 1)
      rect(ctx, '#e6c99a', d + 12, top + 13, 2, 1)
      rect(ctx, '#2c303a', d + 1, top + 8, 4, 1) // keyboard
      drawMonitor(ctx, d + 7, top + 2)
      rect(ctx, '#2c303a', d + 10, top + 8, 2, 1)
      rect(ctx, CUP, d + 15, top + 7, 2, 2) // mug
      break
    }
    case 'standing': {
      // High top on thin metal legs. No chair
      const d = x + 8
      rect(ctx, '#ece6d8', d, top + 7, 13, 1)
      rect(ctx, '#bdb6a6', d, top + 8, 13, 1)
      rect(ctx, METAL, d + 1, top + 9, 1, 5)
      rect(ctx, METAL, d + 11, top + 9, 1, 5)
      rect(ctx, METAL_DARK, d, f - 1, 3, 1)
      rect(ctx, METAL_DARK, d + 10, f - 1, 3, 1)
      rect(ctx, '#2c303a', d + 1, top + 6, 3, 1) // keyboard
      drawMonitor(ctx, d + 5, top - 1)
      rect(ctx, '#2c303a', d + 8, top + 5, 2, 2)
      break
    }
    case 'table': {
      const w = piece.stations.length * TABLE_SEAT_W + 4
      for (const s of piece.stations) {
        const cx = g.stations[s].x
        rect(ctx, METAL_DARK, cx + 9, top + 8, 4, 1) // laptop base
        rect(ctx, METAL_DARK, cx + 12, top + 5, 1, 3) // screen
      }
      rect(ctx, '#dcae78', x, top + 9, w, 1)
      rect(ctx, '#96704a', x + 1, top + 10, w - 2, 1)
      rect(ctx, '#96704a', x + 2, top + 11, 2, 3)
      rect(ctx, '#96704a', x + w - 4, top + 11, 2, 3)
      break
    }
    default:
  }
}

function drawLounge(ctx: Ctx, g: Geometry): void {
  const f = g.floorY

  // Coffee counter and machine
  const c = g.counterX
  rect(ctx, '#8a6446', c, f - 8, COUNTER_W, 8)
  rect(ctx, '#d0aa7c', c, f - 9, COUNTER_W, 1)
  rect(ctx, '#6f4f37', c + 7, f - 7, 1, 6)
  rect(ctx, '#e6c99a', c + 5, f - 5, 1, 2) // handle
  rect(ctx, '#e6c99a', c + 9, f - 5, 1, 2)
  rect(ctx, '#5a4030', c, f - 1, COUNTER_W, 1)
  rect(ctx, '#4a4f5c', c + 2, f - 17, 7, 8) // machine body
  rect(ctx, '#6a7080', c + 2, f - 17, 7, 1)
  rect(ctx, '#23262e', c + 3, f - 13, 5, 3)
  rect(ctx, METAL, c + 5, f - 13, 1, 1)
  rect(ctx, CUP, c + 5, f - 12, 2, 2) // cup being filled
  rect(ctx, CUP, c + 11, f - 11, 2, 2) // stacked cups
  rect(ctx, CUP, c + 13, f - 12, 2, 3)

  for (const x of g.lamps) {
    rect(ctx, '#6a6f7a', x + 2, f - 16, 1, 16)
    rect(ctx, '#6a6f7a', x + 1, f - 1, 3, 1)
    rect(ctx, '#f6d77a', x, f - 20, 5, 4)
    rect(ctx, '#fff0b0', x + 1, f - 19, 3, 2)
  }

  // Chat table: a tall round standing table with one person on each side
  for (const x of g.tables) {
    const t = x + CHAR_W + 1
    rect(ctx, '#e6d8b8', t - 1, f - 10, 6, 1)
    rect(ctx, '#a89878', t, f - 9, 4, 1)
    rect(ctx, '#6a6f7a', t + 1, f - 8, 2, 7)
    rect(ctx, '#6a6f7a', t, f - 1, 4, 1)
    rect(ctx, CUP, t, f - 12, 2, 2) // cup on the table
  }

  for (const x of g.sofas) {
    rect(ctx, '#7b5a8c', x + 1, f - 11, SOFA_W - 2, 7) // backrest
    rect(ctx, '#9a78ab', x + 2, f - 11, SOFA_W - 4, 1)
    rect(ctx, '#8c6a9d', x + 3, f - 5, SOFA_W - 6, 3) // two seat cushions
    rect(ctx, '#a585b6', x + 3, f - 5, SOFA_W - 6, 1)
    rect(ctx, '#6a4d7a', x + 11, f - 5, 1, 3)
    rect(ctx, '#5c4169', x, f - 8, 3, 7) // armrest
    rect(ctx, '#5c4169', x + SOFA_W - 3, f - 8, 3, 7)
    rect(ctx, '#7b5a8c', x, f - 8, 3, 1)
    rect(ctx, '#7b5a8c', x + SOFA_W - 3, f - 8, 3, 1)
    rect(ctx, '#4a3556', x + 3, f - 2, SOFA_W - 6, 1)
    rect(ctx, '#e8c060', x + SOFA_W - 7, f - 8, 3, 3) // cushion
    rect(ctx, '#2a2420', x + 1, f - 1, 2, 1)
    rect(ctx, '#2a2420', x + SOFA_W - 3, f - 1, 2, 1)
  }

  for (const x of g.plants) drawPlant(ctx, x, f)

  if (g.gym) {
    // Treadmill: belt, front post with console, handrail
    const t = g.gym.treadmillX
    rect(ctx, '#23262e', t, f - TREADMILL_H, 16, TREADMILL_H)
    rect(ctx, '#4a505c', t, f - TREADMILL_H, 16, 1)
    rect(ctx, METAL, t + 15, f - 13, 1, 11)
    rect(ctx, METAL, t + 12, f - 9, 3, 1)
    rect(ctx, SCREEN_BODY, t + 13, f - 15, 4, 2)

    // Dumbbell rack
    const r = g.gym.rackX
    rect(ctx, METAL_DARK, r, f - 11, 1, 11)
    rect(ctx, METAL_DARK, r + 9, f - 11, 1, 11)
    rect(ctx, METAL, r, f - 10, 10, 1)
    rect(ctx, METAL, r, f - 5, 10, 1)
    for (const [dx, dy] of [
      [1, 12],
      [5, 12],
      [1, 7],
      [5, 7],
    ]) {
      rect(ctx, '#2c303a', r + dx, f - dy, 4, 2)
      rect(ctx, '#6a7280', r + dx + 1, f - dy, 2, 1)
    }
  }
}

export interface SceneArt {
  /** Behind characters: door, lounge furniture, chairs and decor */
  back: Surface
  /** In front of seated characters: desktops, monitors and laptops */
  front: Surface
}

/** Draws static furniture into two layers and outlines it. Call again only when the layout changes */
export function renderSceneArt(g: Geometry): SceneArt {
  const back = makeSurface(g.w, g.h)
  drawDoor(back.ctx, g)
  drawLounge(back.ctx, g)
  for (const piece of g.pieces) drawPieceBack(back.ctx, g, piece)
  addOutline(back, undefined, g.floorY)

  const front = makeSurface(g.w, g.h)
  for (const piece of g.pieces) drawPieceFront(front.ctx, g, piece)
  addOutline(front, undefined, g.floorY)
  return { back, front }
}

/** Animated parts behind characters: lamp glow, coffee machine light and steam, treadmill belt */
export function drawBackEffects(ctx: Ctx, g: Geometry, now: number): void {
  const f = g.floorY
  // Lamp glow: two layers so it spreads softly around the shade
  for (const x of g.lamps) {
    rect(ctx, 'rgba(255,226,130,0.12)', x - 1, f - 22, 7, 8)
    rect(ctx, 'rgba(255,226,130,0.12)', x - 2, f - 21, 9, 6)
  }

  const c = g.counterX
  rect(ctx, Math.floor(now / 800) % 2 ? '#ff6b5a' : '#a83c32', c + 3, f - 16, 1, 1)
  // Steam rises above the machine in alternating puffs
  const puff = Math.floor(now / 350) % 4
  rect(ctx, 'rgba(255,255,255,0.55)', c + 4 + (puff % 2), f - 19 - puff, 1, 1)
  rect(ctx, 'rgba(255,255,255,0.35)', c + 6 - (puff % 2), f - 18 - ((puff + 2) % 4), 1, 1)

  if (g.gym) {
    const t = g.gym.treadmillX
    const shift = Math.floor(now / 90) % 4
    for (let i = shift; i < 16; i += 4) rect(ctx, '#6a7280', t + 15 - i, f - TREADMILL_H, 1, 1)
    rect(ctx, Math.floor(now / 500) % 2 ? '#7fe08a' : '#3f9a4f', t + 14, f - 15, 2, 1)
  }
}

/** Animated parts in front: lit screens at occupied, working desks */
export function drawFrontEffects(ctx: Ctx, g: Geometry, lit: (station: number) => boolean, now: number): void {
  const top = g.floorY - CHAR_H
  const screen = (x: number, y: number): void => {
    rect(ctx, SCREEN_ON, x, y, 6, 4)
    // Lines of code blink from top to bottom
    const line = Math.floor(now / 300) % 4
    rect(ctx, '#3f7fb0', x, y + line, 2 + ((line * 2 + 1) % 4), 1)
    rect(ctx, '#8fcfe8', x, y + ((line + 2) % 4), 1 + (line % 3), 1)
  }
  for (const piece of g.pieces) {
    switch (piece.kind) {
      case 'desk':
        if (lit(piece.stations[0])) screen(piece.x + 17, top + 3)
        break
      case 'standing':
        if (lit(piece.stations[0])) screen(piece.x + 14, top)
        break
      case 'table':
        for (const s of piece.stations) if (lit(s)) rect(ctx, SCREEN_ON, g.stations[s].x + 11, top + 5, 1, 3)
        break
      default:
    }
  }
}
