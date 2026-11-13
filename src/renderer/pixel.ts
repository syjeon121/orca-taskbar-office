// 픽셀아트용 공통 도구: 작은 오프스크린 캔버스, 자동 외곽선, 색 밝기 조절.

export interface Surface {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
}

export function makeSurface(width: number, height: number): Surface {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, width)
  canvas.height = Math.max(1, height)
  // 외곽선을 만들 때마다 픽셀을 읽으므로 읽기에 유리한 방식으로 만든다
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  return { canvas, ctx }
}

export type Rgb = [number, number, number]

/** 어두운 외곽선 색. 밝은 배경과 어두운 배경 어디서나 그림이 묻히지 않게 한다 */
export const OUTLINE: Rgb = [38, 32, 44]
export const OUTLINE_HOVER: Rgb = [255, 224, 102]

/**
 * 그려진 픽셀에 맞닿은 빈 픽셀을 외곽선 색으로 채운다.
 * limitY 아래(바닥)에는 외곽선을 넣지 않는다.
 */
export function addOutline(surface: Surface, color: Rgb = OUTLINE, limitY = surface.canvas.height): void {
  const { width, height } = surface.canvas
  const image = surface.ctx.getImageData(0, 0, width, height)
  const data = image.data
  const filled = new Uint8Array(width * height)
  for (let i = 0; i < filled.length; i++) filled[i] = data[i * 4 + 3] > 0 ? 1 : 0
  const rows = Math.min(height, limitY)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      if (filled[i]) continue
      const touching =
        (x > 0 && filled[i - 1]) || (x < width - 1 && filled[i + 1]) || (y > 0 && filled[i - width]) || (y < height - 1 && filled[i + width])
      if (!touching) continue
      data[i * 4] = color[0]
      data[i * 4 + 1] = color[1]
      data[i * 4 + 2] = color[2]
      data[i * 4 + 3] = 255
    }
  }
  surface.ctx.putImageData(image, 0, 0)
}

/** 두 '#rrggbb' 색을 섞는다. t가 0이면 a, 1이면 b */
export function mix(a: string, b: string, t: number): string {
  const x = parseInt(a.slice(1), 16)
  const y = parseInt(b.slice(1), 16)
  const channel = (shift: number): number => {
    const from = (x >> shift) & 255
    const to = (y >> shift) & 255
    return Math.round(from + (to - from) * t)
  }
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, '0')}`
}

/** '#rrggbb' 색을 밝게(amount > 0) 또는 어둡게(amount < 0) 한다. amount는 -1~1 */
export function shade(hex: string, amount: number): string {
  return mix(hex, amount > 0 ? '#ffffff' : '#000000', Math.abs(amount))
}
