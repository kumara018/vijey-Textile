'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { ordersQuery, returnsQuery } from '@/lib/query';
import type { Order, ReturnRequest } from '@/types';
import PageShell from '@/components/system/PageShell';
import PageHeader from '@/components/system/PageHeader';
import { ActionLink } from '@/components/system/Action';
import { EmptyState, ErrorState, Skeleton, SkeletonLine } from '@/components/system/States';
import RouteErrorBoundary from '@/components/resilience/RouteErrorBoundary';

/**
 * Your orders.
 *
 * RESTRUCTURED. The old page was a stack of bordered cards with a coloured
 * status banner across the top of each, a badge, an emoji per category and a
 * separate return banner underneath — five competing devices saying roughly
 * one thing. This is a ledger: one row per order, the number set in tabular
 * figures, status as a word rather than a colour, and the return state folded
 * into the same line instead of stacked below it.
 *
 * STATUS IS NEVER COLOUR-ONLY. The old badges carried meaning in a background
 * colour, which is invisible to anyone who cannot separate those hues and
 * meaningless in a screen reader. Here the word IS the status, and brass marks
 * only the two states that need the customer to do something.
 *
 * THIS ROUTE INHERITS THE `records` SCENE — it does not own one. Records is a
 * restrained scene: line geometry in warm stone, no postprocessing, no product
 * staging. A list of past purchases is a working surface, and the scene should
 * stay out of its way.
 */

/** Which statuses want the customer's attention rather than just informing. */
const NEEDS_ATTENTION = new Set(['pending', 'out_for_delivery']);

const STATUS_LABEL: Record<string, string> = {
  pending: 'Awaiting confirmation',
  confirmed: 'Confirmed',
  processing: 'Being packed',
  shipped: 'On its way',
  out_for_delivery: 'Out for delivery today',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

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

const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;

function orderDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function OrdersInner() {
  const { user, loading: authLoading } = useAuth();

  // `enabled` keeps both queries from firing before auth resolves — a disabled
  // query is permanently `pending`, which is why the skeleton below keys off
  // isLoading rather than isPending.
  const ordersQ = useQuery({ ...ordersQuery(), enabled: !authLoading && !!user });
  const returnsQ = useQuery({ ...returnsQuery(), enabled: !authLoading && !!user });

  const orders = (ordersQ.data ?? []) as Order[];

  /**
   * Newest return per order. The API returns newest-first, so the first
   * occurrence of an order_id wins.
   *
   * Only the ORDERS query can fail this page. Returns failing degrades a line
   * of detail; it must never replace the list of orders with an error.
   */
  const returnsByOrder = useMemo(() => {
    const map: Record<number, ReturnRequest> = {};
    for (const r of (returnsQ.data ?? []) as ReturnRequest[]) {
      if (!(r.order_id in map)) map[r.order_id] = r;
    }
    return map;
  }, [returnsQ.data]);

  if (authLoading || !user) return null;

  if (ordersQ.isLoading) {
    return (
      <PageShell rhythm="tight">
        <PageHeader eyebrow="Your orders" title="Everything you have bought" />
        <Skeleton label="Loading your orders">
          <div className="space-y-8">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-3 border-t border-ink-edge/60 pt-7">
                <SkeletonLine w="w-28" h="h-2" />
                <SkeletonLine w="w-2/5" h="h-6" />
                <SkeletonLine w="w-1/3" h="h-3" />
              </div>
            ))}
          </div>
        </Skeleton>
      </PageShell>
    );
  }

  if (ordersQ.isError) {
    return (
      <PageShell rhythm="tight">
        <PageHeader eyebrow="Your orders" title="Everything you have bought" />
        <ErrorState
          title="We could not load your orders"
          body="Your orders are safe — this is a problem reaching our server, not a change to anything you have bought."
          onRetry={() => ordersQ.refetch()}
          retrying={ordersQ.isFetching}
        />
      </PageShell>
    );
  }

  if (orders.length === 0) {
    return (
      <PageShell rhythm="tight">
        <PageHeader eyebrow="Your orders" title="Everything you have bought" />
        <EmptyState
          title="You have not ordered anything yet"
          body="Nothing is missing — this fills in the moment you place your first order, and everything you buy stays here with its tracking and invoice."
          action={<ActionLink href="/products">See every piece</ActionLink>}
        />
      </PageShell>
    );
  }

  return (
    <PageShell rhythm="tight">
      <PageHeader
        eyebrow="Your orders"
        title="Everything you have bought"
        standfirst={`${orders.length} ${orders.length === 1 ? 'order' : 'orders'}, newest first.`}
      />

      <ul>
        {orders.map((o) => {
          const ret = returnsByOrder[o.id];
          const attention = NEEDS_ATTENTION.has(o.status);
          const itemCount = o.items_snapshot?.reduce((n, i: any) => n + (i.quantity ?? 1), 0) ?? 0;
          const firstItem = o.items_snapshot?.[0] as any;

          return (
            <li key={o.id} className="border-t border-ink-edge/60 first:border-t-0">
              <Link
                href={`/orders/${o.id}`}
                className="group block py-8 transition-colors duration-500 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
                  <div className="min-w-0">
                    <p className="text-rule uppercase text-paper-faint">
                      <span className="tabular-nums">{o.order_number}</span>
                      {orderDate(o.created_at) && <> · {orderDate(o.created_at)}</>}
                    </p>

                    <p className="mt-2.5 font-display text-2xl font-light text-paper transition-colors duration-500 group-hover:text-brass-bright motion-reduce:transition-none">
                      {firstItem?.name ?? 'Your order'}
                      {itemCount > 1 && (
                        <span className="text-paper-faint"> and {itemCount - 1} more</span>
                      )}
                    </p>

                    {/* Status as a word. Brass marks only what needs action. */}
                    <p className={`mt-2 text-sm ${attention ? 'text-brass-bright' : 'text-paper-muted'}`}>
                      {STATUS_LABEL[o.status] ?? o.status}
                      {ret && (
                        <span className="text-paper-faint">
                          {' · '}
                          {ret.request_type === 'exchange' ? 'Exchange' : 'Return'}:{' '}
                          {RETURN_LABEL[ret.status] ?? ret.status}
                        </span>
                      )}
                    </p>
                  </div>

                  <p className="shrink-0 font-display text-xl tabular-nums text-paper">
                    {money(o.total)}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-[7vh] border-t border-ink-edge/60 pt-10">
        <ActionLink href="/products">Keep looking</ActionLink>
      </div>
    </PageShell>
  );
}

export default function OrdersPage() {
  return (
    <RouteErrorBoundary routeName="your orders" fallbackHref="/products" fallbackLabel="See every piece">
      <OrdersInner />
    </RouteErrorBoundary>
  );
}
