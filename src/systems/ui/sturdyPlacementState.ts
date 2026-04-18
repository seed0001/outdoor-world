import {
  HALF_X,
  WORLD_MAX_Z,
  WORLD_MIN_Z,
} from "../../world/terrain";

const listeners = new Set<() => void>();

let mode = false;

/** World position for the ground ring; `valid` is false when aim misses terrain or spot is blocked. */
export const sturdyPreviewTarget = {
  x: 0,
  y: 0,
  z: 0,
  valid: false,
};

function emit() {
  listeners.forEach((l) => l());
}

export function isSturdyPlacementMode(): boolean {
  return mode;
}

export function setSturdyPlacementMode(next: boolean): void {
  if (mode === next) return;
  mode = next;
  if (!next) sturdyPreviewTarget.valid = false;
  emit();
}

export function subscribeSturdyPlacement(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Rough map bounds check (same axes as {@link Ground}). */
export function isSturdyPlacementInWorldBounds(x: number, z: number): boolean {
  return (
    x >= -HALF_X - 0.5 &&
    x <= HALF_X + 0.5 &&
    z >= WORLD_MIN_Z - 0.5 &&
    z <= WORLD_MAX_Z + 0.5
  );
}
