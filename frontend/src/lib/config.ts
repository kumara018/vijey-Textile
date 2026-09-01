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
  /* THE ORDER MATTERS: `email` is what the footer and the invoice print, and
     the pages that list both show `email` then `email2`.
     It was the domain address, while the server's SUPPORT_EMAIL — the reply-to
     on every message the shop sends — was already the Gmail. So a customer read
     one address on the page, wrote to it, and got an answer from another; and
     what they wrote to landed in the Hostinger mailbox that has been the
     unreliable one. The address shown is now the mailbox that is actually read.
     admin@vijeytextile.com stays, second, because it is real and still has a
     job: it is SMTP_EMAIL, the sending identity Brevo's domain authentication
     signs. It must keep working — it just should not be the one advertised. */
  email:       'vijeytextile@gmail.com',
  email2:      'admin@vijeytextile.com',
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
export const MAIL_URL2     = `mailto:${STORE.email2}`;
export const CALL_URL      = `tel:${STORE.phone1}`;
export const CALL_URL2     = `tel:${STORE.phone2}`;
