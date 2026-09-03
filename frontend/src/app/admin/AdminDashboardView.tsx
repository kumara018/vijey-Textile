'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { adminAPI, adminReturnsAPI } from '@/lib/api';
import AdminShell from './AdminShell';
import { ActionLink } from '@/components/system/Action';
import { ErrorState, Skeleton, SkeletonLine } from '@/components/system/States';

/**
 * The admin overview.
 *
 * The old dashboard led with four gradient stat cards and an emoji per
 * metric. Those are the numbers a shop owner glances at least — they already
 * know roughly how many products they stock. What they open this page to find
 * out is: WHAT NEEDS ME RIGHT NOW.
 *
 * So the page is inverted. Work that is waiting comes first and is the only
 * thing set in brass; the standing totals are a quiet row underneath. If
 * nothing is waiting, the page says so plainly rather than showing an empty
 * table — that is a genuinely good state and should read as one.
 *
 * Revenue is deliberately NOT in the headline position. It is a figure that
 * moves for reasons outside this screen, and putting it first turns a work
 * queue into a scoreboard.
 */

interface Dash {
  total_products: number;
  total_users: number;
  total_orders: number;
  pending_orders: number;
  total_revenue: number;
  recent_orders: any[];
}

const money = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;

export default function AdminDashboardView() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [dash, setDash] = useState<Dash | null>(null);
  const [openReturns, setOpenReturns] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/auth/login'); return; }
    if (!user.is_admin) router.replace('/');
  }, [user, authLoading, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [d, r] = await Promise.all([
        adminAPI.dashboard(),
        // Returns failing must not take the dashboard down — it is one number.
        adminReturnsAPI.getAll().catch(() => ({ data: [] })),
      ]);
      setDash(d.data);
      const rows = (r.data ?? []) as any[];
      setOpenReturns(
        rows.filter((x) => !['completed', 'refunded', 'rejected'].includes(x.status)).length,
      );
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.is_admin) load();
  }, [user, load]);

  if (authLoading || !user?.is_admin) return null;

  const waiting = (dash?.pending_orders ?? 0) + openReturns;

  return (
    <AdminShell
      title="Dashboard"
      standfirst="What needs you, and what the shop looks like today."
      badges={{ '/admin/orders': dash?.pending_orders ?? 0, '/admin/returns': openReturns }}
      actions={<ActionLink href="/" tone="quiet" arrow={false}>View the shop</ActionLink>}
    >
      {loading && (
        <Skeleton label="Loading the dashboard">
          <div className="space-y-8">
            <SkeletonLine w="w-1/2" h="h-8" />
            <div className="grid gap-6 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => <SkeletonLine key={i} w="w-full" h="h-16" />)}
            </div>
          </div>
        </Skeleton>
      )}

      {failed && !loading && (
        <ErrorState
          title="We could not load the dashboard"
          body="Nothing is wrong with the shop — this is a problem reaching the server."
          onRetry={load}
          fallbackHref="/admin/orders"
          fallbackLabel="Go to orders"
        />
      )}

      {dash && !loading && !failed && (
        <>
          {/* ── What needs you ───────────────────────────────────────── */}
          <section aria-labelledby="waiting-heading">
            <h2 id="waiting-heading" className="text-rule uppercase text-paper-faint">
              Waiting for you
            </h2>

            {waiting === 0 ? (
              <p className="mt-5 max-w-[52ch] text-lede text-paper-muted">
                Nothing is waiting. Every order is progressing and no return needs a decision —
                this is the state you want the page in.
              </p>
            ) : (
              <ul className="mt-6 flex flex-wrap gap-x-14 gap-y-6">
                {dash.pending_orders > 0 && (
                  <li>
                    <Link
                      href="/admin/orders"
                      className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
                    >
                      <span className="block font-display text-4xl tabular-nums text-brass-bright">
                        {dash.pending_orders}
                      </span>
                      <span className="mt-1 block text-sm text-paper-muted transition-colors duration-500 group-hover:text-paper motion-reduce:transition-none">
                        {dash.pending_orders === 1 ? 'order to confirm' : 'orders to confirm'}
                      </span>
                    </Link>
                  </li>
                )}
                {openReturns > 0 && (
                  <li>
                    <Link
                      href="/admin/returns"
                      className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
                    >
                      <span className="block font-display text-4xl tabular-nums text-brass-bright">
                        {openReturns}
                      </span>
                      <span className="mt-1 block text-sm text-paper-muted transition-colors duration-500 group-hover:text-paper motion-reduce:transition-none">
                        {openReturns === 1 ? 'return or exchange open' : 'returns and exchanges open'}
                      </span>
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </section>

          {/* ── Standing totals, quietly ─────────────────────────────── */}
          <section aria-labelledby="totals-heading" className="mt-[6vh] border-t border-ink-edge/60 pt-8">
            <h2 id="totals-heading" className="text-rule uppercase text-paper-faint">
              The shop
            </h2>
            <dl className="mt-6 grid gap-x-12 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Orders, all time', value: dash.total_orders.toLocaleString('en-IN') },
                { label: 'Revenue, all time', value: money(dash.total_revenue) },
                { label: 'Products listed', value: dash.total_products.toLocaleString('en-IN') },
                { label: 'Customers', value: dash.total_users.toLocaleString('en-IN') },
              ].map((s) => (
                <div key={s.label}>
                  <dt className="text-rule uppercase text-paper-faint">{s.label}</dt>
                  <dd className="mt-2 font-display text-2xl tabular-nums text-paper">{s.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* ── Recent orders ────────────────────────────────────────── */}
          <section aria-labelledby="recent-heading" className="mt-[6vh] border-t border-ink-edge/60 pt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-6">
              <h2 id="recent-heading" className="text-rule uppercase text-paper-faint">
                Latest orders
              </h2>
              <ActionLink href="/admin/orders" tone="quiet" arrow={false}>
                All orders
              </ActionLink>
            </div>

            {dash.recent_orders?.length ? (
              <div className="mt-6 overflow-x-auto overflow-y-hidden">
                <table className="w-full min-w-[36rem] border-collapse text-sm">
                  <caption className="sr-only">The most recent orders</caption>
                  <thead>
                    <tr className="border-b border-ink-edge">
                      {['Order', 'Customer', 'Status', 'Total'].map((h, i) => (
                        <th
                          key={h}
                          scope="col"
                          className={`py-3 text-rule uppercase text-paper-faint ${i === 3 ? 'text-right' : 'text-left'}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dash.recent_orders.map((o: any) => (
                      <tr key={o.id} className="border-b border-ink-edge/40">
                        <th scope="row" className="py-3 text-left font-normal">
                          <Link
                            href="/admin/orders"
                            className="font-mono tabular-nums text-paper underline-offset-4 hover:text-brass-bright hover:underline"
                          >
                            {o.order_number}
                          </Link>
                        </th>
                        <td className="py-3 text-paper-muted">{o.customer_name ?? o.user_name ?? '—'}</td>
                        <td className="py-3 capitalize text-paper-muted">
                          {String(o.status ?? '').replace(/_/g, ' ')}
                        </td>
                        <td className="py-3 text-right tabular-nums text-paper">{money(o.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-5 max-w-[52ch] text-paper-muted">
                No orders yet. They will appear here the moment one is placed.
              </p>
            )}
          </section>
        </>
      )}
    </AdminShell>
  );
}
