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
}

const SCATTER_ROCK_COUNT = 45;
const FORMATION_CLUSTER_COUNT = 6;
const MIN_DIST_FROM_SPAWN = 4;
const SCATTER_SEED = 7332;
const FORMATION_SEED = 9912;
const MARGIN = 2;
export const FORMATION_ROCK_ID_BASE = 1000;

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
  const centers: { x: number; z: number }[] = [];
  const out: RockSpec[] = [];
  let id = FORMATION_ROCK_ID_BASE;
  let guard = 0;

  while (centers.length < FORMATION_CLUSTER_COUNT && guard++ < 200) {
    const cx = (rand() - 0.5) * 2 * (HALF_X - 18);
    const cz =
      WORLD_MIN_Z +
      MARGIN +
      18 +
      rand() * (WORLD_MAX_Z - WORLD_MIN_Z - 2 * MARGIN - 36);
    if (Math.hypot(cx, cz) < 28) continue;
    if (insideLake(cx, cz, 10)) continue;
    if (nearSnakeDen(cx, cz, 4)) continue;
    if (centers.some((c) => Math.hypot(c.x - cx, c.z - cz) < 42)) continue;

    centers.push({ x: cx, z: cz });
    const boulderCount = 3 + Math.floor(rand() * 3);
    let baseY = heightAt(cx, cz);

    for (let i = 0; i < boulderCount; i++) {
      const angle = (i / boulderCount) * Math.PI * 2 + rand() * 0.65;
      const dist = (0.35 + rand() * 0.75) * (2.4 + i * 0.35);
      const x = cx + Math.cos(angle) * dist;
      const z = cz + Math.sin(angle) * dist;
      const groundY = heightAt(x, z);
      const scale = 1.85 + rand() * 2.35;
      const stackLift = i > 0 && rand() < 0.55 ? scale * (0.22 + rand() * 0.28) : 0;

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
