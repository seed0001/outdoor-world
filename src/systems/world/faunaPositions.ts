import * as THREE from "three";
import type { FaunaKind } from "./faunaLifecycle";
import { isFaunaAlive } from "./faunaLifecycle";

const snake = new Map<number, THREE.Vector3>();
const rat = new Map<number, THREE.Vector3>();
const fish = new Map<number, THREE.Vector3>();

function vec(map: Map<number, THREE.Vector3>, id: number): THREE.Vector3 {
  let v = map.get(id);
  if (!v) {
    v = new THREE.Vector3();
    map.set(id, v);
  }
  return v;
}

export const faunaPositions = {
  setSnake(id: number, x: number, y: number, z: number): void {
    vec(snake, id).set(x, y, z);
  },
  setRat(id: number, x: number, y: number, z: number): void {
    vec(rat, id).set(x, y, z);
  },
  setFish(id: number, x: number, y: number, z: number): void {
    vec(fish, id).set(x, y, z);
  },
};

const HIT_R: Record<FaunaKind, number> = {
  snake: 0.55,
  rat: 0.38,
  fish: 0.32,
};

/**
 * Closest alive fauna whose hit sphere intersects the camera ray segment
 * `origin + t * dir` for t in [0, maxT]. `dir` need not be normalized.
 */
export function rayPickFauna(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxT: number,
): { kind: FaunaKind; id: number } | null {
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6) return null;
  const ux = dx / len;
  const uy = dy / len;
  const uz = dz / len;

  let bestT = maxT + 1;
  let best: { kind: FaunaKind; id: number } | null = null;
  const now = performance.now();

  const tryMap = (kind: FaunaKind, m: Map<number, THREE.Vector3>) => {
    const r = HIT_R[kind];
    for (const [id, p] of m) {
      if (!isFaunaAlive(kind, id, now)) continue;
      const t = (p.x - ox) * ux + (p.y - oy) * uy + (p.z - oz) * uz;
      if (t < 0 || t > maxT) continue;
      const cx = ox + ux * t;
      const cy = oy + uy * t;
      const cz = oz + uz * t;
      const d = Math.hypot(p.x - cx, p.y - cy, p.z - cz);
      if (d <= r && t < bestT) {
        bestT = t;
        best = { kind, id };
      }
    }
  };

  tryMap("snake", snake);
  tryMap("rat", rat);
  tryMap("fish", fish);
  return best;
}
