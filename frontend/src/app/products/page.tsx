'use client';
import { useState, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { SlidersHorizontal, X } from 'lucide-react';
import Fuse from 'fuse.js';
import { productsAPI } from '@/lib/api';
import { qk } from '@/lib/query';
import { Product } from '@/types';
import ProductCard from '@/components/ProductCard';
import Reveal from '@/components/home/Reveal';
import { identityFor, CATEGORY_ORDER } from '@/lib/categories';

/* 12 to 40 in twos — the range printed on the homepage rule, kept here as
   the one list the filter offers so the two cannot disagree. */
const SIZES = ['12', '14', '16', '18', '20', '22', '24', '26', '28', '30', '32', '34', '36', '38', '40'];

const SORT_OPTIONS = [
  { label: 'Newest first',    value: 'created_at:desc' },
  { label: 'Price: low–high', value: 'price:asc' },
  { label: 'Price: high–low', value: 'price:desc' },
  { label: 'Best rated',      value: 'rating_avg:desc' },
  { label: 'Name A–Z',        value: 'name:asc' },
];

function ProductsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [filtersOpen, setFiltersOpen] = useState(false);

  // Single source of truth — derived directly from the URL on every render, so
  // a shared link reproduces the exact rail the sender was looking at.
  const filters = {
    category: searchParams.get('category')  || '',
    search:   searchParams.get('search')    || '',
    minPrice: searchParams.get('min_price') || '',
    maxPrice: searchParams.get('max_price') || '',
    featured: searchParams.get('featured')  || '',
    size:     searchParams.get('size')      || '',
    sort:     searchParams.get('sort')      || 'created_at:desc',
  };

  // Backend may return the array directly or wrapped — normalise both.
  const unwrap = (raw: unknown): Product[] =>
    Array.isArray(raw)
      ? raw
      : ((raw as { products?: Product[] })?.products ??
         (raw as { items?: Product[] })?.items ??
         (raw as { data?: Product[] })?.data ??
         []);

  const [sortBy, sortOrder] = filters.sort.split(':');
  const params: Record<string, unknown> = { sort_by: sortBy, sort_order: sortOrder, limit: 40 };
  if (filters.category) params.category  = filters.category;
  if (filters.search)   params.search    = filters.search;
  if (filters.minPrice) params.min_price = Number(filters.minPrice);
  if (filters.maxPrice) params.max_price = Number(filters.maxPrice);
  if (filters.featured) params.featured  = true;
  if (filters.size)     params.size      = filters.size;

  /**
   * One query covers the exact search and the fuzzy fallback, because from the
   * page's point of view they are a single question: what should this rail show
   * for these filters? Two queries would let the cache hold a state where the
   * exact result is fresh and the fallback stale, and the rail would flicker.
   */
  const { data, isPending, isError } = useQuery({
    queryKey: qk.products.list(params),
    queryFn: async () => {
      const exact = unwrap((await productsAPI.getAll(params)).data);
      if (exact.length > 0 || !filters.search) {
        return { products: exact, total: exact.length, fuzzyMatch: '' };
      }

      const all = unwrap((await productsAPI.getAll({ limit: 100 })).data);
      if (all.length === 0) return { products: [], total: 0, fuzzyMatch: '' };

      const fuse = new Fuse(all, {
        keys: [{ name: 'name', weight: 0.7 }, { name: 'category', weight: 0.3 }],
        threshold: 0.45,
        minMatchCharLength: 2,
        ignoreLocation: true,
        includeScore: true,
      });
      const fuzzy = fuse.search(filters.search, { limit: 40 });
      if (fuzzy.length === 0) return { products: [], total: 0, fuzzyMatch: '' };

      const matched = fuzzy.map((r) => r.item);
      return {
        products: matched,
        total: matched.length,
        fuzzyMatch: fuzzy[0].item.category || fuzzy[0].item.name,
      };
    },
    /**
     * Retry on a genuine network error; never retry a 4xx the server actually
     * answered with — that is a considered reply, not a dropped call.
     *
     * EXPONENTIAL BACKOFF WITH JITTER, not a flat ten seconds.
     *
     * The previous setting was one retry after a fixed 10s. The failure drill
     * exposed what that costs: with the API down, a customer watches a skeleton
     * for ten full seconds before the page says anything at all. Ten seconds of
     * silence on a shop's main listing is long enough to leave.
     *
     * Three attempts at roughly 0.6s, 1.8s and 5.4s reach the same total
     * patience while making the FIRST retry almost immediate — which is the one
     * that actually rescues the common case, a single dropped request on a
     * flaky mobile connection. If all three fail the customer is told at ~8s
     * instead of ~10s, and has had two more chances to succeed on the way.
     *
     * The jitter matters when the cause is the backend restarting: without it,
     * every browser that failed together retries together and lands as one
     * synchronised wave on a server that has just come back up.
     */
    retry: (count, err: unknown) =>
      !(err as { response?: unknown })?.response && count < 3,
    retryDelay: (attempt) =>
      Math.min(600 * 3 ** attempt, 6_000) * (0.8 + Math.random() * 0.4),
    // Hold the previous rail on screen while the next loads, instead of
    // collapsing to skeletons on every filter change.
    placeholderData: (prev) => prev,
  });

  const products   = data?.products ?? [];
  const total      = data?.total ?? 0;
  const fuzzyMatch = data?.fuzzyMatch ?? '';
  const loading    = isPending;

  // Filters write to the URL only; the query reads back from it.
  const setF = (key: string, val: string) => {
    const urlKeyMap: Record<string, string> = { minPrice: 'min_price', maxPrice: 'max_price' };
    const urlKey = urlKeyMap[key] ?? key;
    const next = new URLSearchParams(searchParams.toString());
    if (val) next.set(urlKey, val);
    else next.delete(urlKey);
    router.replace(`/products${next.toString() ? '?' + next.toString() : ''}`, { scroll: false });
  };

  const clearFilters = () => router.replace('/products', { scroll: false });

  const hasFilters = Boolean(
    filters.category || filters.search || filters.minPrice || filters.maxPrice || filters.featured,
  );

  /**
   * Editorial identity for this entry point.
   *
   * The six category links are query params on one page — the right
   * architecture, and the wrong experience if the page merely swaps a heading.
   * A parent arriving from "Lehenga" lands on copy that knows what a lehenga is
   * for, and on a row rhythm that differs from every other category, so this
   * never reads as one generic grid with a chip pre-selected.
   */
  const identity = identityFor(filters.category, filters.search);

  const railClass =
    'group relative py-1 text-caption uppercase transition-colors duration-500 ' +
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright';
  const ruleClass =
    'absolute bottom-0 left-0 h-px w-full origin-left bg-brass ' +
    'transition-transform duration-[520ms] ease-[cubic-bezier(0.22,0.61,0.24,1)]';

  return (
    <div className="text-paper-muted">
      {/**
        * ═══ Category masthead ═══════════════════════════════════════════
        *
        * IT WAS HALF A SCREEN OF TYPE BEFORE A SINGLE GARMENT. A rule-sized
        * eyebrow, then `text-chapter` — up to 104px — animating in a letter at
        * a time, then a paragraph under it. On a laptop a customer scrolled
        * past all of that to reach the products; on a phone, further.
        *
        * Shrinking the standfirst made it worse rather than better, and that
        * is worth recording: once the paragraph was one short line it said
        * almost exactly what the headline above it said, so the page repeated
        * itself twice at two different sizes. The fix was not a shorter
        * paragraph, it was no paragraph.
        *
        * The eyebrow carries the character now — it is short by nature — and
        * the heading is the category's plain NAME at a size a heading needs
        * rather than a size that makes a point. Amazon puts the category name
        * and the results on one screen; so does this.
        */}
      <section className="border-b border-ink-edge/60 px-6 pb-6 pt-28 sm:px-10">
        <div className="mx-auto w-full max-w-[112rem]">
          <Reveal>
            <p className="mb-2 text-rule uppercase text-brass-bright">{identity.eyebrow}</p>
          </Reveal>

          <h1 className="font-display text-[clamp(1.6rem,3vw,2.4rem)] font-light leading-tight text-paper">
            {identity.slug || 'Every piece'}
          </h1>

          {/* Category rail — always visible, so all six entry points are
              reachable from any one of them without opening the Index. */}
          <Reveal delay={300}>
            <nav aria-label="Categories" className="mt-12 flex flex-wrap items-center gap-x-7 gap-y-3">
              <button
                type="button"
                onClick={clearFilters}
                aria-current={!filters.category && !filters.search ? 'page' : undefined}
                className={`${railClass} ${!filters.category && !filters.search ? 'text-paper' : 'text-paper-faint hover:text-paper'}`}
              >
                All pieces
                <span aria-hidden="true" className={`${ruleClass} ${!filters.category && !filters.search ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`} />
              </button>

              {CATEGORY_ORDER.map((c) => {
                const active = filters.category === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setF('category', active ? '' : c)}
                    aria-current={active ? 'page' : undefined}
                    className={`${railClass} ${active ? 'text-paper' : 'text-paper-faint hover:text-paper'}`}
                  >
                    {c}
                    <span aria-hidden="true" className={`${ruleClass} ${active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`} />
                  </button>
                );
              })}
            </nav>
          </Reveal>

          {/* Count + refine. aria-live so a filter change is announced rather
              than silently re-rendering the rail under a screen-reader user. */}
          <div className="mt-10 flex flex-wrap items-center justify-between gap-5">
            <p aria-live="polite" className="text-caption uppercase text-paper-faint">
              {loading ? 'Looking…' : `${total} piece${total === 1 ? '' : 's'}`}
              {fuzzyMatch && !loading && (
                <span className="ml-3 text-brass-bright">nearest match: {fuzzyMatch}</span>
              )}
            </p>

            <div className="flex items-center gap-6">
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-2 text-caption uppercase text-paper-faint transition-colors duration-500 hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
                >
                  <X size={13} aria-hidden="true" /> Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                aria-expanded={filtersOpen}
                aria-controls="refine-panel"
                className="inline-flex items-center gap-2.5 border border-ink-edge px-4 py-2 text-caption uppercase text-paper-muted transition-colors duration-500 hover:border-brass hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
              >
                <SlidersHorizontal size={13} aria-hidden="true" /> Refine
              </button>
            </div>
          </div>

          {/* Refine panel. Collapses via grid-template-rows rather than
              display:none, so it opens on the same easing as everything else
              instead of snapping. */}
          <div
            id="refine-panel"
            className="grid transition-[grid-template-rows,opacity] duration-[520ms] ease-[cubic-bezier(0.22,0.61,0.24,1)]"
            style={{ gridTemplateRows: filtersOpen ? '1fr' : '0fr', opacity: filtersOpen ? 1 : 0 }}
          >
            <div className="overflow-hidden">
              <div className="mt-8 grid gap-x-10 gap-y-7 border-t border-ink-edge/60 pt-8 sm:grid-cols-2 lg:grid-cols-4">
                {/**
                  * SIZE, WHICH IS THE FILTER THIS SHOP MOST NEEDED AND DID NOT
                  * HAVE.
                  *
                  * Everything here is cut 12 to 40, and a parent is buying for
                  * one child — so "which of these comes in 24" is the first
                  * question, ahead of price and ahead of order. There was no
                  * way to ask it: no control here, no `size` parameter on the
                  * API, and "Shop by size" on the homepage pointed at the
                  * unfiltered shelf because there was nothing to point at.
                  *
                  * A row of buttons rather than a select: fifteen sizes is
                  * short enough to show, one tap instead of two, and the
                  * chosen one is visible without opening anything. It reads
                  * from and writes to the URL like every other filter, so a
                  * size-filtered rail can be shared as a link.
                  */}
                <div className="sm:col-span-2 lg:col-span-4">
                  <span className="text-rule uppercase text-paper-faint">Size</span>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {SIZES.map((sz) => {
                      const on = filters.size === sz;
                      return (
                        <button
                          key={sz}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setF('size', on ? '' : sz)}
                          className={`min-w-[3rem] border px-3 py-2 text-sm tabular-nums transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright ${
                            on
                              ? 'border-brass bg-maroon-600 text-white'
                              : 'border-ink-edge text-paper-muted hover:border-brass-bright hover:text-paper'
                          }`}
                        >
                          {sz}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label htmlFor="sort" className="text-rule uppercase text-paper-faint">Order</label>
                  <select
                    id="sort"
                    value={filters.sort}
                    onChange={(e) => setF('sort', e.target.value)}
                    className="mt-3 w-full border border-ink-edge bg-ink-raised px-3 py-2.5 text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="min-price" className="text-rule uppercase text-paper-faint">From (₹)</label>
                  <input
                    id="min-price" type="number" inputMode="numeric" min={0}
                    value={filters.minPrice}
                    onChange={(e) => setF('minPrice', e.target.value)}
                    className="mt-3 w-full border border-ink-edge bg-ink-raised px-3 py-2.5 tabular-nums text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
                  />
                </div>
                <div>
                  <label htmlFor="max-price" className="text-rule uppercase text-paper-faint">To (₹)</label>
                  <input
                    id="max-price" type="number" inputMode="numeric" min={0}
                    value={filters.maxPrice}
                    onChange={(e) => setF('maxPrice', e.target.value)}
                    className="mt-3 w-full border border-ink-edge bg-ink-raised px-3 py-2.5 tabular-nums text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ The rail ══════════════════════════════════════════════════ */}
      <section aria-label="Pieces" className="px-6 pb-[4.5vh] pt-[3vh] sm:px-10">
        <div className="mx-auto w-full max-w-[112rem]">
          {loading ? (
            <div className="space-y-[7vh]" aria-busy="true">
              <div className="aspect-[16/9] w-full animate-pulse bg-ink-raised" />
              <div className="grid gap-x-10 sm:grid-cols-2">
                {[0, 1].map((i) => <div key={i} className="aspect-[4/5] animate-pulse bg-ink-raised" />)}
              </div>
              <span className="sr-only">Loading pieces</span>
            </div>
          ) : isError ? (
            /* Designed error state: says what happened, reassures about the
               things a shopper actually worries about, offers the one action
               that helps. */
            <div role="alert" className="max-w-[44ch]">
              <h2 className="font-display text-band font-light text-paper">The rail didn&rsquo;t load</h2>
              <p className="mt-5 text-lede text-paper-muted">
                The connection dropped on the way. Nothing is wrong with your bag or your account.
              </p>
              <button
                type="button"
                onClick={() => router.refresh()}
                className="mt-8 inline-flex items-center bg-paper px-7 py-3.5 text-caption uppercase text-ink transition-colors duration-500 hover:bg-brass-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
              >
                Try again
              </button>
            </div>
          ) : products.length === 0 ? (
            /* Designed empty state, worded for the specific reason it is empty
               rather than a generic "no results found". */
            <div className="max-w-[46ch]">
              <h2 className="font-display text-band font-light text-paper">
                {filters.search ? 'Nothing under that name' : 'This rail is empty just now'}
              </h2>
              <p className="mt-5 text-lede text-paper-muted">
                {filters.search
                  ? 'Try a shorter word, or look through everything — the shop is small enough to browse in a minute.'
                  : 'New pieces arrive most weeks. The shop is at Texvalley, Gangapuram, if you would rather see the rail in person.'}
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-8 inline-flex items-center gap-3 border-b border-brass/70 pb-2 text-caption uppercase text-paper transition-colors duration-500 hover:border-brass-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
              >
                See every piece <span aria-hidden="true">&rarr;</span>
              </button>
            </div>
          ) : (
            /**
             * A UNIFORM GRID, NOT AN EDITORIAL RUN.
             *
             * BleedRows gave each piece a size of 1, 2 or 3 and alternated them
             * by category rhythm, so the shelf read like a lookbook: one
             * garment could take the full width and most of the viewport. Good
             * to be looked at, poor to be shopped — comparing two lehengas
             * meant scrolling between them, and each price arrived a screen
             * after its photograph.
             *
             * Four across on a laptop, two on a phone, every card the same
             * size, each carrying photograph, name, price and Add to bag.
             */
            <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductsContent />
    </Suspense>
  );
}
