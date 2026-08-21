'use client';

import { useEffect, useRef, useState } from 'react';
import { mediaUrl } from '@/lib/media';
import { HERO_GARMENTS } from '@/lib/heroGarments';
import type { Product } from '@/types';

/**
 * The opening: whole garments, turning slowly, in a frame shaped like a
 * garment.
 *
 * WHY THE FIRST VERSION SHOWED HALF A DRESS. It filled the hero edge to edge
 * with `object-cover`. The hero is a wide, short band — roughly 1900 by 540 —
 * and a photograph of a garment is portrait, taller than it is wide. Covering
 * a landscape box with a portrait image can only work by cropping the top and
 * bottom away, so what survived was a middle slice: a torso, a pair of hands,
 * half a skirt. Every piece looked cut in half because every piece WAS cut in
 * half.
 *
 * There is no setting on `object-fit` that fixes that while keeping the image
 * full-bleed. `contain` would show the whole garment floating in a wide empty
 * band with bars either side, which is worse. The frame has to change shape,
 * not the fit.
 *
 * SO THE FRAME IS PORTRAIT. The garment now stands in a 3:4 panel on the right
 * of the opening, beside the line rather than behind it — the proportion a
 * garment photograph is actually taken in, so the whole piece fits with
 * nothing cropped. It also means the headline sits on the shop's own ground
 * again instead of over a photograph, which is why it stays readable whatever
 * is showing.
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

export default function GarmentSlide({ products }: { products: Product[] }) {
  /** The shop's own hero photographs win; products are the fallback. */
  const sources: string[] = HERO_GARMENTS.length > 0
    ? HERO_GARMENTS
    : products.filter((p) => p.images?.[0]).slice(0, 5).map((p) => mediaUrl(p.images[0]));

  const [index, setIndex] = useState(0);
  const [onScreen, setOnScreen] = useState(false);
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setOnScreen(true); return; }
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (sources.length <= 1 || !onScreen) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % sources.length), HOLD_MS);
    return () => clearInterval(t);
  }, [sources.length, onScreen]);

  if (sources.length === 0) return null;

  return (
    <div
      ref={host}
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 right-0 hidden w-[38%] max-w-[30rem] items-center justify-end pr-6 md:flex lg:pr-10"
    >
      {/* 3:4 — the proportion a garment is photographed in, so it fits whole. */}
      <div className="relative aspect-[3/4] h-[min(84%,30rem)] overflow-hidden border border-ink-edge/50 bg-ink-raised">
        {sources.map((src, i) => {
          const isCurrent = i === index;
          const isNext = i === (index + 1) % sources.length;
          if (!isCurrent && !isNext) return null;
          return (
            <img
              key={src}
              src={src}
              alt=""
              loading={i === 0 ? 'eager' : 'lazy'}
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[1400ms] ease-[cubic-bezier(0.22,0.61,0.24,1)] motion-reduce:transition-none"
              style={{ opacity: isCurrent ? 1 : 0 }}
            />
          );
        })}
      </div>
    </div>
  );
}
