import { getApiBase } from './api';

/**
 * The one place a stored image path becomes a URL.
 *
 * Product images are stored as backend-relative paths (`/uploads/…`) and have
 * to be joined to the API origin before a browser can fetch them. That join
 * was written out by hand in five components as
 * `${process.env.NEXT_PUBLIC_API_URL}${path}`.
 *
 * CORRECTION, recorded rather than quietly dropped. I first justified this file
 * by claiming those call sites resolved to `undefined/uploads/x.jpg` whenever
 * the hosting dashboard did not define NEXT_PUBLIC_API_URL. That was wrong.
 * `next.config.js` sets
 *
 *     env: { NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || RENDER_URL }
 *
 * and Next inlines that at build time, so the variable always has a value and
 * the images were never broken. I read the five call sites and did not read the
 * config that feeds them.
 *
 * WHAT IS STILL WORTH FIXING. Two independent definitions of "where the backend
 * is": the Next config's fallback constant, and `getApiBase()` in api.ts, which
 * exists because that fallback was not trusted for API calls. They agree today
 * by coincidence, not by construction — change one and images and data would
 * silently talk to different origins, which is a far harder bug to see than a
 * broken image. One function, one answer.
 *
 * `getApiBase()` resolves the origin the same way every API call does, so
 * images and data can never disagree about which backend they are talking to.
 */
export function mediaUrl(path?: string | null): string {
  if (!path) return '';
  // Already absolute — an external CDN or a full URL stored by an older import.
  if (/^https?:\/\//i.test(path)) return path;
  const base = getApiBase();
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
}

/**
 * A Cloudinary URL resized, sharpened and served as a modern format.
 *
 * WHY THE OPENING LOOKED SOFT. The product photographs are 646-675px wide —
 * measured, not assumed — and the opening is close to 1900px. The browser was
 * stretching each one nearly three times its real width with a bilinear
 * resample and no sharpening, which is exactly what soft looks like.
 *
 * Cloudinary can do that resize on its side, with a better resample and a
 * sharpening pass, and hand back a modern format while it is at it. The
 * measured result is the surprising part:
 *
 *     today   675 x  900  JPEG  60.6 KB   (stretched 2.8x by the browser)
 *     w_900   900 x 1200  WebP  56.7 KB   larger image, FEWER bytes
 *     w_1400 1400 x 1867  WebP  91.5 KB
 *     w_1800 1800 x 2400  WebP 141.8 KB
 *     w_500   500 x  667  WebP  27.3 KB   less than half today's bytes
 *
 * So this is not a quality-for-speed trade. A phone downloads less than it
 * does today and gets a sharper picture; a desktop pays about 80KB more for a
 * photograph that is no longer visibly stretched.
 *
 * `c_fill` with `g_auto`. The opening is a wide band, so a portrait
 * photograph has to be cropped to fill it — that is the composition the shop
 * asked for and kept. `g_auto` picks the region worth keeping rather than
 * taking the middle by default, so the crop is less likely to land across a
 * garment.
 *
 * `c_fit` was tried instead, which crops nothing and shows the whole frame.
 * It works, but it leaves the picture boxed into a narrow strip at one side
 * of the band rather than filling it, and that was not what was wanted.
 *
 * Upscaling cannot invent detail. This makes the stretch look as good as a
 * stretch can; real hero photographs at 1200px+ would still be better, which
 * is what public/hero/ is for.
 *
 * Anything that is not a Cloudinary URL is returned untouched.
 */
export function heroImageUrl(url: string, width: number): string {
  const marker = '/image/upload/';
  const i = url.indexOf(marker);
  if (i === -1) return url;                       // not Cloudinary — leave it
  if (/\/image\/upload\/[a-z]_/.test(url)) return url;  // already transformed
  const head = url.slice(0, i + marker.length);
  const tail = url.slice(i + marker.length);
  return `${head}f_auto,q_auto,w_${width},c_fill,g_auto,e_sharpen:60/${tail}`;
}

/** The widths the opening offers the browser to choose between. */
export const HERO_WIDTHS = [500, 900, 1400, 1800];
