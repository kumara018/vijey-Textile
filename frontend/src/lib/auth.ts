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

/**
 * Sign out of the CURRENT account, and land wherever that leaves you.
 *
 * `to` is only used when this was the last account on the device. It once
 * existed for "Switch account", which was implemented as a sign-out with a
 * different destination; switching no longer signs anybody out of anything, so
 * both remaining callers are plain Sign out and neither passes it.
 */
export function performLogout(to: string = '/') {
  // Revoke the device session server-side (fire-and-forget).
  authAPI.logout().catch(() => {});

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
  let remaining: Array<{ token: string; user: { id?: number; is_admin?: boolean } }> = [];
  try {
    const sessionsRaw = localStorage.getItem('sessions');
    const userRaw     = localStorage.getItem('user');
    if (sessionsRaw && userRaw) {
      const sessions = JSON.parse(sessionsRaw);
      const current  = JSON.parse(userRaw);
      remaining = sessions.filter((s: any) => s?.token && s.user?.id !== current?.id);
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
