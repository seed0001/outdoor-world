import {
  LAKE_CENTER_X,
  LAKE_CENTER_Z,
  LAKE_FLOOR_Y,
  LAKE_OUTER_R,
  LAKE_WATER_Y,
  mulberry32,
} from "../../world/terrain";

export interface FishSpec {
  id: number;
  x: number;
  y: number;
  z: number;
  scale: number;
  speed: number;
  turnRate: number;
  phase: number;
  wagFreq: number;
  wagAmp: number;
}

const FISH_COUNT = 14;
const FISH_SEED = 91173;

/** Safe swim volume: inset from the lake rim, a hand above the bed, below the surface. */
export const SWIM_MAX_R = LAKE_OUTER_R - 2.2;
export const SWIM_MIN_Y = LAKE_FLOOR_Y + 0.45;
export const SWIM_MAX_Y = LAKE_WATER_Y - 0.35;

function generate(): FishSpec[] {
  const rand = mulberry32(FISH_SEED);
  const out: FishSpec[] = [];
  for (let i = 0; i < FISH_COUNT; i++) {
    // Disk sample with sqrt so density is uniform over area.
    const angle = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * (SWIM_MAX_R - 1.0);
    const x = LAKE_CENTER_X + Math.cos(angle) * r;
    const z = LAKE_CENTER_Z + Math.sin(angle) * r;
    const y = SWIM_MIN_Y + rand() * (SWIM_MAX_Y - SWIM_MIN_Y);
    out.push({
      id: i,
      x,
      y,
      z,
      scale: 0.75 + rand() * 0.65,
      speed: 0.85 + rand() * 0.9,
      turnRate: 1.1 + rand() * 0.9,
      phase: rand(),
      wagFreq: 5.0 + rand() * 3.5,
      wagAmp: 0.28 + rand() * 0.18,
    });
  }
  return out;
}

export const fishes: ReadonlyArray<FishSpec> = generate();
