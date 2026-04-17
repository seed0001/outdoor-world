import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useLoader } from "@react-three/fiber";
import { FBXLoader, SkeletonUtils } from "three-stdlib";
import { rats, type RatSpec } from "../systems/world/ratRegistry";

const MODEL_URL = "/models/black-rat/blackrat.fbx";

/**
 * Skinned black rats (FBX). One load, `SkeletonUtils.clone` per instance,
 * independent `AnimationMixer`s when clips exist. Materials get the same PBR
 * fixes we use on butterflies (transmission off, sRGB maps) so embedded
 * textures read clearly.
 */
export default function Rats() {
  const fbx = useLoader(FBXLoader, MODEL_URL);

  const { baseScale, groundOffset, forwardQuat } = useMemo(() => {
    fbx.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(fbx);
    const size = new THREE.Vector3();
    box.getSize(size);
    const longest = Math.max(size.x, size.y, size.z);
    // House rat body+tail ~25–40 cm on the longest AABB axis in-game.
    const scale = longest > 0.001 ? 0.36 / longest : 1;

    const forward = new THREE.Vector3();
    if (size.x >= size.y && size.x >= size.z) forward.set(1, 0, 0);
    else if (size.z >= size.y) forward.set(0, 0, 1);
    else forward.set(0, 1, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(
      forward,
      new THREE.Vector3(1, 0, 0),
    );
    return {
      baseScale: scale,
      groundOffset: -box.min.y,
      forwardQuat: q,
    };
  }, [fbx]);

  const clips = fbx.animations as THREE.AnimationClip[];

  return (
    <group>
      {rats.map((spec) => (
        <Rat
          key={spec.id}
          spec={spec}
          template={fbx}
          clips={clips}
          baseScale={baseScale}
          groundOffset={groundOffset}
          forwardQuat={forwardQuat}
        />
      ))}
    </group>
  );
}

interface RatProps {
  spec: RatSpec;
  template: THREE.Object3D;
  clips: THREE.AnimationClip[];
  baseScale: number;
  groundOffset: number;
  forwardQuat: THREE.Quaternion;
}

function Rat({
  spec,
  template,
  clips,
  baseScale,
  groundOffset,
  forwardQuat,
}: RatProps) {
  const groupRef = useRef<THREE.Group>(null);
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
                fixRatMaterial(c);
                return c;
              })
            : (() => {
                const c = src.clone();
                fixRatMaterial(c);
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
    if (mixer) mixer.update(dt);
    else if (groupRef.current) {
      const t = performance.now() * 0.001;
      groupRef.current.rotation.z =
        Math.sin(t * spec.animSpeed + spec.animPhase * 6.28) * 0.04;
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

function fixRatMaterial(m: THREE.Material): void {
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
    linear(m.aoMap);
    m.transparent = false;
    m.opacity = 1;
    m.depthWrite = true;
  } else if (m instanceof THREE.MeshPhongMaterial) {
    sRgb(m.map);
    sRgb(m.emissiveMap);
    linear(m.normalMap);
    sRgb(m.specularMap);
    m.transparent = false;
    m.opacity = 1;
    m.depthWrite = true;
  } else if (m instanceof THREE.MeshLambertMaterial) {
    sRgb(m.map);
    sRgb(m.emissiveMap);
    m.transparent = false;
    m.opacity = 1;
    m.depthWrite = true;
  }
}
