import {
  HALF_X,
  WORLD_MAX_Z,
  GRASS_BIOME_Z_MIN,
  heightAt,
  belowLakeWaterLine,
  insideLake,
  mulberry32,
} from "../../world/terrain";
import { ROSE_FLOWER_PLACEMENT_SEED } from "./worldSeed";

export interface RoseFlowerSpec {
  id: number;
  x: number;
  y: number;
  z: number;
  rot: number;
  scale: number;
}

/** A few climbing-rose placements (see `public/models/rose-flower/`). */
const ROSE_COUNT = 5;
const MARGIN = 6;
const MIN_DIST_FROM_SPAWN = 10;
const MIN_SEPARATION = 14;

function generate(): RoseFlowerSpec[] {
  const rand = mulberry32(ROSE_FLOWER_PLACEMENT_SEED);
  const out: RoseFlowerSpec[] = [];
  let guard = 0;
  while (out.length < ROSE_COUNT && guard++ < ROSE_COUNT * 80) {
    const x = (rand() - 0.5) * 2 * (HALF_X - MARGIN);
    const z =
      GRASS_BIOME_Z_MIN +
      MARGIN +
      rand() * (WORLD_MAX_Z - GRASS_BIOME_Z_MIN - 2 * MARGIN);
    if (Math.hypot(x, z) < MIN_DIST_FROM_SPAWN) continue;
    if (insideLake(x, z, 5)) continue;
    if (belowLakeWaterLine(x, z, 0.4)) continue;
    let ok = true;
    for (const p of out) {
      if (Math.hypot(p.x - x, p.z - z) < MIN_SEPARATION) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    out.push({
      id: out.length,
      x,
      y: heightAt(x, z),
      z,
      rot: rand() * Math.PI * 2,
      scale: 0.9 + rand() * 0.35,
    });
  }
  return out;
}

export const roseFlowers: ReadonlyArray<RoseFlowerSpec> = generate();
