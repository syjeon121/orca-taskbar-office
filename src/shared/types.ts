/** Logical scene height in unscaled pixels. Window height = SCENE_HEIGHT * scale */
export const SCENE_HEIGHT = 35

export const MIN_SCALE = 2
export const MAX_SCALE = 6

/** custom is a position set by dragging the strip edges (uses leftFraction) */
export type Align = 'left' | 'center' | 'right' | 'custom'

/** Minimum width reachable by dragging (fraction of the work area width) */
export const MIN_WIDTH_FRACTION = 0.2

export interface Settings {
  /** Pixel scale factor (integer) */
  scale: number
  /** Strip width as a fraction of the monitor work area (0-1) */
  widthFraction: number
  align: Align
  /** Left edge of the strip when align is custom (fraction of the work area width, 0-1) */
  leftFraction: number
  /** Minutes before a finished session goes home. 0 means never */
  retireMinutes: number
  /** Maximum characters on screen, resting ones included. Busy and unread sessions are shown even beyond this */
  maxCharacters: number
  /** Monitor id to show the strip on. null means the primary monitor */
  displayId: number | null
  visible: boolean
  /** When true, drive the scene with fake sessions instead of Orca */
  demoMode: boolean
  /** Ids of remote Orca environments to hide from the office */
  disabledEnvironments: string[]
}

/** Main → renderer: scene size for the current window size */
export interface Layout {
  scale: number
  /** Scene width in unscaled pixels */
  sceneWidth: number
  sceneHeight: number
}

/**
 * Status of an agent session (one session = one character).
 * - working: working
 * - waiting: waiting for the user (permission request, question)
 * - done / failed / interrupted: finished. The renderer decides the finishing animation from the status change.
 */
export type SessionStatus = 'working' | 'waiting' | 'done' | 'failed' | 'interrupted'

export interface SessionInfo {
  id: string
  /** claude, codex, antigravity, ... */
  agentType: string
  workspace: string
  /** Workspace to open in Orca on click. null for demo sessions */
  worktreeId: string | null
  /** Id of the remote Orca environment the session lives in. null for sessions on this PC */
  environmentId: string | null
  /** Name of the remote environment. Empty for sessions on this PC */
  host: string
  title: string
  status: SessionStatus
  /** When true, the character goes to the lounge quietly on finish, with no cheer or result mark (superseded or unconfirmed sessions) */
  quiet: boolean
  /** Finished but not yet viewed in Orca. Keeps its mark and doesn't go home until viewed */
  unread: boolean
  /** First line of the last reply */
  lastMessage: string
  /** Name of the tool in use while working */
  tool: string | null
  /** When the current status started (epoch ms) */
  since: number
}

/** Renderer → main: the hovered character. x is the scene coordinate of its center */
export interface HoverTarget {
  id: string
  x: number
  scale: number
}

/** Main → tooltip window */
export interface TooltipData {
  session: SessionInfo
  now: number
}

export interface TooltipApi {
  onData(callback: (data: TooltipData) => void): void
  reportHeight(height: number): void
}

/** Color per agent type, used for the tooltip badge */
export const AGENT_COLORS: Record<string, string> = {
  claude: '#d97757',
  codex: '#3fa58e',
  antigravity: '#4f8df5',
  gemini: '#4f8df5',
}

export interface OfficeApi {
  /** Reports when the hovered character changes. null when the cursor leaves */
  hover(target: HoverTarget | null): void
  getLayout(): Promise<Layout>
  onLayout(callback: (layout: Layout) => void): void
  /** The full current session list. Characters whose session is missing go home */
  getSessions(): Promise<SessionInfo[]>
  onSessions(callback: (sessions: SessionInfo[]) => void): void
  /** Reports whether the cursor is over something clickable. When false the window lets clicks through */
  setInteractive(interactive: boolean): void
  /** A strip edge is being dragged. The main process resizes the window to the current cursor position */
  resizeDrag(edge: 'left' | 'right'): void
  /** Drag finished. Saves the current size and position to settings */
  resizeEnd(): void
  characterClicked(id: string): void
}
