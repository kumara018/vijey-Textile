// ═══════════════════════════════════════════════════
// VIJEY TEXTILE — STORE CONFIGURATION
// ═══════════════════════════════════════════════════

export const STORE = {
  name:        'Vijey Textile',
  /* The line under the mark, given by the shop. It appears under the wordmark
     in the header and the footer, on the invoice and at the top of every
     email — so it lives here once rather than being retyped in four places
     that would then drift apart. */
  tagline:     "Grand treat for girls",

  // ── Contact Details ──────────────────────────────
  phone1:      '+91 94439 47853',
  phone2:      '+91 75981 86790',
  /* `email` is what the footer, the invoice and the policy pages print — the
     mailbox the shop actually reads. It was the domain address at first,
     while SUPPORT_EMAIL — the reply-to on every message the shop sends — was
     already the Gmail, so a customer read one address on the page, wrote to
     it, and got an answer from another.

     admin@vijeytextile.com is gone from the site entirely now. It was a paid
     Hostinger mailbox and the plan was not renewed, so mail sent to it
     bounces — removed from the footer, the support page and the policy pages
     rather than left advertised.

     Sending is unaffected. Brevo sends over its HTTP API, authorised by DNS
     (the SPF include, the brevo1/brevo2 DKIM records, the brevo-code TXT),
     and never used the mailbox. `SMTP_EMAIL` on the server stays set to the
     domain address on purpose — a From on the shop's own domain is what keeps
     DKIM aligned. Replies land here, in the Gmail, which is where they
     already went. */
  email:       'vijeytextile@gmail.com',
  supportEmail:'vijeytextile@gmail.com',
  whatsapp:    '919443947853',   // primary WhatsApp — country code + number, no + or spaces
  whatsapp2:   '917598186790',   // secondary WhatsApp

  // ── Address ──────────────────────────────────────
  shopNo:      'Shop Ground Floor No 131',
  area:        'Texvalley Gangapuram',
  city:        'Erode',
  state:       'Tamil Nadu',
  pincode:     '638102',
  country:     'India',

  // ── Store Timings ─────────────────────────────────
  weekdays:    'Mon – Fri: 10:00 AM – 8:00 PM',
  weekend:     'Sat – Sun: 10:00 AM – 9:30 PM',

  // ── Shipping ──────────────────────────────────────
  shippingFee: 49,

  // ── Social Media ─────────────────────────────────
  instagram:   'https://instagram.com/grandtreatforgirls',

  // ── Google Maps ───────────────────────────────────
  googleMapsUrl: 'https://maps.app.goo.gl/zqcDdYaeegs1yBuCA?g_st=awb',

  // ── SEO / Meta ────────────────────────────────────
  description: "Shop luxury Baby Frocks, Chudithar, Frocks, Western Dresses, Lehenga & Party Wear for Baby, Kids & Girls (sizes 12–40) at Vijey Textile. Located at Shop Ground Floor No 131, Texvalley Gangapuram, Erode.",
};

export const FULL_ADDRESS  = `${STORE.shopNo}, ${STORE.area}, ${STORE.city}, ${STORE.state} – ${STORE.pincode}`;
export const SHORT_ADDRESS = `${STORE.shopNo}, ${STORE.area}`;
export const WHATSAPP_URL  = `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent('Hi! I\'m interested in your products at Vijey Textile.')}`;
export const WHATSAPP_URL2 = `https://wa.me/${STORE.whatsapp2}?text=${encodeURIComponent('Hi! I\'m interested in your products at Vijey Textile.')}`;
export const MAIL_URL      = `mailto:${STORE.email}`;
export const CALL_URL      = `tel:${STORE.phone1}`;
export const CALL_URL2     = `tel:${STORE.phone2}`;
