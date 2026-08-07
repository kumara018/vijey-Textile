"""
Inbound webhooks from courier partners — currently just Delhivery's Push API,
which posts a scan update every time a package's status changes, so this
backend doesn't have to guess or wait for someone to open a tracking page.

Delhivery's Push API isn't self-service: activating it means emailing their
integration team this endpoint's URL plus a couple of sample AWBs (see
SETUP.md). Until then this endpoint just sits here unused — the 15-minute
poller (main.py::_sync_delhivery_statuses) and the opportunistic sync on the
customer's tracking-page view (routers/orders.py) are what keep orders in
sync in the meantime.

Delhivery's own docs don't document a signature/shared-secret mechanism for
this webhook (unlike Razorpay's, which this app does verify via HMAC) — if
their onboarding flow turns out to offer one when actually registering this
URL, add verification here the same way routers/payments.py does for Razorpay.
"""
from fastapi import APIRouter, Request
from sqlalchemy.orm import Session
from fastapi import Depends
from database import get_db
import models

router = APIRouter(prefix="/api/webhooks", tags=["Webhooks"])


@router.post("/delhivery")
async def delhivery_webhook(request: Request, db: Session = Depends(get_db)):
    import delhivery as dl
    import courier_sync

    try:
        payload = await request.json()
    except Exception:
        return {"status": "ignored", "reason": "invalid JSON"}

    current = dl.parse_current_status(payload)
    awb = current.get("awb") or (payload.get("Shipment") or {}).get("AWB", "")
    if not awb:
        print(f"[Delhivery Webhook] no AWB in payload: {payload}")
        return {"status": "ignored", "reason": "no AWB in payload"}

    order = db.query(models.Order).filter(models.Order.awb_code == awb).first()
    if not order:
        print(f"[Delhivery Webhook] no order found for AWB {awb}")
        return {"status": "ignored", "reason": "unknown AWB"}

    try:
        action = courier_sync.sync_order_from_delhivery(order, current, db)
        print(f"[Delhivery Webhook] {order.order_number} (AWB {awb}): {action}")
    except Exception as e:
        print(f"[Delhivery Webhook] sync error for AWB {awb}: {e}")

    # Always ack — Delhivery has no need to retry a scan we've already logged,
    # even if something about processing it locally went wrong.
    return {"status": "ok"}
