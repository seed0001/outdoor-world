import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import {
  butterflies,
  type ButterflySpec,
} from "../systems/world/butterflyRegistry";
import { heightAt, mulberry32 } from "./terrain";
import { snapshot } from "../systems/world/worldClock";
import { getWeather } from "../systems/weather/weatherSystem";
import { foliageLevel, temperatureC } from "../systems/world/calendar";

const MODEL_URL = "/models/butterfly.glb";

useGLTF.preload(MODEL_URL);

/**
 * A small population of fully-rigged butterflies. The source GLB ships three
 * clips (`hover`, `idle`, `take_off_and_land`) which we crossfade through a
 * FLYING ↔ LANDING ↔ RESTING ↔ TAKING_OFF state machine.
 *
 * Each butterfly runs its own simulation:
 *  - seeks a noise-perturbed waypoint around its home with a zig-zag drift,
 *  - bobs vertically at wing-beat frequency (bounding flight),
 *  - lands on a predetermined ground spot, idles wings-folded for a breath,
 *    then takes off again.
 *
 * Visibility is gated by season × time-of-day × weather. Butterflies vanish
 * at night, during rain/hail/storms/tornadoes, and in winter. Opacity fades
 * smoothly so they don't pop.
 */
export default function Butterfly() {
  const gltf = useGLTF(MODEL_URL) as unknown as {
    scene: THREE.Group;
    animations: THREE.AnimationClip[];
  };

  // Inspect once: auto-scale so the wingspan reads at ~0.12m (small but visible).
  const baseScale = useMemo(() => {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const longest = Math.max(size.x, size.y, size.z);
    if (longest < 0.001) return 1;
    return 0.12 / longest;
  }, [gltf.scene]);

  return (
    <group>
      {butterflies.map((spec) => (
        <OneButterfly
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

/* -------------------------------------------------------------------------- */

type FlightPhase = "FLYING" | "LANDING" | "RESTING" | "TAKING_OFF";

interface OneProps {
  spec: ButterflySpec;
  template: THREE.Group;
  clips: THREE.AnimationClip[];
  baseScale: number;
}

const _seek = new THREE.Vector3();
const _noiseVec = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _look = new THREE.Vector3();

function OneButterfly({ spec, template, clips, baseScale }: OneProps) {
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<{
    hover: THREE.AnimationAction | null;
    idle: THREE.AnimationAction | null;
    transition: THREE.AnimationAction | null;
  }>({ hover: null, idle: null, transition: null });
  const materialsRef = useRef<THREE.Material[]>([]);

  const instance = useMemo(() => {
    const cloned = SkeletonUtils.clone(template);
    const mats: THREE.Material[] = [];
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.frustumCulled = false; // skinned bounds don't follow motion well
        if (mesh.material) {
          const src = mesh.material as THREE.Material | THREE.Material[];
          if (Array.isArray(src)) {
            mesh.material = src.map((m) => prepMaterial(m));
            (mesh.material as THREE.Material[]).forEach((m) => mats.push(m));
          } else {
            mesh.material = prepMaterial(src);
            mats.push(mesh.material);
          }
        }
      }
    });
    return { cloned, mats };
  }, [template]);

  useEffect(() => {
    materialsRef.current = instance.mats;
  }, [instance]);

  useEffect(() => {
    if (clips.length === 0) return;
    const mixer = new THREE.AnimationMixer(instance.cloned);
    mixerRef.current = mixer;

    const hoverClip = clips.find((c) => c.name === "hover") ?? clips[0];
    const idleClip = clips.find((c) => c.name === "idle") ?? clips[0];
    const transClip =
      clips.find((c) => c.name === "take_off_and_land") ?? null;

    const hover = mixer.clipAction(hoverClip);
    const idle = mixer.clipAction(idleClip);
    hover.setLoop(THREE.LoopRepeat, Infinity);
    idle.setLoop(THREE.LoopRepeat, Infinity);
    hover.timeScale = spec.flapSpeed;
    idle.timeScale = 1;
    hover.time = spec.phase * (hoverClip.duration || 1);
    idle.time = spec.phase * (idleClip.duration || 1);
    hover.play();
    idle.play();
    idle.setEffectiveWeight(0);
    hover.setEffectiveWeight(1);

    let transition: THREE.AnimationAction | null = null;
    if (transClip) {
      transition = mixer.clipAction(transClip);
      transition.setLoop(THREE.LoopOnce, 1);
      transition.clampWhenFinished = true;
      transition.setEffectiveWeight(0);
      transition.play();
      transition.paused = true;
    }

    actionsRef.current = { hover, idle, transition };

    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(instance.cloned);
      mixerRef.current = null;
      actionsRef.current = { hover: null, idle: null, transition: null };
    };
  }, [instance, clips, spec.flapSpeed, spec.phase]);

  // Simulation state — mutable, no re-renders.
  const sim = useRef(createSim(spec));
  // Current rendered opacity, eased toward target.
  const opacityRef = useRef(0);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.08);
    const mixer = mixerRef.current;
    if (mixer) mixer.update(dt);

    const s = sim.current;
    const group = groupRef.current;
    if (!group) return;

    const now = performance.now() / 1000;
    const world = snapshot();
    const weather = getWeather();
    const temp = temperatureC(world, 0, weather.tempMod);

    /* ---------- visibility gating ---------- */

    // Midday = 1, night = 0. Butterflies only fly when the sun is up.
    const sunAlt = Math.sin((world.dayFrac - 0.25) * Math.PI * 2);
    const dayFactor = THREE.MathUtils.clamp(sunAlt * 3 - 0.3, 0, 1);

    // Seasonal activity. foliageLevel already tracks the leaf calendar:
    // bare-winter = 0, spring/summer/early-autumn = 1.
    const seasonFactor = foliageLevel(world.yearFrac);

    // Cold snap kills the butterflies too, even in shoulder seasons.
    const tempFactor = THREE.MathUtils.clamp((temp - 4) / 8, 0, 1);

    // Hostile weather: butterflies hide.
    const weatherHostile =
      weather.type === "rain" ||
      weather.type === "hail" ||
      weather.type === "thunderstorm" ||
      weather.type === "snow" ||
      weather.type === "blizzard" ||
      weather.type === "tornado";
    const weatherFactor = weatherHostile
      ? Math.max(0, 1 - weather.intensity * 2.5)
      : 1 - weather.cloudDarkness * 0.3;

    const visibilityTarget =
      dayFactor * seasonFactor * tempFactor * weatherFactor;

    // Ease opacity — fast fade out (scared by weather), slower fade in.
    const easeRate = visibilityTarget > opacityRef.current ? 0.6 : 2.4;
    opacityRef.current +=
      (visibilityTarget - opacityRef.current) * Math.min(1, dt * easeRate);

    const op = opacityRef.current;
    if (op < 0.01) {
      group.visible = false;
      return;
    }
    group.visible = true;

    // Apply opacity to all shared-cloned materials.
    const mats = materialsRef.current;
    for (let i = 0; i < mats.length; i++) {
      mats[i].opacity = op;
    }

    /* ---------- state machine ---------- */

    switch (s.phase) {
      case "FLYING": {
        // Decide to land occasionally — but not during fading (feels weird
        // if they settle just as they're vanishing).
        if (op > 0.9 && now > s.stateUntil && s.rand() < 0.6) {
          s.phase = "LANDING";
          s.target.set(spec.restX, spec.restY + 0.04, spec.restZ);
          s.stateUntil = now + 8; // safety fallback timeout
          break;
        }
        // Choose a new flight waypoint when close or timer up.
        if (s.pos.distanceTo(s.target) < 0.6 || now > s.waypointUntil) {
          pickFlightWaypoint(s, spec);
        }
        break;
      }
      case "LANDING": {
        // When near the rest spot, commit to RESTING.
        if (s.pos.distanceTo(s.target) < 0.25 || now > s.stateUntil) {
          s.phase = "RESTING";
          s.pos.copy(s.target);
          s.vel.set(0, 0, 0);
          s.stateUntil = now + 4 + s.rand() * 10;
          crossfadeTo("idle", actionsRef.current, 0.6);
          playTransition(actionsRef.current, 1);
        }
        break;
      }
      case "RESTING": {
        if (now > s.stateUntil) {
          s.phase = "TAKING_OFF";
          s.stateUntil = now + 0.9;
          playTransition(actionsRef.current, -1);
          crossfadeTo("hover", actionsRef.current, 0.5);
        }
        break;
      }
      case "TAKING_OFF": {
        if (now > s.stateUntil) {
          s.phase = "FLYING";
          pickFlightWaypoint(s, spec);
          s.stateUntil = now + 14 + s.rand() * 10; // before next landing chance
        }
        break;
      }
    }

    /* ---------- movement ---------- */

    if (s.phase === "RESTING") {
      // Sit on the ground. Still apply a whisper of rotation so body isn't stiff.
      group.position.set(s.pos.x, s.pos.y, s.pos.z);
      group.rotation.set(0, s.heading, 0);
    } else {
      // Seek + noise-perturbed direction.
      _seek.copy(s.target).sub(s.pos);
      const seekLen = _seek.length();
      if (seekLen > 0.0001) _seek.multiplyScalar(1 / seekLen);

      // Butterfly zig-zag: low-frequency noise perpendicular to heading.
      const nx = hashSin(now * 1.3, spec.seed * 0.91) * 0.9;
      const ny = hashSin(now * 0.9, spec.seed * 1.13) * 0.5;
      const nz = hashSin(now * 1.1, spec.seed * 1.37) * 0.9;
      _noiseVec.set(nx, ny, nz);

      // Blend seek with noise — more noise when cruising, less when landing.
      const noiseWeight = s.phase === "LANDING" ? 0.15 : 0.6;
      _desired
        .copy(_seek)
        .multiplyScalar(1 - noiseWeight)
        .addScaledVector(_noiseVec, noiseWeight)
        .normalize();

      const cruise =
        spec.wanderSpeed *
        (s.phase === "LANDING" ? 0.5 : 1) *
        // Slight slow-down in hot weather would be weird; butterflies
        // actually *prefer* warm weather, so don't scale by temp here.
        1;
      _desired.multiplyScalar(cruise);

      // Smooth steer.
      s.vel.lerp(_desired, Math.min(1, dt * 1.8));

      // Bounding flight: vertical sine wave at wing-beat frequency, riding on
      // top of whatever altitude the seek vector wants.
      const flap = spec.flapSpeed * 7.0;
      const bob = Math.sin(now * flap + spec.phase * 6.28) * 0.11;

      s.pos.addScaledVector(s.vel, dt);
      s.pos.y += bob * dt * 6; // integrate bob as velocity so it's frame-rate stable

      // Don't dip below local ground or punch through the sky ceiling.
      const ground = heightAt(s.pos.x, s.pos.z);
      const minY = ground + 0.35;
      const maxY = ground + spec.cruiseHeight + 1.5;
      if (s.pos.y < minY) {
        s.pos.y = minY;
        s.vel.y = Math.max(0, s.vel.y);
      }
      if (s.pos.y > maxY) {
        s.pos.y = maxY;
        s.vel.y = Math.min(0, s.vel.y);
      }

      // Orient body toward motion. Use lookAt so pitch works naturally.
      _look.copy(s.pos).add(s.vel);
      group.position.copy(s.pos);
      group.lookAt(_look);

      // Track heading for the RESTING clamp.
      s.heading = group.rotation.y;
    }
  });

  return (
    <group ref={groupRef} scale={baseScale * spec.scale}>
      <primitive object={instance.cloned} />
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

interface Sim {
  phase: FlightPhase;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  target: THREE.Vector3;
  waypointUntil: number;
  stateUntil: number;
  heading: number;
  rand: () => number;
}

function createSim(spec: ButterflySpec): Sim {
  const rand = mulberry32(spec.seed);
  const startH = heightAt(spec.homeX, spec.homeZ) + spec.cruiseHeight;
  const heading = rand() * Math.PI * 2;
  return {
    phase: "FLYING",
    pos: new THREE.Vector3(spec.homeX, startH, spec.homeZ),
    vel: new THREE.Vector3(
      Math.cos(heading) * spec.wanderSpeed * 0.6,
      0,
      Math.sin(heading) * spec.wanderSpeed * 0.6,
    ),
    target: new THREE.Vector3(spec.homeX, startH, spec.homeZ),
    waypointUntil: 0,
    stateUntil: 6 + rand() * 10,
    heading,
    rand,
  };
}

function pickFlightWaypoint(sim: Sim, spec: ButterflySpec): void {
  const r = Math.sqrt(sim.rand()) * spec.patrolRadius;
  const a = sim.rand() * Math.PI * 2;
  const tx = spec.homeX + Math.cos(a) * r;
  const tz = spec.homeZ + Math.sin(a) * r;
  const base = heightAt(tx, tz);
  const ty = base + spec.cruiseHeight * (0.55 + sim.rand() * 0.9);
  sim.target.set(tx, ty, tz);
  sim.waypointUntil = performance.now() / 1000 + 2.5 + sim.rand() * 3.5;
}

function crossfadeTo(
  which: "hover" | "idle",
  actions: {
    hover: THREE.AnimationAction | null;
    idle: THREE.AnimationAction | null;
  },
  duration: number,
): void {
  const to = actions[which];
  const from = which === "hover" ? actions.idle : actions.hover;
  if (to) to.setEffectiveTimeScale(1);
  if (!from || !to) return;
  // Explicit weight lerp via a tiny tween. Three's crossfadeTo can't be
  // safely called twice in a row if the first one hasn't finished, so we
  // rely on setEffectiveWeight and rely on useFrame pacing.
  from.fadeOut(duration);
  to.reset().fadeIn(duration).play();
}

function playTransition(
  actions: {
    transition: THREE.AnimationAction | null;
  },
  direction: 1 | -1,
): void {
  const t = actions.transition;
  if (!t) return;
  t.reset();
  t.timeScale = direction;
  t.time = direction === 1 ? 0 : t.getClip().duration;
  t.setEffectiveWeight(0.9);
  t.paused = false;
  t.play();
}

function prepMaterial(src: THREE.Material): THREE.Material {
  const m = src.clone();
  m.transparent = true;
  m.depthWrite = true; // still write depth so foliage doesn't overdraw badly
  m.opacity = 0;
  return m;
}

/** Cheap deterministic sin-noise: returns roughly -1..1. */
function hashSin(t: number, seed: number): number {
  return (
    Math.sin(t * 1.73 + seed * 12.9898) * 0.6 +
    Math.sin(t * 2.59 + seed * 78.233) * 0.3 +
    Math.sin(t * 0.91 + seed * 37.719) * 0.1
  );
}
