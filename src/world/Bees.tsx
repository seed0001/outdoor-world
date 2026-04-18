import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import { bees, type BeeSpec } from "../systems/world/beeRegistry";
import { beeHiveInfo } from "../systems/world/beeHive";
import { tryBeeSwarmSting } from "../systems/world/beeSting";
import { playerRef } from "../systems/player/playerRef";
import { worldState } from "../systems/world/worldState";
import { heightAt, mulberry32 } from "./terrain";

const MODEL_URL = "/models/bee/Bee.glb";

/** Horizontal distance from hive trunk — inside this, bees attack. */
const HIVE_THREAT_RADIUS = 10.5;
const AGGRESSIVE_SPEED_MULT = 2.65;

useGLTF.preload(MODEL_URL);

const _seek = new THREE.Vector3();
const _noiseVec = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _look = new THREE.Vector3();
const _playerAim = new THREE.Vector3();

/**
 * Bees live on {@link beeHiveInfo}; near the hive they chase the player and can sting.
 */
export default function Bees() {
  const gltf = useGLTF(MODEL_URL) as unknown as {
    scene: THREE.Group;
    animations: THREE.AnimationClip[];
  };

  const baseScale = useMemo(() => {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const longest = Math.max(size.x, size.y, size.z);
    if (longest < 0.001) return 1;
    return 0.14 / longest;
  }, [gltf.scene]);

  return (
    <group>
      <BeeHiveMarker />
      {bees.map((spec) => (
        <OneBee
          key={spec.id}
          spec={spec}
          template={gltf.scene}
          clips={gltf.animations}
          baseScale={baseScale}
        />
      ))}
    </group>
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
}: {
  spec: BeeSpec;
  template: THREE.Group;
  clips: THREE.AnimationClip[];
  baseScale: number;
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
          if (Array.isArray(src)) src.forEach(fixBeeMaterial);
          else fixBeeMaterial(src);
        }
      }
    });
    return cloned;
  }, [template]);

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

function fixBeeMaterial(m: THREE.Material): void {
  m.needsUpdate = true;
  m.depthWrite = true;

  if (m instanceof THREE.MeshPhysicalMaterial) {
    m.transmission = 0;
    m.thickness = 0;
    m.attenuationDistance = Infinity;
    m.ior = 1.5;
  }

  if (m instanceof THREE.MeshStandardMaterial) {
    const setTex = (tex: THREE.Texture | null | undefined, cs: THREE.ColorSpace) => {
      if (tex) {
        tex.colorSpace = cs;
        tex.needsUpdate = true;
      }
    };
    setTex(m.map, THREE.SRGBColorSpace);
    setTex(m.emissiveMap, THREE.SRGBColorSpace);
    setTex(m.normalMap, THREE.LinearSRGBColorSpace);
    setTex(m.metalnessMap, THREE.LinearSRGBColorSpace);
    setTex(m.roughnessMap, THREE.LinearSRGBColorSpace);
    setTex(m.aoMap, THREE.LinearSRGBColorSpace);
    setTex(m.alphaMap, THREE.LinearSRGBColorSpace);
    if (m.map) m.map.anisotropy = Math.max(m.map.anisotropy, 8);

    if (m.metalness > 0.6) m.metalness = Math.min(m.metalness, 0.25);
    if (m.roughness < 0.35) m.roughness = Math.max(m.roughness, 0.55);
    m.envMapIntensity = Math.min(m.envMapIntensity ?? 1, 0.85);

    const wantsBlend =
      m.transparent ||
      m.opacity < 0.999 ||
      m.alphaMap != null ||
      (m.map != null && m.map.format === THREE.RGBAFormat);

    if (wantsBlend) {
      m.alphaTest = 0.35;
      m.transparent = false;
      m.opacity = 1;
    } else {
      m.transparent = false;
      m.opacity = 1;
    }
  }
}
