'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { productListQuery } from '@/lib/query';
import { useHeroStore } from '@/store/useHeroStore';
import { STORE, MAIL_URL, MAIL_URL2 } from '@/lib/config';
import { HERO_FIXTURE } from '@/lib/heroFixture';
import type { Product } from '@/types';
import Reveal from '@/components/home/Reveal';
import OccasionBand from '@/components/home/OccasionBand';
import MeasureRule from '@/components/home/MeasureRule';
import ProductCard from '@/components/ProductCard';

/**
 * The Trousseau — Vijey Textile homepage.
 *
 * A ceremonial descent in seven movements, not a scannable page. The previous
 * sequence (hero / trust badges / category grid / featured / promo / arrivals)
 * is gone entirely: there is no badge row, no uniform category grid, and no
 * promotional banner. Those are conversion furniture from a different kind of
 * shop; here the structure itself is the argument.
 *
 * The canvas behind this page is staging the hero photograph in 3D. The DOM's
 * only job is typography and whitespace — everything cinematic happens in the
 * scene, everything editorial happens here, and the two never fight because
 * they occupy different layers.
 */

const unwrap = (raw: unknown): Product[] =>
  Array.isArray(raw)
    ? raw
    : ((raw as { products?: Product[]; items?: Product[]; data?: Product[] })?.products ??
       (raw as { items?: Product[] })?.items ??
       (raw as { data?: Product[] })?.data ??
       []);

export default function HomePage() {
  const setHeroImage = useHeroStore((s) => s.setHeroImage);

  // Featured first — the hero photograph should be a piece the shop has chosen
  // to lead with, not whatever happens to be newest.
  const featured = useQuery(productListQuery({ featured: true, limit: 8 }));
  const recent = useQuery(productListQuery({ sort_by: 'created_at', sort_order: 'desc', limit: 7 }));

  const featuredItems = useMemo(() => unwrap(featured.data), [featured.data]);
  const recentItems = useMemo(() => unwrap(recent.data), [recent.data]);

  /**
   * The lead piece: the first product that actually HAS a photograph.
   *
   * It used to be `featuredItems[0] ?? recentItems[0] ?? HERO_FIXTURE` — the
   * first product, whatever it was, with the fixture only as a last resort when
   * the catalogue returned nothing at all. That has a gap in the middle, and I
   * walked straight into it: clearing the seeded products' dead image paths
   * left twenty-four real products with `images: []`, so `featuredItems[0]`
   * resolved, `hero.images?.[0]` was undefined, and the scene staged an empty
   * lit room on every single device. A product existed, so the fixture never
   * ran; the product had no picture, so there was nothing to show.
   *
   * `check:hero-matrix` caught it — "live scene but no __heroFrame published"
   * on all six configurations — which is exactly what that gate is for.
   *
   * A product with no photograph cannot be the hero of a shop that sells
   * clothes. Pick one that can.
   */
  const hero = useMemo(() => {
    const withPhoto = [...featuredItems, ...recentItems].find((p) => p.images?.[0]);
    return withPhoto ?? (HERO_FIXTURE as unknown as Product);
  }, [featuredItems, recentItems]);

  /**
   * The heirloom plate must never be the piece already staged in the hero.
   *
   * It was `product={hero}` — the same garment — so on a small catalogue the
   * page showed one photograph twice within two screens, which reads as the
   * site repeating itself rather than as two movements of one composition.
   * Pick the first piece that is NOT the hero, falling back to the hero only
   * when the shop genuinely has one item.
   */
  const plate = useMemo(() => {
    const pool = [...featuredItems, ...recentItems];
    return pool.find((p) => p.id !== hero?.id) ?? hero;
  }, [featuredItems, recentItems, hero]);

  useEffect(() => {
    const img = hero?.images?.[0] ?? null;
    setHeroImage(img ?? null);
    return () => setHeroImage(null);
  }, [hero, setHeroImage]);

  return (
    // No background here on purpose. The body paints the ground; anything
    // opaque on this wrapper covers the canvas sitting behind it at z-0, and
    // the staged cloth disappears entirely while still costing every draw call.
    <div className="text-paper-muted">
      {/**
        * Copy scrim.
        *
        * The scene is live and its luminance changes as the camera moves and
        * the sheen band crosses the weave, so no fixed text colour can be
        * guaranteed legible against it. This is the standard solution for
        * titles over footage: a gradient matte that keeps the copy column
        * dark while leaving the right side of the frame — where the subject
        * is staged — completely clear.
        *
        * z-0 *within this page's stacking context*, with the content raised
        * to z-10 below. The whole page already sits above the canvas, so the
        * scrim only has to beat the canvas, not the copy. Giving it a high
        * z-index instead put it over the headline and greyed the text out —
        * the same stacking-context trap the letterbox hit one level up.
        */}
        {/* The wash under the copy is gone with the photograph it was
            protecting the type from. On the shop's own ground the type is
            already at 13.61:1. */}

      {/* Everything the visitor reads or clicks sits above the scrim. */}
      <div className="relative z-10">

      {/* ═══ I. The opening plate ══════════════════════════════════════
          One line, at the largest size on the site, over the staged
          photograph. Nothing else competes for the frame. */}
      {/**
        * A PINNED hero — the Accenture / NVIDIA pattern.
        *
        * The inner frame is sticky, so the viewport holds while the scroll
        * drives the camera move and the garment grows from a staged plate to
        * near full bleed. The move plays over a real distance instead of being
        * over within one screen.
        *
        * 190svh, down from 240. `data-hero-section` is what makes that number
        * a single fact rather than three copies of it: HeroStage measures this
        * box to publish hero progress, CanvasHost measures it to time the
        * scene's hand-over, and the camera runs on the progress that comes out.
        * Changing the height here changes all three together — previously the
        * fade was a hardcoded two viewports and the section was two and a half,
        * so the last half-screen of the pin was a dead dark band with nothing
        * in it. That was the gap.
        *
        * `overflow-hidden` on the sticky frame is load-bearing: media is
        * clipped to the frame, so nothing bleeds into the sections below.
        */}
      {/* THE HERO IS AS TALL AS WHAT IS IN IT, AND NOTHING MORE.
          It went 190svh -> 64svh when the staged garment was removed, but the
          RESERVED height stayed behind after the thing it was reserved for had
          gone. Measured at 1440x860: header 110 + hero 550, so the first
          product landed at y=779 — the very bottom edge of the window, and
          below the fold on any real laptop. The headline is about 200px of
          that 550. The other 350 was empty by construction: a fixed box with
          `justify-end` pins the type to the bottom and leaves the surplus
          above it, which is exactly the space that kept getting flagged.
          Nothing measures this box any more — the scene never mounts, since
          sceneForPath returns 'plain' on every route — so there is nothing
          left to reserve height for. Content height plus real padding. */}
      <section data-hero-section="" className="relative h-auto">
        {/**
          * `min-h` rather than `h`, and this is not a cosmetic preference.
          *
          * A fixed `h-[100svh]` with `justify-end` overflows UPWARD the moment
          * the copy is taller than the viewport — and on a phone held sideways
          * (844×390) it always is. The eyebrow then rendered straight through
          * the wordmark in the fixed header: not a spacing bug, a box too
          * small for what was inside it, pushing its own contents out of the
          * top while the padding sat below them doing nothing.
          *
          * With `min-h` the section grows instead of overflowing, so the top
          * padding actually holds and the header stays clear. On a tall screen
          * nothing changes at all — the content is shorter than the viewport
          * and the minimum is what applies.
          */}
        {/* `sticky` went with the reserved height. It existed so the staged
            garment could hold still while the page scrolled over it; with the
            garment gone it only pinned an empty band to the top of the
            window. */}
        <div className="flex flex-col justify-start overflow-hidden px-6 pb-[clamp(1.5rem,4vh,2.5rem)] pt-[clamp(1.5rem,4vh,2rem)] sm:px-10 md:pb-[clamp(2.25rem,5vh,3.25rem)] md:pt-[clamp(2.25rem,5vh,3.25rem)]">
          {/* NO MOTIF BEHIND THE OPENING.
          Three were tried here — eighteen flat pleats, then nine panels in
          real CSS 3D — and each was rejected. The note each time was the
          same in substance: it reads as decoration over the shop rather than
          as the shop. So the opening is now the sandalwood ground, the line,
          and the way in. Nothing else competes with it, and nothing animates
          behind the first thing a customer reads. */}
          {/* The graded ground and the poster underlay. The live scene behind
              this cross-fades in over it once it genuinely has the garment
              drawn; if it never does, this is the hero and it is a still. */}
          {/* THE STAGED GARMENT IS GONE FROM THE OPENING.
              It filled the right half of the hero and ran up behind the
              header, so the wordmark and "Deliver to" sat on a photograph of
              a frock. Asked for directly: the same opening as the sister
              shop — type on the shop's own ground. The garments are the
              section immediately below, where each has a name and a price. */}

          <div className="relative z-10 mx-auto w-full max-w-[112rem]">
          <Reveal>
            <p className="mb-[clamp(1rem,2.6vh,2rem)] text-rule uppercase text-brass-bright">
              Texvalley&nbsp;·&nbsp;Erode&nbsp;·&nbsp;Sizes 12–40
            </p>

          </Reveal>

          <Reveal delay={120}>
            {/* Sized for the band, not the old two-screen hero. `text-plate` ran
              past the bottom edge once the section shrank — the screenshot
              showed "remembered" sliced in half. */}
            <h1 className="max-w-[min(18ch,44vw)] text-balance font-display text-[clamp(1.9rem,4.4vw,3.4rem)] font-light leading-[1.06] text-paper">
              Heirloom pieces, worn once, remembered always
            </h1>
          </Reveal>

          <Reveal delay={260}>
            <div className="mt-[clamp(1.5rem,4.2vh,3rem)] flex flex-wrap items-center gap-x-10 gap-y-5">
              <Link
                href="/products"
                className="group inline-flex items-baseline gap-4 border-b border-brass/70 pb-2 text-caption uppercase text-paper transition-colors duration-500 hover:border-brass-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
              >
                See every piece
                <span aria-hidden="true" className="transition-transform duration-500 group-hover:translate-x-1.5">→</span>
              </Link>
              {/* "In frame: …" named the garment staged behind this copy. There
                  is no frame any more — the piece it pointed at is in the grid
                  below with its price, which is a better link than a caption. */}
            </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/**
        * EVERYTHING AFTER THE PINNED HERO NEEDS AN OPAQUE GROUND.
        *
        * A sticky section stays fixed in the viewport while later content
        * scrolls up the page. If that content is transparent — and every
        * section here was — the pinned hero shows THROUGH it: the headline
        * and the staged garment composite underneath "The wedding" and "The
        * festival" at the same time, which is the overlap that looked like
        * two images fighting.
        *
        * `bg-ink` is the fix and it is not decoration: it is the sheet that
        * slides over the pinned frame and hides it. z-20 puts it above the
        * sticky hero; the hero's own copy sits at z-10 inside its frame.
        *
        * This is the half of the pinned-hero pattern that is invisible until
        * it is missing.
        */}
      <div className="relative z-20 bg-ink">

      {/* ═══ II. The Occasion ══════════════════════════════════════════
          Three full-bleed alternating bands. This replaces the category
          grid: a family does not shop by taxonomy, they shop by the day
          that is coming. */}
      {/* 12vh of padding above the heading plus 9vh below it put roughly a fifth
          of a screen of empty ground between the hero releasing and the first
          word of the next movement, on top of whatever the pin had already
          left. Tightened to 7 + 4.5 — still generous, no longer a void. */}

      {/**
        * STOCK FIRST, AS A GRID.
        *
        * This was KeptStagger — an editorial run where each piece takes most
        * of the viewport and the eye is walked through them one at a time. It
        * is a beautiful way to show six garments and a poor way to let anyone
        * BUY one: a customer scrolls a whole screen per product and sees no
        * price until they arrive at it.
        *
        * The same cards the shelf uses, in a plain responsive grid. Four
        * across on a laptop, two on a phone, each with its photograph, name,
        * price and Add to bag — so the homepage answers "what do you sell and
        * what does it cost" in one screen instead of six.
        */}
      <section aria-labelledby="new-heading" className="mx-auto w-full max-w-[112rem] px-6 pb-[4vh] pt-[5vh] sm:px-10">
        <div className="mb-7 flex flex-wrap items-baseline justify-between gap-4">
          <h2 id="new-heading" className="font-display text-[clamp(1.4rem,2.6vw,2rem)] font-light text-paper">
            New in the shop
          </h2>
          <Link
            href="/products"
            className="text-rule uppercase text-brass-bright transition-colors duration-300 hover:text-brass"
          >
            See everything &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 lg:grid-cols-4">
          {recentItems.slice(0, 8).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/**
        * ═══ The occasion, folded away ═══════════════════════════════════
        *
        * Three bands, each with a three-line paragraph, sat open on the
        * homepage between the products and the rest of the shop. Asked for
        * directly: make it a dropdown, so a customer who wants it can open it
        * and everybody else gets past it.
        *
        * Native <details>/<summary>. It is keyboard operable, announced as a
        * disclosure by screen readers, findable by the browser's own in-page
        * search even while closed in modern browsers, and it costs no
        * JavaScript — which matters on the page that just had 717KB taken off
        * it. A hand-built accordion would need state, ARIA, focus handling and
        * an animation, and would be worse at all four.
        *
        * The copy inside is a line each now rather than a paragraph. If
        * someone has opened a disclosure they are willing to read a little —
        * not an essay.
        */}
      <section aria-labelledby="occasion-heading" className="border-t border-ink-edge/60 py-[5vh]">
        <details className="group mx-auto w-full max-w-[112rem] px-6 sm:px-10">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright">
            <h2 id="occasion-heading" className="font-display text-[clamp(1.4rem,2.6vw,2rem)] font-light text-paper">
              Shop by occasion
            </h2>
            <span className="flex items-center gap-3 text-rule uppercase text-brass-bright">
              <span className="hidden sm:inline">Naming day · Wedding · Festival</span>
              <span
                aria-hidden="true"
                className="text-lg leading-none transition-transform duration-300 group-open:rotate-45 motion-reduce:transition-none"
              >
                +
              </span>
            </span>
          </summary>

          <div className="pt-[3vh]">
            <OccasionBand
              index="01"
              title="The naming day"
              note="First celebrations"
              copy="Soft-finished cottons and gentle silks, every seam finished on the inside."
              category="Baby Frocks"
              align="left"
            />
            <OccasionBand
              index="02"
              title="The wedding"
              note="The heirloom piece"
              copy="Weight, drape, and a hem that holds its line through a long evening."
              category="Lehenga"
              align="right"
            />
            <OccasionBand
              index="03"
              title="The festival"
              note="For the photographs"
              copy="Colour that survives a camera flash and a courtyard full of lamps."
              category="Party Wear"
              align="left"
            />
          </div>
        </details>
      </section>

      {/* ═══ III. The heirloom in frame ════════════════════════════════
          One piece, one viewport. The camera cranes down it as you
          scroll — the scene handles that; this is the type over it. */}
      {/* The single featured piece is gone: a full-width plate for one
          product that already appears, with its price, in the grid above. */}

      {/* ═══ IV. The measure ═══════════════════════════════════════════
          Sizes 12–40 as an actual rule. Replaces a trust-badge row with
          the one fact that genuinely reassures a parent buying online. */}
      <MeasureRule />

      {/* ═══ V. The makers ═════════════════════════════════════════════ */}
      {/* The makers section was removed on request. Where the shop is and
          the numbers to call are in the footer, which is where people look. */}

      {/* ═══ VI. Recently kept ═════════════════════════════════════════
          New arrivals as an offset stagger. Never a uniform row. */}
      </div>
      </div>
    </div>
  );
}
