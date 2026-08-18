'use client';

import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

/**
 * The site's only two action styles, as one component.
 *
 * `lead` is the underlined brass-ruled action with the travelling arrow — the
 * single most important thing on a page. `quiet` is everything else. There is
 * deliberately no filled button anywhere in this design: a solid rectangle of
 * colour is the loudest object on a dark editorial page and it fought the
 * photography every time it appeared.
 *
 * Rules that hold for both, and are the reason this is centralised rather than
 * copied into twenty routes:
 *
 *  - The focus ring is always visible and always offset — `focus-visible`, so
 *    it appears for keyboard users without ringing every mouse click.
 *  - Transitions are 500ms colour only. No transform on the element itself, no
 *    spring, no bounce; only the arrow glyph moves, and only 6px.
 *  - `motion-reduce:transition-none` disables all of it when the visitor has
 *    asked for stillness.
 *  - Disabled state is real: `aria-disabled` plus pointer-events-none, so it
 *    is announced as unavailable rather than silently doing nothing.
 *
 * Motion never gates the action — the arrow is decoration on an element that
 * is already clickable and already keyboard-reachable.
 */

const BASE =
  'group inline-flex items-baseline gap-4 text-caption uppercase transition-colors duration-500 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright';

const TONE = {
  lead: 'border-b border-brass/70 pb-2 text-paper hover:border-brass-bright',
  quiet: 'text-paper-faint hover:text-paper',
} as const;

type Tone = keyof typeof TONE;

function Inner({ children, arrow }: { children: ReactNode; arrow: boolean }) {
  return (
    <>
      {children}
      {arrow && (
        <span
          aria-hidden="true"
          className="transition-transform duration-500 group-hover:translate-x-1.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
        >
          →
        </span>
      )}
    </>
  );
}

export function ActionLink({
  tone = 'lead',
  arrow,
  children,
  className = '',
  ...rest
}: ComponentProps<typeof Link> & { tone?: Tone; arrow?: boolean }) {
  return (
    <Link {...rest} className={`${BASE} ${TONE[tone]} ${className}`}>
      <Inner arrow={arrow ?? tone === 'lead'}>{children}</Inner>
    </Link>
  );
}

export function ActionButton({
  tone = 'lead',
  arrow,
  children,
  className = '',
  disabled,
  ...rest
}: ComponentProps<'button'> & { tone?: Tone; arrow?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      className={`${BASE} ${TONE[tone]} ${
        disabled ? 'pointer-events-none opacity-40' : ''
      } ${className}`}
    >
      <Inner arrow={arrow ?? tone === 'lead'}>{children}</Inner>
    </button>
  );
}
