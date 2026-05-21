import Link from 'next/link';
import { XCircle, CheckCircle } from 'lucide-react';
import { STORE } from '@/lib/config';

export const metadata = {
  title: 'Cancellation & Refund Policy — Vijey Textile',
  description: 'Cancellation and Refund Policy for Vijey Textile. Learn how to cancel orders and get refunds.',
};

export default function CancellationPage() {
  const updated = '21 May 2026';
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
          <XCircle size={15} /> Cancellation & Refund Policy
        </div>
        <h1 className="text-3xl font-display font-bold text-maroon-900 mb-2">Cancellation & Refund Policy</h1>
        <p className="text-gray-500 text-sm">Last updated: {updated}</p>
      </div>

      <div className="card p-8 space-y-8 text-sm text-gray-700 leading-relaxed">

        {/* Quick Summary */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-green-50 rounded-xl p-4">
            <p className="font-bold text-green-800 mb-2 flex items-center gap-2"><CheckCircle size={16} /> You Can Cancel If</p>
            <ul className="space-y-1 text-green-700 text-xs">
              <li>✓ Order not yet shipped</li>
              <li>✓ Order placed within 24 hours</li>
              <li>✓ Item damaged on delivery</li>
              <li>✓ Wrong item delivered</li>
            </ul>
          </div>
          <div className="bg-red-50 rounded-xl p-4">
            <p className="font-bold text-red-800 mb-2 flex items-center gap-2"><XCircle size={16} /> Cannot Cancel If</p>
            <ul className="space-y-1 text-red-700 text-xs">
              <li>✗ Order already shipped</li>
              <li>✗ Item is Non-Returnable</li>
              <li>✗ Item used or washed</li>
              <li>✗ Tags or packaging removed</li>
            </ul>
          </div>
        </div>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">1. Order Cancellation</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>You can cancel your order from <strong>My Orders</strong> page before it is shipped.</li>
            <li>Once the order is shipped (status: "Shipped" or later), it cannot be cancelled online. Please contact us directly.</li>
            <li>Orders can be cancelled within <strong>24 hours</strong> of placement for any reason.</li>
            <li>After 24 hours, cancellation is subject to order status.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">2. Returns</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>We accept returns within <strong>7 days</strong> from the date of delivery.</li>
            <li>Items must be <strong>unused, unwashed</strong>, with all original tags and packaging intact.</li>
            <li>Products clearly marked as <strong>"Non-Returnable"</strong> on the product page are not eligible for return.</li>
            <li>To initiate a return, go to <strong>My Orders → View Order → Request Return</strong> and upload a photo of the item.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">3. Refund Process</h2>
          <div className="space-y-4">
            <div className="p-4 bg-orange-50 rounded-xl">
              <p className="font-semibold text-gray-800 mb-2">Online Payments (UPI / Card / Net Banking)</p>
              <ul className="list-disc pl-5 space-y-1 text-gray-600">
                <li>Refund is initiated within <strong>2–3 business days</strong> after return approval.</li>
                <li>Amount is credited to the original payment source.</li>
                <li>Bank processing may take an additional <strong>5–7 business days</strong>.</li>
                <li>You will receive email + WhatsApp notifications at each step.</li>
              </ul>
            </div>
            <div className="p-4 bg-blue-50 rounded-xl">
              <p className="font-semibold text-gray-800 mb-2">Cash on Delivery (COD) Orders</p>
              <ul className="list-disc pl-5 space-y-1 text-gray-600">
                <li>Refunds for COD orders are processed via <strong>bank transfer (NEFT/IMPS)</strong>.</li>
                <li>You must provide your bank account details when requesting a return.</li>
                <li>Refund is credited within <strong>5–7 business days</strong> after return is received and inspected.</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">4. Damaged or Wrong Items</h2>
          <p className="mb-2">If you received a damaged or incorrect item:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Report within <strong>48 hours</strong> of delivery with photos.</li>
            <li>Contact us via WhatsApp or email with your order number and photos.</li>
            <li>We will arrange a replacement or full refund at no extra cost.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">5. Non-Refundable Cases</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Items that are used, washed, or damaged after delivery</li>
            <li>Items returned without original tags or packaging</li>
            <li>Items marked as Non-Returnable on the product page</li>
            <li>Returns initiated after the 7-day return window</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">6. Shipping Charges on Returns</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>If the return is due to our error (wrong/damaged item) — we bear the return shipping cost.</li>
            <li>If the return is for any other reason — the customer bears the return shipping cost.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">7. Contact for Cancellations & Refunds</h2>
          <div className="mt-2 p-4 bg-orange-50 rounded-xl text-sm">
            <p className="font-semibold text-gray-800 mb-2">{STORE.name} — Customer Support</p>
            <p>📧 Email: <a href={`mailto:${STORE.supportEmail}`} className="text-maroon-700">{STORE.supportEmail}</a></p>
            <p>📱 WhatsApp: <a href={`https://wa.me/${STORE.whatsapp}`} className="text-maroon-700" target="_blank" rel="noopener noreferrer">{STORE.phone1}</a></p>
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
