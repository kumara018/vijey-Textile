'use client';

import Link from 'next/link';
import { ActionButton, ActionLink } from '@/components/system/Action';
import { STORE } from '@/lib/config';

/**
 * Every way a payment can end, designed.
 *
 * D1 was a missing state: a declined card produced no response at all. The
 * customer pressed pay, the Razorpay modal closed, and the page sat there —
 * so they either tried again (risking a double charge in their mind) or left.
 * That cost real sales.
 *
 * The lesson is not "add a declined banner". It is that a payment has SEVERAL
 * terminal states and each one means something different about the customer's
 * money. Collapsing them into one "payment failed" message is the same bug in
 * a politer form, because the single most urgent question — *have I been
 * charged?* — has a different answer in each case.
 *
 *   dismissed   nothing happened. No charge, no order, nothing to undo.
 *   declined    the bank refused. No charge, no order.
 *   unverified  money MAY have left. We could not confirm the signature.
 *   orphaned    money DID leave, and the order did not get created.
 *
 * The first two are reassuring and offer a retry. The last two are not
 * reassuring and must not pretend to be: they surface the payment id and tell
 * the customer to contact the shop, because that id is what makes a refund
 * findable. Telling someone "please try again" when their money is already
 * gone is how a payment problem becomes a trust problem.
 */

/**
 * `paymentId` is `string | null | undefined` rather than `string?` because the
 * contract type says so: PaymentDetailsPayload.razorpay_payment_id is
 * nullable, and Razorpay's failure metadata may omit it entirely. Narrowing it
 * here would only move the lie one file further from the API.
 */
export type Outcome =
  | { kind: 'dismissed' }
  | { kind: 'declined'; description: string; reason?: string | null; paymentId?: string | null }
  | { kind: 'unverified'; paymentId?: string | null }
  | { kind: 'orphaned'; paymentId?: string | null; detail?: string }
  | { kind: 'offline' };

/** True when the customer's money may have moved. Changes the whole tone. */
export function isMoneyAtRisk(o: Outcome): boolean {
  return o.kind === 'unverified' || o.kind === 'orphaned';
}

export default function PaymentOutcome({
  outcome,
  onRetry,
  retrying,
}: {
  outcome: Outcome;
  onRetry: () => void;
  retrying: boolean;
}) {
  const atRisk = isMoneyAtRisk(outcome);

  const copy: Record<Outcome['kind'], { eyebrow: string; title: string; body: React.ReactNode }> = {
    dismissed: {
      eyebrow: 'Payment cancelled',
      title: 'You closed the payment window',
      body: 'Nothing has been charged and no order was placed. Your bag is exactly as you left it.',
    },
    declined: {
      eyebrow: 'Payment declined',
      title: 'Your bank did not approve that payment',
      body: (
        <>
          <strong className="text-paper">You have not been charged and no order was placed.</strong>{' '}
          Your bag is untouched. This is usually a limit, an expired card, or a bank block on
          online payments — trying a different card or UPI normally works.
        </>
      ),
    },
    unverified: {
      eyebrow: 'Needs checking',
      title: 'We could not confirm that payment',
      body: (
        <>
          The payment may have gone through, so <strong className="text-paper">please do not
          pay again yet.</strong> Send us the reference below and we will check it and either
          complete your order or refund you the same day.
        </>
      ),
    },
    orphaned: {
      eyebrow: 'Needs our attention',
      title: 'Your payment went through, but the order did not save',
      body: (
        <>
          <strong className="text-paper">Your money has left your account and we can see it.</strong>{' '}
          The order record failed to save, which is our fault, not yours. Send us the reference
          below and we will either place the order at the same price or refund you in full.
        </>
      ),
    },
    offline: {
      eyebrow: 'No connection',
      title: 'You appear to be offline',
      body: 'Nothing has been charged and no order was placed. Reconnect and try again — your bag is safe.',
    },
  };

  const c = copy[outcome.kind];
  const paymentId =
    'paymentId' in outcome ? outcome.paymentId : undefined;

  return (
    <div
      // assertive: this replaces the action the customer just took and answers
      // the question they are already asking.
      role="alert"
      aria-live="assertive"
      className={`border-t pt-8 ${atRisk ? 'border-brass-bright' : 'border-ink-edge'}`}
    >
      <p className="text-rule uppercase text-brass-bright">{c.eyebrow}</p>
      <h2 className="mt-4 max-w-[24ch] font-display text-band font-light text-paper">{c.title}</h2>
      <p className="mt-5 max-w-[54ch] text-lede text-paper-muted">{c.body}</p>

      {outcome.kind === 'declined' && outcome.description && (
        <p className="mt-4 max-w-[54ch] text-sm text-paper-faint">
          Your bank said: “{outcome.description}”
        </p>
      )}

      {paymentId && (
        <dl className="mt-7 border-t border-ink-edge/60 pt-5">
          <dt className="text-rule uppercase text-paper-faint">Payment reference</dt>
          <dd className="mt-2 select-all font-mono text-sm tabular-nums text-paper">{paymentId}</dd>
        </dl>
      )}

      <div className="mt-9 flex flex-wrap items-center gap-x-10 gap-y-5">
        {/* A retry is only offered where retrying is SAFE. When money may
            already have moved, the primary action is to talk to a person. */}
        {!atRisk ? (
          <>
            <ActionButton onClick={onRetry} disabled={retrying}>
              {retrying ? 'Opening…' : 'Try payment again'}
            </ActionButton>
            <ActionLink href="/cart" tone="quiet">
              Back to your bag
            </ActionLink>
          </>
        ) : (
          <>
            <a
              href={`tel:${STORE.phone1}`}
              className="group inline-flex items-baseline gap-4 border-b border-brass/70 pb-2 text-caption uppercase text-paper transition-colors duration-500 hover:border-brass-bright motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
            >
              Call {STORE.phone1}
            </a>
            <Link
              href="/support#contact"
              className="text-caption uppercase text-paper-faint transition-colors duration-500 hover:text-paper motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
            >
              Other ways to reach us
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
