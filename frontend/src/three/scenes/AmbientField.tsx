'use client';

import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { TierBudget } from '../core/capabilities';
import type { SceneId } from '@/store/useSceneStore';
import { useSceneStore } from '@/store/useSceneStore';

/**
 * The shared substrate every Vijey scene sits inside — the "laboratory air".
 *
 * A GPU-instanced particle field on a slow drift, tinted per scene so each
 * route reads as a different bay of the same facility rather than a
 * different website. Deliberately restrained: this is the layer that is
 * always on, so it has to be cheap enough to run behind checkout.
 *
 * Instanced on purpose — one draw call for the whole field regardless of
 * count. A mesh per particle would be hundreds of draw calls and would show
 * up immediately on mid-range Android.
 */

/**
 * Per-scene identity within one continuous world.
 *
 * These were the last holdout of the old wine-and-steel palette — `#b42251`
 * put crimson dust through the hero, which is off-spec against a system whose
 * only accent is muted gold. It was invisible in code review and obvious the
 * moment a rendered frame was opened and looked at.
 *
 * The range now runs along ONE axis: brass at the top for the scenes that
 * should feel lit, warm stone neutrals for the working screens. Warm, not
 * cool — a steel grey reads as a different palette next to #1C1917, because
 * it is one.
 */
const SCENE_TINT: Record<SceneId, THREE.ColorRepresentation> = {
  entrance: '#A16207',  // brass — the one accent
  gallery:  '#8A5406',  // brass, stepped back
  chamber:  '#C4841A',  // brass bright — product focus
  vault:    '#A8A29E',  // warm stone
  terminal: '#78716C',  // deeper stone — transactional, calm
  records:  '#78716C',
  gate:     '#6B420A',  // brass dim
  plain:    '#57534E',  // the admin's ground: quietest of all
};

export default function AmbientField({
  scene,
  budget,
  weightRef,
}: {
  scene: SceneId;
  budget: TierBudget;
  weightRef: MutableRefObject<number>;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Particle count comes from the tier budget. When the budget is 0 (low tier
  // or a restrained scene) we still render a minimal field so the space isn't
  // empty — just far fewer motes.
  const count = Math.max(24, budget.particles);

  // Positions are generated once and never regenerated: recreating this array
  // on a tier change would visibly reshuffle the field.
  const seeds = useMemo(() => {
    const arr = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      arr[i * 4 + 0] = (Math.random() - 0.5) * 22;      // x
      arr[i * 4 + 1] = (Math.random() - 0.5) * 14;      // y
      arr[i * 4 + 2] = (Math.random() - 0.5) * 12 - 4;  // z, biased behind
      arr[i * 4 + 3] = 0.4 + Math.random() * 0.9;       // drift rate
    }
    return arr;
  }, [count]);

  const color = useMemo(() => new THREE.Color(SCENE_TINT[scene]), [scene]);
  const activeColor = useRef(new THREE.Color(SCENE_TINT[scene]));

  const geometry = useMemo(() => new THREE.SphereGeometry(0.035, 6, 6), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;

    const t = state.clock.elapsedTime;
    const { pointer, scroll } = useSceneStore.getState();

    // Scene tint eases rather than cuts, so a route change reads as moving
    // through the same space into different lighting.
    activeColor.current.lerp(color, 0.02);
    material.color.copy(activeColor.current);
    material.opacity = 0.55 * weightRef.current;

    for (let i = 0; i < count; i++) {
      const x = seeds[i * 4 + 0];
      const y = seeds[i * 4 + 1];
      const z = seeds[i * 4 + 2];
      const rate = seeds[i * 4 + 3];

      // Slow vertical drift that wraps, plus a small parallax response to
      // pointer and scroll so the field feels attached to the viewport
      // rather than painted on it.
      const drift = ((y + t * rate * 0.35) % 14) - 7;
      dummy.position.set(
        x + pointer.x * 0.55 * rate,
        drift - scroll * 2.2,
        z + pointer.y * 0.3 * rate,
      );
      const s = 0.6 + Math.sin(t * rate + i) * 0.25;
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, count]}
      frustumCulled={false}
    />
  );
}
