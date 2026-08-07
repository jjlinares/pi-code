import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  activationEvents?: string[];
  publisher: string;
  icon: string;
  repository: { type: string; url: string };
  homepage: string;
  bugs: { url: string };
  scripts: Record<string, string>;
  engines: { vscode: string };
  extensionPack: string[];
  contributes: {
    commands: Array<{ command: string; title: string }>;
    configuration: { properties: Record<string, { scope: string }> };
    keybindings: Array<{ command: string; key: string; when: string }>;
    menus: {
      "editor/context": Array<{ when: string }>;
      "explorer/context": Array<{ command: string; group: string; when: string }>;
      "terminal/context": Array<{ command: string; group: string; when: string }>;
    };
  };
};

describe("extension manifest", () => {
  it("declares publishable Marketplace metadata", () => {
    expect(manifest.publisher).toBe("jjmsft");
    expect(manifest.icon).toBe("assets/icon.png");
    expect(manifest.repository).toEqual({
      type: "git",
      url: "https://github.com/jjlinares/pi-code.git",
    });
    expect(manifest.homepage).toBe("https://github.com/jjlinares/pi-code#readme");
    expect(manifest.bugs.url).toBe("https://github.com/jjlinares/pi-code/issues");
    expect(manifest.scripts["vscode:prepublish"]).toBe("pnpm check");
  });

  it("contributes exactly the agreed commands", () => {
    expect(manifest.contributes.commands).toEqual([
      { command: "pi-code.open", title: "Pi Code: Open", icon: "$(terminal)" },
      {
        command: "pi-code.newSession",
        title: "Pi Code: New Session",
        icon: "$(terminal-new)",
      },
      {
        command: "pi-code.addSelectionToComposer",
        title: "Pi Code: Add Selection to Composer",
      },
      {
        command: "pi-code.addFileToComposer",
        title: "Pi Code: Add File to Composer",
      },
      {
        command: "pi-code.addTerminalSelectionToComposer",
        title: "Pi Code: Add Terminal Selection to Composer",
      },
    ]);
  });

  it("targets VS Code 1.130 without startup activation", () => {
    expect(manifest.engines.vscode).toBe("^1.130.0");
    expect(manifest.activationEvents).toBeUndefined();
  });

  it("installs the standalone clipboard bridge", () => {
    expect(manifest.extensionPack).toEqual(["jjmsft.pi-clipboard-bridge"]);
  });

  it("uses a machine-scoped Pi path setting", () => {
    expect(manifest.contributes.configuration.properties["pi-code.path"]?.scope).toBe("machine");
  });

  it("binds New Session to Ctrl+Alt+P on Linux", () => {
    expect(manifest.contributes.keybindings).toEqual([
      { command: "pi-code.newSession", key: "ctrl+alt+p", when: "isLinux" },
    ]);
  });

  it("hides editor selection insertion for dirty editors", () => {
    expect(manifest.contributes.menus["editor/context"][0]?.when).toContain("!activeEditorIsDirty");
  });

  it("shows file insertion only for Explorer files", () => {
    expect(manifest.contributes.menus["explorer/context"]).toEqual([
      {
        command: "pi-code.addFileToComposer",
        group: "navigation@-1000",
        when: "resourceScheme == file && !explorerResourceIsFolder",
      },
    ]);
  });

  it("shows terminal selection insertion only when terminal text is selected", () => {
    expect(manifest.contributes.menus["terminal/context"]).toEqual([
      {
        command: "pi-code.addTerminalSelectionToComposer",
        group: "navigation@-1000",
        when: "terminalTextSelected",
      },
    ]);
  });
});
