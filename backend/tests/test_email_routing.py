"""
Where SMTP connects, and what happens when it cannot be known.

WHY THIS FILE EXISTS. The host was hardcoded to `smtp.gmail.com` in two
different places while the shop's mailbox is on Hostinger. Every send was
therefore Gmail being handed a Hostinger address and password; Gmail refused
the login, the exception was caught and printed, and the API returned as though
a code had been sent. The sign-in screen said "We sent a six-digit code" — which
was false — and the owner was locked out of their own admin with nothing
anywhere explaining why.

The failure was not that a guess was wrong. It was that a guess was made at all
and then hidden. These tests pin both halves of the fix: the host is resolved
from configuration, and an unknowable host is refused loudly instead of being
guessed.
"""

import os

import pytest

import notifications


@pytest.fixture()
def smtp_env():
    """Restore SMTP_EMAIL and the host/port overrides after each case."""
    before_addr = notifications.SMTP_EMAIL
    before = {k: os.environ.get(k) for k in ("SMTP_HOST", "SMTP_PORT")}
    try:
        yield
    finally:
        notifications.SMTP_EMAIL = before_addr
        for k, v in before.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v


def _target(address, host=None, port=None):
    notifications.SMTP_EMAIL = address
    for key, value in (("SMTP_HOST", host), ("SMTP_PORT", port)):
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value
    return notifications._smtp_target()


class TestTheHostComesFromConfiguration:
    def test_an_explicit_host_and_port_are_used_exactly(self, smtp_env):
        assert _target("admin@vijeytextile.com", "smtp.hostinger.com", "587") == \
            ("smtp.hostinger.com", 587, False)

    def test_port_465_selects_implicit_tls(self, smtp_env):
        """
        465 and 587 are different protocols, not different numbers: 465 is TLS
        from the first byte, 587 is plaintext upgraded by STARTTLS. Using the
        wrong call against the right port hangs rather than failing cleanly.
        """
        assert _target("admin@vijeytextile.com", "smtp.hostinger.com", "465") == \
            ("smtp.hostinger.com", 465, True)

    def test_an_explicit_host_beats_an_inferrable_address(self, smtp_env):
        """A gmail.com address routed through a relay must still use the relay."""
        assert _target("shop@gmail.com", "smtp.sendgrid.net", "587")[0] == "smtp.sendgrid.net"

    def test_a_nonsense_port_falls_back_rather_than_crashing(self, smtp_env):
        assert _target("admin@vijeytextile.com", "smtp.hostinger.com", "not-a-number") == \
            ("smtp.hostinger.com", 587, False)


class TestConsumerMailboxesAreInferred:
    """
    Somebody using a gmail.com address plainly means smtp.gmail.com, and making
    them state it would be pedantry. The inference is only safe because the
    domain itself names the provider.
    """

    @pytest.mark.parametrize("address,expected", [
        ("shop@gmail.com",       "smtp.gmail.com"),
        ("shop@googlemail.com",  "smtp.gmail.com"),
        ("shop@outlook.com",     "smtp.office365.com"),
        ("shop@hotmail.com",     "smtp.office365.com"),
        ("shop@yahoo.com",       "smtp.mail.yahoo.com"),
        ("shop@zoho.com",        "smtp.zoho.com"),
    ])
    def test_known_providers_resolve(self, smtp_env, address, expected):
        assert _target(address)[0] == expected

    def test_the_domain_is_matched_case_insensitively(self, smtp_env):
        assert _target("Shop@GMAIL.com")[0] == "smtp.gmail.com"


class TestACustomDomainIsRefusedNotGuessed:
    """
    THE BUG, PINNED. A custom domain's mail can live anywhere — Hostinger,
    Google Workspace, Zoho, a relay — and there is no honest guess. Silently
    trying Gmail is what produced "we sent you a code" while sending nothing.
    """

    def test_a_custom_domain_with_no_host_resolves_to_nothing(self, smtp_env):
        assert _target("admin@vijeytextile.com") is None

    def test_it_does_not_fall_back_to_gmail(self, smtp_env):
        """The specific regression: anything Gmail-shaped here is the old bug."""
        result = _target("admin@ammalutex.com")
        assert result is None, f"a custom domain must not resolve, got {result}"

    def test_an_address_with_no_domain_resolves_to_nothing(self, smtp_env):
        assert _target("not-an-address") is None


class TestFailuresAreRecordedNotSwallowed:
    """
    The send itself is allowed to fail — a mail server being down is not this
    application's problem to solve. What is unacceptable is failing invisibly,
    which is why the outcome is recorded for the System Health page to read.
    """

    def test_an_unknowable_host_is_recorded_as_a_failure(self, smtp_env):
        notifications.SMTP_EMAIL = "admin@vijeytextile.com"
        notifications.SMTP_PASS = "irrelevant"
        os.environ.pop("SMTP_HOST", None)

        from email.mime.text import MIMEText
        sent = notifications._smtp_send("someone@example.com", "Test", MIMEText("hi"))

        assert sent is False
        assert notifications.LAST_EMAIL["attempted"] is True
        assert notifications.LAST_EMAIL["ok"] is False
        assert "SMTP_HOST" in (notifications.LAST_EMAIL["detail"] or "")

    def test_the_recorded_outcome_carries_no_password(self, smtp_env):
        """
        System Health reads this dict. It may name a host and an error class;
        it may never carry the credential that failed.
        """
        notifications.SMTP_EMAIL = "admin@vijeytextile.com"
        notifications.SMTP_PASS = "hunter2-CANARY"
        os.environ.pop("SMTP_HOST", None)

        from email.mime.text import MIMEText
        notifications._smtp_send("someone@example.com", "Test", MIMEText("hi"))

        assert "hunter2-CANARY" not in str(notifications.LAST_EMAIL)


class TestRenderBlocksSMTPAndSaysSo:
    """
    Render blocks outbound SMTP on 25, 465 and 587. A perfectly correct SMTP
    configuration therefore cannot connect there, and the failure looks
    identical to a wrong password — which is how an afternoon gets spent
    re-checking a mailbox credential that was never the problem.
    """

    def test_smtp_is_refused_with_an_explanation_on_render(self, smtp_env, monkeypatch):
        monkeypatch.setenv("RENDER", "true")
        notifications.SMTP_EMAIL = "admin@vijeytextile.com"
        notifications.SMTP_PASS = "irrelevant"
        monkeypatch.setenv("SMTP_HOST", "smtp.hostinger.com")

        from email.mime.text import MIMEText
        assert notifications._smtp_send("x@example.com", "Test", MIMEText("hi")) is False
        assert "Render" in (notifications.LAST_EMAIL["detail"] or "")

    def test_off_render_a_valid_configuration_is_attempted(self, smtp_env, monkeypatch):
        """The guard must be about Render, not about SMTP being disliked."""
        monkeypatch.delenv("RENDER", raising=False)
        notifications.SMTP_EMAIL = "admin@vijeytextile.com"
        monkeypatch.setenv("SMTP_HOST", "smtp.hostinger.com")
        assert notifications._smtp_target() == ("smtp.hostinger.com", 587, False)


class TestALoginCodeIsNeverLostWithTheEmail:
    """
    Losing an order confirmation is an annoyance. Losing the code that is the
    only way into an account locks somebody out of their own shop with no route
    back — which is what happened. The code has to survive the send failing.
    """

    def test_the_code_reaches_the_log_when_the_send_fails(self, capsys, monkeypatch):
        """The mechanism: a failed send with a recovery line must print it."""
        import time
        monkeypatch.setattr(notifications, "_send_email", lambda *a, **k: False)

        notifications._bg("owner@example.com", "Your sign-in code", "<p>x</p>",
                          recovery="sign-in code for owner@example.com is 483920")
        time.sleep(0.5)                      # the send runs in a daemon thread

        out = capsys.readouterr().out
        assert "483920" in out, "the code must be recoverable when email is down"
        assert "RECOVERY" in out

    def test_the_login_code_is_actually_wired_to_that_mechanism(self, monkeypatch):
        """
        The wiring, checked against a CLEAN copy of the module.

        conftest replaces every public function in `notifications` with a mock
        for the whole session — rightly, so no test can reach a real gateway —
        which means `send_login_otp_email` cannot be called directly here. A
        separately loaded copy leaves the session's stubs untouched while still
        exercising the real function.
        """
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "notifications_clean", notifications.__file__)
        clean = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(clean)

        captured = {}
        monkeypatch.setattr(clean, "_bg",
                            lambda to, subject, html, recovery=None: captured.update(
                                to=to, recovery=recovery))

        clean.send_login_otp_email("owner@example.com", "Shop Owner", "483920")

        assert captured["recovery"] is not None, "the login code passes no recovery line"
        assert "483920" in captured["recovery"]

    def test_no_recovery_line_is_printed_when_the_send_succeeds(self, capsys, monkeypatch):
        """
        The code is only ever written down as a last resort. A successful send
        must leave nothing behind.
        """
        import time
        monkeypatch.setattr(notifications, "_send_email", lambda *a, **k: True)

        notifications._bg("owner@example.com", "Subject", "<p>x</p>",
                          recovery="sign-in code is 111222")
        time.sleep(0.5)

        out = capsys.readouterr().out
        assert "111222" not in out
        assert "RECOVERY" not in out
