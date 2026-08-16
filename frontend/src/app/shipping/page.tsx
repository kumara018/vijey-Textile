import PolicyDoc, { type PolicySection } from '@/components/system/PolicyDoc';
import { STORE } from '@/lib/config';

/**
 * Shipping policy.
 *
 * Every fact here is carried over unchanged from the previous version — the
 * timelines, the flat fee, the coverage list, the tracking channels and the
 * packaging note. Only the presentation is new: the emoji, the maroon gradient
 * banner, the coloured pill and the three-button footer belonged to a design
 * this one replaced.
 */

export const metadata = {
  title: 'Shipping Policy — Vijey Textile',
  description:
    'Standard delivery 5–7 business days across India. Shipping charged based on order weight via Delhivery.',
};

const SECTIONS: PolicySection[] = [
  {
    title: 'Timelines and cost',
    clauses: [
      {
        heading: 'Standard delivery',
        body: (
          <>
            <strong>5–7 business days.</strong> A flat ₹{STORE.shippingFee} shipping fee applies to
            all orders. Available pan-India including remote areas, via Delhivery.
          </>
        ),
      },
      {
        heading: 'Express delivery',
        body: (
          <>
            <strong>1–3 business days,</strong> in select cities, with additional charges. Choose it
            at checkout if it is available for your address.
          </>
        ),
      },
      {
        heading: 'What you are charged',
        body: (
          <>
            The final shipping cost is calculated from the parcel’s weight and shown at checkout
            before you pay. You will never be asked for more after an order is placed.
          </>
        ),
      },
    ],
  },
  {
    title: 'What happens after you order',
    clauses: [
      {
        heading: 'Within 24 hours',
        body: 'We confirm the order and begin processing it. If anything is out of stock we contact you rather than substituting a piece.',
      },
      {
        heading: 'Dispatch',
        body: 'The order is packed and handed to Delhivery. Your tracking number is sent by SMS and email at this point, not before — a number that does not yet resolve is worse than no number.',
      },
      {
        heading: 'In transit',
        body: (
          <>
            Real-time updates come from Delhivery and appear under <a href="/orders">My Orders</a>.
            On the delivery day the agent’s contact details are shared with you.
          </>
        ),
      },
    ],
  },
  {
    title: 'Where we deliver',
    clauses: [
      {
        heading: 'Coverage',
        body: 'All 28 states and 8 union territories. Tier 1, Tier 2 and Tier 3 cities are all served.',
      },
      {
        heading: 'Rural and remote addresses',
        body: 'Delivered, with one to two additional days. Jammu & Kashmir and the North-East are on standard timelines.',
      },
    ],
  },
  {
    title: 'How your order is packed',
    clauses: [
      {
        heading: 'Every garment',
        body: 'Carefully folded and packed in a protective cover, so it arrives in the condition it left the shop in.',
      },
      {
        heading: 'Silk and embroidered pieces',
        body: 'Individually wrapped in tissue paper and placed in a rigid box. A heavy zari border does not travel well loose, and these are pieces people keep.',
      },
    ],
  },
];

export default function ShippingPage() {
  return (
    <PolicyDoc
      eyebrow="Shipping"
      title="How your order reaches you"
      standfirst="We ship across India through Delhivery. This is what that costs, how long it takes, and what happens between placing the order and opening the box."
      updated="16 August 2026"
      sections={SECTIONS}
      footnote="If a delivery is late, damaged, or has not moved for several days, tell us and we will chase it with the courier ourselves rather than sending you to them."
    />
  );
}
