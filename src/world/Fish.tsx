import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useLoader } from "@react-three/fiber";
import { FBXLoader, SkeletonUtils, TGALoader } from "three-stdlib";
import {
  fishes,
  type FishSpec,
  SWIM_MAX_R,
  SWIM_MIN_Y,
  SWIM_MAX_Y,
} from "../systems/world/fishRegistry";
import { LAKE_CENTER_X, LAKE_CENTER_Z } from "./terrain";
import { snapshot } from "../systems/world/worldClock";
import { getWeather } from "../systems/weather/weatherSystem";
import { temperatureC } from "../systems/world/calendar";
import { isFaunaAlive } from "../systems/world/faunaLifecycle";
import { faunaPositions } from "../systems/world/faunaPositions";

const MODEL_URL = "/models/fish/Fish.FBX";

/**
 * Loads the shared fish FBX (with a TGA normal-map handler registered on the
 * loading manager so the authoring textures resolve) and spawns a school of
 * independent swimmers from `fishRegistry`. Each fish has its own wander AI
 * constrained to the lake volume, yaw-based tail wag synced to swim speed,
 * and slows to a near stop when the water is near freezing.
 */
export default function Fish() {
  const fbx = useLoader(FBXLoader, MODEL_URL, (loader) => {
    // FBX embeds texture filenames; the loader uses the manager to resolve
    // extensions. Register TGA up front so the .tga normal map loads.
    loader.manager.addHandler(/\.tga$/i, new TGALoader());

    // The FBX was authored on someone else's machine and bakes in absolute
    // Windows paths + the original filenames (`ryba1.jpg`, `ryba1reflect.jpg`).
    // The redistributed asset pack renamed those files to `Albedo.png` and
    // `Metallic.png` but never re-exported the FBX, so the loader chases
    // dead URLs. Remap by basename to the real files on disk.
    loader.manager.setURLModifier((url) => {
      const base = (url.split(/[\\/]/).pop() || url).toLowerCase();
      if (base === "ryba1.jpg") return "/models/fish/Albedo.png";
      if (base === "ryba1reflect.jpg") return "/models/fish/Metallic.png";
      if (base === "rybaloupolynormalsmap.tga")
        return "/models/fish/RYBALOUPOLYNormalsMap.tga";
      return url;
    });
  });

  // Inspect once: the longest AABB axis is the fish's length axis; compute
  // a quaternion that rotates it to +X so our yaw-based steering is consistent.
  const { baseScale, forwardQuat } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(fbx);
    const size = new THREE.Vector3();
    box.getSize(size);
    const longest = Math.max(size.x, size.y, size.z);
    const scale = longest > 0.001 ? 0.42 / longest : 1;

    const forward = new THREE.Vector3();
    if (size.x >= size.y && size.x >= size.z) forward.set(1, 0, 0);
    else if (size.z >= size.y) forward.set(0, 0, 1);
    else forward.set(0, 1, 0);

    const q = new THREE.Quaternion().setFromUnitVectors(
      forward,
      new THREE.Vector3(1, 0, 0),
    );
    return { baseScale: scale, forwardQuat: q };
  }, [fbx]);

  return (
    <group>
      {fishes.map((spec) => (
        <OneFish
          key={spec.id}
          spec={spec}
          template={fbx}
          baseScale={baseScale}
          forwardQuat={forwardQuat}
        />
      ))}
    </group>
  );
}

interface OneFishProps {
  spec: FishSpec;
  template: THREE.Object3D;
  baseScale: number;
  forwardQuat: THREE.Quaternion;
}

const _seekDir = new THREE.Vector3();
const _desiredVel = new THREE.Vector3();

function OneFish({ spec, template, baseScale, forwardQuat }: OneFishProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);

  const instance = useMemo(() => {
    const cloned = SkeletonUtils.clone(template);
    // Bake the forward-axis orient into the clone's root so inner yaw (wag)
    // behaves as a clean local rotation on top of model alignment.
    cloned.quaternion.copy(forwardQuat);
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        if (mesh.material) {
          // Clone so per-fish material tweaks never leak between instances.
          const src = mesh.material as THREE.Material | THREE.Material[];
          mesh.material = Array.isArray(src)
            ? src.map((m) => m.clone())
            : src.clone();
        }
      }
    });
    return cloned;
  }, [template, forwardQuat]);

  // Mutable per-fish simulation state. Seeded from spec so behaviour is
  // deterministic across reloads but varied between fish.
  const sim = useRef(createSim(spec));
  const prevAliveRef = useRef(true);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1); // cap huge frames after tab-switch
    const nowMs = performance.now();
    const alive = isFaunaAlive("fish", spec.id, nowMs);
    if (alive && !prevAliveRef.current) {
      sim.current = createSim(spec);
    }
    prevAliveRef.current = alive;
    if (!alive) {
      if (groupRef.current) groupRef.current.visible = false;
      return;
    }
    if (groupRef.current) groupRef.current.visible = true;

    const s = sim.current;
    const now = nowMs / 1000;

    const world = snapshot();
    const weather = getWeather();
    const temp = temperatureC(world, 0, weather.tempMod);
    // Near-freezing fish sit almost still. At 8C+ they move at cruise.
    const slow = THREE.MathUtils.clamp((temp + 2) / 10, 0.12, 1.0);

    // Pick a fresh waypoint when close, when the timer expires, or when
    // we've drifted outside the swim disc (containment steering overshoot).
    const distToTarget = s.pos.distanceTo(s.target);
    const rXZ = Math.hypot(s.pos.x - LAKE_CENTER_X, s.pos.z - LAKE_CENTER_Z);
    if (distToTarget < 0.9 || now > s.nextTargetT || rXZ > SWIM_MAX_R + 0.5) {
      pickWaypoint(s, spec, weather.rainRate * weather.intensity);
      s.nextTargetT = now + 4 + s.rand() * 6;
    }

    // Seek direction
    _seekDir.copy(s.target).sub(s.pos);
    const seekLen = _seekDir.length();
    if (seekLen > 0.0001) _seekDir.multiplyScalar(1 / seekLen);

    // Soft containment: steer back toward centre when near the rim.
    if (rXZ > SWIM_MAX_R - 2.0) {
      const pull = Math.min(1, (rXZ - (SWIM_MAX_R - 2.0)) / 2.0);
      _seekDir.x -= ((s.pos.x - LAKE_CENTER_X) / rXZ) * pull;
      _seekDir.z -= ((s.pos.z - LAKE_CENTER_Z) / rXZ) * pull;
      _seekDir.normalize();
    }

    // Vertical containment so fish never breach the surface or kiss the floor.
    if (s.pos.y < SWIM_MIN_Y + 0.15) _seekDir.y = Math.max(_seekDir.y, 0.4);
    if (s.pos.y > SWIM_MAX_Y - 0.15) _seekDir.y = Math.min(_seekDir.y, -0.4);

    const cruise = spec.speed * slow;
    _desiredVel.copy(_seekDir).multiplyScalar(cruise);

    // Smooth steer: ease velocity toward desired at turnRate per second.
    s.vel.lerp(_desiredVel, Math.min(1, dt * spec.turnRate));

    // Integrate position
    s.pos.addScaledVector(s.vel, dt);

    // Hard clamp volume as a safety net if AI misbehaves near edges.
    s.pos.y = THREE.MathUtils.clamp(s.pos.y, SWIM_MIN_Y, SWIM_MAX_Y);

    // Heading from velocity in the XZ plane. When the fish is nearly stopped
    // (cold water), hold the previous heading so it doesn't spin.
    const horizSpeed = Math.hypot(s.vel.x, s.vel.z);
    if (horizSpeed > 0.05) {
      // See note: rotation.y = θ maps local +X to (cos θ, 0, -sin θ).
      const targetHeading = Math.atan2(-s.vel.z, s.vel.x);
      let dh = targetHeading - s.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      s.heading += dh * Math.min(1, dt * spec.turnRate * 1.2);
    }

    // Apply transforms
    if (groupRef.current) {
      groupRef.current.position.set(
        s.pos.x,
        s.pos.y + Math.sin(now * 1.1 + spec.phase * 6.28) * 0.025,
        s.pos.z,
      );
      groupRef.current.rotation.y = s.heading;
    }
    if (bodyRef.current) {
      const speedFrac = Math.min(1, s.vel.length() / Math.max(0.01, spec.speed));
      // Tail wag: frequency and amplitude scale with speed; both muted in cold.
      const wagAmp = spec.wagAmp * (0.35 + speedFrac * 0.75) * slow;
      bodyRef.current.rotation.y =
        Math.sin(now * spec.wagFreq * (0.5 + speedFrac * 0.7) + spec.phase * 6.28) *
        wagAmp;
    }

    const bob = Math.sin(now * 1.1 + spec.phase * 6.28) * 0.025;
    faunaPositions.setFish(spec.id, s.pos.x, s.pos.y + bob, s.pos.z);
  });

  return (
    <group ref={groupRef} scale={baseScale * spec.scale}>
      <group ref={bodyRef}>
        <primitive object={instance} />
      </group>
    </group>
  );
}

/* ---------- sim state ------------------------------------------------------- */

interface FishSim {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  target: THREE.Vector3;
  nextTargetT: number;
  heading: number;
  rand: () => number;
}

function createSim(spec: FishSpec): FishSim {
  // Per-fish PRNG so waypoint choices stay deterministic but decorrelated.
  const rand = mulberryFromSpec(spec);
  const heading = spec.phase * Math.PI * 2;
  const vel = new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading))
    .multiplyScalar(spec.speed * 0.5);
  return {
    pos: new THREE.Vector3(spec.x, spec.y, spec.z),
    vel,
    target: new THREE.Vector3(spec.x, spec.y, spec.z),
    nextTargetT: 0,
    heading,
    rand,
  };
}

function pickWaypoint(sim: FishSim, spec: FishSpec, rainAmount: number): void {
  const angle = sim.rand() * Math.PI * 2;
  const r = Math.sqrt(sim.rand()) * SWIM_MAX_R;
  // Rain nudges the school slightly shallower (rising to chase surface insects).
  const yBias = rainAmount > 0.05 ? 0.25 : 0;
  const yNorm = THREE.MathUtils.clamp(sim.rand() + yBias, 0, 1);
  sim.target.set(
    LAKE_CENTER_X + Math.cos(angle) * r,
    SWIM_MIN_Y + yNorm * (SWIM_MAX_Y - SWIM_MIN_Y),
    LAKE_CENTER_Z + Math.sin(angle) * r,
  );
  // Prevent stale value warning on unused spec param if inlined later.
  void spec;
}

function mulberryFromSpec(spec: FishSpec): () => number {
  let s = (spec.id * 2654435761 + 91173) | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
