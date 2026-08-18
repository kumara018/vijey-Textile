"""
Authentication: the properties AUTH-SPEC.md asks for, asserted rather than
described.

Every test here corresponds to a remediation in that document. The point is not
coverage for its own sake — it is that the security properties stop being true
by accident. R2 and R3 in particular are one careless `if` away from regressing,
and neither would show up in any other test: the endpoint keeps working
perfectly while quietly answering a question it must not answer.
"""
import sqlite3
import time

import pytest


def test_login_rejects_wrong_password(client, make_user):
    user, _ = make_user()
    r = client.post("/api/auth/login", json={"identifier": user.email, "password": "not-the-password"})
    assert r.status_code in (400, 401), r.text


def test_login_succeeds_and_returns_a_usable_token(client, make_user):
    user, headers = make_user()
    r = client.get("/api/auth/me", headers=headers)
    assert r.status_code == 200
    assert r.json()["email"] == user.email


class TestR2ForgotPasswordDoesNotRevealExistence:
    """
    AUTH-SPEC R2. One identical reply whether or not the account exists.

    This was a live leak: a missing account got a different message from a real
    one, directly under a comment saying "Don't reveal if user exists".
    """

    def test_identical_response_for_real_and_missing_account(self, client, make_user):
        user, _ = make_user()
        real = client.post("/api/auth/forgot-password", json={"identifier": user.email})
        missing = client.post("/api/auth/forgot-password", json={"identifier": "nobody@test.local"})
        assert real.status_code == missing.status_code == 200
        assert real.json() == missing.json(), (
            "forgot-password answers differently for an account that exists — "
            "that is the enumeration oracle R2 removed"
        )


class TestR3TimingOracle:
    """
    AUTH-SPEC R3. A missing account must not answer measurably faster.

    The original code short-circuited before bcrypt when no user was found,
    which made absence roughly a thousand times cheaper than presence — the
    real oracle, independent of any wording.
    """

    def test_absent_account_is_not_dramatically_faster(self, client, make_user, db):
        """
        The rate limiter has to be cleared between samples or this measures the
        wrong thing.

        First run of this test reported absent=4.4ms against present=337.7ms and
        looked exactly like the bug it was written to catch. It was not: the
        budget is five per minute, the five "present" samples spent it, and
        every "absent" call was answered with a 429 before it reached any auth
        code at all. A 429 is identical on both paths, so there is no oracle —
        but a timing test that measures the limiter proves nothing about the
        hash, and would have gone on passing after a real regression.
        """
        import models
        user, _ = make_user()

        def timed(identifier):
            samples = []
            for _ in range(5):
                db.query(models.RateLimitHit).delete()
                db.commit()
                t0 = time.perf_counter()
                r = client.post("/api/auth/send-login-otp",
                                json={"identifier": identifier, "password": "whatever-wrong"})
                assert r.status_code != 429, "rate limited mid-measurement"
                samples.append(time.perf_counter() - t0)
            return sorted(samples)[len(samples) // 2]

        present = timed(user.email)
        absent = timed("definitely-not-here@test.local")

        # bcrypt dominates both paths when the fix is in place. A ratio near 1
        # is the property; the bar is deliberately loose because a laptop under
        # load is noisy, and anything approaching the pre-fix gap (~1000x) sails
        # past it.
        assert absent > present / 5, (
            f"absent={absent*1000:.1f}ms vs present={present*1000:.1f}ms — "
            "the missing-account path is short-circuiting bcrypt again"
        )


class TestR1RateLimiting:
    """AUTH-SPEC R1, and the durability the in-memory version never had."""

    def test_per_ip_budget_returns_429_with_retry_after(self, client):
        codes = []
        for i in range(8):
            r = client.post("/api/auth/forgot-password",
                            json={"identifier": f"probe{i}@test.local"})
            codes.append(r.status_code)
        assert 429 in codes, f"no rate limit fired across eight attempts: {codes}"
        first_429 = codes.index(429)
        assert first_429 == 5, f"budget is 5/minute, first 429 was attempt {first_429 + 1}"

        r = client.post("/api/auth/forgot-password", json={"identifier": "probe99@test.local"})
        assert r.status_code == 429
        assert "retry-after" in {k.lower() for k in r.headers}, "429 without Retry-After"

    def test_per_identifier_budget_is_independent_of_the_address(self, client, db):
        import models
        # Same identifier, and the per-IP counter cleared between attempts, so
        # only the per-identifier ceiling can stop it.
        seen = []
        for _ in range(7):
            db.query(models.RateLimitHit).filter(
                models.RateLimitHit.bucket.like("forgot-password|%")
            ).delete(synchronize_session=False)
            db.commit()
            r = client.post("/api/auth/forgot-password", json={"identifier": "walked@test.local"})
            seen.append(r.status_code)
        assert 429 in seen, (
            f"per-identifier ceiling never fired: {seen} — an attacker rotating "
            "addresses would be unlimited"
        )

    def test_counters_survive_a_restart(self, client, db):
        """
        The whole reason the limiter moved into the database.

        Render sleeps this instance when the shop is quiet and starts a fresh
        process on the next request. An in-process counter reset every time, so
        the budget was per-visit rather than per-hour. The rows are the proof:
        they are still there for a new process to read.
        """
        import models
        for i in range(3):
            client.post("/api/auth/forgot-password", json={"identifier": f"durable{i}@test.local"})
        rows = db.query(models.RateLimitHit).count()
        assert rows >= 3, "attempts were not recorded anywhere a new process could find them"


class TestR6ProgressiveSignIn:
    """AUTH-SPEC R6, Option B — the blind branch."""

    def test_begin_answers_identically_for_existing_and_new(self, client, make_user):
        # Identical SHAPE so any difference in the reply is behaviour, not input.
        # Same first two characters and same domain, so both mask to
        # "aa***@test.local". Anything that still differs is the endpoint
        # behaving differently, which is the whole thing being tested. The
        # first version used aaaaa/bbbbb and failed on the hint — correctly,
        # because the hint is derived from the input and the inputs differed.
        user, _ = make_user(email="aaaaa@test.local", phone="9000009991")
        real = client.post("/api/auth/begin", json={"identifier": "aaaaa@test.local"})
        fake = client.post("/api/auth/begin", json={"identifier": "aabbb@test.local"})
        assert real.status_code == fake.status_code == 200, (real.text, fake.text)
        assert real.json() == fake.json(), (
            "/auth/begin distinguishes an existing account from a new one — "
            "the endpoint exists precisely so it cannot"
        )

    def test_continue_branches_only_after_the_code_is_right(self, client, make_user, db):
        import models
        user, _ = make_user(email="branch@test.local", phone="9000009992")

        client.post("/api/auth/begin", json={"identifier": "branch@test.local"})
        otp = (db.query(models.OTPStore)
                 .filter(models.OTPStore.identifier == "branch@test.local",
                         models.OTPStore.otp_type == "begin")
                 .order_by(models.OTPStore.id.desc()).first())
        assert otp is not None, "/auth/begin did not create a code"

        r = client.post("/api/auth/continue",
                        json={"identifier": "branch@test.local", "otp": otp.otp_code})
        assert r.status_code == 200, r.text
        assert r.json()["next"] == "password"
        assert r.json()["registration_token"] is None

    def test_wrong_code_is_the_same_401_either_way(self, client, make_user):
        make_user(email="known@test.local", phone="9000009993")
        client.post("/api/auth/begin", json={"identifier": "known@test.local"})
        client.post("/api/auth/begin", json={"identifier": "unknown@test.local"})
        a = client.post("/api/auth/continue", json={"identifier": "known@test.local", "otp": "000000"})
        b = client.post("/api/auth/continue", json={"identifier": "unknown@test.local", "otp": "000000"})
        assert a.status_code == b.status_code == 401
        assert a.json() == b.json(), "a wrong code reveals whether the account exists"


class TestR5RevokeAll:
    """AUTH-SPEC R5. One transaction, and the caller's own choice honoured."""

    def _sign_in(self, client, user, ua):
        r = client.post("/api/auth/login",
                        json={"identifier": user.email, "password": "Customer@2026"},
                        headers={"User-Agent": ua})
        assert r.status_code == 200, r.text
        return {"Authorization": f"Bearer {r.json()['access_token']}", "User-Agent": ua}

    UAS = [
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Mobile/15E148",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/17.0",
    ]

    def test_revokes_every_other_device_and_keeps_this_one(self, client, make_user, db):
        import models
        user, _ = make_user(email="devices@test.local", phone="9000009994")
        headers = [self._sign_in(client, user, ua) for ua in self.UAS]

        me = headers[-1]
        before = client.get("/api/auth/sessions", headers=me)
        assert before.status_code == 200
        assert len(before.json()) >= 2, "the test needs more than one device to be meaningful"

        r = client.post("/api/auth/sessions/revoke-all", json={"except_current": True}, headers=me)
        assert r.status_code == 200, r.text
        assert r.json()["revoked"] >= 1
        assert r.json()["current_session_kept"] is True

        after = client.get("/api/auth/sessions", headers=me)
        assert after.status_code == 200, "the caller was signed out despite except_current"
        assert len(after.json()) == 1

        for old in headers[:-1]:
            assert client.get("/api/auth/sessions", headers=old).status_code == 401, (
                "a revoked device can still use its token"
            )

    def test_except_current_false_signs_the_caller_out_too(self, client, make_user):
        user, _ = make_user(email="devices2@test.local", phone="9000009995")
        me = self._sign_in(client, user, self.UAS[0])
        r = client.post("/api/auth/sessions/revoke-all", json={"except_current": False}, headers=me)
        assert r.status_code == 200, r.text
        assert r.json()["current_session_kept"] is False
        assert client.get("/api/auth/sessions", headers=me).status_code == 401
