'use client';

import { useEffect, useRef, useState } from 'react';
import { useDeliveryTier } from '@/three/core/useDeliveryTier';
import { useSceneStore } from '@/store/useSceneStore';

/**
 * The opening plate.
 *
 * This replaces the scroll-scrubbed image sequence, and the reason is the whole
 * point of the component.
 *
 * WHAT WAS WRONG. The hero decoded a 120-frame render of a camera move and drew
 * frame `round(p * 119)` for scroll progress p. That is a STEP FUNCTION. Each
 * frame owns roughly 0.8% of the pin, so the picture holds perfectly still,
 * then jumps to the next frame, then holds — and because consecutive frames of
 * a dolly differ by several pixels everywhere, every jump moves the entire
 * image at once. Against a headline that is nailed to the DOM and moves
 * smoothly, the eye reads that as the photograph shaking. Two frames of the
 * customer's screen recording a third of a second apart showed exactly this:
 * the garment displaced, the type untouched.
 *
 * It is not a rendering fault, a colour fault or a scale fault, and I spent two
 * full re-render cycles on those before measuring it properly. No amount of
 * re-rendering fixes a step function. The cures are: many times more frames
 * (hundreds of megabytes, and still stepped), cross-fade every adjacent pair
 * (two decodes and a composite per frame, on a phone), or stop stepping.
 *
 * WHAT IT IS NOW. Stop stepping. The camera move is rendered live in WebGL,
 * which draws on every animation frame from a continuous float — so there is no
 * frame index, no snap, and nothing to shake. That is what the reference sites
 * (NVIDIA, Accenture, Deloitte) actually do; none of them ship a scrubbed image
 * sequence for a hero of this kind.
 *
 * WHAT THIS COMPONENT STILL OWNS, and why it is not simply deleted:
 *
 *  1. THE GROUND, AND FIRST PAINT. The poster is ordinary markup, so it is on
 *     screen before any script runs and it is the LCP element. The live scene
 *     cross-fades in over it once it genuinely has the garment drawn — never
 *     before, so the worst case is a sharp still, not an empty rectangle.
 *  2. THE FALLBACK. Below the `rich` rung there is no live scene at all, by
 *     design. Those devices keep the poster, moving on a continuous transform
 *     rather than a frame index — which cannot step, because a float has no
 *     steps.
 *  3. THE HERO CLOCK. It measures the pinned section and publishes progress
 *     across it, which is what the entrance camera runs on. See
 *     `heroProgress` in the scene store for why document scroll is the wrong
 *     ruler for a pinned opening.
 */
export default function HeroStage({ className = '' }: { className?: string }) {
  const { tier, profile } = useDeliveryTier();

  const hostRef = useRef<HTMLDivElement>(null);
  const rafPending = useRef(false);

  const [reduced, setReduced] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const [posterLoaded, setPosterLoaded] = useState(false);

  /**
   * Subscribed rather than selected, because this must not re-render the page
   * on every frame — only when the live scene crosses from not-drawn to drawn,
   * exactly once.
   */
  const heroReady = useSceneStore((s) => s.heroReady);

  /** The live scene is the hero on this rung; the poster is its underlay. */
  const live = profile.realtime && !reduced;

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  // A tier change means a different asset directory; give the new poster a
  // fresh chance rather than staying failed because a previous rung 404'd.
  useEffect(() => { setPosterFailed(false); setPosterLoaded(false); }, [tier]);

  /**
   * Publish progress across the pinned section, and drive the fallback move.
   *
   * Driven from the store — which ThreeProvider fills from Lenis's own scroll
   * event — rather than from the native `scroll` event. With a smooth-scroll
   * layer running those are two different numbers on the same frame, and
   * positioning a sticky element from one while measuring with the other is
   * its own, separate source of judder. One clock, one value, one frame.
   */
  useEffect(() => {
    const publish = () => {
      rafPending.current = false;
      const host = hostRef.current;
      if (!host) return;

      const section = host.closest('[data-hero-section]') as HTMLElement | null;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      const p = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;

      useSceneStore.getState().setHeroProgress(p);

      /**
       * The fallback move: a slow push-in on a continuous float.
       *
       * The floor is 1.0 and never below it. Scaling a centred element below
       * its own box leaves visible edges and dark ground beyond them, which is
       * the second half of what the customer was pointing at — a rectangle
       * that changes size while the headline stays still. From 1.0 up there is
       * no scroll position at which an edge can appear.
       */
      if (!live && !reduced) {
        host.style.transform = `scale(${(1 + 0.12 * p).toFixed(4)})`;
      } else {
        host.style.transform = '';
      }
    };

    publish();
    /**
     * Gated on `scroll` specifically, not on any store change.
     *
     * The canvas publishes an eased pointer position every frame the mouse is
     * moving, and an unfiltered subscription would run this — and therefore
     * `getBoundingClientRect`, which flushes layout — on all of them. Cheap
     * per call, but it is a forced synchronous layout inside the same frame the
     * compositor is trying to scroll, which is its own separate way to make a
     * sticky element stutter. Watch the one value that can change the answer.
     */
    let lastScroll = Number.NaN;
    const unsubscribe = useSceneStore.subscribe((state) => {
      if (state.scroll === lastScroll) return;
      lastScroll = state.scroll;
      if (rafPending.current) return;
      rafPending.current = true;
      requestAnimationFrame(publish);
    });
    const schedule = () => {
      if (rafPending.current) return;
      rafPending.current = true;
      requestAnimationFrame(publish);
    };
    /**
     * Native scroll as well as the store, because the store is not always fed.
     *
     * ThreeProvider only starts Lenis once capabilities have resolved, and
     * never at all under `prefers-reduced-motion`. On those paths nothing ever
     * calls `setScroll`, so a store-only subscription would leave hero progress
     * pinned at 0 — the opening frozen for exactly the visitors least likely to
     * reload and try again. Both sources feed one rAF, so when Lenis IS running
     * this costs nothing: the two events coalesce into the same frame.
     */
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });

    return () => {
      unsubscribe();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      useSceneStore.getState().setHeroProgress(0);
    };
  }, [live, reduced]);

  /**
   * Hand the frame over only when the scene is genuinely drawing the garment.
   *
   * `heroReady` is set by the scene itself after the texture has decoded, not
   * by the tier resolving — a fast rung on a slow connection would otherwise
   * take the poster away and show nothing in its place.
   */
  const posterVisible = !live || !heroReady;

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      data-sequence-hero=""
      style={{ transformOrigin: 'center center', willChange: 'transform' }}
      /**
       * `overflow-hidden` and `inset-0` are load-bearing, not cosmetic. A
       * failed <img> is still a replaced element and will size itself to its
       * alt text — which is how a 404 once put a product name as loose text
       * above the navigation. Clipping to an absolutely-positioned box means a
       * failure can never escape the frame whatever the element does.
       */
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {/**
        * THE UNDERLAY: graded ground + poster, faded out as ONE layer.
        *
        * They have to move together. The ground is opaque and this whole
        * component sits above the fixed canvas, so fading only the poster would
        * reveal the ground rather than the scene — the live hero would be
        * invisible behind a dark sheet, which is the same class of mistake as
        * showing two copies of the garment at once, just inverted.
        *
        * The ground is not a flat fill, and that is the answer to "the colour
        * is dull". A flat near-black across a whole viewport reads as dull
        * whatever the hex is, because there is no light in it and nothing for
        * the eye to travel along. This is a graded room: black at the corners,
        * a warm brass pool where the garment is staged, a cool lift along the
        * floor.
        *
        * It is also what the hero degrades TO. If every image 404s and the GPU
        * refuses a context, this is still a deliberate lit composition with the
        * headline legible over it.
        */}
      <div
        className={`absolute inset-0 transition-opacity duration-[1100ms] ease-[cubic-bezier(0.22,0.61,0.24,1)] ${
          posterVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div
          className="absolute inset-0 bg-ink-deep"
          style={{
            backgroundImage: [
              'radial-gradient(72% 78% at 66% 42%, rgba(161,98,7,0.26) 0%, rgba(138,84,6,0.11) 42%, rgba(10,9,8,0) 76%)',
              'radial-gradient(120% 70% at 50% 118%, rgba(90,72,58,0.16) 0%, rgba(10,9,8,0) 62%)',
              'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0) 68%, rgba(0,0,0,0.62) 100%)',
            ].join(','),
          }}
        />

        {!posterFailed && (
          <picture>
            <source srcSet={`/hero/${tier}/poster.avif`} type="image/avif" />
            <img
              src={`/hero/${tier}/poster.webp`}
              /**
               * Empty alt, deliberately. This container is aria-hidden — the
               * garment's name and price are real DOM above it — so alt text
               * adds nothing for a screen reader and is precisely what renders
               * as visible broken text when the file 404s.
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
      </div>

      {/**
        * A vignette over whichever layer is showing.
        *
        * Both the poster and the live canvas sit behind it, so the framing is
        * identical across the hand-over and the cross-fade cannot be seen as a
        * change of treatment — only as the picture coming alive.
        */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(108% 82% at 50% 46%, rgba(0,0,0,0) 44%, rgba(0,0,0,0.34) 78%, rgba(0,0,0,0.66) 100%)',
        }}
      />
    </div>
  );
}
