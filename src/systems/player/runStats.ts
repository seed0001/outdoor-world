import { useEffect, useState } from "react";

export interface RunStatsData {
  startRealMs: number;
  daysElapsed: number;
  treesChopped: number;
  animalsKilled: number;
  campfiresLit: number;
  structuresBuilt: number;
}

const DEFAULT: RunStatsData = {
  startRealMs: performance.now(),
  daysElapsed: 0,
  treesChopped: 0,
  animalsKilled: 0,
  campfiresLit: 0,
  structuresBuilt: 0,
};

let stats: RunStatsData = { ...DEFAULT };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const runStats = {
  get(): RunStatsData {
    return { ...stats };
  },
  reset() {
    stats = { ...DEFAULT, startRealMs: performance.now() };
    emit();
  },
  load(data: Partial<RunStatsData>) {
    stats = { ...DEFAULT, ...data };
    emit();
  },
  incTrees() {
    stats.treesChopped++;
  },
  incAnimals() {
    stats.animalsKilled++;
  },
  incCampfires() {
    stats.campfiresLit++;
    emit();
  },
  incStructures() {
    stats.structuresBuilt++;
    emit();
  },
  tickDay() {
    stats.daysElapsed++;
    emit();
  },
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};

export function useRunStats(): RunStatsData {
  const [s, setS] = useState<RunStatsData>(() => ({ ...stats }));
  useEffect(() => runStats.subscribe(() => setS({ ...stats })), []);
  return s;
}
