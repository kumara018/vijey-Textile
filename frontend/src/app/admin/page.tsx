import AdminDashboardView from './AdminDashboardView';

/**
 * /admin — the overview.
 *
 * The seven working views still mount the legacy AdminDashboard via
 * `admin/[view]`. They are being rebuilt onto AdminShell one at a time; this
 * is the first. Mixed until they are all across, which is visible and
 * deliberate rather than hidden behind a flag.
 */
export default function AdminPage() {
  return <AdminDashboardView />;
}
