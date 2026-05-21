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

export function performLogout() {
  // Remove only the active session from saved sessions list
  try {
    const sessionsRaw = localStorage.getItem('sessions');
    const userRaw     = localStorage.getItem('user');
    if (sessionsRaw && userRaw) {
      const sessions  = JSON.parse(sessionsRaw);
      const current   = JSON.parse(userRaw);
      const updated   = sessions.filter((s: any) => s.user?.id !== current?.id);
      localStorage.setItem('sessions', JSON.stringify(updated));
    }
  } catch {}
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  document.cookie = 'auth_token=; path=/; max-age=0';
  window.location.href = '/';
}

/** Hard-navigate to the correct page after login. */
export function redirectAfterLogin(isAdmin: boolean) {
  // window.location.href forces a full page reload — no React timing issues
  window.location.href = isAdmin ? '/admin' : '/';
}
