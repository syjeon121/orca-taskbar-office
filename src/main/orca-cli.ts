import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// Shared helpers for calling the Orca CLI. No Electron dependency.

const DEFAULT_TIMEOUT_MS = 10000

export function orcaCommand(): string {
  // Also check the default install location in case orca isn't on PATH
  const installed = join(process.env.LOCALAPPDATA ?? '', 'Programs', 'orca', 'resources', 'bin', 'orca.exe')
  return existsSync(installed) ? installed : 'orca'
}

/** Runs an orca command and resolves with its stdout. Rejects on failure */
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
