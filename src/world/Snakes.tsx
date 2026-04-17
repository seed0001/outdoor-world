import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import { snakes, type SnakeSpec } from "../systems/world/snakeRegistry";

const MODEL_URL = "/models/timber-rattlesnake.glb";

useGLTF.preload(MODEL_URL);

export default function Snakes() {
  const gltf = useGLTF(MODEL_URL) as unknown as {
    scene: THREE.Group;
    animations: THREE.AnimationClip[];
  };

  const baseScale = useMemo(() => {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const longest = Math.max(size.x, size.y, size.z);
    if (longest < 0.01) return 1;
    // Target a max dimension of ~1.4m (timber rattlesnakes are ~1-1.5m long).
    return 1.4 / longest;
  }, [gltf.scene]);

  const groundOffset = useMemo(() => {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    return -box.min.y;
  }, [gltf.scene]);

  return (
    <group>
      {snakes.map((spec) => (
        <Snake
          key={spec.id}
          spec={spec}
          template={gltf.scene}
          clips={gltf.animations}
          baseScale={baseScale}
          groundOffset={groundOffset}
        />
      ))}
    </group>
  );
}

interface SnakeProps {
  spec: SnakeSpec;
  template: THREE.Group;
  clips: THREE.AnimationClip[];
  baseScale: number;
  groundOffset: number;
}

function Snake({ spec, template, clips, baseScale, groundOffset }: SnakeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  const instance = useMemo(() => {
    const cloned = SkeletonUtils.clone(template);
    cloned.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    return cloned;
  }, [template]);

  useEffect(() => {
    if (clips.length === 0) {
      mixerRef.current = null;
      return;
    }
    const mixer = new THREE.AnimationMixer(instance);
    const clip = clips[0];
    const action = mixer.clipAction(clip);
    action.timeScale = spec.animSpeed;
    action.time = spec.animPhase * clip.duration;
    action.play();
    mixerRef.current = mixer;
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(instance);
      mixerRef.current = null;
    };
  }, [instance, clips, spec.animPhase, spec.animSpeed]);

  useFrame((_, dt) => {
    const mixer = mixerRef.current;
    if (mixer) {
      mixer.update(dt);
    } else if (groupRef.current) {
      // No animations in the GLB — apply a subtle idle sway so it isn't frozen.
      const t = performance.now() * 0.001;
      groupRef.current.rotation.z =
        Math.sin(t * spec.animSpeed + spec.animPhase * 6.28) * 0.06;
    }
  });

  return (
    <group
      ref={groupRef}
      position={[spec.x, spec.y + groundOffset * baseScale * spec.scale, spec.z]}
      rotation={[0, spec.rot, 0]}
      scale={baseScale * spec.scale}
    >
      <primitive object={instance} />
    </group>
  );
}
