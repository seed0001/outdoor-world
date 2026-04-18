import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { campfires } from "../systems/world/campfires";
import { campfireCooking } from "../systems/world/campfireCooking";

function CampfireCookingTick() {
  useFrame(() => {
    campfireCooking.tick(performance.now());
  });
  return null;
}

function CampfireVisual({ x, y, z }: { x: number; y: number; z: number }) {
  const lightRef = useRef<THREE.PointLight>(null);
  const emberRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (lightRef.current) {
      lightRef.current.intensity = 1.35 + Math.sin(t * 7.2) * 0.35;
    }
    if (emberRef.current) {
      emberRef.current.scale.setScalar(1 + Math.sin(t * 11) * 0.06);
    }
  });

  const stoneRing = useMemo(
    () =>
      [0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2;
        const rx = Math.cos(a) * 0.38;
        const rz = Math.sin(a) * 0.38;
        return (
          <mesh
            key={i}
            castShadow
            receiveShadow
            position={[rx, 0.06, rz]}
          >
            <dodecahedronGeometry args={[0.09, 0]} />
            <meshStandardMaterial color="#5a5a62" roughness={0.92} />
          </mesh>
        );
      }),
    [],
  );

  return (
    <group position={[x, y, z]}>
      <mesh castShadow receiveShadow position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.22, 0.3, 0.14, 10]} />
        <meshStandardMaterial color="#4a3020" roughness={0.95} />
      </mesh>
      {stoneRing}
      <mesh ref={emberRef} position={[0, 0.38, 0]}>
        <coneGeometry args={[0.14, 0.52, 7]} />
        <meshBasicMaterial
          color="#ff7722"
          transparent
          opacity={0.88}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.18, 0.04, 8, 16]} />
        <meshStandardMaterial
          color="#ffaa44"
          emissive="#ff4400"
          emissiveIntensity={0.6}
          roughness={0.4}
        />
      </mesh>
      <pointLight
        ref={lightRef}
        color="#ff8a4a"
        intensity={1.4}
        distance={10}
        decay={2}
        position={[0, 0.55, 0]}
      />
    </group>
  );
}

export default function Campfires() {
  const [fires, setFires] = useState(() => campfires.list());
  useEffect(() => campfires.subscribe(() => setFires(campfires.list())), []);

  return (
    <group>
      <CampfireCookingTick />
      {fires.map((f) => (
        <CampfireVisual key={f.id} x={f.x} y={f.y} z={f.z} />
      ))}
    </group>
  );
}
