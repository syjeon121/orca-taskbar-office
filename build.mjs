import { build } from 'esbuild'
import { copyFile, mkdir } from 'node:fs/promises'

const common = { bundle: true, sourcemap: true, target: 'es2022', logLevel: 'info' }

await mkdir('dist', { recursive: true })
await Promise.all([
  build({ ...common, entryPoints: ['src/main/main.ts'], outfile: 'dist/main.js', platform: 'node', format: 'cjs', external: ['electron'] }),
  build({ ...common, entryPoints: ['src/preload/preload.ts'], outfile: 'dist/preload.js', platform: 'node', format: 'cjs', external: ['electron'] }),
  build({ ...common, entryPoints: ['src/renderer/renderer.ts'], outfile: 'dist/renderer.js', platform: 'browser', format: 'iife' }),
  build({ ...common, entryPoints: ['src/preload/tooltip-preload.ts'], outfile: 'dist/tooltip-preload.js', platform: 'node', format: 'cjs', external: ['electron'] }),
  build({ ...common, entryPoints: ['src/renderer/tooltip.ts'], outfile: 'dist/tooltip.js', platform: 'browser', format: 'iife' }),
  copyFile('src/renderer/index.html', 'dist/index.html'),
  copyFile('src/renderer/tooltip.html', 'dist/tooltip.html'),
])
