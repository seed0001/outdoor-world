/**
 * Collectible minerals from breaking rocks. Each rock has a dominant vein
 * (`rockRegistry`); pickups carry both raw stone and vein minerals.
 */

export type MineralKind = 0 | 1 | 2 | 3 | 4;

export const MINERAL_KINDS: readonly MineralKind[] = [0, 1, 2, 3, 4];

/** Inventory keys — keep in sync with `MINERAL_KINDS` order. */
export const MINERAL_INVENTORY_KEYS = [
  "iron_ore",
  "copper_ore",
  "quartz",
  "sulfur",
  "salt",
] as const;

export type MineralInventoryKey = (typeof MINERAL_INVENTORY_KEYS)[number];

export const MINERAL_NAMES: readonly string[] = [
  "Iron ore",
  "Copper ore",
  "Quartz",
  "Sulfur",
  "Salt",
];

export function mineralKindToKey(kind: MineralKind): MineralInventoryKey {
  return MINERAL_INVENTORY_KEYS[kind];
}

export function mineralKindName(kind: MineralKind): string {
  return MINERAL_NAMES[kind] ?? "Mineral";
}

/** World pickup mesh / rock tint hints. */
export function mineralSampleColor(kind: MineralKind): string {
  switch (kind) {
    case 0:
      return "#8a5c4a";
    case 1:
      return "#3d8a72";
    case 2:
      return "#d8e0e8";
    case 3:
      return "#c9c040";
    case 4:
      return "#e8e4dc";
    default:
      return "#9a9488";
  }
}

/** Deterministic dominant vein from rock id (stable across sessions). */
export function mineralVeinFromRockId(id: number): MineralKind {
  return (((id * 2654435761) >>> 0) % 5) as MineralKind;
}
