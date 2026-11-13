/** 장면의 논리 높이(확대 전 픽셀). 창 높이 = SCENE_HEIGHT * scale */
export const SCENE_HEIGHT = 35

export const MIN_SCALE = 2
export const MAX_SCALE = 6

/** custom은 띠 끝을 드래그해 직접 정한 위치 (leftFraction 사용) */
export type Align = 'left' | 'center' | 'right' | 'custom'

/** 드래그로 줄일 수 있는 최소 폭 (작업 영역 폭 대비) */
export const MIN_WIDTH_FRACTION = 0.2

export interface Settings {
  /** 픽셀 확대 배율 (정수) */
  scale: number
  /** 모니터 작업 영역 폭 대비 띠의 폭 (0~1) */
  widthFraction: number
  align: Align
  /** align이 custom일 때 띠 왼쪽 끝의 위치 (작업 영역 폭 대비 0~1) */
  leftFraction: number
  /** 끝난 세션을 퇴근시키기까지의 시간(분). 0이면 퇴근시키지 않는다 */
  retireMinutes: number
  /** 쉬는 세션까지 포함해 화면에 둘 최대 인원. 일하거나 확인을 기다리는 세션은 이 수를 넘어도 표시한다 */
  maxCharacters: number
  /** 띠를 띄울 모니터 id. null이면 주 모니터 */
  displayId: number | null
  visible: boolean
  /** true면 Orca 대신 가짜 세션으로 장면을 움직인다 */
  demoMode: boolean
  /** 사무실에 표시하지 않을 원격 Orca 환경의 id */
  disabledEnvironments: string[]
}

/** 메인 → 렌더러: 현재 창 크기에 맞는 장면 크기 */
export interface Layout {
  scale: number
  /** 확대 전 장면 폭(픽셀) */
  sceneWidth: number
  sceneHeight: number
}

/**
 * 캐릭터 한 명이 되는 에이전트 세션의 상태.
 * - working: 작업 중
 * - waiting: 사용자 응답 대기 (권한 요청, 질문)
 * - done / failed / interrupted: 끝남. 끝난 직후의 연출은 렌더러가 상태 변화를 보고 판단한다.
 */
export type SessionStatus = 'working' | 'waiting' | 'done' | 'failed' | 'interrupted'

export interface SessionInfo {
  id: string
  /** claude, codex, antigravity 등 */
  agentType: string
  workspace: string
  /** 클릭 시 Orca에서 열 워크스페이스. 데모 세션은 null */
  worktreeId: string | null
  /** 세션이 있는 원격 Orca 환경의 id. 이 PC의 세션은 null */
  environmentId: string | null
  /** 원격 환경의 이름. 이 PC의 세션은 빈 문자열 */
  host: string
  title: string
  status: SessionStatus
  /** true면 끝났을 때 만세나 결과 표시 없이 조용히 라운지로 간다 (대체되었거나 결과가 불확실한 세션) */
  quiet: boolean
  /** 끝났지만 사용자가 Orca에서 아직 확인하지 않음. 확인할 때까지 표시를 달고 퇴근하지 않는다 */
  unread: boolean
  /** 마지막 응답의 첫 줄 */
  lastMessage: string
  /** 작업 중 사용하는 도구 이름 */
  tool: string | null
  /** 현재 상태가 시작된 시각 (epoch ms) */
  since: number
}

/** 렌더러 → 메인: 커서가 올라간 캐릭터. x는 캐릭터 가운데의 장면 좌표 */
export interface HoverTarget {
  id: string
  x: number
  scale: number
}

/** 메인 → 툴팁 창 */
export interface TooltipData {
  session: SessionInfo
  now: number
}

export interface TooltipApi {
  onData(callback: (data: TooltipData) => void): void
  reportHeight(height: number): void
}

/** 에이전트 종류별 대표 색. 툴팁 배지에 쓴다 */
export const AGENT_COLORS: Record<string, string> = {
  claude: '#d97757',
  codex: '#3fa58e',
  antigravity: '#4f8df5',
  gemini: '#4f8df5',
}

export interface OfficeApi {
  /** 커서가 올라간 캐릭터가 바뀔 때 알림. 벗어나면 null */
  hover(target: HoverTarget | null): void
  getLayout(): Promise<Layout>
  onLayout(callback: (layout: Layout) => void): void
  /** 현재 세션 목록 전체. 목록에서 빠진 세션의 캐릭터는 퇴근한다 */
  getSessions(): Promise<SessionInfo[]>
  onSessions(callback: (sessions: SessionInfo[]) => void): void
  /** 커서가 클릭 가능한 대상 위에 있는지 알림. false면 창이 클릭을 통과시킴 */
  setInteractive(interactive: boolean): void
  /** 띠의 왼쪽 또는 오른쪽 끝을 드래그하는 중. 메인이 현재 커서 위치로 창 크기를 바꾼다 */
  resizeDrag(edge: 'left' | 'right'): void
  /** 드래그가 끝남. 현재 크기와 위치를 설정에 저장한다 */
  resizeEnd(): void
  characterClicked(id: string): void
}
