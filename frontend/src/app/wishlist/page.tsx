'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, ShoppingCart, Trash2, ArrowLeft, Package } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useWishlist } from '@/context/WishlistContext';
import { useCart } from '@/context/CartContext';
import { wishlistAPI } from '@/lib/api';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function WishlistPage() {
  const { user } = useAuth();
  const { toggle, refresh } = useWishlist();
  const { addItem } = useCart();
  const router = useRouter();

  const [items, setItems]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<number | null>(null);

  useEffect(() => {
    if (!user) { router.push('/auth/login'); return; }
    load();
  }, [user]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await wishlistAPI.getAll();
      setItems(res.data || []);
    } catch {
      toast.error('Failed to load wishlist');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (productId: number) => {
    await toggle(productId);
    setItems(prev => prev.filter(i => i.product_id !== productId));
  };

  const handleAddToCart = async (item: any) => {
    setAddingId(item.product_id);
    try {
      await addItem(item.product_id, 1);
      toast.success(`${item.product.name} added to cart!`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to add to cart');
    } finally {
      setAddingId(null);
    }
  };

  const handleMoveToCart = async (item: any) => {
    setAddingId(item.product_id);
    try {
      await addItem(item.product_id, 1);
      await toggle(item.product_id);
      setItems(prev => prev.filter(i => i.product_id !== item.product_id));
      toast.success('Moved to cart!');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to move to cart');
    } finally {
      setAddingId(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex justify-center items-center gap-3 text-maroon-700">
          <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-maroon-700" />
          Loading your wishlist...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/products" className="p-2 hover:bg-orange-100 rounded-lg transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-maroon-900 flex items-center gap-2">
            <Heart size={24} fill="#ef4444" className="text-red-500" /> My Wishlist
          </h1>
          <p className="text-sm text-gray-500">{items.length} item{items.length !== 1 ? 's' : ''} saved</p>
        </div>
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div className="card p-12 text-center">
          <Heart size={64} className="text-gray-200 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-700 mb-2">Your wishlist is empty</h2>
          <p className="text-gray-500 mb-6">Save items you love by tapping the ❤️ heart on any product.</p>
          <Link href="/products" className="btn-primary px-8 py-3 inline-flex items-center gap-2">
            <Package size={18} /> Browse Products
          </Link>
        </div>
      )}

      {/* Wishlist grid */}
      {items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.map(item => {
            const p = item.product;
            const discount = p.compare_price
              ? Math.round(((p.compare_price - p.price) / p.compare_price) * 100)
              : null;

            return (
              <div key={item.id} className="card p-4 flex gap-4">
                {/* Image */}
                <Link href={`/products/${p.id}`} className="flex-shrink-0">
                  <div className="w-24 h-28 rounded-xl overflow-hidden bg-orange-50">
                    {p.images?.[0] && !p.images[0].includes('placeholder') ? (
                      <img
                        src={p.images[0].startsWith('http') ? p.images[0] : `${process.env.NEXT_PUBLIC_API_URL}${p.images[0]}`}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl">
                        {p.category === 'Lehenga' ? '👗' : p.category === 'Chudithar' ? '👘' : '👚'}
                      </div>
                    )}
                  </div>
                </Link>

                {/* Details */}
                <div className="flex-1 min-w-0 flex flex-col">
                  <p className="text-xs text-maroon-600 font-medium">{p.category}</p>
                  <Link href={`/products/${p.id}`}>
                    <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 hover:text-maroon-700 transition-colors mt-0.5">
                      {p.name}
                    </h3>
                  </Link>

                  {/* Price */}
                  <div className="flex items-baseline gap-2 mt-1.5">
                    <span className="text-base font-bold text-maroon-900">₹{p.price.toLocaleString()}</span>
                    {p.compare_price && (
                      <span className="text-xs text-gray-400 line-through">₹{p.compare_price.toLocaleString()}</span>
                    )}
                    {discount && (
                      <span className="text-xs font-bold text-green-600">{discount}% off</span>
                    )}
                  </div>

                  {/* Stock */}
                  {p.stock === 0 && (
                    <span className="text-xs text-red-500 font-medium mt-1">Out of Stock</span>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 mt-auto pt-3">
                    <button
                      onClick={() => handleMoveToCart(item)}
                      disabled={p.stock === 0 || addingId === p.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-maroon-800 hover:bg-maroon-900 text-white text-xs font-semibold transition-all disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      {addingId === p.id
                        ? <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                        : <ShoppingCart size={14} />}
                      {p.stock === 0 ? 'Out of Stock' : 'Move to Cart'}
                    </button>
                    <button
                      onClick={() => handleRemove(p.id)}
                      className="p-2 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                      title="Remove from wishlist"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Continue shopping */}
      {items.length > 0 && (
        <div className="mt-8 text-center">
          <Link href="/products" className="text-maroon-700 hover:underline text-sm font-medium">
            ← Continue Shopping
          </Link>
        </div>
      )}
    </div>
  );
}
