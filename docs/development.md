# Development

```powershell
npm install
npm run typecheck   # type check
npm run build       # build into dist/
npm start           # build and run
npm run dist        # build the installer into release/
```

Electron + TypeScript, rendered with Canvas 2D. All art is drawn in code; there are no image assets.

## Structure

```
src/
├─ main/                 Electron main process
│  ├─ main.ts              entry point
│  ├─ window.ts            strip window: placement, click-through, drag resize
│  ├─ tooltip.ts           tooltip window
│  ├─ tray.ts              tray icon and menu
│  ├─ settings.ts          load/save settings
│  ├─ orca-cli.ts          runs orca commands
│  ├─ orca-poller.ts       polls sessions every 3 s (local + remote)
│  ├─ orca-actions.ts      opens a workspace in Orca on click
│  ├─ demo.ts              fake session source
│  ├─ source.ts            switches between poller and demo
│  ├─ session-hub.ts       holds and forwards the current session list
│  └─ icon.ts              tray icon
├─ preload/              APIs exposed to the renderers
├─ shared/types.ts       types shared by main and renderer
└─ renderer/             canvas scene
   ├─ renderer.ts          frame loop and mouse input
   ├─ office.ts            character state, movement and draw order
   ├─ scene.ts             furniture layout
   ├─ scene-art.ts         furniture and floor drawing
   ├─ sprites.ts           characters and speech bubbles
   ├─ pixel.ts             outlines and color helpers
   └─ tooltip.ts           tooltip content
assets/icon-pixels.json  icon pixel data
scripts/make-icon.mjs    generates the installer icon
```

Furniture order is set by `OFFICE_PATTERN` (office) and `LOUNGE_PATTERN` (lounge) in `scene.ts`.

## Orca data

Sessions come from `orca worktree ps --json`, plus `--environment <id>` for each remote environment. Fields used per agent: `paneKey` (session id), `agentType`, `state`, `mainAgent.outcome`, `interrupted`, `stateStartedAt`, `conversationName`, `lastAssistantMessage`, `toolName` and `activity.unread`.

| Orca | Character |
|---|---|
| `working` | Working |
| `blocked`, `waiting` | Waiting for you |
| `done` + `success` | Done |
| `done` + `failure` | Failed |
| `done` + `cancellation` / `interruption`, or `interrupted: true` | Interrupted |
| `done` + `superseded` / `unconfirmed` | Done, but goes to the lounge quietly without a mark |

Clicking runs `orca worktree activate --worktree id:<worktreeId>`. For remote workspaces, see the comment on `openRemote` in `src/main/orca-actions.ts`.

## Dev environment variables

| Variable | Effect |
|---|---|
| `TASKBAR_OFFICE_DEMO=1` | Demo mode with automatic random activity |
| `TASKBAR_OFFICE_DEMO=busy` | 12 fake sessions, all working |
| `TASKBAR_OFFICE_DEMO=idle` | 10 fake sessions, all resting |
| `TASKBAR_OFFICE_DEMO=showcase` | A fixed mix of every state (used for the README screenshot) |
| `TASKBAR_OFFICE_SNAPSHOT=<png path>` | Saves the scene as a PNG a few seconds after start |
| `TASKBAR_OFFICE_SNAPSHOT_DELAY=<ms>` | Delay before the snapshot. Default 7000 |

```powershell
$env:TASKBAR_OFFICE_DEMO = 'showcase'; npm start
```

## Installer

`npm run dist` produces `release\Taskbar Office Setup <version>.exe` (about 115 MB, NSIS one-click, per-user install). It isn't code-signed.
