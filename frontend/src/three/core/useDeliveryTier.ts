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

export interface DeliveryState {
  tier: DeliveryTier;
  profile: TierProfile;
  reason: string;
  /** True until the first real measurement lands. */
  provisional: boolean;
}

export function useDeliveryTier(): DeliveryState {
  const [state, setState] = useState<DeliveryState>(() => {
    // SSR and first paint both need a defensible answer before any measurement
    // exists. 'standard' is the honest middle: good enough to look right, cheap
    // enough not to punish a phone if the guess is wrong.
    if (typeof window === 'undefined') {
      return { tier: 'standard', profile: TIER_PROFILES.standard, reason: 'server render', provisional: true };
    }
    const s = readSignals();
    const { tier, reason } = resolveTier(s);
    return { tier, profile: TIER_PROFILES[tier], reason, provisional: true };
  });

  /** The best rung this device may ever reach, set by the opening guess. */
  const ceiling = useRef<DeliveryTier>('maximum');
  const escalations = useRef(0);
  const lastChange = useRef(Date.now());

  // Re-resolve on the client after mount. The server-rendered guess had no
  // access to navigator at all.
  useEffect(() => {
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
    const id = setInterval(() => {
      const { effectsSuspended, tier: quality } = useSceneStore.getState();

      setState((prev) => {
        // The governor stripping effects is the strongest evidence available
        // that this device cannot afford what it was given. It measured the
        // real frame rate; everything else guessed.
        if (effectsSuspended || quality === 'low' || quality === 'off') {
          const down = stepDown(prev.tier);
          if (down === prev.tier) return prev;
          lastChange.current = Date.now();
          return {
            tier: down, profile: TIER_PROFILES[down],
            reason: 'frame rate below floor', provisional: false,
          };
        }

        // Holding steady on a high quality tier, long enough that it is not
        // just a quiet moment — promote.
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
