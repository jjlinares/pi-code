import { isAbsolute, relative, sep } from "node:path";

export function chooseWorkingDirectory(
  activeFileWorkspace: string | undefined,
  workspaceFolders: readonly string[],
  homeDirectory: string,
): string {
  return activeFileWorkspace ?? workspaceFolders[0] ?? homeDirectory;
}

export function workspaceRelativePath(
  workspaceFolder: string,
  filePath: string,
): string | undefined {
  const path = relative(workspaceFolder, filePath);
  if (path === "" || isAbsolute(path) || path === ".." || path.startsWith(`..${sep}`)) {
    return undefined;
  }
  return path.split(sep).join("/");
}
