'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { adminReturnsAPI } from '@/lib/api';
import AdminShell from './AdminShell';
import { ActionButton } from '@/components/system/Action';
import { ErrorState, Skeleton, SkeletonLine, Announce } from '@/components/system/States';

/**
 * Admin — returns and exchanges.
 *
 * The view where money decisions are made: approving a refund, rejecting a
 * claim, chasing a pickup that did not happen. It is also the one place where
 * the shop's automation and the courier's reality can disagree, which is what
 * this design has to make visible.
 *
 * WHAT CHANGED IN SUBSTANCE
 *
 * A REQUEST IS EXPANDED IN PLACE, NOT IN A ROW OF ICON BUTTONS. The old view
 * put retry-pickup, attach-AWB, retry-replacement and sync behind small
 * unlabelled controls in a cramped cell. Those are consequential, occasionally
 * destructive operations. They are now full labelled actions inside an
 * expanded panel, shown only when the request is actually in a state where
 * they apply.
 *
 * THE PHOTOS ARE THE EVIDENCE, so they are visible at a usable size in the
 * expanded panel rather than as thumbnails you must click through. A refund is
 * being approved or refused on the strength of them.
 *
 * REJECTION REQUIRES A NOTE. The old form let a request be rejected with an
 * empty reason, and that note is the only thing the customer is shown. A
 * refusal with no explanation is how a policy decision becomes a complaint.
 *
 * ATTACH-AWB IS A RECONCILIATION TOOL and is labelled as one — it exists for
 * when a pickup was booked outside the app and the record needs to catch up,
 * not as a normal step.
 */

const STATUS_FLOW = [
  'pending', 'under_review', 'approved', 'pickup_scheduled', 'picked_up',
  'processing', 'replacement_shipped', 'refund_initiated', 'refunded', 'completed', 'rejected',
];

/** Requests where the shop, not the courier, is the blocker. */
const NEEDS_DECISION = new Set(['pending', 'under_review']);
const CLOSED = new Set(['completed', 'refunded', 'rejected']);

const label = (s: string) => s.replace(/_/g, ' ');

export default function AdminReturnsView() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [awb, setAwb] = useState<Record<number, string>>({});
  const [announcement, setAnnouncement] = useState('');
  const [rowError, setRowError] = useState('');

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
      const res = await adminReturnsAPI.getAll();
      setRows(res.data ?? []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user?.is_admin) load(); }, [user, load]);

  useEffect(() => {
    if (!announcement) return;
    const t = setTimeout(() => setAnnouncement(''), 2200);
    return () => clearTimeout(t);
  }, [announcement]);

  /** Decisions first, then everything open, then closed. */
  const sorted = useMemo(() => {
    const rank = (r: any) =>
      NEEDS_DECISION.has(r.status) ? 0 : CLOSED.has(r.status) ? 2 : 1;
    return [...rows].sort((a, b) => {
      const d = rank(a) - rank(b);
      if (d !== 0) return d;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [rows]);

  const waiting = rows.filter((r) => NEEDS_DECISION.has(r.status)).length;

  const run = async (id: number, fn: () => Promise<any>, done: string) => {
    setBusyId(id);
    setRowError('');
    try {
      const res = await fn();
      setAnnouncement(res?.data?.message || done);
      await load();
      heading.current?.focus();
    } catch (err: any) {
      // The real courier message matters here — "could not book pickup" with
      // no detail is what sent people to the Delhivery dashboard to guess.
      setRowError(err?.response?.data?.detail || 'That did not go through. Try again in a moment.');
    } finally {
      setBusyId(null);
    }
  };

  const setStatus = (r: any, status: string) => {
    const note = (notes[r.id] ?? '').trim();
    if (status === 'rejected' && !note) {
      setRowError('A rejection needs a note — it is the only explanation the customer sees.');
      return;
    }
    run(
      r.id,
      () => adminReturnsAPI.updateStatus(r.id, { status, admin_notes: note || undefined }),
      `Request moved to ${label(status)}.`,
    );
  };

  if (authLoading || !user?.is_admin) return null;

  return (
    <AdminShell
      title="Returns and exchanges"
      standfirst={
        loading ? undefined
          : waiting > 0
            ? `${waiting} waiting on a decision from you.`
            : 'No request is waiting on a decision.'
      }
      badges={{ '/admin/returns': waiting }}
      actions={
        <ActionButton tone="quiet" arrow={false} onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </ActionButton>
      }
    >
      <Announce message={announcement} />
      <h2 ref={heading} tabIndex={-1} className="sr-only focus:outline-none">Requests</h2>

      {loading && (
        <Skeleton label="Loading requests">
          <div className="space-y-4">
            {[0, 1, 2].map((i) => <SkeletonLine key={i} w="w-full" h="h-12" />)}
          </div>
        </Skeleton>
      )}

      {failed && !loading && (
        <ErrorState
          title="We could not load the requests"
          body="Nothing has changed — this is a problem reaching the server."
          onRetry={load}
          fallbackHref="/admin"
          fallbackLabel="Back to the dashboard"
        />
      )}

      {!loading && !failed && sorted.length === 0 && (
        <p className="max-w-[52ch] text-lede text-paper-muted">
          No returns or exchanges have been raised. This is the state you want.
        </p>
      )}

      {!loading && !failed && sorted.length > 0 && (
        <ul>
          {sorted.map((r) => {
            const open = openId === r.id;
            const busy = busyId === r.id;
            const needs = NEEDS_DECISION.has(r.status);
            return (
              <li key={r.id} className="border-b border-ink-edge/40">
                <button
                  type="button"
                  onClick={() => { setOpenId(open ? null : r.id); setRowError(''); }}
                  aria-expanded={open}
                  className="flex w-full flex-wrap items-baseline justify-between gap-x-8 gap-y-2 py-4 text-left transition-colors duration-500 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
                >
                  <span className="min-w-0">
                    <span className="font-mono tabular-nums text-paper">
                      {r.order?.order_number ?? `Order ${r.order_id}`}
                    </span>
                    <span className="ml-4 capitalize text-paper-muted">{r.request_type}</span>
                    <span className="mt-1 block text-xs text-paper-faint">
                      {r.user?.full_name ?? 'Customer'} · {label(r.reason)}
                    </span>
                  </span>
                  <span className={`capitalize ${needs ? 'text-brass-bright' : 'text-paper-muted'}`}>
                    {label(r.status)}
                  </span>
                </button>

                {open && (
                  <div className="pb-8 pl-0 sm:pl-6">
                    {rowError && (
                      <p role="alert" className="mb-5 text-sm text-brass-bright">{rowError}</p>
                    )}

                    {/* The evidence, at a size you can actually judge. */}
                    {r.images?.length > 0 && (
                      <div className="mb-6">
                        <p className="text-rule uppercase text-paper-faint">Photos from the customer</p>
                        <ul className="mt-3 flex flex-wrap gap-3">
                          {r.images.map((src: string, i: number) => (
                            <li key={src}>
                              <a href={src} target="_blank" rel="noopener noreferrer"
                                 className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={src} alt={`Evidence photo ${i + 1}`}
                                     className="h-40 w-32 border border-ink-edge object-cover" loading="lazy" />
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {r.description && (
                      <p className="mb-6 max-w-[60ch] border-l border-ink-edge pl-5 text-sm text-paper-muted">
                        {r.description}
                      </p>
                    )}

                    {/* Courier facts */}
                    <dl className="mb-6 grid gap-x-10 gap-y-3 text-sm sm:grid-cols-2">
                      {r.pickup_otp && (
                        <div>
                          <dt className="text-rule uppercase text-paper-faint">Pickup code</dt>
                          <dd className="mt-1 font-mono tabular-nums text-paper">{r.pickup_otp}</dd>
                        </div>
                      )}
                      {r.return_awb && (
                        <div>
                          <dt className="text-rule uppercase text-paper-faint">Pickup AWB</dt>
                          <dd className="mt-1 font-mono text-paper">{r.return_awb}</dd>
                        </div>
                      )}
                      {r.replacement_awb && (
                        <div>
                          <dt className="text-rule uppercase text-paper-faint">Replacement AWB</dt>
                          <dd className="mt-1 font-mono text-paper">{r.replacement_awb}</dd>
                        </div>
                      )}
                      {r.pickup_last_status && (
                        <div>
                          <dt className="text-rule uppercase text-paper-faint">Courier says</dt>
                          <dd className="mt-1 text-paper-muted">{r.pickup_last_status}</dd>
                        </div>
                      )}
                    </dl>

                    {/* The note — required for a rejection. */}
                    <div className="mb-6 max-w-xl">
                      <label htmlFor={`note-${r.id}`} className="block text-rule uppercase text-paper-faint">
                        Note to the customer
                      </label>
                      <textarea
                        id={`note-${r.id}`}
                        rows={2}
                        value={notes[r.id] ?? r.admin_notes ?? ''}
                        onChange={(e) => { setNotes((p) => ({ ...p, [r.id]: e.target.value })); setRowError(''); }}
                        className="mt-2 w-full resize-y border-b border-ink-edge bg-transparent pb-2 text-sm text-paper focus:border-paper-faint focus:outline-none focus-visible:border-brass-bright"
                      />
                      <p className="mt-1.5 text-xs text-paper-faint">
                        Required to reject. This is the only explanation the customer is shown.
                      </p>
                    </div>

                    {/* Status, as labelled actions rather than a bare select. */}
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                      <label htmlFor={`status-${r.id}`} className="text-rule uppercase text-paper-faint">
                        Move to
                      </label>
                      <select
                        id={`status-${r.id}`}
                        value={r.status}
                        disabled={busy}
                        onChange={(e) => setStatus(r, e.target.value)}
                        className="border-b border-ink-edge bg-transparent pb-1 text-sm capitalize text-paper disabled:opacity-40 focus:border-paper-faint focus:outline-none focus-visible:border-brass-bright"
                      >
                        {STATUS_FLOW.map((s) => (
                          <option key={s} value={s} className="bg-ink capitalize">{label(s)}</option>
                        ))}
                      </select>
                    </div>

                    {/* Recovery tools, shown only where they apply. */}
                    <div className="mt-7 flex flex-wrap items-center gap-x-8 gap-y-3">
                      {r.return_awb && (
                        <ActionButton tone="quiet" arrow={false} disabled={busy}
                          onClick={() => run(r.id, () => adminReturnsAPI.syncDelhivery(r.id), 'Synced with the courier.')}>
                          Sync with courier
                        </ActionButton>
                      )}
                      {!r.return_awb && ['approved', 'pickup_scheduled'].includes(r.status) && (
                        <ActionButton tone="quiet" arrow={false} disabled={busy}
                          onClick={() => run(r.id, () => adminReturnsAPI.retryPickup(r.id), 'Pickup requested again.')}>
                          Retry pickup booking
                        </ActionButton>
                      )}
                      {r.request_type === 'exchange' && r.status === 'picked_up' && !r.replacement_awb && (
                        <ActionButton tone="quiet" arrow={false} disabled={busy}
                          onClick={() => run(r.id, () => adminReturnsAPI.retryReplacement(r.id), 'Replacement shipment requested again.')}>
                          Retry replacement shipment
                        </ActionButton>
                      )}
                    </div>

                    {/* Reconciliation, labelled as what it is. */}
                    {!r.return_awb && (
                      <div className="mt-7 max-w-md border-t border-ink-edge/60 pt-5">
                        <label htmlFor={`awb-${r.id}`} className="block text-rule uppercase text-paper-faint">
                          Attach an AWB booked outside the app
                        </label>
                        <p className="mt-1.5 text-xs text-paper-faint">
                          Reconciliation only — use this when a pickup was arranged directly with
                          the courier and this record needs to catch up.
                        </p>
                        <div className="mt-3 flex flex-wrap items-end gap-4">
                          <input
                            id={`awb-${r.id}`}
                            value={awb[r.id] ?? ''}
                            onChange={(e) => setAwb((p) => ({ ...p, [r.id]: e.target.value }))}
                            className="flex-1 border-b border-ink-edge bg-transparent pb-1.5 font-mono text-sm text-paper focus:border-paper-faint focus:outline-none focus-visible:border-brass-bright"
                          />
                          <ActionButton
                            tone="quiet"
                            arrow={false}
                            disabled={busy || !(awb[r.id] ?? '').trim()}
                            onClick={() => run(r.id, () => adminReturnsAPI.attachAwb(r.id, awb[r.id].trim()), 'AWB attached.')}
                          >
                            Attach
                          </ActionButton>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </AdminShell>
  );
}
