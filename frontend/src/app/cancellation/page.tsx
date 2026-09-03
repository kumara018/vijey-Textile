import PolicyDoc, { type PolicySection } from '@/components/system/PolicyDoc';
import { STORE, WHATSAPP_URL, WHATSAPP_URL2 } from '@/lib/config';

/**
 * Cancellation, return and exchange policy.
 *
 * The most consequential document on the site: these windows are enforced in
 * code, and a customer who misreads them loses money. So every figure is
 * reproduced exactly — 1 hour to cancel, 4 hours to return, 12 hours to
 * exchange, all tracked automatically and not extendable — along with the
 * complete not-eligible list, which is the part people most need to have read
 * before they order rather than after.
 *
 * The one presentational decision that carries real weight: the three windows
 * lead the document as a standing table, because "how long have I got" is the
 * question almost everyone arrives with.
 */

export const metadata = {
  title: 'Cancellation, Return & Exchange Policy — Vijey Textile',
  description:
    'Cancel within 1 hour of purchase. Return within 4 hours of delivery, or exchange within 12 hours — both need a valid reason and photo proof.',
};

const SECTIONS: PolicySection[] = [
  {
    title: 'Cancellation — within 1 hour of purchase',
    clauses: [
      {
        heading: 'You do this yourself',
        body: (
          <>
            Cancel from <a href="/orders">My Orders</a> up to <strong>1 hour</strong> after placing
            the order. No reason required, no admin approval needed.
          </>
        ),
      },
      {
        heading: 'What happens immediately',
        body: 'The order status changes to Cancelled and any reserved stock is released.',
      },
      {
        heading: 'Your money',
        body: 'If payment was completed, a refund is automatically initiated with Razorpay the instant you cancel. You get an email and WhatsApp message confirming it, with the expected credit date.',
      },
      {
        heading: 'After the hour',
        body: 'The order has already moved into processing and dispatch, and cannot be cancelled. You can request a return once it is delivered instead.',
      },
    ],
  },
  {
    title: 'Return for refund — within 4 hours of delivery',
    clauses: [
      {
        heading: 'Valid reasons',
        body: (
          <>
            The size does not fit, <strong>or</strong> the item arrived damaged. Those are the only
            two.
          </>
        ),
      },
      {
        heading: 'What you do',
        body: 'Raise a return request within 4 hours of delivery, with photos and a clear reason.',
      },
      {
        heading: 'This is not automatic',
        body: 'Our team reviews every request. A valid reason and proof are required for approval.',
      },
      {
        heading: 'After approval',
        body: 'Pickup is scheduled with our courier partner. The moment pickup is confirmed, a refund is automatically initiated with Razorpay to your original payment method. You receive “Refund Initiated” and “Refund Processed” notifications, each with the expected credit date.',
      },
    ],
  },
  {
    title: 'Exchange or replacement — within 12 hours of delivery',
    clauses: [
      {
        heading: 'Valid reasons',
        body: 'The same two: the size does not fit, or the item arrived damaged.',
      },
      {
        heading: 'What you may swap to',
        body: (
          <>
            You are <strong>not</strong> limited to the same product — a different size, a different
            colour, or an entirely different piece is fine.
          </>
        ),
      },
      {
        heading: 'The price rule',
        body: (
          <>
            The replacement must cost the <strong>same or more</strong> than your original item. If
            it costs more you pay the difference online through Razorpay to confirm the exchange.
            You <strong>cannot</strong> choose a cheaper item to receive money back — no refund is
            issued for a price difference.
          </>
        ),
      },
      {
        heading: 'How it is handled',
        body: 'Once approved we arrange pickup of the original item, and ship your replacement after it has been verified.',
      },
    ],
  },
  {
    title: 'How to raise a request',
    clauses: [
      {
        heading: 'Where',
        body: (
          <>
            <a href="/orders">My Orders</a> → View Order, then choose Cancel, Return or Exchange.
            Only the options still inside their window are shown.
          </>
        ),
      },
      {
        heading: 'What to provide',
        body: 'For a return or exchange: the valid reason (size issue or damage), 2–3 photos, and — for an exchange — your replacement product, size and colour.',
      },
      {
        heading: 'Following it',
        body: 'Track admin approval, pickup, and refund or replacement from the order page. You also receive email and WhatsApp updates at every step.',
      },
    ],
  },
  {
    title: 'Not eligible',
    clauses: [
      {
        heading: 'Outside the window',
        body: 'Cancellations raised more than 1 hour after purchase, or return and exchange requests raised after their 4-hour and 12-hour windows have closed. These are tracked automatically and enforced by our system — a request raised after the window has closed cannot be accepted under any circumstances.',
      },
      {
        heading: 'Change of mind',
        body: 'Any reason other than a genuine size issue or damage. Change of mind is not a valid reason.',
      },
      {
        heading: 'Proof that does not support the reason',
        body: 'Requests without the required photos, or with photos that do not show the problem stated.',
      },
      {
        heading: 'Condition after delivery',
        body: 'Items that are used, washed, or damaged after delivery — as distinct from damaged on arrival.',
      },
      {
        heading: 'Non-returnable items',
        body: (
          <>
            Anything marked <strong>Non-Returnable</strong> on its product page, except where the
            item received is genuinely damaged.
          </>
        ),
      },
      {
        heading: 'Downgrading on an exchange',
        body: 'Choosing a cheaper replacement in order to be refunded the difference.',
      },
    ],
  },
  {
    title: 'Who pays for shipping',
    clauses: [
      {
        heading: 'A genuine size issue, damage, or our error',
        body: 'We bear the pickup and forward shipping cost for the return or replacement.',
      },
      {
        heading: 'Cancellation before dispatch',
        body: 'No shipping charge at all.',
      },
    ],
  },
  {
    title: 'Contact',
    clauses: [
      {
        heading: 'Email',
        body: (
          <>
            <a href={`mailto:${STORE.supportEmail}`}>{STORE.supportEmail}</a> ·{' '}
            <a href={`mailto:${STORE.email}`}>{STORE.email}</a>
          </>
        ),
      },
      {
        heading: 'WhatsApp',
        body: (
          <>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              {STORE.phone1}
            </a>{' '}
            ·{' '}
            <a href={WHATSAPP_URL2} target="_blank" rel="noopener noreferrer">
              {STORE.phone2}
            </a>
          </>
        ),
      },
      { heading: 'Support hours', body: 'Monday to Saturday, 9:00 AM – 8:00 PM.' },
    ],
  },
];

export default function CancellationPage() {
  return (
    <PolicyDoc
      eyebrow="Cancellation, return & exchange"
      title="How long you have, and what you get"
      standfirst={
        <>
          Three windows, all counted automatically from the moment of purchase or delivery:{' '}
          <strong>1 hour</strong> to cancel, <strong>4 hours</strong> to return for a refund,{' '}
          <strong>12 hours</strong> to exchange. Once a window closes it cannot be reopened, so
          please act promptly.
        </>
      }
      updated="21 May 2026"
      sections={SECTIONS}
      footnote="If a piece arrived damaged and you are outside the window because you opened the parcel late, contact us anyway — the policy is firm, but a genuinely damaged garment is a conversation we would rather have than lose you over."
    />
  );
}
