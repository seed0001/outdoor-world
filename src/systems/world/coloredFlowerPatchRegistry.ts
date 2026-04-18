import {
  HALF,
  heightAt,
  belowLakeWaterLine,
  insideLake,
  mulberry32,
} from "../../world/terrain";
import { COLORED_FLOWER_PATCH_SEED } from "./worldSeed";

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

const PATCH_COUNT = 6;
const MARGIN = 5;
const MIN_DIST_FROM_SPAWN = 7;

function generate(): ColoredFlowerPatchSpec[] {
  const rand = mulberry32(COLORED_FLOWER_PATCH_SEED);
  const out: ColoredFlowerPatchSpec[] = [];
  let guard = 0;
  while (out.length < PATCH_COUNT && guard++ < PATCH_COUNT * 45) {
    const x = (rand() - 0.5) * 2 * (HALF - MARGIN);
    const z = (rand() - 0.5) * 2 * (HALF - MARGIN);
    if (Math.hypot(x, z) < MIN_DIST_FROM_SPAWN) continue;
    if (insideLake(x, z, 4)) continue;
    if (belowLakeWaterLine(x, z, 0.35)) continue;
    out.push({
      id: out.length,
      x,
      y: heightAt(x, z),
      z,
      rot: rand() * Math.PI * 2,
      scale: 0.85 + rand() * 0.45,
      variant: out.length % 6,
    });
  }
  return out;
}

export const coloredFlowerPatches: ReadonlyArray<ColoredFlowerPatchSpec> =
  generate();
