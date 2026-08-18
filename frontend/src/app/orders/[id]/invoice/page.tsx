'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { orderDetailQuery } from '@/lib/query';
import { STORE } from '@/lib/config';
import { LogoMark } from '@/components/Logo';
import type { Order } from '@/types';
import PageShell from '@/components/system/PageShell';
import { ActionButton, ActionLink } from '@/components/system/Action';
import { ErrorState, Skeleton, SkeletonLine } from '@/components/system/States';
import RouteErrorBoundary from '@/components/resilience/RouteErrorBoundary';

/**
 * Tax invoice.
 *
 * THE ONE PLACE THE PALETTE DELIBERATELY INVERTS, AND WHY.
 *
 * Everywhere else, off-white type on warm near-black is the design. An invoice
 * is different because it has a second medium: paper. Printing #1C1917 across
 * A4 floods a page with toner, bleeds through cheap stock, and produces grey
 * text on grey — and this is a document customers print for their own records
 * and for GST filing.
 *
 * So the invoice is one document with two grounds. On screen it belongs to the
 * site: ink ground, brass rules, Fraunces for the wordmark and figures. On
 * paper it is ink-on-white, with the SAME typography and the SAME brass
 * accent, because brass prints as a real colour while the ground does not need
 * to. The typography carries the brand across both; the ground follows the
 * medium.
 *
 * `@media print` is the whole mechanism — no separate template to drift out of
 * sync, no second copy of the numbers.
 *
 * The old version leaned on emoji (💵, 🛍️) and a gold gradient strip. Neither
 * survives printing in any useful form, and neither belongs on a tax document.
 */

const money = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;

function InvoiceInner({ id }: { id: number }) {
  const { user } = useAuth();
  const q = useQuery(orderDetailQuery(id));
  const order = q.data as Order | undefined;

  if (q.isLoading) {
    return (
      <PageShell rhythm="tight">
        <Skeleton label="Loading your invoice">
          <div className="space-y-6">
            <SkeletonLine w="w-40" h="h-8" />
            <SkeletonLine w="w-full" h="h-40" />
          </div>
        </Skeleton>
      </PageShell>
    );
  }

  if (q.isError || !order) {
    return (
      <PageShell rhythm="tight">
        <ErrorState
          title="We could not load this invoice"
          body="The order is safe — this is a problem reaching our server."
          onRetry={() => q.refetch()}
          retrying={q.isFetching}
          fallbackHref="/orders"
          fallbackLabel="Your orders"
        />
      </PageShell>
    );
  }

  const addr = order.shipping_address;
  const date = new Date(order.created_at).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const items = (order.items_snapshot ?? []) as any[];

  return (
    <PageShell rhythm="tight">
      {/* Controls never print. */}
      <div className="mb-10 flex flex-wrap items-center gap-x-10 gap-y-4 print:hidden">
        <ActionButton arrow={false} onClick={() => window.print()}>
          Print or save as PDF
        </ActionButton>
        <ActionLink href={`/orders/${order.id}`} tone="quiet">
          Back to this order
        </ActionLink>
      </div>

      <article className="invoice mx-auto max-w-3xl border border-ink-edge/60 p-8 sm:p-12">
        <header className="flex flex-wrap items-start justify-between gap-8 border-b border-brass/60 pb-8">
          <div className="flex items-center gap-4">
            <LogoMark size={44} />
            <div>
              <p className="font-display text-xl font-light text-paper">{STORE.name}</p>
              <p className="mt-1 text-rule uppercase text-paper-faint">{STORE.tagline}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-rule uppercase text-brass-bright">Tax invoice</p>
            <p className="mt-2 font-display text-lg tabular-nums text-paper">{order.order_number}</p>
            <p className="mt-1 text-sm text-paper-muted">{date}</p>
          </div>
        </header>

        <div className="mt-10 grid gap-10 sm:grid-cols-2">
          <section>
            <h2 className="text-rule uppercase text-paper-faint">Billed to</h2>
            <p className="mt-3 text-paper">{user?.full_name}</p>
            {user?.email && <p className="text-sm text-paper-muted">{user.email}</p>}
            {user?.phone && <p className="text-sm tabular-nums text-paper-muted">{user.phone}</p>}
          </section>

          <section>
            <h2 className="text-rule uppercase text-paper-faint">Delivered to</h2>
            <p className="mt-3 text-paper">{addr?.full_name}</p>
            <p className="text-sm text-paper-muted">
              {addr?.address_line1}
              {addr?.address_line2 && <>, {addr.address_line2}</>}
            </p>
            <p className="text-sm text-paper-muted">
              {addr?.city}, {addr?.state} — <span className="tabular-nums">{addr?.pincode}</span>
            </p>
            {addr?.phone && <p className="text-sm tabular-nums text-paper-muted">{addr.phone}</p>}
          </section>
        </div>

        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse text-sm">
            <caption className="sr-only">Items in order {order.order_number}</caption>
            <thead>
              <tr className="border-b border-ink-edge">
                <th scope="col" className="py-3 text-left text-rule uppercase text-paper-faint">Piece</th>
                <th scope="col" className="py-3 text-right text-rule uppercase text-paper-faint">Qty</th>
                <th scope="col" className="py-3 text-right text-rule uppercase text-paper-faint">Price</th>
                <th scope="col" className="py-3 text-right text-rule uppercase text-paper-faint">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-b border-ink-edge/40">
                  <td className="py-3 pr-4 text-paper">
                    {it.name}
                    {(it.size || it.color) && (
                      <span className="block text-xs text-paper-faint">
                        {[it.size && `Size ${it.size}`, it.color].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right tabular-nums text-paper-muted">{it.quantity}</td>
                  <td className="py-3 text-right tabular-nums text-paper-muted">{money(it.price)}</td>
                  <td className="py-3 text-right tabular-nums text-paper">
                    {money((it.price ?? 0) * (it.quantity ?? 1))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 flex justify-end">
          <dl className="w-full max-w-xs space-y-2.5 text-sm">
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
            <div className="flex items-baseline justify-between gap-6 border-t border-brass/60 pt-3">
              <dt className="text-paper">Total paid</dt>
              <dd className="font-display text-xl tabular-nums text-paper">{money(order.total)}</dd>
            </div>
          </dl>
        </div>

        <footer className="mt-10 border-t border-ink-edge/60 pt-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="text-rule uppercase text-paper-faint">Payment</h2>
              <p className="mt-2 text-sm capitalize text-paper-muted">
                {order.payment_method} · {order.payment_status}
              </p>
              {order.payment_transaction_id && (
                <p className="mt-1 font-mono text-xs text-paper-faint">
                  {order.payment_transaction_id}
                </p>
              )}
            </div>
            <div className="sm:text-right">
              <h2 className="text-rule uppercase text-paper-faint">Sold by</h2>
              <p className="mt-2 text-sm text-paper-muted">
                {STORE.shopNo}, {STORE.area}
                <br />
                {STORE.city}, {STORE.state} — {STORE.pincode}
                <br />
                {STORE.email}
              </p>
            </div>
          </div>
          <p className="mt-8 text-xs text-paper-faint">
            This is a computer-generated invoice and is valid without a signature.
          </p>
        </footer>
      </article>
    </PageShell>
  );
}

export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RouteErrorBoundary routeName="this invoice" fallbackHref="/orders" fallbackLabel="Your orders">
      <InvoiceInner id={Number(id)} />
    </RouteErrorBoundary>
  );
}
