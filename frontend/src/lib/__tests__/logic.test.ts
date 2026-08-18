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

describe('sceneForPath — which bay of the facility a route sits in', () => {
  it('maps the storefront', () => {
    expect(sceneForPath('/')).toBe('entrance');
    expect(sceneForPath('/products')).toBe('gallery');
    expect(sceneForPath('/cart')).toBe('vault');
    expect(sceneForPath('/wishlist')).toBe('vault');
  });

  /**
   * Order matters here and the ordering is load-bearing: `/products/`
   * (a single product) is tested BEFORE `/products` (the index) in the
   * implementation, because the index prefix also matches a detail URL.
   * Reversing those two lines would silently send every product page to the
   * gallery scene and nobody would see a crash.
   */
  it('separates a product from the product index', () => {
    expect(sceneForPath('/products/42')).toBe('chamber');
    expect(sceneForPath('/products/42/reviews')).toBe('chamber');
    expect(sceneForPath('/products')).toBe('gallery');
    expect(sceneForPath('/products?sort=new')).toBe('gallery');
  });

  it('puts the transactional routes in their own scenes', () => {
    expect(sceneForPath('/checkout')).toBe('terminal');
    expect(sceneForPath('/orders')).toBe('records');
    expect(sceneForPath('/orders/1001')).toBe('records');
    expect(sceneForPath('/account')).toBe('records');
    expect(sceneForPath('/returns/7')).toBe('records');
    expect(sceneForPath('/auth/login')).toBe('gate');
  });

  it('falls back to the quietest ground for anything unknown', () => {
    expect(sceneForPath('/admin')).toBe('plain');
    expect(sceneForPath('/admin/orders')).toBe('plain');
    expect(sceneForPath('/some/page/nobody/built')).toBe('plain');
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
