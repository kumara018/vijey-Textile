import { describe, it, expect, vi } from 'vitest';
import { keepFromFirstLive, sameAccount, sessionsWithRenewedToken, tokenSubject } from '../sessionTokens';

/** A token shaped like the server's: header.payload.signature, with `sub` written as a string. */
const tok = (sub: string | number, salt = '') => {
  const enc = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub: String(sub), sid: `s${salt}`, exp: 1 })}.sig${salt}`;
};

describe('tokenSubject and sameAccount', () => {
  it('reads the account from the token', () => {
    expect(tokenSubject(tok(42))).toBe('42');
    expect(sameAccount(tok(42, 'a'), tok(42, 'b'))).toBe(true);
    expect(sameAccount(tok(42), tok(7))).toBe(false);
  });

  it('never matches something it cannot read', () => {
    expect(tokenSubject('garbage')).toBeNull();
    expect(tokenSubject(null)).toBeNull();
    expect(sameAccount(null, null)).toBe(false);
    expect(sameAccount('x.y.z', 'x.y.z')).toBe(false);
  });
});

/** SESSION-01: a renewed token reaches the saved copy of ITS account, and only that one. */
describe('sessionsWithRenewedToken', () => {
  const saved = [
    { token: tok(1, 'old'), user: { id: 1 } },
    { token: tok(2, 'old'), user: { id: 2 } },
  ];

  it('renews the account the token belongs to and leaves the others alone', () => {
    const fresh = tok(1, 'new');
    expect(sessionsWithRenewedToken(saved, fresh)).toEqual([
      { token: fresh, user: { id: 1 } },
      saved[1],
    ]);
  });

  it('a late renewal for the account being left never lands in the next one', () => {
    // Signing out of 1 already made 2 the current account; 1 is gone from the list.
    const afterSignOut = [saved[1]];
    expect(sessionsWithRenewedToken(afterSignOut, tok(1, 'late'))).toEqual(afterSignOut);
  });

  it('keeps the order, and survives bad input', () => {
    const out = sessionsWithRenewedToken(saved, tok(2, 'new')) as typeof saved;
    expect(out.map((s) => s.user.id)).toEqual([1, 2]);
    expect(sessionsWithRenewedToken(saved, 'not-a-token')).toEqual(saved);
    expect(sessionsWithRenewedToken('not a list', tok(1))).toEqual([]);
  });
});

/** SESSION-02: promote only an account that still works. */
describe('keepFromFirstLive', () => {
  const list = [{ token: 'dead1' }, { token: 'dead2' }, { token: 'live' }, { token: 'unchecked' }];
  const answer = (statusFor: Record<string, number>) =>
    vi.fn(async (_url: unknown, init?: { headers?: Record<string, string> }) => {
      const t = (init?.headers?.Authorization || '').replace('Bearer ', '');
      return new Response('{}', { status: statusFor[t] ?? 200 });
    }) as unknown as typeof fetch;

  it('drops the dead ones in front and keeps the rest', async () => {
    const out = await keepFromFirstLive(list, 'https://api', answer({ dead1: 401, dead2: 401 }));
    expect(out.map((s) => s.token)).toEqual(['live', 'unchecked']);
  });

  it('returns nothing when every account is dead', async () => {
    expect(await keepFromFirstLive(list, 'https://api', answer({ dead1: 401, dead2: 401, live: 401, unchecked: 401 }))).toEqual([]);
  });

  it('a server error or a network failure is not proof of death', async () => {
    expect((await keepFromFirstLive(list, 'https://api', answer({ dead1: 500 }))).length).toBe(4);
    const offline = vi.fn(async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    expect((await keepFromFirstLive(list, 'https://api', offline)).length).toBe(4);
  });
});
