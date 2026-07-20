import { flowers } from "./flowerRegistry";
import { coloredFlowerPatches } from "./coloredFlowerPatchRegistry";
import { roseFlowers } from "./roseFlowerRegistry";
import { worldState, type FlowerGatherKind } from "./worldState";
import type { InventoryItem } from "../player/inventory";
import {
  COLORED_FLOWER_PETAL_COLORS,
  ROSE_CHIP_COLORS,
  WILDFLOWER_CHIP_COLORS,
} from "../../world/coloredFlowerAssets";

export type { FlowerGatherKind };

export type FlowerPickHit = {
  kind: FlowerGatherKind;
  id: number;
  t: number;
  position: { x: number; y: number; z: number };
  chipColors: readonly string[];
};

function flowerKey(kind: FlowerGatherKind, id: number): string {
  return `${kind}:${id}`;
}

/** Closest point on ray to a target; returns distance along ray + miss distance. */
function rayClosestApproach(
  ox: number,
  oy: number,
  oz: number,
  ndx: number,
  ndy: number,
  ndz: number,
  px: number,
  py: number,
  pz: number,
  maxDist: number,
): { t: number; miss: number } | null {
  const lx = px - ox;
  const ly = py - oy;
  const lz = pz - oz;
  const t = lx * ndx + ly * ndy + lz * ndz;
  if (t < 0 || t > maxDist) return null;
  const mx = lx - ndx * t;
  const my = ly - ndy * t;
  const mz = lz - ndz * t;
  return { t, miss: Math.hypot(mx, my, mz) };
}

function pickFlowerTarget(
  ox: number,
  oy: number,
  oz: number,
  ndx: number,
  ndy: number,
  ndz: number,
  px: number,
  py: number,
  pz: number,
  pickRadius: number,
  maxDist: number,
): number | null {
  const hit = rayClosestApproach(ox, oy, oz, ndx, ndy, ndz, px, py, pz, maxDist);
  if (!hit || hit.miss > pickRadius) return null;
  return hit.t;
}

function pickWildflower(
  ox: number,
  oy: number,
  oz: number,
  ndx: number,
  ndy: number,
  ndz: number,
  fx: number,
  fy: number,
  fz: number,
  scale: number,
  maxDist: number,
): number | null {
  const pickR = 0.85 * scale + 0.7;
  let bestT: number | null = null;

  // Daisies are ground billboards — test where the view ray meets the stem base.
  const groundHeights = [fy + 0.06 * scale, fy + 0.28 * scale, fy + 0.48 * scale];
  for (const ty of groundHeights) {
    if (Math.abs(ndy) < 0.035) continue;
    const t = (ty - oy) / ndy;
    if (t <= 0 || t > maxDist) continue;
    const hx = ox + ndx * t;
    const hz = oz + ndz * t;
    if (Math.hypot(hx - fx, hz - fz) <= pickR && (bestT === null || t < bestT)) {
      bestT = t;
    }
  }

  const blossomT = pickFlowerTarget(
    ox,
    oy,
    oz,
    ndx,
    ndy,
    ndz,
    fx,
    fy + 0.45 * scale,
    fz,
    pickR,
    maxDist,
  );
  if (blossomT !== null && (bestT === null || blossomT < bestT)) bestT = blossomT;

  return bestT;
}

/** True when a flower swing should beat a physics chop target. */
export function flowerGatherWins(
  flower: FlowerPickHit,
  physicsDist: number | null,
): boolean {
  if (physicsDist === null) return true;
  if (flower.kind === "wildflower") {
    // Daisies sit at ankle height; only block when a choppable is clearly in front.
    return physicsDist > flower.t - 0.85;
  }
  return flower.t <= physicsDist + 0.35;
}

function wildflowerChipColors(): readonly string[] {
  return WILDFLOWER_CHIP_COLORS;
}

function petalPatchChipColors(variant: number): readonly string[] {
  const base =
    COLORED_FLOWER_PETAL_COLORS[
      ((variant % COLORED_FLOWER_PETAL_COLORS.length) +
        COLORED_FLOWER_PETAL_COLORS.length) %
        COLORED_FLOWER_PETAL_COLORS.length
    ];
  const i = variant % COLORED_FLOWER_PETAL_COLORS.length;
  const a = COLORED_FLOWER_PETAL_COLORS[i];
  const b = COLORED_FLOWER_PETAL_COLORS[(i + 1) % COLORED_FLOWER_PETAL_COLORS.length];
  return [a, b, base];
}

function roseChipColors(): readonly string[] {
  return ROSE_CHIP_COLORS;
}

export function flowerInventoryItem(kind: FlowerGatherKind): InventoryItem {
  switch (kind) {
    case "wildflower":
      return "wildflower";
    case "petal_patch":
      return "petal_flower";
    case "rose":
      return "rose";
  }
}

export function rayPickFlower(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
): FlowerPickHit | null {
  const len = Math.hypot(dx, dy, dz) || 1;
  const ndx = dx / len;
  const ndy = dy / len;
  const ndz = dz / len;

  let best: FlowerPickHit | null = null;

  for (const f of flowers) {
    if (worldState.isFlowerHarvested("wildflower", f.id)) continue;
    const t = pickWildflower(ox, oy, oz, ndx, ndy, ndz, f.x, f.y, f.z, f.scale, maxDist);
    if (t === null) continue;
    if (!best || t < best.t) {
      best = {
        kind: "wildflower",
        id: f.id,
        t,
        position: {
          x: ox + ndx * t,
          y: oy + ndy * t,
          z: oz + ndz * t,
        },
        chipColors: wildflowerChipColors(),
      };
    }
  }

  for (const p of coloredFlowerPatches) {
    if (worldState.isFlowerHarvested("petal_patch", p.id)) continue;
    const py = p.y + 0.5 * p.scale;
    const pickR = 1.05 * p.scale + 0.45;
    const t = pickFlowerTarget(ox, oy, oz, ndx, ndy, ndz, p.x, py, p.z, pickR, maxDist);
    if (t === null) continue;
    if (!best || t < best.t) {
      best = {
        kind: "petal_patch",
        id: p.id,
        t,
        position: {
          x: ox + ndx * t,
          y: oy + ndy * t,
          z: oz + ndz * t,
        },
        chipColors: petalPatchChipColors(p.variant),
      };
    }
  }

  for (const r of roseFlowers) {
    if (worldState.isFlowerHarvested("rose", r.id)) continue;
    const py = r.y + 0.85 * r.scale;
    const pickR = 1.15 * r.scale + 0.5;
    const t = pickFlowerTarget(ox, oy, oz, ndx, ndy, ndz, r.x, py, r.z, pickR, maxDist);
    if (t === null) continue;
    if (!best || t < best.t) {
      best = {
        kind: "rose",
        id: r.id,
        t,
        position: {
          x: ox + ndx * t,
          y: oy + ndy * t,
          z: oz + ndz * t,
        },
        chipColors: roseChipColors(),
      };
    }
  }

  return best;
}

export function encodeFlowerKey(kind: FlowerGatherKind, id: number): string {
  return flowerKey(kind, id);
}
