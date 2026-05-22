'use client';
import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ordersAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Order } from '@/types';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { ArrowLeft, Download, Mail, Share2, Printer } from 'lucide-react';

const PAY_LABEL: Record<string, string> = {
  razorpay: 'Online Payment (Razorpay)',
  upi:      'UPI Payment',
  cod:      'Cash on Delivery',
};

const PAY_STATUS_COLOR: Record<string, string> = {
  paid:     'text-green-700 bg-green-50 border-green-300',
  pending:  'text-amber-700  bg-amber-50  border-amber-300',
  refunded: 'text-purple-700 bg-purple-50 border-purple-300',
};

function InvoiceContent() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [order, setOrder]       = useState<Order | null>(null);
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    ordersAPI.getOne(Number(id))
      .then(r => setOrder(r.data))
      .catch(() => router.push('/orders'))
      .finally(() => setLoading(false));
  }, [id, user, authLoading]);

  const handlePrint = () => window.print();

  const handleEmail = async () => {
    setSending(true);
    try {
      await ordersAPI.sendInvoice(Number(id));
      toast.success('Invoice sent to your email! 📧');
    } catch {
      toast.error('Failed to send invoice. Please try again.');
    } finally { setSending(false); }
  };

  const handleWhatsApp = () => {
    const url = encodeURIComponent(`${window.location.origin}/orders/${id}/invoice`);
    const msg = encodeURIComponent(
      `📄 *Invoice — ${order?.order_number}*\nVijey Textile · Luxury Kid's & Girls Clothing\nView invoice: ${window.location.origin}/orders/${id}/invoice`
    );
    window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
  };

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-12 animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 rounded w-48" />
      <div className="h-[600px] bg-gray-200 rounded-2xl" />
    </div>
  );

  if (!order) return null;

  const addr = order.shipping_address as any;
  const pm   = (order.payment_method || 'cod').toLowerCase();
  const txn  = order.payment_transaction_id || '';
  const isCod = pm === 'cod';
  const date = new Date(order.created_at).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">

      {/* Action bar — hidden on print */}
      <div className="print:hidden mb-6 flex items-center gap-3 flex-wrap">
        <Link href={`/orders/${id}`} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-maroon-800 font-medium">
          <ArrowLeft size={16} /> Back to Order
        </Link>
        <div className="ml-auto flex gap-2 flex-wrap">
          <button onClick={handleEmail} disabled={sending}
            className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-60">
            <Mail size={15} /> {sending ? 'Sending...' : 'Email Invoice'}
          </button>
          <button onClick={handleWhatsApp}
            className="flex items-center gap-1.5 text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
            <Share2 size={15} /> WhatsApp
          </button>
          <button onClick={handlePrint}
            className="flex items-center gap-1.5 text-sm bg-maroon-800 hover:bg-maroon-900 text-white px-4 py-2 rounded-lg font-medium transition-colors">
            <Download size={15} /> Download PDF
          </button>
        </div>
      </div>

      {/* Invoice Card */}
      <div id="invoice" className="bg-white rounded-2xl shadow-lg print:shadow-none border border-gray-100 overflow-hidden">

        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-maroon-900 via-maroon-800 to-maroon-700 px-8 py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Logo on white card */}
            <div className="bg-white rounded-2xl px-4 py-3 shadow-lg">
              <img src="/logo.png" alt="Vijey Textile" className="h-20 w-auto" />
            </div>
            {/* Invoice details */}
            <div className="text-right">
              <div className="bg-white/15 rounded-xl px-5 py-4 inline-block">
                <p className="text-white/70 text-xs uppercase tracking-wider mb-1">Tax Invoice</p>
                <p className="text-white text-xl font-bold">{order.order_number}</p>
                <p className="text-white/70 text-xs mt-1">{date}</p>
              </div>
              <p className="text-white/60 text-xs mt-3">Shop Ground Floor No 131, Texvalley Gangapuram</p>
              <p className="text-white/60 text-xs">vijeytextile.com &nbsp;|&nbsp; +91 99941 68839</p>
            </div>
          </div>
        </div>

        {/* ── Gold divider strip ── */}
        <div className="h-1 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />

        <div className="px-8 py-7 space-y-6">

          {/* ── Customer + Shipping ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-maroon-50 border border-maroon-100 rounded-xl p-4">
              <p className="text-xs font-bold text-maroon-700 uppercase tracking-wider mb-3">Bill To</p>
              <p className="font-bold text-gray-900">{user?.full_name}</p>
              <p className="text-sm text-gray-600 mt-0.5">{user?.email}</p>
              <p className="text-sm text-gray-600">{user?.phone}</p>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
              <p className="text-xs font-bold text-orange-700 uppercase tracking-wider mb-3">Ship To</p>
              <p className="font-bold text-gray-900">{addr.full_name}</p>
              <p className="text-sm text-gray-600 mt-0.5">{addr.address_line1}</p>
              {addr.address_line2 && <p className="text-sm text-gray-600">{addr.address_line2}</p>}
              <p className="text-sm text-gray-600">{addr.city}, {addr.state} — {addr.pincode}</p>
              <p className="text-sm text-gray-600">📞 {addr.phone}</p>
            </div>
          </div>

          {/* ── Items Table ── */}
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-maroon-800 text-white text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-center">Qty</th>
                  <th className="px-4 py-3 text-right">Unit Price</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(order.items_snapshot as any[]).map((item, i) => {
                  const imgSrc = item.image
                    ? (item.image.startsWith('http') ? item.image : `${process.env.NEXT_PUBLIC_API_URL}${item.image}`)
                    : null;
                  const emoji = item.category === 'Baby Frocks' ? '👶' : item.category === 'Chudithar' ? '👘' : item.category === 'Frocks' ? '👗' : item.category === 'Western Dresses' ? '👒' : item.category === 'Lehenga' ? '💃' : item.category === 'Party Wear' ? '✨' : '👗';
                  return (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-orange-50/40'}>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-lg flex-shrink-0 overflow-hidden border border-orange-100">
                            {imgSrc
                              ? <img src={imgSrc} alt={item.name} className="w-full h-full object-cover" onError={e => { (e.currentTarget as HTMLImageElement).style.display='none'; }} />
                              : <span>{emoji}</span>}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{item.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              Product ID: #{item.product_id}
                              {item.size ? ` · Size: ${item.size}` : ''}
                              {item.color ? ` · Colour: ${item.color}` : ''}
                            </p>
                            <p className="text-xs text-gray-400">{item.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center font-semibold">{item.quantity}</td>
                      <td className="px-4 py-4 text-right text-gray-700">₹{Number(item.price).toLocaleString()}</td>
                      <td className="px-4 py-4 text-right font-bold text-maroon-900">₹{Number(item.subtotal).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Totals ── */}
          <div className="flex justify-end">
            <div className="w-full sm:w-64 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span className="font-medium">₹{order.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                <span className={`font-medium ${order.shipping_fee === 0 ? 'text-green-600' : ''}`}>
                  {order.shipping_fee === 0 ? 'FREE' : `₹${order.shipping_fee}`}
                </span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span className="font-medium">-₹{order.discount.toLocaleString()}</span>
                </div>
              )}
              <div className="border-t-2 border-maroon-200 pt-3 flex justify-between font-bold text-lg">
                <span className="text-maroon-900">Grand Total</span>
                <span className="text-maroon-900">₹{order.total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* ── Payment Details ── */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-3">Payment Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500 text-xs mb-1">Mode of Payment</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{isCod ? '💵' : '💳'}</span>
                  <span className="font-semibold text-gray-800">{PAY_LABEL[pm] || pm.toUpperCase()}</span>
                </div>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1">Payment Status</p>
                <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full border ${PAY_STATUS_COLOR[order.payment_status] || 'text-gray-600 bg-gray-50 border-gray-200'}`}>
                  {order.payment_status.toUpperCase()}
                </span>
              </div>
              {!isCod && txn && (
                <div className="sm:col-span-2">
                  <p className="text-gray-500 text-xs mb-1">Transaction ID</p>
                  <p className="font-mono text-xs bg-white border border-blue-200 rounded-lg px-3 py-2 text-gray-700 break-all">{txn}</p>
                </div>
              )}
              {isCod && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    💵 Cash on Delivery — Payment collected at the time of delivery.
                  </p>
                </div>
              )}
              {order.payment_status === 'refunded' && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                    💜 Refund initiated — Amount will be credited within 5–7 business days.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Order Status ── */}
          <div className="flex items-center justify-between flex-wrap gap-3 py-3 border-t border-gray-100">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Order Status:</span>
              <span className={`font-bold capitalize px-3 py-1 rounded-full text-xs border
                ${order.status === 'delivered' ? 'bg-green-50 text-green-700 border-green-300' :
                  order.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-300' :
                  'bg-blue-50 text-blue-700 border-blue-300'}`}>
                {order.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-gray-400">Invoice generated on {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="bg-gradient-to-r from-maroon-900 to-maroon-800 px-8 py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Vijey Textile" style={{ height: '52px', width: 'auto', mixBlendMode: 'multiply', display: 'block' }} />
              <div>
                <p className="text-white font-bold tracking-widest" style={{ fontFamily: 'Georgia, serif', fontSize: '14px', letterSpacing: '1.5px' }}>VIJEY TEXTILE</p>
                <p className="text-maroon-300 text-[9px] tracking-widest uppercase mb-1">Luxury Kid&apos;s &amp; Girls Clothing</p>
                <p className="text-white/60 text-xs">Shop Ground Floor No 131, Texvalley Gangapuram</p>
                <p className="text-white/60 text-xs">vijeytextile.com · support@vijeytextile.com</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white/50 text-xs">Thank you for shopping with us! 🛍️</p>
              <p className="text-gold-300 text-xs font-medium mt-1">© {new Date().getFullYear()} Vijey Textile. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #invoice, #invoice * { visibility: visible; }
          #invoice { position: fixed; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}

export default function InvoicePage() {
  return (
    <Suspense fallback={
      <div className="max-w-3xl mx-auto px-4 py-12 animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="h-[600px] bg-gray-200 rounded-2xl" />
      </div>
    }>
      <InvoiceContent />
    </Suspense>
  );
}
