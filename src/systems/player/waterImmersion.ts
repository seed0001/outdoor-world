/**
 * Tracks whether the player's head (camera eye) is currently submerged in the
 * lake. Updated each frame by a controller inside the Canvas and read by
 * react-DOM overlays outside the Canvas via {@link useWaterImmersion}.
 */
import { useSyncExternalStore } from "react";

interface WaterImmersionState {
  /** Camera (eye) is below the water surface and inside the lake disk. */
  submerged: boolean;
  /** Depth below water in metres. 0 at surface, grows the deeper you are. */
  depth: number;
}

const state: WaterImmersionState = { submerged: false, depth: 0 };
const listeners = new Set<() => void>();

export function getWaterImmersion(): WaterImmersionState {
  return state;
}

export function setWaterImmersion(next: {
  submerged: boolean;
  depth: number;
}): void {
  // Avoid waking React unless something actually changed. Depth is quantised
  // to 2 decimals so sub-mm jitter doesn't cause re-renders every frame.
  const roundedDepth = Math.round(next.depth * 100) / 100;
  if (
    state.submerged === next.submerged &&
    state.depth === roundedDepth
  ) {
    return;
  }
  state.submerged = next.submerged;
  state.depth = roundedDepth;
  listeners.forEach((l) => l());
}

export function subscribeWaterImmersion(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useWaterImmersion(): WaterImmersionState {
  return useSyncExternalStore(
    subscribeWaterImmersion,
    getWaterImmersion,
    getWaterImmersion,
  );
}
