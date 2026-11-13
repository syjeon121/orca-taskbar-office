// Generates build/icon.ico for the installer and executable.
// Scales the same 16x16 pixel art as the tray icon by 16x into a 256x256 PNG inside an ICO container.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { deflateSync } from 'node:zlib'

const { pixels, palette } = JSON.parse(await readFile('assets/icon-pixels.json', 'utf8'))
const SCALE = 16
const size = pixels.length * SCALE

// Each PNG row is one filter byte (0) followed by RGBA pixels
const raw = Buffer.alloc(size * (size * 4 + 1))
for (let y = 0; y < size; y++) {
  const row = y * (size * 4 + 1)
  for (let x = 0; x < size; x++) {
    const color = palette[pixels[Math.floor(y / SCALE)][Math.floor(x / SCALE)]]
    if (!color) continue
    const i = row + 1 + x * 4
    raw[i] = color[0]
    raw[i + 1] = color[1]
    raw[i + 2] = color[2]
    raw[i + 3] = 255
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const out = Buffer.alloc(body.length + 8)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc32(body), body.length + 4)
  return out
}

const header = Buffer.alloc(13)
header.writeUInt32BE(size, 0)
header.writeUInt32BE(size, 4)
header[8] = 8 // 8 bits per channel
header[9] = 6 // RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', header),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
])

// ICO: 6-byte header + one 16-byte entry + PNG data. A width/height of 0 means 256
const ico = Buffer.alloc(22)
ico.writeUInt16LE(1, 2)
ico.writeUInt16LE(1, 4)
ico.writeUInt16LE(1, 10)
ico.writeUInt16LE(32, 12)
ico.writeUInt32LE(png.length, 14)
ico.writeUInt32LE(22, 18)

await mkdir('build', { recursive: true })
await writeFile('build/icon.ico', Buffer.concat([ico, png]))
console.log(`build/icon.ico (${size}x${size}, ${png.length + 22} bytes)`)
