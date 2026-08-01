# Pi Code

Linux-only VS Code extension that runs Pi's native TUI directly in a terminal editor.

## Invariants

- No webviews, chat participant, localhost server, RPC client, or bundled Pi extension.
- Pi is the terminal process. Do not wrap it in a shell or pseudoterminal.
- All Pi terminals occupy one editor group.
- Reuse is workspace-root scoped. `New Terminal` is the explicit escape hatch.
- Editor context enters Pi only through explicit user commands.
- Never submit composer context automatically.
- Pi installation and updates remain outside this extension.

## Modules

- `src/extension.ts` — VS Code activation and command wiring.
- `src/piTerminals.ts` — terminal lifecycle, reuse, grouping, and composer insertion.
- `src/piExecutable.ts` — pure Linux executable resolution.
- `src/selectionReference.ts` — pure selection range formatting.

## Verification

Run `pnpm check`. It formats/lints, typechecks source and tests, runs Vitest, and creates the production bundle.
