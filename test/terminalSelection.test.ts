import { describe, expect, it } from "vitest";
import { formatTerminalSelectionContext } from "../src/terminalSelection.js";

describe("formatTerminalSelectionContext", () => {
  it("wraps multiline terminal output", () => {
    expect(formatTerminalSelectionContext("first\nsecond\n")).toBe(
      "<quoted_context>\nfirst\nsecond\n</quoted_context>\n",
    );
  });

  it("normalizes carriage returns", () => {
    expect(formatTerminalSelectionContext("first\r\nsecond\r")).toBe(
      "<quoted_context>\nfirst\nsecond\n</quoted_context>\n",
    );
  });

  it("preserves trailing spaces and blank lines", () => {
    expect(formatTerminalSelectionContext("output  \n\n")).toBe(
      "<quoted_context>\noutput  \n\n</quoted_context>\n",
    );
  });

  it("rejects empty and whitespace-only selections", () => {
    expect(formatTerminalSelectionContext("")).toBeUndefined();
    expect(formatTerminalSelectionContext(" \n\t")).toBeUndefined();
  });
});
