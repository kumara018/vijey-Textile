'use client';

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneId } from '@/store/useSceneStore';

/**
 * The scene for every page where 3D must get out of the way: checkout, orders,
 * invoices, returns, account, auth.
 *
 * These are the pages people use when they are spending money or when
 * something has gone wrong, and they are frequently read under stress on a
 * phone. So this is not the full scene turned down — it is a different, much
 * quieter thing: a slow horizon line and a faint grid, no particles, no
 * postprocessing, no physics, nothing that moves fast enough to catch the eye
 * while someone is typing a card number.
 *
 * It still renders, because a canvas that blanks between routes is more
 * jarring than one that stays continuous. It just has almost nothing to say.
 */

const TINT: Partial<Record<SceneId, string>> = {
  terminal: '#6f767b',
  records:  '#6f767b',
  gate:     '#871c3f',
};

export default function RestrainedScene({
  scene,
  weightRef,
}: {
  scene: SceneId;
  weightRef: MutableRefObject<number>;
}) {
  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color(TINT[scene] ?? '#6f767b'),
        transparent: true,
        opacity: 0,
      }),
    [scene],
  );

  // A flat grid on the floor plane. Lines rather than a mesh: no fill, no
  // overdraw, and it cannot possibly interfere with text contrast.
  const geometry = useMemo(() => {
    const pts: number[] = [];
    const span = 16;
    const step = 1.6;
    for (let i = -span; i <= span; i += step) {
      pts.push(-span, 0, i,  span, 0, i);
      pts.push(i, 0, -span,  i, 0, span);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  const group = useRef<THREE.Group>(null);

  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

  useFrame((state) => {
    // Very low ceiling, and no pointer response at all — the grid must not
    // track the cursor while a form is being filled in.
    material.opacity = 0.13 * weightRef.current;
    if (group.current) {
      group.current.position.z = ((state.clock.elapsedTime * 0.12) % 1.6) - 0.8;
    }
  });

  return (
    <group ref={group} position={[0, -3.4, 0]} rotation={[0.02, 0, 0]}>
      <lineSegments geometry={geometry} material={material} />
    </group>
  );
}
