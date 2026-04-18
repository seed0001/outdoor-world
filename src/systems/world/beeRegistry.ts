import {
  HALF_X,
  WORLD_MIN_Z,
  WORLD_MAX_Z,
  insideLake,
  mulberry32,
} from "../../world/terrain";
import { BEE_PLACEMENT_SEED } from "./worldSeed";
import { beeHiveInfo } from "./beeHive";

export interface BeeSpec {
  id: number;
  homeX: number;
  homeZ: number;
  patrolRadius: number;
  cruiseHeight: number;
  wanderSpeed: number;
  scale: number;
  phase: number;
  /** PRNG seed for flight noise / waypoints. */
  seed: number;
}

const BEE_COUNT = 8;
const MARGIN = 6;

function generate(): BeeSpec[] {
  const rand = mulberry32(BEE_PLACEMENT_SEED);
  const out: BeeSpec[] = [];
  const hx = beeHiveInfo.x;
  const hz = beeHiveInfo.z;

  let guard = 0;
  while (out.length < BEE_COUNT && guard++ < BEE_COUNT * 50) {
    const a = rand() * Math.PI * 2;
    const r = 0.35 + rand() * 3.8;
    let homeX = hx + Math.cos(a) * r;
    let homeZ = hz + Math.sin(a) * r;
    if (
      Math.abs(homeX) > HALF_X - MARGIN ||
      homeZ < WORLD_MIN_Z + MARGIN ||
      homeZ > WORLD_MAX_Z - MARGIN
    ) {
      continue;
    }
    if (insideLake(homeX, homeZ, 2.2)) continue;

    out.push({
      id: out.length,
      homeX,
      homeZ,
      patrolRadius: 1.8 + rand() * 2.8,
      cruiseHeight: 0.75 + rand() * 1.05,
      wanderSpeed: 1.35 + rand() * 1.0,
      scale: 0.9 + rand() * 0.35,
      phase: rand(),
      seed: Math.floor(rand() * 0xffffffff) | 0,
    });
  }
  return out;
}

export const bees: ReadonlyArray<BeeSpec> = generate();
