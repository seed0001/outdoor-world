import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RigidBody } from "@react-three/rapier";
import { WORLD_SIZE, WORLD_SEGMENTS, heightAt } from "./terrain";
import { createGroundMaterial } from "./shaders/groundMaterial";
import { getGroundState } from "../systems/world/groundState";

export default function Ground() {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(
      WORLD_SIZE,
      WORLD_SIZE,
      WORLD_SEGMENTS,
      WORLD_SEGMENTS,
    );
    g.rotateX(-Math.PI / 2);

    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, heightAt(x, z));
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    g.computeBoundingBox();
    g.computeBoundingSphere();

    const colors = new Float32Array(pos.count * 3);
    const lo = new THREE.Color("#3a6a28");
    const hi = new THREE.Color("#78a052");
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = THREE.MathUtils.clamp((y + 2.5) / 5.5, 0, 1);
      const c = lo.clone().lerp(hi, t);
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
    // Smooth uniform updates (avoid frame-to-frame jumps)
    uniforms.uSnowLevel.value +=
      (ground.snowLevel - uniforms.uSnowLevel.value) * Math.min(1, dt * 2);
    uniforms.uWetness.value +=
      (ground.wetness - uniforms.uWetness.value) * Math.min(1, dt * 2);
    uniforms.uTime.value += dt;
  });

  return (
    <RigidBody type="fixed" colliders="trimesh" friction={1.0} restitution={0}>
      <mesh geometry={geometry} material={material} receiveShadow />
    </RigidBody>
  );
}
