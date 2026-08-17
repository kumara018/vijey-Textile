import { getApiBase } from './api';

/**
 * The one place a stored image path becomes a URL.
 *
 * Product images are stored as backend-relative paths (`/uploads/…`) and have
 * to be joined to the API origin before a browser can fetch them. That join
 * was written out by hand in five components as
 * `${process.env.NEXT_PUBLIC_API_URL}${path}`.
 *
 * WHY THAT WAS A LATENT OUTAGE. There is no `.env` file in this repository, so
 * that variable is `undefined` unless the hosting dashboard happens to define
 * it — and `${undefined}` stringifies, it does not throw. The result is a
 * request to `undefined/uploads/x.jpg`, which 404s and shows a broken image on
 * the product page, the cart, the wishlist and the admin. It works in
 * production today only because Vercel supplies the value; it is one dashboard
 * edit away from silently breaking every photograph on the site, and it is
 * already broken for anyone running the project locally.
 *
 * `AuthContext` had spotted this and defended itself with
 * `|| 'https://vijey-textile.onrender.com'`. The image call sites had not.
 * That difference is the tell: the knowledge existed but lived in one file
 * instead of one function.
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
