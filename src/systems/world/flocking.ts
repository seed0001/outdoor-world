/**
 * Lightweight flocking helpers for small songbirds: cheap cohesion / separation /
 * target bias around a single flock anchor. Not a full boids solver — the flock
 * center is already steered by {@link birdState}.
 */

export type Vec3 = readonly [number, number, number];

export interface FlockMotionParams {
  /** Simulated time (world clock `simMs`) for phase evolution. */
  simMs: number;
  /** Flock-reported velocity (m/s), mainly for alignment hint. */
  flockVel: Vec3;
  /** World-space point the flock is steering toward. */
  target: Vec3;
  /** Flock anchor in world space. */
  center: Vec3;
  /** 0 = calm perch, 1 = active commute / wander. */
  agitation: number;
  /** When true, offsets stay tight (roost / shelter). */
  roosting: boolean;
}

const V_LEN = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);

const V_NORM = (v: Vec3): Vec3 => {
  const L = V_LEN(v);
  if (L < 1e-6) return [0, 0, 0];
  return [v[0] / L, v[1] / L, v[2] / L];
};

/** Deterministic 0..1 from flock id + bird slot (stable across sessions). */
export function birdSlotHash01(flockId: string, birdIndex: number): number {
  let h = 2166136261;
  for (let i = 0; i < flockId.length; i++) {
    h ^= flockId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= birdIndex * 374761393;
  h = Math.imul(h, 2654435761);
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}

/**
 * Returns a local offset (m) from the flock center for one bird. Cohesion is
 * implicit (offsets orbit the origin); separation is approximated by staggering
 * ring radii and phase by slot; a gentle pull biases motion toward the flock
 * target so travel direction reads in the formation.
 */
export function birdLocalOffset(
  flockId: string,
  birdIndex: number,
  birdCount: number,
  params: FlockMotionParams,
): [number, number, number] {
  const h0 = birdSlotHash01(flockId, birdIndex);
  const h1 = birdSlotHash01(flockId, birdIndex + 997);
  const h2 = birdSlotHash01(flockId, birdIndex + 1337);

  const phase = h0 * Math.PI * 2;
  const layer = birdIndex % 3;
  const ringBase = params.roosting ? 0.35 + h1 * 0.9 : 1.1 + h1 * 2.8;
  const ringR = ringBase + layer * 0.45;

  const spin =
    (params.agitation * 0.95 + 0.08) * (params.roosting ? 0.00025 : 0.00085);
  const angle = params.simMs * spin + phase + birdIndex * 0.31;

  let lx = Math.cos(angle) * ringR;
  let lz = Math.sin(angle) * ringR;

  // Separation: push slots to alternating quadrants so discs don't collapse.
  const sep = (birdIndex / Math.max(4, birdCount)) * Math.PI * 2;
  lx += Math.cos(sep) * 0.35;
  lz += Math.sin(sep) * 0.35;

  const toTarget = V_NORM([
    params.target[0] - params.center[0],
    params.target[1] - params.center[1],
    params.target[2] - params.center[2],
  ]);
  const attract = (0.35 + params.agitation * 0.85) * (params.roosting ? 0.12 : 1);
  lx += toTarget[0] * attract;
  lz += toTarget[2] * attract;

  const velN = V_NORM(params.flockVel);
  const align = params.agitation * 0.4;
  lx += velN[0] * align;
  lz += velN[2] * align;

  const bobFreq = 0.0038 + h2 * 0.0022;
  const bobAmp = (params.roosting ? 0.06 : 0.14) + params.agitation * 0.18;
  const desync = h2 * Math.PI * 2;
  const ly =
    Math.sin(params.simMs * bobFreq + desync) * bobAmp +
    (params.roosting ? 0 : Math.sin(angle * 2 + desync) * 0.05 * params.agitation);

  return [lx, ly, lz];
}
