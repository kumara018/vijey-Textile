'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { adminAPI } from '@/lib/api';
import AdminShell from './AdminShell';
import { ActionButton } from '@/components/system/Action';
import { Announce, ErrorState, Skeleton, SkeletonLine } from '@/components/system/States';

/**
 * The three read-mostly admin views: customers, support ratings, and
 * cancelled orders.
 *
 * They share a shape — load a list, show a table, no mutations — so they share
 * one loader and one table rather than three near-identical files. That is the
 * same reasoning as the storefront's shared system: the fourth copy of a
 * pattern is where they start to drift.
 *
 * TABLES, NOT CARD GRIDS. The old views rendered each customer and each rating
 * as a bordered card. Cards are for things you browse; these are things you
 * scan and compare, and a table with aligned columns and tabular figures does
 * that in a fraction of the vertical space.
 *
 * Every table carries a caption and scope'd headers, so a screen reader can
 * navigate it by column rather than reading a flat run of cells.
 */

/* ── Shared loader ──────────────────────────────────────────────────────── */

function useAdminList<T>(fetcher: () => Promise<{ data: T[] }>) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [rows, setRows] = useState<T[]>([]);
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
      const res = await fetcher();
      setRows(res.data ?? []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
    // fetcher is a stable module-level function at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (user?.is_admin) load(); }, [user, load]);

  return { rows, loading, failed, load, ready: !authLoading && !!user?.is_admin };
}

/* ── Shared table ───────────────────────────────────────────────────────── */

function Table({
  caption,
  columns,
  children,
}: {
  caption: string;
  columns: { label: string; align?: 'right' }[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-ink-edge">
            {columns.map((c) => (
              <th
                key={c.label}
                scope="col"
                className={`py-3 text-rule uppercase text-paper-faint ${
                  c.align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Body({
  loading,
  failed,
  empty,
  emptyCopy,
  onRetry,
  children,
}: {
  loading: boolean;
  failed: boolean;
  empty: boolean;
  emptyCopy: string;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <Skeleton label="Loading">
        <div className="space-y-4">
          {[0, 1, 2, 3].map((i) => <SkeletonLine key={i} w="w-full" h="h-9" />)}
        </div>
      </Skeleton>
    );
  }
  if (failed) {
    return (
      <ErrorState
        title="We could not load this"
        body="Nothing has changed — this is a problem reaching the server."
        onRetry={onRetry}
        fallbackHref="/admin"
        fallbackLabel="Back to the dashboard"
      />
    );
  }
  if (empty) {
    return <p className="max-w-[52ch] text-lede text-paper-muted">{emptyCopy}</p>;
  }
  return <>{children}</>;
}

const shortDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const money = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;

/* ── Customers ──────────────────────────────────────────────────────────── */

export function AdminUsersView() {
  const { rows, loading, failed, load, ready } = useAdminList<any>(adminAPI.getUsers);
  if (!ready) return null;

  return (
    <AdminShell
      title="Customers"
      standfirst={loading ? undefined : `${rows.length} ${rows.length === 1 ? 'account' : 'accounts'}.`}
      actions={<ActionButton tone="quiet" arrow={false} onClick={load} disabled={loading}>Refresh</ActionButton>}
    >
      <Body
        loading={loading}
        failed={failed}
        empty={rows.length === 0}
        emptyCopy="No customers have registered yet."
        onRetry={load}
      >
        <Table
          caption="Registered customers"
          columns={[{ label: 'Name' }, { label: 'Email' }, { label: 'Phone' }, { label: 'Joined' }]}
        >
          {rows.map((u) => (
            <tr key={u.id} className="border-b border-ink-edge/40">
              <th scope="row" className="py-3 pr-4 text-left font-normal text-paper">
                {u.full_name || '—'}
                {!u.is_active && (
                  <span className="ml-3 text-rule uppercase text-brass-bright">Deactivated</span>
                )}
              </th>
              <td className="py-3 pr-4 text-paper-muted">{u.email}</td>
              <td className="py-3 pr-4 tabular-nums text-paper-muted">{u.phone || '—'}</td>
              <td className="py-3 tabular-nums text-paper-faint">{shortDate(u.created_at)}</td>
            </tr>
          ))}
        </Table>
      </Body>
    </AdminShell>
  );
}

/* ── Support ratings ────────────────────────────────────────────────────── */

export function AdminRatingsView() {
  const { rows, loading, failed, load, ready } = useAdminList<any>(adminAPI.getSupportRatings);

  /**
   * The average is the number this page exists to produce, so it is stated
   * rather than left for someone to work out from a column of digits.
   */
  const average = useMemo(() => {
    if (!rows.length) return null;
    return rows.reduce((n, r) => n + (r.rating ?? 0), 0) / rows.length;
  }, [rows]);

  if (!ready) return null;

  return (
    <AdminShell
      title="Support ratings"
      standfirst={
        loading ? undefined
          : average === null
            ? undefined
            : `${average.toFixed(1)} out of 5 across ${rows.length} ${rows.length === 1 ? 'rating' : 'ratings'}.`
      }
      actions={<ActionButton tone="quiet" arrow={false} onClick={load} disabled={loading}>Refresh</ActionButton>}
    >
      <Body
        loading={loading}
        failed={failed}
        empty={rows.length === 0}
        emptyCopy="Nobody has rated a support conversation yet. Ratings arrive from the link sent after each one."
        onRetry={load}
      >
        <Table
          caption="Support ratings, newest first"
          columns={[{ label: 'Rating' }, { label: 'From' }, { label: 'About' }, { label: 'When' }]}
        >
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-ink-edge/40 align-top">
              <th scope="row" className="py-3 pr-4 text-left font-normal">
                {/* Low scores are the ones worth finding, so those are marked. */}
                <span className={`tabular-nums ${r.rating <= 2 ? 'text-brass-bright' : 'text-paper'}`}>
                  {r.rating}
                </span>
                <span className="text-paper-faint"> / 5</span>
              </th>
              <td className="py-3 pr-4 text-paper-muted">
                {r.name || '—'}
                {r.email && <span className="mt-0.5 block text-xs text-paper-faint">{r.email}</span>}
              </td>
              <td className="py-3 pr-4 text-paper-muted">
                {r.category && <span className="block capitalize">{r.category}</span>}
                {r.message && <span className="mt-1 block max-w-[46ch] text-xs text-paper-faint">{r.message}</span>}
              </td>
              <td className="py-3 tabular-nums text-paper-faint">{shortDate(r.created_at)}</td>
            </tr>
          ))}
        </Table>
      </Body>
    </AdminShell>
  );
}

/* ── Cancelled orders ───────────────────────────────────────────────────── */

const fetchCancelled = () => adminAPI.getOrders('cancelled');

export function AdminCancellationsView() {
  const { rows, loading, failed, load, ready } = useAdminList<any>(fetchCancelled);
  if (!ready) return null;

  return (
    <AdminShell
      title="Cancelled orders"
      standfirst={
        loading ? undefined
          : `${rows.length} cancelled. Anything marked as returning to us must not be accepted if a courier delivers it.`
      }
      actions={<ActionButton tone="quiet" arrow={false} onClick={load} disabled={loading}>Refresh</ActionButton>}
    >
      <Body
        loading={loading}
        failed={failed}
        empty={rows.length === 0}
        emptyCopy="No orders have been cancelled. This is the state you want."
        onRetry={load}
      >
        <Table
          caption="Cancelled orders, newest first"
          columns={[
            { label: 'Order' }, { label: 'Customer' }, { label: 'Cancelled' },
            { label: 'Stock' }, { label: 'Total', align: 'right' },
          ]}
        >
          {rows.map((o) => (
            <tr key={o.id} className="border-b border-ink-edge/40">
              <th scope="row" className="py-3 pr-4 text-left font-normal">
                <span className="font-mono tabular-nums text-paper">{o.order_number}</span>
              </th>
              <td className="py-3 pr-4 text-paper-muted">{o.customer_name ?? o.user_name ?? '—'}</td>
              <td className="py-3 pr-4 tabular-nums text-paper-faint">{shortDate(o.updated_at ?? o.created_at)}</td>
              {/* The distinction that matters operationally: has the stock
                  come back, or is the parcel still in the courier's network? */}
              <td className="py-3 pr-4">
                {o.rto_pending ? (
                  <span className="text-brass-bright">Returning to us</span>
                ) : (
                  <span className="text-paper-muted">Back in stock</span>
                )}
              </td>
              <td className="py-3 text-right tabular-nums text-paper">{money(o.total)}</td>
            </tr>
          ))}
        </Table>
      </Body>
    </AdminShell>
  );
}

/* ── Admin accounts ─────────────────────────────────────────────────────── */

/**
 * Who can get into this panel.
 *
 * The only admin view with a destructive action, so it is the only one that
 * departs from the read-only table pattern — and the departure is deliberate
 * rather than incidental.
 *
 * TWO THINGS THIS SCREEN MUST NOT DO.
 *
 * It must not imply the browser decides. Revoking is primary-only and that is
 * enforced in `routers/admin.py:459`, which also refuses to revoke the primary
 * account or the caller's own. Hiding the button for a secondary admin is a
 * courtesy — it stops them reaching for something that would fail — not a
 * control. The empty column says WHY the button is absent rather than leaving
 * a blank cell, which reads as a rendering fault.
 *
 * It must not make removing someone a single click. Revocation locks a
 * colleague out of the shop's operations, so it takes a deliberate second step,
 * in the row, naming the person. A modal would be heavier and would move focus
 * away from the row that is about to change.
 *
 * FOCUS, after the list reloads. Removing a row while focus sits on that row's
 * button drops focus to the document and a keyboard user loses their place —
 * the cart taught this. Focus lands on the standing note instead, which is a
 * real sentence and sits directly above the table that just changed.
 */
export function AdminAdminsView() {
  const { user } = useAuth();
  const { rows, loading, failed, load, ready } = useAdminList<any>(adminAPI.getAdmins);

  const [confirming, setConfirming] = useState<number | null>(null);
  const [working, setWorking] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [actionError, setActionError] = useState('');
  const landing = useRef<HTMLParagraphElement>(null);

  const isPrimary = useMemo(
    () => rows.some((a) => a.is_primary && a.email === user?.email),
    [rows, user],
  );

  const revoke = useCallback(
    async (row: any) => {
      setWorking(row.id);
      setActionError('');
      try {
        await adminAPI.revokeAdmin(row.id);
        setAnnouncement(
          `${row.full_name || row.email} no longer has admin access. Their customer account is untouched.`,
        );
        setConfirming(null);
        await load();
        landing.current?.focus();
      } catch (e: any) {
        setActionError(
          e?.response?.data?.detail ||
            'We could not change that account. Nothing has been altered.',
        );
      } finally {
        setWorking(null);
      }
    },
    [load],
  );

  if (!ready) return null;

  return (
    <AdminShell
      title="Admin accounts"
      standfirst={
        loading
          ? undefined
          : `${rows.length} ${rows.length === 1 ? 'person has' : 'people have'} access to this panel.`
      }
      actions={<ActionButton tone="quiet" arrow={false} onClick={load} disabled={loading}>Refresh</ActionButton>}
    >
      <Announce message={announcement} />

      <p
        ref={landing}
        tabIndex={-1}
        className="max-w-[62ch] text-sm leading-relaxed text-paper-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
      >
        {isPrimary
          ? 'You are the primary admin, so you can remove admin access from anyone on this list. Removing access does not delete their account — they keep their orders and can still shop.'
          : 'Only the primary admin can grant or remove admin access. You can see who has it.'}
      </p>

      {actionError && (
        <p role="alert" className="mt-6 max-w-[62ch] text-sm text-brass-bright">
          {actionError}
        </p>
      )}

      <div className="mt-8">
        <Body
          loading={loading}
          failed={failed}
          empty={rows.length === 0}
          emptyCopy="No admin accounts came back. That should not be possible while you are signed in as one, so treat it as a server problem rather than an empty list — refresh, and tell your developer if it repeats."
          onRetry={load}
        >
          <Table
            caption="Accounts with access to the admin panel"
            columns={[
              { label: 'Name' },
              { label: 'Email' },
              { label: 'Role' },
              { label: 'Since' },
              { label: 'Access', align: 'right' },
            ]}
          >
            {rows.map((a) => {
              const self = a.email === user?.email;
              const removable = isPrimary && !a.is_primary && !self;
              return (
                <tr key={a.id} className="border-b border-ink-edge/40 align-baseline">
                  <th scope="row" className="py-4 pr-4 text-left font-normal text-paper">
                    {a.full_name || '—'}
                    {self && <span className="ml-3 text-rule uppercase text-paper-faint">You</span>}
                  </th>
                  <td className="py-4 pr-4 text-paper-muted">{a.email}</td>
                  <td className="py-4 pr-4">
                    <span className={a.is_primary ? 'text-brass-bright' : 'text-paper-muted'}>
                      {a.is_primary ? 'Primary' : 'Admin'}
                    </span>
                  </td>
                  <td className="py-4 pr-4 tabular-nums text-paper-faint">{shortDate(a.created_at)}</td>
                  <td className="py-4 text-right">
                    {!removable ? (
                      <span className="text-paper-faint">
                        {a.is_primary
                          ? 'Cannot be removed'
                          : self
                            ? 'Cannot remove yourself'
                            : 'Primary admin only'}
                      </span>
                    ) : confirming === a.id ? (
                      <span className="inline-flex flex-wrap items-baseline justify-end gap-x-7 gap-y-3">
                        <span className="text-paper-muted">Remove access?</span>
                        <ActionButton
                          arrow={false}
                          onClick={() => revoke(a)}
                          disabled={working === a.id}
                        >
                          {working === a.id ? 'Removing…' : 'Yes, remove'}
                        </ActionButton>
                        <ActionButton
                          tone="quiet"
                          arrow={false}
                          onClick={() => setConfirming(null)}
                          disabled={working === a.id}
                        >
                          Keep
                        </ActionButton>
                      </span>
                    ) : (
                      <ActionButton
                        tone="quiet"
                        arrow={false}
                        onClick={() => { setConfirming(a.id); setActionError(''); }}
                      >
                        Remove access
                      </ActionButton>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        </Body>
      </div>
    </AdminShell>
  );
}
