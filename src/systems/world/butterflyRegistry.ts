import {
  HALF_X,
  WORLD_MAX_Z,
  GRASS_BIOME_Z_MIN,
  heightAt,
  insideLake,
  mulberry32,
} from "../../world/terrain";
import { BUTTERFLY_PLACEMENT_SEED } from "./worldSeed";

export interface ButterflySpec {
  id: number;
  /** Centroid the butterfly tends to roam around. */
  homeX: number;
  homeZ: number;
  /** Radius it's happy to wander within, in metres. */
  patrolRadius: number;
  /** Nominal flight altitude above local ground. */
  cruiseHeight: number;
  /** Ground spot it returns to between flights. */
  restX: number;
  restY: number;
  restZ: number;
  scale: number;
  /** How fast it zips between waypoints (m/s). */
  wanderSpeed: number;
  /** Rig flap rate multiplier (1.0 = native clip speed). */
  flapSpeed: number;
  phase: number;
  /** Per-butterfly PRNG seed for decisions. */
  seed: number;
}

const BUTTERFLY_COUNT = 16;
const MARGIN = 6;
const MIN_DIST_FROM_SPAWN = 6;

function generate(): ButterflySpec[] {
  const rand = mulberry32(BUTTERFLY_PLACEMENT_SEED);
  const out: ButterflySpec[] = [];
  let guard = 0;
  while (out.length < BUTTERFLY_COUNT && guard++ < BUTTERFLY_COUNT * 30) {
    const homeX = (rand() - 0.5) * 2 * (HALF_X - MARGIN);
    const homeZ =
      GRASS_BIOME_Z_MIN +
      MARGIN +
      rand() * (WORLD_MAX_Z - GRASS_BIOME_Z_MIN - 2 * MARGIN);
    if (Math.hypot(homeX, homeZ) < MIN_DIST_FROM_SPAWN) continue;
    if (insideLake(homeX, homeZ, 4)) continue;

    // Rest spot: sample a point inside the patrol radius that's also on dry land.
    const patrolRadius = 5 + rand() * 6;
    let restX = homeX;
    let restZ = homeZ;
    for (let tries = 0; tries < 12; tries++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * patrolRadius * 0.6;
      const cx = homeX + Math.cos(a) * r;
      const cz = homeZ + Math.sin(a) * r;
      if (!insideLake(cx, cz, 2)) {
        restX = cx;
        restZ = cz;
        break;
      }
    }

    out.push({
      id: out.length,
      homeX,
      homeZ,
      patrolRadius,
      cruiseHeight: 1.1 + rand() * 1.4,
      restX,
      restY: heightAt(restX, restZ),
      restZ,
      scale: 0.85 + rand() * 0.4,
      wanderSpeed: 1.1 + rand() * 0.9,
      flapSpeed: 0.9 + rand() * 0.35,
      phase: rand(),
      seed: Math.floor(rand() * 0xffffffff) | 0,
    });
  }
  return out;
}

export const butterflies: ReadonlyArray<ButterflySpec> = generate();
