import { useEffect, useRef } from "react";
import { heightAt, insideLake } from "../world/terrain";
import { playerRef } from "../systems/player/playerRef";
import { inventory, type InventoryItem } from "../systems/player/inventory";
import { campfires } from "../systems/world/campfires";
import { CAMPFIRE_INTERACT_RADIUS } from "../systems/world/campfireCooking";
import { isBackpackOpen, setBackpackOpen } from "../systems/ui/backpackState";
import {
  isCampfireGrillOpen,
  toggleCampfireGrill,
} from "../systems/ui/campfireGrillUi";
import { releasePointerLockForUI } from "../systems/ui/pointerLock";
import { health } from "../systems/player/health";
import { vitals } from "../systems/player/vitals";

const STICKS_COST = 10;
const STONES_COST = 6;
const PLACE_FORWARD = 1.65;
const GRILL_COOLDOWN_MS = 280;
const PLACE_FIRE_COOLDOWN_MS = 320;
const EAT_COOLDOWN_MS = 650;
const DRINK_COOLDOWN_MS = 550;

const COOKED_ORDER: InventoryItem[] = [
  "cooked_rat",
  "cooked_snake",
  "cooked_fish",
];

const HEAL_EAT = 14;
const FOOD_FROM_MEAT = 38;
const HEAL_DRINK = 10;
const WATER_FROM_DRINK = 42;

/**
 * Separate keys: G grill, V drink, E eat, F place campfire (no overlap).
 */
export default function ActionFSystem() {
  const lastGrill = useRef(0);
  const lastDrink = useRef(0);
  const lastEat = useRef(0);
  const lastPlaceFire = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (health.get().dead) return;

      const now = performance.now();
      const p = playerRef.position;
      const fireHere = campfires.nearest(
        p.x,
        p.y,
        p.z,
        CAMPFIRE_INTERACT_RADIUS,
      );
      const ptr = !!document.pointerLockElement;

      /** G toggles fire grill grid whenever a campfire is in range (open or close). */
      if (e.code === "KeyG") {
        if (!fireHere) return;
        if (now - lastGrill.current < GRILL_COOLDOWN_MS) return;
        e.preventDefault();
        if (isBackpackOpen()) setBackpackOpen(false);
        const wasOpen = isCampfireGrillOpen();
        toggleCampfireGrill();
        const nowOpen = isCampfireGrillOpen();
        if (!wasOpen && nowOpen && ptr) {
          releasePointerLockForUI();
        }
        lastGrill.current = now;
        return;
      }

      if (isBackpackOpen()) return;

      if (e.code === "KeyV") {
        if (!ptr) return;
        if (!insideLake(p.x, p.z, 0.85)) return;
        e.preventDefault();
        if (now - lastDrink.current < DRINK_COOLDOWN_MS) return;
        vitals.addWater(WATER_FROM_DRINK);
        health.heal(HEAL_DRINK);
        lastDrink.current = now;
        return;
      }

      if (e.code === "KeyE") {
        if (!ptr) return;
        if (now - lastEat.current < EAT_COOLDOWN_MS) return;
        for (const key of COOKED_ORDER) {
          const part: Partial<Record<InventoryItem, number>> = { [key]: 1 };
          if (!inventory.tryConsume(part)) continue;
          e.preventDefault();
          vitals.addFood(FOOD_FROM_MEAT);
          health.heal(HEAL_EAT);
          lastEat.current = now;
          return;
        }
        return;
      }

      if (e.code === "KeyF") {
        if (!ptr) return;
        if (fireHere) return;
        if (insideLake(p.x, p.z, 0.85)) return;
        if (now - lastPlaceFire.current < PLACE_FIRE_COOLDOWN_MS) return;

        const c = inventory.get();
        if (c.stick < STICKS_COST || c.stone < STONES_COST) return;

        const h = playerRef.heading;
        const x = p.x + Math.sin(h) * PLACE_FORWARD;
        const z = p.z + Math.cos(h) * PLACE_FORWARD;
        if (insideLake(x, z, 2)) return;

        const y = heightAt(x, z);
        e.preventDefault();
        if (!inventory.tryConsume({ stick: STICKS_COST, stone: STONES_COST }))
          return;
        campfires.add(x, y, z);
        lastPlaceFire.current = now;
        return;
      }
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  return null;
}
