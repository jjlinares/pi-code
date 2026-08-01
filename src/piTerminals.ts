import { randomUUID } from "node:crypto";
import * as vscode from "vscode";

const TERMINAL_NAME = "Pi Code";
const TERMINAL_MARKER = "PI_CODE_TERMINAL";

type TerminalRecord = {
  cwd: string | undefined;
  lastUsed: number;
};

export class PiTerminals implements vscode.Disposable {
  readonly #terminals = new Map<vscode.Terminal, TerminalRecord>();
  readonly #opening = new Map<string, Promise<vscode.Terminal | undefined>>();
  readonly #disposables: vscode.Disposable[];
  readonly #resolveExecutable: () => Promise<string | undefined>;
  #clock = 0;
  #terminalColumn: vscode.ViewColumn | undefined;

  constructor(resolveExecutable: () => Promise<string | undefined>) {
    this.#resolveExecutable = resolveExecutable;

    for (const terminal of vscode.window.terminals) this.#adopt(terminal);
    this.#disposables = [
      vscode.window.onDidOpenTerminal((terminal) => this.#adopt(terminal)),
      vscode.window.onDidCloseTerminal((terminal) => {
        this.#terminals.delete(terminal);
        if (this.#terminals.size === 0) this.#terminalColumn = undefined;
      }),
      vscode.window.onDidChangeActiveTerminal((terminal) => {
        if (terminal) this.#touch(terminal);
      }),
    ];
  }

  async open(cwd: vscode.Uri | undefined, forceNew = false): Promise<vscode.Terminal | undefined> {
    if (process.platform !== "linux") {
      void vscode.window.showErrorMessage("Pi Code currently supports Linux only.");
      return undefined;
    }

    if (forceNew) return this.#create(cwd);

    const existing = this.#findReusable(cwd);
    if (existing) {
      this.#touch(existing);
      existing.show();
      return existing;
    }

    const key = cwd?.fsPath ?? "";
    const pending = this.#opening.get(key);
    if (pending) return pending;

    const opening = this.#create(cwd);
    this.#opening.set(key, opening);
    try {
      return await opening;
    } finally {
      if (this.#opening.get(key) === opening) this.#opening.delete(key);
    }
  }

  async appendToComposer(text: string, cwd: vscode.Uri | undefined): Promise<void> {
    const terminal = await this.open(cwd);
    if (!terminal) return;

    terminal.show();
    terminal.sendText(`${text} `, false);
    this.#touch(terminal);
  }

  dispose(): void {
    for (const disposable of this.#disposables) disposable.dispose();
    this.#opening.clear();
    this.#terminals.clear();
  }

  async #create(cwd: vscode.Uri | undefined): Promise<vscode.Terminal | undefined> {
    const executable = await this.#resolveExecutable();
    if (!executable) return undefined;

    const id = randomUUID();
    const viewColumn =
      this.#findTerminalColumn() ?? this.#terminalColumn ?? this.#findUnusedColumn();
    this.#terminalColumn = viewColumn;

    const terminal = vscode.window.createTerminal({
      name: `${TERMINAL_NAME} · ${id.slice(0, 8)}`,
      shellPath: executable,
      ...(cwd ? { cwd } : {}),
      env: { [TERMINAL_MARKER]: id },
      iconPath: new vscode.ThemeIcon("terminal"),
      location: { viewColumn },
      isTransient: true,
    });
    this.#track(terminal, cwd?.fsPath);
    terminal.show();
    return terminal;
  }

  #adopt(terminal: vscode.Terminal): void {
    const options = terminal.creationOptions;
    if (!("env" in options) || !options.env?.[TERMINAL_MARKER]) return;

    const cwd = options.cwd instanceof vscode.Uri ? options.cwd.fsPath : options.cwd;
    this.#track(terminal, cwd);
  }

  #track(terminal: vscode.Terminal, cwd: string | undefined): void {
    this.#terminals.set(terminal, { cwd, lastUsed: ++this.#clock });
  }

  #touch(terminal: vscode.Terminal): void {
    const record = this.#terminals.get(terminal);
    if (record) record.lastUsed = ++this.#clock;
  }

  #findReusable(cwd: vscode.Uri | undefined): vscode.Terminal | undefined {
    const cwdPath = cwd?.fsPath;
    return [...this.#terminals]
      .filter(([terminal, record]) => terminal.exitStatus === undefined && record.cwd === cwdPath)
      .sort((left, right) => right[1].lastUsed - left[1].lastUsed)[0]?.[0];
  }

  #findTerminalColumn(): vscode.ViewColumn | undefined {
    const names = new Set([...this.#terminals.keys()].map((terminal) => terminal.name));
    for (const group of vscode.window.tabGroups.all) {
      if (
        group.tabs.some(
          (tab) => tab.input instanceof vscode.TabInputTerminal && names.has(tab.label),
        )
      ) {
        return group.viewColumn;
      }
    }
    return undefined;
  }

  #findUnusedColumn(): vscode.ViewColumn {
    const usedColumns = new Set(
      vscode.window.tabGroups.all.map((group) => group.viewColumn).filter((column) => column),
    );
    for (let column = vscode.ViewColumn.One; column <= vscode.ViewColumn.Nine; column++) {
      if (!usedColumns.has(column)) return column;
    }
    return vscode.ViewColumn.Beside;
  }
}
