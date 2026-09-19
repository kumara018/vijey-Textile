"""
Categories, managed from the workroom. Identical in both shops.

Every write returns the whole list, in order, with product counts. The admin
screen replaces its state with that rather than patching one row, so it can
never drift from what the database actually holds — which is the failure this
whole feature was built to end.
"""
import re
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

import models
import auth as auth_utils
import category_store
from database import get_db

router = APIRouter(prefix="/api/admin/categories", tags=["Admin — Categories"])

# Letters (any script, so a Tamil name works), digits, spaces and & ' - . /
# The name travels in URLs as ?category=…, so nothing that needs escaping
# beyond a space is allowed in.
_NAME_OK = re.compile(r"^[\w&'./ -]+$", re.UNICODE)


def _name(v: str) -> str:
    v = " ".join((v or "").split())
    if len(v) < 2:
        raise ValueError("A category name needs at least 2 characters.")
    if len(v) > 60:
        raise ValueError("Keep the name under 60 characters — it has to fit in a menu.")
    if not _NAME_OK.match(v):
        raise ValueError("Use letters, numbers, spaces and & ' - . / only.")
    return v


_LIMITS = {"emoji": 10, "eyebrow": 60, "headline": 160, "description": 500}


def _short(v: Optional[str], info) -> Optional[str]:
    """Trim, collapse spaces, enforce the column's length; blank becomes None."""
    if v is None:
        return None
    v = " ".join(v.split())
    limit = _LIMITS[info.field_name]
    if len(v) > limit:
        raise ValueError(f"Keep this under {limit} characters.")
    return v or None


class CategoryIn(BaseModel):
    name: str
    emoji: Optional[str] = None
    eyebrow: Optional[str] = None
    headline: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def name_valid(cls, v):
        return _name(v)

    @field_validator("emoji", "eyebrow", "headline", "description")
    @classmethod
    def text_valid(cls, v, info):
        return _short(v, info)


class CategoryPatch(BaseModel):
    name: Optional[str] = None
    emoji: Optional[str] = None
    eyebrow: Optional[str] = None
    headline: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def name_valid(cls, v):
        return None if v is None else _name(v)

    @field_validator("emoji", "eyebrow", "headline", "description")
    @classmethod
    def text_valid(cls, v, info):
        return _short(v, info)


class CategoryOrder(BaseModel):
    ids: List[int]


def _listing(db: Session) -> list[dict]:
    tally = category_store.counts(db)
    cats = (
        db.query(models.Category)
        .order_by(models.Category.sort_order, models.Category.id)
        .all()
    )
    return [category_store.to_dict(c, tally) for c in cats]


@router.get("")
def list_categories(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_admin),
):
    """Every category, hidden ones included, with how many pieces each holds."""
    return _listing(db)


@router.post("", status_code=201)
def create_category(
    payload: CategoryIn,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_admin),
):
    if category_store.find(db, payload.name):
        raise HTTPException(409, f"'{payload.name}' already exists.")

    top = db.query(models.Category.sort_order).order_by(models.Category.sort_order.desc()).first()
    db.add(models.Category(
        name=payload.name,
        emoji=payload.emoji,
        eyebrow=payload.eyebrow,
        headline=payload.headline,
        description=payload.description,
        is_active=payload.is_active,
        sort_order=(top[0] if top and top[0] is not None else 0) + 1,
    ))
    db.commit()
    return _listing(db)


# Declared BEFORE /{category_id}: otherwise "reorder" is read as an id, fails
# the int conversion, and the request 422s instead of reaching this handler.
@router.put("/reorder")
def reorder_categories(
    payload: CategoryOrder,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_admin),
):
    """
    The order the menus show. Must name every category exactly once.

    A partial list is refused rather than merged: two admins reordering at the
    same moment would otherwise interleave their lists into an order neither of
    them chose.
    """
    cats = {c.id: c for c in db.query(models.Category).all()}
    if sorted(payload.ids) != sorted(cats) or len(set(payload.ids)) != len(payload.ids):
        raise HTTPException(
            409, "The category list changed while you were reordering. Refresh and try again."
        )
    for position, cid in enumerate(payload.ids, start=1):
        cats[cid].sort_order = position
    db.commit()
    return _listing(db)


@router.put("/{category_id}")
def update_category(
    category_id: int,
    payload: CategoryPatch,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_admin),
):
    cat = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not cat:
        raise HTTPException(404, "That category no longer exists.")

    changes = payload.model_dump(exclude_unset=True)

    if "name" in changes and changes["name"] and changes["name"] != cat.name:
        clash = category_store.find(db, changes["name"])
        if clash and clash.id != cat.id:
            raise HTTPException(409, f"'{changes['name']}' already exists.")
        # A RENAME MOVES THE PIECES WITH IT. Products store the category by
        # name, so renaming only the row would orphan every garment filed under
        # it — gone from its own menu, still on sale, found only by search.
        # Same transaction: both happen or neither does.
        old = cat.name
        (
            db.query(models.Product)
            .filter(models.Product.category == old)
            .update({models.Product.category: changes["name"]}, synchronize_session=False)
        )
        # Past orders keep the name they were bought under. An invoice is a
        # record of what happened, and rewriting it would make it wrong.
        cat.name = changes["name"]

    for field in ("emoji", "eyebrow", "headline", "description", "is_active"):
        if field in changes:
            setattr(cat, field, changes[field])

    db.commit()
    return _listing(db)


@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_admin),
):
    """
    Only an empty category can be deleted.

    Deleting one that still holds pieces would strand them under a name no menu
    offers, and reconcile_with_products would quietly put it back on the next
    restart — so the refusal says what to do instead.
    """
    cat = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not cat:
        raise HTTPException(404, "That category no longer exists.")

    in_use = db.query(models.Product).filter(models.Product.category == cat.name).count()
    if in_use:
        raise HTTPException(
            409,
            f"{in_use} piece{'s' if in_use != 1 else ''} still "
            f"{'use' if in_use != 1 else 'uses'} '{cat.name}'. Move "
            f"{'them' if in_use != 1 else 'it'} to another category first, "
            "or hide the category instead.",
        )
    if db.query(models.Category).count() <= 1:
        raise HTTPException(409, "The shop needs at least one category.")

    db.delete(cat)
    db.commit()
    return _listing(db)
