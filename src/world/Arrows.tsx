import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import {
  CuboidCollider,
  RigidBody,
  type RapierRigidBody,
} from "@react-three/rapier";
import {
  worldState,
  type ArrowPickupPayload,
} from "../systems/world/worldState";
import { playerRef, addCameraShake } from "../systems/player/playerRef";
import { inventory } from "../systems/player/inventory";
import { health } from "../systems/player/health";
import { isBackpackOpen } from "../systems/ui/backpackState";
import { faunaSphereHitAtPoint } from "../systems/world/faunaPositions";
import { killFauna } from "../systems/world/faunaLifecycle";
import { playWoodChopSfx } from "../systems/audio/gameAudio";

const ARROW_URL = "/models/arrow.glb";
const SHOOT_SPEED = 46;
const SHOOT_COOLDOWN = 0.42;
const REST_SPEED = 0.65;
const REST_HOLD = 0.38;
const MAX_FLIGHT = 14;
const PICKUP_R2 = 1.35 * 1.35;

/** Local +X = shaft (tip toward +X) after `ArrowModel` normalization. */
const SHAFT = new THREE.Vector3(1, 0, 0);

useGLTF.preload(ARROW_URL);

type Shot = {
  id: number;
  origin: [number, number, number];
  dir: [number, number, number];
};

function quatFromDir(dx: number, dy: number, dz: number): THREE.Quaternion {
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6) return new THREE.Quaternion();
  const x = dx / len;
  const y = dy / len;
  const z = dz / len;
  const forward = new THREE.Vector3(x, y, z);
  const q = new THREE.Quaternion();
  q.setFromUnitVectors(SHAFT, forward);
  return q;
}

function ArrowModel() {
  const { scene } = useGLTF(ARROW_URL) as unknown as { scene: THREE.Object3D };
  const root = useMemo(() => {
    const clone = SkeletonUtils.clone(scene);
    clone.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false;
      }
    });
    clone.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 1e-4);
    const target = 0.85;
    clone.scale.multiplyScalar(target / maxDim);
    clone.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(clone);
    const c = b2.getCenter(new THREE.Vector3());
    clone.position.sub(c);
    return clone;
  }, [scene]);
  return <primitive object={root} />;
}

function ArrowProjectile({
  shot,
  onDone,
}: {
  shot: Shot;
  onDone: (id: number) => void;
}) {
  const rb = useRef<RapierRigidBody>(null);
  const spawnAt = useRef(performance.now());
  const lowSpeedFor = useRef(0);
  const settled = useRef(false);
  const q = useMemo(() => quatFromDir(...shot.dir), [shot.dir]);

  const rotEuler = useMemo(() => {
    const e = new THREE.Euler().setFromQuaternion(q, "YXZ");
    return [e.x, e.y, e.z] as [number, number, number];
  }, [q]);

  const settle = useCallback(
    (body: RapierRigidBody) => {
      if (settled.current) return;
      settled.current = true;
      const t = body.translation();
      const r = body.rotation();
      const quat: [number, number, number, number] = [r.x, r.y, r.z, r.w];
      worldState.addArrowPickup({
        position: [t.x, t.y, t.z],
        rotation: quat,
      });
      onDone(shot.id);
    },
    [onDone, shot.id],
  );

  useEffect(() => {
    const body = rb.current;
    if (!body) return;
    const [dx, dy, dz] = shot.dir;
    const len = Math.hypot(dx, dy, dz) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const uz = dz / len;
    body.setLinvel({ x: ux * SHOOT_SPEED, y: uy * SHOOT_SPEED, z: uz * SHOOT_SPEED }, true);
  }, [shot.dir]);

  useFrame((_, dt) => {
    const body = rb.current;
    if (!body || settled.current) return;

    const now = performance.now();
    if (now - spawnAt.current > MAX_FLIGHT * 1000) {
      settle(body);
      return;
    }

    const t = body.translation();
    const v = body.linvel();
    const speed = Math.hypot(v.x, v.y, v.z);

    const fauna = faunaSphereHitAtPoint(t.x, t.y, t.z);
    if (fauna && killFauna(fauna.kind, fauna.id)) {
      playWoodChopSfx();
      addCameraShake(0.12);
      settle(body);
      return;
    }

    if (speed < REST_SPEED) {
      lowSpeedFor.current += dt;
      if (lowSpeedFor.current >= REST_HOLD) settle(body);
    } else {
      lowSpeedFor.current = 0;
    }
  });

  return (
    <RigidBody
      ref={rb}
      position={shot.origin}
      rotation={rotEuler}
      type="dynamic"
      colliders={false}
      mass={0.12}
      linearDamping={0.08}
      angularDamping={1.8}
      friction={0.85}
      restitution={0.12}
      ccd
      canSleep
    >
      <CuboidCollider args={[0.38, 0.03, 0.03]} />
      <Suspense fallback={null}>
        <ArrowModel />
      </Suspense>
    </RigidBody>
  );
}

function ArrowPickupMesh({ p }: { p: ArrowPickupPayload }) {
  const q = useMemo(
    () =>
      new THREE.Quaternion(
        p.rotation[0],
        p.rotation[1],
        p.rotation[2],
        p.rotation[3],
      ),
    [p.rotation],
  );
  return (
    <group position={p.position} quaternion={q}>
      <Suspense fallback={null}>
        <ArrowModel />
      </Suspense>
    </group>
  );
}

export default function Arrows() {
  const { camera } = useThree();
  const [shots, setShots] = useState<Shot[]>([]);
  const [pickups, setPickups] = useState<ArrowPickupPayload[]>(() =>
    worldState.listArrowPickups(),
  );
  const nextShotId = useRef(1);
  const cooldown = useRef(0);
  const mouseDown = useRef(false);
  const wasDown = useRef(false);

  useEffect(() => {
    const sync = () => setPickups(worldState.listArrowPickups());
    sync();
    return worldState.subscribe(sync);
  }, []);

  useEffect(() => {
    const preventMenu = (e: MouseEvent) => e.preventDefault();
    window.addEventListener("contextmenu", preventMenu);
    return () => window.removeEventListener("contextmenu", preventMenu);
  }, []);

  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (e.button === 2) mouseDown.current = true;
    };
    const up = (e: MouseEvent) => {
      if (e.button === 2) mouseDown.current = false;
    };
    window.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  const removeShot = useCallback((id: number) => {
    setShots((s) => s.filter((x) => x.id !== id));
  }, []);

  useFrame((_, dt) => {
    cooldown.current = Math.max(0, cooldown.current - dt);

    const locked = !!document.pointerLockElement;
    const pressed =
      mouseDown.current && locked && !health.get().dead && !isBackpackOpen();
    const edge = pressed && !wasDown.current;
    wasDown.current = pressed;

    if (!edge || cooldown.current > 0) return;
    if (inventory.get().arrow < 1) return;

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const ox = camera.position.x + dir.x * 0.85;
    const oy = camera.position.y + dir.y * 0.85;
    const oz = camera.position.z + dir.z * 0.85;

    if (!inventory.tryConsume({ arrow: 1 })) return;

    cooldown.current = SHOOT_COOLDOWN;
    addCameraShake(0.06);
    const id = nextShotId.current++;
    setShots((s) => [
      ...s,
      {
        id,
        origin: [ox, oy, oz],
        dir: [dir.x, dir.y, dir.z],
      },
    ]);
  });

  useFrame(() => {
    const px = playerRef.position.x;
    const py = playerRef.position.y;
    const pz = playerRef.position.z;
    const collected: number[] = [];
    for (const p of worldState.listArrowPickups()) {
      const dx = p.position[0] - px;
      const dy = p.position[1] - py;
      const dz = p.position[2] - pz;
      if (dx * dx + dy * dy + dz * dz <= PICKUP_R2) {
        inventory.add("arrow", 1);
        collected.push(p.id);
      }
    }
    for (const id of collected) worldState.removeArrowPickup(id);
  });

  return (
    <group>
      {pickups.map((p) => (
        <ArrowPickupMesh key={`arrow-pu-${p.id}`} p={p} />
      ))}
      {shots.map((s) => (
        <ArrowProjectile key={`arrow-shot-${s.id}`} shot={s} onDone={removeShot} />
      ))}
    </group>
  );
}
