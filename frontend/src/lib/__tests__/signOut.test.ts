import { describe, it, expect } from 'vitest';
import { sessionsAfterSignOut } from '../auth';

/**
 * Which accounts survive signing out of one of them.
 *
 * WHY THIS IS TESTED AT ALL. The same defect has been shipped three times, and
 * every one of them looked different in the code while producing one symptom:
 * sign out of one account, lose both.
 *
 *   1. The saved list was pruned correctly and then the browser was cleared
 *      anyway, so the survivor was orphaned — held in storage, never used.
 *   2. A 401 on any request removed the entire list, so one expired token
 *      signed the customer out of every account they held.
 *   3. The server-side revoke was sent without an explicit token, so the
 *      request interceptor filled in whatever localStorage held by the time it
 *      ran — the account being switched TO — and killed the wrong session.
 *
 * None of those could be caught by a test, because the decision was tangled up
 * with localStorage, document.cookie and a redirect. It is a pure function now,
 * so the part that keeps being wrong is the part that is pinned.
 *
 * What it protects is not a nicety. The account switcher exists so that an
 * account you already hold is never re-proven; a bug here means a customer
 * types two sets of credentials to get back to where they were.
 */

const VIJEY = { token: 't-vijey', user: { id: 1, is_admin: false } };
const ADMIN = { token: 't-admin', user: { id: 2, is_admin: true } };
const THIRD = { token: 't-third', user: { id: 3, is_admin: false } };

describe('sessionsAfterSignOut', () => {
  it('keeps the other account when you sign out of one', () => {
    // The exact case reported: signed into a customer account and an admin
    // account, signed out of the customer, and lost both.
    expect(sessionsAfterSignOut([VIJEY, ADMIN], 1)).toEqual([ADMIN]);
  });

  it('keeps every other account, not just the first', () => {
    expect(sessionsAfterSignOut([VIJEY, ADMIN, THIRD], 2)).toEqual([VIJEY, THIRD]);
  });

  it('preserves order, so the next account is predictable', () => {
    // performLogout promotes remaining[0]. If order were not stable, signing
    // out would land you on a different account each time.
    expect(sessionsAfterSignOut([THIRD, ADMIN, VIJEY], 2)).toEqual([THIRD, VIJEY]);
  });

  it('returns nothing when the account leaving was the only one', () => {
    // Then, and only then, performLogout signs the device out properly.
    expect(sessionsAfterSignOut([VIJEY], 1)).toEqual([]);
  });

  it('removes the account by id, not by position', () => {
    expect(sessionsAfterSignOut([VIJEY, ADMIN], 2)).toEqual([VIJEY]);
  });

  it('drops entries with no usable token', () => {
    // A session that cannot authenticate is not an account you are signed into.
    // Promoting one would land the customer on a page that immediately signs
    // them out again — the failure looks identical to the bug being fixed.
    const broken = [{ token: '', user: { id: 9 } }, { user: { id: 8 } }, ADMIN];
    expect(sessionsAfterSignOut(broken, 1)).toEqual([ADMIN]);
  });

  it('survives a corrupted list rather than throwing', () => {
    // localStorage is editable by anyone with the console open, and a throw
    // here would leave the customer unable to sign out at all.
    expect(sessionsAfterSignOut(null, 1)).toEqual([]);
    expect(sessionsAfterSignOut('not an array', 1)).toEqual([]);
    expect(sessionsAfterSignOut([null, undefined, ADMIN], 1)).toEqual([ADMIN]);
  });

  it('keeps everything when the current user cannot be identified', () => {
    // Better to leave the list alone than to guess and delete the wrong row.
    expect(sessionsAfterSignOut([VIJEY, ADMIN], undefined)).toEqual([VIJEY, ADMIN]);
  });
});
