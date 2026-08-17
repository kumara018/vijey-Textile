'use client';

import { useEffect } from 'react';
import { reportError } from '@/lib/errorReporter';

/**
 * Last-resort boundary — a failure in the root layout itself.
 *
 * This replaces the ENTIRE document, which is why it renders its own <html>
 * and <body>: the root layout never ran, so nothing it provides exists. That
 * includes globals.css, the font variables, every provider, and the canvas.
 *
 * Consequently every style here is inline, with literal hex values. Tailwind
 * classes would be a bet that the stylesheet loaded — and the most likely way
 * to reach this screen is that it did not. The same reasoning rules out the
 * brand fonts (never loaded) and the logo (a request that can fail); the
 * wordmark is set in a system serif instead. It is the one screen on the site
 * that must survive its own dependencies being gone.
 *
 * Rendered rarely enough that it should be plain, and carefully enough that
 * plain still means composed: brand ground, brand accent, one way forward.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global error]', error);
    // See the note in app/error.tsx: reporting here is safe because
    // reportError cannot throw, cannot block, and cannot flood.
    reportError(error, { source: 'boundary', digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem 1.5rem',
          // The approved palette, written out rather than referenced.
          backgroundColor: '#1C1917',
          color: '#FAFAF9',
          fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        <main style={{ width: '100%', maxWidth: '44rem' }}>
          <p
            style={{
              margin: '0 0 2rem',
              fontSize: '0.68rem',
              letterSpacing: '0.26em',
              textTransform: 'uppercase',
              color: '#C4841A',
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            }}
          >
            Vijey Textile
          </p>

          <h1
            style={{
              margin: 0,
              fontSize: 'clamp(2.1rem, 6vw, 4rem)',
              lineHeight: 1.02,
              letterSpacing: '-0.02em',
              fontWeight: 300,
              maxWidth: '18ch',
            }}
          >
            The site failed to load
          </h1>

          <p
            style={{
              margin: '1.75rem 0 0',
              maxWidth: '52ch',
              fontSize: '1.02rem',
              lineHeight: 1.62,
              color: '#D6D3D1',
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            }}
          >
            Something went wrong before the page could start. Reloading usually clears it.
            If it does not, please call the shop on{' '}
            <a href="tel:+919443947853" style={{ color: '#FAFAF9', textDecoration: 'underline' }}>
              +91 94439 47853
            </a>{' '}
            — we can take your order directly.
          </p>

          <div
            style={{
              marginTop: '3rem',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'baseline',
              gap: '2.5rem',
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                appearance: 'none',
                background: 'none',
                border: 'none',
                borderBottom: '1px solid rgba(161,98,7,0.7)',
                padding: '0 0 0.5rem',
                cursor: 'pointer',
                color: '#FAFAF9',
                fontSize: '0.78rem',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              }}
            >
              Try again
            </button>

            {/* A plain anchor, not next/link — the router is part of what
                failed, so a full document load is the reliable escape. */}
            <a
              href="/"
              style={{
                color: '#A8A29E',
                fontSize: '0.78rem',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                textDecoration: 'none',
                fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              }}
            >
              Reload the site
            </a>
          </div>

          {error.digest && (
            <p
              style={{
                marginTop: '3.5rem',
                paddingTop: '2rem',
                borderTop: '1px solid #3A3431',
                fontSize: '0.78rem',
                color: '#A8A29E',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              }}
            >
              Reference {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
