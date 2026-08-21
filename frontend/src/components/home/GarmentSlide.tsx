'use client';

import { useEffect, useRef, useState } from 'react';
import { HERO_GARMENTS } from '@/lib/heroGarments';

/**
 * The opening: whole garments, turning slowly, in a frame shaped like a
 * garment.
 *
 * FULL-BLEED, WHICH IS WHAT WAS ASKED FOR. It briefly became a small 3:4
 * panel at the right instead, on the reasoning that a wide band crops a
 * portrait photograph to a middle slice — which it does. But a garment
 * filling the opening reads as a shopfront, and a postcard floating in a
 * corner does not, and the shop's judgement on that is the one that counts.
 *
 * The crop is therefore a real constraint rather than a bug: `object-cover`
 * on a band this wide will always cut the top and bottom off a portrait
 * photograph. The way to control WHAT it cuts is the photograph itself —
 * `public/hero/` and `lib/heroGarments.ts` exist for that, and the guidance
 * there says to leave room around the piece so the crop lands on background
 * rather than through the garment.
 *
 * WHERE THE PICTURES COME FROM. `lib/heroGarments.ts` first — images the shop
 * puts in `public/hero/`, chosen deliberately for the opening. If that list is
 * empty it falls back to featured products so the space is never blank. The
 * shop controls it either way, which matters because the brief is garments and
 * not people, and nothing in this code can tell whether a photograph contains
 * a child model.
 *
 * WHY IT CANNOT SLOW THE PAGE. Only the current and next slides are mounted,
 * so the browser never holds four photographs at once. The transition is
 * opacity alone, composited, so it cannot stutter a scroll. An
 * IntersectionObserver stops the timer when the opening is scrolled away. And
 * when it falls back to products, the images are ones the page already loaded
 * for the rails below — no extra requests at all.
 *
 * Under `prefers-reduced-motion` the first garment stays and nothing moves.
 */

const HOLD_MS = 4200;

/** Below this a photograph is visibly soft across a full-bleed opening. */
const MIN_WIDTH = 900;

export default function GarmentSlide() {
  /**
   * ONLY THE SHOP'S OWN HERO PHOTOGRAPHS. There used to be a fallback to
   * featured products, on the reasoning that an empty space is worse than an
   * imperfect picture. That was wrong, and shipping it proved it: the
   * catalogue shots are framed for a grid at thumbnail size, so at full-bleed
   * one came through as a four-photo collage tiled across the opening and
   * another as a soft close-up of a bow. Both looked like a mistake, because
   * both were.
   *
   * An opening with no photograph is the sandalwood ground, the line and the
   * way in — which is a composition the shop already approved. An opening with
   * the wrong photograph is a broken shopfront. So when the list is empty this
   * renders nothing at all and the ground shows through.
   */
  const sources: string[] = HERO_GARMENTS;

  /**
   * A picture too small for this frame is dropped once it loads.
   *
   * The opening is close to 1900px wide on a desktop. A 600px photograph
   * stretched across that is soft, and soft on the first thing a customer sees
   * reads as a cheap shop. There is no way to know a file's real size before
   * it arrives, so this checks on load and removes anything under the bar —
   * the slide simply never appears rather than appearing blurred.
   */
  const [tooSmall, setTooSmall] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [onScreen, setOnScreen] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const usableCount = sources.filter((src) => !tooSmall.includes(src)).length;

  useEffect(() => {
    const el = host.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setOnScreen(true); return; }
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (usableCount <= 1 || !onScreen) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % usableCount), HOLD_MS);
    return () => clearInterval(t);
  }, [usableCount, onScreen]);

  const usable = sources.filter((src) => !tooSmall.includes(src));
  if (usable.length === 0) return null;

  return (
    <div
      ref={host}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="absolute inset-0">
        {usable.map((src, i) => {
          const isCurrent = i === index;
          const isNext = i === (index + 1) % usable.length;
          if (!isCurrent && !isNext) return null;
          return (
            <img
              key={src}
              src={src}
              alt=""
              loading={i === 0 ? 'eager' : 'lazy'}
              decoding="async"
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth > 0 && img.naturalWidth < MIN_WIDTH) {
                  setTooSmall((prev) => (prev.includes(src) ? prev : [...prev, src]));
                }
              }}
              className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[1400ms] ease-[cubic-bezier(0.22,0.61,0.24,1)] motion-reduce:transition-none"
              style={{ opacity: isCurrent ? 1 : 0 }}
            />
          );
        })}
      </div>

      {/**
        * The wash. The opening line sits over this, and type on a photograph
        * is the classic way a headline becomes unreadable — it depends
        * entirely on which garment happens to be showing.
        *
        * Opaque at the left where the words are, clearing toward the right
        * where the garment is meant to be seen. So the line keeps its contrast
        * against the shop's own ground whatever is behind it.
        */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(247,241,232,0.97) 0%, rgba(247,241,232,0.93) 30%, rgba(247,241,232,0.55) 58%, rgba(247,241,232,0.15) 100%)',
        }}
      />
    </div>
  );
}
