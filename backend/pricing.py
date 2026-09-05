"""
What an order costs. One place, read from the database.

WHY THIS FILE EXISTS.

The browser used to decide. /payments/create-order took `amount` from the
request and opened a Razorpay order for exactly that many rupees, with no
reference to any product. Two things followed from that, and both were live:

  1. Buy It Now charged a flat 49 rupees for anything. The checkout page
     computed `grandTotal = cartTotal + shipping`, and a direct purchase
     deliberately has an empty bag — so `cartTotal` was 0, and every customer
     who used Buy It Now paid the shipping fee and nothing for the garment.
     Order AMT-NU23B2RU (Ammalu Tex) captured 4900 paise against a 5000-paise order; on a
     3,000-rupee saree it would have captured 49 rupees.

  2. Anyone could pay any amount. The field was accepted as sent, so a POST
     carrying `{"amount": 1}` bought a full bag for one rupee. No exploit was
     needed — just the request the page already makes, with one number changed.

Both are the same defect: the price came from the client. It is computed here
now, from Product.price rows, and `create-order` and `place_order` both call
this so the amount authorised and the amount recorded cannot disagree.

THAT THEY CANNOT DISAGREE IS ALSO WHY REFUNDS WORK. A cancellation refunds the
order total; Razorpay refuses to return more than it captured, so the 100-paise
gap above made the refund fail outright — and it failed inside a `try` that only
logged, leaving the order cancelled, the customer's money kept, and an admin
button that failed the same way when pressed.
"""
from types import SimpleNamespace

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

import models

#: Flat, and the same number the policy pages quote. Not weight-based — the
#: shipping copy used to claim it was, and did not match this.
SHIPPING_FEE = 49.0


class PricingError(HTTPException):
    """A reason the order cannot be priced, in words a customer can act on."""

    def __init__(self, detail: str, code: int = status.HTTP_400_BAD_REQUEST):
        super().__init__(status_code=code, detail=detail)


def resolve_line_items(db: Session, user_id: int, buy_now) -> list:
    """
    The pieces being bought: one, or the whole bag.

    A direct purchase is wrapped in a SimpleNamespace carrying exactly the four
    attributes the pricing loop reads. Deliberately NOT a transient CartItem —
    assigning `.product` on one associates it with a persistent Product, and
    SQLAlchemy would cascade that into the session and write a real cart row on
    commit. A SimpleNamespace cannot.
    """
    if buy_now is not None:
        product = (
            db.query(models.Product)
            .filter(models.Product.id == buy_now.product_id)
            .first()
        )
        if not product:
            raise PricingError("That piece is no longer available.", status.HTTP_404_NOT_FOUND)
        return [SimpleNamespace(
            product=product,
            product_id=product.id,
            quantity=buy_now.quantity,
            size=buy_now.size,
            color=buy_now.color,
        )]

    cart_items = (
        db.query(models.CartItem)
        .filter(models.CartItem.user_id == user_id)
        .all()
    )
    if not cart_items:
        raise PricingError("Your cart is empty. Please add items before placing an order.")
    return cart_items


def price_items(cart_items: list) -> tuple[list[dict], float, float, str | None]:
    """
    (snapshot, subtotal, total, stock_error) for the given lines.

    `stock_error` is returned rather than raised because the two callers must do
    different things with it: create-order refuses before any money moves, while
    place_order has already taken payment and has to refund before it refuses.
    """
    items_snapshot: list[dict] = []
    subtotal = 0.0

    for item in cart_items:
        product = item.product
        if not product or not product.is_active:
            name = product.name if product else "Unknown"
            return [], 0.0, 0.0, f"Product '{name}' is no longer available."
        if product.stock < item.quantity:
            return [], 0.0, 0.0, (
                f"'{product.name}' has only {product.stock} items left. "
                "Please update your cart."
            )
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

    return items_snapshot, subtotal, subtotal + SHIPPING_FEE, None


def price_order(db: Session, user_id: int, buy_now=None):
    """
    Price what this customer is buying, from the database.

    Returns (items_snapshot, subtotal, shipping_fee, total, stock_error).
    """
    cart_items = resolve_line_items(db, user_id, buy_now)
    snapshot, subtotal, total, stock_error = price_items(cart_items)
    return snapshot, subtotal, SHIPPING_FEE, total, stock_error, cart_items


def to_paise(rupees: float) -> int:
    """
    Rupees to paise, rounded rather than truncated.

    int(49.99 * 100) is 4998 on a binary float, not 4999 — a silent one-paise
    undercharge that would reintroduce exactly the capture/refund mismatch this
    module exists to prevent.
    """
    return int(round(rupees * 100))
