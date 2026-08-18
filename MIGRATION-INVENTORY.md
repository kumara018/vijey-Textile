# MIGRATION-INVENTORY.md — Vijey Textile

Source of truth for the 3D frontend rebuild. **Every entry here was read out of the
running code**, not assumed. Where the rebuild brief assumed something that is not
actually true of this codebase, that is called out explicitly under
[Corrections to the brief](#corrections-to-the-brief).

- Frontend: `frontend/` — Next.js 16 App Router, TypeScript, Tailwind
- Backend: `backend/` — FastAPI + SQLAlchemy. **Out of scope. Do not modify.**
- Live: `https://vijeytextile.com` (Vercel) → `https://vijey-textile.onrender.com` (Render)

---

## 1. API transport

`frontend/src/lib/api.ts` — a single axios instance. All calls go through it.

| Property | Value |
|---|---|
| Base URL (browser, localhost) | `http://localhost:8000` |
| Base URL (browser, anywhere else) | `https://vijey-textile.onrender.com` |
| Base URL (SSR) | `https://vijey-textile.onrender.com` |
| Timeout | `65000` ms — Render cold starts reach ~60s |
| Default header | `Content-Type: application/json` |

**Base URL is hard-coded, not an env var.** If the rebuild introduces
`NEXT_PUBLIC_API_URL`, the Vercel env must be set before cutover or every call
breaks in production.

### Auth interceptors — three behaviours that must survive

1. **Request:** attaches `Authorization: Bearer <localStorage.token>` — but only if
   the caller has not already set that header. Account-switching relies on passing
   an explicit token that must not be clobbered.
2. **Response:** reads the **`x-new-token`** response header on *any* authenticated
   call and writes it to `localStorage.token` plus an `auth_token` cookie
   (`max-age=7776000`, 90 days, `SameSite=Lax`). This is a sliding session — dropping
   it silently signs users out once their original token expires.
3. **401 handling:** does **not** log out immediately. It re-checks `/api/auth/me`
   first, and only clears storage and redirects to `/auth/login` if that *also*
   401s. Auth endpoints are exempt from this entirely.

---

## 2. Endpoint contract

Grouped as exported in `lib/api.ts`. Paths are exact.

### `authAPI`
| Method | Path |
|---|---|
| POST | `/api/auth/register` |
| POST | `/api/auth/verify-register-otp` |
| POST | `/api/auth/resend-register-otp` |
| POST | `/api/auth/login` |
| POST | `/api/auth/send-login-otp` |
| POST | `/api/auth/verify-login-otp` |
| POST | `/api/auth/sessions/evict-and-login` |
| POST | `/api/auth/logout` |
| GET / PUT | `/api/auth/me` |
| POST | `/api/auth/forgot-password` · `/api/auth/reset-password` |
| POST | `/api/auth/request-delete-account` · `/api/auth/confirm-delete-account` · `/api/auth/cancel-delete-account` |
| POST | `/api/auth/request-deactivate-account` · `/api/auth/confirm-deactivate-account` |
| GET | `/api/auth/sessions` |
| DELETE | `/api/auth/sessions/{id}` |

### `productsAPI`
| Method | Path | Notes |
|---|---|---|
| GET | `/api/products/` | **trailing slash required**; takes query params |
| GET | `/api/products/{id}` | |
| GET | `/api/products/categories` | |
| GET / POST | `/api/products/{id}/reviews` | |
| GET | `/api/products/{id}/can-review` | |
| GET | `/api/products/recent-reviews` | params `{ limit, min_rating: 4 }` |

### `cartAPI`
| Method | Path | Notes |
|---|---|---|
| GET / POST / DELETE | `/api/cart/` | trailing slash |
| PUT | `/api/cart/{id}?quantity=N` | **quantity is a query param, not a body field** |
| DELETE | `/api/cart/{id}` | |

### `ordersAPI`
| Method | Path |
|---|---|
| GET / POST | `/api/orders/` |
| GET | `/api/orders/{id}` · `/api/orders/{id}/track` |
| POST | `/api/orders/{id}/send-invoice` |
| POST | `/api/orders/{id}/cancel` — body `{ reason: string }` |

### `addressAPI`
`GET|POST /api/addresses/` · `PUT|DELETE /api/addresses/{id}` · `PUT /api/addresses/{id}/set-default`

### `wishlistAPI`
`GET /api/wishlist/` · `GET /api/wishlist/ids` · `POST /api/wishlist/` body `{ product_id }` · `DELETE /api/wishlist/{product_id}`

### `returnsAPI`
`POST|GET /api/returns/` · `GET /api/returns/{id}` · `POST /api/returns/upload-image` (multipart)

### `supportAPI`
`POST /api/support/rating` · `GET /api/support/rating/summary` · `POST|GET /api/support/interactions` · `GET|POST /api/support/rate/{token}`

### Payments
| Method | Path | Body |
|---|---|---|
| POST | `/api/payments/create-order` | `{ amount }` |
| POST | `/api/payments/webhook/razorpay` | Razorpay → backend. Not called by frontend. |

### Admin — `adminAPI`, `adminReturnsAPI`, `adminNotifAPI`
Full set under `/api/admin/*` and `/api/payments/admin/*`. See `lib/api.ts` lines
154–212. Admin is a single-page dashboard at `/admin`; it can migrate last.

---

## 3. Checkout + payment — highest-risk contract

The order of operations in `app/checkout/page.tsx`. **A bug here costs real money.**

1. `POST /api/payments/create-order` with `{ amount: grandTotal }` → Razorpay order.
2. Razorpay modal opens (see §5) and returns
   `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`.
3. `POST /api/orders/` — `ordersAPI.place(...)`.

### `OrderCreate` — exact shape (`backend/schemas.py:446`)
```jsonc
{
  "shipping_address": {
    "full_name":     "string",   // required, non-blank (validator strips + rejects empty)
    "phone":         "string",
    "address_line1": "string",
    "address_line2": "string|null",
    "city":          "string",
    "state":         "string",
    "pincode":       "string"
  },
  "payment": {
    "method":              "string",       // e.g. "razorpay" | "cod" | "upi" | "emi"
    "card_number":         "string|null",
    "card_expiry":         "string|null",
    "card_cvv":            "string|null",
    "card_holder_name":    "string|null",
    "upi_id":              "string|null",
    "razorpay_order_id":   "string|null",
    "razorpay_payment_id": "string|null",
    "razorpay_signature":  "string|null"
  },
  "notes":             "string|null",
  "open_box_delivery": false
}
```

Zod schemas in the rebuild must mirror this exactly — same optionality, same
nesting. `full_name` blank-check is enforced server-side and will 422.

---

## 4. Routes (23)

| Route | Rebuild phase |
|---|---|
| `/auth/login`, `/auth/register`, `/auth/forgot-password` | 1 — auth |
| `/products`, `/products/[id]` | 2 — listing/detail |
| `/cart`, `/wishlist` | 3 — cart |
| `/checkout` | 4 — **payment, most testing** |
| `/orders`, `/orders/[id]`, `/orders/[id]/invoice` | 5 — orders/invoices |
| `/returns/[id]` | 5 |
| `/`, `/support`, `/support/rate/[token]` | 6 |
| `/account`, `/account/delete` | 6 |
| `/authentic`, `/cancellation`, `/privacy`, `/shipping`, `/terms` | 6 — static policy |
| `/admin` | last — internal only |

Also generated: `/robots.txt`, `/sitemap.xml`, `/icon.jpg`.

---

## 5. Third-party scripts

**Exactly one.** Razorpay Checkout, injected at runtime — not in `layout.tsx`:

```
app/checkout/page.tsx:58
script.src = 'https://checkout.razorpay.com/v1/checkout.js'
```

No analytics, tag manager, pixel, or chat widget exists. Nothing else to preserve.

---

## 6. SEO — must be reproduced exactly (`app/layout.tsx`)

- `metadataBase`: `https://vijeytextile.com`
- `alternates.canonical`: `https://vijeytextile.com`
- `title`: `Vijey Textile — Luxury Baby, Kids & Girls Fashion | Texvalley Erode`
- `description`, `keywords`, `authors`, `creator`, `publisher` — copy verbatim
- `openGraph`: title, description, url, `siteName: Vijey Textile`, `locale: en_IN`, `type: website`
- `twitter`: `card: summary` + title + description
- `robots`: index/follow true, incl. googleBot
- **`verification.google`: `IQsLO0zH60lGqrYy7Jd7nvjDFO_Uf0HKbtNcK8bDsHM`** — dropping this
  un-verifies Search Console
- `icons`: `/icon-mark.jpg` for icon, shortcut, apple

---

## 7. Client state (React Context today)

| Context | Responsibility |
|---|---|
| `AuthContext` | user, token, multi-account sessions; **`setInterval` ping every 14 min** (`AuthContext.tsx:99`) |
| `CartContext` | cart items + totals |
| `WishlistContext` | wishlist ids |
| `LoginPromptContext` | login-prompt modal |

`localStorage` keys in use: `token`, `user`, `sessions`. Cookie: `auth_token`.

Migrating to Zustand must preserve all three keys and the cookie — existing signed-in
customers are holding these right now.

---

## 8. Brand assets — DO NOT CHANGE

- `frontend/public/hero-mark-v3.jpg` — hero medallion
- `frontend/public/icon-mark.jpg` — favicon/apple/OG icon
- `frontend/src/components/Logo.tsx` — `LogoMark`

The logo went through several rounds of approval. It is final. Palette is
"Wine & Steel" in `tailwind.config.js` (`maroon`/`silver`/`gold` scales).

---

## Corrections to the brief

Four points in the rebuild brief do not match this codebase:

**1. There is no real-time notification channel.**
The brief says "same real-time channel as currently used". There is none — no
WebSocket, no EventSource, no SSE anywhere in `src/`. Admin notifications are a plain
`GET /api/admin/notifications` fetched on demand, and `AuthContext` runs a 14-minute
`setInterval` ping. Adding Sonner is fine; adding real-time delivery would be **new
backend work**, which is out of scope.

**2. Invoices are not react-pdf today.**
`app/orders/[id]/invoice/page.tsx` is HTML + `@media print` CSS, triggered by
`window.print()` (line 43). Data source is `ordersAPI.getOne(id)` — that part is
accurate and can carry over. Moving to react-pdf is a genuine change of mechanism,
not a like-for-like port, and needs its own verification.

**3. Toasts are `react-hot-toast`, not Sonner.**
Mounted in `layout.tsx` with custom styling. Swapping to Sonner touches every
`toast.*` call site across the app.

**4. WebGPU is aspirational here, not a given.**
Three.js WebGPURenderer requires TSL-authored materials; hand-written GLSL will not
run on it. The plan stands, but WebGL2 is the real production path and WebGPU is the
enhancement — as the brief's own fallback requirement implies.

---

## Migration safety

- Work happens on **`feat/3d-platform`**. Never commit the rebuild to `main`.
- Cut over **only** after checkout, payment and auth are verified against the real
  backend on a deployed preview.
- The backend, database and every API contract above are **frozen**. If the rebuild
  seems to need a contract change, stop and raise it.

### Already landed on `feat/3d-platform`
React 19.2.8 · R3F 9.7 · Drei 10.7 · postprocessing · Rapier · Zustand · TanStack
Query · RHF + Zod. Verified rendering with a live WebGL context; all commerce routes
returning 200.

Ammalu Tex has **not** had this upgrade and needs its own inventory before its rebuild.
