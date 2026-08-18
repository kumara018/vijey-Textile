'use client';

import { useEffect, useRef, useState } from 'react';
import {
  readSignals, resolveTier, stepDown, stepUp, throughputFrom,
  TIER_PROFILES, TIER_ORDER,
  type DeliveryTier, type TierProfile,
} from './deliveryTier';
import { useSceneStore } from '@/store/useSceneStore';

/**
 * Resolves the delivery tier and keeps revising it for the life of the session.
 *
 * The initial resolution is a guess made from static signals before anything has
 * rendered. What follows is evidence, and evidence outranks the guess in both
 * directions:
 *
 *   DOWN — the frame-rate governor suspended effects, or measured throughput
 *          came in far below what the connection API claimed.
 *   UP   — the poster arrived fast and the scene is holding frame rate, so the
 *          device is more capable than its first second suggested.
 *
 * The upward path is the one that usually gets skipped, and skipping it is how
 * a perfectly capable phone spends an entire session on the bottom rung because
 * it happened to load during a lift ride. A tier is a running estimate, not a
 * verdict passed at page load.
 */

const ESCALATE_AFTER_MS = 6000;   // sustained good behaviour before promoting
const MAX_ESCALATIONS = 2;        // never climb more than two rungs from the guess

/**
 * Offline-render override — `?capture=1`.
 *
 * The ladder exists to protect a customer's device from a cost it cannot pay.
 * The offline renderer is the exact opposite situation: a headless Chrome on a
 * real GPU, with no frame budget and no visitor waiting, whose entire job is to
 * produce the highest-quality frames the scene can express.
 *
 * Without this the renderer inherits whatever rung THIS machine resolves to,
 * and at any rung below `rich` the profile has `realtime: false` — so
 * ThreeProvider returns null, no scene mounts, and the capture records the
 * static poster instead of the scene. That is precisely how a sequence ends up
 * containing a photograph of itself.
 */
const CAPTURE_STATE: DeliveryState = {
  tier: 'maximum',
  profile: TIER_PROFILES.maximum,
  reason: 'offline capture',
  provisional: false,
};

export function isCaptureRender(): boolean {
  return typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('capture') === '1';
}

export interface DeliveryState {
  tier: DeliveryTier;
  profile: TierProfile;
  reason: string;
  /** True until the first real measurement lands. */
  provisional: boolean;
}

export function useDeliveryTier(): DeliveryState {
  /**
   * The opening rung is 'standard' on the server AND on the client's first
   * render — deliberately, and identically.
   *
   * This used to branch on `typeof window`: the server emitted 'standard' and
   * the browser's very first render emitted whatever the device resolved to.
   * That is a hydration mismatch, and React reported it as one — server HTML
   * carrying `/hero/standard/poster.avif` against a client tree wanting
   * `/hero/light/poster.avif`, with the warning that it "won't be patched up".
   *
   * The consequence is worse than a console message. React keeps the SERVER's
   * attributes on a mismatched host node, so the poster could end up pointing
   * at a directory the tier ladder is not loading frames from, and the sequence
   * would scrub against a still from a different rung. It also costs a wasted
   * decode of a poster that is about to be replaced.
   *
   * Hydration's contract is that the first client render reproduces the server
   * exactly; device measurement is by definition not available then. So the
   * guess is made once, in the effect below, which is where it belonged — one
   * render at the honest middle rung, then a single resolved swap. 'standard'
   * is that middle: good enough to look right, cheap enough not to punish a
   * phone if the guess is wrong.
   */
  const [state, setState] = useState<DeliveryState>({
    tier: 'standard',
    profile: TIER_PROFILES.standard,
    reason: 'opening guess',
    provisional: true,
  });

  /** The best rung this device may ever reach, set by the opening guess. */
  const ceiling = useRef<DeliveryTier>('maximum');
  const escalations = useRef(0);
  const lastChange = useRef(Date.now());

  /**
   * State kept so a LATCHED signal is not read as repeating evidence.
   *
   * This is the bug that killed the hero, and it took a live measurement to
   * see. `effectsSuspended` is a one-way latch — the governor sets it once and
   * nothing ever clears it — but the interval below treated it as a fresh
   * observation every 2.5 seconds and stepped the tier down each time. One
   * slow moment therefore did not cost one rung; it walked the device all the
   * way to the floor:
   *
   *     t=3s   rich      canvas yes   20fps
   *     t=6s   maximum   canvas yes   18fps   <- postprocessing too expensive
   *     t=9s   maximum   canvas yes   30fps   <- governor suspends the chain
   *     t=12s  standard  canvas yes   61fps
   *     t=15s  light     canvas NO    60fps   <- realtime gate crossed
   *     t=18s  minimal   canvas NO    60fps   <- hero gone, at a solid 60fps
   *
   * The device was holding 60fps from the moment the chain came off. It kept
   * being demoted for a problem that had already been solved, until the scene
   * was switched off entirely — which is exactly what "the hero disappears
   * halfway down the page" looked like.
   *
   * So: react to the EDGE, not the level. One step per new piece of evidence.
   */
  const sawSuspended = useRef(false);
  const lastQuality = useRef<string | null>(null);
  /** Once a device has needed a demotion, it never climbs again this session. */
  const demoted = useRef(false);

  // Re-resolve on the client after mount. The server-rendered guess had no
  // access to navigator at all.
  useEffect(() => {
    // A capture render is pinned; nothing measured about this machine applies.
    if (isCaptureRender()) { setState(CAPTURE_STATE); return; }
    const s = readSignals();
    const { tier, reason } = resolveTier(s);
    // A device may climb two rungs above its opening guess on evidence, but a
    // Save-Data or 2g signal is a stated constraint and pins the ceiling low.
    const openingIndex = TIER_ORDER.indexOf(tier);
    ceiling.current = s.saveData || s.reducedMotion
      ? tier
      : TIER_ORDER[Math.min(TIER_ORDER.length - 1, openingIndex + MAX_ESCALATIONS)];
    setState({ tier, profile: TIER_PROFILES[tier], reason, provisional: true });
  }, []);

  // ── Measured throughput from the first substantial asset ──────────────
  useEffect(() => {
    if (isCaptureRender()) return;
    if (typeof PerformanceObserver === 'undefined') return;

    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const e = entry as PerformanceResourceTiming;
        // Only hero assets — a 2KB JSON response says nothing about bandwidth.
        if (!/\/hero\//.test(e.name)) continue;
        const mbps = throughputFrom(e);
        if (mbps === null) continue;

        setState((prev) => {
          const s = { ...readSignals(), measuredMbps: mbps };
          const { tier, reason } = resolveTier(s);
          if (tier === prev.tier) return { ...prev, provisional: false };
          // Honour the measurement in whichever direction it points, but never
          // above the ceiling the opening signals established.
          const capped = TIER_ORDER.indexOf(tier) > TIER_ORDER.indexOf(ceiling.current)
            ? ceiling.current
            : tier;
          lastChange.current = Date.now();
          return {
            tier: capped,
            profile: TIER_PROFILES[capped],
            reason: `${reason} (measured ${mbps.toFixed(1)}Mbps)`,
            provisional: false,
          };
        });
        obs.disconnect();
        return;
      }
    });

    try { obs.observe({ type: 'resource', buffered: true }); } catch { /* unsupported */ }
    return () => obs.disconnect();
  }, []);

  // ── The governor as a live signal, in both directions ─────────────────
  useEffect(() => {
    // The governor must never demote a capture render. Offline frames are
    // allowed to take as long as they take — a slow frame here is the cost
    // being paid deliberately, not a symptom to react to.
    if (isCaptureRender()) return;
    const id = setInterval(() => {
      const { effectsSuspended, tier: quality } = useSceneStore.getState();

      /**
       * Each piece of evidence is worth exactly one rung, and only the first
       * time it appears.
       *
       *   - the chain being suspended: one step, on the rising edge
       *   - the governor demoting the quality tier: one step per demotion
       *   - 'off': the device gave up entirely, go to the floor
       *
       * Anything else is the same fact being counted again.
       */
      const suspendedEdge = effectsSuspended && !sawSuspended.current;
      const qualityDropped =
        lastQuality.current !== null &&
        quality !== lastQuality.current &&
        (quality === 'low' || quality === 'off');
      const dead = quality === 'off';

      sawSuspended.current = effectsSuspended;
      lastQuality.current = quality;

      setState((prev) => {
        if (dead && prev.tier !== 'minimal') {
          demoted.current = true;
          lastChange.current = Date.now();
          return {
            tier: 'minimal', profile: TIER_PROFILES.minimal,
            reason: 'renderer gave up', provisional: false,
          };
        }

        if (suspendedEdge || qualityDropped) {
          const down = stepDown(prev.tier);
          demoted.current = true;
          if (down === prev.tier) return prev;
          lastChange.current = Date.now();
          return {
            tier: down, profile: TIER_PROFILES[down],
            reason: suspendedEdge ? 'postprocessing too expensive' : 'frame rate below floor',
            provisional: false,
          };
        }

        // Holding steady on a high quality tier, long enough that it is not
        // just a quiet moment — promote. Never after a demotion: climbing back
        // into a cost this device has already failed to pay is how a hero ends
        // up flickering between present and absent for the whole session.
        if (demoted.current || effectsSuspended) return prev;
        const settled = Date.now() - lastChange.current > ESCALATE_AFTER_MS;
        if (!settled || escalations.current >= MAX_ESCALATIONS) return prev;
        if (quality !== 'high') return prev;

        const up = stepUp(prev.tier, ceiling.current);
        if (up === prev.tier) return prev;
        escalations.current += 1;
        lastChange.current = Date.now();
        return {
          tier: up, profile: TIER_PROFILES[up],
          reason: 'sustained frame rate', provisional: false,
        };
      });
    }, 2500);

    return () => clearInterval(id);
  }, []);

  return state;
}
