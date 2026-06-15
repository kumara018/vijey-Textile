import Link from 'next/link';
import { XCircle, CheckCircle } from 'lucide-react';
import { STORE, WHATSAPP_URL, WHATSAPP_URL2 } from '@/lib/config';

export const metadata = {
  title: 'Exchange & Replacement Policy — Vijey Textile',
  description: 'Exchange and Replacement Policy for Vijey Textile. We do not offer cancellations, returns or refunds — only exchange/replacement of products.',
};

export default function CancellationPage() {
  const updated = '15 June 2026';
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
          <XCircle size={15} /> Exchange & Replacement Policy
        </div>
        <h1 className="text-3xl font-display font-bold text-maroon-900 mb-2">Exchange & Replacement Policy</h1>
        <p className="text-gray-500 text-sm">Last updated: {updated}</p>
      </div>

      <div className="card p-8 space-y-8 text-sm text-gray-700 leading-relaxed">

        {/* Quick Summary */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-green-50 rounded-xl p-4">
            <p className="font-bold text-green-800 mb-2 flex items-center gap-2"><CheckCircle size={16} /> Eligible for Exchange / Replacement</p>
            <ul className="space-y-1 text-green-700 text-xs">
              <li>✓ Size doesn&apos;t fit</li>
              <li>✓ Item is damaged or defective</li>
              <li>✓ Wrong item delivered</li>
              <li>✓ Stitching / quality issue</li>
              <li>✓ Requested within 7 days of delivery</li>
            </ul>
          </div>
          <div className="bg-red-50 rounded-xl p-4">
            <p className="font-bold text-red-800 mb-2 flex items-center gap-2"><XCircle size={16} /> Not Eligible</p>
            <ul className="space-y-1 text-red-700 text-xs">
              <li>✗ Order cancellation (not available)</li>
              <li>✗ Return for refund (not available)</li>
              <li>✗ Item used or washed</li>
              <li>✗ Tags or packaging removed</li>
              <li>✗ Item marked Non-Returnable</li>
            </ul>
          </div>
        </div>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">1. No Order Cancellation</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Once an order is placed and payment is completed, it <strong>cannot be cancelled</strong> by the customer.</li>
            <li>Please review your size, colour and address carefully before confirming your order.</li>
            <li>If you have a genuine concern right after placing an order, contact us immediately — we will try to help where possible, but cancellation cannot be guaranteed.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">2. No Returns or Refunds</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>We do <strong>not</strong> accept returns, and we do <strong>not</strong> issue refunds for any reason.</li>
            <li>If something is wrong with your order — wrong size, damaged item, defect, wrong item received, or a quality issue — we will <strong>exchange or replace</strong> the product instead of refunding it.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">3. Exchange & Replacement</h2>
          <div className="space-y-4">
            <div className="p-4 bg-orange-50 rounded-xl">
              <p className="font-semibold text-gray-800 mb-2">When can I request an exchange or replacement?</p>
              <ul className="list-disc pl-5 space-y-1 text-gray-600">
                <li>The size doesn&apos;t fit and you need a different size of the <strong>same product</strong>.</li>
                <li>The item arrived damaged, defective, or with a stitching/quality issue.</li>
                <li>You received the wrong item.</li>
              </ul>
            </div>
            <div className="p-4 bg-orange-50 rounded-xl">
              <p className="font-semibold text-gray-800 mb-2">Conditions</p>
              <ul className="list-disc pl-5 space-y-1 text-gray-600">
                <li>Request must be raised within <strong>7 days</strong> of delivery.</li>
                <li>Item must be <strong>unused, unwashed</strong>, with all original tags and packaging intact (this condition does not apply to items reported as damaged/defective on arrival).</li>
                <li>Products marked <strong>"Non-Returnable"</strong> on the product page are not eligible for exchange unless the item received is damaged, defective, or incorrect.</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">4. How to Request an Exchange / Replacement</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Go to <strong>My Orders → View Order → Request Exchange / Replacement</strong>.</li>
            <li>Select the reason (size issue, damaged, defective, wrong item, quality issue, etc.) and upload a photo if applicable.</li>
            <li>Our team will review your request, arrange a pickup of the original item, and ship the replacement once it is verified.</li>
            <li>You will receive email and WhatsApp updates at each step.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">5. Not Eligible for Exchange</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Items that are used, washed, or damaged after delivery</li>
            <li>Items returned without original tags or packaging (unless the item was damaged/defective/wrong on arrival)</li>
            <li>Items marked as Non-Returnable on the product page (except for damaged, defective or wrong items)</li>
            <li>Requests raised after the 7-day window</li>
            <li>Order cancellation or return-for-refund requests of any kind</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">6. Shipping Charges on Exchanges</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>If the exchange is due to our error (wrong, damaged or defective item) — we bear the pickup and shipping cost for the replacement.</li>
            <li>If the exchange is for a size change — the customer bears the return shipping cost; we cover shipping of the replacement.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">7. Contact for Exchange & Replacement</h2>
          <div className="mt-2 p-4 bg-orange-50 rounded-xl text-sm">
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
