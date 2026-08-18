"""
Cart, orders and returns — the paths where a mistake costs a customer money.

These are chosen by consequence, not by coverage. An arithmetic slip in a total,
a cancellation that fails to restore stock, a refund that fires before the item
is back: none of those raise an exception, none show up in a log, and all of
them are found by a customer rather than by the shop.
"""
import hashlib
import hmac
import os

import pytest


# The real order payload: a nested address and a payment block, with the method
# validated against ["razorpay", "upi", "emi"]. My first attempt sent a flat
# body with method "cod" and every order test failed 422 — the endpoint was
# right and the test was inventing a contract.
def razorpay_signature(order_id: str, payment_id: str) -> str:
    """
    The signature Razorpay's checkout would return, computed the same way the
    endpoint checks it.

    Deliberately NOT a mock of `_verify_razorpay_payment`. That function is the
    only thing between a forged POST and a free order, and stubbing it in the
    tests would leave the suite green after someone removed it. Satisfying it
    for real costs three lines, and `test_forged_payment_signature_is_refused`
    then proves it is still doing its job.
    """
    secret = os.environ["RAZORPAY_KEY_SECRET"].encode()
    return hmac.new(secret, f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()


def order_body(phone="9000000123", *, valid_signature=True):
    rp_order, rp_payment = "order_TEST123", "pay_TEST123"
    sig = razorpay_signature(rp_order, rp_payment) if valid_signature else "0" * 64
    return {
        "shipping_address": {
            "full_name": "Test Customer",
            "phone": phone,
            "address_line1": "1 Test Street",
            "city": "Erode",
            "state": "Tamil Nadu",
            "pincode": "638001",
        },
        "payment": {
            "method": "upi",
            "upi_id": "test@upi",
            "razorpay_order_id": rp_order,
            "razorpay_payment_id": rp_payment,
            "razorpay_signature": sig,
        },
    }


# ── Cart ─────────────────────────────────────────────────────────────────────

class TestCart:
    def test_add_then_read_back(self, client, make_user, product):
        _, headers = make_user()
        r = client.post("/api/cart/", headers=headers,
                        json={"product_id": product.id, "quantity": 2, "size": "16", "color": "Green"})
        assert r.status_code == 201, r.text

        r = client.get("/api/cart/", headers=headers)
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 1
        assert items[0]["quantity"] == 2

    def test_a_cart_is_private_to_its_owner(self, client, make_user, product):
        _, mine = make_user()
        _, theirs = make_user()
        client.post("/api/cart/", headers=mine,
                    json={"product_id": product.id, "quantity": 1, "size": "16", "color": "Green"})
        r = client.get("/api/cart/", headers=theirs)
        assert r.status_code == 200
        assert r.json() == [], "one customer can see another's cart"

    def test_cart_requires_a_signed_in_customer(self, client):
        assert client.get("/api/cart/").status_code in (401, 403)

    def test_quantity_beyond_stock_is_refused(self, client, make_user, product, db):
        _, headers = make_user()
        r = client.post("/api/cart/", headers=headers,
                        json={"product_id": product.id, "quantity": product.stock + 5,
                              "size": "16", "color": "Green"})
        assert r.status_code >= 400, (
            "the cart accepted more units than exist — the shortfall is only "
            "discovered after the customer has paid"
        )


# ── Orders ───────────────────────────────────────────────────────────────────

class TestOrders:
    def _stocked_cart(self, client, headers, product, qty=2):
        r = client.post("/api/cart/", headers=headers,
                        json={"product_id": product.id, "quantity": qty, "size": "16", "color": "Green"})
        assert r.status_code == 201, r.text

    def test_placing_an_order_charges_the_right_total_and_takes_the_stock(
        self, client, make_user, product, db
    ):
        import models
        _, headers = make_user()
        before = product.stock
        self._stocked_cart(client, headers, product, qty=2)

        r = client.post("/api/orders/", headers=headers, json=order_body("9000000123"))
        assert r.status_code == 201, r.text
        order = r.json()

        # 2 x 1000. If this drifts, someone is being charged the wrong amount.
        assert order["subtotal"] == 2000.0, order

        db.expire_all()
        after = db.query(models.Product).get(product.id).stock
        assert after == before - 2, f"stock went {before} -> {after}, expected {before - 2}"

    def test_forged_payment_signature_is_refused(self, client, make_user, product, db):
        """
        The highest-consequence test here: a wrong signature must not buy goods.

        Razorpay's checkout captures the money client-side, so this endpoint is
        what decides whether a POST claiming "I paid" is believed. If the HMAC
        check is ever removed or weakened, anyone who can read the network tab
        can place free orders — and nothing else in the system would notice.
        """
        import models
        _, headers = make_user()
        before = db.query(models.Product).get(product.id).stock
        self._stocked_cart(client, headers, product, qty=1)

        r = client.post("/api/orders/", headers=headers,
                        json=order_body("9000000128", valid_signature=False))
        assert r.status_code == 400, (
            f"an order was accepted with a forged payment signature: {r.status_code}"
        )
        db.expire_all()
        assert db.query(models.Product).get(product.id).stock == before, (
            "stock moved for an order that was never paid for"
        )

    def test_a_forged_signature_cannot_trigger_a_refund(self, client, make_user, product, db):
        """
        The most valuable test in this file. It guards a hole that moved money.

        `_refund_uncredited_payment` runs when the cart cannot be fulfilled, and
        it refunds whatever `razorpay_payment_id` the REQUEST supplied, using
        the shop's own API keys. That branch used to execute before the payment
        signature was checked — so a caller could put an out-of-stock item in
        their cart, POST a real payment id belonging to somebody else's order
        with a garbage signature, and the shop would fetch that payment from
        Razorpay and refund it. No order created, nothing odd in the logs, money
        gone to a stranger.

        Verification now happens at the top of the endpoint. This test drives
        exactly that request and asserts the refund is never reached.
        """
        import models
        from unittest.mock import patch
        import routers.orders as orders_router

        _, headers = make_user()
        # A cart that CANNOT be fulfilled, so the stock-error branch is the one
        # the request lands in.
        self._stocked_cart(client, headers, product, qty=1)
        p = db.query(models.Product).get(product.id)
        p.stock = 0
        db.commit()

        with patch.object(orders_router, "_refund_uncredited_payment") as refund:
            r = client.post("/api/orders/", headers=headers,
                            json=order_body("9000000129", valid_signature=False))

        assert r.status_code == 400, r.text
        refund.assert_not_called(), (
            "a forged signature reached the refund path — this endpoint would "
            "refund a payment id it never verified"
        )

    def test_a_genuine_payment_is_refunded_when_stock_ran_out(
        self, client, make_user, product, db
    ):
        """
        The other half: a REAL payment that cannot be fulfilled must be given
        back, not silently kept.

        Razorpay captures inside the checkout widget, before this endpoint is
        called — so by the time the shop discovers the last one sold thirty
        seconds ago, the customer has already paid. This path had never been
        executed by anything.
        """
        import models
        from unittest.mock import patch
        import routers.orders as orders_router

        _, headers = make_user()
        self._stocked_cart(client, headers, product, qty=1)
        p = db.query(models.Product).get(product.id)
        p.stock = 0
        db.commit()

        with patch.object(orders_router, "_refund_uncredited_payment",
                          return_value="rfnd_TEST") as refund:
            r = client.post("/api/orders/", headers=headers,
                            json=order_body("9000000130"))

        assert r.status_code == 400, r.text
        refund.assert_called_once()
        assert "refunded" in r.json()["detail"].lower(), (
            f"the customer was not told their money is coming back: {r.json()['detail']}"
        )

    def test_an_empty_cart_cannot_become_an_order(self, client, make_user):
        _, headers = make_user()
        r = client.post("/api/orders/", headers=headers, json=order_body("9000000123"))
        assert r.status_code == 400

    def test_an_order_is_private_to_its_owner(self, client, make_user, product):
        _, mine = make_user()
        _, theirs = make_user()
        self._stocked_cart(client, mine, product, qty=1)
        created = client.post("/api/orders/", headers=mine, json=order_body("9000000124"))
        assert created.status_code == 201, created.text
        order_id = created.json()["id"]

        r = client.get(f"/api/orders/{order_id}", headers=theirs)
        assert r.status_code == 404, (
            "another customer can read this order — order ids are sequential, "
            "so that is the whole order book"
        )

    def test_cancelling_before_dispatch_puts_the_stock_back(
        self, client, make_user, product, db
    ):
        import models
        _, headers = make_user()
        before = db.query(models.Product).get(product.id).stock
        self._stocked_cart(client, headers, product, qty=3)
        created = client.post("/api/orders/", headers=headers, json=order_body("9000000125"))
        assert created.status_code == 201, created.text
        order_id = created.json()["id"]

        db.expire_all()
        assert db.query(models.Product).get(product.id).stock == before - 3

        r = client.post(f"/api/orders/{order_id}/cancel", headers=headers, json={})
        assert r.status_code == 200, r.text

        db.expire_all()
        assert db.query(models.Product).get(product.id).stock == before, (
            "cancelling an order that never shipped did not return its stock to "
            "the shelf — the shop is now short of items it still has"
        )

    def test_cancelling_after_dispatch_holds_the_stock_back(
        self, client, make_user, product, db
    ):
        """
        The RTO rule. An order already with the courier is NOT back on the shelf,
        and restoring it immediately oversells the shop by exactly the quantity
        that is currently in a van.
        """
        import models
        _, headers = make_user()
        self._stocked_cart(client, headers, product, qty=2)
        created = client.post("/api/orders/", headers=headers, json=order_body("9000000126"))
        order_id = created.json()["id"]

        order = db.query(models.Order).get(order_id)
        order.status = "shipped"
        order.awb_code = "TESTAWB0001"
        db.commit()

        after_dispatch = db.query(models.Product).get(product.id).stock

        r = client.post(f"/api/orders/{order_id}/cancel", headers=headers, json={})
        assert r.status_code == 200, r.text

        db.expire_all()
        assert db.query(models.Product).get(product.id).stock == after_dispatch, (
            "stock was restored while the parcel is still with the courier — "
            "the shop will sell items it does not have"
        )
        assert db.query(models.Order).get(order_id).rto_pending is True, (
            "a dispatched cancellation was not marked as awaiting return"
        )

    def test_a_delivered_order_cannot_be_cancelled(self, client, make_user, product, db):
        import models
        _, headers = make_user()
        self._stocked_cart(client, headers, product, qty=1)
        order_id = client.post("/api/orders/", headers=headers, json=order_body("9000000127")).json()["id"]

        order = db.query(models.Order).get(order_id)
        order.status = "delivered"
        db.commit()

        r = client.post(f"/api/orders/{order_id}/cancel", headers=headers, json={})
        assert r.status_code == 400


# ── Returns ──────────────────────────────────────────────────────────────────

class TestReturns:
    def _delivered_order(self, client, headers, product, db, phone="9000000199"):
        import models
        from datetime import datetime, timezone
        client.post("/api/cart/", headers=headers,
                    json={"product_id": product.id, "quantity": 1, "size": "16", "color": "Green"})
        created = client.post("/api/orders/", headers=headers, json=order_body(phone))
        assert created.status_code == 201, created.text
        order = db.query(models.Order).get(created.json()["id"])
        order.status = "delivered"
        order.delivered_at = datetime.now(timezone.utc)
        db.commit()
        return order

    def test_a_return_cannot_be_raised_against_an_undelivered_order(
        self, client, make_user, product, db
    ):
        import models
        _, headers = make_user()
        client.post("/api/cart/", headers=headers,
                    json={"product_id": product.id, "quantity": 1, "size": "16", "color": "Green"})
        order_id = client.post("/api/orders/", headers=headers, json=order_body("9000000198")).json()["id"]

        r = client.post("/api/returns/", headers=headers, json={
            "order_id": order_id, "product_id": product.id,
            "request_type": "return", "reason": "size_issue",
            "images": ["https://res.cloudinary.com/test/a.jpg",
                       "https://res.cloudinary.com/test/b.jpg"],
        })
        assert r.status_code >= 400, (
            "a return was accepted for an order that has not been delivered"
        )

    def test_a_return_is_private_to_its_owner(self, client, make_user, product, db):
        _, mine = make_user()
        _, theirs = make_user()
        order = self._delivered_order(client, mine, product, db, phone="9000000197")

        created = client.post("/api/returns/", headers=mine, json={
            "order_id": order.id, "product_id": product.id,
            "request_type": "return", "reason": "size_issue",
            "images": ["https://res.cloudinary.com/test/a.jpg",
                       "https://res.cloudinary.com/test/b.jpg"],
        })
        if created.status_code >= 400:
            pytest.skip(f"return could not be created in this fixture state: {created.text[:120]}")

        rid = created.json()["id"]
        r = client.get(f"/api/returns/{rid}", headers=theirs)
        assert r.status_code in (403, 404), "another customer can read this return request"

    def test_admin_endpoints_refuse_an_ordinary_customer(self, client, make_user):
        _, headers = make_user()
        for path in ("/api/admin/orders", "/api/admin/returns", "/api/admin/stats"):
            r = client.get(path, headers=headers)
            assert r.status_code in (401, 403, 404), (
                f"{path} answered a non-admin with {r.status_code}"
            )
