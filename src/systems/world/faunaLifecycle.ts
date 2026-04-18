import { inventory, type InventoryItem } from "../player/inventory";

export type FaunaKind = "snake" | "rat" | "fish";

/** Time until the same animal id respawns at its spawn / patrol logic. */
export const FAUNA_RESPAWN_MS = 72_000;

const RAW_ITEM: Record<FaunaKind, InventoryItem> = {
  snake: "raw_snake",
  rat: "raw_rat",
  fish: "raw_fish",
};

function key(kind: FaunaKind, id: number): string {
  return `${kind}:${id}`;
}

const deadKeys = new Set<string>();
const respawnAtMs = new Map<string, number>();

export function isFaunaAlive(
  kind: FaunaKind,
  id: number,
  now = performance.now(),
): boolean {
  const k = key(kind, id);
  if (!deadKeys.has(k)) return true;
  const at = respawnAtMs.get(k);
  if (at !== undefined && now >= at) {
    deadKeys.delete(k);
    respawnAtMs.delete(k);
    return true;
  }
  return false;
}

/** Returns false if already dead or not yet respawned. */
export function killFauna(kind: FaunaKind, id: number): boolean {
  const now = performance.now();
  if (!isFaunaAlive(kind, id, now)) return false;
  const k = key(kind, id);
  deadKeys.add(k);
  respawnAtMs.set(k, now + FAUNA_RESPAWN_MS);
  inventory.add(RAW_ITEM[kind], 1);
  return true;
}
