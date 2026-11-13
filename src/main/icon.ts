import { nativeImage, type NativeImage } from 'electron'
import icon from '../../assets/icon-pixels.json'

// 16x16 tray icon: a person at a desk. The pixel data is shared with the installer icon (scripts/make-icon.mjs).

const PALETTE = icon.palette as Record<string, number[]>

function render(pixelSize: number): Buffer {
  const size = 16 * pixelSize
  const buf = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const color = PALETTE[icon.pixels[Math.floor(y / pixelSize)][Math.floor(x / pixelSize)]]
      if (!color) continue
      const i = (y * size + x) * 4
      // BGRA order
      buf[i] = color[2]
      buf[i + 1] = color[1]
      buf[i + 2] = color[0]
      buf[i + 3] = 255
    }
  }
  return buf
}

export function createTrayIcon(): NativeImage {
  const image = nativeImage.createFromBitmap(render(1), { width: 16, height: 16, scaleFactor: 1 })
  image.addRepresentation({ scaleFactor: 2, width: 32, height: 32, buffer: render(2) })
  return image
}
