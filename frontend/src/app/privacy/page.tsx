import PolicyDoc, { type PolicySection } from '@/components/system/PolicyDoc';
import { STORE } from '@/lib/config';

/**
 * Privacy policy.
 *
 * THE PROCESSOR LIST WAS WRONG, AND THAT IS WHY THE DATE MOVED.
 *
 * It named SendGrid, which does not send this shop's mail — notifications.py
 * reaches for BREVO_API_KEY first and Brevo is what is configured on the
 * server, so Brevo is the processor that receives a customer's name and email.
 * SendGrid sits behind it as a standby that has not been used.
 *
 * Worse, it did not name Twilio at all, while stating that data is shared
 * "only with the parties below". Twilio receives every customer's phone
 * number, for the SMS and WhatsApp updates this shop sends on every order.
 * A privacy policy that omits a processor holding phone numbers is not a
 * wording problem.
 *
 * So the list is Delhivery, Razorpay, Brevo and Twilio, each with what it
 * actually receives beside it. The data categories, the rights list and the
 * minors clause are legal statements and are reproduced exactly; only their
 * wording is shorter.
 *
 * The date moved because this time the document genuinely changed. Restyling
 * alone would not have justified it.
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
            What <strong>{STORE.name}</strong> collects when you shop at{' '}
            <strong>vijeytextile.com</strong>, what we do with it, and who else sees it.
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
        heading: 'Never sold, never rented',
        body: 'Shared only with these, and only with what each one needs.',
      },
      {
        heading: 'The four',
        body: (
          <ul>
            <li>
              <strong>Delhivery</strong> — delivery. Your name, address and phone number.
            </li>
            <li>
              <strong>Razorpay</strong> — payment. Card and UPI details go straight to them.
            </li>
            <li>
              <strong>Brevo</strong> — order emails. Your name and email address.
            </li>
            <li>
              <strong>Twilio</strong> — SMS and WhatsApp updates. Your phone number.
            </li>
          </ul>
        ),
      },
      {
        heading: 'And the law',
        body: 'Government or legal authorities, where we are required to.',
      },
    ],
  },
  {
    title: 'Security and cookies',
    clauses: [
      {
        heading: 'How we protect it',
        body: 'SSL encryption, secure servers, access controls. No transmission over the internet is 100% secure, and we will not claim otherwise.',
      },
      {
        heading: 'Cookies',
        body: 'To keep you signed in, remember your bag, and count visits. Disable them in your browser and parts of the site stop working.',
      },
    ],
  },
  {
    title: 'Your rights',
    clauses: [
      {
        heading: 'What you can ask for',
        body: (
          <ul>
            <li>See what we hold about you.</li>
            <li>Correct anything wrong.</li>
            <li>Delete your account and its data.</li>
            <li>Opt out of promotional messages.</li>
          </ul>
        ),
      },
      {
        heading: 'How to exercise them',
        body: (
          <>
            Write to <a href={`mailto:${STORE.email}`}>{STORE.email}</a>, or delete the account
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
            <a href={`mailto:${STORE.email}`}>{STORE.email}</a>
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
      standfirst="We need your address to send a parcel and your number to call if something is wrong. That is most of it."
      updated="3 September 2026"
      sections={SECTIONS}
      footnote="If anything here is unclear, ask us rather than guessing — we would rather answer the question than have you agree to something you have not understood."
    />
  );
}
