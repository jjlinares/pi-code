export function formatTerminalSelectionContext(selection: string): string | undefined {
  const content = selection.replace(/\r\n?/g, "\n");
  if (!content.trim()) return undefined;

  const closingSeparator = content.endsWith("\n") ? "" : "\n";
  return `<quoted_context>\n${content}${closingSeparator}</quoted_context>\n`;
}
