'use client';

import Link from 'next/link';
import Reveal from './Reveal';

/**
 * The measure — sizes 12 to 40, drawn as an actual rule.
 *
 * This replaced the four trust badges. Those badges ("Free shipping", "Secure
 * payment", "Easy returns", "Genuine products") are conversion furniture: every
 * shop has them, so they persuade nobody. The single fact that genuinely
 * reassures a parent buying a child's garment online is whether it will fit,
 * and that fact deserves a section rather than an icon.
 *
 * Drawn with CSS gradients rather than an SVG or an image — it is a repeating
 * tick pattern, which is exactly what a gradient does natively and at any
 * width. The numerals are the content; the ticks are the structure.
 */

const SIZES = [12, 16, 20, 24, 28, 32, 36, 40];

export default function MeasureRule() {
  return (
    <section aria-labelledby="measure-heading" className="border-t border-ink-edge py-[6vh]">
      <div className="mx-auto w-full max-w-[112rem] px-6 sm:px-10">
        <div className="grid gap-x-16 gap-y-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Reveal>
              <h2 id="measure-heading" className="font-display text-chapter font-light text-paper">
                Twelve to forty
              </h2>
            </Reveal>
            <Reveal delay={120}>
              <p className="mt-6 max-w-[38ch] text-lede text-paper-muted">
                Every piece is cut across the full range. A younger sister and an older
                cousin can wear the same design to the same wedding.
              </p>
            </Reveal>
            <Reveal delay={200}>
              <Link
                href="/products"
                className="mt-8 inline-flex items-baseline gap-3 border-b border-ink-edge pb-1.5 text-caption uppercase text-paper transition-colors duration-500 hover:border-maroon-300 hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-maroon-300"
              >
                See every piece
                <span aria-hidden="true">→</span>
              </Link>
            </Reveal>
          </div>

          <div className="lg:col-span-7 lg:col-start-6">
            <Reveal delay={160}>
              {/* The rule. aria-hidden because the numerals below carry the
                  same information in a form a screen reader can use. */}
              <div
                aria-hidden="true"
                className="h-14 w-full"
                style={{
                  backgroundImage: [
                    // Minor ticks, every 1/40th.
                    'repeating-linear-gradient(90deg, rgba(255,255,255,0.16) 0 1px, transparent 1px 2.5%)',
                    // Major ticks at each labelled size.
                    'repeating-linear-gradient(90deg, rgba(181,161,138,0.55) 0 1px, transparent 1px 12.5%)',
                  ].join(','),
                  backgroundSize: '100% 40%, 100% 100%',
                  backgroundPosition: '0 100%, 0 100%',
                  backgroundRepeat: 'repeat-x',
                }}
              />
              {/**
                * THE NUMERALS ARE THE CONTROL.
                *
                * They were decoration — a printed scale under a rule — beside a
                * "Shop by size" link that went to the unfiltered shelf, because
                * no size filter existed anywhere in the shop. Tapping 24 to see
                * what comes in 24 is the obvious gesture, and it did nothing.
                *
                * Each numeral is a link to the shelf filtered to that size now.
                * The rule above stays aria-hidden; these carry the same
                * information in a form a screen reader and a thumb can both use.
                */}
              <ol className="mt-4 flex justify-between">
                {SIZES.map((s) => (
                  <li key={s}>
                    <Link
                      href={`/products?size=${s}`}
                      aria-label={`See every piece in size ${s}`}
                      className="block font-display text-[1.05rem] tabular-nums text-paper-muted transition-colors duration-300 hover:text-brass-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright sm:text-[1.35rem]"
                    >
                      {s}
                    </Link>
                  </li>
                ))}
              </ol>
              <p className="mt-8 text-rule uppercase text-paper-faint">
                Measured across the chest, in inches
              </p>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
