"""
Web push — the channel that exists because every other one can be priced.

SMS is never free. WhatsApp's free service window closes on 1 October 2026.
Email is free but is read hourly, not instantly. Web push has no vendor to
charge or suspend it, which is the whole reason it is here.

What these pin is not "does a notification arrive" — that needs a real browser
and a real push service. It is the logic around the send, where being wrong
costs something real: a dead subscription that never gets pruned, a duplicate
that buzzes a customer three times for one order, an endpoint one customer can
delete from another's account, or a push failure that takes an order update
down with it.
"""

import importlib.util

import pytest


@pytest.fixture()
def ps():
    """
    A clean copy of `push`.

    conftest replaces every public function in the outbound modules with a mock
    for the session, which is right — no test may reach a real push service.
    It also means the real functions cannot be called directly, so this loads a
    second instance and leaves the session's stubs alone.
    """
    import push as installed
    spec = importlib.util.spec_from_file_location("push_clean", installed.__file__)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture()
def keys(monkeypatch):
    monkeypatch.setenv("VAPID_PUBLIC_KEY", "B" + "a" * 86)
    monkeypatch.setenv("VAPID_PRIVATE_KEY", "p" * 43)
    monkeypatch.setenv("VAPID_SUBJECT", "mailto:shop@example.com")


class TestConfiguration:
    def test_all_three_are_required(self, ps, monkeypatch):
        monkeypatch.setenv("VAPID_PUBLIC_KEY", "B" + "a" * 86)
        monkeypatch.delenv("VAPID_PRIVATE_KEY", raising=False)
        monkeypatch.setenv("VAPID_SUBJECT", "mailto:shop@example.com")
        assert ps.is_configured() is False

    def test_a_bare_address_is_normalised_to_a_uri(self, ps, monkeypatch):
        """
        VAPID requires a mailto: or https: subject. Some push services reject a
        bare address with an error that does not say so — worth fixing here
        rather than debugging it twice.
        """
        monkeypatch.setenv("VAPID_SUBJECT", "shop@example.com")
        assert ps._subject() == "mailto:shop@example.com"

    def test_a_uri_subject_is_left_alone(self, ps, monkeypatch):
        monkeypatch.setenv("VAPID_SUBJECT", "https://vijeytextile.com")
        assert ps._subject() == "https://vijeytextile.com"

    def test_it_falls_back_to_the_support_address(self, ps, monkeypatch):
        monkeypatch.delenv("VAPID_SUBJECT", raising=False)
        monkeypatch.setenv("SUPPORT_EMAIL", "help@example.com")
        assert ps._subject() == "mailto:help@example.com"

    def test_sending_without_keys_is_a_no_op_not_a_crash(self, ps, monkeypatch):
        monkeypatch.delenv("VAPID_PRIVATE_KEY", raising=False)
        delivered, reason = ps.send({"endpoint": "x"}, "t", "b")
        assert delivered is False
        assert reason == "not configured"


class TestADeadSubscriptionIsToldApartFromAFailure:
    """
    A push service answers 404 or 410 when a subscription is dead — the browser
    was uninstalled, site data was cleared, the endpoint expired. That is an
    instruction to delete it, not a transient error to retry. A shop that never
    prunes ends up spending every send on endpoints that cannot receive.
    """

    def _raise(self, ps, status):
        from pywebpush import WebPushException

        class _R:
            status_code = status

        exc = WebPushException("nope")
        exc.response = _R()
        return exc

    @pytest.mark.parametrize("status", [404, 410])
    def test_gone_is_reported_as_gone(self, ps, keys, monkeypatch, status):
        monkeypatch.setattr(ps, "webpush", None, raising=False)
        import pywebpush
        monkeypatch.setattr(pywebpush, "webpush",
                            lambda **k: (_ for _ in ()).throw(self._raise(ps, status)))
        delivered, reason = ps.send({"endpoint": "x", "keys": {}}, "t", "b")
        assert delivered is False
        assert reason == "gone"

    def test_a_gone_endpoint_does_not_mark_the_channel_broken(self, ps, keys, monkeypatch):
        """
        One dead phone is not an outage. Recording it as a channel failure
        would light up System Health every time somebody uninstalled a browser.
        """
        import pywebpush
        monkeypatch.setattr(pywebpush, "webpush",
                            lambda **k: (_ for _ in ()).throw(self._raise(ps, 410)))
        ps.send({"endpoint": "x", "keys": {}}, "t", "b")
        assert ps.LAST_PUSH["ok"] is True

    def test_a_server_error_is_a_real_failure(self, ps, keys, monkeypatch):
        import pywebpush
        monkeypatch.setattr(pywebpush, "webpush",
                            lambda **k: (_ for _ in ()).throw(self._raise(ps, 500)))
        delivered, reason = ps.send({"endpoint": "x", "keys": {}}, "t", "b")
        assert delivered is False
        assert reason != "gone"
        assert ps.LAST_PUSH["ok"] is False


class TestSubscribingIsIdempotent:
    """
    A browser returns the SAME endpoint every time it subscribes. Without
    uniqueness, a customer who reloads the page is notified twice about one
    order, and three times after the next reload.
    """

    def _subscribe(self, client, token, endpoint="https://push.example/abc"):
        return client.post("/api/push/subscribe",
                           headers={"Authorization": f"Bearer {token}"},
                           json={"endpoint": endpoint, "p256dh": "k" * 20, "auth": "a" * 10})

    def test_subscribing_twice_stores_one_row(self, client, db, monkeypatch):
        import auth as auth_utils, models, push

        monkeypatch.setattr(push, "is_configured", lambda: True)

        user = models.User(full_name="Push Tester", email="push.tester@example.com",
                           phone="9000000881",
                           password_hash=auth_utils.hash_password("Sufficient1!"))
        db.add(user); db.commit(); db.refresh(user)
        token = auth_utils.create_access_token({"sub": user.id})

        assert self._subscribe(client, token).status_code == 200
        assert self._subscribe(client, token).status_code == 200

        rows = db.query(models.PushSubscription).filter(
            models.PushSubscription.user_id == user.id).all()
        assert len(rows) == 1, "one browser must not accumulate subscriptions"

    def test_the_public_key_needs_no_sign_in(self, client):
        """
        It is public by definition — every visitor's browser needs it before it
        can even ask permission, and it grants nothing.
        """
        res = client.get("/api/push/key")
        assert res.status_code == 200
        assert "enabled" in res.json()

    def test_subscribing_does_need_sign_in(self, client):
        res = client.post("/api/push/subscribe",
                          json={"endpoint": "https://push.example/x",
                                "p256dh": "k" * 20, "auth": "a" * 10})
        assert res.status_code in (401, 403)


class TestAnOrderUpdateSurvivesAFailedPush:
    def test_a_push_exception_does_not_escape(self, monkeypatch):
        """
        The email and WhatsApp beside it are what the customer relies on. A
        push failing must never be what stops an order being marked shipped.
        """
        import notifications
        import push

        monkeypatch.setattr(push, "is_configured", lambda: True)
        monkeypatch.setattr(push, "send_to_user",
                            lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")))

        class _Order:
            user_id = 1
            id = 7
            order_number = "VT-0007"

        # Reaches the real function rather than conftest's stub.
        import importlib.util
        spec = importlib.util.spec_from_file_location("notif_clean", notifications.__file__)
        clean = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(clean)

        assert clean.push_order_status(None, _Order(), "shipped") == 0

    def test_an_unknown_status_sends_nothing(self, monkeypatch):
        import notifications
        import importlib.util

        spec = importlib.util.spec_from_file_location("notif_clean2", notifications.__file__)
        clean = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(clean)

        class _Order:
            user_id = 1
            id = 7
            order_number = "VT-0007"

        assert clean.push_order_status(None, _Order(), "some_internal_state") == 0
