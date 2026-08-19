'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import AccountMenu from '@/components/nav/AccountMenu';
import HeaderSearch from '@/components/nav/HeaderSearch';
import DeliverTo from '@/components/home/DeliverTo';
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

  /* The scroll lock is gone with the takeover. A dropdown does not cover the
     page, so freezing the page behind it would only trap somebody who opened
     it by accident. */

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
      {/**
        * A SOLID BAR, IN FLOW — LIKE THE SISTER SHOP'S.
        *
        * This was `fixed` and transparent, with a fading scrim underneath it
        * so the navigation could float over the hero photograph. That is a
        * lovely idea and it failed on the one page it was designed for: with
        * the shop relit, the pale scrim over a dark garment left the wordmark,
        * the icons and "Deliver to Erode" barely readable — the screenshot
        * showed a header sitting in the middle of a photograph of a frock.
        *
        * A transparent header can only be legible if you control what is
        * behind it, and a shop cannot: the hero is whatever garment is in
        * stock. So it stops trying. Solid ground, a hairline under it, sticky
        * rather than fixed so it takes its own space instead of covering the
        * first thing on every page — which is exactly what Ammalu's rail does
        * and why that one has never had this problem.
        */}
      <header className="sticky inset-x-0 top-0 z-40 border-b border-ink-edge/70 bg-ink/95 backdrop-blur-sm">

        <div className="relative mx-auto flex max-w-[112rem] items-center justify-between px-6 py-4 sm:px-10">
          {/**
            * THE WORDMARK HAS TO BE ALLOWED TO SHRINK.
            *
            * It was set at 0.95rem with 0.18em of letter-spacing and no width
            * control at all. On a 390px phone "VIJEY TEXTILE" is simply wider
            * than the space left beside four controls, so it wrapped to two
            * lines and the search glass rendered ON TOP of it — the header was
            * unusable on the device most customers hold.
            *
            * `min-w-0` lets the group shrink (a flex item defaults to
            * min-width:auto and refuses to), `truncate` gives it somewhere to
            * go if it still cannot fit, and the tracking and size step up only
            * once there is room. The actions are `shrink-0` so they are never
            * the thing that gives.
            */}
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-maroon-300 sm:gap-3"
          >
            <img src="/hero-mark-v3.jpg" alt="" width={34} height={34} className="h-8 w-8 shrink-0 rounded-full sm:h-[34px] sm:w-[34px]" />
            {/* Hidden on the narrowest screens rather than truncated. With
                four controls beside it, 390px leaves room for about eight
                characters — and "VIJEY TE…" is a worse mark than no mark at
                all. The logo is the identity there; the name returns as soon
                as it can be shown whole. */}
            <span className="hidden min-w-0 xs:block">
              <span className="block truncate font-display text-[0.8rem] font-medium uppercase leading-tight tracking-[0.09em] text-paper sm:text-[0.95rem] sm:tracking-[0.18em]">
                {STORE.name}
              </span>
              {/* The shop's own line, under the mark. */}
              <span className="mt-0.5 block truncate text-[0.6rem] uppercase tracking-[0.14em] text-brass-bright">
                {STORE.tagline}
              </span>
            </span>
            <span className="sr-only">{STORE.name}</span>
          </Link>

          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            {/* Search never leaves the header — see nav/HeaderSearch.tsx. */}
            <HeaderSearch />

            {/* The icon was a plain link to /account. It opens a menu now —
                see components/nav/AccountMenu.tsx. */}
            <AccountMenu />

            <Link
              href="/cart"
              aria-label={`Bag${itemCount ? `, ${itemCount} item${itemCount === 1 ? '' : 's'}` : ', empty'}`}
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-paper-muted transition-colors hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-300"
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
              className="ml-1 flex items-center gap-2.5 rounded-full border border-ink-edge px-4 py-2 text-rule uppercase text-paper transition-colors hover:border-ink-edge hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-300"
            >
              Index
              <span aria-hidden="true" className="flex flex-col gap-[3px]">
                <span className="block h-px w-4 bg-current" />
                <span className="block h-px w-4 bg-current" />
              </span>
            </button>
          </div>
        </div>
        {/* Where this order is going — in the header, on every page.
            It lived in the homepage hero, so it existed on exactly one page;
            "do you deliver to me" is a question a customer has on the shelf
            and at the product just as much as at the door. */}
        <div className="border-t border-ink-edge/60">
          <div className="mx-auto flex w-full max-w-[112rem] px-6 py-1.5 sm:px-10">
            <DeliverTo />
          </div>
        </div>

      {/* ── The Index ───────────────────────────────────────────────── */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Index"
        // Kept mounted so the close transition can play; inert to both
        // pointer and assistive tech when shut.
        //
        // `inert` is a real boolean prop in React 19. It used to be passed as
        // the empty string — the React 18 idiom — which React 19 warns will be
        // read as FALSE, leaving the closed overlay focusable by keyboard.
        aria-hidden={!open}
        {...(!open ? { inert: true } : {})}
        /**
         * A DROPDOWN, NOT A TAKEOVER.
         *
         * This was `fixed inset-0` — the whole screen, with the six category
         * names set large enough to fill it. That is a lovely gesture for a
         * shop somebody is browsing and the wrong one for a shop somebody is
         * buying from: it covers the products you were looking at, it needs a
         * deliberate Close, and it puts a full screen of chrome between a
         * customer and a lehenga. Asked for directly — small, a dropdown, and
         * not this big.
         *
         * It hangs off the header now, on the right, at a width that fits its
         * longest category name and no more. The page stays where it was; a
         * click outside or Escape dismisses it. The scrim is gone with the
         * takeover, and so is the scroll lock — there is nothing left to lock.
         */
        className={`absolute right-6 top-full z-50 mt-2 w-[min(92vw,22rem)] origin-top-right border border-ink-edge bg-ink-deep transition-all duration-300 ease-out sm:right-10 ${
          open
            ? 'pointer-events-auto scale-100 opacity-100'
            : 'pointer-events-none scale-95 opacity-0'
        }`}
      >
        <div className="flex max-h-[70vh] flex-col overflow-y-auto p-5">
          <div className="flex items-center justify-between">
            <span className="text-rule uppercase text-paper-muted">Index</span>
            <button
              type="button"
              onClick={close}
              className="rounded-full border border-ink-edge px-4 py-2 text-rule uppercase text-paper transition-colors hover:border-ink-edge hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-300"
            >
              Close
            </button>
          </div>

          {/**
            * THE INDEX IS A CONTENTS PAGE, NOT A SHOUT.
            *
            * Each category was set in `text-chapter` — clamp(2.4rem, 7.5vw,
            * 6.5rem), so up to 104px. Six of those stacked fill the screen
            * edge to edge with nothing but names, and size on its own is not
            * impact: at that scale the six rows are indistinguishable from one
            * another, the eye has nowhere to rest, and the note explaining
            * what each category is for is a grey whisper 90px away from the
            * word it belongs to. Big is not the same as considered.
            *
            * Halved, and the room that frees is spent on craft instead:
            *
            *   A BRASS RULE DRAWS ACROSS THE ROW on approach — scaleX from the
            *   left, 620ms, compositor-only. That is the one moment of motion,
            *   and it points the way the link goes.
            *
            *   THE NUMERAL LIGHTS. It is the quietest element on the row and
            *   the one that says this is an ordered list of a shop's whole
            *   stock, so it earns the accent rather than the name does.
            *
            *   THE NOTE SITS UNDER THE NAME, not across the row, so "First
            *   celebrations" reads as a description of Baby Frocks rather than
            *   as a second column of unrelated text.
            *
            * The staggered arrival is unchanged — it is this brand's motion
            * signature and it was the part that was already right.
            */}
          <nav className="mt-4" aria-label="Categories">
            <ul>
              {CATEGORIES.map((c, i) => (
                <li key={c.name} className="border-t border-ink-edge last:border-b">
                  <Link
                    href={`/products?category=${encodeURIComponent(c.name)}`}
                    className="group relative flex items-baseline gap-4 py-2.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
                    style={{
                      // Staggered arrival, bottom-up — the motion signature for
                      // this brand. Skipped entirely under reduced motion.
                      transitionDelay: open ? `${90 + i * 45}ms` : '0ms',
                    }}
                  >
                    {/* The rule that draws itself across the row. */}
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-brass-bright transition-transform duration-[620ms] ease-[cubic-bezier(0.22,0.61,0.24,1)] group-hover:scale-x-100 motion-reduce:transition-none"
                    />
                    <span className="w-8 shrink-0 font-display text-[0.8rem] tabular-nums text-paper-faint transition-colors duration-500 group-hover:text-brass-bright motion-reduce:transition-none">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-display text-[1.05rem] font-light leading-tight text-paper transition-colors duration-300 group-hover:text-brass-bright motion-reduce:transition-none">
                        {c.name}
                      </span>
                      <span className="mt-1.5 block text-caption uppercase text-paper-faint transition-colors duration-500 group-hover:text-maroon-300 motion-reduce:transition-none">
                        {c.note}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="ml-auto self-center text-lg leading-none text-paper-faint transition-all duration-500 group-hover:translate-x-1 group-hover:text-brass-bright motion-reduce:transition-none"
                    >
                      &rarr;
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mx-auto flex w-full max-w-[92rem] flex-wrap items-center justify-between gap-6 border-t border-ink-edge pt-6">
            <ul className="flex flex-wrap gap-x-8 gap-y-2">
              {SECONDARY.map((s) => (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    className="text-caption uppercase text-paper-muted transition-colors hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-maroon-300"
                  >
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-caption uppercase text-paper-faint">
              {`${STORE.shopNo}, ${STORE.area} — ${STORE.city}`}
            </p>
          </div>
        </div>
      </div>
      </header>

    </>
  );
}
