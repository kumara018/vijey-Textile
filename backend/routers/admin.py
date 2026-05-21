from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
import os, random
from database import get_db
import models, schemas, auth as auth_utils, notifications

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

    for field, value in payload.model_dump(exclude_none=True).items():
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
            folder="ammalutex/products",
            resource_type="image",
            transformation=[{"width": 900, "height": 900, "crop": "limit", "quality": "auto", "fetch_format": "auto"}],
        )
        return {"url": result["secure_url"], "public_id": result["public_id"]}
    except Exception as e:
        raise HTTPException(500, f"Cloudinary upload failed: {e}")


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

    order.status = payload.status

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
            "is_primary": u.email == os.getenv("ADMIN_EMAIL", "kumaragurubaran27102@gmail.com"),
        }
        for u in admins
    ]


@router.post("/users/grant-admin")
def grant_admin_access(
    payload: dict,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_admin),
):
    """Grant admin access to an existing user by email."""
    email = (payload.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(400, "Email is required")
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(404, f"No registered user found with email: {email}. The person must sign up first.")
    if user.is_admin:
        raise HTTPException(400, "This user already has admin access")
    user.is_admin = True
    db.commit()
    # Notify the new admin by email and WhatsApp
    notifications.send_admin_access_email(user.email, user.full_name)
    if user.phone:
        notifications.send_admin_access_whatsapp(user.phone, user.full_name)
    return {"message": f"✅ Admin access granted to {user.full_name} ({email})", "user_id": user.id}


@router.patch("/users/{user_id}/revoke-admin")
def revoke_admin_access(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(auth_utils.get_current_admin),
):
    """Revoke admin access from a secondary admin account. Only the primary admin can do this."""
    primary = os.getenv("ADMIN_EMAIL", "kumaragurubaran27102@gmail.com")

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
                "sku":           f"AMT-{item.get('product_id', 0)}",
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
    import delhivery as dl

    if not dl.is_configured():
        raise HTTPException(400, "Delhivery not configured. Add DELHIVERY_API_TOKEN to Render env vars.")

    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    if order.status == "cancelled":
        raise HTTPException(400, "Cannot create shipment for a cancelled order")
    if order.awb_code:
        raise HTTPException(400, f"Shipment already created. AWB: {order.awb_code}")

    user = db.query(models.User).filter(models.User.id == order.user_id).first()

    result = dl.create_shipment(order, user)
    if not result:
        raise HTTPException(502, "Delhivery API call failed. Check Render logs for details.")

    print(f"[Delhivery] Full response: {result}")   # visible in Render logs

    # Response format: { "packages": [{ "waybill": "...", "refnum": "...", "sort_code": "..." }], "success": true/false }
    packages = result.get("packages", [])
    success  = result.get("success", False)

    # Check top-level failure
    if not success and not packages:
        err_msg = result.get("rmk") or result.get("error") or str(result)
        raise HTTPException(502, f"Delhivery shipment failed: {err_msg}")

    # Check package-level errors (Delhivery sometimes returns success=true but error inside package)
    if packages:
        pkg_err = packages[0].get("error") or packages[0].get("remarks") or ""
        awb     = packages[0].get("waybill", "")
        if pkg_err and not awb:
            raise HTTPException(502, f"Delhivery shipment failed: {pkg_err}")
    else:
        top_err = result.get("rmk") or result.get("error") or str(result)
        raise HTTPException(502, f"Delhivery shipment failed: {top_err}")

    awb = packages[0].get("waybill", "")
    if not awb:
        raise HTTPException(502, f"Delhivery did not return an AWB. Full response: {result}")

    # Save to order
    order.awb_code     = awb
    order.courier_name = "Delhivery"
    order.tracking_url = f"https://www.delhivery.com/track/package/{awb}"
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
        "tracking_url": f"https://www.delhivery.com/track/package/{awb}",
        "packages":     packages,
        "raw_response": result,
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
    return db.query(models.ReturnRequest).order_by(models.ReturnRequest.created_at.desc()).all()


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
        "refund_initiated", "replacement_shipped", "completed",
    ]
    if payload.status not in VALID_STATUSES:
        raise HTTPException(400, f"Invalid status")

    rr = db.query(models.ReturnRequest).filter(models.ReturnRequest.id == return_id).first()
    if not rr:
        raise HTTPException(404, "Return request not found")

    rr.status = payload.status
    if payload.admin_notes:
        rr.admin_notes = payload.admin_notes

    # If refund_initiated for a return type — trigger Razorpay refund
    if payload.status == "refund_initiated" and rr.request_type == "return":
        order = db.query(models.Order).filter(models.Order.id == rr.order_id).first()
        if order and order.payment_method != "cod" and order.payment_transaction_id and order.payment_transaction_id.startswith("pay_"):
            import razorpay as _rp, os as _os
            key_id     = _os.getenv("RAZORPAY_KEY_ID", "")
            key_secret = _os.getenv("RAZORPAY_KEY_SECRET", "")
            if key_id and key_secret:
                try:
                    client = _rp.Client(auth=(key_id, key_secret))
                    refund = client.payment.refund(
                        order.payment_transaction_id,
                        {"amount": int(order.total * 100), "speed": "normal",
                         "notes": {"order_number": order.order_number, "reason": rr.reason}},
                    )
                    rr.refund_id = refund.get("id", "")
                    order.payment_status = "refund_initiated"   # webhook fires refund.processed → "refunded"
                    print(f"[Returns] Razorpay refund {rr.refund_id} initiated for return {return_id}")
                except Exception as e:
                    print(f"[Returns] Razorpay refund error: {e}")

    db.commit()
    db.refresh(rr)

    # Notify customer
    user = db.query(models.User).filter(models.User.id == rr.user_id).first()
    order = db.query(models.Order).filter(models.Order.id == rr.order_id).first()
    if user and order:
        try:
            notifications.send_return_status_email(user.email, user.full_name, order, rr)
            notifications.send_return_status_whatsapp(user.phone, user.full_name, order, rr)
        except Exception as e:
            print(f"[Returns] Notification error: {e}")

    return {"message": f"Return request updated to {payload.status}", "return_id": return_id}


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
