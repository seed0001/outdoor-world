import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { getWeather } from "../../systems/weather/weatherSystem";
import { playerRef } from "../../systems/player/playerRef";

const PARTICLE_COUNT = 4500;
const RADIUS = 25;
const HEIGHT = 30;

export default function Snow() {
  const pointsRef = useRef<THREE.Points>(null);

  const { geometry, material, uniforms } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const speed = new Float32Array(PARTICLE_COUNT);
    const seed = new Float32Array(PARTICLE_COUNT);
    const sizeAttr = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * RADIUS;
      pos[i * 3 + 0] = Math.cos(a) * r;
      pos[i * 3 + 1] = (Math.random() - 0.5) * HEIGHT;
      pos[i * 3 + 2] = Math.sin(a) * r;
      speed[i] = 1 + Math.random() * 1.6;
      seed[i] = Math.random() * 1000;
      sizeAttr[i] = 0.06 + Math.random() * 0.07;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geom.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
    geom.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    geom.setAttribute("aSize", new THREE.BufferAttribute(sizeAttr, 1));
    geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);

    const uniforms = {
      uTime: { value: 0 },
      uBoxH: { value: HEIGHT },
      uWindX: { value: 0 },
      uWindZ: { value: 0 },
      uIntensity: { value: 0 },
      uPixelRatio: { value: Math.min(2, window.devicePixelRatio || 1) },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      vertexShader: `
        attribute float aSpeed;
        attribute float aSeed;
        attribute float aSize;
        uniform float uTime;
        uniform float uBoxH;
        uniform float uWindX;
        uniform float uWindZ;
        uniform float uPixelRatio;
        void main() {
          vec3 p = position;
          float fall = mod(p.y - uTime * aSpeed + aSeed, uBoxH);
          p.y = fall - uBoxH * 0.5;
          float t = uTime + aSeed;
          p.x += sin(t * 0.8 + aSeed) * 0.9 + uWindX * (uBoxH - p.y) * 0.1;
          p.z += cos(t * 0.6 + aSeed * 1.3) * 0.9 + uWindZ * (uBoxH - p.y) * 0.1;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * 800.0 * uPixelRatio / -mv.z;
        }
      `,
      fragmentShader: `
        uniform float uIntensity;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          float mask = smoothstep(0.5, 0.15, d);
          if (mask < 0.02) discard;
          gl_FragColor = vec4(vec3(1.0), mask * uIntensity * 0.9);
        }
      `,
    });
    return { geometry: geom, material: mat, uniforms };
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((_, dt) => {
    const weather = getWeather();
    const rate = weather.snowRate * weather.intensity;
    uniforms.uTime.value += dt;
    uniforms.uIntensity.value +=
      (rate - uniforms.uIntensity.value) * Math.min(1, dt * 2);
    uniforms.uWindX.value = weather.windStrength * 0.4;
    uniforms.uWindZ.value = weather.windStrength * 0.2;

    const points = pointsRef.current;
    if (points) {
      points.position.copy(playerRef.position);
      points.position.y = playerRef.position.y + HEIGHT * 0.3;
      points.visible = uniforms.uIntensity.value > 0.01;
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />
  );
}
