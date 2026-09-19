"""
The category list, read and kept honest. Identical in both shops.

WHY THIS EXISTS.

Before this there were four separate category lists per shop and they did not
agree with each other:

  * `schemas.VALID_CATEGORIES`         — what a new product was allowed to use
  * `routers/products.py` fallback     — on Vijey Textile, AMMALU TEX's list
  * the `categories` table             — on Vijey Textile's live database,
                                         also Ammalu Tex's list: Tops, Half
                                         Saree, Crop Tops... none of which
                                         Vijey sells
  * a hard-coded array in every menu, footer, filter and admin form

Nothing read the table, which is how it could be wrong for so long without
anyone noticing. Adding a category meant editing code in about ten places per
shop and redeploying — and missing one meant a garment filed under a category
the menu did not offer.

Now the table is the list. Menus, filters and the admin form read it through
the API; product create and update are validated against it; and the admin
edits it from the workroom.
"""
from sqlalchemy import func
from sqlalchemy.orm import Session
from fastapi import HTTPException

import models


def _clean(name: str | None) -> str:
    """Collapse whitespace. "  Party   Wear " and "Party Wear" are one category."""
    return " ".join((name or "").split())


def find(db: Session, name: str) -> models.Category | None:
    """Case-insensitive lookup — "sharara" must not become a second Sharara."""
    cleaned = _clean(name)
    if not cleaned:
        return None
    return (
        db.query(models.Category)
        .filter(func.lower(models.Category.name) == cleaned.lower())
        .first()
    )


def require(db: Session, name: str | None) -> str:
    """
    The canonical spelling of an existing category, or a 400 saying which
    categories do exist.

    Used by product create and update. It returns the STORED spelling, so a
    product saved as "party wear" lands under "Party Wear" rather than
    starting a lookalike category that no menu links to.

    Hidden categories are allowed on purpose: hiding a category takes it out
    of the menus, and an admin still has to be able to edit the pieces in it.
    """
    cat = find(db, name or "")
    if cat:
        return cat.name
    names = [c.name for c in db.query(models.Category).order_by(models.Category.sort_order).all()]
    raise HTTPException(
        status_code=400,
        detail=(
            f"'{_clean(name)}' is not a category. Choose one of: {', '.join(names)} — "
            "or add it under Categories first."
        ),
    )


def counts(db: Session) -> dict[str, dict[str, int]]:
    """{category name: {"total": n, "active": n}} from the products table."""
    from sqlalchemy import case
    rows = (
        db.query(
            models.Product.category,
            func.count(models.Product.id),
            func.sum(case((models.Product.is_active == True, 1), else_=0)),  # noqa: E712
        )
        .group_by(models.Product.category)
        .all()
    )
    return {name: {"total": int(total or 0), "active": int(active or 0)} for name, total, active in rows}


def to_dict(c: models.Category, tally: dict | None = None) -> dict:
    t = (tally or {}).get(c.name, {"total": 0, "active": 0})
    return {
        "id": c.id,
        "name": c.name,
        "emoji": c.emoji,
        "eyebrow": c.eyebrow,
        "headline": c.headline,
        "description": c.description,
        "is_active": bool(c.is_active),
        "sort_order": c.sort_order or 0,
        "product_count": t["total"],
        "live_product_count": t["active"],
    }


def seed_defaults(db: Session, defaults: list[dict]) -> int:
    """Fill an EMPTY table with this shop's starting list. Never touches a populated one."""
    if db.query(models.Category).count():
        return 0
    for i, c in enumerate(defaults, start=1):
        db.add(models.Category(sort_order=c.get("sort_order", i), is_active=True, **{
            k: v for k, v in c.items() if k != "sort_order"
        }))
    db.commit()
    return len(defaults)


def reconcile_with_products(db: Session) -> list[str]:
    """
    Add any category a product uses that the table does not list.

    Self-healing, and only ever additive: a product filed under a name the menu
    does not know about is invisible to anyone browsing by category, which is
    exactly the fault four disagreeing lists produced. Nothing is ever removed
    here — an empty category may be one the admin has just created and not yet
    stocked, such as Sharara on the day it is added.
    """
    known = {c.name.lower() for c in db.query(models.Category).all()}
    used = [n for (n,) in db.query(models.Product.category).distinct().all() if n]
    top = db.query(func.max(models.Category.sort_order)).scalar() or 0
    added = []
    for name in sorted(set(used)):
        if name.lower() in known:
            continue
        top += 1
        db.add(models.Category(name=name, is_active=True, sort_order=top))
        known.add(name.lower())
        added.append(name)
    if added:
        db.commit()
    return added
