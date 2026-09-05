import razorpay
import hmac
import hashlib
import os
import json
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from database import get_db
import models, schemas, auth as auth_utils, notifications, pricing, refunds
from pydantic import BaseModel

router = APIRouter(prefix="/api/payments", tags=["Payments"])

RAZORPAY_KEY_ID     = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")


def get_razorpay_client():
    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=503, detail="Payment gateway not configured")
    return razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


class CreateOrderRequest(BaseModel):
    """
    What the customer is buying — NOT what it costs.

    `amount` used to be the price, taken as sent, and it is now ignored: the
    total is computed from Product rows in pricing.py. It is kept on the schema
    only so an older cached bundle does not 422 mid-checkout, and so the value
    the page believed can be logged when it disagrees with the truth.

    `buy_now` says whether to price the single piece or the whole bag, and has
    to be here because the two produce different totals and the browser is no
    longer trusted to tell us which one it charged for.
    """
    amount: float | None = None      # ignored; see the docstring
    buy_now: schemas.BuyNowItem | None = None


class VerifyRequest(BaseModel):
    razorpay_order_id:   str
    razorpay_payment_id: str
    razorpay_signature:  str


@router.post("/create-order")
def create_razorpay_order(
    payload: CreateOrderRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    """
    Open a Razorpay order for what this customer is actually buying.

    THE AMOUNT IS COMPUTED HERE, NOT ACCEPTED. See pricing.py for the two live
    faults that came from taking it off the request — a flat 49-rupee charge on
    every Buy It Now, and any bag purchasable for one rupee.

    Stock is checked before the customer is sent to Razorpay rather than after.
    place_order still re-checks and refunds if it lost a race, but that path
    means taking money and handing it back; refusing here is the version where
    nobody is charged for something the shop cannot send.
    """
    client = get_razorpay_client()

    snapshot, subtotal, shipping_fee, total, stock_error, _ = pricing.price_order(
        db, current_user.id, payload.buy_now
    )
    if stock_error:
        raise HTTPException(status_code=400, detail=stock_error)

    amount_paise = pricing.to_paise(total)

    # Not an error — an older bundle may still send its own figure, and a
    # mismatch is worth seeing in the log without failing the sale.
    if payload.amount is not None and pricing.to_paise(payload.amount) != amount_paise:
        print(
            f"[payments] amount from browser ({payload.amount}) disagrees with "
            f"the priced total ({total}) for user {current_user.id} — charging {total}"
        )

    order = client.order.create({
        "amount":   amount_paise,
        "currency": "INR",
        "payment_capture": 1,
    })
    return {
        "order_id":  order["id"],
        "amount":    order["amount"],
        "currency":  order["currency"],
        "key_id":    RAZORPAY_KEY_ID,
        # The page displays and charges this, rather than its own arithmetic.
        "subtotal":  subtotal,
        "shipping":  shipping_fee,
        "total":     total,
        "items":     snapshot,
    }


@router.post("/verify")
def verify_payment(payload: VerifyRequest):
    key_secret = RAZORPAY_KEY_SECRET.encode()
    message    = f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}".encode()
    generated  = hmac.new(key_secret, message, hashlib.sha256).hexdigest()

    if generated != payload.razorpay_signature:
        raise HTTPException(status_code=400, detail="Payment verification failed. Invalid signature.")

    return {"verified": True, "payment_id": payload.razorpay_payment_id}


@router.get("/key")
def get_key(current_user: models.User = Depends(auth_utils.get_current_user)):
    if not RAZORPAY_KEY_ID:
        raise HTTPException(status_code=503, detail="Payment gateway not configured")
    return {"key_id": RAZORPAY_KEY_ID}


# ── Razorpay Webhook ──────────────────────────────────────────────────────────
@router.get("/webhook/razorpay")
def webhook_info():
    """Browser / health-check hit — just confirm the endpoint is live."""
    return {"status": "active", "endpoint": "Razorpay webhook — POST only"}


@router.post("/webhook/razorpay")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Razorpay sends events here automatically.
    Configure in: Razorpay Dashboard → Settings → Webhooks
      URL:    https://api.vijeytextile.com/api/payments/webhook/razorpay
      Events: refund.created, refund.processed, refund.speed_changed
      Secret: set RAZORPAY_WEBHOOK_SECRET in the shop's env file

    ONLY REFUND EVENTS MATTER HERE, and it is worth saying so out loud because
    the obvious-looking ones do nothing. `payment.captured` and `payment.failed`
    are received and silently ignored: a payment is verified in the browser at
    checkout, synchronously, before the order is created. Ticking them costs
    nothing but buys nothing either, and it invites the assumption that payment
    confirmation depends on this endpoint — it does not.

    A refund is the opposite. Razorpay settles it minutes to days after the
    request, long after the customer has closed the tab, and this webhook is the
    only way the shop ever learns it completed.

    Flow:
      1. Customer cancels → Razorpay refund API called → payment_status = "refund_initiated"
      2. Razorpay processes refund → fires refund.processed webhook → payment_status = "refunded"
      3. Customer notified: "Refund Credited — amount returned to your account"
    """
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")

    # A CONFIGURED SECRET MEANS THE SIGNATURE IS REQUIRED, NOT OPTIONAL.
    #
    # This read `if webhook_secret and signature:`, so a POST arriving with NO
    # X-Razorpay-Signature header skipped verification entirely and was then
    # processed as genuine. Measured against the live endpoint before the fix:
    # an unsigned POST returned 200 and the handler ran.
    #
    # That is forgeable. The events here move money-state — refund.processed
    # sets an order to `refunded` — so anyone who knew the URL and a payment id
    # could mark refunds that never happened. The endpoint is public by
    # necessity; the signature is the only thing separating Razorpay from
    # everyone else.
    #
    # Missing signature is now refused whenever a secret is configured. If no
    # secret is set the endpoint stays open, which is the documented setup
    # path and is why the check is conditional at all rather than absolute.
    if webhook_secret:
        if not signature:
            print("[Webhook] Rejected: no X-Razorpay-Signature header")
            raise HTTPException(400, "Missing webhook signature")
        expected = hmac.new(webhook_secret.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            print("[Webhook] Rejected: invalid Razorpay signature")
            raise HTTPException(400, "Invalid webhook signature")

    try:
        payload = json.loads(body)
    except Exception:
        raise HTTPException(400, "Invalid JSON payload")

    event = payload.get("event", "")
    print(f"[Webhook] Razorpay event received: {event}")

    # Handle refund.created — Razorpay acknowledged the refund request
    if event == "refund.created":
        entity     = payload.get("payload", {}).get("refund", {}).get("entity", {})
        payment_id = entity.get("payment_id", "")
        refund_id  = entity.get("id", "")
        print(f"[Webhook] Refund CREATED: {refund_id} for payment {payment_id}")

        if payment_id:
            order = db.query(models.Order).filter(
                models.Order.payment_transaction_id == payment_id
            ).first()
            if order and order.payment_status == "paid":
                # Only update to refund_initiated if still "paid" (not already further along)
                order.payment_status = "refund_initiated"
                db.commit()
                print(f"[Webhook] ✅ Order {order.order_number} — refund_initiated (Razorpay confirmed)")

    # Handle refund.processed — Razorpay fully processed it, heading to customer's bank
    elif event == "refund.processed":
        entity     = payload.get("payload", {}).get("refund", {}).get("entity", {})
        payment_id = entity.get("payment_id", "")
        refund_id  = entity.get("id", "")

        print(f"[Webhook] Refund PROCESSED: {refund_id} for payment {payment_id}")

        if payment_id:
            order = db.query(models.Order).filter(
                models.Order.payment_transaction_id == payment_id
            ).first()

            if order and order.payment_status != "refunded":
                order.payment_status = "refunded"

                # If this refund belongs to an approved return (not just a
                # cancellation), mark it refunded too — the customer's return
                # status page reflects "Refund Credited" from here.
                rr = db.query(models.ReturnRequest).filter(
                    models.ReturnRequest.order_id == order.id,
                    models.ReturnRequest.request_type == "return",
                    models.ReturnRequest.status == "refund_initiated",
                ).first()
                if rr:
                    rr.status = "refunded"
                    if not rr.refund_id:
                        rr.refund_id = refund_id

                db.commit()
                print(f"[Webhook] ✅ Order {order.order_number} — refund processed, on way to customer's bank")

                # Notify customer: refund processed by Razorpay, bank will credit soon
                user = db.query(models.User).filter(models.User.id == order.user_id).first()
                if user:
                    try:
                        notifications.send_refund_credited_email(
                            user.email, user.full_name, order, refund_id
                        )
                        notifications.send_refund_credited_whatsapp(
                            user.phone, user.full_name, order, refund_id
                        )
                    except Exception as e:
                        print(f"[Webhook] Notification error: {e}")
            else:
                print(f"[Webhook] Order already at refunded status or not found for payment {payment_id}")

    elif event == "refund.speed_changed":
        print(f"[Webhook] Refund speed changed — no action needed")

    return {"status": "ok"}


# ── Admin: Initiate refund via Razorpay for cancelled paid orders ─────────────
@router.post("/admin/orders/{order_id}/initiate-refund")
def admin_initiate_refund(
    order_id: int,
    db:    Session     = Depends(get_db),
    _:     models.User = Depends(auth_utils.get_current_admin),
):
    """
    Admin triggers Razorpay refund for a cancelled paid order.
    - Calls Razorpay refund API → payment_status = "refund_initiated"
    - Customer gets email + WhatsApp: "Refund initiated, will credit in 5-7 days"
    - When Razorpay processes the refund, webhook auto-updates to "refunded"
      and sends "Refund Credited" notification.
    """
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    if order.payment_method == "cod":
        raise HTTPException(400, "COD orders don't require a digital refund")
    if order.payment_status == "refunded":
        raise HTTPException(400, "Order is already fully refunded")
    if order.payment_status == "refund_initiated":
        raise HTTPException(400, "Refund is already initiated for this order")

    # The amount comes back from Razorpay rather than from order.total. Asking
    # for order.total is what made this button fail with "the refund amount
    # provided is greater than amount captured" on any order whose captured
    # figure differed — see refunds.py.
    refund_id, error = refunds.refund_payment(
        order.payment_transaction_id,
        order.cancel_reason or "Admin initiated refund",
        {"order_number": order.order_number},
    )
    if error:
        raise HTTPException(400, f"Razorpay refund failed: {error}")

    # Nothing was outstanding — the money is already back. Recording it as
    # refunded is the honest state, and beats reporting a failure for an
    # outcome that is what the admin wanted.
    order.payment_status = "refunded" if refund_id == "already_refunded" else "refund_initiated"
    db.commit()
    db.refresh(order)

    # Notify customer — refund has been initiated
    user = db.query(models.User).filter(models.User.id == order.user_id).first()
    if user:
        try:
            notifications.send_refund_initiated_email(
                user.email, user.full_name, order, refund_id
            )
            notifications.send_refund_initiated_whatsapp(
                user.phone, user.full_name, order, refund_id
            )
        except Exception as e:
            print(f"[Admin] Refund notification error: {e}")

    return {
        "message":        f"Refund initiated for {order.order_number} ✅",
        "order_id":       order_id,
        "refund_id":      refund_id,
        "payment_status": "refund_initiated",
    }


# ── Admin: Reset payment status back to refund_initiated (fix premature "refunded") ──
@router.post("/admin/orders/{order_id}/reset-to-refund-initiated")
def admin_reset_to_refund_initiated(
    order_id: int,
    db:    Session     = Depends(get_db),
    _:     models.User = Depends(auth_utils.get_current_admin),
):
    """
    Corrects an order that was incorrectly set to 'refunded' before Razorpay confirmed it.
    Resets payment_status back to 'refund_initiated' so the refund.processed webhook
    can fire correctly and notify the customer when the money actually arrives.
    """
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    if order.payment_method == "cod":
        raise HTTPException(400, "COD orders don't have a digital refund")
    if order.payment_status not in ("refunded", "refund_initiated"):
        raise HTTPException(400, f"Cannot reset — current payment status is '{order.payment_status}'")

    order.payment_status = "refund_initiated"
    db.commit()
    db.refresh(order)

    return {
        "message":        f"Order {order.order_number} reset to refund_initiated ✅ — Razorpay webhook will update it to 'refunded' when the refund is confirmed",
        "order_id":       order_id,
        "payment_status": "refund_initiated",
    }


# ── Admin: Mark refunded manually (fallback — when webhook never fires) ────────
@router.post("/admin/orders/{order_id}/mark-refunded")
def admin_mark_refunded(
    order_id: int,
    db:    Session     = Depends(get_db),
    _:     models.User = Depends(auth_utils.get_current_admin),
):
    """
    Fallback: manually mark an order as refunded when Razorpay webhook didn't fire.
    Only use this if you've already confirmed the refund was credited in Razorpay dashboard.
    """
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    if order.payment_method == "cod":
        raise HTTPException(400, "COD orders don't have a digital refund")
    if order.payment_status == "refunded":
        raise HTTPException(400, "Order is already marked as refunded")

    order.payment_status = "refunded"
    db.commit()
    db.refresh(order)

    # Notify customer — refund credited
    user = db.query(models.User).filter(models.User.id == order.user_id).first()
    if user:
        try:
            notifications.send_refund_credited_email(
                user.email, user.full_name, order, "manual"
            )
            notifications.send_refund_credited_whatsapp(
                user.phone, user.full_name, order, "manual"
            )
        except Exception as e:
            print(f"[Admin] Refund credited notification error: {e}")

    return {
        "message":        f"Order {order.order_number} marked as refunded ✅",
        "order_id":       order_id,
        "payment_status": "refunded",
    }
