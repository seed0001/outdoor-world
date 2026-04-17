import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import {
  CapsuleCollider,
  RigidBody,
  useRapier,
  type RapierRigidBody,
} from "@react-three/rapier";
import { heightAt } from "../world/terrain";
import { usePlayerControlsGetter } from "./usePlayerControls";
import { playerRef } from "../systems/player/playerRef";
import { health, useHealth } from "../systems/player/health";
import { onCommand } from "../systems/world/commands";
import { updateWalkingFoley } from "../systems/audio/gameAudio";

const WALK_SPEED = 4.5;
const RUN_SPEED = 8.5;
const JUMP_VELOCITY = 7.5;

const CAPSULE_HALF_HEIGHT = 0.55;
const CAPSULE_RADIUS = 0.35;
const EYE_OFFSET = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS * 0.5;

const GROUND_RAY_LEN = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS + 0.05;
const RESPAWN_Y = -20;

export default function Player() {
  const body = useRef<RapierRigidBody>(null);
  const { camera } = useThree();
  const { rapier, world } = useRapier();
  const getControls = usePlayerControlsGetter();
  const hp = useHealth();

  const forward = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const shakeOffset = useMemo(() => new THREE.Vector3(), []);

  const spawn = useMemo<[number, number, number]>(() => {
    return [0, heightAt(0, 0) + 4, 0];
  }, []);

  useEffect(() => {
    playerRef.spawn = spawn;
  }, [spawn]);

  useEffect(() => {
    playerRef.body = body.current;
    return () => {
      playerRef.body = null;
    };
  }, []);

  const respawn = useMemo(
    () => () => {
      const rb = body.current;
      if (!rb) return;
      rb.setTranslation({ x: spawn[0], y: spawn[1], z: spawn[2] }, true);
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
      health.respawn();
    },
    [spawn],
  );

  useEffect(() => {
    return onCommand("player:respawn", respawn);
  }, [respawn]);

  // Fall damage: track velocity drops.
  const lastYVel = useRef(0);

  useFrame((state, dt) => {
    const rb = body.current;
    if (!rb) return;

    if (!playerRef.body) playerRef.body = rb;

    const locked = !!document.pointerLockElement;
    const pos = rb.translation();
    const v = rb.linvel();

    playerRef.position.set(pos.x, pos.y, pos.z);

    if (pos.y < RESPAWN_Y) {
      respawn();
      return;
    }

    const ray = new rapier.Ray(
      { x: pos.x, y: pos.y, z: pos.z },
      { x: 0, y: -1, z: 0 },
    );
    const hit = world.castRay(
      ray,
      GROUND_RAY_LEN,
      true,
      undefined,
      undefined,
      undefined,
      rb,
    );
    const grounded = hit !== null;

    if (hp.dead) {
      // Freeze player while dead.
      rb.setLinvel({ x: 0, y: v.y, z: 0 }, true);
      camera.position.set(pos.x, pos.y + EYE_OFFSET, pos.z);
      updateWalkingFoley({
        locked: false,
        grounded,
        dead: true,
        horizSpeed: 0,
        wantsMove: false,
      });
      return;
    }

    // Fall damage on landing
    if (grounded && lastYVel.current < -16) {
      const impact = -lastYVel.current - 16;
      health.damage(Math.min(100, Math.round(impact * 4)), "the ground");
    }
    lastYVel.current = v.y;

    if (!locked) {
      rb.setLinvel({ x: 0, y: v.y, z: 0 }, true);
      applyCamera(camera, pos, shakeOffset, state.clock.elapsedTime);
      updateWalkingFoley({
        locked: false,
        grounded,
        dead: false,
        horizSpeed: 0,
        wantsMove: false,
      });
      return;
    }

    const s = getControls();

    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    else forward.normalize();
    right.crossVectors(forward, camera.up).normalize();

    const fwd = (s.forward ? 1 : 0) - (s.back ? 1 : 0);
    const rgt = (s.right ? 1 : 0) - (s.left ? 1 : 0);

    dir.set(0, 0, 0).addScaledVector(forward, fwd).addScaledVector(right, rgt);
    if (dir.lengthSq() > 0) dir.normalize();

    const speed = s.run ? RUN_SPEED : WALK_SPEED;
    rb.setLinvel(
      { x: dir.x * speed, y: v.y, z: dir.z * speed },
      true,
    );

    if (s.jump && grounded) {
      rb.setLinvel(
        { x: dir.x * speed, y: JUMP_VELOCITY, z: dir.z * speed },
        true,
      );
    }

    applyCamera(camera, pos, shakeOffset, state.clock.elapsedTime);
    playerRef.shake = Math.max(0, playerRef.shake - dt * 2);

    const vNow = rb.linvel();
    const horiz = Math.hypot(vNow.x, vNow.z);
    const wantsMove = fwd !== 0 || rgt !== 0;
    updateWalkingFoley({
      locked,
      grounded,
      dead: hp.dead,
      horizSpeed: horiz,
      wantsMove,
    });
  });

  return (
    <RigidBody
      ref={body}
      type="dynamic"
      colliders={false}
      position={spawn}
      enabledRotations={[false, false, false]}
      canSleep={false}
      mass={1}
      linearDamping={0.15}
      friction={0}
      restitution={0}
      ccd
    >
      <CapsuleCollider args={[CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS]} />
    </RigidBody>
  );
}

function applyCamera(
  camera: THREE.Camera,
  pos: { x: number; y: number; z: number },
  out: THREE.Vector3,
  time: number,
) {
  const shake = playerRef.shake;
  out.set(
    Math.sin(time * 40) * shake * 0.12,
    Math.cos(time * 52) * shake * 0.12,
    0,
  );
  camera.position.set(
    pos.x + out.x,
    pos.y + EYE_OFFSET + out.y,
    pos.z + out.z,
  );
}
