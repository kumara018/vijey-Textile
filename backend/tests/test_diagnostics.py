"""
The diagnostics page must answer the question and never leak the answer's key.

WHY THIS FILE EXISTS. `/api/diagnostics/integrations` exists because every
third party in this application fails softly: an unconfigured SMS gateway
prints to a log and returns as though it sent, an unconfigured courier answers
`checked: false`, an unconfigured mailer walks its fallback chain and gives up.
That is right for customers and it means the shop can be half-dead and look
perfectly normal. The endpoint reports what is actually switched on.

It is therefore a page that reads every credential in the process. Two
properties have to hold, and neither is obvious enough to leave to care:

  IT IS ADMIN-ONLY. Which integrations a shop runs is reconnaissance — knowing
  the courier is off tells you which failure to provoke.

  IT NEVER RETURNS A CREDENTIAL. Not a value, not a masked tail, not a length.
  The temptation to show "…ends in 4f2a" so somebody can tell two keys apart is
  exactly how secrets end up in a screenshot in a support thread. The test
  below plants distinctive values in the environment and asserts that not one
  byte of any of them appears anywhere in the response.
"""

import os

import pytest


SECRETS = {
    "RAZORPAY_KEY_SECRET":  "rzpsecret-CANARY-8f31d2",
    "BREVO_API_KEY":        "xkeysib-CANARY-5b7c19",
    "SENDGRID_API_KEY":     "SG.CANARY-2a9e44",
    "SMTP_PASSWORD":        "smtppass-CANARY-77c1",
    "TWILIO_AUTH_TOKEN":    "twiliotok-CANARY-3d0b",
    "TWILIO_ACCOUNT_SID":   "ACCANARY000111222333",
    "DELHIVERY_API_TOKEN":  "dlv-CANARY-9911ab",
    "CLOUDINARY_API_SECRET": "cld-CANARY-4417",
    "SECRET_KEY":           "jwt-CANARY-abcdef",
    "ADMIN_PASSWORD":       "adminpw-CANARY-0099",
}


@pytest.fixture()
def planted_env():
    """Distinctive values in every credential, restored afterwards."""
    before = {k: os.environ.get(k) for k in SECRETS}
    os.environ.update(SECRETS)
    os.environ["RAZORPAY_KEY_ID"] = "rzp_test_CANARYKEYID"
    try:
        yield
    finally:
        for k, v in before.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v


class TestDiagnosticsIsAdminOnly:
    def test_an_anonymous_caller_is_refused(self, client):
        res = client.get("/api/diagnostics/integrations")
        assert res.status_code in (401, 403), res.text

    def test_a_signed_in_customer_is_refused(self, client, db):
        """
        A real, fully valid customer session — not merely a missing token.

        The account is created directly and the token minted directly, rather
        than driven through register-and-sign-in. That flow needs an OTP this
        test cannot read, and skipping the case when the flow does not
        cooperate would leave the property untested precisely where it matters:
        the difference between "no token" and "a perfectly good token belonging
        to somebody who is not an admin" is the whole of the authorisation
        check. Which integrations are switched off is reconnaissance, and every
        customer has an account.
        """
        import auth as auth_utils
        import models

        existing = db.query(models.User).filter(
            models.User.email == "diag.customer@example.com").first()
        if existing:
            user = existing
            user.is_admin = False
        else:
            user = models.User(
                full_name="Diag Customer",
                email="diag.customer@example.com",
                phone="9000000771",
                password_hash=auth_utils.hash_password("Sufficient1!"),
                is_admin=False,
            )
            db.add(user)
        db.commit()
        db.refresh(user)
        assert user.is_admin is False, "the fixture itself must not be an admin"

        token = auth_utils.create_access_token({"sub": user.id})
        res = client.get("/api/diagnostics/integrations",
                         headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 403, res.text


class TestDiagnosticsNeverLeaksASecret:
    def test_no_planted_credential_appears_in_the_response(self, planted_env):
        """
        Calls the check functions directly rather than over HTTP, so the
        assertion holds regardless of how admin auth is arranged — the property
        being pinned is about what the code BUILDS, not who may read it.
        """
        import importlib
        import routers.diagnostics as d
        importlib.reload(d)

        import json
        body = json.dumps({
            "payments":  d._check_razorpay(),
            "email":     d._check_email(),
            "courier":   d._check_courier(),
            "messaging": d._check_messaging(),
            "media":     d._check_media(),
            "security":  d._check_security(),
        })

        leaked = [name for name, value in SECRETS.items() if value in body]
        assert not leaked, f"credential values present in the response: {leaked}"

        # Not even a fragment. A tail long enough to be useful for telling two
        # keys apart is a tail long enough to matter if it is screenshotted.
        fragments = [name for name, value in SECRETS.items() if value[-6:] in body]
        assert not fragments, f"credential fragments present: {fragments}"

    def test_the_razorpay_key_id_prefix_is_reported_but_not_the_id(self, planted_env):
        """
        Test-versus-live is the single most valuable fact on this page before a
        launch, and the key id is public — it is handed to every customer's
        browser. Reporting the MODE is right; echoing the id is not.
        """
        import importlib
        import routers.diagnostics as d
        importlib.reload(d)

        out = d._check_razorpay()
        assert out["configured"] is True
        assert out["mode"] == "test"
        assert "CANARYKEYID" not in str(out)


class TestDiagnosticsReportsRealState:
    def test_an_absent_integration_reads_as_off(self, planted_env):
        import importlib
        import routers.diagnostics as d

        os.environ.pop("DELHIVERY_API_TOKEN", None)
        importlib.reload(d)
        assert d._check_courier()["configured"] is False

    def test_half_configured_messaging_is_not_reported_as_working(self, planted_env):
        """
        The state that actually occurs: a Twilio account with a WhatsApp sender
        and no SMS number. A single 'messaging: ok' would hide it until an OTP
        failed to arrive for somebody without WhatsApp.
        """
        import importlib
        import routers.diagnostics as d

        os.environ["TWILIO_WHATSAPP_FROM"] = "whatsapp:+14155238886"
        os.environ.pop("TWILIO_PHONE", None)
        importlib.reload(d)

        out = d._check_messaging()
        assert out["configured"] is True      # the account is there
        assert out["whatsapp"] is True
        assert out["sms"] is False            # and this must be visible
