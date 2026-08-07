import { describe, expect, it } from "vitest";
import { commandSkipShellState } from "../src/terminalKeyDispatch.js";

const COMMAND = "pi-clipboard-bridge.paste";

describe("commandSkipShellState", () => {
  it("reports enabled, disabled, and missing commands", () => {
    expect(commandSkipShellState([COMMAND], COMMAND)).toBe("enabled");
    expect(commandSkipShellState([`-${COMMAND}`], COMMAND)).toBe("disabled");
    expect(commandSkipShellState(["other.command"], COMMAND)).toBe("missing");
  });

  it("uses the last matching entry like VS Code", () => {
    expect(commandSkipShellState([`-${COMMAND}`, COMMAND], COMMAND)).toBe("enabled");
    expect(commandSkipShellState([COMMAND, `-${COMMAND}`], COMMAND)).toBe("disabled");
  });
});
