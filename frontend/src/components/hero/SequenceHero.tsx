'use client';

import { useEffect, useRef, useState } from 'react';
import { useDeliveryTier } from '@/three/core/useDeliveryTier';

/**
 * Scroll-scrubbed image sequence.
 *
 * The camera move was rendered offline at full quality with the whole
 * postprocessing chain open — god rays, depth of field, film LUT, grain. What
 * ships is a decode, not a render. That moves the cost off the customer's
 * device, which matters because the real-time chain measured ~10fps on the
 * integrated graphics most of this shop's customers actually have.
 *
 * Three rules hold this together:
 *
 *  1. THE POSTER IS THE HERO. A sharp first frame paints immediately, from
 *     ordinary <img> markup with fetchPriority high. If the sequence never
 *     arrives — slow link, decode failure, JS disabled, an error five levels
 *     up — that frame is still a finished hero. Everything else is addition.
 *
 *  2. SCRUBBING NEVER BLOCKS. Frames decode in the background and the canvas
 *     draws the nearest one it already holds. A visitor who scrolls before
 *     loading finishes sees the move at lower temporal resolution, never a
 *     stall and never a gap.
 *
 *  3. MOTION NEVER GATES AN ACTION. This is a decorative layer behind the copy.
 *     The product name, the price and the route to buying are ordinary DOM
 *     above it, legible and clickable from the first paint.
 */

export default function SequenceHero({
  posterAlt,
  className = '',
}: {
  posterAlt: string;
  className?: string;
}) {
  const { tier, profile } = useDeliveryTier();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frames = useRef<(ImageBitmap | null)[]>([]);
  const loadedCount = useRef(0);
  const rafPending = useRef(false);
  const currentIndex = useRef(-1);

  const [reduced, setReduced] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  /* ── Load the sequence for the active tier ─────────────────────────── */
  useEffect(() => {
    // Reduced motion and the minimal rung both mean: the poster, held. There is
    // no camera move to scrub, so there is nothing to fetch. This is the correct
    // render of the design in that mode, not a degraded one.
    if (reduced || profile.frames <= 1) {
      setReady(false);
      return;
    }

    let cancelled = false;
    const bitmaps: (ImageBitmap | null)[] = new Array(profile.frames).fill(null);
    frames.current = bitmaps;
    loadedCount.current = 0;

    /**
     * Fetch order is interleaved rather than sequential: every other frame
     * first, then the gaps.
     *
     * Loading 0,1,2,3… means a visitor who scrolls early can only scrub the
     * opening of the move. Loading 0,2,4… gives the whole move at half
     * temporal resolution almost immediately, and the second pass fills it in.
     * The move is always complete; only its smoothness improves.
     */
    const order: number[] = [];
    for (let i = 0; i < profile.frames; i += 2) order.push(i);
    for (let i = 1; i < profile.frames; i += 2) order.push(i);

    const supportsAvif = document.createElement('canvas')
      .toDataURL('image/avif').startsWith('data:image/avif');
    const ext = supportsAvif ? 'avif' : 'webp';

    (async () => {
      // A small concurrency window. Firing 120 requests at once on a phone
      // starves the connection and delays the frames actually being looked at.
      const CONCURRENCY = 6;
      let cursor = 0;

      const worker = async () => {
        while (!cancelled && cursor < order.length) {
          const idx = order[cursor++];
          const url = `/hero/${tier}/${String(idx).padStart(4, '0')}.${ext}`;
          try {
            const res = await fetch(url, { cache: 'force-cache' });
            if (!res.ok) continue;
            const blob = await res.blob();
            if (cancelled) return;
            // createImageBitmap decodes off the main thread — decoding 120
            // frames synchronously would jank the very scroll this exists to
            // smooth.
            const bmp = await createImageBitmap(blob);
            if (cancelled) { bmp.close(); return; }
            bitmaps[idx] = bmp;
            loadedCount.current++;
            if (loadedCount.current === 1) setReady(true);
          } catch {
            // A missing frame is survivable: the scrubber falls back to the
            // nearest one it holds. Never surface this to the visitor.
          }
        }
      };

      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    })();

    return () => {
      cancelled = true;
      for (const b of bitmaps) b?.close();
      frames.current = [];
      loadedCount.current = 0;
      currentIndex.current = -1;
      setReady(false);
    };
  }, [tier, profile.frames, reduced]);

  /* ── Scrub ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!ready || reduced) return;

    const draw = () => {
      rafPending.current = false;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const host = canvas.parentElement;
      if (!host) return;

      // Progress across the hero's own height, not the whole page.
      const rect = host.getBoundingClientRect();
      const span = rect.height + window.innerHeight;
      const p = Math.min(1, Math.max(0, (window.innerHeight - rect.top) / span));

      const target = Math.round(p * (frames.current.length - 1));

      // Nearest loaded frame, searching outward. During loading this is what
      // keeps the move continuous instead of gapped.
      let idx = -1;
      for (let d = 0; d < frames.current.length; d++) {
        if (frames.current[target + d]) { idx = target + d; break; }
        if (frames.current[target - d]) { idx = target - d; break; }
      }
      if (idx < 0 || idx === currentIndex.current) return;

      const bmp = frames.current[idx];
      if (!bmp) return;
      currentIndex.current = idx;

      // Match the backing store to the displayed size, capped at 2x — beyond
      // that the extra pixels cost fill rate for nothing visible.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      // Cover-fit, preserving the frame's aspect. Stretching a garment is the
      // one unforgivable error on a clothing site.
      const scale = Math.max(w / bmp.width, h / bmp.height);
      const dw = bmp.width * scale;
      const dh = bmp.height * scale;
      ctx.drawImage(bmp, (w - dw) / 2, (h - dh) / 2, dw, dh);
    };

    const onScroll = () => {
      if (rafPending.current) return;
      rafPending.current = true;
      requestAnimationFrame(draw);
    };

    draw();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [ready, reduced]);

  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {/**
        * The poster. Plain <img>, no JavaScript between it and the screen.
        *
        * It stays mounted underneath the canvas forever rather than being
        * swapped out: the canvas draws over it once frames exist, and if they
        * never do, this is simply what the hero is. Removing it on "ready"
        * would introduce a moment where a failure leaves nothing at all.
        */}
      <picture>
        <source srcSet={`/hero/${tier}/poster.avif`} type="image/avif" />
        <img
          src={`/hero/${tier}/poster.webp`}
          alt={posterAlt}
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-cover"
        />
      </picture>

      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full transition-opacity duration-700 ease-[cubic-bezier(0.22,0.61,0.24,1)] ${
          ready && !reduced ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}
