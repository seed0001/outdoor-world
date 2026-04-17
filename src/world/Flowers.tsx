import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useLoader } from "@react-three/fiber";
import { FBXLoader, mergeBufferGeometries } from "three-stdlib";
import { flowers } from "../systems/world/flowerRegistry";
import { snapshot } from "../systems/world/worldClock";
import { getWeather } from "../systems/weather/weatherSystem";
import { foliageLevel } from "../systems/world/calendar";

const FBX_URL = "/models/flower/Flower.fbx";
const DIFFUSE_URL = "/models/flower/Textur Diffuse.png";
const OPACITY_URL = "/models/flower/Textur Opacity.png";

/**
 * An instanced field of cross-plane flowers.
 *
 * The source FBX references `.tif` textures that don't ship with the pack
 * (they were renamed to `.png`). We ignore the FBX's texture bindings entirely,
 * merge all its mesh geometries into a single centered, base-at-Y=0 buffer
 * geometry, and attach a hand-built `MeshStandardMaterial` with:
 *   - `map` = diffuse PNG (sRGB)
 *   - `alphaMap` = opacity PNG (handles the flower silhouette cut-out)
 *   - `alphaTest` + `transparent` + `DoubleSide` — the correct stack for
 *     alpha-tested billboard foliage (clean cut edges, no translucent sort)
 *
 * An `onBeforeCompile` patch adds a gentle wind sway whose magnitude scales
 * with local vertex height (so the base stays rooted while the blossom wags).
 * Per-instance phases come from an `aPhase` instanced attribute built from
 * the flower registry.
 *
 * The whole field scales with `foliageLevel(yearFrac)` — buds in spring,
 * peaks in summer, wilts in autumn, gone in winter.
 */
export default function Flowers() {
  const fbx = useLoader(FBXLoader, FBX_URL);
  const diffuse = useLoader(THREE.TextureLoader, DIFFUSE_URL);
  const opacity = useLoader(THREE.TextureLoader, OPACITY_URL);

  // Build a single merged geometry + material up front. Heavy-ish work, done once.
  const { geometry, material, uniforms } = useMemo(() => {
    diffuse.colorSpace = THREE.SRGBColorSpace;
    diffuse.anisotropy = 8;
    opacity.colorSpace = THREE.NoColorSpace;

    // Collect & bake world transforms from every mesh in the FBX — the flower
    // authoring likely stacks a head + stem across nodes and we want one
    // geometry that reproduces their combined arrangement.
    const parts: THREE.BufferGeometry[] = [];
    fbx.updateWorldMatrix(true, true);
    fbx.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      const g = mesh.geometry.clone();
      g.applyMatrix4(mesh.matrixWorld);
      // Strip attributes that'd block a merge when they're inconsistent
      // across parts; we only need position/normal/uv for this shader.
      const keep = new THREE.BufferGeometry();
      const pos = g.getAttribute("position");
      if (pos) keep.setAttribute("position", pos);
      const norm = g.getAttribute("normal");
      if (norm) keep.setAttribute("normal", norm);
      const uv = g.getAttribute("uv");
      if (uv) keep.setAttribute("uv", uv);
      if (g.index) keep.setIndex(g.index);
      parts.push(keep);
    });

    if (parts.length === 0) {
      // Failure-safe fallback: a tiny quad so the scene doesn't explode.
      const fallback = new THREE.PlaneGeometry(0.4, 0.6);
      fallback.translate(0, 0.3, 0);
      return {
        geometry: fallback,
        material: new THREE.MeshStandardMaterial({ color: "#ff00ff" }),
        uniforms: { uTime: { value: 0 }, uWind: { value: new THREE.Vector2() } },
      };
    }

    let merged = parts[0];
    if (parts.length > 1) {
      const m = mergeBufferGeometries(parts, false);
      if (m) merged = m;
    }
    if (!merged.getAttribute("normal")) merged.computeVertexNormals();

    // Normalise the geometry: sit base at Y=0, centre XZ, scale so the tallest
    // flower is ~0.6m before per-instance scale. The FBX arrives tiny or huge
    // depending on source units, so normalising locks that down.
    merged.computeBoundingBox();
    const box = merged.boundingBox!;
    const size = new THREE.Vector3();
    box.getSize(size);
    const height = size.y || 1;
    const targetHeight = 0.6;
    const s = targetHeight / height;
    const cx = (box.min.x + box.max.x) / 2;
    const cz = (box.min.z + box.max.z) / 2;
    merged.translate(-cx, -box.min.y, -cz);
    merged.scale(s, s, s);

    // Prepare per-instance phase attribute.
    const phases = new Float32Array(flowers.length);
    for (let i = 0; i < flowers.length; i++) phases[i] = flowers[i].phase;
    merged.setAttribute(
      "aPhase",
      new THREE.InstancedBufferAttribute(phases, 1, false),
    );

    // Shader uniforms (shared via onBeforeCompile patch).
    const shared = {
      uTime: { value: 0 },
      uWind: { value: new THREE.Vector2(0.15, 0.0) },
    };

    const mat = new THREE.MeshStandardMaterial({
      map: diffuse,
      alphaMap: opacity,
      transparent: true,
      alphaTest: 0.5,
      depthWrite: true,
      side: THREE.DoubleSide,
      roughness: 0.85,
      metalness: 0.0,
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = shared.uTime;
      shader.uniforms.uWind = shared.uWind;

      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `
#include <common>
attribute float aPhase;
uniform float uTime;
uniform vec2 uWind;
`,
        )
        .replace(
          "#include <begin_vertex>",
          `
vec3 transformed = vec3( position );
// Sway grows with local height so roots stay put.
float bend = clamp(position.y / 0.6, 0.0, 1.0);
bend = bend * bend;
float phase = aPhase * 6.2831853;
float wave = sin(uTime * 2.4 + phase) * 0.35 + sin(uTime * 1.1 + phase * 2.3) * 0.15;
vec2 dir = uWind;
float windMag = length(dir);
// Keep even calm days subtly alive.
dir += vec2(0.08, 0.05) * sin(uTime * 0.7 + phase);
transformed.x += dir.x * bend * (0.05 + windMag * 0.25) * wave;
transformed.z += dir.y * bend * (0.05 + windMag * 0.25) * wave;
transformed.y -= bend * windMag * 0.02 * (1.0 + wave * 0.5);
`,
        );
    };

    return { geometry: merged, material: mat, uniforms: shared };
  }, [fbx, diffuse, opacity]);

  // Build the instance matrices once.
  const instRef = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = instRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < flowers.length; i++) {
      const f = flowers[i];
      dummy.position.set(f.x, f.y, f.z);
      dummy.rotation.set(0, f.rot, 0);
      dummy.scale.setScalar(f.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = flowers.length;
    mesh.computeBoundingSphere();
  }, [geometry]);

  // Per-frame: wind direction rotates with time; magnitude from weather.
  // Root group scales with the seasonal bloom level so winter hides them.
  const rootRef = useRef<THREE.Group>(null);
  const bloomRef = useRef(0);

  useFrame((_, dt) => {
    uniforms.uTime.value += dt;

    const weather = getWeather();
    const wind = weather.windStrength;
    // Rotate the prevailing wind direction slowly so gusts feel organic.
    const t = uniforms.uTime.value;
    const angle = t * 0.12;
    uniforms.uWind.value.set(
      Math.cos(angle) * wind,
      Math.sin(angle) * wind,
    );

    const world = snapshot();
    const target = foliageLevel(world.yearFrac);
    // Smooth the bloom so it doesn't pop when the day ticks over between
    // foliageLevel plateaus.
    bloomRef.current += (target - bloomRef.current) * Math.min(1, dt * 0.6);
    const s = bloomRef.current;
    if (rootRef.current) {
      rootRef.current.visible = s > 0.01;
      rootRef.current.scale.setScalar(s);
    }
  });

  return (
    <group ref={rootRef}>
      <instancedMesh
        ref={instRef}
        args={[geometry, material, flowers.length]}
        castShadow={false}
        receiveShadow={false}
      />
    </group>
  );
}
