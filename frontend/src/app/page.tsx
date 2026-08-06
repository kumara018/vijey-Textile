'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Star, Truck, Shield, RotateCcw, Headphones, ChevronLeft, ChevronRight } from 'lucide-react';
import { productsAPI } from '@/lib/api';
import { Product } from '@/types';
import ProductCard from '@/components/ProductCard';
import Hero3D from '@/components/Hero3D';

const OFFERS = [
  {
    emoji: '👶',
    tag: 'Adorable Picks',
    title: 'Baby Frocks',
    desc: 'Soft, gentle & cute baby frocks in sizes 14 to 24 — perfect for little ones.',
    btn: 'Shop Baby Frocks',
    href: '/products?category=Baby+Frocks',
    bg: 'from-maroon-100 via-gold-50 to-maroon-100',
    accent: '🌸',
  },
  {
    emoji: '👘',
    tag: 'Traditional Elegance',
    title: 'Chudithar Sets',
    desc: 'Premium cotton & silk chudithar sets — classic style, modern comfort. Sizes 14–40.',
    btn: 'Shop Chudithar',
    href: '/products?category=Chudithar',
    bg: 'from-gold-50 via-maroon-100 to-gold-50',
    accent: '🪷',
  },
  {
    emoji: '👗',
    tag: 'New Arrival',
    title: 'Frocks Collection',
    desc: 'Classic cotton frocks, umbrella frocks & lace frocks for every little girl.',
    btn: 'Shop Frocks',
    href: '/products?category=Frocks',
    bg: 'from-maroon-100 via-gold-50 to-maroon-100',
    accent: '💐',
  },
  {
    emoji: '👒',
    tag: 'Trending Now',
    title: 'Western Dresses',
    desc: 'Stylish A-line dresses, denim pinafores & shirt dresses for modern girls.',
    btn: 'Shop Western',
    href: '/products?category=Western+Dresses',
    bg: 'from-gold-50 via-maroon-100 to-gold-50',
    accent: '⭐',
  },
  {
    emoji: '💃',
    tag: 'Festival Special',
    title: 'Girls Lehenga',
    desc: 'Stunning silk & net lehengas for weddings, Diwali & all festive occasions.',
    btn: 'Shop Lehenga',
    href: '/products?category=Lehenga',
    bg: 'from-maroon-100 via-gold-50 to-maroon-100',
    accent: '🌺',
  },
  {
    emoji: '✨',
    tag: 'Party Ready',
    title: 'Party Wear',
    desc: 'Sequin gowns, tutu dresses & velvet frocks — every girl deserves to shine!',
    btn: 'Shop Party Wear',
    href: '/products?category=Party+Wear',
    bg: 'from-gold-50 via-maroon-100 to-gold-50',
    accent: '🎉',
  },
];

const CATEGORIES = [
  { name: 'Baby Frocks',      emoji: '👶', desc: 'Soft & Cute Baby Wear',   gradient: 'from-maroon-50 to-maroon-100',   border: 'border-maroon-200' },
  { name: 'Chudithar',        emoji: '👘', desc: 'Traditional Elegance',    gradient: 'from-gold-50 to-gold-100',       border: 'border-gold-200' },
  { name: 'Frocks',           emoji: '👗', desc: 'Classic & Printed',       gradient: 'from-maroon-100 to-gold-50',     border: 'border-maroon-300' },
  { name: 'Western Dresses',  emoji: '👒', desc: 'Modern & Trendy',         gradient: 'from-gold-50 to-gold-100',       border: 'border-gold-200' },
  { name: 'Lehenga',          emoji: '💃', desc: 'Festive & Bridal',        gradient: 'from-maroon-50 to-maroon-100',   border: 'border-maroon-200' },
  { name: 'Party Wear',       emoji: '✨', desc: 'Glam & Celebrations',     gradient: 'from-maroon-100 to-gold-50',     border: 'border-maroon-300' },
];

const FEATURES = [
  { icon: Truck,      title: 'Fast Delivery',       desc: 'Delivered to your doorstep', href: '/shipping'  },
  { icon: Shield,     title: '100% Authentic',   desc: 'Genuine quality products',    href: '/authentic' },
  { icon: RotateCcw,  title: 'Easy Exchange',    desc: '7-day exchange & replacement', href: '/support#returns'   },
  { icon: Headphones, title: 'Customer Support', desc: 'Mon–Sat, 9AM to 8PM',         href: '/support'   },
];

// No static fallback — only real verified-buyer reviews from the database

export default function HomePage() {
  const [featured,    setFeatured]    = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [reviews,     setReviews]     = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [offerIdx,    setOfferIdx]    = useState(0);
  const offerTimer = useRef<any>(null);

  // Auto-rotate offers every 3 seconds
  useEffect(() => {
    offerTimer.current = setInterval(() => {
      setOfferIdx(i => (i + 1) % OFFERS.length);
    }, 3000);
    return () => clearInterval(offerTimer.current);
  }, []);

  const prevOffer = () => {
    clearInterval(offerTimer.current);
    setOfferIdx(i => (i - 1 + OFFERS.length) % OFFERS.length);
    offerTimer.current = setInterval(() => setOfferIdx(i => (i + 1) % OFFERS.length), 3000);
  };
  const nextOffer = () => {
    clearInterval(offerTimer.current);
    setOfferIdx(i => (i + 1) % OFFERS.length);
    offerTimer.current = setInterval(() => setOfferIdx(i => (i + 1) % OFFERS.length), 3000);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [featRes, newRes, revRes] = await Promise.all([
          productsAPI.getAll({ featured: true, limit: 8 }),
          productsAPI.getAll({ sort_by: 'created_at', sort_order: 'desc', limit: 8 }),
          productsAPI.getRecentReviews(6),
        ]);
        setFeatured(featRes.data);
        setNewArrivals(newRes.data);
        if (Array.isArray(revRes.data)) setReviews(revRes.data);
      } catch {}
      finally { setLoading(false); }
    };
    load();
  }, []);

  return (
    <div>
      {/* Hero — "Heirloom Locket": full-bleed diagonal split, mirrored from Ammalu Tex's
          layout (locket left / copy right, opposite angle) so both sites read as siblings
          without either one carrying dead space on the sides. */}
      <section className="relative min-h-[86vh] flex flex-col overflow-hidden border-b border-maroon-200">
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(100deg, #f4ede1 0%, #f4ede1 46%, rgba(168,118,63,0.18) 46.4%, #faf7f2 100%)',
          }}
        />
        {/* Divider — anchored to the 3D box's own right edge (not a guessed
            percentage) so it can never drift into the headline regardless of
            viewport width. Straight, not rotated — a rotated line over this
            height drifts tens of px per degree and cut through the text at
            some widths. md+ only, once the layout actually splits left/right. */}
        <div
          className="hidden md:block absolute w-[2px]"
          style={{
            left: 'calc(6% + min(40vw, 420px) + 40px)',
            top: '8%', bottom: '8%',
            background: 'linear-gradient(180deg, transparent, #a8763f 30%, #a8763f 70%, transparent)',
            boxShadow: '0 0 24px 1px rgba(168,118,63,0.5)',
          }}
        />

        <div className="relative z-10 pt-16 md:pt-24 px-6 md:px-12 flex justify-center md:justify-end">
          <p className="text-[12px] font-bold tracking-[0.16em] uppercase text-maroon-500 max-w-[240px] text-center md:text-right">
            Baby Frocks · Chudithar · Frocks · Lehenga
          </p>
        </div>

        {/* Real 3D hero moment — normal flow + centered on mobile (avoids overlapping the
            copy below), absolute + mirrored-left on desktop to match Ammalu's fullness */}
        <div className="relative md:absolute md:z-[2] md:top-[14%] md:left-[6%] w-full md:w-[min(40vw,420px)] h-[280px] md:h-[56vh] mt-6 md:mt-0 px-10 md:px-0 mx-auto md:mx-0">
          <Hero3D />
        </div>

        <div className="relative z-10 px-6 md:px-12 pb-16 md:pb-20 mt-8 md:mt-auto flex justify-center md:justify-end">
          <div className="hero-copy text-center md:text-left">
            <motion.h1
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
              className="font-display font-black leading-[0.95] tracking-tight text-maroon-900 mb-6"
              style={{ fontSize: 'clamp(2.4rem, 7.5vw, 5.5rem)' }}
            >
              Heirloom pieces,<br />
              <span className="text-gold-500">worn once, remembered always.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
              className="max-w-md mx-auto md:mx-0 text-maroon-500 font-medium mb-8 leading-relaxed"
            >
              Every stitch reviewed by hand before it leaves Erode — a capsule built for the moments you&apos;ll photograph for years.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
              className="flex flex-wrap gap-4 justify-center md:justify-start"
            >
              <Link href="/products" className="btn-primary inline-flex items-center gap-2">
                Shop Now <ArrowRight size={18} />
              </Link>
              <Link href="/products?featured=true" className="inline-flex items-center gap-2 font-semibold py-2.5 px-6 rounded-lg border-2 border-maroon-800 text-maroon-900 hover:bg-maroon-100 transition-all duration-200 active:scale-95">
                View Featured
              </Link>
            </motion.div>
          </div>
        </div>
      </section>
      <style jsx>{`
        .hero-copy { max-width: 36rem; }
        @media (min-width: 768px) {
          .hero-copy {
            max-width: min(36rem, calc(94vw - 130px - min(40vw, 420px)));
          }
        }
      `}</style>

      {/* Features bar — each tile is a clickable link */}
      <section className="bg-maroon-100 border-y border-maroon-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-maroon-200">
            {FEATURES.map(({ icon: Icon, title, desc, href }) => (
              <Link
                key={title}
                href={href}
                className="bg-maroon-50 flex items-center gap-3 px-5 py-5 hover:bg-maroon-100 transition-colors group cursor-pointer"
              >
                <div className="p-2.5 bg-maroon-100 rounded-xl flex-shrink-0 group-hover:bg-maroon-200 transition-colors">
                  <Icon size={20} className="text-maroon-700" />
                </div>
                <div>
                  <p className="font-bold text-sm text-maroon-900 group-hover:underline">{title}</p>
                  <p className="text-xs text-maroon-600 mt-0.5">{desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-gold-600 font-medium text-sm mb-1 uppercase tracking-wider">Browse by</p>
            <h2 className="section-title">Shop by Category</h2>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {CATEGORIES.map(({ name, emoji, desc, gradient, border }, i) => (
            <motion.div
              key={name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4, delay: i * 0.05, ease: 'easeOut' }}
              whileHover={{ y: -6, scale: 1.02 }}
            >
              <Link
                href={`/products?category=${encodeURIComponent(name)}`}
                className={`group card bg-gradient-to-br ${gradient} border-2 ${border} hover:shadow-lg transition-shadow duration-300 p-6 flex flex-col items-center text-center h-full`}
              >
                <span className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-300">{emoji}</span>
                <h3 className="font-bold text-maroon-900 text-sm leading-tight">{name}</h3>
                <p className="text-xs text-maroon-600 mt-1">{desc}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section id="featured-products" className="bg-maroon-50 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="text-gold-600 font-medium text-sm mb-1 uppercase tracking-wider">Hand-picked</p>
              <h2 className="section-title">Featured Products</h2>
            </div>
            <Link href="/products?featured=true" className="text-maroon-800 hover:text-maroon-600 font-semibold text-sm flex items-center gap-1">
              View All <ArrowRight size={16} />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array(8).fill(0).map((_, i) => (
                <div key={i} className="card animate-pulse">
                  <div className="bg-gray-200 aspect-[3/4]" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-1/3" />
                    <div className="h-4 bg-gray-200 rounded w-2/3" />
                    <div className="h-8 bg-gray-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : featured.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {featured.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          ) : (
            <div className="text-center py-14">
              <p className="text-4xl mb-3">⭐</p>
              <p className="text-gray-500 font-medium">No featured products yet.</p>
              <p className="text-gray-400 text-sm mt-1">Check back soon — we&apos;re hand-picking the best for you!</p>
              <Link href="/products" className="inline-flex items-center gap-1 mt-4 text-maroon-700 hover:text-maroon-900 font-semibold text-sm">
                Browse all products <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Rotating Offer Banner */}
      <section className="max-w-7xl mx-auto px-4 py-10">
        <div className={`bg-gradient-to-r ${OFFERS[offerIdx].bg} border border-maroon-200 rounded-2xl p-8 md:p-12 text-maroon-900 text-center relative overflow-hidden transition-all duration-700`}>
          {/* Big background emoji */}
          <div className="absolute inset-0 opacity-[0.06] text-[180px] flex items-center justify-center select-none pointer-events-none">
            {OFFERS[offerIdx].accent}
          </div>

          {/* Prev / Next arrows */}
          <button
            onClick={prevOffer}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/70 hover:bg-white text-maroon-800 flex items-center justify-center transition-colors z-10"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={nextOffer}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/70 hover:bg-white text-maroon-800 flex items-center justify-center transition-colors z-10"
          >
            <ChevronRight size={20} />
          </button>

          {/* Content */}
          <div className="relative z-10 transition-all duration-500">
            <span className="inline-block bg-white/70 border border-gold-300 text-gold-700 text-xs font-semibold px-3 py-1 rounded-full mb-3 uppercase tracking-widest">
              {OFFERS[offerIdx].tag}
            </span>
            <h2 className="text-2xl md:text-4xl font-display font-black mb-3 text-maroon-900">
              {OFFERS[offerIdx].emoji} {OFFERS[offerIdx].title}
            </h2>
            <p className="text-maroon-600 mb-6 max-w-xl mx-auto text-sm md:text-base">
              {OFFERS[offerIdx].desc}
            </p>
            <Link href={OFFERS[offerIdx].href} className="btn-primary inline-flex items-center gap-2">
              {OFFERS[offerIdx].btn} <ArrowRight size={18} />
            </Link>
          </div>

          {/* Dot indicators */}
          <div className="flex justify-center gap-2 mt-6 relative z-10">
            {OFFERS.map((_, i) => (
              <button
                key={i}
                onClick={() => { clearInterval(offerTimer.current); setOfferIdx(i); offerTimer.current = setInterval(() => setOfferIdx(j => (j + 1) % OFFERS.length), 3000); }}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === offerIdx ? 'w-6 bg-gold-500' : 'w-1.5 bg-maroon-300'}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* New Arrivals */}
      <section className="max-w-7xl mx-auto px-4 pb-12">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-gold-600 font-medium text-sm mb-1 uppercase tracking-wider">Just In</p>
            <h2 className="section-title">New Arrivals</h2>
          </div>
          <Link href="/products?sort_by=created_at&sort_order=desc" className="text-maroon-800 hover:text-maroon-600 font-semibold text-sm flex items-center gap-1">
            View All <ArrowRight size={16} />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array(8).fill(0).map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="bg-gray-200 aspect-[3/4]" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                  <div className="h-8 bg-gray-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : newArrivals.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {newArrivals.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-12">Products coming soon.</p>
        )}
      </section>

      {/* Customer Reviews — real verified-buyer reviews from DB only */}
      {reviews.length > 0 && (
        <section className="bg-maroon-50 py-12">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="section-title text-center mb-2">What Our Customers Say</h2>
            <p className="text-center text-sm text-gray-500 mb-8">Genuine reviews from verified buyers ✓</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {reviews.slice(0, 3).map((rev) => (
                <div key={rev.id} className="card p-6 flex flex-col">
                  {/* Stars */}
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={15}
                        className={i < rev.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'} />
                    ))}
                  </div>
                  {/* Review text */}
                  <p className="text-gray-700 text-sm leading-relaxed mb-4 flex-1">
                    &ldquo;{rev.comment}&rdquo;
                  </p>
                  {/* Reviewer + product */}
                  <div className="border-t border-maroon-200 pt-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-maroon-800 text-sm">{rev.reviewer}</p>
                      <p className="text-xs text-green-600 font-medium">✓ Verified Buyer</p>
                    </div>
                    <Link
                      href={`/products/${rev.product_id}`}
                      className="text-xs text-maroon-600 hover:underline truncate max-w-[120px]"
                    >
                      {rev.product_name}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
