export interface Campfire {
  id: number;
  x: number;
  y: number;
  z: number;
}

let nextId = 1;
const list: Campfire[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

export const campfires = {
  list(): Campfire[] {
    return list.slice();
  },
  add(x: number, y: number, z: number): void {
    list.push({ id: nextId++, x, y, z });
    emit();
  },
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
  /** True if any fire is within `radius` metres of the point (3D). */
  isNear(px: number, py: number, pz: number, radius: number): boolean {
    return this.nearest(px, py, pz, radius) !== null;
  },

  /**
   * Closest campfire within horizontal reach `maxDist` (metres on XZ).
   * Uses flat distance so player capsule height does not shrink the usable radius.
   */
  nearest(px: number, _py: number, pz: number, maxDist: number): Campfire | null {
    const r2 = maxDist * maxDist;
    let best: Campfire | null = null;
    let bestD2 = Infinity;
    for (const f of list) {
      const dx = f.x - px;
      const dz = f.z - pz;
      const d2 = dx * dx + dz * dz;
      if (d2 > r2) continue;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = f;
      }
    }
    return best;
  },
};
