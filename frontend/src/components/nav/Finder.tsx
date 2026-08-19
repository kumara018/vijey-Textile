'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { productsAPI } from '@/lib/api';
import { mediaUrl } from '@/lib/media';
import { CATEGORY_ORDER } from '@/lib/categories';
import type { Product } from '@/types';

/**
 * The finder — search, opened from the glass in the header.
 *
 * WHY A SHOP THIS SIZE STILL NEEDS ONE. Six categories and a few dozen pieces
 * is small enough to browse, which is the argument for not building search at
 * all. It is wrong for the customer who arrives already knowing: somebody sent
 * a photograph of a lehenga, or a grandmother asked for "the green pattu", and
 * the whole job is to find that one thing without reading a grid.
 *
 * SO IT IS BUILT AROUND ARRIVING, NOT BROWSING.
 *
 *   THE GLASS IS THE SUBJECT. It is drawn once, large, in brass, and the field
 *   sits on its line — not a 32px icon tucked inside a rounded input. The
 *   overlay's opening move is the glass settling into place, which is the same
 *   language as the Index: this shop opens things as events.
 *
 *   IT SEARCHES WHILE YOU TYPE, but not on every keystroke. 220ms of quiet
 *   before a request, so a fast typist spends one query rather than nine, and
 *   an aborted controller means an answer for "leh" can never land after the
 *   answer for "lehenga" and overwrite it — the stale-response bug that makes
 *   search feel haunted.
 *
 *   THE KEYBOARD IS FIRST-CLASS. ↑ ↓ move, Enter opens, Escape closes and
 *   returns focus to the glass. Somebody who searches twice will use the
 *   keyboard the second time.
 *
 *   EMPTY IS NOT BLANK. With nothing typed it offers the six categories,
 *   because the second most common reason to open search is not knowing what
 *   the shop calls the thing you want.
 */

const DEBOUNCE_MS = 220;

export default function Finder() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Product[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);

  const router = useRouter();
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    trigger.current?.focus();
  }, []);

  /* Lock the page behind the overlay. Without this the list under it scrolls
     when someone flicks, and the overlay appears to be attached to nothing. */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    input.current?.focus();
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  /* Debounced, and the previous request is cancelled rather than ignored. */
  useEffect(() => {
    const term = q.trim();
    if (!open) return;
    if (term.length < 2) { setResults(null); setBusy(false); setFailed(false); return; }

    setBusy(true);
    setFailed(false);
    const t = setTimeout(async () => {
      abort.current?.abort();
      const ctl = new AbortController();
      abort.current = ctl;
      try {
        const res = await productsAPI.getAll({ search: term, limit: 8 }, { signal: ctl.signal });
        setResults(res.data ?? []);
        setActive(0);
      } catch (err: any) {
        if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return;
        setFailed(true);
      } finally {
        setBusy(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(t);
  }, [q, open]);

  const go = (p: Product) => { close(); router.push(`/products/${p.id}`); };

  const onFieldKey = (e: React.KeyboardEvent) => {
    if (!results?.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % results.length); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive((i) => (i - 1 + results.length) % results.length); }
    if (e.key === 'Enter')     { e.preventDefault(); go(results[active]); }
  };

  const Glass = ({ size = 18 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M15.8 15.8 21 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="flex h-10 w-10 items-center justify-center rounded-full text-paper-muted transition-colors hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-300"
      >
        <Glass />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search the shop"
          className="fixed inset-0 z-[60] bg-night-deep/97 backdrop-blur-sm"
        >
          <div className="mx-auto flex h-full w-full max-w-[64rem] flex-col px-6 py-8 sm:px-10">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={close}
                className="rounded-full border border-ink-edge px-4 py-2 text-rule uppercase text-paper transition-colors hover:border-ink-edge hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-300"
              >
                Close
              </button>
            </div>

            {/* The glass sits ON the line, not inside a box. */}
            <div className="mt-[8vh] flex items-center gap-5 border-b border-ink-edge pb-4 focus-within:border-brass-bright">
              <span className="shrink-0 text-brass-bright"><Glass size={30} /></span>
              <input
                ref={input}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onFieldKey}
                placeholder="Lehenga, pattu, a colour…"
                aria-label="Search for a piece"
                autoComplete="off"
                className="w-full bg-transparent font-display text-[clamp(1.6rem,4vw,2.6rem)] font-light text-paper placeholder:text-paper-faint focus:outline-none"
              />
            </div>

            <div className="mt-8 min-h-0 flex-1 overflow-y-auto">
              {q.trim().length < 2 ? (
                <div>
                  <p className="text-rule uppercase text-paper-faint">Or start here</p>
                  <ul className="mt-6 flex flex-wrap gap-x-8 gap-y-4">
                    {CATEGORY_ORDER.map((name) => (
                      <li key={name}>
                        <Link
                          href={`/products?category=${encodeURIComponent(name)}`}
                          onClick={close}
                          className="font-display text-[1.5rem] font-light text-paper-muted transition-colors duration-500 hover:text-brass-bright motion-reduce:transition-none"
                        >
                          {name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : failed ? (
                <p className="text-paper-muted">
                  We could not reach the shop just then. Your connection, not your search.
                </p>
              ) : busy && !results ? (
                <p className="text-paper-muted">Looking…</p>
              ) : results && results.length === 0 ? (
                <div>
                  <p className="font-display text-[1.6rem] font-light text-paper">
                    Nothing matches “{q.trim()}”.
                  </p>
                  <p className="mt-3 text-paper-muted">
                    Try a category, or the fabric — pattu, organza, cotton.
                  </p>
                </div>
              ) : (
                <ul>
                  {results?.map((p, i) => {
                    const img = (p.images || []).filter(Boolean)[0];
                    return (
                      <li key={p.id}>
                        <Link
                          href={`/products/${p.id}`}
                          onClick={close}
                          onMouseEnter={() => setActive(i)}
                          aria-current={i === active ? 'true' : undefined}
                          className={`flex items-center gap-5 border-b border-ink-edge px-2 py-4 transition-colors duration-300 ${
                            i === active ? 'bg-ink-deep/[0.06]' : ''
                          }`}
                        >
                          <span className="h-16 w-14 shrink-0 overflow-hidden bg-ink-raised">
                            {img && (
                              <img src={mediaUrl(img)} alt="" className="h-full w-full object-cover" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-rule uppercase text-brass-bright">{p.category}</span>
                            <span className="mt-1 block truncate font-display text-[1.25rem] font-light text-paper">
                              {p.name}
                            </span>
                          </span>
                          <span className="shrink-0 font-display text-[1.15rem] tabular-nums text-paper">
                            ₹{p.price.toLocaleString('en-IN')}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {results && results.length > 0 && (
              <button
                type="button"
                onClick={() => { close(); router.push(`/products?search=${encodeURIComponent(q.trim())}`); }}
                className="mt-6 self-start border-b border-brass-bright pb-1 text-rule uppercase text-paper transition-colors duration-500 hover:text-brass-bright"
              >
                See every match &rarr;
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
