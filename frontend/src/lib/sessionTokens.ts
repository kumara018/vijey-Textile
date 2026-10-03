/**
 * Keep a saved account's token as fresh as the one in use.
 *
 * SESSION-01 (October 2026). The server renews a signed-in device's token on
 * activity (the X-New-Token header), and that renewal only ever reached
 * localStorage 'token'. The copy of the same account in the saved-accounts
 * list ('sessions') kept the token from the original sign-in, so switching
 * back to that account — or being moved to it on sign-out — used a token that
 * expired 30 days after the first sign-in however much it had been used since.
 *
 * WHICH ACCOUNT A RENEWAL BELONGS TO is read from the renewed token itself (its
 * `sub` claim), never from localStorage 'user'. A renewal belongs to whoever's
 * token SENT the request, and during a switch or a sign-out 'user' already
 * names the next account while the previous one's request is still in flight.
 * Matching on 'user' wrote one account's token into another's saved entry.
 *
 * No imports, so api.ts and the auth context can both use it.
 */

/** The account id a sign-in token belongs to: its `sub` claim, as the server writes it (a string). */
export function tokenSubject(token: string | null | undefined): string | null {
  if (!token) return null;
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const sub = JSON.parse(atob(padded))?.sub;
    return sub === undefined || sub === null ? null : String(sub);
  } catch {
    return null;
  }
}

/** Do these two tokens belong to the same account? */
export function sameAccount(a: string | null | undefined, b: string | null | undefined): boolean {
  const sa = tokenSubject(a);
  return sa !== null && sa === tokenSubject(b);
}

/** The saved list with `token` written into the entry for the account it belongs to. Order is kept. */
export function sessionsWithRenewedToken(sessions: unknown, token: string): unknown[] {
  if (!Array.isArray(sessions)) return [];
  const sub = tokenSubject(token);
  if (!sub) return sessions;
  return sessions.map((s) =>
    s && s.user && s.user.id !== undefined && s.user.id !== null && String(s.user.id) === sub ? { ...s, token } : s,
  );
}

/** Write a renewed token into its account's saved entry. Returns the new list, or null if storage failed. */
export function renewSavedToken(token: string): unknown[] | null {
  try {
    const stored = JSON.parse(localStorage.getItem('sessions') || '[]');
    const next = sessionsWithRenewedToken(stored, token);
    localStorage.setItem('sessions', JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

/**
 * SESSION-02. The saved accounts from the first one that still works.
 *
 * When the current account's token dies, the next saved account used to be
 * promoted and the page reloaded without asking whether IT still worked — so a
 * device with several long-idle accounts reloaded once per dead account, each
 * time showing the wrong person in the header, before reaching sign-in. Only a
 * definite 401 counts as dead; a network failure or a server error proves
 * nothing, so that account is kept.
 */
export async function keepFromFirstLive<T extends { token: string }>(
  list: T[],
  apiBase: string,
  fetchImpl: typeof fetch = fetch,
): Promise<T[]> {
  for (let i = 0; i < list.length; i++) {
    try {
      const r = await fetchImpl(`${apiBase}/api/auth/me`, { headers: { Authorization: `Bearer ${list[i].token}` } });
      if (r.status !== 401) return list.slice(i);
    } catch {
      return list.slice(i);
    }
  }
  return [];
}
