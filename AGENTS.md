# Pi Code

Linux-only VS Code extension that runs Pi's native TUI directly in VS Code's integrated Terminal view.

## Invariants

- No webviews, startup activation, status bar, chat participant, localhost server, RPC client, or bundled Pi extension.
- Launch the resolved Pi executable directly, without an extension-owned shell or pseudoterminal. An administrator-provided executable may be an `exec` launcher.
- Pass no arguments or extension-injected environment variables.
- All owned Pi terminals open in VS Code's shared Terminal view; VS Code controls that view's placement.
- `Open` targets the active owned terminal, then global MRU, then creates one.
- Composer references target the active/MRU terminal whose cwd is the file's workspace root.
- Editor and Explorer references are plain workspace-relative `path:start-end` or `path` text and are never submitted automatically.
- Terminal selections use temporary clipboard copy/paste, `<quoted_context>` wrapping, and `finally`-based clipboard restoration.
- Owned source terminals receive their own selected output; foreign sources target a workspace-matched Pi terminal.
- Reject dirty documents, Explorer folders, and files outside workspace folders; never save automatically.
- Pi installation, updates, and session restoration remain outside this extension.

## Modules

- `src/extension.ts` — thin VS Code activation and command wiring.
- `src/piTerminals.ts` — ownership, MRU targeting, Terminal-view launch, and insertion.
- `src/piExecutable.ts` — pure Linux executable resolution.
- `src/selectionReference.ts` — pure inclusive line-range formatting.
- `src/terminalSelection.ts` — pure terminal-output context formatting.
- `src/workspace.ts` — pure cwd and workspace-relative path policy.

## Verification

Run `pnpm check`. It lints/formats, typechecks source and tests, runs Vitest, and creates the production bundle.
