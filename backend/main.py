from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler
import os
from dotenv import load_dotenv

load_dotenv()

from database import engine, Base, SessionLocal
import models
from routers import auth, products, cart, orders, admin, payments, addresses, support, returns, wishlist, webhooks, client_errors


os.makedirs(os.getenv("UPLOAD_DIR", "uploads/products"), exist_ok=True)


# ── Auto-setup on every startup ───────────────────────────────────────────────

def _ensure_admin():
    """Create (or re-hash) the admin user so login always works after a redeploy."""
    from auth import hash_password
    db = SessionLocal()
    try:
        admin_email    = os.getenv("ADMIN_EMAIL",    "admin@vijeytextile.com")
        admin_password = os.getenv("ADMIN_PASSWORD", "VijeyTextile@2026")
        admin_phone    = os.getenv("ADMIN_PHONE",    "9443947853")

        existing = db.query(models.User).filter(models.User.email == admin_email).first()
        if existing:
            existing.password_hash = hash_password(admin_password)
            existing.is_admin    = True
            existing.is_active   = True
            existing.is_verified = True  # admin must never be locked out by the signup-OTP gate
            db.commit()
            print(f"[Startup] Admin password re-synced: {admin_email}")
        else:
            admin = models.User(
                full_name     = "Vijey Textile Admin",
                email         = admin_email,
                phone         = admin_phone,
                password_hash = hash_password(admin_password),
                is_admin      = True,
                is_active     = True,
                is_verified   = True,  # admin must never be locked out by the signup-OTP gate
            )
            db.add(admin)
            db.commit()
            print(f"[Startup] Admin user created: {admin_email}")
    finally:
        db.close()


def _ensure_products():
    """Seed products if the table is empty."""
    db = SessionLocal()
    try:
        count = db.query(models.Product).count()
        if count == 0:
            from seed_data import seed
            seed()
            print("[Startup] Products seeded.")
        else:
            print(f"[Startup] {count} products already in database.")
    finally:
        db.close()


def _migrate_db():
    """Add new columns/tables without dropping data. Each step is independently safe."""
    from sqlalchemy import text, inspect as sa_inspect
    with engine.connect() as conn:
        inspector = sa_inspect(engine)

        # ── users columns ──────────────────────────────────────────────────
        try:
            user_cols = [c["name"] for c in inspector.get_columns("users")]
            if "scheduled_delete_at" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN scheduled_delete_at TIMESTAMP WITH TIME ZONE"))
                conn.commit()
                print("[Startup] Migrated: added scheduled_delete_at to users")
            if "is_deactivated" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN is_deactivated BOOLEAN NOT NULL DEFAULT FALSE"))
                conn.commit()
                print("[Startup] Migrated: added is_deactivated to users")
            if "deactivated_at" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN deactivated_at TIMESTAMP WITH TIME ZONE"))
                conn.commit()
                print("[Startup] Migrated: added deactivated_at to users")
            if "is_verified" not in user_cols:
                # DEFAULT TRUE so every existing customer stays able to log in —
                # only brand-new signups start unverified and go through OTP.
                conn.execute(text("ALTER TABLE users ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT TRUE"))
                conn.commit()
                print("[Startup] Migrated: added is_verified to users")
        except Exception as e:
            print(f"[Startup] User migration note: {e}")

        # ── orders columns ─────────────────────────────────────────────────
        try:
            orders_cols = [c["name"] for c in inspector.get_columns("orders")]
            if "open_box_delivery" not in orders_cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN open_box_delivery BOOLEAN NOT NULL DEFAULT FALSE"))
                conn.commit()
                print("[Startup] Migrated: added open_box_delivery to orders")
            if "delivery_otp" not in orders_cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN delivery_otp VARCHAR(10)"))
                conn.commit()
                print("[Startup] Migrated: added delivery_otp to orders")
            if "delivery_person_name" not in orders_cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN delivery_person_name VARCHAR(100)"))
                conn.commit()
                print("[Startup] Migrated: added delivery_person_name to orders")
            if "delivery_person_phone" not in orders_cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN delivery_person_phone VARCHAR(20)"))
                conn.commit()
                print("[Startup] Migrated: added delivery_person_phone to orders")
            if "awb_code" not in orders_cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN awb_code VARCHAR(50)"))
                conn.commit()
                print("[Startup] Migrated: added awb_code to orders")
            if "courier_name" not in orders_cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN courier_name VARCHAR(100)"))
                conn.commit()
                print("[Startup] Migrated: added courier_name to orders")
            if "tracking_url" not in orders_cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN tracking_url VARCHAR(500)"))
                conn.commit()
                print("[Startup] Migrated: added tracking_url to orders")
            if "estimated_delivery" not in orders_cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN estimated_delivery VARCHAR(50)"))
                conn.commit()
                print("[Startup] Migrated: added estimated_delivery to orders")
            if "status_location" not in orders_cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN status_location VARCHAR(255)"))
                conn.commit()
                print("[Startup] Migrated: added status_location to orders")
            if "shiprocket_order_id" not in orders_cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN shiprocket_order_id VARCHAR(50)"))
                conn.commit()
                print("[Startup] Migrated: added shiprocket_order_id to orders")
            if "shiprocket_shipment_id" not in orders_cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN shiprocket_shipment_id VARCHAR(50)"))
                conn.commit()
                print("[Startup] Migrated: added shiprocket_shipment_id to orders")
            if "cancel_reason" not in orders_cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN cancel_reason VARCHAR(255)"))
                conn.commit()
                print("[Startup] Migrated: added cancel_reason to orders")
            if "cancelled_by" not in orders_cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN cancelled_by VARCHAR(20)"))
                conn.commit()
                print("[Startup] Migrated: added cancelled_by to orders")
            if "delivered_at" not in orders_cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN delivered_at TIMESTAMP WITH TIME ZONE"))
                conn.commit()
                print("[Startup] Migrated: added delivered_at to orders")
            if "rto_pending" not in orders_cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN rto_pending BOOLEAN DEFAULT FALSE"))
                conn.commit()
                print("[Startup] Migrated: added rto_pending to orders")
        except Exception as e:
            print(f"[Startup] Orders migration note: {e}")

        # ── products columns ───────────────────────────────────────────────
        try:
            products_cols = [c["name"] for c in inspector.get_columns("products")]
            if "is_featured" not in products_cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT FALSE"))
                conn.commit()
                print("[Startup] Migrated: added is_featured to products")
            if "is_new_arrival" not in products_cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN is_new_arrival BOOLEAN NOT NULL DEFAULT FALSE"))
                conn.commit()
                print("[Startup] Migrated: added is_new_arrival to products")
            if "is_returnable" not in products_cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN is_returnable BOOLEAN NOT NULL DEFAULT TRUE"))
                conn.commit()
                print("[Startup] Migrated: added is_returnable to products")
            if "video_url" not in products_cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN video_url VARCHAR(500)"))
                conn.commit()
                print("[Startup] Migrated: added video_url to products")
            if "video_orientation" not in products_cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN video_orientation VARCHAR(20) DEFAULT 'landscape'"))
                conn.commit()
                print("[Startup] Migrated: added video_orientation to products")
            if "fit" not in products_cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN fit VARCHAR(100)"))
                conn.commit()
                print("[Startup] Migrated: added fit to products")
            if "material" not in products_cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN material VARCHAR(255)"))
                conn.commit()
                print("[Startup] Migrated: added material to products")
            if "care_instructions" not in products_cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN care_instructions TEXT"))
                conn.commit()
                print("[Startup] Migrated: added care_instructions to products")
        except Exception as e:
            print(f"[Startup] Products migration note: {e}")

        # ── return_requests columns (exchange-for-any-product + price-diff payment) ──
        try:
            if "return_requests" in inspector.get_table_names():
                rr_cols = [c["name"] for c in inspector.get_columns("return_requests")]
                if "product_id" not in rr_cols:
                    conn.execute(text("ALTER TABLE return_requests ADD COLUMN product_id INTEGER REFERENCES products(id) ON DELETE SET NULL"))
                    conn.commit()
                    print("[Startup] Migrated: added product_id to return_requests")
                if "original_price" not in rr_cols:
                    conn.execute(text("ALTER TABLE return_requests ADD COLUMN original_price FLOAT"))
                    conn.commit()
                    print("[Startup] Migrated: added original_price to return_requests")
                if "new_product_id" not in rr_cols:
                    conn.execute(text("ALTER TABLE return_requests ADD COLUMN new_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL"))
                    conn.commit()
                    print("[Startup] Migrated: added new_product_id to return_requests")
                if "new_size" not in rr_cols:
                    conn.execute(text("ALTER TABLE return_requests ADD COLUMN new_size VARCHAR(10)"))
                    conn.commit()
                    print("[Startup] Migrated: added new_size to return_requests")
                if "new_color" not in rr_cols:
                    conn.execute(text("ALTER TABLE return_requests ADD COLUMN new_color VARCHAR(50)"))
                    conn.commit()
                    print("[Startup] Migrated: added new_color to return_requests")
                if "price_difference" not in rr_cols:
                    conn.execute(text("ALTER TABLE return_requests ADD COLUMN price_difference FLOAT DEFAULT 0"))
                    conn.commit()
                    print("[Startup] Migrated: added price_difference to return_requests")
                if "price_diff_payment_id" not in rr_cols:
                    conn.execute(text("ALTER TABLE return_requests ADD COLUMN price_diff_payment_id VARCHAR(100)"))
                    conn.commit()
                    print("[Startup] Migrated: added price_diff_payment_id to return_requests")
                if "return_awb" not in rr_cols:
                    conn.execute(text("ALTER TABLE return_requests ADD COLUMN return_awb VARCHAR(50)"))
                    conn.commit()
                    print("[Startup] Migrated: added return_awb to return_requests")
                if "return_tracking_url" not in rr_cols:
                    conn.execute(text("ALTER TABLE return_requests ADD COLUMN return_tracking_url VARCHAR(255)"))
                    conn.commit()
                    print("[Startup] Migrated: added return_tracking_url to return_requests")
                if "pickup_otp" not in rr_cols:
                    conn.execute(text("ALTER TABLE return_requests ADD COLUMN pickup_otp VARCHAR(10)"))
                    conn.commit()
                    print("[Startup] Migrated: added pickup_otp to return_requests")
                if "replacement_awb" not in rr_cols:
                    conn.execute(text("ALTER TABLE return_requests ADD COLUMN replacement_awb VARCHAR(50)"))
                    conn.commit()
                    print("[Startup] Migrated: added replacement_awb to return_requests")
                if "replacement_tracking_url" not in rr_cols:
                    conn.execute(text("ALTER TABLE return_requests ADD COLUMN replacement_tracking_url VARCHAR(255)"))
                    conn.commit()
                    print("[Startup] Migrated: added replacement_tracking_url to return_requests")
                if "pickup_error" not in rr_cols:
                    conn.execute(text("ALTER TABLE return_requests ADD COLUMN pickup_error TEXT"))
                    conn.commit()
                    print("[Startup] Migrated: added pickup_error to return_requests")
                if "replacement_error" not in rr_cols:
                    conn.execute(text("ALTER TABLE return_requests ADD COLUMN replacement_error TEXT"))
                    conn.commit()
                    print("[Startup] Migrated: added replacement_error to return_requests")
                if "pickup_last_status" not in rr_cols:
                    conn.execute(text("ALTER TABLE return_requests ADD COLUMN pickup_last_status TEXT"))
                    conn.commit()
                    print("[Startup] Migrated: added pickup_last_status to return_requests")
        except Exception as e:
            print(f"[Startup] Return-requests migration note: {e}")

        # ── new tables ─────────────────────────────────────────────────────
        try:
            existing_tables = inspector.get_table_names()
            if "support_ratings" not in existing_tables:
                conn.execute(text("""
                    CREATE TABLE support_ratings (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                        name VARCHAR(100) NOT NULL,
                        email VARCHAR(255) NOT NULL,
                        phone VARCHAR(20),
                        rating INTEGER NOT NULL,
                        category VARCHAR(100),
                        message TEXT,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    )
                """))
                conn.commit()
                print("[Startup] Migrated: created support_ratings table")
            if "reviews" not in existing_tables:
                conn.execute(text("""
                    CREATE TABLE reviews (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                        rating INTEGER NOT NULL,
                        title VARCHAR(255),
                        comment TEXT,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    )
                """))
                conn.commit()
                print("[Startup] Migrated: created reviews table")
            if "support_interactions" not in existing_tables:
                conn.execute(text("""
                    CREATE TABLE support_interactions (
                        id SERIAL PRIMARY KEY,
                        cs_name VARCHAR(100) NOT NULL,
                        cs_email VARCHAR(255),
                        cs_phone VARCHAR(20),
                        customer_name VARCHAR(100) NOT NULL,
                        customer_email VARCHAR(255) NOT NULL,
                        customer_phone VARCHAR(20),
                        customer_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                        issue_summary VARCHAR(500),
                        rating_token VARCHAR(100) UNIQUE NOT NULL,
                        rating INTEGER,
                        rating_comment TEXT,
                        rated_at TIMESTAMP WITH TIME ZONE,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    )
                """))
                conn.commit()
                print("[Startup] Migrated: created support_interactions table")
            if "return_requests" not in existing_tables:
                conn.execute(text("""
                    CREATE TABLE return_requests (
                        id SERIAL PRIMARY KEY,
                        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        request_type VARCHAR(20) NOT NULL,
                        reason VARCHAR(100) NOT NULL,
                        description TEXT,
                        images JSON DEFAULT '[]',
                        status VARCHAR(50) DEFAULT 'pending',
                        admin_notes TEXT,
                        refund_id VARCHAR(100),
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                        updated_at TIMESTAMP WITH TIME ZONE,
                        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
                        original_price FLOAT,
                        new_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
                        new_size VARCHAR(10),
                        new_color VARCHAR(50),
                        price_difference FLOAT DEFAULT 0,
                        price_diff_payment_id VARCHAR(100)
                    )
                """))
                conn.commit()
                print("[Startup] Migrated: created return_requests table")
            if "wishlist_items" not in existing_tables:
                conn.execute(text("""
                    CREATE TABLE wishlist_items (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                        UNIQUE(user_id, product_id)
                    )
                """))
                conn.commit()
                print("[Startup] Migrated: created wishlist_items table")
        except Exception as e:
            print(f"[Startup] New table migration note: {e}")

        # ── user_sessions columns ──────────────────────────────────────────
        try:
            session_cols = [c["name"] for c in inspector.get_columns("user_sessions")]
            if "expires_at" not in session_cols:
                conn.execute(text("ALTER TABLE user_sessions ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE"))
                conn.commit()
                # Give every currently-valid session a fresh expiry as of this
                # deploy rather than leaving it NULL — a NULL is treated as
                # "not expired" downstream so nothing breaks either way, but
                # backfilling means the sliding-window logic has a real value
                # to extend from the next time each session is used.
                conn.execute(text(
                    "UPDATE user_sessions SET expires_at = NOW() + INTERVAL '90 days' "
                    "WHERE expires_at IS NULL AND revoked_at IS NULL"
                ))
                conn.commit()
                print("[Startup] Migrated: added expires_at to user_sessions")
        except Exception as e:
            print(f"[Startup] user_sessions migration note: {e}")

    # Fix size options — Vijey Textile sells kids/girls clothing only.
    # ALL products must use numeric sizes 12–40 (no adult letter sizes).
    try:
        db = SessionLocal()
        KIDS_SIZES = ["12", "14", "16", "18", "20", "22", "24", "26", "28",
                      "30", "32", "34", "36", "38", "40"]
        updated = 0
        for product in db.query(models.Product).all():
            if product.size_options != KIDS_SIZES:
                product.size_options = KIDS_SIZES
                updated += 1
        if updated:
            db.commit()
            print(f"[Startup] Fixed sizes: updated {updated} product(s) to kids sizes 12–40.")

        # Seed Half Saree products if none exist
        hs_count = db.query(models.Product).filter(models.Product.category == "Half Saree").count()
        if hs_count == 0:
            from seed_data import PRODUCTS
            hs_products = [p for p in PRODUCTS if p["category"] == "Half Saree"]
            for p in hs_products:
                db.add(models.Product(**p))
            db.commit()
            print(f"[Startup] Added {len(hs_products)} Half Saree product(s).")

        # Seed categories table if empty
        cat_count = db.query(models.Category).count()
        if cat_count == 0:
            DEFAULT_CATEGORIES = [
                {"name": "Baby Frocks",     "emoji": "👶", "description": "Soft & Cute Baby Wear", "sort_order": 1},
                {"name": "Chudithar",       "emoji": "👘", "description": "Traditional Elegance",  "sort_order": 2},
                {"name": "Frocks",          "emoji": "👗", "description": "Classic & Printed",     "sort_order": 3},
                {"name": "Western Dresses", "emoji": "👒", "description": "Modern & Trendy",       "sort_order": 4},
                {"name": "Lehenga",         "emoji": "💃", "description": "Festive & Bridal",      "sort_order": 5},
                {"name": "Party Wear",      "emoji": "✨", "description": "Glam & Celebrations",   "sort_order": 6},
            ]
            for c in DEFAULT_CATEGORIES:
                db.add(models.Category(**c))
            db.commit()
            print("[Startup] Categories seeded.")
        db.close()
    except Exception as e:
        print(f"[Startup] Size/seed migration note: {e}")


def _cleanup_deleted_accounts():
    """Permanently remove accounts whose deletion window has passed.
    Sends a 'permanently deleted' email to each user before wiping their data.
    """
    from datetime import datetime, timezone
    import notifications as _notif
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        expired = db.query(models.User).filter(
            models.User.scheduled_delete_at.isnot(None),
            models.User.scheduled_delete_at <= now,
        ).all()
        for u in expired:
            # ── Send final goodbye email BEFORE deleting (while we still have the address) ──
            try:
                _notif.send_account_permanently_deleted_email(u.email, u.full_name)
                print(f"[Cleanup] Sent deletion-confirmed email → {u.email}")
            except Exception as e:
                print(f"[Cleanup] Could not send deletion email to {u.email}: {e}")
            db.delete(u)
        if expired:
            db.commit()
            print(f"[Startup] Permanently deleted {len(expired)} expired account(s).")
    finally:
        db.close()


def _sync_delhivery_statuses():
    """
    Runs on a timer (see lifespan below): pulls live tracking for every order
    with an open Delhivery shipment and advances its status via
    courier_sync.sync_all_open_orders() — the piece that makes Shipped ->
    Out for Delivery move on its own instead of needing an admin to notice a
    courier scan and update it by hand. Also runs
    courier_sync.sync_all_open_returns() for the same reason, on the
    replacement-shipment leg of exchanges.

    This timer alone is best-effort: a host that spins down when idle stops
    it along with everything else until the next request wakes the process
    back up. courier_sync.sync_all_open_orders() is also called
    opportunistically whenever the admin orders dashboard loads and via a
    manual "Sync now" action (routers/admin.py), plus the Delhivery webhook
    receiver (routers/webhooks.py) and the customer's own tracking-page view
    (routers/orders.py) — real activity, not just this clock, is what keeps
    orders caught up in practice.
    """
    import courier_sync

    db = SessionLocal()
    try:
        changes = courier_sync.sync_all_open_orders(db)
        for c in changes:
            print(f"[Delhivery Poll] {c}")
        return_changes = courier_sync.sync_all_open_returns(db)
        for c in return_changes:
            print(f"[Delhivery Poll] {c}")
    finally:
        db.close()


_scheduler = BackgroundScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables
    Base.metadata.create_all(bind=engine)
    # Migrate new columns without data loss
    _migrate_db()
    # Delete accounts whose 4-hour deletion window expired + send goodbye email
    _cleanup_deleted_accounts()
    # Always ensure admin + products exist
    _ensure_admin()
    _ensure_products()

    _scheduler.add_job(_sync_delhivery_statuses, "interval", minutes=15, id="delhivery_sync", replace_existing=True)
    _scheduler.start()
    yield
    _scheduler.shutdown(wait=False)


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title       = "Vijey Textile API",
    description = "Premium Textile Shopping — Texvalley Gangapuram",
    version     = "3.0.0",
    lifespan    = lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://vijeytextile.com",
        "https://www.vijeytextile.com",
        "https://vijey-textile.vercel.app",
        "https://www.vijey-textile.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-New-Token"],
)

upload_dir = os.getenv("UPLOAD_DIR", "uploads/products")
app.mount("/uploads/products", StaticFiles(directory=upload_dir), name="product_images")

app.include_router(auth.router)
app.include_router(products.router)
app.include_router(cart.router)
app.include_router(orders.router)
app.include_router(admin.router)
app.include_router(payments.router)
app.include_router(addresses.router)
app.include_router(support.router)
app.include_router(returns.router)
app.include_router(wishlist.router)
app.include_router(webhooks.router)
# Additive: receives browser-side runtime errors. Touches no existing route.
app.include_router(client_errors.router)
# Tracking is wired into orders router (/api/orders/{id}/track)


@app.get("/")
def root():
    return {
        "store":    "Vijey Textile",
        "location": "Shop Ground Floor No 131, Texvalley Gangapuram",
        "status":   "API is running",
        "docs":     "/docs",
    }


@app.api_route("/health", methods=["GET", "HEAD"])
def health():
    return {"status": "healthy"}


@app.get("/seed")
def seed_database():
    from seed_data import seed
    seed()
    return {"status": "Database seeded successfully"}


@app.get("/reset-admin")
def reset_admin():
    _ensure_admin()
    admin_email = os.getenv("ADMIN_EMAIL", "admin@vijeytextile.com")
    return {"status": "Admin reset successfully", "email": admin_email}


@app.get("/test-notification")
def test_notification(to: str = "", type: str = "welcome"):
    """
    Instantly send a real notification email to verify the template.
    Usage: GET /test-notification?to=your@email.com&type=welcome
    Types: welcome | order | payment | admin | deletion | retrieved | deleted
    """
    import notifications as _n
    target = to.strip() or os.getenv("SMTP_EMAIL", "admin@vijeytextile.com")

    class _FakeOrder:
        order_number = "VJT-TEST-001"
        id = 1
        total = 1499.00
        subtotal = 1499.00
        shipping_fee = 0
        discount = 0
        status = "confirmed"
        payment_status = "paid"
        payment_method = "razorpay"
        payment_transaction_id = "pay_TEST123"
        tracking_number = None
        items_snapshot = [{"name": "Silk Chudithar", "quantity": 1,
                           "price": 1499, "subtotal": 1499,
                           "product_id": 1, "size": "L", "color": "Maroon"}]
        shipping_address = {"full_name": "Test Customer", "phone": "9876543210",
                            "address_line1": "123 Test Street", "city": "Coimbatore",
                            "state": "Tamil Nadu", "pincode": "641001"}
        created_at = __import__("datetime").datetime.now()

    t = type.lower()
    name = "Kumaraguru"
    if t == "admin":
        _n.send_admin_access_email(target, name)
    elif t == "order":
        _n.send_order_confirmation_email(target, name, _FakeOrder())
    elif t == "payment":
        _n.send_payment_success_email(target, name, _FakeOrder())
    elif t == "deletion":
        import datetime as _dt
        _n.send_deletion_scheduled_email(target, name,
            _dt.datetime.now(_dt.timezone.utc) + _dt.timedelta(hours=4))
    elif t == "retrieved":
        _n.send_account_retrieved_email(target, name)
    elif t == "deleted":
        _n.send_account_permanently_deleted_email(target, name)
    else:  # welcome
        _n.send_welcome_email(target, name)

    return {"status": "sent", "to": target, "type": t,
            "note": "Check your inbox (and spam folder). Email sent in background."}


@app.get("/test-email")
def test_email(to: str = ""):
    """
    Diagnostic endpoint — tests email delivery and returns the exact result.
    Tries Brevo first, then SendGrid, then reports SMTP status.
    Usage: GET /test-email?to=youremail@gmail.com
    """
    import json as _json, urllib.request as _req, urllib.error as _uerr

    brevo_key  = os.getenv("BREVO_API_KEY", "")
    sg_key     = os.getenv("SENDGRID_API_KEY", "")
    smtp_email = os.getenv("SMTP_EMAIL", "")
    target     = to.strip() if to.strip() else smtp_email or "admin@vijeytextile.com"

    # ── Test via Brevo ───────────────────────────────────────────────────────────
    if brevo_key:
        from_email = smtp_email or "noreply@vijeytextile.com"
        payload = _json.dumps({
            "sender": {"name": "Vijey Textile", "email": from_email},
            "to": [{"email": target}],
            "subject": "✅ Vijey Textile — Email Test (Brevo)",
            "htmlContent": (
                "<h2 style='color:#6d28d9'>Email delivery is working! ✅</h2>"
                "<p>This test email was sent from the Vijey Textile backend on Render "
                "using Brevo. If you're reading this, emails (OTPs, order confirmations, etc.) "
                "are now working correctly.</p>"
                "<p style='color:#888;font-size:12px;'>Sent from vijey-textile.onrender.com</p>"
            ),
        }).encode()
        try:
            request = _req.Request(
                "https://api.brevo.com/v3/smtp/email",
                data=payload,
                headers={"api-key": brevo_key, "Content-Type": "application/json", "Accept": "application/json"},
            )
            with _req.urlopen(request, timeout=15) as resp:
                return {
                    "status":  "success",
                    "method":  "Brevo",
                    "message": f"Test email sent to {target}. Check inbox + spam folder.",
                    "from":    from_email,
                    "to":      target,
                    "http_status": resp.status,
                }
        except _uerr.HTTPError as e:
            body = e.read().decode(errors="ignore")
            return {
                "status":  "error",
                "method":  "Brevo",
                "type":    f"HTTP {e.code}",
                "message": body,
                "hint":    (
                    "Common causes: (1) API key is wrong/expired — check app.brevo.com/settings/keys/api, "
                    "(2) Sender email not verified — go to app.brevo.com → Senders, Domains & Dedicated IPs."
                ),
            }
        except Exception as e:
            return {"status": "error", "method": "Brevo", "type": type(e).__name__, "message": str(e)}

    # ── Test via SendGrid ──────────────────────────────────────────────────────
    if sg_key:
        from_email = smtp_email or "noreply@ammalu-tex.com"
        payload = _json.dumps({
            "personalizations": [{"to": [{"email": target}]}],
            "from": {"email": from_email, "name": "Vijey Textile"},
            "subject": "✅ Vijey Textile — Email Test (SendGrid)",
            "content": [{
                "type": "text/html",
                "value": (
                    "<h2 style='color:#6d28d9'>Email delivery is working! ✅</h2>"
                    "<p>This test email was sent from the Vijey Textile backend on Render "
                    "using SendGrid. If you're reading this, emails (OTPs, order confirmations, etc.) "
                    "are now working correctly.</p>"
                    "<p style='color:#888;font-size:12px;'>Sent from vijey-textile.onrender.com</p>"
                ),
            }],
        }).encode()
        try:
            request = _req.Request(
                "https://api.sendgrid.com/v3/mail/send",
                data=payload,
                headers={"Authorization": f"Bearer {sg_key}", "Content-Type": "application/json"},
            )
            with _req.urlopen(request, timeout=15) as resp:
                return {
                    "status":  "success",
                    "method":  "SendGrid",
                    "message": f"Test email sent to {target}. Check inbox + spam folder.",
                    "from":    from_email,
                    "to":      target,
                    "http_status": resp.status,
                }
        except _uerr.HTTPError as e:
            body = e.read().decode(errors="ignore")
            return {
                "status":  "error",
                "method":  "SendGrid",
                "type":    f"HTTP {e.code}",
                "message": body,
                "hint":    (
                    "Common causes: (1) API key is wrong/expired — regenerate at app.sendgrid.com/settings/api_keys, "
                    "(2) Sender email not verified — go to app.sendgrid.com → Settings → Sender Authentication."
                ),
            }
        except Exception as e:
            return {"status": "error", "method": "SendGrid", "type": type(e).__name__, "message": str(e)}

    # ── No Brevo/SendGrid key — report setup instructions ──────────────────────
    return {
        "status":  "not_configured",
        "message": (
            "Neither BREVO_API_KEY nor SENDGRID_API_KEY is set. "
            "Render free tier blocks SMTP ports, so one of these is required. "
            "Steps: (1) Sign up free at brevo.com (300 emails/day, no card needed), "
            "(2) Senders, Domains & Dedicated IPs → add + verify your sender email, "
            "(3) Settings → SMTP & API → API Keys → Generate a new API key, "
            "(4) Add BREVO_API_KEY to Render environment variables."
        ),
        "smtp_email_set": bool(smtp_email),
    }
