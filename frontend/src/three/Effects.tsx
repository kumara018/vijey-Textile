'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  EffectComposer, Bloom, DepthOfField, N8AO, ChromaticAberration,
  Vignette, SMAA, Noise, GodRays, LUT,
} from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';
import { useLoader } from '@react-three/fiber';
import { LUTCubeLoader } from 'three/examples/jsm/loaders/LUTCubeLoader.js';
import { Vector2, Mesh } from 'three';
import type { TierBudget } from './core/capabilities';
import type { SceneId } from '@/store/useSceneStore';

/**
 * The cinematic chain.
 *
 * Staged the way a product film is staged rather than the way a game is
 * post-processed: one dramatic key, a shallow focus locked to the subject,
 * shafts through the fabric, and a print grade over everything. The reference
 * is hardware-product staging — a single hero object, lit hard, turning slowly,
 * with the background falling away — not a corporate site's editorial grid,
 * which governs the typography here but has nothing to say about the hero.
 *
 * Pass order is not arbitrary. Optical effects that a real lens would produce
 * (DoF, god rays, bloom, aberration) run first, because they describe what
 * reaches the film. Grade and grain run last, because they describe the film
 * itself. Putting the LUT before bloom would grade the scene and then add
 * ungraded light on top, which is exactly how a render ends up looking like
 * two images stacked.
 */

/** Per-scene focus and stage tuning. Defaults are never shipped as-is. */
interface StageTuning {
  focusDistance: number;
  focalLength: number;
  bokehScale: number;
  bloomThreshold: number;
  bloomIntensity: number;
  /** Where the key light sits, for the god-ray source. */
  sun: [number, number, number];
  sunSize: number;
  raysDensity: number;
  raysDecay: number;
  vignette: number;
}

const STAGE: Record<string, StageTuning> = {
  // Homepage: the key sits high and behind the hanging banners so shafts read
  // through the cloth and around its edges. Focus is shallow and sits on the
  // nearest banner, throwing the deeper ones off.
  entrance: {
    focusDistance: 0.010, focalLength: 0.032, bokehScale: 4.5,
    bloomThreshold: 1.02, bloomIntensity: 0.62,
    sun: [-2.6, 4.2, -7.5], sunSize: 0.9,
    raysDensity: 0.94, raysDecay: 0.92,
    vignette: 0.46,
  },
  // Product detail: the tightest focus on the site — this is the shot that has
  // to sell the fabric, so the drape is sharp and everything else goes.
  chamber: {
    focusDistance: 0.006, focalLength: 0.024, bokehScale: 6.0,
    bloomThreshold: 0.96, bloomIntensity: 0.78,
    sun: [3.4, 3.0, -5.2], sunSize: 0.7,
    raysDensity: 0.97, raysDecay: 0.94,
    vignette: 0.52,
  },
  // Listing and cart: graded and grainy like the rest, but no staging — there
  // is no single subject here to focus on or throw light through.
  default: {
    focusDistance: 0.02, focalLength: 0.05, bokehScale: 2.2,
    bloomThreshold: 1.10, bloomIntensity: 0.45,
    sun: [0, 3, -6], sunSize: 0.6,
    raysDensity: 0.9, raysDecay: 0.9,
    vignette: 0.34,
  },
};

/** The god-ray source. Never visible itself — only what it occludes matters. */
function KeyLight({ tuning, onReady }: { tuning: StageTuning; onReady: (m: Mesh | null) => void }) {
  const ref = useRef<Mesh>(null);
  useEffect(() => {
    onReady(ref.current);
    return () => onReady(null);
  }, [onReady]);

  return (
    <mesh ref={ref} position={tuning.sun}>
      <sphereGeometry args={[tuning.sunSize, 20, 20]} />
      {/* Unlit and fog-immune: this is a light *source*, so it must not be
          shaded by the scene it is lighting. */}
      <meshBasicMaterial color="#fff4ea" transparent opacity={0.85} fog={false} />
    </mesh>
  );
}

/**
 * The composer and its passes.
 *
 * Split out so the LUT's useLoader suspends *this* component, letting a single
 * Suspense boundary sit outside the whole composer. Wrapping an individual
 * effect in Suspense instead would put a non-effect node in the composer's
 * child list, which is what it walks to build its pass chain.
 *
 * The LUT is always loaded even when budget.lut is false — hooks cannot be
 * conditional, and it is a 130KB fetch that the browser caches, so the cost of
 * loading it unused is far lower than the cost of a hook-order violation.
 */
function Composer({ budget, tuning, sun }: { budget: TierBudget; tuning: StageTuning; sun: Mesh | null }) {
  const caOffset = useMemo(() => new Vector2(0.0005, 0.0003), []);
  // Authored print emulation: lifted cool toe, filmic S-curve, warm shoulder,
  // chroma falloff at both extremes.
  const lut = useLoader(LUTCubeLoader, '/luts/film-print.cube');
  const wantsRays = budget.godRays && !!sun;

  return (
      <EffectComposer enableNormalPass={budget.ssao} multisampling={0}>
        {/* Post-resolve, so hardware MSAA no longer applies — SMAA is a single
            cheap pass and the only anti-aliasing available at this point. */}
        <SMAA />

        {budget.ssao ? (
          <N8AO aoRadius={1.6} intensity={2.0} distanceFalloff={0.8} halfRes />
        ) : <></>}

        {/* ── Optics: what the lens does ─────────────────────────────── */}
        {wantsRays ? (
          <GodRays
            sun={sun as Mesh}
            density={tuning.raysDensity}
            decay={tuning.raysDecay}
            weight={0.42}
            exposure={0.28}
            samples={48}
            blur
            kernelSize={KernelSize.SMALL}
          />
        ) : <></>}

        {budget.depthOfField ? (
          <DepthOfField
            focusDistance={tuning.focusDistance}
            focalLength={tuning.focalLength}
            bokehScale={tuning.bokehScale}
          />
        ) : <></>}

        {budget.bloom ? (
          <Bloom
            // Above 1.0 so only genuine speculars and the gold accents bleed.
            // Drop this below 1 and the whole frame hazes, which reads as a
            // rendering fault rather than as light.
            luminanceThreshold={tuning.bloomThreshold}
            luminanceSmoothing={0.32}
            intensity={tuning.bloomIntensity}
            mipmapBlur
          />
        ) : <></>}

        {budget.chromaticAberration ? <ChromaticAberration offset={caOffset} /> : <></>}

        {/* ── The film itself: grade, then grain, then the frame edge ─── */}
        {budget.lut ? <LUT lut={lut.texture3D} /> : <></>}

        {budget.grain ? (
          // Low enough to be felt rather than seen. This is the single
          // cheapest thing that stops the image reading as sterile digital.
          <Noise premultiply blendFunction={BlendFunction.OVERLAY} opacity={0.055} />
        ) : <></>}

        <Vignette offset={0.3} darkness={tuning.vignette} blendFunction={BlendFunction.NORMAL} />
      </EffectComposer>
  );
}

export default function Effects({
  budget,
  scene,
}: {
  budget: TierBudget;
  scene: SceneId;
}) {
  const tuning = STAGE[scene] ?? STAGE.default;
  const [sun, setSun] = useState<Mesh | null>(null);

  // No composer at all when the chain is off. An EffectComposer with an empty
  // pass list still allocates render targets and still costs a full-frame copy
  // every frame, so "no effects" has to mean no composer — this is exactly what
  // the governor's first downgrade step relies on.
  if (!budget.postprocessing) return null;

  return (
    <>
      {budget.godRays ? <KeyLight tuning={tuning} onReady={setSun} /> : null}
      {/* Falls back to an ungraded frame for the moment the LUT is in flight,
          rather than blanking the scene. */}
      <Suspense fallback={null}>
        <Composer budget={budget} tuning={tuning} sun={sun} />
      </Suspense>
    </>
  );
}
