import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useLoader } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { FBXLoader } from "three-stdlib";
import { SkeletonUtils } from "three-stdlib";
import { roseFlowers, type RoseFlowerSpec } from "../systems/world/roseFlowerRegistry";
import { snapshot } from "../systems/world/worldClock";
import { butterflyActivity, foliageLevel } from "../systems/world/calendar";

const FBX_URL = "/models/rose-flower/SM_Rosaceae.fbx";

const ROSE_TEXTURE_URLS = [
  "/models/rose-flower/textures/T_RoseClimber.png",
  "/models/rose-flower/textures/T_RoseClimber_n.png",
] as const;

const ROSE_TEX_LIST = [...ROSE_TEXTURE_URLS];

/**
 * Climbing rose (`SM_Rosaceae.fbx`) in a handful of seeded spots — diffuse + normal
 * from `T_RoseClimber` (browser-safe paths under `public/models/rose-flower/`).
 */
export default function RoseFlowers() {
  const fbx = useLoader(FBXLoader, FBX_URL);
  const textures = useTexture(ROSE_TEX_LIST);
  const map = (Array.isArray(textures) ? textures : [textures])[0] as THREE.Texture;
  const normalMap = (Array.isArray(textures) ? textures : [textures])[1] as
    | THREE.Texture
    | undefined;

  useLayoutEffect(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = Math.max(map.anisotropy, 8);
    if (normalMap) {
      normalMap.colorSpace = THREE.NoColorSpace;
      normalMap.anisotropy = Math.max(normalMap.anisotropy, 8);
    }
  }, [map, normalMap]);

  return (
    <group>
      {roseFlowers.map((spec) => (
        <OneRose
          key={spec.id}
          spec={spec}
          template={fbx}
          map={map}
          normalMap={normalMap}
        />
      ))}
    </group>
  );
}

function OneRose({
  spec,
  template,
  map,
  normalMap,
}: {
  spec: RoseFlowerSpec;
  template: THREE.Group;
  map: THREE.Texture;
  normalMap?: THREE.Texture;
}) {
  const rootRef = useRef<THREE.Group>(null);
  const bloomRef = useRef(0);

  const root = useMemo(() => {
    const clone = SkeletonUtils.clone(template);
    clone.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 1e-4);
    const target = 1.65;
    clone.scale.multiplyScalar(target / maxDim);
    clone.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(clone);
    clone.position.sub(b2.getCenter(new THREE.Vector3()));
    clone.position.y -= b2.min.y;

    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      const next = mats.map((m) => buildRoseMaterial(m, map, normalMap));
      mesh.material = next.length === 1 ? next[0] : next;
    });

    return clone;
  }, [template, map, normalMap]);

  useFrame((_, dt) => {
    const world = snapshot();
    const target = Math.max(
      foliageLevel(world.yearFrac),
      butterflyActivity(world.yearFrac),
    );
    bloomRef.current += (target - bloomRef.current) * Math.min(1, dt * 0.55);
    const s = bloomRef.current;
    const g = rootRef.current;
    if (g) {
      g.visible = s > 0.02;
      g.scale.setScalar(spec.scale * s);
    }
  });

  return (
    <group ref={rootRef} position={[spec.x, spec.y, spec.z]} rotation={[0, spec.rot, 0]}>
      <primitive object={root} />
    </group>
  );
}

function buildRoseMaterial(
  _src: THREE.Material,
  map: THREE.Texture,
  normalMap: THREE.Texture | undefined,
): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    map,
    color: new THREE.Color(0xffffff),
    roughness: 0.82,
    metalness: 0.04,
    side: THREE.DoubleSide,
    depthWrite: true,
  });
  if (normalMap) {
    m.normalMap = normalMap;
    m.normalScale = new THREE.Vector2(0.75, 0.75);
  }
  m.needsUpdate = true;
  return m;
}
