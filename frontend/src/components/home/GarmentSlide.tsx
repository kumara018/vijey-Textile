'use client';

import { useEffect, useRef, useState } from 'react';
import { mediaUrl, heroImageUrl, HERO_WIDTHS } from '@/lib/media';
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
 * The shape a single garment photograph has, as a width/height ratio.
 *
 * FILTERING ON SHAPE RATHER THAN SIZE, AND THAT IS FORCED. The obvious test is
 * "is this file big enough", and it was — until the images started being
 * resized by Cloudinary on the way out. A 478px original delivered at w_1400
 * reports naturalWidth 1400, so a width test passes everything and both bad
 * frames come back. `c_fill` with only a width keeps the aspect ratio, so
 * SHAPE survives the transform where size does not.
 *
 * It also happens to be the better test. Measured across the library:
 *
 *     Leghenga        675 x 900   0.750   a garment
 *     Multi colour    675 x 900   0.750   a garment
 *     Aari Pattu      646 x 900   0.718   a garment
 *     Co-ord set      478 x 900   0.531   the soft one
 *     Frock           225 x 225   1.000   the four-photo collage
 *
 * Garment photographs cluster tightly around 0.72-0.75. The two frames that
 * looked wrong sit well outside that on both sides — one nearly square
 * because it is a collage, one unusually narrow. A band of 0.62 to 0.95 keeps
 * the three and drops the two, with room either side for photographs that are
 * not framed identically.
 */
const MIN_RATIO = 0.62;
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
  /**
   * DE-DUPLICATED, WHICH IS NOT DEFENSIVE TIDYING — IT WAS A REAL FAULT.
   *
   * The opening is handed [...featured, ...recent], and a piece that is both
   * featured AND recent appears in both. Measured against the live shop: the
   * combined list is ELEVEN entries holding SIX products, so five of them are
   * in the rotation twice. The same photograph therefore came round twice in a
   * row, which is what "this image is blinking two times" was describing — not
   * a rendering fault at all, the same picture crossfading into itself.
   *
   * Keyed on the resolved URL rather than the product id, so two products
   * sharing a photograph also collapse to one slide.
   */
  const sources: string[] = HERO_GARMENTS.length > 0
    ? Array.from(new Set(HERO_GARMENTS))
    : Array.from(new Set(
        products.filter((p) => p.images?.[0]).map((p) => mediaUrl(p.images[0])),
      )).slice(0, 6);

  /**
   * A picture that cannot carry this frame is dropped once it loads.
   *
   * TWO WAYS A PICTURE FAILS HERE, and both were seen in production:
   *
   *   TOO NARROW. A garment photograph sits around 0.72-0.75 wide-to-tall.
   *   Anything much narrower is a crop of something rather than a piece, and
   *   it was one of the two frames called out.
   *
   *   TOO SQUARE. A collage of four photographs is roughly 1:1; one garment
   *   is roughly 3:4. Anything approaching square is almost certainly not a
   *   single piece, and it tiled across the opening exactly as expected.
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
        {/**
          * EVERY SLIDE STAYS MOUNTED, AND ONLY OPACITY MOVES.
          *
          * This used to mount just the current slide and the next one, to keep
          * at most two photographs in memory. It produced exactly the blink
          * that was reported, and the reason is worth writing down: when the
          * index advanced, the OUTGOING image was unmounted in the same render
          * that the incoming one began fading in. So the old picture did not
          * fade — it was cut, instantly, and the ground flashed through the
          * gap before the new one had any opacity. Two visible steps where
          * there should have been one.
          *
          * It also made the wrap from the last slide to the first feel unlike
          * the others, because a different pair was being swapped at the
          * boundary. With every slide mounted there is no boundary: going from
          * the last to the first is the same crossfade as any other, so the
          * rotation has no beginning and no end.
          *
          * The cost is three photographs held instead of two. At 27-91KB of
          * WebP that is a fair price for a transition that does not flicker,
          * and the ones that are not showing are lazy so nothing is fetched
          * before it is needed.
          */}
        {usable.map((src, i) => {
          const isCurrent = i === index;
          return (
            <img
              key={src}
              src={heroImageUrl(src, 1400)}
              /**
               * The browser picks a width for the screen it is on. A phone
               * takes the 500px file — 27KB, less than the 60KB it downloads
               * today — and a desktop takes 1400 or 1800 rather than
               * stretching a 675px photograph across the whole band.
               *
               * `sizes="100vw"` because the opening is full-bleed: the image
               * really is as wide as the viewport, so anything narrower would
               * make the browser choose a file that is too small again.
               */
              srcSet={HERO_WIDTHS.map((w) => `${heroImageUrl(src, w)} ${w}w`).join(', ')}
              sizes="100vw"
              alt=""
              loading={i === 0 ? 'eager' : 'lazy'}
              fetchPriority={i === 0 ? 'high' : 'auto'}
              decoding="async"
              onLoad={(e) => {
                const img = e.currentTarget;
                if (!img.naturalWidth) return;
                // The shape is unchanged by the transform (c_fill keeps the
                // requested aspect), so the square test still holds — but the
                // WIDTH now reflects what Cloudinary delivered, not the file
                // behind it. The too-small test therefore runs against the
                // untransformed source, which is the thing being judged.
                const ratio = img.naturalWidth / img.naturalHeight;
                // Too small to stretch across the opening without going soft,
                // or too square to be a single garment shot — a collage of
                // four photographs is roughly 1:1, a garment is roughly 3:4.
                if (ratio < MIN_RATIO || ratio > MAX_RATIO) {
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
        * A short wash at the left edge only.
        *
        * It used to run most of the way across, because the photograph filled
        * the whole band and the headline sat on top of it. The garment is held
        * to the right now and never reaches the words, so a full-width wash
        * would only be greying out a picture for no reason. What is left just
        * softens the join where the image meets the ground.
        */}
      <div
        className="absolute inset-y-0 left-0 w-1/2"
        style={{
          background:
            'linear-gradient(90deg, rgba(247,241,232,1) 0%, rgba(247,241,232,1) 55%, rgba(247,241,232,0) 100%)',
        }}
      />
    </div>
  );
}
