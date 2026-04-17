import { useEffect, useState } from "react";

export const DAY_REAL_MS = 3600 * 1000; // 1 real hour per in-game day
export const YEAR_REAL_MS = 30 * 24 * 3600 * 1000; // 30 real days per year
export const SEASON_REAL_MS = YEAR_REAL_MS / 4;
export const MONTH_REAL_MS = YEAR_REAL_MS / 12;

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export type SeasonIndex = 0 | 1 | 2 | 3;
export const SEASON_NAMES = ["Spring", "Summer", "Autumn", "Winter"] as const;

export interface WorldTimeSnapshot {
  simMs: number;
  /** 0..1 over the full 30-day year */
  yearFrac: number;
  /** 0..1 within the current in-game day (real hour) */
  dayFrac: number;
  /** 0..359, treating the year as 360 in-game days */
  dayOfYear: number;
  monthIndex: number;
  monthProgress: number;
  seasonIndex: SeasonIndex;
  seasonProgress: number;
  timeScale: number;
  paused: boolean;
}

type TickListener = (dtSimMs: number, snap: WorldTimeSnapshot) => void;

let simMs = 0;
let timeScale = 1;
let paused = false;
let lastRealMs = performance.now();
const tickListeners = new Set<TickListener>();
const stateListeners = new Set<() => void>();

function parseInitialScale(): number {
  const params = new URLSearchParams(window.location.search);
  const scale = params.get("scale");
  if (scale !== null) {
    const n = parseFloat(scale);
    if (Number.isFinite(n) && n > 0) return n;
  }
  // Back-compat: ?day=N (seconds per sun cycle) -> scale = 3600 / N
  const day = params.get("day");
  if (day !== null) {
    const n = parseFloat(day);
    if (Number.isFinite(n) && n > 0) return 3600 / n;
  }
  return 1;
}

function parseInitialSeason(): number {
  const season = new URLSearchParams(window.location.search).get("season");
  if (!season) return 0;
  const n = SEASON_NAMES.findIndex(
    (s) => s.toLowerCase() === season.toLowerCase(),
  );
  return n >= 0 ? n * SEASON_REAL_MS : 0;
}

/** April 20, mid-morning — used as the default calendar start (HUD day = ⌊monthProgress·30⌋+1). */
export function getDefaultStartSimMs(): number {
  const yearFracApril20 = (3 + 19.5 / 30) / 12;
  return yearFracApril20 * YEAR_REAL_MS + DAY_REAL_MS * 0.3;
}

function parseInitialSimMs(): number {
  const params = new URLSearchParams(window.location.search);
  // URL season jump overrides the April 20 default.
  if (params.get("season") !== null) {
    return parseInitialSeason() + DAY_REAL_MS * 0.3;
  }
  return getDefaultStartSimMs();
}

timeScale = parseInitialScale();
simMs = parseInitialSimMs();

function emitState() {
  stateListeners.forEach((l) => l());
}

export function snapshot(): WorldTimeSnapshot {
  const year = ((simMs % YEAR_REAL_MS) + YEAR_REAL_MS) % YEAR_REAL_MS;
  const yearFrac = year / YEAR_REAL_MS;
  const day = ((simMs % DAY_REAL_MS) + DAY_REAL_MS) % DAY_REAL_MS;
  const dayFrac = day / DAY_REAL_MS;
  const monthIndexRaw = yearFrac * 12;
  const monthIndex = Math.floor(monthIndexRaw) % 12;
  const monthProgress = monthIndexRaw - Math.floor(monthIndexRaw);
  const seasonIndexRaw = yearFrac * 4;
  const seasonIndex = (Math.floor(seasonIndexRaw) % 4) as SeasonIndex;
  const seasonProgress = seasonIndexRaw - Math.floor(seasonIndexRaw);
  const dayOfYear = Math.floor(yearFrac * 360);
  return {
    simMs,
    yearFrac,
    dayFrac,
    dayOfYear,
    monthIndex,
    monthProgress,
    seasonIndex,
    seasonProgress,
    timeScale,
    paused,
  };
}

function rafLoop() {
  const now = performance.now();
  const dtRealMs = now - lastRealMs;
  lastRealMs = now;
  // Clamp dt (tab-switch etc.) so a long pause doesn't warp weeks of sim.
  const clampedDt = Math.min(dtRealMs, 250);
  const dtSimMs = paused ? 0 : clampedDt * timeScale;
  simMs += dtSimMs;
  if (tickListeners.size > 0) {
    const snap = snapshot();
    tickListeners.forEach((l) => l(dtSimMs, snap));
  }
  requestAnimationFrame(rafLoop);
}
requestAnimationFrame(rafLoop);

export function onTick(cb: TickListener): () => void {
  tickListeners.add(cb);
  return () => {
    tickListeners.delete(cb);
  };
}

export function subscribeState(cb: () => void): () => void {
  stateListeners.add(cb);
  return () => {
    stateListeners.delete(cb);
  };
}

export function setTimeScale(s: number) {
  timeScale = Math.max(0, s);
  emitState();
}
export function getTimeScale(): number {
  return timeScale;
}

export function setPaused(p: boolean) {
  paused = p;
  emitState();
}
export function isPaused(): boolean {
  return paused;
}

export function setSimMs(ms: number) {
  simMs = ms;
  emitState();
}

export function advanceSimMs(delta: number) {
  simMs += delta;
  emitState();
}

export function jumpToSeason(s: SeasonIndex) {
  const currentYear = Math.floor(simMs / YEAR_REAL_MS);
  simMs = currentYear * YEAR_REAL_MS + s * SEASON_REAL_MS + DAY_REAL_MS * 0.3;
  emitState();
}

export function resetWorldClock() {
  simMs = getDefaultStartSimMs();
  emitState();
}

/** React hook that updates at a throttled rate for UI readouts. */
export function useWorldTime(updateHz = 4): WorldTimeSnapshot {
  const [snap, setSnap] = useState<WorldTimeSnapshot>(snapshot);
  useEffect(() => {
    const id = window.setInterval(
      () => setSnap(snapshot()),
      Math.max(16, 1000 / updateHz),
    );
    const unsub = subscribeState(() => setSnap(snapshot()));
    return () => {
      window.clearInterval(id);
      unsub();
    };
  }, [updateHz]);
  return snap;
}
