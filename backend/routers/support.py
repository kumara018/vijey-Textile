"""Support interactions — admin logs CS call/chat → customer gets rating link."""
import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models, schemas, auth as auth_utils, notifications

router = APIRouter(prefix="/api/support", tags=["Support"])


# ── Admin: log a CS interaction & send rating link to customer ────────────────
@router.post("/interactions", response_model=schemas.SupportInteractionOut, status_code=201)
def create_interaction(
    payload: schemas.SupportInteractionCreate,
    db:      Session     = Depends(get_db),
    _:       models.User = Depends(auth_utils.get_current_admin),
):
    """
    Admin logs that CS engineer [cs_name] helped customer [customer_email].
    System auto-sends a unique rating link to the customer via email + WhatsApp.
    """
    token = str(uuid.uuid4())

    # Try to find matching registered user
    customer_user = db.query(models.User).filter(
        models.User.email == payload.customer_email
    ).first()

    # WHO ANSWERED. The shop, unless somebody says otherwise.
    #
    # This used to be a required field on the form, so logging a conversation
    # meant naming a support engineer. There isn't one — the owner answers the
    # phone — and the customer then got an email crediting "our support team".
    # The column is NOT NULL and older rows carry real names, so it is filled
    # rather than dropped.
    answered_by = (payload.cs_name or "").strip() or notifications.STORE_NAME

    interaction = models.SupportInteraction(
        cs_name          = answered_by,
        cs_email         = payload.cs_email,
        cs_phone         = payload.cs_phone,
        customer_name    = payload.customer_name,
        customer_email   = payload.customer_email,
        customer_phone   = payload.customer_phone,
        customer_user_id = customer_user.id if customer_user else None,
        issue_summary    = payload.issue_summary,
        rating_token     = token,
    )
    db.add(interaction)
    db.commit()
    db.refresh(interaction)

    # Send rating link to customer
    try:
        notifications.send_support_rating_request_email(
            payload.customer_email, payload.customer_name,
            answered_by, token, payload.issue_summary or ""
        )
    except Exception as e:
        print(f"[Support] Email error: {e}")

    if payload.customer_phone:
        try:
            notifications.send_support_rating_request_whatsapp(
                payload.customer_phone, payload.customer_name,
                answered_by, token
            )
        except Exception as e:
            print(f"[Support] WhatsApp error: {e}")

    return interaction


# ── Admin: list all interactions ──────────────────────────────────────────────
@router.get("/interactions", response_model=List[schemas.SupportInteractionOut])
def list_interactions(
    db: Session     = Depends(get_db),
    _:  models.User = Depends(auth_utils.get_current_admin),
):
    return db.query(models.SupportInteraction).order_by(
        models.SupportInteraction.created_at.desc()
    ).all()


# ── Public: get interaction info by token (for rating page) ──────────────────
@router.get("/rate/{token}")
def get_interaction_for_rating(token: str, db: Session = Depends(get_db)):
    interaction = db.query(models.SupportInteraction).filter(
        models.SupportInteraction.rating_token == token
    ).first()
    if not interaction:
        raise HTTPException(404, "Rating link not found or expired")
    if interaction.rating is not None:
        raise HTTPException(400, "You have already submitted a rating for this interaction")
    return {
        "cs_name":       interaction.cs_name,
        "customer_name": interaction.customer_name,
        "issue_summary": interaction.issue_summary,
        "created_at":    interaction.created_at,
    }


# ── Public: submit rating via token ───────────────────────────────────────────
@router.post("/rate/{token}", status_code=200)
def submit_rating(
    token:   str,
    payload: schemas.SupportRatingSubmit,
    db:      Session = Depends(get_db),
):
    interaction = db.query(models.SupportInteraction).filter(
        models.SupportInteraction.rating_token == token
    ).first()
    if not interaction:
        raise HTTPException(404, "Rating link not found or expired")
    if interaction.rating is not None:
        raise HTTPException(400, "You have already submitted a rating for this interaction")

    interaction.rating         = payload.rating
    interaction.rating_comment = payload.comment
    interaction.rated_at       = datetime.now(timezone.utc)
    db.commit()

    print(f"[Support] Rating {payload.rating}/5 received, answered by {interaction.cs_name}, from {interaction.customer_name}")

    return {"message": "Thank you for your feedback!"}
