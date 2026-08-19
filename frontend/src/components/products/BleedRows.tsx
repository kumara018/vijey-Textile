'use client';

import Link from 'next/link';
import Reveal from '@/components/home/Reveal';
import type { Product } from '@/types';
import { clothFor, boltGround } from '@/lib/cloth';
import { rowPlan, type Rhythm } from '@/lib/categories';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
});

/**
 * Full-bleed alternating rows — the listing grid.
 *
 * The uniform card grid is gone. Rows carry one, two or three pieces and the
 * sequence differs per category, so the eye crosses the page rather than
 * scanning columns and no two category landings scan alike even with identical
 * stock.
 *
 * A single-piece row is a plate: full width, wide aspect, the garment given
 * room. Three-piece rows are the closest thing to a conventional grid and exist
 * to give the rhythm somewhere to breathe — without them a long catalogue
 * becomes exhausting.
 *
 * What matters commercially, and what the cinematic treatment must never cost:
 * name, price and the route into the product are plain DOM on every tile, from
 * first paint, with one tab stop each. A shopper working through forty lehengas
 * never waits for a beat.
 */

function Tile({ product, size, index }: { product: Product; size: 1 | 2 | 3; index: number }) {
  const image = product.images?.[0] ?? null;
  const discounted = product.compare_price != null && product.compare_price > product.price;
  const soldOut = product.stock <= 0;

  // A plate is landscape and cinematic; a pair is portrait; a triple is the
  // tightest. Aspect carries most of the difference between row types.
  const aspect = size === 1 ? '16 / 9' : size === 2 ? '4 / 5' : '3 / 4';

  return (
    <Link
      href={`/products/${product.id}`}
      aria-label={`${product.name}, ${inr.format(product.price)}${soldOut ? ', sold out' : ''}`}
      className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-brass-bright"
    >
      <div
        className="relative overflow-hidden bg-ink-raised
                   motion-safe:transition-transform motion-safe:duration-[560ms]
                   motion-safe:ease-[cubic-bezier(0.22,0.61,0.24,1)]
                   motion-safe:group-hover:-translate-y-1.5"
        style={{ aspectRatio: aspect }}
      >
        {image ? (
          <img
            src={image}
            alt=""
            loading={index < 3 ? 'eager' : 'lazy'}
            decoding="async"
            className="h-full w-full object-cover
                       motion-safe:transition-transform motion-safe:duration-[900ms]
                       motion-safe:ease-[cubic-bezier(0.22,0.61,0.24,1)]
                       motion-safe:group-hover:scale-[1.03]"
          />
        ) : (
          /* The bolt, not an empty rectangle — see lib/cloth.ts. The shelf is
             where this matters most: a grid of unphotographed stock rendered
             as identical dark plates reads as a page that failed to load. */
          <div
            style={boltGround(clothFor(product.category), product.id)}
            className="flex h-full w-full flex-col justify-between p-6"
          >
            <span className="text-rule uppercase" style={{ color: clothFor(product.category).ink, opacity: 0.5 }}>
              Not yet photographed
            </span>
          </div>
        )}

        {/* The light sweep — cloth turned toward a window. Decorative. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0 motion-safe:transition-opacity motion-safe:duration-700 motion-safe:group-hover:opacity-100"
          style={{
            background:
              'linear-gradient(105deg, transparent 34%, rgba(196,132,26,0.13) 48%, rgba(250,250,249,0.16) 52%, rgba(161,98,7,0.10) 57%, transparent 72%)',
          }}
        />

        {soldOut && (
          <span className="absolute inset-x-0 bottom-0 bg-ink-deep/85 px-4 py-2.5 text-center text-rule uppercase text-paper-muted">
            Sold out
          </span>
        )}
        {!soldOut && discounted && (
          <span className="absolute left-0 top-0 bg-brass px-3 py-1.5 text-rule uppercase text-ink">
            Reduced
          </span>
        )}
      </div>

      <h3
        className={`mt-5 font-display font-light text-paper/90 transition-colors duration-500 group-hover:text-paper ${
          size === 1 ? 'text-[1.6rem] sm:text-[2.1rem]' : size === 2 ? 'text-[1.25rem]' : 'text-[1.05rem]'
        } leading-tight`}
      >
        {product.name}
      </h3>

      {/* Title above the rule, price below it — the Trousseau card anatomy. */}
      <div className="mt-3 border-t border-ink-edge/70 pt-3">
        <p className="flex items-baseline gap-3 text-caption uppercase">
          <span className="tabular-nums text-paper">{inr.format(product.price)}</span>
          {discounted && (
            <span className="tabular-nums text-paper-faint/70 line-through">
              {inr.format(product.compare_price as number)}
            </span>
          )}
        </p>
      </div>
    </Link>
  );
}

export default function BleedRows({
  products,
  rhythm,
}: {
  products: Product[];
  rhythm: Rhythm;
}) {
  const plan = rowPlan(rhythm, products.length);

  let cursor = 0;
  const rows = plan.map((size) => {
    const slice = products.slice(cursor, cursor + size);
    cursor += size;
    return { size, slice };
  });

  return (
    <div className="space-y-[7vh]">
      {rows.map((row, r) => (
        <div
          key={r}
          className={
            row.size === 1
              ? 'grid grid-cols-1'
              : row.size === 2
              ? 'grid grid-cols-1 gap-x-10 gap-y-[7vh] sm:grid-cols-2'
              : 'grid grid-cols-2 gap-x-8 gap-y-[7vh] lg:grid-cols-3'
          }
        >
          {row.slice.map((p, i) => (
            <Reveal key={p.id} delay={i * 90}>
              <Tile product={p} size={row.size as 1 | 2 | 3} index={r * 3 + i} />
            </Reveal>
          ))}
        </div>
      ))}
    </div>
  );
}
