import { HALF, heightAt, insideLake, mulberry32 } from "../../world/terrain";
import { nearSnakeDen } from "./snakeDen";

export interface TreeSpec {
  id: number;
  x: number;
  y: number;
  z: number;
  scale: number;
  rot: number;
  trunkHeight: number;
  foliageHeight: number;
  foliageRadius: number;
  trunkRadius: number;
  phase: number;
}

const TREE_COUNT = 180;
const MIN_DIST_FROM_SPAWN = 6;
const TREE_SEED = 1337;
const MARGIN = 4;
const LAKE_SHORE_BUFFER = 1.8;

function generate(): TreeSpec[] {
  const rand = mulberry32(TREE_SEED);
  const out: TreeSpec[] = [];
  let guard = 0;
  while (out.length < TREE_COUNT && guard++ < TREE_COUNT * 30) {
    const x = (rand() - 0.5) * 2 * (HALF - MARGIN);
    const z = (rand() - 0.5) * 2 * (HALF - MARGIN);
    if (Math.hypot(x, z) < MIN_DIST_FROM_SPAWN) continue;
    if (insideLake(x, z, LAKE_SHORE_BUFFER)) continue;
    if (nearSnakeDen(x, z, 0)) continue;
    const scale = 0.8 + rand() * 0.9;
    const trunkHeight = 1.6 * scale;
    const foliageHeight = (2.2 + rand() * 1.2) * scale;
    const foliageRadius = (1.0 + rand() * 0.6) * scale;
    out.push({
      id: out.length,
      x,
      y: heightAt(x, z),
      z,
      scale,
      rot: rand() * Math.PI * 2,
      trunkHeight,
      foliageHeight,
      foliageRadius,
      trunkRadius: 0.35 * scale,
      phase: rand(),
    });
  }
  return out;
}

export const trees: ReadonlyArray<TreeSpec> = generate();
