from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas, auth as auth_utils, notifications

router = APIRouter(prefix="/api/cart", tags=["Cart"])


@router.get("/", response_model=List[schemas.CartItemOut])
def get_cart(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    return (
        db.query(models.CartItem)
        .filter(models.CartItem.user_id == current_user.id)
        .all()
    )


@router.post("/", response_model=schemas.CartItemOut, status_code=status.HTTP_201_CREATED)
def add_to_cart(
    payload: schemas.CartItemAdd,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    product = db.query(models.Product).filter(
        models.Product.id == payload.product_id,
        models.Product.is_active == True,
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if product.stock < payload.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Only {product.stock} items available in stock",
        )

    existing = db.query(models.CartItem).filter(
        models.CartItem.user_id == current_user.id,
        models.CartItem.product_id == payload.product_id,
        models.CartItem.size == payload.size,
        models.CartItem.color == payload.color,
    ).first()

    if existing:
        new_qty = existing.quantity + payload.quantity
        if new_qty > product.stock:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot add more. Only {product.stock} available and you already have {existing.quantity} in cart.",
            )
        if new_qty > 10:
            raise HTTPException(status_code=400, detail="Maximum 10 items per product allowed")
        existing.quantity = new_qty
        db.commit()
        db.refresh(existing)

        # Notify for quantity update as well
        all_items = db.query(models.CartItem).filter(
            models.CartItem.user_id == current_user.id
        ).all()
        cart_snapshot = [
            {
                "name":     ci.product.name,
                "category": ci.product.category,
                "price":    ci.product.price,
                "quantity": ci.quantity,
                "size":     ci.size or "",
                "color":    ci.color or "",
            }
            for ci in all_items
        ]
        notifications.send_cart_add_email(
            current_user.email, current_user.full_name,
            product.name, product.category,
            payload.quantity, payload.size or "", payload.color or "",
            cart_snapshot,
        )
        notifications.send_cart_add_sms(
            current_user.phone, product.name, payload.quantity, cart_snapshot,
        )
        return existing

    item = models.CartItem(
        user_id=current_user.id,
        product_id=payload.product_id,
        quantity=payload.quantity,
        size=payload.size,
        color=payload.color,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    # Build full cart snapshot for email/SMS
    all_items = db.query(models.CartItem).filter(
        models.CartItem.user_id == current_user.id
    ).all()
    cart_snapshot = [
        {
            "name":     ci.product.name,
            "category": ci.product.category,
            "price":    ci.product.price,
            "quantity": ci.quantity,
            "size":     ci.size or "",
            "color":    ci.color or "",
        }
        for ci in all_items
    ]

    # Email + SMS — fire-and-forget
    notifications.send_cart_add_email(
        current_user.email, current_user.full_name,
        product.name, product.category,
        payload.quantity, payload.size or "", payload.color or "",
        cart_snapshot,
    )
    notifications.send_cart_add_sms(
        current_user.phone, product.name, payload.quantity, cart_snapshot,
    )
    return item


@router.put("/{item_id}", response_model=schemas.CartItemOut)
def update_cart_item(
    item_id: int,
    quantity: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    if quantity < 1 or quantity > 10:
        raise HTTPException(status_code=400, detail="Quantity must be between 1 and 10")

    item = db.query(models.CartItem).filter(
        models.CartItem.id == item_id,
        models.CartItem.user_id == current_user.id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")

    if quantity > item.product.stock:
        raise HTTPException(
            status_code=400,
            detail=f"Only {item.product.stock} items available in stock",
        )

    item.quantity = quantity
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_from_cart(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    item = db.query(models.CartItem).filter(
        models.CartItem.id == item_id,
        models.CartItem.user_id == current_user.id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")

    # Capture product info before deletion
    removed_name     = item.product.name
    removed_category = item.product.category

    db.delete(item)
    db.commit()

    # Build remaining cart for notification
    remaining_items = db.query(models.CartItem).filter(
        models.CartItem.user_id == current_user.id
    ).all()
    cart_snapshot = [
        {
            "name":     ci.product.name,
            "category": ci.product.category,
            "price":    ci.product.price,
            "quantity": ci.quantity,
            "size":     ci.size or "",
            "color":    ci.color or "",
        }
        for ci in remaining_items
    ]

    # Email + SMS — fire-and-forget
    notifications.send_cart_remove_email(
        current_user.email, current_user.full_name,
        removed_name, removed_category, cart_snapshot,
    )
    notifications.send_cart_remove_sms(
        current_user.phone, removed_name, cart_snapshot,
    )


@router.delete("/", status_code=status.HTTP_204_NO_CONTENT)
def clear_cart(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    db.query(models.CartItem).filter(
        models.CartItem.user_id == current_user.id
    ).delete()
    db.commit()
