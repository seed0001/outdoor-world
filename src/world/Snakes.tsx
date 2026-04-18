import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import { snakes, type SnakeSpec } from "../systems/world/snakeRegistry";
import { isFaunaAlive } from "../systems/world/faunaLifecycle";
import { faunaPositions } from "../systems/world/faunaPositions";
import { heightAt } from "./terrain";

const MODEL_URL = "/models/timber-rattlesnake.glb";

/** Body submerged under the rock pile while “in den”. */
const BURY_DEPTH = 0.38;
const CRAWL_SPEED = 0.2;

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

type Phase = "den" | "roam" | "home";

interface SnakeSim {
  phase: Phase;
  pos: THREE.Vector3;
  target: THREE.Vector3;
  yaw: number;
  /** Next time a snake leaves the den (ms). */
  emergeAt: number;
  /** Stop roaming and head home (ms). */
  roamUntil: number;
}

function pickRoamTarget(s: SnakeSim, spec: SnakeSpec): void {
  const a = Math.random() * Math.PI * 2;
  const inner = 1.8;
  const outer = Math.max(inner + 0.5, spec.patrolRadius);
  const r = inner + Math.random() * (outer - inner);
  s.target.set(spec.denX + Math.cos(a) * r, 0, spec.denZ + Math.sin(a) * r);
}

function Snake({
  spec,
  template,
  clips,
  baseScale,
  groundOffset,
}: SnakeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  const prevAliveRef = useRef(true);
  const simRef = useRef<SnakeSim | undefined>(undefined);
  if (!simRef.current) {
    const now = performance.now();
    simRef.current = {
      phase: "den",
      pos: new THREE.Vector3(spec.denX, spec.denY, spec.denZ),
      target: new THREE.Vector3(spec.denX, spec.denY, spec.denZ),
      yaw: spec.animPhase * Math.PI * 2,
      emergeAt: now + 4000 + spec.timerOffset * 180,
      roamUntil: 0,
    };
  }

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
    if (mixer) mixer.update(dt);

    const s = simRef.current!;
    const now = performance.now();
    const alive = isFaunaAlive("snake", spec.id, now);
    if (alive && !prevAliveRef.current) {
      s.phase = "den";
      s.pos.set(spec.denX, spec.denY, spec.denZ);
      s.target.set(spec.denX, spec.denY, spec.denZ);
      s.yaw = spec.animPhase * Math.PI * 2;
      s.emergeAt = now + 3000 + spec.timerOffset * 180;
      s.roamUntil = 0;
    }
    prevAliveRef.current = alive;
    if (!alive) {
      if (groupRef.current) groupRef.current.visible = false;
      return;
    }
    if (groupRef.current) groupRef.current.visible = true;

    const crawl = CRAWL_SPEED * (0.85 + spec.animSpeed * 0.15);
    const foot = groundOffset * baseScale * spec.scale;
    const buryAmt =
      s.phase === "den" ? BURY_DEPTH * baseScale * spec.scale : 0;

    if (s.phase === "den") {
      s.pos.set(spec.denX, spec.denY, spec.denZ);
      if (now >= s.emergeAt) {
        s.phase = "roam";
        pickRoamTarget(s, spec);
        s.roamUntil = now + 16000 + spec.id * 800 + Math.random() * 12000;
      }
    } else if (s.phase === "roam") {
      moveToward(s, crawl, dt);
      // Keep patrol disk
      const dx = s.pos.x - spec.denX;
      const dz = s.pos.z - spec.denZ;
      const d = Math.hypot(dx, dz);
      if (d > spec.patrolRadius) {
        s.pos.x = spec.denX + (dx / d) * spec.patrolRadius;
        s.pos.z = spec.denZ + (dz / d) * spec.patrolRadius;
      }
      const td = Math.hypot(s.target.x - s.pos.x, s.target.z - s.pos.z);
      if (td < 0.55) pickRoamTarget(s, spec);
      if (now >= s.roamUntil) {
        s.phase = "home";
        s.target.set(spec.denX, spec.denY, spec.denZ);
      }
    } else {
      s.target.set(spec.denX, spec.denY, spec.denZ);
      moveToward(s, crawl * 1.15, dt);
      const homeDist = Math.hypot(s.pos.x - spec.denX, s.pos.z - spec.denZ);
      if (homeDist < 0.5) {
        s.phase = "den";
        s.emergeAt = now + 9000 + spec.timerOffset * 200 + Math.random() * 8000;
      }
    }

    const gx = s.pos.x;
    const gz = s.pos.z;
    const gy = heightAt(gx, gz) + foot - buryAmt;

    const g = groupRef.current;
    if (g) {
      g.position.set(gx, gy, gz);
      g.rotation.set(0, s.yaw, 0);
      if (clips.length === 0) {
        const t = performance.now() * 0.001;
        g.rotation.z =
          Math.sin(t * spec.animSpeed + spec.animPhase * 6.28) * 0.06;
      } else {
        g.rotation.z = 0;
      }
    }
    faunaPositions.setSnake(spec.id, gx, gy, gz);
  });

  return (
    <group
      ref={groupRef}
      scale={baseScale * spec.scale}
    >
      <primitive object={instance} />
    </group>
  );
}

function moveToward(s: SnakeSim, crawl: number, dt: number): void {
  let dx = s.target.x - s.pos.x;
  let dz = s.target.z - s.pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 1e-4) return;
  dx /= dist;
  dz /= dist;
  s.pos.x += dx * crawl * dt;
  s.pos.z += dz * crawl * dt;
  s.yaw = Math.atan2(dx, dz);
}
