/** @type {import('next').NextConfig} */
const path = require('path');
const RENDER_URL = 'https://vijey-textile.onrender.com';

const nextConfig = {
  // Explicitly set Turbopack workspace root so Vercel (no parent lockfile)
  // doesn't fail with "path argument must be string, received undefined".
  turbopack: {
    root: path.resolve(__dirname),
  },

  // Embed the API URL at build time.
  // Vercel env var takes priority; Render URL is the production fallback.
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || RENDER_URL,
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
   *   Nothing on this site needs the camera, the microphone or geolocation, so
   *   they are switched off. If a dependency ever asks, it fails loudly instead
   *   of silently prompting a customer.
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
    const api = process.env.NEXT_PUBLIC_API_URL || RENDER_URL;
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
      "connect-src 'self' " + api + " " + local + " https://*.razorpay.com https://lumberjack.razorpay.com",
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
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
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
