import { HALF, heightAt, insideLake, mulberry32 } from "../../world/terrain";

export interface SnakeSpec {
  id: number;
  x: number;
  y: number;
  z: number;
  rot: number;
  scale: number;
  animPhase: number;
  animSpeed: number;
}

const SNAKE_COUNT = 5;
const SNAKE_SEED = 4207;
const MIN_DIST_FROM_SPAWN = 8;
const MARGIN = 6;

function generate(): SnakeSpec[] {
  const rand = mulberry32(SNAKE_SEED);
  const out: SnakeSpec[] = [];
  let guard = 0;
  while (out.length < SNAKE_COUNT && guard++ < SNAKE_COUNT * 20) {
    const x = (rand() - 0.5) * 2 * (HALF - MARGIN);
    const z = (rand() - 0.5) * 2 * (HALF - MARGIN);
    if (Math.hypot(x, z) < MIN_DIST_FROM_SPAWN) continue;
    if (insideLake(x, z, 2.5)) continue;
    out.push({
      id: out.length,
      x,
      y: heightAt(x, z),
      z,
      rot: rand() * Math.PI * 2,
      scale: 0.9 + rand() * 0.4,
      animPhase: rand(),
      animSpeed: 0.7 + rand() * 0.5,
    });
  }
  return out;
}

export const snakes: ReadonlyArray<SnakeSpec> = generate();
