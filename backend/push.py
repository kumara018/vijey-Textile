"""
Web push — the one notification channel that is free, unlimited and worldwide.

WHY THIS EXISTS. Every other channel this shop has costs money or is about to.
SMS is never free — carriers charge to terminate every message. WhatsApp's free
service window closes on 1 October 2026, after which order updates inside the
24-hour window start being charged again. Email is free at this volume but goes
to a place people check hourly, not instantly.

Web push has no vendor. The browser's own push service — Google's for Chrome,
Mozilla's for Firefox, Apple's for Safari — carries the message, and none of
them charge or rate-limit a shop of this size. There is no account to open, no
key to buy, nothing that can be suspended. That is the entire reason to build
it: it is the only channel here that cannot be taken away or priced.

WHAT IT COSTS INSTEAD. Reach. A customer must grant permission, and on iPhone
must first add the site to their home screen. So this is an ADDITION to email,
never a replacement — an order confirmation still goes by mail, because a
customer who declined the prompt must not silently stop hearing from the shop.

HOW THE KEYS WORK. VAPID is a keypair the shop owns. The public half is handed
to the browser when it subscribes; the private half signs each push so the push
service knows the message really came from this shop. Generate them once with
`python -m push` and set them as environment variables. Losing the private key
invalidates every existing subscription — customers would have to opt in again,
which is why they belong in the environment and not in the repository.
"""

import json
import os
from datetime import datetime, timezone

# The outcome of the most recent send, so System Health can report a channel
# that is failing rather than merely one that has credentials — the same
# lesson the email and courier rows taught, applied before it can bite.
LAST_PUSH = {"attempted": False, "ok": None, "detail": None}


def _record(ok: bool, detail: str | None = None) -> None:
    LAST_PUSH.update(attempted=True, ok=ok, detail=detail)


def public_key() -> str:
    """The half handed to browsers. Safe to publish — that is its purpose."""
    return os.getenv("VAPID_PUBLIC_KEY", "").strip()


def _private_key() -> str:
    return os.getenv("VAPID_PRIVATE_KEY", "").strip()


def _subject() -> str:
    """
    A contact address the push service can use to reach the sender.

    Required by the VAPID spec. It must be a mailto: or https: URI; a bare
    address is rejected by some push services with an error that does not say
    so, which is worth normalising here rather than debugging twice.
    """
    raw = os.getenv("VAPID_SUBJECT", "").strip()
    if not raw:
        support = os.getenv("SUPPORT_EMAIL", "").strip()
        raw = f"mailto:{support}" if support else ""
    if raw and not raw.startswith(("mailto:", "http://", "https://")):
        raw = f"mailto:{raw}"
    return raw


def is_configured() -> bool:
    return bool(public_key() and _private_key() and _subject())


def send(subscription: dict, title: str, body: str, url: str = "/") -> tuple[bool, str | None]:
    """
    Deliver one notification. Returns (delivered, reason_if_not).

    THE SECOND RETURN VALUE IS NOT DECORATION. A push service answers 404 or
    410 when a subscription is dead — the browser was uninstalled, the customer
    cleared their site data, the endpoint expired. That is not a failure to
    retry; it is the subscription telling us to delete it. Anything else is a
    transient problem worth keeping the subscription for. The caller cannot
    tell those apart from a bare False, and a shop that never prunes dead
    endpoints ends up spending every send on subscriptions that cannot receive.
    """
    if not is_configured():
        _record(False, "VAPID keys not set")
        return False, "not configured"

    try:
        from pywebpush import webpush, WebPushException
    except ImportError:                                   # pragma: no cover
        _record(False, "pywebpush not installed")
        return False, "not configured"

    payload = json.dumps({"title": title, "body": body, "url": url})

    try:
        webpush(
            subscription_info=subscription,
            data=payload,
            vapid_private_key=_private_key(),
            vapid_claims={"sub": _subject()},
            timeout=10,
        )
        _record(True)
        return True, None
    except WebPushException as exc:
        status = getattr(getattr(exc, "response", None), "status_code", None)
        if status in (404, 410):
            _record(True)          # the channel works; this endpoint is dead
            return False, "gone"
        # 403 IS NOT A DEAD SUBSCRIPTION, AND MUST NOT BE TREATED AS ONE.
        # It means VAPID authentication was rejected, which has two very
        # different causes that look identical from here: this subscription was
        # created with a key we have since rotated away from, or the whole VAPID
        # configuration is wrong (a `sub` claim that is not a mailto: or https:
        # URL is the usual one) and EVERY push will fail the same way.
        #
        # Pruning on 403 would delete every subscription in the shop the first
        # time somebody mistyped the subject. So it is reported, not acted on —
        # and the browser resolves the rotation case, because only it can see
        # which key its own subscription was made with (see lib/push.ts).
        if status == 403:
            _record(False, "push service rejected our VAPID credentials (403) — "
                           "rotated keys, or a bad VAPID_SUBJECT")
            return False, "403"
        _record(False, f"push service returned {status}" if status else type(exc).__name__)
        return False, str(status or type(exc).__name__)
    except Exception as exc:                              # pragma: no cover
        _record(False, type(exc).__name__)
        return False, type(exc).__name__


def send_to_user(db, user_id: int, title: str, body: str, url: str = "/") -> int:
    """
    Every device this customer has subscribed, and prune the dead ones.

    Returns how many were actually delivered. A customer with a laptop and a
    phone has two subscriptions and expects both to buzz; one that has died
    since is removed here rather than accumulating forever.
    """
    import models

    if not is_configured():
        return 0

    rows = db.query(models.PushSubscription).filter(
        models.PushSubscription.user_id == user_id,
    ).all()

    delivered, dead = 0, []
    for row in rows:
        ok, reason = send(
            {"endpoint": row.endpoint,
             "keys": {"p256dh": row.p256dh, "auth": row.auth}},
            title, body, url,
        )
        if ok:
            delivered += 1
            row.last_sent_at = datetime.now(timezone.utc)
        elif reason == "gone":
            dead.append(row)

    for row in dead:
        db.delete(row)
    if delivered or dead:
        db.commit()

    return delivered


def _generate() -> None:
    """
    `python -m push` — print a fresh keypair to paste into the environment.

    Run once per shop. Both halves are printed together because they are only
    useful as a pair, and the private half is never written to disk here: it
    goes straight from this output into the environment settings, and nowhere
    else.
    """
    import base64
    from cryptography.hazmat.primitives import serialization
    from py_vapid import Vapid01

    vapid = Vapid01()
    vapid.generate_keys()

    pub = base64.urlsafe_b64encode(
        vapid.public_key.public_bytes(
            encoding=serialization.Encoding.X962,
            format=serialization.PublicFormat.UncompressedPoint,
        )
    ).decode().rstrip("=")

    priv = base64.urlsafe_b64encode(
        vapid.private_key.private_numbers().private_value.to_bytes(32, "big")
    ).decode().rstrip("=")

    print("Set these three on the service, then redeploy:\n")
    print(f"VAPID_PUBLIC_KEY={pub}")
    print(f"VAPID_PRIVATE_KEY={priv}")
    print("VAPID_SUBJECT=mailto:<your support address>")
    print("\nKeep the private key out of the repository. Replacing it later")
    print("invalidates every existing subscription — customers would have to")
    print("allow notifications again.")


if __name__ == "__main__":
    _generate()
