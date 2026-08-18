import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The public routes, read from the App Router itself.
 *
 * WHY THIS FILE EXISTS. `measure-routes.mjs` and `a11y-pass.mjs` each carried a
 * hand-written list, and both had drifted from the application. Five of the
 * fourteen entries did not exist:
 *
 *     /about            -> never existed
 *     /contact          -> never existed
 *     /shipping-policy  -> the route is /shipping
 *     /return-policy    -> the route is /cancellation
 *     /privacy-policy   -> the route is /privacy
 *
 * Next answers an unknown path with a 200-shaped soft 404 page that has a
 * heading, links and focus rings — so the accessibility gate tabbed through it
 * and reported "PASS /shipping-policy · 37 stops · all focus rings visible",
 * and the performance gate reported a comfortable 60fps. Both were describing
 * the not-found page. A third of each report was fiction, and the real shipping
 * policy page had never been checked by either.
 *
 * A hand-maintained list of routes rots the first time a route is renamed, and
 * nothing tells you: the gate keeps passing, just on the wrong pages. Reading
 * the filesystem means the list cannot disagree with the application, because
 * it IS the application.
 *
 * Callers must still assert the response status — see `assertRoutesExist`.
 * Deriving the list correctly and then not checking that the server serves it
 * would leave the same class of hole open one level down.
 */

/** Segments whose subtrees are excluded, and why. */
const EXCLUDE_PREFIXES = [
  '/admin',     // a work tool behind auth; measures the sign-in wall
  '/account',   // auth-gated
  '/orders',    // auth-gated
  '/checkout',  // auth-gated, and has its own dedicated CSP/payment checks
];

function walk(dir, base = '') {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      // Route groups `(name)` do not appear in the URL.
      const seg = entry.startsWith('(') && entry.endsWith(')') ? '' : `/${entry}`;
      out.push(...walk(full, base + seg));
    } else if (entry === 'page.tsx' || entry === 'page.jsx') {
      out.push(base === '' ? '/' : base);
    }
  }
  return out;
}

/**
 * Every public, statically-addressable route.
 *
 * Dynamic segments are excluded because a gate cannot invent a valid id, and a
 * route tested with a made-up one measures the not-found page — the exact
 * failure this file exists to end.
 */
export function publicRoutes(appDir) {
  return walk(appDir)
    .filter((r) => !r.includes('['))
    .filter((r) => !EXCLUDE_PREFIXES.some((p) => r === p || r.startsWith(p + '/')))
    .sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));
}

/**
 * Refuse to report on a route the server does not serve.
 *
 * Returns the list of routes that did not answer 200. A caller that finds any
 * must fail rather than measure them: a soft 404 is indistinguishable from a
 * real page to everything downstream of here.
 */
export async function assertRoutesExist(base, routes) {
  const missing = [];
  for (const r of routes) {
    try {
      const res = await fetch(`${base}${r}`, { method: 'GET', redirect: 'manual' });
      if (res.status !== 200 && res.status !== 307 && res.status !== 308) {
        missing.push(`${r} -> ${res.status}`);
      }
    } catch (e) {
      missing.push(`${r} -> ${e.message}`);
    }
  }
  return missing;
}
