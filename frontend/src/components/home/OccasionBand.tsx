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
  const right = align === 'right';

  return (
    <article className="border-t border-ink-edge first:border-t-0">
      <div className="mx-auto w-full max-w-[112rem] px-6 sm:px-10">
        <div
          className={`grid gap-x-16 gap-y-6 py-[9vh] lg:grid-cols-12 ${
            right ? 'lg:text-right' : ''
          }`}
        >
          <div className={`lg:col-span-2 ${right ? 'lg:order-2 lg:col-start-11' : ''}`}>
            <Reveal>
              <span className="font-display text-[0.82rem] tabular-nums text-maroon-300/60">
                {index}
              </span>
            </Reveal>
          </div>

          <div className={`lg:col-span-9 ${right ? 'lg:order-1 lg:col-start-2' : 'lg:col-start-3'}`}>
            <Reveal delay={80}>
              <h3 className="font-display text-band font-light text-paper">{title}</h3>
            </Reveal>

            <Reveal delay={160}>
              <p className={`mt-6 max-w-[52ch] text-lede text-paper-muted ${right ? 'lg:ml-auto' : ''}`}>
                {copy}
              </p>
            </Reveal>

            <Reveal delay={240}>
              <div className={`mt-9 flex items-baseline gap-6 ${right ? 'lg:justify-end' : ''}`}>
                <Link
                  href={`/products?category=${encodeURIComponent(category)}`}
                  className="group inline-flex items-baseline gap-3 border-b border-ink-edge pb-1.5 text-caption uppercase text-paper transition-colors duration-500 hover:border-maroon-300 hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-maroon-300"
                >
                  {category}
                  <span aria-hidden="true" className="transition-transform duration-500 group-hover:translate-x-1">→</span>
                </Link>
                <span className="text-rule uppercase text-paper-faint">{note}</span>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </article>
  );
}
