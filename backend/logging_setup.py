"""
Structured logging and request IDs.

WHAT WAS THERE BEFORE. `print()`. Render captures stdout, so the lines do reach
the log viewer, but they are unstructured prose with no timestamp of their own,
no level, no route, and nothing tying one line to another. When a customer says
"it failed when I tried to pay on Tuesday afternoon", there is no way to find
their requests among everyone else's — and the frontend already ships error
reports to `/api/client-errors` that cannot be joined to anything on the server
side. Two halves of the same incident, with no key between them.

WHAT THIS ADDS, AND DELIBERATELY NOT MORE.

  1. A request ID for every request, honoured from `X-Request-ID` if the caller
     sent one and generated otherwise, returned on the response, and carried in
     a context variable so any log line written while handling that request
     picks it up without being passed it.
  2. One JSON line per request: method, path, status, duration, request id,
     client address, and the user id when the endpoint resolved one.
  3. The same JSON shape for anything logged through the standard `logging`
     module, so a future `logger.warning(...)` lands in the same stream.

No log aggregation service, no tracing backend, no new dependency. Render's log
viewer greps JSON perfectly well, and a service can be pointed at this later
without changing a line of application code. The point today is that the
information EXISTS and is correlatable; where it is shipped is a separate
decision the shop has not had to make yet.

WHAT IS DELIBERATELY NOT LOGGED. No request bodies, no headers beyond the
address, no identifiers, no OTPs, no tokens. An auth endpoint's body is a phone
number and a password; a payment endpoint's is an order and an amount. A log
that contains those is a second copy of the customer database in a place with
weaker access control than the first one. The request id is what lets someone
find the request; the body is not needed to fix it.
"""
from __future__ import annotations

import json
import logging
import sys
import time
import uuid
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

# The current request's id, readable from anywhere in the handling of it —
# including from code that has no access to the Request object, which is most
# of the interesting code.
request_id_var: ContextVar[str] = ContextVar("request_id", default="-")

_ACCESS = logging.getLogger("vijey.access")
_APP = logging.getLogger("vijey")


class JsonFormatter(logging.Formatter):
    """One JSON object per line. Extra fields ride along in `record.extra`."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(record.created))
                  + f".{int(record.msecs):03d}Z",
            "level": record.levelname,
            "logger": record.name,
            "request_id": request_id_var.get(),
            "msg": record.getMessage(),
        }
        extra = getattr(record, "extra", None)
        if isinstance(extra, dict):
            payload.update(extra)
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        # `default=str` so a stray datetime or Decimal degrades to a string
        # instead of taking the log line down with it — a logger that can raise
        # is a logger that hides the incident it was meant to record.
        return json.dumps(payload, default=str)


def configure_logging(level: str = "INFO") -> None:
    """Point the root logger at stdout with the JSON formatter, exactly once."""
    root = logging.getLogger()
    if any(isinstance(h.formatter, JsonFormatter) for h in root.handlers):
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root.handlers = [handler]
    root.setLevel(getattr(logging, level.upper(), logging.INFO))

    # uvicorn's own access log duplicates what the middleware below records,
    # in a different shape, on every request. One access line per request, in
    # one format, or the log is twice the size and half as searchable.
    logging.getLogger("uvicorn.access").handlers = []
    logging.getLogger("uvicorn.access").propagate = False
    for name in ("uvicorn", "uvicorn.error"):
        logging.getLogger(name).handlers = [handler]
        logging.getLogger(name).propagate = False


def log(msg: str, level: str = "info", **fields) -> None:
    """
    Application logging with structure: `log("refund issued", order=n, amount=x)`.

    A thin wrapper so call sites do not each have to remember the `extra={...}`
    incantation, which is the reason ad-hoc logging drifts back to print().
    """
    getattr(_APP, level.lower(), _APP.info)(msg, extra={"extra": fields})


class RequestContextMiddleware(BaseHTTPMiddleware):
    """
    Assigns the request id, times the request, and writes the access line.

    The id is echoed on the response as `X-Request-ID`. That is the half that
    makes this useful rather than merely tidy: the browser can read it off a
    failed response and include it in the report it already sends to
    `/api/client-errors`, so a customer's crash report and the server's record
    of the request that caused it share a key.
    """

    # Paths that would otherwise fill the log with nothing. `/health` is polled
    # every fourteen minutes by the frontend to keep Render awake, and the
    # static mount serves images.
    QUIET = ("/health", "/uploads/")

    async def dispatch(self, request: Request, call_next):
        incoming = request.headers.get("x-request-id", "").strip()
        # Bounded: an inbound header is attacker-controlled, and an unbounded
        # one would be written verbatim into every log line for that request.
        rid = incoming[:64] if incoming else uuid.uuid4().hex[:16]
        token = request_id_var.set(rid)
        started = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception:
            elapsed = (time.perf_counter() - started) * 1000
            _ACCESS.exception(
                "request failed",
                extra={"extra": {
                    "method": request.method,
                    "path": request.url.path,
                    "status": 500,
                    "ms": round(elapsed, 1),
                    "ip": _client_ip(request),
                }},
            )
            request_id_var.reset(token)
            raise

        elapsed = (time.perf_counter() - started) * 1000
        response.headers["X-Request-ID"] = rid

        path = request.url.path
        if not path.startswith(self.QUIET):
            # A 4xx or 5xx is worth a louder level than a 200 — it is what
            # someone scanning the log is looking for.
            level = "warning" if response.status_code >= 400 else "info"
            getattr(_ACCESS, level)(
                "request",
                extra={"extra": {
                    "method": request.method,
                    "path": path,
                    "status": response.status_code,
                    "ms": round(elapsed, 1),
                    "ip": _client_ip(request),
                    # Only present when the endpoint resolved one; auth
                    # dependencies set it. Never an email or a phone number.
                    **({"user_id": request.state.user_id}
                       if getattr(request.state, "user_id", None) else {}),
                }},
            )

        request_id_var.reset(token)
        return response


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    client = getattr(request, "client", None)
    return (client.host if client else None) or "unknown"
