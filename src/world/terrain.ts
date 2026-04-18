export const WORLD_SIZE_X = 200;
/** East/west half-extent (legacy `HALF` is this value). */
export const HALF_X = WORLD_SIZE_X / 2;
/** @deprecated Prefer HALF_X — kept for existing imports that mean “half width”. */
export const HALF = HALF_X;

/** World extends further south (negative Z) into a desert biome. */
export const WORLD_MIN_Z = -300;
export const WORLD_MAX_Z = 100;
export const WORLD_SIZE_Z = WORLD_MAX_Z - WORLD_MIN_Z;
/** Ground mesh is offset so local geometry still spans the same X range. */
export const WORLD_CENTER_Z = (WORLD_MIN_Z + WORLD_MAX_Z) / 2;

export const WORLD_SEGMENTS = 128;
export const WORLD_SEGMENTS_Z = 160;

// Lake geometry — a bowl carved into the terrain (temperate region only).
export const LAKE_CENTER_X = -28;
export const LAKE_CENTER_Z = 22;
export const LAKE_OUTER_R = 22;
export const LAKE_INNER_R = 10;
export const LAKE_WATER_Y = -0.3;
export const LAKE_FLOOR_Y = -2.8;

/** North of this Z: trees, lake ecology, flowers (roughly above desert transition). */
export const GRASS_BIOME_Z_MIN = -88;

/**
 * 0 = temperate grass, 1 = full desert. Smooth band crossing “south” into the new map.
 */
export function desertBiomeBlend(z: number): number {
  if (z > -105) return 0;
  return smoothstep(-105, -178, z);
}

function heightGrassland(x: number, z: number): number {
  const a = Math.sin(x * 0.04) * Math.cos(z * 0.05) * 2.2;
  const b = Math.sin(x * 0.09 + 1.3) * Math.cos(z * 0.07 + 2.1) * 1.1;
  const c = Math.sin(x * 0.17 + 0.5) * Math.cos(z * 0.21 - 1.7) * 0.4;
  const d = Math.sin((x + z) * 0.02) * 0.6;
  let h = a + b + c + d;

  const lakeDx = x - LAKE_CENTER_X;
  const lakeDz = z - LAKE_CENTER_Z;
  const lakeDist = Math.hypot(lakeDx, lakeDz);
  if (lakeDist < LAKE_OUTER_R) {
    const t = smoothstep(LAKE_OUTER_R, LAKE_INNER_R, lakeDist);
    h = lerp(h, LAKE_FLOOR_Y, t);
  }
  return h;
}

/** Dunes / ergs — lower frequency, warmer base than grass hills. */
function heightDesert(x: number, z: number): number {
  const a = Math.sin(x * 0.052) * Math.cos(z * 0.045) * 3.1;
  const b = Math.sin(x * 0.088 + 1.9) * Math.cos(z * 0.062 + 0.8) * 1.55;
  const c = Math.sin((x + z * 0.62) * 0.032) * 2.4;
  const d = Math.sin((x * 0.7 - z) * 0.018) * 0.85;
  return a + b + c + d + 0.55;
}

/**
 * Cheap multi-octave heightfield: temperate north, desert south, blended across a wide edge.
 */
export function heightAt(x: number, z: number): number {
  const grass = heightGrassland(x, z);
  const desert = heightDesert(x, z);
  const t = desertBiomeBlend(z);
  return lerp(grass, desert, t);
}

/**
 * Intersect a world ray with the analytic heightfield {@link heightAt}.
 * Returns a point on the surface, or null if the ray stays above terrain within `maxDist`.
 */
export function terrainRayHit(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
): { x: number; y: number; z: number } | null {
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-8) return null;
  const ndx = dx / len;
  const ndy = dy / len;
  const ndz = dz / len;
  const STEPS = 112;
  for (let i = 1; i <= STEPS; i++) {
    const t = (i / STEPS) * maxDist;
    const px = ox + ndx * t;
    const py = oy + ndy * t;
    const pz = oz + ndz * t;
    const h = heightAt(px, pz);
    if (py <= h + 0.35) {
      return { x: px, y: h, z: pz };
    }
  }
  return null;
}

/** True when (x,z) is inside the lake disk (plus optional buffer). */
export function insideLake(x: number, z: number, buffer = 0): boolean {
  const dx = x - LAKE_CENTER_X;
  const dz = z - LAKE_CENTER_Z;
  return Math.hypot(dx, dz) < LAKE_OUTER_R + buffer;
}

/** True when terrain height is below the water surface (flower/tree placement). */
export function belowLakeWaterLine(x: number, z: number, margin = 0.2): boolean {
  return heightAt(x, z) < LAKE_WATER_Y + margin;
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
