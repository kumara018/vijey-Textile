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
