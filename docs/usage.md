# Usage

## The scene

```
| shared table  whiteboard  beanbag  standing desk  desk |door| coffee  chat table  sofa  plant  gym |
|            office (working sessions)                   |    |        lounge (resting sessions)    |
```

- **Looks** (skin, hair, clothes, hats, beards) are generated per session. The same session always looks the same. The agent type is shown by the badge color in the tooltip.
- **Result marks stay until acknowledged.** Clicking the character or reading the session in Orca clears the mark, and the character then walks to the lounge.
- **Finished but unread sessions** never go home.
- **Finished sessions** leave through the door after the go-home time. New sessions arrive through the door.
- Tool icons: terminal, edit, read, search, web and agent.

## Controls

| Action | Result |
|---|---|
| Hover a character | Yellow outline and a tooltip with workspace, conversation title, status and last reply |
| Click a character | Brings Orca to the front, opens the session's workspace and clears the result mark |
| Drag the left/right end of the strip | Resizes the strip. Saved on release |
| Left-click the tray icon | Show/hide the strip |
| Right-click the tray icon | Menu |

Only characters and the 8 px resize handles at each end take clicks. Everything else passes through to the windows behind.

Clicking opens the workspace, not the session tab: Orca has no CLI command to open a chat tab, so pick the tab yourself if the workspace has several sessions.

## Tray menu

| Item | Description |
|---|---|
| Show office | Toggle the strip |
| Size | Pixel scale 2x to 6x. Strip height is 35 px × scale |
| Width | Full, 3/4, half, 1/3 |
| Position | Left, center, right, or custom (set by dragging the ends) |
| Monitor | Which monitor shows the strip. Falls back to the primary monitor if it's disconnected |
| Go home after | How long finished sessions stay: 10 min, 30 min, 1 h, 3 h, 1 day, never |
| Max characters | Limit including resting sessions: 6, 12, 20, 30. Busy and unread sessions are always shown |
| Launch at Windows startup | Start at login |
| Language | UI language: English (default) or 한국어 |
| (status line) | Orca connection, remotes, working count, shown/total |
| Remote environments | Toggle each remote environment saved in Orca |
| Demo mode | Use fake sessions instead of Orca |
| Demo controls | In demo mode: add, start, wait, finish, fail, interrupt and remove sessions one by one |
| Quit | Exit the app |

Settings are stored in `%APPDATA%\orca-taskbar-office\settings.json`. Settings from the old name (`%APPDATA%\agent-office\settings.json`) are imported once if present.

## Remote environments

Sessions from remote environments saved in Orca (`orca environment list`) appear in the same office. The environment list is refreshed every minute, and the tooltip shows the environment name next to the workspace.

Clicking a remote character briefly opens a temporary terminal named "Taskbar Office" in that workspace and closes it after a second or two. Switching terminals is the only way the Orca CLI can move this PC's view to a remote workspace.

## Known limitations

- Windows only.
- Status changes show up with up to 3 seconds of delay.
- Clicking opens the workspace, not the specific session tab.
- Remote environments have no per-session read state, so the most recently finished session in an unread workspace is treated as unread.
- The 8 px handles at each end of the strip don't pass clicks through.
- The strip doesn't hide automatically for full-screen apps. Left-click the tray icon to hide it.
