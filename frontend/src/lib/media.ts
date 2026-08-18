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
