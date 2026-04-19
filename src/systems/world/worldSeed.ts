/**
 * Deterministic world vegetation: fixed seeds + stable placement code mean the same
 * plants appear in the same places on every page load — nothing is re-rolled on refresh.
 *
 * Bump a seed only when you intentionally want to reshuffle that layer of the world.
 */
export const TREE_PLACEMENT_SEED = 1338;
export const FLOWER_PLACEMENT_SEED = 76542;
export const BUTTERFLY_PLACEMENT_SEED = 88441;
export const BEE_PLACEMENT_SEED = 77331;
export const COLORED_FLOWER_PATCH_SEED = 55881;
export const ROSE_FLOWER_PLACEMENT_SEED = 66121;
/** Ecological zones + flock definitions for migratory / flocking birds. */
export const BIRD_ZONE_SEED = 88220;
export const BIRD_FLOCK_DEF_SEED = 99221;

/** Seeded mesh instances for `public/models/desert-trees` (south desert band). */
export const DESERT_TREE_PLACEMENT_SEED = 44219;
/** Seeded placements for `tree.glb` in the same desert band (separate RNG stream). */
export const DESERT_GLB_TREE_PLACEMENT_SEED = 52107;
