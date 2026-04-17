import { HALF, heightAt, insideLake, mulberry32 } from "../../world/terrain";

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
}

const ROCK_COUNT = 45;
const MIN_DIST_FROM_SPAWN = 4;
const ROCK_SEED = 7331;
const MARGIN = 2;

function generate(): RockSpec[] {
  const rand = mulberry32(ROCK_SEED);
  const out: RockSpec[] = [];
  let guard = 0;
  while (out.length < ROCK_COUNT && guard++ < ROCK_COUNT * 20) {
    const x = (rand() - 0.5) * 2 * (HALF - MARGIN);
    const z = (rand() - 0.5) * 2 * (HALF - MARGIN);
    if (Math.hypot(x, z) < MIN_DIST_FROM_SPAWN) continue;
    if (insideLake(x, z, 1.2)) continue;
    out.push({
      id: out.length,
      x,
      y: heightAt(x, z),
      z,
      scale: 0.35 + rand() * 1.0,
      rx: rand() * Math.PI * 2,
      ry: rand() * Math.PI * 2,
      rz: rand() * Math.PI * 2,
      shade: 0.65 + rand() * 0.35,
    });
  }
  return out;
}

export const rocks: ReadonlyArray<RockSpec> = generate();
