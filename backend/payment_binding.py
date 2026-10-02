"""
Which payment pays for what.

WHY THIS EXISTS (PAY-04 and PAY-05, October 2026 test pass).

Placing an order checked that the Razorpay payment was genuine — the HMAC over
"razorpay_order_id|razorpay_payment_id" — and nothing else. A genuine payment
proves that SOMEBODY paid SOMETHING on this shop's account. It does not say
who, for what, or whether it has already been spent, and nothing asked:

  * ONE PAYMENT, MANY ORDERS. The same order id, payment id and signature could
    be posted again, and each time a new order was created and marked paid.
  * PAY FOR A LITTLE, ORDER A LOT. Open checkout for a ₹200 bag, pay, then add
    pieces to the bag and place the order with that payment: the order was
    priced from the new bag and recorded as paid in full.
  * A FREE ORDER BY REFUND. Put an out-of-stock piece in the bag and replay the
    payment from an order already delivered: the stock check failed and the
    shop refunded that earlier payment, so the first order cost nothing.
  * AN EXCHANGE PAID WITH ANY RECEIPT. The exchange "price difference" accepted
    any signed payment at all — including the one that paid for the original
    order — without looking at the amount.

THE FIX. /payments/create-order already works out what is being bought and
what it costs. It now also writes that down: one PaymentIntent per Razorpay
order, holding the customer, the purpose and the amount in paise. Whatever the
payment is then used for must match that record exactly, and using it stamps
it, so it can be used once.

No network call is added to the happy path; the record is local. Razorpay is
asked only for an order opened before this existed (checkouts in flight at the
moment of a deploy), which have no record to check against.
"""
from datetime import datetime, timezone

from fastapi import HTTPException

import models
import pricing
import refunds

ALREADY_USED = (
    "This payment has already been used. If you were charged twice, please "
    "contact us and we will refund it."
)


def record(db, razorpay_order_id: str, user_id: int, amount_paise: int, purpose: str) -> None:
    """Write down what a Razorpay order was opened to pay for."""
    db.add(models.PaymentIntent(
        razorpay_order_id=razorpay_order_id,
        user_id=user_id,
        amount_paise=amount_paise,
        purpose=purpose,
    ))
    db.commit()


def payment_already_spent(db, payment_id: str) -> bool:
    """Has this payment already paid for an order or an exchange?"""
    if db.query(models.Order.id).filter(models.Order.payment_transaction_id == payment_id).first():
        return True
    return bool(
        db.query(models.ReturnRequest.id)
        .filter(models.ReturnRequest.price_diff_payment_id == payment_id)
        .first()
    )


def guard(db, *, razorpay_order_id: str, payment_id: str, user_id: int, purpose: str):
    """
    Refuse a payment that is spent, or that was not opened by this customer for
    this purpose. Call it straight after the signature check and before
    anything that can refund — a refund is a way of spending a payment too.

    Returns the PaymentIntent (locked for the rest of the transaction), or None
    for a Razorpay order opened before intents were recorded.
    """
    if payment_already_spent(db, payment_id):
        raise HTTPException(409, ALREADY_USED)

    intent = (
        db.query(models.PaymentIntent)
        .filter(models.PaymentIntent.razorpay_order_id == razorpay_order_id)
        .with_for_update()
        .first()
    )
    if intent is None:
        return None
    if intent.user_id != user_id or intent.purpose != purpose:
        raise HTTPException(400, "This payment does not belong to this purchase.")
    if intent.used_at is not None:
        raise HTTPException(409, ALREADY_USED)
    return intent


def spend(db, intent) -> None:
    """Mark a payment used without creating anything — it was refunded instead."""
    if intent is not None and intent.used_at is None:
        intent.used_at = datetime.now(timezone.utc)
        db.commit()


def _legacy_amount(razorpay_order_id: str, payment_id: str):
    """
    For a Razorpay order opened before intents were recorded: the amount of
    this payment, if it is captured, untouched by any refund, and really made
    against that order. None if Razorpay cannot say so.
    """
    client = refunds._client()
    if client is None:
        return None
    try:
        p = client.payment.fetch(payment_id)
    except Exception as e:
        print(f"[payment_binding] could not read Razorpay payment {payment_id}: {e}")
        return None
    if p.get("order_id") != razorpay_order_id or p.get("status") != "captured" or p.get("amount_refunded"):
        raise HTTPException(409, ALREADY_USED)
    return int(p.get("amount") or 0) or None


def settle(db, intent, *, razorpay_order_id: str, payment_id: str, amount_due: float, what: str) -> None:
    """
    The payment must be for exactly `amount_due`. If it is, it is marked used —
    committed with whatever the caller creates, so both happen or neither does.

    If what is being bought changed after paying (the bag was edited in
    another tab, a price moved), the payment is refunded rather than kept or
    stretched over the new total, and the customer is asked to try again.
    """
    due = pricing.to_paise(amount_due)
    paid = intent.amount_paise if intent is not None else _legacy_amount(razorpay_order_id, payment_id)

    if paid is None:
        raise HTTPException(
            503,
            "We could not confirm this payment with Razorpay just now. Please try "
            "again in a minute — you will not be charged again.",
        )

    if paid != due:
        refund_id, error = refunds.refund_payment(
            payment_id, f"Paid {paid} paise for {what} costing {due} paise",
        )
        spend(db, intent)   # refunded: spent either way
        outcome = (
            "Your payment has been refunded and should reflect in 5-7 business days."
            if refund_id else
            "Your payment will be refunded — our team has been notified."
        )
        print(f"[payment_binding] amount mismatch on {payment_id}: paid {paid}, due {due}; refund={refund_id or error}")
        raise HTTPException(
            400,
            f"What you are buying changed after you paid (paid ₹{paid / 100:.2f}, "
            f"now ₹{due / 100:.2f}). {outcome} Please try again.",
        )

    if intent is not None:
        intent.used_at = datetime.now(timezone.utc)
