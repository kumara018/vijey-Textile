"""
The sign-in budget, and what it is allowed to charge for.

Signing in used to share one five-an-hour-per-account ceiling with
forgot-password and send-login-otp. The owner met it the obvious way: reset the
password, then try the new one, and be refused for an hour with the CORRECT
password, because the reset requests had already spent the allowance.

Two rules now, and these tests are what keep them:
  1. Resetting a password does not consume the budget for signing in.
  2. Only a WRONG password is charged for. A successful sign-in costs nothing.
"""
import models
from rate_limit import LOGIN_SCOPE


def _clear_ip_budget(db):
    """Leave only the per-identifier ceiling standing."""
    db.query(models.RateLimitHit).filter(
        models.RateLimitHit.bucket.like("login|ip:%")
    ).delete(synchronize_session=False)
    db.commit()


def _login_rows(db, identifier):
    return db.query(models.RateLimitHit).filter(
        models.RateLimitHit.bucket == f"{LOGIN_SCOPE}|id:{identifier.lower()}"
    ).count()


class TestSigningInSuccessfullyCostsNothing:
    def test_a_correct_password_records_no_attempt(self, client, db, make_user):
        user, _ = make_user(password="Customer@2026")
        before = _login_rows(db, user.email)

        for _ in range(8):
            _clear_ip_budget(db)
            r = client.post("/api/auth/login",
                            json={"identifier": user.email, "password": "Customer@2026"})
            assert r.status_code == 200, r.text

        assert _login_rows(db, user.email) == before, (
            "a successful sign-in spent budget — the customer who never got it "
            "wrong is not the one this ceiling exists for"
        )

    def test_a_wrong_password_is_charged_for(self, client, db, make_user):
        user, _ = make_user(password="Customer@2026")
        before = _login_rows(db, user.email)

        _clear_ip_budget(db)
        r = client.post("/api/auth/login",
                        json={"identifier": user.email, "password": "Wrong@2026"})
        assert r.status_code == 401

        assert _login_rows(db, user.email) == before + 1, (
            "a wrong password recorded nothing — the ceiling would never fire"
        )


class TestResettingAPasswordDoesNotBlockSigningIn:
    def test_the_two_budgets_are_separate_buckets(self, client, db, make_user):
        """
        Six reset requests — over the old shared five-an-hour ceiling — and then
        the right password. That sequence used to end in 429.
        """
        user, _ = make_user(password="Customer@2026")

        for _ in range(6):
            # Clear only the per-address send budget, so the per-identifier one
            # is what is being exercised.
            db.query(models.RateLimitHit).filter(
                models.RateLimitHit.bucket.like("forgot-password|ip:%")
            ).delete(synchronize_session=False)
            db.commit()
            client.post("/api/auth/forgot-password", json={"identifier": user.email})

        _clear_ip_budget(db)
        r = client.post("/api/auth/login",
                        json={"identifier": user.email, "password": "Customer@2026"})
        assert r.status_code == 200, (
            "resetting a password locked the account out of signing in with it: "
            f"{r.status_code} {r.text}"
        )


class TestTheCeilingStillFires:
    def test_forty_wrong_passwords_an_hour_is_the_limit(self, client, db, make_user):
        user, _ = make_user(password="Customer@2026")
        codes = []
        for _ in range(12):
            _clear_ip_budget(db)
            r = client.post("/api/auth/login",
                            json={"identifier": user.email, "password": "Wrong@2026"})
            codes.append(r.status_code)

        assert 429 in codes, (
            f"guessing was never throttled per account: {codes} — an attacker "
            "rotating addresses would be unlimited"
        )
        assert codes.index(429) == 10, (
            f"budget is 10/minute per account, first 429 was attempt {codes.index(429) + 1}"
        )

    def test_the_refusal_says_how_long_to_wait(self, client, db, make_user):
        user, _ = make_user(password="Customer@2026")
        last = None
        for _ in range(12):
            _clear_ip_budget(db)
            last = client.post("/api/auth/login",
                               json={"identifier": user.email, "password": "Wrong@2026"})
        assert last.status_code == 429
        detail = last.json()["detail"]
        assert "try again in about" in detail.lower(), detail
        assert "retry-after" in {k.lower() for k in last.headers}, "429 without Retry-After"
