'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { scrollPageTo } from '@/lib/smoothScroll';

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
    /*
     * THE ANCHOR MAY ADDRESS SOMETHING *INSIDE* THIS SECTION, NOT THIS SECTION.
     *
     * This only opened when the hash equalled its own id, which covered
     * #size-guide, #faq and #contact and silently missed the four that
     * matter most. The policies live in a disclosure with NO id — the
     * summaries for #shipping, #returns, #terms and #privacy are divs nested
     * inside it — so a footer link to /support#returns addressed an element
     * sitting in a collapsed <details>. Nothing opened, and the page landed
     * on whatever happened to be at that offset. Reported as the shipping
     * and returns links "not showing the correct section".
     *
     * Some browsers now auto-expand a <details> when a fragment inside it is
     * navigated to, which is why this can look like it works on one machine
     * and not another. That is not something to depend on: `open` here is a
     * controlled React prop, so the browser and the component disagree about
     * who owns the state.
     *
     * So the test is containment rather than equality — does this section
     * hold the thing being addressed — and the scroll goes to the ADDRESSED
     * element, not to this heading, since the heading is the wrong place when
     * the target is one of four summaries inside it.
     */
    const check = () => {
      if (typeof window === 'undefined') return;
      const host = ref.current;
      if (!host) return;

      const hash = window.location.hash;
      if (hash.length < 2) return;

      let target: Element | null = null;
      try {
        target = document.querySelector(hash);
      } catch {
        return; // a hash that is not a valid selector is not ours to handle
      }

      const addressesSelf = !!id && hash === `#${id}`;
      // contains() reads the DOM, which exists even while <details> is shut.
      const addressesChild = !!target && target !== host && host.contains(target);
      if (!addressesSelf && !addressesChild) return;

      setOpen(true);

      /* The browser scrolled while the section was still collapsed, so the
         landing position is wrong by the height of whatever just expanded.
         Re-run it on the next frame, once layout has settled. */
      requestAnimationFrame(() => {
        const landing = (addressesChild ? target : host) as HTMLElement | null;
        if (!landing) return;
        const margin = parseFloat(getComputedStyle(landing).scrollMarginTop) || 0;
        scrollPageTo(landing, { offset: -margin });
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
