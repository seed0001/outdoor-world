export interface SturdyFrame {
  id: number;
  x: number;
  y: number;
  z: number;
  /** Radians, Y rotation (matches {@link playerRef.heading}). */
  heading: number;
}

let nextId = 1;
const list: SturdyFrame[] = [];
const listeners = new Set<() => void>();

/** Large FBX clones per instance — keep placements modest. */
export const MAX_STURDY_FRAMES_PLACED = 5;

function emit(): void {
  listeners.forEach((l) => l());
}

export const sturdyFrames = {
  list(): SturdyFrame[] {
    return list.slice();
  },
  /** Returns false if the world already has {@link MAX_STURDY_FRAMES_PLACED}. */
  add(x: number, y: number, z: number, heading: number): boolean {
    if (list.length >= MAX_STURDY_FRAMES_PLACED) return false;
    list.push({ id: nextId++, x, y, z, heading });
    emit();
    return true;
  },
  reset(): void {
    list.length = 0;
    nextId = 1;
    emit();
  },
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};
