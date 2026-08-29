"""
What each integration last did, remembered across restarts.

WHY THIS REPLACES A MODULE GLOBAL. The outcome of the last send used to live in
a dict in memory. That answered the question "has this worked since the process
started", when the question actually being asked is "does this work". Every
deploy — and this shop deploys often — reset every row to amber, so the health
page spent most of its life saying "nothing sent yet this run" about channels
that had been working perfectly for weeks. A status page that forgets on every
restart teaches its owner to ignore it, and an ignored diagnostic is worse than
none: it occupies the place where a real one should be.

Stored in the database, so it survives restarts and says what actually last
happened, whenever that was.

RECORDING MUST NEVER BREAK THE THING IT OBSERVES. Every write here is wrapped:
if the status row cannot be saved, the email still sent, the parcel still
booked. A monitoring write that can take down the operation it monitors is a
liability, not a safeguard.

Nothing secret is ever stored — a key name, a boolean, a short reason and a
timestamp.
"""

from datetime import datetime, timezone


def record(key: str, ok: bool, detail: str | None = None) -> None:
    """Remember how `key` last behaved. Never raises."""
    try:
        from database import SessionLocal
        import models

        db = SessionLocal()
        try:
            row = db.query(models.IntegrationStatus).filter(
                models.IntegrationStatus.key == key,
            ).first()
            now = datetime.now(timezone.utc)
            if row:
                row.ok = bool(ok)
                row.detail = (detail or None)
                row.checked_at = now
            else:
                db.add(models.IntegrationStatus(
                    key=key, ok=bool(ok), detail=(detail or None), checked_at=now,
                ))
            db.commit()
        finally:
            db.close()
    except Exception:
        # Deliberately silent. The caller has already done the real work.
        pass


def read(db, key: str) -> dict:
    """
    What `key` last did. `attempted` false means it has never been tried —
    which is different from having been tried and failed, and the health page
    words those two differently.
    """
    try:
        import models

        row = db.query(models.IntegrationStatus).filter(
            models.IntegrationStatus.key == key,
        ).first()
        if not row:
            return {"attempted": False, "ok": None, "detail": None, "at": None}
        return {
            "attempted": True,
            "ok": bool(row.ok),
            "detail": row.detail,
            "at": row.checked_at.isoformat() if row.checked_at else None,
        }
    except Exception:
        return {"attempted": False, "ok": None, "detail": None, "at": None}
