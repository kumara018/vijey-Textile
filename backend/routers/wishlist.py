from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, auth as auth_utils

router = APIRouter(prefix="/api/wishlist", tags=["Wishlist"])


@router.get("/")
def get_wishlist(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    """Return all wishlist items for the logged-in user."""
    items = (
        db.query(models.WishlistItem)
        .filter(models.WishlistItem.user_id == current_user.id)
        .order_by(models.WishlistItem.created_at.desc())
        .all()
    )
    return [
        {
            "id":         item.id,
            "product_id": item.product_id,
            "created_at": item.created_at,
            "product": {
                "id":            item.product.id,
                "name":          item.product.name,
                "price":         item.product.price,
                "compare_price": item.product.compare_price,
                "category":      item.product.category,
                "images":        item.product.images,
                "stock":         item.product.stock,
                "rating_avg":    item.product.rating_avg,
                "rating_count":  item.product.rating_count,
                "is_active":     item.product.is_active,
            },
        }
        for item in items
        if item.product and item.product.is_active
    ]


@router.post("/")
def add_to_wishlist(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    """Add a product to wishlist. Ignores duplicates."""
    product_id = payload.get("product_id")
    if not product_id:
        raise HTTPException(status_code=400, detail="product_id is required")

    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    existing = (
        db.query(models.WishlistItem)
        .filter(
            models.WishlistItem.user_id == current_user.id,
            models.WishlistItem.product_id == product_id,
        )
        .first()
    )
    if existing:
        return {"message": "Already in wishlist", "id": existing.id}

    item = models.WishlistItem(user_id=current_user.id, product_id=product_id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"message": "Added to wishlist", "id": item.id}


@router.delete("/{product_id}")
def remove_from_wishlist(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    """Remove a product from wishlist."""
    item = (
        db.query(models.WishlistItem)
        .filter(
            models.WishlistItem.user_id == current_user.id,
            models.WishlistItem.product_id == product_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found in wishlist")
    db.delete(item)
    db.commit()
    return {"message": "Removed from wishlist"}


@router.get("/ids")
def get_wishlist_ids(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    """Return only the product_ids in wishlist — used to show filled/unfilled hearts."""
    items = (
        db.query(models.WishlistItem.product_id)
        .filter(models.WishlistItem.user_id == current_user.id)
        .all()
    )
    return [row[0] for row in items]
