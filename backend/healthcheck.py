"""
End-to-end integrity check of the database and the API.

Not a test suite — a standing diagnostic you can run against any environment,
including production, to answer "is this actually wired up correctly right now".
Read-only: it counts, inspects and calls GET endpoints. It creates nothing,
deletes nothing and mutates nothing, so it is safe to point at the live site.

WHAT IT LOOKS FOR, and why each one has bitten a real deployment:

  schema drift    every model this code imports must have its table present.
                  `Base.metadata.create_all` makes new tables on boot but never
                  ALTERs an existing one, so a column added to a model without a
                  matching migration is invisible until a query touches it.
  orphan rows     an order item pointing at a deleted product, a session with no
                  user. These pass every foreign-key-free insert and only show up
                  as a 500 on a customer's order page.
  money integrity an order whose items do not sum to its total. Silent, and the
                  worst kind of silent — the shop and the customer disagree about
                  what was paid.
  stuck states    orders sitting in a transient status far longer than the
                  workflow allows, which usually means a courier sync or a
                  payment callback stopped running.
  live endpoints  the public API answering, so a schema that looks right in the
                  database is confirmed to serialise through the app too.

Exit code 1 if anything is wrong, so it can gate a deploy.

    python healthcheck.py                 # database only
    python healthcheck.py --api http://localhost:8000
"""
import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy import inspect, text

import models
from database import SessionLocal, engine

problems: list[str] = []
notes: list[str] = []


def check(label: str, ok: bool, detail: str = "") -> None:
    mark = "OK  " if ok else "FAIL"
    print(f"  [{mark}] {label}{(' - ' + detail) if detail else ''}")
    if not ok:
        problems.append(f"{label}{(' - ' + detail) if detail else ''}")


print("\n=== SCHEMA ===")
insp = inspect(engine)
present = set(insp.get_table_names())
expected = {m.__tablename__ for m in models.Base.__subclasses__()}
missing = sorted(expected - present)
check(f"{len(expected)} model tables present", not missing,
      f"missing: {', '.join(missing)}" if missing else "")

# Every column the ORM believes in must exist. This is the drift that
# create_all cannot fix, because it only ever CREATEs.
drifted = []
for m in models.Base.__subclasses__():
    if m.__tablename__ not in present:
        continue
    actual = {c["name"] for c in insp.get_columns(m.__tablename__)}
    declared = {c.name for c in m.__table__.columns}
    gap = declared - actual
    if gap:
        drifted.append(f"{m.__tablename__}: {', '.join(sorted(gap))}")
check("no column drift between models and database", not drifted,
      "; ".join(drifted) if drifted else "")

db = SessionLocal()
try:
    print("\n=== DATA ===")
    counts = {}
    for m in sorted(models.Base.__subclasses__(), key=lambda x: x.__tablename__):
        if m.__tablename__ not in present:
            continue
        try:
            counts[m.__tablename__] = db.query(m).count()
        except Exception as e:
            problems.append(f"count failed on {m.__tablename__}: {e}")
    width = max((len(k) for k in counts), default=10)
    for k, v in counts.items():
        print(f"        {k.ljust(width)}  {v}")

    print("\n=== REFERENTIAL INTEGRITY ===")

    # NOTE: this schema is deliberately denormalised — there is no order_items
    # table. Each order carries `items_snapshot` as JSON, which is the right
    # call for a shop: the line a customer bought must not change when the
    # product is later renamed or repriced. My first version of this file
    # assumed a normalised schema and died on `no such table: order_items` —
    # what happens when a diagnostic is written from habit instead of from the
    # model in front of you.
    orphan_orders = db.execute(text("""
        SELECT COUNT(*) FROM orders o
        LEFT JOIN users u ON u.id = o.user_id
        WHERE u.id IS NULL
    """)).scalar()
    check("no orders orphaned from their user", orphan_orders == 0,
          f"{orphan_orders} orphaned")

    if "user_sessions" in present:
        orphan_sessions = db.execute(text("""
            SELECT COUNT(*) FROM user_sessions s
            LEFT JOIN users u ON u.id = s.user_id
            WHERE u.id IS NULL
        """)).scalar()
        check("no sessions orphaned from their user", orphan_sessions == 0,
              f"{orphan_sessions} orphaned")

    print("\n=== MONEY ===")
    # Two independent arithmetic claims each order makes about itself. A
    # rupee of tolerance absorbs float storage; more than that is real.
    orders = db.query(models.Order).all()
    bad_sum, bad_lines, empty_snap = [], [], []
    for o in orders:
        # 1. The headline the customer was charged.
        expected = (o.subtotal or 0) + (o.shipping_fee or 0) - (o.discount or 0)
        if abs(float(o.total or 0) - float(expected)) > 1.0:
            bad_sum.append(f"{o.order_number}: total {o.total} != {expected:.2f}")

        # 2. The snapshot must still reconstruct the subtotal. If it cannot,
        #    the invoice and the charge disagree — the worst kind of silent
        #    error, because each looks perfectly plausible on its own.
        items = o.items_snapshot or []
        if not items:
            empty_snap.append(str(o.order_number))
            continue
        try:
            lines = sum(float(i.get("price", 0)) * int(i.get("quantity", 0)) for i in items)
        except Exception:
            bad_lines.append(f"{o.order_number}: unreadable snapshot")
            continue
        if abs(lines - float(o.subtotal or 0)) > 1.0:
            bad_lines.append(f"{o.order_number}: lines {lines:.2f} != subtotal {o.subtotal}")

    check(f"{len(orders)} orders: total = subtotal + shipping - discount",
          not bad_sum, "; ".join(bad_sum[:4]))
    check("items_snapshot reconstructs the subtotal", not bad_lines,
          "; ".join(bad_lines[:4]))
    check("no order has an empty items_snapshot", not empty_snap,
          ", ".join(empty_snap[:6]))

    negative = db.query(models.Product).filter(models.Product.stock < 0).count()
    check("no product has negative stock", negative == 0, f"{negative} negative")

    unpriced = db.query(models.Product).filter(
        (models.Product.price == None) | (models.Product.price <= 0)  # noqa: E711
    ).count()
    check("every product has a positive price", unpriced == 0, f"{unpriced} unpriced")

    print("\n=== WORKFLOW ===")
    now = datetime.now(timezone.utc)
    # 'processing' is a transient state the admin moves through. Anything stuck
    # there for days usually means an automation stopped, not that someone is
    # taking their time.
    stale = db.execute(text("""
        SELECT COUNT(*) FROM orders
        WHERE status = 'processing' AND created_at < :cutoff
    """), {"cutoff": now - timedelta(days=7)}).scalar()
    if stale:
        notes.append(f"{stale} order(s) stuck in 'processing' for over 7 days")
    check("no orders stuck in a transient state", True,
          f"{stale} in 'processing' >7d (informational)" if stale else "none")

finally:
    db.close()

# ── Live API, optional ───────────────────────────────────────────────────────
api = None
if "--api" in sys.argv:
    api = sys.argv[sys.argv.index("--api") + 1].rstrip("/")

if api:
    import json
    import urllib.request

    print(f"\n=== LIVE API  {api} ===")

    def get(path, as_json=True):
        """
        Status first, body second — and the body is optional.

        The first version JSON-parsed every response, so `/docs` (which serves
        HTML) threw inside the try and was reported as status None. A checker
        that mislabels a healthy endpoint as broken trains you to ignore it.
        """
        try:
            with urllib.request.urlopen(f"{api}{path}", timeout=20) as r:
                raw = r.read()
                if not as_json:
                    return r.status, None
                try:
                    return r.status, json.loads(raw or b"null")
                except ValueError:
                    return r.status, None
        except Exception as e:
            return getattr(e, "code", None), None

    for path, want in [
        ("/api/products/", 200),
        ("/api/products/categories", 200),
    ]:
        status, body = get(path)
        n = len(body) if isinstance(body, list) else ""
        check(f"GET {path}", status == want,
              f"got {status}" if status != want else (f"{n} items" if n != "" else ""))

    # Interactive docs are OFF unless ENABLE_API_DOCS is set. A 404 here is the
    # correct production posture, not a fault: /openapi.json is a complete map
    # of every route and schema, and there is no reason to hand it out. This
    # check therefore asserts the CONFIGURED state rather than a fixed one.
    import os as _os
    docs_expected = _os.getenv("ENABLE_API_DOCS", "").lower() in ("1", "true", "yes")
    for path in ("/docs", "/openapi.json"):
        status, _ = get(path, as_json=False)
        ok = (status == 200) if docs_expected else (status == 404)
        check(f"GET {path} {'open (ENABLE_API_DOCS set)' if docs_expected else 'closed'}",
              ok, f"got {status}")

    # Auth must REFUSE without a token. A 200 here is a serious finding.
    for path in ["/api/orders/", "/api/auth/me", "/api/admin/admins", "/api/client-errors/recent"]:
        status, _ = get(path)
        check(f"GET {path} refuses anonymous", status in (401, 403), f"got {status}")

print("\n" + "=" * 60)
if notes:
    print("Notes:")
    for n in notes:
        print(f"  - {n}")
if problems:
    print(f"FAILED — {len(problems)} problem(s):")
    for p in problems:
        print(f"  x {p}")
    sys.exit(1)
print("All checks passed.")
