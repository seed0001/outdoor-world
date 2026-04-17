import * as THREE from "three";
import type { WorldTimeSnapshot } from "./worldClock";
import type { WeatherState } from "../weather/types";
import { butterflyActivity, temperatureC } from "./calendar";

export interface ButterflyVisibilityBreakdown {
  dayFactor: number;
  seasonFactor: number;
  weatherFactor: number;
  /** Simulated air °C (for the HUD only — not multiplied into visibility). */
  airTempC: number;
  /** 0..1 — should butterflies render (before opacity easing). */
  combined: number;
}

/**
 * Shared with `Butterfly.tsx` and the ecosystem HUD so the UI shows exactly
 * why insects are visible or culled.
 *
 * We intentionally **do not** multiply by simulated air temperature. The
 * world’s `temperatureC()` follows a cold annual curve; “jump to summer”
 * still produces mornings around freezing, and `(temp + 2) / 12` was
 * zeroing visibility even when season + day said “show butterflies”.
 * Seasonal insect activity is already encoded in `butterflyActivity`.
 */
export function computeButterflyVisibility(
  world: WorldTimeSnapshot,
  weather: WeatherState,
): ButterflyVisibilityBreakdown {
  const airTempC = temperatureC(world, 0, weather.tempMod);

  const sunAlt = Math.sin((world.dayFrac - 0.25) * Math.PI * 2);
  const dayFactor = THREE.MathUtils.clamp(sunAlt * 2.5 + 0.1, 0, 1);

  const seasonFactor = butterflyActivity(world.yearFrac);

  const weatherHostile =
    weather.type === "rain" ||
    weather.type === "hail" ||
    weather.type === "thunderstorm" ||
    weather.type === "snow" ||
    weather.type === "blizzard" ||
    weather.type === "tornado";
  const weatherFactor = weatherHostile
    ? Math.max(0, 1 - weather.intensity * 2.5)
    : 1 - weather.cloudDarkness * 0.3;

  const combined = dayFactor * seasonFactor * weatherFactor;

  return {
    dayFactor,
    seasonFactor,
    weatherFactor,
    airTempC,
    combined,
  };
}
