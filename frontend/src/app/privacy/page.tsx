import PolicyDoc, { type PolicySection } from '@/components/system/PolicyDoc';
import { STORE } from '@/lib/config';

/**
 * Privacy policy.
 *
 * Content carried over clause for clause — the named processors (Delhivery,
 * Razorpay, SendGrid), the data categories, the rights list and the minors
 * clause are all legal statements and are reproduced exactly. Only the
 * presentation changed.
 *
 * The "last updated" date is deliberately unchanged at 21 May 2026: restyling
 * a document does not amend it, and moving the date would tell every reader
 * the terms had changed when they had not.
 */

export const metadata = {
  title: 'Privacy Policy — Vijey Textile',
  description:
    'How Vijey Textile collects, uses and protects your personal information, and who we share it with.',
};

const SECTIONS: PolicySection[] = [
  {
    title: 'Who we are',
    clauses: [
      {
        heading: 'Introduction',
        body: (
          <>
            <strong>{STORE.name}</strong> (“we”, “our”, “us”) is committed to protecting your
            personal information and your right to privacy. This policy explains how we collect,
            use, disclose and safeguard your information when you visit{' '}
            <strong>vijeytextile.com</strong> and make purchases from us.
          </>
        ),
      },
    ],
  },
  {
    title: 'What we collect',
    clauses: [
      {
        heading: 'Personal information',
        body: 'Full name, email address, mobile number and delivery address, when you register or place an order.',
      },
      {
        heading: 'Payment information',
        body: (
          <>
            <strong>We do not store card or UPI details.</strong> Payments are processed securely
            through Razorpay.
          </>
        ),
      },
      {
        heading: 'Order information',
        body: 'Products purchased, order history and delivery details.',
      },
      {
        heading: 'Device information',
        body: 'Browser type, IP address and pages visited, for analytics and security purposes.',
      },
    ],
  },
  {
    title: 'How we use it',
    clauses: [
      {
        heading: 'To fulfil your order',
        body: 'To process and deliver it, and to send confirmations, shipping updates and invoices by email and WhatsApp.',
      },
      {
        heading: 'To help you',
        body: 'To respond to customer support queries.',
      },
      {
        heading: 'Promotional offers',
        body: 'Only with your consent, and you can opt out at any time.',
      },
      {
        heading: 'To run and improve the shop',
        body: 'To improve our website and services, and to comply with legal obligations.',
      },
    ],
  },
  {
    title: 'Who we share it with',
    clauses: [
      {
        heading: 'We do not sell or rent your data',
        body: 'It is shared only with the parties below, and only with what each one needs.',
      },
      {
        heading: 'Delhivery',
        body: 'Our shipping partner, for delivery — your name, address and phone number.',
      },
      { heading: 'Razorpay', body: 'Our payment gateway, for processing payments securely.' },
      { heading: 'SendGrid', body: 'For sending transactional emails.' },
      {
        heading: 'Legal authorities',
        body: 'Government or legal authorities, when required by law.',
      },
    ],
  },
  {
    title: 'Security and cookies',
    clauses: [
      {
        heading: 'How we protect it',
        body: 'We use industry-standard measures including SSL encryption, secure servers and access controls. No method of transmission over the internet is 100% secure, and we will not claim otherwise.',
      },
      {
        heading: 'Cookies',
        body: 'We use cookies and similar technologies to maintain your session, remember your cart and analyse traffic. You can disable them in your browser, though parts of the site will stop working.',
      },
    ],
  },
  {
    title: 'Your rights',
    clauses: [
      {
        heading: 'What you can ask for',
        body: 'Access to the personal data we hold about you; correction of anything inaccurate; deletion of your account and data; and to opt out of promotional communications.',
      },
      {
        heading: 'How to exercise them',
        body: (
          <>
            Write to <a href={`mailto:${STORE.supportEmail}`}>{STORE.supportEmail}</a> or{' '}
            <a href={`mailto:${STORE.email2}`}>{STORE.email2}</a>. You can also delete your account
            yourself from <a href="/account/delete">your account settings</a>.
          </>
        ),
      },
      {
        heading: 'Children’s privacy',
        body: 'Our services are not directed to anyone under 18, and we do not knowingly collect personal information from minors.',
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

export default function PrivacyPage() {
  return (
    <PolicyDoc
      eyebrow="Privacy"
      title="What we know about you, and why"
      standfirst="A family shop needs your address to send a parcel and your number to call if something is wrong. That is most of it. This page sets out the rest precisely."
      updated="21 May 2026"
      sections={SECTIONS}
      footnote="If anything here is unclear, ask us rather than guessing — we would rather answer the question than have you agree to something you have not understood."
    />
  );
}
