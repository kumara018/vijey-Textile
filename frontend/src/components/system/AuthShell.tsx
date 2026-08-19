'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { LogoMark } from '@/components/Logo';

/**
 * The frame shared by sign in, create account and forgot password.
 *
 * Amazon's model, deliberately: one focused card on an otherwise empty page.
 * No navigation, no footer, no "back to home", no account switcher. The logo
 * above the card is the only way back to the store, because every additional
 * affordance on a sign-in page is an invitation to leave it, and the wordmark
 * is the escape hatch people already look for.
 *
 * The atmosphere still belongs to this site — the scene renders behind, the
 * palette and type are the same — but it sits BEHIND the card and never
 * competes with the form. A form is the one surface where legibility beats
 * every other consideration, so the card itself is quiet: solid ground, one
 * hairline, generous spacing, and no motion of its own.
 *
 * All three screens use this, so they read as one flow rather than three
 * pages that happen to be adjacent.
 */
export default function AuthShell({
  title,
  standfirst,
  children,
  footer,
}: {
  title: string;
  standfirst?: ReactNode;
  children: ReactNode;
  /** Flow-required actions only — never general navigation. */
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-[100svh] flex-col items-center justify-center px-6 py-16">
      {/* Heavier than the standard PageShell scrim. Behind a form the scene is
          atmosphere only, and a legible field beats a visible garment. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 40%, rgba(247,234,238,0.90) 0%, rgba(247,234,238,0.96) 55%, rgba(247,234,238,0.99) 100%)',
        }}
      />

      <div className="relative z-10 w-full max-w-[26rem]">
        {/* The only route back to the store. */}
        <div className="mb-12 flex justify-center">
          <Link
            href="/"
            aria-label="Vijey Textile — return to the shop"
            className="inline-flex flex-col items-center gap-3 transition-opacity duration-500 hover:opacity-80 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-brass-bright"
          >
            <LogoMark size={44} />
            <span className="text-rule uppercase text-paper">Vijey Textile</span>
          </Link>
        </div>

        <main className="border border-ink-edge/70 bg-ink-deep/80 px-7 py-9 backdrop-blur-sm sm:px-9">
          <h1 className="font-display text-3xl font-light text-paper">{title}</h1>
          {standfirst && (
            <p className="mt-3 text-sm leading-relaxed text-paper-muted">{standfirst}</p>
          )}
          <div className="mt-8">{children}</div>
        </main>

        {footer && <div className="mt-8">{footer}</div>}

        <p className="mt-8 text-center text-xs leading-relaxed text-paper-faint">
          By continuing you agree to our{' '}
          <Link
            href="/terms"
            className="underline underline-offset-4 transition-colors duration-500 hover:text-paper-muted motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
          >
            terms
          </Link>{' '}
          and{' '}
          <Link
            href="/privacy"
            className="underline underline-offset-4 transition-colors duration-500 hover:text-paper-muted motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
          >
            privacy policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
