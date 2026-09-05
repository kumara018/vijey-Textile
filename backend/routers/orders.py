import random
import string
import os
from types import SimpleNamespace
import hmac
import hashlib
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas, auth as auth_utils, notifications, pricing, refunds

router = APIRouter(prefix="/api/orders", tags=["Orders"])

CANCEL_WINDOW_HOURS = 1  # self-service cancellation only within this long of purchase


def _verify_razorpay_payment(payment: schemas.PaymentDetails):
    """
    Cryptographically verify the payment actually succeeded before an order
    is allowed to be created. Every accepted payment method (razorpay, upi,
    emi) is processed through Razorpay's checkout, so all three carry the
    same order_id/payment_id/signature triple to check here.
    """
    if not (payment.razorpay_order_id and payment.razorpay_payment_id and payment.razorpay_signature):
        raise HTTPException(
            status_code=400,
            detail="Payment not completed. Please complete payment before placing your order.",
        )
    razorpay_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
    if not razorpay_secret:
        raise HTTPException(status_code=503, detail="Payment gateway not configured")
    expected_signature = hmac.new(
        razorpay_secret.encode(),
        f"{payment.razorpay_order_id}|{payment.razorpay_payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected_signature, payment.razorpay_signature):
        raise HTTPException(
            status_code=400,
            detail="Payment verification failed. Invalid signature — order not placed.",
        )


def generate_order_number() -> str:
    chars = string.ascii_uppercase + string.digits
    suffix = "".join(random.choices(chars, k=8))
    return f"VJT-{suffix}"


def _refund_uncredited_payment(payment_id: str, reason: str):
    """Razorpay auto-captures payment inside the checkout widget, before this
    endpoint is ever called — so if we discover here that the order can't
    actually be fulfilled (e.g. stock ran out in the race between checkout
    and payment), the customer has already been charged. Refund it rather
    than leaving them charged with no order. Fetches the exact captured
    amount from Razorpay itself so it can never mismatch what was taken."""
    key_id     = os.getenv("RAZORPAY_KEY_ID", "")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
    if not key_id or not key_secret:
        print(f"[Razorpay] ⚠️ REFUND SKIPPED (no keys) — payment {payment_id} "
              f"must be refunded MANUALLY. Reason: {reason}")
        return None
    try:
        import razorpay as _rp
        client = _rp.Client(auth=(key_id, key_secret))
        captured = client.payment.fetch(payment_id)
        amount = captured.get("amount")
        if not amount:
            print(f"[Razorpay] ❌ Could not fetch captured amount for {payment_id} — refund skipped.")
            return None
        refund = client.payment.refund(payment_id, {
            "amount": amount, "speed": "normal", "notes": {"reason": reason},
        })
        refund_id = refund.get("id", "initiated")
        print(f"[Razorpay] ✅ Refund {refund_id} initiated for undeliverable order — payment {payment_id}")
        return refund_id
    except Exception as e:
        print(f"[Razorpay] ❌ Refund FAILED for payment {payment_id}: {e}")
        return None


@router.post("/", response_model=schemas.OrderOut, status_code=status.HTTP_201_CREATED)
def place_order(
    payload: schemas.OrderCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    # ── WHAT IS BEING BOUGHT: one piece, or the whole bag ────────────────
    #
    # "Buy it now" used to add the piece to the cart and then come here, and
    # this endpoint orders EVERYTHING in the cart and deletes it. So a customer
    # who clicked buy on one frock got an order for every piece they had been
    # saving, and an emptied bag. That is the bug; this is the fix.
    #
    # The single piece is wrapped in a plain object carrying exactly the four
    # attributes the pricing loop below reads — product, quantity, size, colour
    # — so that loop, the stock checks, the snapshot and the refund-on-failure
    # path are all reused unchanged. Deliberately NOT a transient CartItem:
    # assigning `.product` on one associates it with a persistent Product, and
    # SQLAlchemy would cascade it into the session and write a real cart row on
    # commit. A SimpleNamespace cannot.
    buying_now = payload.buy_now is not None
    if buying_now:
        product = (
            db.query(models.Product)
            .filter(models.Product.id == payload.buy_now.product_id)
            .first()
        )
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="That piece is no longer available.",
            )
        cart_items = [SimpleNamespace(
            product=product,
            product_id=product.id,
            quantity=payload.buy_now.quantity,
            size=payload.buy_now.size,
            color=payload.buy_now.color,
        )]
    else:
        cart_items = (
            db.query(models.CartItem)
            .filter(models.CartItem.user_id == current_user.id)
            .all()
        )
        if not cart_items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your cart is empty. Please add items before placing an order.",
            )

    # ── VERIFY FIRST. NOTHING ELSE HAPPENS BEFORE THIS. ─────────────────
    #
    # This call used to sit AFTER the stock check, and the comment above it
    # read "Payment must be verified BEFORE any order/stock mutation". That
    # was true of the order and of the stock, and it missed the mutation that
    # matters most: the stock-error branch below calls
    # `_refund_uncredited_payment()` with whatever `razorpay_payment_id` the
    # request supplied — using the shop's own Razorpay key — before anything
    # has checked that the caller owns that payment.
    #
    # The attack is two lines of work. Put an out-of-stock item in a cart,
    # POST an order carrying a REAL payment id belonging to somebody else and
    # a garbage signature. The stock check fails, and the shop issues a
    # genuine refund against that payment before the forged signature is ever
    # examined. The money returns to the real payer, not the attacker — so it
    # is not theft — but any payment id that can be observed or guessed can be
    # reversed on demand, draining the merchant balance and corrupting the
    # order-to-payment record. No proof of ownership is required at any point.
    #
    # Verification is a pure HMAC comparison against the Razorpay secret: no
    # database reads, no network, nothing to lose by doing it first. It runs
    # before the cart is even inspected.
    _verify_razorpay_payment(payload.payment)

    items_snapshot = []
    subtotal = 0.0
    stock_error = None

    for item in cart_items:
        product = item.product
        if not product or not product.is_active:
            stock_error = f"Product '{product.name if product else 'Unknown'}' is no longer available."
            break
        if product.stock < item.quantity:
            stock_error = f"'{product.name}' has only {product.stock} items left. Please update your cart."
            break
        item_total = product.price * item.quantity
        subtotal += item_total
        items_snapshot.append({
            "product_id": product.id,
            "name": product.name,
            "category": product.category,
            "price": product.price,
            "quantity": item.quantity,
            "size": item.size,
            "color": item.color,
            "image": product.images[0] if product.images else None,
            "subtotal": item_total,
            "is_returnable": getattr(product, "is_returnable", True),
        })

    if stock_error:
        # Safe to refund here, and only here: the signature above has already
        # proved this payment belongs to this request. The frontend only calls
        # this endpoint after Razorpay's widget has captured the money, so if
        # the order cannot be fulfilled it has to come back rather than vanish
        # into a failed request.
        #
        # Do not move this above `_verify_razorpay_payment`. That ordering is
        # the bug this file was changed to fix.
        pay_id = payload.payment.razorpay_payment_id if payload.payment else None
        if pay_id:
            refund_id = _refund_uncredited_payment(pay_id, stock_error)
            stock_error += (
                " Your payment has been automatically refunded and should reflect in 5-7 business days."
                if refund_id else
                " Your payment will be refunded — our team has been notified."
            )
        raise HTTPException(status_code=400, detail=stock_error)

    shipping_fee = pricing.SHIPPING_FEE
    total = subtotal + shipping_fee

    order_number = generate_order_number()
    while db.query(models.Order).filter(models.Order.order_number == order_number).first():
        order_number = generate_order_number()

    transaction_id = payload.payment.razorpay_payment_id
    payment_status = "paid"

    order = models.Order(
        order_number=order_number,
        user_id=current_user.id,
        items_snapshot=items_snapshot,
        subtotal=subtotal,
        shipping_fee=shipping_fee,
        discount=0.0,
        total=total,
        status="confirmed",
        payment_status=payment_status,
        payment_method=payload.payment.method,
        payment_transaction_id=transaction_id,
        shipping_address=payload.shipping_address.model_dump(),
        notes=payload.notes,
        open_box_delivery=payload.open_box_delivery,
    )
    db.add(order)

    for item in cart_items:
        item.product.stock -= item.quantity

    # Only a bag order empties the bag. A direct purchase must leave whatever
    # the customer was still saving exactly where it was.
    if not buying_now:
        db.query(models.CartItem).filter(
            models.CartItem.user_id == current_user.id
        ).delete()

    db.commit()
    db.refresh(order)

    # Send order confirmation email + SMS + WhatsApp
    notifications.send_order_confirmation_email(current_user.email, current_user.full_name, order)
    notifications.send_order_sms(current_user.phone, order.order_number, order.total)
    notifications.send_order_whatsapp(current_user.phone, current_user.full_name, order, items_snapshot)
    notifications.send_payment_success_email(current_user.email, current_user.full_name, order)

    return order


@router.get("/", response_model=List[schemas.OrderOut])
def get_my_orders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    return (
        db.query(models.Order)
        .filter(models.Order.user_id == current_user.id)
        .order_by(models.Order.created_at.desc())
        .all()
    )


@router.get("/{order_id}", response_model=schemas.OrderOut)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    order = db.query(models.Order).filter(
        models.Order.id == order_id,
        models.Order.user_id == current_user.id,
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.post("/{order_id}/cancel", response_model=schemas.OrderOut)
def cancel_order(
    order_id: int,
    payload: schemas.CancelOrderPayload = schemas.CancelOrderPayload(),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    order = db.query(models.Order).filter(
        models.Order.id == order_id,
        models.Order.user_id == current_user.id,
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status in ("cancelled", "delivered", "out_for_delivery"):
        raise HTTPException(
            status_code=400,
            detail=f"Order cannot be cancelled once it is '{order.status}'. Please contact support.",
        )

    created = order.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > created + timedelta(hours=CANCEL_WINDOW_HOURS):
        raise HTTPException(
            status_code=400,
            detail=f"Orders can only be cancelled within {CANCEL_WINDOW_HOURS} hour of purchase. This window has passed — please contact support.",
        )

    pre_cancel_status = order.status
    order.status        = "cancelled"
    order.cancelled_by  = "user"
    order.cancel_reason = (payload.reason or "Cancelled by customer").strip()

    # An order cancelled once it's already Shipped is an RTO, not a simple
    # cancel — the item is physically with the courier, not back on the
    # shelf. Restoring stock immediately would let the shop oversell a unit
    # that isn't actually available yet. Hold it and flag rto_pending;
    # courier_sync restores it once Delhivery confirms the item is back.
    # (Customers can't self-cancel past "shipped" — out_for_delivery/
    # delivered are blocked above — so "shipped" is the only RTO case here.)
    is_rto = bool(order.awb_code) and pre_cancel_status == "shipped"

    if not is_rto:
        for item in order.items_snapshot:
            product = db.query(models.Product).filter(
                models.Product.id == item["product_id"]
            ).first()
            if product:
                product.stock += item["quantity"]
    else:
        order.rto_pending = True

    # Cancel on Delhivery if AWB exists
    if order.awb_code:
        courier = (order.courier_name or "").lower()
        try:
            if "delhivery" in courier or not courier:
                import delhivery as dl
                cancel_result = dl.cancel_shipment(order.awb_code)
                print(f"[Delhivery] Cancel/RTO requested for AWB {order.awb_code} — response: {cancel_result}")
            elif order.shiprocket_order_id:
                from shiprocket import shiprocket as sr
                sr.cancel_order([int(order.shiprocket_order_id)])
        except Exception as e:
            print(f"[Courier cancel error] {e}")

    # ── The refund, which is not optional and is not an admin's job ──────────
    #
    # Cancelling a paid order refunds it. There is no button, no queue and no
    # step where somebody has to remember: the customer pressed cancel, so the
    # money goes back.
    #
    # The failure this replaces is worth naming. The amount asked for was
    # `order.total`, Razorpay will not return more than it captured, and the
    # rejection was caught by a bare `except` that only printed. So an order
    # whose captured amount was a rupee short went to "cancelled" with the
    # money kept, no refund, and nothing on screen admitting it — the shop
    # looked like it had refunded and had not. refunds.refund_payment reads the
    # outstanding amount back from Razorpay, so it cannot ask for the wrong
    # figure, and the outcome is recorded either way rather than swallowed.
    refund_status = None
    refund_error = None
    if (
        order.payment_method != "cod"
        and order.payment_status == "paid"
        and order.payment_transaction_id
    ):
        refund_status, refund_error = refunds.refund_payment(
            order.payment_transaction_id,
            order.cancel_reason or "Cancelled by customer",
            {"order_number": order.order_number},
        )
        if refund_status == "already_refunded":
            order.payment_status = "refunded"
        elif refund_status:
            order.payment_status = "refund_initiated"
        else:
            # Kept as an explicit state rather than left reading "paid", so the
            # workroom can show it and the customer is not told money is coming
            # back when it is not.
            order.payment_status = "refund_failed"
            print(f"[Cancel] refund failed for {order.order_number}: {refund_error}")
            try:
                db.add(models.AdminNotification(
                    type="refund_failed",
                    title=f"Refund failed — {order.order_number}",
                    message=(f"₹{order.total} could not be refunded automatically: "
                             f"{refund_error}. Refund it from the Razorpay dashboard."),
                    order_id=order.id,
                ))
            except Exception as e:
                print(f"[Cancel] could not raise refund-failed alert: {e}")

    db.commit()
    db.refresh(order)

    # Notify customer — cancellation (RTO gets a distinct "don't accept it if
    # it arrives" message instead of the generic cancellation email)
    try:
        if order.rto_pending:
            notifications.send_rto_cancellation_email(current_user.email, current_user.full_name, order)
        else:
            notifications.send_order_cancelled_email(current_user.email, current_user.full_name, order)
    except Exception as e:
        print(f"[Cancel email error] {e}")
    try:
        if order.rto_pending:
            notifications.send_rto_cancellation_whatsapp(current_user.phone, current_user.full_name, order)
        else:
            notifications.send_order_cancelled_whatsapp(current_user.phone, current_user.full_name, order)
    except Exception as e:
        print(f"[Cancel WhatsApp error] {e}")

    # Notify admin — new cancellation alert
    try:
        admin_notif = models.AdminNotification(
            type="cancellation",
            order_id=order.id,
            user_id=current_user.id,
            title=f"Order {order.order_number} Cancelled",
            message=f"{current_user.full_name} cancelled order {order.order_number}. Reason: {order.cancel_reason}",
        )
        db.add(admin_notif)
        db.commit()
        notifications.send_admin_cancellation_email(order, current_user)
        notifications.send_admin_cancellation_whatsapp(order, current_user)
    except Exception as e:
        print(f"[Admin notify cancel error] {e}")

    # Notify customer — refund (if refund was triggered)
    if refund_status:
        try:
            notifications.send_refund_initiated_email(
                current_user.email, current_user.full_name, order, refund_status
            )
        except Exception as e:
            print(f"[Refund email error] {e}")
        try:
            notifications.send_refund_initiated_sms(
                current_user.phone, order.order_number, order.total
            )
        except Exception as e:
            print(f"[Refund SMS error] {e}")
        try:
            notifications.send_refund_initiated_whatsapp(
                current_user.phone, current_user.full_name, order, refund_status
            )
        except Exception as e:
            print(f"[Refund WhatsApp error] {e}")

    return order


@router.post("/{order_id}/send-invoice")
def send_invoice(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    """Send the invoice email for this order to the customer."""
    order = db.query(models.Order).filter(
        models.Order.id == order_id,
        models.Order.user_id == current_user.id,
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    try:
        notifications.send_invoice_email(
            current_user.email, current_user.full_name, order, current_user.email
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send invoice: {e}")
    return {"message": "Invoice sent to your email successfully"}


@router.get("/{order_id}/track")
def track_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    """Return Shiprocket live tracking events if AWB is set, else order timeline."""
    order = db.query(models.Order).filter(
        models.Order.id == order_id,
        models.Order.user_id == current_user.id,
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    result = {
        "order_number":     order.order_number,
        "status":           order.status,
        "status_location":  order.status_location,
        "courier_name":     order.courier_name,
        "awb_code":         order.awb_code,
        "tracking_url":     order.tracking_url,
        "estimated_delivery": order.estimated_delivery,
        "shiprocket_data":  None,
    }

    if order.awb_code:
        try:
            # Use Delhivery if courier is Delhivery (or no courier set), else Shiprocket
            courier = (order.courier_name or "").lower()
            if "delhivery" in courier or not courier:
                import delhivery as dl
                import courier_sync
                raw = dl.track_awb(order.awb_code)
                if raw:
                    result["tracking_events"]   = dl.parse_tracking_events(raw)
                    current                     = dl.parse_current_status(raw)
                    result["current_status"]    = current
                    # Auto-update estimated delivery if Delhivery provides it
                    if current.get("expected_delivery"):
                        result["estimated_delivery"] = current["expected_delivery"]
                    # Auto-update current location from Delhivery
                    if current.get("location"):
                        result["status_location"] = current["location"]
                    result["raw_data"] = raw
                    # Persist it — whoever opens this tracking view nudges the
                    # order's own status forward too, not just this response.
                    # (Any error here is caught by the outer try/except below.)
                    action = courier_sync.sync_order_from_delhivery(order, current, db)
                    if action and action != "location_only":
                        result["status"] = order.status
            else:
                from shiprocket import shiprocket as sr
                data = sr.track_awb(order.awb_code)
                if data:
                    result["raw_data"] = data
        except Exception as e:
            print(f"[Track fetch error] {e}")

    return result
