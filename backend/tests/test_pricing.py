"""
What the customer is charged, and who decides it.

BOTH OF THESE WERE LIVE, AND BOTH TOOK REAL MONEY.

/payments/create-order accepted `amount` from the request and opened a Razorpay
order for exactly that. So:

  * Buy It Now charged 49 rupees for anything. The checkout page computed
    `cartTotal + shipping`, and a direct purchase deliberately has an empty
    bag — so the garment contributed nothing. Order AMT-NU23B2RU captured 4900
    paise against a 5000-paise order; on a 3,000-rupee saree it would have
    taken 49 rupees.

  * Anyone could pay any amount, by sending a different number in the request
    the page already makes.

The gap also broke refunds: cancelling asked Razorpay for `order.total`,
Razorpay refuses to return more than it captured, and the rejection was
swallowed by a `try` that only printed — so the order read "cancelled" while
the shop kept the money.

These tests are the reason none of that can come back quietly.
"""
import pytest


@pytest.fixture()
def priced(db):
    """A product whose price cannot be confused with the shipping fee."""
    import models
    p = models.Product(
        name="Priced Half Saree",
        description="Exists only in the test database.",
        price=2500.0,
        category="Half Saree",
        size_options=["L"],
        colors=["Blue"],
        images=["https://res.cloudinary.com/test/image/upload/saree.jpg"],
        stock=5,
        is_active=True,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


class TestTheServerDecidesTheAmount:

    def test_buy_it_now_charges_for_the_garment(self, client, make_user, priced, monkeypatch):
        """
        The exact live fault: an empty bag plus a direct purchase used to bill
        the shipping fee alone.
        """
        captured = {}

        class _FakeOrders:
            def create(self, data):
                captured.update(data)
                return {"id": "order_test", "amount": data["amount"], "currency": "INR"}

        class _FakeClient:
            order = _FakeOrders()

        import routers.payments as payments
        monkeypatch.setattr(payments, "get_razorpay_client", lambda: _FakeClient())

        _user, headers = make_user()
        r = client.post(
            "/api/payments/create-order",
            json={"amount": 49, "buy_now": {"product_id": priced.id, "quantity": 1}},
            headers=headers,
        )
        assert r.status_code == 200, r.text

        # 2500 for the piece + 49 shipping, in paise. Not 4900.
        assert captured["amount"] == 254900, (
            f"Buy It Now authorised {captured['amount']} paise for a 2500-rupee "
            "garment — the browser's figure is being trusted again"
        )
        assert r.json()["total"] == 2549.0

    def test_quantity_is_priced_too(self, client, make_user, priced, monkeypatch):
        captured = {}

        class _FakeClient:
            class order:
                @staticmethod
                def create(data):
                    captured.update(data)
                    return {"id": "order_test", "amount": data["amount"], "currency": "INR"}

        import routers.payments as payments
        monkeypatch.setattr(payments, "get_razorpay_client", lambda: _FakeClient())

        _user, headers = make_user()
        r = client.post(
            "/api/payments/create-order",
            json={"buy_now": {"product_id": priced.id, "quantity": 3}},
            headers=headers,
        )
        assert r.status_code == 200, r.text
        assert captured["amount"] == 754900   # 3 x 2500 + 49

    def test_a_lying_amount_is_ignored(self, client, make_user, priced, monkeypatch):
        """
        The security half. The request asks to pay one rupee for a 2500-rupee
        garment; the shop charges 2549 regardless.
        """
        captured = {}

        class _FakeClient:
            class order:
                @staticmethod
                def create(data):
                    captured.update(data)
                    return {"id": "order_test", "amount": data["amount"], "currency": "INR"}

        import routers.payments as payments
        monkeypatch.setattr(payments, "get_razorpay_client", lambda: _FakeClient())

        _user, headers = make_user()
        r = client.post(
            "/api/payments/create-order",
            json={"amount": 1, "buy_now": {"product_id": priced.id, "quantity": 1}},
            headers=headers,
        )
        assert r.status_code == 200, r.text
        assert captured["amount"] == 254900, "the amount from the request was used"

    def test_an_empty_bag_cannot_open_a_payment(self, client, make_user, monkeypatch):
        import routers.payments as payments
        monkeypatch.setattr(payments, "get_razorpay_client", lambda: object())

        _user, headers = make_user()
        r = client.post("/api/payments/create-order", json={"amount": 49}, headers=headers)
        assert r.status_code == 400, r.text

    def test_out_of_stock_is_refused_before_any_money_moves(
        self, client, make_user, priced, db, monkeypatch
    ):
        priced.stock = 0
        db.commit()

        import routers.payments as payments
        # If pricing let this through, calling into this object would blow up —
        # which is the point: nothing should reach Razorpay.
        monkeypatch.setattr(payments, "get_razorpay_client", lambda: object())

        _user, headers = make_user()
        r = client.post(
            "/api/payments/create-order",
            json={"buy_now": {"product_id": priced.id, "quantity": 1}},
            headers=headers,
        )
        assert r.status_code == 400, r.text
        assert "left" in r.json()["detail"].lower()

    def test_signing_in_is_required(self, client, priced):
        r = client.post(
            "/api/payments/create-order",
            json={"buy_now": {"product_id": priced.id, "quantity": 1}},
        )
        assert r.status_code in (401, 403), r.text


class TestPaiseConversion:

    def test_rounds_rather_than_truncates(self):
        import pricing
        # int(49.99 * 100) is 4998 on a binary float. A one-paise undercharge
        # is exactly the capture/refund mismatch this module exists to prevent.
        assert pricing.to_paise(49.99) == 4999
        assert pricing.to_paise(2549.0) == 254900
        assert pricing.to_paise(0.1 + 0.2) == 30


class TestRefundAsksForWhatWasActuallyTaken:

    def test_refunds_the_outstanding_amount_not_the_order_total(self, monkeypatch):
        """
        The rejection that stranded AMT-NU23B2RU: 5000 recorded, 4900 captured.
        The refund must ask for 4900.
        """
        import refunds
        asked = {}

        class _FakeClient:
            class payment:
                @staticmethod
                def fetch(pid):
                    return {"id": pid, "amount": 4900, "amount_refunded": 0, "status": "captured"}

                @staticmethod
                def refund(pid, data):
                    asked.update(data)
                    return {"id": "rfnd_test"}

        monkeypatch.setattr(refunds, "_client", lambda: _FakeClient())
        refund_id, error = refunds.refund_payment("pay_x", "cancelled")
        assert error is None
        assert refund_id == "rfnd_test"
        assert asked["amount"] == 4900

    def test_a_partly_refunded_payment_only_returns_the_rest(self, monkeypatch):
        import refunds
        asked = {}

        class _FakeClient:
            class payment:
                @staticmethod
                def fetch(pid):
                    return {"id": pid, "amount": 5000, "amount_refunded": 2000, "status": "captured"}

                @staticmethod
                def refund(pid, data):
                    asked.update(data)
                    return {"id": "rfnd_test"}

        monkeypatch.setattr(refunds, "_client", lambda: _FakeClient())
        refunds.refund_payment("pay_x", "cancelled")
        assert asked["amount"] == 3000

    def test_an_already_refunded_payment_is_success_not_failure(self, monkeypatch):
        """
        Idempotent on purpose: an admin pressing the button after the automatic
        refund already worked wants to hear that the money is back, not that
        something failed.
        """
        import refunds

        class _FakeClient:
            class payment:
                @staticmethod
                def fetch(pid):
                    return {"id": pid, "amount": 5000, "amount_refunded": 5000, "status": "captured"}

                @staticmethod
                def refund(pid, data):
                    raise AssertionError("should not attempt to refund nothing")

        monkeypatch.setattr(refunds, "_client", lambda: _FakeClient())
        refund_id, error = refunds.refund_payment("pay_x", "cancelled")
        assert error is None
        assert refund_id == "already_refunded"

    def test_an_uncaptured_payment_says_so_plainly(self, monkeypatch):
        import refunds

        class _FakeClient:
            class payment:
                @staticmethod
                def fetch(pid):
                    return {"id": pid, "amount": 5000, "amount_refunded": 0, "status": "authorized"}

                @staticmethod
                def refund(pid, data):
                    raise AssertionError("should not refund an uncaptured payment")

        monkeypatch.setattr(refunds, "_client", lambda: _FakeClient())
        refund_id, error = refunds.refund_payment("pay_x", "cancelled")
        assert refund_id is None
        assert "captured" in error
