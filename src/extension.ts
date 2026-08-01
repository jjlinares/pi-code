import * as vscode from "vscode";
import { resolvePiExecutable } from "./piExecutable.js";
import { PiTerminals } from "./piTerminals.js";
import { formatSelectionReference } from "./selectionReference.js";

export function activate(context: vscode.ExtensionContext): void {
  const terminals = new PiTerminals(resolveExecutable);
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  status.name = "Pi Code";
  status.text = "$(terminal) Pi Code";
  status.tooltip = "Open Pi Code";
  status.command = "pi-code.open";
  status.show();

  context.subscriptions.push(
    terminals,
    status,
    vscode.commands.registerCommand("pi-code.open", async () => {
      await terminals.open(getActiveWorkspaceFolder());
    }),
    vscode.commands.registerCommand("pi-code.newTerminal", async () => {
      await terminals.open(getActiveWorkspaceFolder(), true);
    }),
    vscode.commands.registerCommand("pi-code.addSelectionToComposer", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty || editor.document.uri.scheme !== "file") return;

      const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
      const path = workspaceFolder
        ? vscode.workspace.asRelativePath(editor.document.uri, false)
        : editor.document.uri.fsPath;
      const reference = formatSelectionReference({
        path,
        startLine: editor.selection.start.line + 1,
        endLine: editor.selection.end.line + 1,
        endCharacter: editor.selection.end.character,
      });
      if (!reference) {
        void vscode.window.showErrorMessage(
          "Pi Code cannot send file paths containing terminal control characters.",
        );
        return;
      }

      await terminals.appendToComposer(reference, workspaceFolder?.uri);
    }),
  );
}

function getActiveWorkspaceFolder(): vscode.Uri | undefined {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
    if (folder) return folder.uri;
  }
  return vscode.workspace.workspaceFolders?.[0]?.uri;
}

async function resolveExecutable(): Promise<string | undefined> {
  const configuredPath = vscode.workspace.getConfiguration("pi-code").get<string>("executablePath");
  const resolution = resolvePiExecutable(configuredPath ? { configuredPath } : {});
  if (resolution.ok) return resolution.path;

  const action = await vscode.window.showErrorMessage(resolution.message, "Open Settings");
  if (action === "Open Settings") {
    await vscode.commands.executeCommand("workbench.action.openSettings", "pi-code.executablePath");
  }
  return undefined;
}
