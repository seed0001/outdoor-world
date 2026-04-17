import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { getWeather } from "../../systems/weather/weatherSystem";
import { playerRef } from "../../systems/player/playerRef";

const PARTICLE_COUNT = 5000;
const RADIUS = 22;
const HEIGHT = 28;

export default function Rain() {
  const pointsRef = useRef<THREE.Points>(null);

  const { geometry, material, uniforms } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const speed = new Float32Array(PARTICLE_COUNT);
    const seed = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * RADIUS;
      pos[i * 3 + 0] = Math.cos(a) * r;
      pos[i * 3 + 1] = (Math.random() - 0.5) * HEIGHT;
      pos[i * 3 + 2] = Math.sin(a) * r;
      speed[i] = 18 + Math.random() * 10;
      seed[i] = Math.random() * 1000;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geom.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
    geom.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);

    const uniforms = {
      uTime: { value: 0 },
      uBoxH: { value: HEIGHT },
      uWindX: { value: 0 },
      uWindZ: { value: 0 },
      uIntensity: { value: 0 },
      uSize: { value: 6 },
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
        uniform float uTime;
        uniform float uBoxH;
        uniform float uWindX;
        uniform float uWindZ;
        uniform float uSize;
        uniform float uPixelRatio;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          float fall = mod(p.y - uTime * aSpeed + aSeed, uBoxH);
          p.y = fall - uBoxH * 0.5;
          p.x += uWindX * (uBoxH * 0.5 - p.y) * 0.25;
          p.z += uWindZ * (uBoxH * 0.5 - p.y) * 0.25;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * uPixelRatio * (12.0 / -mv.z);
          vAlpha = 1.0;
        }
      `,
      fragmentShader: `
        uniform float uIntensity;
        varying float vAlpha;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float dx = smoothstep(0.08, 0.0, abs(uv.x));
          float dy = smoothstep(0.5, 0.1, abs(uv.y));
          float mask = dx * dy;
          if (mask < 0.02) discard;
          gl_FragColor = vec4(vec3(0.70, 0.82, 1.0), mask * uIntensity * 0.5);
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
    const rate = weather.rainRate * weather.intensity;
    uniforms.uTime.value += dt;
    uniforms.uIntensity.value +=
      (rate - uniforms.uIntensity.value) * Math.min(1, dt * 2);
    uniforms.uWindX.value = weather.windStrength * 0.3;
    uniforms.uWindZ.value = 0;

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
