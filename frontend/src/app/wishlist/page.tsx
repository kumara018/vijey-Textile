'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useWishlist } from '@/context/WishlistContext';
import { useCart } from '@/context/CartContext';
import { wishlistQuery, qk } from '@/lib/query';
import PageShell from '@/components/system/PageShell';
import PageHeader from '@/components/system/PageHeader';
import { ActionLink, ActionButton } from '@/components/system/Action';
import {
  EmptyState,
  ErrorState,
  Skeleton,
  SkeletonLine,
  SkeletonBlock,
  Announce,
} from '@/components/system/States';
import RouteErrorBoundary from '@/components/resilience/RouteErrorBoundary';

/**
 * Kept — the wishlist.
 *
 * Named for what it is to this shop: pieces someone is holding in mind for an
 * occasion that has not arrived yet. That framing is why the empty state talks
 * about the occasion rather than about the feature.
 *
 * Two behaviours carried over from the previous version because they were
 * genuinely right and easy to lose in a rewrite:
 *
 *  1. Removals write into the QUERY CACHE, not a local copy. Filtering a
 *     useState array left the cache holding the removed item, so navigating
 *     away and back brought it straight back.
 *  2. `isLoading`, never `isPending`. A disabled query (auth still resolving)
 *     is permanently `pending`, which pinned the skeleton on screen forever
 *     for a signed-out visitor instead of letting the redirect happen.
 */

function WishlistInner() {
  const { user, loading: authLoading } = useAuth();
  const { toggle } = useWishlist();
  const { addItem } = useCart();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [busyId, setBusyId] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth/login');
  }, [user, authLoading, router]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    ...wishlistQuery(),
    enabled: !!user,
  });
  const items = (data ?? []) as any[];

  useEffect(() => {
    if (!announcement) return;
    const t = setTimeout(() => setAnnouncement(''), 1200);
    return () => clearTimeout(t);
  }, [announcement]);

  const dropFromCache = (productId: number) => {
    queryClient.setQueryData(qk.wishlist.list, (prev: any) =>
      Array.isArray(prev) ? prev.filter((i: any) => i.product_id !== productId) : prev,
    );
  };

  const remove = async (productId: number, name: string) => {
    setBusyId(productId);
    try {
      await toggle(productId);
      dropFromCache(productId);
      setAnnouncement(`${name} removed from kept.`);
      document.getElementById('kept-heading')?.focus();
    } catch {
      setAnnouncement(`Could not remove ${name}. Please try again.`);
    } finally {
      setBusyId(null);
    }
  };

  const moveToCart = async (item: any) => {
    const name = item.product.name;
    setBusyId(item.product_id);
    try {
      await addItem(item.product_id, 1);
      await toggle(item.product_id);
      dropFromCache(item.product_id);
      setAnnouncement(`${name} moved to your bag.`);
    } catch {
      setAnnouncement(`Could not move ${name} to your bag. Please try again.`);
    } finally {
      setBusyId(null);
    }
  };

  // The redirect above is in flight; rendering anything here would flash.
  if (authLoading || !user) return null;

  if (isLoading) {
    return (
      <PageShell rhythm="tight">
        <PageHeader eyebrow="Kept" title="Pieces you are holding in mind" />
        <Skeleton label="Loading your kept pieces">
          <div className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex gap-6 border-t border-ink-edge/60 pt-8">
                <SkeletonBlock className="h-36 w-28 shrink-0" />
                <div className="flex-1 space-y-4 pt-1">
                  <SkeletonLine w="w-20" h="h-2" />
                  <SkeletonLine w="w-4/5" h="h-5" />
                  <SkeletonLine w="w-24" h="h-4" />
                </div>
              </div>
            ))}
          </div>
        </Skeleton>
      </PageShell>
    );
  }

  if (isError) {
    return (
      <PageShell rhythm="tight">
        <PageHeader eyebrow="Kept" title="Pieces you are holding in mind" />
        <ErrorState
          title="We could not load your kept pieces"
          body="Nothing has been removed — this is a problem reaching our server, not a change to your list."
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      </PageShell>
    );
  }

  if (items.length === 0) {
    return (
      <PageShell rhythm="tight">
        <PageHeader eyebrow="Kept" title="Pieces you are holding in mind" />
        <EmptyState
          title="You have not kept anything yet"
          body="Nothing is missing — this list fills up when you keep a piece for an occasion that has not arrived yet. Use the keep control on any product."
          action={<ActionLink href="/products">See every piece</ActionLink>}
        />
      </PageShell>
    );
  }

  return (
    <PageShell rhythm="tight">
      <PageHeader
        eyebrow="Kept"
        title="Pieces you are holding in mind"
        standfirst={`${items.length} ${items.length === 1 ? 'piece' : 'pieces'} kept. Nothing here is reserved — keeping a piece does not hold stock.`}
      />

      <h2 id="kept-heading" tabIndex={-1} className="sr-only">
        Kept pieces
      </h2>
      <Announce message={announcement} />

      <ul className="grid gap-x-12 gap-y-2 sm:grid-cols-2">
        {items.map((item) => {
          const p = item.product;
          const busy = busyId === p.id;
          const image = p.images?.[0];
          const src =
            image && !image.includes('placeholder')
              ? image.startsWith('http')
                ? image
                : `${process.env.NEXT_PUBLIC_API_URL}${image}`
              : null;
          const soldOut = p.stock === 0;

          return (
            <li key={item.id} className="flex gap-6 border-t border-ink-edge/60 py-8">
              <Link
                href={`/products/${p.id}`}
                className="shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
              >
                <div className="h-36 w-28 overflow-hidden bg-ink-raised">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div aria-hidden="true" className="h-full w-full bg-ink-raised" />
                  )}
                </div>
              </Link>

              <div className="flex min-w-0 flex-1 flex-col">
                <p className="text-rule uppercase text-paper-faint">{p.category}</p>
                <h3 className="mt-2 font-display text-xl font-light text-paper">
                  <Link
                    href={`/products/${p.id}`}
                    className="transition-colors duration-500 hover:text-brass-bright motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
                  >
                    {p.name}
                  </Link>
                </h3>

                <p className="mt-3 flex items-baseline gap-3 tabular-nums">
                  <span className="text-paper">₹{p.price.toLocaleString()}</span>
                  {p.compare_price && (
                    <span className="text-sm text-paper-faint line-through">
                      ₹{p.compare_price.toLocaleString()}
                    </span>
                  )}
                </p>

                {soldOut && (
                  <p className="mt-2 text-rule uppercase text-brass-bright">Sold out</p>
                )}

                <div className="mt-auto flex flex-wrap items-center gap-x-8 gap-y-3 pt-6">
                  <ActionButton
                    arrow={false}
                    disabled={busy || soldOut}
                    onClick={() => moveToCart(item)}
                  >
                    {busy ? 'Working…' : soldOut ? 'Unavailable' : 'Move to bag'}
                  </ActionButton>
                  <ActionButton
                    tone="quiet"
                    arrow={false}
                    disabled={busy}
                    onClick={() => remove(p.id, p.name)}
                    aria-label={`Remove ${p.name} from kept`}
                  >
                    Remove
                  </ActionButton>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-[7vh] border-t border-ink-edge/60 pt-10">
        <ActionLink href="/products" tone="quiet">
          Keep looking
        </ActionLink>
      </div>
    </PageShell>
  );
}

export default function WishlistPage() {
  return (
    <RouteErrorBoundary routeName="kept" fallbackHref="/products" fallbackLabel="See every piece">
      <WishlistInner />
    </RouteErrorBoundary>
  );
}
