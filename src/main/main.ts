import { app, ipcMain, screen } from 'electron'
import { writeFileSync } from 'node:fs'
import { openInOrca } from './orca-actions'
import { findSession, registerSessionIpc } from './session-hub'
import { createTooltip, hideTooltip } from './tooltip'
import { applySource, onSourceStatus } from './source'
import { createTray, refreshTrayMenu, setTrayStatus } from './tray'
import { applyLayout, createWindow, registerWindowIpc } from './window'

// 설치본(제품 이름 "Taskbar Office")과 개발 실행이 같은 설정 폴더(%APPDATA%\orca-taskbar-office)를 쓰게 한다
app.setName('orca-taskbar-office')

// TASKBAR_OFFICE_SNAPSHOT=<png 경로>: 시작 몇 초 뒤(TASKBAR_OFFICE_SNAPSHOT_DELAY, 기본 7000ms) 장면 캔버스를 PNG로 저장한다.
// 화면을 직접 볼 수 없을 때(잠금 화면, 원격 작업) 그림을 확인하기 위한 개발용 기능.
const snapshotPath = process.env.TASKBAR_OFFICE_SNAPSHOT
// 창이 가려져 있어도 계속 그리게 한다
if (snapshotPath) app.commandLine.appendSwitch('disable-features', 'CalcNativeWinOcclusion')

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.whenReady().then(() => {
    registerWindowIpc(refreshTrayMenu)
    registerSessionIpc()
    const win = createWindow()
    if (snapshotPath) {
      const delay = Number(process.env.TASKBAR_OFFICE_SNAPSHOT_DELAY ?? 7000)
      setTimeout(async () => {
        const url: string = await win.webContents.executeJavaScript("document.getElementById('scene').toDataURL('image/png')")
        writeFileSync(snapshotPath, Buffer.from(url.split(',')[1], 'base64'))
      }, delay)
    }
    createTooltip()
    createTray()

    ipcMain.on('character-clicked', (_event, id: string) => {
      const session = findSession(id)
      hideTooltip()
      // 데모 세션은 연결된 워크스페이스가 없다
      if (session?.worktreeId) void openInOrca(session.worktreeId, session.environmentId)
    })
    onSourceStatus(setTrayStatus)
    applySource()

    // 모니터 연결/분리, 해상도·배율 변경, 작업표시줄 크기 변경 시 다시 배치
    const onDisplaysChanged = (): void => {
      applyLayout()
      refreshTrayMenu()
    }
    screen.on('display-added', onDisplaysChanged)
    screen.on('display-removed', onDisplaysChanged)
    screen.on('display-metrics-changed', onDisplaysChanged)
  })

  // 창이 닫혀도 트레이에 남는다. 종료는 트레이 메뉴에서만.
  app.on('window-all-closed', () => {})
}
