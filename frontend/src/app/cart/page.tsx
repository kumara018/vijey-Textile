'use client';

import { useEffect, useState } from 'react';
import { mediaUrl } from '@/lib/media';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { STORE } from '@/lib/config';
import PageShell from '@/components/system/PageShell';
import PageHeader from '@/components/system/PageHeader';
import { ActionLink, ActionButton } from '@/components/system/Action';
import {
  EmptyState,
  Skeleton,
  SkeletonLine,
  SkeletonBlock,
  Announce,
} from '@/components/system/States';
import RouteErrorBoundary from '@/components/resilience/RouteErrorBoundary';

/**
 * The bag.
 *
 * A cart is a working surface, not an editorial one — someone is here to
 * change a quantity, remove a mistake and move on. So the rhythm is tighter
 * than the homepage and every control is reachable without a pointer.
 *
 * The specific things this route has to get right, which the previous version
 * did not:
 *
 *  - QUANTITY CHANGES ARE ANNOUNCED. Changing a quantity updates a total
 *    elsewhere on the page and removes nothing from the DOM a screen reader is
 *    focused on, so without a live region the change is completely silent.
 *  - REMOVAL IS ANNOUNCED AND FOCUS SURVIVES. Removing the row the keyboard is
 *    inside destroys the focused element; focus falls to <body> and the
 *    visitor is dumped at the top of the document.
 *  - IN-FLIGHT CONTROLS ARE DISABLED, NOT HIDDEN. A control that vanishes
 *    mid-interaction moves everything below it.
 *  - THE TOTAL IS NEVER A GUESS. Shipping is a real, named figure from config,
 *    not a hardcoded 49 that could drift from what checkout charges.
 */

function CartInner() {
  const { items, count, total, loading, updateItem, removeItem } = useCart();

  /** The id currently being mutated — disables just that row's controls. */
  const [busyId, setBusyId] = useState<number | null>(null);
  /** What to tell a screen reader about the last non-navigating change. */
  const [announcement, setAnnouncement] = useState('');

  const shipping = STORE.shippingFee;
  const grandTotal = total + shipping;

  // Clear a stale announcement so the same message announced twice in a row
  // is actually read out twice rather than being seen as unchanged text.
  useEffect(() => {
    if (!announcement) return;
    const t = setTimeout(() => setAnnouncement(''), 1200);
    return () => clearTimeout(t);
  }, [announcement]);

  const changeQuantity = async (itemId: number, next: number, name: string) => {
    if (next < 1) return;
    setBusyId(itemId);
    try {
      await updateItem(itemId, next);
      setAnnouncement(`${name}, quantity ${next}.`);
    } catch {
      setAnnouncement(`Could not update ${name}. Please try again.`);
    } finally {
      setBusyId(null);
    }
  };

  const drop = async (itemId: number, name: string) => {
    setBusyId(itemId);
    try {
      await removeItem(itemId);
      setAnnouncement(`${name} removed from your bag.`);
      // Focus would otherwise die with the removed row. The heading is the
      // nearest stable landmark above it.
      document.getElementById('bag-heading')?.focus();
    } catch {
      setAnnouncement(`Could not remove ${name}. Please try again.`);
    } finally {
      setBusyId(null);
    }
  };

  /* ── Loading: shaped like the real thing ──────────────────────────────── */
  if (loading) {
    return (
      <PageShell rhythm="tight">
        <PageHeader eyebrow="Your bag" title="What you have chosen" />
        <Skeleton label="Loading your bag">
          <div className="grid gap-x-16 gap-y-10 lg:grid-cols-12">
            <div className="space-y-8 lg:col-span-7">
              {[0, 1].map((i) => (
                <div key={i} className="flex gap-7 border-t border-ink-edge/60 pt-8">
                  <SkeletonBlock className="h-40 w-32 shrink-0" />
                  <div className="flex-1 space-y-4 pt-2">
                    <SkeletonLine w="w-24" h="h-2" />
                    <SkeletonLine w="w-3/4" h="h-5" />
                    <SkeletonLine w="w-32" h="h-4" />
                  </div>
                </div>
              ))}
            </div>
            <div className="lg:col-span-4 lg:col-start-9">
              <div className="space-y-5 border-t border-ink-edge/60 pt-8">
                <SkeletonLine w="w-full" h="h-4" />
                <SkeletonLine w="w-full" h="h-4" />
                <SkeletonLine w="w-2/3" h="h-7" />
              </div>
            </div>
          </div>
        </Skeleton>
      </PageShell>
    );
  }

  /* ── Empty: says WHY, and where to go ─────────────────────────────────── */
  if (items.length === 0) {
    return (
      <PageShell rhythm="tight">
        <PageHeader eyebrow="Your bag" title="What you have chosen" />
        <EmptyState
          title="You have not put anything in your bag yet"
          body="Nothing has been lost — an empty bag means nothing has been added, not that something went wrong. The whole rail is one link away."
          action={
            <>
              <ActionLink href="/products">See every piece</ActionLink>
              <ActionLink href="/wishlist" tone="quiet">
                Your wishlist
              </ActionLink>
            </>
          }
        />
      </PageShell>
    );
  }

  /* ── The bag ──────────────────────────────────────────────────────────── */
  return (
    <PageShell rhythm="tight">
      <PageHeader
        eyebrow="Your bag"
        title="What you have chosen"
        standfirst={`${count} ${count === 1 ? 'piece' : 'pieces'}, held for you while you decide.`}
      />

      {/* tabIndex -1 so focus can be moved here after a removal destroys the
          element the keyboard was inside. Never in the tab order itself. */}
      <h2 id="bag-heading" tabIndex={-1} className="sr-only">
        Items in your bag
      </h2>

      <Announce message={announcement} />

      <div className="grid gap-x-16 gap-y-[6vh] lg:grid-cols-12">
        <ul className="lg:col-span-7">
          {items.map((item) => {
            const p = item.product;
            const busy = busyId === item.id;
            const image = p.images?.[0];
            const src =
              image && !image.includes('placeholder')
                ? mediaUrl(image)
                : null;

            return (
              <li
                key={item.id}
                className="flex gap-7 border-t border-ink-edge/60 py-8 first:border-t-0 first:pt-0"
              >
                <Link
                  href={`/products/${p.id}`}
                  className="shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
                >
                  <div className="h-40 w-32 overflow-hidden bg-ink-raised">
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={src}
                        alt={p.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div aria-hidden="true" className="h-full w-full bg-ink-raised" />
                    )}
                  </div>
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="text-rule uppercase text-paper-faint">{p.category}</p>
                  <h3 className="mt-2 font-display text-2xl font-light text-paper">
                    <Link
                      href={`/products/${p.id}`}
                      className="transition-colors duration-500 hover:text-brass-bright motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
                    >
                      {p.name}
                    </Link>
                  </h3>

                  {(item.size || item.color) && (
                    <p className="mt-2 text-sm text-paper-faint">
                      {[item.size && `Size ${item.size}`, item.color].filter(Boolean).join(' · ')}
                    </p>
                  )}

                  <p className="mt-3 text-lede tabular-nums text-paper">
                    ₹{(p.price * item.quantity).toLocaleString()}
                  </p>

                  <div className="mt-auto flex flex-wrap items-center gap-x-8 gap-y-4 pt-6">
                    {/* A real labelled group. Two buttons and a live number
                        beats a <select> for one-tap adjustment, but only if
                        the number is announced — which is what the group
                        label and the live region above provide together. */}
                    <div
                      role="group"
                      aria-label={`Quantity for ${p.name}`}
                      className="flex items-center gap-5 border border-ink-edge px-4 py-2"
                    >
                      <button
                        type="button"
                        onClick={() => changeQuantity(item.id, item.quantity - 1, p.name)}
                        disabled={busy || item.quantity <= 1}
                        aria-label={`Reduce quantity of ${p.name}`}
                        className="text-lg leading-none text-paper-muted transition-colors duration-500 hover:text-paper disabled:opacity-30 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
                      >
                        −
                      </button>
                      <span className="min-w-[2ch] text-center tabular-nums text-paper">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => changeQuantity(item.id, item.quantity + 1, p.name)}
                        disabled={busy || item.quantity >= (p.stock ?? 99)}
                        aria-label={`Increase quantity of ${p.name}`}
                        className="text-lg leading-none text-paper-muted transition-colors duration-500 hover:text-paper disabled:opacity-30 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
                      >
                        +
                      </button>
                    </div>

                    <ActionButton
                      tone="quiet"
                      arrow={false}
                      disabled={busy}
                      onClick={() => drop(item.id, p.name)}
                      aria-label={`Remove ${p.name} from your bag`}
                    >
                      {busy ? 'Working…' : 'Remove'}
                    </ActionButton>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Summary */}
        <aside aria-labelledby="summary-heading" className="lg:col-span-4 lg:col-start-9">
          <div className="border-t border-ink-edge/60 pt-8 lg:sticky lg:top-32">
            <h2 id="summary-heading" className="text-rule uppercase text-paper-faint">
              Summary
            </h2>

            <dl className="mt-8 space-y-4">
              <div className="flex items-baseline justify-between gap-6">
                <dt className="text-paper-muted">
                  Subtotal · {count} {count === 1 ? 'piece' : 'pieces'}
                </dt>
                <dd className="tabular-nums text-paper">₹{total.toLocaleString()}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-6">
                <dt className="text-paper-muted">Shipping</dt>
                <dd className="tabular-nums text-paper">₹{shipping.toLocaleString()}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-6 border-t border-ink-edge/60 pt-5">
                <dt className="text-paper">Total</dt>
                <dd className="font-display text-2xl tabular-nums text-paper">
                  ₹{grandTotal.toLocaleString()}
                </dd>
              </div>
            </dl>

            <p className="mt-5 text-sm text-paper-faint">
              Final shipping is confirmed at checkout from the parcel’s weight.
            </p>

            <div className="mt-10 flex flex-col items-start gap-6">
              <ActionLink href="/checkout">Go to checkout</ActionLink>
              <ActionLink href="/products" tone="quiet">
                Keep looking
              </ActionLink>
            </div>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}

export default function CartPage() {
  return (
    <RouteErrorBoundary routeName="your bag" fallbackHref="/products" fallbackLabel="See every piece">
      <CartInner />
    </RouteErrorBoundary>
  );
}
