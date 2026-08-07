const IMAGE_TYPES = [
  { mimeType: "image/png", extension: "png" },
  { mimeType: "image/jpeg", extension: "jpg" },
  { mimeType: "image/webp", extension: "webp" },
  { mimeType: "image/gif", extension: "gif" },
] as const;

export interface ClipboardImage {
  bytes: Uint8Array;
  extension: string;
  mimeType: string;
}

export type ClipboardImageResult =
  | { kind: "image"; image: ClipboardImage }
  | { kind: "none" }
  | { kind: "unavailable" };

export interface CommandOutput {
  status: "ok" | "missing" | "error";
  stdout: Uint8Array;
}

export type CommandRunner = (
  command: string,
  args: readonly string[],
  timeoutMs: number,
) => Promise<CommandOutput>;

interface ReaderResult {
  helperAvailable: boolean;
  image?: ClipboardImage;
}

const LIST_TIMEOUT_MS = 1_000;
const READ_TIMEOUT_MS = 3_000;

export async function readClipboardImage(
  runCommand: CommandRunner,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ClipboardImageResult> {
  const readers = isWayland(env) ? [readViaWlPaste, readViaXclip] : [readViaXclip, readViaWlPaste];
  let helperAvailable = false;

  for (const reader of readers) {
    const result = await reader(runCommand);
    helperAvailable ||= result.helperAvailable;
    if (result.image) return { kind: "image", image: result.image };
  }

  return helperAvailable ? { kind: "none" } : { kind: "unavailable" };
}

function isWayland(env: NodeJS.ProcessEnv): boolean {
  return Boolean(env.WAYLAND_DISPLAY) || env.XDG_SESSION_TYPE === "wayland";
}

async function readViaWlPaste(runCommand: CommandRunner): Promise<ReaderResult> {
  const listed = await runCommand("wl-paste", ["--list-types"], LIST_TIMEOUT_MS);
  if (listed.status === "missing") return { helperAvailable: false };
  if (listed.status !== "ok") return { helperAvailable: true };

  const imageType = selectImageType(decodeLines(listed.stdout));
  if (!imageType) return { helperAvailable: true };

  const image = await runCommand(
    "wl-paste",
    ["--type", imageType.mimeType, "--no-newline"],
    READ_TIMEOUT_MS,
  );
  if (image.status !== "ok" || image.stdout.byteLength === 0) {
    return { helperAvailable: true };
  }

  return {
    helperAvailable: true,
    image: {
      bytes: image.stdout,
      extension: imageType.extension,
      mimeType: imageType.mimeType,
    },
  };
}

async function readViaXclip(runCommand: CommandRunner): Promise<ReaderResult> {
  const listed = await runCommand(
    "xclip",
    ["-selection", "clipboard", "-t", "TARGETS", "-o"],
    LIST_TIMEOUT_MS,
  );
  if (listed.status === "missing") return { helperAvailable: false };
  if (listed.status !== "ok") return { helperAvailable: true };

  const imageType = selectImageType(decodeLines(listed.stdout));
  if (!imageType) return { helperAvailable: true };

  const image = await runCommand(
    "xclip",
    ["-selection", "clipboard", "-t", imageType.mimeType, "-o"],
    READ_TIMEOUT_MS,
  );
  if (image.status !== "ok" || image.stdout.byteLength === 0) {
    return { helperAvailable: true };
  }

  return {
    helperAvailable: true,
    image: {
      bytes: image.stdout,
      extension: imageType.extension,
      mimeType: imageType.mimeType,
    },
  };
}

function decodeLines(bytes: Uint8Array): string[] {
  return Buffer.from(bytes)
    .toString("utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function selectImageType(types: readonly string[]): (typeof IMAGE_TYPES)[number] | undefined {
  const normalizedTypes = new Set(types.map(baseMimeType));
  return IMAGE_TYPES.find(({ mimeType }) => normalizedTypes.has(mimeType));
}

function baseMimeType(value: string): string {
  return value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}
