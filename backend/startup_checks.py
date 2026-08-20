"""Refuse to start a real deployment that is missing its secrets.

WHY THIS EXISTS. Every one of the 41 environment variables this app reads has
a fallback, so the process starts happily with none of them set. That is
convenient locally and dangerous everywhere else, because three of those
fallbacks are not harmless:

    SECRET_KEY     -> "change-this-in-production"
    ADMIN_PASSWORD -> "VijeyTextile@2026"
    DATABASE_URL   -> "sqlite:///./<shop>.db"

The first two are literal strings in a public GitHub repository. A deployment
that misses SECRET_KEY signs its JWTs with a value anyone can read, which means
anyone can mint an admin token. A deployment that misses DATABASE_URL comes up
"healthy" on an empty SQLite file inside the container — the shop shows no
products, and any order written to it is destroyed when the container restarts.

None of that fails loudly. The service reports itself up, the health check
passes, and the damage is only visible later. That is the worst shape a
misconfiguration can have, and it is most likely to happen during a host
migration — which is exactly what is being planned.

WHAT COUNTS AS A REAL DEPLOYMENT. A Postgres DATABASE_URL. Nobody points this
at Postgres to try something out locally; if Postgres is configured, this is
serving somebody. Local SQLite work is unaffected and needs no new variables.

Failing at import is deliberate. A container that refuses to start is a loud,
obvious, immediately-visible problem that shows up in the deploy log before any
traffic reaches it. A container that starts with the wrong secrets is a quiet
one that shows up in a customer's account.
"""
from __future__ import annotations

import os
import sys

# The literal fallbacks in auth.py and main.py. Kept here as the values that
# must never reach production rather than as a copy of the config.
_PUBLISHED_DEFAULTS = {
    "SECRET_KEY": "change-this-in-production",
    "ADMIN_PASSWORD": "VijeyTextile@2026",
}


def _is_real_deployment() -> bool:
    """A Postgres URL means this instance is serving somebody."""
    url = os.getenv("DATABASE_URL", "")
    return url.startswith("postgres://") or url.startswith("postgresql://")


def run() -> None:
    problems: list[str] = []

    if _is_real_deployment():
        for name, published in _PUBLISHED_DEFAULTS.items():
            value = os.getenv(name)
            if not value:
                problems.append(
                    f"{name} is not set. It would fall back to a value that is "
                    f"committed to this repository."
                )
            elif value == published:
                problems.append(
                    f"{name} is still the repository's placeholder value. "
                    f"Anyone who can read the source can read this secret."
                )
    else:
        # Not Postgres. If a host has assigned a PORT then this is deployed
        # somewhere and about to run the shop off a throwaway file.
        if os.getenv("PORT") and not os.getenv("DATABASE_URL"):
            problems.append(
                "DATABASE_URL is not set, but this looks like a hosted "
                "environment (PORT is assigned). The app would run on an empty "
                "SQLite file inside the container: no products would appear, and "
                "any order placed would be lost when the container restarts."
            )

    if not problems:
        return

    line = "=" * 72
    print(f"\n{line}\nREFUSING TO START — configuration is unsafe\n{line}", file=sys.stderr)
    for p in problems:
        print(f"\n  * {p}", file=sys.stderr)
    print(
        f"\n{line}\n"
        "Set these in the host's environment settings and redeploy.\n"
        "Generate a strong SECRET_KEY with:\n\n"
        "    python -c \"import secrets; print(secrets.token_urlsafe(64))\"\n"
        f"{line}\n",
        file=sys.stderr,
    )
    raise SystemExit(1)
