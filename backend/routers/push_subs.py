from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models, push, auth as auth_utils
from database import get_db

router = APIRouter(prefix="/api/push", tags=["Notifications"])

"""
Subscribing a device to order updates.

WHY SUBSCRIPTIONS ARE TIED TO A CUSTOMER AND NOT JUST STORED. A push endpoint
is a capability: anybody holding it can send that browser a notification. Bound
to a user, the shop can send "your order is out for delivery" to the person who
placed it and to nobody else, and a customer signing out on a shared machine
takes their subscription with them. An anonymous pool of endpoints would be a
list of strangers' browsers with no way to know which is whose.
"""


class SubscriptionIn(BaseModel):
    """Exactly what `PushSubscription.toJSON()` produces in the browser."""
    endpoint: str
    p256dh: str
    auth: str


@router.get("/key")
def vapid_public_key():
    """
    The public half, for the browser to subscribe with.

    Unauthenticated on purpose: it is public by definition — every visitor's
    browser needs it before it can ask permission, and it grants nothing. The
    private half never leaves the server.

    `enabled: false` when the keys are unset, so the frontend hides the control
    rather than offering a button that cannot work.
    """
    return {"enabled": push.is_configured(), "key": push.public_key() or None}


@router.post("/subscribe")
def subscribe(
    payload: SubscriptionIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    """
    Remember this device. Idempotent on the endpoint.

    A browser hands back the SAME endpoint every time it subscribes, so calling
    this twice must update rather than duplicate — otherwise a customer who
    reinstalls the app, or simply reloads, accumulates rows and gets the same
    notification three times. The endpoint is the identity here, not the row id.

    Re-subscribing also moves the endpoint to whoever is signed in now. On a
    shared laptop that is the correct outcome: the notifications follow the
    person who last proved they own the account.
    """
    if not push.is_configured():
        raise HTTPException(503, "Notifications are not set up on this shop yet.")

    existing = db.query(models.PushSubscription).filter(
        models.PushSubscription.endpoint == payload.endpoint,
    ).first()

    if existing:
        existing.user_id = current_user.id
        existing.p256dh = payload.p256dh
        existing.auth = payload.auth
        existing.created_at = datetime.now(timezone.utc)
    else:
        db.add(models.PushSubscription(
            user_id=current_user.id,
            endpoint=payload.endpoint,
            p256dh=payload.p256dh,
            auth=payload.auth,
        ))

    db.commit()
    return {"subscribed": True}


@router.post("/unsubscribe")
def unsubscribe(
    payload: SubscriptionIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    """
    Forget this device.

    Scoped to the caller's own subscriptions. Without that filter, knowing any
    endpoint string would let one customer switch off another's notifications —
    a small harm, but an unnecessary one, and the filter costs nothing.
    """
    deleted = db.query(models.PushSubscription).filter(
        models.PushSubscription.endpoint == payload.endpoint,
        models.PushSubscription.user_id == current_user.id,
    ).delete()
    db.commit()
    return {"unsubscribed": bool(deleted)}


@router.post("/test")
def send_test(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    """
    Send one notification to the caller's own devices.

    This is how somebody confirms the thing works without placing an order.
    It can only ever notify the person asking, so it is not a way to message
    anybody else.
    """
    sent = push.send_to_user(
        db, current_user.id,
        title="Notifications are on",
        body="This is how your order updates will arrive.",
        url="/orders",
    )
    if sent == 0:
        raise HTTPException(404, "No device is subscribed on this account yet.")
    return {"sent": sent}
