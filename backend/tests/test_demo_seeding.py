"""
A live shop is never refilled with demo pieces on boot.

WHY THIS EXISTS. _ensure_products() learned to seed only behind
SEED_DEMO_PRODUCTS, but _migrate_db() kept a second, unguarded seed that put
three demo Half Sarees back on every boot whenever the shop had none. Once the
workroom could delete a piece for good, deleting the last real Half Saree meant
three invented ones, orderable and unpostable, reappeared at the next restart.

Each test runs against its own empty database, so nothing in the shared test
database decides the answer. Identical in both shops; Vijey Textile's seed data
has no Half Sarees, which the opt-in test accounts for rather than assumes.
"""
import inspect

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


@pytest.fixture()
def empty_shop(tmp_path):
    import models
    engine = create_engine(f"sqlite:///{(tmp_path / 'shop.db').as_posix()}")
    models.Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _half_sarees(db):
    import models
    return db.query(models.Product).filter(models.Product.category == "Half Saree").count()


def test_a_shop_with_no_half_sarees_stays_that_way(empty_shop, monkeypatch):
    import main
    monkeypatch.delenv("SEED_DEMO_PRODUCTS", raising=False)
    assert main._seed_demo_half_sarees(empty_shop) == 0
    assert _half_sarees(empty_shop) == 0, "demo Half Sarees were added to a live shop on boot"


def test_a_developer_can_still_ask_for_them(empty_shop, monkeypatch):
    import main
    import seed_data
    monkeypatch.setenv("SEED_DEMO_PRODUCTS", "1")
    expected = sum(p["category"] == "Half Saree" for p in seed_data.PRODUCTS)
    assert main._seed_demo_half_sarees(empty_shop) == expected
    assert _half_sarees(empty_shop) == expected


def test_opting_in_never_adds_to_half_sarees_already_there(empty_shop, monkeypatch):
    import main
    import models
    monkeypatch.setenv("SEED_DEMO_PRODUCTS", "1")
    empty_shop.add(models.Product(name="A real saree", description="Hand-finished.",
                                  price=1200.0, category="Half Saree", stock=1, is_active=True))
    empty_shop.commit()
    assert main._seed_demo_half_sarees(empty_shop) == 0
    assert _half_sarees(empty_shop) == 1


def test_boot_migrations_do_not_seed_anything_themselves():
    """
    The wiring. Any demo seeding has to go through the guarded functions, so
    _migrate_db must not reach into seed_data directly. That is exactly the
    shape of the bug this file was written for.
    """
    import main
    source = inspect.getsource(main._migrate_db)
    assert "seed_data" not in source, "_migrate_db seeds from seed_data outside the SEED_DEMO_PRODUCTS switch"
    assert "_seed_demo_half_sarees(" in source
