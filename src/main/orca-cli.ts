import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// Orca CLI 호출 공통부. Electron에 의존하지 않는다.

const DEFAULT_TIMEOUT_MS = 10000

export function orcaCommand(): string {
  // PATH에 없을 때를 대비해 기본 설치 위치도 확인한다
  const installed = join(process.env.LOCALAPPDATA ?? '', 'Programs', 'orca', 'resources', 'bin', 'orca.exe')
  return existsSync(installed) ? installed : 'orca'
}

/** orca 명령을 실행해 표준 출력을 돌려준다. 실패하면 reject */
export function callOrca(args: string[], timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      orcaCommand(),
      args,
      { timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, windowsHide: true },
      (error, stdout) => (error ? reject(error) : resolve(stdout)),
    )
  })
}
