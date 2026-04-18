import { useEffect, useState } from "react";
import {
  MINERAL_INVENTORY_KEYS,
  type MineralInventoryKey,
} from "../world/mineralRegistry";

const listeners = new Set<() => void>();

export type InventoryItem =
  | "stick"
  | "stone"
  | "arrow"
  | "raw_rat"
  | "raw_snake"
  | "raw_fish"
  | "cooked_rat"
  | "cooked_snake"
  | "cooked_fish"
  | MineralInventoryKey;

function emptyCounts(): Record<InventoryItem, number> {
  const m = {
    stick: 0,
    stone: 0,
    arrow: 0,
    raw_rat: 0,
    raw_snake: 0,
    raw_fish: 0,
    cooked_rat: 0,
    cooked_snake: 0,
    cooked_fish: 0,
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
  /** Returns false if any requested amount is not available. */
  tryConsume(req: Partial<Record<InventoryItem, number>>): boolean {
    const entries = Object.entries(req) as [InventoryItem, number][];
    for (const [k, v] of entries) {
      if (v <= 0) continue;
      if (counts[k] < v) return false;
    }
    for (const [k, v] of entries) {
      if (v > 0) counts[k] -= v;
    }
    emit();
    return true;
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
