import { useFrame } from "@react-three/fiber";
import { playerRef } from "../systems/player/playerRef";
import { vitals } from "../systems/player/vitals";
import { campfires } from "../systems/world/campfires";
import { health } from "../systems/player/health";
import { isSurviveMode } from "../systems/settings/playMode";

/** Food drain is handled by `systems/player/survival.ts` (worldClock sim time). */
const WATER_DRAIN = 0.092;

/**
 * Sanity only drops when hunger AND thirst are extra low together.
 * Otherwise it slowly recovers toward 100.
 */
const EXTRA_LOW_FOOD = 18;
const EXTRA_LOW_WATER = 18;
const SANITY_CRISIS_DRAIN = 0.16;
const SANITY_RECOVERY = 0.055;
const NEAR_FIRE_SANITY_BONUS = 0.1;
const WELL_FED_SANITY_BONUS = 0.035;

export default function VitalsSystem() {
  useFrame((_, dt) => {
    if (!isSurviveMode()) return;
    if (health.get().dead) return;

    const v = vitals.get();
    vitals.tickWater(-WATER_DRAIN, dt);

    const p = playerRef.position;
    const nearFire = campfires.isNear(p.x, p.y, p.z, 3.2);
    const wellFed = v.food > 48 && v.water > 48;

    const bothExtraLow =
      v.food < EXTRA_LOW_FOOD && v.water < EXTRA_LOW_WATER;

    let sanityDelta = 0;
    if (bothExtraLow) {
      sanityDelta -= SANITY_CRISIS_DRAIN;
    } else if (v.sanity < 100) {
      sanityDelta += SANITY_RECOVERY;
    }
    if (nearFire && v.sanity < 100) {
      sanityDelta += NEAR_FIRE_SANITY_BONUS;
    }
    if (wellFed && v.sanity < 100) {
      sanityDelta += WELL_FED_SANITY_BONUS;
    }

    vitals.tickSanity(sanityDelta, dt);
  });

  return null;
}
