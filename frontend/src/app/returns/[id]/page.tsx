'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { returnDetailQuery } from '@/lib/query';
import type { ReturnRequest } from '@/types';
import PageShell from '@/components/system/PageShell';
import PageHeader from '@/components/system/PageHeader';
import { ActionLink } from '@/components/system/Action';
import { ErrorState, Skeleton, SkeletonLine } from '@/components/system/States';
import RouteErrorBoundary from '@/components/resilience/RouteErrorBoundary';

/**
 * Following a return or an exchange.
 *
 * RESTRUCTURED. The old page was a stack of coloured cards — a teal one for
 * the pickup AWB, purple for the replacement, orange for the OTP, amber for
 * the refund — each a separate island with its own hue carrying the meaning.
 * Six colours is not a system; it is six things competing to be the most
 * urgent.
 *
 * This is one timeline. A return has a definite sequence, so the page shows
 * exactly that: what has happened, what is happening now, and what happens
 * next. Anything the customer must ACT on — the pickup code — is the one thing
 * set in brass.
 *
 * THE TWO JOURNEYS DIFFER and the old page blurred them. A return ends in
 * money coming back; an exchange ends in a replacement arriving. Showing an
 * exchange customer a "refund" stage they will never reach is a small lie that
 * generates support calls, so the stages are chosen per request_type.
 *
 * SCENE: inherits `records`.
 */

const RETURN_STAGES = [
  { key: 'pending', label: 'Request received' },
  { key: 'under_review', label: 'Under review' },
  { key: 'approved', label: 'Approved' },
  { key: 'pickup_scheduled', label: 'Pickup scheduled' },
  { key: 'picked_up', label: 'Picked up' },
  { key: 'refund_initiated', label: 'Refund initiated' },
  { key: 'refunded', label: 'Refund credited' },
];

const EXCHANGE_STAGES = [
  { key: 'pending', label: 'Request received' },
  { key: 'under_review', label: 'Under review' },
  { key: 'approved', label: 'Approved' },
  { key: 'pickup_scheduled', label: 'Pickup scheduled' },
  { key: 'picked_up', label: 'Picked up' },
  { key: 'replacement_shipped', label: 'Replacement shipped' },
  { key: 'completed', label: 'Completed' },
];

const REASON_LABEL: Record<string, string> = {
  size_issue: 'The size did not fit',
  damage: 'It arrived damaged',
};

function ReturnDetailInner({ id }: { id: number }) {
  const q = useQuery(returnDetailQuery(id));
  const rr = q.data as (ReturnRequest & Record<string, any>) | undefined;

  if (q.isLoading) {
    return (
      <PageShell rhythm="tight">
        <Skeleton label="Loading your request">
          <div className="space-y-6">
            <SkeletonLine w="w-32" h="h-2" />
            <SkeletonLine w="w-2/3" h="h-8" />
            <SkeletonLine w="w-full" h="h-32" />
          </div>
        </Skeleton>
      </PageShell>
    );
  }

  if (q.isError || !rr) {
    return (
      <PageShell rhythm="tight">
        <ErrorState
          title="We could not load this request"
          body="Your request is safe — this is a problem reaching our server."
          onRetry={() => q.refetch()}
          retrying={q.isFetching}
          fallbackHref="/orders"
          fallbackLabel="Your orders"
        />
      </PageShell>
    );
  }

  const isExchange = rr.request_type === 'exchange';
  const stages = isExchange ? EXCHANGE_STAGES : RETURN_STAGES;
  const rejected = rr.status === 'rejected';
  const stageIndex = stages.findIndex((s) => s.key === rr.status);

  return (
    <PageShell rhythm="tight">
      <PageHeader
        eyebrow={isExchange ? 'Exchange' : 'Return'}
        title={isExchange ? 'Your exchange request' : 'Your return request'}
        standfirst={
          isExchange
            ? 'We collect the original piece first, then send the replacement once it has been checked in.'
            : 'We collect the piece first, then refund your original payment method.'
        }
      >
        <ActionLink href={`/orders/${rr.order_id}`} tone="quiet" arrow={false}>
          Back to the order
        </ActionLink>
      </PageHeader>

      <div className="grid gap-x-16 gap-y-[6vh] lg:grid-cols-12">
        <div className="lg:col-span-7">
          {/* ── The action, if there is one ────────────────────────── */}
          {rr.status === 'pickup_scheduled' && rr.pickup_otp && (
            <section aria-labelledby="otp-heading" className="mb-[6vh] border-t border-brass pt-8">
              <h2 id="otp-heading" className="text-rule uppercase text-brass-bright">
                Pickup code
              </h2>
              <p className="mt-4 font-display text-4xl tabular-nums tracking-[0.3em] text-paper">
                {rr.pickup_otp}
              </p>
              <p className="mt-4 max-w-[48ch] text-sm text-paper-muted">
                Give this to the pickup agent when they collect the piece, in person. Never share
                it beforehand — it is what proves the collection actually happened.
              </p>
            </section>
          )}

          {/* ── Progress ───────────────────────────────────────────── */}
          <section aria-labelledby="progress-heading">
            <h2 id="progress-heading" className="text-rule uppercase text-paper-faint">
              Where it is
            </h2>

            {rejected ? (
              <div className="mt-5">
                <p className="max-w-[52ch] text-lede text-paper-muted">
                  This request was not approved.
                </p>
                {rr.admin_notes && (
                  <p className="mt-4 max-w-[52ch] border-l border-brass/60 pl-5 text-paper-muted">
                    {rr.admin_notes}
                  </p>
                )}
                <p className="mt-5 max-w-[52ch] text-sm text-paper-faint">
                  If you think that is wrong, call the shop — a person will look at it again.
                </p>
              </div>
            ) : (
              <ol className="mt-6">
                {stages.map((s, i) => {
                  const done = stageIndex >= i;
                  const current = stageIndex === i;
                  return (
                    <li
                      key={s.key}
                      className="flex items-baseline gap-5 border-b border-ink-edge/40 py-3.5 last:border-b-0"
                    >
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
          </section>

          {/* ── Tracking, as facts rather than coloured cards ───────── */}
          {(rr.return_awb || rr.replacement_awb || rr.refund_id) && (
            <section aria-labelledby="refs-heading" className="mt-[6vh] border-t border-ink-edge/60 pt-8">
              <h2 id="refs-heading" className="text-rule uppercase text-paper-faint">
                References
              </h2>
              <dl className="mt-6 space-y-5 text-sm">
                {rr.return_awb && (
                  <div>
                    <dt className="text-rule uppercase text-paper-faint">Pickup tracking</dt>
                    <dd className="mt-1.5 font-mono tabular-nums text-paper">
                      {rr.return_awb}
                      {' · '}
                      <a
                        href={rr.return_tracking_url || `https://www.delhivery.com/track/package/${rr.return_awb}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-sans underline underline-offset-4 hover:text-brass-bright"
                      >
                        Track
                      </a>
                    </dd>
                  </div>
                )}
                {rr.replacement_awb && (
                  <div>
                    <dt className="text-rule uppercase text-paper-faint">Replacement tracking</dt>
                    <dd className="mt-1.5 font-mono tabular-nums text-paper">
                      {rr.replacement_awb}
                      {' · '}
                      <a
                        href={rr.replacement_tracking_url || `https://www.delhivery.com/track/package/${rr.replacement_awb}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-sans underline underline-offset-4 hover:text-brass-bright"
                      >
                        Track
                      </a>
                    </dd>
                  </div>
                )}
                {rr.refund_id && (
                  <div>
                    <dt className="text-rule uppercase text-paper-faint">Refund reference</dt>
                    <dd className="mt-1.5 select-all font-mono text-paper">{rr.refund_id}</dd>
                    <dd className="mt-1 text-xs text-paper-faint">
                      Banks usually take 5–7 working days to show a refund.
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          )}
        </div>

        {/* ── What this is about ─────────────────────────────────── */}
        <aside aria-labelledby="about-heading" className="lg:col-span-4 lg:col-start-9">
          <div className="border-t border-ink-edge/60 pt-8 lg:sticky lg:top-28">
            <h2 id="about-heading" className="text-rule uppercase text-paper-faint">
              This request
            </h2>

            <dl className="mt-6 space-y-4 text-sm">
              <div>
                <dt className="text-rule uppercase text-paper-faint">Reason</dt>
                <dd className="mt-1.5 text-paper-muted">
                  {REASON_LABEL[rr.reason] ?? rr.reason}
                </dd>
              </div>
              {rr.description && (
                <div>
                  <dt className="text-rule uppercase text-paper-faint">You told us</dt>
                  <dd className="mt-1.5 text-paper-muted">{rr.description}</dd>
                </div>
              )}
              <div>
                <dt className="text-rule uppercase text-paper-faint">Order</dt>
                <dd className="mt-1.5">
                  <Link
                    href={`/orders/${rr.order_id}`}
                    className="text-paper underline underline-offset-4 hover:text-brass-bright"
                  >
                    View the order
                  </Link>
                </dd>
              </div>
            </dl>

            {isExchange && rr.new_product && (
              <div className="mt-8 border-t border-ink-edge/60 pt-6">
                <h3 className="text-rule uppercase text-paper-faint">Replacing with</h3>
                <p className="mt-3 text-paper">{rr.new_product.name}</p>
                <p className="mt-1 text-sm text-paper-faint">
                  {[rr.new_size && `Size ${rr.new_size}`, rr.new_color].filter(Boolean).join(' · ')}
                </p>
              </div>
            )}

            {rr.images?.length > 0 && (
              <div className="mt-8 border-t border-ink-edge/60 pt-6">
                <h3 className="text-rule uppercase text-paper-faint">Photos you sent</h3>
                <ul className="mt-4 flex flex-wrap gap-3">
                  {rr.images.map((src: string, i: number) => (
                    <li key={src}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt={`Photo ${i + 1} of the problem`}
                        className="h-24 w-20 border border-ink-edge object-cover"
                        loading="lazy"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>
    </PageShell>
  );
}

export default function ReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RouteErrorBoundary routeName="this request" fallbackHref="/orders" fallbackLabel="Your orders">
      <ReturnDetailInner id={Number(id)} />
    </RouteErrorBoundary>
  );
}
