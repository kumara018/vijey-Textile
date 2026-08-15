'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSceneStore, effectiveBudget } from '@/store/useSceneStore';
import AmbientField from './scenes/AmbientField';

/**
 * Crossfades between scenes inside the persistent canvas.
 *
 * Route changes drive `scene` in the store; this component eases a 0..1
 * weight and hands it to whichever environment is mounted. Nothing here
 * unmounts the canvas or drops the GL context — that is the entire point of
 * the architecture.
 *
 * Only the AmbientField environment exists so far. It is the shared
 * substrate every Vijey scene sits inside; the per-scene chambers land on
 * top of it in the next phase.
 */
export default function SceneRouter() {
  const scene = useSceneStore((s) => s.scene);
  const tier = useSceneStore((s) => s.tier);

  // Eased transition weight — read by scenes each frame, never via React
  // state, so a transition costs zero re-renders.
  const weight = useRef(0);
  const targetWeight = useRef(1);

  useFrame(() => {
    const t = targetWeight.current;
    weight.current += (t - weight.current) * 0.05;
  });

  const budget = effectiveBudget(tier, scene);

  // 'plain' and 'off' render nothing at all — the policy pages and any
  // device that failed detection get a completely inert canvas rather than
  // an idling render loop burning battery.
  if (tier === 'off' || scene === 'plain') return null;

  return <AmbientField scene={scene} budget={budget} weightRef={weight} />;
}
