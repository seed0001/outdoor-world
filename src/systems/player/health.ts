import { useEffect, useState } from "react";
import { vitals } from "./vitals";

export interface HealthState {
  hp: number;
  max: number;
  dead: boolean;
  deathSource: string | null;
  deathAtMs: number | null;
  lastDamageAtMs: number | null;
  lastDamageAmount: number;
}

const DEFAULT: HealthState = {
  hp: 100,
  max: 100,
  dead: false,
  deathSource: null,
  deathAtMs: null,
  lastDamageAtMs: null,
  lastDamageAmount: 0,
};

let state: HealthState = { ...DEFAULT };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const health = {
  get(): HealthState {
    return state;
  },
  damage(amount: number, source: string) {
    if (state.dead || amount <= 0) return;
    state.hp = Math.max(0, state.hp - amount);
    state.lastDamageAtMs = performance.now();
    state.lastDamageAmount = amount;
    if (state.hp === 0) {
      state.dead = true;
      state.deathSource = source;
      state.deathAtMs = performance.now();
    }
    emit();
  },
  heal(amount: number) {
    if (state.dead) return;
    state.hp = Math.min(state.max, state.hp + amount);
    emit();
  },
  respawn() {
    state = { ...DEFAULT };
    vitals.reset();
    emit();
  },
  /** Restore a specific HP value without going through damage/heal logic. */
  restoreFromSave(hp: number) {
    state = { ...DEFAULT, hp: Math.max(1, Math.min(DEFAULT.max, hp)) };
    emit();
  },
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};

export function useHealth(): HealthState {
  const [s, setS] = useState<HealthState>(state);
  useEffect(() => {
    const unsub = health.subscribe(() => setS({ ...state }));
    return unsub;
  }, []);
  return s;
}
