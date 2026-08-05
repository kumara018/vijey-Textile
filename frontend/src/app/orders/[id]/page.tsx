'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Package, Truck, CheckCircle, Clock, XCircle,
  MapPin, CreditCard, ArrowLeft, Sparkles, Phone, ShieldCheck,
  PackageOpen, Navigation, ExternalLink, AlertTriangle, RefreshCw,
  FileText, RotateCcw, ImagePlus, X, ChevronRight,
  Search, AlertCircle, Lock,
} from 'lucide-react';
import { ordersAPI, returnsAPI, productsAPI } from '@/lib/api';
import api from '@/lib/api';
import { Order, OrderItem, Product, ReturnRequest } from '@/types';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

declare global {
  interface Window { Razorpay: any; }
}

const STATUS_STEPS = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'];

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string; ring: string }> = {
  pending:          { label: 'Order Placed',      icon: Clock,        color: 'text-yellow-700', bg: 'bg-yellow-50',  ring: 'border-yellow-400' },
  confirmed:        { label: 'Confirmed',          icon: CheckCircle,  color: 'text-blue-700',   bg: 'bg-blue-50',    ring: 'border-blue-400' },
  processing:       { label: 'Being Packed',       icon: Package,      color: 'text-purple-700', bg: 'bg-purple-50',  ring: 'border-purple-400' },
  shipped:          { label: 'Shipped',            icon: Truck,        color: 'text-indigo-700', bg: 'bg-indigo-50',  ring: 'border-indigo-400' },
  out_for_delivery: { label: 'Out for Delivery',   icon: Truck,        color: 'text-orange-700', bg: 'bg-maroon-50',  ring: 'border-orange-400' },
  delivered:        { label: 'Delivered',          icon: CheckCircle,  color: 'text-green-700',  bg: 'bg-green-50',   ring: 'border-green-400' },
  cancelled:        { label: 'Cancelled',          icon: XCircle,      color: 'text-red-700',    bg: 'bg-red-50',     ring: 'border-red-400' },
};

const EXCHANGE_REASONS = [
  { value: 'size_issue', label: "Size Issue", desc: "Doesn't fit — need a different size" },
  { value: 'damage',     label: 'Damage / Defective Piece', desc: 'Item arrived damaged or has a defect' },
] as const;

// Windows are anchored to delivery time (return/exchange) or purchase time
// (cancel) — must match the backend exactly (backend/routers/orders.py and
// backend/routers/returns.py).
const CANCEL_WINDOW_HOURS   = 1;
const RETURN_WINDOW_HOURS   = 4;
const EXCHANGE_WINDOW_HOURS = 12;

const CANCEL_REASONS = [
  'Changed my mind',
  'Ordered by mistake',
  'Found a better price elsewhere',
  'Want to change the size/colour',
  'Other',
];

const RETURN_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:             { label: 'Pending Review',       color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  under_review:        { label: 'Under Review',         color: 'bg-blue-100 text-blue-700 border-blue-300'       },
  approved:            { label: 'Approved',             color: 'bg-green-100 text-green-700 border-green-300'    },
  rejected:            { label: 'Rejected',             color: 'bg-red-100 text-red-700 border-red-300'          },
  pickup_scheduled:    { label: 'Pickup Scheduled',     color: 'bg-purple-100 text-purple-700 border-purple-300' },
  picked_up:           { label: 'Picked Up',            color: 'bg-cyan-100 text-cyan-700 border-cyan-300'       },
  processing:          { label: 'Processing',           color: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  replacement_shipped: { label: 'Replacement Shipped',  color: 'bg-purple-100 text-purple-700 border-purple-300' },
  refund_initiated:    { label: 'Refund Initiated',     color: 'bg-amber-100 text-amber-700 border-amber-300'    },
  refunded:            { label: 'Refund Credited',      color: 'bg-green-100 text-green-700 border-green-300'    },
  completed:           { label: 'Completed',            color: 'bg-green-100 text-green-700 border-green-300'    },
};

function OrderDetailContent() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const isNew = searchParams.get('new') === '1';

  const [order, setOrder]             = useState<Order | null>(null);
  const [loading, setLoading]         = useState(true);
  const [tracking, setTracking]       = useState<any>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason]       = useState('');
  const [customReason, setCustomReason]       = useState('');
  const [cancelling, setCancelling]           = useState(false);

  // Return/Exchange modal state — steps: 1 Type (Return or Exchange) → 2 Item
  // (skipped if single-item order) → 3 Reason → 4 Choose Replacement
  // (exchange only) → 5 Pay Difference (exchange only, skipped if same price)
  // → 6 Photos + Checklist + Submit
  const [existingReturn, setExistingReturn]   = useState<ReturnRequest | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnStep, setReturnStep]           = useState(1);
  const [returnKind, setReturnKind]           = useState<'return'|'exchange'|''>('');
  const [selectedItem, setSelectedItem]       = useState<OrderItem | null>(null);
  const [returnReason, setReturnReason]       = useState<'size_issue'|'damage'|''>('');
  const [returnDesc, setReturnDesc]           = useState('');
  const [returnImages, setReturnImages]       = useState<string[]>([]);
  const [uploadingReturnImg, setUploadingReturnImg] = useState(false);
  const [submittingReturn, setSubmittingReturn]     = useState(false);
  const returnImgRef = useRef<HTMLInputElement>(null);

  // Replacement product picker
  const [productSearch, setProductSearch]     = useState('');
  const [productResults, setProductResults]   = useState<Product[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [newProduct, setNewProduct]           = useState<Product | null>(null);
  const [newSize, setNewSize]                 = useState('');
  const [newColor, setNewColor]               = useState('');

  // Price-difference payment
  const [paymentProof, setPaymentProof] = useState<{
    razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string;
  } | null>(null);
  const [payingDiff, setPayingDiff] = useState(false);

  // Final checklist confirmations
  const [checklist, setChecklist] = useState({ unused: false, packaging: false, invoice: false });

  const priceDifference = newProduct && selectedItem
    ? Math.round((newProduct.price - selectedItem.price) * 100) / 100
    : 0;

  // Steps actually visited for this request, in order — used for the "Step N
  // of M" indicator since return and exchange take different-length paths.
  const multiItem = (order?.items_snapshot?.length || 0) > 1;
  const activeSteps = [
    1,
    ...(multiItem ? [2] : []),
    3,
    ...(returnKind === 'exchange' ? [4] : []),
    ...(returnKind === 'exchange' && priceDifference > 0 ? [5] : []),
    6,
  ];
  const stepPosition = Math.max(1, activeSteps.indexOf(returnStep) + 1);
  const stepTotal = activeSteps.length;

  useEffect(() => {
    if (authLoading || !user) return;
    const load = async () => {
      try {
        const res = await ordersAPI.getOne(Number(id));
        setOrder(res.data);
        // Check for existing return request
        try {
          const rr = await returnsAPI.getAll();
          const found = rr.data.find((r: ReturnRequest) => r.order_id === Number(id));
          if (found) setExistingReturn(found);
        } catch {}
      } catch { router.push('/orders'); } finally { setLoading(false); }
    };
    load();
  }, [id, user, authLoading]);

  const fetchTracking = async () => {
    setTrackLoading(true);
    try {
      const res = await ordersAPI.track(Number(id));
      setTracking(res.data);
    } catch { toast.error('Could not fetch tracking info'); } finally { setTrackLoading(false); }
  };

  const openReturnModal = () => {
    const items = order?.items_snapshot || [];
    setSelectedItem(items.length === 1 ? items[0] : null);
    setReturnKind('');
    setReturnStep(1); // always start by asking Return or Exchange
    setShowReturnModal(true);
  };

  const resetReturnModal = () => {
    setReturnStep(1);
    setReturnKind('');
    setSelectedItem(null);
    setReturnReason('');
    setReturnDesc('');
    setReturnImages([]);
    setProductSearch('');
    setProductResults([]);
    setNewProduct(null);
    setNewSize('');
    setNewColor('');
    setPaymentProof(null);
    setChecklist({ unused: false, packaging: false, invoice: false });
    setShowReturnModal(false);
  };

  // After choosing Return/Exchange, go to item picker (multi-item orders) or
  // straight to reason (single item — it's already pre-selected).
  const afterKindChosen = (kind: 'return' | 'exchange') => {
    setReturnKind(kind);
    const items = order?.items_snapshot || [];
    setReturnStep(items.length > 1 ? 2 : 3);
  };

  const handleReturnImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (returnImages.length >= 3) { toast.error('Maximum 3 photos allowed'); return; }
    const formData = new FormData();
    formData.append('file', file);
    setUploadingReturnImg(true);
    try {
      const res = await returnsAPI.uploadImage(formData);
      setReturnImages(prev => [...prev, res.data.url]);
      toast.success('Photo uploaded!');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploadingReturnImg(false);
      if (returnImgRef.current) returnImgRef.current.value = '';
    }
  };

  const searchReplacementProducts = async (q: string) => {
    setProductSearch(q);
    if (q.trim().length < 2) { setProductResults([]); return; }
    setSearchingProducts(true);
    try {
      const res = await productsAPI.getAll({ search: q.trim(), limit: 12 });
      const raw = res.data;
      const data: Product[] = Array.isArray(raw) ? raw : (raw?.products ?? raw?.items ?? raw?.data ?? []);
      setProductResults(data.filter(p => p.id !== selectedItem?.product_id));
    } catch { /* silent — search box just shows no results */ }
    finally { setSearchingProducts(false); }
  };

  const selectNewProduct = (p: Product) => {
    setNewProduct(p);
    setNewSize(p.size_options?.[0] || '');
    setNewColor(p.colors?.[0] || '');
    setPaymentProof(null); // changing product invalidates any prior payment proof
  };

  // Pay the price difference via Razorpay before the exchange can be submitted
  const handlePayDifference = async () => {
    if (!newProduct || priceDifference <= 0) return;
    setPayingDiff(true);
    try {
      const orderRes = await api.post('/api/payments/create-order', { amount: priceDifference });
      const { order_id, key_id } = orderRes.data;
      const options: any = {
        key: key_id,
        amount: priceDifference * 100,
        currency: 'INR',
        name: order?.order_number ? `Exchange — ${order.order_number}` : 'Exchange Price Difference',
        description: `Price difference for exchanging into ${newProduct.name}`,
        order_id,
        prefill: { name: user?.full_name, contact: user?.phone, email: user?.email },
        theme: { color: '#e11d48' },
        handler: async (response: any) => {
          const proof = {
            razorpay_order_id:   response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature:  response.razorpay_signature,
          };
          try {
            await api.post('/api/payments/verify', proof);
            setPaymentProof(proof);
            toast.success('Payment successful — you can now submit your exchange request.');
          } catch {
            toast.error('Payment verification failed. Please try again.');
          } finally { setPayingDiff(false); }
        },
        modal: { ondismiss: () => { setPayingDiff(false); toast.error('Payment cancelled'); } },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch {
      toast.error('Could not start payment. Please try again.');
      setPayingDiff(false);
    }
  };

  const handleReturnSubmit = async () => {
    if (!selectedItem || !returnKind || !returnReason) {
      toast.error('Please complete all steps'); return;
    }
    if (returnKind === 'exchange' && !newProduct) {
      toast.error('Please choose a replacement product'); return;
    }
    if (returnImages.length < 2) { toast.error('Please upload at least 2 photos'); return; }
    if (!checklist.unused || !checklist.packaging || !checklist.invoice) {
      toast.error('Please confirm all three checklist items'); return;
    }
    if (returnKind === 'exchange' && priceDifference > 0 && !paymentProof) {
      toast.error('Please pay the price difference before submitting'); return;
    }
    setSubmittingReturn(true);
    try {
      const res = await returnsAPI.create({
        order_id: Number(id),
        product_id: selectedItem.product_id,
        request_type: returnKind,
        reason: returnReason,
        description: returnDesc.trim() || undefined,
        images: returnImages,
        ...(returnKind === 'exchange' ? {
          new_product_id: newProduct!.id,
          new_size: newSize || undefined,
          new_color: newColor || undefined,
          ...(paymentProof || {}),
        } : {}),
      });
      setExistingReturn(res.data);
      setShowReturnModal(false);
      toast.success(`${returnKind === 'return' ? 'Return' : 'Exchange'} request submitted! We will review within 24 hours.`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Could not submit request');
    } finally { setSubmittingReturn(false); }
  };

  const handleCancelConfirm = async () => {
    const reason = cancelReason === 'Other' ? customReason.trim() : cancelReason;
    if (!reason) { toast.error('Please select a reason'); return; }
    setCancelling(true);
    try {
      const res = await ordersAPI.cancel(Number(id), reason);
      setOrder(res.data);
      setShowCancelModal(false);
      toast.success('Order cancelled — refund initiated');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Could not cancel order');
    } finally { setCancelling(false); }
  };

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 py-12 animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 rounded w-64" />
      <div className="card p-6 space-y-4"><div className="h-6 bg-gray-200 rounded w-48" /><div className="h-24 bg-gray-200 rounded" /></div>
    </div>
  );

  if (!order) return null;

  const isCancelled = order.status === 'cancelled';
  const isDelivered = order.status === 'delivered';
  const currentStep = STATUS_STEPS.indexOf(order.status);
  const addr = order.shipping_address as any;
  // Check if any item in the order is non-returnable
  const hasNonReturnableItem = (order.items_snapshot as any[]).some(
    (item: any) => item.is_returnable === false
  );

  // Cancel: within 1 hour of purchase, and before it ships
  const hoursSincePurchase = (Date.now() - new Date(order.created_at).getTime()) / 3600000;
  const canCancel = hoursSincePurchase <= CANCEL_WINDOW_HOURS
    && !['cancelled', 'delivered', 'out_for_delivery'].includes(order.status);

  // Return/Exchange: anchored to delivery time
  const deliveredAnchor = order.delivered_at || order.created_at;
  const hoursSinceDelivery = (Date.now() - new Date(deliveredAnchor).getTime()) / 3600000;

  // Delhivery tracking events (parsed clean list)
  const trackingEvents: any[] = tracking?.tracking_events || [];
  // Fallback: Shiprocket format
  const srEvents: any[] = tracking?.raw_data?.tracking_data?.shipment_track_activities || [];
  const allEvents = trackingEvents.length > 0 ? trackingEvents : srEvents;
  const currentLocation = tracking?.status_location || tracking?.current_status?.location || order.status_location;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">

      {/* Success banner for new orders */}
      {isNew && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-6 text-center">
          <Sparkles size={40} className="mx-auto text-green-600 mb-3" />
          <h2 className="text-xl font-bold text-green-800 mb-1">Order Placed Successfully! 🎉</h2>
          <p className="text-green-700 text-sm">Thank you for shopping at Vijey Textile! Your order <b>{order.order_number}</b> has been confirmed.</p>
          <p className="text-green-600 text-xs mt-2">You will receive a confirmation via Email, SMS & WhatsApp shortly.</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Link href="/orders" className="p-2 hover:bg-orange-100 rounded-lg"><ArrowLeft size={20} /></Link>
        <div>
          <h1 className="text-xl font-bold text-maroon-900">Order {order.order_number}</h1>
          <p className="text-sm text-gray-500">Placed on {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        {canCancel && (
          <button
            onClick={() => setShowCancelModal(true)}
            className="ml-auto text-sm text-red-600 hover:text-red-800 border border-red-300 hover:border-red-500 px-4 py-2 rounded-lg transition-colors"
          >
            Cancel Order
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">

          {/* ── Status Timeline ── */}
          {!isCancelled && (
            <div className="card p-6">
              <h3 className="font-bold text-maroon-900 mb-5 flex items-center gap-2">
                <Package size={18} /> Order Status
              </h3>

              {/* Progress bar */}
              <div className="relative mb-2">
                <div className="absolute top-5 left-5 right-5 h-0.5 bg-gray-200">
                  <div
                    className="h-full bg-maroon-800 transition-all duration-700"
                    style={{ width: `${Math.max(0, (currentStep / (STATUS_STEPS.length - 1)) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between relative">
                  {STATUS_STEPS.map((s, i) => {
                    const done = i <= currentStep;
                    const active = i === currentStep;
                    const cfg = STATUS_CONFIG[s];
                    const Icon = cfg.icon;
                    return (
                      <div key={s} className="flex flex-col items-center gap-2 z-10">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all
                          ${done
                            ? (s === 'out_for_delivery' ? 'bg-orange-600 border-orange-600 text-white' :
                               s === 'delivered' ? 'bg-green-600 border-green-600 text-white' :
                               'bg-maroon-800 border-maroon-800 text-white')
                            : 'bg-white border-gray-300 text-gray-400'}
                          ${active ? 'ring-4 ring-offset-2 ring-maroon-200 scale-110' : ''}`}>
                          <Icon size={16} />
                        </div>
                        <span className={`text-[10px] font-medium text-center hidden sm:block leading-tight ${done ? 'text-maroon-800 font-semibold' : 'text-gray-400'}`} style={{ maxWidth: 64 }}>
                          {cfg.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Current location badge */}
              {currentLocation && (
                <div className="mt-5 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
                  <Navigation size={15} className="text-blue-600 flex-shrink-0" />
                  <span className="text-sm text-blue-800 font-medium">{currentLocation}</span>
                </div>
              )}

              {/* Tracking number + courier */}
              {(order.tracking_number || order.awb_code) && (
                <div className="mt-4 pt-4 border-t border-maroon-200 space-y-2">
                  {order.courier_name && (
                    <p className="text-sm text-gray-600">Courier: <span className="font-semibold text-maroon-800">{order.courier_name}</span></p>
                  )}
                  <p className="text-sm text-gray-600">
                    AWB / Tracking: <span className="font-mono font-bold text-maroon-800">{order.awb_code || order.tracking_number}</span>
                  </p>
                  {order.estimated_delivery && (
                    <p className="text-sm text-gray-600">
                      Estimated Delivery: <span className="font-semibold text-green-700">{order.estimated_delivery}</span>
                    </p>
                  )}
                  <div className="flex gap-3 flex-wrap mt-2">
                    {order.tracking_url && (
                      <a href={order.tracking_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-white bg-maroon-800 hover:bg-maroon-900 px-3 py-1.5 rounded-lg transition-colors">
                        <ExternalLink size={13} /> Track on {order.courier_name || 'Courier'} Website
                      </a>
                    )}
                    <button onClick={fetchTracking} disabled={trackLoading}
                      className="inline-flex items-center gap-1.5 text-sm text-maroon-700 border border-maroon-300 hover:bg-maroon-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60">
                      <RefreshCw size={13} className={trackLoading ? 'animate-spin' : ''} />
                      {trackLoading ? 'Loading...' : 'Refresh Tracking'}
                    </button>
                  </div>
                </div>
              )}

              {/* Estimated delivery banner for pre-ship statuses */}
              {['confirmed', 'processing'].includes(order.status) && (
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
                  <Truck size={16} className="text-blue-600 flex-shrink-0" />
                  <p className="text-sm text-blue-700 font-medium">Estimated Delivery: 3–7 Business Days</p>
                </div>
              )}
            </div>
          )}

          {/* ── Live Tracking History (Delhivery / Shiprocket) ── */}
          {allEvents.length > 0 && (
            <div className="card p-6">
              <h3 className="font-bold text-maroon-900 mb-4 flex items-center gap-2">
                <Navigation size={18} /> Live Tracking History
                {order.courier_name && <span className="text-xs font-normal text-gray-400 ml-1">via {order.courier_name}</span>}
              </h3>
              <div className="space-y-0">
                {allEvents.slice(0, 12).map((ev: any, i: number) => (
                  <div key={i} className="flex gap-3 relative">
                    {i < allEvents.length - 1 && (
                      <div className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-orange-100 z-0" />
                    )}
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center z-10 border-2 ${i === 0 ? 'bg-maroon-800 border-maroon-800 text-white' : 'bg-white border-orange-300 text-orange-500'}`}>
                      <MapPin size={14} />
                    </div>
                    <div className="pb-5 flex-1">
                      <p className={`text-sm font-semibold ${i === 0 ? 'text-maroon-900' : 'text-gray-700'}`}>
                        {ev.activity || ev.status || 'Update'}
                      </p>
                      {ev.location && (
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          <MapPin size={11} /> {ev.location}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {ev.datetime ? new Date(ev.datetime).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Open Box Delivery ── */}
          {order.open_box_delivery && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
              <PackageOpen size={24} className="text-blue-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-blue-800 text-sm">Open Box Delivery Requested</p>
                <p className="text-xs text-blue-600 mt-0.5">You can inspect the package before accepting delivery.</p>
              </div>
            </div>
          )}

          {/* ── Delivery OTP ── */}
          {order.status === 'out_for_delivery' && order.delivery_otp && (
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-300 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck size={22} className="text-orange-700" />
                <h3 className="font-bold text-orange-900">Your Delivery OTP</h3>
              </div>
              <p className="text-sm text-gray-700 mb-4">Your order is out for delivery! Share this OTP with the delivery agent when they arrive.</p>
              <div className="bg-white border-2 border-orange-300 rounded-xl p-4 text-center mb-4">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Delivery OTP</p>
                <p className="text-5xl font-bold tracking-[0.4em] font-mono text-orange-700">{order.delivery_otp}</p>
              </div>
              {(order.delivery_person_name || order.delivery_person_phone) && (
                <div className="bg-white border border-orange-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Your Delivery Agent</p>
                  {order.delivery_person_name && <p className="text-sm font-semibold text-gray-800">{order.delivery_person_name}</p>}
                  {order.delivery_person_phone && (
                    <a href={`tel:${order.delivery_person_phone}`}
                      className="flex items-center gap-1.5 text-sm text-maroon-700 hover:underline font-medium mt-1">
                      <Phone size={14} /> {order.delivery_person_phone}
                    </a>
                  )}
                </div>
              )}
              <p className="text-xs text-orange-700 mt-3 font-medium">⚠️ Never share this OTP via phone call or message. Only share it in person at your door.</p>
            </div>
          )}

          {/* ── Cancelled ── */}
          {isCancelled && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
              <div className="flex items-center gap-4 mb-3">
                <XCircle size={32} className="text-red-500 flex-shrink-0" />
                <div>
                  <p className="font-bold text-red-800">Order Cancelled</p>
                  <p className="text-sm text-red-600 mt-0.5">
                    {order.cancelled_by === 'user' ? 'Cancelled by you.' : 'Cancelled by store.'}
                    {order.cancel_reason ? ` Reason: ${order.cancel_reason}` : ''}
                  </p>
                </div>
              </div>
              {order.payment_status === 'refunded' ? (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-green-800">Refund Processed ✅</p>
                    <p className="text-xs text-green-600 mt-0.5">₹{order.total.toLocaleString()} refund has been processed by Razorpay. It will appear in your account within 1–3 business days depending on your bank.</p>
                  </div>
                </div>
              ) : order.payment_status === 'refund_initiated' ? (
                <div className="flex items-center gap-3 bg-maroon-50 border border-orange-200 rounded-xl px-4 py-3">
                  <RotateCcw size={18} className="text-orange-600 flex-shrink-0 animate-spin" style={{animationDuration:'3s'}} />
                  <div>
                    <p className="text-sm font-bold text-orange-800">Refund Initiated 🔄</p>
                    <p className="text-xs text-orange-600 mt-0.5">Your refund of ₹{order.total.toLocaleString()} has been initiated with Razorpay and is being processed. Will be credited to your original payment method within <b>5–7 business days</b>.</p>
                  </div>
                </div>
              ) : order.payment_method !== 'cod' && (
                <p className="text-sm text-orange-700 bg-maroon-50 border border-orange-200 rounded-xl px-4 py-2.5">
                  💰 Refund will be initiated within 24 hours and credited within 5–7 business days.
                </p>
              )}
            </div>
          )}

          {/* ── Items ── */}
          <div className="card p-6">
            <h3 className="font-bold text-maroon-900 mb-4">Ordered Items</h3>
            <div className="space-y-4">
              {(order.items_snapshot as any[]).map((item, i) => {
                const emoji = item.category === 'Baby Frocks' ? '👶' : item.category === 'Chudithar' ? '👘' : item.category === 'Frocks' ? '👗' : item.category === 'Western Dresses' ? '👒' : item.category === 'Lehenga' ? '💃' : item.category === 'Party Wear' ? '✨' : '👗';
                const imgSrc = item.image ? (item.image.startsWith('http') ? item.image : `${process.env.NEXT_PUBLIC_API_URL}${item.image}`) : null;
                return (
                  <div key={i} className="flex items-start gap-4 pb-4 border-b border-orange-50 last:border-0 last:pb-0">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-maroon-100 to-gold-50 flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden border border-maroon-200">
                      {imgSrc ? (
                        <img src={imgSrc} alt={item.name} className="w-full h-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                      ) : <span>{emoji}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-800 truncate">{item.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Qty: {item.quantity}
                        {item.size ? ` · Size: ${item.size}` : ''}
                        {item.color ? ` · Colour: ${item.color}` : ''}
                      </p>
                      <p className="text-xs text-gray-500">₹{Number(item.price).toLocaleString()} each</p>
                      {isDelivered && item.product_id && (
                        <Link href={`/products/${item.product_id}#reviews`}
                          className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-maroon-700 hover:text-maroon-900 border border-maroon-300 hover:border-maroon-500 rounded-lg px-2.5 py-1 transition-colors">
                          ✍️ Write a Review
                        </Link>
                      )}
                    </div>
                    <p className="font-bold text-maroon-900 flex-shrink-0">₹{Number(item.subtotal).toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-5">
          {/* Price summary */}
          <div className="card p-5">
            <h3 className="font-bold text-maroon-900 mb-4">Price Breakdown</h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-gray-700"><span>Subtotal</span><span>₹{order.subtotal.toLocaleString()}</span></div>
              <div className="flex justify-between text-gray-700">
                <span>Shipping</span>
                <span className={order.shipping_fee === 0 ? 'text-green-600' : ''}>{order.shipping_fee === 0 ? 'FREE' : `₹${order.shipping_fee}`}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-green-600"><span>Discount</span><span>-₹{order.discount.toLocaleString()}</span></div>
              )}
              <div className="border-t border-maroon-200 pt-2.5 flex justify-between font-bold text-base">
                <span>Total Paid</span><span className="text-maroon-900">₹{order.total.toLocaleString()}</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-orange-50 space-y-2">
              <p className="text-xs text-gray-500 flex items-center gap-1.5">
                <CreditCard size={12} />
                Mode: <b className="capitalize">
                  {order.payment_method === 'razorpay' ? 'Online (Razorpay)' :
                   order.payment_method === 'upi' ? 'UPI' :
                   order.payment_method === 'emi' ? 'EMI' : 'Cash on Delivery'}
                </b>
              </p>
              <p className="text-xs flex items-center gap-1.5">
                <span className={`inline-block font-bold px-2 py-0.5 rounded-full text-[10px] border
                  ${order.payment_status === 'paid'             ? 'text-green-700 bg-green-50 border-green-300'     :
                    order.payment_status === 'refund_initiated' ? 'text-orange-700 bg-maroon-50 border-orange-300'  :
                    order.payment_status === 'refunded'         ? 'text-purple-700 bg-purple-50 border-purple-300'  :
                    'text-amber-700 bg-amber-50 border-amber-300'}`}>
                  {order.payment_status === 'paid'             ? '✅ PAID'                 :
                   order.payment_status === 'refund_initiated' ? '🔄 REFUND INITIATED'     :
                   order.payment_status === 'refunded'         ? '✅ REFUND PROCESSED'     : '⏳ PENDING'}
                </span>
              </p>
              {order.payment_status === 'refund_initiated' && (
                <p className="text-[10px] text-orange-600 bg-maroon-50 border border-maroon-200 rounded-lg px-2 py-1.5 mt-1">
                  ⏱️ Refund initiated — will be credited to your account within <b>5–7 business days</b>.
                </p>
              )}
              {order.payment_status === 'refunded' && (
                <p className="text-[10px] text-green-600 bg-green-50 border border-green-100 rounded-lg px-2 py-1.5 mt-1">
                  ✅ Refund processed by Razorpay — will appear in your bank account within <b>1–3 business days</b>.
                </p>
              )}
              {order.payment_transaction_id && order.payment_method !== 'cod' && (
                <div className="mt-2 pt-2 border-t border-orange-50">
                  <p className="text-[10px] text-gray-400 mb-1">Transaction ID</p>
                  <p className="font-mono text-[10px] text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5 break-all leading-relaxed">
                    {order.payment_transaction_id}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Invoice */}
          <div className="card p-5">
            <h3 className="font-bold text-maroon-900 mb-3 flex items-center gap-2"><FileText size={16} /> Invoice</h3>
            <p className="text-xs text-gray-500 mb-3">Download or share your order invoice</p>
            <Link href={`/orders/${order.id}/invoice`}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-maroon-800 hover:bg-maroon-900 text-white text-sm font-medium rounded-xl transition-colors">
              <FileText size={15} /> View & Download Invoice
            </Link>
          </div>

          {/* Return / Exchange / Replace */}
          {isDelivered && (
            <div className="card p-5">
              <h3 className="font-bold text-maroon-900 mb-2 flex items-center gap-2">
                <RotateCcw size={16} /> Return / Exchange
              </h3>
              {hasNonReturnableItem ? (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <XCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-red-700">Non-Returnable Order</p>
                    <p className="text-xs text-red-600 mt-0.5">This order contains a non-returnable item and is not eligible for return or exchange.</p>
                  </div>
                </div>
              ) : existingReturn ? (
                <div>
                  <p className="text-xs text-gray-500 mb-2">You have a {existingReturn.request_type === 'return' ? 'Return' : 'Exchange'} request</p>
                  <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border mb-3 ${RETURN_STATUS_LABEL[existingReturn.status]?.color || 'bg-gray-100 text-gray-600 border-gray-300'}`}>
                    {RETURN_STATUS_LABEL[existingReturn.status]?.label || existingReturn.status}
                  </div>
                  {existingReturn.admin_notes && (
                    <p className="text-xs text-gray-600 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mb-3">
                      Note: {existingReturn.admin_notes}
                    </p>
                  )}
                  <Link href={`/returns/${existingReturn.id}`}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-maroon-300 text-maroon-700 hover:bg-maroon-50 text-sm font-medium rounded-xl transition-colors">
                    View Request Details <ChevronRight size={14} />
                  </Link>
                </div>
              ) : hoursSinceDelivery > EXCHANGE_WINDOW_HOURS ? (
                <div className="flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <Clock size={16} className="text-gray-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-gray-500">The return ({RETURN_WINDOW_HOURS}h) and exchange ({EXCHANGE_WINDOW_HOURS}h) windows for this order have both passed.</p>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-gray-500 mb-3">
                    Return for a refund within {RETURN_WINDOW_HOURS} hours, or exchange for any product within {EXCHANGE_WINDOW_HOURS} hours of delivery. We do not offer cancellations after purchase's 1-hour window.
                  </p>
                  <button
                    onClick={openReturnModal}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-maroon-300 text-maroon-700 hover:bg-maroon-50 text-sm font-medium rounded-xl transition-colors">
                    <RotateCcw size={15} /> Request Return / Exchange
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Delivery address */}
          <div className="card p-5">
            <h3 className="font-bold text-maroon-900 mb-3 flex items-center gap-2"><MapPin size={16} /> Delivery Address</h3>
            <div className="text-sm text-gray-700 space-y-1">
              <p className="font-semibold">{addr.full_name}</p>
              <p>{addr.address_line1}</p>
              {addr.address_line2 && <p>{addr.address_line2}</p>}
              <p>{addr.city}, {addr.state} — {addr.pincode}</p>
              <p className="text-gray-500">📞 {addr.phone}</p>
            </div>
          </div>

          <Link href="/products" className="btn-secondary w-full flex items-center justify-center gap-2 py-3">
            Continue Shopping
          </Link>
        </div>
      </div>

      {/* ── Return / Exchange Request Modal ── */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4" onClick={resetReturnModal}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-maroon-200">
              <div>
                <h3 className="font-bold text-maroon-900 text-lg">{returnKind === 'return' ? 'Return Request' : returnKind === 'exchange' ? 'Exchange Request' : 'Return / Exchange'}</h3>
                <p className="text-xs text-gray-500">{order.order_number} · Step {stepPosition} of {stepTotal}</p>
              </div>
              <button onClick={resetReturnModal} className="p-2 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>

            {/* Step indicator */}
            <div className="flex gap-0 px-5 pt-4">
              {activeSteps.map(s => (
                <div key={s} className={`flex-1 h-1.5 rounded-full mx-0.5 transition-all ${returnStep >= s ? 'bg-maroon-800' : 'bg-gray-200'}`} />
              ))}
            </div>

            <div className="p-5">
              {/* Step 1: Return or Exchange? */}
              {returnStep === 1 && (
                <div>
                  <p className="font-semibold text-gray-800 mb-4">What would you like to do?</p>
                  <div className="space-y-3">
                    <button onClick={() => afterKindChosen('return')}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${returnKind === 'return' ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-maroon-300 bg-white'}`}>
                      <p className="font-semibold text-gray-800 text-sm">Return for a refund</p>
                      <p className="text-xs text-gray-500 mt-0.5">Send the item back and get your money refunded to your original payment method. Window: {RETURN_WINDOW_HOURS} hours from delivery.</p>
                    </button>
                    <button onClick={() => afterKindChosen('exchange')}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${returnKind === 'exchange' ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-maroon-300 bg-white'}`}>
                      <p className="font-semibold text-gray-800 text-sm">Exchange for another product</p>
                      <p className="text-xs text-gray-500 mt-0.5">Swap for any product of the same or higher price — pay only the difference. Window: {EXCHANGE_WINDOW_HOURS} hours from delivery.</p>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Which item (only shown for multi-item orders) */}
              {returnStep === 2 && (
                <div>
                  <p className="font-semibold text-gray-800 mb-4">Which item do you want to {returnKind === 'return' ? 'return' : 'exchange'}?</p>
                  <div className="space-y-2">
                    {(order.items_snapshot as OrderItem[]).map((it, idx) => (
                      <button key={idx} onClick={() => { setSelectedItem(it); setReturnStep(3); }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-gray-200 hover:border-maroon-400 text-left transition-all">
                        <div className="w-12 h-12 rounded-lg bg-maroon-50 flex items-center justify-center text-xl flex-shrink-0 overflow-hidden">
                          {it.image ? <img src={it.image} alt={it.name} className="w-full h-full object-cover" /> : '👗'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{it.name}</p>
                          <p className="text-xs text-gray-500">Qty {it.quantity}{it.size ? ` · ${it.size}` : ''}{it.color ? ` · ${it.color}` : ''} · ₹{it.price.toLocaleString()}</p>
                        </div>
                        <ChevronRight size={16} className="text-gray-400" />
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setReturnStep(1)} className="mt-4 w-full py-2.5 border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50">Back</button>
                </div>
              )}

              {/* Step 3: Reason */}
              {returnStep === 3 && (
                <div>
                  <p className="font-semibold text-gray-800 mb-1">Why are you {returnKind === 'return' ? 'returning' : 'exchanging'} this item?</p>
                  <p className="text-xs text-gray-500 mb-4">Select the most appropriate reason</p>
                  <div className="space-y-2 mb-4">
                    {EXCHANGE_REASONS.map(r => (
                      <label key={r.value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${returnReason === r.value ? 'border-maroon-500 bg-maroon-50' : 'border-gray-200 hover:border-maroon-300'}`}>
                        <input type="radio" name="return_reason" value={r.value} checked={returnReason === r.value}
                          onChange={() => setReturnReason(r.value)} className="accent-maroon-700" />
                        <div>
                          <span className="text-sm text-gray-800 font-medium block">{r.label}</span>
                          <span className="text-xs text-gray-500">{r.desc}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div>
                    <label className="label">Additional Details (optional)</label>
                    <textarea value={returnDesc} onChange={e => setReturnDesc(e.target.value)}
                      placeholder="Describe the issue in more detail..."
                      rows={3}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-maroon-400 resize-none" />
                  </div>
                  <div className="flex gap-3 mt-5">
                    <button onClick={() => setReturnStep(multiItem ? 2 : 1)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50">Back</button>
                    <button onClick={() => {
                        if (!returnReason) { toast.error('Please select a reason'); return; }
                        setReturnStep(returnKind === 'exchange' ? 4 : 6);
                      }}
                      className="flex-1 py-2.5 bg-maroon-800 text-white rounded-xl font-semibold text-sm hover:bg-maroon-900 flex items-center justify-center gap-2">
                      Continue <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Choose replacement — exchange only, any product, must cost the same or more */}
              {returnStep === 4 && (
                <div>
                  <p className="font-semibold text-gray-800 mb-1">Choose your replacement</p>
                  <p className="text-xs text-gray-500 mb-4">
                    Original item: ₹{selectedItem?.price.toLocaleString()}. Your replacement must cost the same or more — no cheaper items (no refund is issued for the difference).
                  </p>

                  <div className="relative mb-3">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" value={productSearch} onChange={e => searchReplacementProducts(e.target.value)}
                      placeholder="Search products to exchange into..."
                      className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-maroon-400" />
                  </div>

                  {searchingProducts && <p className="text-xs text-gray-400 mb-3">Searching...</p>}

                  {productResults.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mb-4 max-h-56 overflow-y-auto">
                      {productResults.map(p => {
                        const tooCheap = p.price < (selectedItem?.price || 0);
                        return (
                          <button key={p.id} disabled={tooCheap} onClick={() => selectNewProduct(p)}
                            className={`text-left p-2.5 rounded-xl border-2 transition-all ${newProduct?.id === p.id ? 'border-maroon-700 bg-maroon-50' : tooCheap ? 'border-gray-100 opacity-40 cursor-not-allowed' : 'border-gray-200 hover:border-maroon-300'}`}>
                            <div className="w-full aspect-square rounded-lg bg-maroon-50 mb-1.5 overflow-hidden flex items-center justify-center">
                              {p.images?.[0] ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" /> : <span className="text-2xl">👗</span>}
                            </div>
                            <p className="text-xs font-medium text-gray-800 truncate">{p.name}</p>
                            <p className="text-xs font-semibold text-maroon-800">₹{p.price.toLocaleString()}</p>
                            {tooCheap && <p className="text-[10px] text-red-500 mt-0.5">Too low — pick ₹{selectedItem?.price.toLocaleString()}+</p>}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {newProduct && (
                    <div className="bg-maroon-50 border border-orange-200 rounded-xl p-3 mb-4 space-y-3">
                      <p className="text-sm font-semibold text-gray-800">Selected: {newProduct.name}</p>
                      {newProduct.size_options?.length > 0 && (
                        <div>
                          <label className="label">Size</label>
                          <div className="flex flex-wrap gap-1.5">
                            {newProduct.size_options.map(s => (
                              <button key={s} onClick={() => setNewSize(s)}
                                className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${newSize === s ? 'border-maroon-700 bg-maroon-800 text-white' : 'border-gray-300 text-gray-600'}`}>{s}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      {newProduct.colors?.length > 0 && (
                        <div>
                          <label className="label">Colour</label>
                          <div className="flex flex-wrap gap-1.5">
                            {newProduct.colors.map(c => (
                              <button key={c} onClick={() => setNewColor(c)}
                                className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${newColor === c ? 'border-maroon-700 bg-maroon-800 text-white' : 'border-gray-300 text-gray-600'}`}>{c}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="border-t border-orange-200 pt-2 text-xs text-gray-700 space-y-0.5">
                        <p>Original: ₹{selectedItem?.price.toLocaleString()}</p>
                        <p>Replacement: ₹{newProduct.price.toLocaleString()}</p>
                        <p className="font-semibold text-maroon-800">
                          {priceDifference > 0 ? `You pay ₹${priceDifference.toLocaleString()} more` : 'Same price — no extra payment'}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={() => setReturnStep(3)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50">Back</button>
                    <button onClick={() => {
                        if (!newProduct) { toast.error('Please choose a replacement product'); return; }
                        setReturnStep(priceDifference > 0 ? 5 : 6);
                      }}
                      className="flex-1 py-2.5 bg-maroon-800 text-white rounded-xl font-semibold text-sm hover:bg-maroon-900 flex items-center justify-center gap-2">
                      Continue <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 5: Pay the difference (only when replacement costs more) */}
              {returnStep === 5 && (
                <div>
                  <p className="font-semibold text-gray-800 mb-1 flex items-center gap-2"><Lock size={16} className="text-green-600" /> Pay Price Difference</p>
                  <p className="text-xs text-gray-500 mb-4">Your replacement costs more than the original item. This must be paid upfront before your exchange request is submitted.</p>
                  <div className="bg-maroon-50 border border-orange-200 rounded-xl p-4 mb-4 text-center">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Amount Due</p>
                    <p className="text-2xl font-bold text-maroon-800">₹{priceDifference.toLocaleString()}</p>
                  </div>
                  {paymentProof ? (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl mb-4">
                      <CheckCircle size={18} className="text-green-600" />
                      <p className="text-sm text-green-700 font-medium">Payment received — ready to submit</p>
                    </div>
                  ) : (
                    <button onClick={handlePayDifference} disabled={payingDiff}
                      className="w-full py-3 bg-maroon-800 text-white rounded-xl font-semibold text-sm hover:bg-maroon-900 disabled:opacity-60 flex items-center justify-center gap-2 mb-4">
                      {payingDiff ? <><RefreshCw size={14} className="animate-spin" /> Opening payment...</> : <><Lock size={16} /> Pay ₹{priceDifference.toLocaleString()}</>}
                    </button>
                  )}
                  <div className="flex gap-3">
                    <button onClick={() => setReturnStep(4)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50">Back</button>
                    <button onClick={() => { if (!paymentProof) { toast.error('Please complete the payment first'); return; } setReturnStep(6); }}
                      className="flex-1 py-2.5 bg-maroon-800 text-white rounded-xl font-semibold text-sm hover:bg-maroon-900 flex items-center justify-center gap-2 disabled:opacity-60"
                      disabled={!paymentProof}>
                      Continue <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 6: Photos + checklist + submit */}
              {returnStep === 6 && (
                <div>
                  <p className="font-semibold text-gray-800 mb-1">Upload Photos & Confirm</p>
                  <p className="text-xs text-gray-500 mb-4">At least 2 photos are required as proof. Max 3.</p>

                  {/* Summary */}
                  <div className="bg-maroon-50 border border-orange-200 rounded-xl p-3 mb-4 text-xs text-gray-600 space-y-0.5">
                    <p><span className="font-semibold">Type:</span> {returnKind === 'return' ? 'Return (Refund)' : 'Exchange'}</p>
                    <p><span className="font-semibold">Item:</span> {selectedItem?.name}</p>
                    <p><span className="font-semibold">Reason:</span> {EXCHANGE_REASONS.find(r => r.value === returnReason)?.label}</p>
                    {returnKind === 'exchange' && (
                      <p><span className="font-semibold">Replacement:</span> {newProduct?.name}{newSize ? ` · ${newSize}` : ''}{newColor ? ` · ${newColor}` : ''}</p>
                    )}
                    {priceDifference > 0 && <p><span className="font-semibold">Paid:</span> ₹{priceDifference.toLocaleString()} difference</p>}
                  </div>

                  {/* Image grid */}
                  <div className="flex flex-wrap gap-3 mb-2">
                    {returnImages.map((url, idx) => (
                      <div key={idx} className="relative group">
                        <img src={url} alt={`Exchange photo ${idx+1}`} className="w-20 h-20 object-cover rounded-xl border-2 border-orange-200" />
                        <button onClick={() => setReturnImages(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                    {returnImages.length < 3 && (
                      <button onClick={() => returnImgRef.current?.click()} disabled={uploadingReturnImg}
                        className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-maroon-400 hover:text-maroon-500 transition-colors disabled:opacity-50">
                        {uploadingReturnImg ? (
                          <RefreshCw size={18} className="animate-spin" />
                        ) : (
                          <><ImagePlus size={20} /><span className="text-[9px] mt-1">Add Photo</span></>
                        )}
                      </button>
                    )}
                  </div>
                  <input ref={returnImgRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleReturnImageUpload} />
                  <p className="text-xs text-gray-400 mb-4">JPEG, PNG or WebP · Max 10MB each {returnImages.length < 2 && <span className="text-red-500 font-medium">· {2 - returnImages.length} more required</span>}</p>

                  {/* Checklist */}
                  <div className="space-y-2 mb-5">
                    {[
                      { key: 'unused' as const,     label: 'The item is unused and not dirty' },
                      { key: 'packaging' as const,  label: 'It will be packed properly for pickup' },
                      { key: 'invoice' as const,    label: 'The original invoice/bill will be included' },
                    ].map(c => (
                      <label key={c.key} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-gray-200 cursor-pointer hover:border-maroon-300">
                        <input type="checkbox" checked={checklist[c.key]}
                          onChange={e => setChecklist(prev => ({ ...prev, [c.key]: e.target.checked }))}
                          className="w-4 h-4 accent-maroon-700" />
                        <span className="text-sm text-gray-700">{c.label}</span>
                      </label>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setReturnStep(returnKind === 'exchange' ? (priceDifference > 0 ? 5 : 4) : 3)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50">Back</button>
                    <button onClick={handleReturnSubmit} disabled={submittingReturn}
                      className="flex-1 py-2.5 bg-maroon-800 text-white rounded-xl font-semibold text-sm hover:bg-maroon-900 disabled:opacity-60 flex items-center justify-center gap-2">
                      {submittingReturn ? <><RefreshCw size={14} className="animate-spin" /> Submitting...</> : `Submit ${returnKind === 'return' ? 'Return' : 'Exchange'} Request`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel Confirmation Modal ── */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4" onClick={() => setShowCancelModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Cancel Order?</h3>
                <p className="text-sm text-gray-500">{order.order_number}</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Please tell us why you want to cancel. This helps us improve.
              <span className="block mt-1 text-orange-600 font-medium">Your payment will be refunded within 5–7 business days.</span>
            </p>

            {/* Reason selector */}
            <div className="space-y-2 mb-4">
              {CANCEL_REASONS.map(reason => (
                <label key={reason} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${cancelReason === reason ? 'border-maroon-500 bg-maroon-50' : 'border-gray-200 hover:border-maroon-300'}`}>
                  <input type="radio" name="cancel_reason" value={reason} checked={cancelReason === reason}
                    onChange={() => setCancelReason(reason)} className="accent-maroon-700" />
                  <span className="text-sm text-gray-700">{reason}</span>
                </label>
              ))}
            </div>

            {cancelReason === 'Other' && (
              <textarea
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                placeholder="Please describe your reason..."
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-maroon-400 resize-none mb-4"
              />
            )}

            <div className="flex gap-3">
              <button onClick={() => setShowCancelModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors">
                Keep Order
              </button>
              <button onClick={handleCancelConfirm} disabled={cancelling || !cancelReason}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {cancelling ? <><RefreshCw size={14} className="animate-spin" /> Cancelling...</> : <><XCircle size={14} /> Yes, Cancel</>}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto px-4 py-12 animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-64" /><div className="card p-6 h-48 bg-gray-200 rounded" /></div>}>
      <OrderDetailContent />
    </Suspense>
  );
}
