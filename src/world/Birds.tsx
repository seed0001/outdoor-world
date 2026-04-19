import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { getBirdFlocks, type BirdFlockState } from "../systems/world/birdState";
import {
  birdLocalOffset,
  birdSlotHash01,
  type FlockMotionParams,
} from "../systems/world/flocking";
import { snapshot } from "../systems/world/worldClock";
import { getWeather } from "../systems/weather/weatherSystem";
import { birdZones, type BirdZoneType } from "../systems/world/birdZoneRegistry";

const debug = new URLSearchParams(window.location.search).has("debug");

/** Shared low-poly silhouette: narrow cone reads as a small body + head. */
const BIRD_GEOM = new THREE.ConeGeometry(0.045, 0.12, 4);
const BIRD_MAT = new THREE.MeshStandardMaterial({
  color: "#3a3530",
  roughness: 0.85,
  metalness: 0.05,
});

function zoneColor(type: BirdZoneType): string {
  switch (type) {
    case "ROOST":
      return "#2d6a4f";
    case "DRINK":
      return "#1d7ed8";
    case "WANDER":
      return "#dda15e";
    case "ENTRY":
      return "#9b59b6";
    case "EXIT":
      return "#e76f51";
    case "SHELTER":
      return "#6c757d";
    default:
      return "#ffffff";
  }
}

function BirdZoneMarkers() {
  return (
    <group name="bird-debug-zones">
      {birdZones.map((z) => (
        <mesh key={z.id} position={z.position}>
          <sphereGeometry args={[0.35, 8, 8]} />
          <meshBasicMaterial
            color={zoneColor(z.type)}
            wireframe
            transparent
            opacity={0.5}
          />
        </mesh>
      ))}
    </group>
  );
}

function agitationForState(s: BirdFlockState): number {
  switch (s) {
    case "ROOSTING":
    case "SHELTERING":
      return 0.12;
    case "DRINKING":
      return 0.32;
    case "WANDERING":
      return 0.55;
    case "FLYING_TO_WATER":
    case "RETURNING":
      return 0.68;
    case "OFF_MAP":
      return 0.2;
    default:
      return 0.72;
  }
}

function FlockBirds({ flockId }: { flockId: string }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const maxInstances = 48;

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const f = getBirdFlocks().find((x) => x.id === flockId);
    if (!f || !f.active || f.birdCount <= 0 || !f.onMap) {
      mesh.count = 0;
      mesh.visible = false;
      return;
    }

    mesh.visible = true;
    const n = Math.min(f.birdCount, maxInstances);
    mesh.count = n;

    const simMs = snapshot().simMs;
    const w = getWeather();
    const windJitter = w.windStrength * 0.04;

    const agitation = agitationForState(f.state) * (0.75 + 0.25 * w.intensity);
    const roosting = f.state === "ROOSTING" || f.state === "SHELTERING";

    const params: FlockMotionParams = {
      simMs,
      flockVel: f.velocity,
      target: f.target,
      center: f.center,
      agitation: Math.min(1.2, agitation + windJitter),
      roosting,
    };

    const cx = f.center[0];
    const cy = f.center[1];
    const cz = f.center[2];

    const vx = f.velocity[0];
    const vz = f.velocity[2];
    const horiz = Math.hypot(vx, vz);
    const heading =
      horiz > 0.04 ? Math.atan2(-vz, vx) : Math.sin(simMs * 0.0004 + flockId.length);

    for (let i = 0; i < n; i++) {
      const [ox, oy, oz] = birdLocalOffset(flockId, i, f.birdCount, params);
      const flap =
        Math.sin(
          simMs * (0.018 + i * 0.0007) +
            i * 1.7 +
            birdSlotHash01(flockId, i + 44) * 6.28318,
        ) *
        (0.35 + agitation * 0.55);

      dummy.position.set(cx + ox, cy + oy, cz + oz);
      dummy.rotation.set(flap, heading, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[BIRD_GEOM, BIRD_MAT, maxInstances]}
      frustumCulled={false}
      castShadow
      receiveShadow
    />
  );
}

/**
 * Small songbird flock driven by {@link birdState} (world clock + weather).
 * One instanced cone per bird; cheap local offsets from {@link flocking}.
 */
export default function Birds() {
  const ids = useMemo(() => getBirdFlocks().map((f) => f.id), []);

  return (
    <group name="birds-ecosystem">
      {ids.map((id) => (
        <FlockBirds key={id} flockId={id} />
      ))}
      {debug && <BirdZoneMarkers />}
    </group>
  );
}
