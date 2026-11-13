import type { Layout, OfficeApi } from '../shared/types'
import { Office } from './office'
import { computeGeometry } from './scene'

declare global {
  interface Window {
    office: OfficeApi
  }
}

type Edge = 'left' | 'right'

const canvas = document.getElementById('scene') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!

/** 띠 양 끝에서 이 거리(CSS 픽셀) 안쪽이 폭 조절 손잡이 */
const EDGE_ZONE = 8

let layout: Layout = { scale: 4, sceneWidth: 480, sceneHeight: 35 }
const office = new Office(computeGeometry(layout))

function setLayout(next: Layout): void {
  layout = next
  canvas.width = next.sceneWidth
  canvas.height = next.sceneHeight
  office.setGeometry(computeGeometry(next))
}

// 캐릭터가 움직이므로 커서가 가만히 있어도 매 프레임 다시 판정한다
let cursor: { x: number; y: number } | null = null
let hoveredEdge: Edge | null = null
let draggingEdge: Edge | null = null
let interactive = false

function edgeAt(x: number): Edge | null {
  if (x < EDGE_ZONE) return 'left'
  if (x >= window.innerWidth - EDGE_ZONE) return 'right'
  return null
}

function refreshHover(): void {
  const id = cursor && !draggingEdge ? office.hitTest(cursor.x / layout.scale, cursor.y / layout.scale) : null
  // 캐릭터가 끝에 서 있으면 캐릭터가 우선
  hoveredEdge = cursor && !id ? edgeAt(cursor.x) : null

  if (id !== office.hoveredId) {
    office.setHovered(id)
    const x = id ? office.centerX(id) : null
    window.office.hover(id && x !== null ? { id, x, scale: layout.scale } : null)
  }
  document.body.style.cursor = draggingEdge || hoveredEdge ? 'ew-resize' : id ? 'pointer' : 'default'
  // 캐릭터나 손잡이 위에서만 클릭을 받고, 그 밖에서는 뒤 창으로 통과시킨다
  const wanted = id !== null || hoveredEdge !== null || draggingEdge !== null
  if (wanted !== interactive) {
    interactive = wanted
    window.office.setInteractive(wanted)
  }
}

window.addEventListener('mousemove', (event) => {
  cursor = { x: event.clientX, y: event.clientY }
})
document.addEventListener('mouseleave', () => {
  if (!draggingEdge) cursor = null
})

canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return
  const edge = office.hoveredId ? null : edgeAt(event.clientX)
  if (!edge) return
  draggingEdge = edge
  // 커서가 창 밖으로 나가도 드래그가 끝날 때까지 이벤트를 계속 받는다
  canvas.setPointerCapture(event.pointerId)
})
canvas.addEventListener('pointermove', () => {
  if (draggingEdge) window.office.resizeDrag(draggingEdge)
})
function endDrag(): void {
  if (!draggingEdge) return
  draggingEdge = null
  window.office.resizeEnd()
}
canvas.addEventListener('pointerup', endDrag)
canvas.addEventListener('pointercancel', endDrag)

window.addEventListener('click', () => {
  if (!office.hoveredId) return
  // 클릭하면 결과를 확인한 것으로 보고 표시를 내린다
  office.acknowledge(office.hoveredId)
  window.office.characterClicked(office.hoveredId)
})

/** 폭 조절 손잡이: 커서가 끝에 오거나 드래그 중일 때만 보인다 */
function drawEdgeGrip(): void {
  const edge = draggingEdge ?? hoveredEdge
  if (!edge) return
  const x = edge === 'left' ? 0 : layout.sceneWidth - 2
  ctx.fillStyle = '#ffe066'
  ctx.fillRect(x, layout.sceneHeight - 16, 2, 16)
  ctx.fillStyle = '#8a6a10'
  for (let y = layout.sceneHeight - 12; y < layout.sceneHeight - 3; y += 3) ctx.fillRect(x, y, 2, 1)
}

let last = performance.now()
function frame(now: number): void {
  office.update(Math.min(0.1, (now - last) / 1000), now)
  last = now
  refreshHover()
  office.draw(ctx, now)
  drawEdgeGrip()
  requestAnimationFrame(frame)
}

async function start(): Promise<void> {
  window.office.onLayout(setLayout)
  window.office.onSessions((sessions) => office.setSessions(sessions, performance.now()))
  setLayout(await window.office.getLayout())
  office.setSessions(await window.office.getSessions(), performance.now())
  requestAnimationFrame(frame)
}

void start()
