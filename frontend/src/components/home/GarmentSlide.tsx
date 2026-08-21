'use client';

import { useEffect, useRef, useState } from 'react';
import { mediaUrl } from '@/lib/media';
import type { Product } from '@/types';

/**
 * The opening: real garments, turning slowly.
 *
 * WHAT IT REPLACES AND WHY. Three abstract motifs were tried here — flat
 * pleats, panels in CSS 3D, then overlapping planes — and each was rejected in
 * the same terms: it decorates the shop instead of showing it. That is a fair
 * criticism of all three. A customer arriving at a clothes shop wants to see
 * clothes, and no arrangement of translucent rectangles is a substitute for
 * the thing being sold.
 *
 * WHICH GARMENTS APPEAR IS THE SHOP'S CHOICE, not a guess made here. It draws
 * from the pieces marked FEATURED in the admin. That matters for a specific
 * reason: the brief is garments, not people — no child models in the opening —
 * and nothing in this code can tell whether a photograph contains a person.
 * Tying it to the featured flag means the shop decides exactly what shows,
 * by marking the flat-lay photographs as featured and nothing else.
 *
 * WHY IT CANNOT SLOW THE PAGE DOWN. This is the whole engineering problem with
 * putting photographs in an opening, and it is solved by not adding any:
 *
 *   NO NEW REQUESTS. The homepage already fetches the featured pieces for the
 *   rails below; this reuses that exact query result. The images are ones the
 *   page was going to load anyway.
 *
 *   ONE IMAGE DECODES AT A TIME. Only the current and next slides are mounted,
 *   so the browser never holds four full-size photographs at once. The first
 *   is eager because it is the largest thing above the fold; the rest are lazy.
 *
 *   THE ANIMATION IS OPACITY ONLY. No layout, no paint of anything but the
 *   compositor layer, so a slide change cannot stutter a scroll.
 *
 *   IT STOPS WHEN IT IS NOT VISIBLE. An IntersectionObserver pauses the timer
 *   once the opening scrolls away, so nothing runs while somebody is reading
 *   the shelf below.
 *
 * Under `prefers-reduced-motion` the first garment simply stays.
 */

const HOLD_MS = 4200;   // long enough to look at a piece, not long enough to wait

export default function GarmentSlide({
  products,
  className = '',
}: {
  products: Product[];
  className?: string;
}) {
  // Only pieces that actually have a photograph. A slide with no image is a
  // blank frame in the rotation, which reads as the page being broken.
  const slides = products.filter((p) => p.images?.[0]).slice(0, 5);

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
    if (slides.length <= 1 || !onScreen) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), HOLD_MS);
    return () => clearInterval(t);
  }, [slides.length, onScreen]);

  if (slides.length === 0) return null;

  return (
    <div
      ref={host}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {slides.map((p, i) => {
        // Mount only what is on screen or about to be. Four decoded
        // photographs held at once is what makes an image hero expensive.
        const isCurrent = i === index;
        const isNext = i === (index + 1) % slides.length;
        if (!isCurrent && !isNext) return null;
        return (
          <img
            key={p.id}
            src={mediaUrl(p.images[0])}
            alt=""
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[1400ms] ease-[cubic-bezier(0.22,0.61,0.24,1)] motion-reduce:transition-none"
            style={{ opacity: isCurrent ? 1 : 0 }}
          />
        );
      })}

      {/**
        * The wash. The opening line sits over this, and a photograph behind
        * type is the classic way a headline becomes unreadable — it depends
        * entirely on which garment happens to be showing.
        *
        * The gradient is opaque at the left, where the words are, and clears
        * toward the right where the garment is meant to be seen. So the
        * headline keeps its contrast against the sandalwood ground no matter
        * what is behind it, and the photograph is still a photograph.
        */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(247,241,232,0.97) 0%, rgba(247,241,232,0.94) 34%, rgba(247,241,232,0.55) 62%, rgba(247,241,232,0.18) 100%)',
        }}
      />
    </div>
  );
}
