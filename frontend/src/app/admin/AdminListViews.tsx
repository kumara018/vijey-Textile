'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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

/* ── Browser errors ─────────────────────────────────────────────────────── */

/**
 * What actually broke, in real customers' browsers.
 *
 * Reports arrive from `lib/errorReporter` and land in `client_errors`. Without
 * this screen the pipe existed and nothing came out of it — errors nobody can
 * look at are not monitoring, they are storage.
 *
 * NEWEST FIRST, AND GROUPED BY MESSAGE. Fifty rows of the same TypeError is one
 * bug fifty people hit, not fifty bugs, and the count is the useful number: it
 * separates "an edge case on one device" from "checkout is down for Safari".
 * The stack of the most recent occurrence is kept, because the oldest one is
 * the least likely to still be reproducible.
 *
 * An empty table is genuinely good news here, and is worded as such rather than
 * as an absence of data.
 */
export function AdminErrorsView() {
  const { rows, loading, failed, load, ready } = useAdminList<any>(adminAPI.getClientErrors);
  const [open, setOpen] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const byKey = new Map<string, { key: string; name: string; message: string; count: number; latest: any }>();
    for (const r of rows) {
      const key = `${r.name}:${r.message}`;
      const hit = byKey.get(key);
      if (hit) {
        hit.count += 1;
        // rows arrive newest-first, so the first seen is already the latest.
      } else {
        byKey.set(key, { key, name: r.name, message: r.message, count: 1, latest: r });
      }
    }
    return [...byKey.values()].sort((a, b) => b.count - a.count);
  }, [rows]);

  if (!ready) return null;

  return (
    <AdminShell
      title="Browser errors"
      standfirst={
        loading
          ? undefined
          : rows.length === 0
            ? undefined
            : `${grouped.length} distinct ${grouped.length === 1 ? 'problem' : 'problems'} across ${rows.length} ${rows.length === 1 ? 'report' : 'reports'}.`
      }
      actions={<ActionButton tone="quiet" arrow={false} onClick={load} disabled={loading}>Refresh</ActionButton>}
    >
      <Body
        loading={loading}
        failed={failed}
        empty={rows.length === 0}
        emptyCopy="No errors have been reported. That is the state you want this page in — it means no customer's browser has thrown since the last clear-out, not that reporting is switched off."
        onRetry={load}
      >
        <Table
          caption="Browser errors, most frequent first"
          columns={[
            { label: 'Count', align: 'right' },
            { label: 'Error' },
            { label: 'Where' },
            { label: 'Last seen' },
          ]}
        >
          {grouped.map((g) => (
            <Fragment key={g.key}>
              <tr className="border-b border-ink-edge/40 align-baseline">
                <td className="py-4 pr-4 text-right tabular-nums text-brass-bright">{g.count}</td>
                <th scope="row" className="py-4 pr-4 text-left font-normal">
                  <button
                    type="button"
                    onClick={() => setOpen(open === g.key ? null : g.key)}
                    aria-expanded={open === g.key}
                    className="text-left text-paper transition-colors duration-500 hover:text-brass-bright motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
                  >
                    <span className="block">{g.name}</span>
                    <span className="mt-1 block max-w-[46ch] text-paper-muted">{g.message || '—'}</span>
                  </button>
                </th>
                <td className="py-4 pr-4 text-paper-muted">
                  {/* Path only — the reporter strips query strings, because
                      reset and rating tokens live there. */}
                  {(g.latest.url || '').replace(/^https?:\/\/[^/]+/, '') || '—'}
                </td>
                <td className="py-4 tabular-nums text-paper-faint">{shortDate(g.latest.created_at)}</td>
              </tr>
              {open === g.key && (
                <tr className="border-b border-ink-edge/40">
                  <td colSpan={4} className="py-5">
                    <dl className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
                      <div>
                        <dt className="text-rule uppercase text-paper-faint">Browser</dt>
                        <dd className="mt-1 text-paper-muted">{g.latest.user_agent || '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-rule uppercase text-paper-faint">Viewport · source · digest</dt>
                        <dd className="mt-1 tabular-nums text-paper-muted">
                          {g.latest.viewport || '—'} · {g.latest.source || '—'} · {g.latest.digest || 'none'}
                        </dd>
                      </div>
                    </dl>
                    {g.latest.stack && (
                      <pre className="mt-5 max-h-72 overflow-auto whitespace-pre-wrap border-t border-ink-edge/60 pt-4 font-mono text-xs leading-relaxed text-paper-muted">
                        {g.latest.stack}
                      </pre>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </Table>
      </Body>
    </AdminShell>
  );
}


/* ── System health ──────────────────────────────────────────────────────── */

/**
 * What is actually switched on, in production, right now.
 *
 * WHY THIS SCREEN EXISTS. Every integration in this shop fails SOFTLY and on
 * purpose: an unconfigured SMS gateway prints to a log nobody reads and
 * returns as though it sent, an unconfigured courier answers "we will confirm
 * when you order", an unconfigured mailer walks Brevo then SendGrid then SMTP
 * and gives up quietly. Each is right on its own — a customer must never meet
 * a crash because a third party is down — but together they mean the shop can
 * be half-dead and look completely normal from the counter.
 *
 * That is not hypothetical. The Delhivery token was never set on either shop,
 * so for the entire life of the delivery-location feature the pincode check
 * has never once actually checked, and nothing anywhere said so.
 *
 * CONFIGURED IS NOT PROVEN, and the wording keeps them apart. Most rows report
 * that credentials are present and a client builds — a real check, and exactly
 * what every soft failure is gated on, but it cannot promise the next message
 * will be accepted. The database row IS proven: answering this request
 * required running a statement.
 *
 * No key or secret ever reaches this page. See backend/routers/diagnostics.py.
 */
export function AdminHealthView() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setFailed(false);
    try { const r = await adminAPI.getIntegrations(); setData(r.data); }
    catch { setFailed(true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.is_admin) { router.replace('/'); return; }
    load();
  }, [authLoading, user, router, load]);

  if (authLoading || !user?.is_admin) return null;

  const d = data;

  /* Three tones, not two. "Off" is not always bad — SMS is optional when
     WhatsApp carries the codes — so the middle tone says "absent, and that may
     be deliberate" without either alarming or reassuring falsely. */
  const Row = ({ label, tone, value, note }: {
    label: string; tone: 'on' | 'off' | 'warn'; value: string; note?: string;
  }) => (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-ink-edge/40 py-4">
      <span
        aria-hidden="true"
        className={`inline-block h-2 w-2 shrink-0 translate-y-[-1px] rounded-full ${
          tone === 'on' ? 'bg-positive' : tone === 'warn' ? 'bg-caution' : 'bg-critical'
        }`}
      />
      <span className="min-w-[8rem] text-paper">{label}</span>
      <span className={`text-sm ${tone === 'on' ? 'text-paper-muted' : 'text-paper'}`}>{value}</span>
      {note && <span className="w-full pl-6 text-xs text-paper-faint sm:w-auto sm:pl-0">&middot; {note}</span>}
    </div>
  );

  return (
    <AdminShell
      title="System health"
      standfirst={d ? `Checked ${new Date(d.checked_at).toLocaleString()}.` : undefined}
      actions={<ActionButton tone="quiet" arrow={false} onClick={load} disabled={loading}>Re-check</ActionButton>}
    >
      <Body
        loading={loading}
        failed={failed}
        // Never empty: there is always a fixed set of integrations to report
        // on, so the empty branch is unreachable here by construction.
        empty={false}
        emptyCopy=""
        onRetry={load}
      >
        {d && (
          <>
            <div className="max-w-[54rem]">
              <Row
                label="Database"
                tone={d.database?.reachable ? 'on' : 'off'}
                value={d.database?.reachable ? 'Reachable' : `Unreachable (${d.database?.error ?? 'unknown'})`}
                note="proven — this page ran a query to answer"
              />
              <Row
                label="Payments"
                tone={!d.payments?.configured ? 'off' : d.payments.mode === 'live' ? 'on' : 'warn'}
                value={
                  !d.payments?.configured ? 'Not configured — customers cannot pay'
                    : d.payments.mode === 'live' ? 'Live keys — real money'
                    : d.payments.mode === 'test' ? 'TEST keys — no real money moves'
                    : 'Configured, key format unrecognised'
                }
                note={d.payments?.configured && !d.payments.webhook
                  ? 'no webhook secret — refunds and out-of-session payments never reach the shop'
                  : undefined}
              />
              {/* CONFIGURED IS NOT DELIVERED, and this row is the reason that
                  distinction earns its keep. The SMTP host was hardcoded to
                  Gmail while the shop's mailbox is elsewhere, so credentials
                  were present, this row would have been green, and not one
                  message ever left. `last_send` reports what the most recent
                  attempt actually did. */}
              <Row
                label="Email"
                tone={
                  !d.email?.configured ? 'off'
                    : d.email.last_send?.attempted && d.email.last_send?.ok === false ? 'off'
                    : d.email.last_send?.ok ? 'on'
                    : 'warn'
                }
                value={
                  !d.email?.configured
                    ? 'Not configured — no order confirmations, no codes by email'
                    : d.email.last_send?.attempted && d.email.last_send?.ok === false
                      ? `FAILING — ${d.email.last_send.detail ?? 'send rejected'}`
                      : d.email.last_send?.ok
                        ? `Sending via ${d.email.active}${d.email.last_send.host ? ` (${d.email.last_send.host})` : ''}`
                        : `Configured for ${d.email.active} — nothing sent yet this run`
                }
                note={
                  d.email?.last_send?.ok === false && String(d.email.last_send.detail ?? '').includes('SMTP_HOST')
                    ? 'set SMTP_HOST — a custom-domain mailbox cannot be guessed. Hostinger uses smtp.hostinger.com on 587'
                    : d.email?.configured && !d.email.reply_to
                      ? 'no support address — customer replies go nowhere'
                      : undefined
                }
              />
              {/* A TOKEN BEING PRESENT IS NOT A TOKEN BEING ACCEPTED. This shop
                  has one set and Delhivery answers 401 Unauthorized; the row
                  used to go green on presence alone, which is the same bug the
                  email row had. `last_call` reports what the courier said. */}
              <Row
                label="Courier"
                tone={
                  !d.courier?.configured ? 'off'
                    : d.courier.last_call?.attempted && d.courier.last_call?.ok === false ? 'off'
                    : d.courier.last_call?.ok ? 'on'
                    : 'warn'
                }
                value={
                  !d.courier?.configured
                    ? 'Not configured — pincode checks never check, no labels, no tracking'
                    : d.courier.last_call?.attempted && d.courier.last_call?.ok === false
                      ? `FAILING — ${d.courier.last_call.detail ?? 'the courier refused the call'}`
                      : d.courier.last_call?.ok
                        ? `Delhivery (${d.courier.mode})`
                        : `Delhivery (${d.courier.mode}) — no call made yet this run`
                }
                note={d.courier?.configured && !d.courier.return_address
                  ? 'no return address — reverse pickups will fail'
                  : undefined}
              />
              <Row
                label="WhatsApp"
                tone={d.messaging?.whatsapp ? 'on' : 'warn'}
                value={d.messaging?.whatsapp ? 'Sending' : 'Not configured'}
              />
              <Row
                label="SMS"
                tone={d.messaging?.sms ? 'on' : 'warn'}
                value={d.messaging?.sms ? 'Sending' : 'Not configured'}
                note={!d.messaging?.sms && d.messaging?.whatsapp
                  ? 'fine while WhatsApp carries your codes — a customer without WhatsApp gets nothing'
                  : undefined}
              />
              <Row
                label="Images"
                tone={d.media?.configured ? 'on' : 'off'}
                value={d.media?.configured
                  ? 'Cloudinary connected'
                  : 'Not configured — new product images cannot be uploaded'}
              />
              <Row
                label="Security"
                tone={d.security?.secret_key && d.security?.admin_password ? 'on' : 'off'}
                value={d.security?.secret_key && d.security?.admin_password
                  ? 'Signing key and admin password set'
                  : 'Missing a signing key or admin password'}
                note={!d.security?.frontend_url
                  ? 'no frontend URL — links in emails may point nowhere'
                  : undefined}
              />
            </div>
            <p className="mt-7 max-w-[62ch] text-xs text-paper-faint">
              Every row except the database reports that credentials are present and the client
              builds. That is the same check each integration silently fails on, so it catches the
              real problem — but it cannot promise the next message will be accepted. No key or
              secret is ever sent to this page.
            </p>
          </>
        )}
      </Body>
    </AdminShell>
  );
}
