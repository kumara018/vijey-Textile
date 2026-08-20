/**
 * Root loading state.
 *
 * Shown while a route segment resolves. Deliberately NOT a spinner: a spinner
 * says "wait" and shows nothing, then the real page appears and everything
 * jumps. This is a skeleton in the shape of what is arriving — an eyebrow, a
 * plate-scale headline of three lines, a rule, a row of links — so the
 * transition is a fill rather than a replacement.
 *
 * A server component with no JavaScript at all. The one thing that must never
 * be slow is the thing that appears because something else is slow.
 *
 * `animate-pulse` is Tailwind's own, and `motion-reduce:animate-none` turns it
 * off for a visitor who has asked for stillness — a reduced-motion preference
 * applies to loading states exactly as much as to hero animation.
 */
export default function Loading() {
  return (
    <div
      // Announced politely rather than assertively: a screen reader user
      // should be told the page is loading, not interrupted by it.
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className="relative min-h-[78svh]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(218,203,185,0.92) 0%, rgba(218,203,185,0.84) 55%, rgba(218,203,185,0.92) 100%)',
        }}
      />

      <div
        aria-hidden="true"
        className="relative z-10 mx-auto flex min-h-[78svh] w-full max-w-[112rem] flex-col justify-center px-6 py-[14vh] sm:px-10"
      >
        <div className="animate-pulse motion-reduce:animate-none">
          {/* Eyebrow */}
          <div className="h-2.5 w-56 rounded-full bg-brass/25" />

          {/* Headline, at plate scale — three descending lines, the same
              rhythm a real opening line falls into. */}
          <div className="mt-10 space-y-5">
            <div className="h-[clamp(2.4rem,7vw,5.6rem)] w-[min(46rem,88%)] rounded-sm bg-paper/[0.07]" />
            <div className="h-[clamp(2.4rem,7vw,5.6rem)] w-[min(38rem,74%)] rounded-sm bg-paper/[0.06]" />
            <div className="h-[clamp(2.4rem,7vw,5.6rem)] w-[min(28rem,56%)] rounded-sm bg-paper/[0.05]" />
          </div>

          {/* The link row */}
          <div className="mt-14 flex flex-wrap items-center gap-x-10 gap-y-5">
            <div className="h-2.5 w-40 rounded-full bg-paper/10" />
            <div className="h-2.5 w-28 rounded-full bg-paper/[0.07]" />
          </div>
        </div>

        {/* A single brass hairline that fills left to right, the only moving
            element. It reads as progress without claiming to measure any. */}
        <div className="mt-[5vh] h-px w-full overflow-hidden bg-ink-edge/60">
          <div className="h-px w-1/3 animate-pulse bg-brass motion-reduce:animate-none" />
        </div>
      </div>

      <span className="sr-only">Loading</span>
    </div>
  );
}
