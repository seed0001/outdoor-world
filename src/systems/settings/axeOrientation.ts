const DEG = Math.PI / 180;

/**
 * Held axe mesh rotation (radians): pitch X, yaw Y, roll Z.
 * Default for `public/models/axe/axe.glb` (153°, −23°, 87°).
 */
export const AXE_ORIENTATION_RAD: readonly [number, number, number] = [
  153 * DEG,
  -23 * DEG,
  87 * DEG,
];
