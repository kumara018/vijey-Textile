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
  - A return/exchange's reverse pickup is polled the same way: once
    Delhivery's own scan shows the item left the customer's hands ("In
    Transit" on their reverse-pickup lifecycle), the request is advanced to
    "picked_up" automatically and its follow-on effects (auto-refund for a
    return, auto-ship the replacement for an exchange) fire immediately —
    matching Amazon/Flipkart/Myntra, and matching the same trust-the-scan
    policy already applied to forward deliveries above. A pickup-specific
    failed-attempt phrase list guards this the same way.
  - Any status string this doesn't recognise is logged and left alone —
    never guessed at.
"""
import os, random
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

# Same idea as FAILED_DELIVERY_ATTEMPT_PHRASES above, for the reverse-pickup
# leg — a failed pickup attempt must never be misread as "the courier has
# the item now" just because a later, broader check would otherwise match.
FAILED_PICKUP_ATTEMPT_PHRASES = (
    "pickup exception", "pickup failed", "pickup not attempted", "not picked",
    "pickup reattempt", "pickup rescheduled", "pickup cancelled", "pickup canceled",
    "consignee refused", "consignee unavailable", "consignee not available",
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


def _attempt_return_pickup(rr, order, user) -> bool:
    """
    Calls Delhivery to schedule a reverse pickup for a return/exchange,
    validates the response, and stores either the real AWB + pickup OTP
    (success) or the real Delhivery error message (failure) on `rr` so the
    admin can see exactly why it failed instead of a generic message.
    Shared by the automatic on-approve trigger (below), the manual retry
    endpoint (routers/admin.py), and — via the exact same function — has no
    dependency on FastAPI, so it's equally callable from a background sync
    sweep. Caller is responsible for db.commit().
    """
    try:
        result = dl.create_return_pickup(order, user)
        awb, err = dl.parse_create_response(result)
    except Exception as e:
        awb, err = "", str(e)

    if not awb:
        rr.pickup_error = err
        print(f"[Returns] ⚠️ Delhivery pickup could not be scheduled for {rr.request_type} #{rr.id}: {err}")
        return False

    rr.status = "pickup_scheduled"
    rr.return_awb = awb
    rr.return_tracking_url = f"https://www.delhivery.com/track/package/{awb}"
    rr.pickup_error = None
    rr.pickup_otp = str(random.randint(100000, 999999))
    print(f"[Returns] Delhivery pickup scheduled for {rr.request_type} #{rr.id}, AWB {awb}")
    try:
        notifications.send_pickup_otp_email(user.email, user.full_name, rr.pickup_otp, rr.request_type, order.order_number)
        notifications.send_pickup_otp_whatsapp(user.phone, user.full_name, rr.pickup_otp, rr.request_type, order.order_number)
        notifications.send_otp_sms(
            user.phone,
            f"Pickup OTP for order {order.order_number}: {rr.pickup_otp}. Share with pickup agent only.",
            "Pickup",
        )
    except Exception as e:
        print(f"[Returns] Pickup OTP notification error for return #{rr.id}: {e}")
    return True


def _attach_existing_pickup_awb(rr, awb, db) -> tuple[bool, str]:
    """
    Links a return/exchange to a Delhivery pickup AWB that already exists on
    Delhivery's side but this app never recorded — e.g. create_return_pickup()
    appeared to fail here (network hiccup, response never made it back) but
    Delhivery actually processed the request and dispatched an agent anyway,
    or someone scheduled the pickup by hand directly in Delhivery's own
    dashboard rather than through the app. Reconciling this is a real gap:
    without a stored AWB, sync_all_open_returns() has nothing to poll, so a
    pickup that genuinely happened on Delhivery's side can otherwise sit
    stuck at "no confirmed pickup" forever with no way for the app to find
    out about it.

    Validates the AWB is real and trackable with Delhivery before attaching
    it — a typo'd or unrelated AWB should never get linked silently. Does
    NOT downgrade a return that's already progressed past the pickup stage.
    Returns (success, message). Caller is responsible for db.commit().
    """
    awb = (awb or "").strip()
    if not awb:
        return False, "Enter a Delhivery AWB number."
    try:
        raw = dl.track_awb(awb)
    except Exception as e:
        return False, f"Could not reach Delhivery: {e}"
    if not raw:
        return False, "Delhivery has no record of this AWB — double-check the number and try again."

    rr.return_awb = awb
    rr.return_tracking_url = f"https://www.delhivery.com/track/package/{awb}"
    rr.pickup_error = None
    if rr.status not in ("picked_up", "processing", "refund_initiated", "replacement_shipped", "refunded", "completed"):
        rr.status = "pickup_scheduled"
        if not rr.pickup_otp:
            rr.pickup_otp = str(random.randint(100000, 999999))
    db.commit()
    db.refresh(rr)
    print(f"[Returns] Linked existing Delhivery AWB {awb} to {rr.request_type} #{rr.id}")
    return True, "AWB linked"


def _attempt_replacement_shipment(rr, order, user) -> bool:
    """Same idea as _attempt_return_pickup, for the exchange's second leg —
    the forward replacement shipment created once the old item is picked
    up. Caller is responsible for db.commit()."""
    try:
        result = dl.create_replacement_shipment(rr, order, user)
        awb, err = dl.parse_create_response(result)
    except Exception as e:
        awb, err = "", str(e)

    if not awb:
        rr.replacement_error = err
        print(f"[Returns] ⚠️ Replacement shipment could not be created for exchange #{rr.id}: {err}")
        return False

    rr.replacement_awb = awb
    rr.replacement_tracking_url = f"https://www.delhivery.com/track/package/{awb}"
    rr.replacement_error = None
    rr.status = "replacement_shipped"
    print(f"[Returns] Replacement shipment created for exchange #{rr.id}, AWB {awb}")
    return True


def _attempt_refund(rr, order) -> bool:
    """
    Auto-initiates the Razorpay refund for a RETURN once its pickup is
    confirmed — shared by the admin manually setting 'picked_up' and the
    automatic pickup-detected-by-Delhivery path below. Returns True if the
    refund was actually initiated (rr.status advances to
    'refund_initiated'); False if this order isn't eligible for an
    automatic refund (COD, Razorpay not configured, or the refund API call
    itself failed) — rr stays at 'picked_up' either way, for the admin to
    refund manually.
    """
    if not (
        order.payment_status == "paid"
        and order.payment_transaction_id
        and order.payment_transaction_id.startswith("pay_")
    ):
        return False
    key_id     = os.getenv("RAZORPAY_KEY_ID", "")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
    if not (key_id and key_secret):
        print(f"[Returns] ⚠️ REFUND SKIPPED — Razorpay not configured. Return #{rr.id} must be refunded manually.")
        return False
    try:
        import razorpay as _rp
        client = _rp.Client(auth=(key_id, key_secret))
        refund = client.payment.refund(
            order.payment_transaction_id,
            {
                "amount": int(order.total * 100),
                "speed":  "normal",
                "notes":  {"order_number": order.order_number, "reason": rr.reason},
            },
        )
        rr.refund_id = refund.get("id", "")
        rr.status = "refund_initiated"
        order.payment_status = "refund_initiated"
        print(f"[Returns] ✅ Refund {rr.refund_id} auto-initiated for return #{rr.id}")
        return True
    except Exception as e:
        print(f"[Returns] ❌ Auto-refund FAILED for return #{rr.id}: {e}")
        return False


def _process_picked_up(rr, order, user) -> list[str]:
    """
    Runs the actions that follow a return/exchange's pickup being
    confirmed (the old item is now in the courier's hands) — shared by the
    admin manually marking 'picked_up' and Delhivery's own reverse-pickup
    scan confirming it automatically (_check_return_pickup below). Returns
    whichever extra milestone was reached beyond 'picked_up' itself
    ('refund_initiated' for a return, 'replacement_shipped' for an
    exchange), or an empty list if nothing further happened yet (e.g. a
    COD return with no automatic refund path). Caller is responsible for
    db.commit().
    """
    milestones = []
    if rr.request_type == "return" and order:
        if _attempt_refund(rr, order):
            milestones.append("refund_initiated")
    if rr.request_type == "exchange" and rr.new_product_id and order and user:
        if _attempt_replacement_shipment(rr, order, user):
            milestones.append("replacement_shipped")
    return milestones


def _check_return_pickup(rr, order, user, db) -> tuple[str | None, str]:
    """
    Polls rr.return_awb's live Delhivery status and, if the courier has
    genuinely collected the item from the customer, advances the return to
    'picked_up' and runs its follow-on effects via _process_picked_up() —
    the same actions the admin dashboard triggers when picked_up is set by
    hand, just detected from the courier's own scan instead of waiting for
    someone to notice and click it (matching Amazon/Flipkart/Myntra).

    Delhivery's own reverse-pickup lifecycle is Ready for Pickup -> In
    Transit -> Out for Delivery -> Delivered. A pickup-specific
    failed-attempt phrase list, and a still-waiting phrase list (Manifested/
    Ready for Pickup/Pending), are checked first so a botched or not-yet-
    started pickup is never misread as complete. Anything else Delhivery
    reports beyond that is treated as evidence of pickup completion —
    deliberately optimistic rather than requiring an exact "In Transit"
    match, since real-world status text varies by account/integration and
    the app has no way to independently verify what Delhivery's own system
    hasn't recorded yet.

    Returns (action, delhivery_status_text). action is "picked_up",
    "pickup_failed_needs_review", "pickup_cancelled_needs_review", or None
    (still waiting, or nothing to check). Never raises — a Delhivery API
    hiccup here should never break the rest of a sync sweep; caller is
    responsible for db.commit() when action is not None.

    Whatever Delhivery reports is always saved to rr.pickup_last_status,
    even when nothing else changes — so the admin panel can show the live
    status directly instead of the admin having to click "Sync" and read a
    toast to find out why an auto-detection isn't advancing.
    """
    if not rr.return_awb or rr.status != "pickup_scheduled":
        return None, ""
    try:
        raw = dl.track_awb(rr.return_awb)
    except Exception as e:
        print(f"[Returns Sync] error polling pickup AWB for return #{rr.id}: {e}")
        return None, ""
    if not raw:
        return None, ""

    current = dl.parse_current_status(raw)
    raw_status = (current.get("status") or "").strip()
    status_l   = raw_status.lower()
    if not status_l:
        return None, ""

    if rr.pickup_last_status != raw_status:
        rr.pickup_last_status = raw_status
        db.commit()

    if any(p in status_l for p in FAILED_PICKUP_ATTEMPT_PHRASES):
        print(f"[Returns Sync] return #{rr.id}: pickup attempt failed "
              f"({raw_status!r}) — needs manual review")
        return "pickup_failed_needs_review", raw_status

    if "cancel" in status_l or "rto" in status_l:
        print(f"[Returns Sync] return #{rr.id}: courier reports pickup cancelled/RTO "
              f"({raw_status!r}) — needs manual review")
        return "pickup_cancelled_needs_review", raw_status

    # Nothing has happened yet — the reverse pickup is created but the
    # courier hasn't collected the item. Keep waiting.
    if "out for pickup" in status_l or "ready for pickup" in status_l or "manifest" in status_l or status_l == "pending":
        return None, raw_status

    # Any other status Delhivery reports — "In Transit", "Out for
    # Delivery"/"Delivered" (to the shop), or anything else not already
    # caught by the failed/cancelled/still-waiting checks above — means the
    # pickup has moved past "created but untouched", so the courier already
    # has the item. Deliberately optimistic rather than requiring an exact
    # phrase match: Delhivery's real wording varies by account/integration,
    # and guessing every variant wrong would silently strand pickups at
    # "Pickup Scheduled" forever with the app unable to tell why. The admin
    # can always correct a wrong auto-advance from the dropdown if Delhivery
    # ever reports something genuinely unrelated to the pickup itself.
    if status_l:
        rr.status = "picked_up"
        extra_milestones = _process_picked_up(rr, order, user)
        db.commit()
        db.refresh(rr)
        print(f"[Returns Sync] return #{rr.id}: pickup confirmed by Delhivery ({raw_status!r}) — marked picked_up")

        if user and order:
            for s in ["picked_up"] + extra_milestones:
                try:
                    notifications.send_return_status_email(user.email, user.full_name, order, rr, status=s)
                    notifications.send_return_status_whatsapp(user.phone, user.full_name, order, rr, status=s)
                except Exception as e:
                    print(f"[Returns Sync] notification error ({s}) for return #{rr.id}: {e}")
            if rr.status == "refund_initiated":
                try:
                    notifications.send_refund_initiated_email(user.email, user.full_name, order, rr.refund_id or "")
                    notifications.send_refund_initiated_sms(user.phone, order.order_number, order.total)
                    notifications.send_refund_initiated_whatsapp(user.phone, user.full_name, order, rr.refund_id or "")
                except Exception as e:
                    print(f"[Returns Sync] refund notification error for return #{rr.id}: {e}")

        return "picked_up", raw_status

    return None, raw_status


def _check_replacement_delivery(rr, order, user, db) -> tuple[str | None, str]:
    """
    Polls rr.replacement_awb's live Delhivery status and auto-completes the
    exchange the same way a regular order now auto-completes: trust
    Delhivery's own "Delivered" scan directly, with the same
    failed-attempt-phrase guard so a botched delivery attempt is never
    misread as success. Shared by the bulk sync sweep, the admin's
    on-demand "Sync now" endpoint, and the customer-facing return-detail
    view — the more places this gets a chance to run, the less this
    depends on any one poller.

    Returns (action, delhivery_status_text). action is "completed" or None
    (still in transit, nothing to check, or a failed delivery attempt).
    Never raises; caller is responsible for db.commit() when action is not
    None (already committed internally, but kept consistent with
    _check_return_pickup's contract).
    """
    if not rr.replacement_awb or rr.status != "replacement_shipped":
        return None, ""
    try:
        raw = dl.track_awb(rr.replacement_awb)
    except Exception as e:
        print(f"[Returns Sync] error polling replacement AWB for return #{rr.id}: {e}")
        return None, ""
    if not raw:
        return None, ""

    current = dl.parse_current_status(raw)
    raw_status = (current.get("status") or "").strip()
    status_l   = raw_status.lower()
    if not status_l:
        return None, ""

    if any(p in status_l for p in FAILED_DELIVERY_ATTEMPT_PHRASES):
        print(f"[Returns Sync] return #{rr.id}: replacement delivery attempt failed "
              f"({raw_status!r}) — needs manual review")
        return None, raw_status

    # Same substring caution as the order-delivery check: "out for
    # delivery"/"dispatched for delivery" both contain "deliver".
    if "deliver" in status_l and "out for" not in status_l and "dispatch" not in status_l:
        rr.status = "completed"
        db.commit()
        db.refresh(rr)
        print(f"[Returns Sync] return #{rr.id}: replacement delivered — marked completed")

        if user and order:
            try:
                notifications.send_return_status_email(user.email, user.full_name, order, rr, status="completed")
                notifications.send_return_status_whatsapp(user.phone, user.full_name, order, rr, status="completed")
            except Exception as e:
                print(f"[Returns Sync] notification error for return #{rr.id}: {e}")
        return "completed", raw_status

    return None, raw_status


def sync_all_open_returns(db) -> list[str]:
    """
    Polls every open leg of every in-flight return/exchange and advances
    each one automatically, matching Amazon/Flipkart/Myntra:

      - A pickup still out with the customer (return_awb, status
        'pickup_scheduled') advances to 'picked_up' — and its follow-on
        effects (auto-refund for a return, auto-ship the replacement for
        an exchange) fire immediately — the moment Delhivery's own scan
        shows the courier collected it. See _check_return_pickup() above.
      - An exchange's replacement shipment (replacement_awb, status
        'replacement_shipped') auto-completes the same way a regular order
        now auto-completes: trust Delhivery's own "Delivered" scan
        directly, with the same failed-attempt-phrase guard so a botched
        delivery attempt is never misread as success.

    Called from the same three places as sync_all_open_orders(): the
    scheduled timer, opportunistically on the admin returns dashboard load,
    and on-demand via a manual "Sync now" action.
    """
    if not dl.is_configured():
        return []
    changes = []

    open_pickups = (
        db.query(models.ReturnRequest)
        .filter(models.ReturnRequest.return_awb.isnot(None))
        .filter(models.ReturnRequest.status == "pickup_scheduled")
        .all()
    )
    for rr in open_pickups:
        try:
            order = db.query(models.Order).filter(models.Order.id == rr.order_id).first()
            user  = db.query(models.User).filter(models.User.id == rr.user_id).first()
            action, _ = _check_return_pickup(rr, order, user, db)
            if action == "picked_up":
                changes.append(f"return#{rr.id}: picked_up")
        except Exception as e:
            print(f"[Returns Sync] error syncing pickup AWB for return #{rr.id}: {e}")

    open_returns = (
        db.query(models.ReturnRequest)
        .filter(models.ReturnRequest.replacement_awb.isnot(None))
        .filter(models.ReturnRequest.status == "replacement_shipped")
        .all()
    )
    for rr in open_returns:
        try:
            order = db.query(models.Order).filter(models.Order.id == rr.order_id).first()
            user  = db.query(models.User).filter(models.User.id == rr.user_id).first()
            action, _ = _check_replacement_delivery(rr, order, user, db)
            if action == "completed":
                changes.append(f"return#{rr.id}: replacement delivered, completed")
        except Exception as e:
            print(f"[Returns Sync] error syncing replacement AWB for return #{rr.id}: {e}")
    return changes
