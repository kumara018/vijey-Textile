'use client';

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createSatinMaterial } from '../materials/satin';
import type { TierBudget } from '../core/capabilities';
import { useSceneStore } from '@/store/useSceneStore';

/**
 * Entrance — the homepage.
 *
 * Three satin banners hanging at different depths, drifting in still air. The
 * brief is a "product laboratory", and this is its atrium: the material the
 * shop actually sells, presented as the first thing in the space rather than a
 * decorative abstraction that could belong to any site.
 *
 * Everything is behind the copy and deliberately low-contrast. This layer never
 * competes with the headline — the headline has to stay readable at WCAG AA,
 * and a busy backdrop is how 3D sites quietly fail that.
 */

const BANNERS = [
  { x: -3.1, y:  0.35, z: -3.4, w: 2.7, h: 4.3, rot:  0.20, color: '#8f1b3e', sheen: '#f0b9cb', speed: 0.55 },
  { x:  3.35, y: -0.25, z: -4.6, w: 3.0, h: 4.8, rot: -0.26, color: '#631730', sheen: '#d98fa8', speed: 0.42 },
  { x:  0.15, y:  0.9,  z: -6.6, w: 3.6, h: 5.2, rot:  0.06, color: '#431423', sheen: '#b4708a', speed: 0.33 },
];

export default function EntranceScene({
  budget,
  weightRef,
}: {
  budget: TierBudget;
  weightRef: MutableRefObject<number>;
}) {
  // Tessellation follows the budget: the drape is a vertex displacement, so
  // segment count is exactly where a weak GPU should lose detail. Below ~10
  // segments the wave visibly facets, so that is the floor.
  const seg = Math.max(10, Math.round(26 * budget.geometryScale));

  const materials = useMemo(
    () =>
      BANNERS.map((b) =>
        createSatinMaterial({
          color: b.color,
          sheenColor: b.sheen,
          roughness: 0.3,
          sheenStrength: 0.9,
          waveAmp: 0.34,
          waveFreq: 1.4,
          opacity: 0,
        }),
      ),
    [],
  );

  const geometries = useMemo(
    () => BANNERS.map((b) => new THREE.PlaneGeometry(b.w, b.h, seg, seg)),
    [seg],
  );

  const groupRef = useRef<THREE.Group>(null);

  // Geometry is rebuilt when the tier changes and the materials live for the
  // life of the scene — neither is garbage collected on its own.
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const { pointer } = useSceneStore.getState();
    const w = weightRef.current;

    for (let i = 0; i < materials.length; i++) {
      const u = materials[i].uniforms;
      u.uTime.value = t * BANNERS[i].speed;
      // Opacity carries the scene crossfade. Capped well below 1 so the
      // banners stay a backdrop — this is the value that protects text
      // contrast, so it is deliberately conservative.
      u.uOpacity.value = 0.62 * w;
      materials[i].transparent = true;
    }

    if (groupRef.current) {
      // The whole group counter-rotates very slightly against the pointer,
      // which reads as parallax depth between the banners rather than as the
      // banners themselves moving.
      groupRef.current.rotation.y += (pointer.x * 0.06 - groupRef.current.rotation.y) * 0.02;
      groupRef.current.rotation.x += (-pointer.y * 0.035 - groupRef.current.rotation.x) * 0.02;
    }
  });

  return (
    <group ref={groupRef}>
      {BANNERS.map((b, i) => (
        <mesh
          key={i}
          geometry={geometries[i]}
          material={materials[i]}
          position={[b.x, b.y, b.z]}
          rotation={[0, b.rot, 0]}
        />
      ))}
      {/* A single key light. The satin shader does its own lighting maths, so
          these exist for anything standard-material that joins the scene
          later — Spline content in particular arrives with PBR materials. */}
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 5, 4]} intensity={1.1} color="#ffe8ef" />
    </group>
  );
}
