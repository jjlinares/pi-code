import { describe, expect, it, vi } from "vitest";
import {
  type CommandOutput,
  type CommandRunner,
  readClipboardImage,
} from "../src/clipboardImage.js";

const ok = (textOrBytes: string | Uint8Array): CommandOutput => ({
  status: "ok",
  stdout: typeof textOrBytes === "string" ? Buffer.from(textOrBytes, "utf8") : textOrBytes,
});

const missing = (): CommandOutput => ({ status: "missing", stdout: new Uint8Array() });
const error = (): CommandOutput => ({ status: "error", stdout: new Uint8Array() });

describe("readClipboardImage", () => {
  it("prefers PNG from Wayland and returns its bytes", async () => {
    const bytes = Uint8Array.from([137, 80, 78, 71]);
    const run = vi
      .fn<CommandRunner>()
      .mockResolvedValueOnce(ok("text/plain\nimage/jpeg\nimage/png\n"))
      .mockResolvedValueOnce(ok(bytes));

    await expect(readClipboardImage(run, { WAYLAND_DISPLAY: "wayland-0" })).resolves.toEqual({
      kind: "image",
      image: { bytes, extension: "png", mimeType: "image/png" },
    });
    expect(run).toHaveBeenNthCalledWith(1, "wl-paste", ["--list-types"], 1_000);
    expect(run).toHaveBeenNthCalledWith(
      2,
      "wl-paste",
      ["--type", "image/png", "--no-newline"],
      3_000,
    );
  });

  it("falls back from a missing Wayland helper to xclip", async () => {
    const bytes = Uint8Array.from([1, 2, 3]);
    const run = vi
      .fn<CommandRunner>()
      .mockResolvedValueOnce(missing())
      .mockResolvedValueOnce(ok("image/webp\nUTF8_STRING\n"))
      .mockResolvedValueOnce(ok(bytes));

    await expect(readClipboardImage(run, { XDG_SESSION_TYPE: "wayland" })).resolves.toEqual({
      kind: "image",
      image: { bytes, extension: "webp", mimeType: "image/webp" },
    });
    expect(run).toHaveBeenNthCalledWith(
      2,
      "xclip",
      ["-selection", "clipboard", "-t", "TARGETS", "-o"],
      1_000,
    );
  });

  it("reports no image when a helper is available", async () => {
    const run = vi
      .fn<CommandRunner>()
      .mockResolvedValueOnce(ok("text/plain\nUTF8_STRING\n"))
      .mockResolvedValueOnce(error());

    await expect(readClipboardImage(run, {})).resolves.toEqual({ kind: "none" });
  });

  it("reports unavailable when neither helper is installed", async () => {
    const run = vi.fn<CommandRunner>().mockResolvedValue(missing());

    await expect(readClipboardImage(run, {})).resolves.toEqual({ kind: "unavailable" });
  });
});
