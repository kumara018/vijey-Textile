"""
Who emails come from, and what happens when the email service says no.

Identical in both shops.

WHY THIS FILE EXISTS. Every failure path in notifications._send_email called
`type(e, host)` or `type(e, "brevo")` — which is not valid Python: `type()`
takes one argument or three, never two — and passed the literal "brevo" where
Brevo's response body belonged. So the moment Brevo refused an email, the
error handler itself raised TypeError. The refusal was never logged, never
reached the admin's health page, and the calling thread died with a traceback
that named the wrong problem. An email failure was the one thing the shop
could not see.

It mattered more once the From address moved off admin@: a sender Brevo does
not accept would stop every email, sign-in codes included, and nothing would
have said so.
"""
import io
import urllib.error

import pytest


class _Resp:
    status = 201

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def _refusal(body: str, code: int = 400):
    return urllib.error.HTTPError(
        "https://api.brevo.com/v3/smtp/email", code, "Bad Request", {}, io.BytesIO(body.encode())
    )


@pytest.fixture()
def brevo(monkeypatch):
    """Route _send_email through a fake Brevo that records what it was asked."""
    import notifications
    monkeypatch.setenv("BREVO_API_KEY", "test-key")
    calls, remembered = [], []
    monkeypatch.setattr(notifications, "_remember_email",
                        lambda ok, detail, host: remembered.append((ok, detail, host)))
    return notifications, calls, remembered


def _sender_of(request) -> str:
    import json
    return json.loads(request.data)["sender"]["email"]


class TestARefusalIsReportedNotSwallowed:

    def test_a_brevo_refusal_returns_false_and_is_recorded(self, brevo, monkeypatch):
        notifications, calls, remembered = brevo

        def refuse(req, timeout=None):
            calls.append(_sender_of(req))
            raise _refusal('{"code":"unauthorized","message":"Key not found"}', 401)

        monkeypatch.setattr("urllib.request.urlopen", refuse)
        assert notifications._send_email("a@b.test", "Subject", "<p>x</p>") is False
        assert remembered and remembered[-1][0] is False, "the failure never reached the health page"
        assert remembered[-1][1] == "API key rejected", "Brevo's own reason was thrown away"

    def test_a_network_error_returns_false_and_is_recorded(self, brevo, monkeypatch):
        notifications, calls, remembered = brevo

        def boom(req, timeout=None):
            raise TimeoutError("timed out")

        monkeypatch.setattr("urllib.request.urlopen", boom)
        assert notifications._send_email("a@b.test", "Subject", "<p>x</p>") is False
        assert remembered[-1] == (False, "TimeoutError", "brevo")


class TestTheSender:

    def test_the_configured_sender_is_used_and_replies_go_to_support(self, brevo, monkeypatch):
        import json
        notifications, calls, remembered = brevo
        monkeypatch.setattr(notifications, "SMTP_EMAIL", "noreply@shop.test")
        seen = {}

        def ok(req, timeout=None):
            seen.update(json.loads(req.data))
            return _Resp()

        monkeypatch.setattr("urllib.request.urlopen", ok)
        assert notifications._send_email("a@b.test", "Subject", "<p>x</p>") is True
        assert seen["sender"]["email"] == "noreply@shop.test"
        assert seen["replyTo"]["email"] == notifications.SUPPORT_EMAIL
        assert remembered[-1] == (True, None, "brevo")

    def test_a_refused_sender_falls_back_once_and_says_so(self, brevo, monkeypatch):
        """
        The safety net for the move off admin@: if Brevo will not send as the
        new address, the email still goes — from the old one — and the health
        page says exactly that, instead of sign-in codes silently stopping.
        """
        notifications, calls, remembered = brevo
        monkeypatch.setattr(notifications, "SMTP_EMAIL", "noreply@shop.test")
        monkeypatch.setenv("SMTP_EMAIL_FALLBACK", "admin@shop.test")

        def picky(req, timeout=None):
            sender = _sender_of(req)
            calls.append(sender)
            if sender == "noreply@shop.test":
                raise _refusal('{"code":"invalid_parameter","message":"sender is not valid"}')
            return _Resp()

        monkeypatch.setattr("urllib.request.urlopen", picky)
        assert notifications._send_email("a@b.test", "Subject", "<p>x</p>") is True
        assert calls == ["noreply@shop.test", "admin@shop.test"]
        ok, detail, host = remembered[-1]
        assert ok is True and "admin@shop.test" in detail and "noreply@shop.test" in detail

    def test_no_fallback_for_a_refusal_that_is_not_about_the_sender(self, brevo, monkeypatch):
        """A bad API key would fail from any address; retrying only doubles the noise."""
        notifications, calls, remembered = brevo
        monkeypatch.setattr(notifications, "SMTP_EMAIL", "noreply@shop.test")
        monkeypatch.setenv("SMTP_EMAIL_FALLBACK", "admin@shop.test")

        def refuse(req, timeout=None):
            calls.append(_sender_of(req))
            raise _refusal('{"message":"Key not found"}', 401)

        monkeypatch.setattr("urllib.request.urlopen", refuse)
        assert notifications._send_email("a@b.test", "Subject", "<p>x</p>") is False
        assert calls == ["noreply@shop.test"]

    def test_no_fallback_configured_means_one_attempt(self, brevo, monkeypatch):
        notifications, calls, remembered = brevo
        monkeypatch.setattr(notifications, "SMTP_EMAIL", "noreply@shop.test")
        monkeypatch.delenv("SMTP_EMAIL_FALLBACK", raising=False)

        def refuse(req, timeout=None):
            calls.append(_sender_of(req))
            raise _refusal('{"message":"sender is not valid"}')

        monkeypatch.setattr("urllib.request.urlopen", refuse)
        assert notifications._send_email("a@b.test", "Subject", "<p>x</p>") is False
        assert calls == ["noreply@shop.test"]
        assert remembered[-1] == (False, "sender address not authorised in Brevo", "brevo")
