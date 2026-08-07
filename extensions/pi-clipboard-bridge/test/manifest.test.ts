import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  activationEvents: string[];
  extensionKind: string[];
  publisher: string;
  contributes: {
    commands: Array<{ command: string; title: string }>;
    keybindings: Array<{ command: string; key: string; when: string }>;
    configurationDefaults: Record<string, string[]>;
  };
};

describe("Pi Clipboard Bridge manifest", () => {
  it("runs locally and repairs terminal key dispatch after startup", () => {
    expect(manifest.publisher).toBe("jjmsft");
    expect(manifest.extensionKind).toEqual(["ui"]);
    expect(manifest.activationEvents).toEqual(["onStartupFinished"]);
    expect(manifest.contributes.configurationDefaults).toEqual({
      "terminal.integrated.commandsToSkipShell": ["pi-clipboard-bridge.paste"],
    });
  });

  it("intercepts Ctrl+V only in Linux devcontainer terminals", () => {
    expect(manifest.contributes.commands).toEqual([
      { command: "pi-clipboard-bridge.paste", title: "Pi Clipboard: Paste" },
    ]);
    expect(manifest.contributes.keybindings).toEqual([
      {
        command: "pi-clipboard-bridge.paste",
        key: "ctrl+v",
        when: "terminalFocus && isLinux && remoteName == dev-container",
      },
    ]);
  });
});
