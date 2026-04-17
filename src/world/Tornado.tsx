import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { getWeather } from "../systems/weather/weatherSystem";
import { health } from "../systems/player/health";
import { playerRef, addCameraShake } from "../systems/player/playerRef";
import { onCommand } from "../systems/world/commands";
import { worldState } from "../systems/world/worldState";
import { trees as treeList } from "../systems/world/treeRegistry";
import { rocks as rockList } from "../systems/world/rockRegistry";
import { HALF, heightAt } from "./terrain";

const FUNNEL_RINGS = 40;
const FUNNEL_SEGMENTS = 22;
const FUNNEL_HEIGHT = 42;
const RADIUS_OUTER = 40;
const RADIUS_LIFT = 15;
const RADIUS_DEATH = 5;
const LIFETIME_MS = 90_000; // 90 real seconds base
const DEBRIS_COUNT = 1800;

interface ActiveTornado {
  id: number;
  start: THREE.Vector3;
  control: THREE.Vector3;
  end: THREE.Vector3;
  startTime: number;
  lifetimeMs: number;
}

function randomPathPoints(): {
  start: THREE.Vector3;
  control: THREE.Vector3;
  end: THREE.Vector3;
} {
  const angle = Math.random() * Math.PI * 2;
  const opposite = angle + Math.PI + (Math.random() - 0.5) * 0.6;
  const edge = HALF - 4;
  const start = new THREE.Vector3(
    Math.cos(angle) * edge,
    0,
    Math.sin(angle) * edge,
  );
  const end = new THREE.Vector3(
    Math.cos(opposite) * edge,
    0,
    Math.sin(opposite) * edge,
  );
  // Control point offset perpendicular to direction
  const dir = end.clone().sub(start);
  const perp = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
  const mid = start.clone().add(end).multiplyScalar(0.5);
  const control = mid.addScaledVector(
    perp,
    (Math.random() - 0.5) * 40,
  );
  start.y = heightAt(start.x, start.z);
  end.y = heightAt(end.x, end.z);
  control.y = 0;
  return { start, control, end };
}

function evalBezier(
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  t: number,
  out: THREE.Vector3,
) {
  const mt = 1 - t;
  out.set(
    mt * mt * a.x + 2 * mt * t * b.x + t * t * c.x,
    mt * mt * a.y + 2 * mt * t * b.y + t * t * c.y,
    mt * mt * a.z + 2 * mt * t * b.z + t * t * c.z,
  );
}

let nextTornadoId = 1;

function buildFunnelGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < FUNNEL_RINGS; i++) {
    const t = i / (FUNNEL_RINGS - 1);
    const y = t * FUNNEL_HEIGHT;
    const r = 0.6 + t * t * 5.2 + t * 1.8;
    for (let s = 0; s <= FUNNEL_SEGMENTS; s++) {
      const a = (s / FUNNEL_SEGMENTS) * Math.PI * 2;
      positions.push(Math.cos(a) * r, y, Math.sin(a) * r);
      uvs.push(s / FUNNEL_SEGMENTS, t);
    }
  }
  for (let i = 0; i < FUNNEL_RINGS - 1; i++) {
    for (let s = 0; s < FUNNEL_SEGMENTS; s++) {
      const a = i * (FUNNEL_SEGMENTS + 1) + s;
      const b = a + 1;
      const c = (i + 1) * (FUNNEL_SEGMENTS + 1) + s;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function buildDebrisGeometry(): {
  geometry: THREE.BufferGeometry;
} {
  const pos = new Float32Array(DEBRIS_COUNT * 3);
  const aSeed = new Float32Array(DEBRIS_COUNT);
  const aAngle = new Float32Array(DEBRIS_COUNT);
  const aHeight = new Float32Array(DEBRIS_COUNT);
  const aRadius = new Float32Array(DEBRIS_COUNT);
  const aSize = new Float32Array(DEBRIS_COUNT);
  for (let i = 0; i < DEBRIS_COUNT; i++) {
    pos[i * 3] = 0;
    pos[i * 3 + 1] = 0;
    pos[i * 3 + 2] = 0;
    aSeed[i] = Math.random();
    aAngle[i] = Math.random() * Math.PI * 2;
    aHeight[i] = Math.random();
    aRadius[i] = 0.5 + Math.random() * 0.9;
    aSize[i] = 0.04 + Math.random() * 0.08;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aSeed", new THREE.BufferAttribute(aSeed, 1));
  g.setAttribute("aAngle", new THREE.BufferAttribute(aAngle, 1));
  g.setAttribute("aHeight", new THREE.BufferAttribute(aHeight, 1));
  g.setAttribute("aRadius", new THREE.BufferAttribute(aRadius, 1));
  g.setAttribute("aSize", new THREE.BufferAttribute(aSize, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 200);
  return { geometry: g };
}

const _vec = new THREE.Vector3();
const _vec2 = new THREE.Vector3();

export default function Tornado() {
  const [active, setActive] = useState<ActiveTornado | null>(null);
  const funnelRef = useRef<THREE.Mesh>(null);
  const debrisRef = useRef<THREE.Points>(null);
  const posRef = useRef(new THREE.Vector3());
  const felledTrees = useRef<Set<number>>(new Set());
  const felledRocks = useRef<Set<number>>(new Set());
  const playerDmgAccum = useRef(0);

  const funnelGeom = useMemo(buildFunnelGeometry, []);
  const { geometry: debrisGeom } = useMemo(buildDebrisGeometry, []);

  const funnelUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: 0 },
    }),
    [],
  );

  const debrisUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: 0 },
      uPixelRatio: { value: Math.min(2, window.devicePixelRatio || 1) },
    }),
    [],
  );

  const funnelMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: funnelUniforms,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        vertexShader: `
          uniform float uTime;
          uniform float uIntensity;
          varying float vY;
          varying float vSwirl;
          void main() {
            vec3 p = position;
            vY = clamp(p.y / ${FUNNEL_HEIGHT.toFixed(1)}, 0.0, 1.0);
            float swirlAngle = p.y * 0.4 + uTime * 6.0;
            float wobX = sin(swirlAngle * 0.7 + vY * 3.0) * 0.8 * vY;
            float wobZ = cos(swirlAngle * 0.9 + vY * 2.5) * 0.8 * vY;
            p.x += wobX;
            p.z += wobZ;
            vSwirl = sin(p.y * 3.0 + uTime * 14.0) * 0.5 + 0.5;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uIntensity;
          varying float vY;
          varying float vSwirl;
          void main() {
            float bodyAlpha = 0.55 * uIntensity * (0.7 + 0.3 * vSwirl);
            bodyAlpha *= mix(0.9, 0.3, vY);
            vec3 dark = vec3(0.18, 0.18, 0.22);
            vec3 light = vec3(0.48, 0.48, 0.56);
            vec3 col = mix(dark, light, vSwirl);
            gl_FragColor = vec4(col, bodyAlpha);
          }
        `,
      }),
    [funnelUniforms],
  );

  const debrisMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: debrisUniforms,
        transparent: true,
        depthWrite: false,
        vertexShader: `
          attribute float aSeed;
          attribute float aAngle;
          attribute float aHeight;
          attribute float aRadius;
          attribute float aSize;
          uniform float uTime;
          uniform float uIntensity;
          uniform float uPixelRatio;
          varying float vLife;
          void main() {
            float t = uTime * (1.2 + aSeed * 0.8);
            float angle = aAngle + t * 2.8;
            float heightCycle = mod(aHeight + t * 0.12, 1.0);
            vLife = 1.0 - heightCycle;
            float radiusAtY = aRadius * (1.0 + heightCycle * 5.0);
            vec3 p = vec3(
              cos(angle) * radiusAtY,
              heightCycle * ${FUNNEL_HEIGHT.toFixed(1)},
              sin(angle) * radiusAtY
            );
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = aSize * 900.0 * uPixelRatio * uIntensity / -mv.z;
          }
        `,
        fragmentShader: `
          uniform float uIntensity;
          varying float vLife;
          void main() {
            vec2 uv = gl_PointCoord - 0.5;
            float d = length(uv);
            if (d > 0.5) discard;
            float mask = smoothstep(0.5, 0.2, d);
            vec3 col = mix(vec3(0.25, 0.22, 0.18), vec3(0.6, 0.55, 0.45), vLife);
            gl_FragColor = vec4(col, mask * uIntensity * 0.9);
          }
        `,
      }),
    [debrisUniforms],
  );

  useEffect(
    () => () => {
      funnelGeom.dispose();
      debrisGeom.dispose();
      funnelMat.dispose();
      debrisMat.dispose();
    },
    [funnelGeom, debrisGeom, funnelMat, debrisMat],
  );

  const spawn = useMemo(
    () => () => {
      const { start, control, end } = randomPathPoints();
      const tornado: ActiveTornado = {
        id: nextTornadoId++,
        start,
        control,
        end,
        startTime: performance.now(),
        lifetimeMs: LIFETIME_MS + Math.random() * 30_000,
      };
      felledTrees.current = new Set();
      felledRocks.current = new Set();
      setActive(tornado);
    },
    [],
  );

  const cancel = useMemo(
    () => () => {
      setActive(null);
    },
    [],
  );

  // Watch weather state for auto-spawn when entering "tornado".
  useEffect(() => {
    let currentTornado = false;
    let raf = 0;
    const check = () => {
      const w = getWeather();
      const shouldHaveTornado = w.type === "tornado" && w.intensity > 0.3;
      if (shouldHaveTornado && !currentTornado) {
        currentTornado = true;
        spawn();
      } else if (!shouldHaveTornado && currentTornado) {
        currentTornado = false;
        // Let it fade out naturally via lifetime check
      }
      raf = requestAnimationFrame(check);
    };
    raf = requestAnimationFrame(check);
    return () => cancelAnimationFrame(raf);
  }, [spawn]);

  useEffect(() => {
    const unsubSpawn = onCommand("tornado:now", () => spawn());
    const unsubCancel = onCommand("tornado:cancel", () => cancel());
    return () => {
      unsubSpawn();
      unsubCancel();
    };
  }, [spawn, cancel]);

  useFrame((_, dt) => {
    funnelUniforms.uTime.value += dt;
    debrisUniforms.uTime.value += dt;

    if (!active) {
      funnelUniforms.uIntensity.value = Math.max(
        0,
        funnelUniforms.uIntensity.value - dt * 0.8,
      );
      debrisUniforms.uIntensity.value = funnelUniforms.uIntensity.value;
      if (funnelRef.current) {
        funnelRef.current.visible = funnelUniforms.uIntensity.value > 0.01;
      }
      if (debrisRef.current) {
        debrisRef.current.visible = debrisUniforms.uIntensity.value > 0.01;
      }
      return;
    }

    const now = performance.now();
    const age = now - active.startTime;
    const progress = Math.min(1, age / active.lifetimeMs);
    if (progress >= 1) {
      setActive(null);
      return;
    }

    // Intensity ramps up in first 10%, down in last 15%.
    let intensity = 1;
    if (progress < 0.1) intensity = progress / 0.1;
    else if (progress > 0.85) intensity = (1 - progress) / 0.15;
    funnelUniforms.uIntensity.value = intensity;
    debrisUniforms.uIntensity.value = intensity;

    // Evaluate bezier for current position.
    evalBezier(active.start, active.control, active.end, progress, posRef.current);
    posRef.current.y = heightAt(posRef.current.x, posRef.current.z);

    if (funnelRef.current) {
      funnelRef.current.position.copy(posRef.current);
      funnelRef.current.visible = intensity > 0.01;
    }
    if (debrisRef.current) {
      debrisRef.current.position.copy(posRef.current);
      debrisRef.current.visible = intensity > 0.01;
    }

    // --- Apply wind forces to player ---
    const body = playerRef.body;
    if (body) {
      const pt = body.translation();
      _vec.set(pt.x - posRef.current.x, 0, pt.z - posRef.current.z);
      const r = _vec.length();
      if (r < RADIUS_OUTER && r > 0.01) {
        const falloff = (1 - r / RADIUS_OUTER) * intensity;
        // tangential = perpendicular to radial vector
        _vec.normalize();
        _vec2.set(-_vec.z, 0, _vec.x); // tangent (counter-clockwise)
        // Spin + inward + lift
        const spin = 80 * falloff;
        const pull = 40 * falloff;
        const lift = r < RADIUS_LIFT ? 70 * falloff : 0;
        const fx = _vec2.x * spin - _vec.x * pull;
        const fz = _vec2.z * spin - _vec.z * pull;
        const fy = lift;
        body.applyImpulse({ x: fx * dt, y: fy * dt, z: fz * dt }, true);

        if (r < RADIUS_DEATH) {
          playerDmgAccum.current += dt;
          while (playerDmgAccum.current > 0.2) {
            playerDmgAccum.current -= 0.2;
            health.damage(2, "tornado");
          }
          addCameraShake(0.3 * dt);
        } else if (r < RADIUS_LIFT) {
          addCameraShake(0.08 * dt);
        }
      }
    }
    playerRef.shake = Math.max(0, playerRef.shake - dt * 0.8);

    // --- Destruction sweep ---
    const DESTROY_R = RADIUS_LIFT;
    for (const t of treeList) {
      if (felledTrees.current.has(t.id)) continue;
      if (worldState.isTreeFallen(t.id)) {
        felledTrees.current.add(t.id);
        continue;
      }
      const dx = t.x - posRef.current.x;
      const dz = t.z - posRef.current.z;
      const d = Math.hypot(dx, dz);
      if (d < DESTROY_R && intensity > 0.4) {
        felledTrees.current.add(t.id);
        const dirX = dx / (d || 1);
        const dirZ = dz / (d || 1);
        const tangX = -dirZ;
        const tangZ = dirX;
        const speedScale = (1 - d / DESTROY_R) * 90 + 40;
        worldState.fellTree({
          id: t.id,
          position: [t.x, t.y, t.z],
          trunkHeight: t.trunkHeight,
          trunkRadius: t.trunkRadius,
          foliageHeight: t.foliageHeight,
          foliageRadius: t.foliageRadius,
          initialImpulse: [
            tangX * speedScale + dirX * speedScale * 0.4,
            40 + Math.random() * 30,
            tangZ * speedScale + dirZ * speedScale * 0.4,
          ],
          angularImpulse: [
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 20,
          ],
          spawnSimMs: now,
        });
      }
    }

    const ROCK_DESTROY_R = RADIUS_LIFT * 0.8;
    for (const r of rockList) {
      if (felledRocks.current.has(r.id)) continue;
      if (worldState.isRockDisplaced(r.id)) {
        felledRocks.current.add(r.id);
        continue;
      }
      const dx = r.x - posRef.current.x;
      const dz = r.z - posRef.current.z;
      const d = Math.hypot(dx, dz);
      if (d < ROCK_DESTROY_R && intensity > 0.5 && r.scale > 0.45) {
        felledRocks.current.add(r.id);
        const dirX = dx / (d || 1);
        const dirZ = dz / (d || 1);
        const tangX = -dirZ;
        const tangZ = dirX;
        const speedScale = (1 - d / ROCK_DESTROY_R) * 30 + 15;
        worldState.displaceRock({
          id: r.id,
          position: [r.x, r.y + r.scale * 0.5, r.z],
          scale: [r.scale, r.scale, r.scale],
          initialImpulse: [
            tangX * speedScale,
            20 + Math.random() * 10,
            tangZ * speedScale,
          ],
          angularImpulse: [
            (Math.random() - 0.5) * 8,
            (Math.random() - 0.5) * 6,
            (Math.random() - 0.5) * 8,
          ],
          spawnSimMs: now,
        });
      }
    }
  });

  return (
    <group>
      <mesh ref={funnelRef} geometry={funnelGeom} material={funnelMat} frustumCulled={false} visible={false} />
      <points ref={debrisRef} geometry={debrisGeom} material={debrisMat} frustumCulled={false} visible={false} />
    </group>
  );
}
