from pydantic import BaseModel, EmailStr, field_validator, model_validator, Field
from typing import Optional, List, Any
from datetime import datetime
import re

VALID_CATEGORIES = ["Baby Frocks", "Chudithar", "Frocks", "Western Dresses", "Lehenga", "Party Wear"]

# Clothing sizes 12 to 40 — Baby, Kids & Girls
VALID_SIZES = [
    "12", "14", "16", "18", "20", "22", "24",   # Baby
    "26", "28", "30", "32",                     # Kids
    "34", "36", "38", "40",                     # Girls
]


# ─── AUTH SCHEMAS ─────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    full_name:        str
    email:            EmailStr
    phone:            str
    password:         str
    confirm_password: str
    agree_terms:      bool

    @field_validator("full_name")
    @classmethod
    def name_valid(cls, v):
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Full name must be at least 2 characters")
        if not re.match(r"^[a-zA-Z\s]+$", v):
            raise ValueError("Name must contain only letters and spaces")
        return v

    @field_validator("phone")
    @classmethod
    def phone_valid(cls, v):
        v = v.strip().replace(" ", "").replace("-", "")
        # Indian number (with or without +91 / 91 / 0 prefix)
        if re.match(r"^(\+91|91|0)?[6-9]\d{9}$", v):
            if v.startswith("+91"):             v = v[3:]
            elif v.startswith("91") and len(v) == 12: v = v[2:]
            elif v.startswith("0"):             v = v[1:]
            return v
        # International number with country code (+1, +44, +971, …)
        if re.match(r"^\+\d{7,15}$", v):
            return v
        raise ValueError("Enter a valid mobile number (e.g. +91 9876543210)")

    @field_validator("password")
    @classmethod
    def password_strong(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must have at least one uppercase letter (A-Z)")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must have at least one lowercase letter (a-z)")
        if not re.search(r"\d", v):
            raise ValueError("Password must have at least one number (0-9)")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>\-_]", v):
            raise ValueError("Password must have at least one special character (!@#$%...)")
        return v

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        if not self.agree_terms:
            raise ValueError("You must agree to the Terms & Conditions")
        return self


class UserLogin(BaseModel):
    """Login with email OR phone number."""
    identifier: str   # email or phone
    password:   str

    @field_validator("identifier")
    @classmethod
    def identifier_valid(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Email or phone number is required")
        return v

    @field_validator("password")
    @classmethod
    def password_required(cls, v):
        if not v or not v.strip():
            raise ValueError("Password is required")
        return v


class OTPRequest(BaseModel):
    """Request OTP for password reset."""
    identifier: str   # email or phone

    @field_validator("identifier")
    @classmethod
    def identifier_valid(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Email or phone number is required")
        return v


class OTPVerify(BaseModel):
    """Verify OTP and reset password."""
    identifier:   str
    otp_code:     str
    new_password: str
    confirm_password: str

    @field_validator("otp_code")
    @classmethod
    def otp_valid(cls, v):
        v = v.strip()
        if not re.match(r"^\d{6}$", v):
            raise ValueError("OTP must be 6 digits")
        return v

    @field_validator("new_password")
    @classmethod
    def password_strong(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must have at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must have at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must have at least one number")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>\-_]", v):
            raise ValueError("Password must have at least one special character")
        return v

    @model_validator(mode="after")
    def passwords_match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class LoginOTPVerify(BaseModel):
    """Step-2 of OTP login: identifier + 6-digit OTP."""
    identifier: str
    otp_code:   str

    @field_validator("identifier")
    @classmethod
    def identifier_valid(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Email or phone is required")
        return v

    @field_validator("otp_code")
    @classmethod
    def otp_valid(cls, v):
        v = v.strip()
        if not re.match(r"^\d{6}$", v):
            raise ValueError("OTP must be exactly 6 digits")
        return v


class DeleteAccountConfirm(BaseModel):
    otp_code: str

    @field_validator("otp_code")
    @classmethod
    def otp_valid(cls, v):
        v = v.strip()
        if not re.match(r"^\d{6}$", v):
            raise ValueError("OTP must be exactly 6 digits")
        return v


class UserOut(BaseModel):
    id:            int
    full_name:     str
    email:         str
    phone:         str
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city:          Optional[str] = None
    state:         Optional[str] = None
    pincode:       Optional[str] = None
    is_admin:      bool
    is_active:     bool
    is_verified:   bool = True
    created_at:    datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type:   str
    user:         UserOut


class SessionOut(BaseModel):
    """One linked device, for the account's device dashboard."""
    id:             int
    device_name:    Optional[str] = None
    os_name:        Optional[str] = None
    browser_name:   Optional[str] = None
    device_type:    Optional[str] = None
    location:       Optional[str] = None
    created_at:     datetime
    last_active_at: Optional[datetime] = None
    is_current:     bool = False

    model_config = {"from_attributes": True}


class DeviceEvictLogin(BaseModel):
    """Complete a login by revoking one existing device session first,
    once the caller is already at the 4-device cap."""
    pending_token: str
    session_id:    int


class AuthLookupIn(BaseModel):
    """One field: a mobile number or an email address."""
    identifier: str

class AuthLookupOut(BaseModel):
    """
    One bit, and a masked echo of what was typed.

    Deliberately no name and no contact detail. The sign-in form only needs to
    know which of two screens to show; anything more would turn a branch into a
    profile lookup for anyone who can guess a phone number.
    """
    exists: bool
    hint: str             # masked echo of the submitted identifier, e.g. "94***53"

class AuthBeginIn(BaseModel):
    """One field: a mobile number or an email address."""
    identifier: str


class AuthBeginOut(BaseModel):
    """
    The reply to /auth/begin, which must not depend on whether the account
    exists. Every field here is derived from the submitted identifier — see
    `_identifier_hint` in routers/auth.py for why the hint in particular can
    never be built from a stored record.
    """
    sent: bool
    channel: str          # "sms" | "email"
    hint: str             # masked echo of what was typed, e.g. "94***53"


class AuthContinueIn(BaseModel):
    identifier: str
    otp: str


class AuthContinueOut(BaseModel):
    """
    The branch, returned only after the caller proved control of the identifier.

    `next` is "password" for an existing account and "register" for a new one.
    Exactly one of `user_hint` / `registration_token` is populated to match.
    """
    next: str
    user_hint: Optional[dict] = None
    registration_token: Optional[str] = None


class RevokeAllIn(BaseModel):
    """
    Sign out everywhere.  (AUTH-SPEC.md §3.3)

    Defaults to keeping the caller signed in, because that is what the button
    in the devices dashboard means and it is the safer default: a customer who
    taps it and is immediately thrown out cannot tell whether it worked.
    Passing false signs out this device too.
    """
    except_current: bool = True


class RevokeAllOut(BaseModel):
    revoked: int
    # Tells the frontend whether the token it just used is still good, so it
    # knows whether to redirect to sign-in or simply refresh the device list.
    current_session_kept: bool


class UserUpdate(BaseModel):
    full_name:     Optional[str] = None
    phone:         Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city:          Optional[str] = None
    state:         Optional[str] = None
    pincode:       Optional[str] = None


# ─── PRODUCT SCHEMAS ──────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    name:          str
    description:   str
    price:         float
    compare_price: Optional[float] = None
    category:      str
    fabric:        Optional[str] = None
    size_options:  List[str] = []
    colors:        List[str] = []
    images:        List[str] = []
    video_url:         Optional[str] = None
    video_orientation: Optional[str] = None
    fit:               Optional[str] = None
    material:          Optional[str] = None
    care_instructions: Optional[str] = None
    stock:         int
    sku:           Optional[str] = None
    is_featured:   bool = False
    is_new_arrival: bool = False
    is_returnable:  bool = True

    @field_validator("name")
    @classmethod
    def name_valid(cls, v):
        if len(v.strip()) < 3:
            raise ValueError("Product name must be at least 3 characters")
        return v.strip()

    @field_validator("price")
    @classmethod
    def price_positive(cls, v):
        if v <= 0:
            raise ValueError("Price must be greater than 0")
        return v

    @field_validator("stock")
    @classmethod
    def stock_valid(cls, v):
        if v < 0:
            raise ValueError("Stock cannot be negative")
        return v

    @field_validator("category")
    @classmethod
    def category_valid(cls, v):
        if v not in VALID_CATEGORIES:
            raise ValueError(f"Category must be one of: {', '.join(VALID_CATEGORIES)}")
        return v


class ProductUpdate(BaseModel):
    name:          Optional[str]   = None
    description:   Optional[str]   = None
    price:         Optional[float] = None
    compare_price: Optional[float] = None
    category:      Optional[str]   = None
    fabric:        Optional[str]   = None
    size_options:  Optional[List[str]] = None
    colors:        Optional[List[str]] = None
    images:        Optional[List[str]] = None
    video_url:         Optional[str]   = None
    video_orientation: Optional[str]   = None
    fit:               Optional[str]   = None
    material:          Optional[str]   = None
    care_instructions: Optional[str]   = None
    stock:         Optional[int]   = None
    is_active:      Optional[bool]  = None
    is_featured:    Optional[bool]  = None
    is_new_arrival: Optional[bool]  = None
    is_returnable:  Optional[bool]  = None


class ProductOut(BaseModel):
    id:            int
    name:          str
    description:   str
    price:         float
    compare_price: Optional[float] = None
    category:      str
    fabric:        Optional[str]   = None
    size_options:  List[str] = []
    colors:        List[str] = []
    images:        List[str] = []
    video_url:         Optional[str]   = None
    video_orientation: Optional[str]   = None
    fit:               Optional[str]   = None
    material:          Optional[str]   = None
    care_instructions: Optional[str]   = None
    stock:         int
    sku:           Optional[str]   = None
    is_active:      bool
    is_featured:    bool
    is_new_arrival: bool = False
    is_returnable:  bool = True
    rating_avg:    float
    rating_count:  int
    created_at:    datetime

    model_config = {"from_attributes": True}

    @field_validator(
        "stock", "is_active", "is_featured", "is_new_arrival", "is_returnable",
        "rating_avg", "rating_count", "size_options", "colors", "images",
        mode="before",
    )
    @classmethod
    def _tolerate_null(cls, v, info):
        """
        ONE BAD ROW MUST NOT TAKE THE WHOLE CATALOGUE DOWN.

        Every field listed here is non-optional with a PYTHON-side default, so a
        product created through the ORM always has a value. A product created
        any other way — a manual SQL fix, a CSV import, an older migration that
        added the column without backfilling — has NULL, and FastAPI's response
        validation then raises on the entire list:

            ResponseValidationError: 5 validation errors
              ('response', 0, 'is_featured'): Input should be a valid boolean

        Note the index: row ZERO. It is not that one product is missing from
        the listing — the endpoint returns 500 and the shop has no catalogue at
        all. Found by inserting a test product with raw SQL, which is exactly
        how it would happen for real.

        A missing flag is not worth an outage. The row renders with the same
        default it would have been created with, and the shop stays open.
        """
        if v is not None:
            return v
        return {
            "stock": 0,
            "is_active": True,
            "is_featured": False,
            "is_new_arrival": False,
            "is_returnable": True,
            "rating_avg": 0.0,
            "rating_count": 0,
            "size_options": [],
            "colors": [],
            "images": [],
        }.get(info.field_name)

    @field_validator("name", "description", "category", mode="before")
    @classmethod
    def _tolerate_null_text(cls, v):
        """Same reasoning: a null name should show as blank, not 500 the list."""
        return v if v is not None else ""


# ─── CART SCHEMAS ─────────────────────────────────────────────────────────────

class CartItemAdd(BaseModel):
    product_id: int
    quantity:   int = 1
    size:       Optional[str] = None
    color:      Optional[str] = None

    @field_validator("quantity")
    @classmethod
    def qty_valid(cls, v):
        if v < 1:
            raise ValueError("Quantity must be at least 1")
        if v > 10:
            raise ValueError("Maximum 10 items per product")
        return v


class CartItemOut(BaseModel):
    id:         int
    product_id: int
    quantity:   int
    size:       Optional[str] = None
    color:      Optional[str] = None
    product:    ProductOut

    model_config = {"from_attributes": True}


# ─── ORDER SCHEMAS ────────────────────────────────────────────────────────────

class ShippingAddress(BaseModel):
    full_name:     str
    phone:         str
    address_line1: str
    address_line2: Optional[str] = None
    city:          str
    state:         str
    pincode:       str

    @field_validator("full_name")
    @classmethod
    def name_required(cls, v):
        if not v or not v.strip():
            raise ValueError("Full name is required")
        return v.strip()

    @field_validator("phone")
    @classmethod
    def phone_valid(cls, v):
        v = v.strip().replace(" ", "")
        if not re.match(r"^(\+91|91|0)?[6-9]\d{9}$", v):
            raise ValueError("Enter a valid Indian mobile number")
        return v

    @field_validator("address_line1")
    @classmethod
    def addr_required(cls, v):
        if not v or not v.strip():
            raise ValueError("Address is required")
        return v.strip()

    @field_validator("city")
    @classmethod
    def city_required(cls, v):
        if not v or not v.strip():
            raise ValueError("City is required")
        return v.strip()

    @field_validator("state")
    @classmethod
    def state_required(cls, v):
        if not v or not v.strip():
            raise ValueError("State is required")
        return v.strip()

    @field_validator("pincode")
    @classmethod
    def pincode_valid(cls, v):
        v = v.strip()
        if not re.match(r"^\d{6}$", v):
            raise ValueError("Pincode must be exactly 6 digits")
        return v


class PaymentDetails(BaseModel):
    method:           str
    card_number:      Optional[str] = None
    card_expiry:      Optional[str] = None
    card_cvv:         Optional[str] = None
    card_holder_name: Optional[str] = None
    upi_id:           Optional[str] = None
    razorpay_order_id:    Optional[str] = None
    razorpay_payment_id:  Optional[str] = None
    razorpay_signature:   Optional[str] = None

    @model_validator(mode="after")
    def validate_payment(self):
        allowed = ["razorpay", "upi", "emi"]
        if self.method not in allowed:
            raise ValueError(f"Payment method must be one of: {', '.join(allowed)}")
        if self.method == "upi" and self.upi_id:
            if not re.match(r"^[\w.\-_]{3,}@[a-zA-Z]{3,}$", self.upi_id.strip()):
                raise ValueError("Enter a valid UPI ID (e.g., name@upi)")
        return self


class BuyNowItem(BaseModel):
    """One piece, bought directly, without going through the bag.

    "Buy it now" used to add the piece to the cart and then send the customer
    to checkout — and checkout orders the WHOLE cart and empties it. So buying
    one thing ordered everything the customer had been saving, and cleared the
    bag. This carries the single piece instead, so the bag is neither read nor
    touched.
    """
    product_id: int
    quantity:   int = Field(default=1, ge=1, le=99)
    size:       Optional[str] = None
    color:      Optional[str] = None


class OrderCreate(BaseModel):
    shipping_address:  ShippingAddress
    payment:           PaymentDetails
    notes:             Optional[str] = None
    open_box_delivery: bool = False    # customer can request open-box inspection
    # When present the order is built from this ONE piece and the cart is left
    # exactly as it was. When absent, behaviour is unchanged: the whole cart.
    buy_now:           Optional[BuyNowItem] = None


class CancelOrderPayload(BaseModel):
    reason: Optional[str] = None


class OrderStatusUpdate(BaseModel):
    status:                str
    tracking_number:       Optional[str] = None
    delivery_person_name:  Optional[str] = None
    delivery_person_phone: Optional[str] = None
    awb_code:              Optional[str] = None
    courier_name:          Optional[str] = None
    tracking_url:          Optional[str] = None
    estimated_delivery:    Optional[str] = None
    status_location:       Optional[str] = None   # current location note e.g. "In Transit – Erode Hub"


class OrderOut(BaseModel):
    id:                     int
    order_number:           str
    items_snapshot:         Any
    subtotal:               float
    shipping_fee:           float
    discount:               float
    total:                  float
    status:                 str
    payment_status:         str
    payment_method:         str
    payment_transaction_id: Optional[str] = None
    shipping_address:       Any
    tracking_number:        Optional[str] = None
    notes:                  Optional[str] = None
    open_box_delivery:      bool = False
    delivery_otp:           Optional[str] = None
    delivery_person_name:   Optional[str] = None
    delivery_person_phone:  Optional[str] = None
    awb_code:               Optional[str] = None
    courier_name:           Optional[str] = None
    tracking_url:           Optional[str] = None
    estimated_delivery:     Optional[str] = None
    status_location:        Optional[str] = None
    cancel_reason:          Optional[str] = None
    cancelled_by:           Optional[str] = None
    rto_pending:            bool = False
    delivered_at:           Optional[datetime] = None
    created_at:             datetime

    model_config = {"from_attributes": True}


# ─── REVIEW SCHEMAS ───────────────────────────────────────────────────────────

class ReviewCreate(BaseModel):
    product_id: int
    rating:     int
    title:      Optional[str] = None
    comment:    Optional[str] = None

    @field_validator("rating")
    @classmethod
    def rating_valid(cls, v):
        if v < 1 or v > 5:
            raise ValueError("Rating must be between 1 and 5")
        return v


class ReviewOut(BaseModel):
    id:         int
    user_id:    int
    product_id: int
    rating:     int
    title:      Optional[str] = None
    comment:    Optional[str] = None
    created_at: datetime
    user:       UserOut

    model_config = {"from_attributes": True}


# ─── RETURN / EXCHANGE / REPLACE SCHEMAS ─────────────────────────────────────

class ReturnRequestCreate(BaseModel):
    order_id:     int
    product_id:   int              # which item in the order is being returned/exchanged
    request_type: str              # "return" (refund) | "exchange" (different product)
    reason:       str              # "size_issue" | "damage" only
    description:  Optional[str] = None
    images:       List[str] = []   # 2 required, max 3

    # Exchange only — what the customer wants instead, any product
    new_product_id: Optional[int] = None
    new_size:       Optional[str] = None
    new_color:      Optional[str] = None

    # Exchange only, required when the replacement costs more than the
    # original item — the price difference must be paid upfront.
    razorpay_order_id:   Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    razorpay_signature:  Optional[str] = None

    @field_validator("request_type")
    @classmethod
    def type_valid(cls, v):
        if v not in ["return", "exchange"]:
            raise ValueError("request_type must be 'return' or 'exchange'")
        return v

    @field_validator("reason")
    @classmethod
    def reason_valid(cls, v):
        if v not in ["size_issue", "damage"]:
            raise ValueError("Reason must be 'size_issue' or 'damage'")
        return v

    @field_validator("images")
    @classmethod
    def images_valid(cls, v):
        if len(v) < 2:
            raise ValueError("At least 2 photos are required as proof")
        if len(v) > 3:
            raise ValueError("Maximum 3 photos allowed")
        return v

    @model_validator(mode="after")
    def exchange_needs_product(self):
        if self.request_type == "exchange" and not self.new_product_id:
            raise ValueError("Please choose a replacement product for an exchange")
        if self.request_type == "return" and self.new_product_id:
            raise ValueError("A return does not take a replacement product — use exchange instead")
        return self

class ReturnStatusUpdate(BaseModel):
    status:      str
    admin_notes: Optional[str] = None

class AttachAwbPayload(BaseModel):
    awb: str

class ReturnRequestOut(BaseModel):
    id:           int
    order_id:     int
    user_id:      int
    request_type: str
    reason:       str
    description:  Optional[str] = None
    images:       List[str] = []
    status:       str
    admin_notes:  Optional[str] = None
    refund_id:    Optional[str] = None
    return_awb:           Optional[str] = None
    return_tracking_url:  Optional[str] = None
    pickup_otp:               Optional[str] = None
    replacement_awb:          Optional[str] = None
    replacement_tracking_url: Optional[str] = None
    pickup_error:             Optional[str] = None
    replacement_error:        Optional[str] = None
    pickup_last_status:       Optional[str] = None
    product_id:            Optional[int] = None
    original_price:         Optional[float] = None
    new_product_id:         Optional[int] = None
    new_product:             Optional[ProductOut] = None
    new_size:               Optional[str] = None
    new_color:               Optional[str] = None
    price_difference:        float = 0.0
    price_diff_payment_id:   Optional[str] = None
    created_at:   datetime
    model_config = {"from_attributes": True}


# ─── SUPPORT INTERACTION SCHEMAS ──────────────────────────────────────────────

class SupportInteractionCreate(BaseModel):
    """
    WHO ANSWERED IS NO LONGER ASKED FOR.

    This required `cs_name` — the name of the support engineer who took the
    call. That is the shape of a company with a support desk, and this is a
    shop where the owner answers the phone. Asking for it meant inventing an
    employee before a conversation could be logged.

    The field stays optional rather than being deleted: the column is NOT NULL
    and already holds real values on rows logged before this, so removing it
    would mean a migration on a live database to gain nothing. The router
    fills it with the shop's own name when it is not supplied.
    """
    cs_name:        Optional[str] = None
    cs_email:       Optional[str] = None
    cs_phone:       Optional[str] = None
    customer_name:  str
    customer_email: str
    customer_phone: Optional[str] = None
    issue_summary:  Optional[str] = None

    @field_validator("customer_name")
    @classmethod
    def name_required(cls, v):
        if not v or not v.strip():
            raise ValueError("Name is required")
        return v.strip()

    @field_validator("customer_email")
    @classmethod
    def email_required(cls, v):
        if not v or not v.strip():
            raise ValueError("Customer email is required")
        return v.strip()


class SupportRatingSubmit(BaseModel):
    rating:  int
    comment: Optional[str] = None

    @field_validator("rating")
    @classmethod
    def rating_valid(cls, v):
        if v < 1 or v > 5:
            raise ValueError("Rating must be between 1 and 5")
        return v


class SupportInteractionOut(BaseModel):
    id:               int
    cs_name:          str
    cs_email:         Optional[str] = None
    cs_phone:         Optional[str] = None
    customer_name:    str
    customer_email:   str
    customer_phone:   Optional[str] = None
    issue_summary:    Optional[str] = None
    rating_token:     str
    rating:           Optional[int] = None
    rating_comment:   Optional[str] = None
    rated_at:         Optional[datetime] = None
    created_at:       datetime
    model_config = {"from_attributes": True}
