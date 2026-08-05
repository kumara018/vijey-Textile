'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CreditCard, AlertCircle, CheckCircle,
  Lock, Package, ArrowLeft, MapPin, Navigation, Plus, Star, CalendarDays,
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { ordersAPI, addressAPI } from '@/lib/api';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const INDIA_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
  'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
  'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
  'Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Andaman & Nicobar Islands','Chandigarh','Dadra & Nagar Haveli','Daman & Diu',
  'Delhi','Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry',
];

type PayMethod = 'razorpay' | 'emi';
interface Errors { [k: string]: string; }

function FieldErr({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="error-msg mt-1.5"><AlertCircle size={13} />{msg}</p>;
}

declare global {
  interface Window { Razorpay: any; }
}

export default function CheckoutPage() {
  const { items, total, clearCart } = useCart();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Declare state first so useEffect hooks below can reference them
  const [step,    setStep]    = useState<1 | 2 | 3>(1);
  const [placing, setPlacing] = useState(false);
  const [openBox, setOpenBox] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    if (items.length === 0) { router.push('/cart'); return; }
    // Load Razorpay script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, [user, items, authLoading]);

  // Warn user before refresh / tab close while on checkout or during payment
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (items.length === 0) return; // cart already empty — order placed, no need to warn
      const msg = placing
        ? '⚠️ Your payment is being processed! Leaving now may cause issues.'
        : 'You are in the middle of checkout. Your order has not been placed yet.';
      e.preventDefault();
      e.returnValue = msg;
      return msg;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [items.length, placing]);

  // Saved addresses
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [selectedAddrId, setSelectedAddrId] = useState<number | null>(null);
  const [showNewAddrForm, setShowNewAddrForm] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    addressAPI.getAll().then(res => {
      const addrs = res.data || [];
      setSavedAddresses(addrs);
      const def = addrs.find((a: any) => a.is_default);
      if (def) {
        setSelectedAddrId(def.id);
        setAddr({
          full_name:     def.full_name,
          phone:         def.phone,
          address_line1: def.address_line1,
          address_line2: def.address_line2 || '',
          city:          def.city,
          state:         def.state,
          pincode:       def.pincode,
        });
      } else if (addrs.length === 0) {
        setShowNewAddrForm(true);
      }
    }).catch(() => setShowNewAddrForm(true));
  }, [user]);

  const [addr, setAddr] = useState({
    full_name:     user?.full_name || '',
    phone:         user?.phone || '',
    address_line1: '',
    address_line2: '',
    city:          '',
    state:         'Tamil Nadu',
    pincode:       '',
  });
  const [addrErrors, setAddrErrors] = useState<Errors>({});
  const [payMethod, setPayMethod] = useState<PayMethod>('razorpay');

  // Use GPS to fill address
  const detectLocation = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=en`
          );
          const data = await res.json();
          const a = data.address || {};
          setAddr(prev => ({
            ...prev,
            address_line1: [a.road, a.neighbourhood, a.suburb].filter(Boolean).join(', ') || prev.address_line1,
            city:  a.city || a.town || a.village || a.county || prev.city,
            state: a.state || prev.state,
            pincode: a.postcode || prev.pincode,
          }));
          toast.success('Location detected!');
        } catch { toast.error('Could not fetch address from location'); }
        finally { setGpsLoading(false); }
      },
      () => { toast.error('Location access denied. Please allow location.'); setGpsLoading(false); },
      { timeout: 10000 }
    );
  };

  const shipping   = 49;
  const grandTotal = total + shipping;

  const setA = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setAddr({ ...addr, [f]: e.target.value });
    setAddrErrors({ ...addrErrors, [f]: '' });
  };

  const validateAddr = (): boolean => {
    const e: Errors = {};
    if (!addr.full_name.trim())      e.full_name     = 'Full name is required';
    if (!addr.phone.trim())          e.phone         = 'Mobile number is required';
    else if (!/^(\+91|91|0)?[6-9]\d{9}$/.test(addr.phone.replace(/\s|-/g,'')))
                                     e.phone         = 'Enter a valid 10-digit Indian mobile number';
    if (!addr.address_line1.trim())  e.address_line1 = 'Street address is required';
    if (!addr.city.trim())           e.city          = 'City is required';
    if (!addr.state)                 e.state         = 'State is required';
    if (!addr.pincode.trim())        e.pincode       = 'Pincode is required';
    else if (!/^\d{6}$/.test(addr.pincode.trim()))
                                     e.pincode       = 'Pincode must be exactly 6 digits';
    setAddrErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleAddrNext = () => {
    if (validateAddr()) setStep(2);
    else toast.error('Please fill all required address fields correctly');
  };

  const handlePayNext = () => setStep(3);

  // ── Finalize the order — only ever called after Razorpay confirms payment ──
  const finalizeOrder = async (method: string, paymentProof: {
    razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string;
  }) => {
    setPlacing(true);
    try {
      const res = await ordersAPI.place({
        shipping_address: {
          full_name:    addr.full_name.trim(),
          phone:        addr.phone.replace(/\s|-/g, ''),
          address_line1: addr.address_line1.trim(),
          address_line2: addr.address_line2.trim() || undefined,
          city:         addr.city.trim(),
          state:        addr.state,
          pincode:      addr.pincode.trim(),
        },
        payment: { method, ...paymentProof },
        open_box_delivery: openBox,
      });
      await clearCart();
      toast.success('Order placed successfully!');
      router.push(`/orders/${res.data.id}?new=1`);
    } catch (err: any) {
      const d = err.response?.data?.detail;
      toast.error(Array.isArray(d) ? d.map((x: any) => x.msg).join('. ') : (d || 'Failed to place order'));
    } finally { setPlacing(false); }
  };

  // ── Razorpay flow (card / net banking / UPI via Razorpay modal) ──
  const openRazorpay = async (isEmi = false) => {
    if (!validateAddr()) { toast.error('Please fill all address fields'); return; }
    setPlacing(true);
    try {
      const orderRes = await api.post('/api/payments/create-order', { amount: grandTotal });
      const { order_id, key_id } = orderRes.data;

      const options: any = {
        key:         key_id,
        amount:      grandTotal * 100,
        currency:    'INR',
        name:        'Vijey Textile',
        description: 'Premium Textile Purchase',
        order_id:    order_id,
        prefill: {
          name:    addr.full_name,
          contact: addr.phone,
          email:   user?.email,
        },
        theme: { color: '#e11d48' },
        handler: async (response: any) => {
          const paymentProof = {
            razorpay_order_id:   response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature:  response.razorpay_signature,
          };
          try {
            await api.post('/api/payments/verify', paymentProof);
            // Order is only ever created after this — the backend independently
            // re-verifies the same signature before writing anything to the DB.
            await finalizeOrder(isEmi ? 'emi' : 'razorpay', paymentProof);
          } catch {
            toast.error('Payment verification failed. Contact support.');
            setPlacing(false);
          }
        },
        modal: { ondismiss: () => { setPlacing(false); toast.error('Payment cancelled'); } },
      };

      // For EMI: open standard Razorpay modal (EMI tab appears automatically inside)
      // No custom config — Razorpay shows EMI for eligible credit cards automatically

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Payment gateway error. Please try again.';
      toast.error(Array.isArray(msg) ? msg.map((x: any) => x.msg).join('. ') : msg);
      setPlacing(false);
    }
  };

  const handleRazorpay = async () => openRazorpay(false);

  const handlePlaceOrder = async () => {
    if (!validateAddr()) {
      toast.error('Please complete all required fields'); return;
    }
    if (payMethod === 'emi') { await openRazorpay(true); return; }
    await handleRazorpay();
  };

  const StepDot = ({ n, label }: { n: number; label: string }) => (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all ${step >= n ? 'bg-maroon-800 border-maroon-800 text-white' : 'border-gray-300 text-gray-400'}`}>
        {step > n ? <CheckCircle size={18} /> : n}
      </div>
      <span className={`text-xs font-medium ${step >= n ? 'text-maroon-800' : 'text-gray-400'}`}>{label}</span>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/cart" className="p-2 hover:bg-maroon-100 rounded-lg"><ArrowLeft size={20} /></Link>
        <h1 className="text-2xl font-bold text-maroon-900">Secure Checkout</h1>
        <Lock size={18} className="text-green-600" />
      </div>

      {/* Steps */}
      <div className="flex items-center justify-center gap-0 mb-8">
        <StepDot n={1} label="Address" />
        <div className={`h-0.5 w-20 sm:w-28 transition-colors ${step >= 2 ? 'bg-maroon-800' : 'bg-gray-200'}`} />
        <StepDot n={2} label="Payment" />
        <div className={`h-0.5 w-20 sm:w-28 transition-colors ${step >= 3 ? 'bg-maroon-800' : 'bg-gray-200'}`} />
        <StepDot n={3} label="Confirm" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">

          {/* ── STEP 1: Address ── */}
          {step === 1 && (
            <div className="card p-6">
              <h2 className="font-bold text-lg text-maroon-900 mb-5 flex items-center gap-2">
                <Package size={20} /> Delivery Address
              </h2>

              {/* Saved addresses */}
              {savedAddresses.length > 0 && (
                <div className="mb-5">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Saved Addresses</p>
                  <div className="space-y-2">
                    {savedAddresses.map((a: any) => (
                      <label key={a.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${selectedAddrId === a.id ? 'border-maroon-700 bg-maroon-50' : 'border-gray-200 hover:border-maroon-300'}`}
                      >
                        <input type="radio" name="saved_addr" className="mt-1 accent-maroon-700"
                          checked={selectedAddrId === a.id}
                          onChange={() => {
                            setSelectedAddrId(a.id);
                            setShowNewAddrForm(false);
                            setAddr({ full_name: a.full_name, phone: a.phone, address_line1: a.address_line1, address_line2: a.address_line2 || '', city: a.city, state: a.state, pincode: a.pincode });
                          }}
                        />
                        <div className="flex-1 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">{a.full_name}</span>
                            {a.label && <span className="text-xs bg-gold-100 text-gold-700 px-2 py-0.5 rounded-full">{a.label}</span>}
                            {a.is_default && <span className="text-xs bg-maroon-100 text-maroon-700 px-2 py-0.5 rounded-full flex items-center gap-1"><Star size={10} /> Default</span>}
                          </div>
                          <p className="text-gray-500 mt-0.5">{a.address_line1}{a.address_line2 ? `, ${a.address_line2}` : ''}, {a.city}, {a.state} – {a.pincode}</p>
                          <p className="text-gray-500">{a.phone}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <button onClick={() => { setShowNewAddrForm(v => !v); setSelectedAddrId(null); }}
                    className="mt-3 flex items-center gap-1.5 text-sm text-maroon-700 font-medium hover:underline">
                    <Plus size={15} /> {showNewAddrForm ? 'Cancel' : 'Add new address'}
                  </button>
                </div>
              )}

              {/* Address form (new or when no saved addresses) */}
              {(showNewAddrForm || savedAddresses.length === 0) && (
              <div className="space-y-4">
                {/* GPS detect button */}
                <button type="button" onClick={detectLocation} disabled={gpsLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-maroon-300 rounded-xl text-maroon-700 text-sm font-medium hover:bg-maroon-50 transition-colors">
                  {gpsLoading
                    ? <><span className="animate-spin h-4 w-4 border-2 border-maroon-600 border-t-transparent rounded-full" /> Detecting location...</>
                    : <><Navigation size={16} /> Use my current location</>}
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Full Name *</label>
                    <input type="text" value={addr.full_name} onChange={setA('full_name')} placeholder="Your full name" className={`input-field ${addrErrors.full_name ? 'input-error' : ''}`} />
                    <FieldErr msg={addrErrors.full_name} />
                  </div>
                  <div>
                    <label className="label">Mobile Number *</label>
                    <input type="tel" value={addr.phone} onChange={setA('phone')} placeholder="+91 98765 43210" className={`input-field ${addrErrors.phone ? 'input-error' : ''}`} maxLength={13} />
                    <FieldErr msg={addrErrors.phone} />
                  </div>
                </div>
                <div>
                  <label className="label">Street Address *</label>
                  <input type="text" value={addr.address_line1} onChange={setA('address_line1')} placeholder="House No, Street, Area" className={`input-field ${addrErrors.address_line1 ? 'input-error' : ''}`} />
                  <FieldErr msg={addrErrors.address_line1} />
                </div>
                <div>
                  <label className="label">Landmark (Optional)</label>
                  <input type="text" value={addr.address_line2} onChange={setA('address_line2')} placeholder="Landmark, Apartment number" className="input-field" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="label">City *</label>
                    <input type="text" value={addr.city} onChange={setA('city')} placeholder="City" className={`input-field ${addrErrors.city ? 'input-error' : ''}`} />
                    <FieldErr msg={addrErrors.city} />
                  </div>
                  <div>
                    <label className="label">State *</label>
                    <select value={addr.state} onChange={setA('state')} className={`input-field ${addrErrors.state ? 'input-error' : ''}`}>
                      <option value="">Select State</option>
                      {INDIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <FieldErr msg={addrErrors.state} />
                  </div>
                  <div>
                    <label className="label">Pincode *</label>
                    <input type="text" value={addr.pincode} onChange={setA('pincode')} placeholder="600001" className={`input-field ${addrErrors.pincode ? 'input-error' : ''}`} maxLength={6} />
                    <FieldErr msg={addrErrors.pincode} />
                  </div>
                </div>
              </div>
              )}
              {/* end new address form */}

              <button onClick={handleAddrNext} className="btn-primary w-full mt-6 py-3 flex items-center justify-center gap-2">
                <MapPin size={18} /> Continue to Payment →
              </button>
            </div>
          )}

          {/* ── STEP 2: Payment ── */}
          {step === 2 && (
            <div className="card p-6">
              <h2 className="font-bold text-lg text-maroon-900 mb-5 flex items-center gap-2">
                <Lock size={20} className="text-green-600" /> Payment Method
                <span className="ml-auto text-xs text-green-600 flex items-center gap-1"><Lock size={11} /> 100% Secure</span>
              </h2>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {([
                  { val: 'razorpay', icon: CreditCard,    label: 'Card / UPI / Net Banking', sub: 'Visa • Master • UPI • Wallets' },
                  { val: 'emi',      icon: CalendarDays,  label: 'Pay in EMI',               sub: 'No-cost EMI available' },
                ] as const).map(({ val, icon: Icon, label, sub }) => (
                  <button key={val} onClick={() => setPayMethod(val)}
                    className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 text-sm font-medium transition-all ${payMethod === val ? 'border-maroon-800 bg-maroon-50 text-maroon-800' : 'border-gray-200 text-gray-600 hover:border-maroon-300'}`}>
                    <Icon size={22} />
                    <span className="text-center leading-tight font-semibold">{label}</span>
                    <span className="text-[10px] text-gray-400">{sub}</span>
                  </button>
                ))}
              </div>

              {/* Razorpay info */}
              {payMethod === 'razorpay' && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                  <p className="font-semibold text-blue-800 flex items-center gap-2"><CreditCard size={16} /> Razorpay Secure Payment</p>
                  <p className="text-sm text-blue-700">You will be redirected to Razorpay's secure payment page. Accepts:</p>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    {['Credit Card','Debit Card','Net Banking','UPI','Wallets','EMI'].map(m => (
                      <span key={m} className="bg-white border border-blue-200 px-2.5 py-1 rounded-full text-blue-700">{m}</span>
                    ))}
                  </div>
                  <p className="text-xs text-blue-500 flex items-center gap-1"><Lock size={11} /> Your card details are handled by Razorpay — never stored on our servers.</p>
                </div>
              )}

              {/* EMI info */}
              {payMethod === 'emi' && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-2">
                  <p className="font-semibold text-purple-800 flex items-center gap-2"><CalendarDays size={16} /> EMI — Pay in Easy Instalments</p>
                  <p className="text-sm text-purple-700">Split your payment into monthly instalments. Available on Credit Cards.</p>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    {['3 months', '6 months', '9 months', '12 months', 'No-cost EMI'].map(m => (
                      <span key={m} className="bg-white border border-purple-200 px-2.5 py-1 rounded-full text-purple-700">{m}</span>
                    ))}
                  </div>
                  {grandTotal < 1000 ? (
                    <div className="bg-maroon-50 border border-orange-200 rounded-lg p-3">
                      <p className="text-xs text-orange-700 font-semibold">⚠️ Your order total is ₹{grandTotal}. EMI requires a minimum order of ₹1,000.</p>
                      <p className="text-xs text-orange-600 mt-1">You can still pay via Card / UPI using the option above.</p>
                    </div>
                  ) : (
                    <p className="text-xs text-purple-500 flex items-center gap-1"><Lock size={11} /> EMI options will appear in the payment screen. Requires a Credit Card.</p>
                  )}
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep(1)} className="btn-secondary flex-1 py-3">← Back</button>
                <button onClick={handlePayNext} className="btn-primary flex-1 py-3 flex items-center justify-center gap-2">
                  <Lock size={16} /> Review Order →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Confirm ── */}
          {step === 3 && (
            <div className="card p-6">
              <h2 className="font-bold text-lg text-maroon-900 mb-5 flex items-center gap-2">
                <CheckCircle size={20} className="text-green-600" /> Review & Place Order
              </h2>

              {/* Address summary */}
              <div className="bg-maroon-50 rounded-xl p-4 mb-4">
                <div className="flex justify-between">
                  <div>
                    <p className="text-xs font-semibold text-maroon-700 uppercase tracking-wide mb-1">Delivering to</p>
                    <p className="font-semibold text-gray-800">{addr.full_name}</p>
                    <p className="text-sm text-gray-600">{addr.address_line1}{addr.address_line2 ? `, ${addr.address_line2}` : ''}</p>
                    <p className="text-sm text-gray-600">{addr.city}, {addr.state} — {addr.pincode}</p>
                    <p className="text-sm text-gray-500">📞 {addr.phone}</p>
                  </div>
                  <button onClick={() => setStep(1)} className="text-sm text-maroon-700 hover:underline font-medium">Edit</button>
                </div>
              </div>

              {/* Payment summary */}
              <div className="bg-maroon-50 rounded-xl p-4 mb-4">
                <div className="flex justify-between">
                  <div>
                    <p className="text-xs font-semibold text-maroon-700 uppercase tracking-wide mb-1">Payment</p>
                    <p className="font-semibold text-gray-800 flex items-center gap-2">
                      {payMethod === 'razorpay' && <><CreditCard size={16} /> Razorpay (Card / Net Banking / UPI)</>}
                      {payMethod === 'emi'      && <><CalendarDays size={16} /> EMI — Pay in Instalments</>}
                    </p>
                  </div>
                  <button onClick={() => setStep(2)} className="text-sm text-maroon-700 hover:underline font-medium">Edit</button>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-3 mb-5">
                <p className="text-xs font-semibold text-maroon-700 uppercase tracking-wide">Items ({items.length})</p>
                {items.map(item => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-maroon-100 flex items-center justify-center text-xl flex-shrink-0">
                      {item.product.category === 'Lehenga' ? '👗' : item.product.category === 'Chudithar' ? '👘' : '👚'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.product.name}</p>
                      <p className="text-xs text-gray-500">Qty: {item.quantity}{item.size ? ` · ${item.size}` : ''}{item.color ? ` · ${item.color}` : ''}</p>
                    </div>
                    <p className="font-semibold text-maroon-900 text-sm">₹{(item.product.price * item.quantity).toLocaleString()}</p>
                  </div>
                ))}
              </div>

              {/* Open Box Delivery option */}
              <label className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl cursor-pointer hover:bg-blue-100 transition-colors mb-4">
                <input type="checkbox" checked={openBox} onChange={e => setOpenBox(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-blue-700 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-blue-900 text-sm">📦 Request Open Box Delivery</p>
                  <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
                    Inspect the package before accepting. If the product is damaged or doesn't match,
                    you can refuse delivery on the spot for a full refund.
                  </p>
                </div>
              </label>

              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="btn-secondary flex-1 py-3">← Back</button>
                <button onClick={handlePlaceOrder} disabled={placing}
                  className="btn-gold flex-1 py-3.5 flex items-center justify-center gap-2 text-base font-bold rounded-xl">
                  {placing
                    ? <><span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> Processing...</>
                    : <><Lock size={18} /> {payMethod === 'razorpay' ? 'Pay with Razorpay' : 'Choose EMI Plan'} · ₹{grandTotal.toLocaleString()}</>
                  }
                </button>
              </div>
              <p className="text-xs text-gray-400 text-center mt-3">By placing this order, you agree to our Terms of Service.</p>
            </div>
          )}
        </div>

        {/* Order Summary sidebar */}
        <div className="lg:col-span-1">
          <div className="card p-5 sticky top-28">
            <h3 className="font-bold text-maroon-900 mb-4">Price Details</h3>
            <div className="space-y-2.5 text-sm">
              {items.map(item => (
                <div key={item.id} className="flex justify-between text-gray-700">
                  <span className="truncate mr-2">{item.product.name} × {item.quantity}</span>
                  <span className="font-medium flex-shrink-0">₹{(item.product.price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
              <div className="border-t border-maroon-200 pt-2.5 flex justify-between text-gray-700">
                <span>Subtotal</span><span className="font-medium">₹{total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span>Shipping</span>
                <span className="font-medium">₹{shipping}</span>
              </div>
              <div className="border-t-2 border-maroon-100 pt-2.5 flex justify-between font-bold text-base">
                <span className="text-maroon-900">Total</span>
                <span className="text-maroon-900">₹{grandTotal.toLocaleString()}</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-maroon-200 space-y-1.5">
              <p className="text-xs text-gray-500 flex items-center gap-1.5"><Lock size={11} className="text-green-500" /> SSL Secured Checkout</p>
              <p className="text-xs text-gray-500">↩️ 7-day easy returns</p>
              <p className="text-xs text-gray-500">✅ 100% Authentic Products</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
