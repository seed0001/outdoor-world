import { inventory, type InventoryItem } from "../player/inventory";

export const GRID_DIM = 12;
export const GRID_CELLS = GRID_DIM * GRID_DIM;
/** Time on the grill before raw becomes cooked. */
export const COOK_DURATION_MS = 14_000;

/** Horizontal reach (m) to use grill / see overlay (XZ from player to fire). */
export const CAMPFIRE_INTERACT_RADIUS = 4;

export type RawMeat = "raw_rat" | "raw_snake" | "raw_fish";
export type CookedMeat = "cooked_rat" | "cooked_snake" | "cooked_fish";

export type GrillCell =
  | { k: "empty" }
  | { k: "cooking"; raw: RawMeat; startedAt: number }
  | { k: "ready"; cooked: CookedMeat };

const RAW_TO_COOKED: Record<RawMeat, CookedMeat> = {
  raw_rat: "cooked_rat",
  raw_snake: "cooked_snake",
  raw_fish: "cooked_fish",
};

const RAW_ORDER: RawMeat[] = ["raw_rat", "raw_snake", "raw_fish"];

const grids = new Map<number, GrillCell[]>();
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

function ensureGrid(fireId: number): GrillCell[] {
  let g = grids.get(fireId);
  if (!g) {
    g = Array.from({ length: GRID_CELLS }, () => ({ k: "empty" } as GrillCell));
    grids.set(fireId, g);
  }
  return g;
}

export const campfireCooking = {
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },

  getGrid(fireId: number): readonly GrillCell[] {
    return ensureGrid(fireId);
  },

  /** Advance timers; moves cooking cells to ready when duration elapsed. */
  tick(now: number): void {
    let changed = false;
    for (const g of grids.values()) {
      for (let i = 0; i < g.length; i++) {
        const c = g[i];
        if (c.k === "cooking" && now - c.startedAt >= COOK_DURATION_MS) {
          g[i] = { k: "ready", cooked: RAW_TO_COOKED[c.raw] };
          changed = true;
        }
      }
    }
    if (changed) emit();
  },

  tryCollect(fireId: number): boolean {
    const grid = ensureGrid(fireId);
    const idx = grid.findIndex((c) => c.k === "ready");
    if (idx < 0) return false;
    const c = grid[idx] as Extract<GrillCell, { k: "ready" }>;
    inventory.add(c.cooked, 1);
    grid[idx] = { k: "empty" };
    emit();
    return true;
  },

  /** First empty slot gets one raw piece from inventory (priority rat → snake → fish). */
  tryDeposit(fireId: number): boolean {
    const inv = inventory.get();
    let raw: RawMeat | null = null;
    for (const r of RAW_ORDER) {
      if (inv[r] > 0) {
        raw = r;
        break;
      }
    }
    if (!raw) return false;
    const grid = ensureGrid(fireId);
    const idx = grid.findIndex((c) => c.k === "empty");
    if (idx < 0) return false;
    const part: Partial<Record<InventoryItem, number>> = { [raw]: 1 };
    if (!inventory.tryConsume(part)) return false;
    grid[idx] = { k: "cooking", raw, startedAt: performance.now() };
    emit();
    return true;
  },
};
