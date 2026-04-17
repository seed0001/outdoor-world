import { HALF, heightAt, insideLake, mulberry32 } from "../../world/terrain";
import { nearSnakeDen } from "./snakeDen";

export interface ScorpionSpec {
  id: number;
  x: number;
  y: number;
  z: number;
  rot: number;
  scale: number;
  /** Animation phase 0..1 */
  phase: number;
}

const SCORPION_COUNT = 10;
const SCORPION_SEED = 44077;
const MIN_DIST_FROM_SPAWN = 8;
const MARGIN = 5;

function generate(): ScorpionSpec[] {
  const rand = mulberry32(SCORPION_SEED);
  const out: ScorpionSpec[] = [];
  let guard = 0;
  while (out.length < SCORPION_COUNT && guard++ < SCORPION_COUNT * 30) {
    const x = (rand() - 0.5) * 2 * (HALF - MARGIN);
    const z = (rand() - 0.5) * 2 * (HALF - MARGIN);
    if (Math.hypot(x, z) < MIN_DIST_FROM_SPAWN) continue;
    if (insideLake(x, z, 2.5)) continue;
    if (nearSnakeDen(x, z, 0)) continue;
    out.push({
      id: out.length,
      x,
      y: heightAt(x, z),
      z,
      rot: rand() * Math.PI * 2,
      scale: 0.75 + rand() * 0.45,
      phase: rand(),
    });
  }
  return out;
}

export const scorpions: ReadonlyArray<ScorpionSpec> = generate();
