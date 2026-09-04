import PolicyDoc, { type PolicySection } from '@/components/system/PolicyDoc';
import { STORE } from '@/lib/config';

/**
 * Shipping policy.
 *
 * WRITTEN AS POINTS, NOT PARAGRAPHS. Somebody opening this page wants one of
 * four things — how long, how much, where to, how do I follow it — and the
 * previous version answered each of them inside a sentence. Every clause is a
 * list now, each line one fact, so the answer is found by looking rather than
 * by reading.
 *
 * EACH FACT APPEARS ONCE. The old version said "pan-India including remote
 * areas" under Standard delivery and then said it again under Coverage and a
 * third time under Rural addresses; the fee was stated twice and the two
 * statements disagreed. A fact repeated in three places is three places to
 * update and two chances to contradict yourself, which is exactly what
 * happened. So the fee is stated once, coverage once, timelines once.
 *
 * THE WEIGHT CLAIM WAS FALSE AND IS GONE. This page said the cost "is
 * calculated from the parcel's weight and shown at checkout". It is not:
 * `routers/orders.py` sets `shipping_fee = 49.0` outright, and weight appears
 * nowhere in order pricing on either shop. A policy page describing a pricing
 * model the shop does not operate is worse than a vague one, so it now states
 * what is actually charged.
 */

export const metadata = {
  title: 'Shipping Policy — Vijey Textile',
  description:
    `Flat ₹${STORE.shippingFee} shipping across India. Standard 5–7 business days, express 1–3 in select cities, tracked by Delhivery.`,
};

const SECTIONS: PolicySection[] = [
  {
    title: 'What it costs and how long it takes',
    clauses: [
      {
        heading: 'The fee',
        body: (
          <ul>
            <li>
              <strong>Flat ₹{STORE.shippingFee}</strong> on every order, whatever it weighs.
            </li>
            <li>Shown at checkout before you pay.</li>
            <li>Nothing is added afterwards.</li>
          </ul>
        ),
      },
      {
        heading: 'How long',
        body: (
          <ul>
            <li>
              <strong>Standard — 5–7 business days.</strong> Everywhere in India.
            </li>
            <li>
              <strong>Express — 1–3 business days.</strong> Select cities, costs extra, offered at
              checkout when your address qualifies.
            </li>
            <li>Rural and remote addresses add one to two days.</li>
          </ul>
        ),
      },
    ],
  },
  {
    title: 'Where we deliver',
    clauses: [
      {
        heading: 'Coverage',
        body: (
          <ul>
            <li>All 28 states and 8 union territories.</li>
            <li>Tier 1, tier 2 and tier 3 cities.</li>
            <li>Rural and remote addresses.</li>
            <li>Jammu &amp; Kashmir and the North-East, on standard timelines.</li>
          </ul>
        ),
      },
      {
        heading: 'Carried by',
        body: 'Delhivery, on every order.',
      },
    ],
  },
  {
    title: 'After you pay',
    clauses: [
      {
        heading: 'The four steps',
        body: (
          <ol>
            <li>
              <strong>Ordered.</strong> Your bag becomes an order the moment payment succeeds.
            </li>
            <li>
              <strong>Confirmed.</strong> Within 24 hours. If a piece is out of stock we call you
              rather than substituting it.
            </li>
            <li>
              <strong>Dispatched.</strong> Packed at the counter and handed to Delhivery.
            </li>
            <li>
              <strong>Delivered.</strong> To your door, against the code sent to you.
            </li>
          </ol>
        ),
      },
      {
        heading: 'Following it',
        body: (
          <ul>
            <li>Tracking number by SMS and email — sent at dispatch, not before.</li>
            <li>
              Live status under <a href="/orders">My orders</a>, read from Delhivery directly.
            </li>
            <li>The agent&rsquo;s contact is shared on the delivery day.</li>
          </ul>
        ),
      },
    ],
  },
  {
    title: 'How it is packed',
    clauses: [
      {
        heading: 'Every garment',
        body: 'Folded into a protective cover, so it arrives as it left the shop.',
      },
      {
        heading: 'Silk and embroidered pieces',
        body: 'Wrapped individually in tissue and boxed rigid — a heavy zari border does not travel well loose.',
      },
    ],
  },
];

export default function ShippingPage() {
  return (
    <PolicyDoc
      eyebrow="Shipping"
      title="How your order reaches you"
      standfirst={`Flat ₹${STORE.shippingFee} anywhere in India, 5–7 business days, carried by Delhivery.`}
      updated="3 September 2026"
      sections={SECTIONS}
      footnote="If a delivery is late, damaged, or has not moved for days, tell us and we will chase Delhivery ourselves rather than sending you to them."
    />
  );
}
