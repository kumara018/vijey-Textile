"""
Test fixtures: a throwaway database and an app with every outbound call stubbed.

WHY THIS SHAPE. Three of the four things these tests cover — orders, returns,
refunds — talk to Delhivery, Razorpay and an SMTP server in the course of doing
their job. A test suite that reaches any of those is not a test suite: it is
slow, it fails when someone else's service is down, and on the money paths it
can create a real shipment for a fake order. So every outbound edge is stubbed
at the module boundary, and what is left under test is the shop's own logic —
which is the part that has never had a test and the part that decides whether a
customer is charged correctly.

The database is a real SQLite file per test session, not an in-memory one:
`create_all` plus the app's own boot-time migrations run against it exactly as
they do in production, so a migration that would break on a fresh database
breaks here too.
"""
from __future__ import annotations

import itertools
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock

import pytest

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

# Point every module at a throwaway database BEFORE anything imports `database`,
# which reads DATABASE_URL at import time. Getting this wrong runs the suite
# against the developer's own data.
_TMP = tempfile.mkdtemp(prefix="vijey-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_TMP, 'test.db').as_posix()}"
os.environ.setdefault("UPLOAD_DIR", str(Path(_TMP, "uploads")))
os.environ.setdefault("ADMIN_EMAIL", "admin@test.local")
os.environ.setdefault("ADMIN_PASSWORD", "TestAdmin@2026")
os.environ.setdefault("ADMIN_PHONE", "9000000001")
os.environ.setdefault("SECRET_KEY", "test-secret-not-used-anywhere-real")
# A known Razorpay secret so tests can compute a REAL signature rather than
# stub the verification out. Mocking `_verify_razorpay_payment` would delete
# the only thing standing between a forged request and a free order — the
# check has to run, so the tests satisfy it honestly and one test deliberately
# fails it.
os.environ.setdefault("RAZORPAY_KEY_SECRET", "test-razorpay-secret")

from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _stub_outbound():
    """
    Replace every outbound call with a recording stub, for the whole session.

    Patched on the MODULE rather than at each call site: the routers call
    `notifications.send_x(...)` by attribute, so replacing the attribute catches
    every present and future caller. Patching call sites would leave the next
    one someone adds talking to a real SMS gateway from a test run.
    """
    import notifications
    import delhivery

    for module in (notifications, delhivery):
        for name in dir(module):
            attr = getattr(module, name)
            if callable(attr) and not name.startswith("_") and getattr(attr, "__module__", "") == module.__name__:
                setattr(module, name, MagicMock(name=f"{module.__name__}.{name}", return_value={}))

    # SMTP has its own path in routers/auth.py (`_send_otp_email` builds a
    # message directly), so the socket layer is closed off as well. A test that
    # tries to open a connection should fail loudly rather than hang.
    import smtplib
    smtplib.SMTP = MagicMock(name="smtplib.SMTP")
    smtplib.SMTP_SSL = MagicMock(name="smtplib.SMTP_SSL")
    yield


@pytest.fixture(scope="session")
def app(_stub_outbound):
    """The real application, booted the way production boots it."""
    import main
    return main.app


@pytest.fixture(scope="session")
def client(app):
    # `with` so lifespan runs: create_all, the migrations and _ensure_indexes
    # are part of what is under test, not setup to be skipped.
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def db():
    from database import SessionLocal
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


@pytest.fixture(autouse=True)
def _clear_rate_limits(client):
    """
    Empty the rate-limit table between tests.

    The limiter is durable now, which is the point of it — and that means a
    test's requests are counted against the next test's budget. Without this
    the suite passes alone and 429s in a full run, which is the most confusing
    possible failure.
    """
    from database import SessionLocal
    import models
    s = SessionLocal()
    try:
        s.query(models.RateLimitHit).delete()
        s.commit()
    finally:
        s.close()
    yield


# ── Helpers ──────────────────────────────────────────────────────────────────

# One sequence for the whole session, so no two tests can collide on the
# unique email/phone constraints.
_USER_SEQ = itertools.count(1)

@pytest.fixture()
def make_user(client, db):
    """Create a verified customer and return (user, auth headers)."""
    import models
    import auth as auth_utils

    made = []

    def _make(email: str = None, phone: str = None, password: str = "Customer@2026"):
        # Session-wide counter, not per-test. The fixture is function-scoped but
        # the DATABASE is not, so a per-test counter hands the second test the
        # first test's email and the unique constraint rejects it.
        n = next(_USER_SEQ)
        email = email or f"customer{n}@test.local"
        # Offset past the seeded admin (9000000001). The first generated
        # number was exactly it, so the very first test hit the unique
        # constraint on phone rather than anything under test.
        phone = phone or f"9{n + 500:09d}"
        user = models.User(
            full_name=f"Test Customer {n}",
            email=email,
            phone=phone,
            password_hash=auth_utils.hash_password(password),
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        made.append(user)

        r = client.post("/api/auth/login", json={"identifier": email, "password": password})
        assert r.status_code == 200, r.text
        token = r.json()["access_token"]
        return user, {"Authorization": f"Bearer {token}"}

    return _make


@pytest.fixture()
def product(db):
    """A single in-stock product, priced so arithmetic errors are obvious."""
    import models
    p = models.Product(
        name="Test Aari Frock",
        description="A garment that exists only in the test database.",
        price=1000.0,
        category="Baby Frocks",
        size_options=["16", "18"],
        colors=["Green"],
        images=["https://res.cloudinary.com/test/image/upload/frock.jpg"],
        stock=10,
        is_active=True,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p
