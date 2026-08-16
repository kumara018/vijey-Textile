import type { ReactNode } from 'react';

/**
 * The standard frame every rebuilt route sits in.
 *
 * Three jobs, all of which were being re-improvised per page before this
 * existed:
 *
 *  1. LEGIBILITY OVER A LIVE SCENE. The canvas is behind every route and its
 *     luminance changes as the camera moves, so no fixed text colour is safe
 *     on its own. A gradient matte holds the copy column dark. It sits at z-0
 *     *within this shell's stacking context* and the content at z-10 — the
 *     page as a whole already beats the canvas, so the scrim only has to beat
 *     the canvas, never the copy. Giving it a high z-index is what greyed out
 *     the homepage headline once already.
 *  2. ONE MEASURE. `max-w-[112rem]` and the 6/10 gutter are the site's
 *     column. Routes that invent their own drift by a few rem and the
 *     misalignment is visible the moment you navigate between them.
 *  3. A SKIP TARGET. `<main id="main">` lives in the layout; this provides the
 *     landmark structure beneath it.
 */
export default function PageShell({
  children,
  /** `full` removes the measure for routes that bleed (product grids). */
  width = 'measure',
  /** Vertical rhythm. `tight` for utility routes, `open` for editorial ones. */
  rhythm = 'open',
  className = '',
}: {
  children: ReactNode;
  width?: 'measure' | 'full';
  rhythm?: 'tight' | 'open';
  className?: string;
}) {
  return (
    <div className={`relative min-h-[70svh] ${className}`}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(20,18,16,0.93) 0%, rgba(20,18,16,0.85) 50%, rgba(20,18,16,0.93) 100%)',
        }}
      />
      <div
        className={[
          'relative z-10 w-full',
          width === 'measure' ? 'mx-auto max-w-[112rem] px-6 sm:px-10' : '',
          rhythm === 'open' ? 'py-[12vh]' : 'py-[7vh]',
        ].join(' ')}
      >
        {children}
      </div>
    </div>
  );
}
