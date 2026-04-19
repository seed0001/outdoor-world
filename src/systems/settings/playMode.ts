export type PlayMode = "sim" | "survive";

/** `null` until the user enters the world (device + play mode chosen). */
let mode: PlayMode | null = null;

export function configurePlayMode(m: PlayMode): void {
  mode = m;
}

/** Call when leaving the running game so menu / ticks do not use survive rules. */
export function resetPlayMode(): void {
  mode = null;
}

export function getPlayMode(): PlayMode | null {
  return mode;
}

export function isSurviveMode(): boolean {
  return mode === "survive";
}
