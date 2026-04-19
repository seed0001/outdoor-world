import {
  LAKE_CENTER_X,
  LAKE_CENTER_Z,
  LAKE_OUTER_R,
  LAKE_WATER_Y,
  heightAt,
  mulberry32,
} from "../../world/terrain";
import { FROG_PLACEMENT_SEED } from "./worldSeed";

export interface FrogSpec {
  id: number;
  x: number;
  y: number;
  z: number;
  scale: number;
  phase: number;
  rotY: number;
}

const FROG_COUNT = 16;

function generate(): FrogSpec[] {
  const rand = mulberry32(FROG_PLACEMENT_SEED);
  const out: FrogSpec[] = [];
  let attempts = 0;

  while (out.length < FROG_COUNT && attempts < 500) {
    attempts++;
    const angle = rand() * Math.PI * 2;
    // Shore band: just inside water edge to just outside lake rim
    const r = LAKE_OUTER_R - 3.0 + rand() * 6.0;
    const x = LAKE_CENTER_X + Math.cos(angle) * r;
    const z = LAKE_CENTER_Z + Math.sin(angle) * r;
    const terrainY = heightAt(x, z);
    // Only place on gentle shore (avoid deep lake floor or steep hills)
    if (terrainY < -1.6 || terrainY > 1.4) continue;
    const y = Math.max(terrainY, LAKE_WATER_Y + 0.04);
    out.push({
      id: out.length,
      x,
      y,
      z,
      scale: 0.7 + rand() * 0.6,
      phase: rand(),
      rotY: rand() * Math.PI * 2,
    });
  }
  return out;
}

export const frogs: ReadonlyArray<FrogSpec> = generate();
