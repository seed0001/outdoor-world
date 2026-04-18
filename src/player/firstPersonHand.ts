import * as THREE from "three";

/**
 * Right / down / forward in camera local space (Three.js camera −Z is view).
 * Used for both the held axe rig and melee chop rays so swings line up with hits.
 */
export const HAND_OFFSET = new THREE.Vector3(0.42, -0.34, -0.58);

/** World-space point at the right-hand hold (camera + rotated offset). */
export function handWorldPosition(
  camera: THREE.Camera,
  out: THREE.Vector3,
): THREE.Vector3 {
  return out
    .copy(HAND_OFFSET)
    .applyQuaternion(camera.quaternion)
    .add(camera.position);
}
