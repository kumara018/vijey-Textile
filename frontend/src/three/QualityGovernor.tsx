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
 * Shader compilation, texture upload, font swap and the first route transition
 * all land early and are not representative of steady state.
 *
 * Measured on a real GPU: startup jank alone read as 8fps and permanently
 * suspended the whole postprocessing chain on hardware that then held 60fps
 * for the rest of the session. The governor exists to protect weak devices,
 * not to punish every device for its first two seconds.
 */
const WARMUP_MS = 6000;

export default function QualityGovernor() {
  const deltas = useRef<number[]>([]);
  const windowStart = useRef(0);
  const mountedAt = useRef(0);
  const strikes = useRef(0);

  /**
   * Design-review escape hatch: ?effects=hold keeps the chain open regardless
   * of frame rate.
   *
   * The governor is correct to strip the chain on a slow device, but that makes
   * the cinematography impossible to evaluate on any machine that cannot afford
   * it — the reviewer sees the fallback, judges that, and the actual design is
   * never seen. This holds the full chain so the frame can be looked at, and it
   * is strictly opt-in via the URL: no visitor ever reaches it.
   */
  const hold = useRef(false);
  if (typeof window !== 'undefined' && !hold.current) {
    hold.current = new URLSearchParams(window.location.search).get('effects') === 'hold';
  }

  useFrame((state, delta) => {
    if (hold.current) return;
    const now = state.clock.elapsedTime * 1000;

    if (mountedAt.current === 0) {
      mountedAt.current = now;
      windowStart.current = now;
      return;
    }
    if (now - mountedAt.current < WARMUP_MS) {
      windowStart.current = now;
      deltas.current.length = 0;
      return;
    }

    deltas.current.push(delta * 1000);
    const elapsed = now - windowStart.current;
    if (elapsed < WINDOW_MS) return;

    /**
     * MEDIAN frame time, not mean.
     *
     * A shader compile, a texture upload or a GC pause produces a handful of
     * 300ms frames. Averaged, those drag a comfortable 60fps window down below
     * the floor and cost the device its entire effects chain permanently — the
     * governor only ever steps down. The median ignores them: it answers "what
     * does a typical frame cost here", which is the question that should decide
     * quality, while the mean answers "was anything ever slow", which should
     * not.
     */
    const sorted = deltas.current.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] || 16.7;
    const fps = 1000 / median;
    deltas.current.length = 0;
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

    const { tier, setTier, effectsSuspended, suspendEffects } = useSceneStore.getState();

    /**
     * First downgrade: drop the entire postprocessing chain, keeping the tier.
     *
     * Every pass in that chain costs per-pixel, so its price rises with the
     * square of resolution — on the high-DPI displays this pass targets, the
     * chain is where the frame budget actually goes, not the geometry. Cutting
     * it recovers far more than thinning meshes would, and losing the grade is
     * much less noticeable than watching the scene itself come apart.
     */
    if (!effectsSuspended) {
      console.warn(
        `[3D] ${fps.toFixed(0)}fps sustained — suspending the postprocessing chain (tier stays "${tier}")`,
      );
      suspendEffects();
      return;
    }

    // Only once the chain is already gone do we start giving up geometry.
    const next = NEXT_TIER_DOWN[tier];
    if (!next) return;

    console.warn(
      `[3D] ${fps.toFixed(0)}fps sustained on the "${tier}" tier — dropping to "${next}"`,
    );
    setTier(next);
  });

  return null;
}
