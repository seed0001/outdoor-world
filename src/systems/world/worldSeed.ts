/**
 * Deterministic world vegetation: fixed seeds + stable placement code mean the same
 * plants appear in the same places on every page load — nothing is re-rolled on refresh.
 *
 * Bump a seed only when you intentionally want to reshuffle that layer of the world.
 */
export const TREE_PLACEMENT_SEED = 1338;
export const FLOWER_PLACEMENT_SEED = 76542;
export const BUTTERFLY_PLACEMENT_SEED = 88441;
