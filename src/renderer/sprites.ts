import { addOutline, makeSurface, mix, OUTLINE, OUTLINE_HOVER, shade } from './pixel'
import { CHAR_H, CHAR_W } from './scene'

// 캐릭터와 말풍선을 사각형 조합으로 그린다. 이미지 파일 없이 코드만으로 외형과 자세를 만든다.

export type Pose = 'stand' | 'walk' | 'run' | 'lift' | 'talk' | 'type' | 'typeStand' | 'lapType' | 'standType' | 'sit' | 'wave' | 'cheer' | 'trouble' | 'drink'
export type ToolKind = 'terminal' | 'edit' | 'read' | 'search' | 'web' | 'agent'
export type BubbleKind = 'dots' | 'bang' | 'check' | 'fail' | 'pause' | 'talk' | ToolKind

/** 도구 이름을 말풍선 아이콘 종류로 분류한다. 에이전트마다 도구 이름이 달라 이름의 일부로 판단한다 */
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
  /** 모자 색. hat이 false면 쓰지 않음 */
  hat: string | null
  hatDark: string
  hatLight: string
  beard: boolean
  /** 셔츠 앞쪽 무늬: 0 없음, 1 가로 줄무늬, 2 넥타이, 3 멜빵 */
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

/** 세션 id를 시드로 써서 같은 세션은 항상 같은 외형이 된다. 부위마다 따로 해시해 조합이 고르게 섞이게 한다 */
export function lookFor(id: string): Look {
  const pick = <T>(part: string, list: readonly T[]): T => list[hash(id + ':' + part) % list.length]
  const chance = (part: string, percent: number): boolean => hash(id + ':' + part) % 100 < percent
  const skin = pick('skin', SKINS)
  const hair = pick('hair', HAIRS)
  const shirt = pick('shirt', SHIRTS)
  const pants = pick('pants', PANTS)
  const hairStyle = hash(id + ':style') % HAIR_STYLES
  // 모자는 머리 모양과 별개로 가끔 쓴다. 셔츠와 같은 색이면 묻히니 피한다
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
    // 볼은 피부색에 붉은 기를 살짝 더한다
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

// 캐릭터를 따로 그려 외곽선을 입히는 작업용 캔버스. 팔, 아령, 노트북이 몸 밖으로 나가므로 여백을 둔다
const PAD_X = 6
const PAD_TOP = 4
const PAD_BOTTOM = 1
const sprite = makeSurface(CHAR_W + PAD_X * 2, CHAR_H + PAD_TOP + PAD_BOTTOM)

/**
 * 외곽선을 입힌 캐릭터를 그린다. highlighted면 외곽선이 노란색이 된다 (커서가 올라간 캐릭터).
 * (x, feetY)는 캐릭터의 왼쪽 끝과 발바닥 높이.
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
 * (x, feetY)는 캐릭터의 왼쪽 끝과 발바닥 높이.
 * 부위 좌표는 오른쪽을 보는 기준으로 쓰고, facing이 -1이면 좌우를 뒤집는다.
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

  // 다리
  if (pose === 'type' || pose === 'sit' || pose === 'lapType') {
    p(look.pants, 2, 11, 7, 1) // 허벅지
    p(look.pantsDark, 2, 11, 2, 1)
    p(look.pants, 7, 12, 2, 1) // 정강이
    p(SHOE, 7, 13, 3, 1)
  } else {
    const stride = (pose === 'walk' && slow) || (pose === 'run' && fast) ? 1 : 0
    p(look.pantsDark, 1 + stride, 11, 2, 2) // 뒤쪽 다리는 어둡게
    p(look.pants, 5 - stride, 11, 2, 2)
    p(SHOE, 1 + stride, 13, 2, 1)
    p(SHOE, 5 - stride, 13, 2, 1)
  }

  // 몸통: 등 쪽과 밑단을 어둡게 해 입체감을 주고, 목 부분은 피부색으로 판다
  p(look.shirt, 1, 6, 6, 5)
  p(look.shirtDark, 1, 7, 1, 4)
  p(look.shirtDark, 1, 10, 6, 1)
  p(look.shirtLight, 5, 7, 1, 2)
  p(look.skinDark, 3, 6, 2, 1)
  switch (look.pattern) {
    case 1: // 가로 줄무늬
      p(look.accent, 2, 8, 5, 1)
      break
    case 2: // 넥타이
      p(look.accent, 4, 7, 1, 3)
      break
    case 3: // 멜빵
      p(look.accent, 2, 7, 1, 3)
      p(look.accent, 6, 7, 1, 3)
      break
    default:
  }

  // 머리
  p(look.skin, 1, 2, 6, 4)
  p(look.skinDark, 1, 5, 6, 1) // 턱 그림자
  p(EYE, 3, 3, 1, 1)
  p(EYE, 5, 3, 1, 1)
  p(look.blush, 6, 4, 1, 1)
  p(look.blush, 2, 4, 1, 1)
  if (look.beard) {
    p(look.hair, 2, 5, 5, 1)
    p(look.hair, 6, 4, 1, 1)
  }
  switch (look.hairStyle) {
    case 0: // 짧은 머리
      p(look.hair, 1, 0, 6, 2)
      p(look.hair, 1, 2, 1, 2)
      p(look.hairLight, 4, 0, 2, 1)
      break
    case 3: // 단발
      p(look.hair, 1, 0, 6, 2)
      p(look.hair, 0, 1, 2, 4)
      p(look.hair, 6, 2, 1, 1)
      p(look.hairLight, 3, 0, 2, 1)
      break
    case 4: // 포니테일
      p(look.hair, 1, 0, 6, 2)
      p(look.hair, 1, 2, 1, 1)
      p(look.hair, 0, 1, 1, 2)
      p(look.hair, -1, 2, 1, 3)
      p(look.hairLight, 4, 0, 2, 1)
      break
    case 5: // 올림머리
      p(look.hair, 2, -2, 3, 2)
      p(look.hair, 1, 0, 6, 2)
      p(look.hair, 1, 2, 1, 1)
      p(look.hairLight, 3, -2, 1, 1)
      break
    case 6: // 곱슬
      p(look.hair, 0, 0, 8, 2)
      p(look.hair, 1, -1, 2, 1)
      p(look.hair, 4, -1, 2, 1)
      p(look.hair, 0, 2, 2, 2)
      p(look.hairLight, 2, 0, 1, 1)
      p(look.hairLight, 5, 0, 1, 1)
      break
    case 7: // 옆가르마 짧은 머리
      p(look.hair, 1, 0, 6, 1)
      p(look.hair, 1, 1, 3, 1)
      p(look.hair, 6, 1, 1, 1)
      p(look.hair, 1, 2, 1, 2)
      p(look.hairLight, 2, 0, 3, 1)
      break
    case 1: // 긴 머리
      p(look.hair, 1, 0, 6, 2)
      p(look.hair, 0, 1, 2, 6)
      p(look.hairLight, 4, 0, 2, 1)
      p(look.hairLight, 0, 3, 1, 2)
      break
    case 2: // 삐죽 머리
      p(look.hair, 1, 1, 6, 1)
      p(look.hair, 1, 0, 1, 1)
      p(look.hair, 3, 0, 1, 1)
      p(look.hair, 5, 0, 1, 1)
      p(look.hair, 1, 2, 1, 1)
      p(look.hairLight, 5, 0, 1, 1)
      break
    default: // 까까머리
      p(look.hair, 1, 1, 6, 1)
      p(look.hair, 1, 2, 1, 1)
  }
  if (look.hat) {
    // 챙 달린 모자. 머리 모양 위에 덮어 쓴다
    p(look.hat, 1, 0, 6, 2)
    p(look.hatLight, 2, 0, 3, 1)
    p(look.hatDark, 1, 1, 6, 1)
    p(look.hatDark, 7, 1, 1, 1)
  }

  // 팔. 뒤쪽 팔(dx 0)과 앞쪽 팔(dx 7)
  const armDown = (dx: number): void => {
    p(dx === 0 ? look.shirtDark : look.shirt, dx, 6, 1, 3)
    p(look.skin, dx, 9, 1, 1)
  }
  switch (pose) {
    case 'type':
      p(look.shirt, 7, 8, 2, 1)
      p(look.skin, 9, 8 - fast, 1, 1)
      break
    case 'typeStand': // 스탠딩 데스크: 서서 높은 키보드를 친다
      p(look.shirt, 7, 7, 2, 1)
      p(look.skin, 9, 6 - fast, 1, 1)
      break
    case 'lapType': // 빈백: 무릎 위 노트북
      p(look.shirt, 7, 8, 1, 1)
      p(look.skin, 7, 9 - fast, 1, 1)
      p('#5a6070', 6, 10, 4, 1)
      p('#5a6070', 10, 7, 1, 3)
      p(fast ? '#bfe9ff' : '#9fd8f5', 9, 7, 1, 3)
      break
    case 'run': // 러닝머신: 팔을 번갈아 흔든다
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
      // 아령: 내렸다가 머리 위로 들어 올리기를 반복
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
    case 'talk': // 수다: 말하면서 손짓
      armDown(0)
      p(look.shirt, 7, 6, 1, 2)
      p(look.skin, 8, 7 - slow, 1, 1)
      break
    case 'standType':
      p(look.shirt, 7, 8, 2, 1)
      p('#2c303a', 9, 6, 1, 3) // 태블릿
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
      p(look.skin, 6 - slow, 1, 1, 1) // 머리 긁적이는 손
      break
    case 'drink': {
      armDown(0)
      // 4초에 한 번, 1초 동안 컵을 입으로 가져간다
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

// 7x5 아이콘. '#'이 칠해지는 픽셀
// bg/border가 있으면 흰 말풍선 대신 그 색으로 칠해 눈에 띄게 한다
const ICONS: Record<Exclude<BubbleKind, 'dots'>, { color: string; rows: string[]; bg?: string; border?: string }> = {
  bang: { color: '#e0453a', rows: ['...#...', '...#...', '...#...', '.......', '...#...'] },
  check: { color: '#ffffff', bg: '#2fb35a', border: '#145c2c', rows: ['......#', '.....#.', '#...#..', '.#.#...', '..#....'] },
  fail: { color: '#e0453a', rows: ['.#...#.', '..#.#..', '...#...', '..#.#..', '.#...#.'] },
  pause: { color: '#7a7f8a', rows: ['..#.#..', '..#.#..', '..#.#..', '..#.#..', '..#.#..'] },
  talk: { color: '#6a7080', rows: ['.##.###', '.......', '.#####.', '.......', '.###.#.'] },
  // 작업 중 사용하는 도구
  terminal: { color: '#3a4050', rows: ['.#.....', '..#....', '.#.....', '....###', '.......'] },
  edit: { color: '#c9862a', rows: ['.....##', '....##.', '...##..', '.###...', '.#.....'] },
  read: { color: '#3f7fb0', rows: ['.#####.', '.#...#.', '.#.#.#.', '.#...#.', '.#####.'] },
  search: { color: '#7a4fb0', rows: ['.###...', '.#.#...', '.###...', '....#..', '.....#.'] },
  web: { color: '#2f9e8a', rows: ['..###..', '.#.#.#.', '.#####.', '.#.#.#.', '..###..'] },
  agent: { color: '#d97757', rows: ['...#...', '..###..', '...#...', '..###..', '..#.#..'] },
}

/** 캐릭터 머리 위 말풍선. (x, headTop)은 캐릭터 왼쪽 끝과 머리 꼭대기 */
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
    // 점 세 개가 차례로 튀어 오른다
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
