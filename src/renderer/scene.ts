import type { Layout } from '../shared/types'

// 장면의 배치: 어디에 무엇이 있는지 계산한다. 그리기는 scene-art.ts. 좌표는 모두 확대 전 장면 픽셀.

export const FLOOR_H = 3
export const CHAR_W = 8
export const CHAR_H = 14

export const DOOR_W = 12
const PIECE_GAP = 6
export const TABLE_SEAT_W = 13

/** 일하는 자리의 종류. 자리마다 캐릭터의 자세가 달라진다 */
export type StationKind = 'desk' | 'standing' | 'table' | 'beanbag'

export interface Station {
  kind: StationKind
  /** 이 자리에서 일하는 캐릭터의 왼쪽 끝 x */
  x: number
}

export type PieceKind = StationKind | 'plant' | 'whiteboard'

/** 오피스에 놓인 가구 하나. 자리가 있는 가구는 stations에 자리 번호를 가진다 */
export interface Piece {
  kind: PieceKind
  x: number
  stations: number[]
  /** 같은 종류 안에서 색을 바꾸기 위한 순번 */
  variant: number
}

// 문에서 왼쪽으로 가며 이 순서대로 가구를 놓는다. 폭이 남는 만큼 반복한다.
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
  /** 문 왼쪽 끝. 문 왼쪽이 오피스, 오른쪽이 라운지 */
  doorX: number
  /** 오피스 가구. 문에서 가까운 것부터 */
  pieces: Piece[]
  /** 일하는 자리 전체 */
  stations: Station[]
  loungeStart: number
  loungeEnd: number
  counterX: number
  /** 소파의 왼쪽 끝 x (각 2인석) */
  sofas: number[]
  /** 수다 테이블의 왼쪽 끝 x. 테이블 양옆에 한 명씩 선다 */
  tables: number[]
  plants: number[]
  lamps: number[]
  /** 서성이는 구역 */
  wanderStart: number
  wanderEnd: number
  /** 라운지 오른쪽 끝의 헬스장. 폭이 좁으면 없다 */
  gym: Gym | null
}

export interface Gym {
  x: number
  w: number
  treadmillX: number
  /** 아령 드는 자리의 캐릭터 x */
  liftX: number
  rackX: number
}

const COFFEE_SLOT_W = 10
export const COFFEE_SLOTS = 2
const GYM_W = 50
const LOUNGE_GAP = 10
/** 수다 테이블에서 오른쪽에 서는 캐릭터의 x 오프셋 */
export const TABLE_SIDE_OFFSET = 14
/** 러닝머신 벨트 높이. 그 위의 캐릭터는 이만큼 올라가 있다 */
export const TREADMILL_H = 2

// 커피 카운터와 헬스장 사이를 왼쪽부터 이 순서로 채운다. 폭이 남는 만큼 반복한다.
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
