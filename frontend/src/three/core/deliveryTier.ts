/**
 * Adaptive delivery tier.
 *
 * There is no fixed payload ceiling. A flagship phone on 5G should get the site
 * at its absolute best; a mid-range Android on a congested 4G cell should get
 * the same design, the same brass palette and the same choreography rendered
 * more cheaply. Never a different site, never a visibly degraded one — a
 * lighter print of the same film.
 *
 * The important insight, and the reason this is not just a bandwidth check:
 * **bandwidth is rarely the binding constraint — GPU and memory are.** A
 * mid-range Android on perfect 5G still cannot composite what a desktop
 * composites. So the decision reads four independent signals:
 *
 *   1. connection    — effectiveType, downlink, saveData
 *   2. memory/cores  — deviceMemory, hardwareConcurrency
 *   3. measured throughput of the first real asset we fetch
 *   4. the live frame-rate governor, which is the only signal that reflects
 *      what this device is actually managing right now
 *
 * Signals 1–3 are guesses made before anything has rendered. Signal 4 is
 * evidence. So the initial tier is a starting position, not a verdict, and the
 * ladder moves in BOTH directions: a device that looked slow for its first
 * second is re-promoted once it proves otherwise. Locking someone to the
 * bottom rung because of one congested moment is the failure mode this exists
 * to avoid.
 */

export type DeliveryTier = 'minimal' | 'light' | 'standard' | 'rich' | 'maximum';

/** Ordered worst → best, so a tier can be stepped by index. */
export const TIER_ORDER: DeliveryTier[] = ['minimal', 'light', 'standard', 'rich', 'maximum'];

export interface TierProfile {
  tier: DeliveryTier;
  /** Frames in the hero sequence. 1 means the static plate only. */
  frames: number;
  /** Widest frame variant to request, in CSS pixels. */
  width: number;
  /** Encoder quality for this rung, 0-100. */
  quality: number;
  /** Layer the real-time WebGL chain on top of the sequence. */
  realtime: boolean;
  /** Ambient audio offered (still muted by default, still opt-in). */
  audio: boolean;
}

/**
 * The ladder.
 *
 * `maximum` deliberately has no cap — it is the site at its best and is meant
 * to be genuinely expensive. Every rung below it is the same choreography with
 * fewer samples of it, which is why the frame counts step rather than the
 * design changing.
 */
export const TIER_PROFILES: Record<DeliveryTier, TierProfile> = {
  // No sequence at all: the static first frame IS the hero. Chosen for
  // save-data, 2g, or a device that has already proven it cannot cope.
  minimal:  { tier: 'minimal',  frames: 1,   width: 960,  quality: 58, realtime: false, audio: false },
  light:    { tier: 'light',    frames: 24,  width: 1280, quality: 60, realtime: false, audio: false },
  standard: { tier: 'standard', frames: 48,  width: 1600, quality: 66, realtime: false, audio: true  },
  rich:     { tier: 'rich',     frames: 72,  width: 2048, quality: 72, realtime: true,  audio: true  },
  maximum:  { tier: 'maximum',  frames: 120, width: 3840, quality: 82, realtime: true,  audio: true  },
};

interface NetworkInformation {
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  downlink?: number;      // Mbit/s
  saveData?: boolean;
  addEventListener?: (t: string, fn: () => void) => void;
  removeEventListener?: (t: string, fn: () => void) => void;
}

function connection(): NetworkInformation | null {
  if (typeof navigator === 'undefined') return null;
  const n = navigator as Navigator & {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  };
  return n.connection ?? n.mozConnection ?? n.webkitConnection ?? null;
}

export interface TierSignals {
  saveData: boolean;
  effectiveType: string | null;
  downlinkMbps: number | null;
  deviceMemoryGb: number | null;
  cores: number | null;
  /** Measured on the first real asset, once one has been fetched. */
  measuredMbps: number | null;
  reducedMotion: boolean;
  smallViewport: boolean;
}

export function readSignals(): TierSignals {
  const c = connection();
  const nav = typeof navigator !== 'undefined'
    ? (navigator as Navigator & { deviceMemory?: number })
    : null;

  return {
    saveData: !!c?.saveData,
    effectiveType: c?.effectiveType ?? null,
    downlinkMbps: typeof c?.downlink === 'number' ? c.downlink : null,
    deviceMemoryGb: typeof nav?.deviceMemory === 'number' ? nav.deviceMemory : null,
    cores: typeof nav?.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
    measuredMbps: null,
    reducedMotion:
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    smallViewport:
      typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches,
  };
}

/**
 * Resolve a starting tier from the pre-render signals.
 *
 * Deliberately asymmetric: a single decisive negative (Save-Data, 2g, 2GB RAM)
 * drops hard, because those are reliable. Promotion to the top requires several
 * positives at once, because none of them individually proves a capable GPU —
 * the thing that actually decides whether the top rung is renderable.
 */
export function resolveTier(s: TierSignals): { tier: DeliveryTier; reason: string } {
  // An explicit user preference for less data outranks every capability signal
  // on the device. It is a stated choice, not a measurement.
  if (s.saveData) return { tier: 'minimal', reason: 'Save-Data requested' };

  if (s.effectiveType === 'slow-2g' || s.effectiveType === '2g') {
    return { tier: 'minimal', reason: `connection ${s.effectiveType}` };
  }

  // Reduced motion does not need a long sequence — there is no camera move to
  // scrub. It gets the sharp static plate, which is the correct render of the
  // design in that mode rather than a downgrade of it.
  if (s.reducedMotion) return { tier: 'minimal', reason: 'prefers-reduced-motion' };

  if (s.deviceMemoryGb !== null && s.deviceMemoryGb <= 2) {
    return { tier: 'light', reason: `${s.deviceMemoryGb}GB memory` };
  }
  if (s.cores !== null && s.cores <= 2) {
    return { tier: 'light', reason: `${s.cores} cores` };
  }
  if (s.effectiveType === '3g') return { tier: 'light', reason: 'connection 3g' };

  const throughput = s.measuredMbps ?? s.downlinkMbps;
  if (throughput !== null && throughput < 2) {
    return { tier: 'light', reason: `${throughput.toFixed(1)}Mbps` };
  }

  // Phones get one rung below their apparent capability regardless of network.
  // A flagship handset has the bandwidth for the top rung and neither the
  // sustained GPU headroom nor the thermal budget to composite it — the frame
  // rate collapses two minutes in, which is worse than never offering it.
  if (s.smallViewport) {
    const strong = (s.deviceMemoryGb ?? 0) >= 6 && (s.cores ?? 0) >= 6;
    return {
      tier: strong ? 'standard' : 'light',
      reason: strong ? 'capable handset' : 'handset',
    };
  }

  const mem = s.deviceMemoryGb ?? 4;
  const cores = s.cores ?? 4;

  if (mem >= 8 && cores >= 8 && (throughput === null || throughput >= 10)) {
    return { tier: 'maximum', reason: `${mem}GB / ${cores} cores / fast link` };
  }
  if (mem >= 8 && cores >= 6) return { tier: 'rich', reason: `${mem}GB / ${cores} cores` };
  if (mem >= 4 && cores >= 4) return { tier: 'standard', reason: `${mem}GB / ${cores} cores` };
  return { tier: 'light', reason: 'conservative default' };
}

/** One rung down, floored at minimal. */
export function stepDown(t: DeliveryTier): DeliveryTier {
  return TIER_ORDER[Math.max(0, TIER_ORDER.indexOf(t) - 1)];
}

/** One rung up, capped at the starting tier's ceiling. */
export function stepUp(t: DeliveryTier, ceiling: DeliveryTier): DeliveryTier {
  const next = TIER_ORDER[Math.min(TIER_ORDER.length - 1, TIER_ORDER.indexOf(t) + 1)];
  return TIER_ORDER.indexOf(next) > TIER_ORDER.indexOf(ceiling) ? ceiling : next;
}

/**
 * Measure throughput from a Resource Timing entry.
 *
 * `transferSize` is 0 for a cached or CORS-opaque response — reporting that as
 * infinite bandwidth would promote a device on no evidence at all, so those are
 * skipped rather than counted.
 */
export function throughputFrom(entry: PerformanceResourceTiming): number | null {
  const bytes = entry.transferSize;
  if (!bytes || bytes < 8_000) return null;           // too small to be meaningful
  const seconds = (entry.responseEnd - entry.startTime) / 1000;
  if (seconds <= 0.01) return null;                   // sub-10ms: almost certainly cache
  return (bytes * 8) / seconds / 1_000_000;
}
