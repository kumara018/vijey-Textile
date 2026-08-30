import { describe, it, expect } from 'vitest';
import { sameKey } from '../push';

/**
 * Comparing a device's push subscription against the shop's current VAPID key.
 *
 * WHY THIS COMPARISON EXISTS AT ALL. A push subscription is permanently bound
 * to the VAPID key it was created with. Rotate the keys — which this shop did,
 * because the old private key had been exposed — and every existing
 * subscription becomes undeliverable. The push service answers 403 to those,
 * not 404 or 410, and the server cannot safely act on a 403: a misconfigured
 * VAPID subject produces exactly the same 403 for every device, so treating it
 * as "dead subscription" would delete every subscriber in the shop.
 *
 * Only the browser can tell the two apart, because only it can see which key
 * its own subscription was made with. This function is that check.
 *
 * BOTH WRONG ANSWERS COST SOMETHING. Report "different" when they match and
 * every page load retires a working subscription and makes a new one — churn
 * the customer never asked for. Report "same" when they differ and the
 * rotation goes undetected: the device holds a subscription that can never be
 * delivered to, the UI cheerfully says notifications are on, and pressing the
 * button changes nothing because the stale subscription is reused.
 *
 * The spelling cases below are not hypothetical tidiness. The server sends its
 * key base64url-encoded and unpadded; what comes back out of the browser's
 * `applicationServerKey` is raw bytes that have to be re-encoded, and the
 * obvious `btoa` produces standard base64 — different alphabet, with padding.
 * Two spellings of one key must not read as two keys.
 */

// A realistic pair: 87-character base64url, as /api/push/key returns.
const KEY_A = 'BGSDSN56P5lNq2vX8dYzR1tHc0mKfE7jWbQ4uLpA9sCgNvTiOyZxMdRk3PwUeIaHlBnFrGtJqSvXyZbCdEf';
const KEY_B = 'BHxKmQ2vR8tYzN1pWcJ7aEbLdFgHiOkSuTvXyZ3MnQpRsTuVwXyZaBcDeFgHiJkLmNoPqRsTuVwXyZ0123';

describe('sameKey — has this device been left on a rotated-away key?', () => {
  it('matches a key against itself', () => {
    expect(sameKey(KEY_A, KEY_A)).toBe(true);
  });

  it('separates two genuinely different keys', () => {
    // The case the whole fix exists for.
    expect(sameKey(KEY_A, KEY_B)).toBe(false);
  });

  it('ignores trailing padding', () => {
    // btoa pads; the server does not. Same key, two spellings.
    expect(sameKey('abcd', 'abcd==')).toBe(true);
    expect(sameKey('abcd=', 'abcd')).toBe(true);
  });

  it('treats standard base64 and base64url as the same key', () => {
    // `+` and `/` become `-` and `_`. Re-encoding raw bytes with btoa yields
    // the standard alphabet, so without this the comparison would report a
    // rotation on every key that happens to contain either character.
    expect(sameKey('ab+cd/ef', 'ab-cd_ef')).toBe(true);
    expect(sameKey('a+b/c=', 'a-b_c')).toBe(true);
  });

  it('does not treat different keys as equal just because they normalise', () => {
    // Guard against an over-eager implementation — stripping characters rather
    // than translating them would make these collide.
    expect(sameKey('ab-cd_ef', 'abcdef')).toBe(false);
  });

  it('is case sensitive, because base64 is', () => {
    expect(sameKey('AbCd', 'abcd')).toBe(false);
  });

  it('reports an empty key as different from a real one', () => {
    // A subscription with no applicationServerKey readable is not a match, and
    // must not be quietly accepted as one.
    expect(sameKey('', KEY_A)).toBe(false);
  });
});
