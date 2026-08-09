"""
Syncs order status from live Delhivery tracking data — the piece that makes
Shipped -> Out for Delivery -> Delivered advance on its own instead of
needing an admin to notice a courier scan and update the order by hand.

  - Delhivery's own "Delivered" scan is trusted directly and applied
    immediately, matching Amazon/Flipkart/Myntra. A delivery-OTP is still
    generated and sent to the customer the moment an order reaches
    "out_for_delivery" — the delivery agent should still use it to verify
    they're handing the parcel to the right person — but the OTP is no
    longer a gate the *app's own status* waits on; Delhivery's scan alone
    is enough to close the order out. A specific set of failed-attempt
    phrases (undelivered, delivery attempt failed, consignee refused/
    unavailable, delivery exception) is checked FIRST and routed to manual
    review instead, so a botched delivery attempt can never be misread as
    a successful one just because its status text also contains "deliver".
  - RTO and courier-side cancellation are logged for manual review rather
    than auto-applied, since resolving either correctly may mean a refund
    decision that shouldn't happen without a human looking at it.
  - Any status string this doesn't recognise is logged and left alone —
    never guessed at.
"""
import random
from datetime import datetime, timezone
import models
import notifications
import delhivery as dl

# Canonical order-status lifecycle. Both the admin dropdown (routers/admin.py)
# and this module's own automatic sync enforce the same rule off this table:
# status only ever moves forward, matching Amazon/Flipkart/Myntra — once
# "Shipped", an order can't silently slide back to "Processing".
STATUS_RANK = {
    "pending":          0,
    "confirmed":        1,
    "processing":       2,
    "shipped":          3,
    "out_for_delivery": 4,
    "delivered":        5,
}

# A failed delivery attempt's status text ("Undelivered", "Delivery
# Attempted", "Consignee Refused"...) also contains the substring "deliver",
# so callers must check this BEFORE any generic "deliver" match or a
# botched attempt gets misread as a successful delivery. Shared between the
# regular-order sync below and the exchange-replacement sync, since both
# leg types can hit the exact same failure phrases from Delhivery.
FAILED_DELIVERY_ATTEMPT_PHRASES = (
    "undelivered", "not delivered", "delivery attempt", "delivery failed",
    "delivery exception", "consignee refused", "consignee unavailable",
    "consignee not available",
)


def is_valid_transition(from_status: str, to_status: str) -> bool:
    """
    "Cancelled" is the one exception to forward-only: reachable from any
    state except an order that's already Delivered or already Cancelled —
    cancelling something already in the customer's hands doesn't make
    sense (that's what the returns/exchange flow is for), and a cancelled
    order can't un-cancel back through this same dropdown.
    """
    if to_status == "cancelled":
        return from_status not in ("delivered", "cancelled")
    if from_status == "cancelled":
        return False
    if from_status not in STATUS_RANK or to_status not in STATUS_RANK:
        return True  # unrecognised status string — let the caller's own validation reject it
    return STATUS_RANK[to_status] >= STATUS_RANK[from_status]


def sync_order_from_delhivery(order, current: dict, db) -> str | None:
    """
    order:   models.Order row (already loaded, attached to `db`)
    current: dict shaped like delhivery.parse_current_status()'s return —
             {"status": str, "location": str, "datetime": str, "expected_delivery": str}
    db:      SQLAlchemy session — this function commits if anything changes.

    Returns a short string describing what happened ("shipped",
    "out_for_delivery", "delivered", "delivery_attempt_failed_needs_review",
    "rto_needs_review", "courier_cancelled_needs_review", "rto_received",
    "location_only") or None if nothing about the order needed to change.
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

    # Delivered is terminal — keep location/ETA fresh but never reopen it.
    if order.status == "delivered":
        if changed:
            db.commit()
        return "location_only" if changed else None

    # Cancelled is terminal for the order's own status, but a cancellation
    # made after the item had already shipped (rto_pending — see
    # routers/admin.py / routers/orders.py) deliberately did NOT restore
    # stock at cancel time, since the item was still physically out with
    # the courier. This is the one remaining signal that closes that loop:
    # once Delhivery confirms the RTO genuinely landed back at origin,
    # restore the stock and clear the flag. Any other RTO-related status
    # (still in transit back) just keeps location fresh, same as before.
    if order.status == "cancelled":
        if order.rto_pending and "rto" in status_l and ("delivered" in status_l or "complete" in status_l):
            for item in order.items_snapshot:
                product = db.query(models.Product).filter(models.Product.id == item["product_id"]).first()
                if product:
                    product.stock += item["quantity"]
            order.rto_pending = False
            db.commit()
            db.refresh(order)
            print(f"[Delhivery Sync] {order.order_number}: RTO confirmed back at origin — stock restored")
            return "rto_received"
        if changed:
            db.commit()
        return "location_only" if changed else None

    action = None

    # Order matters here: "out for delivery" / "dispatched for delivery" both
    # contain the substring "deliver", so the specific out-for-delivery check
    # must run before the broad "deliver" catch-all below, or every
    # out-for-delivery scan would get misread as a completed delivery.
    if "out for delivery" in status_l or "dispatched for delivery" in status_l or "ofd" in status_l:
        if order.status != "out_for_delivery" and is_valid_transition(order.status, "out_for_delivery"):
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

    # A failed delivery attempt's status text ("Undelivered", "Delivery
    # Attempted", "Consignee Refused"...) also contains the substring
    # "deliver", so this must run BEFORE the generic "deliver" catch below
    # or a botched attempt would get misread as a successful delivery.
    elif any(p in status_l for p in FAILED_DELIVERY_ATTEMPT_PHRASES):
        print(f"[Delhivery Sync] {order.order_number}: delivery attempt failed "
              f"({raw_status!r}) — needs manual review, status left as {order.status!r}")
        action = "delivery_attempt_failed_needs_review"

    elif "deliver" in status_l:
        if order.status != "delivered" and is_valid_transition(order.status, "delivered"):
            order.status = "delivered"
            if not order.delivered_at:
                order.delivered_at = datetime.now(timezone.utc)
            changed = True
            action = "delivered"

    elif "transit" in status_l or "dispatch" in status_l or "manifest" in status_l or "picked" in status_l:
        if order.status not in ("shipped", "out_for_delivery") and is_valid_transition(order.status, "shipped"):
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
    if user and action in ("out_for_delivery", "shipped", "delivered"):
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
            elif action == "delivered":
                # Same notification pair the manual admin dropdown sends for
                # every status change, plus the same post-delivery review
                # request — keeps the automatic and manual paths consistent.
                notifications.send_order_status_email(user.email, user.full_name, order, action)
                notifications.send_order_status_whatsapp(user.phone, user.full_name, order, action)
                notifications.send_review_request_email(user.email, user.full_name, order)
                notifications.send_review_request_whatsapp(user.phone, user.full_name, order.order_number)
            else:
                notifications.send_order_status_email(user.email, user.full_name, order, action)
                notifications.send_order_status_whatsapp(user.phone, user.full_name, order, action)
        except Exception as e:
            print(f"[Delhivery Sync] notification error for {order.order_number}: {e}")

    return action


def sync_all_open_orders(db) -> list[str]:
    """
    Polls live Delhivery tracking for every order with an open Delhivery
    shipment and advances each one via sync_order_from_delhivery().

    Shared by three call sites, because a single 15-minute in-process timer
    (main.py's scheduler) is not on its own a reliable way to keep this
    current — a host that spins down when idle simply stops running that
    timer along with everything else until the next request wakes it back
    up. Also called opportunistically whenever the admin orders dashboard
    loads (routers/admin.py::get_all_orders) and on-demand from a manual
    "Sync now" action, so real activity — not just the clock — keeps orders
    caught up.

    Best-effort throughout: one order's Delhivery API error never stops the
    rest from syncing. Returns a list of "{order_number}: {action}" strings
    for orders that actually changed, for logging/reporting by the caller.
    """
    if not dl.is_configured():
        return []
    changes = []
    # A cancelled order stays in scope while rto_pending — that's the one
    # case where "cancelled" isn't fully done with Delhivery yet, since
    # sync_order_from_delhivery() still needs to see the RTO confirmed back
    # at origin before it can release the held stock.
    open_orders = db.query(models.Order).filter(
        models.Order.awb_code.isnot(None),
    ).filter(
        (models.Order.status.notin_(["delivered", "cancelled"]))
        | ((models.Order.status == "cancelled") & (models.Order.rto_pending.is_(True)))
    ).all()
    for order in open_orders:
        courier = (order.courier_name or "").lower()
        if courier and "delhivery" not in courier:
            continue  # manually-entered non-Delhivery courier (BlueDart/DTDC) — nothing to poll
        try:
            raw = dl.track_awb(order.awb_code)
            if not raw:
                continue
            current = dl.parse_current_status(raw)
            action = sync_order_from_delhivery(order, current, db)
            if action and action != "location_only":
                changes.append(f"{order.order_number}: {action}")
        except Exception as e:
            print(f"[Delhivery Sync] error syncing order {order.id}: {e}")
    return changes


def sync_all_open_returns(db) -> list[str]:
    """
    Mirrors sync_all_open_orders() for an exchange's replacement leg — once
    create_replacement_shipment() (routers/admin.py) has shipped the new
    item, this polls that shipment's own AWB and auto-completes the
    exchange the same way a regular order now auto-completes: trust
    Delhivery's own "Delivered" scan directly, with the same failed-
    attempt-phrase guard so a botched delivery attempt is never misread as
    success. The pickup leg (return_awb) is intentionally NOT auto-advanced
    here — confirming a pickup is what triggers refunds/replacement
    shipments, so that stays an admin-confirmed step (see courier_sync.py
    module docstring / the plan this was built from).

    Called from the same three places as sync_all_open_orders(): the
    scheduled timer, opportunistically on the admin returns dashboard load,
    and on-demand via a manual "Sync now" action.
    """
    if not dl.is_configured():
        return []
    changes = []
    open_returns = (
        db.query(models.ReturnRequest)
        .filter(models.ReturnRequest.replacement_awb.isnot(None))
        .filter(models.ReturnRequest.status == "replacement_shipped")
        .all()
    )
    for rr in open_returns:
        try:
            raw = dl.track_awb(rr.replacement_awb)
            if not raw:
                continue
            current = dl.parse_current_status(raw)
            status_l = (current.get("status") or "").strip().lower()
            if not status_l:
                continue

            if any(p in status_l for p in FAILED_DELIVERY_ATTEMPT_PHRASES):
                print(f"[Returns Sync] return #{rr.id}: replacement delivery attempt failed "
                      f"({current.get('status')!r}) — needs manual review")
                continue

            # Same substring caution as the order-delivery check: "out for
            # delivery"/"dispatched for delivery" both contain "deliver".
            if "deliver" in status_l and "out for" not in status_l and "dispatch" not in status_l:
                rr.status = "completed"
                db.commit()
                db.refresh(rr)
                changes.append(f"return#{rr.id}: replacement delivered, completed")
                print(f"[Returns Sync] return #{rr.id}: replacement delivered — marked completed")

                user  = db.query(models.User).filter(models.User.id == rr.user_id).first()
                order = db.query(models.Order).filter(models.Order.id == rr.order_id).first()
                if user and order:
                    try:
                        notifications.send_return_status_email(user.email, user.full_name, order, rr, status="completed")
                        notifications.send_return_status_whatsapp(user.phone, user.full_name, order, rr, status="completed")
                    except Exception as e:
                        print(f"[Returns Sync] notification error for return #{rr.id}: {e}")
        except Exception as e:
            print(f"[Returns Sync] error syncing replacement AWB for return #{rr.id}: {e}")
    return changes
