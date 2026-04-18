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
  /** Dominant mineral when this rock is broken into pickups. */
  mineralVein: MineralKind;
}

const ROCK_COUNT = 45;
const MIN_DIST_FROM_SPAWN = 4;
const ROCK_SEED = 7332;
const MARGIN = 2;

function generate(): RockSpec[] {
  const rand = mulberry32(ROCK_SEED);
  const out: RockSpec[] = [];
  let guard = 0;
  while (out.length < ROCK_COUNT && guard++ < ROCK_COUNT * 20) {
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
      mineralVein: mineralVeinFromRockId(id),
    });
  }
  return out;
}

export const rocks: ReadonlyArray<RockSpec> = generate();
