'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight, ShoppingBag } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

export default function CartPage() {
  const { items, count, total, loading, fetchCart, updateItem, removeItem, clearCart } = useCart();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading || !user) return;
    fetchCart();
  }, [user, authLoading]);

  if (authLoading || !user) return null;

  const shipping = 49;
  const grandTotal = total + shipping;

  const handleUpdate = async (itemId: number, qty: number) => {
    try {
      await updateItem(itemId, qty);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update quantity');
    }
  };

  const handleRemove = async (itemId: number, name: string) => {
    try {
      await removeItem(itemId);
      toast.success(`${name} removed from cart`);
    } catch {
      toast.error('Failed to remove item');
    }
  };

  const handleClear = async () => {
    if (!confirm('Remove all items from cart?')) return;
    try {
      await clearCart();
      toast.success('Cart cleared');
    } catch {
      toast.error('Failed to clear cart');
    }
  };

  if (loading) return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="animate-pulse space-y-4">
        {Array(3).fill(0).map((_, i) => (
          <div key={i} className="card p-4 flex gap-4">
            <div className="w-24 h-24 bg-gray-200 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/2" />
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-6 bg-gray-200 rounded w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (items.length === 0) return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <ShoppingBag size={80} className="mx-auto text-maroon-200 mb-6" />
      <h2 className="text-2xl font-bold text-gray-800 mb-3">Your cart is empty</h2>
      <p className="text-gray-500 mb-8">Looks like you haven&apos;t added anything yet. Explore our beautiful collection!</p>
      <Link href="/products" className="btn-primary inline-flex items-center gap-2">
        <ShoppingCart size={18} /> Start Shopping
      </Link>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="section-title">Shopping Cart <span className="text-gold-600">({count} item{count !== 1 ? 's' : ''})</span></h1>
        <button onClick={handleClear} className="text-sm text-red-500 hover:text-red-700 font-medium flex items-center gap-1.5">
          <Trash2 size={15} /> Clear Cart
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cart items */}
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => (
            <div key={item.id} className="card p-4">
              <div className="flex gap-4">
                {/* Image */}
                <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-orange-50 to-pink-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {item.product.images?.[0] && !item.product.images[0].includes('placeholder') ? (
                    <img
                      src={item.product.images[0].startsWith('http') ? item.product.images[0] : `${process.env.NEXT_PUBLIC_API_URL}${item.product.images[0]}`}
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl">
                      {item.product.category === 'Lehenga' ? '👗' : item.product.category === 'Chudithar' ? '👘' : '👚'}
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <Link href={`/products/${item.product_id}`} className="font-semibold text-gray-900 hover:text-maroon-800 line-clamp-2 text-sm leading-snug">
                    {item.product.name}
                  </Link>
                  <p className="text-xs text-gray-500 mt-1">{item.product.category}</p>
                  <div className="flex gap-3 mt-1 text-xs text-gray-500">
                    {item.size  && <span>Size: <b className="text-gray-700">{item.size}</b></span>}
                    {item.color && <span>Colour: <b className="text-gray-700">{item.color}</b></span>}
                  </div>

                  <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                    {/* Price */}
                    <div>
                      <span className="font-bold text-maroon-900">₹{(item.product.price * item.quantity).toLocaleString()}</span>
                      {item.quantity > 1 && (
                        <span className="text-xs text-gray-400 ml-1">₹{item.product.price.toLocaleString()} each</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Qty control */}
                      <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => handleUpdate(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className="px-2.5 py-1.5 hover:bg-gray-100 disabled:opacity-40 transition-colors"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="px-3 py-1.5 font-semibold text-sm min-w-[32px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleUpdate(item.id, item.quantity + 1)}
                          disabled={item.quantity >= item.product.stock || item.quantity >= 10}
                          className="px-2.5 py-1.5 hover:bg-gray-100 disabled:opacity-40 transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() => handleRemove(item.id, item.product.name)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Order summary */}
        <div className="lg:col-span-1">
          <div className="card p-6 sticky top-28">
            <h2 className="font-bold text-lg text-maroon-900 mb-5">Order Summary</h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-gray-700">
                <span>Subtotal ({count} item{count !== 1 ? 's' : ''})</span>
                <span className="font-medium">₹{total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span>Shipping</span>
                <span className="font-medium">₹{shipping}</span>
              </div>
              <div className="border-t border-orange-100 pt-3 flex justify-between font-bold text-lg">
                <span className="text-maroon-900">Total</span>
                <span className="text-maroon-900">₹{grandTotal.toLocaleString()}</span>
              </div>
            </div>

            <Link href="/checkout" className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 mt-6 text-base">
              Proceed to Checkout <ArrowRight size={18} />
            </Link>

            <Link href="/products" className="block text-center text-sm text-maroon-700 hover:underline mt-4">
              ← Continue Shopping
            </Link>

            <div className="mt-5 pt-4 border-t border-orange-100">
              <p className="text-xs text-gray-400 text-center">🔒 Secure checkout with SSL encryption</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
