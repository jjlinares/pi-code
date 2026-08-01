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
  groups: [] as Array<{ viewColumn: number }>,
  closed: [] as Array<(terminal: unknown) => void>,
  activated: [] as Array<(terminal: unknown) => void>,
  events: [] as string[],
  lockFails: false,
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
    constructor(readonly id: string) {}
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
    ViewColumn: {
      Active: -1,
      Beside: -2,
      One: 1,
      Two: 2,
      Three: 3,
      Four: 4,
      Five: 5,
      Six: 6,
      Seven: 7,
      Eight: 8,
      Nine: 9,
    },
    commands: {
      executeCommand: vi.fn(async () => {
        mock.events.push("lock");
        if (mock.lockFails) throw new Error("lock unavailable");
      }),
    },
    window: {
      terminals: mock.terminals,
      get activeTerminal() {
        return mock.activeTerminal;
      },
      tabGroups: {
        get all() {
          return mock.groups;
        },
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
  mock.groups.length = 0;
  mock.closed.length = 0;
  mock.activated.length = 0;
  mock.events.length = 0;
  mock.lockFails = false;
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

  it("creates the first terminal at the right and later sessions in its active group", async () => {
    mock.groups.push({ viewColumn: 1 }, { viewColumn: 3 });
    const terminals = new PiTerminals(async () => "/usr/bin/pi");

    await terminals.newSession(vscode.Uri.file("/workspace/one"));
    await terminals.newSession(vscode.Uri.file("/workspace/two"));

    expect(mock.options.map((options) => options.location)).toEqual([
      { viewColumn: 4 },
      { viewColumn: -1 },
    ]);
    expect(mock.options.every((options) => options.env === undefined)).toBe(true);
    terminals.dispose();
  });

  it("targets the active or MRU terminal belonging to the reference workspace", async () => {
    const terminals = new PiTerminals(async () => "/usr/bin/pi");
    await terminals.newSession(vscode.Uri.file("/workspace/one"));
    await terminals.newSession(vscode.Uri.file("/workspace/two"));

    await terminals.appendToComposer("src/app.ts:4-8", vscode.Uri.file("/workspace/one"));

    expect(mock.terminals[0]?.sendText).toHaveBeenCalledWith(" src/app.ts:4-8 ", false);
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
    expect(mock.terminals[1]?.sendText).toHaveBeenCalledWith(" src/app.ts:4 ", false);
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

  it("does not fail terminal creation when editor-group locking fails", async () => {
    mock.lockFails = true;
    const terminals = new PiTerminals(async () => "/usr/bin/pi");

    await expect(terminals.newSession(vscode.Uri.file("/workspace"))).resolves.toBeDefined();
    expect(mock.options).toHaveLength(1);
    terminals.dispose();
  });
});
