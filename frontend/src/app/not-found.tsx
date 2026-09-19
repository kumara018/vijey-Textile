import Link from 'next/link';
import DepartmentIndex from '@/components/nav/DepartmentIndex';

/**
 * 404.
 *
 * The previous version was a 🧵 emoji above a maroon "404" and a
 * `.btn-primary` — three things that no longer exist in this design system.
 *
 * A 404 is a navigation failure, so the page's job is navigation, not
 * apology. The categories below are the actual catalogue: a visitor who
 * mistyped a URL or followed a dead link is one click from the department
 * they wanted, rather than being sent back to the homepage to start again.
 */
export const metadata = {
  title: 'Page not found — Vijey Textile',
  // A 404 must never be indexed as content.
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="relative min-h-[78svh]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(247,241,232,0.94) 0%, rgba(247,241,232,0.86) 55%, rgba(247,241,232,0.94) 100%)',
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-[78svh] w-full max-w-[112rem] flex-col justify-center px-6 py-[14vh] sm:px-10">
        <p className="mb-8 text-rule uppercase text-brass-bright">Error 404</p>

        <h1 className="max-w-[16ch] font-display text-chapter font-light text-paper">
          This page is no longer here
        </h1>

        <p className="mt-8 max-w-[52ch] text-lede text-paper-muted">
          The address may have changed, or the piece may have sold. Everything the shop
          currently holds is below.
        </p>

        <div className="mt-12">
          <Link
            href="/products"
            className="group inline-flex items-baseline gap-4 border-b border-brass/70 pb-2 text-caption uppercase text-paper transition-colors duration-500 hover:border-brass-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
          >
            See every piece
            <span aria-hidden="true" className="transition-transform duration-500 group-hover:translate-x-1.5">
              →
            </span>
          </Link>
        </div>

        {/* The catalogue, as an index rather than a grid of tiles — this is a
            wayfinding surface, and a numbered list reads faster than cards.
            It reads the workroom's live category list. */}
        <DepartmentIndex />
      </div>
    </div>
  );
}
