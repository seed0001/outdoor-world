import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Cloud, Clouds as DreiClouds } from "@react-three/drei";
import { getWeather } from "../systems/weather/weatherSystem";
import { mulberry32 } from "./terrain";

const CLOUD_COUNT = 14;
const CLOUD_Y_BASE = 55;

type CloudInfo = {
  x: number;
  y: number;
  z: number;
  bounds: [number, number, number];
  volume: number;
  seed: number;
  driftSpeed: number;
};

function generateClouds(): CloudInfo[] {
  const rand = mulberry32(2024);
  const out: CloudInfo[] = [];
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const angle = (i / CLOUD_COUNT) * Math.PI * 2 + rand() * 0.3;
    const radius = 80 + rand() * 40;
    out.push({
      x: Math.cos(angle) * radius,
      y: CLOUD_Y_BASE + rand() * 18,
      z: Math.sin(angle) * radius,
      bounds: [20 + rand() * 10, 4 + rand() * 2, 10 + rand() * 6],
      volume: 14 + rand() * 10,
      seed: Math.floor(rand() * 1e6),
      driftSpeed: 0.8 + rand() * 0.6,
    });
  }
  return out;
}

export default function Clouds() {
  const clouds = useMemo(generateClouds, []);
  const groupRef = useRef<THREE.Group>(null);

  const color = useMemo(() => new THREE.Color(), []);
  const white = useMemo(() => new THREE.Color("#f4f5f7"), []);
  const storm = useMemo(() => new THREE.Color("#3c424d"), []);
  const foundMaterials = useRef<THREE.MeshBasicMaterial[]>([]);

  useFrame((state) => {
    const weather = getWeather();
    const coverage = weather.cloudCoverage;
    const darkness = weather.cloudDarkness;

    const group = groupRef.current;
    if (!group) return;

    group.visible = coverage > 0.02;

    const windDrift = weather.windStrength * 0.3;
    group.position.x =
      Math.sin(state.clock.elapsedTime * 0.01 * windDrift) * 30;
    group.position.z =
      Math.cos(state.clock.elapsedTime * 0.015 * windDrift) * 30;

    group.children.forEach((child, idx) => {
      const threshold = idx / Math.max(1, group.children.length);
      child.visible = coverage > threshold * 0.8;
    });

    // Lazy-find materials once they exist (drei creates instanced mats after mount).
    if (foundMaterials.current.length === 0) {
      group.traverse((obj) => {
        const mat = (obj as THREE.Mesh).material as
          | THREE.Material
          | THREE.Material[]
          | undefined;
        const push = (m: THREE.Material) => {
          if (
            (m as THREE.MeshBasicMaterial).isMeshBasicMaterial &&
            !foundMaterials.current.includes(m as THREE.MeshBasicMaterial)
          ) {
            foundMaterials.current.push(m as THREE.MeshBasicMaterial);
          }
        };
        if (Array.isArray(mat)) mat.forEach(push);
        else if (mat) push(mat);
      });
    }

    color.copy(white).lerp(storm, darkness);
    for (const m of foundMaterials.current) {
      m.color.copy(color);
      m.opacity = 0.55 + coverage * 0.35;
      m.transparent = true;
      m.depthWrite = false;
      m.fog = true;
    }
  });

  return (
    <group ref={groupRef}>
      <DreiClouds material={THREE.MeshBasicMaterial} limit={400} range={120}>
        {clouds.map((c, i) => (
          <Cloud
            key={i}
            segments={24}
            bounds={c.bounds}
            volume={c.volume}
            position={[c.x, c.y, c.z]}
            speed={c.driftSpeed * 0.25}
            growth={4}
            opacity={0.8}
            seed={c.seed}
          />
        ))}
      </DreiClouds>
    </group>
  );
}
