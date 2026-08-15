'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSceneStore } from '@/store/useSceneStore';
import type { QualityTier } from './core/capabilities';

/**
 * Adaptive quality: measures real frame rate and tiers down when the device
 * cannot hold it.
 *
 * Static capability detection has a hard limit, and it is easy to demonstrate:
 * a software rasteriser (SwiftShader, llvmpipe, a VM, a browser with the GPU
 * blocklisted) reports WebGL2, plenty of cores and plenty of memory, and only
 * gives itself away through WEBGL_debug_renderer_info — which browsers
 * increasingly withhold for fingerprinting reasons. When that extension is
 * absent, detection has no signal at all and cheerfully assigns the high tier.
 * Measured here in headless Chrome: full postprocessing at ~20fps while the
 * detector reported a capable device.
 *
 * The same gap covers cases no static check could ever catch — a phone
 * thermally throttling after five minutes, a laptop dropping to its integrated
 * GPU on battery, another heavy tab stealing the GPU.
 *
 * So this measures what is actually happening and steps the tier down. It only
 * ever steps down: a governor that also steps up oscillates, and an effect
 * stack that switches on and off every few seconds is far more distracting
 * than one that is simply absent.
 */

const NEXT_TIER_DOWN: Record<QualityTier, QualityTier | null> = {
  high: 'medium',
  medium: 'low',
  low: null,   // the floor — below this the scene is not worth rendering
  off: null,
};

/** Below this sustained frame rate the current tier is not affordable. */
const FLOOR_FPS = 40;
/** Sample window. Long enough that one slow frame cannot trigger a downgrade. */
const WINDOW_MS = 2000;
/** Consecutive bad windows required. Guards against a transient stall. */
const STRIKES = 2;
/**
 * Shader compilation, texture upload and route transition all land in the
 * first seconds and are not representative of steady state.
 */
const WARMUP_MS = 3000;

export default function QualityGovernor() {
  const frames = useRef(0);
  const windowStart = useRef(0);
  const mountedAt = useRef(0);
  const strikes = useRef(0);

  useFrame((state) => {
    const now = state.clock.elapsedTime * 1000;

    if (mountedAt.current === 0) {
      mountedAt.current = now;
      windowStart.current = now;
      return;
    }
    if (now - mountedAt.current < WARMUP_MS) {
      windowStart.current = now;
      frames.current = 0;
      return;
    }

    frames.current++;
    const elapsed = now - windowStart.current;
    if (elapsed < WINDOW_MS) return;

    const fps = (frames.current * 1000) / elapsed;
    frames.current = 0;
    windowStart.current = now;

    if (fps >= FLOOR_FPS) {
      // One good window clears the record — we are only interested in
      // sustained trouble, not a single busy moment.
      strikes.current = 0;
      return;
    }

    strikes.current++;
    if (strikes.current < STRIKES) return;
    strikes.current = 0;

    const { tier, setTier } = useSceneStore.getState();
    const next = NEXT_TIER_DOWN[tier];
    if (!next) return;

    console.warn(
      `[3D] ${fps.toFixed(0)}fps sustained on the "${tier}" tier — dropping to "${next}"`,
    );
    setTier(next);
  });

  return null;
}
