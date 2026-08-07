import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import { formatTerminalSelectionContext } from "./terminalSelection.js";

const TERMINAL_NAME = "Pi Code";
const COMPOSER_NEWLINE = "\u001b[13;2u";

type TerminalRecord = {
  cwd: string;
  lastUsed: number;
};

export type TerminalSelectionResult = "inserted" | "noSelection" | "unavailable";

export class PiTerminals implements vscode.Disposable {
  readonly #terminals = new Map<vscode.Terminal, TerminalRecord>();
  readonly #disposables: vscode.Disposable[];
  readonly #resolveExecutable: () => Promise<string | undefined>;
  #creationQueue: Promise<void> = Promise.resolve();
  #clock = 0;

  constructor(resolveExecutable: () => Promise<string | undefined>) {
    this.#resolveExecutable = resolveExecutable;
    this.#disposables = [
      vscode.window.onDidCloseTerminal((terminal) => {
        this.#terminals.delete(terminal);
      }),
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

    terminal.sendText(`${COMPOSER_NEWLINE}${text} `, false);
    this.#focus(terminal);
  }

  async appendTerminalSelectionToComposer(
    sourceTerminal: vscode.Terminal,
    cwd: vscode.Uri,
  ): Promise<TerminalSelectionResult> {
    if (!this.#supportsPlatform()) return "unavailable";

    const selection = await this.#copyTerminalSelection(sourceTerminal);
    const context = selection ? formatTerminalSelectionContext(selection) : undefined;
    if (!context) return "noSelection";

    let terminal = this.#isLiveOwned(sourceTerminal) ? sourceTerminal : this.#mostRecent(cwd);
    if (!terminal) {
      terminal = await this.#serializeCreation(async () => {
        return this.#mostRecent(cwd) ?? this.#create(cwd);
      });
    }
    if (!terminal) return "unavailable";

    const previousClipboard = await vscode.env.clipboard.readText();
    try {
      await vscode.env.clipboard.writeText(context);
      this.#focus(terminal);
      terminal.sendText(COMPOSER_NEWLINE, false);
      await vscode.commands.executeCommand("workbench.action.terminal.paste");
      this.#touch(terminal);
      return "inserted";
    } finally {
      await vscode.env.clipboard.writeText(previousClipboard);
    }
  }

  dispose(): void {
    for (const disposable of this.#disposables) disposable.dispose();
    this.#terminals.clear();
  }

  async #create(cwd: vscode.Uri): Promise<vscode.Terminal | undefined> {
    const executable = await this.#resolveExecutable();
    if (!executable) return undefined;

    const terminal = vscode.window.createTerminal({
      name: TERMINAL_NAME,
      shellPath: executable,
      cwd,
      iconPath: new vscode.ThemeIcon("terminal"),
      location: vscode.TerminalLocation.Panel,
      isTransient: true,
    });
    this.#track(terminal, cwd.fsPath);
    this.#focus(terminal);
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

  #isLiveOwned(terminal: vscode.Terminal): boolean {
    return terminal.exitStatus === undefined && this.#terminals.has(terminal);
  }

  async #copyTerminalSelection(sourceTerminal: vscode.Terminal): Promise<string | undefined> {
    const previousClipboard = await vscode.env.clipboard.readText();
    const sentinel = `pi-code:${randomUUID()}`;
    try {
      await vscode.env.clipboard.writeText(sentinel);
      sourceTerminal.show();
      await vscode.commands.executeCommand("workbench.action.terminal.copySelection");
      const selection = await vscode.env.clipboard.readText();
      return selection === sentinel ? undefined : selection;
    } finally {
      await vscode.env.clipboard.writeText(previousClipboard);
    }
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

  #serializeCreation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#creationQueue.then(operation);
    this.#creationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
