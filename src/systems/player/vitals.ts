import { useEffect, useState } from "react";

export const VITALS_MAX = 100;

export interface VitalsState {
  food: number;
  water: number;
  sanity: number;
  max: number;
}

const DEFAULT: VitalsState = {
  food: 100,
  water: 100,
  sanity: 100,
  max: VITALS_MAX,
};

let state: VitalsState = { ...DEFAULT };
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

function clamp(n: number): number {
  return Math.max(0, Math.min(VITALS_MAX, n));
}

export const vitals = {
  get(): VitalsState {
    return state;
  },
  reset(): void {
    state = { ...DEFAULT };
    emit();
  },
  /** Passive change per second (negative = drain). */
  tickFood(deltaPerSec: number, dt: number): void {
    state = { ...state, food: clamp(state.food + deltaPerSec * dt) };
    emit();
  },
  tickWater(deltaPerSec: number, dt: number): void {
    state = { ...state, water: clamp(state.water + deltaPerSec * dt) };
    emit();
  },
  tickSanity(deltaPerSec: number, dt: number): void {
    state = { ...state, sanity: clamp(state.sanity + deltaPerSec * dt) };
    emit();
  },
  addFood(amount: number): void {
    state = { ...state, food: clamp(state.food + amount) };
    emit();
  },
  addWater(amount: number): void {
    state = { ...state, water: clamp(state.water + amount) };
    emit();
  },
  addSanity(amount: number): void {
    state = { ...state, sanity: clamp(state.sanity + amount) };
    emit();
  },
  /** Restore specific vital values without going through tick logic. */
  restoreFromSave(food: number, water: number, sanity: number): void {
    state = { food: clamp(food), water: clamp(water), sanity: clamp(sanity), max: VITALS_MAX };
    emit();
  },
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};

export function useVitals(): VitalsState {
  const [s, setS] = useState<VitalsState>(state);
  useEffect(() => {
    return vitals.subscribe(() => setS({ ...state }));
  }, []);
  return s;
}
