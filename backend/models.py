from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, JSON, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    full_name     = Column(String(100), nullable=False)
    email         = Column(String(255), unique=True, index=True, nullable=False)
    phone         = Column(String(15), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    address_line1 = Column(String(255), nullable=True)
    address_line2 = Column(String(255), nullable=True)
    city          = Column(String(100), nullable=True)
    state         = Column(String(100), nullable=True)
    pincode       = Column(String(10),  nullable=True)
    is_admin             = Column(Boolean, default=False)
    is_active            = Column(Boolean, default=True)
    is_verified          = Column(Boolean, default=False)          # False until signup OTP is confirmed
    is_deactivated       = Column(Boolean, default=False)          # user-initiated soft suspend
    deactivated_at       = Column(DateTime(timezone=True), nullable=True)
    scheduled_delete_at  = Column(DateTime(timezone=True), nullable=True)   # account deletion
    created_at           = Column(DateTime(timezone=True), server_default=func.now())
    updated_at           = Column(DateTime(timezone=True), onupdate=func.now())

    cart_items = relationship("CartItem", back_populates="user", cascade="all, delete-orphan")
    orders     = relationship("Order",    back_populates="user")
    reviews    = relationship("Review",   back_populates="user")
    addresses  = relationship("Address",  back_populates="user", cascade="all, delete-orphan")
    sessions   = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")


class Category(Base):
    """Master list of product categories with their own IDs."""
    __tablename__ = "categories"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(String(500), nullable=True)
    emoji       = Column(String(10), nullable=True)
    is_active   = Column(Boolean, default=True)
    sort_order  = Column(Integer, default=0)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())


    # ── Indexes, chosen from measured query plans ────────────────────────
    #
    # Before these, EXPLAIN showed a full table SCAN plus a temporary B-tree
    # sort for this table's hot query. The columns the application actually
    # filters and orders by had no index at all — the thirty-odd `index=True`
    # in this file are almost entirely primary keys, which were already
    # indexed, and unique constraints, which bring their own.
    #
    # Composite and column-ordered on purpose: an index on `user_id` alone
    # still leaves the database sorting the matched rows by hand, which is
    # the "USE TEMP B-TREE FOR ORDER BY" line in the plan and the part that
    # grows with the customer's order history rather than with the shop's.

    __table_args__ = (
        # the navigation: is_active = true ORDER BY sort_order
        Index("ix_categories_active_sort", "is_active", "sort_order"),
    )


class UserSession(Base):
    """One row per logged-in device — powers the 4-device cap and the
    'Linked Devices' dashboard (WhatsApp-style device list)."""
    __tablename__ = "user_sessions"

    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_token  = Column(String(64), unique=True, index=True, nullable=False)  # embedded in the JWT as "sid"
    device_name    = Column(String(150), nullable=True)   # e.g. "Chrome on Windows"
    os_name        = Column(String(50),  nullable=True)   # Windows | macOS | Linux | iOS | Android
    browser_name   = Column(String(50),  nullable=True)   # Chrome | Safari | Firefox | Edge
    device_type    = Column(String(20),  nullable=True)   # desktop | mobile | tablet
    ip_address     = Column(String(64),  nullable=True)
    location       = Column(String(150), nullable=True)   # "Chennai, Tamil Nadu, India"
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    last_active_at = Column(DateTime(timezone=True), server_default=func.now())
    revoked_at     = Column(DateTime(timezone=True), nullable=True)
    expires_at     = Column(DateTime(timezone=True), nullable=True)  # slides forward on every active use — see auth.py::get_current_user

    user = relationship("User", back_populates="sessions")


    # ── Indexes, chosen from measured query plans ────────────────────────
    #
    # Before these, EXPLAIN showed a full table SCAN plus a temporary B-tree
    # sort for this table's hot query. The columns the application actually
    # filters and orders by had no index at all — the thirty-odd `index=True`
    # in this file are almost entirely primary keys, which were already
    # indexed, and unique constraints, which bring their own.
    #
    # Composite and column-ordered on purpose: an index on `user_id` alone
    # still leaves the database sorting the matched rows by hand, which is
    # the "USE TEMP B-TREE FOR ORDER BY" line in the plan and the part that
    # grows with the customer's order history rather than with the shop's.

    __table_args__ = (
        # the device cap and the session check, on every authenticated request
        Index("ix_sessions_user_revoked", "user_id", "revoked_at"),
    )


class OTPStore(Base):
    """Stores OTPs for password reset / MFA."""
    __tablename__ = "otp_store"

    id         = Column(Integer, primary_key=True, index=True)
    identifier = Column(String(255), index=True, nullable=False)   # email or phone
    otp_code   = Column(String(10),  nullable=False)
    otp_type   = Column(String(50),  nullable=False, default="reset")  # reset | mfa
    is_used    = Column(Boolean, default=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Product(Base):
    __tablename__ = "products"

    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String(255), nullable=False, index=True)
    description   = Column(Text, nullable=False)
    price         = Column(Float, nullable=False)
    compare_price = Column(Float, nullable=True)
    category      = Column(String(100), nullable=False, index=True)
    fabric        = Column(String(100), nullable=True)
    size_options  = Column(JSON, default=list)
    colors        = Column(JSON, default=list)
    images        = Column(JSON, default=list)
    video_url          = Column(String(500), nullable=True)   # product video URL (YouTube/MP4)
    video_orientation  = Column(String(20), nullable=True, default="landscape")  # "portrait" | "landscape" — admin choice
    fit                = Column(String(100), nullable=True)   # e.g. "Regular Fit", "Relaxed Fit"
    material           = Column(String(255), nullable=True)   # e.g. "100% Cotton"
    care_instructions  = Column(Text, nullable=True)          # washing & care instructions
    stock         = Column(Integer, default=0)
    sku           = Column(String(50), unique=True, index=True, nullable=True)
    is_active      = Column(Boolean, default=True)
    is_featured    = Column(Boolean, default=False)
    is_new_arrival = Column(Boolean, default=False)
    is_returnable  = Column(Boolean, default=True)   # False = non-returnable product
    rating_avg    = Column(Float, default=0.0)
    rating_count  = Column(Integer, default=0)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), onupdate=func.now())

    cart_items = relationship("CartItem", back_populates="product")
    reviews    = relationship("Review",   back_populates="product", cascade="all, delete-orphan")


    # ── Indexes, chosen from measured query plans ────────────────────────
    #
    # Before these, EXPLAIN showed a full table SCAN plus a temporary B-tree
    # sort for this table's hot query. The columns the application actually
    # filters and orders by had no index at all — the thirty-odd `index=True`
    # in this file are almost entirely primary keys, which were already
    # indexed, and unique constraints, which bring their own.
    #
    # Composite and column-ordered on purpose: an index on `user_id` alone
    # still leaves the database sorting the matched rows by hand, which is
    # the "USE TEMP B-TREE FOR ORDER BY" line in the plan and the part that
    # grows with the customer's order history rather than with the shop's.

    __table_args__ = (
        # the catalogue: is_active = true AND category = ?
        Index("ix_products_active_category", "is_active", "category"),
        # the catalogue default sort: is_active = true ORDER BY created_at DESC
        Index("ix_products_active_created", "is_active", "created_at"),
    )


class Address(Base):
    """Saved delivery addresses per user. Each user can have multiple."""
    __tablename__ = "addresses"

    id            = Column(Integer, primary_key=True, index=True)   # auto-increment
    user_id       = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    label         = Column(String(50),  nullable=True)   # "Home", "Work", "Other"
    full_name     = Column(String(100), nullable=False)
    phone         = Column(String(20),  nullable=False)
    address_line1 = Column(String(255), nullable=False)
    address_line2 = Column(String(255), nullable=True)
    city          = Column(String(100), nullable=False)
    state         = Column(String(100), nullable=False)
    pincode       = Column(String(10),  nullable=False)
    is_default    = Column(Boolean, default=False)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="addresses")


class CartItem(Base):
    __tablename__ = "cart_items"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id",    ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    quantity   = Column(Integer, default=1)
    size       = Column(String(20),  nullable=True)
    color      = Column(String(50),  nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user    = relationship("User",    back_populates="cart_items")
    product = relationship("Product", back_populates="cart_items")


    # ── Indexes, chosen from measured query plans ────────────────────────
    #
    # Before these, EXPLAIN showed a full table SCAN plus a temporary B-tree
    # sort for this table's hot query. The columns the application actually
    # filters and orders by had no index at all — the thirty-odd `index=True`
    # in this file are almost entirely primary keys, which were already
    # indexed, and unique constraints, which bring their own.
    #
    # Composite and column-ordered on purpose: an index on `user_id` alone
    # still leaves the database sorting the matched rows by hand, which is
    # the "USE TEMP B-TREE FOR ORDER BY" line in the plan and the part that
    # grows with the customer's order history rather than with the shop's.

    __table_args__ = (
        # the cart, read on every page that shows a basket count
        Index("ix_cart_user", "user_id"),
    )


class Order(Base):
    __tablename__ = "orders"

    id                     = Column(Integer, primary_key=True, index=True)
    order_number           = Column(String(20), unique=True, index=True)
    user_id                = Column(Integer, ForeignKey("users.id"), nullable=False)
    items_snapshot         = Column(JSON,   nullable=False)
    subtotal               = Column(Float,  nullable=False)
    shipping_fee           = Column(Float,  default=0.0)
    discount               = Column(Float,  default=0.0)
    total                  = Column(Float,  nullable=False)
    status                 = Column(String(50), default="pending")
    payment_status         = Column(String(50), default="pending")
    payment_method         = Column(String(50), nullable=False)
    payment_transaction_id = Column(String(100), nullable=True)
    shipping_address       = Column(JSON,  nullable=False)
    tracking_number        = Column(String(100), nullable=True)
    notes                  = Column(Text, nullable=True)
    open_box_delivery      = Column(Boolean, default=False)          # customer requested open-box
    delivery_otp           = Column(String(10),  nullable=True)      # 6-digit OTP for delivery confirmation
    delivery_person_name   = Column(String(100), nullable=True)      # agent name (set on out_for_delivery)
    delivery_person_phone  = Column(String(20),  nullable=True)      # agent phone
    # ── Shiprocket / courier tracking ──────────────────────────────────────
    awb_code              = Column(String(50),  nullable=True)       # courier AWB / tracking code
    courier_name          = Column(String(100), nullable=True)       # e.g. "Delhivery", "BlueDart"
    tracking_url          = Column(String(500), nullable=True)       # direct tracking link
    estimated_delivery    = Column(String(50),  nullable=True)       # e.g. "25 May 2026"
    status_location       = Column(String(255), nullable=True)       # e.g. "In Transit – Erode Hub"
    shiprocket_order_id   = Column(String(50),  nullable=True)
    shiprocket_shipment_id= Column(String(50),  nullable=True)
    # ── Cancellation info ──────────────────────────────────────────────────
    cancel_reason         = Column(String(255), nullable=True)
    cancelled_by          = Column(String(20),  nullable=True)       # 'user' or 'admin'
    rto_pending           = Column(Boolean, default=False)   # cancelled after already being shipped — stock held until the courier confirms it's back
    delivered_at           = Column(DateTime(timezone=True), nullable=True)  # set when status → delivered; anchors return/exchange windows
    created_at             = Column(DateTime(timezone=True), server_default=func.now())
    updated_at             = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="orders")


    # ── Indexes, chosen from measured query plans ────────────────────────
    #
    # Before these, EXPLAIN showed a full table SCAN plus a temporary B-tree
    # sort for this table's hot query. The columns the application actually
    # filters and orders by had no index at all — the thirty-odd `index=True`
    # in this file are almost entirely primary keys, which were already
    # indexed, and unique constraints, which bring their own.
    #
    # Composite and column-ordered on purpose: an index on `user_id` alone
    # still leaves the database sorting the matched rows by hand, which is
    # the "USE TEMP B-TREE FOR ORDER BY" line in the plan and the part that
    # grows with the customer's order history rather than with the shop's.

    __table_args__ = (
        # My Orders: user_id = ? ORDER BY created_at DESC
        Index("ix_orders_user_created", "user_id", "created_at"),
        # the 15-minute courier poller: status IN (shipped, out_for_delivery)
        Index("ix_orders_status", "status"),
        # the Delhivery webhook and the tracking endpoint, which arrive with an AWB and nothing else
        Index("ix_orders_awb", "awb_code"),
    )


class Review(Base):
    __tablename__ = "reviews"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id",    ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    rating     = Column(Integer, nullable=False)
    title      = Column(String(255), nullable=True)
    comment    = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user    = relationship("User",    back_populates="reviews")
    product = relationship("Product", back_populates="reviews")


    # ── Indexes, chosen from measured query plans ────────────────────────
    #
    # Before these, EXPLAIN showed a full table SCAN plus a temporary B-tree
    # sort for this table's hot query. The columns the application actually
    # filters and orders by had no index at all — the thirty-odd `index=True`
    # in this file are almost entirely primary keys, which were already
    # indexed, and unique constraints, which bring their own.
    #
    # Composite and column-ordered on purpose: an index on `user_id` alone
    # still leaves the database sorting the matched rows by hand, which is
    # the "USE TEMP B-TREE FOR ORDER BY" line in the plan and the part that
    # grows with the customer's order history rather than with the shop's.

    __table_args__ = (
        # the product page: product_id = ? ORDER BY created_at DESC
        Index("ix_reviews_product_created", "product_id", "created_at"),
    )


class SupportRating(Base):
    __tablename__ = "support_ratings"
    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name       = Column(String(100), nullable=False)
    email      = Column(String(255), nullable=False)
    phone      = Column(String(20), nullable=True)
    rating     = Column(Integer, nullable=False)   # 1-5
    category   = Column(String(100), nullable=True)
    message    = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    user = relationship("User", foreign_keys=[user_id])


class SupportInteraction(Base):
    """Admin logs a CS interaction → customer gets a unique rating link via email/WhatsApp."""
    __tablename__ = "support_interactions"
    id               = Column(Integer, primary_key=True, index=True)
    # CS engineer who handled the interaction
    cs_name          = Column(String(100), nullable=False)
    cs_email         = Column(String(255), nullable=True)
    cs_phone         = Column(String(20),  nullable=True)
    # Customer who was helped
    customer_name    = Column(String(100), nullable=False)
    customer_email   = Column(String(255), nullable=False)
    customer_phone   = Column(String(20),  nullable=True)
    customer_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    # Interaction details
    issue_summary    = Column(String(500), nullable=True)
    # Unique token sent to customer for rating
    rating_token     = Column(String(100), unique=True, nullable=False, index=True)
    # Rating result (filled when customer rates)
    rating           = Column(Integer, nullable=True)      # 1-5, null = not yet rated
    rating_comment   = Column(Text,    nullable=True)
    rated_at         = Column(DateTime(timezone=True), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    customer_user    = relationship("User", foreign_keys=[customer_user_id])


class WishlistItem(Base):
    __tablename__ = "wishlist_items"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user    = relationship("User")
    product = relationship("Product")


class AdminNotification(Base):
    """Admin alert for customer cancellations, returns, exchanges, replacements."""
    __tablename__ = "admin_notifications"
    id                = Column(Integer, primary_key=True, index=True)
    type              = Column(String(30),  nullable=False)   # "cancellation"|"return"|"exchange"|"replace"
    order_id          = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=True)
    return_request_id = Column(Integer, nullable=True)        # ReturnRequest.id (no FK to avoid circular)
    user_id           = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    title             = Column(String(200), nullable=False)
    message           = Column(Text,       nullable=False)
    is_read           = Column(Boolean, default=False)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())

    order = relationship("Order", foreign_keys=[order_id])
    user  = relationship("User",  foreign_keys=[user_id])


class ReturnRequest(Base):
    __tablename__ = "return_requests"
    id            = Column(Integer, primary_key=True, index=True)
    order_id      = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    user_id       = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    request_type  = Column(String(20), nullable=False)   # "exchange" only — no return/refund
    reason        = Column(String(100), nullable=False)  # "size_issue" | "damage" only
    description   = Column(Text, nullable=True)
    images        = Column(JSON, default=list)            # Cloudinary image URLs (2 required, up to 3)
    status        = Column(String(50), default="pending")
    # pending → under_review → approved / rejected → pickup_scheduled → picked_up → processing → replacement_shipped → completed
    admin_notes   = Column(Text, nullable=True)
    refund_id     = Column(String(100), nullable=True)   # unused while return/refund is out of scope; kept for future
    return_awb           = Column(String(50), nullable=True)   # Delhivery reverse-pickup waybill, once confirmed
    return_tracking_url  = Column(String(255), nullable=True)
    pickup_otp            = Column(String(10),  nullable=True)   # given to the pickup agent to verify handoff — same idea as Order.delivery_otp
    replacement_awb          = Column(String(50),  nullable=True)   # exchange only — forward shipment of the new item, created once the old one is picked up
    replacement_tracking_url = Column(String(255), nullable=True)
    pickup_error       = Column(Text, nullable=True)   # last Delhivery error creating the pickup — cleared on success, shown to admin instead of a generic "failed" message
    replacement_error  = Column(Text, nullable=True)   # same, for the exchange's replacement shipment
    pickup_last_status = Column(Text, nullable=True)   # raw live Delhivery status text from the last pickup-AWB poll, updated every check regardless of outcome — lets the admin see exactly what Delhivery reports without clicking Sync
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), onupdate=func.now())

    # Which item in the (possibly multi-item) order is being exchanged
    product_id       = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    original_price    = Column(Float, nullable=True)  # price of that item at time of request

    # What the customer wants instead — any product, not just the same one
    new_product_id    = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    new_size           = Column(String(10), nullable=True)
    new_color           = Column(String(50), nullable=True)

    # Price-difference payment — required upfront if the replacement costs more.
    # Replacement must always cost the same or more; never less (no refund path exists).
    price_difference        = Column(Float, default=0.0)
    price_diff_payment_id   = Column(String(100), nullable=True)  # Razorpay payment_id, if a difference was paid

    order       = relationship("Order")
    user        = relationship("User")
    product     = relationship("Product", foreign_keys=[product_id])
    new_product = relationship("Product", foreign_keys=[new_product_id])


    # ── Indexes, chosen from measured query plans ────────────────────────
    #
    # Before these, EXPLAIN showed a full table SCAN plus a temporary B-tree
    # sort for this table's hot query. The columns the application actually
    # filters and orders by had no index at all — the thirty-odd `index=True`
    # in this file are almost entirely primary keys, which were already
    # indexed, and unique constraints, which bring their own.
    #
    # Composite and column-ordered on purpose: an index on `user_id` alone
    # still leaves the database sorting the matched rows by hand, which is
    # the "USE TEMP B-TREE FOR ORDER BY" line in the plan and the part that
    # grows with the customer's order history rather than with the shop's.

    __table_args__ = (
        # My Returns: user_id = ? ORDER BY created_at DESC
        Index("ix_returns_user_created", "user_id", "created_at"),
        # the return/replacement pollers, which sweep by status
        Index("ix_returns_status", "status"),
        # the order detail page, which loads a return by its order
        Index("ix_returns_order", "order_id"),
    )


class ClientError(Base):
    """
    One runtime error from a customer's browser.

    Additive: nothing else reads or writes this table, so it cannot affect an
    order, a payment or a session. Deliberately denormalised and unlinked to a
    user — a crash on a public page has no session to attribute, and attaching
    one would make this a place customer identity accumulates for no benefit.
    """
    __tablename__ = "client_errors"

    id              = Column(Integer, primary_key=True, index=True)
    name            = Column(String(100))
    message         = Column(String(500))
    stack           = Column(Text)
    source          = Column(String(40), index=True)
    component_stack = Column(Text, nullable=True)
    # Next's digest correlates a browser report to the server log line.
    digest          = Column(String(100), nullable=True, index=True)
    # The API's own id for the request that failed, read off X-Request-ID by
    # the response interceptor. The digest joins a crash to Next's server log;
    # this joins it to the API's, which is the record that matters when the
    # failure was a checkout rather than a render.
    request_id      = Column(String(64), nullable=True, index=True)
    url             = Column(String(500), index=True)
    user_agent      = Column(String(300))
    viewport        = Column(String(40))
    created_at      = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class RateLimitHit(Base):
    """
    One recorded request against one rate-limit bucket.

    WHY THIS IS IN THE DATABASE. The limits were held in process memory, and on
    this deployment that is close to holding them nowhere. Render's free tier
    sleeps the instance after fifteen minutes of inactivity and restarts it on
    the next request, and every deploy restarts it too — so an attacker walking
    a number space did not need to defeat the limit, only to wait for the shop
    to go quiet. The budget reset itself. The same applies the moment the
    service runs more than one worker: each one keeps its own counters, so the
    real ceiling is the configured limit multiplied by the number of processes.

    A limit that resets on its own is not a limit; it is a delay. This table is
    the one place the counter can live that survives a restart and is shared by
    every worker, and it costs one small insert and one count per attempt on
    endpoints that are already doing bcrypt.

    Deliberately a hit log rather than a counter row: a log needs no upsert, so
    there is no dialect-specific `ON CONFLICT` to get right across SQLite and
    Postgres, and no read-modify-write race between workers. Rows are pruned as
    they expire, and the volume is tiny — the budgets are tens per hour.
    """
    __tablename__ = "rate_limit_hits"

    id     = Column(Integer, primary_key=True, index=True)
    # "<scope>|<key>" — e.g. "send-login-otp|ip:203.0.113.7" or
    # "identifier|id:9443947853". One namespace per endpoint per key kind.
    bucket = Column(String(200), nullable=False, index=True)
    at     = Column(DateTime(timezone=True), nullable=False, index=True)

    # The query is always "how many hits for THIS bucket since T", so the
    # composite is what actually serves it — either single-column index alone
    # leaves the database filtering the other half by hand.
    __table_args__ = (Index("ix_rate_limit_bucket_at", "bucket", "at"),)
