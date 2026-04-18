import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { insideLake, terrainRayHit } from "./terrain";
import {
  isSturdyPlacementInWorldBounds,
  isSturdyPlacementMode,
  sturdyPreviewTarget,
  subscribeSturdyPlacement,
} from "../systems/ui/sturdyPlacementState";

const RAY_LEN = 120;

/**
 * Ground ring while placing a sturdy shelter; updates {@link sturdyPreviewTarget} each frame.
 */
export default function SturdyPlacementPreview() {
  const { camera } = useThree();
  const [active, setActive] = useState(isSturdyPlacementMode);
  const groupRef = useRef<THREE.Group>(null);
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const dir = useRef(new THREE.Vector3());
  const origin = useRef(new THREE.Vector3());

  useEffect(
    () =>
      subscribeSturdyPlacement(() => {
        setActive(isSturdyPlacementMode());
      }),
    [],
  );

  useFrame(() => {
    const g = groupRef.current;
    const mat = ringMatRef.current;
    if (!g || !mat) return;

    if (!active) {
      g.visible = false;
      sturdyPreviewTarget.valid = false;
      return;
    }

    g.visible = true;

    camera.getWorldPosition(origin.current);
    camera.getWorldDirection(dir.current);
    const hit = terrainRayHit(
      origin.current.x,
      origin.current.y,
      origin.current.z,
      dir.current.x,
      dir.current.y,
      dir.current.z,
      RAY_LEN,
    );

    if (!hit) {
      sturdyPreviewTarget.valid = false;
      return;
    }

    const blocked =
      insideLake(hit.x, hit.z, 2.2) ||
      !isSturdyPlacementInWorldBounds(hit.x, hit.z);

    sturdyPreviewTarget.x = hit.x;
    sturdyPreviewTarget.y = hit.y;
    sturdyPreviewTarget.z = hit.z;
    sturdyPreviewTarget.valid = !blocked;

    g.position.set(hit.x, hit.y + 0.04, hit.z);
    mat.color.setHex(sturdyPreviewTarget.valid ? 0x55ee88 : 0xee8855);
    mat.opacity = sturdyPreviewTarget.valid ? 0.72 : 0.45;
  });

  return (
    <group ref={groupRef} renderOrder={10}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.38, 0.62, 48]} />
        <meshBasicMaterial
          ref={ringMatRef}
          color={0x55ee88}
          transparent
          opacity={0.72}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
