import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { getWeather } from "../../systems/weather/weatherSystem";
import { playerRef } from "../../systems/player/playerRef";
import { health } from "../../systems/player/health";

const PARTICLE_COUNT = 800;
const RADIUS = 22;
const HEIGHT = 28;
const PLAYER_HIT_PER_SEC = 2; // damage per second under heavy hail

export default function Hail() {
  const pointsRef = useRef<THREE.Points>(null);
  const accumRef = useRef(0);

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
      speed[i] = 22 + Math.random() * 8;
      seed[i] = Math.random() * 1000;
      sizeAttr[i] = 0.04 + Math.random() * 0.05;
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
        uniform float uPixelRatio;
        void main() {
          vec3 p = position;
          float fall = mod(p.y - uTime * aSpeed + aSeed, uBoxH);
          p.y = fall - uBoxH * 0.5;
          p.x += uWindX * (uBoxH * 0.5 - p.y) * 0.08;
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
          vec3 col = mix(vec3(0.82, 0.88, 0.95), vec3(1.0), 1.0 - d*2.0);
          gl_FragColor = vec4(col, mask * uIntensity);
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
    const rate = weather.hailRate * weather.intensity;
    uniforms.uTime.value += dt;
    uniforms.uIntensity.value +=
      (rate - uniforms.uIntensity.value) * Math.min(1, dt * 2);
    uniforms.uWindX.value = weather.windStrength * 0.3;

    const points = pointsRef.current;
    if (points) {
      points.position.copy(playerRef.position);
      points.position.y = playerRef.position.y + HEIGHT * 0.3;
      points.visible = uniforms.uIntensity.value > 0.01;
    }

    if (rate > 0.2) {
      accumRef.current += rate * dt;
      while (accumRef.current > 1 / PLAYER_HIT_PER_SEC) {
        accumRef.current -= 1 / PLAYER_HIT_PER_SEC;
        health.damage(1, "hail");
      }
    } else {
      accumRef.current = 0;
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />
  );
}
