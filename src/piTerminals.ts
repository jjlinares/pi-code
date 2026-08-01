import * as vscode from "vscode";

const TERMINAL_NAME = "Pi Code";

type TerminalRecord = {
  cwd: string;
  lastUsed: number;
};

export class PiTerminals implements vscode.Disposable {
  readonly #terminals = new Map<vscode.Terminal, TerminalRecord>();
  readonly #disposables: vscode.Disposable[];
  readonly #resolveExecutable: () => Promise<string | undefined>;
  #creationQueue: Promise<void> = Promise.resolve();
  #clock = 0;

  constructor(resolveExecutable: () => Promise<string | undefined>) {
    this.#resolveExecutable = resolveExecutable;
    this.#disposables = [
      vscode.window.onDidCloseTerminal((terminal) => this.#terminals.delete(terminal)),
      vscode.window.onDidChangeActiveTerminal((terminal) => {
        if (terminal) this.#touch(terminal);
      }),
    ];
  }

  async open(cwd: vscode.Uri): Promise<vscode.Terminal | undefined> {
    if (!this.#supportsPlatform()) return undefined;

    const existing = this.#activeOwned() ?? this.#mostRecent();
    if (existing) {
      this.#focus(existing);
      return existing;
    }

    return this.#serializeCreation(async () => {
      const createdWhileWaiting = this.#activeOwned() ?? this.#mostRecent();
      if (createdWhileWaiting) {
        this.#focus(createdWhileWaiting);
        return createdWhileWaiting;
      }
      return this.#create(cwd);
    });
  }

  async newSession(cwd: vscode.Uri): Promise<vscode.Terminal | undefined> {
    if (!this.#supportsPlatform()) return undefined;
    return this.#serializeCreation(() => this.#create(cwd));
  }

  async appendToComposer(text: string, cwd: vscode.Uri): Promise<void> {
    if (!this.#supportsPlatform()) return;

    let terminal = this.#activeOwned(cwd) ?? this.#mostRecent(cwd);
    if (!terminal) {
      terminal = await this.#serializeCreation(async () => {
        return this.#activeOwned(cwd) ?? this.#mostRecent(cwd) ?? this.#create(cwd);
      });
    }
    if (!terminal) return;

    terminal.sendText(` ${text} `, false);
    this.#focus(terminal);
  }

  dispose(): void {
    for (const disposable of this.#disposables) disposable.dispose();
    this.#terminals.clear();
  }

  async #create(cwd: vscode.Uri): Promise<vscode.Terminal | undefined> {
    const executable = await this.#resolveExecutable();
    if (!executable) return undefined;

    const anchor = this.#mostRecent();
    let viewColumn: vscode.ViewColumn;
    if (anchor) {
      this.#focus(anchor);
      viewColumn = vscode.ViewColumn.Active;
    } else {
      viewColumn = this.#rightmostNewColumn();
    }

    const terminal = vscode.window.createTerminal({
      name: TERMINAL_NAME,
      shellPath: executable,
      cwd,
      iconPath: new vscode.ThemeIcon("terminal"),
      location: { viewColumn },
      isTransient: true,
    });
    this.#track(terminal, cwd.fsPath);
    this.#focus(terminal);
    await this.#lockActiveGroup();
    return terminal;
  }

  #supportsPlatform(): boolean {
    if (process.platform === "linux") return true;
    void vscode.window.showErrorMessage("Pi Code currently supports Linux only.");
    return false;
  }

  #track(terminal: vscode.Terminal, cwd: string): void {
    this.#terminals.set(terminal, { cwd, lastUsed: ++this.#clock });
  }

  #touch(terminal: vscode.Terminal): void {
    const record = this.#terminals.get(terminal);
    if (record) record.lastUsed = ++this.#clock;
  }

  #focus(terminal: vscode.Terminal): void {
    this.#touch(terminal);
    terminal.show();
  }

  #activeOwned(cwd?: vscode.Uri): vscode.Terminal | undefined {
    const terminal = vscode.window.activeTerminal;
    if (!terminal || terminal.exitStatus !== undefined || !this.#matchesCwd(terminal, cwd)) {
      return undefined;
    }
    return terminal;
  }

  #mostRecent(cwd?: vscode.Uri): vscode.Terminal | undefined {
    return [...this.#terminals]
      .filter(([terminal]) => terminal.exitStatus === undefined && this.#matchesCwd(terminal, cwd))
      .sort((left, right) => right[1].lastUsed - left[1].lastUsed)[0]?.[0];
  }

  #matchesCwd(terminal: vscode.Terminal, cwd: vscode.Uri | undefined): boolean {
    const record = this.#terminals.get(terminal);
    return record !== undefined && (cwd === undefined || record.cwd === cwd.fsPath);
  }

  #rightmostNewColumn(): vscode.ViewColumn {
    const columns = vscode.window.tabGroups.all
      .map((group) => group.viewColumn)
      .filter((column) => column >= vscode.ViewColumn.One && column <= vscode.ViewColumn.Nine);
    const rightmost = columns.length > 0 ? Math.max(...columns) : undefined;
    if (rightmost !== undefined && rightmost < vscode.ViewColumn.Nine) {
      return (rightmost + 1) as vscode.ViewColumn;
    }
    return vscode.ViewColumn.Beside;
  }

  async #lockActiveGroup(): Promise<void> {
    try {
      await vscode.commands.executeCommand("workbench.action.lockEditorGroup");
    } catch {
      // VS Code exposes no public locking API. Terminal creation must still succeed.
    }
  }

  #serializeCreation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#creationQueue.then(operation);
    this.#creationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
