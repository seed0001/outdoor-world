import { onTick, snapshot, type WorldTimeSnapshot } from "./worldClock";
import { seasonForMonth } from "./calendar";
import { getWeather, type WeatherState } from "../weather/weatherSystem";
import type { WeatherType } from "../weather/types";
import {
  birdFlockDefinitions,
  type BirdFlockDefinition,
  type BirdSpecies,
} from "./birdRegistry";
import {
  getBirdZone,
  birdZonesOfType,
  type BirdZone,
  type BirdZoneType,
} from "./birdZoneRegistry";
import { heightAt } from "../../world/terrain";

// —— tuning (sim time / movement) ————————————————————————————————————

/** Minimum time in a state before optional (non-emergency) transitions. */
const STATE_DWELL_MIN_MS = 4_800;

/** In-game minutes at ~2500 sim ms each — thirst accrues over the morning. */
const THIRST_DAY_RATE = (0.028 / 2_500) * 0.72;
const THIRST_DRINK_RELIEF = 0.055 / 2_500;
const REST_FLIGHT_DRAIN = 0.018 / 2_500;
const REST_ROOST_GAIN = 0.04 / 2_500;

const FEAR_DANGER_GAIN = 0.22 / 2_500;
const FEAR_CALM_DECAY = 0.06 / 2_500;

/** Max horizontal cruise speed (m/s) — songbirds, not racing starlings. */
const MAX_CRUISE_MS = 4.2;
const ARRIVE_EPS = 2.8;
const ARRIVE_Z_ROOST = 2.2;

/** Minimum time at the lake before ending a drink stop (sim ms). */
const MIN_DRINK_DWELL_MS = 12_000;

/** Sim-time spacing for rare deterministic forage ticks while wandering. */
const FORAGE_PERIOD_MS = 140_000;

// —— public model (matches design contract) ——————————————————————————

export type BirdFlockState =
  | "ROOSTING"
  | "FLYING_TO_WATER"
  | "DRINKING"
  | "WANDERING"
  | "RETURNING"
  | "SHELTERING"
  | "OFF_MAP";

export interface BirdFlock {
  id: string;
  species: BirdSpecies;
  state: BirdFlockState;
  center: [number, number, number];
  target: [number, number, number];
  velocity: [number, number, number];
  birdCount: number;
  thirst: number;
  restNeed: number;
  fear: number;
  currentZoneId: string | null;
  active: boolean;
  seedCarry: number;
  lastTransitionSimTimeMs: number;
  perchCount: number;
  drinkCount: number;
  forageCount: number;
  onMap: boolean;
}

export type BirdEcosystemEvent =
  | { kind: "visited_zone"; flockId: string; zoneId: string; zoneType: BirdZoneType }
  | { kind: "drank_at_lake"; flockId: string; zoneId: string }
  | { kind: "roosted"; flockId: string; zoneId: string };

// —— runtime-only fields ——————————————————————————————————————————————

interface BirdFlockRuntime extends BirdFlock {
  homeRoostZoneId: string;
  baseBirdCount: number;
  wanderSlot: number;
  shelterPick: number;
  previousZoneId: string | null;
  /** Last `Math.floor(simMs / FORAGE_PERIOD_MS)` bucket used for forage ticks. */
  lastForageBucket: number;
}

// —— vec3 helpers —————————————————————————————————————————————————————

type V3 = [number, number, number];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const distXZ = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpV = (a: V3, b: V3, t: number): V3 => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// —— weather / season —————————————————————————————————————————————————

function isDangerousWeather(t: WeatherType): boolean {
  return t === "thunderstorm" || t === "hail" || t === "tornado" || t === "blizzard";
}

function isHeavyPrecip(t: WeatherType): boolean {
  return t === "rain" || t === "snow" || t === "hail";
}

function movementMultiplier(w: WeatherState): number {
  let m = 1;
  if (isDangerousWeather(w.type)) m *= 0.35;
  else if (isHeavyPrecip(w.type)) m *= 0.62;
  if (w.windStrength > 1.35) m *= 0.72;
  else if (w.windStrength > 0.95) m *= 0.88;
  if (w.type === "snow" || w.type === "blizzard") m *= 0.55;
  return Math.max(0.12, m * w.intensity + (1 - w.intensity) * 0.85);
}

/**
 * 0..1 — how many individuals stay with the flock. Deep winter thins or clears
 * the population; late winter allows partial return.
 */
function winterActivityFactor(
  traditionalSeason: number,
  monthIndex: number,
): number {
  if (traditionalSeason !== 3) return 1;
  if (monthIndex === 11 || monthIndex === 0) return 0.06;
  if (monthIndex === 1) return 0.28;
  return 0.55;
}

function isNight(dayFrac: number): boolean {
  return dayFrac < 0.31 || dayFrac > 0.79;
}

function pickWeightedZone(zones: BirdZone[], key: number): BirdZone {
  if (zones.length === 0) {
    return {
      id: "fallback",
      type: "WANDER",
      position: [0, 18, 0],
      radius: 20,
      weight: 1,
    };
  }
  let sum = 0;
  for (const z of zones) sum += z.weight;
  let r = (Math.sin(key * 12.9898) * 43758.5453) % 1;
  if (r < 0) r += 1;
  let acc = r * sum;
  for (const z of zones) {
    acc -= z.weight;
    if (acc <= 0) return z;
  }
  return zones[zones.length - 1];
}

function drinkZonesOrdered(flockId: string): BirdZone[] {
  const all = birdZonesOfType("DRINK");
  const off = (flockId.split("").reduce((s, c) => s + c.charCodeAt(0), 0) % Math.max(1, all.length));
  return [...all.slice(off), ...all.slice(0, off)];
}

/**
 * Prefer wander patches near the flock's home roost so daytime activity stays
 * in the treeline instead of drifting across open terrain.
 */
function wanderTargetForSlot(
  flock: BirdFlockRuntime,
  slot: number,
  simMs: number,
): BirdZone {
  const wanders = birdZonesOfType("WANDER");
  if (wanders.length === 0) return roostZoneFor(flock);
  const home = roostZoneFor(flock).position;
  const sorted = [...wanders].sort(
    (a, b) =>
      Math.hypot(a.position[0] - home[0], a.position[2] - home[2]) -
      Math.hypot(b.position[0] - home[0], b.position[2] - home[2]),
  );
  const pool = sorted.slice(0, Math.min(10, sorted.length));
  const idx =
    (slot + Math.floor(simMs / 110_000)) % Math.max(1, pool.length);
  return pool[idx];
}

function exitZoneForFlock(flockId: string): BirdZone {
  const exits = birdZonesOfType("EXIT");
  return pickWeightedZone(exits, flockId.length * 13);
}

function entryZoneForFlock(flockId: string): BirdZone {
  const entries = birdZonesOfType("ENTRY");
  return pickWeightedZone(entries, flockId.length * 17);
}

function shelterZoneFor(flock: BirdFlockRuntime, simMs: number): BirdZone {
  const shelters = birdZonesOfType("SHELTER");
  if (shelters.length === 0) {
    const roost = getBirdZone(flock.homeRoostZoneId);
    if (roost) return roost;
    return wanderTargetForSlot(flock, 0, simMs);
  }
  const i = (flock.shelterPick + Math.floor(simMs / 120_000)) % shelters.length;
  return shelters[i];
}

function roostZoneFor(flock: BirdFlockRuntime): BirdZone {
  return getBirdZone(flock.homeRoostZoneId) ?? birdZonesOfType("ROOST")[0];
}

// —— lifecycle / events ———————————————————————————————————————————————

const ecoListeners = new Set<(e: BirdEcosystemEvent) => void>();
const renderListeners = new Set<() => void>();

export function subscribeBirdEcosystem(
  cb: (e: BirdEcosystemEvent) => void,
): () => void {
  ecoListeners.add(cb);
  return () => ecoListeners.delete(cb);
}

function emitEco(e: BirdEcosystemEvent) {
  ecoListeners.forEach((l) => l(e));
}

function emitRender() {
  renderListeners.forEach((l) => l());
}

export function subscribeBirds(cb: () => void): () => void {
  renderListeners.add(cb);
  return () => renderListeners.delete(cb);
}

/** Emit `visited_zone` only when the flock focus actually changes zones. */
function recordZoneVisit(flock: BirdFlockRuntime, z: BirdZone | null) {
  const nextId = z?.id ?? null;
  if (nextId === flock.currentZoneId) return;
  flock.previousZoneId = flock.currentZoneId;
  flock.currentZoneId = nextId;
  if (nextId && z) {
    emitEco({
      kind: "visited_zone",
      flockId: flock.id,
      zoneId: nextId,
      zoneType: z.type,
    });
  }
}

function transitionTo(
  flock: BirdFlockRuntime,
  next: BirdFlockState,
  simMs: number,
) {
  if (flock.state === next) return;
  flock.state = next;
  flock.lastTransitionSimTimeMs = simMs;
}

// —— flock factory ————————————————————————————————————————————————————

function createRuntimeFor(def: BirdFlockDefinition): BirdFlockRuntime {
  const roost = getBirdZone(def.homeRoostZoneId);
  const c: V3 = roost
    ? [...roost.position]
    : [0, heightAt(0, 0) + 16, 0];
  const slotHash = def.id.split("").reduce((s, ch) => s + ch.charCodeAt(0), 0);
  return {
    id: def.id,
    species: def.species,
    state: "ROOSTING",
    center: [...c],
    target: [...c],
    velocity: [0, 0, 0],
    birdCount: def.baseBirdCount,
    thirst: 0.28 + (slotHash % 100) / 400,
    restNeed: 0.5 + (slotHash % 80) / 400,
    fear: 0,
    currentZoneId: def.homeRoostZoneId,
    active: true,
    seedCarry: 0,
    lastTransitionSimTimeMs: 0,
    perchCount: 0,
    drinkCount: 0,
    forageCount: 0,
    onMap: true,
    homeRoostZoneId: def.homeRoostZoneId,
    baseBirdCount: def.baseBirdCount,
    wanderSlot: 1 + (slotHash % 4),
    shelterPick: slotHash % 7,
    previousZoneId: def.homeRoostZoneId,
    lastForageBucket: -1,
  };
}

const flocks: BirdFlockRuntime[] = birdFlockDefinitions.map(createRuntimeFor);

// —— target + altitude ————————————————————————————————————————————————

function preferredAltitude(state: BirdFlockState, groundY: number): number {
  switch (state) {
    case "ROOSTING":
      return groundY + 2.9;
    case "FLYING_TO_WATER":
      return groundY + 5.5;
    case "DRINKING":
      return groundY + 1.15;
    case "WANDERING":
      return groundY + 3.2;
    case "RETURNING":
      return groundY + 4.2;
    case "SHELTERING":
      return groundY + 3.4;
    case "OFF_MAP":
      return groundY + 20;
    default:
      return groundY + 4.5;
  }
}

function buildTarget(zone: BirdZone, state: BirdFlockState): V3 {
  const [tx, _ty, tz] = zone.position;
  const g = heightAt(tx, tz);
  const y = preferredAltitude(state, g);
  if (state === "DRINKING") {
    return [tx, g + 1.1 + Math.min(0.6, zone.radius * 0.08), tz];
  }
  if (state === "ROOSTING" || state === "SHELTERING") {
    return [tx, zone.position[1], tz];
  }
  return [tx, y, tz];
}

function resolveMovementTarget(
  flock: BirdFlockRuntime,
  snap: WorldTimeSnapshot,
  w: WeatherState,
): { zone: BirdZone; state: BirdFlockState } {
  const df = snap.dayFrac;
  const season = seasonForMonth(snap.monthIndex);
  const winter = winterActivityFactor(season, snap.monthIndex);

  if (winter < 0.08 || (w.type === "blizzard" && w.intensity > 0.75)) {
    const ex = exitZoneForFlock(flock.id);
    return { zone: ex, state: "OFF_MAP" };
  }

  if (isDangerousWeather(w.type) && w.intensity > 0.45) {
    const sh = shelterZoneFor(flock, snap.simMs);
    return { zone: sh, state: "SHELTERING" };
  }

  if (flock.fear > 0.78 && w.windStrength > 1.6) {
    const ex = exitZoneForFlock(flock.id);
    return { zone: ex, state: "OFF_MAP" };
  }

  if (isNight(df)) {
    const r = roostZoneFor(flock);
    if (distXZ(flock.center, r.position) > 12) {
      return { zone: r, state: "RETURNING" };
    }
    return { zone: r, state: "ROOSTING" };
  }

  const drinks = drinkZonesOrdered(flock.id);
  const morning = df >= 0.32 && df < 0.42;
  const drinkPhase = df >= 0.32 && df < 0.52;

  if (drinkPhase && flock.thirst > 0.42 && !isHeavyPrecip(w.type)) {
    const di = Math.min(drinks.length - 1, Math.max(0, Math.floor(df * 15) % drinks.length));
    return { zone: drinks[di], state: "FLYING_TO_WATER" };
  }

  if (drinkPhase && flock.thirst > 0.28 && isHeavyPrecip(w.type)) {
    const r = roostZoneFor(flock);
    return { zone: r, state: "RETURNING" };
  }

  if (morning && flock.thirst > 0.48) {
    return { zone: drinks[0], state: "FLYING_TO_WATER" };
  }

  if (df >= 0.42 && df < 0.58) {
    if (flock.thirst > 0.52 && w.windStrength < 1.15) {
      const di = (flock.wanderSlot + snap.dayOfYear) % drinks.length;
      return { zone: drinks[di], state: "FLYING_TO_WATER" };
    }
  }

  if (df >= 0.8 && df <= 0.86) {
    const r = roostZoneFor(flock);
    return { zone: r, state: "RETURNING" };
  }

  if (isHeavyPrecip(w.type) && w.intensity > 0.55) {
    const sh = shelterZoneFor(flock, snap.simMs);
    return { zone: sh, state: "SHELTERING" };
  }

  const wz = wanderTargetForSlot(flock, flock.wanderSlot, snap.simMs);
  return { zone: wz, state: "WANDERING" };
}

// —— main tick ——————————————————————————————————————————————————————————

function dwellOk(flock: BirdFlockRuntime, simMs: number): boolean {
  return simMs - flock.lastTransitionSimTimeMs >= STATE_DWELL_MIN_MS;
}

function tickOneFlock(
  flock: BirdFlockRuntime,
  dtSimMs: number,
  snap: WorldTimeSnapshot,
  w: WeatherState,
) {
  const dt = dtSimMs / 1000;
  const season = seasonForMonth(snap.monthIndex);
  const winter = winterActivityFactor(season, snap.monthIndex);

  flock.baseBirdCount = birdFlockDefinitions[0].baseBirdCount;
  flock.birdCount = Math.max(
    0,
    Math.round(flock.baseBirdCount * winter * (0.55 + 0.45 * (1 - flock.fear))),
  );

  if (flock.birdCount === 0) {
    flock.onMap = false;
    flock.active = false;
    transitionTo(flock, "OFF_MAP", snap.simMs);
    const ex = exitZoneForFlock(flock.id);
    flock.target = buildTarget(ex, "OFF_MAP");
    const moveMul0 = movementMultiplier(w);
    const to0 = sub(flock.target, flock.center);
    const dist0 = len(to0);
    const dir0 =
      dist0 > 1e-5 ? scale(to0, 1 / dist0) : ([0, 0, 0] as V3);
    const cruise0 = MAX_CRUISE_MS * 0.42 * moveMul0;
    flock.velocity = lerpV(
      flock.velocity,
      scale(dir0, cruise0),
      Math.min(1, 1.5 * dt),
    );
    flock.center = add(flock.center, scale(flock.velocity, dt));
    recordZoneVisit(flock, ex);
    return;
  }

  flock.onMap = flock.state !== "OFF_MAP";
  flock.active = true;

  if (isDangerousWeather(w.type)) {
    flock.fear = clamp01(flock.fear + FEAR_DANGER_GAIN * dtSimMs);
  } else {
    flock.fear = clamp01(flock.fear - FEAR_CALM_DECAY * dtSimMs);
  }

  const moveMul = movementMultiplier(w);
  const dangerous = isDangerousWeather(w.type) && w.intensity > 0.45;

  if (
    dangerous &&
    flock.state !== "SHELTERING" &&
    flock.state !== "OFF_MAP"
  ) {
    transitionTo(flock, "SHELTERING", snap.simMs);
  }

  if (isNight(snap.dayFrac) && flock.state === "WANDERING") {
    transitionTo(flock, "RETURNING", snap.simMs);
  }

  const { zone, state: desiredRaw } = resolveMovementTarget(flock, snap, w);
  let desiredState = desiredRaw;

  if (
    flock.state === "SHELTERING" &&
    !dangerous &&
    dwellOk(flock, snap.simMs)
  ) {
    desiredState = isNight(snap.dayFrac) ? "ROOSTING" : "WANDERING";
  }

  if (
    flock.state === "OFF_MAP" &&
    winter > 0.12 &&
    snap.dayFrac > 0.29 &&
    snap.dayFrac < 0.78 &&
    !dangerous
  ) {
    desiredState = "FLYING_TO_WATER";
    transitionTo(flock, "FLYING_TO_WATER", snap.simMs);
    const ent = entryZoneForFlock(flock.id);
    flock.target = buildTarget(ent, "FLYING_TO_WATER");
  }

  if (flock.state !== "OFF_MAP" && desiredState !== flock.state) {
    const urgent =
      desiredState === "OFF_MAP" ||
      (isDangerousWeather(w.type) && w.intensity > 0.45);
    if (urgent || dwellOk(flock, snap.simMs)) {
      transitionTo(flock, desiredState, snap.simMs);
    }
  }

  const workingState = flock.state;
  let targetZone = zone;

  if (workingState === "ROOSTING" || workingState === "RETURNING") {
    targetZone = roostZoneFor(flock);
  } else if (workingState === "FLYING_TO_WATER") {
    const drinks = drinkZonesOrdered(flock.id);
    const idx = snap.dayOfYear % Math.max(1, drinks.length);
    targetZone = drinks[idx] ?? targetZone;
  } else if (workingState === "DRINKING") {
    const drinks = drinkZonesOrdered(flock.id);
    const idx = flock.wanderSlot % Math.max(1, drinks.length);
    targetZone = drinks[idx] ?? targetZone;
  } else if (workingState === "WANDERING") {
    targetZone = wanderTargetForSlot(flock, flock.wanderSlot, snap.simMs);
  } else if (workingState === "SHELTERING") {
    targetZone = shelterZoneFor(flock, snap.simMs);
  } else if (workingState === "OFF_MAP") {
    targetZone = exitZoneForFlock(flock.id);
  }

  flock.target = buildTarget(targetZone, workingState);
  recordZoneVisit(flock, targetZone);

  const to = sub(flock.target, flock.center);
  const dist = len(to);
  const dir = dist > 1e-5 ? scale(to, 1 / dist) : [0, 0, 0] as V3;

  let cruise = MAX_CRUISE_MS * moveMul;
  if (workingState === "DRINKING") cruise *= 0.45;
  if (workingState === "ROOSTING" || workingState === "SHELTERING") cruise *= 0.35;
  if (workingState === "OFF_MAP") cruise *= 0.85;

  if (w.windStrength > 1.05 && workingState === "DRINKING") {
    cruise *= 0.65;
  }

  const desiredVel = scale(dir as V3, cruise);
  flock.velocity = lerpV(
    flock.velocity,
    desiredVel,
    Math.min(1, 1.55 * dt),
  );

  flock.center = add(flock.center, scale(flock.velocity, dt));

  const g = heightAt(flock.center[0], flock.center[2]);
  const prefY = preferredAltitude(workingState, g);
  flock.center[1] = lerp(flock.center[1], prefY, Math.min(1, 0.95 * dt));

  const arrive = workingState === "ROOSTING" || workingState === "RETURNING"
    ? ARRIVE_Z_ROOST
    : ARRIVE_EPS;

  if (workingState === "FLYING_TO_WATER" && distXZ(flock.center, flock.target) < arrive) {
    transitionTo(flock, "DRINKING", snap.simMs);
    emitEco({
      kind: "drank_at_lake",
      flockId: flock.id,
      zoneId: targetZone.id,
    });
    flock.drinkCount += 1;
  }

  if (workingState === "RETURNING" && distXZ(flock.center, flock.target) < ARRIVE_Z_ROOST) {
    transitionTo(flock, "ROOSTING", snap.simMs);
    emitEco({
      kind: "roosted",
      flockId: flock.id,
      zoneId: flock.homeRoostZoneId,
    });
    flock.perchCount += 1;
  }

  if (
    workingState === "DRINKING" &&
    flock.thirst < 0.1 &&
    snap.simMs - flock.lastTransitionSimTimeMs >= MIN_DRINK_DWELL_MS
  ) {
    flock.wanderSlot += 1;
    transitionTo(flock, "WANDERING", snap.simMs);
  }

  if (!isNight(snap.dayFrac) && flock.onMap) {
    flock.thirst = clamp01(flock.thirst + THIRST_DAY_RATE * dtSimMs * moveMul);
  }
  if (workingState === "DRINKING") {
    flock.thirst = clamp01(flock.thirst - THIRST_DRINK_RELIEF * dtSimMs);
  }

  if (workingState === "ROOSTING" || workingState === "SHELTERING") {
    flock.restNeed = clamp01(flock.restNeed - REST_ROOST_GAIN * dtSimMs);
  } else if (workingState !== "OFF_MAP") {
    flock.restNeed = clamp01(flock.restNeed + REST_FLIGHT_DRAIN * dtSimMs);
  }

  if (workingState === "WANDERING") {
    const bucket = Math.floor(snap.simMs / FORAGE_PERIOD_MS);
    const key =
      bucket * 31 +
      flock.id.charCodeAt(flock.id.length - 1) +
      flock.wanderSlot * 17;
    if (
      bucket !== flock.lastForageBucket &&
      key % 23 === 0 &&
      bucket >= 0
    ) {
      flock.forageCount += 1;
      flock.lastForageBucket = bucket;
    }
  }

  void season;
}

onTick((dtSimMs) => {
  if (dtSimMs <= 0) return;
  const snap = snapshot();
  const w = getWeather();
  for (const f of flocks) {
    tickOneFlock(f, dtSimMs, snap, w);
  }
  emitRender();
});

// —— public accessors ——————————————————————————————————————————————————

export function getBirdFlocks(): readonly BirdFlock[] {
  return flocks;
}

export interface BirdDebugSnapshot {
  flocks: Array<{
    id: string;
    state: BirdFlockState;
    birdCount: number;
    target: V3;
    currentZoneId: string | null;
    active: boolean;
    onMap: boolean;
    thirst: number;
    fear: number;
    shelterReason: string | null;
  }>;
}

export function getBirdDebugSnapshot(): BirdDebugSnapshot {
  const w = getWeather();
  let shelterReason: string | null = null;
  if (isDangerousWeather(w.type)) shelterReason = `weather:${w.type}`;
  else if (isHeavyPrecip(w.type) && w.intensity > 0.55)
    shelterReason = `precip:${w.type}`;
  return {
    flocks: flocks.map((f) => ({
      id: f.id,
      state: f.state,
      birdCount: f.birdCount,
      target: [...f.target],
      currentZoneId: f.currentZoneId,
      active: f.active,
      onMap: f.onMap,
      thirst: f.thirst,
      fear: f.fear,
      shelterReason: f.state === "SHELTERING" ? shelterReason : null,
    })),
  };
}
