import Link from 'next/link';
import { XCircle, RotateCcw, Repeat, Clock } from 'lucide-react';
import { STORE, WHATSAPP_URL, WHATSAPP_URL2 } from '@/lib/config';

export const metadata = {
  title: 'Cancellation, Return & Exchange Policy — Vijey Textile',
  description: 'Cancel within 1 hour of purchase, return within 4 hours of delivery, or exchange within 12 hours of delivery. Strict, verified, Amazon-style policy for Vijey Textile.',
};

export default function CancellationPage() {
  const updated = '4 August 2026';
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
          <XCircle size={15} /> Cancellation, Return & Exchange Policy
        </div>
        <h1 className="text-3xl font-display font-bold text-maroon-900 mb-2">Cancellation, Return & Exchange Policy</h1>
        <p className="text-gray-500 text-sm">Last updated: {updated}</p>
      </div>

      <div className="card p-8 space-y-8 text-sm text-gray-700 leading-relaxed">

        {/* Quick Summary — 3 windows */}
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="bg-red-50 rounded-xl p-4">
            <p className="font-bold text-red-800 mb-2 flex items-center gap-2"><XCircle size={16} /> Cancel</p>
            <p className="text-red-700 text-xs mb-1">Within <strong>1 hour</strong> of purchase</p>
            <p className="text-red-600 text-xs">Instant, automatic — no reason needed</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="font-bold text-blue-800 mb-2 flex items-center gap-2"><RotateCcw size={16} /> Return</p>
            <p className="text-blue-700 text-xs mb-1">Within <strong>4 hours</strong> of delivery</p>
            <p className="text-blue-600 text-xs">Valid reason + photos, admin-approved</p>
          </div>
          <div className="bg-green-50 rounded-xl p-4">
            <p className="font-bold text-green-800 mb-2 flex items-center gap-2"><Repeat size={16} /> Exchange</p>
            <p className="text-green-700 text-xs mb-1">Within <strong>12 hours</strong> of delivery</p>
            <p className="text-green-600 text-xs">Valid reason + photos, admin-approved</p>
          </div>
        </div>

        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
          <Clock size={15} className="flex-shrink-0 mt-0.5" />
          <p>These windows are tracked automatically from the moment of purchase / delivery and enforced by our system — requests raised after the window has closed cannot be accepted under any circumstances, so please act promptly.</p>
        </div>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">1. Order Cancellation — within 1 hour of purchase</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>You can cancel an order yourself from <strong>My Orders</strong> up to <strong>1 hour</strong> after placing it — no reason required, no admin approval needed.</li>
            <li>The moment you cancel, your order status updates to <strong>Cancelled</strong> automatically and any reserved stock is released.</li>
            <li>If payment was already completed, a refund is <strong>automatically initiated with Razorpay</strong> the instant you cancel — you'll get an email/WhatsApp confirming the refund with the expected credit date.</li>
            <li>After 1 hour, the order has already moved into processing/dispatch and can no longer be cancelled — you can request a <strong>Return</strong> once it's delivered instead.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">2. Return (for Refund) — within 4 hours of delivery</h2>
          <div className="space-y-4">
            <div className="p-4 bg-maroon-50 rounded-xl">
              <p className="font-semibold text-gray-800 mb-2">When can I request a return?</p>
              <ul className="list-disc pl-5 space-y-1 text-gray-600">
                <li>The size doesn't fit, <strong>or</strong></li>
                <li>The item arrived damaged.</li>
              </ul>
              <p className="text-gray-500 text-xs mt-2">These are the only two valid reasons. You'll need to upload 2–3 clear photos of the product as proof — requests without valid proof are rejected.</p>
            </div>
            <div className="p-4 bg-maroon-50 rounded-xl">
              <p className="font-semibold text-gray-800 mb-2">How it works</p>
              <ol className="list-decimal pl-5 space-y-1 text-gray-600">
                <li>Raise a return request within 4 hours of delivery, with photos and a clear reason.</li>
                <li>Our team reviews it — this is <strong>not automatic</strong>; a valid reason and proof are required for approval.</li>
                <li>Once approved, pickup of the item is scheduled with our courier partner.</li>
                <li>The moment pickup is confirmed, a refund is <strong>automatically initiated with Razorpay</strong> to your original payment method.</li>
                <li>You'll receive "Refund Initiated" and "Refund Processed" notifications by email/WhatsApp, each with the expected credit date.</li>
              </ol>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">3. Exchange / Replacement — within 12 hours of delivery</h2>
          <div className="space-y-4">
            <div className="p-4 bg-maroon-50 rounded-xl">
              <p className="font-semibold text-gray-800 mb-2">When can I request an exchange?</p>
              <ul className="list-disc pl-5 space-y-1 text-gray-600">
                <li>The size doesn't fit, <strong>or</strong></li>
                <li>The item arrived damaged.</li>
              </ul>
              <p className="text-gray-500 text-xs mt-2">Same two valid reasons as a return, with 2–3 photos as proof — but instead of a refund, you get a replacement.</p>
            </div>
            <div className="p-4 bg-maroon-50 rounded-xl">
              <p className="font-semibold text-gray-800 mb-2">Choosing your replacement</p>
              <ul className="list-disc pl-5 space-y-1 text-gray-600">
                <li>You are <strong>not limited</strong> to the same product — you can exchange for a different size, colour, or an entirely different product.</li>
                <li>The replacement must cost the <strong>same or more</strong> than your original item. If it costs more, you pay the difference online (via Razorpay) to confirm the exchange.</li>
                <li>You <strong>cannot</strong> choose a cheaper item to receive money back — no refund is issued for any price difference.</li>
                <li>Once approved, we arrange pickup of the original item and ship your replacement after it's verified.</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">4. How to Request a Cancellation, Return or Exchange</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Go to <strong>My Orders → View Order</strong> and choose Cancel, Return or Exchange — only the options still within their time window will be available.</li>
            <li>For Return/Exchange: select the valid reason (size issue or damage), upload 2–3 photos, and (for exchange) pick your replacement product/size/colour.</li>
            <li>Track the status of your request — including admin approval, pickup, and refund/replacement — directly from the order page.</li>
            <li>You will receive email and WhatsApp updates at every step.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">5. Not Eligible</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Cancellation requests raised more than 1 hour after purchase.</li>
            <li>Return or exchange requests raised after their respective window (4 hours / 12 hours from delivery) has closed.</li>
            <li>Reasons other than a genuine size issue or damage — change of mind is not a valid reason.</li>
            <li>Requests without the required photo proof, or with photos that don't support the stated reason.</li>
            <li>Items that are used, washed, or damaged after delivery (i.e. not damaged on arrival).</li>
            <li>Items marked <strong>Non-Returnable</strong> on the product page, except where the item received is genuinely damaged.</li>
            <li>Choosing a cheaper replacement product on an exchange in order to receive a refund of the difference.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">6. Shipping Charges</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>For a genuine size issue, damage, or our error — we bear the pickup and forward shipping cost for the return/replacement.</li>
            <li>Cancellations before dispatch involve no shipping charge at all.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">7. Contact for Cancellation, Return & Exchange</h2>
          <div className="mt-2 p-4 bg-maroon-50 rounded-xl text-sm">
            <p className="font-semibold text-gray-800 mb-2">{STORE.name} — Customer Support</p>
            <p>📧 Email: <a href={`mailto:${STORE.supportEmail}`} className="text-maroon-700">{STORE.supportEmail}</a></p>
            <p>📱 WhatsApp: <a href={WHATSAPP_URL} className="text-maroon-700 font-semibold" target="_blank" rel="noopener noreferrer">{STORE.phone1}</a> / <a href={WHATSAPP_URL2} className="text-maroon-700 font-semibold" target="_blank" rel="noopener noreferrer">{STORE.phone2}</a></p>
            <p>⏰ Support Hours: Mon–Sat, 9:00 AM – 8:00 PM</p>
          </div>
        </section>

      </div>

      <div className="flex gap-3 mt-8 justify-center flex-wrap">
        <Link href="/privacy"  className="text-sm text-maroon-700 hover:underline">Privacy Policy</Link>
        <span className="text-gray-300">|</span>
        <Link href="/terms"    className="text-sm text-maroon-700 hover:underline">Terms & Conditions</Link>
        <span className="text-gray-300">|</span>
        <Link href="/shipping" className="text-sm text-maroon-700 hover:underline">Shipping Policy</Link>
      </div>
    </div>
  );
}
