/**
 * Auth helper script
 *
 * REDIRECT FLOW:
 *   Admin login  → /admin
 *   User  login  → /       (homepage)
 *   Not logged in → /auth/login
 */

import { authAPI } from './api';

export interface LoginResult {
  success: boolean;
  isAdmin?: boolean;
  name?: string;
  error?: string;
}

export async function performLogin(
  identifier: string,
  password: string,
): Promise<LoginResult> {
  try {
    const res = await authAPI.login({ identifier: identifier.trim(), password });
    const { access_token, user } = res.data;

    // Store token and user
    localStorage.setItem('token', access_token);
    localStorage.setItem('user', JSON.stringify(user));

    return { success: true, isAdmin: user.is_admin, name: user.full_name };
  } catch (err: any) {
    const detail = err.response?.data?.detail;
    const msg = detail || 'Login failed. Please check your credentials.';
    return { success: false, error: msg };
  }
}

/** One saved account, as it is held in localStorage. */
export interface StoredSession {
  token: string;
  user: { id?: number; is_admin?: boolean };
}

/**
 * Which accounts survive signing out of the current one.
 *
 * Pulled out of `performLogout` so it can be tested, because this decision has
 * now been got wrong three separate times: the list was pruned and then thrown
 * away anyway; an expired token elsewhere wiped every account; and the revoke
 * was sent with the wrong credentials. Each fault had the same symptom — sign
 * out of one account, lose both — and none of them could be caught by a test,
 * because the logic was tangled up with localStorage, cookies and a redirect.
 *
 * Entries without a usable token are dropped rather than kept: a session that
 * cannot authenticate is not an account you are signed into, and promoting one
 * would land the customer on a page that immediately signs them out.
 */
export function sessionsAfterSignOut(
  sessions: unknown,
  currentUserId: number | undefined,
): StoredSession[] {
  if (!Array.isArray(sessions)) return [];
  return sessions.filter(
    (s): s is StoredSession =>
      Boolean(s) && typeof s?.token === 'string' && s.token.length > 0 &&
      s?.user?.id !== currentUserId,
  );
}

/**
 * The saved list after an account is signed into, or switched to.
 *
 * THE BUG THIS EXISTS TO KILL: signing in as a second account did not save that
 * account, so the moment you switched away from it you were signed out of it.
 *
 * `login()` wrote the new list inside a `setSessions(prev => …)` updater, which
 * React runs on the NEXT RENDER — and the very next statement was
 * `redirectAfterLogin`, a full document navigation. React schedules that render
 * through the Scheduler, which posts a macrotask; a pending navigation
 * preempts it. So the write usually never happened, and the account that had
 * just proven its password was missing from `sessions` on the other side of the
 * reload. It looked signed in, because `token` and `user` ARE written
 * synchronously. It was simply not in the list — so the next switch dropped it.
 *
 * The list is therefore computed here, from the value in storage rather than
 * from React state, and written synchronously by the caller before it navigates.
 *
 * Upsert-to-front, by id: an account already held is replaced rather than
 * duplicated (its token may have been refreshed), and the most recent one leads
 * the list, which is the order the switcher and `performLogout` both assume.
 */
export function sessionsAfterSignIn(
  sessions: unknown,
  entry: StoredSession,
): StoredSession[] {
  const list = Array.isArray(sessions) ? sessions : [];
  const id = entry?.user?.id;
  const others = list.filter(
    (s): s is StoredSession =>
      Boolean(s) && typeof s?.token === 'string' && s.token.length > 0 &&
      s?.user?.id !== id,
  );
  // An entry with no usable token is not a session. Returning the list
  // unchanged beats corrupting it with a row that can never authenticate.
  if (!entry || typeof entry.token !== 'string' || !entry.token) return others;
  return [entry, ...others];
}

/**
 * Sign out of the CURRENT account, and land wherever that leaves you.
 *
 * `to` is only used when this was the last account on the device. It once
 * existed for "Switch account", which was implemented as a sign-out with a
 * different destination; switching no longer signs anybody out of anything, so
 * both remaining callers are plain Sign out and neither passes it.
 */
export function performLogout(to: string = '/') {
  /*
   * THE TOKEN IS CAPTURED AND PASSED EXPLICITLY, and that is not defensive
   * tidying — without it this function revokes the WRONG ACCOUNT.
   *
   * `api.ts`'s request interceptor fills in Authorization from localStorage,
   * and it runs as a microtask: after this synchronous block has finished, by
   * which point the lines below have already written the NEXT account's token
   * there. The revoke would then be sent with the credentials of the account
   * being switched TO — killing its session server-side, so its next request
   * 401s and signs that one out as well. Sign out of one account, lose both,
   * which is the exact fault this whole function was rewritten to fix.
   *
   * The interceptor leaves an explicit Authorization header alone precisely so
   * this call site can say which account it means. Its comment names this case.
   */
  const leaving = localStorage.getItem('token') || undefined;
  authAPI.logout(leaving).catch(() => {});

  /*
   * SIGNING OUT OF ONE ACCOUNT DOES NOT SIGN YOU OUT OF THE REST.
   *
   * The saved list was already pruned correctly here, but the browser was then
   * cleared and sent to the front door regardless — so a customer signed into
   * two accounts who signed out of one was left signed out of both, holding a
   * saved session for the other that nothing would ever use again. The account
   * switcher exists precisely so an account you already hold is never
   * re-proven, and this discarded one every time it was used.
   *
   * Now the account being left is removed and, if another remains, it becomes
   * the current one. That is what a multi-account switcher means: you are
   * leaving THIS account, not the device.
   *
   * The move is deliberately visible rather than silent — a full load onto the
   * remaining account's own landing page, where the header shows who you now
   * are. Landing somewhere ambiguous while still signed in as somebody would be
   * worse than either outcome.
   */
  let remaining: StoredSession[] = [];
  try {
    const sessionsRaw = localStorage.getItem('sessions');
    const userRaw     = localStorage.getItem('user');
    if (sessionsRaw && userRaw) {
      remaining = sessionsAfterSignOut(JSON.parse(sessionsRaw), JSON.parse(userRaw)?.id);
      localStorage.setItem('sessions', JSON.stringify(remaining));
    }
  } catch {
    remaining = [];   // unreadable list — sign out fully rather than guess
  }

  if (remaining.length > 0) {
    const next = remaining[0];
    localStorage.setItem('token', next.token);
    localStorage.setItem('user', JSON.stringify(next.user));
    document.cookie = `auth_token=${next.token}; path=/; max-age=7776000; SameSite=Lax`;
    window.location.href = next.user?.is_admin ? '/admin' : '/';
    return;
  }

  localStorage.removeItem('token');
  localStorage.removeItem('user');
  document.cookie = 'auth_token=; path=/; max-age=0';
  window.location.href = to;
}

/** Hard-navigate to the correct page after login. */
export function redirectAfterLogin(isAdmin: boolean) {
  // window.location.href forces a full page reload — no React timing issues
  window.location.href = isAdmin ? '/admin' : '/';
}
