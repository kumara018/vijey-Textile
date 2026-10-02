"""
What "Remove" does to a product — and what it must never do.

The workroom asked 'Remove "frock"?', the owner said yes, and the row stayed in
the list marked HIDDEN, because this endpoint only ever hid. A sample piece made
to try something out could never actually be got rid of.

Three rules, one test each:
  1. Asked to delete an untouched piece, it is really deleted.
  2. Asked to delete a piece a customer has a stake in, it is HIDDEN instead,
     nothing of the customer's is erased, and the reply says why.
  3. Without the flag the old behaviour stands — hide, reversibly — because the
     sister shop's "Deactivate" button depends on exactly that.
"""
import pytest

import models


@pytest.fixture()
def admin(make_user, db):
    user, headers = make_user()
    user.is_admin = True
    db.commit()
    return headers


def _piece(db, name):
    p = models.Product(
        name=name, description="Exists only in the test database.", price=1500.0,
        category="Baby Frocks", size_options=["16"], colors=["Green"],
        images=[], stock=3, is_active=True,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


class TestRemoveReallyRemoves:
    def test_an_untouched_piece_is_deleted_for_good(self, client, db, admin):
        p = _piece(db, "Sample to delete")
        pid = p.id  # read now: once the row is really gone, the instance cannot reload it
        r = client.delete(f"/api/admin/products/{pid}?permanent=true", headers=admin)
        assert r.status_code == 200, r.text
        assert r.json() == {"deleted": True, "hidden": False}

        db.expire_all()
        assert db.query(models.Product).filter(models.Product.id == pid).first() is None, (
            "the workroom said removed and the row is still there — the bug the owner hit"
        )


class TestACustomersHistoryIsNeverErased:
    def test_a_reviewed_piece_is_hidden_not_deleted_and_says_why(self, client, db, admin, make_user):
        p = _piece(db, "Reviewed piece")
        customer, _ = make_user()
        db.add(models.Review(user_id=customer.id, product_id=p.id, rating=5,
                             title="Lovely", comment="Wore it to a wedding."))
        db.commit()

        r = client.delete(f"/api/admin/products/{p.id}?permanent=true", headers=admin)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["deleted"] is False and body["hidden"] is True
        assert "review" in body["reason"].lower(), body

        db.expire_all()
        kept = db.query(models.Product).filter(models.Product.id == p.id).first()
        assert kept is not None and kept.is_active is False
        assert db.query(models.Review).filter(models.Review.product_id == p.id).count() == 1, (
            "deleting the piece cascaded away a customer's review"
        )

    def test_a_piece_in_a_past_order_is_hidden_not_deleted(self, client, db, admin, make_user):
        p = _piece(db, "Ordered piece")
        customer, _ = make_user()
        db.add(models.Order(
            order_number=f"VJT-T{p.id:07d}", user_id=customer.id,
            items_snapshot=[{"product_id": p.id, "name": p.name, "price": 1500.0, "quantity": 1}],
            subtotal=1500.0, shipping_fee=49.0, total=1549.0,
            status="delivered", payment_status="paid", payment_method="razorpay",
            shipping_address={"full_name": "Test", "pincode": "638102"},
        ))
        db.commit()

        r = client.delete(f"/api/admin/products/{p.id}?permanent=true", headers=admin)
        body = r.json()
        assert body["deleted"] is False, "a piece someone bought was erased"
        assert "order" in body["reason"].lower(), body


class TestTheReversibleHideIsUnchanged:
    def test_without_the_flag_it_only_hides(self, client, db, admin):
        p = _piece(db, "Deactivated piece")
        r = client.delete(f"/api/admin/products/{p.id}", headers=admin)
        assert r.status_code == 200, r.text
        assert r.json()["deleted"] is False

        db.expire_all()
        kept = db.query(models.Product).filter(models.Product.id == p.id).first()
        assert kept is not None and kept.is_active is False, (
            "Deactivate must stay reversible — the sister shop's Reactivate button needs the row"
        )

    def test_customers_cannot_delete_anything(self, client, db, make_user):
        p = _piece(db, "Protected piece")
        _, customer = make_user()
        r = client.delete(f"/api/admin/products/{p.id}?permanent=true", headers=customer)
        assert r.status_code in (401, 403), r.status_code
        db.expire_all()
        assert db.query(models.Product).filter(models.Product.id == p.id).first() is not None
