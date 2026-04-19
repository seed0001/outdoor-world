import { useEffect, useState } from "react";
import {
  onTick,
  YEAR_REAL_MS,
  SEASON_REAL_MS,
  getDefaultStartSimMs,
} from "./worldClock";
import { runStats } from "../player/runStats";

export interface RunGoalState {
  active: boolean;
  startSimMs: number;
  /** 0–4: how many full seasons have elapsed since run started. */
  seasonsCompleted: number;
  complete: boolean;
}

const INITIAL: RunGoalState = {
  active: false,
  startSimMs: getDefaultStartSimMs(),
  seasonsCompleted: 0,
  complete: false,
};

let goal: RunGoalState = { ...INITIAL };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

let prevDayIndex = -1;

export const runGoal = {
  start(startSimMs?: number) {
    goal = {
      active: true,
      startSimMs: startSimMs ?? getDefaultStartSimMs(),
      seasonsCompleted: 0,
      complete: false,
    };
    prevDayIndex = -1;
    emit();
  },
  get(): RunGoalState {
    return { ...goal };
  },
  reset() {
    goal = { ...INITIAL };
    prevDayIndex = -1;
    emit();
  },
  tick(currentSimMs: number) {
    if (!goal.active || goal.complete) return;
    const elapsed = Math.max(0, currentSimMs - goal.startSimMs);

    // Track seasons completed (floor of elapsed seasons, capped at 4)
    const completed = Math.min(4, Math.floor(elapsed / SEASON_REAL_MS));
    if (completed !== goal.seasonsCompleted) {
      goal = { ...goal, seasonsCompleted: completed };
      if (completed >= 4) {
        goal = { ...goal, complete: true };
      }
      emit();
    }

    // Track in-game days for runStats (a day is 1/360 of a year)
    const dayIndex = Math.floor(elapsed / (YEAR_REAL_MS / 360));
    if (prevDayIndex !== -1 && dayIndex !== prevDayIndex) {
      runStats.tickDay();
    }
    prevDayIndex = dayIndex;
  },
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};

let unsubTick: (() => void) | null = null;

export function startRunGoalTracking() {
  unsubTick?.();
  unsubTick = onTick((_dt, snap) => runGoal.tick(snap.simMs));
}

export function stopRunGoalTracking() {
  unsubTick?.();
  unsubTick = null;
}

export function useRunGoal(): RunGoalState {
  const [s, setS] = useState<RunGoalState>(() => ({ ...goal }));
  useEffect(() => runGoal.subscribe(() => setS({ ...goal })), []);
  return s;
}
