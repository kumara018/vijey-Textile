'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@/types';
import { authAPI, getApiBase } from '@/lib/api';

export interface SavedSession {
  token: string;
  user: User;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  sessions: SavedSession[];
  login: (token: string, user: User) => void;
  logout: () => void;
  switchAccount: (session: SavedSession) => Promise<void>;
  removeSession: (userId: number) => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  sessions: [],
  login: () => {},
  logout: () => {},
  switchAccount: async () => {},
  removeSession: () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,     setUser]     = useState<User | null>(null);
  const [token,    setToken]    = useState<string | null>(null);
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [loading,  setLoading]  = useState(true);

  // ── Restore state on mount + always refresh from API ─────────────────────
  useEffect(() => {
    const storedToken    = localStorage.getItem('token');
    const storedUser     = localStorage.getItem('user');
    const storedSessions = localStorage.getItem('sessions');

    let parsedSessions: SavedSession[] = [];
    if (storedSessions) {
      try { parsedSessions = JSON.parse(storedSessions); } catch {}
    }

    if (storedToken && storedUser) {
      // Apply cached data immediately so UI doesn't flicker
      setToken(storedToken);
      try { setUser(JSON.parse(storedUser)); } catch {}
      setSessions(parsedSessions);
      document.cookie = `auth_token=${storedToken}; path=/; max-age=7776000; SameSite=Lax`; // 90 days — mirrors backend ACCESS_TOKEN_EXPIRE_MINUTES

      // Always fetch fresh user data from server to pick up role changes (e.g. is_admin)
      const API = getApiBase();
      fetch(`${API}/api/auth/me`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      })
        .then(res => {
          if (!res.ok) return null;
          // Tokens issued before device-session tracking have no "sid" claim —
          // the backend silently upgrades them here so this device shows up
          // in Linked Devices without forcing a logout/login.
          const newToken = res.headers.get('X-New-Token');
          if (newToken) _applyRefreshedToken(newToken);
          return res.json();
        })
        .then(fresh => {
          if (!fresh) return;
          setUser(fresh);
          localStorage.setItem('user', JSON.stringify(fresh));
          // Keep all sessions in sync — update current user's entry
          setSessions(prev => {
            const updated = prev.map(s =>
              s.user.id === fresh.id ? { ...s, user: fresh } : s
            );
            localStorage.setItem('sessions', JSON.stringify(updated));
            return updated;
          });
        })
        .catch(() => {});
    } else {
      setSessions(parsedSessions);
    }

    setLoading(false);
  }, []);

  // ── Keep Render backend awake ─────────────────────────────────────────────
  useEffect(() => {
    const API = getApiBase();
    const ping = () => fetch(`${API}/health`, { method: 'GET' }).catch(() => {});
    ping();
    const iv = setInterval(ping, 14 * 60 * 1000);
    return () => clearInterval(iv);
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const _setCookie = (t: string) => {
    document.cookie = `auth_token=${t}; path=/; max-age=7776000; SameSite=Lax`; // 90 days — mirrors backend ACCESS_TOKEN_EXPIRE_MINUTES
  };
  // Swap in a server-issued token upgrade (see the X-New-Token header on /me) —
  // used to silently migrate pre-device-tracking tokens without a re-login.
  const _applyRefreshedToken = (newToken: string) => {
    localStorage.setItem('token', newToken);
    _setCookie(newToken);
    setToken(newToken);
  };
  const _clearCookie = () => {
    document.cookie = 'auth_token=; path=/; max-age=0';
  };
  const _persistSessions = (list: SavedSession[]) => {
    setSessions(list);
    localStorage.setItem('sessions', JSON.stringify(list));
  };

  // ── Login (also called after OTP verify) ──────────────────────────────────
  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    _setCookie(newToken);
    setToken(newToken);
    setUser(newUser);

    // Upsert this session — replace existing entry for same user, prepend otherwise
    setSessions(prev => {
      const without = prev.filter(s => s.user.id !== newUser.id);
      const updated = [{ token: newToken, user: newUser }, ...without];
      localStorage.setItem('sessions', JSON.stringify(updated));
      return updated;
    });
  };

  // ── Instant account switch — fetches fresh user data to pick up role changes ─
  const switchAccount = async (session: SavedSession) => {
    // Apply the token immediately so API calls use the right account
    localStorage.setItem('token', session.token);
    _setCookie(session.token);
    setToken(session.token);

    // Fetch fresh user data (picks up is_admin changes made after last login)
    let freshUser: User = session.user;
    try {
      const API = getApiBase();
      const res = await fetch(`${API}/api/auth/me`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (res.ok) freshUser = await res.json();
    } catch {}

    localStorage.setItem('user', JSON.stringify(freshUser));
    setUser(freshUser);

    // Bring switched account to front of list with fresh data
    setSessions(prev => {
      const others  = prev.filter(s => s.user.id !== session.user.id);
      const updated = [{ token: session.token, user: freshUser }, ...others];
      localStorage.setItem('sessions', JSON.stringify(updated));
      return updated;
    });
  };

  // ── Remove one saved session (without affecting the active one) ───────────
  const removeSession = (userId: number) => {
    setSessions(prev => {
      const updated = prev.filter(s => s.user.id !== userId);
      localStorage.setItem('sessions', JSON.stringify(updated));
      return updated;
    });
  };

  // ── Sign out current account only ────────────────────────────────────────
  // If other saved sessions exist → auto-switch to the next one (like Amazon/Google).
  // If no other sessions → fully log out.
  const logout = () => {
    // Revoke the device session server-side (fire-and-forget — never block
    // the local sign-out on a network round trip). Must pass the outgoing
    // account's token explicitly: this function switches localStorage's
    // 'token' to the next saved account (or clears it) before the request
    // interceptor's microtask actually reads localStorage, so relying on
    // the interceptor here would revoke the WRONG account's session — the
    // one being switched to, not the one being signed out of.
    authAPI.logout(token || undefined).catch(() => {});

    const currentId = user?.id;
    const remaining = sessions.filter(s => s.user.id !== currentId);

    // Always update sessions list (remove signed-out account)
    setSessions(remaining);
    localStorage.setItem('sessions', JSON.stringify(remaining));

    if (remaining.length > 0) {
      // Switch to the next saved account seamlessly
      const next = remaining[0];
      localStorage.setItem('token', next.token);
      localStorage.setItem('user', JSON.stringify(next.user));
      _setCookie(next.token);
      setToken(next.token);
      setUser(next.user);
    } else {
      // No other saved accounts — full sign-out
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      _clearCookie();
      setToken(null);
      setUser(null);
    }
  };

  // ── Refresh current user from API ─────────────────────────────────────────
  // Only logout on 401 (token truly invalid). Keep user logged in for
  // network errors, server restarts, timeouts, 5xx — they are temporary.
  const refresh = async () => {
    try {
      const res = await authAPI.getMe();
      const newToken = res.headers?.['x-new-token'];
      if (newToken) _applyRefreshedToken(newToken);
      const fresh = res.data as User;
      setUser(fresh);
      localStorage.setItem('user', JSON.stringify(fresh));
      setSessions(prev => {
        const updated = prev.map(s =>
          s.user.id === fresh.id ? { ...s, user: fresh } : s
        );
        localStorage.setItem('sessions', JSON.stringify(updated));
        return updated;
      });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        // Token is genuinely invalid or expired — sign out
        logout();
      }
      // Any other error (network, timeout, 503, 500) → keep user logged in
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, sessions, login, logout, switchAccount, removeSession, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
