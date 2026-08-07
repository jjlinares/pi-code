import { describe, expect, it } from "vitest";
import { createRemoteTempLocation, findRemoteTempLocation } from "../src/remoteTarget.js";

describe("createRemoteTempLocation", () => {
  it("keeps the devcontainer URI authority and targets remote /tmp", () => {
    expect(
      createRemoteTempLocation(
        {
          scheme: "vscode-remote",
          authority: "dev-container+7b22686f737450617468223a222f776f726b7370616365227d",
        },
        "pi-clipboard-id.png",
      ),
    ).toEqual({
      scheme: "vscode-remote",
      authority: "dev-container+7b22686f737450617468223a222f776f726b7370616365227d",
      path: "/tmp/pi-clipboard-id.png",
    });
  });

  it("falls back from a local terminal cwd to the remote workspace", () => {
    expect(
      findRemoteTempLocation(
        [
          { scheme: "file", authority: "" },
          { scheme: "vscode-remote", authority: "dev-container+id" },
        ],
        "pi-clipboard-id.png",
      ),
    ).toEqual({
      scheme: "vscode-remote",
      authority: "dev-container+id",
      path: "/tmp/pi-clipboard-id.png",
    });
  });

  it("rejects local filesystems, absent authorities, and path traversal", () => {
    expect(
      createRemoteTempLocation({ scheme: "file", authority: "" }, "pi-clipboard-id.png"),
    ).toBeUndefined();
    expect(
      createRemoteTempLocation({ scheme: "vscode-remote", authority: "" }, "image.png"),
    ).toBeUndefined();
    expect(
      createRemoteTempLocation(
        { scheme: "vscode-remote", authority: "dev-container+id" },
        "../image.png",
      ),
    ).toBeUndefined();
  });
});
