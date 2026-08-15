import * as THREE from 'three';

/**
 * Anisotropic satin — the material the whole storefront is selling.
 *
 * Standard PBR gives an isotropic highlight: a round specular blob that reads
 * as plastic or polished stone. Woven cloth does not do that. Its threads run
 * in one direction, so the highlight smears *across* the weave into a band,
 * and that band is the single strongest cue that something is fabric. There is
 * no stock three.js material for it, which is why this is hand-written GLSL.
 *
 * The model is Kajiya-Kay: shift the shading normal along the tangent and
 * evaluate two lobes at different widths, one tight and bright for the sheen
 * and one broad and dim for the body of the cloth. Cheap enough for a phone,
 * and the only part of the frame anyone will actually look at.
 */

export interface SatinUniforms {
  uTime: { value: number };
  uColor: { value: THREE.Color };
  uSheenColor: { value: THREE.Color };
  uLightDir: { value: THREE.Vector3 };
  uRoughness: { value: number };
  uSheenStrength: { value: number };
  uWaveAmp: { value: number };
  uWaveFreq: { value: number };
  uOpacity: { value: number };
}

const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uWaveAmp;
  uniform float uWaveFreq;

  varying vec3 vNormal;
  varying vec3 vTangent;
  varying vec3 vViewDir;
  varying vec2 vUv;
  varying float vFold;

  // Cloth hanging in still air moves in two overlapping waves, not one — a
  // single sine reads as a flag, which is far too energetic for a display piece.
  float drape(vec2 p, float t) {
    float a = sin(p.x * uWaveFreq + t * 0.6) * 0.6;
    float b = sin((p.x * 0.6 + p.y * 1.3) * uWaveFreq * 0.7 - t * 0.42) * 0.4;
    return a + b;
  }

  void main() {
    vUv = uv;

    vec3 pos = position;
    float fold = drape(uv * 4.0, uTime);
    // Anchor the top edge: fabric on a rail does not billow where it is held.
    float hang = smoothstep(0.0, 0.85, 1.0 - uv.y);
    pos.z += fold * uWaveAmp * hang;
    vFold = fold;

    // Derive the normal from the displacement rather than reusing the flat
    // one. Without this the geometry ripples but the lighting stays put, and
    // the surface reads as a printed pattern sliding over a flat plane.
    float e = 0.012;
    vec3 dx = vec3(e * 2.0, 0.0,
      (drape((uv + vec2(e, 0.0)) * 4.0, uTime) - drape((uv - vec2(e, 0.0)) * 4.0, uTime)) * uWaveAmp * hang);
    vec3 dy = vec3(0.0, e * 2.0,
      (drape((uv + vec2(0.0, e)) * 4.0, uTime) - drape((uv - vec2(0.0, e)) * 4.0, uTime)) * uWaveAmp * hang);
    vec3 n = normalize(cross(dx, dy));

    vNormal = normalize(normalMatrix * n);
    // Weave direction. Horizontal, so the sheen band runs across the drape the
    // way it does on a bolt of cloth.
    vTangent = normalize(normalMatrix * vec3(1.0, 0.0, 0.0));

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  uniform vec3  uColor;
  uniform vec3  uSheenColor;
  uniform vec3  uLightDir;
  uniform float uRoughness;
  uniform float uSheenStrength;
  uniform float uOpacity;

  varying vec3 vNormal;
  varying vec3 vTangent;
  varying vec3 vViewDir;
  varying vec2 vUv;
  varying float vFold;

  // Kajiya-Kay: the highlight is computed against a normal shifted along the
  // thread direction, which is what turns a round specular dot into a band.
  float strandSpec(vec3 t, vec3 n, vec3 l, vec3 v, float shift, float width) {
    vec3 shiftedT = normalize(t + n * shift);
    vec3 h = normalize(l + v);
    float dotTH = dot(shiftedT, h);
    float sinTH = sqrt(max(0.0, 1.0 - dotTH * dotTH));
    float atten = smoothstep(-1.0, 0.0, dotTH);
    return atten * pow(sinTH, width);
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(vViewDir);
    vec3 l = normalize(uLightDir);
    vec3 t = normalize(vTangent);

    float diff = max(dot(n, l), 0.0);
    // Wrapped diffuse. Real cloth scatters light under its own surface, so it
    // never goes fully black on the shadow side the way a hard lambert term
    // does — that hard terminator is what makes CG fabric look like cardboard.
    float wrapped = diff * 0.62 + 0.38;

    float width = mix(120.0, 14.0, uRoughness);
    float primary   = strandSpec(t, n, l, v, -0.06, width);
    float secondary = strandSpec(t, n, l, v,  0.10, width * 0.22) * 0.45;

    // Rim light. Separates the silhouette from the page behind it, which
    // matters here because the scene composites over real content rather than
    // a controlled backdrop.
    float rim = pow(1.0 - max(dot(n, v), 0.0), 2.6) * 0.28;

    // Folds sit slightly darker in the crease, as thread density rises.
    float creaseShade = 1.0 - abs(vFold) * 0.08;

    vec3 base  = uColor * wrapped * creaseShade;
    vec3 sheen = uSheenColor * (primary + secondary) * uSheenStrength;

    gl_FragColor = vec4(base + sheen + uSheenColor * rim, uOpacity);

    #include <colorspace_fragment>
  }
`;

/**
 * Builds the satin material.
 *
 * `geometryScale` comes from the tier budget and only affects tessellation at
 * the call site — the shader cost itself is per-pixel and identical on every
 * tier, which is intentional: the sheen is the point of the material, so it is
 * the last thing that should be dropped on a weak device.
 */
export function createSatinMaterial(opts: {
  color: THREE.ColorRepresentation;
  sheenColor: THREE.ColorRepresentation;
  roughness?: number;
  sheenStrength?: number;
  waveAmp?: number;
  waveFreq?: number;
  opacity?: number;
}): THREE.ShaderMaterial {
  const uniforms: SatinUniforms = {
    uTime:          { value: 0 },
    uColor:         { value: new THREE.Color(opts.color) },
    uSheenColor:    { value: new THREE.Color(opts.sheenColor) },
    uLightDir:      { value: new THREE.Vector3(0.45, 0.75, 0.55).normalize() },
    uRoughness:     { value: opts.roughness ?? 0.34 },
    uSheenStrength: { value: opts.sheenStrength ?? 0.85 },
    uWaveAmp:       { value: opts.waveAmp ?? 0.32 },
    uWaveFreq:      { value: opts.waveFreq ?? 1.5 },
    uOpacity:       { value: opts.opacity ?? 1 },
  };

  return new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: (opts.opacity ?? 1) < 1,
    // Cloth is visible from both sides as it drapes and turns.
    side: THREE.DoubleSide,
  });
}
