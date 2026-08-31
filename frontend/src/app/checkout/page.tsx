'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api, { ordersAPI, productsAPI } from '@/lib/api';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { shippingAddressSchema } from '@/lib/schemas';
import { STORE } from '@/lib/config';
import type { Product } from '@/types';
import type { OrderCreatePayload, PaymentDetailsPayload, BuyNowItemPayload } from '@/lib/contracts';
import PageShell from '@/components/system/PageShell';
import toast from 'react-hot-toast';
import PageHeader from '@/components/system/PageHeader';
import { Field } from '@/components/system/Field';
import { ActionButton, ActionLink } from '@/components/system/Action';
import { Announce, Skeleton, SkeletonLine } from '@/components/system/States';
import RouteErrorBoundary from '@/components/resilience/RouteErrorBoundary';
import PaymentOutcome, { type Outcome, isMoneyAtRisk } from './PaymentOutcome';

/**
 * Checkout — the revenue path.
 *
 * RESTRUCTURED. The old page was a three-step wizard: address, then payment,
 * then review. A wizard hides the total behind a step, makes correcting an
 * address a backwards journey, and — worst on a phone — means the customer
 * cannot see what they are paying for at the moment they pay. This is one
 * page: address and payment in the column, the order standing beside them,
 * total always visible.
 *
 * Validation gates the payment, not the scroll. Pressing pay with a bad
 * address does not silently fail: it marks the fields, moves focus to the
 * first one, and says so.
 *
 * EVERY TERMINAL STATE OF THE PAYMENT IS DESIGNED — see PaymentOutcome.
 * D1 was a declined card producing no response at all. The fix is not one
 * banner; it is that "have I been charged?" has four different answers and
 * the customer is owed the right one.
 *
 * ORDERING THAT MATTERS, AND WHY:
 *   1. create-order          — a Razorpay order id
 *   2. Razorpay modal        — the customer pays
 *   3. verify                — signature check, server-side
 *   4. POST /api/orders/     — the order row
 *   5. clearCart             — only after 4 succeeds
 *
 * The cart is cleared LAST, deliberately. If step 4 fails the customer still
 * has their bag, which is the difference between "try again" and "I have lost
 * everything and paid for it".
 *
 * `orderPlacedRef` is set synchronously before clearing, because clearCart()
 * empties `items` and the empty-cart guard would otherwise bounce the
 * customer to /cart in the same tick their order succeeded.
 */

const INDIA_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
  'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
  'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
  'Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Andaman & Nicobar Islands','Chandigarh','Dadra & Nagar Haveli','Daman & Diu',
  'Delhi','Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry',
];

type Addr = {
  full_name: string; phone: string; address_line1: string; address_line2: string;
  city: string; state: string; pincode: string;
};

const EMPTY: Addr = {
  full_name: '', phone: '', address_line1: '', address_line2: '',
  city: '', state: 'Tamil Nadu', pincode: '',
};

declare global {
  interface Window { Razorpay: any }
}

const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;

function CheckoutInner() {
  const { items, total, loading: cartLoading, clearCart } = useCart();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [addr, setAddr] = useState<Addr>(EMPTY);
  const [gpsLoading, setGpsLoading] = useState(false);

  /** Fill the address from the device's position. Nothing is locked after. */
  const detectLocation = () => {
    if (!navigator.geolocation) { toast.error('This browser cannot find your location. Please type the address.'); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=en`,
          );
          if (!res.ok) throw new Error(String(res.status));
          const data = await res.json();
          const a = data.address || {};
          setAddr((prev) => ({
            ...prev,
            address_line1: [a.road, a.neighbourhood, a.suburb].filter(Boolean).join(', ') || prev.address_line1,
            city:    a.city || a.town || a.village || a.county || prev.city,
            state:   a.state || prev.state,
            pincode: a.postcode || prev.pincode,
          }));
          toast.success('Address filled in — please check it');
        } catch {
          toast.error('Found you, but could not turn that into an address. Please type it.');
        } finally { setGpsLoading(false); }
      },
      (err) => {
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? 'Could not read your location. Check that location is on for this browser AND in your device settings, then try again.'
            : err.code === err.POSITION_UNAVAILABLE
            ? 'Your device could not get a location fix. Please type the address instead.'
            : 'Finding your location took too long. Try again, or type the address.',
        );
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 300000 },
    );
  };
  const [errors, setErrors] = useState<Partial<Record<keyof Addr, string>>>({});
  const [openBox, setOpenBox] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const orderPlacedRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const outcomeRef = useRef<HTMLDivElement>(null);

  /**
   * A DIRECT PURCHASE SHOWS ONE PIECE, NOT THE WHOLE BAG.
   *
   * "Buy it now" used to add the piece to the bag and come here, and this page
   * orders everything in the bag and empties it — so buying one frock ordered
   * every piece the customer had saved. The product page now hands the single
   * piece over in sessionStorage instead, and this reads it.
   *
   * Read once into state rather than on every render: sessionStorage is
   * synchronous and would otherwise be hit on each pass, and the value must
   * not change underneath a checkout that is already in progress.
   */
  const [buyNow, setBuyNow] = useState<BuyNowItemPayload | null>(null);
  const [buyNowProduct, setBuyNowProduct] = useState<Product | null>(null);
  const isDirect = buyNow !== null;

  useEffect(() => {
    if (searchParams.get('buy') !== '1') return;
    try {
      const raw = sessionStorage.getItem('buyNow');
      if (!raw) { router.replace('/cart'); return; }
      const parsed = JSON.parse(raw) as BuyNowItemPayload;
      if (!parsed?.product_id) { router.replace('/cart'); return; }
      setBuyNow(parsed);
      productsAPI.getOne(parsed.product_id)
        .then((r) => setBuyNowProduct(r.data))
        .catch(() => router.replace('/cart'));
    } catch {
      router.replace('/cart');
    }
  }, [searchParams, router]);

  const shipping = STORE.shippingFee;
  // The direct purchase is priced from the piece itself; the bag total is
  // irrelevant to it and must not leak in.
  const subtotal = isDirect
    ? (buyNowProduct ? buyNowProduct.price * (buyNow?.quantity ?? 1) : 0)
    : total;
  const grandTotal = subtotal + shipping;

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth/login');
  }, [user, authLoading, router]);

  // Empty bag → back to the bag. Never fires once an order has been placed,
  // and never for a direct purchase, which deliberately has nothing in the bag.
  useEffect(() => {
    if (cartLoading || orderPlacedRef.current || isDirect) return;
    if (searchParams.get('buy') === '1') return;   // still loading the piece
    if (items.length === 0) router.replace('/cart');
  }, [items.length, cartLoading, router, isDirect, searchParams]);

  useEffect(() => {
    if (user) {
      setAddr((a) => ({
        ...a,
        full_name: a.full_name || user.full_name || '',
        phone: a.phone || user.phone || '',
      }));
    }
  }, [user]);

  /**
   * Razorpay's script is the only third-party code on the site, and it is
   * loaded here rather than in the layout so it exists on exactly one route.
   * `scriptReady` gates the pay button — offering payment before the script
   * has parsed is how you get a button that does nothing.
   */
  useEffect(() => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay]');
    if (existing) { setScriptReady(true); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.dataset.razorpay = 'true';
    s.onload = () => setScriptReady(true);
    s.onerror = () => setOutcome({ kind: 'offline' });
    document.body.appendChild(s);
    return () => { s.remove(); };
  }, []);

  // Any outcome is a change of task — move focus so it is not missed.
  useEffect(() => {
    if (outcome) outcomeRef.current?.focus();
  }, [outcome]);

  useEffect(() => {
    if (!announcement) return;
    const t = setTimeout(() => setAnnouncement(''), 1800);
    return () => clearTimeout(t);
  }, [announcement]);

  const set = (k: keyof Addr) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setAddr((a) => ({ ...a, [k]: e.target.value }));
    setErrors((p) => ({ ...p, [k]: '' }));
  };

  /**
   * One source of truth for the address rules: the same Zod schema the rest of
   * the app uses, which mirrors backend/schemas.py:370 field for field
   * including the Indian mobile pattern. When these drifted, the failure
   * surfaced as a 422 AFTER the customer had already been sent to Razorpay —
   * the worst possible moment to discover a validation mismatch.
   */
  const validate = (): boolean => {
    const result = shippingAddressSchema.safeParse(addr);
    if (result.success) { setErrors({}); return true; }
    const e: Partial<Record<keyof Addr, string>> = {};
    for (const issue of result.error.issues) {
      const f = issue.path[0] as keyof Addr;
      if (f && !e[f]) e[f] = issue.message;
    }
    setErrors(e);
    // Focus the first bad field rather than leaving the customer to hunt.
    const first = Object.keys(e)[0];
    const el = formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`);
    el?.focus();
    setAnnouncement('Some delivery details need fixing before you can pay.');
    return false;
  };

  /** Only ever called after Razorpay AND the server have confirmed payment. */
  const finalise = async (proof: Required<Pick<PaymentDetailsPayload,
    'razorpay_order_id' | 'razorpay_payment_id' | 'razorpay_signature'>>) => {
    const payload: OrderCreatePayload = {
      shipping_address: {
        full_name: addr.full_name.trim(),
        phone: addr.phone.replace(/[\s-]/g, ''),
        address_line1: addr.address_line1.trim(),
        address_line2: addr.address_line2.trim() || null,
        city: addr.city.trim(),
        state: addr.state,
        pincode: addr.pincode.trim(),
      },
      payment: { method: 'razorpay', ...proof },
      open_box_delivery: openBox,
      // Present only for a direct purchase. The backend then builds the order
      // from this one piece and leaves the bag exactly as it was.
      ...(buyNow ? { buy_now: buyNow } : {}),
    };

    try {
      const res = await ordersAPI.place(payload);
      // Set BEFORE clearing: clearCart empties items, and the empty-bag guard
      // would otherwise redirect to /cart in the same tick.
      orderPlacedRef.current = true;
      if (isDirect) {
        // Nothing of the bag was ordered, so nothing of it may be cleared.
        sessionStorage.removeItem('buyNow');
      } else {
        await clearCart();
      }
      router.push(`/orders/${res.data.id}?new=1`);
    } catch (err: any) {
      // Money has left the customer's account and there is no order. This is
      // the state that must never be dressed up as "please try again".
      const d = err?.response?.data?.detail;
      setOutcome({
        kind: 'orphaned',
        paymentId: proof.razorpay_payment_id,
        detail: typeof d === 'string' ? d : undefined,
      });
    } finally {
      setPlacing(false);
    }
  };

  const pay = async () => {
    setOutcome(null);
    if (!navigator.onLine) { setOutcome({ kind: 'offline' }); return; }
    if (!validate()) return;
    if (!scriptReady || !window.Razorpay) { setOutcome({ kind: 'offline' }); return; }

    setPlacing(true);
    try {
      const orderRes = await api.post('/api/payments/create-order', { amount: grandTotal });
      const { order_id, key_id } = orderRes.data;

      const rzp = new window.Razorpay({
        key: key_id,
        amount: grandTotal * 100,
        currency: 'INR',
        name: STORE.name,
        description: 'Order',
        order_id,
        prefill: { name: addr.full_name, contact: addr.phone, email: user?.email },
        theme: { color: '#A16207' },
        // Closing the modal is not a failure — say so plainly rather than
        // leaving the page silent, which is what D1 actually was.
        modal: {
          ondismiss: () => {
            setPlacing(false);
            setOutcome({ kind: 'dismissed' });
          },
        },
        handler: async (response: any) => {
          const proof = {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          };
          try {
            await api.post('/api/payments/verify', proof);
          } catch {
            // The charge may have succeeded; we simply cannot prove it.
            // Retrying here risks charging twice, so it is not offered.
            setPlacing(false);
            setOutcome({ kind: 'unverified', paymentId: proof.razorpay_payment_id });
            return;
          }
          await finalise(proof);
        },
      });

      /**
       * The declined-card path. Razorpay fires this event rather than
       * rejecting the handler, which is precisely why it was missed: the modal
       * closes and, without a listener, nothing at all happens.
       */
      rzp.on('payment.failed', (resp: {
        error?: { description?: string; reason?: string; metadata?: { payment_id?: string } };
      }) => {
        const e = resp?.error ?? {};
        setPlacing(false);
        setOutcome({
          kind: 'declined',
          description: e.description || 'The payment could not be completed.',
          reason: e.reason,
          paymentId: e.metadata?.payment_id,
        });
      });

      rzp.open();
    } catch {
      setPlacing(false);
      setOutcome({ kind: 'offline' });
    }
  };

  if (authLoading || !user) return null;

  if (cartLoading) {
    return (
      <PageShell rhythm="tight">
        <PageHeader eyebrow="Checkout" title="Where it goes, and how you pay" scale="doc" />
        <Skeleton label="Loading checkout">
          <div className="grid gap-x-16 gap-y-10 lg:grid-cols-12">
            <div className="space-y-7 lg:col-span-7">
              {[0, 1, 2, 3].map((i) => <SkeletonLine key={i} w="w-full" h="h-10" />)}
            </div>
            <div className="lg:col-span-4 lg:col-start-9"><SkeletonLine w="w-full" h="h-40" /></div>
          </div>
        </Skeleton>
      </PageShell>
    );
  }

  const atRisk = outcome ? isMoneyAtRisk(outcome) : false;

  return (
    <PageShell rhythm="tight">
      <PageHeader
        eyebrow="Checkout"
        title="Where it goes, and how you pay"
        standfirst="Payment is handled by Razorpay. We never see your card details."
        scale="doc"
      />

      <Announce message={announcement} />

      <div className="grid gap-x-16 gap-y-[6vh] lg:grid-cols-12">
        <div className="lg:col-span-7">
          {/* The outcome takes the top of the column when there is one — it is
              the most important thing on the page at that moment. */}
          {outcome && (
            <div ref={outcomeRef} tabIndex={-1} className="mb-[6vh] focus:outline-none">
              <PaymentOutcome outcome={outcome} onRetry={pay} retrying={placing} />
            </div>
          )}

          <form ref={formRef} onSubmit={(e) => { e.preventDefault(); pay(); }} noValidate>
            <section aria-labelledby="delivery-heading">
              <div className="flex items-baseline gap-5">
                <span className="text-rule tabular-nums text-brass-bright">01</span>
                <h2 id="delivery-heading" className="font-display text-doc-head font-normal text-paper">
                  Where it goes
                </h2>
              </div>

              {/**
                * FILL THE ADDRESS FROM THE PHONE, RATHER THAN TYPING IT.
                *
                * Eight fields is the longest piece of work between a customer
                * deciding to buy and actually buying, and on a phone it is all
                * thumb-typing. One tap fills the street, city, state and
                * pincode from the device's own position; the customer still
                * checks and corrects it, which is why nothing is locked.
                *
                * The failure messages say which failure it was. The sister
                * shop reported "Location access denied" for every error
                * including timeouts, so somebody who HAD granted permission
                * was sent to look through browser settings for a problem that
                * was not there. Each code gets its own sentence here.
                */}
              <button
                type="button"
                onClick={detectLocation}
                disabled={gpsLoading}
                className="mt-8 flex w-full items-center justify-center gap-2.5 border border-dashed border-maroon-500 bg-ink-deep/60 py-3 text-caption uppercase text-maroon-800 transition-colors duration-300 hover:bg-ink-deep disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
              >
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
                  <path d="M17.5 2.5 2.5 8.6l6.4 2.5 2.5 6.4 6.1-15Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                </svg>
                {gpsLoading ? 'Finding you…' : 'Use my current location'}
              </button>

              <div className="mt-8 grid gap-7 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Full name" name="full_name" autoComplete="name"
                    value={addr.full_name} onChange={set('full_name')} error={errors.full_name} />
                </div>
                <Field label="Mobile number" name="phone" inputMode="tel" autoComplete="tel"
                  value={addr.phone} onChange={set('phone')} error={errors.phone}
                  hint="We call this number if there is a problem with delivery." />
                <Field label="Pincode" name="pincode" inputMode="numeric" autoComplete="postal-code"
                  maxLength={6} value={addr.pincode} onChange={set('pincode')} error={errors.pincode} />
                <div className="sm:col-span-2">
                  <Field label="Address" name="address_line1" autoComplete="address-line1"
                    value={addr.address_line1} onChange={set('address_line1')} error={errors.address_line1} />
                </div>
                <div className="sm:col-span-2">
                  <Field label="Landmark or apartment (optional)" name="address_line2"
                    autoComplete="address-line2" value={addr.address_line2} onChange={set('address_line2')} />
                </div>
                <Field label="City" name="city" autoComplete="address-level2"
                  value={addr.city} onChange={set('city')} error={errors.city} />
                <div>
                  <label htmlFor="state" className="block text-rule uppercase text-paper-faint">State</label>
                  <select
                    id="state" name="state" value={addr.state} onChange={set('state')}
                    className="mt-2.5 w-full border-b border-ink-edge bg-transparent pb-2.5 text-lg text-paper transition-colors duration-500 motion-reduce:transition-none focus:border-paper-faint focus:outline-none focus-visible:border-brass-bright"
                  >
                    {INDIA_STATES.map((s) => (
                      <option key={s} value={s} className="bg-ink text-paper">{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section aria-labelledby="pay-heading" className="mt-[7vh] border-t border-ink-edge/60 pt-10">
              <div className="flex items-baseline gap-5">
                <span className="text-rule tabular-nums text-brass-bright">02</span>
                <h2 id="pay-heading" className="font-display text-doc-head font-normal text-paper">
                  How you pay
                </h2>
              </div>

              <p className="mt-7 max-w-[54ch] text-lede text-paper-muted">
                Cards, UPI, net banking and EMI, all through Razorpay&rsquo;s own secure window.
                Cash on delivery is not available.
              </p>

              <label className="mt-8 flex cursor-pointer items-start gap-4">
                <input
                  type="checkbox"
                  checked={openBox}
                  onChange={(e) => setOpenBox(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-[#A16207] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
                />
                <span className="text-sm text-paper-muted">
                  <span className="text-paper">Open-box delivery.</span> The agent waits while you
                  check the piece before you accept it.
                </span>
              </label>

              <div className="mt-10">
                <ActionButton tone="primary" type="submit" disabled={placing || !scriptReady || atRisk}>
                  {placing ? 'Opening payment…' : !scriptReady ? 'Preparing…' : `Pay ${money(grandTotal)}`}
                </ActionButton>
                {atRisk && (
                  <p className="mt-4 max-w-[46ch] text-xs text-paper-faint">
                    Paying again is disabled until we have checked the payment above — we do not
                    want to take your money twice.
                  </p>
                )}
              </div>
            </section>
          </form>
        </div>

        {/* ── What you are paying for, always visible ─────────────────── */}
        <aside aria-labelledby="order-heading" className="lg:col-span-4 lg:col-start-9">
          <div className="border-t border-ink-edge/60 pt-8 lg:sticky lg:top-28">
            <h2 id="order-heading" className="text-rule uppercase text-paper-faint">Your order</h2>

            {/* A direct purchase lists the ONE piece being bought. Showing the
                bag here would be worse than the bug it replaces: the customer
                would see items they are not paying for. */}
            {isDirect ? (
              <ul className="mt-7 space-y-5">
                <li className="flex justify-between gap-5 text-sm">
                  <span className="min-w-0 text-paper-muted">
                    {buyNowProduct ? (
                      <Link href={`/products/${buyNowProduct.id}`} className="text-paper underline-offset-4 hover:underline">
                        {buyNowProduct.name}
                      </Link>
                    ) : (
                      <span className="text-paper">Loading…</span>
                    )}
                    <span className="mt-0.5 block text-xs text-paper-faint">
                      {[buyNow?.size && `Size ${buyNow.size}`, buyNow?.color, `×${buyNow?.quantity ?? 1}`]
                        .filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-paper">
                    {buyNowProduct ? money(buyNowProduct.price * (buyNow?.quantity ?? 1)) : '—'}
                  </span>
                </li>
              </ul>
            ) : (
            <ul className="mt-7 space-y-5">
              {items.map((item) => (
                <li key={item.id} className="flex justify-between gap-5 text-sm">
                  <span className="min-w-0 text-paper-muted">
                    <Link href={`/products/${item.product.id}`} className="text-paper underline-offset-4 hover:underline">
                      {item.product.name}
                    </Link>
                    <span className="mt-0.5 block text-xs text-paper-faint">
                      {[item.size && `Size ${item.size}`, item.color, `×${item.quantity}`]
                        .filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-paper">
                    {money(item.product.price * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            )}

            <dl className="mt-8 space-y-3 border-t border-ink-edge/60 pt-6 text-sm">
              <div className="flex justify-between gap-6">
                <dt className="text-paper-muted">Subtotal</dt>
                <dd className="tabular-nums text-paper">{money(subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-paper-muted">Shipping</dt>
                <dd className="tabular-nums text-paper">{money(shipping)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-6 border-t border-ink-edge/60 pt-4">
                <dt className="text-paper">Total</dt>
                <dd className="font-display text-2xl tabular-nums text-paper">{money(grandTotal)}</dd>
              </div>
            </dl>

            <p className="mt-6 text-xs leading-relaxed text-paper-faint">
              Cancel free within 1 hour.{' '}
              <Link href="/cancellation" className="underline underline-offset-4 hover:text-paper-muted">
                Returns and exchanges
              </Link>
              .
            </p>

            <div className="mt-8">
              <ActionLink href="/cart" tone="quiet" arrow={false}>Edit your bag</ActionLink>
            </div>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}

export default function CheckoutPage() {
  return (
    <RouteErrorBoundary routeName="checkout" fallbackHref="/cart" fallbackLabel="Back to your bag">
      <CheckoutInner />
    </RouteErrorBoundary>
  );
}
