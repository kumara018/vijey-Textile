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

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative border-t border-ink-edge/60 bg-ink-deep text-paper-muted">
      {/* A single brass hairline across the top — the woven edge. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(to right, transparent, rgba(161,98,7,0.55) 22%, rgba(161,98,7,0.55) 78%, transparent)' }}
      />

      <div className="mx-auto w-full max-w-[112rem] px-6 py-[4.5vh] sm:px-10">
        <div className="grid gap-x-14 gap-y-14 lg:grid-cols-12">

          {/* ── The shop ─────────────────────────────────────────────── */}
          <div className="lg:col-span-4">
            <Link
              href="/"
              className="inline-flex items-center gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
            >
              <img src="/hero-mark-v3.jpg" alt="" width={38} height={38} className="rounded-full" />
              <span className="font-display text-[1.05rem] tracking-[0.16em] text-paper uppercase">
                {STORE.name}
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
          <nav aria-labelledby="footer-shop" className="lg:col-span-3">
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
          <nav aria-labelledby="footer-help" className="lg:col-span-3">
            <h2 id="footer-help" className="text-rule uppercase text-brass-bright">Help &amp; policies</h2>
            <ul className="mt-6 space-y-1.5">
              {HELP.map((l) => (
                <li key={l.href}><FooterLink href={l.href}>{l.label}</FooterLink></li>
              ))}
            </ul>
          </nav>

          {/* ── Reach us ─────────────────────────────────────────────── */}
          <div className="lg:col-span-2">
            <h2 className="text-rule uppercase text-brass-bright">Reach us</h2>
            <address className="mt-6 space-y-4 not-italic">
              <p className="text-paper-faint">
                {STORE.shopNo}<br />{STORE.area}<br />{STORE.city}
              </p>
              <p className="flex flex-col gap-1.5">
                <FooterLink href={CALL_URL}>{STORE.phone1}</FooterLink>
                <FooterLink href={CALL_URL2}>{STORE.phone2}</FooterLink>
              </p>
              <p className="flex flex-col gap-1.5">
                <FooterLink href={MAIL_URL}>{STORE.email}</FooterLink>
                <FooterLink href={MAIL_URL2}>{STORE.email2}</FooterLink>
              </p>
              <p>
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
