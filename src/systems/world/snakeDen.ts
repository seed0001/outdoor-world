import { heightAt } from "../../world/terrain";

/** Shared den all timber rattlesnakes use — clear of the lake and player spawn. */
export const SNAKE_DEN_X = 34;
export const SNAKE_DEN_Z = -30;
/** Keep trees / procedural rocks from spawning inside the mound. */
export const SNAKE_DEN_CLEAR_R = 5.5;

export function snakeDenBaseY(): number {
  return heightAt(SNAKE_DEN_X, SNAKE_DEN_Z);
}

export function nearSnakeDen(x: number, z: number, extra = 0): boolean {
  const dx = x - SNAKE_DEN_X;
  const dz = z - SNAKE_DEN_Z;
  return Math.hypot(dx, dz) < SNAKE_DEN_CLEAR_R + extra;
}
