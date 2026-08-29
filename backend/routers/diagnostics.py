import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

import models, auth as auth_utils
from database import get_db

router = APIRouter(prefix="/api/diagnostics", tags=["Diagnostics"])

"""
What is actually switched on, in production, right now.

WHY THIS EXISTS. Every integration in this application fails SOFTLY and on
purpose: an unconfigured SMS gateway prints `[SMS not configured]` to a log
nobody reads and returns as though it sent; an unconfigured courier returns
`checked: false` and the shop says "we will confirm when you order"; an
unconfigured mailer falls through Brevo, then SendGrid, then SMTP and gives up.
Every one of those is the right behaviour — a customer must never see a 500
because a third party is down — but together they mean the shop can be quietly
half-dead and look completely normal from the outside.

That is exactly what happened. The courier token was never set on either shop,
so for the whole life of the delivery-location feature the pincode check has
never once actually checked, and nothing anywhere said so.

This endpoint asks each integration the only question that can be answered
without spending money or messaging a real customer: ARE YOUR CREDENTIALS
PRESENT AND DOES YOUR CLIENT CONSTRUCT? That is a genuine test — it is the
check every one of those soft failures is gated on — and it is honest about
what it is not: it cannot prove Brevo will accept the next message or that
Razorpay's keys are still valid. `verified` records which kind of answer each
row is, so the page can say "configured" without implying "proven".

WHAT IT MUST NEVER DO. Return a secret, or any part of one. Not a masked tail,
not a length, not a hash. A diagnostics page is a page an admin session can
reach, and an admin session is one stolen laptop away from an attacker; there
is no version of "helpfully showing a bit of the key" that is worth that. Every
value below is a boolean or a fixed string.
"""


def _present(*names: str) -> bool:
    """True when every named variable is set to something non-blank."""
    return all(os.getenv(n, "").strip() for n in names)


def _check_razorpay() -> dict:
    """
    Configured, and — the question that actually matters before a launch —
    TEST keys or LIVE keys.

    Razorpay key ids carry their own mode: `rzp_test_…` against a sandbox that
    moves no money, `rzp_live_…` against real cards. Reading the prefix is not
    a secret leak; the key id is handed to every customer's browser to open the
    payment window. The secret is never touched here.
    """
    key_id = os.getenv("RAZORPAY_KEY_ID", "").strip()
    secret = os.getenv("RAZORPAY_KEY_SECRET", "").strip()
    if not key_id or not secret:
        return {"configured": False, "mode": None, "webhook": False, "verified": "credentials"}
    mode = "test" if key_id.startswith("rzp_test_") else "live" if key_id.startswith("rzp_live_") else "unknown"
    return {
        "configured": True,
        "mode": mode,
        # Without this, a refund or a payment captured outside the browser
        # session never reaches the shop.
        "webhook": _present("RAZORPAY_WEBHOOK_SECRET"),
        "verified": "credentials",
    }


def _check_email() -> dict:
    """
    Three providers in a fallback chain, so the useful answer is WHICH ONE will
    actually carry the next message — not merely that one of them might.
    """
    brevo = _present("BREVO_API_KEY")
    sendgrid = _present("SENDGRID_API_KEY")
    smtp = _present("SMTP_EMAIL", "SMTP_PASSWORD")
    active = "brevo" if brevo else "sendgrid" if sendgrid else "smtp" if smtp else None

    # WHAT THE LAST ATTEMPT ACTUALLY DID, which is the part that was missing.
    # Credentials being present is not the same as mail arriving: the SMTP host
    # was hardcoded to Gmail while the shop's mailbox is elsewhere, so every
    # send failed authentication and the only trace was a log line. A green row
    # that means "a key exists" is exactly the reassurance that hid it.
    import notifications as _n
    last = getattr(_n, "LAST_EMAIL", {"attempted": False, "ok": None, "detail": None, "host": None})

    return {
        "configured": bool(active),
        "active": active,
        "brevo": brevo, "sendgrid": sendgrid, "smtp": smtp,
        "smtp_host": (os.getenv("SMTP_HOST", "").strip() or None) if smtp else None,
        # Render blocks outbound SMTP entirely, so an SMTP-only configuration
        # there is broken no matter how correct the credentials are. Worth
        # stating on the page rather than leaving somebody to re-check a
        # password that was never wrong.
        "smtp_blocked_by_host": bool(os.getenv("RENDER", "").strip()) and active == "smtp",
        "last_send": {"attempted": bool(last.get("attempted")),
                      "ok": last.get("ok"),
                      "detail": last.get("detail"),
                      "host": last.get("host")},
        # Replies to an order confirmation go here. Missing is not fatal but it
        # means a customer's reply lands nowhere.
        "reply_to": _present("SUPPORT_EMAIL"),
        "verified": "credentials",
    }


def _check_courier() -> dict:
    """
    Delhivery drives serviceability, labels, tracking and reverse pickups. When
    the token is absent every one of those degrades silently.
    """
    configured = _present("DELHIVERY_API_TOKEN")

    # WHAT THE COURIER ACTUALLY SAID LAST TIME. A token being present is not the
    # same as a token being accepted: this shop has one set and Delhivery
    # answers 401 Unauthorized, which the presence check reported as a healthy
    # green row. Found in a deploy log, not by reasoning — hence this.
    import delhivery as _dl
    last = getattr(_dl, "LAST_COURIER", {"attempted": False, "ok": None, "detail": None})

    return {
        "configured": configured,
        "mode": os.getenv("DELHIVERY_MODE", "production").strip().lower() if configured else None,
        "pickup_named": _present("DELHIVERY_PICKUP_NAME"),
        "return_address": _present("DELHIVERY_RETURN_PIN", "DELHIVERY_RETURN_PHONE"),
        "last_call": {"attempted": bool(last.get("attempted")),
                      "ok": last.get("ok"),
                      "detail": last.get("detail")},
        "verified": "credentials",
    }


def _check_messaging() -> dict:
    """
    SMS and WhatsApp share a Twilio account but need DIFFERENT senders, and
    having one does not give you the other — which is precisely the kind of
    half-configured state that looks fine until an OTP does not arrive.
    """
    account = _present("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN")
    return {
        "configured": account,
        "sms": account and _present("TWILIO_PHONE"),
        "whatsapp": account and _present("TWILIO_WHATSAPP_FROM"),
        "verified": "credentials",
    }


def _check_push() -> dict:
    """
    The only channel here that no provider can price or switch off — so it is
    worth knowing whether it is actually on.
    """
    import push as _p
    last = getattr(_p, "LAST_PUSH", {"attempted": False, "ok": None, "detail": None})
    return {
        "configured": _p.is_configured(),
        "last_send": {"attempted": bool(last.get("attempted")),
                      "ok": last.get("ok"),
                      "detail": last.get("detail")},
        "verified": "credentials",
    }


def _check_media() -> dict:
    configured = _present("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET")
    return {"configured": configured, "verified": "credentials"}


def _check_security() -> dict:
    """
    The two that decide whether anybody else can be you. `startup_checks.py`
    already refuses to boot on a Postgres database with these missing or still
    the repository placeholders — this reports the same facts rather than
    re-deciding them, so the page cannot disagree with the guard.
    """
    return {
        "secret_key": _present("SECRET_KEY"),
        "admin_password": _present("ADMIN_PASSWORD"),
        "frontend_url": _present("FRONTEND_URL"),
        "verified": "credentials",
    }


@router.get("/integrations")
def integrations(
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(auth_utils.get_current_admin),
):
    """
    Admin-only. Every third party this shop depends on, and whether it is on.

    The database is the one row here that is genuinely PROVEN rather than
    merely configured: this request reached a session and can run a statement,
    so `SELECT 1` returning is real evidence, and it is marked as such.
    """
    db_ok, db_error = True, None
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:                                  # pragma: no cover
        db_ok, db_error = False, type(exc).__name__

    return {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "database":   {"configured": True, "reachable": db_ok,
                       "error": db_error, "verified": "live"},
        "payments":   _check_razorpay(),
        "email":      _check_email(),
        "courier":    _check_courier(),
        "messaging":  _check_messaging(),
        "media":      _check_media(),
        "push":       _check_push(),
        "security":   _check_security(),
    }

@router.post("/test-email")
def send_test_email(
    current_admin: models.User = Depends(auth_utils.get_current_admin),
):
    """
    Prove email works, on demand, without waiting for a customer to need it.

    WHY THIS EXISTS. The Email row can only report what the last real send did,
    so after every deploy it reads "configured, nothing sent yet this run" —
    honest, but useless at the moment you most want an answer: you have just
    changed a setting and want to know whether it worked. The alternative was
    placing a test order or signing out and back in, which is a lot of
    ceremony to answer one question.

    IT CAN ONLY EVER EMAIL THE ADMIN WHO ASKED. Not an address in the request —
    the address on the calling account. So this cannot be turned into a way to
    send mail to anybody else, which is what it would become the moment it
    accepted a recipient.

    The result is the truth from the provider, not a guess: the same
    `_send_email` every order confirmation goes through, and its outcome is
    recorded, so the Email row goes green or red on this one click.
    """
    import notifications

    to = (current_admin.email or "").strip()
    if not to:
        raise HTTPException(400, "This admin account has no email address.")

    ok = notifications._send_email(
        to,
        "Test from your shop's health page",
        "<p>If you are reading this, email is working.</p>"
        "<p>Sent from the System Health page. Nothing else was changed.</p>",
    )

    last = getattr(notifications, "LAST_EMAIL", {})
    if not ok:
        # The reason, not just the failure — it is the whole point of asking.
        raise HTTPException(
            502,
            f"Could not send: {last.get('detail') or 'the provider refused it'}",
        )
    return {"sent": True, "to": to, "via": last.get("host")}
