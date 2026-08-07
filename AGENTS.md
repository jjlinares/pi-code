# Pi Code

## Agent constraints

- Keep Pi Code TUI a thin Linux-only launcher for Pi's native TUI. Launch Pi directly in VS Code's terminal: no shell, pseudoterminal, arguments, or injected environment variables.
- Do not add webviews, startup activation to Pi Code TUI, status UI, chat integration, servers/RPC, a bundled Pi extension, or Pi installation/update/session management.
- Composer actions insert text only; never submit automatically or save documents.
- Keep Pi Clipboard Bridge standalone and usable without Pi Code TUI. It runs locally, never detects Pi, and bridges image clipboard data only for Linux devcontainers.
- Treat the README, package manifests, source, and tests as canonical for behavior, layout, and commands; inspect them instead of expanding this file.
