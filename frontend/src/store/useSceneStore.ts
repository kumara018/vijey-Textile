'use client';

import { create } from 'zustand';
import type { Capabilities, QualityTier, TierBudget } from '@/three/core/capabilities';
import { TIER_BUDGETS, withoutEffects, forReducedMotion } from '@/three/core/capabilities';

/**
 * Which 3D environment the persistent canvas is currently showing.
 * Routes map onto these — several routes can share one scene.
 */
export type SceneId =
  | 'entrance'   // /
  | 'gallery'    // /products
  | 'chamber'    // /products/[id]
  | 'vault'      // /cart, /wishlist
  | 'terminal'   // /checkout  — restrained tier by design
  | 'records'    // /orders, /account, invoices — restrained
  | 'gate'       // /auth/*
  | 'plain';     // policy pages — canvas idles

export type TransitionPhase = 'idle' | 'exiting' | 'entering';

interface SceneState {
  /** null until detection has run; scenes must not mount before then. */
  capabilities: Capabilities | null;
  tier: QualityTier;
  budget: TierBudget;

  scene: SceneId;
  previousScene: SceneId | null;
  phase: TransitionPhase;

  /** Normalised pointer, -1..1, eased by the canvas each frame. */
  pointer: { x: number; y: number };
  /** 0..1 scroll progress of the active page, fed by Lenis. */
  scroll: number;

  /**
   * 0..1 across the PINNED HERO SECTION, which is not the same number as
   * `scroll` and is the one the opening camera move has to run on.
   *
   * `scroll` is a fraction of the whole document. The homepage is seven
   * movements long, so the hero pin — 190svh of a document several times that
   * — occupies a small slice of it. Driving the entrance camera from `scroll`
   * therefore moved it a few percent of its travel during the entire hero and
   * spent the rest of the range animating behind opaque sections nobody can
   * see through. That is why the opening read as static and why the pinned
   * screen felt like dead space: the move was there, it was just being played
   * against the wrong ruler.
   *
   * This is measured from the hero section's own box — 0 when its top reaches
   * the viewport top, 1 when its bottom reaches the viewport bottom — so the
   * move begins exactly as the pin engages and lands exactly as it releases.
   */
  heroProgress: number;
  setHeroProgress: (v: number) => void;

  /**
   * True once the live scene genuinely has the garment on screen.
   *
   * The hero poster is real DOM painted at first byte, and it must not be
   * taken away on a promise. It is only cross-faded out once the texture has
   * decoded and the scene is drawing it — so the worst case is a customer who
   * keeps a sharp still, never a customer watching an empty dark rectangle
   * while a texture downloads.
   */
  heroReady: boolean;
  setHeroReady: (v: boolean) => void;

  /**
   * Set by the frame-rate governor as its FIRST downgrade step, independently
   * of tier. Postprocessing scales with pixel count rather than scene
   * complexity, so on a high-DPI display it is where the frame budget actually
   * goes — surrendering the grade buys more than thinning geometry, and is far
   * less visible than watching the scene lose detail.
   */
  effectsSuspended: boolean;
  suspendEffects: () => void;

  setCapabilities: (c: Capabilities) => void;
  /** Manual override, e.g. a "reduce effects" control in settings. */
  setTier: (t: QualityTier) => void;
  goToScene: (s: SceneId) => void;
  setPhase: (p: TransitionPhase) => void;
  setPointer: (x: number, y: number) => void;
  setScroll: (v: number) => void;
}

export const useSceneStore = create<SceneState>((set, get) => ({
  capabilities: null,
  tier: 'off',
  budget: TIER_BUDGETS.off,

  scene: 'plain',
  previousScene: null,
  phase: 'idle',

  pointer: { x: 0, y: 0 },
  scroll: 0,
  heroProgress: 0,
  heroReady: false,
  effectsSuspended: false,

  suspendEffects: () => set({ effectsSuspended: true }),

  setCapabilities: (c) =>
    set({ capabilities: c, tier: c.tier, budget: TIER_BUDGETS[c.tier] }),

  setTier: (t) => set({ tier: t, budget: TIER_BUDGETS[t] }),

  goToScene: (s) => {
    const { scene } = get();
    if (s === scene) return;
    set({ previousScene: scene, scene: s });
  },

  setPhase: (p) => set({ phase: p }),

  // Mutating in place would break Zustand's change detection, but these two
  // are written every frame — allocating a fresh object each time is the
  // cost of correctness here, and it's small.
  setPointer: (x, y) => set({ pointer: { x, y } }),
  setScroll: (v) => set({ scroll: v }),

  // Written on every scroll frame, so it is guarded: a store write notifies
  // every subscriber, and republishing a value that has not meaningfully
  // changed wakes the whole tree for nothing.
  setHeroProgress: (v) => {
    if (Math.abs(get().heroProgress - v) < 0.0004) return;
    set({ heroProgress: v });
  },
  setHeroReady: (v) => {
    if (get().heroReady === v) return;
    set({ heroReady: v });
  },
}));

/** Route → scene. Kept beside the store so both stay in sync. */
export function sceneForPath(pathname: string): SceneId {
  if (pathname === '/') return 'entrance';
  if (pathname.startsWith('/products/')) return 'chamber';
  if (pathname.startsWith('/products')) return 'gallery';
  if (pathname.startsWith('/cart') || pathname.startsWith('/wishlist')) return 'vault';
  if (pathname.startsWith('/checkout')) return 'terminal';
  if (
    pathname.startsWith('/orders') ||
    pathname.startsWith('/account') ||
    pathname.startsWith('/returns')
  ) return 'records';
  if (pathname.startsWith('/auth')) return 'gate';
  return 'plain';
}

/**
 * Scenes where the effects budget is capped regardless of device tier.
 * Checkout and the record pages are transactional: every frame of latency
 * on a payment step costs real orders, so they never get the full stack
 * even on a machine that could render it.
 */
const RESTRAINED: ReadonlySet<SceneId> = new Set<SceneId>(['terminal', 'records', 'gate', 'plain']);

export function isRestrained(scene: SceneId): boolean {
  return RESTRAINED.has(scene);
}

/**
 * Scenes that carry the full cinematic chain.
 *
 * God rays and the shallow depth-of-field only make sense where there is a
 * single staged subject to throw light through and focus on. Everywhere else
 * they would be atmosphere applied to nothing in particular, at full
 * full-screen cost.
 */
const HERO: ReadonlySet<SceneId> = new Set<SceneId>(['entrance', 'chamber']);

export function isHero(scene: SceneId): boolean {
  return HERO.has(scene);
}

/**
 * Effective budget for the active scene.
 *
 * Order matters: restraint cap, then hero gating, then the governor's
 * suspension, then reduced motion. The governor's decision must survive
 * everything below it — it exists because the device has already been measured
 * failing, so no per-scene rule may re-enable what it turned off.
 */
export function effectiveBudget(
  tier: QualityTier,
  scene: SceneId,
  opts: { effectsSuspended?: boolean; reducedMotion?: boolean } = {},
): TierBudget {
  let b = TIER_BUDGETS[tier];

  if (isRestrained(scene)) {
    b = {
      ...b,
      postprocessing: false,
      bloom: false,
      depthOfField: false,
      ssao: false,
      chromaticAberration: false,
      godRays: false,
      lut: false,
      grain: false,
      physics: false,
      shadows: false,
      particles: 0,
      geometryScale: Math.min(b.geometryScale, 0.5),
    };
  } else if (!isHero(scene)) {
    // Listing and cart keep the grade and the grain — the things that make the
    // whole site look like one film — but lose the staging passes.
    b = { ...b, godRays: false, depthOfField: false, ssao: false };
  }

  if (opts.effectsSuspended) b = withoutEffects(b);
  if (opts.reducedMotion) b = forReducedMotion(b);
  return b;
}
