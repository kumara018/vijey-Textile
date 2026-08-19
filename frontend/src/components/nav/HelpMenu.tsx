'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

/**
 * Help, as a dropdown.
 *
 * WHY THIS IS NOT A LINK TO THE HELP PAGE. It was, and the help page is one
 * long document with six anchors in it. Somebody who wants to know what
 * postage costs had to load that page, find the section, and read past the
 * size guide to reach it. Every one of those questions has a short answer and
 * a fixed home, so the questions themselves belong in the header where they
 * can be picked off directly.
 *
 * THE ROWS ARE THE QUESTIONS PEOPLE ACTUALLY ASK, IN THEIR WORDS. Not
 * "Shipping policy", "Cancellation, return and exchange policy",
 * "Authenticity" — those are the names of documents, and a customer does not
 * think "I need the cancellation policy", they think "can I send this back".
 * So the label is the question and the line under it is the short answer, in
 * the quiet colour. Someone often gets what they came for without opening
 * anything, which is the point.
 *
 * Same control as Contact us — one button, Escape closes it, a click outside
 * closes it, focus returns to the trigger. Two dropdowns in one header that
 * behave differently is worse than either.
 */

const ROWS = [
  {
    label: 'Where is my order?',
    detail: 'Track a parcel that is on its way',
    href: '/orders',
  },
  {
    label: 'Will it fit?',
    detail: 'Every size, measured across the chest',
    href: '/support#size-guide',
  },
  {
    label: 'What does delivery cost?',
    detail: 'Charges, and how long it takes',
    href: '/support#shipping',
  },
  {
    label: 'Can I send it back?',
    detail: 'Cancelling, returning and exchanging',
    href: '/cancellation',
  },
  {
    label: 'Something else',
    detail: 'The full help page',
    href: '/support',
  },
];

export default function HelpMenu() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
    };
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`text-rule uppercase transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright ${
          open ? 'text-brass-bright' : 'text-paper-muted hover:text-brass-bright'
        }`}
      >
        Help
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Common questions"
          className="absolute right-0 top-7 z-50 w-[min(92vw,21rem)] border border-ink-edge bg-ink-deep py-1"
        >
          {ROWS.map((r) => (
            <Link
              key={r.href}
              role="menuitem"
              href={r.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 transition-colors duration-200 hover:bg-ink-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brass-bright"
            >
              <span className="block text-sm text-paper">{r.label}</span>
              <span className="block text-xs text-paper-faint">{r.detail}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
