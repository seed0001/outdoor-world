import { HALF_X, WORLD_MIN_Z, heightAt, mulberry32 } from "../../world/terrain";
import {
  DESERT_GLB_TREE_PLACEMENT_SEED,
  DESERT_TREE_PLACEMENT_SEED,
} from "./worldSeed";

export interface DesertTreeSpec {
  id: number;
  x: number;
  y: number;
  z: number;
  scale: number;
  rot: number;
}

/** South of the grass/temperate tree line, spread through the dune belt. */
const DESERT_Z_MAX = -95;
const DESERT_TREE_COUNT = 52;
const MARGIN = 8;
const MIN_DIST_FROM_SPAWN = 10;

function generate(): DesertTreeSpec[] {
  const rand = mulberry32(DESERT_TREE_PLACEMENT_SEED);
  const out: DesertTreeSpec[] = [];
  let guard = 0;
  while (out.length < DESERT_TREE_COUNT && guard++ < DESERT_TREE_COUNT * 40) {
    const x = (rand() - 0.5) * 2 * (HALF_X - MARGIN);
    const z =
      WORLD_MIN_Z +
      MARGIN +
      rand() * (DESERT_Z_MAX - WORLD_MIN_Z - 2 * MARGIN);
    if (Math.hypot(x, z) < MIN_DIST_FROM_SPAWN) continue;
    const id = out.length;
    const scale = 0.72 + rand() * 0.55;
    out.push({
      id,
      x,
      y: heightAt(x, z),
      z,
      scale,
      rot: rand() * Math.PI * 2,
    });
  }
  return out;
}

export const desertTrees: ReadonlyArray<DesertTreeSpec> = generate();

const DESERT_GLB_TREE_COUNT = 28;

function generateGlb(): DesertTreeSpec[] {
  const rand = mulberry32(DESERT_GLB_TREE_PLACEMENT_SEED);
  const out: DesertTreeSpec[] = [];
  let guard = 0;
  while (out.length < DESERT_GLB_TREE_COUNT && guard++ < DESERT_GLB_TREE_COUNT * 40) {
    const x = (rand() - 0.5) * 2 * (HALF_X - MARGIN);
    const z =
      WORLD_MIN_Z +
      MARGIN +
      rand() * (DESERT_Z_MAX - WORLD_MIN_Z - 2 * MARGIN);
    if (Math.hypot(x, z) < MIN_DIST_FROM_SPAWN) continue;
    const id = out.length;
    const scale = 0.68 + rand() * 0.62;
    out.push({
      id,
      x,
      y: heightAt(x, z),
      z,
      scale,
      rot: rand() * Math.PI * 2,
    });
  }
  return out;
}

/** Additional `tree.glb` props in the dune band (see `DesertTrees` GLB branch). */
export const desertGlbTrees: ReadonlyArray<DesertTreeSpec> = generateGlb();
