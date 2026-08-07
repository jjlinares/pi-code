import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import { readClipboardImage } from "./clipboardImage.js";
import { runCommand } from "./commandRunner.js";
import { findRemoteTempLocation } from "./remoteTarget.js";
import { commandSkipShellState } from "./terminalKeyDispatch.js";

const PASTE_COMMAND = "pi-clipboard-bridge.paste";
const TERMINAL_PASTE_COMMAND = "workbench.action.terminal.paste";
const COMMANDS_TO_SKIP_SHELL_SETTING = "commandsToSkipShell";
const COMMANDS_TO_SKIP_SHELL_SECTION = `terminal.integrated.${COMMANDS_TO_SKIP_SHELL_SETTING}`;
const SEND_KEYBINDINGS_TO_SHELL_SETTING = "sendKeybindingsToShell";
const SEND_KEYBINDINGS_TO_SHELL_SECTION = `terminal.integrated.${SEND_KEYBINDINGS_TO_SHELL_SETTING}`;
const OPEN_SETTINGS_ACTION = "Open Settings";
type KeyDispatchConflict =
  | typeof COMMANDS_TO_SKIP_SHELL_SECTION
  | typeof SEND_KEYBINDINGS_TO_SHELL_SECTION;
let helperWarningShown = false;

export function activate(context: vscode.ExtensionContext): void {
  let warnedConflict: KeyDispatchConflict | undefined;
  let checkQueue = Promise.resolve();
  const scheduleKeyDispatchCheck = (): void => {
    checkQueue = checkQueue
      .then(async () => {
        const conflict = keyDispatchConflict();
        if (!conflict) {
          warnedConflict = undefined;
          return;
        }
        if (warnedConflict === conflict) return;

        warnedConflict = conflict;
        await warnAboutKeyDispatchConflict(conflict);
      })
      .catch((error: unknown) => {
        void vscode.window.showWarningMessage(
          `Pi Clipboard Bridge could not check terminal key handling: ${toErrorMessage(error)}`,
        );
      });
  };

  context.subscriptions.push(
    vscode.commands.registerCommand(PASTE_COMMAND, async () => {
      await pasteClipboardIntoTerminal();
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration(COMMANDS_TO_SKIP_SHELL_SECTION) ||
        event.affectsConfiguration(SEND_KEYBINDINGS_TO_SHELL_SECTION)
      ) {
        scheduleKeyDispatchCheck();
      }
    }),
  );
  scheduleKeyDispatchCheck();
}

function keyDispatchConflict(): KeyDispatchConflict | undefined {
  if (process.platform !== "linux" || vscode.env.remoteName !== "dev-container") return undefined;

  const configuration = vscode.workspace.getConfiguration("terminal.integrated");
  const configured = configuration.get<string[]>(COMMANDS_TO_SKIP_SHELL_SETTING, []);
  const commandState = commandSkipShellState(configured, PASTE_COMMAND);
  if (commandState === "disabled") return undefined;
  if (configuration.get<boolean>(SEND_KEYBINDINGS_TO_SHELL_SETTING, false)) {
    return SEND_KEYBINDINGS_TO_SHELL_SECTION;
  }
  return commandState === "missing" ? COMMANDS_TO_SKIP_SHELL_SECTION : undefined;
}

async function warnAboutKeyDispatchConflict(conflict: KeyDispatchConflict): Promise<void> {
  const instruction =
    conflict === SEND_KEYBINDINGS_TO_SHELL_SECTION
      ? "Turn off terminal.integrated.sendKeybindingsToShell."
      : "Add pi-clipboard-bridge.paste to terminal.integrated.commandsToSkipShell.";
  const action = await vscode.window.showWarningMessage(
    `A terminal setting prevents Pi Clipboard Bridge from handling Ctrl+V. ${instruction}`,
    OPEN_SETTINGS_ACTION,
  );
  if (action === OPEN_SETTINGS_ACTION) {
    await vscode.commands.executeCommand("workbench.action.openSettings", conflict);
  }
}

async function pasteClipboardIntoTerminal(): Promise<void> {
  const terminal = vscode.window.activeTerminal;
  if (!terminal) return;

  if (process.platform !== "linux" || vscode.env.remoteName !== "dev-container") {
    await pasteText();
    return;
  }

  const result = await readClipboardImage(runCommand);
  if (result.kind !== "image") {
    await pasteText();
    if (result.kind === "unavailable") await warnAboutMissingHelper();
    return;
  }

  const fileName = `pi-clipboard-${randomUUID()}.${result.image.extension}`;
  const location = findRemoteTempLocation(
    [
      terminal.shellIntegration?.cwd,
      vscode.window.activeTextEditor?.document.uri,
      ...(vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri),
      vscode.workspace.workspaceFile,
    ],
    fileName,
  );
  if (!location) {
    void vscode.window.showErrorMessage(
      "Pi Clipboard Bridge cannot resolve the devcontainer filesystem.",
    );
    return;
  }

  const uri = vscode.Uri.from(location);
  try {
    await vscode.workspace.fs.writeFile(uri, result.image.bytes);
  } catch (error) {
    void vscode.window.showErrorMessage(
      `Pi Clipboard Bridge could not write ${location.path}: ${toErrorMessage(error)}`,
    );
    return;
  }

  if (terminal.exitStatus === undefined) terminal.sendText(location.path, false);
}

async function pasteText(): Promise<void> {
  await vscode.commands.executeCommand(TERMINAL_PASTE_COMMAND);
}

async function warnAboutMissingHelper(): Promise<void> {
  if (helperWarningShown || (await vscode.env.clipboard.readText())) return;
  helperWarningShown = true;
  void vscode.window.showWarningMessage(
    "Pi Clipboard Bridge needs wl-paste (wl-clipboard) or xclip on the local Linux desktop.",
  );
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
