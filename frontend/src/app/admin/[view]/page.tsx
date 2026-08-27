import { notFound } from 'next/navigation';
import AdminOrdersView from '../AdminOrdersView';
import AdminReturnsView from '../AdminReturnsView';
import { AdminUsersView, AdminRatingsView, AdminCancellationsView, AdminAdminsView, AdminErrorsView, AdminHealthView } from '../AdminListViews';
import AdminProductsView from '../AdminProductsView';

/**
 * The admin's views as real, addressable routes.
 *
 *   /admin/products    /admin/orders    /admin/returns
 *   /admin/users       /admin/ratings
 *   /admin/cancellations   /admin/admins
 *
 * Each mounts the same dashboard component with the view preselected. An
 * unknown segment 404s rather than silently falling back to the overview —
 * a mistyped admin URL should say so, not quietly show something else.
 */

const VIEWS = [
  'products',
  'orders',
  'returns',
  'users',
  'ratings',
  'cancellations',
  'admins',
  'errors',
  'health',
] as const;

/** Pre-rendered as static shells; all data is fetched client-side. */
export function generateStaticParams() {
  return VIEWS.map((view) => ({ view }));
}

/**
 * The view set is closed and known at build time, so anything outside it is
 * genuinely not a route.
 *
 * Without this, an unknown segment still rendered — reaching the `notFound()`
 * below — and Next.js served the 404 page with **HTTP 200** and cached it.
 * The body said "not found" while the status line said "fine", which is the
 * version of this bug that monitoring never catches. `dynamicParams = false`
 * moves the decision into the router, which returns a real 404 before this
 * component runs at all.
 */
export const dynamicParams = false;

const TITLES: Record<string, string> = {
  products:      'Products',
  orders:        'Orders',
  returns:       'Returns & Exchange',
  users:         'Customers',
  ratings:       'Support Ratings',
  cancellations: 'Cancelled Orders',
  admins:        'Admin Accounts',
  errors:        'Browser Errors',
  health:        'System Health',
};

export async function generateMetadata({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  return {
    title: `${TITLES[view] ?? 'Admin'} — Vijey Textile`,
    // Never let an admin screen into an index.
    robots: { index: false, follow: false },
  };
}

export default async function AdminViewPage({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  if (!VIEWS.includes(view as (typeof VIEWS)[number])) notFound();

  /**
   * THE MIGRATION IS OVER, AND THIS IS WHAT FINISHED IT.
   *
   * Views crossed onto AdminShell one at a time, and until the last one landed
   * this function ended with a fallback to the legacy dashboard. Every view in
   * VIEWS now has a branch — all eight — and anything outside VIEWS is stopped
   * by `notFound()` several lines above, so that fallback had become
   * unreachable code holding a 2,261-line component alive.
   *
   * It was not harmless. Every old-palette reference left anywhere in this
   * admin — 252 of them, maroon and generic greys from before the redesign —
   * was inside that file, so the admin measured as "still the old design"
   * while nothing a person could actually reach was. Dead code that fails an
   * audit is worse than dead code that merely costs bytes.
   */
  if (view === 'orders') return <AdminOrdersView />;
  if (view === 'returns') return <AdminReturnsView />;
  if (view === 'users') return <AdminUsersView />;
  if (view === 'ratings') return <AdminRatingsView />;
  if (view === 'cancellations') return <AdminCancellationsView />;
  if (view === 'products') return <AdminProductsView />;
  if (view === 'admins') return <AdminAdminsView />;
  if (view === 'errors') return <AdminErrorsView />;
  if (view === 'health') return <AdminHealthView />;

  // Unreachable: `notFound()` above rejects anything outside VIEWS, and every
  // member of VIEWS is handled. Kept as a typed exhaustiveness guard so adding
  // a view without a branch fails the build instead of rendering nothing.
  const unhandled: never = view as never;
  return unhandled;
}
