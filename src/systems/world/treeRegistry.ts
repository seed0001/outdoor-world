import { HALF, heightAt, insideLake, mulberry32 } from "../../world/terrain";
import { nearSnakeDen } from "./snakeDen";

/**
 * 0 oak · 1 pine · 2 birch · 3 elm (spreading round crown).
 * Material behavior (season / time / temperature) lives in `woodEcology.ts`.
 */
export type TreeKind = 0 | 1 | 2 | 3;

export interface TreeSpec {
  id: number;
  kind: TreeKind;
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

const TREE_SEED = 1338;

/** Deterministic kind from id so placement RNG stream is unchanged vs older builds. */
function kindFromId(id: number): TreeKind {
  return (((id * 1103515245 + TREE_SEED) >>> 0) % 4) as TreeKind;
}

function applyKindProfile(
  kind: TreeKind,
  base: {
    trunkHeight: number;
    foliageHeight: number;
    foliageRadius: number;
    trunkRadius: number;
  },
): { trunkHeight: number; foliageHeight: number; foliageRadius: number; trunkRadius: number } {
  switch (kind) {
    case 1: // pine — tall, narrow crown
      return {
        trunkHeight: base.trunkHeight * 1.22,
        foliageHeight: base.foliageHeight * 1.18,
        foliageRadius: base.foliageRadius * 0.52,
        trunkRadius: base.trunkRadius * 0.68,
      };
    case 2: // birch — pale, slim trunk, smaller crown
      return {
        trunkHeight: base.trunkHeight * 1.38,
        foliageHeight: base.foliageHeight * 0.82,
        foliageRadius: base.foliageRadius * 0.58,
        trunkRadius: base.trunkRadius * 0.48,
      };
    case 3: // elm — wide, low crown
      return {
        trunkHeight: base.trunkHeight * 0.9,
        foliageHeight: base.foliageHeight * 0.78,
        foliageRadius: base.foliageRadius * 1.32,
        trunkRadius: base.trunkRadius * 1.05,
      };
    default: // oak — balanced
      return { ...base };
  }
}

const TREE_COUNT = 180;
const MIN_DIST_FROM_SPAWN = 6;
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
    const baseTrunk = 1.6 * scale;
    const baseFoliageH = (2.2 + rand() * 1.2) * scale;
    const baseFoliageR = (1.0 + rand() * 0.6) * scale;
    const baseTrunkR = 0.35 * scale;
    const id = out.length;
    const kind = kindFromId(id);
    const shaped = applyKindProfile(kind, {
      trunkHeight: baseTrunk,
      foliageHeight: baseFoliageH,
      foliageRadius: baseFoliageR,
      trunkRadius: baseTrunkR,
    });
    out.push({
      id,
      kind,
      x,
      y: heightAt(x, z),
      z,
      scale,
      rot: rand() * Math.PI * 2,
      trunkHeight: shaped.trunkHeight,
      foliageHeight: shaped.foliageHeight,
      foliageRadius: shaped.foliageRadius,
      trunkRadius: shaped.trunkRadius,
      phase: rand(),
    });
  }
  return out;
}

export const trees: ReadonlyArray<TreeSpec> = generate();
