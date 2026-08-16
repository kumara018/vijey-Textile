# Vijey Textile — Route Map

Every route the frontend serves, what it calls, and what guards it. Built by
reading the backend, **read-only** — no schema, endpoint, or migration touched.

**Status legend:** ✅ rebuilt in the new design · ⬜ still on the old design · n/a not a page

---

## Auth model — applies to every guarded route

| Guard | Definition | Behaviour |
|---|---|---|
| `get_current_user` | `backend/auth.py` | Bearer JWT. Re-issues a longer-lived token via the `x-new-token` response header when due — the sliding session. |
| `get_current_admin` | `backend/auth.py:133` | `get_current_user` **and** `is_admin`, else **403 "Admin privileges required"** |
| `get_optional_user` | `backend/auth.py:142` | Returns `None` rather than 401 — used where a page works signed-out |

The axios layer already implements both critical behaviours and must not change:
`x-new-token` → localStorage + 90-day cookie, and the 401 path re-checks
`/api/auth/me` before logging anyone out.

---

## 1. Storefront

| Route | Status | Calls | Guard |
|---|---|---|---|
| `/` | ✅ | `GET /api/products/` (featured, recent) | public |
| `/products` | ✅ | `GET /api/products/` · `GET /api/products/categories` | public |
| `/products/[id]` | ✅ | `GET /api/products/{id}` · `/reviews` · `/can-review` · `POST /reviews` | public; review posting needs auth |

`/products` filters map to query params on `GET /api/products/`: `category`,
`search`, `min_price`, `max_price`, `featured`, `sort_by`, `sort_order`, `limit`.

**Footer category links** (`Baby Frocks`, `Chudithar`, `Frocks`,
`Western Dresses`, `Lehenga`, `Party Wear`) are *not* separate routes — every
one is `/products?category=<name>`. Six links, one page.

---

## 2. Cart and wishlist

| Route | Status | Calls | Guard |
|---|---|---|---|
| `/cart` | ✅ | `GET/POST /api/cart/` · `PUT /api/cart/{id}?quantity=` · `DELETE /api/cart/{id}` · `DELETE /api/cart/` | auth |
| `/wishlist` | ✅ | `GET /api/wishlist/` · `/ids` · `POST` · `DELETE /{product_id}` | auth |

**Quantity is a query parameter, not a body field** — `PUT /api/cart/{id}?quantity=N`.
Easy to get wrong when rebuilding.

---

## 3. Checkout and payment — the money path

| Route | Status | Calls | Guard |
|---|---|---|---|
| `/checkout` | ✅ | `GET /api/addresses/` · `POST /api/payments/create-order` · `GET /api/payments/key` · `POST /api/orders/` | auth |

Razorpay sequence, unchanged:

1. `GET /api/payments/key` → publishable key
2. `POST /api/payments/create-order` → razorpay order id
3. Razorpay Checkout script — **the only third-party script on the site**, injected at runtime from `checkout/page.tsx`, not in `layout.tsx`
4. `POST /api/payments/verify` → signature check
5. `POST /api/orders/` with `shipping_address`, `payment` (carrying `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`), `notes`, `open_box_delivery`

`POST /api/payments/webhook/razorpay` is server-to-server. Not a frontend concern.

`OrderCreate` and `ShippingAddress` shapes are mirrored in `lib/schemas.ts`,
including the Indian mobile pattern the server enforces.

---

## 4. Orders, returns, invoices

| Route | Status | Calls | Guard |
|---|---|---|---|
| `/orders` | ✅ | `GET /api/orders/` · `GET /api/returns/` | auth |
| `/orders/[id]` | ✅ | `GET /api/orders/{id}` · `/track` · `POST /cancel` · `POST /send-invoice` | auth |
| `/orders/[id]/invoice` | ✅ | `GET /api/orders/{id}` | auth |
| `/returns/[id]` | ✅ | `GET /api/returns/{id}` · `POST /api/returns/` · `/upload-image` | auth |

---

## 5. Account and auth screens

| Route | Status | Calls | Guard |
|---|---|---|---|
| `/auth/login` | ✅ | `POST /send-login-otp` → `/verify-login-otp` · `/sessions/evict-and-login` | public |
| `/auth/register` | ✅ | `POST /register` → `/verify-register-otp` · `/resend-register-otp` | public |
| `/auth/forgot-password` | ✅ | `POST /forgot-password` → `/reset-password` | public |
| `/account` | ✅ | `GET/PUT /api/auth/me` · `GET /api/auth/sessions` · `DELETE /sessions/{id}` · addresses CRUD | auth |
| `/account/delete` | ✅ | `POST /request-delete-account` → `/confirm-delete-account` · `/cancel-delete-account` · deactivate pair | auth |
| Sign out | n/a | `POST /api/auth/logout` — accepts an explicit token so one saved account can be signed out while switching to another | auth |

Login is **two-step OTP**, not password-only, and can return **409 `device_limit`**
carrying `pending_token` + `sessions` for the eviction modal. Both behaviours
must survive the rebuild.

---

## 6. Support and policy

| Route | Status | Calls | Guard |
|---|---|---|---|
| `/support` | ✅ | `GET /api/support/rating/summary` · `POST /interactions` | public |
| `/support/rate/[token]` | ✅ | `GET/POST /api/support/rate/{token}` | public, token-scoped |
| `/shipping` | ✅ | none — static | public |
| `/terms` | ✅ | none — static | public |
| `/privacy` | ✅ | none — static | public |
| `/cancellation` | ✅ | none — static | public |
| `/authentic` | ✅ | none — static | public |

The rebuilt policy pages share one `PolicyDoc` component: numbered sections
with a sticky contents rail, a ~68ch measure, and hairline rules between
clauses. The numbering is load-bearing — support can say "point 4 of the
shipping policy" and the customer can find it.

**Every clause was carried over verbatim.** Restyling a policy is not amending
one, so the legal content and each page's "last updated" date are unchanged;
moving the date would tell readers the terms had changed when they had not.

Footer links `Size Guide`, `Shipping Policy` and `Cancel/Return/Exchange FAQ`
are **anchors into `/support`** (`#size-guide`, `#shipping`, `#returns`), not
separate pages. `Cancellation, Return & Exchange Policy` is its own route,
`/cancellation`.

---

## 7. Admin — internal, `is_admin` required

| Route | Status | Calls | Guard |
|---|---|---|---|
| `/admin` | ✅ | `GET /api/admin/dashboard` · products CRUD + image/video upload · `GET /orders` · `PUT /orders/{id}/status` · Delhivery create/sync/serviceability · returns status/retry-pickup/attach-awb/retry-replacement · notifications · `GET /users` · support ratings · payments refund trio | **admin** |
| `/admin/products` | ✅ | products CRUD + image/video upload | **admin** |
| `/admin/orders` | ✅ | `GET /orders` · `PUT /orders/{id}/status` · Delhivery create/sync | **admin** |
| `/admin/returns` | ✅ | returns status · retry-pickup · attach-awb · retry-replacement | **admin** |
| `/admin/users` | ✅ | `GET /users` | **admin** |
| `/admin/ratings` | ✅ | support ratings | **admin** |
| `/admin/cancellations` | ✅ | `GET /orders` (cancelled) | **admin** |
| `/admin/admins` | ✅ | `GET /admins` · `PATCH /users/{id}/revoke-admin` | **admin** |

The seven views were previously one route switching on component state, with
`?tab=` as the only handle. They are now **addressable routes** — bookmarkable,
shareable, and correct under the back button. `?tab=` still resolves, so
existing links keep working.

`/admin` is rebuilt on the new **`AdminShell`**: no scene, no scrim, no motion
(the admin resolves to `plain` and renders zero draw calls), a tighter measure
than the storefront because density is what a work tool needs, and the same
palette and type because it is the same shop. Its tabs are real links, so
back, bookmark and open-in-new-tab all work — managing orders in one tab and
products in another is the normal case.

**The seven working views still mount the legacy `AdminDashboard`.** They cross
onto `AdminShell` one at a time. The mixed state is deliberate and visible
rather than hidden behind a flag.

Every `/api/admin/*` endpoint sits behind `get_current_admin` → **403** for a
signed-in non-admin. The admin dashboard is a work tool used all day, which is
why it resolves to the `plain` scene and renders **zero** draw calls.

---

## 8. App shell — the states with no route of their own

These are not pages a visitor navigates to; they are the surfaces Next.js
renders when something goes wrong or is still arriving. They had no
implementation at all before this pass, which meant a data failure showed the
framework's default and a slow segment showed nothing.

| Surface | File | Status | Notes |
|---|---|---|---|
| 404 | `app/not-found.tsx` | ✅ | Rebuilt. Was 🧵 emoji + maroon + `.btn-primary`, none of which exist in this design system. Now a wayfinding index of all six departments — a navigation failure answered with navigation. |
| Route error | `app/error.tsx` | ✅ | **New.** Retry, catalogue, home, the shop's phone number, and the Next.js `digest` as a support reference. Imports nothing that can throw. |
| Global error | `app/global-error.tsx` | ✅ | **New.** Replaces the whole document, so it renders its own `<html>`/`<body>` and every style is an inline literal — it must survive the stylesheet, fonts and providers all being gone. |
| Loading | `app/loading.tsx` | ✅ | **New.** A skeleton in the shape of the arriving page, not a spinner. Zero JS; honours `prefers-reduced-motion`. |
| Empty cart · empty wishlist · no orders · no kept pieces · no reviews | per-route | ✅ | Rebuilt with each route, via `EmptyState`. Each says WHY it is empty rather than that it is. |

---

## Route count

**30 app routes** (23 + the six new addressable admin views + `[view]`)
+ `robots.txt`, `sitemap.xml`, `icon.jpg` generated.

**23 of 23 customer routes rebuilt.** The admin component's seven working views remain.

`/` · `/products` · `/shipping` · `/privacy` · `/terms` · `/cancellation` ·
`/authentic` · `/cart` · `/wishlist` · `/support` · `/auth/login` · `/auth/register` · `/auth/forgot-password` · `/account` · `/products/[id]` · `/checkout` · `/orders` · `/orders/[id]/invoice` · `/support/rate/[token]` · `/orders/[id]` · `/returns/[id]` · `/account/delete`

**4 of 5 app-shell surfaces rebuilt** (404, route error, global error, loading).

### The shared system

Built before the back half of the routes, so the standard is encoded once
rather than reimprovised per page:

| Piece | What it fixes |
|---|---|
| `PageShell` | The legibility scrim over the live scene, the site's one measure, and the z-index discipline that greyed out the homepage headline when it was got wrong. |
| `PageHeader` | Eyebrow / display line / standfirst — the masthead that makes routes read as one publication. |
| `Action` | The only two action styles. No filled buttons anywhere; 500ms colour transitions, no spring or bounce; `focus-visible` rings; `motion-reduce` disables all of it; `aria-disabled` on disabled controls. |
| `States` | `EmptyState`, `ErrorState`, `Skeleton*`, `Announce`. Empty copy must say **why** it is empty — "you have not ordered anything yet" and "we could not load your orders" are different sentences and only one needs a retry. |
| `PolicyDoc` | Numbered sections, sticky contents, ~68ch measure. |
| Query backoff | Exponential with jitter (~600ms / 1.2s / 2.4s). Flat retries all landed inside one Render cold start; the jitter stops a route's several queries retrying in lockstep. |

---

## Backend observations — reported, not changed

Two things I noticed while reading. **I have not touched either.**

1. **`GET /api/payments/webhook/razorpay` exists alongside the POST** (`payments.py:74`, `webhook_info`). Harmless if it only returns metadata, but a GET on a webhook path is an unusual surface to expose publicly. Worth a look.

2. **`POST /api/admin/orders/create-test`** (`admin.py:195`) creates test orders. Admin-guarded, so not exposed — but if it writes real order rows it will appear in dashboard counts and revenue figures.

Neither blocks the frontend rebuild.
