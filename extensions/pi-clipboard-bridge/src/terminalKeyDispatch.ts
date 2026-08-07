export function addCommandToSkipShell(
  configured: readonly string[],
  command: string,
): string[] | undefined {
  if (configured.includes(command) || configured.includes(`-${command}`)) return undefined;
  return [...configured, command];
}
