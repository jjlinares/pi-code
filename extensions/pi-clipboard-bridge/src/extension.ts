import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import { readClipboardImage } from "./clipboardImage.js";
import { runCommand } from "./commandRunner.js";
import { findRemoteTempLocation } from "./remoteTarget.js";
import { addCommandToSkipShell } from "./terminalKeyDispatch.js";

const PASTE_COMMAND = "pi-clipboard-bridge.paste";
const TERMINAL_PASTE_COMMAND = "workbench.action.terminal.paste";
const COMMANDS_TO_SKIP_SHELL_SETTING = "commandsToSkipShell";
let helperWarningShown = false;

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(PASTE_COMMAND, async () => {
      await pasteClipboardIntoTerminal();
    }),
  );
  void ensurePasteCommandSkipsShell().catch((error: unknown) => {
    void vscode.window.showWarningMessage(
      `Pi Clipboard Bridge could not configure terminal key handling: ${toErrorMessage(error)}`,
    );
  });
}

async function ensurePasteCommandSkipsShell(): Promise<void> {
  const configuration = vscode.workspace.getConfiguration("terminal.integrated");
  const configured = configuration.get<string[]>(COMMANDS_TO_SKIP_SHELL_SETTING, []);
  if (!addCommandToSkipShell(configured, PASTE_COMMAND)) return;

  const inspected = configuration.inspect<string[]>(COMMANDS_TO_SKIP_SHELL_SETTING);
  const globalCommands = inspected?.globalValue ?? [];
  const updatedGlobalCommands = addCommandToSkipShell(globalCommands, PASTE_COMMAND);
  if (!updatedGlobalCommands) return;

  await configuration.update(
    COMMANDS_TO_SKIP_SHELL_SETTING,
    updatedGlobalCommands,
    vscode.ConfigurationTarget.Global,
  );
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
