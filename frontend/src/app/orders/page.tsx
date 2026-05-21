'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Package, ChevronRight, Clock, CheckCircle, Truck, XCircle } from 'lucide-react';
import { ordersAPI } from '@/lib/api';
import { Order } from '@/types';
import { useAuth } from '@/context/AuthContext';

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string; badge: string; banner: string }> = {
  pending:          { label: 'Pending',          icon: Clock,        color: 'text-yellow-600', badge: 'badge-warning', banner: 'bg-yellow-50 border-yellow-200 text-yellow-800' },
  confirmed:        { label: 'Confirmed',         icon: CheckCircle,  color: 'text-blue-600',   badge: 'badge-info',    banner: 'bg-blue-50 border-blue-200 text-blue-800' },
  processing:       { label: 'Processing',        icon: Package,      color: 'text-purple-600', badge: 'badge-default', banner: 'bg-purple-50 border-purple-200 text-purple-800' },
  shipped:          { label: 'Shipped',           icon: Truck,        color: 'text-blue-700',   badge: 'badge-info',    banner: 'bg-blue-50 border-blue-200 text-blue-800' },
  out_for_delivery: { label: 'Out for Delivery',  icon: Truck,        color: 'text-orange-600', badge: 'badge-warning', banner: 'bg-orange-50 border-orange-200 text-orange-800' },
  delivered:        { label: 'Delivered',         icon: CheckCircle,  color: 'text-green-600',  badge: 'badge-success', banner: 'bg-green-50 border-green-200 text-green-800' },
  cancelled:        { label: 'Cancelled',         icon: XCircle,      color: 'text-red-600',    badge: 'badge-danger',  banner: 'bg-red-50 border-red-200 text-red-800' },
};

function getDeliveryLine(status: string): string {
  if (status === 'delivered') return 'Delivered';
  if (status === 'cancelled') return 'Cancelled';
  return 'Expected: 3–7 business days';
}

function getCategoryEmoji(category?: string): string {
  if (!category) return '👚';
  if (category === 'Lehenga') return '👗';
  if (category === 'Chudithar') return '👘';
  if (category === 'Half Saree') return '🥻';
  if (category === 'Crop Tops') return '🎽';
  if (category === 'Party Wears') return '✨';
  return '👚';
}

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;
    const load = async () => {
      try {
        const res = await ordersAPI.getAll();
        setOrders(res.data);
      } catch {} finally { setLoading(false); }
    };
    load();
  }, [user, authLoading]);

  if (authLoading || !user) return null;

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-4">
      {Array(3).fill(0).map((_, i) => (
        <div key={i} className="card overflow-hidden animate-pulse">
          <div className="h-10 bg-gray-200" />
          <div className="p-5 space-y-3">
            <div className="flex justify-between">
              <div className="h-5 bg-gray-200 rounded w-40" />
              <div className="h-5 bg-gray-200 rounded w-20" />
            </div>
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="h-4 bg-gray-200 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );

  if (orders.length === 0) return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <Package size={80} className="mx-auto text-maroon-200 mb-6" />
      <h2 className="text-2xl font-bold text-gray-800 mb-3">No orders yet</h2>
      <p className="text-gray-500 mb-8">You haven&apos;t placed any orders yet. Start shopping!</p>
      <Link href="/products" className="btn-primary inline-flex items-center gap-2">
        Start Shopping
      </Link>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="section-title mb-6">My Orders</h1>
      <div className="space-y-4">
        {orders.map((order) => {
          const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
          const Icon = cfg.icon;
          const items = order.items_snapshot as any[];
          const deliveryLine = getDeliveryLine(order.status);

          return (
            <Link key={order.id} href={`/orders/${order.id}`} className="block group">
              <div className="card overflow-hidden hover:shadow-md transition-all">

                {/* Colored status banner */}
                <div className={`border-b px-5 py-2.5 flex items-center justify-between ${cfg.banner}`}>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Icon size={14} />
                    <span>{cfg.label}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium opacity-80">
                    <span>{deliveryLine}</span>
                    <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>

                <div className="p-5">
                  {/* Order number + date */}
                  <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                    <div>
                      <p className="font-bold text-maroon-900 text-sm">{order.order_number}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(order.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'long', year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-500">Total</p>
                      <p className="font-bold text-maroon-900 text-base">₹{order.total.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Product emoji row */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex -space-x-1">
                      {items.slice(0, 4).map((item: any, idx: number) => (
                        <div
                          key={idx}
                          className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-50 to-pink-50 border border-white flex items-center justify-center text-lg shadow-sm"
                          title={item.name}
                        >
                          {getCategoryEmoji(item.category)}
                        </div>
                      ))}
                      {items.length > 4 && (
                        <div className="w-9 h-9 rounded-lg bg-gray-100 border border-white flex items-center justify-center text-xs font-bold text-gray-500 shadow-sm">
                          +{items.length - 4}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 font-medium line-clamp-1">
                        {items.map((i: any) => i.name).join(', ')}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {items.length} {items.length === 1 ? 'item' : 'items'}
                      </p>
                    </div>
                  </div>

                  {/* Tracking + payment */}
                  <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                    <span className="capitalize">Payment: {order.payment_method.toUpperCase()}</span>
                    <span>·</span>
                    <span className={order.payment_status === 'paid' ? 'text-green-600 font-medium' : 'text-orange-600 font-medium'}>
                      {order.payment_status === 'paid' ? '✓ Paid' : 'Pending'}
                    </span>
                    {order.tracking_number && (
                      <>
                        <span>·</span>
                        <span>
                          Tracking: <span className="font-mono font-medium text-maroon-700">{order.tracking_number}</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
