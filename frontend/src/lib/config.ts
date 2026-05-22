// ═══════════════════════════════════════════════════
// VIJEY TEXTILE — STORE CONFIGURATION
// ═══════════════════════════════════════════════════

export const STORE = {
  name:        'Vijey Textile',
  tagline:     "Luxury Kid's & Girls Clothing",

  // ── Contact Details ──────────────────────────────
  phone1:      '+91 99941 68839',
  phone2:      '+91 94439 47853',
  email:       'kumaragurubaran27102@gmail.com',
  supportEmail:'kumaragurubaran27102@gmail.com',
  whatsapp:    '919994168839',   // country code + number, no + or spaces

  // ── Address ──────────────────────────────────────
  shopNo:      'Shop Ground Floor No 131',
  area:        'Texvalley Gangapuram',
  city:        'Erode',
  state:       'Tamil Nadu',
  pincode:     '638004',
  country:     'India',

  // ── Store Timings ─────────────────────────────────
  weekdays:    'Mon – Fri: 10:00 AM – 8:00 PM',
  weekend:     'Sat – Sun: 10:00 AM – 9:30 PM',

  // ── Shipping ──────────────────────────────────────
  shippingFee: 49,

  // ── Social Media ─────────────────────────────────
  facebook:    'https://facebook.com/vijeytextile',
  instagram:   'https://instagram.com/vijeytextile',
  twitter:     'https://x.com/vijeytextile',

  // ── Google Maps ───────────────────────────────────
  googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Texvalley+Gangapuram+Erode+Tamil+Nadu',

  // ── SEO / Meta ────────────────────────────────────
  description: "Shop luxury Kid's & Girls Frocks, Chudithar, Western Dresses, Lehenga & Party Wear (sizes 14–40) at Vijey Textile. Located at Shop Ground Floor No 131, Texvalley Gangapuram, Erode.",
};

export const FULL_ADDRESS  = `${STORE.shopNo}, ${STORE.area}, ${STORE.city}, ${STORE.state} – ${STORE.pincode}`;
export const SHORT_ADDRESS = `${STORE.shopNo}, ${STORE.area}`;
export const WHATSAPP_URL  = `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent('Hi! I\'m interested in your products at Vijey Textile.')}`;
export const MAIL_URL      = `mailto:${STORE.email}`;
export const CALL_URL      = `tel:${STORE.phone1}`;
