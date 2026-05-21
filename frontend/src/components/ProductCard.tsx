'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, Star, Heart } from 'lucide-react';
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

  return (
    <Link href={`/products/${product.id}`} className="group block">
      <div className="card hover:shadow-lg transition-all duration-300 hover:-translate-y-1 h-full flex flex-col">
        {/* Image */}
        <div className="relative bg-gradient-to-br from-orange-50 to-pink-50 aspect-[3/4] overflow-hidden">
          {product.images && product.images[0] && !product.images[0].includes('placeholder') ? (
            <img
              src={product.images[0].startsWith('http') ? product.images[0] : `${process.env.NEXT_PUBLIC_API_URL}${product.images[0]}`}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-maroon-200">
              <div className="text-6xl mb-2">
                {product.category === 'Lehenga' ? '👗' :
                 product.category === 'Chudithar' ? '👘' :
                 product.category === 'Party Wears' ? '✨' :
                 product.category === 'Crop Tops' ? '👚' : '👕'}
              </div>
              <span className="text-xs font-medium text-maroon-300">{product.category}</span>
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1.5">
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

          <button
            onClick={handleWishlist}
            className={`absolute top-2 right-2 p-1.5 bg-white rounded-full shadow-sm transition-all opacity-0 group-hover:opacity-100 ${isWishlisted ? 'opacity-100' : ''}`}
            title={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <Heart
              size={15}
              className={isWishlisted ? 'text-red-500' : 'text-maroon-800'}
              fill={isWishlisted ? '#ef4444' : 'none'}
            />
          </button>
        </div>

        {/* Info */}
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

          {/* Price */}
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
  );
}
