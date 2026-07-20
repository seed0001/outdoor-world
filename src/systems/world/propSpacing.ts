import type { RockSpec } from "./rockRegistry";

export type PlacementCircle = { x: number; z: number; radius: number };

export function treeClearanceRadius(
  foliageRadius: number,
  trunkRadius: number,
): number {
  return Math.max(foliageRadius, trunkRadius * 1.6) + 0.45;
}

export function desertTreeClearanceRadius(scale: number): number {
  return 1.1 * scale + 0.55;
}

export function scatterRockClearanceRadius(rock: RockSpec): number {
  return rock.scale * 0.92 + 0.35;
}

export function formationRockClearanceRadius(rock: RockSpec): number {
  return rock.scale * 1.05 + 0.55;
}

export function rockClearanceRadius(rock: RockSpec): number {
  return rock.role === "formation"
    ? formationRockClearanceRadius(rock)
    : scatterRockClearanceRadius(rock);
}

export function circlesOverlap(
  ax: number,
  az: number,
  ar: number,
  bx: number,
  bz: number,
  br: number,
  pad = 0.35,
): boolean {
  return Math.hypot(ax - bx, az - bz) < ar + br + pad;
}

export function overlapsAny(
  x: number,
  z: number,
  radius: number,
  others: readonly PlacementCircle[],
  pad = 0.35,
): boolean {
  for (const o of others) {
    if (circlesOverlap(x, z, radius, o.x, o.z, o.radius, pad)) return true;
  }
  return false;
}

export function rocksToCircles(rocks: readonly RockSpec[]): PlacementCircle[] {
  return rocks.map((r) => ({ x: r.x, z: r.z, radius: rockClearanceRadius(r) }));
}

export function desertTreesToCircles(
  trees: readonly { x: number; z: number; scale: number }[],
): PlacementCircle[] {
  return trees.map((t) => ({
    x: t.x,
    z: t.z,
    radius: desertTreeClearanceRadius(t.scale),
  }));
}
