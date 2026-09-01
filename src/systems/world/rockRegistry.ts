import {
  HALF_X,
  WORLD_MIN_Z,
  WORLD_MAX_Z,
  heightAt,
  insideLake,
  mulberry32,
} from "../../world/terrain";
import { nearSnakeDen } from "./snakeDen";
import { mineralVeinFromRockId, type MineralKind } from "./mineralRegistry";

export type RockRole = "scatter" | "formation";

/** RGB components 0–1; formations use this instead of mineral vein tinting. */
export type FormationRockColor = [number, number, number];

export interface RockSpec {
  id: number;
  x: number;
  y: number;
  z: number;
  scale: number;
  rx: number;
  ry: number;
  rz: number;
  shade: number;
  role: RockRole;
  /** Dominant mineral when this rock is broken into pickups (scatter only). */
  mineralVein: MineralKind;
  /** Grey/brown tint for formation boulders. */
  formationColor?: FormationRockColor;
}

const SCATTER_ROCK_COUNT = 45;
const FORMATION_CLUSTER_COUNT = 12;
const MIN_DIST_FROM_SPAWN = 4;
const SCATTER_SEED = 7332;
const FORMATION_SEED = 9912;
const MARGIN = 2;
export const FORMATION_ROCK_ID_BASE = 1000;

/** Size tiers from current “large” up through three bigger classes. */
const FORMATION_SIZE_TIERS = [
  { scaleMin: 0.45, scaleRange: 0.55, boulders: [2, 4] as const, spread: 1.6, lakePad: 10, spacing: 26 },
  { scaleMin: 0.65, scaleRange: 0.65, boulders: [3, 5] as const, spread: 2.0, lakePad: 14, spacing: 34 },
  { scaleMin: 0.85, scaleRange: 0.75, boulders: [4, 7] as const, spread: 2.6, lakePad: 18, spacing: 42 },
  { scaleMin: 1.1, scaleRange: 0.9, boulders: [5, 9] as const, spread: 3.3, lakePad: 24, spacing: 52 },
] as const;

function randomFormationColor(rand: () => number): FormationRockColor {
  const grey = rand() < 0.52;
  const brightness = 0.32 + rand() * 0.48;
  if (grey) {
    const cool = 0.9 + rand() * 0.1;
    return [brightness * cool, brightness, brightness * (0.94 + rand() * 0.06)];
  }
  return [
    brightness * (0.95 + rand() * 0.18),
    brightness * (0.68 + rand() * 0.16),
    brightness * (0.38 + rand() * 0.14),
  ];
}

function generateScatter(): RockSpec[] {
  const rand = mulberry32(SCATTER_SEED);
  const out: RockSpec[] = [];
  let guard = 0;
  while (out.length < SCATTER_ROCK_COUNT && guard++ < SCATTER_ROCK_COUNT * 24) {
    const x = (rand() - 0.5) * 2 * (HALF_X - MARGIN);
    const z =
      WORLD_MIN_Z +
      MARGIN +
      rand() * (WORLD_MAX_Z - WORLD_MIN_Z - 2 * MARGIN);
    if (Math.hypot(x, z) < MIN_DIST_FROM_SPAWN) continue;
    if (insideLake(x, z, 1.2)) continue;
    if (nearSnakeDen(x, z, 0)) continue;
    const id = out.length;
    out.push({
      id,
      x,
      y: heightAt(x, z),
      z,
      scale: 0.35 + rand() * 1.0,
      rx: rand() * Math.PI * 2,
      ry: rand() * Math.PI * 2,
      rz: rand() * Math.PI * 2,
      shade: 0.65 + rand() * 0.35,
      role: "scatter",
      mineralVein: mineralVeinFromRockId(id),
    });
  }
  return out;
}

function generateFormations(): RockSpec[] {
  const rand = mulberry32(FORMATION_SEED);
  const centers: { x: number; z: number; spacing: number }[] = [];
  const out: RockSpec[] = [];
  let id = FORMATION_ROCK_ID_BASE;
  let guard = 0;

  while (centers.length < FORMATION_CLUSTER_COUNT && guard++ < 800) {
    const tierIdx = Math.floor(rand() * FORMATION_SIZE_TIERS.length);
    const tier = FORMATION_SIZE_TIERS[tierIdx];
    const cx = (rand() - 0.5) * 2 * (HALF_X - 22);
    const cz =
      WORLD_MIN_Z +
      MARGIN +
      22 +
      rand() * (WORLD_MAX_Z - WORLD_MIN_Z - 2 * MARGIN - 44);
    if (Math.hypot(cx, cz) < 30) continue;
    if (insideLake(cx, cz, tier.lakePad)) continue;
    if (nearSnakeDen(cx, cz, 4 + tierIdx)) continue;
    if (
      centers.some(
        (c) => Math.hypot(c.x - cx, c.z - cz) < Math.max(c.spacing, tier.spacing),
      )
    ) {
      continue;
    }

    centers.push({ x: cx, z: cz, spacing: tier.spacing });
    const boulderCount =
      tier.boulders[0] + Math.floor(rand() * (tier.boulders[1] - tier.boulders[0] + 1));
    const clusterColor = randomFormationColor(rand);
    let baseY = heightAt(cx, cz);

    for (let i = 0; i < boulderCount; i++) {
      const angle = (i / boulderCount) * Math.PI * 2 + rand() * 0.85;
      const ring = Math.floor(i / 5);
      const dist =
        (0.32 + rand() * 0.78) * (tier.spread + ring * 1.15 + (i % 5) * 0.28);
      const x = cx + Math.cos(angle) * dist;
      const z = cz + Math.sin(angle) * dist;
      const groundY = heightAt(x, z);
      const scale = tier.scaleMin + rand() * tier.scaleRange;
      const stackLift = i > 0 && rand() < 0.55 ? scale * (0.22 + rand() * 0.28) : 0;
      const shadeJitter = 0.88 + rand() * 0.24;
      const formationColor: FormationRockColor = [
        Math.min(1, clusterColor[0] * shadeJitter),
        Math.min(1, clusterColor[1] * shadeJitter),
        Math.min(1, clusterColor[2] * shadeJitter),
      ];

      out.push({
        id: id++,
        x,
        y: Math.max(groundY, baseY - 0.4) + stackLift,
        z,
        scale,
        rx: rand() * Math.PI * 2,
        ry: rand() * Math.PI * 2,
        rz: rand() * Math.PI * 2,
        shade: 0.58 + rand() * 0.28,
        role: "formation",
        mineralVein: mineralVeinFromRockId(id),
        formationColor,
      });

      baseY = Math.max(baseY, groundY + scale * 0.35);
    }
  }

  return out;
}

export const scatterRocks: ReadonlyArray<RockSpec> = generateScatter();
export const formationRocks: ReadonlyArray<RockSpec> = generateFormations();
/** All placed rocks (scatter + formations) for world counts. */
export const rocks: ReadonlyArray<RockSpec> = [...scatterRocks, ...formationRocks];

export function isFormationRockId(id: number): boolean {
  return id >= FORMATION_ROCK_ID_BASE;
}

/** Mining hits scale with boulder size (scatter rocks only). */
export function scatterRockMineHits(scale: number): number {
  if (scale < 0.5) return 2;
  if (scale < 0.72) return 3;
  return 4;
}
