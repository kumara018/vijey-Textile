"""
Rate limiting for the authentication endpoints.  (AUTH-SPEC.md R1)

Before this, nothing limited any auth endpoint — searched for `slowapi`,
`limiter`, `RateLimit` and found no match outside `venv/`. Every endpoint
answered as fast as the server could.

WHY THIS IS THE FIRST OF THE REMEDIATIONS. The other findings in the spec each
leak roughly one bit per request: whether an account exists, whether a password
was right, how long a lookup took. Rate limiting is what decides whether one bit
per request is a curiosity or a customer list. An Indian mobile number is ten
digits with a known prefix set — a few million candidates — which is nothing to
an unthrottled endpoint and impractical at five attempts a minute. It is also
the only item that helps even if nothing else is ever touched.

TWO KEYS, BECAUSE ONE IS NOT ENOUGH.

Per-IP alone is defeated by a proxy pool: rotate the source address and the
limit resets. So the endpoints that take an identifier are ALSO limited per
identifier, which is what actually stops a distributed walk of the number
space — the attacker can change address freely, but each number they probe
still burns one of its own small budget.

Per-identifier alone would be worse: it lets one address hammer the whole
endpoint as long as it varies the identifier. The two together cover both.

BEHIND A PROXY, THE SOCKET PEER IS THE PROXY.

Render terminates TLS in front of the app, so `get_remote_address` sees
Render's address for every request and the per-IP limit would put the entire
internet in one bucket — a limiter that locks out all customers at once, which
is worse than none. The left-most X-Forwarded-For entry is the closest thing to
the real client.

That header is spoofable, and the honest consequence is: an attacker who forges
it can evade the per-IP limit. They cannot evade the per-identifier limit, which
is the one that matters for enumeration. Stated here rather than left implicit,
because a limiter whose weaknesses are not written down gets trusted for things
it does not do.

THE STORAGE, AND WHY IT CHANGED.

This used slowapi with its default in-process storage, and the file said so:
"resets when Render restarts or scales out... adequate for slowing enumeration
to uselessness". That was too generous by half, and the deployment is the reason.

Render's free tier sleeps the instance after fifteen minutes without traffic and
starts a fresh process on the next request. Every deploy restarts it as well. So
the counters do not merely reset "on restart" as an occasional event — on a shop
that is quiet overnight they reset continuously, and an attacker does not have
to defeat the limit at all. They wait for the shop to be idle, spend the budget,
wait again. The limit becomes a rate of five per visit rather than five per
hour, and enumeration goes back to being a weekend job.

slowapi cannot fix this here: its storage backends are memory, Redis, Memcached,
MongoDB and etcd — there is no SQL backend, and this deployment has Postgres and
nothing else. Rather than add a paid dependency for a counter, the limiter is
now roughly eighty lines against a table (`models.RateLimitHit`). It survives
restarts, it is shared by every worker, and it removes a dependency instead of
adding one.

The budgets, their keys and their wording are unchanged. Only where the count
is kept has changed.
"""
from __future__ import annotations

import time as _time
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session
from starlette.requests import Request

import models


# ── Keys ─────────────────────────────────────────────────────────────────────

def client_ip(request: Request) -> str:
    """The real client address, as far as it can be known behind Render."""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        # Left-most entry is the original client; everything after is proxies.
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    client = getattr(request, "client", None)
    return (client.host if client else None) or "unknown"


# ── Budgets ──────────────────────────────────────────────────────────────────
#
# Set from what a real person does, not from what feels safe. Someone mistyping
# a one-time code three times in a minute is ordinary; someone requesting six
# codes for six different numbers in a minute is not.
#
# Anything that SENDS a message (an OTP, a reset link) is tightest: each request
# costs real money and lands in someone's inbox, so abuse is expensive for the
# shop and annoying for whoever's number is being used.
SEND_CODE = "5/minute;30/hour"      # send-login-otp, forgot-password, resend
VERIFY_CODE = "10/minute;60/hour"   # verify-*-otp, reset-password — typos happen
REGISTER = "3/minute;20/hour"       # account creation
SESSION_SWAP = "10/minute"          # evict-and-login
# Per-identifier ceiling for the enumeration-sensitive endpoints. Deliberately
# per-hour: the point is to make walking a number space take years.
PER_IDENTIFIER = "5/hour"
# Progressive sign-in (AUTH-SPEC R6) sends a real SMS on every attempt whether
# or not the account exists — that is the whole point of the blind branch, and
# it means the spend ceiling has to be tighter than anywhere else. The spec's
# own suggestion: 3 per identifier per hour, 10 per IP per hour.
BEGIN_PER_IP = "10/hour"
BEGIN_PER_IDENTIFIER = "3/hour"
# /auth/lookup answers "is this registered?" so the sign-in form can send a new
# customer to Create Account instead of failing them on a password they were
# never going to have. That answer is an enumeration oracle, and these are the
# numbers that keep it from being a useful one.
#
# It is not a NEW oracle: /register already replies "An account with this email
# already exists" and "This phone number is already registered", at 20/hour per
# IP. Anything reachable through lookup was reachable there first, and more
# cheaply — so this is deliberately no more permissive than REGISTER per hour.
#
# Sends nothing, so there is no per-message cost to bound, only walking. The
# per-minute allowance is generous because Indian mobile networks put whole
# cities behind shared addresses: a limit that stops enumeration from one IP
# must not stop a street of customers signing in from another.
LOOKUP_PER_IP = "20/minute;120/hour"
LOOKUP_PER_IDENTIFIER = "10/hour"

_UNITS = {
    "second": 1,
    "minute": 60,
    "hour": 3600,
    "day": 86400,
}


def parse_budget(budget: str) -> list[tuple[int, int]]:
    """
    "5/minute;30/hour" -> [(5, 60), (30, 3600)]

    Kept as the same strings the old decorators took, so the numbers in this
    file are still the numbers that apply and a reviewer comparing against the
    spec does not have to translate anything.
    """
    out: list[tuple[int, int]] = []
    for part in budget.split(";"):
        part = part.strip()
        if not part:
            continue
        count, _, unit = part.partition("/")
        seconds = _UNITS.get(unit.strip().rstrip("s"))
        if seconds is None:
            raise ValueError(f"unknown rate-limit period: {part!r}")
        out.append((int(count), seconds))
    return out


# ── The limiter ──────────────────────────────────────────────────────────────

def enforce(db: Session, scope: str, key: str, budget: str) -> None:
    """
    Record one attempt against `scope|key` and raise 429 if it breaks `budget`.

    Called explicitly at the top of an endpoint rather than through a decorator.
    That is the same judgement already made for the per-identifier ceiling, and
    for the same reason: a decorator has to guess which of the endpoint's
    arguments is the request and which is the session, and slowapi's version of
    that guess is what turned every successful request into a 500 once
    `headers_enabled` was on. An explicit call at the top of the function is one
    line, and what it does is visible at the call site.

    Fails OPEN on a database error, deliberately. This is a control on abuse,
    not on correctness, and the alternative — every customer locked out of
    sign-in because the counter table is unreachable — is a worse outcome than
    an unthrottled hour. Anything that reaches this state is already paging
    someone about the database.
    """
    limits = parse_budget(budget)
    if not limits:
        return

    bucket = f"{scope}|{key}"
    now = datetime.now(timezone.utc)
    longest = max(seconds for _, seconds in limits)

    try:
        # Prune this bucket's expired rows before counting. Doing it here rather
        # than on a schedule keeps the table self-maintaining: a bucket that is
        # never touched again holds at most one window of rows, and a bucket
        # under attack is pruned on every attempt.
        db.execute(
            delete(models.RateLimitHit).where(
                models.RateLimitHit.bucket == bucket,
                models.RateLimitHit.at < now - timedelta(seconds=longest),
            )
        )

        for count, seconds in limits:
            since = now - timedelta(seconds=seconds)
            used = db.execute(
                select(func.count())
                .select_from(models.RateLimitHit)
                .where(
                    models.RateLimitHit.bucket == bucket,
                    models.RateLimitHit.at >= since,
                )
            ).scalar_one()

            if used >= count:
                # The oldest hit still inside the window is when a slot frees.
                oldest = db.execute(
                    select(func.min(models.RateLimitHit.at)).where(
                        models.RateLimitHit.bucket == bucket,
                        models.RateLimitHit.at >= since,
                    )
                ).scalar_one_or_none()
                retry = seconds
                if oldest is not None:
                    if oldest.tzinfo is None:
                        oldest = oldest.replace(tzinfo=timezone.utc)
                    retry = max(1, int(seconds - (now - oldest).total_seconds()))
                db.commit()
                raise HTTPException(
                    status_code=429,
                    detail="Too many attempts. Please wait a moment and try again.",
                    headers={"Retry-After": str(retry)},
                )

        db.add(models.RateLimitHit(bucket=bucket, at=now))
        db.commit()
    except HTTPException:
        raise
    except Exception:
        # See the docstring: abuse control must not become an outage.
        try:
            db.rollback()
        except Exception:
            pass


def enforce_ip_limit(db: Session, request: Request, scope: str, budget: str) -> None:
    """Per-address budget for one endpoint."""
    enforce(db, scope, f"ip:{client_ip(request)}", budget)


def enforce_identifier_limit(db: Session, identifier: str, budget: str = PER_IDENTIFIER) -> None:
    """
    Raise 429 when one identifier has been probed too often, from anywhere.

    Keyed on the account being asked about, deliberately NOT on the caller: an
    attacker rotating through a proxy pool resets a per-IP budget on every
    request, but each phone number or email they walk still spends one of its
    own five hourly slots. That is what turns enumeration from a weekend job
    into an impossible one.

    Normalised so `  User@Example.COM ` and `user@example.com` share a budget —
    otherwise the limit is bypassed with a capital letter.
    """
    key = (identifier or "").strip().lower()
    if not key:
        return
    enforce(db, "identifier", f"id:{key}", budget)


def sweep(db: Session, older_than_seconds: int = 86400) -> int:
    """
    Drop rows no live window can reference any more.

    `enforce` prunes the bucket it touches, which is enough for buckets that
    keep being used. This catches the long tail — an address that probed once
    and never returned would otherwise leave its row behind forever. Called from
    the existing scheduled job; returns how many rows went.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=older_than_seconds)
    result = db.execute(
        delete(models.RateLimitHit).where(models.RateLimitHit.at < cutoff)
    )
    db.commit()
    return result.rowcount or 0
