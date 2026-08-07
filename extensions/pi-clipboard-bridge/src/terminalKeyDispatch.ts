export type CommandSkipShellState = "enabled" | "disabled" | "missing";

export function commandSkipShellState(
  configured: readonly string[],
  command: string,
): CommandSkipShellState {
  let state: CommandSkipShellState = "missing";
  for (const entry of configured) {
    if (entry === command) state = "enabled";
    if (entry === `-${command}`) state = "disabled";
  }
  return state;
}
