import { spawn } from "node:child_process";
import type { CommandOutput, CommandRunner } from "./clipboardImage.js";

const MAX_OUTPUT_BYTES = 50 * 1024 * 1024;

export const runCommand: CommandRunner = (command, args, timeoutMs) =>
  new Promise<CommandOutput>((resolve) => {
    const child = spawn(command, [...args], { stdio: ["ignore", "pipe", "ignore"] });
    const chunks: Buffer[] = [];
    let outputBytes = 0;
    let settled = false;
    let failed = false;

    const finish = (result: CommandOutput): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };

    const timeout = setTimeout(() => {
      failed = true;
      child.kill();
    }, timeoutMs);
    timeout.unref();

    child.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.byteLength;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        failed = true;
        child.kill();
        return;
      }
      chunks.push(chunk);
    });

    child.on("error", (error: NodeJS.ErrnoException) => {
      finish({
        status: error.code === "ENOENT" ? "missing" : "error",
        stdout: new Uint8Array(),
      });
    });

    child.on("close", (code) => {
      finish({
        status: !failed && code === 0 ? "ok" : "error",
        stdout: !failed && code === 0 ? Buffer.concat(chunks, outputBytes) : new Uint8Array(),
      });
    });
  });
