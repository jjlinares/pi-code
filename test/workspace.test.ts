import { describe, expect, it } from "vitest";
import { chooseWorkingDirectory, workspaceRelativePath } from "../src/workspace.js";

describe("chooseWorkingDirectory", () => {
  it("uses the workspace containing the active file", () => {
    expect(
      chooseWorkingDirectory(
        "/workspace/backend",
        ["/workspace/frontend", "/workspace/backend"],
        "/home/user",
      ),
    ).toBe("/workspace/backend");
  });

  it("uses the sole workspace folder without an active workspace file", () => {
    expect(chooseWorkingDirectory(undefined, ["/workspace"], "/home/user")).toBe("/workspace");
  });

  it("uses the first folder for an ambiguous multi-root workspace", () => {
    expect(
      chooseWorkingDirectory(undefined, ["/workspace/first", "/workspace/second"], "/home/user"),
    ).toBe("/workspace/first");
  });

  it("uses the home directory for an empty window", () => {
    expect(chooseWorkingDirectory(undefined, [], "/home/user")).toBe("/home/user");
  });
});

describe("workspaceRelativePath", () => {
  it("returns a workspace-relative POSIX path", () => {
    expect(workspaceRelativePath("/workspace", "/workspace/src/app.ts")).toBe("src/app.ts");
  });

  it("rejects files outside the workspace folder", () => {
    expect(workspaceRelativePath("/workspace/one", "/workspace/two/app.ts")).toBeUndefined();
  });
});
