'use client';

import { useEffect, useRef, useState } from 'react';
import { useDeliveryTier } from '@/three/core/useDeliveryTier';

/**
 * Scroll-scrubbed image sequence.
 *
 * The camera move was rendered offline at full quality with the whole
 * postprocessing chain open. What ships is a decode, not a render — which
 * moves the cost off the customer's device, where the real-time chain measured
 * 10-14fps on the integrated graphics most of this shop's customers have.
 *
 * Four rules, in priority order:
 *
 *  1. THE FRAME NEVER BREAKS. The container owns its dimensions and clips its
 *     contents, and a solid brand-coloured ground sits underneath everything.
 *     If the poster 404s, if AVIF and WebP both fail, if JS never runs — the
 *     hero is still a deliberate dark frame with the headline legible over it.
 *     A broken-image glyph must never reach a customer.
 *  2. THE POSTER IS THE HERO. A sharp first frame paints immediately from
 *     ordinary markup. Everything after it is addition.
 *  3. SCRUBBING NEVER BLOCKS. Frames decode in the background; the canvas draws
 *     the nearest one it holds.
 *  4. MOTION NEVER GATES AN ACTION. Decoration behind the copy. Product name,
 *     price and the route to buying are DOM above it, from first paint.
 */

export default function SequenceHero({ className = '' }: { className?: string }) {
  const { tier, profile } = useDeliveryTier();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frames = useRef<(ImageBitmap | null)[]>([]);
  const loadedCount = useRef(0);
  const rafPending = useRef(false);
  const currentIndex = useRef(-1);

  const [reduced, setReduced] = useState(false);
  const [ready, setReady] = useState(false);
  /**
   * Set when BOTH the AVIF source and the WebP fallback fail.
   *
   * <picture> falls through from <source> to <img> automatically on a decode
   * failure, but a 404 on the <img> src is terminal — that is what fires this.
   */
  const [posterFailed, setPosterFailed] = useState(false);
  /**
   * Only true once the poster has genuinely decoded.
   *
   * The poster starts INVISIBLE and fades in on load, rather than starting
   * visible and being hidden on error. That inversion is deliberate: inside a
   * <picture>, when the <source> fails the browser does not reliably fire
   * `error` on the <img>, so an onError-only guard still leaves a broken-image
   * glyph painted in the corner — which is exactly the artifact that reached
   * production. Opacity-gated on load, a poster that never arrives is simply
   * never shown, whatever the browser does or does not report.
   */
  const [posterLoaded, setPosterLoaded] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  // A tier change means a different asset directory; give the new poster a
  // fresh chance rather than staying failed because a previous rung 404'd.
  useEffect(() => { setPosterFailed(false); setPosterLoaded(false); }, [tier]);

  /* ── Load the sequence for the active tier ─────────────────────────── */
  useEffect(() => {
    // Reduced motion and the minimal rung both mean: the poster, held. There is
    // no camera move to scrub. Also skip entirely when the poster failed —
    // if the directory 404s the frames in it will too, and firing 120 doomed
    // requests helps nobody.
    if (reduced || profile.frames <= 1 || posterFailed) {
      setReady(false);
      return;
    }

    let cancelled = false;
    const bitmaps: (ImageBitmap | null)[] = new Array(profile.frames).fill(null);
    frames.current = bitmaps;
    loadedCount.current = 0;

    // Interleaved: every other frame, then the gaps. Sequential loading would
    // let an early scroller scrub only the opening of the move; this gives the
    // whole move at half temporal resolution almost immediately.
    const order: number[] = [];
    for (let i = 0; i < profile.frames; i += 2) order.push(i);
    for (let i = 1; i < profile.frames; i += 2) order.push(i);

    const supportsAvif = document.createElement('canvas')
      .toDataURL('image/avif').startsWith('data:image/avif');
    const ext = supportsAvif ? 'avif' : 'webp';

    (async () => {
      const CONCURRENCY = 6;
      let cursor = 0;
      let consecutiveFailures = 0;

      const worker = async () => {
        while (!cancelled && cursor < order.length) {
          const idx = order[cursor++];
          const url = `/hero/${tier}/${String(idx).padStart(4, '0')}.${ext}`;
          try {
            const res = await fetch(url, { cache: 'force-cache' });
            if (!res.ok) {
              // A whole missing tier directory should stop the run, not
              // generate 120 identical 404s in the network panel.
              if (++consecutiveFailures > 4) { cursor = order.length; return; }
              continue;
            }
            consecutiveFailures = 0;
            const blob = await res.blob();
            if (cancelled) return;
            const bmp = await createImageBitmap(blob);
            if (cancelled) { bmp.close(); return; }
            bitmaps[idx] = bmp;
            loadedCount.current++;
            if (loadedCount.current === 1) setReady(true);
          } catch {
            if (++consecutiveFailures > 4) { cursor = order.length; return; }
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
  }, [tier, profile.frames, reduced, posterFailed]);

  /* ── Scrub ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!ready || reduced) return;

    const draw = () => {
      rafPending.current = false;
      const canvas = canvasRef.current;
      const host = canvas?.parentElement;
      if (!canvas || !host) return;

      const rect = host.getBoundingClientRect();
      if (rect.height < 1) return;

      const span = rect.height + window.innerHeight;
      const p = Math.min(1, Math.max(0, (window.innerHeight - rect.top) / span));
      const target = Math.round(p * (frames.current.length - 1));

      let idx = -1;
      for (let d = 0; d < frames.current.length; d++) {
        if (frames.current[target + d]) { idx = target + d; break; }
        if (frames.current[target - d]) { idx = target - d; break; }
      }
      if (idx < 0 || idx === currentIndex.current) return;

      const bmp = frames.current[idx];
      if (!bmp) return;
      currentIndex.current = idx;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      // Cover-fit, preserving aspect. Stretching a garment is the one
      // unforgivable error on a clothing site.
      const scale = Math.max(w / bmp.width, h / bmp.height);
      ctx.drawImage(bmp, (w - bmp.width * scale) / 2, (h - bmp.height * scale) / 2,
        bmp.width * scale, bmp.height * scale);
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
    <div
      aria-hidden="true"
      data-sequence-hero=""
      /**
       * `overflow-hidden` and `inset-0` are load-bearing, not cosmetic. A
       * failed <img> is still a replaced element and will size itself to its
       * alt text — which is how a 404 put "Aari Pattu knots model frock" as
       * loose text above the navigation. Clipping to an absolutely-positioned
       * box means a failure can never escape the frame no matter what the
       * element does internally.
       */
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {/**
        * The ground. Always painted, underneath everything, in the brand's own
        * near-black with a brass wash where the garment is staged. This is what
        * the hero degrades TO — if every image fails, the frame still reads as
        * a deliberate dark composition rather than as an empty box.
        */}
      <div
        className="absolute inset-0 bg-ink"
        style={{
          backgroundImage:
            'radial-gradient(60% 70% at 68% 45%, rgba(161,98,7,0.20) 0%, rgba(161,98,7,0.07) 45%, rgba(28,25,23,0) 78%)',
        }}
      />

      {!posterFailed && (
        <picture>
          <source srcSet={`/hero/${tier}/poster.avif`} type="image/avif" />
          <img
            src={`/hero/${tier}/poster.webp`}
            /**
             * Empty alt, deliberately. This whole container is aria-hidden —
             * the garment's name and price are real DOM above it — so alt text
             * here adds nothing for a screen reader and is precisely what
             * renders as visible broken text when the file 404s.
             */
            alt=""
            fetchPriority="high"
            decoding="async"
            onLoad={() => setPosterLoaded(true)}
            onError={() => setPosterFailed(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-[cubic-bezier(0.22,0.61,0.24,1)] ${
              posterLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </picture>
      )}

      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full transition-opacity duration-700 ease-[cubic-bezier(0.22,0.61,0.24,1)] ${
          ready && !reduced ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}
