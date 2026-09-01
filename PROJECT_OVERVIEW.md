# Vijey Textile / Ammalu Tex — Project Overview

_Generated from a full codebase survey, 2026-08-04._

Two full-stack e-commerce projects live in this GitHub account:

| | **vijey-textile** | **ammalu-tex** |
|---|---|---|
| Status | **Live in production** | Local/dev twin, not deployed |
| Frontend | `https://vijeytextile.com` (Vercel) | not deployed |
| Backend | `https://api.vijeytextile.com` (Oracle Cloud) | not deployed |
| Store | Vijey Textile, Shop GF No 131, Texvalley Gangapuram, Erode – 638102 | Ammalu Tex, Shop GF No 129, Texvalley Gangapuram |
| Admin login | kumaragurubaran27102@gmail.com | admin@ammalutex.com |

**The two codebases are near-identical forks**, not a simple prototype vs. final product — same DB schema, same dependencies (`requirements.txt` is byte-for-byte identical), same Razorpay/Twilio/Cloudinary/Delhivery/Shiprocket integrations, same 16 frontend routes. A handful of real differences exist (see [§6](#6-differences-ammalu-tex-vs-vijey-textile)), the most notable being that **ammalu-tex has a working customer-facing order-cancellation endpoint that vijey-textile is missing.**

Stack: **FastAPI** (Python) backend + **Next.js/React (App Router)** frontend, **PostgreSQL** (Render) in production / SQLite locally, **JWT** auth, **Razorpay** payments, **Cloudinary** media, **Twilio** email/SMS/WhatsApp (despite SETUP.md documenting Ultramsg/Fast2SMS — see §7.8), **Delhivery** + **Shiprocket** for shipping.

---

## 1. Database Models (`backend/models.py`)

| Model | Table | Purpose | Key fields |
|---|---|---|---|
| User | `users` | Customer/admin accounts | email, phone, password_hash, is_admin, is_active, is_deactivated, scheduled_delete_at |
| Category | `categories` | Storefront category chips | name, emoji, sort_order |
| OTPStore | `otp_store` | One-time codes for login/reset/delete/deactivate | identifier, otp_code, otp_type, expires_at |
| Product | `products` | Catalog items | price, compare_price, category, size_options/colors/images (JSON), stock, sku, rating_avg |
| Address | `addresses` | Saved delivery addresses | label, full_name, phone, address lines, pincode, is_default |
| CartItem | `cart_items` | Active cart | user_id, product_id, quantity, size, color |
| Order | `orders` | Placed orders | order_number, items_snapshot (JSON), totals, status, payment_status, tracking (AWB/courier), delivery_otp, cancel_reason/cancelled_by |
| Review | `reviews` | Product reviews | rating, title, comment |
| SupportRating | `support_ratings` | **Dead table** — never written to (see §7.3) | — |
| SupportInteraction | `support_interactions` | CS-agent rating flow | rating_token, rating, rating_comment |
| WishlistItem | `wishlist_items` | Saved-for-later products | user_id, product_id |
| AdminNotification | `admin_notifications` | Admin inbox (cancellations/returns/exchanges) | type, order_id, is_read |
| ReturnRequest | `return_requests` | Return/exchange/replace workflow | request_type, reason, images (Cloudinary, ≤3), status (10-state) |

`main.py` runs idempotent startup migrations on boot, seeds the admin user and demo products if empty, and permanently deletes accounts past their `scheduled_delete_at`.

---

## 2. Backend API (`backend/routers/`)

### Auth (`/api/auth`)
Password login can go two ways: direct JWT (`POST /login`), or a 2-step OTP flow (`send-login-otp` → email 6-digit code → `verify-login-otp` → JWT). JWT = 30-day HS256, `bcrypt` password hashing.
- Register/login/me/update-profile
- Forgot/reset password (OTP-gated)
- Request/confirm account deletion (OTP-gated, 4-hour grace window)
- Request/confirm account deactivation (OTP-gated, 7-day reversible soft-suspend)

### Products (`/api/products`) — public catalog
List/filter/search/sort/paginate, product detail, reviews, verified-buyer-only review posting (`can-review` checks for a `delivered` order containing the product).

### Cart (`/api/cart`) — auth required
Add (stock-checked, max 10/product)/update/remove/clear. Every change fires an email + SMS cart snapshot.

### Orders (`/api/orders`) — auth required
Lifecycle: `pending → confirmed → processing → shipped → out_for_delivery → delivered` (or admin-only `cancelled`).
- `POST /` places the order from cart, decrements stock, generates `order_number` (`AMT-XXXXXXXX`), marks `payment_status=paid` **without verifying the Razorpay signature first** (see §7.6)
- `GET /{id}/track` — live tracking via Delhivery/Shiprocket if shipped
- **No `POST /{id}/cancel` route** — customers cannot self-cancel (see §7.1)

### Payments (`/api/payments`) — Razorpay
`create-order` → checkout widget → `verify` (HMAC-SHA256 signature check, **not actually called by the order flow**) → `webhook/razorpay` handles refund events → admin refund endpoints (`initiate-refund`, `mark-refunded`, `reset-to-refund-initiated`).

### Admin (`/api/admin`) — admin-only
Dashboard stats; product CRUD + Cloudinary image/video upload; order list/status updates (auto-generates delivery OTP, fires notifications per status); user list; admin role grant/revoke (primary admin protected); Delhivery/Shiprocket shipment creation + serviceability check; returns queue management (auto-fires Razorpay refund on approval); admin notifications inbox.

### Addresses (`/api/addresses`) — auth required
Standard CRUD + default-address handling.

### Returns (`/api/returns`) — auth required
Create return/exchange/replace request for `delivered` orders only (**schema only allows `exchange`/`replace`, not `return`** — see §7.2); Cloudinary photo upload for evidence; 7-day window defined but not enforced (§7.9).

### Support (`/api/support`)
Token-based CS-interaction rating: admin logs an interaction → customer gets a one-time rating link → rates 1–5.

### Wishlist (`/api/wishlist`) — auth required
Add/remove/list/ids (for heart-icon state).

---

## 3. Integrations

- **Notifications** (`backend/notifications.py`, ~1900 lines, 45+ functions): SendGrid HTTP API primary for email (Gmail SMTP fallback locally), **Twilio** for SMS + WhatsApp. Covers welcome, order confirmation, payment success/fail, status updates, delivery OTP, cart changes, account deletion/deactivation OTPs, refunds, returns, invoices, support ratings, admin alerts.
- **Delhivery** (`backend/delhivery.py`): shipment creation, AWB tracking, cancellation, pincode serviceability.
- **Shiprocket** (`backend/shiprocket.py`): alternate courier — login/token caching, forward shipment, tracking, cancel.
- **Cloudinary**: product images/videos (in `admin.py`), return evidence photos (in `returns.py`).
- **Razorpay**: order creation, signature verification, webhooks, refunds (in `payments.py`, `admin.py`, `returns.py`).

---

## 4. Frontend (`frontend/src/app/`)

Next.js App Router, provider stack `AuthProvider → CartProvider → WishlistProvider → LoginPromptProvider`. `AuthContext` supports **multi-account switching** (like Google/Amazon — multiple saved logins). `lib/api.ts` centralizes all API calls with JWT auto-attach and Render cold-start keep-alive pings.

| Route | Purpose |
|---|---|
| `/` | Home — hero carousel, categories, featured products, recent reviews |
| `/products`, `/products/[id]` | Catalog (fuzzy search via Fuse.js) + PDP (image/video gallery, size/color pickers, reviews) |
| `/cart`, `/checkout` | Cart management; 3-step checkout (address → payment method → Razorpay widget) |
| `/orders`, `/orders/[id]`, `/orders/[id]/invoice` | Order history, detail + tracking + return modal, printable invoice |
| `/returns/[id]` | Return/exchange status tracker |
| `/wishlist` | Saved products |
| `/auth/login`, `/auth/register`, `/auth/forgot-password` | Auth flows |
| `/account`, `/account/delete` | Profile edit, deactivate/delete account |
| `/admin` | Admin SPA — Dashboard, Products, Orders, Cancellations (Legacy), Customers, Support Ratings, Exchange & Replacement, Admins, CS-interaction logger |
| `/support`, `/support/rate/[token]` | Help center, one-time CS rating page |
| `/authentic`, `/shipping`, `/cancellation`, `/privacy`, `/terms` | Static policy pages |

---

## 5. Deployment

- **Backend** → Render (Root: `backend`, `pip install -r requirements.txt`, `uvicorn main:app --host 0.0.0.0 --port $PORT`, free tier — sleeps after 15 min idle)
- **Frontend** → Vercel (Root: `frontend`, Next.js preset)
- **Domain** → `vijeytextile.com` via Hostinger DNS → Vercel
- **DB** → Render PostgreSQL
- Auto-deploy on every push to `main`
- Env vars needed on Render: `DATABASE_URL`, `SECRET_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_PHONE`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `SMTP_EMAIL`, `SMTP_PASSWORD`, `SENDGRID_API_KEY`, `DELHIVERY_API_TOKEN`, `SUPPORT_EMAIL`, `FRONTEND_URL` — plus **Twilio vars actually used by the code** (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE`, `TWILIO_WHATSAPP_FROM`) which SETUP.md doesn't mention (§7.8).

---

## 6. Differences: ammalu-tex vs vijey-textile

Schema, dependencies, and integrations are identical. Real differences:

1. **Order cancellation** — ammalu-tex's `orders.py` has a full `POST /orders/{id}/cancel` (courier cancellation, automatic Razorpay refund, notifications). This route **does not exist** in vijey-textile.
2. **COD handling** — ammalu-tex's `place_order` leaves `payment_status="pending"` for Cash on Delivery; vijey-textile always sets `payment_status="paid"` (COD there appears to be admin-created only).
3. Cosmetic-only: Cloudinary folder names, admin email defaults, store branding/address.
4. Confirming shared origin: vijey-textile's order-number generator still hardcodes the `"AMT-"` prefix (Ammalu Tex's initials).

**Also found:** `ammalu-tex/backend/venv/` (a Python virtualenv, ~2,566 files, 62MB) is committed to git. No secrets in it, but it bloats the now-public repo and should be removed (`git rm -r --cached backend/venv`, already covered by `.gitignore` going forward).

---

## 7. Known Bugs / Inconsistencies

1. **No customer-facing order cancellation in production.** DB fields (`cancel_reason`, `cancelled_by`) and frontend UI exist, but no route sets them. Only admins can force-cancel via the generic status-update endpoint (no reason captured). The admin panel's own tab is labeled "Cancelled Orders (**Legacy**)", and the public `/cancellation` policy page states the store doesn't offer cancellations at all — so this looks like intentionally retired functionality, not an active bug, unless you want it re-enabled (ammalu-tex has a working version to port over).
2. **"Return" requests are unreachable.** Model, admin notifications, refund trigger logic, and frontend labels all reference a `"return"` type, but `ReturnRequestCreate`'s validator only accepts `exchange`/`replace`. No one can ever actually file a return through the API.
3. **`SupportRating` table and its API/frontend calls are dead code** — nothing writes to it; the real support-rating flow uses the separate token-based `SupportInteraction` system instead.
4. **`adminAPI.updateSettings`** in the frontend calls a backend route that doesn't exist.
5. **Category taxonomy mismatch.** Admin product form (`schemas.VALID_CATEGORIES`) only allows the old 6 categories (Baby Frocks, Chudithar, Frocks, Western Dresses, Lehenga, Party Wear). But `products.py` and the DB-seeded `Category` rows use a different, newer set (Chudithar, Tops, Lehenga, Half Saree, Crop Tops, Party Wears). Result: storefront can show categories (Tops, Half Saree, Crop Tops) admins can't assign any product to, and "Half Saree" auto-seed silently adds zero products because no seed product uses that category.
6. **Payment verification not enforced.** `POST /api/payments/verify` exists (HMAC signature check) but `orders.py` never calls it before marking an order `paid` — it trusts the `razorpay_payment_id` the frontend sends.
7. **Duplicate function definitions in `notifications.py`.** `send_cart_add_sms`/`send_cart_remove_sms` are defined twice; the second silently shadows the first (SMS-only version), so WhatsApp-included versions are the ones actually used — functionally fine, but dead/confusing code.
8. **SETUP.md documents the wrong SMS/WhatsApp provider.** It lists `ULTRAMSG_TOKEN`/`ULTRAMSG_INSTANCE`/`FAST2SMS_API_KEY`, none of which the code reads. Actual provider is Twilio.
9. **7-day return window isn't enforced server-side** — only exists as UI copy; `RETURN_WINDOW_DAYS` is defined but never checked against delivery date.
10. **Seed data uses placeholder images** (`/images/placeholder-*.jpg`) — expected for demo data, just flagging in case any went live unreplaced.

---

## 8. Security Check (this session)

- No hardcoded API keys, passwords, or secrets found in either codebase — Razorpay/Cloudinary/Twilio/SendGrid credentials are all pulled from environment variables via `os.getenv(...)`.
- `.env`, `.env.local`, and DB files are correctly gitignored and not present in either repo's git history.
- Both repos were private until today; now public. Recommend rotating any credentials that may have been shared outside this chat/repo before going public, as a precaution (none were found committed, but worth confirming your Render/Vercel env vars weren't pasted anywhere public).
