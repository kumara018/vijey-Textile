import { describe, it, expect } from 'vitest';
import { sessionsAfterSignIn, sessionsAfterSignOut } from '../auth';

/**
 * Which accounts are held after signing into one, or switching to one.
 *
 * THE FAULT THIS PINS. Signing in as a second account did not save that
 * account. `token` and `user` were written to localStorage directly, so the
 * customer looked signed in and was — but the entry never reached `sessions`,
 * because that write sat inside a `setSessions(prev => …)` updater that React
 * defers to the next render, and the next statement was a full page
 * navigation. The navigation won.
 *
 * The symptom was reported as "switching account signs out the current
 * account", and that is exactly what it did: the account you were using was
 * missing from the list, so the moment you switched to another one it was gone
 * for good, password and emailed code required to get back in.
 *
 * The decision is a pure function now, computed from what is in storage, so
 * the part that was wrong is the part that is tested.
 */

const CUSTOMER = { token: 't-customer', user: { id: 1, is_admin: false } };
const ADMIN    = { token: 't-admin',    user: { id: 2, is_admin: true  } };
const THIRD    = { token: 't-third',    user: { id: 3, is_admin: false } };

describe('sessionsAfterSignIn', () => {
  it('saves the account that just signed in', () => {
    // The whole bug in one line: this used to end up empty.
    expect(sessionsAfterSignIn([], CUSTOMER)).toEqual([CUSTOMER]);
  });

  it('keeps the account already held when a second one signs in', () => {
    expect(sessionsAfterSignIn([CUSTOMER], ADMIN)).toEqual([ADMIN, CUSTOMER]);
  });

  it('puts the newest account first, because that is the one now in use', () => {
    expect(sessionsAfterSignIn([CUSTOMER, ADMIN], THIRD))
      .toEqual([THIRD, CUSTOMER, ADMIN]);
  });

  it('replaces an account rather than listing it twice', () => {
    // Signing back into an account already held — or switching to it, which
    // refreshes its token. Two rows for one person would show the same name
    // twice in the switcher and leave a stale token behind one of them.
    const refreshed = { token: 't-customer-2', user: { id: 1, is_admin: false } };
    expect(sessionsAfterSignIn([CUSTOMER, ADMIN], refreshed))
      .toEqual([refreshed, ADMIN]);
  });

  it('survives a corrupted or absent list rather than throwing', () => {
    // localStorage is editable by anyone with the console open, and a throw
    // here would happen mid-sign-in, after the token was already written.
    expect(sessionsAfterSignIn(null, CUSTOMER)).toEqual([CUSTOMER]);
    expect(sessionsAfterSignIn('not an array', CUSTOMER)).toEqual([CUSTOMER]);
    expect(sessionsAfterSignIn([null, undefined, ADMIN], CUSTOMER))
      .toEqual([CUSTOMER, ADMIN]);
  });

  it('drops rows with no usable token while saving the new one', () => {
    const broken = [{ token: '', user: { id: 9 } }, { user: { id: 8 } }, ADMIN];
    expect(sessionsAfterSignIn(broken, CUSTOMER)).toEqual([CUSTOMER, ADMIN]);
  });

  it('refuses to add an entry that has no token', () => {
    // A row that cannot authenticate is not an account you are signed into.
    // Adding one would put a dead entry at the front of the switcher, which is
    // the position performLogout promotes.
    expect(sessionsAfterSignIn([ADMIN], { token: '', user: { id: 5 } }))
      .toEqual([ADMIN]);
  });
});

describe('signing in then switching away', () => {
  it('leaves the first account reachable — the reported bug, end to end', () => {
    // Sign in as the customer, then as the admin, then switch back.
    let saved = sessionsAfterSignIn([], CUSTOMER);
    saved = sessionsAfterSignIn(saved, ADMIN);

    // Both are held, so the switcher can offer the customer account.
    expect(saved.map((s) => s.user.id).sort()).toEqual([1, 2]);

    // Switching back must not cost the admin session.
    const afterSwitch = sessionsAfterSignIn(saved, CUSTOMER);
    expect(afterSwitch.map((s) => s.user.id).sort()).toEqual([1, 2]);
    expect(afterSwitch[0]).toEqual(CUSTOMER);
  });

  it('still signs out of only one account when asked to', () => {
    // The two functions share a list; this guards the seam between them.
    const saved = sessionsAfterSignIn(sessionsAfterSignIn([], CUSTOMER), ADMIN);
    expect(sessionsAfterSignOut(saved, 2)).toEqual([CUSTOMER]);
  });
});
