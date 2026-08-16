'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * The frame every admin view sits in.
 *
 * The admin is a WORK TOOL, used all day, and that changes the design brief
 * rather than relaxing it. Three consequences, all deliberate:
 *
 *  1. NO SCENE, NO SCRIM, NO MOTION. The admin resolves to the `plain` scene
 *     and renders zero draw calls. Atmosphere behind a page someone reads for
 *     six hours is a cost with no return, and a page that animates on every
 *     navigation is exhausting to work in.
 *  2. DENSITY IS A FEATURE. The storefront's editorial rhythm — 12vh sections,
 *     huge display type — is wrong here. This uses a tighter measure and a
 *     smaller scale so more rows fit on screen, which is what someone
 *     processing forty orders actually needs.
 *  3. THE SAME PALETTE AND TYPE. It is the same shop. Brass still marks the
 *     one thing that needs attention, and nothing else competes for it.
 *
 * The tabs are real links to real routes now, so the browser's back button,
 * bookmarks and "open in new tab" all work — a person managing orders in one
 * tab and products in another is the normal case, and component state could
 * never support it.
 */

const VIEWS = [
  { href: '/admin', label: 'Dashboard', match: (p: string) => p === '/admin' },
  { href: '/admin/orders', label: 'Orders', match: (p: string) => p === '/admin/orders' },
  { href: '/admin/products', label: 'Products', match: (p: string) => p === '/admin/products' },
  { href: '/admin/returns', label: 'Returns', match: (p: string) => p === '/admin/returns' },
  { href: '/admin/cancellations', label: 'Cancelled', match: (p: string) => p === '/admin/cancellations' },
  { href: '/admin/users', label: 'Customers', match: (p: string) => p === '/admin/users' },
  { href: '/admin/ratings', label: 'Ratings', match: (p: string) => p === '/admin/ratings' },
  { href: '/admin/admins', label: 'Admins', match: (p: string) => p === '/admin/admins' },
];

export default function AdminShell({
  title,
  standfirst,
  actions,
  children,
  /** Per-view unread counts, keyed by href. Brass, and only when non-zero. */
  badges = {},
}: {
  title: string;
  standfirst?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-[80svh] bg-ink">
      <div className="mx-auto w-full max-w-[100rem] px-6 py-10 sm:px-10">
        <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
          <div>
            <p className="text-rule uppercase text-brass-bright">Vijey Textile · Admin</p>
            <h1 className="mt-3 font-display text-3xl font-light text-paper">{title}</h1>
            {standfirst && <p className="mt-2 text-sm text-paper-muted">{standfirst}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-x-8 gap-y-3">{actions}</div>}
        </header>

        {/* Real links, so back/bookmark/new-tab all work. */}
        <nav aria-label="Admin sections" className="mt-9 border-b border-ink-edge">
          <ul className="-mb-px flex flex-wrap gap-x-7">
            {VIEWS.map((v) => {
              const active = v.match(pathname);
              const badge = badges[v.href] ?? 0;
              return (
                <li key={v.href}>
                  <Link
                    href={v.href}
                    aria-current={active ? 'page' : undefined}
                    className={`inline-flex items-baseline gap-2 border-b-2 pb-3 text-caption uppercase transition-colors duration-500 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright ${
                      active
                        ? 'border-brass-bright text-paper'
                        : 'border-transparent text-paper-faint hover:text-paper-muted'
                    }`}
                  >
                    {v.label}
                    {badge > 0 && (
                      <span className="text-rule tabular-nums text-brass-bright">
                        {badge}
                        <span className="sr-only"> needing attention</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="pt-9">{children}</main>
      </div>
    </div>
  );
}
