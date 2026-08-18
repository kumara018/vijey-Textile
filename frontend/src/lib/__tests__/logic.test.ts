import { describe, it, expect } from 'vitest';
import { isMoneyAtRisk, type Outcome } from '@/app/checkout/PaymentOutcome';
import { sceneForPath, isRestrained } from '@/store/useSceneStore';

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
describe('sceneForPath — the scene is the entrance, and nowhere else', () => {
  it('gives the homepage the entrance', () => {
    expect(sceneForPath('/')).toBe('entrance');
  });

  it('gives every other route the quiet ground', () => {
    const elsewhere = [
      '/products',
      '/products?sort=new',
      '/products/42',
      '/products/42/reviews',
      '/cart',
      '/wishlist',
      '/checkout',
      '/orders',
      '/orders/1001',
      '/account',
      '/returns/7',
      '/auth/login',
      '/admin',
      '/admin/orders',
      '/some/page/nobody/built',
    ];
    for (const path of elsewhere) {
      expect(sceneForPath(path)).toBe('plain');
    }
  });

  /**
   * The homepage match is exact, not a prefix. `/products` starts with `/`,
   * so a `startsWith('/')` here would hand the entrance scene to the entire
   * site — which is the failure mode this whole change exists to avoid.
   */
  it('matches the homepage exactly rather than by prefix', () => {
    expect(sceneForPath('/')).toBe('entrance');
    expect(sceneForPath('/anything')).toBe('plain');
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
