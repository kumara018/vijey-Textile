'use client';
import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Package, CheckCircle, Clock, XCircle,
  RefreshCw, AlertCircle, Image as ImageIcon, ShieldCheck,
} from 'lucide-react';
import { returnsAPI } from '@/lib/api';
import { ReturnRequest } from '@/types';
import { useAuth } from '@/context/AuthContext';

const TYPE_INFO = {
  return:   { label: 'Return',   color: 'text-red-700',  bg: 'bg-red-50',  border: 'border-red-200'  },
  exchange: { label: 'Exchange', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
} as const;

const REASON_LABELS: Record<string, string> = {
  size_issue: 'Size Issue',
  damage:     'Damage / Defective Piece',
};

const EXCHANGE_STEPS = [
  { key: 'pending',             label: 'Request Received',    icon: Clock         },
  { key: 'under_review',        label: 'Under Review',        icon: RefreshCw     },
  { key: 'approved',            label: 'Approved',            icon: CheckCircle   },
  { key: 'pickup_scheduled',    label: 'Pickup Scheduled',    icon: Package       },
  { key: 'picked_up',           label: 'Item Picked Up',      icon: Package       },
  { key: 'processing',          label: 'Processing',          icon: RefreshCw     },
  { key: 'replacement_shipped', label: 'Replacement Shipped', icon: Package       },
  { key: 'completed',           label: 'Completed',           icon: CheckCircle   },
];

const RETURN_STEPS = [
  { key: 'pending',             label: 'Request Received',    icon: Clock         },
  { key: 'under_review',        label: 'Under Review',        icon: RefreshCw     },
  { key: 'approved',            label: 'Approved',            icon: CheckCircle   },
  { key: 'pickup_scheduled',    label: 'Pickup Scheduled',    icon: Package       },
  { key: 'picked_up',           label: 'Item Picked Up',      icon: Package       },
  { key: 'refund_initiated',    label: 'Refund Initiated',    icon: RefreshCw     },
  { key: 'refunded',            label: 'Refund Credited',     icon: CheckCircle   },
];

const STATUS_MSG: Record<string, string> = {
  pending:             'We\'ve received your request. Our team will review it within 24 hours.',
  under_review:        'Our team is carefully reviewing your request and the photos you uploaded.',
  approved:            'Great news! Your request has been approved. We will arrange a pickup soon.',
  rejected:            'Unfortunately, your request could not be approved at this time.',
  pickup_scheduled:    'Our courier has been scheduled to pick up the item from your address.',
  picked_up:           'Your item has been picked up.',
  processing:          'Your item is being inspected by our quality team.',
  replacement_shipped: 'Your replacement item has been dispatched and is on its way!',
  refund_initiated:    'Your refund has been initiated with Razorpay and is on its way to your original payment method.',
  refunded:             'Your refund has been credited. It may take 5–7 business days to reflect in your account.',
  completed:            'Your request has been successfully completed. Thank you for your patience!',
};

const STATUS_COLOR: Record<string, string> = {
  pending:             'text-yellow-700 bg-yellow-50 border-yellow-300',
  under_review:        'text-blue-700 bg-blue-50 border-blue-300',
  approved:            'text-green-700 bg-green-50 border-green-300',
  rejected:            'text-red-700 bg-red-50 border-red-300',
  pickup_scheduled:    'text-purple-700 bg-purple-50 border-purple-300',
  picked_up:           'text-cyan-700 bg-cyan-50 border-cyan-300',
  processing:          'text-indigo-700 bg-indigo-50 border-indigo-300',
  replacement_shipped: 'text-purple-700 bg-purple-50 border-purple-300',
  refund_initiated:    'text-amber-700 bg-amber-50 border-amber-300',
  refunded:             'text-green-700 bg-green-50 border-green-300',
  completed:            'text-green-700 bg-green-50 border-green-300',
};

function ReturnDetailContent() {
  const { id } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [rr, setRr]             = useState<ReturnRequest | null>(null);
  const [loading, setLoading]   = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    const load = async () => {
      try {
        const res = await returnsAPI.getOne(Number(id));
        setRr(res.data);
      } catch { router.push('/orders'); } finally { setLoading(false); }
    };
    load();
  }, [id, user, authLoading]);

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-12 animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 rounded w-48" />
      <div className="card p-6 h-40 bg-gray-100 rounded-2xl" />
    </div>
  );

  if (!rr) return null;

  const typeInfo = TYPE_INFO[rr.request_type] || TYPE_INFO.exchange;
  const isRejected = rr.status === 'rejected';
  const steps = rr.request_type === 'return' ? RETURN_STEPS : EXCHANGE_STEPS;
  const activeStepIdx = steps.findIndex(s => s.key === rr.status);
  const progressPct = activeStepIdx < 0 ? 0 : Math.round((activeStepIdx / (steps.length - 1)) * 100);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Return photo" className="max-w-full max-h-full rounded-2xl object-contain" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/orders/${rr.order_id}`} className="p-2 hover:bg-orange-100 rounded-lg">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-maroon-900">{typeInfo.label} Request #{rr.id}</h1>
          <p className="text-sm text-gray-500">Submitted on {new Date(rr.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className={`ml-auto inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${STATUS_COLOR[rr.status] || 'bg-gray-100 text-gray-600 border-gray-300'}`}>
          {rr.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
        </div>
      </div>

      {/* Request type badge */}
      <div className={`flex items-center gap-3 rounded-2xl border p-4 mb-5 ${typeInfo.bg} ${typeInfo.border}`}>
        <div className={`p-2 rounded-xl bg-white border ${typeInfo.border}`}>
          <Package size={20} className={typeInfo.color} />
        </div>
        <div>
          <p className={`font-bold ${typeInfo.color}`}>{typeInfo.label}</p>
          <p className="text-sm text-gray-600">Reason: {REASON_LABELS[rr.reason] || rr.reason}</p>
        </div>
      </div>

      {/* Exchanging into */}
      {rr.new_product && (
        <div className="card p-5 mb-5">
          <h3 className="font-bold text-maroon-900 mb-3">Exchanging Into</h3>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-lg bg-maroon-50 flex items-center justify-center overflow-hidden flex-shrink-0">
              {rr.new_product.images?.[0]
                ? <img src={rr.new_product.images[0]} alt={rr.new_product.name} className="w-full h-full object-cover" />
                : <Package size={22} className="text-gray-300" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{rr.new_product.name}</p>
              <p className="text-xs text-gray-500">{rr.new_size ? `Size ${rr.new_size}` : ''}{rr.new_size && rr.new_color ? ' · ' : ''}{rr.new_color || ''}</p>
            </div>
            <p className="text-sm font-bold text-maroon-800">₹{rr.new_product.price.toLocaleString()}</p>
          </div>
          {rr.price_difference > 0 && (
            <div className="mt-3 pt-3 border-t border-maroon-200 flex justify-between text-sm">
              <span className="text-gray-500">Price difference paid</span>
              <span className="font-semibold text-green-700">₹{rr.price_difference.toLocaleString()} ✓</span>
            </div>
          )}
        </div>
      )}

      {/* Status timeline */}
      {!isRejected && (
        <div className="card p-6 mb-5">
          <h3 className="font-bold text-maroon-900 mb-5">Request Progress</h3>

          {/* Progress bar */}
          <div className="relative mb-6">
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div className="bg-maroon-800 h-1.5 rounded-full transition-all duration-700" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-0">
            {steps.map((step, i) => {
              const done    = activeStepIdx >= i;
              const active  = activeStepIdx === i;
              const Icon    = step.icon;
              return (
                <div key={step.key} className="flex gap-4 relative">
                  {i < steps.length - 1 && (
                    <div className={`absolute left-[15px] top-8 bottom-0 w-0.5 ${done ? 'bg-maroon-300' : 'bg-gray-200'} z-0`} />
                  )}
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center z-10 border-2 transition-all ${
                    active  ? 'bg-maroon-800 border-maroon-800 text-white ring-4 ring-maroon-100' :
                    done    ? 'bg-maroon-700 border-maroon-700 text-white' :
                              'bg-white border-gray-300 text-gray-400'
                  }`}>
                    <Icon size={13} />
                  </div>
                  <div className="pb-5 flex-1">
                    <p className={`text-sm font-semibold ${done ? 'text-maroon-900' : 'text-gray-400'}`}>{step.label}</p>
                    {active && (
                      <p className="text-xs text-gray-500 mt-0.5">{STATUS_MSG[step.key] || ''}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rejected state */}
      {isRejected && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-5 flex items-start gap-4">
          <XCircle size={28} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-800 mb-1">Request Rejected</p>
            <p className="text-sm text-red-600">{STATUS_MSG.rejected}</p>
            {rr.admin_notes && <p className="text-sm text-red-700 mt-2 font-medium">Reason: {rr.admin_notes}</p>}
          </div>
        </div>
      )}

      {/* Current status message card */}
      {!isRejected && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 flex items-start gap-3">
          <AlertCircle size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">{STATUS_MSG[rr.status] || ''}</p>
        </div>
      )}

      {/* Admin notes */}
      {rr.admin_notes && !isRejected && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-5">
          <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wide mb-1">Note from our team</p>
          <p className="text-sm text-yellow-800">{rr.admin_notes}</p>
        </div>
      )}

      {/* Pickup OTP — give this to the courier when they arrive */}
      {rr.status === 'pickup_scheduled' && rr.pickup_otp && (
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-300 rounded-2xl p-6 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck size={22} className="text-orange-700" />
            <h3 className="font-bold text-orange-900">Your Pickup OTP</h3>
          </div>
          <p className="text-sm text-gray-700 mb-4">Our courier is on the way to collect your item! Give this OTP to the pickup agent when they arrive.</p>
          <div className="bg-white border-2 border-orange-300 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Pickup OTP</p>
            <p className="text-5xl font-bold tracking-[0.4em] font-mono text-orange-700">{rr.pickup_otp}</p>
          </div>
          <p className="text-xs text-orange-700 mt-3 font-medium">⚠️ Never share this OTP via phone call or message. Only give it to the agent in person.</p>
        </div>
      )}

      {/* Pickup tracking — only shown once Delhivery has actually confirmed a pickup */}
      {rr.return_awb && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Pickup Tracking</p>
            <p className="text-sm text-teal-800 font-mono">{rr.return_awb}</p>
          </div>
          <a href={rr.return_tracking_url || `https://www.delhivery.com/track/package/${rr.return_awb}`}
            target="_blank" rel="noopener noreferrer"
            className="text-xs font-semibold text-teal-700 hover:text-teal-900 border border-teal-300 hover:border-teal-500 rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap">
            Track Pickup
          </a>
        </div>
      )}

      {/* Replacement shipment tracking — exchange only */}
      {rr.replacement_awb && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">Replacement Shipment</p>
            <p className="text-sm text-purple-800 font-mono">{rr.replacement_awb}</p>
          </div>
          <a href={rr.replacement_tracking_url || `https://www.delhivery.com/track/package/${rr.replacement_awb}`}
            target="_blank" rel="noopener noreferrer"
            className="text-xs font-semibold text-purple-700 hover:text-purple-900 border border-purple-300 hover:border-purple-500 rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap">
            Track Replacement
          </a>
        </div>
      )}

      {/* Refund info */}
      {rr.refund_id && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-5">
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Refund Information</p>
          <p className="text-sm text-green-800">
            {rr.status === 'refunded'
              ? 'Refund credited to your original payment method.'
              : 'Refund initiated — it will be credited within 5–7 business days.'}
          </p>
          <p className="text-xs font-mono text-green-600 mt-1">Refund ID: {rr.refund_id}</p>
        </div>
      )}

      {/* Details card */}
      <div className="card p-5 mb-5">
        <h3 className="font-bold text-maroon-900 mb-4">Request Details</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Request Type</span>
            <span className={`font-semibold ${typeInfo.color}`}>{typeInfo.label}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Reason</span>
            <span className="font-medium text-gray-800">{REASON_LABELS[rr.reason] || rr.reason}</span>
          </div>
          {rr.description && (
            <div>
              <p className="text-gray-500 mb-1">Description</p>
              <p className="text-gray-800 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">{rr.description}</p>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">Submitted</span>
            <span className="text-gray-700">{new Date(rr.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* Photos */}
      {rr.images && rr.images.length > 0 && (
        <div className="card p-5 mb-5">
          <h3 className="font-bold text-maroon-900 mb-3 flex items-center gap-2">
            <ImageIcon size={16} /> Uploaded Photos
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {rr.images.map((url, i) => (
              <button key={i} onClick={() => setLightbox(url)}
                className="aspect-square rounded-xl overflow-hidden border-2 border-maroon-200 hover:border-maroon-400 transition-colors">
                <img src={url} alt={`Return photo ${i+1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">Click a photo to view full size</p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        <Link href={`/orders/${rr.order_id}`}
          className="w-full flex items-center justify-center gap-2 py-3 bg-maroon-800 hover:bg-maroon-900 text-white font-semibold rounded-xl transition-colors">
          <ArrowLeft size={16} /> Back to Order
        </Link>
        <Link href="/orders"
          className="w-full flex items-center justify-center gap-2 py-3 border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium rounded-xl transition-colors text-sm">
          View All Orders
        </Link>
      </div>
    </div>
  );
}

export default function ReturnDetailPage() {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto px-4 py-12 animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="card p-6 h-40 bg-gray-100 rounded-2xl" />
      </div>
    }>
      <ReturnDetailContent />
    </Suspense>
  );
}
