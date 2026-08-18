import Link from 'next/link';
import PageShell from '@/components/system/PageShell';
import PageHeader from '@/components/system/PageHeader';
import { ActionLink } from '@/components/system/Action';
import { STORE, WHATSAPP_URL, WHATSAPP_URL2, MAIL_URL, MAIL_URL2 } from '@/lib/config';

/**
 * Support.
 *
 * Two structural decisions, both of which fix real problems rather than
 * restyling them:
 *
 * 1. NO ACCORDIONS. The footer links `#size-guide`, `#shipping` and `#returns`
 *    point into this page, and an anchor that lands on collapsed content is a
 *    bug that has already been fixed here once. Rather than patch the
 *    open-on-hash behaviour again, the collapsing is gone: everything is
 *    visible, the ids still resolve, and the failure mode cannot recur. A
 *    support page is the last place to hide information behind a click.
 *
 * 2. THE POLICIES ARE NOT RESTATED. This page used to carry its own copies of
 *    the shipping, returns, terms and privacy policies, which is the same
 *    duplication problem as the cart's two shipping fees, at document scale:
 *    two sources for one set of legally binding statements, free to drift
 *    apart. Each is now a short summary that links to the canonical document.
 *    The anchor ids are kept so existing footer links still land somewhere
 *    meaningful.
 *
 * What remains here is what exists nowhere else: the size guide, the FAQ, and
 * how to reach a person.
 */

export const metadata = {
  title: 'Support & Size Guide — Vijey Textile',
  description:
    'Size guide for sizes 12–40, frequently asked questions, and how to reach Vijey Textile directly.',
};

const SIZE_GROUPS = [
  {
    label: 'Baby',
    range: 'Sizes 12 to 24',
    rows: [
      { size: '12', chest: '33 cm', waist: '32 cm', hip: '35 cm' },
      { size: '14', chest: '35 cm', waist: '34 cm', hip: '37 cm' },
      { size: '16', chest: '37 cm', waist: '36 cm', hip: '39 cm' },
      { size: '18', chest: '39 cm', waist: '38 cm', hip: '41 cm' },
      { size: '20', chest: '41 cm', waist: '40 cm', hip: '43 cm' },
      { size: '22', chest: '43 cm', waist: '42 cm', hip: '45 cm' },
      { size: '24', chest: '45 cm', waist: '44 cm', hip: '47 cm' },
    ],
  },
  {
    label: 'Kids',
    range: 'Sizes 26 to 32',
    rows: [
      { size: '26', chest: '48 cm', waist: '46 cm', hip: '50 cm' },
      { size: '28', chest: '51 cm', waist: '49 cm', hip: '53 cm' },
      { size: '30', chest: '54 cm', waist: '52 cm', hip: '56 cm' },
      { size: '32', chest: '57 cm', waist: '55 cm', hip: '59 cm' },
    ],
  },
  {
    label: 'Girls',
    range: 'Sizes 34 to 40',
    rows: [
      { size: '34', chest: '61 cm', waist: '58 cm', hip: '63 cm' },
      { size: '36', chest: '65 cm', waist: '62 cm', hip: '67 cm' },
      { size: '38', chest: '69 cm', waist: '66 cm', hip: '71 cm' },
      { size: '40', chest: '73 cm', waist: '70 cm', hip: '75 cm' },
    ],
  },
];

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: 'How do I choose the right size?',
    a: (
      <>
        Measure chest, waist and hip and compare them with the chart above. We use standard
        Indian sizes 12 to 40 — Baby (12–24), Kids (26–32), Girls (34–40). For flowing styles
        like a lehenga or a frock, one size up gives a comfortable fit. When in doubt, size up.
      </>
    ),
  },
  {
    q: 'What are your delivery timelines?',
    a: (
      <>
        Standard delivery takes 5–7 business days across India. Express (1–3 days) is available
        in select cities. A flat ₹{STORE.shippingFee} shipping fee applies to all orders — full
        detail in the <Link href="/shipping">shipping policy</Link>.
      </>
    ),
  },
  {
    q: 'How do I track my order?',
    a: (
      <>
        Once shipped you receive a tracking number by SMS and email, and the status is on your{' '}
        <Link href="/orders">order page</Link> at any time.
      </>
    ),
  },
  {
    q: 'Can I change or cancel my order after placing it?',
    a: (
      <>
        You can cancel it yourself from <Link href="/orders">My Orders</Link> within{' '}
        <strong>1 hour</strong>. After that we begin processing and it cannot be cancelled or
        changed — so please check size, colour and address before confirming. Once delivered, a
        size issue or damage is handled by return (4 hours) or exchange (12 hours).
      </>
    ),
  },
  {
    q: 'Are the colours accurate in product photos?',
    a: (
      <>
        We photograph in natural light and do not enhance the cloth, but screens vary and no
        display renders a dyed silk exactly. If a colour is significantly different from what was
        shown, that counts as a defect and you can request a return or exchange within the usual
        windows.
      </>
    ),
  },
  {
    q: 'Do you offer cash on delivery?',
    a: 'No. We accept online payments only — cards, net banking, UPI and EMI — which keeps checkout faster and the transaction traceable for both of us.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'Credit and debit cards (Visa, Mastercard, RuPay), net banking, UPI (PhonePe, Google Pay, Paytm, BHIM) and EMI. All transactions are secured with SSL encryption and processed by Razorpay — we never see or store your card details.',
  },
  {
    q: 'What are your store timings?',
    a: (
      <>
        {STORE.weekdays}. {STORE.weekend}. You are welcome to visit us at {STORE.shopNo},{' '}
        {STORE.area}, {STORE.city}.
      </>
    ),
  },
];

const POLICY_SUMMARIES = [
  {
    id: 'shipping',
    title: 'Shipping',
    summary:
      'Standard delivery 5–7 business days pan-India via Delhivery, express 1–3 days in select cities. Final shipping is calculated from parcel weight and shown before you pay.',
    href: '/shipping',
    label: 'Read the shipping policy',
  },
  {
    id: 'returns',
    title: 'Cancellation, return & exchange',
    summary:
      'One hour to cancel. Four hours after delivery to return for a refund, twelve to exchange. Both need a genuine size issue or damage, with photos. The windows are enforced automatically and cannot be reopened.',
    href: '/cancellation',
    label: 'Read the full policy',
  },
  {
    id: 'terms',
    title: 'Terms & conditions',
    summary:
      'Pricing, orders, delivery, accounts, liability and governing law. The parts most people need are the cancellation windows in section five.',
    href: '/terms',
    label: 'Read the terms',
  },
  {
    id: 'privacy',
    title: 'Privacy',
    summary:
      'What we collect, why, and the three processors we share it with — Delhivery to deliver, Razorpay to take payment, SendGrid to email you. We never sell your data and we do not store card details.',
    href: '/privacy',
    label: 'Read the privacy policy',
  },
];

export default function SupportPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Support"
        title="Measurements, answers, and a person to call"
        standfirst="Most questions here are about fit. The chart below is measured from actual garments rather than a generic standard, which is why our sizes mean something specific."
      />

      {/* ── Size guide ─────────────────────────────────────────────────── */}
      <section id="size-guide" className="scroll-mt-32 border-t border-ink-edge/60 pt-10">
        <div className="flex items-baseline gap-5">
          <span className="text-rule tabular-nums text-brass-bright">01</span>
          <h2 className="font-display text-band font-light text-paper">Size guide</h2>
        </div>

        <p className="mt-7 max-w-[60ch] text-lede text-paper-muted">
          Standard Indian sizes, 12 to 40. Measure around the fullest part of the chest, the
          natural waist, and the widest part of the hip.
        </p>

        <div className="mt-12 grid gap-x-14 gap-y-12 lg:grid-cols-3">
          {SIZE_GROUPS.map((group) => (
            <div key={group.label}>
              <h3 className="font-display text-2xl font-light text-paper">{group.label}</h3>
              <p className="mt-1 text-rule uppercase text-paper-faint">{group.range}</p>

              {/* Wide content scrolls inside its own container so the page body
                  never scrolls sideways on a narrow phone. */}
              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[20rem] border-collapse text-sm">
                  <caption className="sr-only">
                    {group.label} sizes, {group.range}, with chest, waist and hip measurements
                  </caption>
                  <thead>
                    <tr className="border-b border-ink-edge">
                      {['Size', 'Chest', 'Waist', 'Hip'].map((h) => (
                        <th
                          key={h}
                          scope="col"
                          className="py-3 text-left text-rule uppercase text-paper-faint"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((r) => (
                      <tr key={r.size} className="border-b border-ink-edge/40">
                        <th scope="row" className="py-3 text-left font-normal tabular-nums text-paper">
                          {r.size}
                        </th>
                        <td className="py-3 tabular-nums text-paper-muted">{r.chest}</td>
                        <td className="py-3 tabular-nums text-paper-muted">{r.waist}</td>
                        <td className="py-3 tabular-nums text-paper-muted">{r.hip}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-10 max-w-[60ch] text-lede text-paper-muted">
          Still unsure? Send us the measurements on WhatsApp and we will tell you which size to
          order — we would rather answer first than handle a return afterwards.
        </p>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section id="faq" className="mt-[10vh] scroll-mt-32 border-t border-ink-edge/60 pt-10">
        <div className="flex items-baseline gap-5">
          <span className="text-rule tabular-nums text-brass-bright">02</span>
          <h2 className="font-display text-band font-light text-paper">Common questions</h2>
        </div>

        <dl className="mt-10 grid gap-x-16 gap-y-10 lg:grid-cols-2">
          {FAQS.map((f) => (
            <div key={f.q} className="border-t border-ink-edge/40 pt-6">
              <dt className="font-display text-xl font-light text-paper">{f.q}</dt>
              <dd className="mt-3 max-w-[56ch] text-lede text-paper-muted [&_a]:text-paper [&_a]:underline [&_a]:underline-offset-4 [&_strong]:font-normal [&_strong]:text-paper">
                {f.a}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Policies, summarised and linked ────────────────────────────── */}
      <section className="mt-[10vh] border-t border-ink-edge/60 pt-10">
        <div className="flex items-baseline gap-5">
          <span className="text-rule tabular-nums text-brass-bright">03</span>
          <h2 className="font-display text-band font-light text-paper">The policies</h2>
        </div>

        <p className="mt-7 max-w-[60ch] text-lede text-paper-muted">
          Each of these lives in one place, so what you read here is what applies.
        </p>

        <div className="mt-10 grid gap-x-16 gap-y-10 lg:grid-cols-2">
          {POLICY_SUMMARIES.map((p) => (
            <div key={p.id} id={p.id} className="scroll-mt-32 border-t border-ink-edge/40 pt-6">
              <h3 className="font-display text-xl font-light text-paper">{p.title}</h3>
              <p className="mt-3 max-w-[56ch] text-paper-muted">{p.summary}</p>
              <div className="mt-5">
                <ActionLink href={p.href} tone="quiet">
                  {p.label}
                </ActionLink>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Reach a person ─────────────────────────────────────────────── */}
      <section id="contact" className="mt-[10vh] scroll-mt-32 border-t border-ink-edge/60 pt-10">
        <div className="flex items-baseline gap-5">
          <span className="text-rule tabular-nums text-brass-bright">04</span>
          <h2 className="font-display text-band font-light text-paper">Reach us</h2>
        </div>

        <p className="mt-7 max-w-[60ch] text-lede text-paper-muted">
          A real person answers, {STORE.weekdays.toLowerCase()}.
        </p>

        <dl className="mt-10 grid gap-x-14 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-rule uppercase text-paper-faint">Call</dt>
            <dd className="mt-3 space-y-1">
              <a href={`tel:${STORE.phone1}`} className="block text-paper-muted underline underline-offset-4 transition-colors duration-500 hover:text-paper motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright">
                {STORE.phone1}
              </a>
              <a href={`tel:${STORE.phone2}`} className="block text-paper-muted underline underline-offset-4 transition-colors duration-500 hover:text-paper motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright">
                {STORE.phone2}
              </a>
            </dd>
          </div>

          <div>
            <dt className="text-rule uppercase text-paper-faint">WhatsApp</dt>
            <dd className="mt-3 space-y-1">
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="block text-paper-muted underline underline-offset-4 transition-colors duration-500 hover:text-paper motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright">
                {STORE.phone1}
              </a>
              <a href={WHATSAPP_URL2} target="_blank" rel="noopener noreferrer" className="block text-paper-muted underline underline-offset-4 transition-colors duration-500 hover:text-paper motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright">
                {STORE.phone2}
              </a>
            </dd>
          </div>

          <div>
            <dt className="text-rule uppercase text-paper-faint">Email</dt>
            <dd className="mt-3 space-y-1">
              <a href={MAIL_URL} className="block break-words text-paper-muted underline underline-offset-4 transition-colors duration-500 hover:text-paper motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright">
                {STORE.email}
              </a>
              <a href={MAIL_URL2} className="block break-words text-paper-muted underline underline-offset-4 transition-colors duration-500 hover:text-paper motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright">
                {STORE.email2}
              </a>
            </dd>
          </div>

          <div>
            <dt className="text-rule uppercase text-paper-faint">Visit</dt>
            <dd className="mt-3 text-paper-muted">
              {STORE.shopNo}
              <br />
              {STORE.area}
              <br />
              {STORE.city}, {STORE.state} — {STORE.pincode}
            </dd>
          </div>
        </dl>

        <div className="mt-12">
          <ActionLink href="/products">See every piece</ActionLink>
        </div>
      </section>
    </PageShell>
  );
}
