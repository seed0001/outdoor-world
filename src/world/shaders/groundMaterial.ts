import * as THREE from "three";

export interface GroundUniforms {
  uSnowLevel: { value: number };
  uWetness: { value: number };
  uTime: { value: number };
}

/**
 * A MeshStandardMaterial patched to blend grass -> snow on upward-facing
 * surfaces, with patchy noise edges and elevation banding, and to darken
 * the surface when wet.
 */
export function createGroundMaterial(): {
  material: THREE.MeshStandardMaterial;
  uniforms: GroundUniforms;
} {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0,
  });
  const uniforms: GroundUniforms = {
    uSnowLevel: { value: 0 },
    uWetness: { value: 0 },
    uTime: { value: 0 },
  };

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSnowLevel = uniforms.uSnowLevel;
    shader.uniforms.uWetness = uniforms.uWetness;
    shader.uniforms.uTime = uniforms.uTime;

    // Inject world-space varyings.
    shader.vertexShader = `
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
    ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      `
        #include <worldpos_vertex>
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
      `,
    );

    shader.fragmentShader = `
      uniform float uSnowLevel;
      uniform float uWetness;
      uniform float uTime;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;

      // Hash-based value noise
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
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `
        #include <color_fragment>

        float slope = clamp(vWorldNormal.y, 0.0, 1.0);
        float slopeMask = smoothstep(0.55, 0.9, slope);

        // Patchy edges from noise + elevation banding.
        float n = vnoise(vWorldPosition.xz * 0.12);
        float n2 = vnoise(vWorldPosition.xz * 0.35 + 7.1);
        float patchy = 1.0 - (n * 0.55 + n2 * 0.25);

        float elevBoost = smoothstep(3.0, 7.5, vWorldPosition.y);

        float snow = clamp(
          (slopeMask * patchy + elevBoost * 0.6) * uSnowLevel * 1.2,
          0.0,
          1.0
        );

        vec3 snowColor = vec3(0.94, 0.96, 0.98);
        diffuseColor.rgb = mix(diffuseColor.rgb, snowColor, snow);

        // Wet darkening (muds the grass, less effect on snow)
        float wetMask = (1.0 - snow) * uWetness;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.55, wetMask);
      `,
    );

    // Slightly shinier when wet or snowy.
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      `
        #include <roughnessmap_fragment>
        float slopeF = clamp(vWorldNormal.y, 0.0, 1.0);
        float snowMask = smoothstep(0.55, 0.9, slopeF) * uSnowLevel;
        roughnessFactor = mix(roughnessFactor, 0.55, snowMask * 0.6);
        roughnessFactor = mix(roughnessFactor, 0.4, uWetness * 0.5);
      `,
    );
  };

  // Ensure the material recompiles when uniforms change (three r3f handles
  // this automatically since it's the same material instance).
  mat.customProgramCacheKey = () => "ground-seasonal";

  return { material: mat, uniforms };
}
