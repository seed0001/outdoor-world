import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RigidBody } from "@react-three/rapier";
import {
  WORLD_SIZE_X,
  WORLD_SIZE_Z,
  WORLD_SEGMENTS,
  WORLD_SEGMENTS_Z,
  WORLD_CENTER_Z,
  heightAt,
  desertBiomeBlend,
} from "./terrain";
import { createGroundMaterial } from "./shaders/groundMaterial";
import { getGroundState } from "../systems/world/groundState";
import { getWaterImmersion } from "../systems/player/waterImmersion";

export default function Ground() {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(
      WORLD_SIZE_X,
      WORLD_SIZE_Z,
      WORLD_SEGMENTS,
      WORLD_SEGMENTS_Z,
    );
    g.rotateX(-Math.PI / 2);

    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const lz = pos.getZ(i);
      const worldZ = lz + WORLD_CENTER_Z;
      pos.setY(i, heightAt(lx, worldZ));
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    g.computeBoundingBox();
    g.computeBoundingSphere();

    const colors = new Float32Array(pos.count * 3);
    const lo = new THREE.Color("#3a6a28");
    const hi = new THREE.Color("#78a052");
    const sandLo = new THREE.Color("#b89860");
    const sandHi = new THREE.Color("#e6d2a8");
    for (let i = 0; i < pos.count; i++) {
      const lz = pos.getZ(i);
      const y = pos.getY(i);
      const worldZ = lz + WORLD_CENTER_Z;
      const blend = desertBiomeBlend(worldZ);
      const tGrass = THREE.MathUtils.clamp((y + 2.5) / 5.5, 0, 1);
      const cGrass = lo.clone().lerp(hi, tGrass);
      const tSand = THREE.MathUtils.clamp((y + 0.8) / 4.2, 0, 1);
      const cSand = sandLo.clone().lerp(sandHi, tSand);
      const c = cGrass.clone().lerp(cSand, blend);
      colors[i * 3 + 0] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    return g;
  }, []);

  const { material, uniforms } = useMemo(() => createGroundMaterial(), []);

  useEffect(() => {
    return () => {
      material.dispose();
      geometry.dispose();
    };
  }, [material, geometry]);

  useFrame((_, dt) => {
    const ground = getGroundState();
    uniforms.uSnowLevel.value +=
      (ground.snowLevel - uniforms.uSnowLevel.value) * Math.min(1, dt * 2);
    uniforms.uWetness.value +=
      (ground.wetness - uniforms.uWetness.value) * Math.min(1, dt * 2);
    uniforms.uTime.value += dt;

    // Gentle ease in/out of the underwater tint so entering/exiting the lake
    // doesn't pop. Target strength scales with submersion depth.
    const immersion = getWaterImmersion();
    const targetUW = immersion.submerged
      ? Math.min(1, 0.55 + immersion.depth * 0.2)
      : 0;
    uniforms.uUnderwater.value +=
      (targetUW - uniforms.uUnderwater.value) * Math.min(1, dt * 4);
  });

  return (
    <RigidBody type="fixed" colliders="trimesh" friction={1.0} restitution={0}>
      <mesh
        position={[0, 0, WORLD_CENTER_Z]}
        geometry={geometry}
        material={material}
        receiveShadow
      />
    </RigidBody>
  );
}
