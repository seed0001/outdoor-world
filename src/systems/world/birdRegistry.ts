import { birdZonesOfType } from "./birdZoneRegistry";
import { BIRD_FLOCK_DEF_SEED } from "./worldSeed";

export type BirdSpecies = "small_songbird";

/** Static flock layout: deterministic choice of home roost from registry zones. */
export interface BirdFlockDefinition {
  id: string;
  species: BirdSpecies;
  baseBirdCount: number;
  homeRoostZoneId: string;
}

function pickHomeRoostId(): string {
  const roosts = birdZonesOfType("ROOST");
  if (roosts.length === 0) {
    const w = birdZonesOfType("WANDER");
    return w[0]?.id ?? "wander-0";
  }
  const idx = ((BIRD_FLOCK_DEF_SEED * 2654435761) >>> 0) % roosts.length;
  return roosts[idx].id;
}

export const birdFlockDefinitions: ReadonlyArray<BirdFlockDefinition> = [
  {
    id: "flock-0",
    species: "small_songbird",
    baseBirdCount: 26,
    homeRoostZoneId: pickHomeRoostId(),
  },
];
