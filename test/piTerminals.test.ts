import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  terminals: [] as Array<{
    name: string;
    creationOptions: Record<string, unknown>;
    exitStatus: undefined | { code: number };
    show: ReturnType<typeof vi.fn>;
    sendText: ReturnType<typeof vi.fn>;
  }>,
  activeTerminal: undefined as unknown,
  options: [] as Record<string, unknown>[],
  closed: [] as Array<(terminal: unknown) => void>,
  activated: [] as Array<(terminal: unknown) => void>,
  events: [] as string[],
  clipboard: "",
  clipboardWrites: [] as string[],
  terminalSelection: undefined as string | undefined,
  pasteFails: false,
}));

vi.mock("vscode", () => {
  class Uri {
    readonly fsPath: string;

    constructor(fsPath: string) {
      this.fsPath = fsPath;
    }

    static file(path: string): Uri {
      return new Uri(path);
    }
  }

  class ThemeIcon {
    readonly id: string;

    constructor(id: string) {
      this.id = id;
    }
  }

  function event(listeners: Array<(terminal: unknown) => void>) {
    return (listener: (terminal: unknown) => void) => {
      listeners.push(listener);
      return {
        dispose() {
          const index = listeners.indexOf(listener);
          if (index >= 0) listeners.splice(index, 1);
        },
      };
    };
  }

  return {
    Uri,
    ThemeIcon,
    TerminalLocation: {
      Panel: 1,
      Editor: 2,
    },
    commands: {
      executeCommand: vi.fn(async (command: string) => {
        if (command === "workbench.action.terminal.copySelection") {
          mock.events.push("copy");
          if (mock.terminalSelection !== undefined) mock.clipboard = mock.terminalSelection;
          return;
        }
        if (command === "workbench.action.terminal.paste") {
          mock.events.push("paste");
          if (mock.pasteFails) throw new Error("paste unavailable");
        }
      }),
    },
    env: {
      clipboard: {
        readText: vi.fn(async () => mock.clipboard),
        writeText: vi.fn(async (text: string) => {
          mock.clipboard = text;
          mock.clipboardWrites.push(text);
        }),
      },
    },
    window: {
      terminals: mock.terminals,
      get activeTerminal() {
        return mock.activeTerminal;
      },
      onDidCloseTerminal: event(mock.closed),
      onDidChangeActiveTerminal: event(mock.activated),
      showErrorMessage: vi.fn(),
      createTerminal(options: Record<string, unknown>) {
        mock.options.push(options);
        const terminal = {
          name: options.name as string,
          creationOptions: options,
          exitStatus: undefined,
          show: vi.fn(() => {
            mock.events.push(`show:${mock.terminals.indexOf(terminal)}`);
            mock.activeTerminal = terminal;
            for (const listener of mock.activated) listener(terminal);
          }),
          sendText: vi.fn((text: string, execute: boolean) => {
            mock.events.push(`send:${text}:${execute}`);
          }),
        };
        mock.terminals.push(terminal);
        return terminal;
      },
    },
  };
});

import * as vscode from "vscode";
import { PiTerminals } from "../src/piTerminals.js";

beforeEach(() => {
  vi.clearAllMocks();
  mock.terminals.length = 0;
  mock.activeTerminal = undefined;
  mock.options.length = 0;
  mock.closed.length = 0;
  mock.activated.length = 0;
  mock.events.length = 0;
  mock.clipboard = "";
  mock.clipboardWrites.length = 0;
  mock.terminalSelection = undefined;
  mock.pasteFails = false;
});

describe("PiTerminals", () => {
  it("coalesces concurrent Open calls", async () => {
    let resolveExecutable: ((path: string) => void) | undefined;
    const executable = new Promise<string>((resolve) => {
      resolveExecutable = resolve;
    });
    const terminals = new PiTerminals(() => executable);

    const first = terminals.open(vscode.Uri.file("/workspace/one"));
    const second = terminals.open(vscode.Uri.file("/workspace/two"));
    resolveExecutable?.("/usr/bin/pi");

    const [firstTerminal, secondTerminal] = await Promise.all([first, second]);
    expect(firstTerminal).toBe(secondTerminal);
    expect(mock.options).toHaveLength(1);
    terminals.dispose();
  });

  it("Open prefers the active owned terminal, then the global MRU terminal", async () => {
    const terminals = new PiTerminals(async () => "/usr/bin/pi");
    const first = await terminals.open(vscode.Uri.file("/workspace/one"));
    const second = await terminals.newSession(vscode.Uri.file("/workspace/two"));
    expect(first).toBeDefined();
    expect(second).toBeDefined();

    expect(await terminals.open(vscode.Uri.file("/workspace/one"))).toBe(second);

    mock.activeTerminal = { name: "foreign" };
    expect(await terminals.open(vscode.Uri.file("/workspace/one"))).toBe(second);
    expect(mock.options).toHaveLength(2);
    terminals.dispose();
  });

  it("creates sessions in VS Code's shared Terminal view", async () => {
    const terminals = new PiTerminals(async () => "/usr/bin/pi");

    await terminals.newSession(vscode.Uri.file("/workspace/one"));
    await terminals.newSession(vscode.Uri.file("/workspace/two"));

    expect(mock.options.map((options) => options.location)).toEqual([
      vscode.TerminalLocation.Panel,
      vscode.TerminalLocation.Panel,
    ]);
    expect(mock.options[0]?.iconPath).toEqual(new vscode.ThemeIcon("terminal"));
    expect(mock.options.every((options) => options.env === undefined)).toBe(true);
    terminals.dispose();
  });

  it("targets the active or MRU terminal belonging to the reference workspace", async () => {
    const terminals = new PiTerminals(async () => "/usr/bin/pi");
    await terminals.newSession(vscode.Uri.file("/workspace/one"));
    await terminals.newSession(vscode.Uri.file("/workspace/two"));

    await terminals.appendToComposer("src/app.ts:4-8", vscode.Uri.file("/workspace/one"));

    expect(mock.terminals[0]?.sendText).toHaveBeenCalledWith("\u001b[13;2usrc/app.ts:4-8 ", false);
    expect(mock.terminals[1]?.sendText).not.toHaveBeenCalled();
    expect(mock.events.at(-1)).toBe("show:0");
    terminals.dispose();
  });

  it("creates a matching terminal when no terminal belongs to the reference workspace", async () => {
    const terminals = new PiTerminals(async () => "/usr/bin/pi");
    await terminals.newSession(vscode.Uri.file("/workspace/one"));

    await terminals.appendToComposer("src/app.ts:4", vscode.Uri.file("/workspace/two"));

    expect(mock.options).toHaveLength(2);
    expect(mock.options[1]?.cwd).toEqual(vscode.Uri.file("/workspace/two"));
    expect(mock.terminals[1]?.sendText).toHaveBeenCalledWith("\u001b[13;2usrc/app.ts:4 ", false);
    terminals.dispose();
  });

  it("pastes selected output into its owned source terminal and restores the clipboard", async () => {
    const terminals = new PiTerminals(async () => "/usr/bin/pi");
    const source = await terminals.newSession(vscode.Uri.file("/workspace"));
    if (!source) throw new Error("terminal was not created");
    mock.clipboard = "original clipboard";
    mock.terminalSelection = "first line\nsecond line\n";

    const result = await terminals.appendTerminalSelectionToComposer(
      source,
      vscode.Uri.file("/workspace"),
    );

    expect(result).toBe("inserted");
    expect(source.sendText).toHaveBeenCalledWith("\u001b[13;2u", false);
    expect(mock.clipboardWrites).toContain(
      "<quoted_context>\nfirst line\nsecond line\n</quoted_context>\n",
    );
    expect(mock.events.at(-1)).toBe("paste");
    expect(mock.clipboard).toBe("original clipboard");
    terminals.dispose();
  });

  it("targets the workspace-matched Pi terminal when output comes from another terminal", async () => {
    const terminals = new PiTerminals(async () => "/usr/bin/pi");
    const target = await terminals.newSession(vscode.Uri.file("/workspace"));
    if (!target) throw new Error("terminal was not created");
    const source = {
      exitStatus: undefined,
      show: vi.fn(() => {
        mock.activeTerminal = source;
      }),
    } as unknown as vscode.Terminal;
    mock.activeTerminal = source;
    mock.terminalSelection = "build output";

    const result = await terminals.appendTerminalSelectionToComposer(
      source,
      vscode.Uri.file("/workspace"),
    );

    expect(result).toBe("inserted");
    expect(target.sendText).toHaveBeenCalledWith("\u001b[13;2u", false);
    expect(mock.options).toHaveLength(1);
    terminals.dispose();
  });

  it("rejects a missing terminal selection without pasting stale clipboard text", async () => {
    const terminals = new PiTerminals(async () => "/usr/bin/pi");
    const source = await terminals.newSession(vscode.Uri.file("/workspace"));
    if (!source) throw new Error("terminal was not created");
    mock.clipboard = "stale clipboard";

    const result = await terminals.appendTerminalSelectionToComposer(
      source,
      vscode.Uri.file("/workspace"),
    );

    expect(result).toBe("noSelection");
    expect(mock.events).not.toContain("paste");
    expect(mock.clipboard).toBe("stale clipboard");
    terminals.dispose();
  });

  it("restores the clipboard when terminal paste fails", async () => {
    const terminals = new PiTerminals(async () => "/usr/bin/pi");
    const source = await terminals.newSession(vscode.Uri.file("/workspace"));
    if (!source) throw new Error("terminal was not created");
    mock.clipboard = "original clipboard";
    mock.terminalSelection = "output";
    mock.pasteFails = true;

    await expect(
      terminals.appendTerminalSelectionToComposer(source, vscode.Uri.file("/workspace")),
    ).rejects.toThrow("paste unavailable");
    expect(mock.clipboard).toBe("original clipboard");
    terminals.dispose();
  });

  it("does not reuse an exited active terminal", async () => {
    const terminals = new PiTerminals(async () => "/usr/bin/pi");
    await terminals.open(vscode.Uri.file("/workspace/one"));
    const exited = mock.terminals[0];
    if (!exited) throw new Error("terminal was not created");
    exited.exitStatus = { code: 0 };
    mock.activeTerminal = exited;

    const replacement = await terminals.open(vscode.Uri.file("/workspace/two"));

    expect(replacement).not.toBe(exited);
    expect(mock.options).toHaveLength(2);
    terminals.dispose();
  });
});
