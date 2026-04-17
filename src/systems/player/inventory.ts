import { useEffect, useState } from "react";

const listeners = new Set<() => void>();

export type InventoryItem = "stick" | "stone";

const counts: Record<InventoryItem, number> = {
  stick: 0,
  stone: 0,
};

function emit() {
  listeners.forEach((l) => l());
}

export const inventory = {
  get(): Readonly<Record<InventoryItem, number>> {
    return counts;
  },
  reset() {
    counts.stick = 0;
    counts.stone = 0;
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
