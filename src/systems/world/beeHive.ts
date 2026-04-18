import { trees } from "./treeRegistry";
import { BEE_PLACEMENT_SEED } from "./worldSeed";

/**
 * One deterministic standing tree hosts the bee colony (same world every load).
 */
export interface BeeHiveInfo {
  treeId: number;
  x: number;
  y: number;
  z: number;
  trunkHeight: number;
  foliageHeight: number;
}

function computeHive(): BeeHiveInfo {
  if (trees.length === 0) {
    return {
      treeId: 0,
      x: 0,
      y: 0,
      z: 0,
      trunkHeight: 2.2,
      foliageHeight: 2,
    };
  }
  const start =
    ((BEE_PLACEMENT_SEED * 31337 + 1021) >>> 0) % trees.length;
  for (let k = 0; k < trees.length; k++) {
    const t = trees[(start + k) % trees.length];
    if (Math.hypot(t.x, t.z) >= 7) {
      return {
        treeId: t.id,
        x: t.x,
        y: t.y,
        z: t.z,
        trunkHeight: t.trunkHeight,
        foliageHeight: t.foliageHeight,
      };
    }
  }
  const t = trees[start];
  return {
    treeId: t.id,
    x: t.x,
    y: t.y,
    z: t.z,
    trunkHeight: t.trunkHeight,
    foliageHeight: t.foliageHeight,
  };
}

export const beeHiveInfo: BeeHiveInfo = computeHive();
