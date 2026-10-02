"""
PAY-04 / PAY-05 (October 2026 test pass): a payment proved only that somebody
paid something. Each test below is one way it could be spent on something it
was never made for, and each fails on the code before payment_binding.py.

Razorpay is never contacted: the client that opens orders, the refund call and
the legacy lookup are all replaced here.
"""
import hashlib
import hmac
import itertools
from datetime import datetime, timezone

import pytest

import models
import refunds
from routers import payments

SECRET = "test_rzp_secret"
ADDRESS = {
    "full_name": "Test Customer", "phone": "9876543210", "address_line1": "1 Test Street",
    "city": "Erode", "state": "Tamil Nadu", "pincode": "638102",
}


_ORDER_IDS = itertools.count(1)   # one sequence for the module: the test database outlives each test


class _Rzp:
    """A stand-in Razorpay client: numbered orders, recorded refunds."""
    def __init__(self):
        self.refunded = []

        class _Orders:
            def create(self, params):
                return {"id": f"order_QA{next(_ORDER_IDS):06d}", "amount": params["amount"], "currency": "INR"}

        self.order = _Orders()


@pytest.fixture()
def rzp(monkeypatch):
    fake = _Rzp()
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", SECRET)
    monkeypatch.setattr(payments, "get_razorpay_client", lambda: fake)

    def refund(payment_id, reason, notes=None):
        fake.refunded.append(payment_id)
        return "rfnd_QA", None

    monkeypatch.setattr(refunds, "refund_payment", refund)
    monkeypatch.setattr(refunds, "_client", lambda: None)   # Razorpay "unreachable" for legacy lookups
    return fake


def _sign(order_id, payment_id):
    return hmac.new(SECRET.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()


def _open(client, headers, product, qty=1):
    r = client.post("/api/payments/create-order", headers=headers,
                    json={"buy_now": {"product_id": product.id, "quantity": qty}})
    assert r.status_code == 200, r.text
    return r.json()["order_id"]


def _place(client, headers, product, rz_order, pay_id, qty=1):
    return client.post("/api/orders/", headers=headers, json={
        "shipping_address": ADDRESS,
        "buy_now": {"product_id": product.id, "quantity": qty},
        "payment": {"method": "razorpay", "razorpay_order_id": rz_order,
                    "razorpay_payment_id": pay_id, "razorpay_signature": _sign(rz_order, pay_id)},
    })


def _orders_paid_by(db, pay_id):
    db.expire_all()
    return db.query(models.Order).filter(models.Order.payment_transaction_id == pay_id).count()


def test_a_genuine_checkout_still_goes_through(client, db, make_user, product, rzp):
    _, h = make_user()
    rz = _open(client, h, product)
    r = _place(client, h, product, rz, "pay_QA0001")
    assert r.status_code in (200, 201), r.text
    db.expire_all()
    intent = db.query(models.PaymentIntent).filter_by(razorpay_order_id=rz).one()
    assert intent.used_at is not None and intent.amount_paise == round((product.price + 49) * 100)


def test_one_payment_cannot_place_a_second_order(client, db, make_user, product, rzp):
    _, h = make_user()
    rz = _open(client, h, product)
    first = _place(client, h, product, rz, "pay_QA0002")
    again = _place(client, h, product, rz, "pay_QA0002")
    assert again.status_code in (200, 201) and again.json()["id"] == first.json()["id"], (
        "a retry must hand back the order that already went through"
    )
    assert _orders_paid_by(db, "pay_QA0002") == 1, "one payment created two paid orders"


def test_someone_elses_spent_payment_is_refused(client, db, make_user, product, rzp):
    _, buyer = make_user()
    _, other = make_user()
    rz = _open(client, buyer, product)
    _place(client, buyer, product, rz, "pay_QA0003")
    r = _place(client, other, product, rz, "pay_QA0003")
    assert r.status_code == 409, r.text
    assert _orders_paid_by(db, "pay_QA0003") == 1


def test_paying_for_one_piece_does_not_buy_three(client, db, make_user, product, rzp):
    _, h = make_user()
    rz = _open(client, h, product, qty=1)
    r = _place(client, h, product, rz, "pay_QA0004", qty=3)
    assert r.status_code == 400, f"an order for three was accepted against a payment for one: {r.text}"
    assert _orders_paid_by(db, "pay_QA0004") == 0
    assert rzp.refunded == ["pay_QA0004"], "the customer's payment must come back, not be kept"


def test_an_unspent_payment_cannot_be_used_by_another_account(client, db, make_user, product, rzp):
    _, owner = make_user()
    _, thief = make_user()
    rz = _open(client, owner, product)
    r = _place(client, thief, product, rz, "pay_QA0005")
    assert r.status_code == 400, r.text
    assert rzp.refunded == [], "someone else's payment must not be refunded on a stranger's say-so"


def test_a_refunded_payment_cannot_be_spent_after_a_restock(client, db, make_user, product, rzp):
    _, h = make_user()
    rz = _open(client, h, product)
    product.stock = 0
    db.commit()
    first = _place(client, h, product, rz, "pay_QA0006")
    assert first.status_code == 400 and rzp.refunded == ["pay_QA0006"], first.text
    product.stock = 10
    db.commit()
    again = _place(client, h, product, rz, "pay_QA0006")
    assert again.status_code == 409, f"a refunded payment bought the piece anyway: {again.text}"
    assert _orders_paid_by(db, "pay_QA0006") == 0


def test_a_delivered_orders_payment_cannot_be_refunded_by_replaying_it(client, db, make_user, product, rzp):
    _, h = make_user()
    rz = _open(client, h, product)
    assert _place(client, h, product, rz, "pay_QA0007").status_code in (200, 201)
    product.stock = 0
    db.commit()
    _place(client, h, product, rz, "pay_QA0007")
    assert rzp.refunded == [], "replaying a paid order's payment against an empty shelf refunded it"


def test_a_checkout_opened_before_the_fix_waits_for_razorpay_rather_than_guessing(client, db, make_user, product, rzp):
    _, h = make_user()
    r = _place(client, h, product, "order_LEGACY01", "pay_QA0008")
    assert r.status_code == 503, r.text
    assert _orders_paid_by(db, "pay_QA0008") == 0


class TestExchangeDifference:
    def _delivered(self, db, user, product, tag):
        o = models.Order(
            order_number=f"QA-EX{tag}{user.id:05d}", user_id=user.id,
            items_snapshot=[{"product_id": product.id, "name": product.name, "price": product.price, "quantity": 1}],
            subtotal=product.price, shipping_fee=49.0, total=product.price + 49.0,
            status="delivered", delivered_at=datetime.now(timezone.utc),
            payment_status="paid", payment_method="razorpay", payment_transaction_id=f"pay_QAORIG{tag}{user.id}",
            shipping_address=ADDRESS,
        )
        db.add(o)
        dearer = models.Product(name=f"Dearer piece {tag}", description="Test.", price=product.price + 300,
                                category=product.category, size_options=["16"], colors=["Green"],
                                images=[], stock=5, is_active=True)
        db.add(dearer)
        db.commit()
        return o, dearer

    def _ask(self, client, h, o, product, dearer, rz, pay_id):
        return client.post("/api/returns/", headers=h, json={
            "order_id": o.id, "product_id": product.id, "request_type": "exchange", "reason": "size_issue",
            "images": ["https://res.cloudinary.com/x/a.jpg", "https://res.cloudinary.com/x/b.jpg"],
            "new_product_id": dearer.id,
            "razorpay_order_id": rz, "razorpay_payment_id": pay_id, "razorpay_signature": _sign(rz, pay_id),
        })

    def test_the_server_charges_the_difference_not_the_bag(self, client, db, make_user, product, rzp):
        user, h = make_user()
        o, dearer = self._delivered(db, user, product, "A")
        r = client.post("/api/payments/create-order", headers=h, json={
            "amount": 1, "exchange": {"order_id": o.id, "product_id": product.id, "new_product_id": dearer.id}})
        assert r.status_code == 200, r.text
        assert r.json()["amount"] == 30000, r.json()
        ok = self._ask(client, h, o, product, dearer, r.json()["order_id"], "pay_QAEXA")
        assert ok.status_code == 201, ok.text

    def test_a_checkout_payment_does_not_pay_the_difference(self, client, db, make_user, product, rzp):
        user, h = make_user()
        o, dearer = self._delivered(db, user, product, "B")
        rz = _open(client, h, product)                                   # an ordinary checkout's payment...
        r = self._ask(client, h, o, product, dearer, rz, "pay_QAEXB")   # ...offered for the exchange
        assert r.status_code == 400, f"an exchange was paid for with a checkout payment: {r.text}"
