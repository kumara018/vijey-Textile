import AdminDashboard from './AdminDashboard';

/**
 * /admin — the dashboard overview.
 *
 * The five working views live at their own addresses under this one; see
 * `admin/[view]/page.tsx`.
 */
export default function AdminPage() {
  return <AdminDashboard initialView="dash" />;
}
