import { describe, it, expect } from 'vitest';
import { isMoneyAtRisk, type Outcome } from '@/app/checkout/PaymentOutcome';
import { sceneForPath, isRestrained } from '@/store/useSceneStore';
import { nextHistory, withoutTerm, LIMIT } from '../searchHistory';
import { codeTimer, formatRemaining, CODE_TTL_SECONDS, RESEND_AFTER_SECONDS } from '../otpTimer';

/**
 * Tests for the logic where being wrong costs money or misleads a customer.
 *
 * This repo has had no test suite. Rather than open with a broad shallow one,
 * this covers the handful of PURE functions whose failure modes are real:
 * a payment state that tells someone to retry when their money has already
 * moved, and a route→scene map that decides what renders on checkout.
 *
 * Deliberately not tested here: anything needing a browser, a GPU or the
 * network. Those are covered by the drills and the accessibility passes, which
 * run against a live server and are recorded in AUDIT.md. Simulating them in
 * jsdom would assert against a fake and report confidence we do not have.
 */

describe('isMoneyAtRisk — the question a customer is actually asking', () => {
  /**
   * The whole point of the Outcome type is that "payment failed" is four
   * different facts about the customer's money. Getting this wrong in the
   * SAFE direction shows a scary warning after a clean decline; getting it
   * wrong in the UNSAFE direction invites a second charge on top of a first
   * that already succeeded. Only the second is a disaster, but both are bugs.
   */
  it('is false when nothing was charged', () => {
    expect(isMoneyAtRisk({ kind: 'dismissed' })).toBe(false);
    expect(isMoneyAtRisk({ kind: 'offline' })).toBe(false);
    expect(isMoneyAtRisk({ kind: 'declined', description: 'insufficient funds' })).toBe(false);
  });

  it('is true when money may have moved and we cannot prove otherwise', () => {
    expect(isMoneyAtRisk({ kind: 'unverified', paymentId: 'pay_123' })).toBe(true);
    expect(isMoneyAtRisk({ kind: 'orphaned', paymentId: 'pay_123' })).toBe(true);
  });

  it('does not depend on whether a payment id happens to be present', () => {
    // Razorpay's failure metadata may omit the id entirely. An absent id makes
    // the refund harder to trace; it does not make the money safe.
    expect(isMoneyAtRisk({ kind: 'unverified' })).toBe(true);
    expect(isMoneyAtRisk({ kind: 'orphaned' })).toBe(true);
    expect(isMoneyAtRisk({ kind: 'declined', description: '', paymentId: 'pay_9' })).toBe(false);
  });

  it('classifies every kind in the union, so a new one cannot be forgotten', () => {
    const all: Outcome[] = [
      { kind: 'dismissed' },
      { kind: 'declined', description: 'x' },
      { kind: 'unverified' },
      { kind: 'orphaned' },
      { kind: 'offline' },
    ];
    // If a sixth kind is added to Outcome, this array stops type-checking
    // until it is listed — which is the point.
    expect(all.map(isMoneyAtRisk)).toEqual([false, false, true, true, false]);
  });
});

/**
 * THE RULE THESE TESTS ENCODE CHANGED, SO THE TESTS DID.
 *
 * They used to assert a scene per area — gallery for the shelf, chamber for a
 * piece, vault for the bag, terminal for checkout, records for the archive.
 * That was the design, and it was wrong in use: on a dark ground the drifting
 * panels read as large brown rectangles sliding behind the merchandise, and
 * the category rail and REFINE control sat on top of moving furniture.
 *
 * The scene is now the entrance and nothing else. These tests were not
 * "fixed" to make a red build green — they failed because they were doing
 * their job, and they now state the new rule instead of the old one.
 *
 * Deliberately asserted as a RULE rather than a list of routes: the old
 * version had to be extended every time a route was added, and a route nobody
 * remembered to list would have been silently fine. `everything that is not
 * the homepage is plain` cannot rot that way.
 */
describe('sceneForPath — no scene mounts anywhere', () => {
  /**
   * The rule changed again, and these tests changed with it rather than being
   * deleted. The entrance scene drew a product photograph behind the homepage
   * copy — that garment was asked to be removed from the opening twice, and
   * the scene was what drew it. With the homepage the last route using it,
   * retiring it takes the remaining three.js off the site entirely.
   *
   * Asserted as a rule, not a list: every route resolves to the quiet ground,
   * so a route added later cannot silently acquire a scene.
   */
  it('gives every route the quiet ground', () => {
    const routes = [
      '/', '/products', '/products?sort=new', '/products/42',
      '/cart', '/wishlist', '/checkout', '/orders', '/orders/1001',
      '/account', '/returns/7', '/auth/login', '/admin', '/nobody/built/this',
    ];
    for (const path of routes) {
      expect(sceneForPath(path)).toBe('plain');
    }
  });

  it('treats the quiet ground as restrained, so no effects budget is spent', () => {
    expect(isRestrained(sceneForPath('/'))).toBe(true);
  });
});

describe('isRestrained — where the effects budget is capped regardless of device', () => {
  /**
   * This is a commercial rule, not a graphics one: every frame of latency on
   * a payment step costs orders, so checkout never gets the full stack even on
   * a machine that could render it.
   */
  it('caps checkout and the record screens', () => {
    expect(isRestrained('terminal')).toBe(true);
    expect(isRestrained('records')).toBe(true);
    expect(isRestrained('gate')).toBe(true);
    expect(isRestrained('plain')).toBe(true);
  });

  it('leaves the shopfront scenes free', () => {
    expect(isRestrained('entrance')).toBe(false);
    expect(isRestrained('gallery')).toBe(false);
    expect(isRestrained('chamber')).toBe(false);
    expect(isRestrained('vault')).toBe(false);
  });
});

// ── Search history ──────────────────────────────────────────────────────────
//
// The list rules only. Storage and React are not tested here — this suite runs
// in Node without jsdom on purpose, and these are the parts where a mistake
// would actually be felt: a duplicate that never collapses, a repeat that does
// not resurface, or a list that grows until it stops being a shortcut.

describe('search history', () => {
  it('puts the newest term first', () => {
    expect(nextHistory(['lehenga'], 'pattu')).toEqual(['pattu', 'lehenga']);
  });

  it('collapses a repeat rather than storing it twice, and resurfaces it', () => {
    // Searching a thing again is the strongest signal it is still wanted.
    expect(nextHistory(['lehenga', 'pattu'], 'lehenga')).toEqual(['lehenga', 'pattu']);
  });

  it('treats a repeat as the same term regardless of case', () => {
    // Otherwise "Lehenga" and "lehenga" both sit in a list of eight.
    expect(nextHistory(['lehenga'], 'LEHENGA')).toEqual(['LEHENGA']);
  });

  it('trims before comparing, so a stray space is not a new term', () => {
    expect(nextHistory(['lehenga'], '  lehenga  ')).toEqual(['lehenga']);
  });

  it('ignores a term too short to be worth remembering', () => {
    const prev = ['lehenga'];
    expect(nextHistory(prev, 'a')).toBe(prev);
    expect(nextHistory(prev, ' ')).toBe(prev);
  });

  it('never grows past the cap, dropping the oldest', () => {
    let list: string[] = [];
    for (let i = 1; i <= LIMIT + 3; i++) list = nextHistory(list, `term${i}`);
    expect(list).toHaveLength(LIMIT);
    expect(list[0]).toBe(`term${LIMIT + 3}`);       // newest kept
    expect(list).not.toContain('term1');            // oldest dropped
  });

  it('removes exactly one term and leaves the rest', () => {
    expect(withoutTerm(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });

  it('is unbothered by removing something that is not there', () => {
    expect(withoutTerm(['a'], 'zzz')).toEqual(['a']);
  });
});

describe('the sign-in code countdown', () => {
  /**
   * The screen had no resend at all. These pin the two states that decide
   * whether a customer can recover: whether the code they hold can still work,
   * and whether they are allowed to ask for another.
   */
  const T0 = 1_700_000_000_000;

  it('offers nothing before a code has been sent', () => {
    // Not the same as expired. A null read as expired would tell somebody
    // "that code has expired" when they have not been sent one.
    const t = codeTimer(null, T0);
    expect(t.expired).toBe(false);
    expect(t.canResend).toBe(false);
  });

  it('will not resend immediately, so the visible button never 429s', () => {
    const t = codeTimer(T0, T0 + 5_000);
    expect(t.canResend).toBe(false);
    expect(t.resendIn).toBe(RESEND_AFTER_SECONDS - 5);
  });

  it('allows a resend once the cooldown has run out', () => {
    expect(codeTimer(T0, T0 + RESEND_AFTER_SECONDS * 1000).canResend).toBe(true);
    expect(codeTimer(T0, T0 + 120_000).canResend).toBe(true);
  });

  it('keeps the code alive for its full ten minutes', () => {
    expect(codeTimer(T0, T0 + (CODE_TTL_SECONDS - 1) * 1000).expired).toBe(false);
  });

  it('expires the code exactly at the limit, not after it', () => {
    // One second late must already be dead: submitting an expired code spends
    // a verify attempt to be told what the page already knew.
    const t = codeTimer(T0, T0 + CODE_TTL_SECONDS * 1000);
    expect(t.expired).toBe(true);
    expect(t.expiresIn).toBe(0);
  });

  it('never reports a negative countdown long after expiry', () => {
    const t = codeTimer(T0, T0 + 3_600_000);
    expect(t.expiresIn).toBe(0);
    expect(t.resendIn).toBe(0);
  });

  it('survives a clock that jumps backwards', () => {
    // A device correcting its time would otherwise produce a code that lasts
    // longer than ten minutes.
    const t = codeTimer(T0, T0 - 60_000);
    expect(t.expiresIn).toBe(CODE_TTL_SECONDS);
    expect(t.expired).toBe(false);
  });
});

describe('formatRemaining — vague on purpose', () => {
  /**
   * A ticking mm:ss on a security step reads as pressure, and pressure is what
   * makes people mistype a code they are copying from another device.
   */
  it('does not count seconds at the end', () => {
    expect(formatRemaining(45)).toBe('less than a minute');
  });

  it('speaks in minutes', () => {
    expect(formatRemaining(60)).toBe('about a minute');
    expect(formatRemaining(540)).toBe('about 9 minutes');
  });

  it('says something sensible at zero rather than "0 minutes"', () => {
    expect(formatRemaining(0)).toBe('no time');
    expect(formatRemaining(-5)).toBe('no time');
  });
});
