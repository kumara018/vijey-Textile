'use client';

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createSatinMaterial } from '../materials/satin';
import { useSafeTexture } from '../core/useSafeTexture';
import type { TierBudget } from '../core/capabilities';
import { useSceneStore } from '@/store/useSceneStore';
import { useHeroStore } from '@/store/useHeroStore';

/**
 * Entrance — the opening plate, rendered live.
 *
 * This scene IS the homepage hero now. It used to be a second, redundant
 * staging of a garment that was really being carried by a scrubbed image
 * sequence; the sequence is gone, because scrubbing a frame index against
 * scroll is a step function and step functions shake. See HeroStage for the
 * full account.
 *
 * Three things had to be true before a live scene could take the hero:
 *
 *   1. THE GARMENT IS ALWAYS WHOLE. Framing is solved against the camera's own
 *      frustum every frame, so there is no camera position, aspect ratio or
 *      viewport at which the piece can be cropped. The previous version fixed
 *      the plate at 7.6 world units tall in a frame that is 6.6 units tall at
 *      that depth — it was cut off top and bottom on every screen, which is
 *      exactly the "not fully visible" complaint.
 *   2. THE MOVE IS CONTINUOUS. Everything animated here is a float eased
 *      toward a target on every animation frame. There is no index, no
 *      quantisation, and therefore nothing to snap.
 *   3. THE ROOM IS LIT. A flat near-black field reads as dull whatever the hex
 *      is. The backdrop is a graded, slowly moving room — black at the corners,
 *      a warm brass pool behind the subject — so the ground has light in it.
 */

/** Depth the subject is staged at, in front of the cloth panels. */
const SUBJECT_DEPTH = 6.4;

/**
 * Backdrop cloth, receding behind the subject.
 *
 * These are near the ground value on purpose: what should read is the brass
 * sheen travelling across the weave, not the colour of the cloth. A backdrop
 * that announces itself competes with the piece it exists to set off.
 */
const PANELS = [
  { x:  3.1, y:  0.2, z: -5.4, w: 4.4, h: 7.2, rot: -0.16, color: '#221E1B', sheen: '#A16207', speed: 0.34, weight: 0.62 },
  { x:  6.4, y: -0.5, z: -7.2, w: 3.6, h: 6.2, rot: -0.30, color: '#1B1816', sheen: '#8A5406', speed: 0.28, weight: 0.44 },
  { x: -3.4, y:  1.1, z: -9.0, w: 5.2, h: 6.6, rot:  0.08, color: '#171412', sheen: '#6B420A', speed: 0.22, weight: 0.30 },
];

/** Smootherstep. Zero first AND second derivative at both ends — no visible
 *  kick when the move starts or lands. */
const ease = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
};

/* ────────────────────────────────────────────────────────────────────────
   The room
   ──────────────────────────────────────────────────────────────────────── */

/**
 * A graded backdrop locked to the camera, filling the frame at every moment.
 *
 * This is the answer to "the background colour is dull", and the reason it is
 * a shader rather than a colour value: the complaint was never really about the
 * hex. #1C1917 painted flat across 100vh has no gradient, no falloff and no
 * movement, so there is nothing in it for the eye to travel along and it reads
 * as a grey sheet however warm the colour is. Cinematic grounds are graded —
 * they are dark where nothing is happening and lifted where the subject is.
 *
 * So: near-black at the corners, a warm brass pool sitting behind where the
 * garment is staged, a cool floor lift along the bottom, and a slow drift
 * across the whole thing so it is never quite static. All of it is computed
 * per-pixel in one draw call, which is cheaper than the three extra meshes it
 * replaces.
 */
function Backdrop({ weightRef }: { weightRef: MutableRefObject<number> }) {
  const mesh = useRef<THREE.Mesh>(null);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: false,
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: 0 },
          uProgress: { value: 0 },
          /** Where the pool of light sits, in -1..1 screen space. */
          uFocus: { value: new THREE.Vector2(0.3, 0.02) },
          uGround: { value: new THREE.Color('#0B0908') },
          uWarm: { value: new THREE.Color('#7A4A0C') },
          uFloor: { value: new THREE.Color('#2A2320') },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          precision highp float;
          varying vec2 vUv;
          uniform float uTime;
          uniform float uOpacity;
          uniform float uProgress;
          uniform vec2  uFocus;
          uniform vec3  uGround;
          uniform vec3  uWarm;
          uniform vec3  uFloor;

          // Cheap ordered dither. Banding is the one artefact a large smooth
          // gradient on a dark ground always shows on an 8-bit display, and it
          // is what makes a graded backdrop look like a compression artefact
          // instead of like light.
          float dither(vec2 p) {
            return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
          }

          void main() {
            vec2 p = vUv * 2.0 - 1.0;

            // The pool drifts a little as the hero plays, so the light is
            // never in exactly the same place twice.
            vec2 focus = uFocus + vec2(
              sin(uTime * 0.07) * 0.05 - uProgress * 0.12,
              cos(uTime * 0.05) * 0.03
            );

            float d = length((p - focus) * vec2(0.78, 1.0));

            // Warm pool: strong at the subject, gone well before the corners.
            float pool = smoothstep(1.25, 0.0, d);
            pool = pool * pool * (0.34 + 0.16 * uProgress);

            // Floor lift, so the frame has a ground plane rather than an edge.
            float floorLift = smoothstep(-0.15, -1.0, p.y) * 0.16;

            // Vignette. Slightly elliptical — a circular one reads as a lens
            // effect, an elliptical one reads as a lit room.
            float vig = smoothstep(1.55, 0.35, length(p * vec2(0.82, 1.0)));

            vec3 col = uGround;
            col += uWarm  * pool;
            col += uFloor * floorLift;
            col *= 0.35 + 0.65 * vig;

            col += (dither(gl_FragCoord.xy) - 0.5) * (1.6 / 255.0);

            gl_FragColor = vec4(col, uOpacity);
          }
        `,
      }),
    [],
  );

  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    const u = material.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uOpacity.value = weightRef.current;
    u.uProgress.value = ease(useSceneStore.getState().heroProgress);
  });

  // A full-screen triangle in clip space: the vertex shader ignores the camera
  // entirely, so this can never be out of frame and never needs resizing.
  return (
    <mesh ref={mesh} material={material} frustumCulled={false} renderOrder={-10}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   The subject
   ──────────────────────────────────────────────────────────────────────── */

function GarmentPlate({
  url,
  weightRef,
  budget,
}: {
  url: string;
  weightRef: MutableRefObject<number>;
  budget: TierBudget;
}) {
  /**
   * A texture that is allowed to fail. See `useSafeTexture` — a throwing
   * loader here took the entire site down to an error screen when the image
   * was blocked.
   */
  const texture = useSafeTexture(url);
  const group = useRef<THREE.Group>(null);
  const plate = useRef<THREE.Mesh>(null);
  const haloMesh = useRef<THREE.Mesh>(null);
  const { gl } = useThree();

  const setHeroReady = useSceneStore((s) => s.setHeroReady);

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        toneMapped: true,
      }),
    [],
  );

  useEffect(() => {
    if (!texture) {
      material.map = null;
      material.needsUpdate = true;
      return;
    }
    texture.colorSpace = THREE.SRGBColorSpace;
    // Viewed at an angle as the camera cranes, so anisotropy matters more than
    // raw resolution — without it the weave aliases into moiré.
    texture.anisotropy = Math.min(
      gl.capabilities.getMaxAnisotropy(),
      budget.geometryScale >= 0.7 ? 16 : 4,
    );
    texture.needsUpdate = true;
    material.map = texture;
    material.needsUpdate = true;
  }, [texture, material, budget.geometryScale, gl]);

  /**
   * Tell the DOM the scene has the garment, so the poster can hand over.
   *
   * Two frames after the texture lands, not on mount: the decode being finished
   * is not the same as the frame being on screen, and cross-fading on the
   * decode alone shows a frame of empty canvas on a slow machine. The signal
   * has to mean "it is drawn", not "it is in memory" — and if the image never
   * arrives it must never fire at all, which is what keeps the poster.
   */
  useEffect(() => {
    if (!texture) {
      setHeroReady(false);
      return;
    }
    let raf1 = 0;
    const raf0 = requestAnimationFrame(() => {
      raf1 = requestAnimationFrame(() => setHeroReady(true));
    });
    return () => {
      cancelAnimationFrame(raf0);
      cancelAnimationFrame(raf1);
      setHeroReady(false);
    };
  }, [texture, setHeroReady]);

  // `Texture.image` is typed as `any`/`{}` because it can be an ImageBitmap, a
  // canvas or a video. A portrait default keeps the framing sane in the one
  // frame before the real dimensions are known.
  const img = texture?.image as { width?: number; height?: number } | undefined;
  const aspect = img?.width && img?.height ? img.width / img.height : 0.72;

  /**
   * A soft gold pool immediately behind the garment.
   *
   * Product photography arrives on whatever ground it was shot against, and a
   * hard rectangular edge against a dark room is what makes a staged photo look
   * pasted on. This bleeds past the plate on every side, so the edge falls off
   * into light instead of stopping dead.
   */
  const halo = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(128, 128, 8, 128, 128, 128);
    grad.addColorStop(0, 'rgba(184,116,16,0.62)');
    grad.addColorStop(0.5, 'rgba(122,74,12,0.26)');
    grad.addColorStop(1, 'rgba(218,203,185,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  const haloMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: halo,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [halo],
  );

  useEffect(() => () => { material.dispose(); haloMat.dispose(); halo.dispose(); },
    [material, haloMat, halo]);

  /**
   * Measurement hook, opt-in via `?measure=1` — the same convention CanvasHost
   * uses to publish the renderer.
   *
   * "Is the garment fully in frame?" is the invariant this scene exists to
   * guarantee, and it is the one thing a screenshot cannot answer honestly: the
   * backdrop fills the frame, so pixel analysis cannot tell a subject touching
   * the edge from a room that reaches it. Publishing the computed extents lets
   * `check:hero-matrix` assert the geometry itself, at every viewport, instead
   * of inferring it. Never present on a customer's page.
   */
  const measuring = useRef(false);
  if (typeof window !== 'undefined' && !measuring.current) {
    measuring.current = new URLSearchParams(window.location.search).get('measure') === '1';
  }

  // Scratch vectors, allocated once. Anything created inside useFrame is
  // allocated sixty times a second and collected in bursts, which is a
  // stutter with a completely different cause and an identical symptom.
  const fwd = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const up = useRef(new THREE.Vector3());
  const pos = useRef(new THREE.Vector3());

  useFrame((state) => {
    const cam = state.camera as THREE.PerspectiveCamera;
    const { pointer, heroProgress } = useSceneStore.getState();
    const w = texture ? weightRef.current : 0;
    const p = ease(heroProgress);

    material.opacity = w;
    haloMat.opacity = 0.85 * w;
    if (!texture) return;

    const g = group.current;
    const m = plate.current;
    if (!g || !m) return;

    /**
     * FRAMING, SOLVED AGAINST THE LIVE FRUSTUM — the fix for "not fully
     * visible".
     *
     * The subject is placed relative to the camera rather than pinned to a
     * world coordinate: take the frame the camera actually sees at the staging
     * depth, size the garment as a fraction of it, then position it by that
     * same fraction. Because both the size and the offset are expressed in
     * frame units, there is no aspect ratio, no camera move and no window
     * shape at which the piece can leave the frame or be cut.
     *
     * The push-in is then the FRACTION growing — 0.62 of frame height to 0.97
     * across the pin — not the camera closing distance. That is deliberate: a
     * dolly changes what the camera can see, and on a portrait subject in a
     * landscape frame it runs out of headroom long before the move is over.
     * Growing the subject inside a frame the camera still controls gives the
     * full travel with the crop guaranteed impossible.
     */
    const visH = 2 * SUBJECT_DEPTH * Math.tan((cam.fov * Math.PI) / 360);
    const visW = visH * cam.aspect;

    const wantedFill = 0.62 + 0.35 * p;
    let h = visH * wantedFill;
    let plateW = h * aspect;

    // Width can bind before height on a narrow window, and the garment must
    // stay whole on both axes.
    const maxW = visW * 0.92;
    if (plateW > maxW) {
      plateW = maxW;
      h = plateW / aspect;
    }

    // Half-extents in NDC, measured AFTER the width clamp. Reading the
    // half-height back off `wantedFill` would be wrong on any viewport narrow
    // enough for width to bind — the plate is shorter than asked for there, and
    // the vertical clamp below would reserve margin that no longer exists.
    const halfW = plateW / visW;
    const halfH = h / visH;

    /**
     * Lateral placement. The copy column owns the left of a wide frame, so the
     * subject is staged right of centre and drifts in toward the middle as it
     * grows. On a frame too narrow to hold both — a phone — it centres, and the
     * copy scrim above it does the separating instead.
     */
    const room = Math.max(0, 1 - halfW - 0.03);          // how far it may sit off-centre
    /**
     * Staged right, and it stays right.
     *
     * An earlier pass drifted it toward the centre as it grew (0.34 → 0.20) and
     * at three quarters of the pin its left edge crossed the headline — the
     * word "pieces," disappeared behind the photograph. The growth is the move;
     * the lateral travel was buying nothing and costing the one thing on the
     * page that must never be obstructed.
     *
     * `room` is what makes this safe on every screen without a breakpoint: it
     * is how far off-centre the subject can sit before an edge would leave the
     * frame, so on a phone — where the plate is nearly as wide as the frame —
     * it collapses to almost zero and the subject centres itself.
     */
    const ndcX = Math.min(0.40 - 0.03 * p, room);
    // Vertical headroom, from the real half-height. Both edges stay inside the
    // frame with a margin at every viewport this can be asked to render at.
    const headroom = Math.max(0, 1 - halfH - 0.015);
    const ndcY = Math.max(-headroom, Math.min(0.015 - 0.03 * p, headroom));

    // Camera basis, so the subject is placed in the frame the camera is
    // currently pointing at rather than in world axes it has rotated away from.
    cam.getWorldDirection(fwd.current);
    right.current.set(1, 0, 0).applyQuaternion(cam.quaternion);
    up.current.set(0, 1, 0).applyQuaternion(cam.quaternion);

    pos.current
      .copy(cam.position)
      .addScaledVector(fwd.current, SUBJECT_DEPTH)
      .addScaledVector(right.current, (ndcX * visW) / 2)
      .addScaledVector(up.current, (ndcY * visH) / 2);

    g.position.copy(pos.current);
    g.quaternion.copy(cam.quaternion);

    // Life, not interaction: a small counter-rotation off the pointer and a
    // breath on the vertical. Both are eased floats, so neither can step.
    g.rotateY(pointer.x * 0.055);
    g.rotateX(-pointer.y * 0.028);
    g.translateY(Math.sin(state.clock.elapsedTime * 0.22) * 0.035 * (1 - p * 0.6));

    m.scale.set(plateW, h, 1);
    if (haloMesh.current) haloMesh.current.scale.set(plateW * 2.05, h * 1.5, 1);

    if (measuring.current) {
      // Normalised device coordinates: the frame is -1..1 on both axes, so
      // anything outside that range is off screen and anything at exactly ±1
      // is touching the edge. `fill` is the half-height because the plate is
      // sized as a fraction of the visible height.
      (window as unknown as { __heroFrame?: unknown }).__heroFrame = {
        left: +(ndcX - halfW).toFixed(4),
        right: +(ndcX + halfW).toFixed(4),
        top: +(ndcY + halfH).toFixed(4),
        bottom: +(ndcY - halfH).toFixed(4),
        fill: +halfH.toFixed(3),
        aspect: +cam.aspect.toFixed(3),
      };
    }
  });

  return (
    <group ref={group}>
      <mesh ref={haloMesh} position={[0, 0, -0.35]} material={haloMat}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh ref={plate} material={material}>
        <planeGeometry args={[1, 1]} />
      </mesh>
    </group>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   The scene
   ──────────────────────────────────────────────────────────────────────── */

export default function EntranceScene({
  budget,
  weightRef,
}: {
  budget: TierBudget;
  weightRef: MutableRefObject<number>;
}) {
  const heroImage = useHeroStore((s) => s.heroImage);
  const seg = Math.max(10, Math.round(24 * budget.geometryScale));

  const materials = useMemo(
    () =>
      PANELS.map((p) =>
        createSatinMaterial({
          color: p.color,
          sheenColor: p.sheen,
          roughness: 0.3,
          // The sheen is a band across the weave, not a wash over it. Pushed
          // past ~1 it floods the panel and reads as a lit screen, not cloth.
          sheenStrength: 0.95,
          waveAmp: 0.38,
          waveFreq: 1.3,
          opacity: 0,
        }),
      ),
    [],
  );

  const geometries = useMemo(
    () => PANELS.map((p) => new THREE.PlaneGeometry(p.w, p.h, seg, seg)),
    [seg],
  );

  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const { pointer, heroProgress } = useSceneStore.getState();
    const w = weightRef.current;
    const p = ease(heroProgress);

    for (let i = 0; i < materials.length; i++) {
      const u = materials[i].uniforms;
      u.uTime.value = t * PANELS[i].speed;
      // The room recedes as the subject grows — the panels give up the frame
      // to the garment rather than competing with it at the end of the move.
      u.uOpacity.value = 0.85 * PANELS[i].weight * w * (1 - 0.45 * p);
      materials[i].transparent = true;
      // The key travels across the weave with the pointer — on an anisotropic
      // material this is the interaction that actually reads as fabric.
      u.uLightDir.value.set(-0.5 + pointer.x * 0.4, 0.8 + pointer.y * 0.22, 0.55).normalize();
    }

    if (groupRef.current) {
      // Slow lateral drift across the pin: the room slides behind the subject,
      // which is where the sense of depth comes from now that the subject is
      // framed rather than dollied.
      const targetY = pointer.x * 0.035 + p * 0.16;
      groupRef.current.rotation.y += (targetY - groupRef.current.rotation.y) * 0.02;
      groupRef.current.position.x = -p * 1.6;
      groupRef.current.position.z = p * 2.2;
    }
  });

  return (
    <group>
      <Backdrop weightRef={weightRef} />

      <group ref={groupRef}>
        {PANELS.map((p, i) => (
          <mesh
            key={i}
            geometry={geometries[i]}
            material={materials[i]}
            position={[p.x, p.y, p.z]}
            rotation={[0, p.rot, 0]}
          />
        ))}
      </group>

      {/* No Suspense: nothing here suspends any more. The texture hook resolves
          to null rather than throwing, so the failure path is a scene without a
          subject instead of a page without a site. */}
      {heroImage ? (
        <GarmentPlate url={heroImage} weightRef={weightRef} budget={budget} />
      ) : null}

      {/* A single dramatic key, high and camera-left, so the light rakes across
          the cloth rather than flattening it. The god-ray source in Effects.tsx
          is positioned to agree with this. */}
      <ambientLight intensity={0.34} />
      <directionalLight position={[-3.2, 4.6, 3.0]} intensity={1.6} color="#FFF3DE" />
      {/* Warm bounce from the right, at a fraction of the key — it separates
          the subject's edge from the backdrop without lifting the shadows. */}
      <pointLight position={[6.5, -1.2, 1.5]} intensity={0.62} color="#A16207" />
      {/* A broad, soft wash with a long falloff, filling the space the subject
          does not occupy. No boundary anywhere for the eye to read as a shape,
          which is the difference between a lit dark room and a grey area. */}
      <pointLight position={[-6.0, 0.4, -2.5]} intensity={1.05} distance={26} decay={1.6} color="#8A5A18" />
    </group>
  );
}
