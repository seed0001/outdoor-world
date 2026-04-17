import type { RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";

interface PlayerRef {
  body: RapierRigidBody | null;
  spawn: [number, number, number];
  /** Pending camera shake amplitude (decays each frame in Player.tsx). */
  shake: number;
  /** Last known translation for fast reads outside useFrame. */
  position: THREE.Vector3;
}

export const playerRef: PlayerRef = {
  body: null,
  spawn: [0, 6, 0],
  shake: 0,
  position: new THREE.Vector3(),
};

export function addCameraShake(amount: number) {
  playerRef.shake = Math.min(2, playerRef.shake + amount);
}
