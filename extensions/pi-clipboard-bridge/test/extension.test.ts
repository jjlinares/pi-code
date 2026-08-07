import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";

const PASTE_COMMAND = "pi-clipboard-bridge.paste";
const COMMANDS_TO_SKIP_SHELL_SECTION = "terminal.integrated.commandsToSkipShell";
const SEND_KEYBINDINGS_TO_SHELL_SECTION = "terminal.integrated.sendKeybindingsToShell";
const OPEN_SETTINGS_ACTION = "Open Settings";

const mock = vi.hoisted(() => {
  const state = {
    configurationListener: undefined as
      | ((event: { affectsConfiguration: (section: string) => boolean }) => void)
      | undefined,
    effectiveCommands: [] as string[],
    sendKeybindingsToShell: false,
  };
  const fireConfigurationChange = (affectedSection: string): void => {
    state.configurationListener?.({
      affectsConfiguration: (section) => section === affectedSection,
    });
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
      get: vi.fn((setting: string) =>
        setting === "sendKeybindingsToShell"
          ? mock.state.sendKeybindingsToShell
          : mock.state.effectiveCommands,
      ),
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
  mock.state.sendKeybindingsToShell = false;
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
        expect.stringContaining("A terminal setting prevents"),
        OPEN_SETTINGS_ACTION,
      );
      expect(mock.executeCommand).toHaveBeenCalledWith(
        "workbench.action.openSettings",
        COMMANDS_TO_SKIP_SHELL_SECTION,
      );
    });
    expect(mock.update).not.toHaveBeenCalled();
  });

  it("does not warn for an explicit opt-out", async () => {
    mock.state.effectiveCommands = [`-${PASTE_COMMAND}`];
    mock.state.sendKeybindingsToShell = true;

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
    mock.fireConfigurationChange(COMMANDS_TO_SKIP_SHELL_SECTION);
    await vi.waitFor(() => expect(mock.showWarningMessage).toHaveBeenCalledTimes(1));

    mock.fireConfigurationChange(COMMANDS_TO_SKIP_SHELL_SECTION);
    await new Promise((resolve) => setImmediate(resolve));
    expect(mock.showWarningMessage).toHaveBeenCalledTimes(1);
  });

  it("detects sendKeybindingsToShell changes and opens that setting", async () => {
    mock.state.effectiveCommands = [PASTE_COMMAND];
    mock.showWarningMessage.mockResolvedValue(OPEN_SETTINGS_ACTION);
    activateExtension();
    await new Promise((resolve) => setImmediate(resolve));

    mock.state.sendKeybindingsToShell = true;
    mock.fireConfigurationChange(SEND_KEYBINDINGS_TO_SHELL_SECTION);

    await vi.waitFor(() => {
      expect(mock.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining("Turn off terminal.integrated.sendKeybindingsToShell"),
        OPEN_SETTINGS_ACTION,
      );
      expect(mock.executeCommand).toHaveBeenCalledWith(
        "workbench.action.openSettings",
        SEND_KEYBINDINGS_TO_SHELL_SECTION,
      );
    });
  });
});
