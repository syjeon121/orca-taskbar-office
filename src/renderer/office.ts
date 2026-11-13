import type { SessionInfo, SessionStatus } from '../shared/types'
import { CHAR_H, CHAR_W, COFFEE_SLOTS, TABLE_SIDE_OFFSET, TREADMILL_H, type Geometry } from './scene'
import { drawBackEffects, drawFloor, drawFrontEffects, drawShadow, renderSceneArt, type SceneArt } from './scene-art'
import { drawBubble, drawCharacterOutlined, lookFor, toolKind, type BubbleKind, type Look, type Pose } from './sprites'

// 세션 목록을 받아 캐릭터들을 움직이고 그린다.
// 캐릭터는 "있어야 할 자리"를 상태에서 계산하고, 그 자리로 걸어가 도착하면 자세를 잡는다.

type Place =
  /** 오피스의 일하는 자리 (책상, 스탠딩 데스크, 공용 테이블, 빈백) */
  | { kind: 'desk'; i: number }
  /** 자리가 모자랄 때 서서 일하는 자리 */
  | { kind: 'overflow'; i: number }
  | { kind: 'wander'; frac: number }
  | { kind: 'coffee'; slot: number }
  | { kind: 'sofa'; sofa: number; seat: number }
  /** 수다 테이블의 왼쪽(0) 또는 오른쪽(1) */
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
  /** 배정받은 작업 자리. 일하는 동안과 끝난 직후 연출 동안 유지 */
  work: Place | null
  /** 작업이 끝난 직후 자리에서 하는 동작 */
  hold: { pose: 'cheer' | 'trouble'; until: number } | null
  /** 끝난 뒤 머리 위에 남는 결과 표시. 사용자가 확인할 때까지 사라지지 않는다 */
  mark: Mark | null
  /** 사용자가 캐릭터를 클릭해 결과를 확인함. Orca의 읽음 표시가 늦게 따라와도 다시 띄우지 않는다 */
  acked: boolean
  /** 라운지에서 지금 하는 행동을 끝낼 시각 */
  loungeUntil: number
  alpha: number
  leaving: boolean
}

const WALK_SPEED = 26 // 장면 픽셀/초
const CHEER_MS = 2600
const TROUBLE_MS = 6000
/** 수다 중 말하는 사람이 바뀌는 간격 */
const TALK_TURN_MS = 1500
/** 작업 중 말풍선: 이 주기 중 앞부분은 도구 아이콘, 나머지는 점 세 개 */
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
  /** 외곽선까지 입혀 미리 그려 둔 가구 그림 */
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
    // 창 폭이 바뀌면 가구 구성이 달라진다. 사라진 자리는 반납하고 다시 고르게 한다
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
      // Orca에서 확인하면(읽음) 결과 표시를 내린다
      if (c.info.unread && !next.unread && !isBusy(next.status)) c.mark = null
      if (!next.unread) c.acked = false
      c.info = next
      c.leaving = false
    }
    for (const info of incoming.values()) {
      // 처음 받은 목록의 세션은 이미 자리에 있는 것으로 시작하고, 이후 추가된 세션은 문으로 출근한다
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
    // 작업이 방금 끝남. 자리에서 연출한 뒤, 확인할 때까지 그 자리에 머물며 결과 표시를 달고 있는다
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

  /** 현재 배치에 그 자리가 실제로 있는지 */
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
    // 빈 자리 중 아무 곳이나 고른다. 책상, 스탠딩 데스크, 공용 테이블, 빈백이 골고루 쓰인다
    const free = this.g.stations.map((_, i): Place => ({ kind: 'desk', i })).filter((p) => !taken(p))
    if (free.length > 0) return free[Math.floor(Math.random() * free.length)]
    for (let i = 0; ; i++) {
      const p: Place = { kind: 'overflow', i }
      if (!taken(p)) return p
    }
  }

  /** 라운지에서 다음에 할 일을 고른다: 커피, 수다, 소파, 운동, 서성이기 */
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
      // 수다: 혼자 서 있는 사람이 있는 테이블에 먼저 합류하고, 없으면 빈 테이블에서 기다린다
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

    // 서성일 자리는 후보 몇 개 중 다른 캐릭터나 수다 테이블 자리와 가장 덜 겹치는 곳으로 고른다
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

  /** 상태에 맞는 자리를 정한다 */
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
    // 수다가 한창일 때는 자리를 뜨지 않고 조금 더 머문다
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

  /** 같은 수다 테이블 맞은편에 도착해 있는 상대 */
  private chatPartner(c: Character): Character | null {
    if (!c.arrived || c.place.kind !== 'table') return null
    const { table, side } = c.place
    return (
      this.chars.find(
        (o) => o !== c && o.arrived && !o.leaving && o.place.kind === 'table' && o.place.table === table && o.place.side !== side,
      ) ?? null
    )
  }

  /** 수다 중 지금 말할 차례인지. 테이블의 왼쪽과 오른쪽이 번갈아 말한다 */
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
        // 커서가 올라가 있는 동안은 멈춰 서서 클릭하기 쉽게 한다
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
      // 출근은 문에서 서서히 나타나고, 퇴근은 문에 도착한 뒤 서서히 사라진다
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
        // 혼자면 커피를 마시며 기다리고, 상대가 오면 번갈아 말한다
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
      // 사용 중인 도구 아이콘과 점 세 개를 번갈아 보여준다
      const tool = toolKind(c.info.tool)
      return tool && now % TOOL_CYCLE_MS < TOOL_SHOW_MS ? tool : 'dots'
    }
    // 확인하지 않은 결과가 있으면 확인할 때까지 계속 달고 있는다
    return this.pendingResult(c) ?? (this.isSpeaking(c, now) ? 'talk' : null)
  }

  /** 아직 확인하지 않은 결과. 끝나는 순간을 봤으면 그 표시를, 처음부터 끝나 있던 세션은 Orca의 읽음 정보를 따른다 */
  private pendingResult(c: Character): Mark | null {
    if (c.leaving || isBusy(c.info.status)) return null
    if (c.mark) return c.mark
    if (c.info.unread && !c.acked) return c.info.status === 'failed' ? 'fail' : c.info.status === 'interrupted' ? 'pause' : 'check'
    return null
  }

  /** 사용자가 캐릭터를 클릭해 결과를 확인함 */
  acknowledge(id: string): void {
    const c = this.chars.find((o) => o.id === id)
    if (!c || !this.pendingResult(c)) return
    c.mark = null
    c.acked = true
    c.hold = null
  }

  /** 장면 좌표가 가리키는 캐릭터. 겹치면 나중에 그려진(앞에 있는) 쪽 */
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

  /** 캐릭터 가운데의 장면 x좌표 */
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
    /** 러닝머신 위에서는 벨트 높이만큼 올라가 있다 */
    const feetY = (c: Character): number => g.floorY - (c.arrived && c.place.kind === 'treadmill' ? TREADMILL_H : 0)
    const drawOne = (c: Character): void => {
      ctx.globalAlpha = Math.max(0, Math.min(1, c.alpha))
      drawCharacterOutlined(ctx, Math.round(c.x), feetY(c), c.look, this.poseOf(c, now), c.facing, now, c.id === this.hoveredId)
      ctx.globalAlpha = 1
    }

    // 바닥 그림자는 가구와 캐릭터보다 먼저 깐다
    for (const c of this.chars) {
      ctx.globalAlpha = Math.max(0, Math.min(1, c.alpha))
      drawShadow(ctx, Math.round(c.x), g.floorY)
    }
    ctx.globalAlpha = 1

    // 자리에 있는 캐릭터는 책상 상판과 모니터 뒤에, 나머지는 가구 앞에 그린다
    for (const c of this.chars) if (atDesk(c)) drawOne(c)
    ctx.drawImage(this.art.front.canvas, 0, 0)
    const lit = (station: number): boolean =>
      this.chars.some((c) => atDesk(c) && c.place.kind === 'desk' && c.place.i === station && c.info.status === 'working')
    drawFrontEffects(ctx, g, lit, now)
    for (const c of this.chars) if (!atDesk(c)) drawOne(c)

    for (const c of this.chars) {
      const kind = this.bubbleOf(c, now)
      // 확인을 기다리는 표시는 위아래로 까딱여 눈에 띄게 한다
      const bob = this.pendingResult(c) && Math.floor(now / 450) % 2 ? 1 : 0
      if (kind) drawBubble(ctx, Math.round(c.x), feetY(c) - CHAR_H - bob, kind, g.w, now)
    }
  }
}
