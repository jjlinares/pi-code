import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  terminals: [] as Array<{
    name: string;
    creationOptions: Record<string, unknown>;
    exitStatus: undefined;
    show: ReturnType<typeof vi.fn>;
    sendText: ReturnType<typeof vi.fn>;
  }>,
  options: [] as Record<string, unknown>[],
  groups: [] as Array<{ viewColumn: number; tabs: Array<{ input: unknown; label: string }> }>,
  opened: [] as Array<(terminal: unknown) => void>,
  closed: [] as Array<(terminal: unknown) => void>,
  activated: [] as Array<(terminal: unknown) => void>,
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

  class TabInputTerminal {}

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
    TabInputTerminal,
    ViewColumn: {
      One: 1,
      Two: 2,
      Three: 3,
      Four: 4,
      Five: 5,
      Six: 6,
      Seven: 7,
      Eight: 8,
      Nine: 9,
      Beside: -2,
    },
    window: {
      terminals: mock.terminals,
      tabGroups: {
        get all() {
          return mock.groups;
        },
      },
      onDidOpenTerminal: event(mock.opened),
      onDidCloseTerminal: event(mock.closed),
      onDidChangeActiveTerminal: event(mock.activated),
      showErrorMessage: vi.fn(),
      createTerminal(options: Record<string, unknown>) {
        mock.options.push(options);
        const terminal = {
          name: options.name as string,
          creationOptions: options,
          exitStatus: undefined,
          show: vi.fn(),
          sendText: vi.fn(),
        };
        mock.terminals.push(terminal);
        for (const listener of mock.opened) listener(terminal);
        return terminal;
      },
    },
  };
});

import * as vscode from "vscode";
import { PiTerminals } from "../src/piTerminals.js";

beforeEach(() => {
  mock.terminals.length = 0;
  mock.options.length = 0;
  mock.groups.length = 0;
  mock.opened.length = 0;
  mock.closed.length = 0;
  mock.activated.length = 0;
});

describe("PiTerminals", () => {
  it("coalesces concurrent opens for the same workspace root", async () => {
    let resolveExecutable: ((path: string) => void) | undefined;
    const executable = new Promise<string>((resolve) => {
      resolveExecutable = resolve;
    });
    const terminals = new PiTerminals(() => executable);
    const cwd = vscode.Uri.file("/workspace/one");

    const first = terminals.open(cwd);
    const second = terminals.open(cwd);
    resolveExecutable?.("/usr/bin/pi");

    const [firstTerminal, secondTerminal] = await Promise.all([first, second]);
    expect(firstTerminal).toBe(secondTerminal);
    expect(mock.options).toHaveLength(1);
    terminals.dispose();
  });

  it("reuses by workspace root and creates explicitly independent terminals", async () => {
    const terminals = new PiTerminals(async () => "/usr/bin/pi");
    const firstRoot = vscode.Uri.file("/workspace/one");
    const secondRoot = vscode.Uri.file("/workspace/two");

    const first = await terminals.open(firstRoot);
    expect(await terminals.open(firstRoot)).toBe(first);
    expect(await terminals.open(firstRoot, true)).not.toBe(first);
    expect(await terminals.open(secondRoot)).not.toBe(first);
    expect(mock.options).toHaveLength(3);
    expect(mock.options.map((options) => options.location)).toEqual([
      { viewColumn: 1 },
      { viewColumn: 1 },
      { viewColumn: 1 },
    ]);
    terminals.dispose();
  });

  it("ignores an unrelated terminal with the generic Pi Code label when locating its group", async () => {
    const terminals = new PiTerminals(async () => "/usr/bin/pi");
    const first = await terminals.open(vscode.Uri.file("/workspace/one"));
    if (!first) throw new Error("terminal was not created");

    mock.groups.push(
      {
        viewColumn: 2,
        tabs: [{ input: new vscode.TabInputTerminal(), label: "Pi Code" }],
      },
      {
        viewColumn: 1,
        tabs: [{ input: new vscode.TabInputTerminal(), label: first.name }],
      },
    );

    await terminals.open(vscode.Uri.file("/workspace/one"), true);
    expect(mock.options[1]?.location).toEqual({ viewColumn: 1 });
    terminals.dispose();
  });

  it("appends without submitting", async () => {
    const terminals = new PiTerminals(async () => "/usr/bin/pi");
    await terminals.appendToComposer("@src/app.ts:4-8", vscode.Uri.file("/workspace/one"));

    expect(mock.terminals[0]?.sendText).toHaveBeenCalledWith("@src/app.ts:4-8 ", false);
    terminals.dispose();
  });
});
