# Pi Code

Minimal Linux-only VS Code integration for [Pi](https://pi.dev/). Pi Code runs Pi's native terminal UI in an integrated terminal editor. It has no webviews, chat participant, IDE bridge, package manager, or hidden agent process.

## Requirements

- Linux
- VS Code 1.95 or newer
- `pi` available in `PATH`, or an absolute executable configured in `pi-code.executablePath`

Install Pi separately:

```bash
npm install --global --ignore-scripts @earendil-works/pi-coding-agent
```

## Commands

| Command | Behavior |
| --- | --- |
| `Pi Code: Open` | Focus the most recently used Pi terminal for the active workspace root, or create one. |
| `Pi Code: New Terminal` | Create an independent Pi terminal for the active workspace root. |
| `Pi Code: Add Selection to Composer` | Append an `@path:start-end` reference without submitting it. |

The status-bar item runs `Pi Code: Open`. The selection command is also available at the top of the editor context menu.

## Terminal behavior

- Pi runs directly as the terminal process, preserving its real PTY/TUI behavior.
- Pi terminals are grouped in one dedicated editor group.
- Multi-root workspaces use the active editor's workspace folder as Pi's working directory.
- Explicitly created terminals remain independent but share the dedicated editor group.
- The extension does not restore or mutate Pi sessions. Pi retains its own normal session behavior.

## Development

```bash
pnpm install
pnpm check
pnpm package
```

Press `F5` in VS Code to launch an Extension Development Host.

## Deliberate exclusions

No webviews, HTTP server, Pi extension injection, editor bridge tools, VS Code Chat integration, package browser, installer/upgrader, session tracker, or clipboard-based terminal selection handling.
