'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { adminAPI, adminReturnsAPI } from '@/lib/api';
import type { OrderStatusUpdatePayload } from '@/lib/contracts';
import AdminShell from './AdminShell';
import { ActionButton } from '@/components/system/Action';
import { ErrorState, Skeleton, SkeletonLine, Announce } from '@/components/system/States';

/**
 * Admin — orders.
 *
 * The daily work surface. Someone stands here and moves forty orders forward,
 * so the design brief is throughput, not composition.
 *
 * WHAT CHANGED IN SUBSTANCE
 *
 * ORDERS THAT NEED A DECISION COME FIRST. The old table was strictly
 * newest-first, so a confirmed order waiting to be packed sat wherever the
 * date put it. Waiting orders are now grouped to the top; everything else
 * follows in date order. That is the difference between reading the table and
 * working it.
 *
 * STATUS ONLY MOVES FORWARD, and the dropdown enforces it rather than the
 * server rejecting a choice after the fact. STATUS_RANK mirrors
 * backend/courier_sync.py, so a backward move is never offered — the previous
 * version let you pick one and then showed an error.
 *
 * A COMPOUND STATE IS SHOWN AS ONE LINE. An order with an open return is not
 * simply "delivered"; the row says both, because treating them as separate
 * facts is what caused a delivered-and-being-returned order to be actioned
 * twice.
 *
 * Every mutation is announced and re-fetches, so two people working the same
 * queue see the same thing.
 */

const ORDER_STATUSES = [
  'pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled',
];

/** Mirrors backend/courier_sync.py STATUS_RANK — forward-only. */
const STATUS_RANK: Record<string, number> = {
  pending: 0, confirmed: 1, processing: 2, shipped: 3, out_for_delivery: 4, delivered: 5,
};

function validNextStatuses(current: string): string[] {
  return ORDER_STATUSES.filter((s) => {
    if (s === current) return true;
    if (s === 'cancelled') return current !== 'delivered' && current !== 'cancelled';
    if (current === 'cancelled') return false;
    return (STATUS_RANK[s] ?? -1) >= (STATUS_RANK[current] ?? -1);
  });
}

/** Statuses where the shop, not the courier, is the blocker. */
const NEEDS_ACTION = new Set(['pending', 'confirmed']);

const label = (s: string) => s.replace(/_/g, ' ');
const money = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;

export default function AdminOrdersView() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [orders, setOrders] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [filter, setFilter] = useState('');

  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/auth/login'); return; }
    if (!user.is_admin) router.replace('/');
  }, [user, authLoading, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [o, r] = await Promise.all([
        adminAPI.getOrders(),
        adminReturnsAPI.getAll().catch(() => ({ data: [] })),
      ]);
      setOrders(o.data ?? []);
      setReturns(r.data ?? []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user?.is_admin) load(); }, [user, load]);

  useEffect(() => {
    if (!announcement) return;
    const t = setTimeout(() => setAnnouncement(''), 2000);
    return () => clearTimeout(t);
  }, [announcement]);

  /** Newest open return per order — the compound state each row shows. */
  const returnByOrder = useMemo(() => {
    const map: Record<number, any> = {};
    for (const r of returns) if (!(r.order_id in map)) map[r.order_id] = r;
    return map;
  }, [returns]);

  /**
   * Waiting work first, then date order. Sorting the whole table by date is
   * what made this a report instead of a queue.
   */
  const rows = useMemo(() => {
    const base = filter ? orders.filter((o) => o.status === filter) : orders;
    return [...base].sort((a, b) => {
      const aw = NEEDS_ACTION.has(a.status) ? 0 : 1;
      const bw = NEEDS_ACTION.has(b.status) ? 0 : 1;
      if (aw !== bw) return aw - bw;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [orders, filter]);

  const waiting = orders.filter((o) => NEEDS_ACTION.has(o.status)).length;

  const changeStatus = async (order: any, status: string) => {
    if (status === order.status) return;
    setBusyId(order.id);
    try {
      const payload: OrderStatusUpdatePayload = { status };
      await adminAPI.updateOrderStatus(order.id, payload);
      setAnnouncement(`${order.order_number} moved to ${label(status)}.`);
      await load();
      heading.current?.focus();
    } catch (err: any) {
      setAnnouncement(err?.response?.data?.detail || 'That change did not save.');
    } finally {
      setBusyId(null);
    }
  };

  const sync = async (order: any) => {
    setBusyId(order.id);
    try {
      const res = await adminAPI.syncDelhivery(order.id);
      setAnnouncement(res.data?.message || `${order.order_number} synced with the courier.`);
      await load();
    } catch (err: any) {
      setAnnouncement(err?.response?.data?.detail || 'The courier sync did not respond.');
    } finally {
      setBusyId(null);
    }
  };

  if (authLoading || !user?.is_admin) return null;

  return (
    <AdminShell
      title="Orders"
      standfirst={
        loading ? undefined
          : waiting > 0
            ? `${waiting} waiting for you, listed first.`
            : 'Nothing is waiting — everything here is with the courier or done.'
      }
      badges={{ '/admin/orders': waiting }}
      actions={
        <>
          <label htmlFor="status-filter" className="sr-only">Filter by status</label>
          <select
            id="status-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border-b border-ink-edge bg-transparent pb-1.5 text-sm text-paper focus:border-paper-faint focus:outline-none focus-visible:border-brass-bright"
          >
            <option value="" className="bg-ink">All statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s} className="bg-ink capitalize">{label(s)}</option>
            ))}
          </select>
          <ActionButton tone="quiet" arrow={false} onClick={load} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </ActionButton>
        </>
      }
    >
      <Announce message={announcement} />
      <h2 ref={heading} tabIndex={-1} className="sr-only focus:outline-none">Orders</h2>

      {loading && (
        <Skeleton label="Loading orders">
          <div className="space-y-4">
            {[0, 1, 2, 3, 4].map((i) => <SkeletonLine key={i} w="w-full" h="h-10" />)}
          </div>
        </Skeleton>
      )}

      {failed && !loading && (
        <ErrorState
          title="We could not load the orders"
          body="No order has changed — this is a problem reaching the server."
          onRetry={load}
          fallbackHref="/admin"
          fallbackLabel="Back to the dashboard"
        />
      )}

      {!loading && !failed && rows.length === 0 && (
        <p className="max-w-[52ch] text-lede text-paper-muted">
          {filter
            ? `No orders are currently ${label(filter)}.`
            : 'No orders yet. They appear here the moment one is placed.'}
        </p>
      )}

      {!loading && !failed && rows.length > 0 && (
        <div className="overflow-x-auto overflow-y-hidden">
          <table className="w-full min-w-[56rem] border-collapse text-sm">
            <caption className="sr-only">
              Orders, those needing attention first
            </caption>
            <thead>
              <tr className="border-b border-ink-edge">
                {['Order', 'Customer', 'Placed', 'State', 'Total', 'Move to'].map((h, i) => (
                  <th
                    key={h}
                    scope="col"
                    className={`py-3 text-rule uppercase text-paper-faint ${i === 4 ? 'text-right' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const ret = returnByOrder[o.id];
                const needs = NEEDS_ACTION.has(o.status);
                const busy = busyId === o.id;
                return (
                  <tr key={o.id} className="border-b border-ink-edge/40 align-top">
                    <th scope="row" className="py-4 pr-4 text-left font-normal">
                      <span className="font-mono tabular-nums text-paper">{o.order_number}</span>
                      {(o.awb_code || o.tracking_number) && (
                        <span className="mt-1 block font-mono text-xs text-paper-faint">
                          {o.awb_code || o.tracking_number}
                        </span>
                      )}
                    </th>

                    <td className="py-4 pr-4 text-paper-muted">
                      {o.customer_name ?? o.user_name ?? '—'}
                      {o.shipping_address?.city && (
                        <span className="mt-1 block text-xs text-paper-faint">
                          {o.shipping_address.city}
                        </span>
                      )}
                    </td>

                    <td className="py-4 pr-4 tabular-nums text-paper-faint">
                      {o.created_at
                        ? new Date(o.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short',
                          })
                        : '—'}
                    </td>

                    {/* The compound state, on one line. */}
                    <td className="py-4 pr-4">
                      <span className={`capitalize ${needs ? 'text-brass-bright' : 'text-paper-muted'}`}>
                        {label(o.status)}
                      </span>
                      {ret && (
                        <span className="mt-1 block text-xs capitalize text-paper-faint">
                          {ret.request_type} · {label(ret.status)}
                        </span>
                      )}
                      {o.rto_pending && (
                        <span className="mt-1 block text-xs text-brass-bright">
                          Returning to us
                        </span>
                      )}
                    </td>

                    <td className="py-4 pr-4 text-right tabular-nums text-paper">{money(o.total)}</td>

                    <td className="py-4">
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                        <label className="sr-only" htmlFor={`status-${o.id}`}>
                          Move {o.order_number} to a new status
                        </label>
                        <select
                          id={`status-${o.id}`}
                          value={o.status}
                          disabled={busy || o.status === 'cancelled'}
                          onChange={(e) => changeStatus(o, e.target.value)}
                          className="border-b border-ink-edge bg-transparent pb-1 text-sm capitalize text-paper disabled:opacity-40 focus:border-paper-faint focus:outline-none focus-visible:border-brass-bright"
                        >
                          {validNextStatuses(o.status).map((s) => (
                            <option key={s} value={s} className="bg-ink capitalize">{label(s)}</option>
                          ))}
                        </select>

                        {(o.awb_code || o.tracking_number) && (
                          <ActionButton
                            tone="quiet"
                            arrow={false}
                            disabled={busy}
                            onClick={() => sync(o)}
                            aria-label={`Sync ${o.order_number} with the courier`}
                          >
                            {busy ? 'Working…' : 'Sync'}
                          </ActionButton>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
