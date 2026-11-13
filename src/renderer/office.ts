import type { SessionInfo, SessionStatus } from '../shared/types'
import { CHAR_H, CHAR_W, COFFEE_SLOTS, TABLE_SIDE_OFFSET, TREADMILL_H, type Geometry } from './scene'
import { drawBackEffects, drawFloor, drawFrontEffects, drawShadow, renderSceneArt, type SceneArt } from './scene-art'
import { drawBubble, drawCharacterOutlined, lookFor, toolKind, type BubbleKind, type Look, type Pose } from './sprites'

// Takes the session list, then moves and draws the characters.
// Each character derives where it should be from its status, walks there, and strikes a pose on arrival.

type Place =
  /** A work spot in the office (desk, standing desk, shared table, beanbag) */
  | { kind: 'desk'; i: number }
  /** Standing spot used when the office runs out of seats */
  | { kind: 'overflow'; i: number }
  | { kind: 'wander'; frac: number }
  | { kind: 'coffee'; slot: number }
  | { kind: 'sofa'; sofa: number; seat: number }
  /** Left (0) or right (1) side of a chat table */
  | { kind: 'table'; table: number; side: number }
  | { kind: 'treadmill' }
  | { kind: 'lift' }
  | { kind: 'door' }

type Mark = 'check' | 'fail' | 'pause'

interface Character {
  id: string
  info: SessionInfo
  look: Look
  x: number
  facing: 1 | -1
  place: Place
  arrived: boolean
  /** Assigned work spot. Kept while working and until the result has been acknowledged */
  work: Place | null
  /** Animation played at the desk right after finishing */
  hold: { pose: 'cheer' | 'trouble'; until: number } | null
  /** Result mark shown overhead after finishing. Stays until the user acknowledges it */
  mark: Mark | null
  /** The user clicked the character to acknowledge the result. Don't show it again even if Orca's read state lags behind */
  acked: boolean
  /** When the current lounge activity ends */
  loungeUntil: number
  alpha: number
  leaving: boolean
}

const WALK_SPEED = 26 // scene pixels per second
const CHEER_MS = 2600
const TROUBLE_MS = 6000
/** How often the speaker switches during a chat */
const TALK_TURN_MS = 1500
/** Working bubble: the tool icon for the first part of this cycle, three dots for the rest */
const TOOL_CYCLE_MS = 2600
const TOOL_SHOW_MS = 1700

const LOUNGE_KINDS: Place['kind'][] = ['wander', 'coffee', 'sofa', 'table', 'treadmill', 'lift']

function isBusy(status: SessionStatus): boolean {
  return status === 'working' || status === 'waiting'
}

function samePlace(a: Place, b: Place): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function between(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export class Office {
  private chars: Character[] = []
  private g: Geometry
  /** Pre-rendered, outlined furniture */
  private art: SceneArt
  private seeded = false
  hoveredId: string | null = null

  constructor(geometry: Geometry) {
    this.g = geometry
    this.art = renderSceneArt(geometry)
  }

  setGeometry(geometry: Geometry): void {
    this.g = geometry
    this.art = renderSceneArt(geometry)
    // A new window width changes the furniture. Release spots that no longer exist so they get picked again
    for (const c of this.chars) {
      if (c.work && !this.exists(c.work)) c.work = null
      if (!this.exists(c.place)) this.go(c, { kind: 'wander', frac: Math.random() })
      if (c.arrived) c.x = this.placeX(c.place)
    }
  }

  setSessions(sessions: SessionInfo[], now: number): void {
    const incoming = new Map(sessions.map((s) => [s.id, s]))
    for (const c of this.chars) {
      const next = incoming.get(c.id)
      if (!next) {
        c.leaving = true
        continue
      }
      incoming.delete(c.id)
      this.onStatusChange(c, c.info.status, next.status, next.quiet, now)
      // Viewing the session in Orca (read) clears the result mark
      if (c.info.unread && !next.unread && !isBusy(next.status)) c.mark = null
      if (!next.unread) c.acked = false
      c.info = next
      c.leaving = false
    }
    for (const info of incoming.values()) {
      // Sessions in the first list start in place; sessions added later arrive through the door
      const c: Character = {
        id: info.id,
        info,
        look: lookFor(info.id),
        x: this.placeX({ kind: 'door' }),
        facing: 1,
        place: { kind: 'door' },
        arrived: true,
        work: null,
        hold: null,
        mark: null,
        acked: false,
        loungeUntil: 0,
        alpha: this.seeded ? 0 : 1,
        leaving: false,
      }
      this.chars.push(c)
      if (!this.seeded) {
        this.decidePlace(c, now)
        c.x = this.placeX(c.place)
        this.arrive(c, now)
      }
    }
    this.seeded = true
  }

  private onStatusChange(c: Character, prev: SessionStatus, next: SessionStatus, quiet: boolean, now: number): void {
    if (prev === next) return
    if (isBusy(next)) {
      c.hold = null
      c.mark = null
      c.acked = false
      return
    }
    if (!isBusy(prev) || quiet) return
    // Just finished. Animate at the desk, then stay there with the result mark until acknowledged
    const atWork = c.arrived && c.work !== null && samePlace(c.place, c.work)
    c.acked = false
    if (next === 'done') {
      if (atWork) c.hold = { pose: 'cheer', until: now + CHEER_MS }
      c.mark = 'check'
    } else {
      if (atWork) c.hold = { pose: 'trouble', until: now + TROUBLE_MS }
      c.mark = next === 'failed' ? 'fail' : 'pause'
    }
  }

  /** Whether the spot exists in the current layout */
  private exists(place: Place): boolean {
    const g = this.g
    switch (place.kind) {
      case 'desk':
        return place.i < g.stations.length
      case 'sofa':
        return place.sofa < g.sofas.length
      case 'table':
        return place.table < g.tables.length
      case 'treadmill':
      case 'lift':
        return g.gym !== null
      default:
        return true
    }
  }

  private placeX(place: Place): number {
    const g = this.g
    switch (place.kind) {
      case 'desk':
        return g.stations[place.i]?.x ?? 4
      case 'overflow':
        return Math.max(4, g.doorX - 14 - place.i * 10)
      case 'wander':
        return Math.round(g.wanderStart + place.frac * (g.wanderEnd - g.wanderStart))
      case 'coffee':
        return g.counterX + 18 + place.slot * 10
      case 'sofa':
        return (g.sofas[place.sofa] ?? g.wanderStart) + 2 + place.seat * 10
      case 'table':
        return (g.tables[place.table] ?? g.wanderStart) + place.side * TABLE_SIDE_OFFSET
      case 'treadmill':
        return (g.gym?.treadmillX ?? g.wanderStart) + 3
      case 'lift':
        return g.gym?.liftX ?? g.wanderStart
      case 'door':
        return g.doorX + 2
    }
  }

  private go(c: Character, place: Place): void {
    if (samePlace(c.place, place)) return
    c.place = place
    c.arrived = false
  }

  private allocateWork(c: Character): Place {
    const taken = (p: Place): boolean => this.chars.some((o) => o !== c && o.work !== null && samePlace(o.work, p))
    // Pick any free spot so desks, standing desks, shared tables and beanbags all get used
    const free = this.g.stations.map((_, i): Place => ({ kind: 'desk', i })).filter((p) => !taken(p))
    if (free.length > 0) return free[Math.floor(Math.random() * free.length)]
    for (let i = 0; ; i++) {
      const p: Place = { kind: 'overflow', i }
      if (!taken(p)) return p
    }
  }

  /** Picks the next lounge activity: coffee, chat, sofa, workout or wandering */
  private pickLounge(c: Character): Place {
    const others = this.chars.filter((o) => o !== c && !o.leaving)
    const free = (p: Place): boolean => !others.some((o) => samePlace(o.place, p))
    const g = this.g
    const roll = Math.random()

    if (roll < 0.18) {
      for (let slot = 0; slot < COFFEE_SLOTS; slot++) {
        const p: Place = { kind: 'coffee', slot }
        if (free(p)) return p
      }
    } else if (roll < 0.48) {
      // Chat: join a table where someone is standing alone, otherwise wait at an empty one
      const seats: Place[] = []
      for (let table = 0; table < g.tables.length; table++) {
        for (let side = 0; side < 2; side++) seats.push({ kind: 'table', table, side })
      }
      const open = seats.filter(free)
      const joinable = open.find(
        (p) => p.kind === 'table' && !free({ kind: 'table', table: p.table, side: 1 - p.side }),
      )
      if (joinable) return joinable
      if (open.length > 0) return open[Math.floor(Math.random() * open.length)]
    } else if (roll < 0.64) {
      for (let sofa = 0; sofa < g.sofas.length; sofa++) {
        for (let seat = 0; seat < 2; seat++) {
          const p: Place = { kind: 'sofa', sofa, seat }
          if (free(p)) return p
        }
      }
    } else if (roll < 0.82 && g.gym) {
      const options: Place[] = Math.random() < 0.5 ? [{ kind: 'treadmill' }, { kind: 'lift' }] : [{ kind: 'lift' }, { kind: 'treadmill' }]
      const p = options.find(free)
      if (p) return p
    }

    // Wander to whichever of a few candidates overlaps least with other characters and chat table spots
    const occupied = others.filter((o) => LOUNGE_KINDS.includes(o.place.kind)).map((o) => this.placeX(o.place))
    for (const x of g.tables) occupied.push(x, x + TABLE_SIDE_OFFSET)
    let best: Place = { kind: 'wander', frac: Math.random() }
    let bestGap = -1
    for (let i = 0; i < 10; i++) {
      const p: Place = { kind: 'wander', frac: Math.random() }
      const x = this.placeX(p)
      const gap = Math.min(...occupied.map((ox) => Math.abs(ox - x)), Infinity)
      if (gap > bestGap) {
        best = p
        bestGap = gap
      }
    }
    return best
  }

  /** Decides where the character should be for its status */
  private decidePlace(c: Character, now: number): void {
    if (c.hold && now >= c.hold.until) c.hold = null
    if (c.leaving) {
      c.work = null
      this.go(c, { kind: 'door' })
      return
    }
    if (isBusy(c.info.status) || c.hold || this.pendingResult(c)) {
      c.work ??= this.allocateWork(c)
      this.go(c, c.work)
      return
    }
    c.work = null
    const inLounge = LOUNGE_KINDS.includes(c.place.kind)
    // Stay a bit longer while a chat is going
    if (inLounge && c.arrived && now >= c.loungeUntil && this.chatPartner(c) && Math.random() < 0.7) {
      c.loungeUntil = now + between(4000, 9000)
      return
    }
    if (!inLounge || (c.arrived && now >= c.loungeUntil)) this.go(c, this.pickLounge(c))
  }

  private arrive(c: Character, now: number): void {
    c.arrived = true
    switch (c.place.kind) {
      case 'desk':
      case 'overflow':
      case 'sofa':
      case 'treadmill':
      case 'lift':
        c.facing = 1
        break
      case 'coffee':
        c.facing = -1
        break
      case 'table':
        c.facing = c.place.side === 0 ? 1 : -1
        break
      default:
    }
    switch (c.place.kind) {
      case 'wander':
        c.loungeUntil = now + between(2500, 8000)
        break
      case 'coffee':
        c.loungeUntil = now + between(8000, 16000)
        break
      case 'sofa':
        c.loungeUntil = now + between(12000, 30000)
        break
      case 'table':
        c.loungeUntil = now + between(12000, 24000)
        break
      case 'treadmill':
        c.loungeUntil = now + between(12000, 26000)
        break
      case 'lift':
        c.loungeUntil = now + between(8000, 16000)
        break
      default:
    }
  }

  /** The partner who has arrived on the other side of the same chat table */
  private chatPartner(c: Character): Character | null {
    if (!c.arrived || c.place.kind !== 'table') return null
    const { table, side } = c.place
    return (
      this.chars.find(
        (o) => o !== c && o.arrived && !o.leaving && o.place.kind === 'table' && o.place.table === table && o.place.side !== side,
      ) ?? null
    )
  }

  /** Whether it's this character's turn to talk. Left and right sides take turns */
  private isSpeaking(c: Character, now: number): boolean {
    return c.place.kind === 'table' && this.chatPartner(c) !== null && Math.floor(now / TALK_TURN_MS) % 2 === c.place.side
  }

  update(dt: number, now: number): void {
    for (const c of this.chars) {
      this.decidePlace(c, now)
      const target = this.placeX(c.place)
      if (c.arrived) {
        c.x = target
      } else if (c.id !== this.hoveredId) {
        // Stop while hovered so the character is easy to click
        const dx = target - c.x
        const step = WALK_SPEED * dt
        if (Math.abs(dx) <= step) {
          c.x = target
          this.arrive(c, now)
        } else {
          c.facing = dx > 0 ? 1 : -1
          c.x += c.facing * step
        }
      }
      // Fade in at the door when arriving; fade out after reaching the door when leaving
      if (c.leaving && c.arrived && c.place.kind === 'door') c.alpha -= dt * 2.5
      else if (c.alpha < 1) c.alpha = Math.min(1, c.alpha + dt * 2.5)
    }
    this.chars = this.chars.filter((c) => c.alpha > 0 || !c.leaving)
  }

  private poseOf(c: Character, now: number): Pose {
    if (!c.arrived) return c.id === this.hoveredId ? 'stand' : 'walk'
    switch (c.place.kind) {
      case 'desk':
      case 'overflow':
        if (c.hold) return c.hold.pose
        if (c.info.status === 'waiting') return 'wave'
        if (c.info.status !== 'working') return 'stand'
        if (c.place.kind === 'overflow') return 'standType'
        switch (this.g.stations[c.place.i]?.kind) {
          case 'standing':
            return 'typeStand'
          case 'beanbag':
            return 'lapType'
          default:
            return 'type'
        }
      case 'coffee':
        return 'drink'
      case 'sofa':
        return 'sit'
      case 'table':
        // Sip coffee while alone; take turns talking once a partner arrives
        return this.isSpeaking(c, now) ? 'talk' : 'drink'
      case 'treadmill':
        return 'run'
      case 'lift':
        return 'lift'
      default:
        return 'stand'
    }
  }

  private bubbleOf(c: Character, now: number): BubbleKind | null {
    if (c.leaving) return null
    if (c.info.status === 'waiting') return 'bang'
    if (c.info.status === 'working') {
      if (!c.arrived) return null
      // Alternate between the current tool icon and three dots
      const tool = toolKind(c.info.tool)
      return tool && now % TOOL_CYCLE_MS < TOOL_SHOW_MS ? tool : 'dots'
    }
    // Keep showing an unacknowledged result until it's acknowledged
    return this.pendingResult(c) ?? (this.isSpeaking(c, now) ? 'talk' : null)
  }

  /** The unacknowledged result, if any. Uses the mark if we saw the session finish; otherwise follows Orca's read state */
  private pendingResult(c: Character): Mark | null {
    if (c.leaving || isBusy(c.info.status)) return null
    if (c.mark) return c.mark
    if (c.info.unread && !c.acked) return c.info.status === 'failed' ? 'fail' : c.info.status === 'interrupted' ? 'pause' : 'check'
    return null
  }

  /** The user clicked the character to acknowledge its result */
  acknowledge(id: string): void {
    const c = this.chars.find((o) => o.id === id)
    if (!c || !this.pendingResult(c)) return
    c.mark = null
    c.acked = true
    c.hold = null
  }

  /** The character at a scene coordinate. When they overlap, the one drawn last (in front) wins */
  hitTest(x: number, y: number): string | null {
    const top = this.g.floorY - CHAR_H - TREADMILL_H
    if (y < top || y >= this.g.floorY) return null
    for (let i = this.chars.length - 1; i >= 0; i--) {
      const c = this.chars[i]
      const left = Math.round(c.x)
      if (!c.leaving && x >= left && x < left + CHAR_W) return c.id
    }
    return null
  }

  /** Scene x coordinate of the character's center */
  centerX(id: string): number | null {
    const c = this.chars.find((o) => o.id === id)
    return c ? Math.round(c.x) + CHAR_W / 2 : null
  }

  setHovered(id: string | null): void {
    this.hoveredId = id
  }

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    const g = this.g
    ctx.clearRect(0, 0, g.w, g.h)
    drawFloor(ctx, g)
    ctx.drawImage(this.art.back.canvas, 0, 0)
    drawBackEffects(ctx, g, now)

    const atDesk = (c: Character): boolean => c.arrived && c.place.kind === 'desk'
    /** Raised by the belt height while on the treadmill */
    const feetY = (c: Character): number => g.floorY - (c.arrived && c.place.kind === 'treadmill' ? TREADMILL_H : 0)
    const drawOne = (c: Character): void => {
      ctx.globalAlpha = Math.max(0, Math.min(1, c.alpha))
      drawCharacterOutlined(ctx, Math.round(c.x), feetY(c), c.look, this.poseOf(c, now), c.facing, now, c.id === this.hoveredId)
      ctx.globalAlpha = 1
    }

    // Floor shadows go down before furniture and characters
    for (const c of this.chars) {
      ctx.globalAlpha = Math.max(0, Math.min(1, c.alpha))
      drawShadow(ctx, Math.round(c.x), g.floorY)
    }
    ctx.globalAlpha = 1

    // Seated characters are drawn behind the desktop and monitor; everyone else in front of the furniture
    for (const c of this.chars) if (atDesk(c)) drawOne(c)
    ctx.drawImage(this.art.front.canvas, 0, 0)
    const lit = (station: number): boolean =>
      this.chars.some((c) => atDesk(c) && c.place.kind === 'desk' && c.place.i === station && c.info.status === 'working')
    drawFrontEffects(ctx, g, lit, now)
    for (const c of this.chars) if (!atDesk(c)) drawOne(c)

    for (const c of this.chars) {
      const kind = this.bubbleOf(c, now)
      // Bob marks that await acknowledgement so they stand out
      const bob = this.pendingResult(c) && Math.floor(now / 450) % 2 ? 1 : 0
      if (kind) drawBubble(ctx, Math.round(c.x), feetY(c) - CHAR_H - bob, kind, g.w, now)
    }
  }
}
