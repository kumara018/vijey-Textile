'use client';

import { useEffect, useRef, useState } from 'react';
import { STORE } from '@/lib/config';

/**
 * Contact us, as a dropdown.
 *
 * WHY A CUSTOMER CANNOT FIND A PHONE NUMBER TODAY. The numbers exist, in the
 * footer, at the bottom of a page that is now several screens long. Somebody
 * who wants to ask whether a piece comes in another colour has to scroll past
 * the entire shop to find out how. That is the moment an order is lost, and it
 * is the one thing a small shop has that a large one does not — a person who
 * answers the phone.
 *
 * So the ways to reach the shop move into the header, behind one control, on
 * every page. Not a page of its own: "Contact us" as a destination is a page
 * with four lines on it, and a customer mid-question does not want to navigate,
 * they want the number.
 *
 * EACH ROW SAYS WHAT IT DOES, IN THE FEWEST WORDS THAT ARE STILL TRUE. "Call
 * the shop", "Message on WhatsApp", "Email us", "Find us on the map" — a verb
 * and a place. The number or address sits under it in the quiet colour, so the
 * eye picks the ACTION first and the detail second, which is the order somebody
 * actually decides in.
 *
 * Every row is a real link with the right scheme — tel:, https://wa.me/,
 * mailto:, maps — so on a phone each one opens the app that handles it. A
 * contact panel that requires copying a number by hand is a printed sign.
 */

export default function ContactMenu() {
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

  const wa = STORE.phone1.replace(/[^0-9]/g, '');

  const rows = [
    { label: 'Call the shop', detail: STORE.phone1, href: `tel:${STORE.phone1}`, icon: 'phone' },
    { label: 'Call the second line', detail: STORE.phone2, href: `tel:${STORE.phone2}`, icon: 'phone' },
    { label: 'Message on WhatsApp', detail: 'Usually answered the same day', href: `https://wa.me/91${wa}`, icon: 'chat' },
    { label: 'Email us', detail: STORE.email, href: `mailto:${STORE.email}`, icon: 'mail' },
    { label: 'Find us on the map', detail: `${STORE.area}, ${STORE.city}`, href: STORE.googleMapsUrl, icon: 'pin' },
  ];

  const ico = 'mt-0.5 h-4 w-4 shrink-0 text-brass-bright';
  const Icon = ({ kind }: { kind: string }) => {
    if (kind === 'phone') return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={ico}>
        <path d="M6.6 3.2 8.2 6.3 6.6 7.9a10.2 10.2 0 0 0 5.3 5.3l1.7-1.6 3.9 1.6v2.6c0 .6-.5 1.1-1.1 1.1A13.8 13.8 0 0 1 2.5 4.3c0-.6.5-1.1 1.1-1.1h3Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    );
    if (kind === 'chat') return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={ico}>
        <path d="M17.5 9.4c0 3.4-3.4 6.2-7.5 6.2a9.3 9.3 0 0 1-2.5-.33L2.5 17l1.2-3.1A6.1 6.1 0 0 1 2.5 9.4c0-3.4 3.4-6.2 7.5-6.2s7.5 2.8 7.5 6.2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    );
    if (kind === 'mail') return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={ico}>
        <rect x="2.5" y="4.4" width="15" height="11.2" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <path d="m3.1 5.2 6.9 5 6.9-5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    );
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={ico}>
        <path d="M2.5 5.6 7.5 3.6l5 2 5-2v10.8l-5 2-5-2-5 2V5.6Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M7.5 3.6v10.8M12.5 5.6v10.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  };

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
        Contact us
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Ways to reach the shop"
          className="absolute right-0 top-7 z-50 w-[min(92vw,20rem)] border border-ink-edge bg-ink-deep py-1"
        >
          {rows.map((r) => (
            <a
              key={r.label}
              role="menuitem"
              href={r.href}
              {...(r.icon === 'pin' || r.icon === 'chat'
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
              onClick={() => setOpen(false)}
              className="flex gap-3 px-4 py-2.5 transition-colors duration-200 hover:bg-ink-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brass-bright"
            >
              <Icon kind={r.icon} />
              <span className="min-w-0">
                <span className="block text-sm text-paper">{r.label}</span>
                <span className="block truncate text-xs text-paper-faint">{r.detail}</span>
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
