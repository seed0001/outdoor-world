import * as THREE from "three";

export interface FoliageUniforms {
  uYearPhase: { value: number };
  uTime: { value: number };
  uWind: { value: number };
  uPhaseSpread: { value: number };
}

/**
 * Patched MeshStandardMaterial that uses a per-instance attribute `aPhase`
 * to stagger each tree's position in the yearly foliage cycle:
 *   0.00 spring bud -> 0.25 summer -> 0.50 autumn yellow -> 0.62 red ->
 *   0.72 drop -> bare until 0.88 -> buds again.
 * Foliage geometry scales to 0 during bare winter so no leaves are drawn.
 * A wind-driven sway is applied to vertices weighted by local Y height.
 */
export function createFoliageMaterial(): {
  material: THREE.MeshStandardMaterial;
  uniforms: FoliageUniforms;
} {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    metalness: 0,
    // alphaTest avoids transparency sorting; we shrink geometry to hide.
  });

  const uniforms: FoliageUniforms = {
    uYearPhase: { value: 0 },
    uTime: { value: 0 },
    uWind: { value: 0.2 },
    uPhaseSpread: { value: 0.12 },
  };

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uYearPhase = uniforms.uYearPhase;
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWind = uniforms.uWind;
    shader.uniforms.uPhaseSpread = uniforms.uPhaseSpread;

    shader.vertexShader =
      `
      attribute float aPhase;
      uniform float uYearPhase;
      uniform float uTime;
      uniform float uWind;
      uniform float uPhaseSpread;
      varying vec3 vLeafColor;
      varying float vLeafScale;

      vec3 seasonColor(float p) {
        vec3 springEarly = vec3(0.40, 0.62, 0.28);
        vec3 summer      = vec3(0.22, 0.48, 0.24);
        vec3 summerDeep  = vec3(0.17, 0.40, 0.20);
        vec3 yellow      = vec3(0.80, 0.68, 0.20);
        vec3 orange      = vec3(0.78, 0.42, 0.12);
        vec3 red         = vec3(0.62, 0.22, 0.12);
        vec3 bare        = vec3(0.35, 0.25, 0.18);
        if (p < 0.10) return mix(bare, springEarly, p / 0.10);
        if (p < 0.25) return mix(springEarly, summer, (p - 0.10) / 0.15);
        if (p < 0.45) return mix(summer, summerDeep, (p - 0.25) / 0.20);
        if (p < 0.55) return mix(summerDeep, yellow, (p - 0.45) / 0.10);
        if (p < 0.63) return mix(yellow, orange, (p - 0.55) / 0.08);
        if (p < 0.70) return mix(orange, red, (p - 0.63) / 0.07);
        return bare;
      }

      float leafScale(float p) {
        if (p < 0.08) return smoothstep(0.0, 0.08, p);
        if (p < 0.58) return 1.0;
        if (p < 0.70) return 1.0 - smoothstep(0.58, 0.70, p);
        return 0.0;
      }
    ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `
        float localPhase = fract(uYearPhase + aPhase * uPhaseSpread);
        vLeafColor = seasonColor(localPhase);
        float scaleF = leafScale(localPhase);
        vLeafScale = scaleF;

        vec3 transformed = vec3(position) * scaleF;
        float heightMask = smoothstep(0.0, 1.0, position.y);
        float sway = sin(uTime * 1.6 + aPhase * 6.2831) * uWind * 0.18;
        transformed.x += sway * heightMask;
        transformed.z += cos(uTime * 1.3 + aPhase * 5.7) * uWind * 0.12 * heightMask;
      `,
    );

    shader.fragmentShader =
      `
      varying vec3 vLeafColor;
      varying float vLeafScale;
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `
        #include <color_fragment>
        diffuseColor.rgb *= vLeafColor;
        if (vLeafScale < 0.01) discard;
      `,
    );
  };

  mat.customProgramCacheKey = () => "foliage-seasonal-v1";

  return { material: mat, uniforms };
}
