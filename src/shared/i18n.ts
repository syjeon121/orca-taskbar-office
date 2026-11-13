// UI strings for every supported language. English is the default.

export type Language = 'en' | 'ko'

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ko', label: '한국어' },
]

export interface Strings {
  // Tray menu
  showOffice: string
  size: string
  scaleOption: (scale: number, height: number) => string
  width: string
  widthFull: string
  widthHalf: string
  position: string
  alignLeft: string
  alignCenter: string
  alignRight: string
  alignCustom: string
  monitor: string
  monitorOption: (n: number, width: number, height: number, primary: boolean) => string
  goHome: string
  goHomeAfter: (minutes: number) => string
  goHomeNever: string
  maxCharacters: string
  characterCount: (n: number) => string
  launchAtStartup: string
  remoteEnvironments: string
  language: string
  demoMode: string
  demoControls: string
  demoAuto: string
  demoAdd: string
  demoStart: string
  demoWaiting: string
  demoDone: string
  demoFailed: string
  demoInterrupted: string
  demoRemove: string
  quit: string
  // Source status (tray tooltip and first menu line)
  statusDemo: string
  statusConnecting: string
  statusDisconnected: string
  statusConnected: (remote: string, working: number, shown: number, total: number) => string
  statusRemotes: (up: number, total: number) => string
  // Tooltip
  duration: (minutes: number) => string
  working: (tool: string | null, elapsed: string) => string
  waiting: (elapsed: string) => string
  done: (elapsed: string) => string
  failed: (elapsed: string) => string
  interrupted: (elapsed: string) => string
  unread: string
  remoteHost: (host: string) => string
  untitled: string
  clickHint: string
}

function hoursOrDays(minutes: number, h: string, d: string): string {
  return minutes >= 24 * 60 ? `${minutes / (24 * 60)}${d}` : `${minutes / 60}${h}`
}

const en: Strings = {
  showOffice: 'Show office',
  size: 'Size',
  scaleOption: (s, h) => `${s}x (${h}px tall)`,
  width: 'Width',
  widthFull: 'Full',
  widthHalf: 'Half',
  position: 'Position',
  alignLeft: 'Left',
  alignCenter: 'Center',
  alignRight: 'Right',
  alignCustom: 'Custom (drag the strip ends)',
  monitor: 'Monitor',
  monitorOption: (n, w, h, primary) => `Monitor ${n} (${w}×${h})${primary ? ' · primary' : ''}`,
  goHome: 'Go home after finishing',
  goHomeAfter: (m) => (m < 60 ? `${m} min` : m === 60 ? '1 hour' : m === 24 * 60 ? '1 day' : hoursOrDays(m, ' hours', ' days')),
  goHomeNever: 'Never',
  maxCharacters: 'Max characters',
  characterCount: (n) => `${n}`,
  launchAtStartup: 'Launch at Windows startup',
  remoteEnvironments: 'Remote environments',
  language: 'Language',
  demoMode: 'Demo mode (fake sessions)',
  demoControls: 'Demo controls',
  demoAuto: 'Auto play',
  demoAdd: 'Add session',
  demoStart: 'Start working',
  demoWaiting: 'Wait for user',
  demoDone: 'Finish',
  demoFailed: 'Fail',
  demoInterrupted: 'Interrupt',
  demoRemove: 'Remove session',
  quit: 'Quit',
  statusDemo: 'Demo mode',
  statusConnecting: 'Connecting to Orca',
  statusDisconnected: 'Orca not connected',
  statusConnected: (remote, working, shown, total) => `Orca connected${remote} · ${working} working · ${shown}/${total} shown`,
  statusRemotes: (up, total) => (up === total ? ` · ${total} remote` : ` · ${up}/${total} remote`),
  duration: (m) => {
    if (m < 1) return 'under a minute'
    if (m < 60) return `${m} min`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h} h ${m % 60} min`
    return `${Math.floor(h / 24)} d`
  },
  working: (tool, t) => `Working${tool ? ` · ${tool}` : ''} · for ${t}`,
  waiting: (t) => `Waiting for you · for ${t}`,
  done: (t) => `Done · ${t} ago`,
  failed: (t) => `Failed · ${t} ago`,
  interrupted: (t) => `Interrupted · ${t} ago`,
  unread: ' · not viewed yet',
  remoteHost: (host) => `remote ${host}`,
  untitled: '(untitled)',
  clickHint: 'Click to open this workspace in Orca',
}

const ko: Strings = {
  showOffice: '오피스 보이기',
  size: '크기',
  scaleOption: (s, h) => `${s}배 (높이 ${h}px)`,
  width: '폭',
  widthFull: '전체',
  widthHalf: '절반',
  position: '위치',
  alignLeft: '왼쪽',
  alignCenter: '가운데',
  alignRight: '오른쪽',
  alignCustom: '직접 조절 (띠 끝을 드래그)',
  monitor: '모니터',
  monitorOption: (n, w, h, primary) => `모니터 ${n} (${w}×${h})${primary ? ' · 주 모니터' : ''}`,
  goHome: '퇴근 기준 (작업이 끝난 뒤)',
  goHomeAfter: (m) => (m < 60 ? `${m}분 뒤` : m === 24 * 60 ? '하루 뒤' : `${hoursOrDays(m, '시간', '일')} 뒤`),
  goHomeNever: '퇴근시키지 않음',
  maxCharacters: '최대 인원',
  characterCount: (n) => `${n}명`,
  launchAtStartup: 'Windows 시작 시 실행',
  remoteEnvironments: '원격 환경',
  language: '언어 (Language)',
  demoMode: '데모 모드 (가짜 세션)',
  demoControls: '데모 조작',
  demoAuto: '자동 진행',
  demoAdd: '세션 추가 (출근)',
  demoStart: '작업 시작',
  demoWaiting: '응답 대기',
  demoDone: '작업 완료',
  demoFailed: '작업 실패',
  demoInterrupted: '작업 중단',
  demoRemove: '세션 제거 (퇴근)',
  quit: '종료',
  statusDemo: '데모 모드',
  statusConnecting: 'Orca 연결 중',
  statusDisconnected: 'Orca 연결 안 됨',
  statusConnected: (remote, working, shown, total) => `Orca 연결됨${remote} · 작업 중 ${working} · 표시 ${shown}/${total}`,
  statusRemotes: (up, total) => (up === total ? ` · 원격 ${total}` : ` · 원격 ${up}/${total}`),
  duration: (m) => {
    if (m < 1) return '1분 미만'
    if (m < 60) return `${m}분`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}시간 ${m % 60}분`
    return `${Math.floor(h / 24)}일`
  },
  working: (tool, t) => `작업 중${tool ? ` · ${tool}` : ''} · ${t}째`,
  waiting: (t) => `응답을 기다리는 중 · ${t}째`,
  done: (t) => `완료 · ${t} 전`,
  failed: (t) => `실패 · ${t} 전`,
  interrupted: (t) => `중단됨 · ${t} 전`,
  unread: ' · 아직 확인 안 함',
  remoteHost: (host) => `원격 ${host}`,
  untitled: '(제목 없음)',
  clickHint: '클릭하면 Orca에서 이 워크스페이스를 엽니다',
}

const TABLE: Record<Language, Strings> = { en, ko }

export function strings(language: Language): Strings {
  return TABLE[language] ?? en
}
