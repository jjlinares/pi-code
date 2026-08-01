import { describe, expect, it } from "vitest";
import { resolvePiExecutable } from "../src/piExecutable.js";

function executablePaths(...paths: string[]): (path: string) => boolean {
  const existing = new Set(paths);
  return (path) => existing.has(path);
}

describe("resolvePiExecutable", () => {
  it("uses an executable absolute configured path", () => {
    expect(
      resolvePiExecutable({
        configuredPath: "/opt/pi/bin/pi",
        canExecute: executablePaths("/opt/pi/bin/pi"),
      }),
    ).toEqual({ ok: true, path: "/opt/pi/bin/pi" });
  });

  it("rejects a relative configured path", () => {
    expect(
      resolvePiExecutable({ configuredPath: "bin/pi", canExecute: executablePaths() }),
    ).toEqual({ ok: false, message: "Pi executable path must be absolute: bin/pi" });
  });

  it("rejects a configured path that is not executable", () => {
    expect(
      resolvePiExecutable({
        configuredPath: "/opt/pi",
        canExecute: executablePaths(),
      }),
    ).toEqual({
      ok: false,
      message: "Pi executable is missing or not executable: /opt/pi",
    });
  });

  it("returns the first executable pi in PATH", () => {
    expect(
      resolvePiExecutable({
        pathEnvironment: "/usr/local/bin:/usr/bin",
        canExecute: executablePaths("/usr/bin/pi"),
      }),
    ).toEqual({ ok: true, path: "/usr/bin/pi" });
  });

  it("reports a missing PATH executable", () => {
    expect(
      resolvePiExecutable({
        pathEnvironment: "/usr/local/bin:/usr/bin",
        canExecute: executablePaths(),
      }),
    ).toEqual({
      ok: false,
      message:
        "Pi was not found in PATH. Install @earendil-works/pi-coding-agent or configure pi-code.executablePath.",
    });
  });
});
