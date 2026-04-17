export const WORLD_SIZE = 200;
export const WORLD_SEGMENTS = 128;
export const HALF = WORLD_SIZE / 2;

// Lake geometry — a bowl carved into the terrain.
export const LAKE_CENTER_X = -28;
export const LAKE_CENTER_Z = 22;
export const LAKE_OUTER_R = 22;
export const LAKE_INNER_R = 10;
export const LAKE_WATER_Y = -0.3;
export const LAKE_FLOOR_Y = -2.8;

/**
 * Cheap multi-octave pseudo-noise built from sin/cos. Good enough for
 * gentle rolling hills without pulling in a noise library. Deterministic
 * and continuous (C1), so normals behave. After the base heightfield we
 * carve the lake bowl with a smoothstep falloff so tree/rock placement
 * and physics stay in sync with the water's disk.
 */
export function heightAt(x: number, z: number): number {
  const a = Math.sin(x * 0.04) * Math.cos(z * 0.05) * 2.2;
  const b = Math.sin(x * 0.09 + 1.3) * Math.cos(z * 0.07 + 2.1) * 1.1;
  const c = Math.sin(x * 0.17 + 0.5) * Math.cos(z * 0.21 - 1.7) * 0.4;
  const d = Math.sin((x + z) * 0.02) * 0.6;
  let h = a + b + c + d;

  const lakeDx = x - LAKE_CENTER_X;
  const lakeDz = z - LAKE_CENTER_Z;
  const lakeDist = Math.hypot(lakeDx, lakeDz);
  if (lakeDist < LAKE_OUTER_R) {
    // t = 1 at centre, 0 at outer rim; inverted smoothstep.
    const t = smoothstep(LAKE_OUTER_R, LAKE_INNER_R, lakeDist);
    h = lerp(h, LAKE_FLOOR_Y, t);
  }
  return h;
}

/** True when (x,z) is inside the lake disk (plus optional buffer). */
export function insideLake(x: number, z: number, buffer = 0): boolean {
  const dx = x - LAKE_CENTER_X;
  const dz = z - LAKE_CENTER_Z;
  return Math.hypot(dx, dz) < LAKE_OUTER_R + buffer;
}

/** Seeded 32-bit PRNG. Stable across reloads for a given seed. */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
