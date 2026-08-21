'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchHistory } from '@/lib/searchHistory';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { productsAPI } from '@/lib/api';
import { mediaUrl } from '@/lib/media';
import { clothFor, boltGround } from '@/lib/cloth';
import type { Product } from '@/types';

/**
 * Search, in the header.
 *
 * THIS REPLACES A FULL-SCREEN OVERLAY, on instruction and correctly. The
 * overlay was built as an event — the glass drawn large, the page taken over,
 * the categories offered underneath. It photographs well and it is the wrong
 * shape for someone who came to find one thing: it covers the products you
 * were looking at, it needs a deliberate Close, and on a phone it is a whole
 * screen of chrome between a customer and a lehenga.
 *
 * Amazon's search never leaves the header, and the shop asked for this shop's
 * search to work the way the sister shop's does. So the glass IS the field: it
 * grows a line to write on, and answers drop under it while the page stays
 * where it was.
 *
 * So the glass IS the field. Pressing it lets the rail grow a line to write on,
 * and the answers arrive on a slip of paper laid under the counter: a hairline
 * sheet, no shadow, because a drop shadow on a paper ground reads as a floating
 * tile and this shop has refused that throughout.
 *
 * THE ANSWERS SHOW THE CLOTH. A piece with no photograph is drawn as its dye
 * (lib/dyes.ts) rather than as a grey square, so a result list of unphotographed
 * stock still reads as a shelf of cloth. That is the same decision as the
 * product plates, applied where most shops would have shrugged.
 *
 * 220ms of quiet before a request, and the previous request is ABORTED rather
 * than ignored — otherwise the answer for "half" can land after the answer for
 * "half saree" and overwrite it, which is the bug that makes a search box feel
 * possessed. Escape closes and returns focus to the glass; ↑ ↓ move; Enter
 * opens.
 */

const DEBOUNCE_MS = 220;

export default function HeaderSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Product[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const { terms, record, remove, clear } = useSearchHistory();

  const router = useRouter();
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQ('');
    setResults(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); trigger.current?.focus(); }
    };
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, close]);

  useEffect(() => {
    const term = q.trim();
    if (!open) return;
    if (term.length < 2) { setResults(null); setFailed(false); return; }

    setFailed(false);
    const t = setTimeout(async () => {
      abort.current?.abort();
      const ctl = new AbortController();
      abort.current = ctl;
      try {
        const res = await productsAPI.getAll({ search: term, limit: 6 }, { signal: ctl.signal });
        setResults(res.data ?? []);
        setActive(0);
      } catch (err: any) {
        if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return;
        setFailed(true);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(t);
  }, [q, open]);

  const onFieldKey = (e: React.KeyboardEvent) => {
    if (!results?.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % results.length); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive((i) => (i - 1 + results.length) % results.length); }
    if (e.key === 'Enter') {
      e.preventDefault();
      const p = results[active];
      record(q);
      close();
      router.push(`/products/${p.id}`);
    }
  };

  /* The glass, drawn in one hairline weight to match the rail's other marks. */
  const Glass = ({ size = 17 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="7" stroke="currentColor" strokeWidth="1.4" />
      <path d="M15.8 15.8 21 21" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );

  return (
    <div ref={wrap} className="relative">
      {!open ? (
        <button
          ref={trigger}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Search the shop"
          aria-expanded={false}
          className="flex items-center text-paper-muted transition-colors duration-500 hover:text-brass-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
        >
          <Glass />
        </button>
      ) : (
        /* The rail grows a line to write on. */
        <div className="flex items-center gap-2.5 border-b border-brass-bright pb-1">
          <span className="shrink-0 text-brass-bright"><Glass size={15} /></span>
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onFieldKey}
            placeholder="Lehenga, pattu, a colour…"
            aria-label="Search the shop"
            autoComplete="off"
            className="w-[8.5rem] bg-transparent text-caption uppercase text-paper placeholder:text-paper-faint focus:outline-none sm:w-[17rem]"
          />
        </div>
      )}

      {/**
        * RECENT SEARCHES, shown when the field is empty.
        *
        * Nobody decides on an occasion piece in one visit — they search,
        * leave, and come back to type the same thing again on a phone
        * keyboard. This is that retyping removed.
        *
        * Each line carries its own remove button, not just the clear-all. A
        * search history is personal, and somebody buying a gift needs to drop
        * ONE line without losing the rest; offering only "clear everything"
        * makes the private case cost the useful case until people stop using
        * it. The × is a real button beside the link rather than inside it,
        * because a control nested in a link is unreachable by keyboard.
        */}
      {open && q.trim().length === 0 && terms.length > 0 && (
        <div className="absolute right-0 top-9 z-50 w-[min(92vw,26rem)] border border-ink-edge bg-ink-deep">
          <div className="flex items-baseline justify-between gap-4 border-b border-ink-edge/60 px-4 py-2.5">
            <span className="text-rule uppercase text-paper-faint">Recent searches</span>
            <button
              type="button"
              onClick={clear}
              className="text-caption uppercase text-paper-muted transition-colors duration-300 hover:text-brass-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
            >
              Clear all
            </button>
          </div>
          <ul>
            {terms.map((term) => (
              <li key={term} className="flex items-center gap-2 transition-colors duration-300 hover:bg-ink-raised">
                <button
                  type="button"
                  onClick={() => { record(term); close(); router.push(`/products?search=${encodeURIComponent(term)}`); }}
                  className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brass-bright"
                >
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4 shrink-0 text-paper-faint">
                    <circle cx="10" cy="10" r="7.2" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M10 6.2V10l2.6 1.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  <span className="truncate text-sm text-paper">{term}</span>
                </button>
                <button
                  type="button"
                  onClick={() => remove(term)}
                  aria-label={`Remove ${term} from recent searches`}
                  className="mr-2 grid h-7 w-7 shrink-0 place-items-center text-paper-faint transition-colors duration-300 hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
                >
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
                    <path d="m5.5 5.5 9 9m0-9-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && q.trim().length >= 2 && (
        /* A slip of paper laid under the counter. No shadow — see above. */
        <div className="absolute right-0 top-9 z-50 w-[min(92vw,26rem)] border border-ink-edge bg-ink-deep">
          {failed ? (
            <p className="px-5 py-6 text-sm text-paper-muted">
              We could not reach the shop. Your connection, not your search.
            </p>
          ) : results === null ? (
            <p className="px-5 py-6 text-caption uppercase text-paper-faint">Looking…</p>
          ) : results.length === 0 ? (
            <div className="px-5 py-6">
              <p className="font-display text-[1.15rem] text-paper">Nothing matches “{q.trim()}”.</p>
              <p className="mt-2 text-sm text-paper-muted">Try a fabric — silk, cotton, georgette.</p>
            </div>
          ) : (
            <>
              <ul>
                {results.map((p, i) => {
                  const img = (p.images || []).filter(Boolean)[0];
                  const cloth = clothFor(p.category);
                  return (
                    <li key={p.id}>
                      <Link
                        href={`/products/${p.id}`}
                        onClick={close}
                        onMouseEnter={() => setActive(i)}
                        aria-current={i === active ? 'true' : undefined}
                        className={`flex items-center gap-4 px-4 py-3 transition-colors duration-300 ${
                          i === active ? 'bg-ink-raised' : ''
                        }`}
                      >
                        <span className="h-14 w-12 shrink-0 overflow-hidden">
                          {img ? (
                            <img src={mediaUrl(img)} alt="" className="h-full w-full object-cover" />
                          ) : (
                            /* The dye, not a grey square. */
                            <span
                              className="block h-full w-full"
                              style={boltGround(cloth, p.id)}
                              aria-hidden="true"
                            />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-rule uppercase text-paper-faint">{p.category}</span>
                          <span className="mt-0.5 block truncate font-display text-[1.05rem] text-paper">
                            {p.name}
                          </span>
                        </span>
                        <span className="shrink-0 font-display tabular-nums text-paper">
                          ₹{p.price.toLocaleString('en-IN')}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                onClick={() => { const term = q.trim(); record(term); close(); router.push(`/products?search=${encodeURIComponent(term)}`); }}
                className="block w-full border-t border-ink-edge px-4 py-3 text-left text-caption uppercase text-paper-muted transition-colors duration-300 hover:bg-ink-raised hover:text-brass-bright"
              >
                See every match &rarr;
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
