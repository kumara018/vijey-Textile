"""
Receives runtime errors from customers' browsers.

Nothing previously told the shop when a real visitor's browser threw. The
frontend has designed error boundaries, so a crash shows a proper page rather
than a blank one, but the FACT of it died in that person's console. A checkout
that fails only on one iOS version, or only with a particular wallet extension
installed, stayed invisible until somebody telephoned the shop.

This is deliberately the smallest thing that closes that gap:

  * ADDITIVE ONLY. It adds one endpoint and one table. It does not touch auth,
    orders, payments or any existing route. The auth remediation in
    AUTH-SPEC.md is a separate matter and is still specced, not built.
  * UNAUTHENTICATED, because errors must be reportable by someone who never
    signed in — a crash on the product page is exactly the case that matters —
    and because requiring a token would mean the auth failure path could never
    report itself.
  * RATE LIMITED IN MEMORY, since unauthenticated write endpoints are abusable
    by definition. See the note on the limiter for what that does and does not
    protect against.
  * SIZE CAPPED, so a large body cannot be used to fill the database.

WHAT IS NOT STORED. The client already strips query strings before sending,
because reset and rating tokens live there. Nothing here reads cookies, headers
beyond the user agent, or any request body field not listed in the model. An
error report should make a bug findable, not become a second place customer
data can leak from.
"""
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
import time

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import models
import auth as auth_utils
from database import get_db

router = APIRouter(prefix="/api/client-errors", tags=["client-errors"])

# ── Rate limiting ────────────────────────────────────────────────────────────
#
# In-process and therefore per-worker: with N workers the effective ceiling is
# N times this. Stated plainly rather than implied, because the honest scope of
# a limiter matters. It exists to stop one broken page in one browser flooding
# the table — the realistic failure — not to stop a determined attacker, which
# needs the shared-store limiter described in AUTH-SPEC.md R1.
#
# It also resets on deploy. For this endpoint that is acceptable; for the auth
# endpoints it would not be, which is exactly why that one is specced properly.
_WINDOW_SECONDS = 60
_MAX_PER_WINDOW = 20
_hits: dict[str, deque] = defaultdict(deque)


def _client_key(request: Request) -> str:
    # Render sits behind a proxy, so REMOTE_ADDR is the proxy. The left-most
    # X-Forwarded-For entry is the closest thing to the real client. It is
    # spoofable — which is fine for shedding load, and is why this is not a
    # security control.
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _rate_limited(key: str) -> bool:
    now = time.monotonic()
    q = _hits[key]
    while q and now - q[0] > _WINDOW_SECONDS:
        q.popleft()
    if len(q) >= _MAX_PER_WINDOW:
        return True
    q.append(now)
    return False


class ClientErrorIn(BaseModel):
    name: str = Field(default="Error", max_length=100)
    message: str = Field(default="", max_length=500)
    stack: str = Field(default="", max_length=4000)
    source: str = Field(default="unknown", max_length=40)
    component_stack: str | None = Field(default=None, max_length=2000)
    digest: str | None = Field(default=None, max_length=100)
    request_id: str | None = Field(default=None, max_length=64)
    url: str = Field(default="", max_length=500)
    user_agent: str = Field(default="", max_length=300)
    viewport: str = Field(default="", max_length=40)
    at: str | None = Field(default=None, max_length=40)


@router.post("", status_code=204)
@router.post("/", status_code=204)
def receive_client_error(
    payload: ClientErrorIn,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Record one browser-side error.

    Returns 204 with no body on purpose. The browser sends this with
    `navigator.sendBeacon`, which cannot read a response, and the page is
    frequently unloading as it fires. There is nothing useful to say back.
    """
    if _rate_limited(_client_key(request)):
        # 429 rather than a silent drop, so the behaviour is observable if
        # anyone ever looks at why reports stopped arriving.
        raise HTTPException(429, "Too many error reports")

    row = models.ClientError(
        name=payload.name,
        message=payload.message,
        stack=payload.stack,
        source=payload.source,
        component_stack=payload.component_stack,
        digest=payload.digest,
        request_id=payload.request_id,
        url=payload.url,
        user_agent=payload.user_agent,
        viewport=payload.viewport,
        created_at=datetime.now(timezone.utc),
    )
    db.add(row)
    db.commit()
    return None


@router.get("/recent")
def recent_client_errors(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_admin),
):
    """
    The most recent reports, newest first. Admin only.

    Reading them requires an admin because a stack trace names internal file
    paths and component names; writing them does not, because a crashing page
    has no session to offer.
    """
    rows = (
        db.query(models.ClientError)
        .order_by(models.ClientError.created_at.desc())
        .limit(200)
        .all()
    )
    return [
        {
            "id": r.id,
            "name": r.name,
            "message": r.message,
            "source": r.source,
            "url": r.url,
            "user_agent": r.user_agent,
            "viewport": r.viewport,
            "digest": r.digest,
            "request_id": r.request_id,
            "stack": r.stack,
            "component_stack": r.component_stack,
            "created_at": str(r.created_at),
        }
        for r in rows
    ]
