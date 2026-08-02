# Pi Code

Linux-only VS Code extension that runs Pi's native TUI directly in a terminal editor.

## Invariants

- No webviews, startup activation, status bar, chat participant, localhost server, RPC client, or bundled Pi extension.
- Pi is the terminal process. Do not wrap it in a shell or pseudoterminal.
- Launch Pi with no arguments and no injected environment variables.
- All owned Pi terminals occupy one best-effort locked editor group.
- `Open` targets the active owned terminal, then global MRU, then creates one.
- Composer references target the active/MRU terminal whose cwd is the file's workspace root.
- Editor and Explorer references are plain workspace-relative `path:start-end` or `path` text and are never submitted automatically.
- Terminal selections use temporary clipboard copy/paste, `<quoted_context>` wrapping, and `finally`-based clipboard restoration.
- Owned source terminals receive their own selected output; foreign sources target a workspace-matched Pi terminal.
- Reject dirty documents, Explorer folders, and files outside workspace folders; never save automatically.
- Pi installation, updates, and session restoration remain outside this extension.

## Modules

- `src/extension.ts` — thin VS Code activation and command wiring.
- `src/piTerminals.ts` — ownership, MRU targeting, launch, grouping, locking, and insertion.
- `src/piExecutable.ts` — pure Linux executable resolution.
- `src/selectionReference.ts` — pure inclusive line-range formatting.
- `src/terminalSelection.ts` — pure terminal-output context formatting.
- `src/workspace.ts` — pure cwd and workspace-relative path policy.

## Verification

Run `pnpm check`. It lints/formats, typechecks source and tests, runs Vitest, and creates the production bundle.
