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
import DeliverTo from '@/components/home/DeliverTo';
import OccasionBand from '@/components/home/OccasionBand';
import HeirloomPlate from '@/components/home/HeirloomPlate';
import MeasureRule from '@/components/home/MeasureRule';
import ProductCard from '@/components/ProductCard';
import HeroStage from '@/components/hero/HeroStage';

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
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          // Pulled left of where it was. The subject is staged further into the
          // frame now that it is sized against the frustum, and the old stops
          // (0.62 at 46%, 0.18 at 60%) put a grey wash across its left third —
          // which is a slower, subtler version of the same "dull" complaint.
          background:
            'linear-gradient(96deg, rgba(247,234,238,0.97) 0%, rgba(247,234,238,0.92) 24%, rgba(247,234,238,0.58) 37%, rgba(247,234,238,0.16) 50%, rgba(247,234,238,0) 62%)',
        }}
      />

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
      {/* THE HERO IS A BAND NOW, NOT TWO SCREENS.
          It was `h-[190svh]` — a customer scrolled nearly two full screens of
          photograph and sentence before reaching anything they could buy. The
          owner's words were "product should be visible in homepage mainly not
          down", and they are describing this. 64svh keeps the staged garment
          and the scroll effect while putting real stock above the fold on a
          laptop and one short flick away on a phone. */}
      <section data-hero-section="" className="relative h-[64svh]">
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
        <div className="sticky top-0 flex min-h-[62svh] flex-col justify-end overflow-hidden px-6 pb-[clamp(2rem,5vh,3.5rem)] pt-[clamp(6.5rem,12vh,8rem)] sm:px-10">
          {/* The graded ground and the poster underlay. The live scene behind
              this cross-fades in over it once it genuinely has the garment
              drawn; if it never does, this is the hero and it is a still. */}
          <HeroStage />

          <div className="relative z-10 mx-auto w-full max-w-[112rem]">
          <Reveal>
            <p className="mb-[clamp(1rem,2.6vh,2rem)] text-rule uppercase text-brass-bright">
              Texvalley&nbsp;·&nbsp;Erode&nbsp;·&nbsp;Sizes 12–40
            </p>

            {/* Where this order is going. Directly under the line that says
                where the shop IS — the two halves of the same question. */}
            <div className="mb-[clamp(1rem,2.6vh,2rem)]">
              <DeliverTo />
            </div>
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
              {hero && (
                <Link
                  href={`/products/${hero.id}`}
                  className="text-caption uppercase text-paper-faint transition-colors duration-500 hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
                >
                  In frame: {hero.name}
                </Link>
              )}
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
      <section aria-labelledby="new-heading" className="mx-auto w-full max-w-[112rem] px-6 pb-[7vh] pt-[5vh] sm:px-10">
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

      <section aria-labelledby="occasion-heading" className="border-t border-ink-edge/60 pb-[11vh] pt-[7vh]">
        <div className="mx-auto mb-[4.5vh] w-full max-w-[112rem] px-6 sm:px-10">
          <Reveal>
            <h2 id="occasion-heading" className="font-display text-chapter font-light text-paper">
              The occasion
            </h2>
          </Reveal>
        </div>

        <OccasionBand
          index="01"
          title="The naming day"
          note="First celebrations"
          copy="The first photograph anyone will keep. Soft-finished cottons and gentle silks, cut for a child who will be passed between every pair of arms in the room."
          category="Baby Frocks"
          align="left"
        />
        <OccasionBand
          index="02"
          title="The wedding"
          note="The heirloom piece"
          copy="Weight, drape and a hem that holds its line through a long evening. These are the pieces that come out of the cupboard again a decade later, for a younger cousin."
          category="Lehenga"
          align="right"
        />
        <OccasionBand
          index="03"
          title="The festival"
          note="For the photographs"
          copy="Colour that survives a camera flash and a courtyard full of lamps. Made to be seen across a crowded room, and to still look considered up close."
          category="Party Wear"
          align="left"
        />
      </section>

      {/* ═══ III. The heirloom in frame ════════════════════════════════
          One piece, one viewport. The camera cranes down it as you
          scroll — the scene handles that; this is the type over it. */}
      <HeirloomPlate product={plate} loading={featured.isPending && recent.isPending} />

      {/* ═══ IV. The measure ═══════════════════════════════════════════
          Sizes 12–40 as an actual rule. Replaces a trust-badge row with
          the one fact that genuinely reassures a parent buying online. */}
      <MeasureRule />

      {/* ═══ V. The makers ═════════════════════════════════════════════ */}
      <section aria-labelledby="makers-heading" className="border-t border-ink-edge/60 py-[12vh]">
        <div className="mx-auto grid w-full max-w-[112rem] gap-x-16 gap-y-10 px-6 sm:px-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Reveal>
              <h2 id="makers-heading" className="font-display text-chapter font-light text-paper">
                The makers
              </h2>
            </Reveal>
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <Reveal delay={120}>
              <p className="max-w-[46ch] text-lede text-paper-muted">
                We are a family shop on the ground floor at Texvalley, Gangapuram. Everything
                here is chosen by hand, checked by hand, and packed by someone who will answer
                the phone if it is wrong.
              </p>
            </Reveal>
            <Reveal delay={200}>
              <dl className="mt-12 grid gap-x-10 gap-y-7 sm:grid-cols-2">
                <div>
                  <dt className="text-rule uppercase text-paper-faint">Find us</dt>
                  <dd className="mt-2.5 text-paper-muted">
                    Shop No 131, Ground Floor<br />Texvalley, Gangapuram, Erode
                  </dd>
                </div>
                <div>
                  <dt className="text-rule uppercase text-paper-faint">Speak to us</dt>
                  <dd className="mt-2.5 space-y-1">
                    <a href={`tel:${STORE.phone1}`} className="block text-paper-muted transition-colors hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright">
                      {STORE.phone1}
                    </a>
                    <a href={MAIL_URL} className="block text-paper-muted transition-colors hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright">
                      {STORE.email}
                    </a>
                    <a href={MAIL_URL2} className="block text-paper-muted transition-colors hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright">
                      {STORE.email2}
                    </a>
                  </dd>
                </div>
              </dl>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══ VI. Recently kept ═════════════════════════════════════════
          New arrivals as an offset stagger. Never a uniform row. */}
      </div>
      </div>
    </div>
  );
}
