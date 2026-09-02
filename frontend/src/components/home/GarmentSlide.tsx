'use client';

import { useEffect, useRef, useState } from 'react';
import { mediaUrl, heroImageUrl } from '@/lib/media';
import { HERO_GARMENTS } from '@/lib/heroGarments';
import type { Product } from '@/types';

/**
 * The opening: whole garments, moving slowly across the band, like a shop
 * window you are walking past.
 *
 * WHY THIS IS A RAIL AND NOT ONE BIG PHOTOGRAPH ANY MORE.
 *
 * It used to stretch a single photograph across the whole opening and
 * crossfade to the next one. The note that used to live here admitted the
 * flaw and called it a constraint rather than a bug: `object-cover` on a band
 * this wide always cuts the top and bottom off a portrait photograph, and the
 * suggested remedy was for the shop to go and shoot pictures shaped for the
 * band.
 *
 * MEASURED, WHICH IS WHY IT CHANGED. The band renders 1434x384 on a 1440px
 * screen — 3.73:1, near enough a LinkedIn cover. The photographs going
 * into it are 1440x1920, which is 0.75:1. A 3.7:1 frame can therefore show
 * about a fifth of a portrait photograph's height, and what a customer saw
 * was a horizontal slice of skirt with the garment's neckline and hem both
 * outside the frame. No amount of choosing a better photograph fixes a
 * six-to-one mismatch in shape; only changing the shape of what goes in the
 * frame does.
 *
 * So the band keeps its proportions — it is a good shape for a masthead, and
 * the headline needs the width — and the garments stop being stretched across
 * it. They are portrait cards now, at the band's full height, moving through
 * it in a continuous lane. Every piece is seen WHOLE, in the shape it was
 * photographed in, and the opening shows several at once rather than one.
 *
 * WHERE THE PICTURES COME FROM. `lib/heroGarments.ts` first — images the shop
 * puts in `public/hero/`. If that list is empty it falls back to product
 * photographs, which now costs nothing: a portrait card is exactly the shape
 * a catalogue photograph already is, so the fallback is no longer a
 * compromise. The old advice to shoot wide pictures for the band is obsolete,
 * and heroGarments.ts has been corrected to say so.
 *
 * WHY IT CANNOT SLOW THE PAGE. The lane is CSS `transform` on one element —
 * composited, off the main thread, and incapable of stuttering a scroll. The
 * images are requested at card size (a few hundred pixels) rather than at
 * 1400px for a full-width band, so this asks for LESS bandwidth than the
 * version it replaces. An IntersectionObserver pauses the animation when the
 * opening is scrolled away, and `prefers-reduced-motion` stops it entirely,
 * leaving a still row of garments.
 */

/** The card's shape. Portrait, and the same 3:4 the shelf cards use. */
const CARD_RATIO = 3 / 4;

/**
 * How long one card takes to travel its own width. Five seconds is a walking
 * pace: fast enough to read as alive, slow enough that nothing demands to be
 * looked at while somebody is trying to read the headline over it.
 */
const SECONDS_PER_CARD = 5;

/** Widths offered for a card. A card is ~270px wide, so 600 covers 2x screens. */
const CARD_WIDTHS = [300, 450, 600];

/**
 * The shape a single garment photograph has, as a width/height ratio.
 *
 * The filter survives the redesign because it is not about fitting the band —
 * it is about what the picture IS. A collage of four photographs is roughly
 * 1:1 and a cropped close-up runs well under 0.62; neither is a garment, and
 * neither belongs in the opening whatever shape the frame is. Checked on load
 * because a file's real dimensions are not knowable until it arrives.
 */
const MIN_RATIO = 0.62;
const MAX_RATIO = 0.95;

/** The ground the wash is made of — the shop's warm white. */
const WASH = '247,241,232';

export default function GarmentSlide({ products }: { products: Product[] }) {
  /*
   * De-duplicated on the resolved URL. The opening is handed
   * [...featured, ...recent] and a piece that is both appears twice; keying on
   * the URL rather than the product id also collapses two products that share
   * a photograph. In a lane rather than a crossfade a duplicate is more
   * obvious, not less — the same garment would ride past twice in one screen.
   */
  const sources: string[] = HERO_GARMENTS.length > 0
    ? Array.from(new Set(HERO_GARMENTS))
    : Array.from(new Set(
        products.filter((p) => p.images?.[0]).map((p) => mediaUrl(p.images[0])),
      )).slice(0, 12);

  const [rejected, setRejected] = useState<string[]>([]);
  const [onScreen, setOnScreen] = useState(false);
  const [repeats, setRepeats] = useState(2);
  const host = useRef<HTMLDivElement>(null);

  const usable = sources.filter((src) => !rejected.includes(src));
  const count = usable.length;

  useEffect(() => {
    const el = host.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setOnScreen(true); return; }
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /*
   * ENOUGH CARDS TO OUTRUN THE SCREEN.
   *
   * The lane loops by translating exactly half its width, which is seamless
   * only while one half is itself wider than the viewport — otherwise the
   * lane runs out and the ground shows through before it wraps. A handful of cards is barely a
   * thousand pixels and a desktop band is 1900. So the set is repeated until one half covers
   * the screen half again over, and re-measured when the window changes.
   */
  useEffect(() => {
    if (count === 0) return;
    const measure = () => {
      const bandHeight = host.current?.clientHeight || 360;
      const setWidth = bandHeight * CARD_RATIO * count;
      if (setWidth <= 0) return;
      setRepeats(Math.max(2, Math.ceil((window.innerWidth * 1.5) / setWidth)));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [count]);

  if (count === 0) return null;

  // One half of the lane, then the same again — the two are identical, so the
  // wrap from the end back to the start is not a boundary at all.
  const half: string[] = [];
  for (let r = 0; r < repeats; r += 1) half.push(...usable);
  const lane = [...half, ...half];

  return (
    <div
      ref={host}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div
        className="garment-rail flex h-full w-max items-stretch"
        style={{
          animationDuration: `${half.length * SECONDS_PER_CARD}s`,
          animationPlayState: onScreen ? 'running' : 'paused',
        }}
      >
        {lane.map((src, i) => (
          /*
           * The trailing space is PADDING on the card rather than `gap` on the
           * lane, and that is load-bearing. `gap` puts a space BETWEEN items,
           * so the two halves of the lane are separated by one more gap than
           * each half contains internally — half the width is then not quite
           * where the second half begins, and the loop jumps by half a gap
           * every time it wraps. Padding belongs to the card, so every card
           * occupies exactly the same width and half is exactly half.
           */
          <div key={`${src}-${i}`} className="h-full shrink-0 pr-3">
            <div className="h-full bg-ink-raised" style={{ aspectRatio: '3 / 4' }}>
              <img
                src={heroImageUrl(src, 450)}
                srcSet={CARD_WIDTHS.map((w) => `${heroImageUrl(src, w)} ${w}w`).join(', ')}
                sizes="(min-width: 768px) 280px, 190px"
                alt=""
                loading={i < 4 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 ? 'high' : 'auto'}
                decoding="async"
                onLoad={(e) => {
                  const img = e.currentTarget;
                  if (!img.naturalWidth) return;
                  const ratio = img.naturalWidth / img.naturalHeight;
                  if (ratio < MIN_RATIO || ratio > MAX_RATIO) {
                    setRejected((prev) => (prev.includes(src) ? prev : [...prev, src]));
                  }
                }}
                /*
                 * `contain`, so a piece shot at some other ratio is shown
                 * whole rather than trimmed to fit the card. Showing the whole
                 * garment is the entire point of the change; cropping it again
                 * at the card would simply move the original fault inwards.
                 */
                className="h-full w-full object-contain"
              />
            </div>
          </div>
        ))}
      </div>

      {/*
        * One wash, opaque where the words are and clearing across the lane, so
        * the headline holds its contrast while the garments keep their light.
        */}
      <div
        className="absolute inset-0"
        style={{
          background:
            `linear-gradient(90deg, rgba(${WASH},0.97) 0%, rgba(${WASH},0.93) 30%, rgba(${WASH},0.55) 58%, rgba(${WASH},0.15) 100%)`,
        }}
      />
    </div>
  );
}
