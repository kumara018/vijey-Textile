"""Return (refund) and Exchange requests."""
import os
import hmac
import hashlib
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas, auth as auth_utils, notifications

router = APIRouter(prefix="/api/returns", tags=["Returns"])

# Windows are anchored to delivery time, not purchase time — you can't
# return/exchange something you haven't received yet.
RETURN_WINDOW_HOURS   = 4    # money-back return: strict, short window
EXCHANGE_WINDOW_HOURS = 12   # exchange for a different product

REASON_LABELS = {
    "size_issue": "Size Issue",
    "damage":     "Damage / Defective Piece",
}

TYPE_LABELS = {
    "return":   "Return",
    "exchange": "Exchange",
}


def _verify_price_diff_payment(payload: schemas.ReturnRequestCreate, amount_due: float):
    """Same HMAC verification pattern as order placement — the price
    difference must be a real, verified Razorpay payment before the
    exchange request is created."""
    if not (payload.razorpay_order_id and payload.razorpay_payment_id and payload.razorpay_signature):
        raise HTTPException(
            status_code=400,
            detail=f"Payment of ₹{amount_due:.2f} for the price difference is required before this exchange can be requested.",
        )
    razorpay_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
    if not razorpay_secret:
        raise HTTPException(status_code=503, detail="Payment gateway not configured")
    expected_signature = hmac.new(
        razorpay_secret.encode(),
        f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected_signature, payload.razorpay_signature):
        raise HTTPException(status_code=400, detail="Payment verification failed. Invalid signature.")


@router.post("/", response_model=schemas.ReturnRequestOut, status_code=201)
def create_return_request(
    payload: schemas.ReturnRequestCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    order = db.query(models.Order).filter(
        models.Order.id == payload.order_id,
        models.Order.user_id == current_user.id,
    ).first()
    if not order:
        raise HTTPException(404, "Order not found")
    if order.status != "delivered":
        raise HTTPException(400, "Return/exchange requests can only be made for delivered orders")

    # Enforce the window from delivery time — strictly shorter for a return
    # (money back) than an exchange (different product, no refund involved).
    window_hours = RETURN_WINDOW_HOURS if payload.request_type == "return" else EXCHANGE_WINDOW_HOURS
    anchor = order.delivered_at or order.created_at
    if anchor:
        if anchor.tzinfo is None:
            anchor = anchor.replace(tzinfo=timezone.utc)
        deadline = anchor + timedelta(hours=window_hours)
        if datetime.now(timezone.utc) > deadline:
            label = TYPE_LABELS.get(payload.request_type, payload.request_type)
            raise HTTPException(400, f"The {window_hours}-hour {label.lower()} window for this order has passed.")

    # Find the specific item being returned/exchanged within this (possibly multi-item) order
    items = order.items_snapshot or []
    item = next((i for i in items if i.get("product_id") == payload.product_id), None)
    if not item:
        raise HTTPException(400, "That item was not found in this order")

    original_product = db.query(models.Product).filter(models.Product.id == payload.product_id).first()
    if original_product and not original_product.is_returnable:
        raise HTTPException(400, f'"{item.get("name", "This item")}" is not eligible for return/exchange.')
    original_price = item.get("price", 0)

    # Check if a request already exists for this item
    existing = db.query(models.ReturnRequest).filter(
        models.ReturnRequest.order_id == payload.order_id,
        models.ReturnRequest.product_id == payload.product_id,
        models.ReturnRequest.status.notin_(["rejected", "completed"]),
    ).first()
    if existing:
        raise HTTPException(400, "A return/exchange request already exists for this item")

    new_product = None
    price_difference = 0.0
    price_diff_payment_id = None

    if payload.request_type == "exchange":
        # Validate the replacement product — must exist, be active, and cost
        # the same or more than the original item. Cheaper items are never
        # allowed, since there is no refund mechanism to return the difference.
        new_product = db.query(models.Product).filter(
            models.Product.id == payload.new_product_id,
            models.Product.is_active == True,
        ).first()
        if not new_product:
            raise HTTPException(400, "The selected replacement product is not available")

        price_difference = round(new_product.price - original_price, 2)
        if price_difference < 0:
            raise HTTPException(
                400,
                "The replacement item must cost the same or more than the original — "
                "a cheaper item cannot be selected since no refund is issued.",
            )

        # If the replacement costs more, the difference must already be paid
        if price_difference > 0:
            _verify_price_diff_payment(payload, price_difference)
            price_diff_payment_id = payload.razorpay_payment_id

    rr = models.ReturnRequest(
        order_id       = payload.order_id,
        user_id        = current_user.id,
        request_type   = payload.request_type,
        reason         = payload.reason,
        description    = payload.description,
        images         = payload.images,
        status         = "pending",
        product_id     = payload.product_id,
        original_price = original_price,
        new_product_id = payload.new_product_id if payload.request_type == "exchange" else None,
        new_size       = payload.new_size if payload.request_type == "exchange" else None,
        new_color      = payload.new_color if payload.request_type == "exchange" else None,
        price_difference      = price_difference,
        price_diff_payment_id = price_diff_payment_id,
    )
    db.add(rr)
    db.commit()
    db.refresh(rr)

    # Notify customer
    try:
        notifications.send_return_request_email(current_user.email, current_user.full_name, order, rr)
        notifications.send_return_request_whatsapp(current_user.phone, current_user.full_name, order, rr)
    except Exception as e:
        print(f"[Return] Notification error: {e}")

    # Notify admin — new return/exchange request
    try:
        type_label = TYPE_LABELS.get(rr.request_type, rr.request_type)
        price_note = f", pays ₹{price_difference:.2f} difference" if price_difference > 0 else ""
        admin_notif = models.AdminNotification(
            type=rr.request_type,
            order_id=rr.order_id,
            return_request_id=rr.id,
            user_id=current_user.id,
            title=f"New {type_label} Request — {order.order_number}",
            message=(
                f"{current_user.full_name} requested a {type_label.lower()} for order {order.order_number}. "
                f"Reason: {REASON_LABELS.get(rr.reason, rr.reason)}{price_note}. "
                f"Please review the stated reason carefully before approving."
            ),
        )
        db.add(admin_notif)
        db.commit()
        notifications.send_admin_return_email(rr, order, current_user)
        notifications.send_admin_return_whatsapp(rr, order, current_user)
    except Exception as e:
        print(f"[Admin notify return error] {e}")

    return rr


@router.post("/upload-image")
async def upload_return_image(
    file: UploadFile = File(...),
    _: models.User = Depends(auth_utils.get_current_user),
):
    """Upload a return request image to Cloudinary."""
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", "")
    api_key    = os.getenv("CLOUDINARY_API_KEY", "")
    api_secret = os.getenv("CLOUDINARY_API_SECRET", "")
    if not all([cloud_name, api_key, api_secret]):
        raise HTTPException(500, "Image upload not configured")
    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(400, "Only JPEG, PNG and WebP images are allowed")
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(400, "Image must be under 10MB")
    try:
        import cloudinary, cloudinary.uploader
        cloudinary.config(cloud_name=cloud_name, api_key=api_key, api_secret=api_secret, secure=True)
        result = cloudinary.uploader.upload(
            contents,
            folder="ammalutex/returns",
            resource_type="image",
            transformation=[{"width": 1200, "height": 1200, "crop": "limit", "quality": "auto"}],
        )
        return {"url": result["secure_url"]}
    except Exception as e:
        raise HTTPException(500, f"Upload failed: {e}")


@router.get("/", response_model=List[schemas.ReturnRequestOut])
def get_my_returns(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    return db.query(models.ReturnRequest).filter(
        models.ReturnRequest.user_id == current_user.id
    ).order_by(models.ReturnRequest.created_at.desc()).all()


@router.get("/{return_id}", response_model=schemas.ReturnRequestOut)
def get_return(
    return_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    rr = db.query(models.ReturnRequest).filter(
        models.ReturnRequest.id == return_id,
        models.ReturnRequest.user_id == current_user.id,
    ).first()
    if not rr:
        raise HTTPException(404, "Return request not found")
    return rr
