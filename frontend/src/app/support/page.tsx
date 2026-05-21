'use client';
import { useState } from 'react';
import { STORE, WHATSAPP_URL, MAIL_URL, CALL_URL } from '@/lib/config';
import Link from 'next/link';
import {
  Phone, Mail, MapPin, Clock, ChevronDown, ChevronUp,
  MessageCircle, Package, RotateCcw, Truck, Shield,
  Ruler, FileText, Lock, HelpCircle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

// ── Size data — Girls' clothing 3 Months to 16 Years ─────────────────────────
const INFANT_SIZES = [
  { size: '3M',   height: '56–62 cm',   chest: '41 cm',  waist: '41 cm' },
  { size: '6M',   height: '62–68 cm',   chest: '43 cm',  waist: '43 cm' },
  { size: '9M',   height: '68–74 cm',   chest: '45 cm',  waist: '44 cm' },
  { size: '12M',  height: '74–80 cm',   chest: '47 cm',  waist: '46 cm' },
  { size: '18M',  height: '80–86 cm',   chest: '49 cm',  waist: '48 cm' },
  { size: '24M',  height: '86–92 cm',   chest: '51 cm',  waist: '50 cm' },
];
const TODDLER_SIZES = [
  { size: '2-3Y',  height: '92–98 cm',    chest: '53 cm',  waist: '52 cm' },
  { size: '3-4Y',  height: '98–104 cm',   chest: '55 cm',  waist: '53 cm' },
  { size: '4-5Y',  height: '104–110 cm',  chest: '57 cm',  waist: '54 cm' },
  { size: '5-6Y',  height: '110–116 cm',  chest: '59 cm',  waist: '55 cm' },
];
const KIDS_SIZES = [
  { size: '6-7Y',   height: '116–122 cm',  chest: '62 cm',  waist: '57 cm' },
  { size: '7-8Y',   height: '122–128 cm',  chest: '64 cm',  waist: '58 cm' },
  { size: '8-9Y',   height: '128–134 cm',  chest: '67 cm',  waist: '60 cm' },
  { size: '9-10Y',  height: '134–140 cm',  chest: '70 cm',  waist: '62 cm' },
  { size: '10-11Y', height: '140–146 cm',  chest: '74 cm',  waist: '64 cm' },
  { size: '11-12Y', height: '146–152 cm',  chest: '78 cm',  waist: '67 cm' },
];
const TEEN_SIZES = [
  { size: '12-13Y', height: '152–158 cm',  chest: '82 cm',  waist: '70 cm' },
  { size: '13-14Y', height: '158–163 cm',  chest: '86 cm',  waist: '73 cm' },
  { size: '14-15Y', height: '163–168 cm',  chest: '90 cm',  waist: '75 cm' },
  { size: '15-16Y', height: '168–173 cm',  chest: '92 cm',  waist: '77 cm' },
];

// ── Accordion component ──────────────────────────────────────────────────────
function Accordion({
  id, title, icon: Icon, children, defaultOpen = false, color = 'maroon',
}: {
  id?: string;
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  color?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div id={id} className="card overflow-hidden mb-4">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors ${open ? 'bg-maroon-50' : 'bg-white hover:bg-gray-50'}`}
      >
        <div className="flex items-center gap-3">
          <span className="p-2 bg-maroon-100 rounded-lg text-maroon-800">
            <Icon size={18} />
          </span>
          <span className="font-bold text-gray-800 text-base">{title}</span>
        </div>
        {open
          ? <ChevronUp size={20} className="text-maroon-700 flex-shrink-0" />
          : <ChevronDown size={20} className="text-gray-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-6 pt-4 border-t border-orange-100 bg-white">
          {children}
        </div>
      )}
    </div>
  );
}

// ── FAQ item ─────────────────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-orange-100 rounded-xl overflow-hidden mb-2">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex justify-between items-start gap-4 px-4 py-3.5 text-left transition-colors ${open ? 'bg-orange-50' : 'bg-white hover:bg-gray-50'}`}
      >
        <span className="font-semibold text-gray-800 text-sm leading-snug">{q}</span>
        {open
          ? <ChevronUp size={17} className="text-maroon-700 flex-shrink-0 mt-0.5" />
          : <ChevronDown size={17} className="text-gray-400 flex-shrink-0 mt-0.5" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-3 text-sm text-gray-600 leading-relaxed border-t border-orange-100 bg-white">
          {a}
        </div>
      )}
    </div>
  );
}

export default function SupportPage() {
  const { user } = useAuth();

  // Rating form state
  // Rating widget removed — ratings are now sent via unique link after each support interaction
  // Admin logs CS interaction → customer receives email/WhatsApp with rating link

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-maroon-50 text-maroon-800 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
          <MessageCircle size={15} /> Customer Support
        </div>
        <h1 className="section-title mb-3">How can we help you?</h1>
        <p className="text-gray-500 max-w-xl mx-auto text-sm">
          Our support team at Vijey Textile is here to help. Reach us through any of the
          channels below, or find quick answers in our policy sections.
        </p>
      </div>

      {/* ── Contact cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        <a href={CALL_URL}
          className="card p-4 text-center hover:shadow-md transition-shadow group">
          <div className="inline-flex p-2.5 bg-blue-50 rounded-xl mb-2 text-blue-700 group-hover:bg-blue-100 transition-colors">
            <Phone size={20} />
          </div>
          <p className="font-bold text-gray-800 text-sm mb-0.5">Call Us</p>
          <p className="text-xs text-gray-600">{STORE.phone1}</p>
          <p className="text-xs text-gray-600">{STORE.phone2}</p>
          <p className="text-xs text-gray-400 mt-1">{STORE.weekdays}</p>
        </a>

        <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
          className="card p-4 text-center hover:shadow-md transition-shadow group">
          <div className="inline-flex p-2.5 bg-green-50 rounded-xl mb-2 text-green-700 group-hover:bg-green-100 transition-colors">
            <MessageCircle size={20} />
          </div>
          <p className="font-bold text-gray-800 text-sm mb-0.5">WhatsApp</p>
          <p className="text-xs text-gray-600">{STORE.phone1}</p>
          <p className="text-xs text-gray-400 mt-1">Chat with us anytime</p>
        </a>

        <a href={MAIL_URL}
          className="card p-4 text-center hover:shadow-md transition-shadow group">
          <div className="inline-flex p-2.5 bg-orange-50 rounded-xl mb-2 text-orange-700 group-hover:bg-orange-100 transition-colors">
            <Mail size={20} />
          </div>
          <p className="font-bold text-gray-800 text-sm mb-0.5">Email Us</p>
          <p className="text-xs text-gray-600 break-all">{STORE.email}</p>
          <p className="text-xs text-gray-400 mt-1">Reply within 24 hours</p>
        </a>

        <a href={STORE.googleMapsUrl} target="_blank" rel="noopener noreferrer"
          className="card p-4 text-center hover:shadow-md transition-shadow group">
          <div className="inline-flex p-2.5 bg-purple-50 rounded-xl mb-2 text-purple-700 group-hover:bg-purple-100 transition-colors">
            <MapPin size={20} />
          </div>
          <p className="font-bold text-gray-800 text-sm mb-0.5">Visit Store</p>
          <p className="text-xs text-gray-600">{STORE.shopNo}</p>
          <p className="text-xs text-gray-600">{STORE.area}</p>
          <p className="text-xs text-gray-400 mt-1">Open in Maps</p>
        </a>
      </div>

      {/* ── Quick links ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        {[
          { icon: Package,   label: 'Track My Order',  href: '/orders'      },
          { icon: RotateCcw, label: 'Return & Refund', href: '#returns'     },
          { icon: Truck,     label: 'Shipping Info',   href: '#shipping'    },
          { icon: Ruler,     label: 'Size Guide',      href: '#size-guide'  },
        ].map(({ icon: Icon, label, href }) => (
          <Link key={label} href={href}
            className="card p-4 flex items-center gap-3 hover:shadow-md hover:border-maroon-200 border-2 border-transparent transition-all">
            <Icon size={18} className="text-maroon-700 flex-shrink-0" />
            <span className="text-sm font-semibold text-gray-700">{label}</span>
          </Link>
        ))}
      </div>

      {/* ── Size Guide ─────────────────────────────────────────────────── */}
      <Accordion id="size-guide" title="Size Guide" icon={Ruler} defaultOpen>
        <p className="text-sm text-gray-500 mb-5">
          Our sizes are based on age and body measurements for girls from 3 months to 16 years.
          Measure height and chest in a relaxed position for the best fit.
        </p>

        {[
          { label: '👶 Infant — 3 Months to 24 Months', rows: INFANT_SIZES },
          { label: '🧒 Toddler — 2 Years to 6 Years',   rows: TODDLER_SIZES },
          { label: '👧 Kids — 6 Years to 12 Years',      rows: KIDS_SIZES },
          { label: '🌸 Teens — 12 Years to 16 Years',    rows: TEEN_SIZES },
        ].map(({ label, rows }) => (
          <div className="mb-5" key={label}>
            <p className="text-xs font-semibold text-maroon-700 uppercase tracking-wide mb-1">{label}</p>
            <div className="overflow-x-auto rounded-xl border border-orange-100">
              <table className="w-full text-sm">
                <thead className="bg-maroon-50">
                  <tr className="text-maroon-800 font-semibold text-xs uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Size</th>
                    <th className="px-4 py-3 text-left">Height</th>
                    <th className="px-4 py-3 text-left">Chest</th>
                    <th className="px-4 py-3 text-left">Waist</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-orange-50">
                  {rows.map((row) => (
                    <tr key={row.size} className="hover:bg-orange-50 transition-colors">
                      <td className="px-4 py-3 font-bold text-maroon-900">{row.size}</td>
                      <td className="px-4 py-3 text-gray-700">{row.height}</td>
                      <td className="px-4 py-3 text-gray-700">{row.chest}</td>
                      <td className="px-4 py-3 text-gray-700">{row.waist}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        <div className="p-4 bg-amber-50 rounded-xl text-xs text-gray-600 border border-amber-100">
          💡 <b>Measurement Tips:</b> Use a soft measuring tape to measure height and chest.
          If your child is between sizes, size up for comfortable room to grow.
          For flowing styles (Lehenga, Frocks), the larger size is always a better choice.
          When in doubt, contact us on WhatsApp — we&apos;ll help you pick the right fit!
        </div>
      </Accordion>

      {/* ── Shipping Policy ────────────────────────────────────────────── */}
      <Accordion id="shipping" title="Shipping Policy" icon={Truck}>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            {
              title: '🚚 Standard Delivery',
              desc:  '5–7 business days across India. A flat ₹49 shipping fee applies to all orders.',
            },
            {
              title: '⚡ Express Delivery',
              desc:  '1–3 business days available in select cities. Additional charges apply based on location. Select at checkout.',
            },
            {
              title: '📦 Packaging',
              desc:  'All items are carefully packed to prevent damage. Delicate fabrics are wrapped in tissue paper for extra protection.',
            },
            {
              title: '🌍 Service Areas',
              desc:  'We deliver across all 28 states and 8 union territories of India. Remote / hilly areas may take 1–2 extra days.',
            },
            {
              title: '📬 Order Processing',
              desc:  'Orders are confirmed and dispatched within 1–2 business days. You will receive an SMS/email with tracking details once shipped.',
            },
            {
              title: '🔍 Order Tracking',
              desc:  'Track your shipment anytime from the "My Orders" section in your account, or use the tracking link sent to your registered email/phone.',
            },
          ].map(({ title, desc }) => (
            <div key={title} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <p className="font-bold text-gray-800 mb-1.5">{title}</p>
              <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </Accordion>

      {/* ── Return & Refund ────────────────────────────────────────────── */}
      <Accordion id="returns" title="Return & Refund Policy" icon={RotateCcw}>
        <div className="grid md:grid-cols-2 gap-6 mb-5">
          <div>
            <h3 className="font-bold text-green-700 mb-3 text-sm">✅ Eligible for Return</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              {[
                'Unused and unwashed items',
                'Items with original tags still attached',
                'Return request within 7 days of delivery',
                'Wrong size or colour received',
                'Defective or damaged items received',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-green-500 font-bold mt-0.5">✓</span> {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-red-700 mb-3 text-sm">❌ NOT Eligible for Return</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              {[
                'Washed or used items',
                'Items without original tags or packaging',
                'Return request after 7 days of delivery',
                'Undergarments or innerwear (hygiene reasons)',
                'Items purchased on final sale / clearance',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-red-500 font-bold mt-0.5">✗</span> {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="p-4 bg-blue-50 rounded-xl text-sm text-gray-700 border border-blue-100 mb-3">
          <b className="text-gray-800">How to Initiate a Return:</b> Go to My Orders → Select the
          order → Tap "Request Return" and follow the steps. Or contact us on WhatsApp at{' '}
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="text-maroon-700 font-medium hover:underline">
            {STORE.phone1}
          </a>{' '}
          and we will guide you through.
        </div>

        <div className="p-4 bg-green-50 rounded-xl text-sm text-gray-700 border border-green-100">
          <b className="text-gray-800">Refund Timeline:</b> Refunds are processed within{' '}
          <b>5–7 business days</b> after we receive and inspect the returned item. Amount is
          credited back to your original payment method (bank account for COD orders).
        </div>
      </Accordion>

      {/* ── Terms & Conditions ─────────────────────────────────────────── */}
      <Accordion id="terms" title="Terms & Conditions" icon={FileText}>
        <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
          <div>
            <b className="text-gray-800">1. Acceptance of Terms</b>
            <p className="mt-1">By accessing or using the Vijey Textile website or placing an order, you agree to be bound by these Terms and Conditions. If you do not agree, please do not use our services.</p>
          </div>
          <div>
            <b className="text-gray-800">2. Use of Service</b>
            <p className="mt-1">You agree to provide accurate, current, and complete information when registering or placing an order. The platform may only be used for lawful personal purchases. Commercial reselling without written consent is prohibited.</p>
          </div>
          <div>
            <b className="text-gray-800">3. Account Responsibility</b>
            <p className="mt-1">You are solely responsible for maintaining the confidentiality of your account credentials. Notify us immediately at <a href={MAIL_URL} className="text-maroon-700 hover:underline">{STORE.email}</a> of any unauthorized access or security breach.</p>
          </div>
          <div>
            <b className="text-gray-800">4. Product Accuracy</b>
            <p className="mt-1">We strive to display accurate product images, colours, and descriptions. Minor colour variations due to different screen settings and lighting are not grounds for return unless the item is significantly different from what was described.</p>
          </div>
          <div>
            <b className="text-gray-800">5. Pricing & Availability</b>
            <p className="mt-1">All prices are in Indian Rupees (INR) and inclusive of applicable GST. Prices and availability are subject to change without prior notice. We reserve the right to cancel orders if a product is unavailable or if the listed price was erroneous.</p>
          </div>
          <div>
            <b className="text-gray-800">6. Intellectual Property</b>
            <p className="mt-1">All content on this website — including logos, images, product descriptions, and design — is the intellectual property of Vijey Textile and may not be reproduced or used without prior written permission.</p>
          </div>
          <div>
            <b className="text-gray-800">7. Governing Law</b>
            <p className="mt-1">These Terms are governed by the laws of India. Any disputes arising shall be subject to the exclusive jurisdiction of courts in Erode, Tamil Nadu.</p>
          </div>
        </div>
      </Accordion>

      {/* ── Privacy Policy ─────────────────────────────────────────────── */}
      <Accordion id="privacy" title="Privacy Policy" icon={Lock}>
        <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
          <div>
            <b className="text-gray-800">Information We Collect</b>
            <p className="mt-1">We collect personal information such as your name, email address, phone number, and delivery address when you register or place an order. We also collect browsing data (pages visited, time spent) to improve our services.</p>
          </div>
          <div>
            <b className="text-gray-800">How We Use Your Information</b>
            <p className="mt-1">Your data is used exclusively for: processing and delivering your orders; providing customer support; sending order updates via SMS/email; improving our website and product offerings. We do not use your data for unrelated marketing without your explicit consent.</p>
          </div>
          <div>
            <b className="text-gray-800">Payment Security</b>
            <p className="mt-1">We do not store payment card details on our servers. All transactions are processed through PCI-DSS compliant payment gateways. Your financial data is fully encrypted end-to-end.</p>
          </div>
          <div>
            <b className="text-gray-800">Data Sharing</b>
            <p className="mt-1">We do not sell, rent, or trade your personal information to third parties. We may share your delivery address with our logistics partners solely for shipping purposes.</p>
          </div>
          <div>
            <b className="text-gray-800">Cookies</b>
            <p className="mt-1">We use cookies to maintain session state, remember your cart, and analyse site usage. You may disable cookies in your browser settings, but some features may not work correctly.</p>
          </div>
          <div>
            <b className="text-gray-800">Data Retention</b>
            <p className="mt-1">We retain your account and order data for as long as your account is active or as required by law. You may request deletion of your account and associated data at any time from Account Settings.</p>
          </div>
          <div>
            <b className="text-gray-800">Your Rights</b>
            <p className="mt-1">You have the right to access, correct, or delete your personal data. To exercise these rights, contact us at <a href={MAIL_URL} className="text-maroon-700 hover:underline">{STORE.supportEmail}</a>.</p>
          </div>
        </div>
      </Accordion>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <Accordion id="faq" title="Frequently Asked Questions" icon={HelpCircle}>
        {[
          {
            q: 'What are your delivery timelines?',
            a: `Standard delivery takes 5–7 business days across India. Express delivery (1–3 days) is available in select cities. A flat ₹49 shipping fee applies to all orders.`,
          },
          {
            q: 'What is your return and refund policy?',
            a: 'We offer a 7-day hassle-free return policy. Items must be unused, unwashed, and in original packaging with tags. Refunds are processed within 5–7 business days after we receive the returned item.',
          },
          {
            q: 'How do I track my order?',
            a: 'Once your order is shipped, you will receive a tracking number via SMS/email. You can also view order status in the "My Orders" section after logging in.',
          },
          {
            q: 'Are the colours accurate in product photos?',
            a: 'We strive for accurate colour representation. However, slight variations may occur due to different screen settings. If the colour is significantly different from what was shown, you can return within 7 days.',
          },
          {
            q: 'How do I choose the right size?',
            a: 'Check the Size Guide above. Our sizes go from 3 Months (infant) to 15-16Y (teens) based on age and body measurements. Measure your child\'s height and chest, then compare with the chart. When in doubt, size up — children grow fast!',
          },
          {
            q: 'Can I change or cancel my order after placing it?',
            a: 'Orders can be cancelled within 24 hours of placement if they are in "Pending" or "Confirmed" status. Go to My Orders → Select the order → Cancel. Once the order is shipped, cancellation is not possible.',
          },
          {
            q: 'Do you offer Cash on Delivery?',
            a: 'Yes! COD is available across India with no extra charges. Please keep the exact amount ready at the time of delivery.',
          },
          {
            q: `What are your store timings?`,
            a: `${STORE.weekdays}. ${STORE.weekend}. Visit us at ${STORE.shopNo}, ${STORE.area}, ${STORE.city}, ${STORE.state}.`,
          },
          {
            q: 'How do I contact customer support?',
            a: `Call or WhatsApp us at ${STORE.phone1} or ${STORE.phone2}. You can also email us at ${STORE.email}. We are available ${STORE.weekdays}.`,
          },
          {
            q: 'What payment methods do you accept?',
            a: 'We accept Credit/Debit Cards (Visa, Mastercard, RuPay), UPI (PhonePe, Google Pay, Paytm, BHIM), and Cash on Delivery. All online transactions are secured with SSL encryption.',
          },
        ].map((faq) => (
          <FaqItem key={faq.q} q={faq.q} a={faq.a} />
        ))}
      </Accordion>

      {/* ── Store Timings card ─────────────────────────────────────────── */}
      <div className="card p-5 mt-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="p-3 bg-maroon-100 rounded-xl text-maroon-800 flex-shrink-0">
          <Clock size={22} />
        </div>
        <div className="flex-1">
          <p className="font-bold text-gray-800 mb-1">Store Timings</p>
          <p className="text-sm text-gray-600">{STORE.weekdays}</p>
          <p className="text-sm text-gray-600">{STORE.weekend}</p>
          <p className="text-xs text-gray-400 mt-1">{STORE.shopNo}, {STORE.area}, {STORE.city} – {STORE.pincode}</p>
        </div>
        <a href={STORE.googleMapsUrl} target="_blank" rel="noopener noreferrer"
          className="btn-primary text-sm flex-shrink-0">
          Open in Maps
        </a>
      </div>

    </div>
  );
}
