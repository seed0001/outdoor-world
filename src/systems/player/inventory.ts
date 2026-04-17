import { useEffect, useState } from "react";
import {
  MINERAL_INVENTORY_KEYS,
  type MineralInventoryKey,
} from "../world/mineralRegistry";

const listeners = new Set<() => void>();

export type InventoryItem =
  | "stick"
  | "stone"
  | MineralInventoryKey;

function emptyCounts(): Record<InventoryItem, number> {
  const m = {
    stick: 0,
    stone: 0,
  } as Record<InventoryItem, number>;
  for (const k of MINERAL_INVENTORY_KEYS) {
    m[k] = 0;
  }
  return m;
}

const counts: Record<InventoryItem, number> = emptyCounts();

function emit() {
  listeners.forEach((l) => l());
}

export const inventory = {
  get(): Readonly<Record<InventoryItem, number>> {
    return counts;
  },
  reset() {
    const z = emptyCounts();
    (Object.keys(z) as InventoryItem[]).forEach((k) => {
      counts[k] = z[k];
    });
    emit();
  },
  add(item: InventoryItem, n: number) {
    if (n <= 0) return;
    counts[item] += n;
    emit();
  },
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};

/** Re-render when inventory changes (for React HUD). */
export function useInventory(): Record<InventoryItem, number> {
  const [, bump] = useState(0);
  useEffect(() => inventory.subscribe(() => bump((n) => n + 1)), []);
  return { ...counts };
}
