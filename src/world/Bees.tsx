import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import { bees, type BeeSpec } from "../systems/world/beeRegistry";
import { beeHiveInfo } from "../systems/world/beeHive";
import { tryBeeSwarmSting } from "../systems/world/beeSting";
import { playerRef } from "../systems/player/playerRef";
import { worldState } from "../systems/world/worldState";
import { heightAt, mulberry32 } from "./terrain";

const MODEL_URL = "/models/bee/Bee.glb";

/** Embedded PNGs extracted from `Bee.glb` — the glTF uses legacy spec/gloss and leaves `map` unset in current Three loaders. */
const BEE_TEX_URLS = [
  "/models/bee/textures/bee_diffuse.png",
  "/models/bee/textures/bee_occlusion.png",
  "/models/bee/textures/bee_normal.png",
] as const;

/** Horizontal distance from hive trunk — inside this, bees attack. */
const HIVE_THREAT_RADIUS = 10.5;
const AGGRESSIVE_SPEED_MULT = 2.65;

useGLTF.preload(MODEL_URL);
for (const url of BEE_TEX_URLS) {
  useTexture.preload(url);
}

const _seek = new THREE.Vector3();
const _noiseVec = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _look = new THREE.Vector3();
const _playerAim = new THREE.Vector3();

/**
 * Bees live on {@link beeHiveInfo}; near the hive they chase the player and can sting.
 * Hive marker is not asset-bound so it stays visible even if the GLB/textures suspend or fail.
 */
export default function Bees() {
  return (
    <group>
      <BeeHiveMarker />
      <Suspense fallback={null}>
        <BeeSwarmModels />
      </Suspense>
    </group>
  );
}

function BeeSwarmModels() {
  const gltf = useGLTF(MODEL_URL) as unknown as {
    scene: THREE.Group;
    animations: THREE.AnimationClip[];
  };

  const beeTextures = useTexture([...BEE_TEX_URLS]);
  const diffuse = (Array.isArray(beeTextures) ? beeTextures : [beeTextures])[0] as THREE.Texture;
  const occlusion = (Array.isArray(beeTextures) ? beeTextures : [beeTextures])[1] as THREE.Texture;
  const normal = (Array.isArray(beeTextures) ? beeTextures : [beeTextures])[2] as THREE.Texture;

  useLayoutEffect(() => {
    diffuse.colorSpace = THREE.SRGBColorSpace;
    diffuse.anisotropy = Math.max(diffuse.anisotropy, 8);
    occlusion.colorSpace = THREE.NoColorSpace;
    occlusion.anisotropy = Math.max(occlusion.anisotropy, 8);
    normal.colorSpace = THREE.NoColorSpace;
    normal.anisotropy = Math.max(normal.anisotropy, 8);
  }, [diffuse, occlusion, normal]);

  const baseScale = useMemo(() => {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const longest = Math.max(size.x, size.y, size.z);
    if (longest < 0.001) return 1;
    return 0.14 / longest;
  }, [gltf.scene]);

  return (
    <>
      {bees.map((spec) => (
        <OneBee
          key={spec.id}
          spec={spec}
          template={gltf.scene}
          clips={gltf.animations}
          baseScale={baseScale}
          diffuse={diffuse}
          occlusion={occlusion}
          normal={normal}
        />
      ))}
    </>
  );
}

function BeeHiveMarker() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const sync = () => {
      const harvested = worldState
        .listTreesHarvestedToLog()
        .includes(beeHiveInfo.treeId);
      const fallen = worldState
        .listFallenTrees()
        .some((p) => p.id === beeHiveInfo.treeId);
      setVisible(!harvested && !fallen);
    };
    sync();
    return worldState.subscribe(sync);
  }, []);

  if (!visible) return null;

  const y = beeHiveInfo.y + beeHiveInfo.trunkHeight * 0.68;
  return (
    <group position={[beeHiveInfo.x, y, beeHiveInfo.z]}>
      <mesh castShadow rotation={[0.25, 0.4, 0.12]}>
        <sphereGeometry args={[0.34, 8, 6]} />
        <meshStandardMaterial
          color="#6b5420"
          roughness={0.9}
          metalness={0.06}
        />
      </mesh>
      <mesh position={[0.05, -0.1, 0.1]} rotation={[0.5, 0.2, 0.15]}>
        <cylinderGeometry args={[0.045, 0.055, 0.28, 6]} />
        <meshStandardMaterial color="#3a2e12" roughness={0.94} />
      </mesh>
    </group>
  );
}

interface BeeSim {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  target: THREE.Vector3;
  waypointUntil: number;
  rand: () => number;
}

function createSim(spec: BeeSpec): BeeSim {
  const rand = mulberry32(spec.seed);
  const startH = heightAt(spec.homeX, spec.homeZ) + spec.cruiseHeight * 0.7;
  const heading = rand() * Math.PI * 2;
  return {
    pos: new THREE.Vector3(spec.homeX, startH, spec.homeZ),
    vel: new THREE.Vector3(
      Math.cos(heading) * spec.wanderSpeed * 0.5,
      0,
      Math.sin(heading) * spec.wanderSpeed * 0.5,
    ),
    target: new THREE.Vector3(spec.homeX, startH, spec.homeZ),
    waypointUntil: 0,
    rand,
  };
}

function pickWaypoint(sim: BeeSim, spec: BeeSpec): void {
  const r = Math.sqrt(sim.rand()) * spec.patrolRadius;
  const a = sim.rand() * Math.PI * 2;
  const tx = spec.homeX + Math.cos(a) * r;
  const tz = spec.homeZ + Math.sin(a) * r;
  const base = heightAt(tx, tz);
  const ty = base + spec.cruiseHeight * (0.5 + sim.rand() * 0.85);
  sim.target.set(tx, ty, tz);
  sim.waypointUntil = performance.now() / 1000 + 1.8 + sim.rand() * 2.2;
}

function hashSin(t: number, seed: number): number {
  return (
    Math.sin(t * 1.73 + seed * 12.9898) * 0.6 +
    Math.sin(t * 2.59 + seed * 78.233) * 0.3 +
    Math.sin(t * 0.91 + seed * 37.719) * 0.1
  );
}

function OneBee({
  spec,
  template,
  clips,
  baseScale,
  diffuse,
  occlusion,
  normal,
}: {
  spec: BeeSpec;
  template: THREE.Group;
  clips: THREE.AnimationClip[];
  baseScale: number;
  diffuse: THREE.Texture;
  occlusion: THREE.Texture;
  normal: THREE.Texture;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionRef = useRef<THREE.AnimationAction | null>(null);
  const sim = useRef(createSim(spec));

  const instance = useMemo(() => {
    const cloned = SkeletonUtils.clone(template);
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        mesh.frustumCulled = false;
        if (mesh.material) {
          const src = mesh.material as THREE.Material | THREE.Material[];
          if (Array.isArray(src)) {
            for (const mat of src)
              applyBeeMaps(mesh, mat, { diffuse, occlusion, normal });
          } else applyBeeMaps(mesh, src, { diffuse, occlusion, normal });
        }
      }
    });
    return cloned;
  }, [template, diffuse, occlusion, normal]);

  useEffect(() => {
    if (clips.length === 0) {
      mixerRef.current = null;
      actionRef.current = null;
      return;
    }
    const mixer = new THREE.AnimationMixer(instance);
    mixerRef.current = mixer;
    const clip = clips[0];
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.timeScale = 1.35;
    action.play();
    actionRef.current = action;
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(instance);
      mixerRef.current = null;
      actionRef.current = null;
    };
  }, [instance, clips]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.08);
    const mixer = mixerRef.current;
    if (mixer) mixer.update(dt);

    const s = sim.current;
    const group = groupRef.current;
    if (!group) return;

    const now = performance.now() / 1000;

    const px = playerRef.position.x;
    const py = playerRef.position.y;
    const pz = playerRef.position.z;
    const dHive = Math.hypot(px - beeHiveInfo.x, pz - beeHiveInfo.z);
    const aggressive = dHive < HIVE_THREAT_RADIUS;
    const threat = Math.min(
      1,
      Math.max(0, (HIVE_THREAT_RADIUS - dHive) / HIVE_THREAT_RADIUS),
    );

    const act = actionRef.current;
    if (act) act.timeScale = aggressive ? 2.05 + threat * 0.45 : 1.35;

    if (aggressive) {
      _playerAim.set(
        px + hashSin(now * 3.4, spec.seed) * 1.4,
        py + 1.05 + hashSin(now * 2.3, spec.seed * 0.73) * 0.45,
        pz + hashSin(now * 3.2, spec.seed * 1.07) * 1.4,
      );
      s.target.lerp(_playerAim, Math.min(1, dt * 5));
    } else if (s.pos.distanceTo(s.target) < 0.45 || now > s.waypointUntil) {
      pickWaypoint(s, spec);
    }

    _seek.copy(s.target).sub(s.pos);
    const seekLen = _seek.length();
    if (seekLen > 0.0001) _seek.multiplyScalar(1 / seekLen);

    const nx = hashSin(now * 2.2, spec.seed * 0.91) * 1.1;
    const ny = hashSin(now * 1.6, spec.seed * 1.13) * 0.5;
    const nz = hashSin(now * 1.9, spec.seed * 1.37) * 1.1;
    _noiseVec.set(nx, ny, nz);

    const noiseW = aggressive ? 0.22 + (1 - threat) * 0.18 : 0.65;
    const seekW = 1 - noiseW;

    _desired
      .copy(_seek)
      .multiplyScalar(seekW)
      .addScaledVector(_noiseVec, noiseW)
      .normalize();

    let spd = spec.wanderSpeed;
    if (aggressive) spd *= AGGRESSIVE_SPEED_MULT * (0.85 + threat * 0.35);
    _desired.multiplyScalar(spd);

    const steer = aggressive ? 3.2 : 2.4;
    s.vel.lerp(_desired, Math.min(1, dt * steer));

    const flap = 9 + spec.phase * 4;
    const bob = Math.sin(now * flap + spec.phase * 6.28) * (aggressive ? 0.05 : 0.08);

    s.pos.addScaledVector(s.vel, dt);
    s.pos.y += bob * dt * 5;

    const ground = heightAt(s.pos.x, s.pos.z);
    const minY = ground + 0.35;
    const maxY = ground + spec.cruiseHeight + (aggressive ? 3.2 : 1.8);
    if (s.pos.y < minY) {
      s.pos.y = minY;
      s.vel.y = Math.max(0, s.vel.y);
    }
    if (s.pos.y > maxY) {
      s.pos.y = maxY;
      s.vel.y = Math.min(0, s.vel.y);
    }

    _look.copy(s.pos).add(s.vel);
    group.position.copy(s.pos);
    group.lookAt(_look);

    if (aggressive) {
      const dPlayer = s.pos.distanceTo(playerRef.position);
      tryBeeSwarmSting(dPlayer, true);
    }
  });

  return (
    <group ref={groupRef} scale={baseScale * spec.scale}>
      <primitive object={instance} />
    </group>
  );
}

/**
 * Applies embedded diffuse / AO / normal from `public/models/bee/textures/*`.
 * The source GLB uses spec/gloss + empty MR params so the loader never binds {@link MeshStandardMaterial.map}.
 * AO is skipped without `uv2` — assigning {@link MeshStandardMaterial.aoMap} without a second UV breaks skinned shaders.
 */
function applyBeeMaps(
  mesh: THREE.Mesh,
  m: THREE.Material,
  tex: {
    diffuse: THREE.Texture;
    occlusion: THREE.Texture;
    normal: THREE.Texture;
  },
): void {
  const geo = mesh.geometry as THREE.BufferGeometry;
  const hasUv2 = !!geo.attributes.uv2;

  const applyToStandard = (mat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial) => {
    mat.needsUpdate = true;
    mat.depthWrite = true;
    if (mat instanceof THREE.MeshPhysicalMaterial) {
      mat.transmission = 0;
      mat.thickness = 0;
      mat.attenuationDistance = Infinity;
      mat.clearcoat = 0;
    }
    mat.map = tex.diffuse;
    mat.aoMap = hasUv2 ? tex.occlusion : null;
    mat.aoMapIntensity = hasUv2 ? 1 : 0;
    mat.normalMap = tex.normal;
    mat.normalScale = new THREE.Vector2(0.9, 0.9);
    mat.metalness = 0.12;
    mat.roughness = 0.58;
    mat.envMapIntensity = Math.min(mat.envMapIntensity ?? 1, 0.82);
    mat.side = THREE.DoubleSide;
    if (mat.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;

    const wantsBlend = mat.map != null && mat.map.format === THREE.RGBAFormat;
    if (wantsBlend) {
      mat.alphaTest = 0.35;
      mat.transparent = false;
      mat.opacity = 1;
    } else {
      mat.transparent = false;
      mat.opacity = 1;
      mat.alphaTest = 0;
    }
  };

  if (m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshPhysicalMaterial) {
    applyToStandard(m);
    return;
  }

  const replacement = new THREE.MeshStandardMaterial({
    map: tex.diffuse,
    normalMap: tex.normal,
    normalScale: new THREE.Vector2(0.9, 0.9),
    metalness: 0.12,
    roughness: 0.58,
    side: THREE.DoubleSide,
    depthWrite: true,
  });
  if (hasUv2) {
    replacement.aoMap = tex.occlusion;
    replacement.aoMapIntensity = 1;
  }
  replacement.map!.colorSpace = THREE.SRGBColorSpace;
  replacement.normalMap!.colorSpace = THREE.NoColorSpace;
  if (replacement.aoMap) replacement.aoMap.colorSpace = THREE.NoColorSpace;
  replacement.needsUpdate = true;
  m.dispose();
  mesh.material = replacement;
}
