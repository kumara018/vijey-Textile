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
            'linear-gradient(180deg, rgba(247,234,238,0.94) 0%, rgba(247,234,238,0.88) 50%, rgba(247,234,238,0.94) 100%)',
        }}
      />
      <div
        className={[
          'relative z-10 w-full',
          width === 'measure' ? 'mx-auto max-w-[112rem] px-6 sm:px-10' : '',
          /**
           * THE TOP HAS TO CLEAR A FIXED HEADER, AND A PERCENTAGE CANNOT
           * PROMISE THAT.
           *
           * The rhythm was `py-[4vh]` / `py-[6vh]` on both edges. The header
           * (components/nav/OverlayNav.tsx) is `fixed`, and roughly 5.5rem
           * tall regardless of viewport — so on any screen where 7vh is less
           * than that, the first element on the page renders UNDERNEATH it.
           *
           * That is not hypothetical: it is why the back control on a product
           * page appeared jammed into the wordmark, with the category name
           * sitting level with the second line of the logo. It reads as a
           * misaligned control, and the control is fine — it was being
           * overlapped. Anything whose first child is not a PageHeader (which
           * carries its own space) hits this, and short viewports hit it
           * worst: a phone in landscape at 380px tall gets 27px of 7vh.
           *
           * `max()` keeps the airy rhythm on a tall screen and guarantees the
           * clearance on a short one. The bottom keeps the plain percentage —
           * nothing is fixed down there.
           */
          /* The header is in flow now (see nav/OverlayNav.tsx), so it takes its
             own space and nothing has to be padded out from under it. The
             `max(…, 6.5rem)` clearance that used to be here is now just
             double spacing at the top of every page. */
          rhythm === 'open' ? 'py-[6vh]' : 'py-[4vh]',
        ].join(' ')}
      >
        {children}
      </div>
    </div>
  );
}
