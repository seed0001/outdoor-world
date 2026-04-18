import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Sky as DreiSky, Stars } from "@react-three/drei";
import { snapshot } from "../systems/world/worldClock";
import { getWeather } from "../systems/weather/weatherSystem";

const DAY_FOG = new THREE.Color("#c8d8e8");
const DUSK_FOG = new THREE.Color("#ff8d5a");
const NIGHT_FOG = new THREE.Color("#0a1426");
const STORM_FOG = new THREE.Color("#4a5260");

const SUN_WARM = new THREE.Color("#ffb27a");
const SUN_NOON = new THREE.Color("#fff3d6");

const AMBIENT_DAY = new THREE.Color("#b9d5ff");
const AMBIENT_NIGHT = new THREE.Color("#283a5c");

export default function Sky() {
  const skyRef = useRef<THREE.Mesh<THREE.BoxGeometry, THREE.ShaderMaterial>>(
    null,
  );
  const sunLightRef = useRef<THREE.DirectionalLight>(null);
  const moonLightRef = useRef<THREE.DirectionalLight>(null);
  const moonMeshRef = useRef<THREE.Mesh>(null);
  const moonMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const starsGroupRef = useRef<THREE.Group>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  /** Extra flat fill so terrain (no env map) doesn’t go black in heavy storms. */
  const stormFillRef = useRef<THREE.AmbientLight>(null);

  const sunDir = useMemo(() => new THREE.Vector3(), []);
  const moonDir = useMemo(() => new THREE.Vector3(), []);
  const workColor = useMemo(() => new THREE.Color(), []);
  const scene = useThree((s) => s.scene);

  useFrame(() => {
    const world = snapshot();
    const weather = getWeather();

    // Sun phase: 1 in-game day (dayFrac 0..1) = one full arc. dayFrac 0.25
    // = sunrise (east), 0.5 = noon, 0.75 = sunset, 0 = midnight.
    const dayTheta = (world.dayFrac - 0.25) * Math.PI * 2;

    sunDir
      .set(
        Math.cos(dayTheta),
        Math.sin(dayTheta),
        Math.sin(dayTheta) * 0.25 + 0.1,
      )
      .normalize();
    moonDir.copy(sunDir).multiplyScalar(-1);

    const elev = sunDir.y;
    const dayFactor = THREE.MathUtils.clamp(elev * 4 + 0.1, 0, 1);
    const nightFactor = THREE.MathUtils.clamp(-elev * 3 + 0.05, 0, 1);
    const horizonFactor = Math.max(0, 1 - Math.abs(elev) * 6);

    // Do not multiply by `weather.intensity`: that value dips during transitions and
    // was wiping out storm darkening at the worst moments.
    const cloudCoverage = weather.cloudCoverage;
    const cloudDarkness = weather.cloudDarkness;

    // --- Sky shader uniforms ---
    const skyMesh = skyRef.current;
    if (skyMesh) {
      const u = skyMesh.material.uniforms;
      u.sunPosition.value.copy(sunDir).multiplyScalar(1000);
      u.turbidity.value =
        2 +
        horizonFactor * 8 +
        nightFactor * 1 +
        cloudCoverage * 4 +
        cloudDarkness * 12;
      u.rayleigh.value = Math.max(
        0.12,
        0.6 +
          horizonFactor * 3 +
          nightFactor * 0.5 +
          cloudCoverage * 1 -
          cloudDarkness * 0.85,
      );
      u.mieCoefficient.value =
        0.004 + horizonFactor * 0.02 + cloudDarkness * 0.04;
      u.mieDirectionalG.value = 0.8;
    }

    // --- Sun directional light ---
    const sun = sunLightRef.current;
    if (sun) {
      sun.position.copy(sunDir).multiplyScalar(80);
      sun.target.position.set(0, 0, 0);
      sun.target.updateMatrixWorld();
      const baseIntensity = dayFactor * 2.6;
      // Slightly softer than 0.92× so thunderstorm keeps a sliver of directional light.
      const sunAtten = 1 - THREE.MathUtils.clamp(cloudDarkness * 0.82, 0, 0.94);
      let sunInt = baseIntensity * sunAtten;
      // Floor: fully dark albedo + no env map = “missing” ground under heavy clouds.
      if (cloudDarkness > 0.55) {
        sunInt = Math.max(sunInt, 0.38 * dayFactor + 0.06 * nightFactor);
      }
      sun.intensity = sunInt;
      const warmth = 1 - THREE.MathUtils.clamp(elev * 3, 0, 1);
      sun.color.copy(SUN_NOON).lerp(SUN_WARM, warmth);
      sun.castShadow = elev > 0.02 && cloudDarkness < 0.48;
      sun.visible = sun.intensity > 0.001;
    }

    // --- Moon ---
    const moon = moonLightRef.current;
    if (moon) {
      moon.position.copy(moonDir).multiplyScalar(80);
      moon.target.position.set(0, 0, 0);
      moon.target.updateMatrixWorld();
      moon.intensity =
        nightFactor * 0.55 * (1 - THREE.MathUtils.clamp(cloudDarkness * 0.65, 0, 0.95));
      moon.visible = moon.intensity > 0.001;
    }
    const moonMesh = moonMeshRef.current;
    const moonMat = moonMatRef.current;
    if (moonMesh && moonMat) {
      moonMesh.position.copy(moonDir).multiplyScalar(420);
      const visFactor = THREE.MathUtils.clamp(
        (moonDir.y * 4 + 0.3) * (1 - cloudCoverage * 0.85),
        0,
        1,
      );
      moonMat.opacity = visFactor;
      moonMesh.visible = visFactor > 0.001;
    }

    // --- Stars ---
    const stars = starsGroupRef.current;
    if (stars) {
      const starOpacity = nightFactor * (1 - cloudCoverage * 0.9);
      stars.visible = starOpacity > 0.001;
      stars.traverse((obj) => {
        const m = (obj as THREE.Points).material as
          | THREE.Material
          | THREE.Material[]
          | undefined;
        const apply = (mat: THREE.Material) => {
          mat.transparent = true;
          mat.depthWrite = false;
          (mat as THREE.Material & { opacity: number }).opacity = starOpacity;
        };
        if (Array.isArray(m)) m.forEach(apply);
        else if (m) apply(m);
      });
    }

    // --- Ambient + hemisphere ---
    if (ambientRef.current) {
      let amb =
        (0.08 + dayFactor * 0.32) *
        (1 - THREE.MathUtils.clamp(cloudDarkness * 0.58, 0, 0.95));
      if (cloudDarkness > 0.5) amb = Math.max(amb, 0.14 + dayFactor * 0.12);
      ambientRef.current.intensity = amb;
      ambientRef.current.color
        .copy(AMBIENT_NIGHT)
        .lerp(AMBIENT_DAY, dayFactor);
    }
    if (hemiRef.current) {
      let hemi =
        (0.1 + dayFactor * 0.45) *
        (1 - THREE.MathUtils.clamp(cloudDarkness * 0.68, 0, 0.95));
      if (cloudDarkness > 0.5) hemi = Math.max(hemi, 0.18 + dayFactor * 0.16);
      hemiRef.current.intensity = hemi;
    }
    if (stormFillRef.current) {
      const k = THREE.MathUtils.clamp(
        (cloudDarkness - 0.42) / 0.55,
        0,
        1,
      );
      stormFillRef.current.intensity =
        k * k * (0.12 + dayFactor * 0.14 + nightFactor * 0.05);
      stormFillRef.current.color.copy(STORM_FOG).lerp(AMBIENT_DAY, dayFactor * 0.35);
    }

    // --- Fog color shift ---
    const fog = scene.fog;
    if (fog instanceof THREE.Fog) {
      if (elev > 0.15) {
        workColor.copy(DAY_FOG);
      } else if (elev > -0.1) {
        const k = (elev + 0.1) / 0.25;
        workColor.copy(DUSK_FOG).lerp(DAY_FOG, k);
      } else {
        const k = THREE.MathUtils.clamp((elev + 0.3) / 0.2, 0, 1);
        workColor.copy(NIGHT_FOG).lerp(DUSK_FOG, k);
      }
      if (cloudDarkness > 0) {
        workColor.lerp(STORM_FOG, cloudDarkness * 0.72);
      }
      fog.color.copy(workColor);
      const cc = THREE.MathUtils.clamp(cloudCoverage, 0, 1);
      // Earlier: far = 180 - cc*80 (down to ~100) fully washed out the ground in storms.
      // Pull near in gently and widen far so mid-field terrain stays readable.
      fog.near = 50 - cc * 11;
      fog.far = fog.near + THREE.MathUtils.lerp(130, 145, cc);
    }
  });

  return (
    <>
      <DreiSky
        ref={skyRef}
        distance={450000}
        sunPosition={[1, 0.4, 0]}
        turbidity={4}
        rayleigh={1.2}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />

      <fog attach="fog" args={["#c8d8e8", 50, 180]} />

      <ambientLight ref={ambientRef} intensity={0.35} color={"#b9d5ff"} />
      <hemisphereLight
        ref={hemiRef}
        args={["#d6e6f5", "#3a5a2c", 0.45]}
      />
      <ambientLight ref={stormFillRef} intensity={0} color={"#5a6470"} />

      <directionalLight
        ref={sunLightRef}
        intensity={2.2}
        color={"#fff3d6"}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={260}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-bias={-0.0005}
        shadow-normalBias={0.04}
      />

      <directionalLight
        ref={moonLightRef}
        intensity={0}
        color={"#a6c4ff"}
      />

      <group ref={starsGroupRef}>
        <Stars
          radius={320}
          depth={60}
          count={6000}
          factor={4}
          saturation={0}
          fade
        />
      </group>

      <mesh ref={moonMeshRef} frustumCulled={false}>
        <sphereGeometry args={[14, 32, 32]} />
        <meshBasicMaterial
          ref={moonMatRef}
          color={"#f4efe2"}
          transparent
          opacity={0}
          toneMapped={false}
          depthWrite={false}
          fog={false}
        />
      </mesh>
    </>
  );
}
