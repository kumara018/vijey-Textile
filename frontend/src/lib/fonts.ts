import { Fraunces, Source_Sans_3 } from 'next/font/google';

/**
 * The Trousseau type pairing.
 *
 * next/font downloads and self-hosts these at build time — no runtime request
 * to a font CDN, no layout shift, no third party watching our customers.
 *
 * Fraunces carries the display. It is a high-contrast old-style face with a
 * SOFT axis that rounds the terminals, which is exactly the register this
 * brand needs: warm and hand-finished rather than the cold Didone sharpness
 * the sister site uses. The two faces must never be mistakable for each other,
 * and the WONK axis makes that structural rather than a matter of weight.
 *
 * Old-style figures throughout: lining figures all sit at cap height and read
 * as tabular data. Prices on an heirloom piece should read as prose.
 */
export const display = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  // No `weight` here on purpose: next/font rejects `axes` alongside a fixed
  // weight list, because declaring axes means loading the variable font, and a
  // variable font carries the whole weight range already.
  axes: ['SOFT', 'WONK', 'opsz'],
});

/**
 * Source Sans 3 for body and interface. Deliberately quiet — a humanist sans
 * with a large x-height that stays legible at 13px on a phone, which is where
 * most of this shop's traffic reads a price.
 */
export const body = Source_Sans_3({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
  weight: ['300', '400', '500', '600'],
});

export const fontVariables = `${display.variable} ${body.variable}`;
