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
import HeirloomPlate from '@/components/home/HeirloomPlate';
import MeasureRule from '@/components/home/MeasureRule';
import KeptStagger from '@/components/home/KeptStagger';
import SequenceHero from '@/components/hero/SequenceHero';

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

  // The lead piece: a featured item if one exists, otherwise the newest. If
  // neither resolves the scene stages the material alone, which is a composed
  // state rather than a broken one.
  // A live product always wins. The fixture only fills in when the catalogue
  // returns nothing, so the hero is never an empty state.
  const hero = featuredItems[0] ?? recentItems[0] ?? (HERO_FIXTURE as unknown as Product);

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
          background:
            'linear-gradient(96deg, rgba(20,18,16,0.97) 0%, rgba(20,18,16,0.93) 30%, rgba(20,18,16,0.62) 46%, rgba(20,18,16,0.18) 60%, rgba(20,18,16,0) 72%)',
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
        * The section is 240svh tall and its inner frame is sticky, so the
        * viewport holds still while the scroll drives the camera move and the
        * garment grows from a held plate to full bleed. The move therefore
        * plays over a real distance instead of being over within one screen.
        *
        * `overflow-hidden` on the sticky frame is load-bearing: the scaled
        * media is clipped to the frame, so nothing bleeds into the sections
        * below no matter how far it grows.
        */}
      <section className="relative h-[240svh]">
        <div className="sticky top-0 flex h-[100svh] flex-col justify-end overflow-hidden px-6 pb-[14vh] pt-40 sm:px-10">
          {/* The pre-rendered camera move. Its poster paints immediately and
              stands alone if the sequence never arrives. */}
          <SequenceHero />

          <div className="relative z-10 mx-auto w-full max-w-[112rem]">
          <Reveal>
            <p className="mb-8 text-rule uppercase text-brass-bright">
              Texvalley&nbsp;·&nbsp;Erode&nbsp;·&nbsp;Sizes 12–40
            </p>
          </Reveal>

          <Reveal delay={120}>
            <h1 className="max-w-[min(15ch,50vw)] font-display text-plate font-light text-paper">
              Heirloom pieces, worn once, remembered always
            </h1>
          </Reveal>

          <Reveal delay={260}>
            <div className="mt-12 flex flex-wrap items-center gap-x-10 gap-y-5">
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
      <section aria-labelledby="occasion-heading" className="border-t border-ink-edge/60 py-[12vh]">
        <div className="mx-auto mb-[9vh] w-full max-w-[112rem] px-6 sm:px-10">
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
                  <dd className="mt-2.5 text-white/75">
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
      <KeptStagger items={recentItems} loading={recent.isPending} />

      </div>
      </div>
    </div>
  );
}
