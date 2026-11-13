import type { Layout } from '../shared/types'

// Scene layout: works out what goes where. Drawing lives in scene-art.ts. All coordinates are unscaled scene pixels.

export const FLOOR_H = 3
export const CHAR_W = 8
export const CHAR_H = 14

export const DOOR_W = 12
const PIECE_GAP = 6
export const TABLE_SEAT_W = 13

/** Kind of work spot. Each kind gives the character a different pose */
export type StationKind = 'desk' | 'standing' | 'table' | 'beanbag'

export interface Station {
  kind: StationKind
  /** Left x of the character working at this spot */
  x: number
}

export type PieceKind = StationKind | 'plant' | 'whiteboard'

/** One piece of office furniture. Furniture with seats has its seat indices in stations */
export interface Piece {
  kind: PieceKind
  x: number
  stations: number[]
  /** Index used to vary colors within the same kind */
  variant: number
}

// Furniture is placed in this order going left from the door, repeating while there is room.
const OFFICE_PATTERN: { kind: PieceKind; seats?: number }[] = [
  { kind: 'desk' },
  { kind: 'standing' },
  { kind: 'plant' },
  { kind: 'table', seats: 3 },
  { kind: 'beanbag' },
  { kind: 'beanbag' },
  { kind: 'whiteboard' },
  { kind: 'desk' },
  { kind: 'desk' },
  { kind: 'standing' },
  { kind: 'table', seats: 2 },
  { kind: 'plant' },
]

function pieceWidth(kind: PieceKind, seats: number): number {
  switch (kind) {
    case 'desk':
      return 26
    case 'standing':
      return 21
    case 'table':
      return seats * TABLE_SEAT_W + 4
    case 'beanbag':
      return 13
    case 'plant':
      return 6
    case 'whiteboard':
      return 14
  }
}

function layoutOffice(doorX: number): { pieces: Piece[]; stations: Station[] } {
  const pieces: Piece[] = []
  const stations: Station[] = []
  let right = doorX - 8
  for (let n = 0; n < 200; n++) {
    const spec = OFFICE_PATTERN[n % OFFICE_PATTERN.length]
    const seats = spec.seats ?? 1
    const x = right - pieceWidth(spec.kind, seats)
    if (x < 4) break
    const piece: Piece = { kind: spec.kind, x, stations: [], variant: n }
    if (spec.kind !== 'plant' && spec.kind !== 'whiteboard') {
      for (let s = 0; s < seats; s++) {
        const offset = spec.kind === 'table' ? 2 + s * TABLE_SEAT_W : spec.kind === 'beanbag' ? 2 : spec.kind === 'desk' ? 1 : 0
        piece.stations.push(stations.length)
        stations.push({ kind: spec.kind, x: x + offset })
      }
    }
    pieces.push(piece)
    right = x - PIECE_GAP
  }
  return { pieces, stations }
}
export const COUNTER_W = 16
export const SOFA_W = 24

export interface Geometry {
  w: number
  h: number
  floorY: number
  /** Left edge of the door. Office to the left, lounge to the right */
  doorX: number
  /** Office furniture, nearest to the door first */
  pieces: Piece[]
  /** All work spots */
  stations: Station[]
  loungeStart: number
  loungeEnd: number
  counterX: number
  /** Left x of each sofa (two seats each) */
  sofas: number[]
  /** Left x of each chat table. One person stands on each side */
  tables: number[]
  plants: number[]
  lamps: number[]
  /** Wandering area */
  wanderStart: number
  wanderEnd: number
  /** Gym at the right end of the lounge. Absent when the strip is narrow */
  gym: Gym | null
}

export interface Gym {
  x: number
  w: number
  treadmillX: number
  /** Character x at the dumbbell spot */
  liftX: number
  rackX: number
}

const COFFEE_SLOT_W = 10
export const COFFEE_SLOTS = 2
const GYM_W = 50
const LOUNGE_GAP = 10
/** X offset of the character on the right side of a chat table */
export const TABLE_SIDE_OFFSET = 14
/** Treadmill belt height. A character on it is raised by this much */
export const TREADMILL_H = 2

// The space between the coffee counter and the gym is filled left to right in this order, repeating while there is room.
const LOUNGE_PATTERN = ['table', 'sofa', 'plant', 'table', 'sofa', 'plant'] as const

export function computeGeometry(layout: Layout): Geometry {
  const w = layout.sceneWidth
  const h = layout.sceneHeight
  const doorX = Math.floor(w * 0.6)
  const { pieces, stations } = layoutOffice(doorX)

  const loungeStart = doorX + DOOR_W + 4
  const loungeEnd = w - 4
  const lw = loungeEnd - loungeStart
  const counterX = loungeStart + 2

  let gym: Gym | null = null
  if (lw >= 170) {
    const x = loungeEnd - GYM_W
    gym = { x, w: GYM_W, treadmillX: x + 3, liftX: x + 26, rackX: x + 38 }
  }

  const midStart = counterX + COUNTER_W + 4 + COFFEE_SLOTS * COFFEE_SLOT_W + 4
  const midEnd = gym ? gym.x - 4 : loungeEnd
  const sofas: number[] = []
  const tables: number[] = []
  const plants: number[] = []
  const lamps: number[] = []
  let cursor = midStart
  for (let n = 0; n < 100; n++) {
    const kind = LOUNGE_PATTERN[n % LOUNGE_PATTERN.length]
    const width = kind === 'table' ? TABLE_SIDE_OFFSET + CHAR_W : kind === 'sofa' ? SOFA_W + 6 : 6
    if (cursor + width > midEnd) break
    if (kind === 'table') tables.push(cursor)
    else if (kind === 'sofa') {
      lamps.push(cursor)
      sofas.push(cursor + 6)
    } else plants.push(cursor)
    cursor += width + LOUNGE_GAP
  }

  return {
    w,
    h,
    floorY: h - FLOOR_H,
    doorX,
    pieces,
    stations,
    loungeStart,
    loungeEnd,
    counterX,
    sofas,
    tables,
    plants,
    lamps,
    wanderStart: Math.min(midStart, loungeEnd - CHAR_W),
    wanderEnd: Math.max(midStart, midEnd - CHAR_W),
    gym,
  }
}
