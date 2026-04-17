import { HALF, heightAt, insideLake, mulberry32 } from "../../world/terrain";

export interface RatSpec {
  id: number;
  x: number;
  y: number;
  z: number;
  rot: number;
  scale: number;
  animPhase: number;
  animSpeed: number;
}

const RAT_COUNT = 6;
const RAT_SEED = 92011;
const MIN_DIST_FROM_SPAWN = 7;
const MARGIN = 6;

function generate(): RatSpec[] {
  const rand = mulberry32(RAT_SEED);
  const out: RatSpec[] = [];
  let guard = 0;
  while (out.length < RAT_COUNT && guard++ < RAT_COUNT * 25) {
    const x = (rand() - 0.5) * 2 * (HALF - MARGIN);
    const z = (rand() - 0.5) * 2 * (HALF - MARGIN);
    if (Math.hypot(x, z) < MIN_DIST_FROM_SPAWN) continue;
    if (insideLake(x, z, 2.2)) continue;
    out.push({
      id: out.length,
      x,
      y: heightAt(x, z),
      z,
      rot: rand() * Math.PI * 2,
      scale: 0.85 + rand() * 0.35,
      animPhase: rand(),
      animSpeed: 0.65 + rand() * 0.55,
    });
  }
  return out;
}

export const rats: ReadonlyArray<RatSpec> = generate();
