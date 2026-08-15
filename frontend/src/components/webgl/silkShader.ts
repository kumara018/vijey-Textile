/**
 * GLSL source for the flowing-silk hero backdrop.
 *
 * Kept in its own module (plain exported strings, no JSX) so the shader can be
 * shared by both stores with only uniform values differing, and so editing the
 * GLSL doesn't churn the React component's diff.
 */

// Ashima Arts' 3D simplex noise — the standard public-domain/MIT implementation
// (github.com/ashima/webgl-noise). Used for the cloth displacement field.
const SIMPLEX_3D = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

/**
 * Shared displacement function — the actual "cloth" motion. Three octaves of
 * simplex noise at different scales/speeds, plus a long directional wave so the
 * fabric reads as *draping and rippling* rather than randomly bubbling.
 *
 * Declared once here and used by the vertex shader three times (at the vertex
 * and at two neighbouring samples) so surface normals are derived from the same
 * field that moved the geometry — otherwise the lighting detaches from the
 * silhouette and the whole thing looks like a flat painted texture.
 */
const DISPLACE = /* glsl */ `
uniform float uTime;
uniform float uAmp;
uniform vec2  uMouse;
uniform float uMouseStrength;

float clothHeight(vec2 p) {
  float t = uTime;

  // Long, slow drape running diagonally across the fabric.
  float drape = sin(p.x * 1.15 + p.y * 0.55 + t * 0.42) * 0.55;

  // Mid-scale ripple.
  float ripple = snoise(vec3(p * 1.4, t * 0.22)) * 0.42;

  // Fine weave shimmer.
  float weave = snoise(vec3(p * 3.6, t * 0.35)) * 0.14;

  // Pointer pushes a soft bulge into the cloth, falling off with distance.
  float d = distance(p, uMouse);
  float touch = exp(-d * d * 1.1) * uMouseStrength * 0.85;

  return (drape + ripple + weave + touch) * uAmp;
}
`;

export const SILK_VERTEX = /* glsl */ `
${SIMPLEX_3D}
${DISPLACE}

varying vec3 vNormal;
varying vec3 vViewPos;
varying vec2 vUv;
varying float vHeight;

void main() {
  vUv = uv;

  vec3 pos = position;
  float h = clothHeight(pos.xy);
  pos.z += h;
  vHeight = h;

  // Numerical normal from the same displacement field (see DISPLACE docblock).
  float e = 0.08;
  float hx = clothHeight(position.xy + vec2(e, 0.0));
  float hy = clothHeight(position.xy + vec2(0.0, e));
  vec3 tangentX = normalize(vec3(e, 0.0, hx - h));
  vec3 tangentY = normalize(vec3(0.0, e, hy - h));
  vNormal = normalize(cross(tangentX, tangentY));

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  vViewPos = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const SILK_FRAGMENT = /* glsl */ `
precision highp float;

uniform vec3  uColorDeep;
uniform vec3  uColorMid;
uniform vec3  uColorLight;
uniform vec3  uSheen;
uniform float uTime;
uniform float uOpacity;
uniform float uFadeStart;   // uv.x where the copy-side fade begins
uniform float uFadeEnd;     // uv.x where it reaches its minimum
uniform float uFadeFloor;   // remaining opacity over the copy column
uniform float uFadeFlip;    // 1.0 mirrors the ramp (copy column on the left)

varying vec3 vNormal;
varying vec3 vViewPos;
varying vec2 vUv;
varying float vHeight;

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewPos);

  // Two lights: a warm key from upper-left, a cool-ish fill from lower-right,
  // so the folds always have a lit face and a shaded face regardless of which
  // way a given ripple happens to be leaning.
  vec3 L1 = normalize(vec3(-0.45, 0.75, 0.62));
  vec3 L2 = normalize(vec3(0.65, -0.35, 0.55));

  float d1 = max(dot(N, L1), 0.0);
  float d2 = max(dot(N, L2), 0.0) * 0.45;

  // Anisotropic-ish sheen: satin catches a tight highlight along the fold
  // direction, which is what separates "silk" from "plastic".
  vec3 H = normalize(L1 + V);
  float spec = pow(max(dot(N, H), 0.0), 46.0);

  // Fresnel rim — silk goes brighter and slightly desaturated at grazing angles.
  float fres = pow(1.0 - max(dot(N, V), 0.0), 2.6);

  // Height drives the base colour ramp: troughs sink into the deeper tone,
  // crests rise toward the lighter one.
  float ramp = smoothstep(-0.55, 0.75, vHeight);
  vec3 base = mix(uColorDeep, uColorMid, ramp);
  base = mix(base, uColorLight, smoothstep(0.25, 1.0, ramp) * 0.65);

  // High ambient floor on purpose. This silk sits *behind* the hero headline,
  // which is near-black (maroon-900) — a conventional 0.3-ish ambient sent
  // ~38% of the frame under RGB(48,16,16) and would have buried the type.
  // Keeping the multiplier in ~0.72–1.15 gives real fold shading while the
  // panel stays light enough to read dark text against.
  vec3 color = base * (0.72 + d1 * 0.30 + d2 * 0.16);
  color += uSheen * spec * 0.55;
  color += uSheen * fres * 0.18;

  // Very subtle vertical falloff so the panel melts into the page instead of
  // ending on a hard rectangular edge.
  float vignette = smoothstep(0.0, 0.32, vUv.y) * smoothstep(1.0, 0.72, vUv.y);
  float alpha = uOpacity * mix(0.82, 1.0, vignette);

  // Copy-side fade. The hero is a diagonal split — brand mark on one side,
  // headline and body copy on the other. Body copy is maroon-500 wine, and
  // wine text over full-strength wine silk measured 1.6:1 contrast (4.5:1 is
  // the readable floor), so the cloth thins out across the text column and
  // lets the pale page gradient carry it instead. The mesh's z-rotation makes
  // this ramp read as a diagonal, which suits the split rather than fighting it.
  // uFadeFlip mirrors the ramp: the two stores' heroes are deliberate mirror
  // images of each other (mark-left/copy-right vs mark-right/copy-left), so
  // the cloth has to thin toward the opposite edge on each.
  float fx = mix(vUv.x, 1.0 - vUv.x, step(0.5, uFadeFlip));
  float sideFade = mix(1.0, uFadeFloor, smoothstep(uFadeStart, uFadeEnd, fx));
  alpha *= sideFade;

  gl_FragColor = vec4(color, alpha);
}
`;
