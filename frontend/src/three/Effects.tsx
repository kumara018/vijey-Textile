'use client';

import { EffectComposer, Bloom, DepthOfField, N8AO, ChromaticAberration, Vignette, SMAA } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Vector2 } from 'three';
import { useMemo } from 'react';
import type { TierBudget } from './core/capabilities';

/**
 * The postprocessing stack, driven entirely by the tier budget.
 *
 * Every effect here is a full-screen fragment pass — cost scales with pixels,
 * not scene complexity, which is exactly the wrong shape for a mid-range phone.
 * So nothing decides for itself whether to run: the budget decides, and the
 * budget is already capped on checkout and the record pages regardless of how
 * capable the device is.
 *
 * Returning null when postprocessing is off matters. An EffectComposer with an
 * empty pass list still allocates render targets and still costs a full
 * framebuffer copy per frame, so "no effects" has to mean no composer at all.
 */
export default function Effects({ budget }: { budget: TierBudget }) {
  // Recreated only when the offset value actually changes — passing a fresh
  // Vector2 literal every render makes the effect rebuild its uniforms.
  const caOffset = useMemo(() => new Vector2(0.0006, 0.0004), []);

  if (!budget.postprocessing) return null;

  return (
    <EffectComposer
      // The scene is composited over the page, so the composer must not clear
      // to an opaque colour or the DOM behind it disappears.
      enableNormalPass={budget.ssao}
      multisampling={0}
    >
      {/* SMAA rather than MSAA: the composer runs post-resolve, where hardware
          multisampling no longer applies, and SMAA is a single cheap pass. */}
      <SMAA />

      {budget.ssao ? (
        <N8AO
          aoRadius={1.6}
          intensity={2.2}
          distanceFalloff={0.8}
          // Half resolution is invisible on an ambient-occlusion term and
          // roughly quarters its cost.
          halfRes
        />
      ) : <></>}

      {budget.bloom ? (
        <Bloom
          // Above 1.0 so only genuine highlights bloom. Lower and the whole
          // frame hazes over, which reads as a rendering fault rather than
          // light.
          luminanceThreshold={1.05}
          luminanceSmoothing={0.35}
          intensity={0.55}
          mipmapBlur
        />
      ) : <></>}

      {budget.depthOfField ? (
        <DepthOfField
          focusDistance={0.015}
          focalLength={0.045}
          bokehScale={2.4}
        />
      ) : <></>}

      {/* Only `offset` is exposed on this version's prop type — the effect's
          other controls are not surfaced through the React wrapper. */}
      {budget.chromaticAberration ? <ChromaticAberration offset={caOffset} /> : <></>}

      {/* Always on when the composer runs at all: it costs almost nothing and
          it is what stops the scene's edges reading as a pasted-on rectangle
          over the page. */}
      <Vignette offset={0.32} darkness={0.42} blendFunction={BlendFunction.NORMAL} />
    </EffectComposer>
  );
}
