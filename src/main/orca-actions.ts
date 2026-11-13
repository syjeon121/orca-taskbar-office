import { execFile } from 'node:child_process'
import { callOrca } from './orca-cli'

// On character click: open the session's workspace in Orca and bring the Orca window to the front.
// The Orca CLI has no command to open a chat session tab, so this only goes as far as the workspace.

// Windows restricts bringing another process's window to the front.
// Simulating a single Alt key press lifts that restriction.
const FOCUS_SCRIPT = `
Add-Type @'
using System; using System.Runtime.InteropServices;
public class OfficeFocus {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
}
'@
$p = Get-Process -Name Orca -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if ($p) {
  $h = $p.MainWindowHandle
  if ([OfficeFocus]::IsIconic($h)) { [OfficeFocus]::ShowWindow($h, 9) | Out-Null }
  [OfficeFocus]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)
  [OfficeFocus]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)
  [OfficeFocus]::SetForegroundWindow($h) | Out-Null
}
`

function focusOrcaWindow(): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', FOCUS_SCRIPT],
      { timeout: 15000, windowsHide: true },
      (error) => (error ? reject(error) : resolve()),
    )
  })
}

/** Workspace on this PC: `worktree activate` switches the Orca view directly */
async function openLocal(worktreeId: string): Promise<void> {
  await callOrca(['worktree', 'activate', '--worktree', `id:${worktreeId}`, '--json'])
}

/**
 * Workspace in a remote environment.
 * `worktree activate --environment` reports success but doesn't change the Orca view on this PC.
 * The only command that moves the view to a remote workspace is `terminal switch --environment`, so we
 * create a temporary terminal there, switch to it to move the view, then close the terminal.
 * The view stays on that workspace after the terminal closes (verified with Orca 1.4.255).
 */
async function openRemote(worktreeId: string, environmentId: string): Promise<void> {
  const env = ['--environment', environmentId]
  const created = JSON.parse(
    await callOrca(['terminal', 'create', '--worktree', `id:${worktreeId}`, '--title', 'Taskbar Office', '--json', ...env], 20000),
  ) as { result?: { terminal?: { handle?: string } } }
  const handle = created.result?.terminal?.handle
  if (!handle) throw new Error('Failed to create the temporary terminal')
  try {
    await callOrca(['terminal', 'switch', '--terminal', handle, '--json', ...env])
  } finally {
    // Don't leave the temporary terminal behind even if switching fails
    await callOrca(['terminal', 'close', '--terminal', handle, '--json', ...env]).catch((error) =>
      console.error('Failed to close the temporary terminal:', handle, error),
    )
  }
}

export async function openInOrca(worktreeId: string, environmentId: string | null): Promise<void> {
  // Raise the window and switch the workspace in parallel to feel snappier
  const results = await Promise.allSettled([
    focusOrcaWindow(),
    environmentId ? openRemote(worktreeId, environmentId) : openLocal(worktreeId),
  ])
  for (const result of results) {
    if (result.status === 'rejected') console.error('Failed to open in Orca:', result.reason)
  }
}
