from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from database import get_db
import models, auth as auth_utils

router = APIRouter(prefix="/api/addresses", tags=["Addresses"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class AddressIn(BaseModel):
    label:         Optional[str] = None
    full_name:     str
    phone:         str
    address_line1: str
    address_line2: Optional[str] = None
    city:          str
    state:         str
    pincode:       str
    is_default:    bool = False

class AddressOut(BaseModel):
    id:            int
    label:         Optional[str]
    full_name:     str
    phone:         str
    address_line1: str
    address_line2: Optional[str]
    city:          str
    state:         str
    pincode:       str
    is_default:    bool

    class Config:
        from_attributes = True


# ── Helpers ───────────────────────────────────────────────────────────────────

def _clear_default(db: Session, user_id: int):
    db.query(models.Address).filter(
        models.Address.user_id == user_id,
        models.Address.is_default == True,
    ).update({"is_default": False})


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[AddressOut])
def get_addresses(
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    """Get all saved addresses for the logged-in user."""
    return db.query(models.Address).filter(
        models.Address.user_id == current_user.id
    ).order_by(models.Address.is_default.desc(), models.Address.created_at.desc()).all()


@router.post("/", response_model=AddressOut, status_code=201)
def add_address(
    payload: AddressIn,
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    """Add a new address. Auto-sets as default if it's the user's first."""
    count = db.query(models.Address).filter(models.Address.user_id == current_user.id).count()
    is_default = payload.is_default or (count == 0)  # first address is always default

    if is_default:
        _clear_default(db, current_user.id)

    addr = models.Address(
        user_id       = current_user.id,
        label         = payload.label,
        full_name     = payload.full_name,
        phone         = payload.phone,
        address_line1 = payload.address_line1,
        address_line2 = payload.address_line2,
        city          = payload.city,
        state         = payload.state,
        pincode       = payload.pincode,
        is_default    = is_default,
    )
    db.add(addr)
    db.commit()
    db.refresh(addr)
    return addr


@router.put("/{address_id}", response_model=AddressOut)
def update_address(
    address_id: int,
    payload: AddressIn,
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    addr = db.query(models.Address).filter(
        models.Address.id == address_id,
        models.Address.user_id == current_user.id,
    ).first()
    if not addr:
        raise HTTPException(404, "Address not found")

    if payload.is_default:
        _clear_default(db, current_user.id)

    for field, value in payload.model_dump().items():
        setattr(addr, field, value)
    db.commit()
    db.refresh(addr)
    return addr


@router.delete("/{address_id}")
def delete_address(
    address_id: int,
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    addr = db.query(models.Address).filter(
        models.Address.id == address_id,
        models.Address.user_id == current_user.id,
    ).first()
    if not addr:
        raise HTTPException(404, "Address not found")
    db.delete(addr)
    db.commit()

    # If deleted address was default, make the most recent one default
    if addr.is_default:
        next_addr = db.query(models.Address).filter(
            models.Address.user_id == current_user.id
        ).order_by(models.Address.created_at.desc()).first()
        if next_addr:
            next_addr.is_default = True
            db.commit()

    return {"message": "Address deleted"}


@router.put("/{address_id}/set-default", response_model=AddressOut)
def set_default(
    address_id: int,
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    addr = db.query(models.Address).filter(
        models.Address.id == address_id,
        models.Address.user_id == current_user.id,
    ).first()
    if not addr:
        raise HTTPException(404, "Address not found")
    _clear_default(db, current_user.id)
    addr.is_default = True
    db.commit()
    db.refresh(addr)
    return addr
