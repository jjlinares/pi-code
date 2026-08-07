import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";

const PASTE_COMMAND = "pi-clipboard-bridge.paste";
const OPEN_SETTINGS_ACTION = "Open Settings";

const mock = vi.hoisted(() => {
  const state = {
    configurationListener: undefined as
      | ((event: { affectsConfiguration: (section: string) => boolean }) => void)
      | undefined,
    effectiveCommands: [] as string[],
  };
  const fireConfigurationChange = (): void => {
    state.configurationListener?.({ affectsConfiguration: () => true });
  };
  const update = vi.fn(async () => undefined);

  return {
    state,
    fireConfigurationChange,
    executeCommand: vi.fn(async () => undefined),
    registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
    showWarningMessage: vi.fn(async () => undefined as string | undefined),
    update,
  };
});

vi.mock("vscode", () => ({
  commands: {
    executeCommand: mock.executeCommand,
    registerCommand: mock.registerCommand,
  },
  env: {
    clipboard: { readText: vi.fn(async () => "") },
    remoteName: "dev-container",
  },
  window: {
    showWarningMessage: mock.showWarningMessage,
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn(() => mock.state.effectiveCommands),
      update: mock.update,
    })),
    onDidChangeConfiguration: vi.fn(
      (listener: (event: { affectsConfiguration: (section: string) => boolean }) => void) => {
        mock.state.configurationListener = listener;
        return { dispose: vi.fn() };
      },
    ),
  },
}));

import { activate } from "../src/extension.js";

beforeEach(() => {
  vi.clearAllMocks();
  mock.state.configurationListener = undefined;
  mock.state.effectiveCommands = [];
  mock.showWarningMessage.mockResolvedValue(undefined);
});

function activateExtension(): void {
  activate({ subscriptions: [] } as unknown as ExtensionContext);
}

describe("terminal key dispatch setup", () => {
  it("warns without rewriting a setting that omits the command", async () => {
    mock.state.effectiveCommands = ["other.command"];
    mock.showWarningMessage.mockResolvedValue(OPEN_SETTINGS_ACTION);

    activateExtension();

    await vi.waitFor(() => {
      expect(mock.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining("remote or workspace terminal setting"),
        OPEN_SETTINGS_ACTION,
      );
      expect(mock.executeCommand).toHaveBeenCalledWith(
        "workbench.action.openSettings",
        "terminal.integrated.commandsToSkipShell",
      );
    });
    expect(mock.update).not.toHaveBeenCalled();
  });

  it("does not warn for an explicit opt-out", async () => {
    mock.state.effectiveCommands = [`-${PASTE_COMMAND}`];

    activateExtension();
    await new Promise((resolve) => setImmediate(resolve));

    expect(mock.update).not.toHaveBeenCalled();
    expect(mock.showWarningMessage).not.toHaveBeenCalled();
  });

  it("does nothing when the command is enabled", async () => {
    mock.state.effectiveCommands = [PASTE_COMMAND];

    activateExtension();
    await new Promise((resolve) => setImmediate(resolve));

    expect(mock.update).not.toHaveBeenCalled();
    expect(mock.showWarningMessage).not.toHaveBeenCalled();
  });

  it("detects an override that loads after activation without repeating in the window", async () => {
    mock.state.effectiveCommands = [PASTE_COMMAND];
    activateExtension();
    await new Promise((resolve) => setImmediate(resolve));

    mock.state.effectiveCommands = ["remote.command"];
    mock.fireConfigurationChange();
    await vi.waitFor(() => expect(mock.showWarningMessage).toHaveBeenCalledTimes(1));

    mock.fireConfigurationChange();
    await new Promise((resolve) => setImmediate(resolve));
    expect(mock.showWarningMessage).toHaveBeenCalledTimes(1);
  });
});
