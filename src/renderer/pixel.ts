// Shared pixel-art helpers: small offscreen canvases, automatic outlines and color shading.

export interface Surface {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
}

export function makeSurface(width: number, height: number): Surface {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, width)
  canvas.height = Math.max(1, height)
  // Pixels are read back for every outline, so optimize the context for reads
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  return { canvas, ctx }
}

export type Rgb = [number, number, number]

/** Dark outline color that keeps sprites readable on both light and dark backgrounds */
export const OUTLINE: Rgb = [38, 32, 44]
export const OUTLINE_HOVER: Rgb = [255, 224, 102]

/**
 * Fills empty pixels that touch drawn pixels with the outline color.
 * No outline is added below limitY (the floor).
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

/** Mixes two '#rrggbb' colors. t = 0 gives a, t = 1 gives b */
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

/** Lightens (amount > 0) or darkens (amount < 0) a '#rrggbb' color. amount is -1 to 1 */
export function shade(hex: string, amount: number): string {
  return mix(hex, amount > 0 ? '#ffffff' : '#000000', Math.abs(amount))
}
