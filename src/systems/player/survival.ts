import { useEffect, useState } from "react";
import { onTick, snapshot as clockSnapshot } from "../world/worldClock";
import { temperatureC } from "../world/calendar";
import { getWeather } from "../weather/weatherSystem";
import { health } from "./health";
import { vitals, VITALS_MAX } from "./vitals";
import { playerRef } from "./playerRef";
import { isSurviveMode } from "../settings/playMode";

export interface SurvivalState {
  /** Deg C: calendar `temperatureC` + elevation lapse + `weather.tempMod`. */
  feltTemperatureC: number;
  /** 0 = full, higher = hungrier (`100 - food`). */
  hunger: number;
}

function computeFelt(): number {
  return temperatureC(
    clockSnapshot(),
    playerRef.position.y,
    getWeather().tempMod,
  );
}

let feltTemperatureC = computeFelt();

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** Matches former VitalsSystem food drain, now driven by simulated time from worldClock. */
const FOOD_DRAIN_PER_SIM_SECOND = 0.072;

const COLD_SAFE_C = 5;
const COLD_DAMAGE_FACTOR = 0.05;
const HEAT_SAFE_C = 38;
const HEAT_DAMAGE_FACTOR = 0.06;
const MAX_ENV_DPS = 2.2;

const STARVE_HP_PER_SIM_SEC = 0.45;

onTick((dtSimMs, snap) => {
  if (health.get().dead) return;

  const dt = dtSimMs / 1000;
  if (dt <= 0) return;

  feltTemperatureC = temperatureC(
    snap,
    playerRef.position.y,
    getWeather().tempMod,
  );

  if (!isSurviveMode()) {
    emit();
    return;
  }

  vitals.tickFood(-FOOD_DRAIN_PER_SIM_SECOND, dt);

  const food = vitals.get().food;
  if (food <= 0) {
    health.damage(STARVE_HP_PER_SIM_SEC * dt, "starvation");
  }

  const t = feltTemperatureC;
  if (t < COLD_SAFE_C) {
    const dps = Math.min(MAX_ENV_DPS, (COLD_SAFE_C - t) * COLD_DAMAGE_FACTOR);
    health.damage(dps * dt, "hypothermia");
  } else if (t > HEAT_SAFE_C) {
    const dps = Math.min(MAX_ENV_DPS, (t - HEAT_SAFE_C) * HEAT_DAMAGE_FACTOR);
    health.damage(dps * dt, "heatstroke");
  }

  emit();
});

vitals.subscribe(() => emit());

export const survival = {
  get(): SurvivalState {
    return {
      feltTemperatureC,
      hunger: VITALS_MAX - vitals.get().food,
    };
  },
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};

export function useSurvival(): SurvivalState {
  const [s, setS] = useState<SurvivalState>(() => survival.get());
  useEffect(() => {
    const unsub = survival.subscribe(() => setS(survival.get()));
    return unsub;
  }, []);
  return s;
}
