import { notFound } from 'next/navigation';
import AdminDashboard from '../AdminDashboard';
import AdminOrdersView from '../AdminOrdersView';
import AdminReturnsView from '../AdminReturnsView';
import { AdminUsersView, AdminRatingsView, AdminCancellationsView, AdminAdminsView } from '../AdminListViews';
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

  // Views cross onto AdminShell one at a time. Anything not yet rebuilt still
  // mounts the legacy dashboard, which keeps working exactly as before.
  if (view === 'orders') return <AdminOrdersView />;
  if (view === 'returns') return <AdminReturnsView />;
  if (view === 'users') return <AdminUsersView />;
  if (view === 'ratings') return <AdminRatingsView />;
  if (view === 'cancellations') return <AdminCancellationsView />;
  if (view === 'products') return <AdminProductsView />;
  if (view === 'admins') return <AdminAdminsView />;

  return <AdminDashboard initialView={view} />;
}
