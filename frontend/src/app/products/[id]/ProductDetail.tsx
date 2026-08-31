'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { mediaUrl } from '@/lib/media';
import { clothFor, boltGround } from '@/lib/cloth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { productDetailQuery, productReviewsQuery, qk } from '@/lib/query';
import { productsAPI } from '@/lib/api';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useWishlist } from '@/context/WishlistContext';
import { useHeroStore } from '@/store/useHeroStore';
import type { Product, Review } from '@/types';
import PageShell from '@/components/system/PageShell';
import { ActionButton, ActionLink } from '@/components/system/Action';
import { EmptyState, ErrorState, Skeleton, SkeletonLine, SkeletonBlock, Announce } from '@/components/system/States';

/**
 * One piece.
 *
 * RESTRUCTURED, NOT RESTYLED. The old page was a boxed card grid with a
 * thumbnail strip, a tab bar (Details / Reviews / Shipping) and a sticky
 * add-to-cart bar. This is a two-column plate: the garment held on the left at
 * full bleed while the right column scrolls past it, which is how a printed
 * lookbook presents a single piece and how a customer actually reads one —
 * looking, then reading, then looking again.
 *
 * The tabs are gone for the same reason they went on /support and /account:
 * content behind a tab cannot be found by a page search, cannot be linked to,
 * and hides exactly the material — fabric, care, returnability — a parent
 * spending real money wants before they commit.
 *
 * THIS ROUTE OWNS THE `chamber` SCENE. It does not inherit one: the scene
 * router maps a product page to `chamber`, whose cloth and anisotropic sheen
 * were rebuilt onto the brass palette. The DOM stays entirely above it.
 *
 * SIZE AND COLOUR ARE RADIO GROUPS, NOT BUTTONS. A row of <button>s looks
 * identical and is wrong: arrow keys do nothing, nothing announces which is
 * selected, and there is no group label. Real radios give arrow-key movement,
 * a single tab stop, and "Size 24, 3 of 7" read out.
 */

const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;

function imageUrl(src?: string): string | null {
  if (!src || src.includes('placeholder')) return null;
  return mediaUrl(src);
}

export default function ProductDetail({ id }: { id: number }) {
  const { user } = useAuth();
  const router = useRouter();
  const { addItem } = useCart();
  const { wishlistIds, toggle } = useWishlist();
  const queryClient = useQueryClient();
  const setHeroImage = useHeroStore((s) => s.setHeroImage);

  const detail = useQuery(productDetailQuery(id));
  const reviewsQ = useQuery(productReviewsQuery(id));

  const product = detail.data as Product | undefined;
  const reviews = (reviewsQ.data ?? []) as Review[];

  const [size, setSize] = useState('');
  const [colour, setColour] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [frame, setFrame] = useState(0);
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState('');
  const [announcement, setAnnouncement] = useState('');

  const galleryHeading = useRef<HTMLHeadingElement>(null);

  const images = useMemo(
    () => (product?.images ?? []).map(imageUrl).filter(Boolean) as string[],
    [product],
  );

  // Feed the staged photograph to the scene, and clear it on the way out so
  // the next route does not inherit this garment.
  useEffect(() => {
    setHeroImage(product?.images?.[0] ?? null);
    return () => setHeroImage(null);
  }, [product, setHeroImage]);

  // Default to the only option when there is exactly one — asking someone to
  // choose from a list of one is a question with no information in it.
  useEffect(() => {
    if (product?.size_options?.length === 1) setSize(product.size_options[0]);
    if (product?.colors?.length === 1) setColour(product.colors[0]);
  }, [product]);

  useEffect(() => {
    if (!announcement) return;
    const t = setTimeout(() => setAnnouncement(''), 1800);
    return () => clearTimeout(t);
  }, [announcement]);

  const kept = product ? wishlistIds.includes(product.id) : false;
  const soldOut = product ? product.stock === 0 : false;
  const lowStock = product ? product.stock > 0 && product.stock <= 3 : false;

  const add = async () => {
    if (!product) return;
    if (product.size_options?.length > 0 && !size) {
      setFormError('Choose a size first.');
      return false;
    }
    if (product.colors?.length > 0 && !colour) {
      setFormError('Choose a colour first.');
      return false;
    }
    setFormError('');
    setAdding(true);
    try {
      await addItem(product.id, quantity, size, colour);
      setAnnouncement(`${product.name} added to your bag.`);
      return true;
    } catch (err: any) {
      setFormError(err?.response?.data?.detail || 'We could not add that to your bag. Please try again.');
      return false;
    } finally {
      setAdding(false);
    }
  };

  /**
   * BUY IT NOW — the step that was missing between choosing a piece and paying
   * for one.
   *
   * "Add to bag" was the only thing this page could do. A customer who has
   * decided had to add, notice the bag count change somewhere in the header,
   * find the bag, open it, and then find checkout — four navigations after the
   * decision was already made. On a phone that is where orders are lost, and
   * it is why every shop worth copying puts a second, quieter button beside
   * the first.
   *
   * IT NO LONGER GOES THROUGH THE BAG, and that was a real bug rather than a
   * preference. It used to call `add()` and then send the customer to
   * checkout — but checkout orders the WHOLE bag and empties it. So clicking
   * buy on one frock ordered every piece the customer had been saving, and
   * cleared the bag on the way out.
   *
   * It now carries just this piece to checkout, in sessionStorage rather than
   * the URL so a size and colour cannot be tampered with by editing the
   * address bar, and so a refresh keeps working. The backend takes the same
   * single piece as `buy_now` and leaves the cart untouched — the validation,
   * the stock check, the pricing and the refund-on-failure path are all the
   * same code the bag order uses, so the two cannot drift.
   *
   * sessionStorage, not localStorage: an abandoned direct purchase should not
   * still be waiting in a new tab tomorrow.
   */
  const buyNow = () => {
    if (!product) return;
    if (product.size_options?.length > 0 && !size) {
      setFormError('Choose a size first.');
      return;
    }
    if (product.colors?.length > 0 && !colour) {
      setFormError('Choose a colour first.');
      return;
    }
    setFormError('');
    sessionStorage.setItem('buyNow', JSON.stringify({
      product_id: product.id,
      quantity,
      size: size || null,
      color: colour || null,
    }));
    router.push('/checkout?buy=1');
  };

  const keep = async () => {
    if (!product) return;
    if (!user) { setFormError('Sign in to keep a piece for later.'); return; }
    await toggle(product.id);
    setAnnouncement(kept ? `${product.name} removed from kept.` : `${product.name} kept.`);
  };

  /* ── Loading, shaped like the plate ───────────────────────────────── */
  if (detail.isLoading) {
    return (
      <PageShell width="full" rhythm="tight">
        <Skeleton label="Loading this piece">
          <div className="grid gap-x-14 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <SkeletonBlock className="aspect-[4/5] w-full" />
            </div>
            <div className="mt-10 space-y-6 px-6 sm:px-10 lg:col-span-4 lg:mt-0 lg:px-0">
              <SkeletonLine w="w-24" h="h-2" />
              <SkeletonLine w="w-3/4" h="h-8" />
              <SkeletonLine w="w-32" h="h-6" />
              <SkeletonLine w="w-full" h="h-3" />
              <SkeletonLine w="w-5/6" h="h-3" />
            </div>
          </div>
        </Skeleton>
      </PageShell>
    );
  }

  if (detail.isError) {
    return (
      <PageShell rhythm="tight">
        <ErrorState
          title="We could not load this piece"
          body="It may still be here — this is a problem reaching our server, not a sign the piece has gone."
          onRetry={() => detail.refetch()}
          retrying={detail.isFetching}
        />
      </PageShell>
    );
  }

  if (!product) {
    return (
      <PageShell rhythm="tight">
        <EmptyState
          title="This piece is no longer listed"
          body="It may have sold, or the address may have changed. Everything the shop currently holds is one link away."
          action={<ActionLink href="/products">See every piece</ActionLink>}
        />
      </PageShell>
    );
  }

  const discount = product.compare_price
    ? Math.round(((product.compare_price - product.price) / product.compare_price) * 100)
    : 0;

  return (
    <PageShell width="full" rhythm="tight">
      <Announce message={announcement} />

      <div className="mx-auto w-full max-w-[112rem] px-6 sm:px-10">
        {/**
          * THE WAY BACK, DRAWN AS A CONTROL.
          *
          * This was a breadcrumb — two rule-sized grey links separated by a
          * dot — and it still drew the question "how can we go back". That is
          * the answer: it read as a label, not as something you press. A back
          * control has to look pressable before anyone discovers that it is.
          *
          * A ring holding an arrow, at the size of a thumb. On approach the
          * ring fills with brass and the arrow steps left. The category name
          * stays beside it, so it says where back goes rather than only that
          * back exists.
          */}
        <nav aria-label="Breadcrumb" className="mb-10">
          <Link
            href={`/products?category=${encodeURIComponent(product.category)}`}
            aria-label={`Back to ${product.category}`}
            className="group inline-flex items-center gap-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
          >
            <span
              aria-hidden="true"
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-ink-edge text-paper-muted transition-colors duration-500 group-hover:border-brass-bright group-hover:text-brass-bright motion-reduce:transition-none"
            >
              <span className="text-lg leading-none transition-transform duration-500 group-hover:-translate-x-0.5 motion-reduce:transition-none">
                &larr;
              </span>
            </span>
            <span className="text-rule uppercase text-paper-faint transition-colors duration-500 group-hover:text-paper motion-reduce:transition-none">
              {product.category}
            </span>
          </Link>
        </nav>
      </div>

      <div className="mx-auto grid w-full max-w-[112rem] gap-x-14 px-6 sm:px-10 lg:grid-cols-12">
        {/* ── The garment, held ──────────────────────────────────────── */}
        <div className="lg:col-span-7">
          <h2 ref={galleryHeading} tabIndex={-1} className="sr-only">
            Photographs of {product.name}
          </h2>

          <figure className="relative aspect-[4/5] w-full overflow-hidden bg-ink-raised">
            {images[frame] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={images[frame]}
                alt={`${product.name} — view ${frame + 1} of ${images.length}`}
                className="h-full w-full object-cover"
                fetchPriority={frame === 0 ? 'high' : 'auto'}
              />
            ) : (
              /* The bolt, not a line of grey text — see lib/cloth.ts. This
                 screen gets the full plate, because it is the one place a
                 customer came specifically to look at the piece. The piece's
                 name sits in the column beside this, so the plate does not
                 repeat it. */
              <div
                style={boltGround(clothFor(product.category), product.id)}
                className="flex h-full w-full flex-col justify-between p-8"
              >
                <span className="block">
                  <span
                    aria-hidden="true"
                    className="mb-4 block h-px w-14"
                    style={{ backgroundColor: clothFor(product.category).ink, opacity: 0.4 }}
                  />
                  <span
                    className="block max-w-[34ch] text-caption uppercase"
                    style={{ color: clothFor(product.category).ink, opacity: 0.55 }}
                  >
                    Not yet photographed &middot; call the shop and we will describe it
                  </span>
                </span>
              </div>
            )}
          </figure>

          {images.length > 1 && (
            <div role="group" aria-label="Choose a photograph" className="mt-4 flex flex-wrap gap-3">
              {images.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => { setFrame(i); setAnnouncement(`View ${i + 1} of ${images.length}.`); }}
                  aria-pressed={i === frame}
                  aria-label={`View ${i + 1} of ${images.length}`}
                  className={`h-20 w-16 overflow-hidden border transition-colors duration-500 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright ${
                    i === frame ? 'border-brass-bright' : 'border-ink-edge hover:border-paper-faint'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}

          {product.video_url && (
            <div className="mt-6">
              <video
                src={product.video_url}
                controls
                playsInline
                preload="metadata"
                className={`w-full bg-ink-raised ${product.video_orientation === 'portrait' ? 'aspect-[9/16] max-w-sm' : 'aspect-video'}`}
              />
            </div>
          )}
        </div>

        {/* ── What it is, and how to have it ─────────────────────────── */}
        <div className="mt-12 lg:col-span-5 lg:mt-0">
          <div className="lg:sticky lg:top-28">
            <p className="text-rule uppercase text-brass-bright">{product.category}</p>
            <h1 className="mt-5 font-display text-band font-light text-paper">{product.name}</h1>

            <div className="mt-6 flex flex-wrap items-baseline gap-4">
              <span className="font-display text-3xl tabular-nums text-paper">{money(product.price)}</span>
              {product.compare_price && (
                <>
                  <span className="text-lg tabular-nums text-paper-faint line-through">
                    {money(product.compare_price)}
                  </span>
                  {discount > 0 && (
                    <span className="text-rule uppercase text-brass-bright">{discount}% less</span>
                  )}
                </>
              )}
            </div>

            {product.rating_count > 0 && (
              <p className="mt-3 text-sm text-paper-muted">
                <span className="tabular-nums">{product.rating_avg.toFixed(1)}</span> from{' '}
                <a href="#reviews" className="underline underline-offset-4 hover:text-paper">
                  {product.rating_count} {product.rating_count === 1 ? 'review' : 'reviews'}
                </a>
              </p>
            )}

            {product.description && (
              <p className="mt-7 max-w-[46ch] text-lede text-paper-muted">{product.description}</p>
            )}

            {/* Size — a real radiogroup */}
            {product.size_options?.length > 0 && (
              <fieldset className="mt-10">
                <legend className="text-rule uppercase text-paper-faint">
                  Size
                  <Link href="/support#size-guide" className="ml-4 normal-case text-paper-muted underline underline-offset-4 transition-colors duration-500 hover:text-paper motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright">
                    Size guide
                  </Link>
                </legend>
                <div className="mt-4 flex flex-wrap gap-3">
                  {product.size_options.map((s) => (
                    <label
                      key={s}
                      className={`cursor-pointer border px-5 py-2.5 text-sm tabular-nums transition-colors duration-500 motion-reduce:transition-none has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-brass-bright ${
                        size === s
                          ? 'border-brass-bright text-paper'
                          : 'border-ink-edge text-paper-muted hover:border-paper-faint'
                      }`}
                    >
                      <input
                        type="radio"
                        name="size"
                        value={s}
                        checked={size === s}
                        onChange={() => { setSize(s); setFormError(''); }}
                        className="sr-only"
                      />
                      {s}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {/* Colour — likewise */}
            {product.colors?.length > 0 && (
              <fieldset className="mt-8">
                <legend className="text-rule uppercase text-paper-faint">Colour</legend>
                <div className="mt-4 flex flex-wrap gap-3">
                  {product.colors.map((c) => (
                    <label
                      key={c}
                      className={`cursor-pointer border px-5 py-2.5 text-sm transition-colors duration-500 motion-reduce:transition-none has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-brass-bright ${
                        colour === c
                          ? 'border-brass-bright text-paper'
                          : 'border-ink-edge text-paper-muted hover:border-paper-faint'
                      }`}
                    >
                      <input
                        type="radio"
                        name="colour"
                        value={c}
                        checked={colour === c}
                        onChange={() => { setColour(c); setFormError(''); }}
                        className="sr-only"
                      />
                      {c}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {/* Quantity */}
            {!soldOut && (
              <div role="group" aria-label="Quantity" className="mt-8 flex items-center gap-5 border border-ink-edge px-4 py-2 w-fit">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  aria-label="Reduce quantity"
                  className="text-lg leading-none text-paper-muted transition-colors duration-500 hover:text-paper disabled:opacity-30 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
                >
                  −
                </button>
                <span className="min-w-[2ch] text-center tabular-nums text-paper">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                  disabled={quantity >= product.stock}
                  aria-label="Increase quantity"
                  className="text-lg leading-none text-paper-muted transition-colors duration-500 hover:text-paper disabled:opacity-30 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
                >
                  +
                </button>
              </div>
            )}

            {lowStock && (
              <p className="mt-5 text-rule uppercase text-brass-bright">
                Only {product.stock} left
              </p>
            )}

            {formError && (
              <p role="alert" className="mt-5 text-sm text-brass-bright">{formError}</p>
            )}

            <div className="mt-9 flex flex-wrap items-center gap-x-10 gap-y-5">
              <ActionButton tone="primary" onClick={add} disabled={adding || soldOut}>
                {soldOut ? 'Sold out' : adding ? 'Adding…' : 'Add to bag'}
              </ActionButton>
              {!soldOut && (
                <ActionButton tone="secondary" onClick={buyNow} disabled={adding}>
                  Buy it now
                </ActionButton>
              )}
              <ActionButton tone="quiet" arrow={false} onClick={keep}>
                {kept ? 'Kept' : 'Keep for later'}
              </ActionButton>
            </div>

            {/* The facts a parent asks for, never behind a tab. */}
            <dl className="mt-12 border-t border-ink-edge/60 pt-8 text-sm">
              {product.fabric && (
                <div className="flex gap-6 border-b border-ink-edge/40 py-3">
                  <dt className="w-32 shrink-0 text-rule uppercase text-paper-faint">Fabric</dt>
                  <dd className="text-paper-muted">{product.fabric}</dd>
                </div>
              )}
              {product.material && (
                <div className="flex gap-6 border-b border-ink-edge/40 py-3">
                  <dt className="w-32 shrink-0 text-rule uppercase text-paper-faint">Material</dt>
                  <dd className="text-paper-muted">{product.material}</dd>
                </div>
              )}
              {product.fit && (
                <div className="flex gap-6 border-b border-ink-edge/40 py-3">
                  <dt className="w-32 shrink-0 text-rule uppercase text-paper-faint">Fit</dt>
                  <dd className="text-paper-muted">{product.fit}</dd>
                </div>
              )}
              {product.care_instructions && (
                <div className="flex gap-6 border-b border-ink-edge/40 py-3">
                  <dt className="w-32 shrink-0 text-rule uppercase text-paper-faint">Care</dt>
                  <dd className="text-paper-muted">{product.care_instructions}</dd>
                </div>
              )}
              <div className="flex gap-6 py-3">
                <dt className="w-32 shrink-0 text-rule uppercase text-paper-faint">Returns</dt>
                <dd className="text-paper-muted">
                  {product.is_returnable ? (
                    <>
                      Return within 4 hours of delivery, or exchange within 12 —{' '}
                      <Link href="/cancellation" className="underline underline-offset-4 hover:text-paper">
                        the full policy
                      </Link>
                      .
                    </>
                  ) : (
                    <>
                      <span className="text-brass-bright">Non-returnable.</span> This piece cannot be
                      returned or exchanged unless it arrives damaged.
                    </>
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* ── Reviews ────────────────────────────────────────────────────── */}
      <section id="reviews" className="mx-auto mt-[12vh] w-full max-w-[112rem] scroll-mt-32 px-6 sm:px-10">
        <div className="border-t border-ink-edge/60 pt-10">
          <h2 className="font-display text-band font-light text-paper">
            What people said
          </h2>

          {reviewsQ.isLoading && (
            <Skeleton label="Loading reviews">
              <div className="mt-8 space-y-6">
                {[0, 1].map((i) => (
                  <div key={i} className="space-y-3 border-t border-ink-edge/40 pt-6">
                    <SkeletonLine w="w-24" h="h-2" />
                    <SkeletonLine w="w-2/3" h="h-4" />
                  </div>
                ))}
              </div>
            </Skeleton>
          )}

          {!reviewsQ.isLoading && reviews.length === 0 && (
            <p className="mt-7 max-w-[52ch] text-lede text-paper-muted">
              Nobody has written about this piece yet. Reviews here come only from people who
              bought it, so an empty list means it is new — not that it disappointed anyone.
            </p>
          )}

          {reviews.length > 0 && (
            <ul className="mt-8 grid gap-x-16 gap-y-9 lg:grid-cols-2">
              {reviews.map((r) => (
                <li key={r.id} className="border-t border-ink-edge/40 pt-6">
                  <p className="text-rule uppercase text-paper-faint">
                    <span className="tabular-nums text-brass-bright">{r.rating}</span> · {r.user?.full_name ?? 'A customer'}
                  </p>
                  {r.title && <p className="mt-2.5 font-display text-xl font-light text-paper">{r.title}</p>}
                  {r.comment && <p className="mt-2 max-w-[52ch] text-paper-muted">{r.comment}</p>}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-12">
            <ActionLink href="/products">See every piece</ActionLink>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
