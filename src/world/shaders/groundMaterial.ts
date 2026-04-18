import * as THREE from "three";

export interface GroundUniforms {
  uSnowLevel: { value: number };
  uWetness: { value: number };
  uTime: { value: number };
}

/**
 * A MeshStandardMaterial patched to blend grass -> snow on upward-facing
 * surfaces, with patchy noise edges and elevation banding, varied grass-green
 * patches in world space, and to darken the surface when wet.
 */
export function createGroundMaterial(): {
  material: THREE.MeshStandardMaterial;
  uniforms: GroundUniforms;
} {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    // Scene fog pushes storm/dusk color onto distant hills; distance fog on
    // the walkable mesh reads as “missing ground” in heavy weather.
    fog: false,
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

        // South (negative Z) desert biome — mute grass tints, reduce snow / wet cues.
        float desertBio = 1.0 - smoothstep(-178.0, -108.0, vWorldPosition.z);

        // Grass tint patches (world XZ) — lower frequencies = larger patches on terrain.
        vec2 gx = vWorldPosition.xz;
        float gN = vnoise(gx * 0.016);
        gN += 0.55 * vnoise(gx * 0.042 + vec2(13.2, 7.1));
        gN += 0.28 * vnoise(gx * 0.09 + vec2(1.0, 22.0));
        gN /= 1.83;
        float gM = vnoise(gx * 0.024 + vec2(40.0, 4.0));
        float gK = vnoise(gx * 0.068 + vec2(-18.0, 60.0));
        float gT = smoothstep(0.08, 0.92, gN);
        float gT2 = smoothstep(0.15, 0.9, gM);
        float gT3 = smoothstep(0.28, 0.82, gK);
        vec3 warmTint = vec3(1.09, 0.98, 0.84);
        vec3 coolTint = vec3(0.9, 1.06, 0.98);
        vec3 oliveTint = vec3(0.92, 0.88, 0.72);
        vec3 mossTint = vec3(0.86, 1.03, 0.91);
        vec3 grassPatchTint = mix(
          mix(warmTint, coolTint, gT),
          mix(oliveTint, mossTint, gT3),
          gT2 * 0.72
        );
        grassPatchTint = clamp(grassPatchTint, vec3(0.78), vec3(1.14));
        float grassMix = 0.68 * (1.0 - desertBio * 0.92);
        diffuseColor.rgb *= mix(vec3(1.0), grassPatchTint, grassMix);

        float slope = clamp(vWorldNormal.y, 0.0, 1.0);
        float slopeMask = smoothstep(0.55, 0.9, slope);

        // Patchy edges from noise + elevation banding.
        float n = vnoise(vWorldPosition.xz * 0.12);
        float n2 = vnoise(vWorldPosition.xz * 0.35 + 7.1);
        float patchy = 1.0 - (n * 0.55 + n2 * 0.25);

        float elevBoost = smoothstep(3.0, 7.5, vWorldPosition.y);

        float snow = clamp(
          (slopeMask * patchy + elevBoost * 0.6) * uSnowLevel * 1.2 * (1.0 - desertBio * 0.95),
          0.0,
          1.0
        );

        vec3 snowColor = vec3(0.94, 0.96, 0.98);
        diffuseColor.rgb = mix(diffuseColor.rgb, snowColor, snow);

        // Wet darkening (muds the grass, less effect on snow)
        float wetMask = (1.0 - snow) * uWetness * (1.0 - desertBio * 0.85);
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
  mat.customProgramCacheKey = () => "ground-seasonal-grass-desert-v1";

  return { material: mat, uniforms };
}
