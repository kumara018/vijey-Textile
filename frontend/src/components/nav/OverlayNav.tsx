'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag, User } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { STORE } from '@/lib/config';

/**
 * Full-screen overlay navigation — The Trousseau.
 *
 * The old persistent top bar is gone. In this shop buying is an occasion, so
 * opening the navigation is an event rather than a permanently-docked utility
 * strip: the categories arrive as full plates, numbered, with room around
 * them. (The sister site takes the opposite position — a thin rail that is
 * always present and never opens — which is the structural half of keeping the
 * two apart.)
 *
 * What stays permanently visible is only what a shopper needs at any instant:
 * the mark, the bag, and the way in. Everything else is behind the Index.
 *
 * Accessibility is load-bearing here, because an overlay that traps or hides
 * focus is a far worse failure than a plain nav bar:
 *   - focus moves into the panel on open and returns to the trigger on close
 *   - Tab is trapped inside while open, Escape closes
 *   - the rest of the page is inert to screen readers via aria-hidden
 *   - body scroll locks without the layout shifting when the bar disappears
 */

const CATEGORIES = [
  { name: 'Baby Frocks',     note: 'First celebrations' },
  { name: 'Chudithar',       note: 'Everyday grace' },
  { name: 'Frocks',          note: 'School to supper' },
  { name: 'Western Dresses', note: 'Modern occasion' },
  { name: 'Lehenga',         note: 'The heirloom piece' },
  { name: 'Party Wear',      note: 'For the photographs' },
];

const SECONDARY = [
  { href: '/products', label: 'All pieces' },
  { href: '/orders',   label: 'My orders' },
  { href: '/support',  label: 'Help' },
  { href: '/authentic', label: 'Authenticity' },
];

export default function OverlayNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { count: itemCount } = useCart();
  const { user } = useAuth();

  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Any route change closes the panel — leaving it open across a navigation
  // strands the visitor on a page they cannot see.
  useEffect(() => { setOpen(false); }, [pathname]);

  // Scroll lock that compensates for the scrollbar's width, so the page
  // underneath does not jump sideways as the bar is removed.
  useEffect(() => {
    if (!open) return;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    const prev = { overflow: document.body.style.overflow, pad: document.body.style.paddingRight };
    document.body.style.overflow = 'hidden';
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    return () => {
      document.body.style.overflow = prev.overflow;
      document.body.style.paddingRight = prev.pad;
    };
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Focus management + trap.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    const focusables = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);

    focusables()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      // Wrap at both ends, so focus can never escape into the inert page.
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  return (
    <>
      {/* ── Permanent minimal bar ───────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-40 pointer-events-none">
        {/**
          * Nav scrim.
          *
          * The bar has no background of its own, so on the homepage the staged
          * garment showed straight through it — the photograph appeared to
          * bleed across the top of the page and the wordmark and icons lost
          * contrast against whatever happened to be behind them.
          *
          * A short top-down gradient gives the navigation a guaranteed dark bed
          * on every route, regardless of what the hero is doing underneath. It
          * is the standard treatment for an overlay nav sitting on imagery, and
          * it is why the nav can stay transparent-by-design without ever being
          * illegible. Non-interactive, and it fades out completely well before
          * the headline starts.
          */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-32"
          style={{
            background:
              'linear-gradient(to bottom, rgba(20,18,16,0.92) 0%, rgba(20,18,16,0.72) 38%, rgba(20,18,16,0.32) 68%, rgba(20,18,16,0) 100%)',
          }}
        />

        <div className="relative mx-auto flex max-w-[112rem] items-center justify-between px-6 py-6 sm:px-10">
          <Link
            href="/"
            className="pointer-events-auto flex items-center gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-maroon-300"
          >
            <img src="/hero-mark-v3.jpg" alt="" width={34} height={34} className="rounded-full" />
            <span className="font-display text-[0.95rem] font-medium tracking-[0.18em] text-white/90 uppercase">
              {STORE.name}
            </span>
          </Link>

          <div className="pointer-events-auto flex items-center gap-1 sm:gap-3">
            <Link
              href={user ? '/account' : '/auth/login'}
              aria-label={user ? 'Account' : 'Sign in'}
              className="flex h-10 w-10 items-center justify-center rounded-full text-white/70 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-300"
            >
              <User size={18} />
            </Link>

            <Link
              href="/cart"
              aria-label={`Bag${itemCount ? `, ${itemCount} item${itemCount === 1 ? '' : 's'}` : ', empty'}`}
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-white/70 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-300"
            >
              <ShoppingBag size={18} />
              {itemCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-maroon-400 px-1 text-[0.6rem] font-semibold text-night">
                  {itemCount}
                </span>
              )}
            </Link>

            <button
              ref={triggerRef}
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              aria-haspopup="dialog"
              className="ml-1 flex items-center gap-2.5 rounded-full border border-white/15 px-4 py-2 text-rule uppercase text-white/80 transition-colors hover:border-white/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-300"
            >
              Index
              <span aria-hidden="true" className="flex flex-col gap-[3px]">
                <span className="block h-px w-4 bg-current" />
                <span className="block h-px w-4 bg-current" />
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ── The Index ───────────────────────────────────────────────── */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Index"
        // Kept mounted so the close transition can play; inert to both
        // pointer and assistive tech when shut.
        aria-hidden={!open}
        {...(!open ? { inert: '' as unknown as boolean } : {})}
        className={`fixed inset-0 z-50 bg-night-deep transition-opacity duration-[520ms] ease-[cubic-bezier(0.22,0.61,0.24,1)] ${
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="flex h-full flex-col overflow-y-auto px-6 py-6 sm:px-10">
          <div className="flex items-center justify-between">
            <span className="text-rule uppercase text-white/40">Index</span>
            <button
              type="button"
              onClick={close}
              className="rounded-full border border-white/15 px-4 py-2 text-rule uppercase text-white/80 transition-colors hover:border-white/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-300"
            >
              Close
            </button>
          </div>

          <nav className="flex flex-1 flex-col justify-center py-10" aria-label="Categories">
            <ul className="mx-auto w-full max-w-[92rem]">
              {CATEGORIES.map((c, i) => (
                <li key={c.name} className="border-t border-white/10 last:border-b">
                  <Link
                    href={`/products?category=${encodeURIComponent(c.name)}`}
                    className="group flex items-baseline gap-5 py-4 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-maroon-300 sm:gap-9 sm:py-6"
                    style={{
                      // Staggered arrival, bottom-up — the motion signature for
                      // this brand. Skipped entirely under reduced motion.
                      transitionDelay: open ? `${90 + i * 45}ms` : '0ms',
                    }}
                  >
                    <span className="w-8 shrink-0 font-display text-[0.8rem] tabular-nums text-white/30">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="font-display text-chapter font-light text-white/85 transition-colors duration-500 group-hover:text-white">
                      {c.name}
                    </span>
                    <span className="ml-auto hidden text-caption uppercase text-white/30 transition-colors duration-500 group-hover:text-maroon-300 md:block">
                      {c.note}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mx-auto flex w-full max-w-[92rem] flex-wrap items-center justify-between gap-6 border-t border-white/10 pt-6">
            <ul className="flex flex-wrap gap-x-8 gap-y-2">
              {SECONDARY.map((s) => (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    className="text-caption uppercase text-white/50 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-maroon-300"
                  >
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-caption uppercase text-white/30">
              {`${STORE.shopNo}, ${STORE.area} — ${STORE.city}`}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
