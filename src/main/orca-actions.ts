import { execFile } from 'node:child_process'
import { callOrca } from './orca-cli'

// 캐릭터 클릭 시: Orca에서 그 세션의 워크스페이스를 열고 Orca 창을 앞으로 가져온다.
// Orca CLI에는 채팅 세션 탭을 직접 여는 명령이 없어 워크스페이스까지만 이동한다 (docs/PLAN.md 4장).

// Windows는 다른 프로세스의 창을 앞으로 가져오는 것을 제한한다.
// Alt 키 입력을 한 번 흉내 내면 제한이 풀리는 것을 이용한다.
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

/** 이 PC의 워크스페이스: `worktree activate`가 Orca 화면을 바로 전환한다 */
async function openLocal(worktreeId: string): Promise<void> {
  await callOrca(['worktree', 'activate', '--worktree', `id:${worktreeId}`, '--json'])
}

/**
 * 원격 환경의 워크스페이스.
 * `worktree activate --environment`는 성공을 반환하지만 이 PC의 Orca 화면을 바꾸지 않는다.
 * 화면을 원격 쪽으로 옮기는 명령은 `terminal switch --environment`뿐이라,
 * 그 워크스페이스에 임시 터미널을 만들고 → 그 터미널로 전환해 화면을 옮긴 뒤 → 터미널을 닫는다.
 * 터미널을 닫아도 화면은 그 워크스페이스에 남는다 (2026-11-12, Orca 1.4.255에서 확인).
 */
async function openRemote(worktreeId: string, environmentId: string): Promise<void> {
  const env = ['--environment', environmentId]
  const created = JSON.parse(
    await callOrca(['terminal', 'create', '--worktree', `id:${worktreeId}`, '--title', 'Taskbar Office', '--json', ...env], 20000),
  ) as { result?: { terminal?: { handle?: string } } }
  const handle = created.result?.terminal?.handle
  if (!handle) throw new Error('임시 터미널을 만들지 못했습니다')
  try {
    await callOrca(['terminal', 'switch', '--terminal', handle, '--json', ...env])
  } finally {
    // 전환에 실패해도 임시 터미널은 남기지 않는다
    await callOrca(['terminal', 'close', '--terminal', handle, '--json', ...env]).catch((error) =>
      console.error('임시 터미널 닫기 실패:', handle, error),
    )
  }
}

export async function openInOrca(worktreeId: string, environmentId: string | null): Promise<void> {
  // 창을 앞으로 가져오는 일과 워크스페이스 전환을 동시에 시작해 반응을 빠르게 한다
  const results = await Promise.allSettled([
    focusOrcaWindow(),
    environmentId ? openRemote(worktreeId, environmentId) : openLocal(worktreeId),
  ])
  for (const result of results) {
    if (result.status === 'rejected') console.error('Orca로 이동 실패:', result.reason)
  }
}
