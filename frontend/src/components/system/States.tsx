'use client';

import type { ReactNode } from 'react';
import { ActionButton, ActionLink } from './Action';

/**
 * Empty, error and loading states — the three things a route spends most of
 * its life in and which were, before this, either missing or a grey spinner.
 *
 * The governing rule for the copy: SAY WHY IT IS EMPTY, not that it is empty.
 * "No orders found" tells a customer nothing they cannot see. "You have not
 * ordered anything yet" tells them the shop is working and the next step is
 * theirs — and it is a different sentence from "we could not load your
 * orders", which is our fault and needs a retry. Collapsing those two into one
 * grey box is how a working site looks broken.
 */

/* ── Empty ──────────────────────────────────────────────────────────────── */

export function EmptyState({
  eyebrow,
  title,
  body,
  action,
}: {
  eyebrow?: string;
  /** Why it is empty, in the customer's terms. */
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="border-t border-ink-edge/60 py-[5vh]">
      {eyebrow && <p className="mb-6 text-rule uppercase text-paper-faint">{eyebrow}</p>}
      <h2 className="max-w-[22ch] font-display text-band font-light text-paper">{title}</h2>
      {body && <p className="mt-6 max-w-[48ch] text-lede text-paper-muted">{body}</p>}
      {action && <div className="mt-10 flex flex-wrap items-center gap-x-10 gap-y-5">{action}</div>}
    </div>
  );
}

/* ── Error ──────────────────────────────────────────────────────────────── */

/**
 * An in-page failure — a query that could not load — as distinct from a render
 * crash, which RouteErrorBoundary catches, and from a route-level failure,
 * which app/error.tsx catches.
 *
 * `role="alert"` because this replaces content the visitor was waiting for and
 * they need to be told, not left listening to silence.
 */
export function ErrorState({
  title = 'This did not load',
  body = 'The fault is on our side. Nothing you were doing has been lost.',
  onRetry,
  retrying = false,
  fallbackHref = '/products',
  fallbackLabel = 'See every piece',
}: {
  title?: string;
  body?: ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
  fallbackHref?: string;
  fallbackLabel?: string;
}) {
  return (
    <div role="alert" className="border-t border-ink-edge/60 py-[5vh]">
      <p className="mb-6 text-rule uppercase text-brass-bright">Something went wrong</p>
      <h2 className="max-w-[22ch] font-display text-band font-light text-paper">{title}</h2>
      <p className="mt-6 max-w-[48ch] text-lede text-paper-muted">{body}</p>
      <div className="mt-10 flex flex-wrap items-center gap-x-10 gap-y-5">
        {onRetry && (
          <ActionButton onClick={onRetry} disabled={retrying}>
            {retrying ? 'Trying again…' : 'Try again'}
          </ActionButton>
        )}
        <ActionLink href={fallbackHref} tone="quiet">
          {fallbackLabel}
        </ActionLink>
      </div>
    </div>
  );
}

/* ── Skeletons ──────────────────────────────────────────────────────────── */

/**
 * Skeleton primitives.
 *
 * These exist so a route's loading state can be built in the SHAPE of that
 * route's final layout rather than as a generic spinner. A skeleton whose
 * proportions match what arrives makes the swap read as the content filling
 * in; one that does not makes it read as the page changing twice.
 *
 * `animate-pulse` is Tailwind's own; `motion-reduce:animate-none` turns it off
 * for a visitor who asked for stillness. All of this is `aria-hidden` — the
 * live region announcing "loading" is the accessible signal, not a tree of
 * meaningless boxes.
 */

export function SkeletonLine({ w = 'w-full', h = 'h-3' }: { w?: string; h?: string }) {
  return <div className={`${h} ${w} rounded-full bg-paper/[0.07]`} />;
}

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`rounded-sm bg-paper/[0.05] ${className}`} />;
}

export function Skeleton({
  children,
  label = 'Loading',
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <>
      <div
        aria-hidden="true"
        className="animate-pulse motion-reduce:animate-none"
      >
        {children}
      </div>
      {/* The accessible half: announced politely, never interrupting. */}
      <div role="status" aria-live="polite" className="sr-only">
        {label}
      </div>
    </>
  );
}

/* ── Live region ────────────────────────────────────────────────────────── */

/**
 * Announces a change that does NOT navigate — a quantity updated, an item
 * removed, a filter applied. Without this, those changes are silent to a
 * screen reader: the DOM updates and nothing says so.
 *
 * `polite` waits for a pause; only genuine errors get `assertive`.
 */
export function Announce({
  message,
  assertive = false,
}: {
  message: string;
  assertive?: boolean;
}) {
  return (
    <div
      role={assertive ? 'alert' : 'status'}
      aria-live={assertive ? 'assertive' : 'polite'}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}
