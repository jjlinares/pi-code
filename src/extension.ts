import { homedir } from "node:os";
import * as vscode from "vscode";
import { resolvePiExecutable } from "./piExecutable.js";
import { PiTerminals } from "./piTerminals.js";
import { formatFileReference, formatSelectionReference } from "./selectionReference.js";
import { chooseWorkingDirectory, workspaceRelativePath } from "./workspace.js";

export function activate(context: vscode.ExtensionContext): void {
  const terminals = new PiTerminals(resolveExecutable);

  context.subscriptions.push(
    terminals,
    vscode.commands.registerCommand("pi-code.open", async () => {
      await terminals.open(getWorkingDirectory());
    }),
    vscode.commands.registerCommand("pi-code.newSession", async () => {
      await terminals.newSession(getWorkingDirectory());
    }),
    vscode.commands.registerCommand("pi-code.addSelectionToComposer", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        showError("Open a workspace file and select one or more lines first.");
        return;
      }
      if (editor.document.uri.scheme !== "file") {
        showError("Pi Code only supports file-backed editors.");
        return;
      }
      if (editor.selection.isEmpty) {
        showError("Select one or more lines before adding a reference.");
        return;
      }
      if (editor.document.isDirty) {
        showError("Save the file before adding its selection to Pi.");
        return;
      }

      const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
      if (!workspaceFolder) {
        showError("Pi Code only supports files inside a workspace folder.");
        return;
      }

      const path = workspaceRelativePath(workspaceFolder.uri.fsPath, editor.document.uri.fsPath);
      if (!path) {
        showError("Could not derive a workspace-relative path for the selected file.");
        return;
      }

      const reference = formatSelectionReference({
        path,
        startLine: editor.selection.start.line + 1,
        endLine: editor.selection.end.line + 1,
        endCharacter: editor.selection.end.character,
      });
      if (!reference) {
        showError("Pi Code cannot send file paths containing terminal control characters.");
        return;
      }

      await terminals.appendToComposer(reference, workspaceFolder.uri);
    }),
    vscode.commands.registerCommand("pi-code.addFileToComposer", async (uri?: vscode.Uri) => {
      if (uri?.scheme !== "file") {
        showError("Choose a file from the Explorer before adding it to Pi.");
        return;
      }

      try {
        const stat = await vscode.workspace.fs.stat(uri);
        if ((stat.type & vscode.FileType.Directory) !== 0) {
          showError("Choose a file, not a folder, before adding it to Pi.");
          return;
        }
      } catch (error) {
        showError(`Could not read the selected file: ${toErrorMessage(error)}`);
        return;
      }

      const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
      if (!workspaceFolder) {
        showError("Pi Code only supports files inside a workspace folder.");
        return;
      }

      const relativePath = workspaceRelativePath(workspaceFolder.uri.fsPath, uri.fsPath);
      if (!relativePath) {
        showError("Could not derive a workspace-relative path for the selected file.");
        return;
      }

      const reference = formatFileReference(relativePath);
      if (!reference) {
        showError("Pi Code cannot send file paths containing terminal control characters.");
        return;
      }

      await terminals.appendToComposer(reference, workspaceFolder.uri);
    }),
    vscode.commands.registerCommand("pi-code.addTerminalSelectionToComposer", async () => {
      const sourceTerminal = vscode.window.activeTerminal;
      if (!sourceTerminal) {
        showError("Select terminal text before adding it to Pi.");
        return;
      }

      try {
        const result = await terminals.appendTerminalSelectionToComposer(
          sourceTerminal,
          getWorkingDirectory(),
        );
        if (result === "noSelection") {
          showError("Select non-empty terminal text before adding it to Pi.");
        }
      } catch (error) {
        showError(`Failed to add terminal selection: ${toErrorMessage(error)}`);
      }
    }),
  );
}

function getWorkingDirectory(): vscode.Uri {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const activeEditor = vscode.window.activeTextEditor;
  const activeFolder = activeEditor
    ? vscode.workspace.getWorkspaceFolder(activeEditor.document.uri)
    : undefined;
  const path = chooseWorkingDirectory(
    activeFolder?.uri.fsPath,
    folders.map((folder) => folder.uri.fsPath),
    homedir(),
  );
  return vscode.Uri.file(path);
}

function showError(message: string): void {
  void vscode.window.showErrorMessage(message);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function resolveExecutable(): Promise<string | undefined> {
  const configuredPath = vscode.workspace.getConfiguration("pi-code").get<string>("path");
  const resolution = resolvePiExecutable(configuredPath ? { configuredPath } : {});
  if (resolution.ok) return resolution.path;

  const action = await vscode.window.showErrorMessage(resolution.message, "Open Settings");
  if (action === "Open Settings") {
    await vscode.commands.executeCommand("workbench.action.openSettings", "pi-code.path");
  }
  return undefined;
}
