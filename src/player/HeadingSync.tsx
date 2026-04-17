import { useMemo } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { playerRef } from "../systems/player/playerRef";

/**
 * Same yaw convention as three-stdlib PointerLockControls (Euler order YXZ).
 * Do NOT use getWorldDirection flattened to XZ — pitch changes that projection
 * and makes the compass spin while the view “only” tilts up/down.
 */
export default function HeadingSync() {
  const camera = useThree((s) => s.camera);
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, "YXZ"), []);

  useFrame(() => {
    euler.setFromQuaternion(camera.quaternion, "YXZ");
    const fx = -Math.sin(euler.y);
    const fz = -Math.cos(euler.y);
    playerRef.heading = Math.atan2(fx, fz);
  });

  return null;
}
