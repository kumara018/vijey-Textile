"""
Giving money back.

WHY THERE IS ONE OF THESE NOW.

Three call sites refunded a payment, and two of them asked Razorpay for
`order.total`. Razorpay will not return more than it captured, so the moment
the order row and the captured amount disagreed the refund was rejected with

    The refund amount provided is greater than amount captured

which is exactly what happened to AMT-NU23B2RU (Ammalu Tex): 5000 paise recorded, 4900
captured, refund refused over one rupee. In cancel_order that rejection was
swallowed by a `try` that only printed, so the order went to "cancelled" with
the customer's money kept and nothing on screen saying so. The admin's
"Initiate Refund" button then failed the same way, because it did the same sum.

pricing.py stops the amounts diverging in the first place. This stops a
divergence being able to strand anybody's money again: the amount refunded is
read back from Razorpay, so it is by construction an amount that can be
refunded.

IDEMPOTENT ON PURPOSE. A payment already fully refunded reports success rather
than an error. Refunding is something the shop may attempt more than once — a
retried request, an admin pressing the button after an automatic attempt
already worked — and "the money is back with the customer" is the outcome
either way. Treating that as a failure is how an admin ends up trying again on
a payment that was never the problem.
"""
import os


def _client():
    key_id = os.getenv("RAZORPAY_KEY_ID", "")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
    if not key_id or not key_secret:
        return None
    import razorpay
    return razorpay.Client(auth=(key_id, key_secret))


def refund_payment(payment_id: str, reason: str, notes: dict | None = None):
    """
    Refund whatever of `payment_id` is still outstanding.

    Returns (refund_id, error). Exactly one is set. `refund_id` is
    "already_refunded" when there was nothing left to return, which callers
    should treat as success.
    """
    if not payment_id or not payment_id.startswith("pay_"):
        return None, "No Razorpay payment is recorded against this order."

    client = _client()
    if client is None:
        print(f"[Razorpay] REFUND SKIPPED (no keys) — payment {payment_id} "
              f"must be refunded by hand. Reason: {reason}")
        return None, "Razorpay credentials are not configured on the server."

    try:
        payment = client.payment.fetch(payment_id)
    except Exception as e:
        print(f"[Razorpay] could not fetch payment {payment_id}: {e}")
        return None, f"Could not read the payment from Razorpay: {e}"

    if payment.get("status") != "captured":
        # Authorised-but-not-captured money is released by Razorpay on its own;
        # asking to refund it errors and would look like a failure to the admin.
        return None, (
            f"That payment is '{payment.get('status')}', not captured — "
            "there is nothing to refund."
        )

    captured = payment.get("amount") or 0
    already = payment.get("amount_refunded") or 0
    outstanding = captured - already

    if outstanding <= 0:
        print(f"[Razorpay] payment {payment_id} was already fully refunded")
        return "already_refunded", None

    try:
        refund = client.payment.refund(payment_id, {
            "amount": outstanding,
            "speed": "normal",
            "notes": {**(notes or {}), "reason": reason[:255]},
        })
    except Exception as e:
        print(f"[Razorpay] refund FAILED for {payment_id}: {e}")
        return None, str(e)

    refund_id = refund.get("id", "initiated")
    print(f"[Razorpay] refund {refund_id} initiated for {payment_id} "
          f"({outstanding} paise)")
    return refund_id, None
