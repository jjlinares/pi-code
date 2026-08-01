import { describe, expect, it } from "vitest";
import { formatSelectionReference } from "../src/selectionReference.js";

describe("formatSelectionReference", () => {
  it("formats a single-line selection", () => {
    expect(
      formatSelectionReference({
        path: "src/extension.ts",
        startLine: 8,
        endLine: 8,
        endCharacter: 12,
      }),
    ).toBe("@src/extension.ts:8");
  });

  it("formats a multiline selection", () => {
    expect(
      formatSelectionReference({
        path: "src/extension.ts",
        startLine: 8,
        endLine: 12,
        endCharacter: 4,
      }),
    ).toBe("@src/extension.ts:8-12");
  });

  it("excludes an exclusive end line at character zero", () => {
    expect(
      formatSelectionReference({
        path: "src/extension.ts",
        startLine: 8,
        endLine: 13,
        endCharacter: 0,
      }),
    ).toBe("@src/extension.ts:8-12");
  });

  it.each(["src/evil\nfile.ts", "src/evil\rfile.ts", "src/evil\u001bfile.ts"])(
    "rejects terminal control characters in %j",
    (path) => {
      expect(
        formatSelectionReference({
          path,
          startLine: 1,
          endLine: 1,
          endCharacter: 1,
        }),
      ).toBeUndefined();
    },
  );
});
