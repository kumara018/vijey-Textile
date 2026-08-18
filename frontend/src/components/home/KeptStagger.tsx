'use client';

import Link from 'next/link';
import Reveal from './Reveal';
import TrousseauCard from '@/components/product/TrousseauCard';
import type { Product } from '@/types';

/**
 * Recently kept — new arrivals as an offset stagger.
 *
 * Never a uniform row. Each item carries its own column span and vertical
 * offset, so the eye descends in a zigzag rather than scanning a rank. The
 * pattern is fixed rather than random: a random layout reflows differently on
 * every visit, which reads as instability, and it also makes a specific piece
 * impossible to find again.
 *
 * The offsets only apply from `lg` up. On a phone this is a single clean
 * column — a stagger inside 360px is just misalignment.
 */

/** span / top-offset in rem / whether the card gets the larger treatment. */
const RHYTHM: { span: string; offset: string; large: boolean }[] = [
  { span: 'lg:col-span-6', offset: 'lg:mt-0',   large: true  },
  { span: 'lg:col-span-4', offset: 'lg:mt-32',  large: false },
  { span: 'lg:col-span-4', offset: 'lg:mt-10',  large: false },
  { span: 'lg:col-span-5', offset: 'lg:mt-24',  large: true  },
  { span: 'lg:col-span-3', offset: 'lg:mt-0',   large: false },
  { span: 'lg:col-span-4', offset: 'lg:mt-40',  large: false },
  { span: 'lg:col-span-5', offset: 'lg:mt-14',  large: true  },
];

export default function KeptStagger({
  items,
  loading,
}: {
  items: Product[];
  loading: boolean;
}) {
  return (
    <section aria-labelledby="kept-heading" className="border-t border-white/8 py-[12vh]">
      <div className="mx-auto w-full max-w-[112rem] px-6 sm:px-10">
        <div className="mb-[8vh] flex flex-wrap items-baseline justify-between gap-6">
          <Reveal>
            <h2 id="kept-heading" className="font-display text-chapter font-light text-white">
              Recently kept
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <Link
              href="/products"
              className="group inline-flex items-baseline gap-3 border-b border-white/20 pb-1.5 text-caption uppercase text-white/70 transition-colors duration-500 hover:border-maroon-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-maroon-300"
            >
              Everything
              <span aria-hidden="true" className="transition-transform duration-500 group-hover:translate-x-1">→</span>
            </Link>
          </Reveal>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-x-10 gap-y-14 sm:grid-cols-2 lg:grid-cols-12" aria-busy="true">
            {RHYTHM.slice(0, 4).map((r, i) => (
              <div key={i} className={`${r.span} ${r.offset}`}>
                <div className="aspect-[4/5] w-full animate-pulse rounded-sm bg-white/6" />
                <div className="mt-5 h-4 w-2/3 animate-pulse rounded-sm bg-white/6" />
              </div>
            ))}
            <span className="sr-only">Loading recent pieces</span>
          </div>
        ) : items.length === 0 ? (
          <p className="max-w-[44ch] text-lede text-white/45">
            Nothing new is on the floor this week. The shop is at Texvalley, Gangapuram —
            come and see what is on the rail.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-x-10 gap-y-14 sm:grid-cols-2 lg:grid-cols-12">
            {items.slice(0, RHYTHM.length).map((p, i) => {
              const r = RHYTHM[i % RHYTHM.length];
              return (
                <li key={p.id} className={`${r.span} ${r.offset}`}>
                  <Reveal delay={(i % 3) * 90}>
                    <TrousseauCard product={p} large={r.large} />
                  </Reveal>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
