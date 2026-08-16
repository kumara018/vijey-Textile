/**
 * Request payload types, transcribed from `backend/schemas.py`.
 *
 * WHY THIS FILE EXISTS
 *
 * `api.ts` types every request body as `data: object`, which accepts any shape
 * at all. That is how a real bug shipped: the sign-in screen sent `{ otp }` to
 * an endpoint whose schema is `LoginOTPVerify { identifier, otp_code }`. It
 * compiled, it typechecked, it passed a browser walkthrough — and it would
 * have returned 422 at the last step of sign-in, in front of a customer, with
 * nothing in the type system to warn anyone.
 *
 * The routes still to be rebuilt — checkout, orders, returns, admin — have the
 * most complex payloads on the site. `OrderCreate` alone nests a shipping
 * address and a payment object with nine optional fields. Left untyped, that
 * class of bug repeats where the money is.
 *
 * HOW TO KEEP IT HONEST
 *
 * These are hand-transcribed, so they are only as true as the last read of
 * schemas.py. Every type below names its source class and line. When a payload
 * fails validation, check here FIRST — a mismatch means this file drifted, and
 * fixing it fixes every call site at once.
 *
 * Backend read-only: reading schemas.py to transcribe it changes nothing.
 *
 * Naming traps already found, all of which compiled fine before:
 *   · `otp_code`, never `otp`            (OTPVerify, LoginOTPVerify)
 *   · `confirm_password` is REQUIRED     (OTPVerify)
 *   · cart quantity is a QUERY param     (PUT /api/cart/{id}?quantity=N)
 */

/* ── Auth ──────────────────────────────────────────────────────────────── */

/** schemas.py:75 UserLogin */
export interface UserLoginPayload {
  identifier: string;
  password: string;
}

/** schemas.py:146 LoginOTPVerify — `otp_code`, NOT `otp`. */
export interface LoginOtpVerifyPayload {
  identifier: string;
  otp_code: string;
}

/** schemas.py:96 OTPRequest */
export interface OtpRequestPayload {
  identifier: string;
}

/**
 * schemas.py:109 OTPVerify — reset password.
 * `confirm_password` is required; the server compares the two itself.
 */
export interface ResetPasswordPayload {
  identifier: string;
  otp_code: string;
  new_password: string;
  confirm_password: string;
}

/** schemas.py:18 UserRegister */
export interface UserRegisterPayload {
  full_name: string;
  email: string;
  phone: string;
  password: string;
}

/** schemas.py:219 DeviceEvictLogin */
export interface DeviceEvictLoginPayload {
  pending_token: string;
  session_id: number;
}

/* ── Cart ──────────────────────────────────────────────────────────────── */

/**
 * schemas.py:341 CartItemAdd.
 *
 * Note the asymmetry, which is easy to get wrong: ADDING sends a body, but
 * UPDATING sends the quantity as a query parameter — `PUT /api/cart/{id}?quantity=N`
 * — with no body at all.
 */
export interface CartItemAddPayload {
  product_id: number;
  quantity?: number;
  size?: string | null;
  color?: string | null;
}

/* ── Checkout ──────────────────────────────────────────────────────────── */

/** schemas.py:370 ShippingAddress */
export interface ShippingAddressPayload {
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state: string;
  pincode: string;
}

/**
 * schemas.py:424 PaymentDetails.
 *
 * `method` is the only required field. The three razorpay_* fields are what
 * carry a completed payment back to the server, and they arrive from the
 * Razorpay checkout handler — all optional in the schema, all mandatory in
 * practice for an online order.
 */
export interface PaymentDetailsPayload {
  method: string;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  razorpay_signature?: string | null;
  card_number?: string | null;
  card_expiry?: string | null;
  card_cvv?: string | null;
  card_holder_name?: string | null;
  upi_id?: string | null;
}

/** schemas.py:446 OrderCreate */
export interface OrderCreatePayload {
  shipping_address: ShippingAddressPayload;
  payment: PaymentDetailsPayload;
  notes?: string | null;
  open_box_delivery?: boolean;
}

/** schemas.py:453 CancelOrderPayload */
export interface CancelOrderPayload {
  reason?: string | null;
}

/* ── Reviews ───────────────────────────────────────────────────────────── */

/** schemas.py:504 ReviewCreate */
export interface ReviewCreatePayload {
  product_id: number;
  rating: number;
  title?: string | null;
  comment?: string | null;
}

/* ── Returns and exchanges ─────────────────────────────────────────────── */

/**
 * schemas.py:533 ReturnRequestCreate.
 *
 * `reason` is a closed set of two — "size_issue" or "damage" — enforced
 * server-side, so it is a union here rather than a string. `images` needs 2
 * and allows 3; that is a runtime rule the type cannot express, so the form
 * has to enforce it.
 */
export interface ReturnRequestCreatePayload {
  order_id: number;
  product_id: number;
  request_type: 'return' | 'exchange';
  reason: 'size_issue' | 'damage';
  description?: string | null;
  images: string[];
  new_product_id?: number | null;
  new_size?: string | null;
  new_color?: string | null;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  razorpay_signature?: string | null;
}

/* ── Admin ─────────────────────────────────────────────────────────────── */

/** schemas.py:457 OrderStatusUpdate */
export interface OrderStatusUpdatePayload {
  status: string;
  tracking_number?: string | null;
  delivery_person_name?: string | null;
  delivery_person_phone?: string | null;
  awb_code?: string | null;
  courier_name?: string | null;
  tracking_url?: string | null;
  estimated_delivery?: string | null;
  status_location?: string | null;
}

/* ── Support ───────────────────────────────────────────────────────────── */

/**
 * schemas.py:647 SupportRatingSubmit.
 *
 * The token is a PATH parameter, not a body field — POST /api/support/rate/{token}.
 * `supportAPI.submitRating` is a different, authenticated endpoint
 * (/api/support/rating); the token-scoped one is `submitTokenRating`.
 */
export interface SupportRatingSubmitPayload {
  rating: number;
  comment?: string | null;
}
