import random
import string
import os
import hmac
import hashlib
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas, auth as auth_utils, notifications

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
        # The frontend only calls this endpoint after Razorpay's widget has
        # already captured payment — so if we can't fulfill the order, that
        # money needs to come back rather than vanish into a failed request.
        pay_id = payload.payment.razorpay_payment_id if payload.payment else None
        if pay_id:
            refund_id = _refund_uncredited_payment(pay_id, stock_error)
            stock_error += (
                " Your payment has been automatically refunded and should reflect in 5-7 business days."
                if refund_id else
                " Your payment will be refunded — our team has been notified."
            )
        raise HTTPException(status_code=400, detail=stock_error)

    # Payment must be verified BEFORE any order/stock mutation — no order is
    # ever created on an unverified or missing payment.
    _verify_razorpay_payment(payload.payment)

    shipping_fee = 49.0
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

    order.status        = "cancelled"
    order.cancelled_by  = "user"
    order.cancel_reason = (payload.reason or "Cancelled by customer").strip()

    # Restore stock
    for item in order.items_snapshot:
        product = db.query(models.Product).filter(
            models.Product.id == item["product_id"]
        ).first()
        if product:
            product.stock += item["quantity"]

    # Cancel on Delhivery if AWB exists (unlikely this early, but handle it)
    if order.awb_code:
        courier = (order.courier_name or "").lower()
        try:
            if "delhivery" in courier or not courier:
                import delhivery as dl
                dl.cancel_shipment(order.awb_code)
                print(f"[Delhivery] Cancelled AWB {order.awb_code}")
            elif order.shiprocket_order_id:
                from shiprocket import shiprocket as sr
                sr.cancel_order([int(order.shiprocket_order_id)])
        except Exception as e:
            print(f"[Courier cancel error] {e}")

    # ── Auto-refund via Razorpay for paid online orders ───────────────────────
    refund_status = None
    if (
        order.payment_status == "paid"
        and order.payment_transaction_id
        and order.payment_transaction_id.startswith("pay_")
    ):
        key_id     = os.getenv("RAZORPAY_KEY_ID", "")
        key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
        if not key_id or not key_secret:
            print(f"[Razorpay] ⚠️  REFUND SKIPPED — RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set in env vars. "
                  f"Order {order.order_number} txn {order.payment_transaction_id} "
                  f"₹{order.total} must be refunded MANUALLY from Razorpay Dashboard.")
        else:
            try:
                import razorpay as _rp
                client = _rp.Client(auth=(key_id, key_secret))
                refund = client.payment.refund(
                    order.payment_transaction_id,
                    {
                        "amount": int(order.total * 100),   # paise
                        "speed":  "normal",
                        "notes":  {
                            "order_number": order.order_number,
                            "reason":       order.cancel_reason,
                        },
                    },
                )
                order.payment_status = "refund_initiated"
                refund_status = refund.get("id", "initiated")
                print(f"[Razorpay] ✅ Refund {refund_status} initiated for {order.order_number} ₹{order.total}")
            except Exception as e:
                print(f"[Razorpay] ❌ Refund FAILED for {order.order_number} txn {order.payment_transaction_id}: {e}")

    db.commit()
    db.refresh(order)

    # Notify customer — cancellation
    try:
        notifications.send_order_cancelled_email(current_user.email, current_user.full_name, order)
    except Exception as e:
        print(f"[Cancel email error] {e}")
    try:
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
