'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { mediaUrl } from '@/lib/media';
import { clothFor, boltGround } from '@/lib/cloth';
import Link from 'next/link';
import { ShoppingCart, Star, Heart, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Product } from '@/types';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useLoginPrompt } from '@/context/LoginPromptContext';
import { useWishlist } from '@/context/WishlistContext';
import toast from 'react-hot-toast';

interface Props { product: Product; }

export default function ProductCard({ product }: Props) {
  const { addItem } = useCart();
  const { user } = useAuth();
  const { promptLogin } = useLoginPrompt();
  const { wishlistIds, toggle } = useWishlist();
  const isWishlisted = wishlistIds.includes(product.id);
  const [toggling, setToggling] = useState(false);

  // ── Mini carousel state ──────────────────────────────────────────────────────
  const images = (product.images || []).filter(Boolean);
  const hasVideo = Boolean(product.video_url);
  const totalSlides = images.length + (hasVideo ? 1 : 0);

  const [imgIdx, setImgIdx] = useState(0);
  const [hovering, setHovering] = useState(false);
  /**
   * URLs that have already failed, so a dead image degrades to the composed
   * placeholder instead of a broken-image glyph.
   *
   * The card had a placeholder branch, but it only covered a product with NO
   * image — not a product whose image URL is present and unreachable. That is
   * the common case, and it is live: the seeded catalogue stores
   * `/images/placeholder-frock.jpg`, a path neither the backend nor the
   * frontend has ever served, so all 24 seeded products render a broken glyph
   * in the grid. A dead CDN link or a revoked Cloudinary asset would look the
   * same. On a shop selling heirloom clothing, a broken-image icon is the worst
   * possible thing to put where the garment should be.
   */
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const touchStartX = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const goCard = useCallback((idx: number) => {
    if (totalSlides === 0) return;
    setImgIdx((idx + totalSlides) % totalSlides);
  }, [totalSlides]);

  /**
   * The gallery slides on its own, and ONLY while the card is on screen.
   *
   * It already auto-advanced, but every card in the grid did so forever —
   * twenty cards decoding an image each on their own timer, most of them
   * scrolled past and invisible. That is real work done for nobody, and on a
   * phone it is exactly the kind of background cost that reads as "the site is
   * laggy". An IntersectionObserver stops every card the customer cannot see;
   * usually two or three run at a time.
   *
   * Hovering now QUICKENS it rather than pausing it. Pausing on hover is
   * backwards: pointing at a card is asking to see the rest of it.
   */
  const [onScreen, setOnScreen] = useState(false);
  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setOnScreen(true); return; }
    const io = new IntersectionObserver(
      ([e]) => setOnScreen(e.isIntersecting),
      { rootMargin: '0px 0px -10% 0px', threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (totalSlides <= 1 || !onScreen) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setImgIdx(i => (i + 1) % totalSlides);
    }, hovering ? 1800 : 3400);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [totalSlides, hovering, onScreen]);

  // Reset to first slide on mouse leave
  const handleMouseLeave = () => {
    setHovering(false);
    setImgIdx(0);
  };

  // Touch swipe on card
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd   = (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 35) delta < 0 ? goCard(imgIdx + 1) : goCard(imgIdx - 1);
  };

  // ── Wishlist / cart ──────────────────────────────────────────────────────────
  const discount = product.compare_price
    ? Math.round(((product.compare_price - product.price) / product.compare_price) * 100)
    : null;

  const handleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) { promptLogin('Sign in to save items to your wishlist.'); return; }
    if (toggling) return;
    setToggling(true);
    await toggle(product.id);
    setToggling(false);
  };

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) {
      promptLogin('Sign in to add items to your cart and place orders.');
      return;
    }
    try {
      await addItem(product.id, 1);
      toast.success(`${product.name} added to cart!`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to add to cart');
    }
  };

  const stars = Array.from({ length: 5 }, (_, i) => i < Math.round(product.rating_avg));

  // ── Current slide content ────────────────────────────────────────────────────
  const isVideoSlide = hasVideo && imgIdx === images.length;
  const resolvedImg = !isVideoSlide && images[imgIdx] ? mediaUrl(images[imgIdx]) : null;
  // A URL that has already failed is treated exactly like no URL at all, which
  // routes it into the placeholder branch below.
  const currentImg = resolvedImg && !failedImages.includes(resolvedImg) ? resolvedImg : null;

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="h-full"
    >
    {/**
      * THE CARD IS THE PHOTOGRAPH, NOT A BOX AROUND IT.
      *
      * This was `.card` — `bg-white rounded-2xl shadow-sm border` — with the
      * garment inset by 16px on a maroon-to-gold gradient, and a rounded
      * filled button under it. That is the card every storefront template
      * ships with, and it was named as such more than once. Four things went:
      *
      *   THE WHITE BOX. The shop's own ground is a blush; a white card on it
      *   is a foreign object, and twenty of them make a grid of tiles rather
      *   than a rail of clothes.
      *
      *   THE SHADOW AND THE 16px RADIUS. Both say "component". Neither says
      *   anything about the garment.
      *
      *   THE GRADIENT BEHIND THE PHOTOGRAPH, and the padding that made room
      *   for it. A product photograph does not need a backdrop invented for
      *   it; it needs the whole plate. `object-cover`, edge to edge.
      *
      *   THE LIFT ON HOVER. A card that jumps 6px when the pointer crosses it
      *   is movement without meaning, and on a grid it is a field of twitching
      *   rectangles.
      *
      * What is left is the photograph, the name, the price and one button —
      * which is all a customer needs and all Amazon shows.
      */}
    <Link href={`/products/${product.id}`} className="group block h-full">
      <div className="flex h-full flex-col">

        {/* ── Image / Carousel ───────────────────────────────────────────────── */}
        <div
          className="relative aspect-[3/4] overflow-hidden bg-ink-raised"
          style={{ perspective: 1200 }}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={handleMouseLeave}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Slide content — cross-fades with a subtle 3D coverflow tilt
              instead of hard-cutting, so both auto-advance and manual swipe
              feel smooth and give the gallery some depth. */}
          <AnimatePresence mode="sync" initial={false}>
            {isVideoSlide ? (
              <motion.div
                key="video"
                initial={{ opacity: 0, rotateY: -14, scale: 0.94 }}
                animate={{ opacity: 1, rotateY: 0, scale: 1 }}
                exit={{ opacity: 0, rotateY: 14, scale: 0.94 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                style={{ transformStyle: 'preserve-3d' }}
                className="absolute inset-0 bg-gray-900 rounded-lg flex items-center justify-center"
              >
                <Play size={40} className="text-paper opacity-80" fill="white" />
                <span className="absolute bottom-4 text-paper text-xs font-medium bg-black/50 px-2 py-0.5 rounded-full">
                  Watch Video
                </span>
              </motion.div>
            ) : currentImg ? (
              <motion.img
                key={currentImg}
                src={currentImg}
                alt={product.name}
                onError={() =>
                  setFailedImages((prev) => (prev.includes(currentImg) ? prev : [...prev, currentImg]))
                }
                initial={{ opacity: 0, rotateY: -14, scale: 0.94 }}
                animate={{ opacity: 1, rotateY: 0, scale: 1 }}
                exit={{ opacity: 0, rotateY: 14, scale: 0.94 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                style={{ transformStyle: 'preserve-3d' }}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,0.61,0.24,1)] group-hover:scale-[1.04] motion-reduce:transition-none"
              />
            ) : (
              /**
               * NO PHOTOGRAPH — SHOWN AS THE CLOTH, NOT AS A CARTOON.
               *
               * This was an emoji at six times the body size, picked by
               * category: 👶 for Baby Frocks, 💃 for Lehenga. On a shop whose
               * whole promise is that the colour you see is the colour that
               * arrives, the fallback for a missing photograph was a cartoon —
               * and one that says "baby" tells a customer nothing about the
               * garment.
               *
               * A bolt of silk in a dim room is not a flat colour; it is a deep
               * colour with a band of light lying across the fold. So the plate
               * becomes that bolt (lib/cloth.ts), with the piece's id choosing
               * its dye lot so two pieces in one category are not the same
               * rectangle.
               *
               * It carries only the cloth's name. The caption directly beneath
               * already gives category, name and price, and repeating the name
               * on the plate reads as a rendering fault rather than as design.
               */
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                style={boltGround(clothFor(product.category), product.id)}
                className="flex h-full w-full flex-col justify-between p-5"
              >
                <span className="block">
                  <span
                    aria-hidden="true"
                    className="mb-2.5 block h-px w-8"
                    style={{ backgroundColor: clothFor(product.category).ink, opacity: 0.4 }}
                  />
                  <span
                    className="block text-caption uppercase"
                    style={{ color: clothFor(product.category).ink, opacity: 0.5 }}
                  >
                    Not yet photographed
                  </span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/**
            * PREV / NEXT — TRANSPARENT, AND ONLY WHERE THEY ARE THE RIGHT
            * CONTROL.
            *
            * They were solid `bg-ink-raised` discs: an opaque pale-rose puck
            * parked over the middle of the garment, on the one image that has
            * to sell it. The chevron inside was `text-gray-700`, a flat grey
            * belonging to no palette here.
            *
            * WHY THEY EARN THEIR PLACE AT ALL. The card advances itself every
            * 3.4s, so without a manual control somebody who wants to see the
            * back of a dress has to wait for it to come round. On a phone that
            * control is a SWIPE, which this card already handles; arrows there
            * would be two small targets competing with the card's own link.
            * On a pointer device there is no swipe, so the arrows are the
            * desktop half of the same feature — which is why they appear on
            * hover and nowhere else.
            *
            * THE SCRIM IS MEASURED, NOT PICKED. A control sitting on an
            * unknown photograph has two worst cases: the photo behind it is
            * white, or it is black. At 55% the ground is genuinely see-through
            * and the chevron still measures 14.80:1 over a white photo and
            * 4.37:1 over a black one, so it clears the 3:1 that WCAG 1.4.11
            * asks of a control at both extremes. `backdrop-blur` separates it
            * from busy print without hiding what is underneath.
            */}
          {totalSlides > 1 && hovering && (
            <>
              <button
                type="button"
                aria-label="Previous image"
                onClick={e => { e.preventDefault(); goCard(imgIdx - 1); }}
                className="absolute left-1.5 top-1/2 z-20 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-ink-deep/55 text-maroon-900 ring-1 ring-ink-edge/70 backdrop-blur-[3px] transition-colors duration-200 hover:bg-ink-deep/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                type="button"
                aria-label="Next image"
                onClick={e => { e.preventDefault(); goCard(imgIdx + 1); }}
                className="absolute right-1.5 top-1/2 z-20 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-ink-deep/55 text-maroon-900 ring-1 ring-ink-edge/70 backdrop-blur-[3px] transition-colors duration-200 hover:bg-ink-deep/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
              >
                <ChevronRight size={15} />
              </button>
            </>
          )}

          {/* Dot indicators — always visible when multiple slides */}
          {totalSlides > 1 && (
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 z-10 pointer-events-none">
              {Array.from({ length: totalSlides }).map((_, i) => (
                <span
                  key={i}
                  className={`rounded-full transition-all duration-300 ${
                    i === imgIdx
                      ? 'w-4 h-1.5 bg-ink-deep shadow'
                      : 'w-1.5 h-1.5 bg-ink-raised'
                  }`}
                />
              ))}
            </div>
          )}

          {/**
            * ONE BADGE, NOT FOUR.
            *
            * There were four, stacked: a maroon discount pill, a gold
            * "Featured", an emerald "New Arrival", a grey "Out of Stock" —
            * four colours and four radii piled in the corner of a photograph
            * of the thing being sold. Most pieces here are featured AND new,
            * so in practice two or three shouted at once over the garment.
            * `text-paper` on them also inverted with the relight: they were
            * dark type on dark fills, which is why the screenshot showed
            * unreadable blobs.
            *
            * A badge is worth having only when it changes a decision. Sold out
            * changes whether you can buy; a discount changes what you pay.
            * "Featured" and "New Arrival" change nothing for the customer —
            * they are the shop talking about itself — and the price row
            * already shows the saving in figures.
            *
            * So: one badge, chosen by what matters most.
            *
            * AND IT IS LIGHT, NOT A SOLID BLOCK OF CERISE. A filled dark badge
            * plus a filled dark button put two heavy rectangles on top of a
            * photograph of a pale garment, and the card read as the colour
            * rather than as the dress — which is exactly the "dark rose /
            * cinematic" note that came back three times. Both are now a pale
            * ground with the deep tone carried by the TEXT and a hairline
            * edge. Measured: #6B1230 on #FDE7EE is 10.17:1, well past AAA,
            * and the #C22B62 hairline is 4.71:1 against the page ground, so
            * the control edge clears WCAG 1.4.11 without being a slab.
            */}
          {(product.stock === 0 || discount) && (
            <span
              className={`absolute left-0 top-3 z-10 border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.08em] ${
                product.stock === 0
                  ? 'border-steel bg-ink-raised text-paper-muted'
                  : 'border-maroon-500 bg-maroon-100 text-maroon-800'
              }`}
            >
              {product.stock === 0 ? 'Sold out' : `${discount}% off`}
            </span>
          )}

          {/* Wishlist button */}
          <button
            onClick={handleWishlist}
            className={`absolute top-2 right-2 p-1.5 bg-ink-deep rounded-full shadow-sm transition-all z-10 opacity-0 group-hover:opacity-100 ${isWishlisted ? 'opacity-100' : ''}`}
            title={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <Heart
              size={15}
              className={isWishlisted ? 'text-red-500' : 'text-maroon-800'}
              fill={isWishlisted ? '#ef4444' : 'none'}
            />
          </button>
        </div>

        {/* ── Info ────────────────────────────────────────────────────────────── */}
        <div className="p-3 flex flex-col flex-1">
          <p className="text-xs text-maroon-600 font-medium mb-1">{product.category}</p>
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1.5 leading-snug">
            {product.name}
          </h3>

          {/* Stars */}
          {product.rating_count > 0 && (
            <div className="flex items-center gap-1 mb-2">
              <div className="flex">
                {stars.map((filled, i) => (
                  <Star
                    key={i}
                    size={12}
                    className={filled ? 'star-filled fill-yellow-400' : 'star-empty'}
                    fill={filled ? '#facc15' : 'none'}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-500">({product.rating_count})</span>
            </div>
          )}

          {product.fabric && (
            <p className="text-xs text-gray-500 mb-2">{product.fabric}</p>
          )}

          {/* Price + cart */}
          <div className="mt-auto">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-lg font-bold text-maroon-900">₹{product.price.toLocaleString()}</span>
              {product.compare_price && (
                <span className="text-sm text-gray-400 line-through">
                  ₹{product.compare_price.toLocaleString()}
                </span>
              )}
            </div>

            <button
              onClick={handleAddToCart}
              disabled={product.stock === 0}
              className="mt-3 flex w-full items-center justify-center gap-2 border border-maroon-500 bg-maroon-100 py-2.5 text-sm font-medium text-maroon-800 transition-colors duration-300 hover:bg-maroon-200 active:scale-[0.99] disabled:border-ink-edge disabled:bg-ink-raised disabled:text-paper-faint"
            >
              <ShoppingCart size={15} />
              {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
            </button>
          </div>
        </div>
      </div>
    </Link>
    </motion.div>
  );
}
