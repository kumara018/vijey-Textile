"""
What /reset-password must do, and must not say.

Two rules, both learned from this endpoint doing the opposite:

  1. It gives ONE answer for a wrong code and for an account that does not
     exist. /forgot-password was rewritten to stop revealing which addresses are
     customers; this endpoint then answered the same question one step later,
     with "Account not found", and no code required.

  2. It signs every other device out. The usual reason for a reset is that
     somebody else might know the old password — a lost phone, a shared
     computer. Changing the lock while the old key still opens the door is not
     a reset. Sign-in tokens last 90 days, so waiting is not an answer either.
"""
import models


def _request_code(client, db, identifier):
    """Ask for a reset and read the code straight out of the store."""
    r = client.post("/api/auth/forgot-password", json={"identifier": identifier})
    assert r.status_code == 200, r.text
    row = (
        db.query(models.OTPStore)
        .filter(models.OTPStore.otp_type == "reset")
        .order_by(models.OTPStore.id.desc())
        .first()
    )
    assert row is not None, "no reset code was stored"
    return row.otp_code


class TestItRevealsNothingAboutWhoIsACustomer:
    def test_unknown_account_answers_exactly_like_a_wrong_code(self, client, db, make_user):
        user, _ = make_user(password="Customer@2026")
        code = _request_code(client, db, user.email)

        wrong_code = client.post("/api/auth/reset-password", json={
            "identifier": user.email,
            "otp_code": "000000" if code != "000000" else "111111",
            "new_password": "Brand@New2026",
            "confirm_password": "Brand@New2026",
        })
        no_account = client.post("/api/auth/reset-password", json={
            "identifier": "nobody-at-all@test.local",
            "otp_code": "123456",
            "new_password": "Brand@New2026",
            "confirm_password": "Brand@New2026",
        })

        assert wrong_code.status_code == no_account.status_code == 400, (
            f"wrong code {wrong_code.status_code}, unknown account "
            f"{no_account.status_code} — the pair is an enumeration oracle"
        )
        assert wrong_code.json()["detail"] == no_account.json()["detail"], (
            "the two refusals are worded differently, so one request still "
            "answers 'is this address a customer of yours'"
        )


class TestAResetSignsOtherDevicesOut:
    def test_every_live_session_is_revoked(self, client, db, make_user):
        user, headers = make_user(password="Customer@2026")

        live = db.query(models.UserSession).filter(
            models.UserSession.user_id == user.id,
            models.UserSession.revoked_at.is_(None),
        ).count()
        assert live >= 1, "fixture signed in, so there should be a session to revoke"

        code = _request_code(client, db, user.email)
        r = client.post("/api/auth/reset-password", json={
            "identifier": user.email,
            "otp_code": code,
            "new_password": "Brand@New2026",
            "confirm_password": "Brand@New2026",
        })
        assert r.status_code == 200, r.text
        assert r.json().get("signed_out_devices", 0) >= 1, r.json()

        db.expire_all()
        still_live = db.query(models.UserSession).filter(
            models.UserSession.user_id == user.id,
            models.UserSession.revoked_at.is_(None),
        ).count()
        assert still_live == 0, (
            f"{still_live} device(s) still signed in after a password reset — "
            "the old key still opens the door"
        )

        # And the token those devices hold is refused from the next request on.
        after = client.get("/api/auth/me", headers=headers)
        assert after.status_code in (401, 403), (
            f"a revoked session was still accepted: {after.status_code}"
        )

    def test_the_new_password_works_and_the_old_one_does_not(self, client, db, make_user):
        user, _ = make_user(password="Customer@2026")
        code = _request_code(client, db, user.email)
        assert client.post("/api/auth/reset-password", json={
            "identifier": user.email,
            "otp_code": code,
            "new_password": "Brand@New2026",
            "confirm_password": "Brand@New2026",
        }).status_code == 200

        db.query(models.RateLimitHit).delete()
        db.commit()
        assert client.post("/api/auth/login", json={
            "identifier": user.email, "password": "Brand@New2026",
        }).status_code == 200, "the new password does not work"

        db.query(models.RateLimitHit).delete()
        db.commit()
        assert client.post("/api/auth/login", json={
            "identifier": user.email, "password": "Customer@2026",
        }).status_code == 401, "the old password still works"
