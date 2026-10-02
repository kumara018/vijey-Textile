/**
 * Where a cancelled order's money is.
 *
 * The workroom showed no payment state at all, so a cancelled prepaid order
 * whose refund had failed looked exactly like one that had been refunded
 * (PAY-01, October 2026 test pass). Shared by the Orders and Cancelled
 * screens so the two can never describe the same order differently.
 */
type Paid = { status?: string; payment_method?: string; payment_status?: string };

export const REFUND_NOTE: Record<string, string> = {
  paid: 'Paid — not refunded',
  refund_failed: 'Refund failed',
  refund_initiated: 'Refund on its way',
  refunded: 'Refunded',
};

export const isPrepaid = (o: Paid) => !!o.payment_method && o.payment_method !== 'cod';

/** Cancelled, prepaid, and the money is not already on its way back. */
export const canRefund = (o: Paid) =>
  o.status === 'cancelled' && isPrepaid(o) && ['paid', 'refund_failed'].includes(o.payment_status ?? '');
