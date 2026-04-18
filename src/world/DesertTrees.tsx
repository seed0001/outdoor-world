import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { FBXLoader, SkeletonUtils } from "three-stdlib";
import { CylinderCollider, RigidBody } from "@react-three/rapier";

import {
  desertGlbTrees,
  desertTrees,
  type DesertTreeSpec,
} from "../systems/world/desertTreeRegistry";

const FBX_URL = "/models/desert-trees/source/trees1.fbx";
const GLB_URL = "/models/desert-trees/tree.glb";
const TEX_PREFIX = "/models/desert-trees/textures/";

const TARGET_HEIGHT_FBX = 7.2;
const TARGET_HEIGHT_GLB = 6.8;

useGLTF.preload(GLB_URL);

/**
 * Wild-west desert tree mesh (`trees1.fbx` + textures under `public/models/desert-trees/`),
 * instanced across the south dune band from {@link desertTrees}, plus `tree.glb`
 * instances from {@link desertGlbTrees}.
 */
export default function DesertTrees() {
  const fbx = useLoader(FBXLoader, FBX_URL, (loader) => {
    loader.manager.setURLModifier((url) => {
      if (
        /WildWest|[A-Za-z]:\\|\\\\|localhost/i.test(url) ||
        url.includes("environment\\tex")
      ) {
        const base = url.split(/[\\/]/).pop();
        if (base) return `${TEX_PREFIX}${base}`;
      }
      return url;
    });
  });

  useLayoutEffect(() => {
    fbx.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const m of mats) {
        const mat = m as THREE.MeshStandardMaterial;
        if (mat.map) {
          mat.map.colorSpace = THREE.SRGBColorSpace;
          mat.map.anisotropy = Math.max(mat.map.anisotropy, 4);
        }
        if (mat.normalMap) {
          mat.normalMap.colorSpace = THREE.NoColorSpace;
          mat.normalMap.anisotropy = Math.max(mat.normalMap.anisotropy, 4);
        }
        mat.side = THREE.FrontSide;
        mat.needsUpdate = true;
      }
    });
  }, [fbx]);

  return (
    <group>
      {desertTrees.map((spec) => (
        <DesertFbxTreeInstance key={`fbx-${spec.id}`} template={fbx} spec={spec} />
      ))}
      <DesertGlbTrees />
    </group>
  );
}

function DesertGlbTrees() {
  const { scene } = useGLTF(GLB_URL) as unknown as { scene: THREE.Object3D };
  return (
    <>
      {desertGlbTrees.map((spec) => (
        <DesertGlbTreeInstance key={`glb-${spec.id}`} template={scene} spec={spec} />
      ))}
    </>
  );
}

function DesertFbxTreeInstance({
  template,
  spec,
}: {
  template: THREE.Group;
  spec: DesertTreeSpec;
}) {
  const { scene, colliderHalfHeight, colliderRadius } = useMemo(() => {
    const clone = SkeletonUtils.clone(template);
    clone.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 1e-4);
    const uniform = (TARGET_HEIGHT_FBX / maxDim) * spec.scale;
    clone.scale.setScalar(uniform);
    clone.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(clone);
    clone.position.sub(b2.getCenter(new THREE.Vector3()));
    clone.position.y -= b2.min.y;

    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });

    const b3 = new THREE.Box3().setFromObject(clone);
    const h = Math.max(b3.max.y - b3.min.y, 0.5);
    const r = Math.max(
      (b3.max.x - b3.min.x) * 0.22,
      (b3.max.z - b3.min.z) * 0.22,
      0.25,
    );

    return {
      scene: clone,
      colliderHalfHeight: h * 0.5,
      colliderRadius: r,
    };
  }, [template, spec.scale]);

  return (
    <group position={[spec.x, spec.y, spec.z]} rotation={[0, spec.rot, 0]}>
      <RigidBody
        type="fixed"
        position={[0, colliderHalfHeight, 0]}
        colliders={false}
        userData={{ kind: "desertTree", id: spec.id }}
      >
        <CylinderCollider args={[colliderHalfHeight, colliderRadius]} />
      </RigidBody>
      <primitive object={scene} />
    </group>
  );
}

function DesertGlbTreeInstance({
  template,
  spec,
}: {
  template: THREE.Object3D;
  spec: DesertTreeSpec;
}) {
  const { scene, colliderHalfHeight, colliderRadius } = useMemo(() => {
    const clone = SkeletonUtils.clone(template);
    clone.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 1e-4);
    const uniform = (TARGET_HEIGHT_GLB / maxDim) * spec.scale;
    clone.scale.setScalar(uniform);
    clone.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(clone);
    clone.position.sub(b2.getCenter(new THREE.Vector3()));
    clone.position.y -= b2.min.y;

    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const m of mats) {
        const mat = m as THREE.MeshStandardMaterial;
        if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
        if (mat.normalMap) mat.normalMap.colorSpace = THREE.NoColorSpace;
        mat.needsUpdate = true;
      }
    });

    const b3 = new THREE.Box3().setFromObject(clone);
    const h = Math.max(b3.max.y - b3.min.y, 0.5);
    const r = Math.max(
      (b3.max.x - b3.min.x) * 0.22,
      (b3.max.z - b3.min.z) * 0.22,
      0.25,
    );

    return {
      scene: clone,
      colliderHalfHeight: h * 0.5,
      colliderRadius: r,
    };
  }, [template, spec.scale]);

  return (
    <group position={[spec.x, spec.y, spec.z]} rotation={[0, spec.rot, 0]}>
      <RigidBody
        type="fixed"
        position={[0, colliderHalfHeight, 0]}
        colliders={false}
        userData={{ kind: "desertGlbTree", id: spec.id }}
      >
        <CylinderCollider args={[colliderHalfHeight, colliderRadius]} />
      </RigidBody>
      <primitive object={scene} />
    </group>
  );
}
