'use client';

import { useEffect, useRef, useState } from 'react';
import { mediaUrl } from '@/lib/media';
import { HERO_GARMENTS } from '@/lib/heroGarments';
import type { Product } from '@/types';

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

/**
 * Below this a photograph is visibly soft across a full-bleed opening.
 *
 * SET FROM THE ACTUAL LIBRARY, NOT FROM A ROUND NUMBER. This was 900px, which
 * sounded reasonable and was catastrophic: measured against the real product
 * images, EVERY one of them is under 900 wide (675, 675, 646, 478, 225), so
 * the filter would have emptied the opening entirely and left it looking
 * broken rather than picky.
 *
 * The library splits cleanly at 600. Three pieces sit at 646-675 wide and are
 * perfectly sharp in the frame; the two that looked wrong are 478 and 225.
 * So 600 removes exactly the two bad frames and keeps everything else — which
 * is what was asked for, arrived at by measuring rather than guessing.
 */
const MIN_WIDTH = 600;

/** Above this a picture is too square to be one garment — likely a collage. */
const MAX_RATIO = 0.95;

export default function GarmentSlide({ products }: { products: Product[] }) {
  /**
   * The shop's own hero photographs first; product images after.
   *
   * The fallback was removed for a while because at full-bleed it produced two
   * genuinely bad frames: one product image is a four-photo collage, which
   * tiled across the opening, and another is a soft close-up, which went
   * blurry stretched to 1900px. Removing it fixed those and took the sliding
   * garments away with them, which was too blunt — the feature was wanted, the
   * two bad pictures were not.
   *
   * So the pictures are filtered instead of the feature being dropped. Both
   * checks below run on load, because a file's real dimensions are not
   * knowable until it arrives, and a failing image is simply never shown.
   */
  const sources: string[] = HERO_GARMENTS.length > 0
    ? HERO_GARMENTS
    : products.filter((p) => p.images?.[0]).slice(0, 6).map((p) => mediaUrl(p.images[0]));

  /**
   * A picture that cannot carry this frame is dropped once it loads.
   *
   * TWO WAYS A PICTURE FAILS HERE, and both were seen in production:
   *
   *   TOO SMALL. The opening is close to 1900px wide, so a narrow file goes
   *   soft stretched across it, and soft on the first thing a customer sees
   *   reads as a cheap shop. The threshold is measured against the actual
   *   library rather than picked — see MIN_WIDTH.
   *
   *   TOO SQUARE. A collage of four photographs is roughly 1:1; a photograph
   *   of a single garment is roughly 3:4. Anything approaching square is
   *   almost certainly not one piece, and it tiled across the opening exactly
   *   as you would expect.
   *
   * Neither is knowable before the file arrives, so both are checked on load
   * and a failing image is removed from the rotation rather than shown badly.
   */
  const [rejected, setRejected] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [onScreen, setOnScreen] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const usableCount = sources.filter((src) => !rejected.includes(src)).length;

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

  const usable = sources.filter((src) => !rejected.includes(src));
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
                if (!img.naturalWidth) return;
                const ratio = img.naturalWidth / img.naturalHeight;
                // Too small to stretch across the opening without going soft,
                // or too square to be a single garment shot — a collage of
                // four photographs is roughly 1:1, a garment is roughly 3:4.
                if (img.naturalWidth < MIN_WIDTH || ratio > MAX_RATIO) {
                  setRejected((prev) => (prev.includes(src) ? prev : [...prev, src]));
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
