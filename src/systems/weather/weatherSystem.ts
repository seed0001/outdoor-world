import { onTick, snapshot } from "../world/worldClock";
import { seasonForMonth } from "../world/calendar";
import {
  WEATHER_LABELS,
  type WeatherState,
  type WeatherType,
} from "./types";

export { WEATHER_LABELS, type WeatherState, type WeatherType };

/** Weighted transitions. Each entry is a bias that is multiplied by a season
 * multiplier. Higher = more likely to transition to that state. */
type Weights = Partial<Record<WeatherType, number>>;

const BASE_TRANSITIONS: Record<WeatherType, Weights> = {
  clear: { clear: 6, cloudy: 3 },
  cloudy: { clear: 4, cloudy: 2, rain: 2, snow: 1, thunderstorm: 0.4 },
  rain: { rain: 3, cloudy: 2, thunderstorm: 1.2, hail: 0.4, clear: 0.5 },
  hail: { rain: 3, cloudy: 1, clear: 0.5 },
  thunderstorm: {
    thunderstorm: 2,
    rain: 3,
    tornado: 0.8,
    cloudy: 1,
  },
  snow: { snow: 3, cloudy: 2, blizzard: 1, clear: 0.5 },
  blizzard: { snow: 3, cloudy: 1 },
  tornado: { thunderstorm: 4, rain: 2 },
};

/** Multipliers applied per season. Missing entries default to 0 (impossible). */
type SeasonWeights = Partial<Record<WeatherType, number>>;
const SEASON_MULT: Record<number, SeasonWeights> = {
  // 0 Spring (Mar–May): wet and variable — no snow/blizzard (April shouldn’t blizzard).
  0: {
    clear: 1,
    cloudy: 1.2,
    rain: 1.5,
    hail: 0.4,
    thunderstorm: 0.7,
    tornado: 0.3,
    snow: 0,
    blizzard: 0,
  },
  // 1 Summer: mostly clear, dramatic thunderstorms, tornado season
  1: {
    clear: 1.6,
    cloudy: 0.8,
    rain: 0.8,
    hail: 0.5,
    thunderstorm: 1.0,
    tornado: 0.6,
    snow: 0,
    blizzard: 0,
  },
  // 2 Autumn: grey and windy, occasional early snow, late tornadoes
  2: {
    clear: 0.8,
    cloudy: 1.4,
    rain: 1.2,
    hail: 0.3,
    thunderstorm: 0.4,
    tornado: 0.15,
    snow: 0.3,
    blizzard: 0,
  },
  // 3 Winter: snow dominant, blizzards
  3: {
    clear: 0.7,
    cloudy: 1.2,
    rain: 0.1,
    hail: 0.05,
    thunderstorm: 0,
    tornado: 0,
    snow: 1.6,
    blizzard: 0.6,
  },
};

const DEFAULT_STATE: WeatherState = {
  type: "clear",
  intensity: 1,
  target: null,
  transition: 0,
  rainRate: 0,
  hailRate: 0,
  snowRate: 0,
  windStrength: 0.2,
  lightningRate: 0,
  cloudCoverage: 0.1,
  cloudDarkness: 0,
  wetness: 0,
  tempMod: 0,
};

let state: WeatherState = { ...DEFAULT_STATE };
let forced: WeatherType | null = null;
let timeInState = 0;
/** All durations below are in simulated milliseconds, NOT wall-clock ms. */
const IN_GAME_MINUTE_MS = 2500; // DAY_REAL_MS / 1440
const DEFAULT_TRANSITION_MS = 8 * IN_GAME_MINUTE_MS;
const ROLL_PERIOD_MS = 20 * IN_GAME_MINUTE_MS;
const MIN_STATE_MS = 3 * IN_GAME_MINUTE_MS;
let transitionDurationMs = DEFAULT_TRANSITION_MS;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function rollNext(current: WeatherType, seasonMonth: number): WeatherType {
  const season = seasonForMonth(seasonMonth);
  const seasonMult = SEASON_MULT[season] ?? {};
  const base = BASE_TRANSITIONS[current];
  const weights: Array<[WeatherType, number]> = [];
  (Object.keys(base) as WeatherType[]).forEach((t) => {
    const w = (base[t] ?? 0) * (seasonMult[t] ?? 0);
    if (w > 0) weights.push([t, w]);
  });
  if (weights.length === 0) return "clear";
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [t, w] of weights) {
    r -= w;
    if (r <= 0) return t;
  }
  return weights[weights.length - 1][0];
}

function applyDerivedForType(t: WeatherType): Omit<
  WeatherState,
  "type" | "intensity" | "target" | "transition" | "wetness"
> {
  switch (t) {
    case "clear":
      return {
        rainRate: 0,
        hailRate: 0,
        snowRate: 0,
        windStrength: 0.2,
        lightningRate: 0,
        cloudCoverage: 0.1,
        cloudDarkness: 0,
        tempMod: 0,
      };
    case "cloudy":
      return {
        rainRate: 0,
        hailRate: 0,
        snowRate: 0,
        windStrength: 0.4,
        lightningRate: 0,
        cloudCoverage: 0.8,
        cloudDarkness: 0.15,
        tempMod: -1,
      };
    case "rain":
      return {
        rainRate: 0.8,
        hailRate: 0,
        snowRate: 0,
        windStrength: 0.6,
        lightningRate: 0,
        cloudCoverage: 0.95,
        cloudDarkness: 0.45,
        tempMod: -2,
      };
    case "hail":
      return {
        rainRate: 0.3,
        hailRate: 0.8,
        snowRate: 0,
        windStrength: 0.8,
        lightningRate: 0.1,
        cloudCoverage: 1,
        cloudDarkness: 0.55,
        tempMod: -4,
      };
    case "thunderstorm":
      return {
        rainRate: 1,
        hailRate: 0,
        snowRate: 0,
        windStrength: 1.1,
        lightningRate: 1.5, // ~1.5 strikes per in-game min
        cloudCoverage: 1,
        cloudDarkness: 0.94,
        tempMod: -3,
      };
    case "snow":
      return {
        rainRate: 0,
        hailRate: 0,
        snowRate: 0.8,
        windStrength: 0.4,
        lightningRate: 0,
        cloudCoverage: 0.9,
        cloudDarkness: 0.3,
        tempMod: -5,
      };
    case "blizzard":
      return {
        rainRate: 0,
        hailRate: 0,
        snowRate: 1.2,
        windStrength: 1.5,
        lightningRate: 0,
        cloudCoverage: 1,
        cloudDarkness: 0.55,
        tempMod: -8,
      };
    case "tornado":
      return {
        rainRate: 0.7,
        hailRate: 0.15,
        snowRate: 0,
        windStrength: 2.5,
        lightningRate: 0.8,
        cloudCoverage: 1,
        cloudDarkness: 0.8,
        tempMod: -2,
      };
  }
}

function beginTransition(target: WeatherType, durationMs = DEFAULT_TRANSITION_MS) {
  if (state.type === target && !state.target) {
    return;
  }
  state.target = target;
  state.transition = 0;
  transitionDurationMs = durationMs;
  emit();
}

/** Drives the weather forward. Called each real frame via the world clock. */
function tick(dtSimMs: number) {
  if (dtSimMs <= 0) return;

  timeInState += dtSimMs;

  // If we have a pending target, advance the transition.
  if (state.target !== null) {
    state.transition += dtSimMs / transitionDurationMs;
    const halfway = Math.min(1, state.transition * 2); // old fades out first half
    if (state.transition >= 1) {
      state.type = state.target;
      state.target = null;
      state.transition = 0;
      state.intensity = 1;
      timeInState = 0;
      Object.assign(state, applyDerivedForType(state.type));
      emit();
    } else {
      // Crossfade derived values.
      const from = applyDerivedForType(state.type);
      const to = applyDerivedForType(state.target);
      const k = smoothstep(state.transition);
      state.rainRate = lerp(from.rainRate, to.rainRate, k);
      state.hailRate = lerp(from.hailRate, to.hailRate, k);
      state.snowRate = lerp(from.snowRate, to.snowRate, k);
      state.windStrength = lerp(from.windStrength, to.windStrength, k);
      state.lightningRate = lerp(from.lightningRate, to.lightningRate, k);
      state.cloudCoverage = lerp(from.cloudCoverage, to.cloudCoverage, k);
      state.cloudDarkness = lerp(from.cloudDarkness, to.cloudDarkness, k);
      state.tempMod = lerp(from.tempMod, to.tempMod, k);
      state.intensity = 1 - Math.abs(halfway - 0.5) * 2; // dip then rise
      emit();
    }
  } else if (state.intensity < 1) {
    state.intensity = Math.min(
      1,
      state.intensity + dtSimMs / IN_GAME_MINUTE_MS,
    );
  }

  // Update wetness: rises with precipitation, dries in sun.
  // Reach ~full wetness after ~10 in-game minutes of heavy rain.
  const wetGainPerSimMs =
    (state.rainRate * 0.0001 + state.hailRate * 0.00005 - 0.00001) /
    IN_GAME_MINUTE_MS;
  state.wetness = Math.min(
    1,
    Math.max(0, state.wetness + wetGainPerSimMs * dtSimMs),
  );

  // Consider rolling a new target on expected 1 roll per 20 in-game min.
  if (state.target === null && forced === null) {
    const chancePerMs = dtSimMs / ROLL_PERIOD_MS;
    if (Math.random() < chancePerMs && timeInState > MIN_STATE_MS) {
      const { monthIndex } = snapshot();
      const next = rollNext(state.type, monthIndex);
      if (next !== state.type) {
        beginTransition(next);
      }
    }
  }
}

onTick((dtSimMs) => {
  tick(dtSimMs);
});

export function getWeather(): WeatherState {
  return state;
}

export function subscribeWeather(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function forceWeather(
  t: WeatherType | null,
  fastMs = IN_GAME_MINUTE_MS,
) {
  forced = t;
  if (t === null) return;
  beginTransition(t, fastMs);
}

export function isForced(): boolean {
  return forced !== null;
}

export function releaseForcedWeather() {
  forced = null;
}

// Initialise with season-biased starting weather
(() => {
  const { monthIndex } = snapshot();
  const season = seasonForMonth(monthIndex);
  const initial =
    season === 3 ? "snow" : season === 1 ? "clear" : "cloudy";
  state = { ...DEFAULT_STATE, type: initial, ...applyDerivedForType(initial) };
})();

// Short in-game minute timer utility exported for others if needed
export const ONE_IN_GAME_MINUTE_MS = IN_GAME_MINUTE_MS;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}
