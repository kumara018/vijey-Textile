"""
Syncs order status from live Delhivery tracking data — the piece that makes
Shipped -> Out for Delivery -> Delivered advance on its own instead of
needing an admin to notice a courier scan and update the order by hand.

Deliberately conservative:
  - Only ever advances INTO "out_for_delivery", and does so by running the
    exact same delivery-OTP step the manual admin dropdown already runs —
    it never invents a new way for an order to become "delivered". This
    store confirms delivery via an OTP the agent collects from the
    customer, which anchors the return/exchange window and protects
    against a courier's own record being the only proof a package arrived.
    A Delhivery "Delivered" scan is therefore logged, not applied.
  - RTO and courier-side cancellation are logged for manual review rather
    than auto-applied, since resolving either correctly may mean a refund
    decision that shouldn't happen without a human looking at it.
  - Any status string this doesn't recognise is logged and left alone —
    never guessed at.
"""
import random
import models
import notifications


def sync_order_from_delhivery(order, current: dict, db) -> str | None:
    """
    order:   models.Order row (already loaded, attached to `db`)
    current: dict shaped like delhivery.parse_current_status()'s return —
             {"status": str, "location": str, "datetime": str, "expected_delivery": str}
    db:      SQLAlchemy session — this function commits if anything changes.

    Returns a short string describing what happened ("shipped",
    "out_for_delivery", "delivered_awaiting_otp", "rto_needs_review",
    "courier_cancelled_needs_review", "location_only") or None if nothing
    about the order needed to change.
    """
    raw_status = (current.get("status") or "").strip()
    status_l   = raw_status.lower()
    if not status_l:
        return None

    changed = False
    if current.get("location") and order.status_location != current["location"]:
        order.status_location = current["location"]
        changed = True
    if current.get("expected_delivery") and order.estimated_delivery != current["expected_delivery"]:
        order.estimated_delivery = current["expected_delivery"]
        changed = True

    # Terminal in our own system — keep location/ETA fresh but never reopen it.
    if order.status in ("delivered", "cancelled"):
        if changed:
            db.commit()
        return "location_only" if changed else None

    action = None

    # Order matters here: "out for delivery" / "dispatched for delivery" both
    # contain the substring "deliver", so the specific out-for-delivery check
    # must run before the broad "deliver" catch-all below, or every
    # out-for-delivery scan would get misread as a completed delivery.
    if "out for delivery" in status_l or "dispatched for delivery" in status_l or "ofd" in status_l:
        if order.status != "out_for_delivery":
            order.status = "out_for_delivery"
            if not order.delivery_otp:
                order.delivery_otp = str(random.randint(100000, 999999))
            changed = True
            action = "out_for_delivery"

    elif "rto" in status_l or "return" in status_l:
        print(f"[Delhivery Sync] {order.order_number}: RTO/return detected "
              f"({raw_status!r}) — needs manual review, status left as {order.status!r}")
        action = "rto_needs_review"

    elif "cancel" in status_l:
        print(f"[Delhivery Sync] {order.order_number}: courier reports cancelled "
              f"({raw_status!r}) — needs manual review, status left as {order.status!r}")
        action = "courier_cancelled_needs_review"

    elif "deliver" in status_l:
        print(f"[Delhivery Sync] {order.order_number}: courier reports delivered — "
              f"awaiting OTP confirmation before this becomes Delivered in-app")
        action = "delivered_awaiting_otp"

    elif "transit" in status_l or "dispatch" in status_l or "manifest" in status_l or "picked" in status_l:
        if order.status not in ("shipped", "out_for_delivery"):
            order.status = "shipped"
            changed = True
            action = "shipped"

    else:
        print(f"[Delhivery Sync] {order.order_number}: unrecognised status "
              f"{raw_status!r} — left unchanged")

    if not changed:
        return action

    db.commit()
    db.refresh(order)

    user = db.query(models.User).filter(models.User.id == order.user_id).first()
    if user and action in ("out_for_delivery", "shipped"):
        try:
            if action == "out_for_delivery":
                notifications.send_delivery_otp_email(
                    user.email, user.full_name, order.delivery_otp, order.order_number,
                    agent_name=order.delivery_person_name or "", agent_phone=order.delivery_person_phone or "",
                )
                notifications.send_delivery_otp_whatsapp(
                    user.phone, user.full_name, order.delivery_otp, order.order_number,
                    agent_name=order.delivery_person_name or "", agent_phone=order.delivery_person_phone or "",
                )
                notifications.send_otp_sms(
                    user.phone,
                    f"Delivery OTP for order {order.order_number}: {order.delivery_otp}. Share with delivery agent only.",
                    "Delivery",
                )
            else:
                notifications.send_order_status_email(user.email, user.full_name, order, action)
                notifications.send_order_status_whatsapp(user.phone, user.full_name, order, action)
        except Exception as e:
            print(f"[Delhivery Sync] notification error for {order.order_number}: {e}")

    return action
