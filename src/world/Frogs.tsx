import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import { frogs, type FrogSpec } from "../systems/world/frogRegistry";

const MODEL_URL = "/models/frog/frog.glb";

export default function Frogs() {
  const { scene } = useGLTF(MODEL_URL);

  const normalizedScale = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const longest = Math.max(size.x, size.y, size.z);
    // Target body length ~0.28 world units (about shoe-box sized)
    return longest > 0.001 ? 0.28 / longest : 1;
  }, [scene]);

  return (
    <group name="frogs-ecosystem">
      {frogs.map((spec) => (
        <OneFrog
          key={spec.id}
          spec={spec}
          template={scene}
          normalizedScale={normalizedScale}
        />
      ))}
    </group>
  );
}

interface OneFrogProps {
  spec: FrogSpec;
  template: THREE.Object3D;
  normalizedScale: number;
}

function OneFrog({ spec, template, normalizedScale }: OneFrogProps) {
  const groupRef = useRef<THREE.Group>(null);

  const instance = useMemo(() => {
    const cloned = SkeletonUtils.clone(template);
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (mesh.material) {
          const src = mesh.material as THREE.Material | THREE.Material[];
          mesh.material = Array.isArray(src)
            ? src.map((m) => m.clone())
            : (src as THREE.Material).clone();
        }
      }
    });
    return cloned;
  }, [template]);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const t = performance.now() / 1000;
    // Gentle idle bob
    g.position.y = spec.y + Math.sin(t * 1.4 + spec.phase * Math.PI * 2) * 0.022;
    // Subtle body rock
    g.rotation.z = Math.sin(t * 0.85 + spec.phase * 4.7) * 0.055;
  });

  return (
    <group
      ref={groupRef}
      position={[spec.x, spec.y, spec.z]}
      rotation={[0, spec.rotY, 0]}
      scale={normalizedScale * spec.scale}
    >
      <primitive object={instance} />
    </group>
  );
}

useGLTF.preload(MODEL_URL);
