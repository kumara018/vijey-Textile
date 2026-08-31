'use client';

import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

/**
 * The site's action styles, as one component.
 *
 * `lead` is the underlined rule with the travelling arrow. `quiet` is
 * everything else. `primary` and `secondary` are filled and outlined buttons,
 * and they exist because of a decision that had to be reversed.
 *
 * WHY THERE ARE NOW FILLED BUTTONS, HAVING SAID THERE NEVER WOULD BE.
 *
 * The original note here read: "There is deliberately no filled button anywhere
 * in this design: a solid rectangle of colour is the loudest object on a dark
 * editorial page and it fought the photography every time it appeared." That
 * was a real observation and it produced a page that looks better in isolation
 * than it works in use.
 *
 * The shop's owner could not find the buy actions on his own product page. Add
 * to bag, Buy it now and Pay were all set as underlined text at caption size,
 * indistinguishable at a glance from the four other underlined links around
 * them. On a shop, an action a customer cannot identify is not restraint — it
 * is a lost order, and the cost falls entirely on the one page that has to
 * convert.
 *
 * So the restraint is kept everywhere it costs nothing, and abandoned on the
 * three places where money changes hands. `primary` and `secondary` are only
 * for those: adding to the bag, buying now, and paying. Everything else on the
 * site still uses `lead` and `quiet`, so the page keeps its character and the
 * filled buttons keep their meaning — a rectangle that appears three times on
 * a whole site still reads as important. Used on every link, it would read as
 * nothing, which is exactly the failure the original note was guarding against.
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

/*
 * Alignment lives in the tones, not here. Text actions sit on the baseline so
 * they align with the prose beside them; a filled button centres its label in
 * its own box. Putting both in BASE would leave two conflicting `items-*`
 * classes on one element and let stylesheet order decide, which is not a
 * decision anyone would make on purpose.
 */
const BASE =
  'group inline-flex gap-4 text-caption uppercase transition-colors duration-500 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright';

const TONE = {
  /*
   * FILLED. Cerise ground, warm-white label — 6.7:1, comfortably past AA, and
   * 4.9:1 on the brighter hover, which also passes. Both were computed rather
   * than eyeballed: an accent chosen for headings has no obligation to work as
   * a background, and this one only just does.
   */
  primary:
    'items-center bg-brass px-7 py-3.5 text-ink hover:bg-brass-bright',
  /*
   * OUTLINED. Unmistakably a control, visibly lighter than `primary`, so two
   * buttons side by side still say which one the shop expects you to press.
   */
  secondary:
    'items-center border border-brass px-7 py-3.5 text-brass hover:bg-brass hover:text-ink',
  lead: 'items-baseline border-b border-brass/70 pb-2 text-paper hover:border-brass-bright',
  quiet: 'items-baseline text-paper-faint hover:text-paper',
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
      <Inner arrow={arrow ?? tone !== 'quiet'}>{children}</Inner>
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
      <Inner arrow={arrow ?? tone !== 'quiet'}>{children}</Inner>
    </button>
  );
}
