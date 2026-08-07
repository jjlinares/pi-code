export interface RemoteUriBase {
  authority: string;
  scheme: string;
}

export interface RemoteTempLocation extends RemoteUriBase {
  path: string;
}

export function createRemoteTempLocation(
  base: RemoteUriBase,
  fileName: string,
): RemoteTempLocation | undefined {
  if (base.scheme !== "vscode-remote" || !base.authority || !isSafeFileName(fileName)) {
    return undefined;
  }

  return {
    scheme: base.scheme,
    authority: base.authority,
    path: `/tmp/${fileName}`,
  };
}

export function findRemoteTempLocation(
  bases: Iterable<RemoteUriBase | undefined>,
  fileName: string,
): RemoteTempLocation | undefined {
  for (const base of bases) {
    if (!base) continue;
    const location = createRemoteTempLocation(base, fileName);
    if (location) return location;
  }
  return undefined;
}

function isSafeFileName(fileName: string): boolean {
  return fileName.length > 0 && !fileName.includes("/") && !fileName.includes("\\");
}
