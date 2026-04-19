import {
  HALF_X,
  WORLD_MAX_Z,
  GRASS_BIOME_Z_MIN,
  LAKE_CENTER_X,
  LAKE_CENTER_Z,
  LAKE_OUTER_R,
  heightAt,
  insideLake,
  mulberry32,
} from "../../world/terrain";
import { trees } from "./treeRegistry";
import { BIRD_ZONE_SEED } from "./worldSeed";

/** Ecological zone tags used by the bird ecosystem (roost, water, travel, shelter). */
export type BirdZoneType =
  | "ROOST"
  | "DRINK"
  | "WANDER"
  | "ENTRY"
  | "EXIT"
  | "SHELTER";

export interface BirdZone {
  id: string;
  type: BirdZoneType;
  position: [number, number, number];
  radius: number;
  weight: number;
}

const ROOST_FROM_TREES = 16;
const SHELTER_ZONES = 10;
const DRINK_SLOTS = 10;
/** Daytime hop / forage spots — anchored to real trees, not open grass. */
const WANDER_ZONES = 16;
const ENTRY_EXIT_EACH = 3;

/** Minimum distance from lake center for a roost tree (songbirds avoid open water at night). */
const ROOST_LAKE_CLEARANCE = LAKE_OUTER_R + 7;

function buildZones(): BirdZone[] {
  const rand = mulberry32(BIRD_ZONE_SEED);
  const zones: BirdZone[] = [];

  const treeCandidates = trees
    .map((t, i) => ({
      t,
      i,
      lakeD: Math.hypot(t.x - LAKE_CENTER_X, t.z - LAKE_CENTER_Z),
    }))
    .filter(
      (o) =>
        o.lakeD > ROOST_LAKE_CLEARANCE && !insideLake(o.t.x, o.t.z, 2.5),
    )
    .map((o) => ({
      ...o,
      sortKey: (o.i * 1103515245 + BIRD_ZONE_SEED) >>> 0,
    }))
    .sort((a, b) => a.sortKey - b.sortKey);

  for (let k = 0; k < ROOST_FROM_TREES && k < treeCandidates.length; k++) {
    const { t } = treeCandidates[k];
    const canopyY = t.y + t.trunkHeight + t.foliageHeight * 0.62;
    zones.push({
      id: `roost-${k}`,
      type: "ROOST",
      position: [t.x, canopyY, t.z],
      radius: Math.max(2.4, t.foliageRadius * 1.12),
      weight: 0.75 + rand() * 0.45,
    });
  }

  for (let k = 0; k < SHELTER_ZONES && k < treeCandidates.length; k++) {
    const { t } = treeCandidates[(k * 7 + 3) % treeCandidates.length];
    const y = t.y + t.trunkHeight + t.foliageHeight * 0.38;
    zones.push({
      id: `shelter-${k}`,
      type: "SHELTER",
      position: [
        t.x + (rand() - 0.5) * 2.2,
        y,
        t.z + (rand() - 0.5) * 2.2,
      ],
      radius: 2.1 + rand() * 1.35,
      weight: 1.15,
    });
  }

  for (let i = 0; i < DRINK_SLOTS; i++) {
    const angle = (i / DRINK_SLOTS) * Math.PI * 2 + (rand() - 0.5) * 0.12;
    const r = LAKE_OUTER_R + 1.35 + rand() * 0.95;
    const x = LAKE_CENTER_X + Math.cos(angle) * r;
    const z = LAKE_CENTER_Z + Math.sin(angle) * r;
    const g = heightAt(x, z);
    zones.push({
      id: `drink-${i}`,
      type: "DRINK",
      position: [x, g + 0.2, z],
      radius: 2.8 + rand() * 1.2,
      weight: 1,
    });
  }

  for (let i = 0; i < WANDER_ZONES && treeCandidates.length > 0; i++) {
    const { t } = treeCandidates[(i * 5 + 13) % treeCandidates.length];
    const ox = (rand() - 0.5) * 5;
    const oz = (rand() - 0.5) * 5;
    const x = t.x + ox;
    const z = t.z + oz;
    if (insideLake(x, z, 4)) continue;
    const g = heightAt(x, z);
    zones.push({
      id: `wander-${i}`,
      type: "WANDER",
      position: [x, g + 2.2 + rand() * 1.6, z],
      radius: 4.5 + rand() * 3.5,
      weight: 0.82 + rand() * 0.2,
    });
  }

  const edgeZSamples = [
    WORLD_MAX_Z - 18,
    (GRASS_BIOME_Z_MIN + WORLD_MAX_Z) * 0.5,
    GRASS_BIOME_Z_MIN + 25,
  ];
  for (let i = 0; i < ENTRY_EXIT_EACH; i++) {
    const x = -HALF_X + 10 + rand() * 5;
    const z = edgeZSamples[i % edgeZSamples.length] + (rand() - 0.5) * 22;
    const g = heightAt(x, z);
    zones.push({
      id: `entry-${i}`,
      type: "ENTRY",
      position: [x, g + 22 + rand() * 8, z],
      radius: 18,
      weight: 0.55,
    });
  }
  for (let i = 0; i < ENTRY_EXIT_EACH; i++) {
    const x = HALF_X - 10 - rand() * 5;
    const z = edgeZSamples[(i + 1) % edgeZSamples.length] + (rand() - 0.5) * 26;
    const g = heightAt(x, z);
    zones.push({
      id: `exit-${i}`,
      type: "EXIT",
      position: [x, g + 22 + rand() * 8, z],
      radius: 18,
      weight: 0.55,
    });
  }

  return zones;
}

export const birdZones: ReadonlyArray<BirdZone> = buildZones();

const byType = new Map<BirdZoneType, BirdZone[]>();
for (const z of birdZones) {
  const arr = byType.get(z.type) ?? [];
  arr.push(z);
  byType.set(z.type, arr);
}

const idMap = new Map<string, BirdZone>();
for (const z of birdZones) idMap.set(z.id, z);

export function birdZonesOfType(t: BirdZoneType): BirdZone[] {
  return byType.get(t) ?? [];
}

export function getBirdZone(id: string): BirdZone | undefined {
  return idMap.get(id);
}
