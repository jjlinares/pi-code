import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  activationEvents?: string[];
  engines: { vscode: string };
  contributes: {
    commands: Array<{ command: string; title: string }>;
    configuration: { properties: Record<string, { scope: string }> };
    keybindings: Array<{ command: string; key: string; when: string }>;
    menus: { "editor/context": Array<{ when: string }> };
  };
};

describe("extension manifest", () => {
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
    ]);
  });

  it("targets VS Code 1.130 without startup activation", () => {
    expect(manifest.engines.vscode).toBe("^1.130.0");
    expect(manifest.activationEvents).toBeUndefined();
  });

  it("uses a machine-scoped Pi path setting", () => {
    expect(manifest.contributes.configuration.properties["pi-code.path"]?.scope).toBe("machine");
  });

  it("binds Open to Ctrl+Alt+P on Linux", () => {
    expect(manifest.contributes.keybindings).toEqual([
      { command: "pi-code.open", key: "ctrl+alt+p", when: "isLinux" },
    ]);
  });

  it("hides selection insertion for dirty editors", () => {
    expect(manifest.contributes.menus["editor/context"][0]?.when).toContain("!activeEditorIsDirty");
  });
});
