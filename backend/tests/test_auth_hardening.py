"""
Regression pack for the account-security defects found in the October 2026
test pass. Each test fails on the code as it was and passes on the fix.

  AUTH-01  wrong one-time codes are capped per account, not just per address
  AUTH-02  a signed-in device cannot silently change the account's phone number
  AUTH-03  the account-deletion code is never returned in the API reply
  AUTH-04  every spelling of a phone number shares one rate-limit budget
  AUTH-05  the password-only /api/auth/login is off unless explicitly enabled
  AUTH-06  lookup, forgot-password and sign-in no longer share one budget
  AUTH-08  code-checking endpoints do not answer "Account not found"
  AUTH-14  pausing an account signs every device out
"""
import pytest

import models

BAD_CODE = "Invalid or expired OTP. Please request a new one."


def _clear_ip(db, *scopes):
    """Leave only the per-account budgets standing, so they are what is tested."""
    for scope in scopes:
        db.query(models.RateLimitHit).filter(
            models.RateLimitHit.bucket.like(f"{scope}|ip:%")
        ).delete(synchronize_session=False)
    db.commit()


def _code(db, email, kind):
    row = (db.query(models.OTPStore)
           .filter(models.OTPStore.identifier == email, models.OTPStore.otp_type == kind)
           .order_by(models.OTPStore.id.desc()).first())
    assert row is not None, f"no {kind} code was issued"
    return row.otp_code


class TestAuth04PhoneSpellingsShareABudget:
    def test_six_spellings_of_one_number_hit_one_ceiling(self, client, db, make_user):
        user, _ = make_user(phone="9876511111")
        spellings = ["9876511111", "+919876511111", "09876511111", "919876511111",
                     "98765 11111", "+91 98765-11111"]
        codes = []
        for s in spellings:
            _clear_ip(db, "forgot-password")
            codes.append(client.post("/api/auth/forgot-password", json={"identifier": s}).status_code)
        assert codes[:5] == [200] * 5, codes
        assert codes[5] == 429, (
            f"the sixth spelling got a fresh budget: {codes} — every spelling of a "
            "number must count against the same account"
        )


class TestAuth06TheCustomersOwnSignInIsNeverLockedOutByAReset:
    def test_lookup_resets_and_lookup_again_still_let_the_right_password_in(self, client, db, make_user):
        """The exact sequence the owner hit: look up, reset, reset, then sign in."""
        user, _ = make_user(password="Customer@2026")
        for _ in range(3):
            _clear_ip(db, "auth-lookup")
            client.post("/api/auth/lookup", json={"identifier": user.email})
        for _ in range(5):
            _clear_ip(db, "forgot-password")
            client.post("/api/auth/forgot-password", json={"identifier": user.email})
        _clear_ip(db, "send-login-otp")
        r = client.post("/api/auth/send-login-otp",
                        json={"identifier": user.email, "password": "Customer@2026"})
        assert r.status_code == 200, (
            f"the right password was refused after a reset: {r.status_code} {r.text[:160]}"
        )

    def test_wrong_passwords_at_send_login_otp_are_still_capped(self, client, db, make_user):
        user, _ = make_user(password="Customer@2026")
        codes = []
        for _ in range(12):
            _clear_ip(db, "send-login-otp")
            codes.append(client.post("/api/auth/send-login-otp",
                                     json={"identifier": user.email, "password": "Wrong@2026"}).status_code)
        assert 429 in codes, f"password guessing was never throttled: {codes}"


class TestAuth01WrongCodesAreCappedPerAccount:
    def test_eleven_wrong_sign_in_codes_are_refused_whatever_the_address(self, client, db, make_user):
        user, _ = make_user()
        codes = []
        for i in range(12):
            _clear_ip(db, "verify-login-otp")
            codes.append(client.post("/api/auth/verify-login-otp",
                                     json={"identifier": user.email, "otp_code": f"{100000 + i}"}).status_code)
        assert codes[:10] == [400] * 10, codes
        assert codes[10] == 429, f"code guessing was never throttled per account: {codes}"

    def test_reset_codes_are_capped_too(self, client, db, make_user):
        user, _ = make_user()
        codes = []
        for i in range(12):
            _clear_ip(db, "reset-password")
            codes.append(client.post("/api/auth/reset-password", json={
                "identifier": user.email, "otp_code": f"{200000 + i}",
                "new_password": "Brand@New2026", "confirm_password": "Brand@New2026",
            }).status_code)
        assert 429 in codes, f"reset-code guessing was never throttled: {codes}"


class TestAuth08NoAccountNotFound:
    @pytest.mark.parametrize("path", ["/api/auth/verify-login-otp", "/api/auth/verify-register-otp"])
    def test_an_unknown_account_gets_the_wrong_code_answer(self, client, db, path):
        _clear_ip(db, "verify-login-otp", "verify-register-otp")
        r = client.post(path, json={"identifier": "nobody.here.qa@gmail.com", "otp_code": "123456"})
        assert r.status_code == 400, r.text
        assert r.json()["detail"] == BAD_CODE, r.json()


class TestAuth03DeletionCodeStaysSecret:
    def test_request_delete_account_never_returns_the_code(self, client, make_user):
        _, headers = make_user()
        r = client.post("/api/auth/request-delete-account", headers=headers)
        assert r.status_code == 200, r.text
        assert "dev_otp" not in r.json(), (
            "the deletion code came back in the reply — anyone holding the device "
            "could delete the account without the owner's email or phone"
        )


class TestAuth05PasswordOnlySignInIsOff:
    def test_login_is_not_found_unless_enabled(self, client, make_user, monkeypatch):
        user, _ = make_user(password="Customer@2026")
        monkeypatch.delenv("ALLOW_PASSWORD_ONLY_LOGIN", raising=False)
        r = client.post("/api/auth/login", json={"identifier": user.email, "password": "Customer@2026"})
        assert r.status_code == 404, (
            f"a full token was issued for a password alone: {r.status_code}"
        )


class TestAuth02PhoneCannotBeSwappedSilently:
    def test_a_different_number_is_refused(self, client, make_user):
        user, headers = make_user(phone="9876522222")
        r = client.put("/api/auth/me", headers=headers, json={"phone": "9123456789"})
        assert r.status_code == 400, r.text

    def test_the_same_number_in_another_spelling_and_a_name_change_are_fine(self, client, make_user):
        user, headers = make_user(phone="9876533333")
        r = client.put("/api/auth/me", headers=headers,
                       json={"phone": "+91 98765 33333", "full_name": "Renamed Customer"})
        assert r.status_code == 200, r.text
        assert r.json()["full_name"] == "Renamed Customer"


class TestAuth14PausingSignsDevicesOut:
    def test_confirmed_deactivation_revokes_the_session(self, client, db, make_user):
        user, headers = make_user()
        assert client.post("/api/auth/request-deactivate-account", headers=headers).status_code == 200
        code = _code(db, user.email, "deactivate")
        r = client.post("/api/auth/confirm-deactivate-account", headers=headers, json={"otp_code": code})
        assert r.status_code == 200, r.text
        after = client.get("/api/auth/me", headers=headers)
        assert after.status_code in (401, 403), (
            f"a paused account's device was still signed in: {after.status_code}"
        )
