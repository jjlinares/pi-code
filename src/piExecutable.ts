import { accessSync, constants } from "node:fs";
import { isAbsolute, join } from "node:path";

export type PiExecutableResolution = { ok: true; path: string } | { ok: false; message: string };

export interface PiExecutableOptions {
  configuredPath?: string;
  pathEnvironment?: string;
  canExecute?: (path: string) => boolean;
}

export function resolvePiExecutable(options: PiExecutableOptions = {}): PiExecutableResolution {
  const canExecute = options.canExecute ?? isExecutable;
  const configuredPath = options.configuredPath?.trim();

  if (configuredPath) {
    if (!isAbsolute(configuredPath)) {
      return {
        ok: false,
        message: `Pi executable path must be absolute: ${configuredPath}`,
      };
    }
    if (!canExecute(configuredPath)) {
      return {
        ok: false,
        message: `Pi executable is missing or not executable: ${configuredPath}`,
      };
    }
    return { ok: true, path: configuredPath };
  }

  for (const directory of (options.pathEnvironment ?? process.env.PATH ?? "").split(":")) {
    if (!directory) continue;
    const candidate = join(directory, "pi");
    if (canExecute(candidate)) return { ok: true, path: candidate };
  }

  return {
    ok: false,
    message:
      "Pi was not found in PATH. Install @earendil-works/pi-coding-agent or configure pi-code.executablePath.",
  };
}

function isExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
