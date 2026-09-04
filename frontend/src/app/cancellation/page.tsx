import PolicyDoc, { type PolicySection } from '@/components/system/PolicyDoc';
import { STORE, WHATSAPP_URL, WHATSAPP_URL2 } from '@/lib/config';

/**
 * Cancellation, return and exchange policy.
 *
 * The most consequential document on the site: these windows are enforced in
 * code, and a customer who misreads them loses money. Every figure is
 * reproduced exactly — 1 hour to cancel, 4 hours to return, 12 hours to
 * exchange, all tracked automatically and not extendable — along with the
 * complete not-eligible list, which is the part people most need to have read
 * before they order rather than after.
 *
 * THE THREE WINDOWS LEAD, AS FIGURES. "How long have I got" is the question
 * almost everyone arrives with, and it used to be answered inside a sentence
 * in the standfirst and then again in three section titles. It is a standing
 * table now: the hours set largest, because the hours are what was come for.
 *
 * WRITTEN AS POINTS. Every clause below is a list, one fact per line. A
 * customer deciding whether they still have time does not read a policy, they
 * scan it, and the previous version made them read four sentences to find out
 * that a return needs photographs.
 *
 * EACH FACT APPEARS ONCE. "The size does not fit, or the item arrived damaged"
 * was stated three separate times — under return, under exchange, and again
 * inverted under change-of-mind. It is stated once now, in the one place it
 * governs both. The windows are in the table and not repeated as prose.
 */

export const metadata = {
  title: 'Cancellation, Return & Exchange Policy — Vijey Textile',
  description:
    'Cancel within 1 hour of purchase. Return within 4 hours of delivery, or exchange within 12 hours — both need a size issue or damage, with photos.',
};

const WINDOWS = [
  {
    action: 'Cancel',
    time: '1 hour',
    from: 'from placing the order',
    note: 'You do it yourself. No reason needed, no approval.',
  },
  {
    action: 'Return for refund',
    time: '4 hours',
    from: 'from delivery',
    note: 'Needs a valid reason, photos, and our approval.',
  },
  {
    action: 'Exchange',
    time: '12 hours',
    from: 'from delivery',
    note: 'Same conditions. Swap to anything of equal or greater price.',
  },
];

function Windows() {
  return (
    <div className="grid gap-x-14 gap-y-9 sm:grid-cols-3">
      {WINDOWS.map(({ action, time, from, note }) => (
        <div key={action} className="border-t border-brass/50 pt-5">
          <p className="text-rule uppercase text-brass">{action}</p>
          <p className="mt-4 font-display text-band font-normal leading-none text-paper">{time}</p>
          <p className="mt-2 text-caption uppercase text-paper-faint">{from}</p>
          <p className="mt-4 max-w-[34ch] text-paper-muted">{note}</p>
        </div>
      ))}
    </div>
  );
}

const SECTIONS: PolicySection[] = [
  {
    title: 'The two valid reasons',
    clauses: [
      {
        heading: 'For any return or exchange',
        body: (
          <ul>
            <li>The size does not fit.</li>
            <li>The piece arrived damaged.</li>
          </ul>
        ),
      },
      {
        heading: 'There is no third',
        body: 'Change of mind is not one of them. Cancelling inside the first hour needs no reason at all.',
      },
    ],
  },
  {
    title: 'Cancelling',
    clauses: [
      {
        heading: 'Inside the hour',
        body: (
          <ul>
            <li>
              Do it yourself from <a href="/orders">My orders</a>.
            </li>
            <li>The order becomes Cancelled and the stock is released at once.</li>
            <li>If you had paid, Razorpay refunds you automatically — no request needed.</li>
            <li>Email and WhatsApp confirm it, with the date the money should land.</li>
          </ul>
        ),
      },
      {
        heading: 'After the hour',
        body: 'It has gone into processing and cannot be cancelled. Wait for delivery and raise a return instead.',
      },
    ],
  },
  {
    title: 'Returning for a refund',
    clauses: [
      {
        heading: 'What we need',
        body: (
          <ul>
            <li>The request inside 4 hours of delivery.</li>
            <li>2–3 photographs showing the problem.</li>
          </ul>
        ),
      },
      {
        heading: 'What happens',
        body: (
          <ol>
            <li>We review it — this one is not automatic.</li>
            <li>Approved, we schedule a pickup.</li>
            <li>
              Pickup confirmed, Razorpay refunds your original payment method automatically.
            </li>
            <li>Refund Initiated and Refund Processed both reach you, with credit dates.</li>
          </ol>
        ),
      },
    ],
  },
  {
    title: 'Exchanging',
    clauses: [
      {
        heading: 'What you may swap to',
        body: (
          <ul>
            <li>A different size, a different colour, or a different piece entirely.</li>
            <li>
              It must cost the <strong>same or more</strong>.
            </li>
            <li>Costs more — you pay the difference through Razorpay to confirm it.</li>
            <li>
              Costs less — <strong>not allowed</strong>. No money is refunded on a price difference.
            </li>
          </ul>
        ),
      },
      {
        heading: 'What happens',
        body: 'Approved, we collect the original and send the replacement once it is back and checked.',
      },
    ],
  },
  {
    title: 'Raising a request',
    clauses: [
      {
        heading: 'Where',
        body: (
          <>
            <a href="/orders">My orders</a> → View order → Cancel, Return or Exchange. Only the
            options still inside their window appear.
          </>
        ),
      },
      {
        heading: 'What to attach',
        body: (
          <ul>
            <li>Which of the two reasons applies.</li>
            <li>2–3 photographs.</li>
            <li>For an exchange, the replacement piece, size and colour.</li>
          </ul>
        ),
      },
      {
        heading: 'Following it',
        body: 'Approval, pickup and refund all show on the order page, and each step reaches you by email and WhatsApp.',
      },
    ],
  },
  {
    title: 'What we cannot accept',
    clauses: [
      {
        heading: 'The list',
        body: (
          <ul>
            <li>
              Anything raised after its window has closed. This is enforced automatically and cannot
              be reopened.
            </li>
            <li>Change of mind.</li>
            <li>Photographs that do not show the problem claimed.</li>
            <li>Pieces used, washed, or damaged after delivery.</li>
            <li>
              Anything marked <strong>Non-Returnable</strong> on its product page — unless it
              arrived damaged.
            </li>
            <li>Swapping to a cheaper piece to be paid the difference.</li>
          </ul>
        ),
      },
    ],
  },
  {
    title: 'Who pays the shipping',
    clauses: [
      {
        heading: 'We do',
        body: 'For a genuine size issue, damage, or our mistake — both the pickup and sending the replacement.',
      },
      {
        heading: 'Nobody does',
        body: 'A cancellation before dispatch carries no shipping charge at all.',
      },
    ],
  },
  {
    title: 'Reaching us',
    clauses: [
      {
        heading: 'Email',
        body: <a href={`mailto:${STORE.email}`}>{STORE.email}</a>,
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
      { heading: 'Hours', body: `${STORE.weekdays} · ${STORE.weekend}` },
    ],
  },
];

export default function CancellationPage() {
  return (
    <PolicyDoc
      eyebrow="Cancellation, return & exchange"
      title="How long you have, and what you get"
      standfirst="Once a window closes it cannot be reopened, so act promptly."
      updated="3 September 2026"
      summary={<Windows />}
      sections={SECTIONS}
      footnote="If a piece arrived damaged and you are outside the window because you opened the parcel late, contact us anyway — the policy is firm, but a genuinely damaged garment is a conversation we would rather have than lose you over."
    />
  );
}
