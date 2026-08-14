import Link from 'next/link';
import { FileText } from 'lucide-react';
import { STORE } from '@/lib/config';

export const metadata = {
  title: 'Terms & Conditions — Vijey Textile',
  description: 'Terms and Conditions for shopping at Vijey Textile.',
};

export default function TermsPage() {
  const updated = '21 May 2026';
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
          <FileText size={15} /> Terms & Conditions
        </div>
        <h1 className="text-3xl font-display font-bold text-maroon-900 mb-2">Terms & Conditions</h1>
        <p className="text-gray-500 text-sm">Last updated: {updated}</p>
      </div>

      <div className="card p-8 space-y-8 text-sm text-gray-700 leading-relaxed">

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">1. Acceptance of Terms</h2>
          <p>By accessing and using <strong>vijeytextile.com</strong> ("the Website"), you accept and agree to be bound by these Terms & Conditions. If you do not agree, please do not use our website or services. These terms apply to all visitors, users, and customers of {STORE.name}.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">2. Products & Pricing</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>All product prices are displayed in Indian Rupees (₹) and are inclusive of applicable taxes.</li>
            <li>We reserve the right to change prices at any time without prior notice.</li>
            <li>Product images are for illustrative purposes. Actual colours may vary slightly due to screen settings.</li>
            <li>Product availability is subject to stock. We reserve the right to cancel orders for out-of-stock items.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">3. Orders & Payments</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Orders are confirmed only after successful online payment.</li>
            <li>We accept payments via UPI, Credit/Debit Cards, Net Banking and EMI (via Razorpay). Cash on Delivery is not available.</li>
            <li>We reserve the right to reject or cancel any order at our discretion, with full refund if payment was made.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">4. Shipping & Delivery</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Orders are delivered across India via Delhivery courier service.</li>
            <li>Standard delivery takes 5–7 business days. Delivery times may vary for remote areas.</li>
            <li>A flat shipping fee of ₹{STORE.shippingFee} applies to all orders.</li>
            <li>We are not responsible for delays caused by courier partners, natural disasters, or government actions.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">5. Cancellation, Return & Exchange</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Orders can be <strong>cancelled within 1 hour</strong> of purchase — instant, automatic, no reason required.</li>
            <li>Once delivered, a <strong>return (for refund)</strong> can be requested within <strong>4 hours</strong>, or an <strong>exchange</strong> within <strong>12 hours</strong> — both require a valid reason (size issue or damage) with 2–3 photos as proof, and admin approval.</li>
            <li>Approved returns are refunded via Razorpay to the original payment method once the item is picked up. Exchanges can be swapped for any product of equal or higher value (price difference payable online; no refund for a lower-value choice).</li>
            <li>Certain products marked as <strong>Non-Returnable</strong> are not eligible for return/exchange, except where the item received is genuinely damaged.</li>
            <li>Full details: <Link href="/cancellation" className="text-maroon-700 hover:underline">Cancellation, Return & Exchange Policy</Link>.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">6. User Accounts</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>You must provide accurate information when creating an account.</li>
            <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
            <li>We reserve the right to suspend or terminate accounts that violate these terms.</li>
            <li>You must be at least 18 years old to create an account and make purchases.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">7. Intellectual Property</h2>
          <p>All content on this website including text, images, logos, and design is the property of {STORE.name} and is protected by copyright laws. You may not reproduce, distribute, or use any content without our written permission.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">8. Limitation of Liability</h2>
          <p>{STORE.name} shall not be liable for any indirect, incidental, or consequential damages arising from the use of our website or products. Our maximum liability is limited to the value of the order placed.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">9. Governing Law</h2>
          <p>These Terms & Conditions are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts in <strong>Erode, Tamil Nadu, India</strong>.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">10. Changes to Terms</h2>
          <p>We reserve the right to update these Terms & Conditions at any time. Continued use of the website after changes constitutes acceptance of the updated terms.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">11. Contact Us</h2>
          <div className="mt-2 p-4 bg-maroon-50 rounded-xl text-sm">
            <p className="font-semibold text-gray-800">{STORE.name}</p>
            <p>{STORE.shopNo}, {STORE.area}</p>
            <p>{STORE.city}, {STORE.state} — {STORE.pincode}</p>
            <p>Email: <a href={`mailto:${STORE.supportEmail}`} className="text-maroon-700">{STORE.supportEmail}</a></p>
            <p>Email: <a href={`mailto:${STORE.email2}`} className="text-maroon-700">{STORE.email2}</a></p>
            <p>Phone: <a href={`tel:${STORE.phone1}`} className="text-maroon-700">{STORE.phone1}</a></p>
          </div>
        </section>

      </div>

      <div className="flex gap-3 mt-8 justify-center flex-wrap">
        <Link href="/privacy"      className="text-sm text-maroon-700 hover:underline">Privacy Policy</Link>
        <span className="text-gray-300">|</span>
        <Link href="/cancellation" className="text-sm text-maroon-700 hover:underline">Cancellation, Return & Exchange Policy</Link>
        <span className="text-gray-300">|</span>
        <Link href="/shipping"     className="text-sm text-maroon-700 hover:underline">Shipping Policy</Link>
      </div>
    </div>
  );
}
