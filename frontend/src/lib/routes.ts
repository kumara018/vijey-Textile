/**
 * Is this pathname one of the sign-in screens?
 *
 * THE BUG THIS EXISTS TO KILL. Four components independently wrote
 * `pathname.startsWith('/auth')` to decide whether to hide the navigation, the
 * selvedge and the ambient chrome on the sign-in screens. That string is a
 * prefix, not a path segment — and this shop has a route called
 * **`/authentic`**, which starts with `/auth`.
 *
 * So the authenticity page has been shipping with no navigation and no footer:
 * no way to the pieces, no way to the bag, no policy links, no address, and no
 * way back except the browser's own back button. On the page whose entire job
 * is to make a first-time buyer trust the shop.
 *
 * It was invisible in review because every check agreed with every other
 * check — four call sites, one wrong idea, perfectly consistent. The sister
 * shop has the same route and had the same bug.
 *
 * A path segment ends at a slash or at the end of the string, so that is what
 * this tests. `/auth` and `/auth/login` match; `/authentic` does not.
 */
export function isAuthRoute(pathname: string): boolean {
  return pathname === '/auth' || pathname.startsWith('/auth/');
}
