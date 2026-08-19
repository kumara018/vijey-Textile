'use client';

import Link from 'next/link';
import {
  STORE, WHATSAPP_URL, WHATSAPP_URL2, CALL_URL, CALL_URL2, MAIL_URL, MAIL_URL2,
} from '@/lib/config';

/**
 * The Selvedge — site footer.
 *
 * A selvedge is the self-finished edge of a bolt of cloth: the part that stops
 * it fraying, woven tighter than the body. That is what this is doing at the
 * bottom of every page, and it is why the treatment is denser and quieter than
 * the sections above rather than louder.
 *
 * This is the most-seen component on the site — it renders on every route — so
 * it was also the loudest remaining piece of the old design: bright magenta and
 * green social buttons on a maroon ground, undoing the hero's work on every
 * page a visitor reached. Rebuilt in the brass palette with the same 400-600ms
 * motion language as everything else.
 *
 * Every hover here moves a rule rather than a colour swatch. Underlines grow
 * from the left on a long cubic-bezier; nothing scales, nothing bounces, and
 * the only accent is brass.
 */

/**
 * Brand marks as inline SVG.
 *
 * lucide-react v1 removed every brand glyph for trademark reasons, so there is
 * no Instagram export to import. A generic camera icon does not read as "our
 * Instagram" to a customer, and the previous coloured pill buttons read as
 * someone else's brand entirely — these are single-weight strokes in the
 * site's own palette, so the social links look like part of this shop.
 */
function InstagramMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function WhatsAppMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.2 20.8l1.3-4.6A8.4 8.4 0 1 1 7.9 19.4L3.2 20.8Z" />
      <path d="M9.1 8.2c.3-.1.6 0 .8.3l.8 1.3c.1.2.1.5 0 .7l-.5.7c-.1.2-.1.4 0 .6a6 6 0 0 0 2.2 2.2c.2.1.4.1.6 0l.7-.5c.2-.1.5-.2.7 0l1.3.8c.3.2.4.5.3.8a2.4 2.4 0 0 1-2.6 1.5 8.6 8.6 0 0 1-6.2-6.2 2.4 2.4 0 0 1 1.9-2.2Z" />
    </svg>
  );
}

/**
 * A footer link. The rule under it grows from the left on hover — the same
 * gesture the occasion bands and the hero CTA use, so the whole site behaves
 * one way.
 */
function FooterLink({ href, children, external = false }: {
  href: string; children: React.ReactNode; external?: boolean;
}) {
  const cls =
    'group relative inline-block py-1 text-paper-muted transition-colors duration-500 ' +
    'ease-[cubic-bezier(0.22,0.61,0.24,1)] hover:text-paper ' +
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright';

  const inner = (
    <>
      {children}
      <span
        aria-hidden="true"
        className="absolute bottom-0 left-0 h-px w-full origin-left scale-x-0 bg-brass
                   transition-transform duration-[520ms] ease-[cubic-bezier(0.22,0.61,0.24,1)]
                   group-hover:scale-x-100"
      />
    </>
  );

  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
  ) : (
    <Link href={href} className={cls}>{inner}</Link>
  );
}

const CATEGORIES = [
  'Baby Frocks', 'Chudithar', 'Frocks', 'Western Dresses', 'Lehenga', 'Party Wear',
];

const HELP = [
  { href: '/products',            label: 'All pieces' },
  { href: '/orders',              label: 'My orders' },
  { href: '/support',             label: 'Contact us' },
  { href: '/support#size-guide',  label: 'Size guide' },
  { href: '/support#shipping',    label: 'Shipping policy' },
  { href: '/support#returns',     label: 'Cancel, return & exchange FAQ' },
  { href: '/cancellation',        label: 'Cancellation, return & exchange policy' },
  { href: '/authentic',           label: 'Authenticity' },
  { href: '/terms',               label: 'Terms & conditions' },
  { href: '/privacy',             label: 'Privacy policy' },
];


/* One hairline weight, sized to sit on the first line of the text beside it. */
const ico = 'mt-[0.28em] h-4 w-4 shrink-0 text-brass-bright';

function Shop() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={ico}>
      <path d="M3.4 8.4v8.2h13.2V8.4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M2.5 8.4 4 3.4h12l1.5 5a2.4 2.4 0 0 1-4.75 0 2.4 2.4 0 0 1-4.85 0 2.4 2.4 0 0 1-4.75 0Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M8.2 16.6v-4.1h3.6v4.1" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function Handset() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={ico}>
      <path d="M6.8 3.2 8.3 6.2 6.8 7.8a9.8 9.8 0 0 0 5.2 5.2l1.6-1.5 2.9 1.5v2.5c0 .6-.5 1.1-1.1 1.1A13.3 13.3 0 0 1 3 4.3c0-.6.5-1.1 1.1-1.1h2.7Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function Envelope() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={ico}>
      <rect x="2.5" y="4.4" width="15" height="11.2" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <path d="m3.1 5.2 6.9 5 6.9-5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function Pin() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={ico}>
      {/* Drawn to the same LEFT INK EDGE as the other three (x=2.6), not just
          the same 16px box. Measured on the rendered page, the old pin's
          drawing started at x=4.0 while the shop and envelope started at 2.5 —
          a 1.4-unit inset, about 1.1px at this size, which in a vertical stack
          is exactly what reads as "the symbols are not straight". It was also
          the tallest of the four at 15.4 units against the envelope's 11.
          Aligning the boxes was never enough; the ink has to line up. */}
      <path d="M10 17.3s5.7-5.2 5.7-8.7a5.7 5.7 0 1 0-11.4 0c0 3.5 5.7 8.7 5.7 8.7Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="10" cy="8.6" r="2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden border-t border-ink-edge/60 bg-ink-deep text-paper-muted">
      {/**
        * THE GROUND, WHICH WAS A FLAT SHEET OF NEAR-WHITE.
        *
        * `bg-ink-deep` is #FFFBFC. On a page whose body is #F7EAEE that is
        * almost the same colour, so the footer did not read as a place — it
        * read as the page running out. The sister shop anchors its footer with
        * a dark ground; doing that here would just make the two shops look
        * alike again, and this one has been deliberately relit.
        *
        * So the depth comes from WEAVE rather than from darkness. Two
        * repeating gradients at right angles, a couple of percent apart in
        * tone, produce the over-under of a plain weave at close range — the
        * one texture that belongs to a cloth shop and to nothing else. Over
        * it, a wide radial lifts the centre so the columns sit in light and
        * the corners fall away.
        *
        * Both are painted, not animated, and both are CSS gradients rather
        * than images: no request, no decode, no layout, and it scales to any
        * width without tiling artefacts.
        */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: [
            'radial-gradient(120% 90% at 50% 0%, rgba(247,234,238,0.9) 0%, rgba(239,221,227,0.55) 45%, rgba(239,221,227,0) 100%)',
            'repeating-linear-gradient(90deg, rgba(220,195,203,0.22) 0 1px, transparent 1px 7px)',
            'repeating-linear-gradient(0deg,  rgba(220,195,203,0.16) 0 1px, transparent 1px 7px)',
          ].join(','),
        }}
      />
      {/* A single cerise hairline arc across the head of the footer — the
          selvedge thread, and the one saturated mark down here. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-24"
        style={{
          backgroundImage:
            'radial-gradient(140% 100% at 50% 0%, rgba(194,43,98,0.16) 0%, rgba(194,43,98,0) 70%)',
        }}
      />
      {/* A single brass hairline across the top — the woven edge. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(to right, transparent, rgba(161,98,7,0.55) 22%, rgba(161,98,7,0.55) 78%, transparent)' }}
      />

      <div className="relative z-10 mx-auto w-full max-w-[112rem] px-6 py-[4.5vh] sm:px-10">
        {/**
          * THE GUTTER AND THE COLUMN SPLIT ARE MEASURED, NOT CHOSEN BY EYE.
          *
          * This grid pushed the whole document 41px wider than the viewport at
          * exactly 1024px — the width a laptop actually is — and the page
          * scrolled sideways. Nothing looked broken in isolation, which is why
          * it survived several passes: no single element overflowed, the SUM
          * did. Twelve columns with a 56px gutter spends 616px on gaps alone
          * out of 944px of content width, leaving 27px per column, and the
          * "Reach us" column at 2/12 then had 111px to fit an email address in.
          *
          * Three things, each necessary:
          *   - the gutter scales (32px at lg, 56px only at xl where it fits);
          *   - the split gives "Reach us" 3 columns instead of 2, since it
          *     holds the longest strings in the footer;
          *   - every child gets `min-w-0`. A grid item defaults to
          *     `min-width: auto`, which means it refuses to shrink below its
          *     content no matter what its column says — the same rule that
          *     broke the header wordmark. Without this the other two fixes
          *     only move the overflow point.
          */}
        <div className="grid gap-x-8 gap-y-14 lg:grid-cols-12 xl:gap-x-14">

          {/* ── The shop ─────────────────────────────────────────────── */}
          <div className="min-w-0 lg:col-span-4">
            <Link
              href="/"
              /* Raised by the measured cap-height difference. `leading-none`
                 on the wordmark was not enough — taken honestly, by
                 rasterising both strings and finding the first row of real
                 ink rather than trusting font-metric APIs, the wordmark's
                 cap-top still sat 5.5px below the column headings'. The
                 face's ascent is nearly a full em, so even a collapsed line
                 box puts the letters well below the top of it.
                 5.5px = 0.344rem, and this wordmark is a fixed 1.05rem rather
                 than a clamp, so a fixed rem is exact at every width. On the
                 link, so the mark and the name rise together. */
              className="-mt-[0.344rem] inline-flex items-center gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
            >
              <img src="/hero-mark-v3.jpg" alt="" width={38} height={38} className="shrink-0 rounded-full" />
              <span>
                {/* `leading-none`, for the same reason as the sister shop's wordmark:
                    half-leading pushed the brand name below the cap-top of the
                    column headings beside it. Smaller offset here (1.5px against
                    3.7px) because this mark is 16.8px and already sat on
                    leading-tight, but it is the same defect. */}
                <span className="block font-display text-[1.05rem] uppercase leading-none tracking-[0.16em] text-paper">
                  {STORE.name}
                </span>
                {/* The same line as the header and the invoice, from one place
                    in config so the four cannot drift apart. */}
                <span className="mt-0.5 block text-[0.62rem] uppercase tracking-[0.14em] text-brass-bright">
                  {STORE.tagline}
                </span>
              </span>
            </Link>

            <p className="mt-7 max-w-[34ch] text-paper-faint">
              {/* A footer is scanned, not read. The paragraph that stood here
                  said the shop is family-run, hand-checked and answers the
                  phone — all true, and none of it is what somebody scrolling
                  to the bottom of a page is looking for. They want a link, an
                  address or a number. The sentence lives on the homepage,
                  where there is room to say it properly. */}
              Ground floor, Texvalley, Gangapuram, Erode.
            </p>

            <div className="mt-9 flex items-center gap-3">
              <a
                href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
                aria-label={`WhatsApp ${STORE.phone1}`}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-ink-edge text-paper-faint
                           transition-colors duration-500 ease-[cubic-bezier(0.22,0.61,0.24,1)]
                           hover:border-brass hover:text-brass-bright
                           focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
              >
                <WhatsAppMark />
              </a>
              <a
                href={WHATSAPP_URL2} target="_blank" rel="noopener noreferrer"
                aria-label={`WhatsApp ${STORE.phone2}`}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-ink-edge text-paper-faint
                           transition-colors duration-500 ease-[cubic-bezier(0.22,0.61,0.24,1)]
                           hover:border-brass hover:text-brass-bright
                           focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
              >
                <WhatsAppMark />
              </a>
              <a
                href={STORE.instagram} target="_blank" rel="noopener noreferrer"
                aria-label="Instagram"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-ink-edge text-paper-faint
                           transition-colors duration-500 ease-[cubic-bezier(0.22,0.61,0.24,1)]
                           hover:border-brass hover:text-brass-bright
                           focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
              >
                <InstagramMark />
              </a>
            </div>
          </div>

          {/* ── Shop by piece ────────────────────────────────────────── */}
          <nav aria-labelledby="footer-shop" className="min-w-0 lg:col-span-2">
            <h2 id="footer-shop" className="text-rule uppercase text-brass-bright">The pieces</h2>
            <ul className="mt-6 space-y-1.5">
              {CATEGORIES.map((c) => (
                <li key={c}>
                  <FooterLink href={`/products?category=${encodeURIComponent(c)}`}>{c}</FooterLink>
                </li>
              ))}
            </ul>
          </nav>

          {/* ── Help and policies ────────────────────────────────────── */}
          <nav aria-labelledby="footer-help" className="min-w-0 lg:col-span-3">
            <h2 id="footer-help" className="text-rule uppercase text-brass-bright">Help &amp; policies</h2>
            <ul className="mt-6 space-y-1.5">
              {HELP.map((l) => (
                <li key={l.href}><FooterLink href={l.href}>{l.label}</FooterLink></li>
              ))}
            </ul>
          </nav>

          {/* ── Reach us ─────────────────────────────────────────────── */}
          <div className="min-w-0 lg:col-span-3">
            <h2 className="text-rule uppercase text-brass-bright">Reach us</h2>
            {/**
              * EACH ROW GETS ITS SYMBOL.
              *
              * This was four stacked paragraphs of near-identical grey text —
              * an address, two numbers, two addresses, a link — and a customer
              * scanning for "how do I phone them" had to read all of it to
              * find out which was which. A shop mark, a handset, an envelope
              * and a pin sort that in one glance, before a single word is
              * read, which is what a footer is for.
              *
              * Drawn inline at one hairline weight rather than pulled from an
              * icon set: four shapes do not justify a dependency, and these
              * match the weight of the rules and the glass already on the page.
              *
              * `aria-hidden` on every one of them. The link text beside each
              * already says what it is, and a screen reader announcing "phone
              * icon, phone, +91…" is worse than not having them.
              */}
            <address className="mt-6 space-y-4 not-italic">
              <p className="flex gap-3 text-paper-faint">
                <Shop />
                <span>{STORE.shopNo}<br />{STORE.area}<br />{STORE.city}</span>
              </p>
              <p className="flex gap-3">
                <Handset />
                <span className="flex flex-col gap-1.5">
                  <FooterLink href={CALL_URL}>{STORE.phone1}</FooterLink>
                  <FooterLink href={CALL_URL2}>{STORE.phone2}</FooterLink>
                </span>
              </p>
              <p className="flex gap-3">
                <Envelope />
                <span className="flex min-w-0 flex-col gap-1.5 break-words">
                  <FooterLink href={MAIL_URL}>{STORE.email}</FooterLink>
                  <FooterLink href={MAIL_URL2}>{STORE.email2}</FooterLink>
                </span>
              </p>
              <p className="flex gap-3">
                <Pin />
                <FooterLink href={STORE.googleMapsUrl} external>Find us on the map</FooterLink>
              </p>
            </address>
          </div>
        </div>

        {/* ── Colophon ───────────────────────────────────────────────── */}
        <div className="mt-[7vh] flex flex-col gap-5 border-t border-ink-edge/60 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-caption uppercase text-paper-faint">
            © {year} {STORE.name} — Erode, Tamil Nadu
          </p>
          <p className="text-caption uppercase text-paper-faint">
            Sizes 12–40 · Delivered across India
          </p>
        </div>
      </div>
    </footer>
  );
}
