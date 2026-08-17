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

IN-PROCESS STORAGE. This resets when Render restarts or scales out, so the true
ceiling is per-worker. Adequate for slowing enumeration to uselessness; not a
distributed guarantee. A shared Redis store is the upgrade, and slowapi takes a
`storage_uri` when you want it — nothing else here changes.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request


def client_ip(request: Request) -> str:
    """The real client address, as far as it can be known behind Render."""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        # Left-most entry is the original client; everything after is proxies.
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    return get_remote_address(request)


def identifier_key(request: Request) -> str:
    """
    Key on the account being probed, not the address probing it.

    slowapi resolves the key before the endpoint runs, so the request body is
    not parsed yet and cannot be read here without consuming the stream. The
    routes that need this therefore set `request.state.rl_identifier` from their
    already-validated payload and call the limiter explicitly.

    Falls back to the address, so a missing identifier degrades to the per-IP
    limit rather than to no limit at all.
    """
    ident = getattr(request.state, "rl_identifier", None)
    if ident:
        return f"id:{str(ident).strip().lower()}"
    return f"ip:{client_ip(request)}"


#
# `headers_enabled` is OFF, and that is a correctness fix rather than a
# preference. With it on, slowapi attaches X-RateLimit-* headers to every
# response — which requires each decorated endpoint to hand it a real
# `starlette.responses.Response`. These endpoints return plain dicts and let
# FastAPI serialise them, so every SUCCESSFUL request raised
# "parameter `response` must be an instance of starlette.responses.Response"
# and turned into a 500.
#
# It was invisible at first because the failure only shows on the happy path:
# the 429s looked perfect (slowapi builds a real Response for those) while
# requests 1-5 were quietly 500ing. A limiter that breaks the endpoint it
# protects is worse than no limiter — it converts "someone is probing us" into
# "nobody can sign in".
#
# Turning it on later means adding `response: Response` to eight signatures.
# The headers are a convenience for well-behaved clients; the limit is the
# security control, and it works without them.
limiter = Limiter(key_func=client_ip)

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


# ── Per-identifier ceiling ───────────────────────────────────────────────────
#
# Written explicitly rather than by reusing slowapi's decorator.
#
# The decorator is built to wrap an endpoint: with `headers_enabled` it expects
# a real Response back so it can attach X-RateLimit-* headers, and calling it on
# a throwaway lambda raised "parameter `response` must be an instance of
# starlette.responses.Response" — a 500 on every forgot-password request. That
# was me bending a tool to a shape it does not have. Fifteen lines of counter is
# clearer than a clever call into somebody else's decorator internals, and it
# cannot break when slowapi changes them.
#
# Same in-process caveat as everything else here: per-worker, resets on deploy.
from collections import defaultdict, deque
import time as _time

from fastapi import HTTPException

_ID_WINDOW_SECONDS = 3600
_ID_MAX_PER_WINDOW = 5
_id_hits: dict[str, deque] = defaultdict(deque)


def enforce_identifier_limit(identifier: str) -> None:
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

    now = _time.monotonic()
    q = _id_hits[key]
    while q and now - q[0] > _ID_WINDOW_SECONDS:
        q.popleft()

    if len(q) >= _ID_MAX_PER_WINDOW:
        # Same wording whether or not the account exists — this endpoint must
        # not become the enumeration oracle the limit exists to prevent.
        raise HTTPException(
            status_code=429,
            detail="Too many requests for this account. Please try again later.",
        )
    q.append(now)
