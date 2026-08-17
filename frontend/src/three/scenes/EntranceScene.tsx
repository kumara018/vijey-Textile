'use client';

import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createSatinMaterial } from '../materials/satin';
import type { TierBudget } from '../core/capabilities';
import { useSceneStore } from '@/store/useSceneStore';
import { useHeroStore } from '@/store/useHeroStore';

/**
 * Entrance — a garment staged in a lit room.
 *
 * The subject is a real product photograph on a plane inside the 3D scene, not
 * laid over it. Cloth panels sit BEHIND it at increasing depth, so the camera
 * dolly produces true parallax between garment and room, the key light throws
 * shafts between the layers, and the grade and grain fall on photograph and
 * render together in one pass. That last part is what stops it reading as a
 * cut-out pasted onto a background.
 *
 * Two hard constraints govern the staging geometry:
 *
 *   1. NOTHING crosses the headline. The copy owns the left of the frame; every
 *      element here lives to the right of STAGE_LEFT and behind the subject. An
 *      earlier version spread translucent panels across the full width and they
 *      cut through the middle of the type, which is the one thing the strongest
 *      asset on the page cannot survive.
 *   2. Gold is the only accent. The cloth is near-black; what makes it read as
 *      fabric is the gold sheen band travelling across the weave, not the
 *      colour of the cloth itself.
 */

/** Everything staged sits right of this world-x. The copy column is clear. */
const STAGE_LEFT = 1.1;

/**
 * Backdrop cloth. Near-black with a gold sheen, receding behind the subject.
 * No panel is nearer than the garment, so none can ever occlude it.
 */
/**
 * Backdrop cloth, deliberately almost invisible.
 *
 * These read as a flat dull rectangle behind the garment when they carried
 * enough value to be seen as objects. A backdrop that announces itself is
 * competing with the piece it exists to set off, and at this scale the eye
 * reads the panel edge as a box rather than as cloth.
 *
 * They now sit within a few points of the ground (#1C1917), so what survives
 * is the brass sheen travelling across them — light on fabric, which is the
 * only part that was ever doing useful work.
 */
const PANELS = [
  { x: 3.1, y:  0.2, z: -5.4, w: 4.4, h: 7.2, rot: -0.16, color: '#1F1C1A', sheen: '#A16207', speed: 0.34, weight: 0.55 },
  { x: 6.4, y: -0.5, z: -7.2, w: 3.6, h: 6.2, rot: -0.30, color: '#1C1917', sheen: '#8A5406', speed: 0.28, weight: 0.38 },
  { x: 1.6, y:  1.1, z: -9.0, w: 5.2, h: 6.6, rot:  0.08, color: '#1A1715', sheen: '#6B420A', speed: 0.22, weight: 0.25 },
];

/** The garment. The one thing in the frame that commands attention. */
function GarmentPlate({
  url,
  weightRef,
  budget,
}: {
  url: string;
  weightRef: MutableRefObject<number>;
  budget: TierBudget;
}) {
  const texture = useLoader(THREE.TextureLoader, url);
  const group = useRef<THREE.Group>(null);
  const { gl } = useThree();

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    // Viewed at an angle as the camera cranes, so anisotropy matters more than
    // raw resolution — without it the weave aliases into moiré.
    texture.anisotropy = Math.min(
      gl.capabilities.getMaxAnisotropy(),
      budget.geometryScale >= 0.7 ? 16 : 4,
    );
    texture.needsUpdate = true;
  }, [texture, budget.geometryScale, gl]);

  const aspect = texture.image ? texture.image.width / texture.image.height : 0.75;
  const height = 7.6;
  const width = height * aspect;

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        toneMapped: true,
      }),
    [texture],
  );

  /**
   * A soft gold pool behind the garment.
   *
   * Product photography arrives on whatever ground it was shot against, and a
   * hard rectangular edge against a dark room is what makes a staged photo look
   * pasted. This sits just behind the plate and bleeds past it, so the edge
   * falls off into light instead of stopping dead.
   */
  const halo = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    grad.addColorStop(0, 'rgba(161,98,7,0.55)');
    grad.addColorStop(0.55, 'rgba(107,66,10,0.22)');
    grad.addColorStop(1, 'rgba(28,25,23,0)');
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

  useFrame((state) => {
    const { pointer } = useSceneStore.getState();
    const w = weightRef.current;
    material.opacity = w;
    haloMat.opacity = 0.9 * w;

    if (!group.current) return;
    // Small counter-rotation only. Enough to separate the garment from the
    // room behind it; nowhere near enough to read as a trick.
    group.current.rotation.y = pointer.x * 0.06;
    group.current.rotation.x = -pointer.y * 0.03;
    group.current.position.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.045;
  });

  return (
    <group ref={group} position={[3.05, 0, -1.6]}>
      <mesh position={[0, 0, -0.6]} material={haloMat}>
        <planeGeometry args={[width * 2.1, height * 1.55]} />
      </mesh>
      <mesh material={material}>
        <planeGeometry args={[width, height]} />
      </mesh>
    </group>
  );
}

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
    const { pointer } = useSceneStore.getState();
    const w = weightRef.current;

    for (let i = 0; i < materials.length; i++) {
      const u = materials[i].uniforms;
      u.uTime.value = t * PANELS[i].speed;
      u.uOpacity.value = 0.82 * PANELS[i].weight * w;
      materials[i].transparent = true;
      // The key travels across the weave with the pointer — on an anisotropic
      // material this is the interaction that actually reads as fabric.
      u.uLightDir.value.set(-0.5 + pointer.x * 0.4, 0.8 + pointer.y * 0.22, 0.55).normalize();
    }

    if (groupRef.current) {
      groupRef.current.rotation.y += (pointer.x * 0.035 - groupRef.current.rotation.y) * 0.02;
    }
  });

  return (
    <group>
      <group ref={groupRef}>
        {PANELS.map((p, i) => (
          <mesh
            key={i}
            geometry={geometries[i]}
            material={materials[i]}
            position={[Math.max(STAGE_LEFT, p.x), p.y, p.z]}
            rotation={[0, p.rot, 0]}
          />
        ))}
      </group>

      {heroImage ? (
        <Suspense fallback={null}>
          <GarmentPlate url={heroImage} weightRef={weightRef} budget={budget} />
        </Suspense>
      ) : null}

      {/* A single dramatic key, high and camera-left, so the light rakes across
          the garment rather than flattening it. The god-ray source in
          Effects.tsx is positioned to agree with this. */}
      <ambientLight intensity={0.32} />
      <directionalLight position={[-3.2, 4.6, 3.0]} intensity={1.6} color="#FFF3DE" />
      {/* Warm bounce from the right, at a fraction of the key — it separates
          the garment's edge from the backdrop without lifting the shadows. */}
      <pointLight position={[6.5, -1.2, 1.5]} intensity={0.62} color="#A16207" />

      {/**
       * A broad, soft wash filling the space the garment does not occupy.
       *
       * Roughly two thirds of this frame is backdrop, and after the panels were
       * pulled back to within a few points of the ground it had NOTHING lighting
       * it — the result read as flat and muddy rather than as a dark room. That
       * was an over-correction on my part: the complaint about the backdrop was
       * that its EDGE read as a dull rectangle, not that the space should be
       * empty. Erasing the panel removed the box and the light together.
       *
       * A point light with a large distance and gentle decay restores the light
       * without restoring the edge. It falls off smoothly to nothing, so there
       * is no boundary anywhere for the eye to read as a shape — which is
       * exactly the difference between "a lit dark room" and "a grey area".
       *
       * Deliberately dim and deliberately warm: it has to lift the ground off
       * black without competing with the key raking across the silk.
       */}
      <pointLight
        position={[-6.0, 0.4, -2.5]}
        intensity={1.05}
        distance={26}
        decay={1.6}
        color="#8A5A18"
      />
    </group>
  );
}
