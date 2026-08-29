'use client';

import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ordersAPI } from '@/lib/api';
import OrderNotifications from '@/components/system/OrderNotifications';
import { orderDetailQuery, returnsQuery, qk } from '@/lib/query';
import type { Order, ReturnRequest as ReturnRow } from '@/types';
import PageShell from '@/components/system/PageShell';
import PageHeader from '@/components/system/PageHeader';
import { ActionButton, ActionLink } from '@/components/system/Action';
import { ErrorState, Skeleton, SkeletonLine, Announce } from '@/components/system/States';
import ReturnRequest from './ReturnRequest';

/**
 * One order.
 *
 * RESTRUCTURED. The old page was 1,100 lines of coloured banners, badge pills,
 * emoji and nested cards, with the return form inline. This is a document: the
 * order as a heading, a progress rule, the pieces as a list, and the actions
 * that are actually available right now — nothing else.
 *
 * The return/exchange form lives in its own file. A route that long stopped
 * being reviewable, which is how a form with real money rules ends up with
 * nobody able to check it.
 *
 * WHAT IS AVAILABLE WHEN — the windows are the server's, restated:
 *   cancel    within 1 hour of purchase, before dispatch
 *   return    within 4 hours of delivery
 *   exchange  within 12 hours of delivery
 *
 * These are enforced server-side and cannot be reopened, so the page states
 * the deadline as a time rather than hiding a disabled button. A customer who
 * has missed a window is owed the reason, not a control that does nothing.
 *
 * SCENE: this route INHERITS `records` — restrained line geometry in warm
 * stone. An order page is a working surface.
 */

const CANCEL_WINDOW_HOURS = 1;
const RETURN_WINDOW_HOURS = 4;
const EXCHANGE_WINDOW_HOURS = 12;

const CANCEL_REASONS = [
  'Changed my mind',
  'Ordered by mistake',
  'Found a better price elsewhere',
  'Want to change the size or colour',
  'Other',
];

/** The forward journey, in order. Cancelled is not on it. */
const JOURNEY = [
  { key: 'pending', label: 'Placed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'processing', label: 'Packed' },
  { key: 'shipped', label: 'On its way' },
  { key: 'out_for_delivery', label: 'Out for delivery' },
  { key: 'delivered', label: 'Delivered' },
];

const RETURN_LABEL: Record<string, string> = {
  pending: 'Pending review',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
  pickup_scheduled: 'Pickup scheduled',
  picked_up: 'Picked up',
  processing: 'Processing',
  replacement_shipped: 'Replacement shipped',
  refund_initiated: 'Refund initiated',
  refunded: 'Refund credited',
  completed: 'Completed',
};

const money = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;

function hoursLeft(fromIso: string, windowHours: number): number {
  const elapsed = (Date.now() - new Date(fromIso).getTime()) / 3600000;
  return windowHours - elapsed;
}

function describeLeft(h: number): string {
  if (h <= 0) return 'closed';
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} minutes left`;
  return `${Math.floor(h)} hour${Math.floor(h) === 1 ? '' : 's'} left`;
}

export default function OrderDetail({ id }: { id: number }) {
  const params = useSearchParams();
  const isNew = params.get('new') === '1';
  const queryClient = useQueryClient();

  const q = useQuery(orderDetailQuery(id));
  const returnsQ = useQuery(returnsQuery());
  const order = q.data as Order | undefined;

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [announcement, setAnnouncement] = useState('');

  const actionsHeading = useRef<HTMLHeadingElement>(null);

  const ret = useMemo(() => {
    const rows = (returnsQ.data ?? []) as ReturnRow[];
    return rows.find((r) => r.order_id === id);
  }, [returnsQ.data, id]);

  if (q.isLoading) {
    return (
      <PageShell rhythm="tight">
        <Skeleton label="Loading your order">
          <div className="space-y-6">
            <SkeletonLine w="w-32" h="h-2" />
            <SkeletonLine w="w-2/3" h="h-8" />
            <SkeletonLine w="w-full" h="h-2" />
            <SkeletonLine w="w-full" h="h-24" />
          </div>
        </Skeleton>
      </PageShell>
    );
  }

  if (q.isError || !order) {
    return (
      <PageShell rhythm="tight">
        <ErrorState
          title="We could not load this order"
          body="Your order is safe — this is a problem reaching our server, not a change to anything you have bought."
          onRetry={() => q.refetch()}
          retrying={q.isFetching}
          fallbackHref="/orders"
          fallbackLabel="All your orders"
        />
      </PageShell>
    );
  }

  const items = (order.items_snapshot ?? []) as any[];
  const cancelled = order.status === 'cancelled';
  const delivered = order.status === 'delivered';
  const stageIndex = JOURNEY.findIndex((s) => s.key === order.status);

  const cancelLeft = hoursLeft(order.created_at, CANCEL_WINDOW_HOURS);
  const canCancel =
    cancelLeft > 0 && !['cancelled', 'delivered', 'out_for_delivery', 'shipped'].includes(order.status);

  const deliveredAnchor = (order as any).delivered_at || order.created_at;
  const returnLeft = hoursLeft(deliveredAnchor, RETURN_WINDOW_HOURS);
  const exchangeLeft = hoursLeft(deliveredAnchor, EXCHANGE_WINDOW_HOURS);
  const canReturn = delivered && returnLeft > 0 && !ret && order.status !== 'cancelled';
  const canExchange = delivered && exchangeLeft > 0 && !ret && order.status !== 'cancelled';

  const doCancel = async () => {
    const reason = cancelReason === 'Other' ? customReason.trim() : cancelReason;
    if (!reason) { setActionError('Choose a reason so we know what went wrong.'); return; }
    setCancelling(true);
    setActionError('');
    try {
      await ordersAPI.cancel(order.id, reason);
      await queryClient.invalidateQueries({ queryKey: qk.orders.detail(order.id) });
      setCancelOpen(false);
      setAnnouncement('Your order has been cancelled and a refund started.');
      actionsHeading.current?.focus();
    } catch (err: any) {
      setActionError(err?.response?.data?.detail || 'We could not cancel that. Please call the shop.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <PageShell rhythm="tight">
      <Announce message={announcement} />

      <PageHeader
        eyebrow={isNew ? 'Order placed' : 'Your order'}
        title={order.order_number}
        standfirst={
          isNew
            ? 'Thank you — we have your order and will confirm it shortly. A copy is on its way to your email.'
            : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
          <ActionLink href={`/orders/${order.id}/invoice`} tone="quiet" arrow={false}>
            View invoice
          </ActionLink>
          <ActionLink href="/orders" tone="quiet" arrow={false}>
            All your orders
          </ActionLink>
        </div>
      </PageHeader>

      <div className="grid gap-x-16 gap-y-[6vh] lg:grid-cols-12">
        <div className="lg:col-span-7">
          {/* ── Where it is ─────────────────────────────────────────── */}
          <section aria-labelledby="progress-heading">
            <h2 id="progress-heading" className="text-rule uppercase text-paper-faint">
              Where it is
            </h2>

            {cancelled ? (
              <p className="mt-5 max-w-[52ch] text-lede text-paper-muted">
                This order was cancelled.{' '}
                {(order as any).rto_pending
                  ? 'It had already left us, so it is on its way back. Please do not accept it if an agent arrives — your refund and the stock are settled once it is returned to us.'
                  : 'Any payment has been refunded to your original payment method.'}
              </p>
            ) : (
              <ol className="mt-6">
                {JOURNEY.map((s, i) => {
                  const done = stageIndex >= i;
                  const current = stageIndex === i;
                  return (
                    <li key={s.key} className="flex items-baseline gap-5 border-b border-ink-edge/40 py-3.5 last:border-b-0">
                      <span
                        aria-hidden="true"
                        className={`text-rule tabular-nums ${done ? 'text-brass-bright' : 'text-paper-faint/40'}`}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className={current ? 'text-paper' : done ? 'text-paper-muted' : 'text-paper-faint/60'}>
                        {s.label}
                        {current && <span className="sr-only"> — current stage</span>}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}

            {order.status_location && !cancelled && (
              <p className="mt-5 text-sm text-paper-muted">Last seen: {order.status_location}</p>
            )}

            {(order.awb_code || order.tracking_number) && !cancelled && (
              <p className="mt-4 text-sm text-paper-muted">
                Tracking{' '}
                <span className="font-mono tabular-nums text-paper">
                  {order.awb_code || order.tracking_number}
                </span>
                {order.courier_name && <> · {order.courier_name}</>}
                {order.tracking_url && (
                  <>
                    {' · '}
                    <a
                      href={order.tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4 hover:text-paper"
                    >
                      Track with the courier
                    </a>
                  </>
                )}
              </p>
            )}
          </section>

          {/* ── Delivery OTP ────────────────────────────────────────── */}
          {order.delivery_otp && !delivered && !cancelled && (
            <section aria-labelledby="otp-heading" className="mt-[6vh] border-t border-brass/50 pt-8">
              <h2 id="otp-heading" className="text-rule uppercase text-brass-bright">
                Delivery code
              </h2>
              <p className="mt-4 font-display text-4xl tabular-nums tracking-[0.3em] text-paper">
                {order.delivery_otp}
              </p>
              <p className="mt-4 max-w-[48ch] text-sm text-paper-muted">
                Give this to the delivery agent in person. Never share it over the phone or by
                message before the parcel is in your hands.
              </p>
              {order.delivery_person_name && (
                <p className="mt-3 text-sm text-paper-faint">
                  Agent: {order.delivery_person_name}
                  {order.delivery_person_phone && <> · {order.delivery_person_phone}</>}
                </p>
              )}
            </section>
          )}

          {/* ── The pieces ──────────────────────────────────────────── */}
          {/* Offered once an order exists, which is the only moment a
              notification prompt is an answer rather than an interruption —
              see components/system/OrderNotifications. */}
          {!delivered && !cancelled && <OrderNotifications />}

          <section aria-labelledby="items-heading" className="mt-[6vh] border-t border-ink-edge/60 pt-8">
            <h2 id="items-heading" className="text-rule uppercase text-paper-faint">
              What you bought
            </h2>
            <ul className="mt-6">
              {items.map((it, i) => (
                <li key={i} className="flex items-baseline justify-between gap-6 border-b border-ink-edge/40 py-4 last:border-b-0">
                  <span className="min-w-0">
                    <Link
                      href={`/products/${it.product_id}`}
                      className="text-paper underline-offset-4 transition-colors duration-500 hover:text-brass-bright hover:underline motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
                    >
                      {it.name}
                    </Link>
                    <span className="mt-1 block text-xs text-paper-faint">
                      {[it.size && `Size ${it.size}`, it.color, `×${it.quantity}`].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-paper">
                    {money((it.price ?? 0) * (it.quantity ?? 1))}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* ── What you can do now ─────────────────────────────────── */}
          <section aria-labelledby="actions-heading" className="mt-[6vh] border-t border-ink-edge/60 pt-8">
            <h2
              ref={actionsHeading}
              tabIndex={-1}
              id="actions-heading"
              className="text-rule uppercase text-paper-faint focus:outline-none"
            >
              What you can do
            </h2>

            {actionError && <p role="alert" className="mt-5 text-sm text-brass-bright">{actionError}</p>}

            {/* An existing request outranks everything else. */}
            {ret && (
              <div className="mt-6">
                <p className="text-paper">
                  {ret.request_type === 'exchange' ? 'Exchange' : 'Return'} ·{' '}
                  <span className="text-brass-bright">{RETURN_LABEL[ret.status] ?? ret.status}</span>
                </p>
                <div className="mt-5">
                  <ActionLink href={`/returns/${ret.id}`}>Follow this request</ActionLink>
                </div>
              </div>
            )}

            {!ret && canCancel && !cancelOpen && (
              <div className="mt-6">
                <p className="max-w-[52ch] text-sm text-paper-muted">
                  You can still cancel this order — {describeLeft(cancelLeft)} of the one-hour
                  window. After that it moves into packing and cannot be stopped.
                </p>
                <div className="mt-5">
                  <ActionButton tone="quiet" arrow={false} onClick={() => setCancelOpen(true)}>
                    Cancel this order
                  </ActionButton>
                </div>
              </div>
            )}

            {cancelOpen && (
              <div className="mt-6">
                <fieldset>
                  <legend className="text-sm text-paper">Why are you cancelling?</legend>
                  <div className="mt-4 flex flex-col gap-1">
                    {CANCEL_REASONS.map((r) => (
                      <label key={r} className="flex cursor-pointer items-center gap-4 border-b border-ink-edge/40 py-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brass-bright">
                        <input type="radio" name="cancel_reason" className="sr-only"
                          checked={cancelReason === r} onChange={() => { setCancelReason(r); setActionError(''); }} />
                        <span aria-hidden="true" className={cancelReason === r ? 'text-brass-bright' : 'text-paper-faint'}>—</span>
                        <span className={cancelReason === r ? 'text-paper' : 'text-paper-muted'}>{r}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {cancelReason === 'Other' && (
                  <div className="mt-5">
                    <label htmlFor="custom-reason" className="block text-rule uppercase text-paper-faint">
                      Tell us more
                    </label>
                    <input
                      id="custom-reason"
                      value={customReason}
                      onChange={(e) => { setCustomReason(e.target.value); setActionError(''); }}
                      className="mt-2.5 w-full border-b border-ink-edge bg-transparent pb-2.5 text-paper focus:border-paper-faint focus:outline-none focus-visible:border-brass-bright"
                    />
                  </div>
                )}

                <div className="mt-7 flex flex-wrap items-center gap-x-10 gap-y-4">
                  <ActionButton arrow={false} disabled={cancelling} onClick={doCancel}>
                    {cancelling ? 'Cancelling…' : 'Confirm cancellation'}
                  </ActionButton>
                  <ActionButton tone="quiet" arrow={false} onClick={() => setCancelOpen(false)}>
                    Keep my order
                  </ActionButton>
                </div>
              </div>
            )}

            {/* Return / exchange */}
            {!ret && delivered && (canReturn || canExchange) && !returnOpen && (
              <div className="mt-6">
                <p className="max-w-[52ch] text-sm text-paper-muted">
                  {canReturn && <>Return for a refund — {describeLeft(returnLeft)}. </>}
                  {canExchange && <>Exchange for something else — {describeLeft(exchangeLeft)}.</>}
                </p>
                <div className="mt-5">
                  <ActionButton arrow={false} onClick={() => setReturnOpen(true)}>
                    Return or exchange
                  </ActionButton>
                </div>
              </div>
            )}

            {returnOpen && (
              <div className="mt-7">
                <ReturnRequest
                  order={order}
                  canReturn={canReturn}
                  canExchange={canExchange}
                  onRaised={() => {
                    setReturnOpen(false);
                    returnsQ.refetch();
                    setAnnouncement('Your request has been sent for review.');
                    actionsHeading.current?.focus();
                  }}
                />
              </div>
            )}

            {/* A closed window is explained, not hidden behind a dead button. */}
            {!ret && delivered && !canReturn && !canExchange && (
              <p className="mt-6 max-w-[52ch] text-sm text-paper-muted">
                The return window ({RETURN_WINDOW_HOURS} hours) and the exchange window
                ({EXCHANGE_WINDOW_HOURS} hours) have both closed for this order. If the piece
                arrived damaged, call us anyway — that is a conversation we would rather have.
              </p>
            )}

            {!ret && !delivered && !cancelled && !canCancel && !cancelOpen && (
              <p className="mt-6 max-w-[52ch] text-sm text-paper-muted">
                This order has moved past the one-hour cancellation window and is being prepared.
                Once it arrives you can return it within {RETURN_WINDOW_HOURS} hours or exchange
                it within {EXCHANGE_WINDOW_HOURS}.
              </p>
            )}
          </section>
        </div>

        {/* ── Summary ─────────────────────────────────────────────── */}
        <aside aria-labelledby="summary-heading" className="lg:col-span-4 lg:col-start-9">
          <div className="border-t border-ink-edge/60 pt-8 lg:sticky lg:top-28">
            <h2 id="summary-heading" className="text-rule uppercase text-paper-faint">Summary</h2>

            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between gap-6">
                <dt className="text-paper-muted">Subtotal</dt>
                <dd className="tabular-nums text-paper">{money(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-paper-muted">Shipping</dt>
                <dd className="tabular-nums text-paper">{money(order.shipping_fee)}</dd>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between gap-6">
                  <dt className="text-paper-muted">Discount</dt>
                  <dd className="tabular-nums text-paper">−{money(order.discount)}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between gap-6 border-t border-ink-edge/60 pt-4">
                <dt className="text-paper">Total</dt>
                <dd className="font-display text-2xl tabular-nums text-paper">{money(order.total)}</dd>
              </div>
            </dl>

            <div className="mt-8 border-t border-ink-edge/60 pt-6">
              <h3 className="text-rule uppercase text-paper-faint">Delivering to</h3>
              <p className="mt-3 text-sm text-paper-muted">
                {order.shipping_address?.full_name}
                <br />
                {order.shipping_address?.address_line1}
                {order.shipping_address?.address_line2 && <>, {order.shipping_address.address_line2}</>}
                <br />
                {order.shipping_address?.city}, {order.shipping_address?.state} —{' '}
                <span className="tabular-nums">{order.shipping_address?.pincode}</span>
              </p>
            </div>

            {order.open_box_delivery && (
              <p className="mt-6 text-xs text-paper-faint">
                Open-box delivery: the agent waits while you check the piece.
              </p>
            )}
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
