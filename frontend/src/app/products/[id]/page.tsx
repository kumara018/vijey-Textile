'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShoppingCart, Star, Truck, RotateCcw, Shield, XCircle,
  AlertCircle, CheckCircle, ChevronRight, Send,
  ChevronLeft, Play, Heart,
} from 'lucide-react';
import { productsAPI } from '@/lib/api';
import { Product, Review } from '@/types';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useLoginPrompt } from '@/context/LoginPromptContext';
import { useWishlist } from '@/context/WishlistContext';
import toast from 'react-hot-toast';

// ── helpers ──────────────────────────────────────────────────────────────────
function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function resolveUrl(url: string) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${process.env.NEXT_PUBLIC_API_URL}${url}`;
}

// ── Video slide ───────────────────────────────────────────────────────────────
function VideoSlide({ url }: { url: string }) {
  const ytId = getYouTubeId(url);
  if (ytId) {
    return (
      <iframe
        src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }
  return (
    <video
      src={url}
      className="w-full h-full object-contain bg-black"
      controls
      playsInline
    />
  );
}

// ── Carousel ──────────────────────────────────────────────────────────────────
function ProductCarousel({ images, videoUrl, name }: { images: string[]; videoUrl?: string; name: string }) {
  const slides: Array<{ type: 'image' | 'video'; src: string }> = [
    ...images.map(img => ({ type: 'image' as const, src: resolveUrl(img) })),
    ...(videoUrl ? [{ type: 'video' as const, src: videoUrl }] : []),
  ];

  const [active, setActive] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragDeltaX = useRef(0);

  const go = useCallback((idx: number) => {
    setActive((idx + slides.length) % slides.length);
  }, [slides.length]);

  const prev = () => go(active - 1);
  const next = () => go(active + 1);

  const onTouchStart = (e: React.TouchEvent) => { dragStartX.current = e.touches[0].clientX; dragDeltaX.current = 0; };
  const onTouchMove  = (e: React.TouchEvent) => { dragDeltaX.current = e.touches[0].clientX - dragStartX.current; };
  const onTouchEnd   = () => { if (Math.abs(dragDeltaX.current) > 40) { dragDeltaX.current < 0 ? next() : prev(); } dragDeltaX.current = 0; };

  const onMouseDown  = (e: React.MouseEvent) => { setDragging(true); dragStartX.current = e.clientX; dragDeltaX.current = 0; };
  const onMouseMove  = (e: React.MouseEvent) => { if (!dragging) return; dragDeltaX.current = e.clientX - dragStartX.current; };
  const onMouseUp    = () => { if (dragging && Math.abs(dragDeltaX.current) > 40) { dragDeltaX.current < 0 ? next() : prev(); } setDragging(false); dragDeltaX.current = 0; };

  if (slides.length === 0) {
    return (
      <div className="aspect-square bg-gradient-to-br from-maroon-50 to-pink-50 rounded-2xl flex items-center justify-center text-8xl">👗</div>
    );
  }

  const current = slides[active];

  return (
    <div className="select-none">
      <div
        className="relative bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl overflow-hidden mb-3 cursor-grab active:cursor-grabbing"
        style={{ aspectRatio: '1/1' }}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
      >
        {current.type === 'image' ? (
          <img src={current.src} alt={`${name} — view ${active + 1}`} className="w-full h-full object-cover" draggable={false} />
        ) : (
          <VideoSlide url={current.src} />
        )}

        {slides.length > 1 && (
          <>
            <button onClick={e => { e.stopPropagation(); prev(); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 hover:bg-white shadow-md flex items-center justify-center text-gray-700 transition-all z-10">
              <ChevronLeft size={18} />
            </button>
            <button onClick={e => { e.stopPropagation(); next(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 hover:bg-white shadow-md flex items-center justify-center text-gray-700 transition-all z-10">
              <ChevronRight size={18} />
            </button>
          </>
        )}

        {slides.length > 1 && (
          <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs font-medium px-2.5 py-1 rounded-full">
            {active + 1} / {slides.length}
          </div>
        )}
        {current.type === 'video' && (
          <div className="absolute top-3 left-3 bg-black/60 text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
            <Play size={11} fill="white" /> Video
          </div>
        )}
      </div>

      {slides.length > 1 && (
        <div className="flex justify-center gap-1.5 mb-3">
          {slides.map((_, i) => (
            <button key={i} onClick={() => go(i)}
              className={`rounded-full transition-all ${i === active ? 'w-6 h-2 bg-maroon-800' : 'w-2 h-2 bg-gray-300 hover:bg-gray-400'}`} />
          ))}
        </div>
      )}

      {slides.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {slides.map((s, i) => (
            <button key={i} onClick={() => go(i)}
              className={`relative flex-shrink-0 w-16 h-16 rounded-xl border-2 overflow-hidden transition-all ${i === active ? 'border-maroon-800 ring-2 ring-maroon-300' : 'border-gray-200 hover:border-maroon-400'}`}>
              {s.type === 'image' ? (
                <img src={s.src} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                  <Play size={20} className="text-white" fill="white" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProductDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { addItem } = useCart();
  const { user } = useAuth();
  const { promptLogin } = useLoginPrompt();
  const { wishlistIds, toggle: toggleWishlist } = useWishlist();

  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [sizeErr, setSizeErr] = useState(false);
  const [colorErr, setColorErr] = useState(false);
  const [tab, setTab] = useState<'desc' | 'care' | 'reviews'>('desc');

  const [canReview, setCanReview]       = useState(false);
  const [reviewReason, setReviewReason] = useState('');
  const [myRating, setMyRating]         = useState(0);
  const [hoverRating, setHoverRating]   = useState(0);
  const [myTitle, setMyTitle]           = useState('');
  const [myComment, setMyComment]       = useState('');
  const [submitting, setSubmitting]     = useState(false);

  const isWishlisted = product ? wishlistIds.includes(product.id) : false;

  useEffect(() => {
    const load = async () => {
      try {
        const calls: Promise<any>[] = [
          productsAPI.getOne(Number(id)),
          productsAPI.getReviews(Number(id)),
        ];
        if (user) calls.push(productsAPI.canReview(Number(id)));
        const [pRes, rRes, crRes] = await Promise.all(calls);
        setProduct(pRes.data);
        setReviews(rRes.data);
        if (pRes.data.size_options?.length) setSelectedSize(pRes.data.size_options[0]);
        if (pRes.data.colors?.length) setSelectedColor(pRes.data.colors[0]);
        if (crRes) { setCanReview(crRes.data.can_review); setReviewReason(crRes.data.reason); }
      } catch { router.push('/products'); }
      finally { setLoading(false); }
    };
    load();
  }, [id, user]);

  const handleAddToCart = async () => {
    if (!user) { promptLogin('Sign in to add this item to your cart and place an order.'); return; }
    let hasErr = false;
    if (product!.size_options?.length > 0 && !selectedSize) { setSizeErr(true); hasErr = true; }
    if (product!.colors?.length > 0 && !selectedColor) { setColorErr(true); hasErr = true; }
    if (hasErr) { toast.error('Please select size and colour before adding to cart'); return; }
    setAdding(true);
    try {
      await addItem(product!.id, quantity, selectedSize, selectedColor);
      toast.success('Added to cart!');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to add to cart');
    } finally { setAdding(false); }
  };

  const handleBuyNow = async () => { await handleAddToCart(); router.push('/cart'); };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (myRating === 0) { toast.error('Please select a star rating'); return; }
    if (!myComment.trim()) { toast.error('Please write a review comment'); return; }
    setSubmitting(true);
    try {
      const res = await productsAPI.addReview(Number(id), {
        product_id: Number(id), rating: myRating,
        title: myTitle.trim() || undefined, comment: myComment.trim(),
      });
      setReviews(prev => [res.data, ...prev]);
      setCanReview(false); setReviewReason('already_reviewed');
      setMyRating(0); setMyTitle(''); setMyComment('');
      toast.success('Thank you for your review! 🌟');
      if (product) {
        const newCount = product.rating_count + 1;
        const newAvg = ((product.rating_avg * product.rating_count) + myRating) / newCount;
        setProduct({ ...product, rating_avg: Math.round(newAvg * 10) / 10, rating_count: newCount });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to submit review');
    } finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-pulse">
        <div className="bg-gray-200 aspect-square rounded-2xl" />
        <div className="space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4" />
          <div className="h-8 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded w-1/3" />
          <div className="h-24 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );

  if (!product) return null;

  const discount = product.compare_price
    ? Math.round(((product.compare_price - product.price) / product.compare_price) * 100)
    : null;

  const hasCareData = product.fit || product.material || product.care_instructions || product.fabric;
  const TABS = [
    { key: 'desc',    label: 'Description' },
    ...(hasCareData ? [{ key: 'care', label: 'Fit & Care' }] : []),
    { key: 'reviews', label: `Reviews (${product.rating_count})` },
  ] as const;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-maroon-800">Home</Link>
        <ChevronRight size={14} />
        <Link href="/products" className="hover:text-maroon-800">Products</Link>
        <ChevronRight size={14} />
        <Link href={`/products?category=${product.category}`} className="hover:text-maroon-800">{product.category}</Link>
        <ChevronRight size={14} />
        <span className="text-maroon-800 font-medium truncate max-w-[200px]">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Carousel */}
        <div>
          <ProductCarousel images={product.images || []} videoUrl={product.video_url} name={product.name} />
        </div>

        {/* Details */}
        <div>
          <div className="flex items-start justify-between gap-3 mb-1">
            <p className="text-maroon-600 font-medium text-sm">{product.category}</p>
            <button
              onClick={() => { if (!user) { promptLogin('Sign in to save products to your wishlist.'); return; } toggleWishlist(product.id); }}
              className={`p-2 rounded-full border-2 transition-all ${isWishlisted ? 'border-red-400 bg-red-50 text-red-500' : 'border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-400'}`}
              title={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart size={18} fill={isWishlisted ? 'currentColor' : 'none'} />
            </button>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">{product.name}</h1>

          {product.rating_count > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center gap-1 bg-green-600 text-white text-sm px-2.5 py-0.5 rounded-full font-semibold">
                <Star size={13} fill="white" /> {product.rating_avg.toFixed(1)}
              </div>
              <span className="text-gray-500 text-sm">{product.rating_count} rating{product.rating_count !== 1 ? 's' : ''}</span>
            </div>
          )}

          <div className="flex items-baseline gap-3 mb-2">
            <span className="text-3xl font-bold text-maroon-900">₹{product.price.toLocaleString()}</span>
            {product.compare_price && <span className="text-lg text-gray-400 line-through">₹{product.compare_price.toLocaleString()}</span>}
            {discount && <span className="text-green-600 font-semibold text-sm">{discount}% off</span>}
          </div>
          <p className="text-xs text-gray-500 mb-5">Inclusive of all taxes. ✓ Delivered to your doorstep</p>

          <hr className="border-maroon-100 mb-5" />

          {product.fabric && (
            <div className="flex gap-3 mb-3 text-sm"><span className="text-gray-500 w-20 flex-shrink-0">Fabric</span><span className="font-medium text-gray-800">{product.fabric}</span></div>
          )}
          {product.fit && (
            <div className="flex gap-3 mb-3 text-sm"><span className="text-gray-500 w-20 flex-shrink-0">Fit</span><span className="font-medium text-gray-800">{product.fit}</span></div>
          )}
          {product.material && (
            <div className="flex gap-3 mb-4 text-sm"><span className="text-gray-500 w-20 flex-shrink-0">Material</span><span className="font-medium text-gray-800">{product.material}</span></div>
          )}

          {/* Size */}
          {product.size_options && product.size_options.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Select Size *</label>
                {sizeErr && <span className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />Required</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {product.size_options.map((size) => (
                  <button key={size} onClick={() => { setSelectedSize(size); setSizeErr(false); }}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${selectedSize === size ? 'border-maroon-800 bg-maroon-800 text-white' : 'border-gray-200 text-gray-700 hover:border-maroon-400'}`}>
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Color */}
          {product.colors && product.colors.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Select Colour *</label>
                {colorErr && <span className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />Required</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((color) => (
                  <button key={color} onClick={() => { setSelectedColor(color); setColorErr(false); }}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${selectedColor === color ? 'border-maroon-800 bg-maroon-50 text-maroon-800' : 'border-gray-200 text-gray-700 hover:border-maroon-400'}`}>
                    {color}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="mb-6">
            <label className="label">Quantity</label>
            <div className="flex items-center gap-3">
              <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-10 h-10 rounded-lg border-2 border-gray-200 hover:border-maroon-400 font-bold text-lg flex items-center justify-center">-</button>
              <span className="text-lg font-bold w-8 text-center">{quantity}</span>
              <button onClick={() => setQuantity(q => Math.min(product.stock, q + 1))} className="w-10 h-10 rounded-lg border-2 border-gray-200 hover:border-maroon-400 font-bold text-lg flex items-center justify-center">+</button>
              <span className="text-sm text-gray-500 ml-1">{product.stock} available</span>
            </div>
          </div>

          {product.stock === 0 ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-red-700 text-sm font-medium">❌ This product is currently out of stock. Check back later.</div>
          ) : product.stock <= 5 ? (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4 text-orange-700 text-sm">⚠️ Only {product.stock} left in stock — order soon!</div>
          ) : null}

          <div className="flex gap-3 mb-6">
            <button onClick={handleAddToCart} disabled={adding || product.stock === 0}
              className="flex-1 btn-secondary flex items-center justify-center gap-2 py-3">
              <ShoppingCart size={18} />
              {adding ? 'Adding...' : 'Add to Cart'}
            </button>
            <button onClick={handleBuyNow} disabled={adding || product.stock === 0}
              className="flex-1 btn-primary flex items-center justify-center gap-2 py-3">
              Buy Now
            </button>
          </div>

          {product.is_returnable === false && (
            <div className="flex items-start gap-2.5 p-3.5 mb-4 bg-red-50 border border-red-200 rounded-xl">
              <XCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-700">Non-Returnable Product</p>
                <p className="text-xs text-red-600 mt-0.5">This item is not eligible for return, exchange, or replacement once delivered.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { icon: Truck, text: 'Fast Delivery' },
              { icon: product.is_returnable === false ? XCircle : RotateCcw, text: product.is_returnable === false ? 'Non-Returnable' : '7-day Easy Returns', red: product.is_returnable === false },
              { icon: Shield, text: '100% Authentic' },
            ].map(({ icon: Icon, text, red }) => (
              <div key={text} className={`flex flex-col items-center gap-1.5 p-3 rounded-xl text-center ${red ? 'bg-red-50' : 'bg-maroon-50'}`}>
                <Icon size={18} className={red ? 'text-red-500' : 'text-maroon-700'} />
                <span className={`text-xs leading-tight ${red ? 'text-red-600 font-medium' : 'text-gray-600'}`}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-12 card overflow-hidden">
        <div className="flex border-b border-maroon-100 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`flex-1 min-w-[120px] py-4 text-sm font-semibold transition-colors whitespace-nowrap ${tab === t.key ? 'text-maroon-800 border-b-2 border-maroon-800 bg-maroon-50' : 'text-gray-500 hover:text-maroon-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Description */}
          {tab === 'desc' && (
            <div className="prose prose-sm max-w-none text-gray-700">
              <p className="leading-relaxed">{product.description}</p>
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
                {product.fabric && (
                  <div className="bg-maroon-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Fabric</p>
                    <p className="font-semibold text-maroon-900 mt-1">{product.fabric}</p>
                  </div>
                )}
                {product.material && (
                  <div className="bg-maroon-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Material</p>
                    <p className="font-semibold text-maroon-900 mt-1">{product.material}</p>
                  </div>
                )}
                {product.fit && (
                  <div className="bg-maroon-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Fit</p>
                    <p className="font-semibold text-maroon-900 mt-1">{product.fit}</p>
                  </div>
                )}
                {product.size_options?.length > 0 && (
                  <div className="bg-maroon-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Sizes</p>
                    <p className="font-semibold text-maroon-900 mt-1">{product.size_options.join(', ')}</p>
                  </div>
                )}
                {product.colors?.length > 0 && (
                  <div className="bg-maroon-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Colours</p>
                    <p className="font-semibold text-maroon-900 mt-1">{product.colors.join(', ')}</p>
                  </div>
                )}
                <div className="bg-maroon-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Category</p>
                  <p className="font-semibold text-maroon-900 mt-1">{product.category}</p>
                </div>
                <div className="bg-maroon-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Stock</p>
                  <p className={`font-semibold mt-1 ${product.stock > 0 ? 'text-maroon-900' : 'text-red-600'}`}>{product.stock > 0 ? `${product.stock} available` : 'Out of stock'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Fit & Care */}
          {tab === 'care' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {product.fit && (
                  <div className="bg-rose-50 rounded-2xl p-5 border border-rose-100">
                    <div className="flex items-center gap-2 mb-3"><span className="text-2xl">👗</span><p className="font-bold text-maroon-900 text-sm uppercase tracking-wide">Fit</p></div>
                    <p className="text-gray-700 font-medium">{product.fit}</p>
                  </div>
                )}
                {product.fabric && (
                  <div className="bg-rose-50 rounded-2xl p-5 border border-rose-100">
                    <div className="flex items-center gap-2 mb-3"><span className="text-2xl">🧵</span><p className="font-bold text-maroon-900 text-sm uppercase tracking-wide">Fabric</p></div>
                    <p className="text-gray-700 font-medium">{product.fabric}</p>
                  </div>
                )}
                {product.material && (
                  <div className="bg-rose-50 rounded-2xl p-5 border border-rose-100">
                    <div className="flex items-center gap-2 mb-3"><span className="text-2xl">🔬</span><p className="font-bold text-maroon-900 text-sm uppercase tracking-wide">Material / Composition</p></div>
                    <p className="text-gray-700 font-medium">{product.material}</p>
                  </div>
                )}
              </div>

              {product.care_instructions && (
                <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
                  <div className="flex items-center gap-2 mb-4"><span className="text-2xl">🧺</span><p className="font-bold text-blue-900 text-sm uppercase tracking-wide">Care Instructions</p></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {product.care_instructions.split(/[.\n]+/).filter(s => s.trim()).map((instruction, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckCircle size={15} className="text-blue-500 mt-0.5 flex-shrink-0" />
                        <span>{instruction.trim()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                <p className="font-bold text-gray-700 text-sm uppercase tracking-wide mb-3">General Tips</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                  {['Wash dark colours separately for first few washes','Turn inside out before washing to preserve colour','Avoid soaking for extended periods','Store in a cool, dry place away from direct sunlight'].map((tip, i) => (
                    <div key={i} className="flex items-start gap-2"><span className="text-maroon-400 mt-0.5">•</span><span>{tip}</span></div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Reviews */}
          {tab === 'reviews' && (
            <div className="space-y-6">
              {!user && (
                <div className="bg-maroon-50 border border-maroon-200 rounded-xl p-4 text-center">
                  <p className="text-sm text-gray-700 mb-2">Sign in to write a review</p>
                  <Link href="/auth/login" className="btn-primary inline-flex items-center gap-2 py-2 px-5 text-sm">Sign In</Link>
                </div>
              )}
              {user && canReview && (
                <div className="bg-gradient-to-br from-maroon-50 to-rose-50 border border-maroon-200 rounded-2xl p-6">
                  <h3 className="font-bold text-maroon-900 mb-4 flex items-center gap-2">
                    <Star size={18} className="text-yellow-500 fill-yellow-500" /> Rate this product
                  </h3>
                  <form onSubmit={handleSubmitReview} className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Your rating *</p>
                      <div className="flex gap-1">
                        {[1,2,3,4,5].map(n => (
                          <button key={n} type="button" onMouseEnter={() => setHoverRating(n)} onMouseLeave={() => setHoverRating(0)} onClick={() => setMyRating(n)} className="focus:outline-none">
                            <Star size={32} className={(hoverRating || myRating) >= n ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
                          </button>
                        ))}
                        {myRating > 0 && <span className="ml-2 text-sm text-gray-600 self-center">{['','Poor','Fair','Good','Very Good','Excellent'][myRating]}</span>}
                      </div>
                    </div>
                    <div>
                      <label className="label">Review title (optional)</label>
                      <input type="text" value={myTitle} onChange={e => setMyTitle(e.target.value)} placeholder="e.g. Beautiful outfit for my daughter!" className="input-field" maxLength={100} />
                    </div>
                    <div>
                      <label className="label">Your review *</label>
                      <textarea value={myComment} onChange={e => setMyComment(e.target.value)} placeholder="Share your experience — quality, fit, colour, delivery..." className="input-field resize-none" rows={4} maxLength={1000} />
                      <p className="text-xs text-gray-400 mt-1">{myComment.length}/1000 characters</p>
                    </div>
                    <button type="submit" disabled={submitting || myRating === 0} className="btn-primary flex items-center gap-2 py-2.5 px-6 disabled:opacity-60">
                      {submitting ? 'Submitting...' : <><Send size={16} /> Submit Review</>}
                    </button>
                  </form>
                </div>
              )}
              {user && !canReview && reviewReason === 'not_purchased' && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-sm text-gray-600">🛡️ <strong>Only verified buyers</strong> who have received this product can leave a review. <Link href="/products" className="text-maroon-700 hover:underline ml-1">Purchase it to review.</Link></p>
                </div>
              )}
              {user && !canReview && reviewReason === 'already_reviewed' && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-sm text-green-700 flex items-center gap-2"><CheckCircle size={16} /> You have already reviewed this product. Thank you!</p>
                </div>
              )}

              {reviews.length > 0 ? (
                <div className="space-y-4">
                  {product && product.rating_count > 0 && (
                    <div className="flex items-center gap-4 bg-maroon-50 rounded-xl p-4 mb-6">
                      <div className="text-center flex-shrink-0">
                        <p className="text-4xl font-bold text-maroon-900">{product.rating_avg.toFixed(1)}</p>
                        <div className="flex gap-0.5 justify-center mt-1">
                          {[1,2,3,4,5].map(i => <Star key={i} size={14} className={i <= Math.round(product.rating_avg) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />)}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{product.rating_count} rating{product.rating_count !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="flex-1 space-y-1">
                        {[5,4,3,2,1].map(star => {
                          const cnt = reviews.filter(r => r.rating === star).length;
                          const pct = reviews.length ? Math.round((cnt / reviews.length) * 100) : 0;
                          return (
                            <div key={star} className="flex items-center gap-2 text-xs">
                              <span className="w-4 text-gray-600 text-right">{star}</span>
                              <Star size={10} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />
                              <div className="flex-1 bg-gray-200 rounded-full h-1.5"><div className="bg-yellow-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} /></div>
                              <span className="w-6 text-gray-400">{cnt}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {reviews.map((r) => (
                    <div key={r.id} className="border-b border-maroon-50 pb-5 last:border-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-9 h-9 rounded-full bg-maroon-100 flex items-center justify-center text-maroon-800 font-bold text-sm flex-shrink-0">
                          {r.user.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm text-gray-900">{r.user.full_name}</p>
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ Verified Buyer</span>
                          </div>
                          <div className="flex gap-0.5 mt-0.5">
                            {Array.from({ length: 5 }, (_, i) => (
                              <Star key={i} size={12} fill={i < r.rating ? '#facc15' : 'none'} className={i < r.rating ? 'text-yellow-400' : 'text-gray-300'} />
                            ))}
                          </div>
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">{new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                      {r.title && <p className="font-semibold text-sm text-gray-800 mb-1">{r.title}</p>}
                      {r.comment && <p className="text-sm text-gray-600 leading-relaxed">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-gray-500">
                  <Star size={40} className="mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">No reviews yet</p>
                  <p className="text-sm mt-1">Be the first verified buyer to review this product</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
