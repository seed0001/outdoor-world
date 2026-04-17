import { useMemo } from "react";
import { BallCollider, RigidBody } from "@react-three/rapier";
import {
  SNAKE_DEN_CLEAR_R,
  SNAKE_DEN_X,
  SNAKE_DEN_Z,
  snakeDenBaseY,
} from "../systems/world/snakeDen";
import { heightAt, mulberry32 } from "./terrain";

const PEBBLE_COUNT = 24;
const PEBBLE_SEED = 88001;

interface Pebble {
  lx: number;
  ly: number;
  lz: number;
  radius: number;
  rx: number;
  ry: number;
  rz: number;
  shade: number;
}

/**
 * A tumble of field stones marking the rattlesnake burrow. Physically
 * approximated as clustered ball colliders so the player bumps over the
 * pile instead of walking through it.
 */
export default function SnakeDen() {
  const baseY = snakeDenBaseY();

  const pebbles = useMemo(() => {
    const rand = mulberry32(PEBBLE_SEED);
    const list: Pebble[] = [];
    for (let i = 0; i < PEBBLE_COUNT; i++) {
      const u = rand();
      const v = rand();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(1 - 2 * v * 0.6);
      const shell = 0.45 + rand() * (SNAKE_DEN_CLEAR_R - 0.8);
      const lx = shell * Math.sin(phi) * Math.cos(theta);
      const lz = shell * Math.sin(phi) * Math.sin(theta);
      const ly = shell * Math.cos(phi) * 0.55 + rand() * 0.35;
      const radius = 0.22 + rand() * 0.42;
      list.push({
        lx,
        ly,
        lz,
        radius,
        rx: rand() * Math.PI * 2,
        ry: rand() * Math.PI * 2,
        rz: rand() * Math.PI * 2,
        shade: 0.62 + rand() * 0.32,
      });
    }
    // Shell offsets keep every ly >= 0, so the whole mound floated. Shift so
    // the lowest rock's bottom sits on the heightfield; others stack above.
    const minLy = Math.min(...list.map((p) => p.ly));
    for (const p of list) p.ly -= minLy;
    return list;
  }, []);

  return (
    <group position={[SNAKE_DEN_X, baseY, SNAKE_DEN_Z]}>
      <RigidBody type="fixed" colliders={false} name="snake_den">
        {pebbles.map((p, i) => {
          const wx = SNAKE_DEN_X + p.lx;
          const wz = SNAKE_DEN_Z + p.lz;
          const gy = heightAt(wx, wz);
          // Sphere center so bottom (y − radius) meets terrain at (wx, wz).
          const lift = gy - baseY + p.radius;
          return (
            <BallCollider
              key={i}
              position={[p.lx, p.ly + lift, p.lz]}
              args={[p.radius * 0.82]}
            />
          );
        })}
        {pebbles.map((p, i) => {
          const wx = SNAKE_DEN_X + p.lx;
          const wz = SNAKE_DEN_Z + p.lz;
          const gy = heightAt(wx, wz);
          const lift = gy - baseY + p.radius;
          const col = `rgb(${Math.round(125 * p.shade)}, ${Math.round(
            118 * p.shade,
          )}, ${Math.round(108 * p.shade)})`;
          return (
            <mesh
              key={`m-${i}`}
              position={[p.lx, p.ly + lift, p.lz]}
              rotation={[p.rx, p.ry, p.rz]}
              castShadow
              receiveShadow
            >
              <icosahedronGeometry args={[p.radius, 0]} />
              <meshStandardMaterial color={col} roughness={0.95} flatShading />
            </mesh>
          );
        })}
      </RigidBody>
    </group>
  );
}
