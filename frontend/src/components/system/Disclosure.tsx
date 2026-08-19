'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * A section heading that opens and closes.
 *
 * WHY A HELP PAGE IS A BAD SHAPE FOR A LONG DOCUMENT. The support page holds
 * four things — a size chart, the common questions, the policies, and how to
 * reach a person — and somebody arrives wanting exactly one of them. Laid out
 * flat they are five screens of scrolling, and the size chart alone is three
 * tables. Every visitor pays the cost of the other three sections to read the
 * one they came for.
 *
 * Closed by default, the whole page becomes its own table of contents: four
 * lines, and you open the one you want.
 *
 * BUILT ON NATIVE <details>, NOT A useState PANEL. The browser gives the right
 * keyboard behaviour, the right ARIA role and the right find-in-page behaviour
 * for free, and it works before the JavaScript arrives. A hand-rolled
 * disclosure has to reimplement all of that and usually reimplements some of
 * it wrong.
 *
 * THE ONE THING NATIVE <details> DOES NOT SOLVE IS THE ANCHOR. Half the links
 * into this page are deep ones — the Help menu points at /support#size-guide
 * and /support#shipping, the footer at #returns. Navigating to a fragment
 * inside a CLOSED <details> scrolls to a heading with nothing under it, which
 * looks like the link is broken. So this opens itself when the hash addresses
 * it, on first load and on every later hash change, and then scrolls it into
 * view — because the browser has already done its own scroll by the time we
 * expand, against the collapsed height.
 */
export default function Disclosure({
  id,
  index,
  title,
  children,
  defaultOpen = false,
}: {
  id?: string;
  /** The section number, shown in the rule colour beside the heading. */
  index?: string;
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (!id) return;
    const check = () => {
      if (typeof window === 'undefined') return;
      if (window.location.hash !== `#${id}`) return;
      setOpen(true);
      /* The browser scrolled to this heading while the section was still
         collapsed, so the landing position is wrong by the height of whatever
         just expanded. Re-run it on the next frame, once layout has settled. */
      requestAnimationFrame(() => {
        ref.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
      });
    };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, [id]);

  return (
    <details
      ref={ref}
      id={id}
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="scroll-mt-32 border-t border-ink-edge/60"
    >
      <summary
        className="flex cursor-pointer list-none items-baseline gap-5 py-6
                   transition-colors duration-300 hover:text-paper
                   focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4
                   focus-visible:outline-brass-bright [&::-webkit-details-marker]:hidden"
      >
        {index && <span className="text-rule tabular-nums text-brass-bright">{index}</span>}
        <h2 className="font-display text-doc-head font-normal text-paper">{title}</h2>
        {/* The chevron is the affordance. `ml-auto` keeps it at the far edge so
            a row of four reads as a list of controls rather than four titles
            with decoration. It rotates rather than swapping glyph, so there is
            nothing to load and nothing to mismatch. */}
        <svg
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          className={`ml-auto h-4 w-4 shrink-0 self-center text-paper-faint transition-transform duration-300 ${
            open ? 'rotate-180' : ''
          }`}
        >
          <path d="m4.5 7.5 5.5 5 5.5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>

      <div className="pb-12">{children}</div>
    </details>
  );
}
