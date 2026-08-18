'use client';

import Link from 'next/link';
import Reveal from './Reveal';
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
      className="relative flex min-h-[100svh] items-center border-t border-white/8"
    >
      <div className="mx-auto w-full max-w-[112rem] px-6 py-[12vh] sm:px-10">
        <div className="grid gap-x-16 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Reveal>
              <p className="mb-7 text-rule uppercase text-maroon-300/70">In frame</p>
            </Reveal>

            {loading ? (
              // A composed holding state, not a spinner: the frame is already
              // correct, only the name is missing.
              <div className="space-y-5" aria-live="polite" aria-busy="true">
                <div className="h-14 w-3/4 animate-pulse rounded-sm bg-white/8" />
                <div className="h-5 w-1/3 animate-pulse rounded-sm bg-white/8" />
                <span className="sr-only">Loading the featured piece</span>
              </div>
            ) : product ? (
              <>
                <Reveal delay={100}>
                  <h2 id="heirloom-heading" className="font-display text-chapter font-light text-white">
                    {product.name}
                  </h2>
                </Reveal>

                {product.description && (
                  <Reveal delay={180}>
                    <p className="mt-7 max-w-[46ch] text-lede text-white/55">
                      {product.description}
                    </p>
                  </Reveal>
                )}

                <Reveal delay={250}>
                  <div className="mt-10 flex flex-wrap items-baseline gap-x-8 gap-y-3">
                    <span className="font-display text-[1.9rem] tabular-nums text-white">
                      {inr.format(product.price)}
                    </span>
                    {product.compare_price != null && product.compare_price > product.price && (
                      <span className="text-white/35 line-through tabular-nums">
                        {inr.format(product.compare_price)}
                      </span>
                    )}
                  </div>
                </Reveal>

                <Reveal delay={320}>
                  <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
                    <Link
                      href={`/products/${product.id}`}
                      className="inline-flex items-center gap-3 bg-white px-8 py-4 text-caption uppercase text-night transition-colors duration-500 hover:bg-maroon-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-maroon-300"
                    >
                      View this piece
                    </Link>
                    <Link
                      href="/products?featured=1"
                      className="text-caption uppercase text-white/45 transition-colors duration-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-maroon-300"
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
                  <h2 id="heirloom-heading" className="font-display text-chapter font-light text-white">
                    The frame is set
                  </h2>
                </Reveal>
                <Reveal delay={180}>
                  <p className="mt-7 max-w-[44ch] text-lede text-white/55">
                    New pieces are being photographed. Until they arrive, the room stays
                    lit and the cloth stays hung.
                  </p>
                </Reveal>
                <Reveal delay={250}>
                  <Link
                    href="/products"
                    className="mt-10 inline-flex items-center gap-3 border-b border-white/25 pb-2 text-caption uppercase text-white transition-colors duration-500 hover:border-maroon-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-maroon-300"
                  >
                    Browse the shop
                  </Link>
                </Reveal>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
