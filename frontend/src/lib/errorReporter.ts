/**
 * Runtime error reporting, to your own backend.
 *
 * Until now nothing told you when a real customer's browser threw. The site
 * has error boundaries — `app/error.tsx` and `app/global-error.tsx` — so a
 * crash shows a designed page rather than a blank one, but the *fact* of it
 * died in that customer's console. A checkout that breaks only on iOS 16, or
 * only when a wallet extension is installed, is invisible until someone
 * telephones the shop.
 *
 * WHY NOT SENTRY. Its free tier would do this well, and if you would rather
 * use it, this file is the seam to swap. It needs an account and a DSN, and
 * creating accounts on your behalf is not something I will do. This route
 * costs nothing, adds no third party, and keeps customer data on
 * infrastructure you already run.
 *
 * WHAT IS DELIBERATELY NOT SENT.
 *
 * No cookies, no tokens, no form values, no email addresses, no cart contents.
 * The URL has its query string stripped, because that is where reset tokens
 * and rating tokens live on this site. An error report should make a bug
 * findable, not become a second place customer data can leak from.
 *
 * THREE THINGS KEEP THIS FROM BECOMING THE PROBLEM IT REPORTS.
 *
 *   dedupe   the same message+stack is sent once per session. A render loop
 *            throwing every frame would otherwise send thousands of beacons
 *            and take the backend down — monitoring that causes the outage.
 *   cap      a hard ceiling per session, after which it goes quiet.
 *   sendBeacon  survives the page being closed, and never blocks navigation.
 *              A report that delays a customer leaving is worse than no report.
 *
 * Failure here is always silent. If reporting throws, it is swallowed: this
 * layer must never turn a recoverable error into a broken page.
 */

import { getApiBase } from './api';

const ENDPOINT = '/api/client-errors';

/**
 * The id of the most recent API response, successful or not.
 *
 * A crash is almost never reported by the same code that made the call — an
 * error boundary catches a render that failed because of data a request
 * returned three frames ago. Threading the id through every component that
 * might throw is not realistic; remembering the last one the API answered with
 * is, and in practice it is the request the reader wants.
 */
let _lastRequestId: string | null = null;
export function noteRequestId(id: string | null | undefined): void {
  if (id) _lastRequestId = id;
}
function lastRequestId(): string | undefined {
  return _lastRequestId ?? undefined;
}
const MAX_PER_SESSION = 8;

let sent = 0;
const seen = new Set<string>();

export interface ReportContext {
  /** Where it came from: 'boundary' | 'window' | 'unhandledrejection' */
  source: string;
  /** React's component stack, when an error boundary caught it. */
  componentStack?: string;
  /** Next's error digest, which correlates to the server log line. */
  digest?: string;
  /**
   * The backend's own id for the request that failed, read off `X-Request-ID`.
   *
   * The digest correlates a browser crash to Next's SERVER log. This correlates
   * it to the API's — which is the half that matters when the failure is a
   * checkout that did not complete, because the interesting record is the one
   * written by the endpoint, not by the renderer. Set automatically by the
   * response interceptor in lib/api.ts; nothing has to remember to pass it.
   */
  requestId?: string;
}

/** Query strings on this site carry reset and rating tokens. Never send them. */
function safeUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    const u = new URL(window.location.href);
    return u.origin + u.pathname;
  } catch {
    return '';
  }
}

export function reportError(error: unknown, context: ReportContext): void {
  try {
    if (typeof window === 'undefined') return;
    if (sent >= MAX_PER_SESSION) return;

    const err = error instanceof Error ? error : new Error(String(error));
    const stack = (err.stack ?? '').split('\n').slice(0, 12).join('\n');
    const key = `${err.name}:${err.message}:${stack.slice(0, 200)}`;
    if (seen.has(key)) return;
    seen.add(key);
    sent++;

    const body = JSON.stringify({
      name: err.name,
      message: String(err.message ?? '').slice(0, 500),
      stack: stack.slice(0, 4000),
      source: context.source,
      component_stack: context.componentStack?.slice(0, 2000),
      digest: context.digest,
      request_id: context.requestId ?? lastRequestId(),
      url: safeUrl(),
      user_agent: navigator.userAgent.slice(0, 300),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      at: new Date().toISOString(),
    });

    /**
     * The same base every other API call uses, not NEXT_PUBLIC_API_URL.
     *
     * That variable is not set in this repo — there is no .env file — so it is
     * `undefined` at build time unless the hosting dashboard supplies it. Five
     * existing files interpolate it straight into image URLs and would produce
     * "undefined/uploads/...", which is presumably why `getApiBase()` was
     * written in the first place. Reporting must not be the sixth thing that
     * quietly posts to a nonexistent origin — least of all a component whose
     * whole job is to notice failures.
     */
    const url = `${getApiBase()}${ENDPOINT}`;

    // sendBeacon survives unload and never blocks. Only fall back to fetch
    // when it is unavailable or refuses (it has a payload size limit).
    const blob = new Blob([body], { type: 'application/json' });
    if (!navigator.sendBeacon?.(url, blob)) {
      void fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true })
        .catch(() => {});
    }
  } catch {
    // Reporting must never be the thing that breaks the page.
  }
}

/**
 * Catches what the React boundaries cannot: errors thrown outside rendering.
 *
 * An error boundary only sees errors during render, in lifecycle, or in
 * constructors. It does not see a rejected promise from an event handler, a
 * failed dynamic import, or a throw inside a `setTimeout` — which on this site
 * covers the scene loader, the sequence decoder and every API call made from a
 * click. Those are exactly the paths most likely to fail on a device I cannot
 * test on.
 */
export function installGlobalErrorReporting(): () => void {
  if (typeof window === 'undefined') return () => {};

  const onError = (e: ErrorEvent) => {
    reportError(e.error ?? new Error(e.message), { source: 'window' });
  };
  const onRejection = (e: PromiseRejectionEvent) => {
    reportError(e.reason, { source: 'unhandledrejection' });
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}
