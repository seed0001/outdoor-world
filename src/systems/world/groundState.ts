import { onTick, snapshot } from "./worldClock";
import { snowTarget, temperatureC } from "./calendar";
import { getWeather } from "../weather/weatherSystem";

interface GroundState {
  snowLevel: number; // 0..1 visible snow blend
  wetness: number; // 0..1 wet surface darkening
}

const state: GroundState = {
  snowLevel: 0,
  wetness: 0,
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function getGroundState(): GroundState {
  return state;
}

export function subscribeGround(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

onTick((dtSimMs) => {
  if (dtSimMs <= 0) return;
  const snap = snapshot();
  const weather = getWeather();

  // Baseline seasonal snow the world wants.
  const seasonalTarget = snowTarget(snap.yearFrac);
  // Temperature melts snow. Above ~4C snow melts fast; below 0C preserved.
  const temp = temperatureC(snap, 0, weather.tempMod);
  const meltRate = temp > 0 ? Math.min(1, temp / 5) : 0;

  // Snow accumulation contribution from active snowfall.
  const accumPerSimMs = weather.snowRate * 0.0002; // heavier in blizzards
  // Rain melts snow.
  const rainMeltPerSimMs = weather.rainRate * 0.00015;
  // Natural drift toward seasonal baseline.
  const driftPerSimMs = (seasonalTarget - state.snowLevel) * 0.00003;

  state.snowLevel = clamp(
    state.snowLevel +
      accumPerSimMs * dtSimMs -
      rainMeltPerSimMs * dtSimMs -
      meltRate * 0.00005 * dtSimMs +
      driftPerSimMs * dtSimMs,
  );

  state.wetness = weather.wetness;

  if (dtSimMs > 0) emit();
});

function clamp(n: number) {
  return Math.max(0, Math.min(1, n));
}

/** Test-only helper used by DevPanel resets. */
export function resetGroundState() {
  state.snowLevel = 0;
  state.wetness = 0;
  emit();
}
