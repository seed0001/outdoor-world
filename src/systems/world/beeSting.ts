import { health } from "../player/health";
import { addCameraShake } from "../player/playerRef";

let lastStingAtMs = 0;
const COOLDOWN_MS = 950;

/** Swarm sting — one hit per cooldown while any bee is close enough. */
export function tryBeeSwarmSting(
  nearestBeeDistance: number,
  aggressive: boolean,
): void {
  if (!aggressive || health.get().dead) return;
  if (nearestBeeDistance > 1.45) return;
  const now = performance.now();
  if (now - lastStingAtMs < COOLDOWN_MS) return;
  lastStingAtMs = now;
  health.damage(4, "bees");
  addCameraShake(0.14);
}
