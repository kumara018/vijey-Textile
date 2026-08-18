'use client';

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { TierBudget } from '../core/capabilities';
import { useSceneStore } from '@/store/useSceneStore';

/**
 * Gallery — the product listing.
 *
 * A deep rack of suspended bolt-ends receding into the space, scrolling with
 * the page. The listing grid is dense, real content; the scene behind it stays
 * strictly rhythmic rather than eventful, so it reads as the room the shelves
 * are in and never pulls the eye off a product card.
 *
 * One InstancedMesh for every bolt. A mesh each would be a draw call each, and
 * this scene deliberately carries a lot of them.
 */

const COLUMNS = 7;
const ROWS = 5;

export default function GalleryScene({
  budget,
  weightRef,
}: {
  budget: TierBudget;
  weightRef: MutableRefObject<number>;
}) {
  const count = Math.max(12, Math.round(COLUMNS * ROWS * budget.geometryScale));

  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Layout is generated once. Recomputing it on a tier change would visibly
  // reshuffle the rack under the user.
  const slots = useMemo(() => {
    const arr: { x: number; y: number; z: number; tilt: number; rate: number; scale: number }[] = [];
    for (let i = 0; i < count; i++) {
      const col = i % COLUMNS;
      const row = Math.floor(i / COLUMNS);
      arr.push({
        x: (col - (COLUMNS - 1) / 2) * 2.3 + (row % 2) * 0.55,
        y: 2.6 - row * 1.5,
        z: -3 - row * 1.9,
        tilt: (Math.random() - 0.5) * 0.3,
        rate: 0.35 + Math.random() * 0.5,
        scale: 0.85 + Math.random() * 0.35,
      });
    }
    return arr;
  }, [count]);

  const geometry = useMemo(() => new THREE.BoxGeometry(1.5, 2.1, 0.09), []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#A16207',
        roughness: 0.72,
        metalness: 0.06,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [],
  );

  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;

    const t = state.clock.elapsedTime;
    const { pointer, scroll } = useSceneStore.getState();
    material.opacity = 0.3 * weightRef.current;

    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      // Rows further back move less against the scroll, which is what builds
      // the sense of depth — parallax, not perspective, does that work.
      const depthFactor = 1 - (-s.z / 14);
      dummy.position.set(
        s.x + pointer.x * 0.4 * depthFactor,
        s.y + scroll * 5.5 * depthFactor + Math.sin(t * s.rate + i) * 0.07,
        s.z,
      );
      dummy.rotation.set(0, s.tilt + Math.sin(t * s.rate * 0.5 + i) * 0.05, 0);
      dummy.scale.setScalar(s.scale);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh
        ref={mesh}
        args={[geometry, material, slots.length]}
        frustumCulled={false}
      />
      <ambientLight intensity={0.7} />
      <directionalLight position={[-4, 6, 5]} intensity={0.9} color="#FFF3DE" />
    </group>
  );
}
