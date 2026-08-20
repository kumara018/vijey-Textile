/** @type {import('next').NextConfig} */
const path = require('path');
const RENDER_URL = 'https://vijey-textile.onrender.com';

/**
 * THE API ORIGIN, AND WHY THIS FUNCTION EXISTS.
 *
 * This shop went dark and nobody could see why. Every page that needed data
 * showed its error state — "The rail didn't load", "0 PIECES", "We could not
 * load your devices" — while the backend itself was healthy, answered 200 in
 * under half a second, and returned correct CORS headers for the real origin.
 *
 * The cause was one environment variable. NEXT_PUBLIC_API_URL on the host held
 * `rzp_live_…` — a Razorpay key ID pasted into the wrong box. The CSP is built
 * from that variable, so the shipped policy read:
 *
 *   connect-src 'self' <api> http://localhost:8000 razorpay nominatim …
 *     nominatim.openstreetmap.org is checkout's reverse geocoder — it turns
 *     the coordinates from "Use my current location" into a street, city,
 *     state and pincode. Without it in this list the browser BLOCKS that
 *     request, so the feature found the customer and then failed with
 *     "could not turn that into an address" — the same shape of bug as
 *     geolocation=() in Permissions-Policy: our own header saying no.
 *
 * and the browser blocked every single call to the Render backend, because the
 * origin the code actually calls was not on the list. img-src too, so product
 * photographs would have been blocked even if the data had arrived.
 *
 * THE REAL DEFECT IS THE ONE THAT LET A TYPO DO THAT. `lib/api.ts::getApiBase()`
 * decides the API origin at runtime and does not read this variable at all — it
 * returns RENDER_URL on any non-localhost host. So the policy was built from one
 * source of truth and the requests from another, and nothing checked they agreed.
 * A value that is not a URL cannot possibly be the API origin, and letting one
 * through silently turns a typo into a total outage with no error message
 * anywhere in the build.
 *
 * So: anything that is not an absolute http(s) origin is rejected, loudly in the
 * build log, and RENDER_URL — the value getApiBase() will genuinely use — is
 * kept instead. A misconfigured variable now costs a warning rather than a shop.
 */
function apiOrigin() {
  const raw = (process.env.NEXT_PUBLIC_API_URL || '').trim();
  if (!raw) return RENDER_URL;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocol');
    return u.origin; // normalised: no trailing slash, no path, no stray whitespace
  } catch {
    console.warn(
      `\n  next.config.js: NEXT_PUBLIC_API_URL is not a valid http(s) URL (${JSON.stringify(raw)}).` +
        `\n  Ignoring it and using ${RENDER_URL}, which is what lib/api.ts calls anyway.` +
        `\n  If this was meant to be the Razorpay key, it belongs in NEXT_PUBLIC_RAZORPAY_KEY_ID.\n`
    );
    return RENDER_URL;
  }
}

const nextConfig = {
  // Explicitly set Turbopack workspace root so Vercel (no parent lockfile)
  // doesn't fail with "path argument must be string, received undefined".
  turbopack: {
    root: path.resolve(__dirname),
  },

  // Embed the API URL at build time.
  // Vercel env var takes priority; Render URL is the production fallback.
  env: {
    NEXT_PUBLIC_API_URL: apiOrigin(),
  },


  /**
   * Security headers. There were none.
   *
   * Every one of these is a class of attack the browser will defend against for
   * free, but only if it is told to. Unset, the browser's default is permissive,
   * because the web's default is permissive.
   *
   * X-Frame-Options / frame-ancestors
   *   Without it any site can put vijeytextile.com in an invisible iframe over
   *   their own buttons, so a customer thinking they are clicking "play" is
   *   actually clicking "Buy now" on a page they cannot see. That is clickjacking,
   *   and a shop with a one-click purchase is exactly the target for it.
   *
   * Strict-Transport-Security
   *   Without it, the FIRST request a customer makes by typing the domain goes
   *   over plain HTTP and can be intercepted before the redirect to HTTPS ever
   *   happens. HSTS tells the browser to never try HTTP again for two years.
   *   `preload` is deliberately omitted — it is very hard to undo and belongs to
   *   a decision the domain owner should make knowingly, not one I add quietly.
   *
   * Content-Security-Policy
   *   The one that limits the damage of an injected script. It is written for
   *   what this site actually loads: Razorpay's checkout, the Render API, and
   *   the site's own assets. Nothing else may execute or be connected to.
   *
   *   'unsafe-inline' and 'unsafe-eval' are present for scripts, and that is an
   *   honest compromise rather than an oversight: Next's inline bootstrap and
   *   React's dev tooling both require them, and Razorpay injects inline script
   *   of its own. Removing them needs a nonce-based CSP wired through the
   *   document, which is a real piece of work and would break the payment modal
   *   if got wrong. The policy still blocks the main prize — loading script from
   *   an attacker's domain — and that is worth having today rather than a
   *   perfect policy nobody ships.
   *
   * Permissions-Policy
   *   The camera and the microphone stay switched off — nothing here needs
   *   them, and if a dependency ever asks it should fail loudly rather than
   *   silently prompt a customer.
   *
   *   GEOLOCATION IS NOW `self`, AND THE `()` IT REPLACES WAS A REAL BUG.
   *   An empty allowlist denies the feature to EVERY origin including this
   *   one, so the browser refused the API outright and handed back
   *   PERMISSION_DENIED — no matter what the customer had allowed for the
   *   site. Checkout's "Use my current location" therefore reported "location
   *   permission is off" to people whose permission was on, and no amount of
   *   changing browser or OS settings could have fixed it, because the site
   *   was the thing saying no.
   *
   *   The comment above was accurate when it was written; checkout grew a
   *   geolocation feature afterwards and this header was never revisited.
   *   `self` allows this origin only — no third-party frame can use it.
   */
  async headers() {
    /**
     * BOTH origins the browser may legitimately call, because getApiBase()
     * decides at RUNTIME, not at build time: it returns the Render URL on the
     * real domain and http://localhost:8000 when the page is served from
     * localhost. A policy built only from the build-time value therefore blocks
     * every API call during local production verification — which the CSP check
     * caught immediately, and which would otherwise have made this gate
     * unrunnable locally and therefore ignored.
     *
     * Allowing loopback in the shipped policy is close to free. connect-src
     * limits where an injected script may SEND data, and a remote attacker
     * gains nothing from a victim's own 127.0.0.1 — they would need the victim
     * to already be running a listener on that exact port. Weighed against a
     * security gate that only works on one machine, this is the better trade.
     */
    /**
     * Validated, and RENDER_URL is always allowed alongside it. getApiBase()
     * hardcodes RENDER_URL for every non-localhost host, so it is the origin the
     * browser will actually call — it belongs in the policy whether or not the
     * environment agrees. Listing both costs nothing and removes the class of
     * outage described at the top of this file.
     */
    const api = apiOrigin() === RENDER_URL ? RENDER_URL : `${apiOrigin()} ${RENDER_URL}`;
    const local = 'http://localhost:8000 http://127.0.0.1:8000';
    /**
     * WHERE THE PRODUCT MEDIA ACTUALLY LIVES — and the bug this fixes.
     *
     * The policy was written from what the FRONTEND code references, and every
     * image path in the frontend is backend-relative, so `img-src` allowed the
     * API origin and nothing else. But the backend does not serve product
     * media: `routers/admin.py` and `routers/returns.py` upload photographs and
     * videos to Cloudinary and store the absolute `https://res.cloudinary.com/…`
     * URL in the database. The API returns those URLs; the browser fetches them
     * from Cloudinary directly.
     *
     * So the policy blocked every product photograph, every return photo and
     * every product video on the live site. Caught here by loading the built
     * site in a real browser and reading the console — the build is silent
     * about it, and so is every page that has no product on it:
     *
     *   Loading the image 'https://res.cloudinary.com/…' violates the following
     *   Content Security Policy directive: "img-src 'self' data: blob: …"
     *
     * That is the whole reason a CSP gets its own browser-driven check rather
     * than a review. Exact host, not a wildcard: this account is the only one
     * the shop uploads to.
     */
    const media = 'https://res.cloudinary.com';
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://*.razorpay.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: " + api + " " + local + " " + media + " https://*.razorpay.com",
      "media-src 'self' data: blob: " + media,
      "font-src 'self' data:",
      "connect-src 'self' " + api + " " + local + " https://*.razorpay.com https://lumberjack.razorpay.com https://nominatim.openstreetmap.org",
      "frame-src https://api.razorpay.com https://*.razorpay.com",
      "worker-src 'self' blob:",
      "upgrade-insecure-requests",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
    ];
  },

  images: {
    remotePatterns: [
      { protocol: 'http',  hostname: 'localhost',              port: '8000' },
      { protocol: 'https', hostname: 'vijey-textile.onrender.com'              },
    ],
  },
};

module.exports = nextConfig;
