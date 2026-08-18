/**
 * What a piece looks like while it is being fetched.
 *
 * WHY THIS FILE EXISTS. Tapping a product did nothing visible for as long as
 * the route chunk took to arrive and the product to load — the previous page
 * stayed on screen, apparently ignoring the tap, and then the new one replaced
 * it whole. On a good connection that is a stutter; on mobile data it is long
 * enough that a customer taps a second time.
 *
 * Next's App Router streams this the instant navigation begins, before any
 * data is requested. The response to the tap is immediate, and the layout that
 * arrives is the one already on screen — the piece settles into place instead
 * of appearing from nothing.
 *
 * It mirrors the real page's proportions exactly: the same 7/5 split, the same
 * 4/5 plate, the same rhythm. A skeleton shaped differently from the page it
 * precedes is worse than no skeleton, because the layout visibly jumps at the
 * moment the content lands — which is the very stutter this removes.
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[112rem] px-6 py-10 sm:px-10">
      {/* The way back, held so it does not pop in. */}
      <div className="mb-10 flex items-center gap-4">
        <span className="block h-12 w-12 rounded-full border border-ink-edge" />
        <span className="block h-3 w-24 bg-ink-raised" />
      </div>

      <div className="grid gap-x-14 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="aspect-[4/5] w-full animate-pulse bg-ink-raised" />
        </div>

        <div className="mt-10 lg:col-span-5 lg:mt-0">
          <span className="block h-3 w-28 bg-ink-raised" />
          <span className="mt-6 block h-11 w-11/12 bg-ink-raised" />
          <span className="mt-3 block h-11 w-7/12 bg-ink-raised" />
          <span className="mt-9 block h-8 w-40 bg-ink-raised" />

          <div className="mt-9 flex flex-col gap-3">
            <span className="block h-3 w-full bg-ink-raised" />
            <span className="block h-3 w-11/12 bg-ink-raised" />
            <span className="block h-3 w-8/12 bg-ink-raised" />
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span key={i} className="block h-10 w-14 border border-ink-edge" />
            ))}
          </div>

          <span className="mt-11 block h-4 w-36 bg-ink-raised" />
        </div>
      </div>

      <span className="sr-only" role="status">Loading this piece…</span>
    </div>
  );
}
