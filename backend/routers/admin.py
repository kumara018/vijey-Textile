from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
import os, random
from datetime import datetime, timezone
from database import get_db
import models, schemas, auth as auth_utils, notifications
import courier_sync

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_admin),
):
    total_products = db.query(models.Product).count()
    active_products = db.query(models.Product).filter(models.Product.is_active == True).count()
    total_users = db.query(models.User).filter(models.User.is_admin == False).count()
    total_orders = db.query(models.Order).count()
    pending_orders = db.query(models.Order).filter(models.Order.status == "confirmed").count()
    from sqlalchemy import func
    revenue = db.query(func.sum(models.Order.total)).filter(
        models.Order.status != "cancelled"
    ).scalar() or 0

    recent_orders = (
        db.query(models.Order)
        .order_by(models.Order.created_at.desc())
        .limit(10)
        .all()
    )

    return {
        "total_products": total_products,
        "active_products": active_products,
        "total_users": total_users,
        "total_orders": total_orders,
        "pending_orders": pending_orders,
        "total_revenue": round(revenue, 2),
        "recent_orders": [
            {
                "id": o.id,
                "order_number": o.order_number,
                "total": o.total,
                "status": o.status,
                "payment_status": o.payment_status,
                "created_at": o.created_at,
            }
            for o in recent_orders
        ],
    }


@router.post("/products", response_model=schemas.ProductOut, status_code=201)
def create_product(
    payload: schemas.ProductCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_admin),
):
    if payload.sku:
        existing = db.query(models.Product).filter(models.Product.sku == payload.sku).first()
        if existing:
            raise HTTPException(status_code=409, detail="Product with this SKU already exists")

    product = models.Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.get("/products", response_model=List[schemas.ProductOut])
def list_all_products(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_admin),
    skip: int = 0,
    limit: int = 50,
):
    return db.query(models.Product).order_by(models.Product.created_at.desc()).offset(skip).limit(limit).all()


@router.put("/products/{product_id}", response_model=schemas.ProductOut)
def update_product(
    product_id: int,
    payload: schemas.ProductUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_admin),
):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # exclude_unset (not exclude_none): the admin form always sends every
    # field, including explicit nulls to clear an optional field (e.g.
    # removing a product's video) — exclude_none would silently drop those
    # nulls and leave the old value in place. exclude_unset still correctly
    # leaves untouched any field a caller genuinely omits, like the
    # single-field quick-toggle calls (is_featured, is_active) elsewhere in
    # the admin UI.
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)
    return product


@router.delete("/products/{product_id}", status_code=204)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_admin),
):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.is_active = False
    db.commit()


@router.post("/products/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    _: models.User = Depends(auth_utils.get_current_admin),
):
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", "")
    api_key    = os.getenv("CLOUDINARY_API_KEY", "")
    api_secret = os.getenv("CLOUDINARY_API_SECRET", "")

    if not all([cloud_name, api_key, api_secret]):
        raise HTTPException(500, "Cloudinary not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET to Render env vars.")

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
            folder="vijeytextile/products",
            resource_type="image",
            # angle:"exif" bakes in the correct rotation from the phone's EXIF
            # orientation tag server-side too — a safety net for the rare
            # browser that can't do the client-side canvas correction the
            # admin upload widget applies before the file even gets here.
            transformation=[
                {"angle": "exif"},
                {"width": 900, "height": 900, "crop": "limit", "quality": "auto", "fetch_format": "auto"},
            ],
        )
        return {"url": result["secure_url"], "public_id": result["public_id"]}
    except Exception as e:
        raise HTTPException(500, f"Cloudinary upload failed: {e}")


@router.post("/products/upload-video")
async def upload_video(
    file: UploadFile = File(...),
    _: models.User = Depends(auth_utils.get_current_admin),
):
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", "")
    api_key    = os.getenv("CLOUDINARY_API_KEY", "")
    api_secret = os.getenv("CLOUDINARY_API_SECRET", "")

    if not all([cloud_name, api_key, api_secret]):
        raise HTTPException(500, "Cloudinary not configured.")

    if file.content_type not in ["video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"]:
        raise HTTPException(400, "Only MP4, MOV, AVI, WebM videos are allowed")

    contents = await file.read()
    if len(contents) > 100 * 1024 * 1024:
        raise HTTPException(400, "Video must be under 100MB")

    try:
        import cloudinary, cloudinary.uploader
        cloudinary.config(cloud_name=cloud_name, api_key=api_key, api_secret=api_secret, secure=True)
        result = cloudinary.uploader.upload(
            contents,
            folder="vijeytextile/product-videos",
            resource_type="video",
        )
        return {"url": result["secure_url"], "public_id": result["public_id"]}
    except Exception as e:
        raise HTTPException(500, f"Cloudinary video upload failed: {e}")


@router.post("/orders/create-test", response_model=schemas.OrderOut, status_code=201)
def create_test_order(
    db:    Session      = Depends(get_db),
    admin: models.User = Depends(auth_utils.get_current_admin),
):
    """Create a dummy order so admin can test Delhivery / shipping integrations."""
    import random, string as _string

    product = db.query(models.Product).filter(models.Product.is_active == True).first()
    if not product:
        raise HTTPException(400, "No active products found — add a product first.")

    suffix       = "".join(random.choices(_string.ascii_uppercase + _string.digits, k=6))
    order_number = f"TEST-{suffix}"

    items_snapshot = [{
        "product_id": product.id,
        "name":       product.name,
        "category":   product.category,
        "price":      product.price,
        "quantity":   1,
        "size":       (product.size_options or ["M"])[0],
        "color":      (product.colors or ["Default"])[0],
        "image":      (product.images or [None])[0],
        "subtotal":   product.price,
    }]

    order = models.Order(
        order_number    = order_number,
        user_id         = admin.id,
        items_snapshot  = items_snapshot,
        subtotal        = product.price,
        shipping_fee    = 49.0,
        discount        = 0.0,
        total           = product.price + 49.0,
        status          = "confirmed",
        payment_status  = "pending",
        payment_method  = "cod",
        shipping_address = {
            "full_name":    "Test Customer",
            "phone":        "9999999999",
            "address_line1":"123 Test Street",
            "city":         "Coimbatore",
            "state":        "Tamil Nadu",
            "pincode":      "641001",
            "country":      "India",
        },
        notes = "🧪 TEST ORDER — for Delhivery integration testing only. Safe to cancel.",
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.get("/orders", response_model=List[schemas.OrderOut])
def get_all_orders(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_admin),
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
):
    # Opportunistic sync — the 15-min in-process poller alone isn't reliable
    # on a host that spins down when idle, so every time the admin actually
    # opens this dashboard is also a chance to self-heal any order that's
    # fallen behind Delhivery's real status. Best-effort: a Delhivery outage
    # must never break loading the order list itself.
    try:
        import courier_sync
        courier_sync.sync_all_open_orders(db)
    except Exception as e:
        print(f"[Admin Orders] opportunistic Delhivery sync error: {e}")

    query = db.query(models.Order)
    if status:
        query = query.filter(models.Order.status == status)
    return query.order_by(models.Order.created_at.desc()).offset(skip).limit(limit).all()


@router.put("/orders/{order_id}/status")
def update_order_status(
    order_id: int,
    payload: schemas.OrderStatusUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_admin),
):
    allowed = ["pending", "confirmed", "processing", "shipped", "out_for_delivery", "delivered", "cancelled"]
    if payload.status not in allowed:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {', '.join(allowed)}")

    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Status only ever moves forward, matching Amazon/Flipkart/Myntra — once
    # an order is Shipped it can't silently slide back to Processing. The
    # one exception is Cancelled, which is reachable from anything except an
    # order that's already Delivered or already Cancelled (see courier_sync).
    if order.status != payload.status and not courier_sync.is_valid_transition(order.status, payload.status):
        raise HTTPException(
            status_code=400,
            detail=f"Can't move an order from '{order.status}' back to '{payload.status}' — status only moves forward. Use Cancel if this order needs to be stopped.",
        )

    was_cancelled     = order.status == "cancelled"
    pre_cancel_status = order.status
    order.status = payload.status

    # ── Cancelled by admin: restore stock and cancel the courier pickup ───────
    # Mirrors the customer self-cancel flow in routers/orders.py::cancel_order —
    # without this, the shipment stays live with the courier (still shows
    # "ready for pickup" on Delhivery) even though the order is cancelled here.
    #
    # An order cancelled once it's already Shipped/Out for Delivery is an RTO,
    # not a simple cancel — the item is physically still with the courier or
    # at the customer's door, not back on the shelf. Restoring stock the
    # instant this button is clicked would let the shop oversell a unit that
    # isn't actually available yet. Instead: hold the stock, flag
    # rto_pending, and only restore it once courier_sync sees Delhivery
    # confirm the item is genuinely back at origin.
    if payload.status == "cancelled" and not was_cancelled:
        order.cancelled_by = "admin"
        if not order.cancel_reason:
            order.cancel_reason = "Cancelled by admin"

        is_rto = bool(order.awb_code) and pre_cancel_status in ("shipped", "out_for_delivery")

        if not is_rto:
            for item in order.items_snapshot:
                product = db.query(models.Product).filter(
                    models.Product.id == item["product_id"]
                ).first()
                if product:
                    product.stock += item["quantity"]
        else:
            order.rto_pending = True

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

    # ── Marked Shipped: hand it to Delhivery automatically ────────────────────
    # Previously "Shipped" was just a label — the courier was never actually
    # told, only a separate "🚚 Delhivery" button did that. Marking an order
    # Shipped now *is* the handoff, matching how Amazon/Flipkart/Myntra work.
    # Skipped if a courier was already set (existing AWB, or the admin is
    # manually recording a non-Delhivery courier in this same request via the
    # Ship Details modal) — and if Delhivery's API call fails, this raises,
    # which aborts the whole request so the order is never left saying
    # "Shipped" with nothing actually shipped.
    if payload.status == "shipped" and not order.awb_code and not payload.awb_code:
        _create_delhivery_shipment_for_order(order, db)

    # Update tracking / courier info if provided
    if payload.tracking_number:
        order.tracking_number = payload.tracking_number
    if payload.awb_code:
        order.awb_code = payload.awb_code
    if payload.courier_name:
        order.courier_name = payload.courier_name
    if payload.tracking_url:
        order.tracking_url = payload.tracking_url
    if payload.estimated_delivery:
        order.estimated_delivery = payload.estimated_delivery
    if payload.status_location:
        order.status_location = payload.status_location

    # Set delivery person info if provided
    if payload.delivery_person_name:
        order.delivery_person_name = payload.delivery_person_name
    if payload.delivery_person_phone:
        order.delivery_person_phone = payload.delivery_person_phone

    # ── Out for Delivery: generate a 6-digit delivery OTP ─────────────────────
    if payload.status == "out_for_delivery":
        otp = str(random.randint(100000, 999999))
        order.delivery_otp = otp

    # ── Delivered: stamp the time — this anchors the return/exchange windows ──
    if payload.status == "delivered" and not order.delivered_at:
        order.delivered_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(order)

    # ── Notify the customer by email ──────────────────────────────────────────
    user = db.query(models.User).filter(models.User.id == order.user_id).first()
    if user:
        if payload.status == "out_for_delivery":
            notifications.send_delivery_otp_email(
                user.email, user.full_name, order.delivery_otp,
                order.order_number,
                agent_name=order.delivery_person_name or "",
                agent_phone=order.delivery_person_phone or "",
            )
            notifications.send_delivery_otp_whatsapp(
                user.phone, user.full_name, order.delivery_otp,
                order.order_number,
                agent_name=order.delivery_person_name or "",
                agent_phone=order.delivery_person_phone or "",
            )
            notifications.send_otp_sms(
                user.phone,
                f"Delivery OTP for order {order.order_number}: {order.delivery_otp}. Share with delivery agent only.",
                "Delivery",
            )
        elif payload.status == "cancelled" and order.rto_pending:
            notifications.send_rto_cancellation_email(user.email, user.full_name, order)
            notifications.send_rto_cancellation_whatsapp(user.phone, user.full_name, order)
        else:
            notifications.send_order_status_email(user.email, user.full_name, order, payload.status)
            notifications.send_order_status_whatsapp(user.phone, user.full_name, order, payload.status)

        # After delivered, ask for a review
        if payload.status == "delivered":
            notifications.send_review_request_email(user.email, user.full_name, order)
            notifications.send_review_request_whatsapp(user.phone, user.full_name, order.order_number)

    return {
        "message": f"Order {order.order_number} updated to {payload.status}",
        "delivery_otp": order.delivery_otp if payload.status == "out_for_delivery" else None,
        "awb_code": order.awb_code,
    }


@router.get("/users", response_model=List[schemas.UserOut])
def get_all_users(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_admin),
):
    return db.query(models.User).filter(models.User.is_admin == False).all()


# ── Admin Account Management ───────────────────────────────────────────────────

@router.get("/admins")
def get_all_admins(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_admin),
):
    """List all admin accounts."""
    admins = db.query(models.User).filter(models.User.is_admin == True).all()
    return [
        {
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "phone": u.phone,
            "is_admin": u.is_admin,
            "created_at": str(u.created_at),
            "is_primary": u.email == os.getenv("ADMIN_EMAIL", "admin@vijeytextile.com"),
        }
        for u in admins
    ]


@router.patch("/users/{user_id}/revoke-admin")
def revoke_admin_access(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(auth_utils.get_current_admin),
):
    """Revoke admin access from a secondary admin account. Only the primary admin can do this."""
    primary = os.getenv("ADMIN_EMAIL", "admin@vijeytextile.com")

    # Only the primary admin can remove other admins
    if current_admin.email != primary:
        raise HTTPException(403, "Only the primary admin can remove admin access")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if user.email == primary:
        raise HTTPException(400, "Cannot revoke the primary admin account")
    if user.id == current_admin.id:
        raise HTTPException(400, "You cannot revoke your own admin access")

    user.is_admin = False
    db.commit()

    # Notify the revoked admin by email
    try:
        notifications.send_admin_revoked_email(user.email, user.full_name)
    except Exception as e:
        print(f"[Admin] Could not send revoke email to {user.email}: {e}")

    return {"message": f"Admin access removed from {user.full_name} ({user.email})"}


@router.post("/orders/{order_id}/create-shipment")
def create_shiprocket_shipment(
    order_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_admin),
):
    """
    Create a shipment on Shiprocket for this order.
    Requires SHIPROCKET_EMAIL + SHIPROCKET_PASSWORD in Render env vars.
    Also requires a 'Primary' pickup location set up in your Shiprocket account.
    """
    from shiprocket import shiprocket as sr

    if not sr.is_configured():
        raise HTTPException(400, "Shiprocket not configured. Add SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD to Render env vars.")

    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    if order.status == "cancelled":
        raise HTTPException(400, "Cannot create shipment for a cancelled order")

    user = db.query(models.User).filter(models.User.id == order.user_id).first()
    addr = order.shipping_address or {}

    # Build Shiprocket forward-shipment payload
    sr_payload = {
        "order_id":           order.order_number,
        "order_date":         order.created_at.strftime("%Y-%m-%d %H:%M"),
        "pickup_location":    os.getenv("SHIPROCKET_PICKUP_LOCATION", "Primary"),
        "billing_customer_name": addr.get("full_name", user.full_name if user else "Customer"),
        "billing_last_name":  "",
        "billing_address":    addr.get("address_line1", ""),
        "billing_address_2":  addr.get("address_line2", ""),
        "billing_city":       addr.get("city", ""),
        "billing_pincode":    addr.get("pincode", ""),
        "billing_state":      addr.get("state", ""),
        "billing_country":    "India",
        "billing_email":      user.email if user else "",
        "billing_phone":      addr.get("phone", user.phone if user else ""),
        "shipping_is_billing": True,
        "order_items": [
            {
                "name":          item.get("name", "Product"),
                "sku":           f"VJT-{item.get('product_id', 0)}",
                "units":         item.get("quantity", 1),
                "selling_price": item.get("price", 0),
            }
            for item in (order.items_snapshot or [])
        ],
        "payment_method":  "COD" if order.payment_method == "cod" else "Prepaid",
        "sub_total":       order.subtotal,
        "length":          25,
        "breadth":         20,
        "height":          5,
        "weight":          0.5,
    }

    result = sr.create_forward_shipment(sr_payload)
    if not result:
        raise HTTPException(502, "Shiprocket API call failed. Check SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD.")

    # Extract shipment details from response
    payload_data = result.get("payload", {})
    awb        = payload_data.get("awb_code", "")
    shipment_id= str(payload_data.get("shipment_id", ""))
    sr_order_id= str(payload_data.get("order_id", ""))
    courier    = payload_data.get("courier_name", "")

    if awb:
        order.awb_code              = awb
        order.shiprocket_order_id   = sr_order_id
        order.shiprocket_shipment_id= shipment_id
        order.courier_name          = courier
        order.tracking_url          = f"https://shiprocket.co/tracking/{awb}"
        if order.status in ["confirmed", "pending"]:
            order.status = "processing"
        db.commit()
        db.refresh(order)

    return {
        "message":     "Shipment created on Shiprocket",
        "awb_code":    awb,
        "courier":     courier,
        "shipment_id": shipment_id,
        "tracking_url": f"https://shiprocket.co/tracking/{awb}" if awb else None,
        "shiprocket_response": result,
    }


def _create_delhivery_shipment_for_order(order, db: Session) -> str:
    """
    Calls Delhivery's create-shipment API for `order`, validates the
    response, and saves awb_code/courier_name/tracking_url onto it.

    Raises HTTPException on any failure — callers must let that propagate
    rather than swallow it, since a "Shipped" order with no real shipment
    behind it is exactly the bug this whole flow exists to prevent.

    Does not touch order.status and does not commit — the caller decides
    the resulting status and commits, since the two call sites (the
    dedicated create-shipment endpoint, and auto-creation when an admin
    marks an order Shipped) want different status transitions.
    """
    import delhivery as dl

    if not dl.is_configured():
        raise HTTPException(400, "Delhivery not configured. Add DELHIVERY_API_TOKEN to Render env vars.")

    user = db.query(models.User).filter(models.User.id == order.user_id).first()
    result = dl.create_shipment(order, user)
    print(f"[Delhivery] Full response: {result}")   # visible in Render logs

    awb, err = dl.parse_create_response(result)
    if not awb:
        raise HTTPException(502, f"Delhivery shipment failed: {err}")

    order.awb_code     = awb
    order.courier_name = "Delhivery"
    order.tracking_url = f"https://www.delhivery.com/track/package/{awb}"
    return awb


@router.post("/orders/{order_id}/create-delhivery-shipment")
def create_delhivery_shipment(
    order_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_admin),
):
    """
    Create a shipment on Delhivery Direct for this order.
    Requires DELHIVERY_API_TOKEN in Render env vars.
    Also requires a pickup location named 'Primary' (or set DELHIVERY_PICKUP_NAME)
    set up in your Delhivery dashboard.
    """
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    if order.status == "cancelled":
        raise HTTPException(400, "Cannot create shipment for a cancelled order")
    if order.awb_code:
        raise HTTPException(400, f"Shipment already created. AWB: {order.awb_code}")

    awb = _create_delhivery_shipment_for_order(order, db)

    if order.status in ["pending", "confirmed"]:
        order.status = "processing"

    db.commit()
    db.refresh(order)

    # Notify customer that order is being shipped
    customer = db.query(models.User).filter(models.User.id == order.user_id).first()
    if customer:
        notifications.send_order_status_email(customer.email, customer.full_name, order, order.status)
        notifications.send_order_status_whatsapp(customer.phone, customer.full_name, order, order.status)

    return {
        "message":      "Shipment created on Delhivery ✅",
        "awb_code":     awb,
        "courier":      "Delhivery",
        "tracking_url": order.tracking_url,
    }


@router.post("/orders/{order_id}/sync-delhivery")
def sync_order_delhivery_now(
    order_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_admin),
):
    """
    On-demand version of courier_sync.sync_all_open_orders() for a single
    order — an immediate "Sync now" for when an admin has spotted a specific
    order that looks stale and doesn't want to wait for the next opportunistic
    or timed sync to catch it.
    """
    import delhivery as dl

    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    if not order.awb_code:
        raise HTTPException(400, "This order has no Delhivery AWB yet — nothing to sync.")
    if not dl.is_configured():
        raise HTTPException(500, "Delhivery not configured. Add DELHIVERY_API_TOKEN to Render env vars.")

    raw = dl.track_awb(order.awb_code)
    if not raw:
        raise HTTPException(502, "Could not reach Delhivery — check the AWB and try again in a moment.")

    current = dl.parse_current_status(raw)
    action = courier_sync.sync_order_from_delhivery(order, current, db)
    db.refresh(order)

    return {
        "message":          f"Delhivery reports: {current.get('status') or 'no status yet'}",
        "action":           action,
        "status":           order.status,
        "delhivery_status": current.get("status"),
        "location":         order.status_location,
    }


@router.get("/orders/{order_id}/check-serviceability")
def check_serviceability(
    order_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_admin),
):
    """Check if the customer's pincode is serviceable by Delhivery."""
    import delhivery as dl

    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")

    addr      = order.shipping_address or {}
    dest_pin  = str(addr.get("pincode", ""))
    origin_pin= os.getenv("DELHIVERY_RETURN_PIN", "638001")

    result = dl.check_serviceability(origin_pin, dest_pin)
    return {
        "dest_pincode":  dest_pin,
        "origin_pincode":origin_pin,
        "serviceable":   bool(result and not result.get("error")),
        "details":       result,
    }


@router.get("/returns", response_model=List[schemas.ReturnRequestOut])
def get_all_returns(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_admin),
):
    # Opportunistic sync — same reasoning as get_all_orders(): the 15-min
    # in-process poller alone isn't reliable on a host that spins down when
    # idle, so every dashboard load is also a chance to auto-complete any
    # exchange replacement that's already been delivered.
    try:
        courier_sync.sync_all_open_returns(db)
    except Exception as e:
        print(f"[Admin Returns] opportunistic Delhivery sync error: {e}")

    return db.query(models.ReturnRequest).order_by(models.ReturnRequest.created_at.desc()).all()


@router.post("/returns/{return_id}/sync-delhivery")
def sync_return_delhivery_now(
    return_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_admin),
):
    """On-demand single-return version of sync_all_open_returns() — checks
    whichever live Delhivery leg this return is currently waiting on (the
    reverse pickup, or the exchange's replacement shipment) right now, for
    an admin who's spotted a specific return that looks stale."""
    import delhivery as dl

    rr = db.query(models.ReturnRequest).filter(models.ReturnRequest.id == return_id).first()
    if not rr:
        raise HTTPException(404, "Return request not found")
    if not dl.is_configured():
        raise HTTPException(500, "Delhivery not configured. Add DELHIVERY_API_TOKEN to Render env vars.")

    order = db.query(models.Order).filter(models.Order.id == rr.order_id).first()
    user  = db.query(models.User).filter(models.User.id == rr.user_id).first()

    if rr.return_awb and rr.status == "pickup_scheduled":
        action, delhivery_status = courier_sync._check_return_pickup(rr, order, user, db)
        return {
            "message":          f"Delhivery reports: {delhivery_status or 'no status yet'}",
            "status":           rr.status,
            "delhivery_status": delhivery_status,
        }

    if rr.replacement_awb and rr.status == "replacement_shipped":
        action, delhivery_status = courier_sync._check_replacement_delivery(rr, order, user, db)
        return {
            "message":          f"Delhivery reports: {delhivery_status or 'no status yet'}",
            "status":           rr.status,
            "delhivery_status": delhivery_status,
        }

    raise HTTPException(400, "This return has no active Delhivery shipment to sync right now.")


@router.put("/returns/{return_id}/status")
def update_return_status(
    return_id: int,
    payload: schemas.ReturnStatusUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_admin),
):
    VALID_STATUSES = [
        "pending", "under_review", "approved", "rejected",
        "pickup_scheduled", "picked_up", "processing",
        "replacement_shipped", "refund_initiated", "refunded", "completed",
    ]
    if payload.status not in VALID_STATUSES:
        raise HTTPException(400, f"Invalid status")

    rr = db.query(models.ReturnRequest).filter(models.ReturnRequest.id == return_id).first()
    if not rr:
        raise HTTPException(404, "Return request not found")

    # These are only ever reached through a real, verified courier/payment
    # confirmation — pickup_scheduled and refund_initiated/refunded from a
    # genuine Delhivery pickup + Razorpay webhook (see courier_sync.py /
    # payments.py), replacement_shipped from a genuine Delhivery shipment
    # call, and an exchange's completed from a genuine "Delivered" scan on
    # the replacement. Accepting them here too let an admin hand-set
    # "Refunded" before the money had actually moved. picked_up (and,
    # for a plain return, completed) stay admin-settable by design.
    SYSTEM_ONLY_STATUSES = {"pickup_scheduled", "refund_initiated", "refunded", "replacement_shipped"}
    if payload.status in SYSTEM_ONLY_STATUSES or (payload.status == "completed" and rr.request_type == "exchange"):
        raise HTTPException(
            400,
            f"'{payload.status}' can't be set manually — it's only applied automatically once Delhivery/Razorpay "
            f"actually confirms it. Use the Retry Pickup / Retry Replacement / Sync button instead.",
        )

    previous_status = rr.status
    rr.status = payload.status
    # Every status rr.status actually passes through this request, in order —
    # the admin's explicit choice plus anything auto-advanced further below
    # (e.g. approving a return that also auto-schedules pickup). Each one is
    # its own milestone from the customer's point of view and gets its own
    # notification, not just whichever status this ends up resolving to.
    milestones = [payload.status]
    if payload.admin_notes:
        rr.admin_notes = payload.admin_notes

    order = db.query(models.Order).filter(models.Order.id == rr.order_id).first()
    user  = db.query(models.User).filter(models.User.id == rr.user_id).first()

    # Reserve stock for the replacement item the first time an exchange is
    # approved — guarded so re-saving an already-approved request never
    # double-decrements.
    if payload.status == "approved" and previous_status != "approved" and rr.request_type == "exchange" and rr.new_product_id:
        qty = 1
        if order:
            item = next((i for i in (order.items_snapshot or []) if i.get("product_id") == rr.product_id), None)
            if item:
                qty = item.get("quantity", 1)
        new_product = db.query(models.Product).filter(models.Product.id == rr.new_product_id).first()
        if new_product:
            if new_product.stock < qty:
                raise HTTPException(400, f'"{new_product.name}" only has {new_product.stock} in stock — cannot approve this exchange.')
            new_product.stock -= qty

    # Approving a RETURN or EXCHANGE auto-schedules a Delhivery pickup (best
    # effort — never blocks the approval if the courier call fails; admin
    # can always retry from the UI, which surfaces the real Delhivery error
    # via rr.pickup_error instead of a generic "not confirmed" message).
    # An exchange is physically the same pickup as a return (the old item
    # still has to come back) — it just never called Delhivery at all
    # before this.
    if payload.status == "approved" and previous_status != "approved" and rr.request_type in ("return", "exchange") and order and user:
        if courier_sync._attempt_return_pickup(rr, order, user):
            milestones.append("pickup_scheduled")

    # Once picked_up (whether the admin sets it by hand here, or Delhivery's
    # own reverse-pickup scan sets it automatically via courier_sync — see
    # sync_all_open_returns), immediately run its follow-on effects: a
    # RETURN auto-initiates the Razorpay refund, an EXCHANGE auto-ships the
    # replacement (second leg of the two-leg pattern — reverse pickup, then
    # a fresh forward shipment, not a same-visit swap). Best effort either
    # way: failure leaves the admin to retry from the UI (surfacing the
    # real error via rr.pickup_error/replacement_error) or act manually.
    if payload.status == "picked_up":
        milestones.extend(courier_sync._process_picked_up(rr, order, user))

    db.commit()
    db.refresh(rr)

    # Notify customer — once per milestone actually reached this request
    # (see `milestones` above), not just the final resolved status.
    if user and order:
        for s in milestones:
            try:
                notifications.send_return_status_email(user.email, user.full_name, order, rr, status=s)
                notifications.send_return_status_whatsapp(user.phone, user.full_name, order, rr, status=s)
            except Exception as e:
                print(f"[Returns] Notification error ({s}): {e}")
        if rr.status == "refund_initiated":
            try:
                notifications.send_refund_initiated_email(user.email, user.full_name, order, rr.refund_id or "")
                notifications.send_refund_initiated_sms(user.phone, order.order_number, order.total)
                notifications.send_refund_initiated_whatsapp(user.phone, user.full_name, order, rr.refund_id or "")
            except Exception as e:
                print(f"[Returns] Refund notification error: {e}")

    return {"message": f"Return request updated to {rr.status}", "return_id": return_id, "status": rr.status}


@router.post("/returns/{return_id}/retry-pickup")
def retry_return_pickup(
    return_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_admin),
):
    """
    Manually re-attempts scheduling a Delhivery pickup for a return/exchange
    that's stuck without one — surfaces the exact Delhivery error in the
    response so the admin doesn't have to dig through server logs to find
    out why the automatic attempt failed.
    """
    rr = db.query(models.ReturnRequest).filter(models.ReturnRequest.id == return_id).first()
    if not rr:
        raise HTTPException(404, "Return request not found")
    if rr.return_awb:
        raise HTTPException(400, f"This {rr.request_type} already has a confirmed pickup (AWB {rr.return_awb}).")

    order = db.query(models.Order).filter(models.Order.id == rr.order_id).first()
    user  = db.query(models.User).filter(models.User.id == rr.user_id).first()
    if not order or not user:
        raise HTTPException(400, "Order or customer not found for this return.")

    success = courier_sync._attempt_return_pickup(rr, order, user)
    db.commit()
    db.refresh(rr)

    if not success:
        raise HTTPException(502, f"Delhivery pickup still failed: {rr.pickup_error}")

    return {
        "message":    f"Pickup scheduled — AWB {rr.return_awb}",
        "return_awb": rr.return_awb,
        "status":     rr.status,
    }


@router.post("/returns/{return_id}/attach-awb")
def attach_return_awb(
    return_id: int,
    payload: schemas.AttachAwbPayload,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_admin),
):
    """
    Links a return/exchange to a Delhivery pickup AWB that already exists on
    Delhivery's side but this app's own records never captured — e.g. the
    automatic pickup call appeared to fail here but Delhivery actually
    dispatched an agent anyway (a lost response, not a real rejection), or
    someone scheduled the pickup by hand directly in Delhivery's own
    dashboard. Once linked, this return is picked up by the same automatic
    polling as every other pickup — no separate manual status update needed
    from here on.
    """
    rr = db.query(models.ReturnRequest).filter(models.ReturnRequest.id == return_id).first()
    if not rr:
        raise HTTPException(404, "Return request not found")
    if rr.return_awb:
        raise HTTPException(400, f"This {rr.request_type} already has an AWB on file (AWB {rr.return_awb}).")

    order = db.query(models.Order).filter(models.Order.id == rr.order_id).first()
    user  = db.query(models.User).filter(models.User.id == rr.user_id).first()
    if not order or not user:
        raise HTTPException(400, "Order or customer not found for this return.")

    success, message = courier_sync._attach_existing_pickup_awb(rr, payload.awb, db)
    if not success:
        raise HTTPException(400, message)

    # Immediately pull the live status too — if Delhivery already shows this
    # picked up (or further along), resolve it in this same action instead
    # of waiting for the next poll.
    _action, delhivery_status = courier_sync._check_return_pickup(rr, order, user, db)
    db.refresh(rr)

    return {
        "message":          f"AWB linked. Delhivery reports: {delhivery_status or 'no status yet'}",
        "return_awb":       rr.return_awb,
        "status":           rr.status,
        "delhivery_status": delhivery_status,
    }


@router.post("/returns/{return_id}/retry-replacement")
def retry_replacement_shipment(
    return_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_admin),
):
    """Manual retry for an exchange's replacement forward shipment — same
    idea as retry-pickup above, for the second leg."""
    rr = db.query(models.ReturnRequest).filter(models.ReturnRequest.id == return_id).first()
    if not rr:
        raise HTTPException(404, "Return request not found")
    if rr.request_type != "exchange":
        raise HTTPException(400, "Only exchanges have a replacement shipment.")
    if rr.replacement_awb:
        raise HTTPException(400, f"This exchange already has a confirmed replacement shipment (AWB {rr.replacement_awb}).")

    order = db.query(models.Order).filter(models.Order.id == rr.order_id).first()
    user  = db.query(models.User).filter(models.User.id == rr.user_id).first()
    if not order or not user:
        raise HTTPException(400, "Order or customer not found for this return.")

    success = courier_sync._attempt_replacement_shipment(rr, order, user)
    db.commit()
    db.refresh(rr)

    if not success:
        raise HTTPException(502, f"Replacement shipment still failed: {rr.replacement_error}")

    return {
        "message":         f"Replacement shipment created — AWB {rr.replacement_awb}",
        "replacement_awb": rr.replacement_awb,
        "status":          rr.status,
    }


@router.get("/notifications")
def get_admin_notifications(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_admin),
):
    """Return last 50 admin notifications newest-first."""
    from sqlalchemy import desc
    notifs = (
        db.query(models.AdminNotification)
        .order_by(desc(models.AdminNotification.created_at))
        .limit(50)
        .all()
    )
    return [
        {
            "id": n.id,
            "type": n.type,
            "order_id": n.order_id,
            "return_request_id": n.return_request_id,
            "title": n.title,
            "message": n.message,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
            "user": {"full_name": n.user.full_name, "phone": n.user.phone} if n.user else None,
        }
        for n in notifs
    ]


@router.put("/notifications/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_admin),
):
    db.query(models.AdminNotification).filter(
        models.AdminNotification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read"}


@router.put("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_admin),
):
    n = db.query(models.AdminNotification).filter(
        models.AdminNotification.id == notification_id
    ).first()
    if not n:
        raise HTTPException(404, "Notification not found")
    n.is_read = True
    db.commit()
    return {"message": "Marked as read"}


@router.get("/support-ratings")
def get_support_ratings(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_admin),
):
    ratings = db.query(models.SupportRating).order_by(models.SupportRating.created_at.desc()).limit(100).all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "email": r.email,
            "phone": r.phone,
            "rating": r.rating,
            "category": r.category,
            "message": r.message,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in ratings
    ]


# ── One-off maintenance: wipe test orders, keeping a named list ───────────────
# Temporary — remove this endpoint once used. Deletes every order whose
# order_number isn't in `keep`, plus its dependent return_requests /
# admin_notifications rows (deleted explicitly rather than relying on the
# live DB actually having the ON DELETE CASCADE constraint this app's
# models declare, since this project applies schema changes via ad-hoc
# ALTER TABLE statements at startup rather than real migrations).
@router.post("/maintenance/cleanup-orders")
def cleanup_orders_keep_only(
    keep: str,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_admin),
):
    keep_set = {s.strip() for s in keep.split(",") if s.strip()}
    if not keep_set:
        raise HTTPException(400, "Refusing to run with an empty keep list — this would delete every order.")

    to_delete_ids = [
        row[0] for row in
        db.query(models.Order.id).filter(~models.Order.order_number.in_(keep_set)).all()
    ]
    if not to_delete_ids:
        return {"message": "Nothing to delete — every order is already in the keep list.", "deleted_orders": 0}

    db.query(models.ReturnRequest).filter(models.ReturnRequest.order_id.in_(to_delete_ids)).delete(synchronize_session=False)
    db.query(models.AdminNotification).filter(models.AdminNotification.order_id.in_(to_delete_ids)).delete(synchronize_session=False)
    deleted = db.query(models.Order).filter(models.Order.id.in_(to_delete_ids)).delete(synchronize_session=False)
    db.commit()

    return {"message": f"Deleted {deleted} orders.", "deleted_orders": deleted, "kept_order_numbers": sorted(keep_set)}
