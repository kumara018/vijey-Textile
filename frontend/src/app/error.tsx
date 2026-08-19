'use client';

import { useEffect } from 'react';
import { reportError } from '@/lib/errorReporter';
import Link from 'next/link';
import { STORE } from '@/lib/config';

/**
 * Route-level error boundary.
 *
 * Catches a render or data failure in any route below the root layout. The
 * layout itself survives — navigation and footer stay usable — so this is a
 * composed page inside a working shop, not a dead end.
 *
 * Three rules govern everything here:
 *
 *  1. NOTHING IN THIS FILE MAY THROW. An error boundary that fails escalates
 *     to global-error.tsx, which tears down the entire layout. So: no data
 *     fetching, no 3D, no animation library, no component that could suspend.
 *     Two imports, both constants.
 *  2. THE VISITOR IS NOT AT FAULT AND MUST NOT BE STRANDED. Every path out is
 *     offered — retry, the catalogue, a human on the phone. A family that
 *     cannot reach the shop online should be able to reach it directly.
 *  3. THE DIGEST IS SHOWN. Next.js hashes the server-side error into
 *     `digest`; it is the only thing that connects what the customer saw to
 *     what the logs recorded. Printing it turns "the site broke" into a
 *     traceable report.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[route error]', error);
    /**
     * Now also reported, which this comment previously said was unsafe.
     *
     * The caution was right and still holds: a naive network call inside an
     * error boundary turns one failure into two. reportError is built for
     * exactly that objection — every path is wrapped so it cannot throw, it
     * uses sendBeacon so it neither blocks nor fails on unload, it dedupes by
     * message and stack so a render loop cannot flood, and it caps per
     * session. If it breaks, it breaks silently and the customer still sees
     * this designed page.
     *
     * `digest` is the value that connects what the customer saw to the server
     * log line, so it goes with the report rather than only on screen.
     */
    reportError(error, { source: 'boundary', digest: error.digest });
  }, [error]);

  return (
    <div className="relative min-h-[78svh]">
      {/* The scene continues behind this. A gradient matte keeps the copy
          column legible without hiding the staging entirely — same approach
          the homepage uses over its hero. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(247,234,238,0.94) 0%, rgba(247,234,238,0.86) 55%, rgba(247,234,238,0.94) 100%)',
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-[78svh] w-full max-w-[112rem] flex-col justify-center px-6 py-[14vh] sm:px-10">
        <p className="mb-8 text-rule uppercase text-brass-bright">Something went wrong</p>

        <h1 className="max-w-[18ch] font-display text-chapter font-light text-paper">
          This page did not load
        </h1>

        <p className="mt-8 max-w-[52ch] text-lede text-paper-muted">
          The fault is on our side, not yours. Nothing you were doing has been lost — your
          cart and your orders are exactly where you left them.
        </p>

        <div className="mt-12 flex flex-wrap items-center gap-x-10 gap-y-5">
          <button
            type="button"
            onClick={reset}
            className="group inline-flex items-baseline gap-4 border-b border-brass/70 pb-2 text-caption uppercase text-paper transition-colors duration-500 hover:border-brass-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
          >
            Try this page again
            <span aria-hidden="true" className="transition-transform duration-500 group-hover:translate-x-1.5">
              →
            </span>
          </button>

          <Link
            href="/products"
            className="text-caption uppercase text-paper-faint transition-colors duration-500 hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
          >
            See every piece
          </Link>

          <Link
            href="/"
            className="text-caption uppercase text-paper-faint transition-colors duration-500 hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
          >
            Return home
          </Link>
        </div>

        {/* The human fallback. A shop with a phone number should say so at the
            exact moment its website has failed. */}
        <div className="mt-[5vh] border-t border-ink-edge/60 pt-8">
          <dl className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
            <div>
              <dt className="text-rule uppercase text-paper-faint">Speak to us instead</dt>
              <dd className="mt-2.5">
                <a
                  href={`tel:${STORE.phone1}`}
                  className="text-paper-muted transition-colors hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
                >
                  {STORE.phone1}
                </a>
              </dd>
            </div>
            {error.digest && (
              <div>
                <dt className="text-rule uppercase text-paper-faint">Reference</dt>
                <dd className="mt-2.5 font-mono text-sm tabular-nums text-paper-muted">
                  {error.digest}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}
