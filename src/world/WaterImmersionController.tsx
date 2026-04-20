import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { playerRef } from "../systems/player/playerRef";
import { EYE_OFFSET } from "../player/Player";
import { LAKE_WATER_Y, insideLake } from "./terrain";
import { setWaterImmersion } from "../systems/player/waterImmersion";

/**
 * Runs inside the Canvas. Each frame, checks the camera eye against the lake
 * and publishes the immersion state for DOM overlays + tweaks scene fog while
 * submerged so everything visible through the water picks up a blue cast.
 */
export default function WaterImmersionController() {
  const scene = useThree((s) => s.scene);

  // Remember the original fog so we can restore it when leaving the water.
  const savedFog = useFogSnapshot(scene);

  useFrame(() => {
    const eyeY = playerRef.position.y + EYE_OFFSET;
    const submerged =
      insideLake(playerRef.position.x, playerRef.position.z) &&
      eyeY < LAKE_WATER_Y;
    const depth = submerged ? Math.max(0, LAKE_WATER_Y - eyeY) : 0;
    setWaterImmersion({ submerged, depth });

    if (scene.fog instanceof THREE.Fog) {
      if (submerged) {
        // Deeper = murkier. Sky.tsx keeps writing fog each frame; we override
        // after its write on the same tick since this component is registered
        // later in GameRoot's tree. Very short range so the world beyond a
        // few metres of the player dissolves into murk.
        const k = THREE.MathUtils.clamp(depth / 3.5, 0, 1);
        const near = THREE.MathUtils.lerp(1.5, 0.5, k);
        const far = THREE.MathUtils.lerp(9, 4, k);
        scene.fog.color.setRGB(0.025, 0.10, 0.18);
        scene.fog.near = near;
        scene.fog.far = far;
      }
    }
  });

  // When we stop being submerged, push the last-known Sky fog values back in
  // so the first frame after surfacing isn't blue. Sky.tsx will overwrite on
  // the very next frame anyway.
  useEffect(() => {
    return () => {
      if (scene.fog instanceof THREE.Fog && savedFog.current) {
        scene.fog.color.copy(savedFog.current.color);
        scene.fog.near = savedFog.current.near;
        scene.fog.far = savedFog.current.far;
      }
    };
  }, [scene, savedFog]);

  return null;
}

function useFogSnapshot(scene: THREE.Scene) {
  const ref = useRef<null | { color: THREE.Color; near: number; far: number }>(
    null,
  );
  useEffect(() => {
    if (scene.fog instanceof THREE.Fog) {
      ref.current = {
        color: scene.fog.color.clone(),
        near: scene.fog.near,
        far: scene.fog.far,
      };
    }
  }, [scene]);
  return ref;
}
