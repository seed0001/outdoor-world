import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import {
  LAKE_CENTER_X,
  LAKE_CENTER_Z,
  LAKE_INNER_R,
  LAKE_OUTER_R,
  LAKE_WATER_Y,
} from "./terrain";
import { snapshot } from "../systems/world/worldClock";
import { getWeather } from "../systems/weather/weatherSystem";
import { temperatureC } from "../systems/world/calendar";
import { playerRef } from "../systems/player/playerRef";

/**
 * A circular lake surface with a hand-rolled water shader:
 *   - dual-octave gradient noise for scrolling ripples and fake normals
 *   - Lambert + specular from the current sun direction
 *   - depth-based colour blend (deep navy -> teal -> pale shore)
 *   - shore foam and soft alpha feather at the outer rim
 *   - freezes to cracked ice when sustained sub-zero temperatures hit
 *   - rain intensity boosts surface choppiness and kills the specular hit
 *
 * The sun direction is recomputed each frame from the worldClock so sunrise
 * glints and moonlight sheens line up with the Sky.
 */
export default function Lake() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const frozenAmountRef = useRef(0);

  const geometry = useMemo(() => {
    const g = new THREE.CircleGeometry(LAKE_OUTER_R, 96);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uCameraPos: { value: new THREE.Vector3() },
      uLakeCenter: {
        value: new THREE.Vector2(LAKE_CENTER_X, LAKE_CENTER_Z),
      },
      uOuterR: { value: LAKE_OUTER_R },
      uInnerR: { value: LAKE_INNER_R },
      uFreeze: { value: 0 },
      uRain: { value: 0 },
      uCloudDarkness: { value: 0 },
      uDayFactor: { value: 1 },
    }),
    [],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      matRef.current?.dispose();
    },
    [geometry],
  );

  useFrame((state, dt) => {
    const world = snapshot();
    const weather = getWeather();

    uniforms.uTime.value += dt;

    // Sun/moon direction — mirror Sky.tsx so highlights match.
    const dayTheta = (world.dayFrac - 0.25) * Math.PI * 2;
    const sx = Math.cos(dayTheta);
    const sy = Math.sin(dayTheta);
    const sz = Math.sin(dayTheta) * 0.25 + 0.1;
    const len = Math.hypot(sx, sy, sz) || 1;
    uniforms.uSunDir.value.set(sx / len, sy / len, sz / len);
    uniforms.uDayFactor.value = Math.max(0, Math.min(1, sy * 4 + 0.1));

    uniforms.uCameraPos.value.copy(state.camera.position);
    uniforms.uRain.value +=
      (weather.rainRate * weather.intensity - uniforms.uRain.value) *
      Math.min(1, dt * 2);
    uniforms.uCloudDarkness.value +=
      (weather.cloudDarkness * weather.intensity -
        uniforms.uCloudDarkness.value) *
      Math.min(1, dt * 1);

    // Freeze accumulator: hardens when cold for a while, melts quickly above 2C.
    const temp = temperatureC(world, playerRef.position.y, weather.tempMod);
    const freezeTarget =
      temp < -3 ? 1 : temp < 1 ? THREE.MathUtils.mapLinear(temp, -3, 1, 1, 0) : 0;
    frozenAmountRef.current +=
      (freezeTarget - frozenAmountRef.current) * Math.min(1, dt * 0.25);
    uniforms.uFreeze.value = frozenAmountRef.current;
  });

  return (
    <mesh
      geometry={geometry}
      position={[LAKE_CENTER_X, LAKE_WATER_Y, LAKE_CENTER_Z]}
      receiveShadow={false}
      renderOrder={1}
    >
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.FrontSide}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
      />
    </mesh>
  );
}

const VERTEX = /* glsl */ `
  uniform float uTime;
  varying vec2 vWorldXZ;
  varying vec3 vWorldPos;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    // gentle bob on the surface so the water breathes
    float bob =
      sin(worldPos.x * 0.22 + uTime * 0.9) * 0.05 +
      cos(worldPos.z * 0.19 + uTime * 1.2) * 0.04;
    worldPos.y += bob;
    vWorldPos = worldPos.xyz;
    vWorldXZ = worldPos.xz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uCameraPos;
  uniform vec2 uLakeCenter;
  uniform float uOuterR;
  uniform float uInnerR;
  uniform float uFreeze;
  uniform float uRain;
  uniform float uCloudDarkness;
  uniform float uDayFactor;
  varying vec2 vWorldXZ;
  varying vec3 vWorldPos;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  // Sum of two octaves scrolling opposite directions — makes fake ripples.
  float ripples(vec2 p) {
    vec2 q1 = p * 0.20 + vec2(uTime * 0.040, uTime * 0.022);
    vec2 q2 = p * 0.45 + vec2(-uTime * 0.028,  uTime * 0.031);
    return vnoise(q1) * 0.65 + vnoise(q2) * 0.35;
  }

  vec3 waterNormal(vec2 p, float amp) {
    float eps = 0.9;
    float hL = ripples(p - vec2(eps, 0.0));
    float hR = ripples(p + vec2(eps, 0.0));
    float hD = ripples(p - vec2(0.0, eps));
    float hU = ripples(p + vec2(0.0, eps));
    vec3 n = vec3(hL - hR, 1.0, hD - hU);
    n.xz *= amp;
    return normalize(n);
  }

  void main() {
    float dist = length(vWorldXZ - uLakeCenter);
    float edgeT = smoothstep(uInnerR, uOuterR, dist); // 0 centre, 1 rim

    // Choppier in rain; glassy otherwise.
    float normalAmp = 0.55 + uRain * 1.2;
    vec3 N = waterNormal(vWorldXZ, normalAmp);

    vec3 V = normalize(uCameraPos - vWorldPos);
    vec3 L = normalize(uSunDir);
    vec3 H = normalize(L + V);

    float NdotL = max(0.0, dot(N, L));
    // Sharper highlight when calm; rain disperses it.
    float shininess = mix(120.0, 30.0, clamp(uRain, 0.0, 1.0));
    float spec = pow(max(0.0, dot(N, H)), shininess) * uDayFactor;
    // Fresnel-ish edge brightness
    float fres = pow(1.0 - max(0.0, dot(N, V)), 3.0);

    vec3 deep    = vec3(0.03, 0.10, 0.20);
    vec3 mid     = vec3(0.08, 0.28, 0.38);
    vec3 shallow = vec3(0.30, 0.55, 0.55);
    vec3 col = mix(deep, mid, smoothstep(0.0, 0.55, edgeT));
    col = mix(col, shallow, smoothstep(0.55, 1.0, edgeT));

    // Apply sun lighting: ambient + diffuse.
    float daylight = mix(0.12, 1.0, uDayFactor) * (1.0 - uCloudDarkness * 0.5);
    col *= 0.35 + NdotL * 0.65 * daylight;

    // Specular hit (kill under clouds/rain).
    float specMask = (1.0 - uFreeze) * (1.0 - uCloudDarkness * 0.8) * (1.0 - uRain * 0.6);
    col += vec3(1.0, 0.95, 0.82) * spec * specMask * 1.6;

    // Fresnel sky tint on the horizon of the lake
    vec3 sky = mix(vec3(0.40, 0.55, 0.75), vec3(0.08, 0.12, 0.20), uCloudDarkness);
    col = mix(col, sky, fres * 0.35 * (1.0 - uFreeze));

    // Shoreline foam
    float shore = smoothstep(0.75, 1.0, edgeT);
    float foamNoise = vnoise(vWorldXZ * 2.2 + uTime * 0.3);
    float foam = shore * smoothstep(0.4, 0.9, foamNoise) * (1.0 - uFreeze);
    col = mix(col, vec3(0.92, 0.96, 0.98), foam);

    // Rain ripples — bright blue-white splatter pattern
    if (uRain > 0.01) {
      vec2 rp = vWorldXZ * 3.5;
      vec2 cell = floor(rp);
      vec2 f = fract(rp);
      float seed = hash21(cell);
      float t0 = fract(uTime * 0.9 + seed);
      float r = length(f - 0.5);
      float ripple = smoothstep(0.5, 0.46, abs(r - t0 * 0.5));
      ripple *= (1.0 - t0);
      col += vec3(0.8, 0.9, 1.0) * ripple * uRain * 0.35;
    }

    // Ice overlay
    if (uFreeze > 0.01) {
      vec3 iceCol = mix(vec3(0.70, 0.80, 0.88), vec3(0.92, 0.96, 0.99), vnoise(vWorldXZ * 0.5));
      // cracks
      float crack = smoothstep(0.85, 0.95, vnoise(vWorldXZ * 0.8)) +
                    smoothstep(0.85, 0.95, vnoise(vWorldXZ * 1.6 + 11.0));
      iceCol = mix(iceCol, vec3(0.35, 0.45, 0.55), clamp(crack, 0.0, 1.0));
      col = mix(col, iceCol, uFreeze);
    }

    // Alpha feathers at the very rim so the shoreline reads soft
    float alpha = mix(0.92, 0.65, edgeT);
    alpha = mix(alpha, 0.98, uFreeze);

    gl_FragColor = vec4(col, alpha);
  }
`;
