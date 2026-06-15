import Link from 'next/link';
import { Shield, ChevronRight } from 'lucide-react';
import { STORE } from '@/lib/config';

export const metadata = {
  title: 'Privacy Policy — Vijey Textile',
  description: 'Privacy Policy for Vijey Textile. Learn how we collect, use, and protect your personal information.',
};

export default function PrivacyPage() {
  const updated = '21 May 2026';
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
          <Shield size={15} /> Privacy Policy
        </div>
        <h1 className="text-3xl font-display font-bold text-maroon-900 mb-2">Privacy Policy</h1>
        <p className="text-gray-500 text-sm">Last updated: {updated}</p>
      </div>

      <div className="card p-8 space-y-8 text-sm text-gray-700 leading-relaxed">

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">1. Introduction</h2>
          <p>Welcome to <strong>{STORE.name}</strong> ("we", "our", "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website <strong>vijeytextile.com</strong> and make purchases from us.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">2. Information We Collect</h2>
          <p className="mb-2">We collect the following types of information:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Personal Information:</strong> Full name, email address, mobile number, and delivery address when you register or place an order.</li>
            <li><strong>Payment Information:</strong> We do not store card or UPI details. Payments are processed securely through Razorpay.</li>
            <li><strong>Order Information:</strong> Products purchased, order history, and delivery details.</li>
            <li><strong>Device Information:</strong> Browser type, IP address, and pages visited for analytics and security purposes.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">3. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To process and deliver your orders</li>
            <li>To send order confirmations, shipping updates, and invoices via email and WhatsApp</li>
            <li>To respond to customer support queries</li>
            <li>To send promotional offers (only with your consent)</li>
            <li>To improve our website and services</li>
            <li>To comply with legal obligations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">4. Sharing Your Information</h2>
          <p className="mb-2">We do not sell or rent your personal data. We share your information only with:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Delhivery</strong> — our shipping partner, for order delivery (name, address, phone)</li>
            <li><strong>Razorpay</strong> — our payment gateway, for processing payments securely</li>
            <li><strong>SendGrid</strong> — for sending transactional emails</li>
            <li>Government or legal authorities when required by law</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">5. Data Security</h2>
          <p>We implement industry-standard security measures including SSL encryption, secure servers, and access controls to protect your personal information. However, no method of transmission over the internet is 100% secure.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">6. Cookies</h2>
          <p>We use cookies and similar technologies to maintain your session, remember your cart, and analyse website traffic. You can disable cookies in your browser settings, but this may affect site functionality.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">7. Your Rights</h2>
          <p className="mb-2">You have the right to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your account and data</li>
            <li>Opt out of promotional communications</li>
          </ul>
          <p className="mt-2">To exercise these rights, contact us at <a href={`mailto:${STORE.supportEmail}`} className="text-maroon-700 underline">{STORE.supportEmail}</a>.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">8. Children's Privacy</h2>
          <p>Our services are not directed to individuals under the age of 18. We do not knowingly collect personal information from minors.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">9. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the new policy on this page with an updated date.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">10. Contact Us</h2>
          <p>If you have questions about this Privacy Policy, contact us at:</p>
          <div className="mt-2 p-4 bg-orange-50 rounded-xl text-sm">
            <p className="font-semibold text-gray-800">{STORE.name}</p>
            <p>{STORE.shopNo}, {STORE.area}</p>
            <p>{STORE.city}, {STORE.state} — {STORE.pincode}</p>
            <p>Email: <a href={`mailto:${STORE.supportEmail}`} className="text-maroon-700">{STORE.supportEmail}</a></p>
            <p>Phone: <a href={`tel:${STORE.phone1}`} className="text-maroon-700">{STORE.phone1}</a></p>
          </div>
        </section>

      </div>

      <div className="flex gap-3 mt-8 justify-center flex-wrap">
        <Link href="/terms"        className="text-sm text-maroon-700 hover:underline">Terms & Conditions</Link>
        <span className="text-gray-300">|</span>
        <Link href="/cancellation" className="text-sm text-maroon-700 hover:underline">Exchange & Replacement Policy</Link>
        <span className="text-gray-300">|</span>
        <Link href="/shipping"     className="text-sm text-maroon-700 hover:underline">Shipping Policy</Link>
      </div>
    </div>
  );
}
