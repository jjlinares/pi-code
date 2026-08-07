# Pi Clipboard Bridge

Paste images from a local Linux clipboard into Pi running in a VS Code devcontainer terminal.
Pi Code TUI is not required.

## Behavior

With a devcontainer terminal focused, press `Ctrl+V`:

1. The extension reads an image using local `wl-paste` or `xclip`.
2. It writes the image to `/tmp/pi-clipboard-<uuid>.<ext>` inside the devcontainer.
3. It inserts that path into the active terminal without submitting it.

If the clipboard does not contain a supported image, VS Code performs its normal terminal text
paste. The extension does not inspect or require the terminal's foreground process.

VS Code sends terminal shortcuts to the shell unless their command is listed in
`terminal.integrated.commandsToSkipShell`. The bridge contributes
`pi-clipboard-bridge.paste` by default but never rewrites user settings. An explicit
`-pi-clipboard-bridge.paste` entry opts out. The bridge warns when an effective user, remote,
workspace, or workspace-folder setting omits the command.

## Requirements

- Local Linux VS Code desktop
- VS Code 1.130 or newer
- A VS Code devcontainer window
- `wl-paste` from `wl-clipboard`, or `xclip`, installed on the local desktop

Supported clipboard image types: PNG, JPEG, WebP, and GIF.

## Development

From this directory:

```bash
pnpm install
pnpm check
pnpm package
```
