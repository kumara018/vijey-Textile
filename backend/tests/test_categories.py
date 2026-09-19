"""
Categories: one list, edited from the workroom, obeyed everywhere.

Identical in both shops, so nothing here names a shop's own categories — every
test makes the ones it needs. The database outlives a single test, so names
carry a counter.

What this pins, and why each one matters:

  * the list a customer sees is the table, in the admin's order, minus the
    hidden ones — before this the table was not read at all, and on Vijey
    Textile it held Ammalu Tex's categories
  * a product can only be filed under a category that exists — on create AND
    on update; update was never checked, so any string could be saved
  * renaming a category moves its pieces with it, in one transaction
  * a category holding pieces cannot be deleted out from under them
"""
import itertools

import pytest

_SEQ = itertools.count(1)


def _name(prefix="Cat"):
    return f"{prefix} {next(_SEQ)}"


@pytest.fixture()
def admin(make_user, db):
    user, headers = make_user()
    user.is_admin = True
    db.commit()
    return headers


def _product(client, admin, category, **extra):
    body = {
        "name": f"Test piece {next(_SEQ)}",
        "description": "Exists only in the test database.",
        "price": 999.0,
        "category": category,
        "stock": 3,
        **extra,
    }
    return client.post("/api/admin/products", json=body, headers=admin)


def _by_name(listing, name):
    return next((c for c in listing if c["name"] == name), None)


class TestAdding:

    def test_a_new_category_appears_for_customers(self, client, admin):
        name = _name("Sharara")
        r = client.post("/api/admin/categories", json={
            "name": name, "eyebrow": "Mehendi to sangeet",
            "headline": "Made to twirl in", "description": "Flared, and easy to dance in.",
        }, headers=admin)
        assert r.status_code == 201, r.text

        public = client.get("/api/products/categories").json()
        row = _by_name(public, name)
        assert row, "a category added in the workroom did not reach the shop's menus"
        assert row["eyebrow"] == "Mehendi to sangeet"
        assert row["headline"] == "Made to twirl in"
        # Added at the end, so it never jumps ahead of what the admin arranged.
        assert public[-1]["name"] == name

    def test_a_duplicate_is_refused_whatever_its_case(self, client, admin):
        name = _name("Dupe")
        assert client.post("/api/admin/categories", json={"name": name}, headers=admin).status_code == 201
        r = client.post("/api/admin/categories", json={"name": f"  {name.upper()}  "}, headers=admin)
        assert r.status_code == 409, r.text

    @pytest.mark.parametrize("bad", ["", " ", "x", "<script>", "a" * 61, "Cotton?Silk"])
    def test_names_that_would_break_a_menu_or_a_url_are_refused(self, client, admin, bad):
        r = client.post("/api/admin/categories", json={"name": bad}, headers=admin)
        assert r.status_code == 422, f"{bad!r} was accepted: {r.text}"

    def test_customers_cannot_touch_the_list(self, client, make_user):
        _user, headers = make_user()
        assert client.get("/api/admin/categories", headers=headers).status_code == 403
        assert client.post("/api/admin/categories", json={"name": _name()}, headers=headers).status_code == 403
        assert client.post("/api/admin/categories", json={"name": _name()}).status_code in (401, 403)


class TestProductsMustUseARealCategory:

    def test_a_piece_can_be_filed_under_a_new_category(self, client, admin):
        name = _name("Fresh")
        client.post("/api/admin/categories", json={"name": name}, headers=admin)
        r = _product(client, admin, name)
        assert r.status_code == 201, r.text
        assert r.json()["category"] == name

    def test_the_stored_spelling_wins(self, client, admin):
        name = _name("Spelling")
        client.post("/api/admin/categories", json={"name": name}, headers=admin)
        r = _product(client, admin, name.lower())
        assert r.status_code == 201, r.text
        # Not a lookalike category that no menu links to.
        assert r.json()["category"] == name

    def test_an_unknown_category_is_refused_on_create(self, client, admin):
        r = _product(client, admin, "No Such Category Anywhere")
        assert r.status_code == 400, r.text
        assert "not a category" in r.json()["detail"]

    def test_an_unknown_category_is_refused_on_update(self, client, admin):
        """Update was never checked — any string could be saved."""
        name = _name("Home")
        client.post("/api/admin/categories", json={"name": name}, headers=admin)
        pid = _product(client, admin, name).json()["id"]

        r = client.put(f"/api/admin/products/{pid}", json={"category": "Made Up"}, headers=admin)
        assert r.status_code == 400, r.text

    def test_a_hidden_category_can_still_be_used_by_the_admin(self, client, admin):
        name = _name("Hidden")
        client.post("/api/admin/categories", json={"name": name, "is_active": False}, headers=admin)
        assert _product(client, admin, name).status_code == 201
        # ...but customers do not see it in the menus.
        assert not _by_name(client.get("/api/products/categories").json(), name)


class TestEditing:

    def test_renaming_moves_the_pieces_with_it(self, client, admin):
        old, new = _name("Before"), _name("After")
        listing = client.post("/api/admin/categories", json={"name": old}, headers=admin).json()
        cid = _by_name(listing, old)["id"]
        pid = _product(client, admin, old).json()["id"]

        r = client.put(f"/api/admin/categories/{cid}", json={"name": new}, headers=admin)
        assert r.status_code == 200, r.text

        piece = client.get(f"/api/products/{pid}").json()
        assert piece["category"] == new, "the rename orphaned the piece under the old name"
        assert _by_name(r.json(), new)["product_count"] == 1

    def test_renaming_onto_an_existing_name_is_refused(self, client, admin):
        a, b = _name("First"), _name("Second")
        client.post("/api/admin/categories", json={"name": a}, headers=admin)
        listing = client.post("/api/admin/categories", json={"name": b}, headers=admin).json()
        r = client.put(f"/api/admin/categories/{_by_name(listing, b)['id']}",
                       json={"name": a.lower()}, headers=admin)
        assert r.status_code == 409, r.text

    def test_the_copy_can_be_edited_and_cleared(self, client, admin):
        name = _name("Copy")
        listing = client.post("/api/admin/categories", json={
            "name": name, "headline": "Old line"}, headers=admin).json()
        cid = _by_name(listing, name)["id"]

        r = client.put(f"/api/admin/categories/{cid}", json={"headline": "New line"}, headers=admin)
        assert _by_name(r.json(), name)["headline"] == "New line"

        r = client.put(f"/api/admin/categories/{cid}", json={"headline": "   "}, headers=admin)
        assert _by_name(r.json(), name)["headline"] is None

    def test_hiding_takes_it_out_of_the_menus_and_showing_brings_it_back(self, client, admin):
        name = _name("Toggle")
        listing = client.post("/api/admin/categories", json={"name": name}, headers=admin).json()
        cid = _by_name(listing, name)["id"]

        client.put(f"/api/admin/categories/{cid}", json={"is_active": False}, headers=admin)
        assert not _by_name(client.get("/api/products/categories").json(), name)
        # Still in the admin's list, so it can be brought back.
        assert _by_name(client.get("/api/admin/categories", headers=admin).json(), name)

        client.put(f"/api/admin/categories/{cid}", json={"is_active": True}, headers=admin)
        assert _by_name(client.get("/api/products/categories").json(), name)


class TestOrdering:

    def test_the_menus_follow_the_admins_order(self, client, admin):
        client.post("/api/admin/categories", json={"name": _name("Order")}, headers=admin)
        ids = [c["id"] for c in client.get("/api/admin/categories", headers=admin).json()]
        flipped = list(reversed(ids))

        r = client.put("/api/admin/categories/reorder", json={"ids": flipped}, headers=admin)
        assert r.status_code == 200, r.text
        assert [c["id"] for c in r.json()] == flipped

        public = [c["id"] for c in client.get("/api/products/categories").json()]
        visible = [i for i in flipped if i in public]
        assert public == visible

        client.put("/api/admin/categories/reorder", json={"ids": ids}, headers=admin)

    def test_a_partial_list_is_refused_rather_than_merged(self, client, admin):
        ids = [c["id"] for c in client.get("/api/admin/categories", headers=admin).json()]
        r = client.put("/api/admin/categories/reorder", json={"ids": ids[:-1]}, headers=admin)
        assert r.status_code == 409, r.text

    def test_a_repeated_id_is_refused(self, client, admin):
        ids = [c["id"] for c in client.get("/api/admin/categories", headers=admin).json()]
        r = client.put("/api/admin/categories/reorder",
                       json={"ids": ids[:-1] + [ids[0]]}, headers=admin)
        assert r.status_code == 409, r.text


class TestDeleting:

    def test_an_empty_category_can_be_deleted(self, client, admin):
        name = _name("Empty")
        listing = client.post("/api/admin/categories", json={"name": name}, headers=admin).json()
        r = client.delete(f"/api/admin/categories/{_by_name(listing, name)['id']}", headers=admin)
        assert r.status_code == 200, r.text
        assert not _by_name(r.json(), name)

    def test_a_category_holding_pieces_cannot_be_deleted(self, client, admin):
        name = _name("Stocked")
        listing = client.post("/api/admin/categories", json={"name": name}, headers=admin).json()
        _product(client, admin, name)
        r = client.delete(f"/api/admin/categories/{_by_name(listing, name)['id']}", headers=admin)
        assert r.status_code == 409, r.text
        assert "hide" in r.json()["detail"].lower()


class TestSelfHealing:

    def test_a_category_products_use_is_put_back_in_the_list(self, db):
        """
        The table can never again miss a category that pieces are filed under —
        which is what four disagreeing lists produced.
        """
        import category_store
        import models
        orphan = _name("Orphan")
        db.add(models.Product(
            name="Orphaned piece", description="x", price=10.0, category=orphan,
            stock=1, is_active=True,
        ))
        db.commit()

        added = category_store.reconcile_with_products(db)
        assert orphan in added
        assert category_store.find(db, orphan) is not None
        # Idempotent: a second pass adds nothing.
        assert orphan not in category_store.reconcile_with_products(db)
