import { describe, expect, it } from "vitest";
import { addCommandToSkipShell } from "../src/terminalKeyDispatch.js";

const COMMAND = "pi-clipboard-bridge.paste";

describe("addCommandToSkipShell", () => {
  it("appends the bridge command without discarding existing commands", () => {
    expect(addCommandToSkipShell(["pi-code.newSession"], COMMAND)).toEqual([
      "pi-code.newSession",
      COMMAND,
    ]);
  });

  it("does not duplicate the command", () => {
    expect(addCommandToSkipShell([COMMAND], COMMAND)).toBeUndefined();
  });

  it("respects an explicit opt-out", () => {
    expect(addCommandToSkipShell([`-${COMMAND}`], COMMAND)).toBeUndefined();
  });
});
