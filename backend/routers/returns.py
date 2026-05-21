"""Return / Exchange / Replace requests."""
import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas, auth as auth_utils, notifications

router = APIRouter(prefix="/api/returns", tags=["Returns"])

RETURN_WINDOW_DAYS = 7  # days after delivery to allow return requests

VALID_REASONS = [
    "Size doesn't fit",
    "Damaged product",
    "Stitching / quality issue",
    "Wrong item received",
    "Colour different from photo",
    "Other",
]


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
        raise HTTPException(400, "Return requests can only be made for delivered orders")

    # Check if any item in the order is non-returnable
    items = order.items_snapshot or []
    product_ids = [item.get("product_id") for item in items if item.get("product_id")]
    if product_ids:
        non_returnable = db.query(models.Product).filter(
            models.Product.id.in_(product_ids),
            models.Product.is_returnable == False,
        ).first()
        if non_returnable:
            raise HTTPException(400, f'"{non_returnable.name}" is a non-returnable product. Returns are not accepted for this item.')

    # Check if return request already exists
    existing = db.query(models.ReturnRequest).filter(
        models.ReturnRequest.order_id == payload.order_id,
        models.ReturnRequest.status.notin_(["rejected", "completed"]),
    ).first()
    if existing:
        raise HTTPException(400, "A return request already exists for this order")

    rr = models.ReturnRequest(
        order_id     = payload.order_id,
        user_id      = current_user.id,
        request_type = payload.request_type,
        reason       = payload.reason,
        description  = payload.description,
        images       = payload.images or [],
        status       = "pending",
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
