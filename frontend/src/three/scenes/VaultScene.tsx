'use client';

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { TierBudget } from '../core/capabilities';
import { useSceneStore } from '@/store/useSceneStore';

/**
 * Vault — cart and wishlist.
 *
 * A steel holding bay: a slow-rotating containment frame, cool and quiet. The
 * emotional register here is "your things are safe and accounted for", which is
 * the opposite of the entrance's warmth — so it drops to steel, loses the
 * satin entirely, and moves at roughly half the speed of the browsing scenes.
 *
 * Cart is also where people count and re-count, so the scene stays
 * deliberately calm: nothing here should compete with a total.
 */
export default function VaultScene({
  budget,
  weightRef,
}: {
  budget: TierBudget;
  weightRef: MutableRefObject<number>;
}) {
  const detail = Math.max(3, Math.round(6 * budget.geometryScale));

  const frameGeo = useMemo(() => new THREE.TorusGeometry(2.9, 0.035, 6, 64), []);
  const barGeo = useMemo(() => new THREE.BoxGeometry(0.05, 5.4, 0.05), []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#A8A29E',
        roughness: 0.35,
        metalness: 0.75,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [],
  );

  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);

  useEffect(() => () => { frameGeo.dispose(); barGeo.dispose(); material.dispose(); },
    [frameGeo, barGeo, material]);

  const bars = useMemo(
    () => Array.from({ length: detail * 2 }, (_, i) => (i / (detail * 2)) * Math.PI * 2),
    [detail],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const { pointer } = useSceneStore.getState();
    material.opacity = 0.34 * weightRef.current;

    // Two nested rings turning on different axes at different rates. The
    // counter-rotation is what makes a simple frame read as a mechanism.
    if (outer.current) {
      outer.current.rotation.y = t * 0.09 + pointer.x * 0.2;
      outer.current.rotation.x = 0.28 + pointer.y * 0.1;
    }
    if (inner.current) {
      inner.current.rotation.y = -t * 0.13;
      inner.current.rotation.z = t * 0.05;
    }
  });

  return (
    <group position={[-0.4, -0.5, -1.5]}>
      <group ref={outer}>
        <mesh geometry={frameGeo} material={material} />
        <mesh geometry={frameGeo} material={material} rotation={[Math.PI / 2, 0, 0]} />
      </group>

      <group ref={inner}>
        {bars.map((a, i) => (
          <mesh
            key={i}
            geometry={barGeo}
            material={material}
            position={[Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2]}
          />
        ))}
      </group>

      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 4, 6]} intensity={0.85} color="#FFF3DE" />
    </group>
  );
}
