import {
  HALF_X,
  WORLD_MAX_Z,
  GRASS_BIOME_Z_MIN,
  heightAt,
  belowLakeWaterLine,
  insideLake,
  mulberry32,
} from "../../world/terrain";
import { COLORED_FLOWER_PATCH_SEED } from "./worldSeed";
import { COLORED_FLOWER_VARIANT_COUNT } from "../../world/coloredFlowerAssets";

export interface ColoredFlowerPatchSpec {
  id: number;
  x: number;
  y: number;
  z: number;
  rot: number;
  scale: number;
  /** Picks diffuse from `TEXTURE_VARIANTS` in ColoredFlowerPatches. */
  variant: number;
}

const PATCH_COUNT = COLORED_FLOWER_VARIANT_COUNT;
const MARGIN = 5;
const MIN_DIST_FROM_SPAWN = 7;

function generate(): ColoredFlowerPatchSpec[] {
  const rand = mulberry32(COLORED_FLOWER_PATCH_SEED);
  const out: ColoredFlowerPatchSpec[] = [];
  let guard = 0;
  while (out.length < PATCH_COUNT && guard++ < PATCH_COUNT * 45) {
    const x = (rand() - 0.5) * 2 * (HALF_X - MARGIN);
    const z =
      GRASS_BIOME_Z_MIN +
      MARGIN +
      rand() * (WORLD_MAX_Z - GRASS_BIOME_Z_MIN - 2 * MARGIN);
    if (Math.hypot(x, z) < MIN_DIST_FROM_SPAWN) continue;
    if (insideLake(x, z, 4)) continue;
    if (belowLakeWaterLine(x, z, 0.35)) continue;
    out.push({
      id: out.length,
      x,
      y: heightAt(x, z),
      z,
      rot: rand() * Math.PI * 2,
      scale: 0.78 + rand() * 0.32,
      variant: out.length % COLORED_FLOWER_VARIANT_COUNT,
    });
  }
  return out;
}

export const coloredFlowerPatches: ReadonlyArray<ColoredFlowerPatchSpec> =
  generate();
