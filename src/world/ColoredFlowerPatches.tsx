import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useLoader } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { FBXLoader } from "three-stdlib";
import { SkeletonUtils } from "three-stdlib";
import {
  coloredFlowerPatches,
  type ColoredFlowerPatchSpec,
} from "../systems/world/coloredFlowerPatchRegistry";
import { snapshot } from "../systems/world/worldClock";
import { butterflyActivity, foliageLevel } from "../systems/world/calendar";
import {
  COLORED_FLOWER_TEXTURE_URLS,
  COLORED_FLOWER_VARIANT_COUNT,
} from "./coloredFlowerAssets";

export { COLORED_FLOWER_TEXTURE_URLS } from "./coloredFlowerAssets";

const FBX_URL = "/models/colored-flower/FlowerPatch.fbx";

const TEXTURE_URL_LIST = [...COLORED_FLOWER_TEXTURE_URLS];

/**
 * Deterministic flower-bed patches (`FlowerPatch.fbx`) — one per diffuse variant,
 * with bundled PNGs; materials are rebuilt so paths work in the browser.
 */
export default function ColoredFlowerPatches() {
  const fbx = useLoader(FBXLoader, FBX_URL);
  // Stable array ref so useLoader/useTexture cache keys stay consistent across renders.
  const textures = useTexture(TEXTURE_URL_LIST);

  useLayoutEffect(() => {
    const list = Array.isArray(textures) ? textures : [textures];
    for (const t of list) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.max(t.anisotropy, 8);
    }
  }, [textures]);

  return (
    <group>
      {coloredFlowerPatches.map((spec) => (
        <OnePatch
          key={spec.id}
          spec={spec}
          template={fbx}
          diffuse={
            (Array.isArray(textures) ? textures : [textures])[
              spec.variant % COLORED_FLOWER_VARIANT_COUNT
            ]
          }
        />
      ))}
    </group>
  );
}

function OnePatch({
  spec,
  template,
  diffuse,
}: {
  spec: ColoredFlowerPatchSpec;
  template: THREE.Group;
  diffuse: THREE.Texture;
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
    const target = 1.35;
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
      const next = mats.map((m) => buildPatchMaterial(m, diffuse));
      mesh.material = next.length === 1 ? next[0] : next;
    });

    return clone;
  }, [template, diffuse]);

  useFrame((_, dt) => {
    const world = snapshot();
    // Wildflowers can read as “in bloom” before full tree leaf-out; don’t tie only to foliageLevel.
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

function buildPatchMaterial(
  _src: THREE.Material,
  map: THREE.Texture,
): THREE.MeshStandardMaterial {
  // Always white: FBX materials often share one tint; it multiplies the diffuse map and
  // makes every petal/grass texture read as the same muddy hue.
  const color = new THREE.Color(0xffffff);

  const m = new THREE.MeshStandardMaterial({
    map,
    color,
    roughness: 0.88,
    metalness: 0.02,
    side: THREE.DoubleSide,
    depthWrite: true,
  });

  // Do not alphaTest every RGBA diffuse: many petal PNGs ship with RGBA where the alpha
  // channel is unused or all zeros (bad export), which makes alphaTest discard the mesh.

  m.needsUpdate = true;
  return m;
}
