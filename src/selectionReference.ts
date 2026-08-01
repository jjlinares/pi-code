export interface SelectionReference {
  path: string;
  startLine: number;
  endLine: number;
  endCharacter: number;
}

export function formatSelectionReference(selection: SelectionReference): string | undefined {
  if ([...selection.path].some(isTerminalControlCharacter)) return undefined;

  const effectiveEndLine =
    selection.endCharacter === 0 && selection.endLine > selection.startLine
      ? selection.endLine - 1
      : selection.endLine;
  const range =
    selection.startLine === effectiveEndLine
      ? String(selection.startLine)
      : `${selection.startLine}-${effectiveEndLine}`;

  return `${selection.path}:${range}`;
}

function isTerminalControlCharacter(character: string): boolean {
  const codePoint = character.codePointAt(0) ?? 0;
  return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
}
