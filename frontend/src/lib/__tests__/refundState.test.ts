import { describe, it, expect } from 'vitest';
import { REFUND_NOTE, canRefund, isPrepaid } from '../refundState';

/** PAY-01: the workroom must say where a cancelled order's money is, and offer a refund only when one is due. */
describe('refund state', () => {
  const order = (payment_status: string, extra: Record<string, string> = {}) =>
    ({ status: 'cancelled', payment_method: 'razorpay', payment_status, ...extra });

  it('offers a refund when the money was kept or a refund failed', () => {
    expect(canRefund(order('paid'))).toBe(true);
    expect(canRefund(order('refund_failed'))).toBe(true);
  });

  it('never offers one twice, for cash on delivery, or for a live order', () => {
    expect(canRefund(order('refund_initiated'))).toBe(false);
    expect(canRefund(order('refunded'))).toBe(false);
    expect(canRefund(order('paid', { payment_method: 'cod' }))).toBe(false);
    expect(canRefund(order('paid', { status: 'confirmed' }))).toBe(false);
  });

  it('names every state it can be in', () => {
    for (const s of ['paid', 'refund_failed', 'refund_initiated', 'refunded']) expect(REFUND_NOTE[s]).toBeTruthy();
    expect(isPrepaid({ payment_method: 'cod' })).toBe(false);
    expect(isPrepaid({})).toBe(false);
  });
});
