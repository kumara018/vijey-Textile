import { NextResponse } from 'next/server';

/**
 * Where the visitor is, from their IP, with no permission prompt.
 *
 * WHY THIS EXISTS. Signed out, the delivery line showed the SHOP'S OWN
 * pincode — 638004, Erode — because that was the only thing available to
 * fall back to. It is marked as an assumption in the markup, but a customer
 * in Chennai reads a specific pincode as a claim about them, and it is wrong.
 *
 * WHY NOT ASK THE BROWSER FOR GPS. That is the obvious answer and it is the
 * wrong one for a first visit. `navigator.geolocation` fires a permission
 * prompt, which on arrival — before a customer has seen a single garment —
 * is an interruption most people dismiss, and a dismissal is sticky. Amazon
 * does not do it either: it resolves the location from the connection and
 * offers a control to correct it. GPS is right at CHECKOUT, where somebody
 * has already decided to buy and is filling in an address, and it is used
 * there.
 *
 * WHERE THE DATA COMES FROM. Vercel resolves the IP at the edge and attaches
 * the result as request headers, so this costs no third-party call, no API
 * key, and nothing that can rate-limit or go down independently of the site.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It never returns the shop's own city as
 * a guess. If the headers are absent — running locally, a VPN, an IP the edge
 * cannot place — it says so with `found: false` and the caller shows a
 * "choose your location" control instead of a confident wrong answer. An
 * honest blank beats a precise fiction.
 */
export const dynamic = 'force-dynamic';   // per-visitor, never cached

export async function GET(request: Request) {
  const h = request.headers;
  const city = h.get('x-vercel-ip-city');
  const postal = h.get('x-vercel-ip-postal-code');
  const country = h.get('x-vercel-ip-country');

  // Vercel percent-encodes city names that contain spaces or non-ASCII.
  const decode = (v: string | null) => {
    if (!v) return null;
    try { return decodeURIComponent(v); } catch { return v; }
  };

  const resolved = decode(city);
  if (!resolved && !postal) {
    return NextResponse.json({ found: false });
  }

  return NextResponse.json({
    found: true,
    city: resolved,
    pincode: postal || null,
    country: country || null,
  });
}
