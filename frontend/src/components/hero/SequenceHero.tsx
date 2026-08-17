'use client';

import { useEffect, useRef, useState } from 'react';
import { useDeliveryTier } from '@/three/core/useDeliveryTier';
import { useSceneStore } from '@/store/useSceneStore';
import HERO_SCRUB from '@/lib/heroScrub.json';

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
  const hostRef = useRef<HTMLDivElement>(null);
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

  /* ── Scrub + scale, driven from one rAF ───────────────────────────── */
  useEffect(() => {
    if (reduced) return;

    const draw = () => {
      rafPending.current = false;
      const host = hostRef.current;
      if (!host) return;

      /**
       * Progress across the PINNED section, not the document.
       *
       * The hero is now a tall section with a sticky inner frame — the
       * Accenture / NVIDIA pattern — so the move plays while the section is
       * pinned and finishes exactly as it releases. The parent's own box is
       * the range: its top passing 0 is p=0, and its bottom reaching the
       * viewport floor is p=1.
       *
       * (The renderer still CAPTURES the move by stepping document scroll
       * across heroScrub.json's span. That is how the frames were produced;
       * where they are replayed is a layout decision, and pinning is the
       * layout. Frame 0 opens the move and the last frame closes it either
       * way, which is the invariant that actually matters.)
       */
      const section = host.parentElement?.parentElement;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      const p = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;

      /**
       * A SLOW PUSH-IN THAT NEVER GOES BELOW FULL BLEED.
       *
       * This used to run 0.62 -> 1.00. For most of the pin the element was
       * therefore SMALLER than its box, and because it is centred with
       * `transformOrigin: center`, that left the frame floating with visible
       * edges and dark ground beyond them. On a recording it reads as a
       * rectangle that changes size while the headline stays still — which is
       * both the "shape is wrong" and a large part of the "shaking".
       *
       * It also made the shake worse mechanically: at 0.62 the browser is
       * resampling a full-resolution canvas down to 62%, and the resampling
       * grid shifts every time the scale changes by a fraction of a percent.
       * Fine detail — the gold border, the woven motifs — crawls. Near 1.0
       * there is barely any resampling to shift.
       *
       * Accenture, NVIDIA and Deloitte all do the same thing: the media covers
       * the viewport at every moment and the scroll drives a slow zoom INTO it.
       * The move is felt, not watched. 1.00 -> 1.14 across the whole pin is
       * roughly the same rate their heroes use, and because the floor is 1.0
       * there is no scroll position at which an edge can appear.
       */
      const scale = 1 + 0.14 * p;
      host.style.transform = `scale(${scale.toFixed(4)})`;
      // Fully present from the first frame. Fading up from 0.55 was the third
      // thing making the opening look muddy — the darkest part of the sequence
      // was also being shown at just over half strength.
      host.style.opacity = '1';

      const canvas = canvasRef.current;
      if (!canvas || !ready) return;

      const total = frames.current.length;
      if (total === 0) return;
      const target = Math.round(p * (total - 1));

      // Nearest loaded frame, bounded. The old version scanned the entire
      // array on every draw; interleaved loading means the nearest hit is
      // almost always within a few slots.
      let idx = -1;
      for (let d = 0; d < 12; d++) {
        if (frames.current[target + d]) { idx = target + d; break; }
        if (frames.current[target - d]) { idx = target - d; break; }
      }
      if (idx < 0 || idx === currentIndex.current) return;

      const bmp = frames.current[idx];
      if (!bmp) return;
      currentIndex.current = idx;

      // Size the backing store ONCE per viewport, not per scroll tick.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(host.clientWidth * dpr);
      const h = Math.round(host.clientHeight * dpr);
      if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
        canvas.width = w;
        canvas.height = h;
      }

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      // Cover-fit, preserving aspect. Stretching a garment is the one
      // unforgivable error on a clothing site.
      const s = Math.max(canvas.width / bmp.width, canvas.height / bmp.height);
      ctx.drawImage(
        bmp,
        (canvas.width - bmp.width * s) / 2,
        (canvas.height - bmp.height * s) / 2,
        bmp.width * s,
        bmp.height * s,
      );
    };

    /**
     * DRIVEN BY LENIS'S CLOCK, NOT BY NATIVE SCROLL EVENTS.
     *
     * This is the half that actually fixes the stutter. With a smooth-scroll
     * layer running, the browser's `scroll` event and Lenis's interpolated
     * position are two different numbers on the same frame. Reading one while
     * the sticky element is positioned by the other is exactly the
     * disagreement that made the hero judder.
     *
     * Subscribing to the store — which ThreeProvider fills from Lenis's own
     * `scroll` event — means the scrub, the scale and the sticky frame are
     * all resolved from one value, once per frame, in the same order every
     * time. The rAF guard still coalesces, so a burst of events costs one
     * draw.
     *
     * `getBoundingClientRect` remains the geometry source: Lenis drives real
     * scrollTop, so layout is truthful. It is the TIMING that had to be
     * unified, not the measurement.
     */
    draw();
    const unsubscribe = useSceneStore.subscribe(() => {
      if (rafPending.current) return;
      rafPending.current = true;
      requestAnimationFrame(draw);
    });

    const onResize = () => {
      if (rafPending.current) return;
      rafPending.current = true;
      requestAnimationFrame(draw);
    };
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      unsubscribe();
      window.removeEventListener('resize', onResize);
    };
  }, [ready, reduced]);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      data-sequence-hero=""
      // will-change + a transform origin at the centre keep the scale on the
      // compositor. Without will-change the browser promotes the layer on the
      // first scroll tick, which is exactly when the stutter is visible.
      style={{ transformOrigin: 'center center', willChange: 'transform, opacity' }}
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
