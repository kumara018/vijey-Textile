'use client';

import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSceneStore, effectiveBudget, isRestrained, type SceneId } from '@/store/useSceneStore';
import AmbientField from './scenes/AmbientField';
import EntranceScene from './scenes/EntranceScene';
import GalleryScene from './scenes/GalleryScene';
import ChamberScene from './scenes/ChamberScene';
import VaultScene from './scenes/VaultScene';
import RestrainedScene from './scenes/RestrainedScene';
import CameraRig from './CameraRig';
import Effects from './Effects';
import QualityGovernor from './QualityGovernor';

/**
 * Crossfades between scenes inside the persistent canvas.
 *
 * The mechanism that matters: both the outgoing and incoming scene are mounted
 * at once, and a 0..1 weight is eased between them every frame. Nothing here
 * unmounts the canvas or drops the GL context — that is the entire point of
 * the architecture — and no transition costs a single React re-render, because
 * the weight lives in a ref that scenes read inside their own useFrame.
 *
 * A scene is only unmounted once its weight has reached zero, so a fast
 * back-and-forth between two routes never pops.
 */

function SceneBody({
  scene,
  weightRef,
}: {
  scene: SceneId;
  weightRef: React.MutableRefObject<number>;
}) {
  const tier = useSceneStore((s) => s.tier);
  const budget = effectiveBudget(tier, scene);

  if (scene === 'plain') return null;

  if (isRestrained(scene)) {
    return <RestrainedScene scene={scene} weightRef={weightRef} />;
  }

  switch (scene) {
    case 'entrance': return <EntranceScene budget={budget} weightRef={weightRef} />;
    case 'gallery':  return <GalleryScene  budget={budget} weightRef={weightRef} />;
    case 'chamber':  return <ChamberScene  budget={budget} weightRef={weightRef} />;
    case 'vault':    return <VaultScene    budget={budget} weightRef={weightRef} />;
    default:         return null;
  }
}

export default function SceneRouter() {
  const scene = useSceneStore((s) => s.scene);
  const tier = useSceneStore((s) => s.tier);

  // The scene currently fading out. Held in state rather than a ref because
  // mounting and unmounting it genuinely is a render-level concern — it is
  // only the per-frame weight that must stay out of React.
  const [outgoing, setOutgoing] = useState<SceneId | null>(null);
  const previous = useRef<SceneId>(scene);

  const inWeight = useRef(0);
  const outWeight = useRef(1);

  useEffect(() => {
    if (previous.current === scene) return;
    setOutgoing(previous.current);
    previous.current = scene;
    inWeight.current = 0;
    outWeight.current = 1;
  }, [scene]);

  useFrame((_, delta) => {
    // Same frame-rate normalisation as the camera rig: a fixed lerp factor
    // makes the crossfade twice as fast on a 120Hz display.
    const k = 1 - Math.pow(1 - 0.055, Math.min(delta, 0.1) * 60);
    inWeight.current += (1 - inWeight.current) * k;
    outWeight.current += (0 - outWeight.current) * k;
  });

  // Drop the outgoing scene once it is genuinely invisible, releasing its
  // geometry and materials. Unmounting it early would cut the fade.
  useEffect(() => {
    if (!outgoing) return;
    const id = setInterval(() => {
      if (outWeight.current < 0.01) {
        setOutgoing(null);
        clearInterval(id);
      }
    }, 120);
    return () => clearInterval(id);
  }, [outgoing]);

  const budget = effectiveBudget(tier, scene);

  // A device that failed detection gets a completely inert canvas rather than
  // an idling render loop burning battery.
  if (tier === 'off') return null;

  // 'plain' — policy pages, support, and the admin dashboard, which is a work
  // tool someone has open all day — must reach genuinely zero draw calls, not
  // "a cheap scene". The substrate stays mounted only long enough to fade the
  // previous scene out, then stops entirely.
  const idle = scene === 'plain';
  const showAmbient = !idle || outgoing !== null;

  return (
    <>
      <CameraRig />
      <QualityGovernor />

      {/* The substrate every scene sits inside — never crossfaded between
          active scenes, so the space itself stays continuous even as its
          contents change. */}
      {showAmbient ? (
        <AmbientField
          scene={idle ? (outgoing ?? scene) : scene}
          budget={budget}
          weightRef={idle ? outWeight : inWeight}
        />
      ) : null}

      <SceneBody scene={scene} weightRef={inWeight} />
      {outgoing ? <SceneBody scene={outgoing} weightRef={outWeight} /> : null}

      {idle ? null : <Effects budget={budget} />}
    </>
  );
}
