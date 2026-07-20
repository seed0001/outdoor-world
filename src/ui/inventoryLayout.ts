import type { InventoryItem } from "../systems/player/inventory";
import {
  MINERAL_INVENTORY_KEYS,
  MINERAL_NAMES,
} from "../systems/world/mineralRegistry";

export type BackpackItemSlot = {
  item: InventoryItem;
  title: string;
};

/** Display order for the backpack — one large tile per inventory type. */
export const BACKPACK_ITEMS: BackpackItemSlot[] = [
  { item: "stick", title: "Sticks" },
  { item: "wood", title: "Wood" },
  { item: "stone", title: "Stone" },
  { item: "arrow", title: "Arrows" },
  { item: "wildflower", title: "Daisies" },
  { item: "petal_flower", title: "Petal flowers" },
  { item: "rose", title: "Roses" },
  { item: "sturdy_frame", title: "Sturdy shelter kit (B to place)" },
  ...MINERAL_INVENTORY_KEYS.map((item, i) => ({
    item,
    title: MINERAL_NAMES[i] ?? "Mineral",
  })),
  { item: "raw_rat", title: "Raw rat" },
  { item: "raw_snake", title: "Raw snake" },
  { item: "raw_fish", title: "Raw fish" },
  { item: "cooked_rat", title: "Cooked rat" },
  { item: "cooked_snake", title: "Cooked snake" },
  { item: "cooked_fish", title: "Cooked fish" },
];

export const BACKPACK_GRID_COLS = 4;
