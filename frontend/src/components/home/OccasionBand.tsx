'use client';

import Link from 'next/link';
import Reveal from './Reveal';

/**
 * A full-bleed occasion band.
 *
 * This is what replaced the category grid. A uniform grid of six tiles asks the
 * visitor to translate "my niece's naming day" into a taxonomy term; a band
 * states the occasion in their own words and hands them the category behind it.
 *
 * Alternating alignment gives the section a rhythm a grid cannot have — the eye
 * crosses the page three times on the way down rather than scanning columns.
 * The rule and the numeral do real work: they are the only ornament, and they
 * encode sequence, which is genuinely true of the content.
 */
export default function OccasionBand({
  index,
  title,
  note,
  copy,
  category,
  align,
}: {
  index: string;
  title: string;
  note: string;
  copy: string;
  category: string;
  align: 'left' | 'right';
}) {
  /**
   * ONE COMPACT ROW, NOT AN ALTERNATING SPREAD.
   *
   * These alternated left and right across a 12-column grid, so every band
   * left half the row deliberately empty — three of them stacked meant three
   * screens of mostly nothing between the products and the rest of the shop.
   * Reported as exactly that: "don't leave this much space".
   *
   * White space is worth paying for when it frames something. Framing an
   * empty half-row frames nothing. The numeral, the title, the line and the
   * link now sit on one row that is as tall as its content, and the alignment
   * no longer alternates — a reader's eye should not have to cross the page
   * to find where the next item starts.
   */
  void align;

  return (
    <article className="border-t border-ink-edge first:border-t-0">
      <div className="mx-auto w-full max-w-[112rem] px-6 sm:px-10">
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3 py-6">
          <span className="font-display text-[0.82rem] tabular-nums text-brass-bright/70">
            {index}
          </span>

          <h3 className="font-display text-[clamp(1.25rem,2.2vw,1.7rem)] font-light leading-tight text-paper">
            {title}
          </h3>

          <p className="min-w-[16rem] flex-1 text-paper-muted">{copy}</p>

          <Link
            href={`/products?category=${encodeURIComponent(category)}`}
            className="group inline-flex shrink-0 items-baseline gap-3 border-b border-ink-edge pb-1 text-caption uppercase text-paper transition-colors duration-500 hover:border-brass-bright hover:text-brass-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
          >
            {category}
            <span aria-hidden="true" className="transition-transform duration-500 group-hover:translate-x-1">&rarr;</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
