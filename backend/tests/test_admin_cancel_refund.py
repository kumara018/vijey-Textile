"""
PAY-01 (October 2026 test pass): a paid order cancelled from the workroom kept
the customer's money.

The customer's own Cancel refunds on the spot. The workroom's Cancel put the
stock back and called off the courier, and never refunded — so every prepaid
order the shop itself cancelled stayed "paid" with the money captured.

Razorpay is never called: refunds.refund_payment is replaced per test.
"""
import pytest

import models
import refunds


@pytest.fixture()
def admin(make_user, db):
    user, headers = make_user()
    user.is_admin = True
    db.commit()
    return headers


class _Calls(list):
    """The payment ids a refund was asked for; `result` is what Razorpay "answers"."""
    result = ("rfnd_TEST123", None)


@pytest.fixture()
def calls(monkeypatch):
    seen = _Calls()

    def fake(payment_id, reason, notes=None):
        seen.append(payment_id)
        return seen.result

    monkeypatch.setattr(refunds, "refund_payment", fake)
    return seen


def _order(db, user, *, method="razorpay", pay_status="paid", txn="pay_TEST123", tag="A"):
    o = models.Order(
        order_number=f"VJT-RF{tag}{user.id:05d}", user_id=user.id,
        items_snapshot=[], subtotal=1500.0, shipping_fee=0.0, total=1500.0,
        status="processing", payment_status=pay_status, payment_method=method,
        payment_transaction_id=txn,
        shipping_address={"full_name": "Test", "pincode": "638102"},
    )
    db.add(o)
    db.commit()
    db.refresh(o)
    return o


def _cancel(client, admin, order):
    return client.put(f"/api/admin/orders/{order.id}/status", headers=admin, json={"status": "cancelled"})


def test_a_paid_order_the_shop_cancels_is_refunded(client, db, admin, make_user, calls):
    customer, _ = make_user()
    o = _order(db, customer)
    r = _cancel(client, admin, o)
    assert r.status_code == 200, r.text
    assert calls == ["pay_TEST123"], "the workroom cancelled a paid order and never asked for the money back"
    db.refresh(o)
    assert o.payment_status == "refund_initiated"


def test_a_refund_that_fails_is_shown_never_left_reading_paid(client, db, admin, make_user, calls):
    calls.result = (None, "Razorpay said no")
    customer, _ = make_user()
    o = _order(db, customer, tag="B")
    assert _cancel(client, admin, o).status_code == 200
    db.refresh(o)
    assert o.payment_status == "refund_failed"
    alert = db.query(models.AdminNotification).filter(
        models.AdminNotification.order_id == o.id, models.AdminNotification.type == "refund_failed"
    ).first()
    assert alert is not None, "a failed refund raised no alert in the workroom"


@pytest.mark.parametrize("method,pay_status,txn", [
    ("cod", "pending", None),              # cash on delivery: nothing was taken
    ("razorpay", "pending", None),         # never paid
    ("razorpay", "refunded", "pay_TEST9"),  # already given back
])
def test_nothing_is_refunded_that_was_never_taken(client, db, admin, make_user, calls, method, pay_status, txn):
    customer, _ = make_user()
    o = _order(db, customer, method=method, pay_status=pay_status, txn=txn, tag="C")
    assert _cancel(client, admin, o).status_code == 200
    assert calls == []


def test_a_live_order_cannot_be_refunded_by_mistake(client, db, admin, make_user, calls):
    """PAY-02: the refund button refunded orders that were still going out."""
    customer, _ = make_user()
    o = _order(db, customer, tag="D")
    r = client.post(f"/api/payments/admin/orders/{o.id}/initiate-refund", headers=admin)
    assert r.status_code == 400, r.text
    assert calls == []


def test_a_failed_refund_can_be_retried(client, db, admin, make_user, calls):
    customer, _ = make_user()
    o = _order(db, customer, tag="E")
    o.status, o.payment_status = "cancelled", "refund_failed"
    db.commit()
    r = client.post(f"/api/payments/admin/orders/{o.id}/initiate-refund", headers=admin)
    assert r.status_code == 200, r.text
    assert r.json()["payment_status"] == "refund_initiated"
    assert calls == ["pay_TEST123"]


def test_an_unpaid_order_cannot_be_marked_refunded(client, db, admin, make_user):
    """PAY-03: that sent a "refund credited" message for money never taken."""
    customer, _ = make_user()
    o = _order(db, customer, pay_status="pending", txn=None, tag="F")
    r = client.post(f"/api/payments/admin/orders/{o.id}/mark-refunded", headers=admin)
    assert r.status_code == 400, r.text
