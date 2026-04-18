import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { FBXLoader, SkeletonUtils } from "three-stdlib";
import { CuboidCollider, RigidBody } from "@react-three/rapier";

import {
  sturdyFrames,
  type SturdyFrame,
} from "../systems/world/sturdyFrames";

const FBX_URL =
  "/models/primitive-sturdy/Meshy_AI_A_primitive_sturdy_w_0418175525_texture.fbx";
const TEX_PREFIX = "/models/primitive-sturdy/";

/**
 * Largest world axis after uniform scale (~3.5 m = small walk-in shelter, not map-sized).
 */
const SHELTER_TARGET_MAX_AXIS = 3.5;

/** Thin floor slab only — a full AABB cuboid blocks the interior; walls/roof stay visual-only for walking inside. */
const FLOOR_HALF_HEIGHT = 0.09;

/**
 * Bounding box from mesh geometry only — FBX roots often include empty transforms that
 * blow up `setFromObject` or collapse to zero.
 */
function meshBoundsWorld(object: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  let any = false;
  object.updateMatrixWorld(true);
  object.traverse((o) => {
    if (o instanceof THREE.Mesh && o.geometry) {
      const b = new THREE.Box3().setFromObject(o);
      if (!any) {
        box.copy(b);
        any = true;
      } else {
        box.union(b);
      }
    }
  });
  if (!any) {
    box.setFromObject(object);
  }
  return box;
}

/**
 * Uniform scale so the mesh's largest axis becomes {@link SHELTER_TARGET_MAX_AXIS} world units.
 * One division: `rawMax * uniform = target` — the old cm heuristic only changed the denominator
 * while vertices stayed in file units, which scaled shelters to hundreds of metres.
 */
function uniformScaleForShelter(size: THREE.Vector3): number {
  const rawMax = Math.max(size.x, size.y, size.z, 0.01);
  const u = SHELTER_TARGET_MAX_AXIS / rawMax;
  return THREE.MathUtils.clamp(u, 0.04, 24);
}

function SturdyFrameInstance({
  template,
  item,
}: {
  template: THREE.Group;
  item: SturdyFrame;
}) {
  const { scene, colliderHalf, colliderCenter } = useMemo(() => {
    const clone = SkeletonUtils.clone(template);
    clone.updateMatrixWorld(true);
    const box = meshBoundsWorld(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const uniform = uniformScaleForShelter(size);
    clone.scale.setScalar(uniform);
    clone.updateMatrixWorld(true);
    const b2 = meshBoundsWorld(clone);
    clone.position.sub(b2.getCenter(new THREE.Vector3()));
    clone.position.y -= b2.min.y;

    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
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
        if (mat.metalnessMap) mat.metalnessMap.colorSpace = THREE.NoColorSpace;
        if (mat.roughnessMap) mat.roughnessMap.colorSpace = THREE.NoColorSpace;
        const mtl = mat.metalness ?? 0.25;
        const rou = mat.roughness ?? 0.75;
        mat.metalness = Math.min(mtl, 0.42);
        mat.roughness = Math.max(rou, 0.42);
        mat.side = THREE.DoubleSide;
        mat.transparent = false;
        mat.opacity = 1;
        mat.needsUpdate = true;
      }
    });

    clone.updateMatrixWorld(true);
    const b3 = meshBoundsWorld(clone);
    const c = b3.getCenter(new THREE.Vector3());
    const hx = Math.max((b3.max.x - b3.min.x) * 0.5, 0.08);
    const hz = Math.max((b3.max.z - b3.min.z) * 0.5, 0.08);
    const floorY = b3.min.y + FLOOR_HALF_HEIGHT;
    return {
      scene: clone,
      colliderHalf: [hx, FLOOR_HALF_HEIGHT, hz] as [number, number, number],
      colliderCenter: [c.x, floorY, c.z] as [number, number, number],
    };
  }, [template, item.id]);

  return (
    <group position={[item.x, item.y, item.z]} rotation={[0, item.heading, 0]}>
      {/*
        Keep mesh *outside* RigidBody — same pattern as DesertTrees. Rapier often fails to
        show <primitive> attached as a rigid-body child.
      */}
      <RigidBody
        type="fixed"
        colliders={false}
        userData={{ kind: "sturdyFrame", id: item.id }}
      >
        <CuboidCollider
          args={colliderHalf}
          position={colliderCenter}
          friction={0.9}
        />
      </RigidBody>
      <primitive object={scene} />
    </group>
  );
}

export default function SturdyFrames() {
  const [items, setItems] = useState<SturdyFrame[]>(() =>
    sturdyFrames.list(),
  );

  useEffect(
    () =>
      sturdyFrames.subscribe(() => {
        setItems(sturdyFrames.list());
      }),
    [],
  );

  const fbx = useLoader(FBXLoader, FBX_URL, (loader) => {
    loader.manager.setURLModifier((url) => {
      if (/WildWest|[A-Za-z]:\\|\\\\|localhost|file:/i.test(url)) {
        const base = url.split(/[\\/]/).pop();
        if (base) return `${TEX_PREFIX}${base.split("?")[0]}`;
      }
      const base = url.split(/[\\/]/).pop();
      const clean = base ? base.split("?")[0] : "";
      if (clean && /\.(png|jpg|jpeg|tga|webp)$/i.test(clean))
        return `${TEX_PREFIX}${clean}`;
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
        if (mat.metalnessMap)
          mat.metalnessMap.colorSpace = THREE.NoColorSpace;
        if (mat.roughnessMap)
          mat.roughnessMap.colorSpace = THREE.NoColorSpace;
        const mtl = mat.metalness ?? 0.25;
        const rou = mat.roughness ?? 0.75;
        mat.metalness = Math.min(mtl, 0.42);
        mat.roughness = Math.max(rou, 0.42);
        mat.side = THREE.DoubleSide;
        mat.needsUpdate = true;
      }
    });
  }, [fbx]);

  return (
    <group>
      {items.map((item) => (
        <SturdyFrameInstance key={item.id} template={fbx} item={item} />
      ))}
    </group>
  );
}
