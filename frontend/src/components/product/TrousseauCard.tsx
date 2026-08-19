'use client';

import Link from 'next/link';
import type { Product } from '@/types';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
});

/**
 * The Trousseau card.
 *
 * Anatomy, stated because it is the half of the brand split that is structural
 * rather than stylistic:
 *
 *   - the image FILLS a 4:5 plate, edge to edge, no inset margin
 *   - the title sits ABOVE a hairline rule, in the warm display serif
 *   - the price sits BELOW that rule, as a small caption
 *   - press lifts the card and sweeps a warm light across the image, the way
 *     you turn a piece of cloth toward a window
 *
 * The sister site inverts every one of those: image inset within the card so
 * the whitespace is the card, title and price on the same baseline at the same
 * size, and a hover that cross-dissolves to a second frame without lifting.
 *
 * Accessibility notes that matter on a shopping grid:
 *   - one link wraps the whole card, so there is a single tab stop per product
 *     rather than three
 *   - the accessible name carries name AND price, so a screen-reader user
 *     hears what they are choosing without exploring the card
 *   - the light sweep is decorative and sits behind aria-hidden
 */
export default function TrousseauCard({
  product,
  large = false,
}: {
  product: Product;
  large?: boolean;
}) {
  const image = product.images?.[0] ?? null;
  const discounted =
    product.compare_price != null && product.compare_price > product.price;

  return (
    <Link
      href={`/products/${product.id}`}
      aria-label={`${product.name}, ${inr.format(product.price)}`}
      className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-maroon-300"
    >
      <div
        className="relative overflow-hidden bg-night-raised
                   motion-safe:transition-transform motion-safe:duration-[560ms]
                   motion-safe:ease-[cubic-bezier(0.22,0.61,0.24,1)]
                   motion-safe:group-hover:-translate-y-2 motion-safe:group-active:-translate-y-1"
        style={{ aspectRatio: '4 / 5' }}
      >
        {image ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover
                       motion-safe:transition-transform motion-safe:duration-[900ms]
                       motion-safe:ease-[cubic-bezier(0.22,0.61,0.24,1)]
                       motion-safe:group-hover:scale-[1.035]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-rule uppercase text-paper-faint">No photograph</span>
          </div>
        )}

        {/* The light sweep. A warm band crossing the plate on hover — cloth
            turned to a window. Purely decorative, and skipped under
            reduced motion. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0 motion-safe:transition-opacity motion-safe:duration-700 motion-safe:group-hover:opacity-100"
          style={{
            background:
              'linear-gradient(105deg, transparent 32%, rgba(227,191,203,0.16) 47%, rgba(255,242,246,0.26) 52%, rgba(197,128,89,0.12) 58%, transparent 74%)',
          }}
        />

        {discounted && (
          <span className="absolute left-0 top-0 bg-maroon-400 px-3 py-1.5 text-rule uppercase text-night">
            Reduced
          </span>
        )}
      </div>

      {/* Title above the rule, price below it. */}
      <h3
        className={`mt-5 font-display font-light text-paper transition-colors duration-500 group-hover:text-paper ${
          large ? 'text-[1.5rem] leading-tight sm:text-[1.85rem]' : 'text-[1.15rem] leading-snug'
        }`}
      >
        {product.name}
      </h3>

      <div className="mt-3 border-t border-ink-edge pt-3">
        <p className="flex items-baseline gap-3 text-caption uppercase text-paper-muted">
          <span className="tabular-nums text-paper">{inr.format(product.price)}</span>
          {discounted && (
            <span className="tabular-nums text-paper-faint line-through">
              {inr.format(product.compare_price as number)}
            </span>
          )}
        </p>
      </div>
    </Link>
  );
}
