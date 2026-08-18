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
  const effectsSuspended = useSceneStore((s) => s.effectsSuspended);
  const reducedMotion = useSceneStore((s) => s.capabilities?.reducedMotion ?? false);
  const budget = effectiveBudget(tier, scene, { effectsSuspended, reducedMotion });

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

  // 'plain' is every route that is not the entrance. Declared here rather
  // than further down because the dissolve rate below reads it.
  const idle = scene === 'plain';

  /**
   * LEAVING IS FAST. ARRIVING IS SLOW.
   *
   * One rate served both directions — 0.055 per frame, roughly 80 frames to
   * fall under 1%, so about a second and a third. That was right while this
   * router cross-faded one scene into another: you want to watch the old room
   * give way.
   *
   * It stopped being right when the scene became the entrance and nothing
   * else. Every navigation is now "scene → nothing", and that second and a
   * third is spent laying a ghost of the entrance over the page somebody just
   * asked for. Arriving keeps the slow reveal, because the entrance is the one
   * place the scene is the point; leaving clears in about a fifth of a second.
   */
  useFrame((_, delta) => {
    // Same frame-rate normalisation as the camera rig: a fixed lerp factor
    // makes the crossfade twice as fast on a 120Hz display.
    const step = Math.min(delta, 0.1) * 60;
    const k = 1 - Math.pow(1 - 0.055, step);
    const kOut = 1 - Math.pow(1 - (idle ? 0.34 : 0.055), step);
    inWeight.current += (1 - inWeight.current) * k;
    outWeight.current += (0 - outWeight.current) * kOut;
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

  const effectsSuspended = useSceneStore((s) => s.effectsSuspended);
  const reducedMotion = useSceneStore((s) => s.capabilities?.reducedMotion ?? false);
  const budget = effectiveBudget(tier, scene, { effectsSuspended, reducedMotion });

  // A device that failed detection gets a completely inert canvas rather than
  // an idling render loop burning battery.
  if (tier === 'off') return null;

  // 'plain' — policy pages, support, and the admin dashboard, which is a work
  // tool someone has open all day — must reach genuinely zero draw calls, not
  // "a cheap scene". The substrate stays mounted only long enough to fade the
  // previous scene out, then stops entirely.
  /**
   * The dust field is off on the ENTRANCE, and dimming it was not enough.
   *
   * It has been raised three times as "dots" that read as printed specks over
   * the photograph rather than as light in the air. I answered twice by
   * lowering opacity — 0.55, then 0.18 — and the specks survived both, because
   * the problem is not their brightness. They are additively blended brass on a
   * near-black ground, so every one of them is a small saturated orange point
   * with no falloff into its surroundings. At any opacity that keeps them
   * visible at all, they are dots.
   *
   * The homepage is also the one route where the frame is mostly empty
   * backdrop, so there is nothing for them to sit against and they read as
   * dirt on the lens.
   *
   * Atmosphere on this route now comes from the soft wash in EntranceScene,
   * which has falloff and therefore no countable elements. Every other scene
   * keeps its field: they are busier frames where the motes read as depth.
   */
  const showAmbient = (!idle || outgoing !== null) && scene !== 'entrance';

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

      {idle ? null : <Effects budget={budget} scene={scene} />}
    </>
  );
}
