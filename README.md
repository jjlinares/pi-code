# Pi Code

Minimal Linux-only VS Code integration for [Pi](https://pi.dev/). Pi Code runs Pi's native terminal UI in an integrated terminal editor. It has no webviews, status item, chat participant, IDE bridge, package manager, or hidden agent process.

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
| `Pi Code: Open` | `Ctrl+Alt+P` | Focus the active or most recently used Pi terminal, or create one. |
| `Pi Code: New Session` | — | Create an independent Pi session. |
| `Pi Code: Add Selection to Composer` | Editor context menu | Append a workspace-relative `path:start-end` reference without submitting it. |

Selection references require a saved, file-backed document inside a workspace folder. Pi Code never copies selected source text or saves documents automatically.

## Terminal behavior

- Pi runs directly as the terminal process with no arguments or injected environment variables.
- The first Pi terminal opens in a new rightmost editor group. Later sessions reuse that group.
- The extension makes a best-effort attempt to lock the Pi editor group.
- New terminal cwd selection: active file's workspace, first workspace folder, then the user's home directory.
- Composer references target the active or most recent Pi terminal for the selected file's workspace. If none exists, Pi Code creates one.
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

No webviews, startup activation, status bar, HTTP server, Pi extension injection, editor bridge tools, VS Code Chat integration, package browser, installer/upgrader, session restoration, or clipboard-based terminal selection handling.
