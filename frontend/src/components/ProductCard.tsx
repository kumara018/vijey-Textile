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

  const goCard = useCallback((idx: number) => {
    if (totalSlides === 0) return;
    setImgIdx((idx + totalSlides) % totalSlides);
  }, [totalSlides]);

  // Auto-scroll every 3.8s (slow, unhurried pace), pause on hover
  useEffect(() => {
    if (totalSlides <= 1 || hovering) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setImgIdx(i => (i + 1) % totalSlides);
    }, 3800);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [totalSlides, hovering]);

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
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      whileHover={{ y: -6 }}
      className="h-full"
    >
    <Link href={`/products/${product.id}`} target="_blank" rel="noopener noreferrer" className="group block h-full">
      <div className="card hover:shadow-lg transition-shadow duration-300 h-full flex flex-col">

        {/* ── Image / Carousel ───────────────────────────────────────────────── */}
        <div
          className="relative bg-gradient-to-br from-maroon-100 to-gold-50 aspect-[3/4] overflow-hidden p-4"
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
                <Play size={40} className="text-white opacity-80" fill="white" />
                <span className="absolute bottom-4 text-white text-xs font-medium bg-black/50 px-2 py-0.5 rounded-full">
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
                className="absolute inset-0 w-full h-full object-contain group-hover:scale-[1.03] transition-transform duration-500"
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
                <span
                  className="text-rule uppercase"
                  style={{ color: clothFor(product.category).ink, opacity: 0.66 }}
                >
                  {clothFor(product.category).name}
                </span>
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

          {/* Prev / Next arrows — visible on hover when multiple slides */}
          {totalSlides > 1 && hovering && (
            <>
              <button
                onClick={e => { e.preventDefault(); goCard(imgIdx - 1); }}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/85 shadow flex items-center justify-center text-gray-700 hover:bg-white transition-all z-20"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={e => { e.preventDefault(); goCard(imgIdx + 1); }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/85 shadow flex items-center justify-center text-gray-700 hover:bg-white transition-all z-20"
              >
                <ChevronRight size={14} />
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
                      ? 'w-4 h-1.5 bg-white shadow'
                      : 'w-1.5 h-1.5 bg-white/60'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1.5 z-10">
            {discount && (
              <span className="bg-maroon-800 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                {discount}% OFF
              </span>
            )}
            {product.is_featured && (
              <span className="bg-gold-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                Featured
              </span>
            )}
            {product.is_new_arrival && (
              <span className="bg-emerald-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                New Arrival
              </span>
            )}
            {product.stock === 0 && (
              <span className="bg-gray-700 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                Out of Stock
              </span>
            )}
          </div>

          {/* Wishlist button */}
          <button
            onClick={handleWishlist}
            className={`absolute top-2 right-2 p-1.5 bg-white rounded-full shadow-sm transition-all z-10 opacity-0 group-hover:opacity-100 ${isWishlisted ? 'opacity-100' : ''}`}
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
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-maroon-800 hover:bg-maroon-900 text-white text-sm font-semibold transition-all active:scale-95 disabled:bg-gray-300 disabled:cursor-not-allowed"
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
