import { Component, Suspense, useEffect, useMemo, useRef, type ErrorInfo, type ReactNode } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import {
  scorpions as scorpionList,
  type ScorpionSpec,
} from "../systems/world/scorpionRegistry";

/**
 * Export your scorpion mesh as `public/models/scorpion/scorpion.glb` to use it.
 * Until then, stylized procedural scorpions are shown (or on load error).
 */
const SCORPION_GLB_URL = "/models/scorpion/scorpion.glb";

function fixScorpionMaterial(m: THREE.Material): void {
  m.needsUpdate = true;
  if (m instanceof THREE.MeshPhysicalMaterial) {
    m.transmission = 0;
    m.thickness = 0;
  }
  const sRgb = (t: THREE.Texture | null | undefined) => {
    if (t) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.max(t.anisotropy, 8);
    }
  };
  const linear = (t: THREE.Texture | null | undefined) => {
    if (t) t.colorSpace = THREE.LinearSRGBColorSpace;
  };
  if (m instanceof THREE.MeshStandardMaterial) {
    sRgb(m.map);
    sRgb(m.emissiveMap);
    linear(m.normalMap);
    linear(m.metalnessMap);
    linear(m.roughnessMap);
    m.transparent = false;
    m.opacity = 1;
    m.depthWrite = true;
  }
}

function ProceduralScorpion({ spec }: { spec: ScorpionSpec }) {
  const rootRef = useRef<THREE.Group>(null);
  const tailRef = useRef<THREE.Group>(null);
  const shell = "#8b4513";
  const leg = "#5c2e0c";

  useFrame((state) => {
    const root = rootRef.current;
    const tail = tailRef.current;
    if (!root || !tail) return;
    const t = state.clock.elapsedTime;
    root.rotation.y =
      spec.rot + Math.sin(t * 0.15 + spec.phase * 40) * 0.35;
    root.position.y =
      spec.y + Math.sin(t * 2.1 + spec.phase * 12) * 0.012;
    tail.rotation.y = Math.sin(t * 2.8 + spec.phase * 6) * 0.18;
    tail.rotation.x = Math.sin(t * 1.9) * 0.06;
  });

  return (
    <group ref={rootRef} position={[spec.x, spec.y, spec.z]} scale={spec.scale}>
      <mesh castShadow receiveShadow position={[0, 0.04, 0.06]}>
        <cylinderGeometry args={[0.04, 0.07, 0.14, 6]} />
        <meshStandardMaterial color={shell} roughness={0.88} />
      </mesh>
      <mesh
        castShadow
        receiveShadow
        position={[0, 0.08, -0.12]}
        scale={[1, 0.55, 1.2]}
      >
        <sphereGeometry args={[0.08, 8, 6]} />
        <meshStandardMaterial color={shell} roughness={0.9} />
      </mesh>
      <group ref={tailRef} position={[0, 0.06, -0.18]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh
            key={i}
            castShadow
            position={[0, 0, -0.05 * i]}
            rotation={[0.25 + i * 0.06, 0, 0]}
          >
            <boxGeometry args={[0.045, 0.035, 0.08]} />
            <meshStandardMaterial
              color={i > 2 ? "#3d2818" : shell}
              roughness={0.85}
            />
          </mesh>
        ))}
        <mesh castShadow position={[0, 0.02, -0.32]} rotation={[0.5, 0, 0]}>
          <coneGeometry args={[0.025, 0.1, 4]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
        </mesh>
      </group>
      {[-1, 1].map((side) =>
        [0, 1, 2, 3].map((i) => (
          <mesh
            key={`${side}-${i}`}
            castShadow
            position={[side * 0.07, 0.02, 0.05 - i * 0.05]}
            rotation={[0, 0, side * 0.6]}
          >
            <boxGeometry args={[0.1, 0.02, 0.02]} />
            <meshStandardMaterial color={leg} roughness={0.95} />
          </mesh>
        )),
      )}
      <mesh castShadow position={[0.06, 0.05, 0.14]} rotation={[0, 0, Math.PI / 5]}>
        <boxGeometry args={[0.1, 0.03, 0.03]} />
        <meshStandardMaterial color={leg} roughness={0.9} />
      </mesh>
      <mesh castShadow position={[-0.06, 0.05, 0.14]} rotation={[0, 0, -Math.PI / 5]}>
        <boxGeometry args={[0.1, 0.03, 0.03]} />
        <meshStandardMaterial color={leg} roughness={0.9} />
      </mesh>
    </group>
  );
}

function ProceduralScorpions() {
  return (
    <group>
      {scorpionList.map((spec) => (
        <ProceduralScorpion key={spec.id} spec={spec} />
      ))}
    </group>
  );
}

function ScorpionGltfInstance({
  spec,
  template,
  clips,
  baseScale,
  groundOffset,
  forwardQuat,
}: {
  spec: ScorpionSpec;
  template: THREE.Object3D;
  clips: THREE.AnimationClip[];
  baseScale: number;
  groundOffset: number;
  forwardQuat: THREE.Quaternion;
}) {
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  const instance = useMemo(() => {
    const cloned = SkeletonUtils.clone(template);
    cloned.quaternion.copy(forwardQuat);
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (mesh.material) {
          const src = mesh.material as THREE.Material | THREE.Material[];
          mesh.material = Array.isArray(src)
            ? src.map((mat) => {
                const c = mat.clone();
                fixScorpionMaterial(c);
                return c;
              })
            : (() => {
                const c = src.clone();
                fixScorpionMaterial(c);
                return c;
              })();
        }
      }
    });
    return cloned;
  }, [template, forwardQuat]);

  useEffect(() => {
    if (clips.length === 0) {
      mixerRef.current = null;
      return;
    }
    const mixer = new THREE.AnimationMixer(instance);
    const clip = clips[0];
    const action = mixer.clipAction(clip);
    action.timeScale = 0.55 + spec.phase * 0.35;
    action.time = spec.phase * clip.duration;
    action.play();
    mixerRef.current = mixer;
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(instance);
      mixerRef.current = null;
    };
  }, [instance, clips, spec.phase]);

  useFrame((_, dt) => {
    const mixer = mixerRef.current;
    if (mixer) mixer.update(dt);
  });

  return (
    <group
      position={[spec.x, spec.y + groundOffset * baseScale * spec.scale, spec.z]}
      rotation={[0, spec.rot, 0]}
      scale={baseScale * spec.scale}
    >
      <primitive object={instance} />
    </group>
  );
}

class ScorpionGltfErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_e: Error, _info: ErrorInfo) {}

  render() {
    if (this.state.failed) return <ProceduralScorpions />;
    return this.props.children;
  }
}

function ScorpionsFromGltf() {
  const gltf = useGLTF(SCORPION_GLB_URL) as unknown as {
    scene: THREE.Group;
    animations: THREE.AnimationClip[];
  };

  const { baseScale, groundOffset, forwardQuat } = useMemo(() => {
    gltf.scene.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const longest = Math.max(size.x, size.y, size.z);
    const scale = longest > 0.001 ? 0.42 / longest : 1;
    const forward = new THREE.Vector3();
    if (size.x >= size.y && size.x >= size.z) forward.set(1, 0, 0);
    else if (size.z >= size.y) forward.set(0, 0, 1);
    else forward.set(0, 1, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(
      forward,
      new THREE.Vector3(0, 0, 1),
    );
    return {
      baseScale: scale,
      groundOffset: -box.min.y,
      forwardQuat: q,
    };
  }, [gltf.scene]);

  return (
    <group>
      {scorpionList.map((spec) => (
        <ScorpionGltfInstance
          key={spec.id}
          spec={spec}
          template={gltf.scene}
          clips={gltf.animations}
          baseScale={baseScale}
          groundOffset={groundOffset}
          forwardQuat={forwardQuat}
        />
      ))}
    </group>
  );
}

/**
 * Desert scorpions on dry ground (procedural mesh, or your `scorpion.glb` when present).
 */
export default function Scorpions() {
  return (
    <ScorpionGltfErrorBoundary>
      <Suspense fallback={<ProceduralScorpions />}>
        <ScorpionsFromGltf />
      </Suspense>
    </ScorpionGltfErrorBoundary>
  );
}
