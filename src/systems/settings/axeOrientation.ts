const DEG = Math.PI / 180;

/**
 * Held axe mesh rotation (radians): pitch X, yaw Y, roll Z (`order="XYZ"`).
 * Tuned for `public/models/axe/axe.glb` — handle at hand, blade arcs toward the sky (chop plane).
 */
export const AXE_ORIENTATION_RAD: readonly [number, number, number] = [
  -58 * DEG + Math.PI,
  28 * DEG,
  78 * DEG,
];
