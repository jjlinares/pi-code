# Pi Code TUI

Minimal Linux-only VS Code integration for [Pi](https://pi.dev/). Pi Code TUI runs Pi's native terminal UI in VS Code's integrated Terminal view. It has no webviews, status item, chat participant, IDE bridge, package manager, or hidden agent process.

Pi Code TUI is an independent community integration and is not affiliated with or endorsed by the Pi project.

## Installation

Install from the VS Code Marketplace:

```bash
code --install-extension jjmsft.pi-code-tui
```

## Requirements

- Linux
- VS Code 1.130 or newer
- `pi` available in VS Code's inherited `PATH`, or an absolute executable configured in `pi-code.path`

Install Pi separately:

```bash
npm install --global --ignore-scripts @earendil-works/pi-coding-agent
```

## Commands

| Command | Key | Behavior |
| --- | --- | --- |
| `Pi Code: Open` | — | Focus the active or most recently used Pi terminal, or create one. |
| `Pi Code: New Session` | `Ctrl+Alt+P` | Create an independent Pi session. |
| `Pi Code: Add Selection to Composer` | Editor context menu | Append a workspace-relative `path:start-end` reference on a new composer line without submitting it. |
| `Pi Code: Add File to Composer` | Explorer context menu | Append a workspace-relative file path on a new composer line without submitting it. |
| `Pi Code: Add Terminal Selection to Composer` | Terminal context menu | Paste selected terminal output as `<quoted_context>` on a new composer line without submitting it. |

Editor and Explorer references require file-backed resources inside a workspace folder. Explorer folders are rejected. Pi Code never copies selected source text or saves documents automatically. Terminal selections temporarily pass through the system clipboard because VS Code exposes no terminal-selection API; the prior clipboard text is restored afterward.

## Terminal behavior

- Pi Code launches the resolved executable directly, without an extension-owned shell, arguments, or environment overrides. An administrator-provided executable may be an `exec` launcher.
- Pi terminals open in VS Code's shared Terminal view, including when the user moves that view to the Secondary Sidebar.
- New terminal cwd selection: active file's workspace, first workspace folder, then the user's home directory.
- Composer references target the active or most recent Pi terminal for the selected file's workspace. If none exists, Pi Code creates one.
- Terminal output selected inside an owned Pi terminal returns to that terminal. Output from other terminals targets the workspace-matched most recent Pi terminal.
- Terminals are transient. The extension does not restore or mutate Pi sessions; Pi owns session persistence.

## Configuration

`pi-code.path` is a machine-scoped absolute path to the Pi executable. Leave it empty to resolve `pi` strictly from VS Code's inherited `PATH`.

```json
{
  "pi-code.path": "/absolute/path/to/pi"
}
```

## Development

```bash
pnpm install
pnpm check
pnpm package
```

Press `F5` in VS Code to launch an Extension Development Host.

## Deliberate exclusions

No webviews, startup activation, status bar, HTTP server, Pi extension injection, editor bridge tools, VS Code Chat integration, package browser, installer/upgrader, or session restoration.
