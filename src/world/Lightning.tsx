import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { getWeather } from "../systems/weather/weatherSystem";
import { health } from "../systems/player/health";
import { playerRef, addCameraShake } from "../systems/player/playerRef";
import { onCommand } from "../systems/world/commands";
import { heightAt } from "./terrain";

const STRIKE_LIFETIME_MS = 220;
const FLASH_LIFETIME_MS = 260;
const BOLT_HEIGHT = 55;

interface Strike {
  id: number;
  origin: THREE.Vector3;
  endAt: number;
  flashEndAt: number;
  points: Float32Array;
  distanceToPlayer: number;
}

let nextStrikeId = 1;

function buildBoltPoints(target: THREE.Vector3): Float32Array {
  const pts: THREE.Vector3[] = [];
  const start = new THREE.Vector3(target.x, target.y + BOLT_HEIGHT, target.z);
  pts.push(start.clone());
  const SEGMENTS = 18;
  for (let i = 1; i < SEGMENTS; i++) {
    const t = i / SEGMENTS;
    const y = start.y + (target.y - start.y) * t;
    const jitter = (1 - Math.abs(t - 0.5) * 2) * 3.5;
    const x = start.x + (target.x - start.x) * t + (Math.random() - 0.5) * jitter;
    const z = start.z + (target.z - start.z) * t + (Math.random() - 0.5) * jitter;
    pts.push(new THREE.Vector3(x, y, z));
  }
  pts.push(target.clone());
  // Add small branches
  const branches: THREE.Vector3[][] = [];
  const branchCount = 2 + Math.floor(Math.random() * 3);
  for (let b = 0; b < branchCount; b++) {
    const from = pts[2 + Math.floor(Math.random() * (pts.length - 4))];
    const dir = new THREE.Vector3(
      Math.random() - 0.5,
      -0.6 - Math.random() * 0.4,
      Math.random() - 0.5,
    ).normalize();
    const length = 3 + Math.random() * 5;
    const branch: THREE.Vector3[] = [from.clone()];
    const steps = 5;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const bp = from.clone().addScaledVector(dir, length * t);
      bp.x += (Math.random() - 0.5) * 1.5;
      bp.z += (Math.random() - 0.5) * 1.5;
      branch.push(bp);
    }
    branches.push(branch);
  }
  // Flatten into line segments
  const segments: number[] = [];
  const push = (ps: THREE.Vector3[]) => {
    for (let i = 0; i < ps.length - 1; i++) {
      segments.push(ps[i].x, ps[i].y, ps[i].z, ps[i + 1].x, ps[i + 1].y, ps[i + 1].z);
    }
  };
  push(pts);
  branches.forEach(push);
  return new Float32Array(segments);
}

let audioCtx: AudioContext | null = null;
function getAudio() {
  if (audioCtx) return audioCtx;
  try {
    audioCtx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext)();
  } catch {
    audioCtx = null;
  }
  return audioCtx;
}

function playThunder(distance: number) {
  const ctx = getAudio();
  if (!ctx) return;
  // Speed of sound ~343 m/s. Delay based on distance.
  const delaySec = Math.min(4, distance / 60);
  const startAt = ctx.currentTime + delaySec;

  // Noise burst, low-pass filtered, plus a rumble
  const bufferSize = ctx.sampleRate * 3;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    const t = i / bufferSize;
    const env = Math.exp(-t * 2.2);
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 180 - Math.min(100, distance * 0.6);
  const gain = ctx.createGain();
  const proximity = Math.max(0.2, 1 - Math.min(1, distance / 120));
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(proximity, startAt + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + 2.8);
  src.connect(lp);
  lp.connect(gain);
  gain.connect(ctx.destination);
  src.start(startAt);
  src.stop(startAt + 3);
}

export default function Lightning() {
  const [strikes, setStrikes] = useState<Strike[]>([]);
  const flashLightRef = useRef<THREE.PointLight>(null);
  const triggerAccumRef = useRef(0);

  const strike = useMemo(
    () => (customTarget?: THREE.Vector3) => {
      let target: THREE.Vector3;
      if (customTarget) {
        target = customTarget.clone();
      } else {
        const angle = Math.random() * Math.PI * 2;
        const radius = 8 + Math.random() * 45;
        const player = playerRef.position;
        const tx = player.x + Math.cos(angle) * radius;
        const tz = player.z + Math.sin(angle) * radius;
        target = new THREE.Vector3(tx, heightAt(tx, tz), tz);
      }
      const now = performance.now();
      const points = buildBoltPoints(target);
      const distance = playerRef.position.distanceTo(target);
      const newStrike: Strike = {
        id: nextStrikeId++,
        origin: target,
        endAt: now + STRIKE_LIFETIME_MS,
        flashEndAt: now + FLASH_LIFETIME_MS,
        points,
        distanceToPlayer: distance,
      };
      setStrikes((s) => [...s, newStrike]);

      playThunder(distance);

      if (distance < 6) {
        health.damage(40, "lightning");
        addCameraShake(1.4);
      } else if (distance < 16) {
        addCameraShake(0.5);
      }
    },
    [],
  );

  useEffect(() => {
    const unsub = onCommand("lightning:now", () => strike());
    return unsub;
  }, [strike]);

  useFrame((_, dt) => {
    const weather = getWeather();
    const ratePerMin = weather.lightningRate * weather.intensity;
    // Probability per real second: ratePerMin / 60. But our "minute" is in
    // game minutes. Using real seconds is fine for visual pacing.
    if (ratePerMin > 0) {
      triggerAccumRef.current += dt * (ratePerMin / 60);
      if (triggerAccumRef.current > Math.random()) {
        triggerAccumRef.current = 0;
        strike();
      }
    }

    const now = performance.now();
    const flash = flashLightRef.current;
    if (flash) {
      let maxFlash = 0;
      for (const s of strikes) {
        const t = (s.flashEndAt - now) / FLASH_LIFETIME_MS;
        if (t > 0) {
          const proximity = Math.max(0.2, 1 - s.distanceToPlayer / 80);
          // Further reduced: even at 9× the point light blew the whole scene
          // white in the middle of a thunderstorm night. 3.5× reads as a
          // flash without wiping out the world around it.
          maxFlash = Math.max(maxFlash, t * 3.5 * proximity);
          flash.position.set(s.origin.x, s.origin.y + 25, s.origin.z);
        }
      }
      flash.intensity = maxFlash;
      flash.visible = maxFlash > 0.01;
    }

    // Cull expired strikes.
    const alive = strikes.filter((s) => s.endAt > now);
    if (alive.length !== strikes.length) setStrikes(alive);
  });

  return (
    <group>
      <pointLight
        ref={flashLightRef}
        intensity={0}
        color={"#b6cff5"}
        distance={140}
        decay={2}
      />
      {strikes.map((s) => (
        <BoltMesh key={s.id} strike={s} />
      ))}
    </group>
  );
}

function BoltMesh({ strike }: { strike: Strike }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(strike.points, 3));
    return g;
  }, [strike.points]);
  useEffect(() => () => geom.dispose(), [geom]);
  const matRef = useRef<THREE.LineBasicMaterial>(null);
  useFrame(() => {
    const now = performance.now();
    const remaining = (strike.endAt - now) / STRIKE_LIFETIME_MS;
    if (matRef.current) {
      matRef.current.opacity = Math.max(0, remaining);
    }
  });
  return (
    <lineSegments geometry={geom}>
      <lineBasicMaterial
        ref={matRef}
        color={"#ffffff"}
        transparent
        opacity={1}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
}
