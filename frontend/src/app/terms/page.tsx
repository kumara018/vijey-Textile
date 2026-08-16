import Link from 'next/link';
import PolicyDoc, { type PolicySection } from '@/components/system/PolicyDoc';
import { STORE } from '@/lib/config';

/**
 * Terms & conditions.
 *
 * Every clause is reproduced exactly — the cancellation windows (1 hour to
 * cancel, 4 hours to return, 12 hours to exchange), the payment methods, the
 * liability cap, and the Erode jurisdiction are contractual terms and are not
 * mine to reword. Only the presentation changed, and the "last updated" date
 * is unchanged for the same reason as on the privacy page.
 */

export const metadata = {
  title: 'Terms & Conditions — Vijey Textile',
  description:
    'The terms that apply when you shop with Vijey Textile: pricing, orders, delivery, cancellation, accounts and governing law.',
};

const SECTIONS: PolicySection[] = [
  {
    title: 'Acceptance',
    clauses: [
      {
        heading: 'Using this website',
        body: (
          <>
            By accessing and using <strong>vijeytextile.com</strong> (“the Website”) you accept and
            agree to be bound by these Terms &amp; Conditions. If you do not agree, please do not
            use our website or services. These terms apply to all visitors, users and customers of{' '}
            {STORE.name}.
          </>
        ),
      },
    ],
  },
  {
    title: 'Products and pricing',
    clauses: [
      {
        heading: 'Prices',
        body: 'All prices are displayed in Indian Rupees (₹) and are inclusive of applicable taxes. We reserve the right to change prices at any time without prior notice.',
      },
      {
        heading: 'Images',
        body: 'Product images are illustrative. Actual colours may vary slightly with screen settings — a screen cannot show zari or a dyed silk exactly.',
      },
      {
        heading: 'Availability',
        body: 'Availability is subject to stock. We reserve the right to cancel orders for out-of-stock items.',
      },
    ],
  },
  {
    title: 'Orders and payment',
    clauses: [
      { heading: 'Confirmation', body: 'Orders are confirmed only after successful online payment.' },
      {
        heading: 'Accepted methods',
        body: (
          <>
            UPI, credit and debit cards, net banking and EMI, through Razorpay.{' '}
            <strong>Cash on delivery is not available.</strong>
          </>
        ),
      },
      {
        heading: 'Our discretion',
        body: 'We reserve the right to reject or cancel any order at our discretion, with a full refund if payment was made.',
      },
    ],
  },
  {
    title: 'Shipping and delivery',
    clauses: [
      {
        heading: 'Courier and timeline',
        body: `Delivered across India via Delhivery. Standard delivery takes 5–7 business days, and may take longer for remote areas. A flat shipping fee of ₹${STORE.shippingFee} applies to all orders.`,
      },
      {
        heading: 'What we cannot control',
        body: 'We are not responsible for delays caused by courier partners, natural disasters or government actions. We will still chase the courier on your behalf.',
      },
    ],
  },
  {
    title: 'Cancellation, return and exchange',
    clauses: [
      {
        heading: 'Cancelling',
        body: (
          <>
            Orders can be <strong>cancelled within 1 hour</strong> of purchase — instant, automatic,
            no reason required.
          </>
        ),
      },
      {
        heading: 'After delivery',
        body: (
          <>
            A <strong>return (for refund)</strong> can be requested within <strong>4 hours</strong>,
            or an <strong>exchange</strong> within <strong>12 hours</strong>. Both require a valid
            reason (size issue or damage) with 2–3 photos as proof, and admin approval.
          </>
        ),
      },
      {
        heading: 'How each is settled',
        body: 'Approved returns are refunded via Razorpay to the original payment method once the item is picked up. Exchanges can be swapped for any product of equal or higher value — the price difference is payable online, and there is no refund for choosing something cheaper.',
      },
      {
        heading: 'Non-returnable items',
        body: (
          <>
            Certain products are marked <strong>Non-Returnable</strong> and are not eligible for
            return or exchange, except where the item received is genuinely damaged.
          </>
        ),
      },
      {
        heading: 'Full policy',
        body: <Link href="/cancellation">Cancellation, Return &amp; Exchange Policy</Link>,
      },
    ],
  },
  {
    title: 'Your account',
    clauses: [
      {
        heading: 'Accuracy',
        body: 'You must provide accurate information when creating an account, and you are responsible for keeping your credentials confidential.',
      },
      {
        heading: 'Age',
        body: 'You must be at least 18 years old to create an account and make purchases.',
      },
      {
        heading: 'Suspension',
        body: 'We reserve the right to suspend or terminate accounts that violate these terms.',
      },
    ],
  },
  {
    title: 'Intellectual property',
    clauses: [
      {
        heading: 'Ownership',
        body: `All content on this website — text, images, logos and design — is the property of ${STORE.name} and is protected by copyright law. You may not reproduce, distribute or use any of it without our written permission.`,
      },
    ],
  },
  {
    title: 'Liability and law',
    clauses: [
      {
        heading: 'Limitation of liability',
        body: `${STORE.name} shall not be liable for any indirect, incidental or consequential damages arising from the use of our website or products. Our maximum liability is limited to the value of the order placed.`,
      },
      {
        heading: 'Governing law',
        body: (
          <>
            These terms are governed by the laws of India. Any disputes are subject to the exclusive
            jurisdiction of the courts in <strong>Erode, Tamil Nadu, India</strong>.
          </>
        ),
      },
      {
        heading: 'Changes',
        body: 'We may update these terms at any time. Continued use of the website after a change constitutes acceptance of the updated terms.',
      },
    ],
  },
  {
    title: 'Contact',
    clauses: [
      {
        heading: 'Vijey Textile',
        body: (
          <>
            {STORE.shopNo}, {STORE.area}
            <br />
            {STORE.city}, {STORE.state} — {STORE.pincode}
            <br />
            <a href={`mailto:${STORE.supportEmail}`}>{STORE.supportEmail}</a>
            <br />
            <a href={`mailto:${STORE.email2}`}>{STORE.email2}</a>
            <br />
            <a href={`tel:${STORE.phone1}`}>{STORE.phone1}</a>
          </>
        ),
      },
    ],
  },
];

export default function TermsPage() {
  return (
    <PolicyDoc
      eyebrow="Terms"
      title="The terms you are agreeing to"
      standfirst="Written to be read, not to be scrolled past. The parts that most often matter — the cancellation window and what happens after delivery — are in section five."
      updated="21 May 2026"
      sections={SECTIONS}
      footnote="These terms are binding, so if any part of them is not clear, ask before you order rather than after."
    />
  );
}
