'use client';

import Link from 'next/link';
import Reveal from './Reveal';
import { mediaUrl } from '@/lib/media';
import type { Product } from '@/types';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
});

/**
 * The heirloom in frame — one piece, one viewport.
 *
 * This is the NVIDIA-staging beat: a single subject commanding the composition,
 * lit by one dramatic key, with the camera craning slowly down it as the page
 * scrolls. The photograph itself is staged in the 3D scene behind this markup,
 * not rendered here — what lives here is only the type, held to the left third
 * so the frame stays open.
 *
 * The non-negotiable: name, price and the route to buying are plain DOM, always
 * legible, always reachable, and never gated behind the camera finishing its
 * move. A shopper who wants the price should never wait for a cinematic beat.
 */
export default function HeirloomPlate({
  product,
  loading,
}: {
  product: Product | null;
  loading: boolean;
}) {
  return (
    <section
      aria-labelledby="heirloom-heading"
      /**
       * IT SHOWS THE PHOTOGRAPH ITSELF NOW.
       *
       * This reserved a full viewport (`min-h-[100svh]`) and put only type in
       * it, because the garment was staged in the 3D scene BEHIND the markup.
       * That was true when the scene ran everywhere. It no longer runs on
       * phones at all, and on desktop it waits for an idle callback — so this
       * section became what the screenshot showed: a whole empty screen with a
       * name and a price floating in it.
       *
       * A homepage section whose entire subject lives in an optional
       * background is a section that breaks the moment the background becomes
       * optional. So the piece is rendered here, as an ordinary image, in the
       * markup that names it. The scene still adds depth behind it where it
       * runs; nothing depends on it any more.
       */
      className="relative border-t border-ink-edge"
    >
      <div className="mx-auto w-full max-w-[112rem] px-6 py-[6vh] sm:px-10">
        <div className="grid items-center gap-x-16 gap-y-8 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Reveal>
              <p className="mb-7 text-rule uppercase text-maroon-300/70">In frame</p>
            </Reveal>

            {loading ? (
              // A composed holding state, not a spinner: the frame is already
              // correct, only the name is missing.
              <div className="space-y-5" aria-live="polite" aria-busy="true">
                <div className="h-14 w-3/4 animate-pulse rounded-sm bg-ink-raised" />
                <div className="h-5 w-1/3 animate-pulse rounded-sm bg-ink-raised" />
                <span className="sr-only">Loading the featured piece</span>
              </div>
            ) : product ? (
              <>
                <Reveal delay={100}>
                  <h2 id="heirloom-heading" className="font-display text-chapter font-light text-paper">
                    {product.name}
                  </h2>
                </Reveal>

                {product.description && (
                  <Reveal delay={180}>
                    <p className="mt-7 max-w-[46ch] text-lede text-paper-muted">
                      {product.description}
                    </p>
                  </Reveal>
                )}

                <Reveal delay={250}>
                  <div className="mt-10 flex flex-wrap items-baseline gap-x-8 gap-y-3">
                    <span className="font-display text-[1.9rem] tabular-nums text-paper">
                      {inr.format(product.price)}
                    </span>
                    {product.compare_price != null && product.compare_price > product.price && (
                      <span className="text-paper-faint line-through tabular-nums">
                        {inr.format(product.compare_price)}
                      </span>
                    )}
                  </div>
                </Reveal>

                <Reveal delay={320}>
                  <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
                    <Link
                      href={`/products/${product.id}`}
                      className="inline-flex items-center gap-3 bg-ink-deep px-8 py-4 text-caption uppercase text-night transition-colors duration-500 hover:bg-maroon-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-maroon-300"
                    >
                      View this piece
                    </Link>
                    <Link
                      href="/products?featured=1"
                      className="text-caption uppercase text-paper-muted transition-colors duration-500 hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-maroon-300"
                    >
                      Other featured pieces
                    </Link>
                  </div>
                </Reveal>
              </>
            ) : (
              // Nothing featured and nothing new. The scene stages the material
              // alone behind this; the copy says so rather than pretending.
              <>
                <Reveal delay={100}>
                  <h2 id="heirloom-heading" className="font-display text-chapter font-light text-paper">
                    The frame is set
                  </h2>
                </Reveal>
                <Reveal delay={180}>
                  <p className="mt-7 max-w-[44ch] text-lede text-paper-muted">
                    New pieces are being photographed. Until they arrive, the room stays
                    lit and the cloth stays hung.
                  </p>
                </Reveal>
                <Reveal delay={250}>
                  <Link
                    href="/products"
                    className="mt-10 inline-flex items-center gap-3 border-b border-ink-edge pb-2 text-caption uppercase text-paper transition-colors duration-500 hover:border-maroon-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-maroon-300"
                  >
                    Browse the shop
                  </Link>
                </Reveal>
              </>
            )}
          </div>

          {/* The piece, actually visible. `object-cover` on a 4/5 plate so it
              reads the same as every card on the site. */}
          <div className="lg:col-span-6 lg:col-start-7">
            {product?.images?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaUrl(product.images[0])}
                alt={product.name}
                loading="lazy"
                className="aspect-[4/5] w-full object-cover"
              />
            ) : (
              <div className="aspect-[4/5] w-full bg-ink-raised" />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
