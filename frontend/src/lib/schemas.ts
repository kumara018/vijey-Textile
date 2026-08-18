import { z } from 'zod';

/**
 * Client-side mirrors of the backend's Pydantic validators.
 *
 * These tighten the client. They do not define the contract — the backend is
 * still the authority and will still 422, which is deliberate: a schema that
 * drifts from the server should fail loudly at the server rather than quietly
 * let a bad payload through.
 *
 * Every rule below is copied from a real validator in backend/schemas.py, and
 * the messages are kept close to the server's so a customer sees the same
 * wording whichever side rejects the input.
 */

/**
 * backend/schemas.py — ShippingAddress.phone_valid and UserCreate.phone_valid.
 * Accepts an optional +91 / 91 / 0 prefix; the number itself must start 6-9.
 */
export const INDIAN_MOBILE = /^(\+91|91|0)?[6-9]\d{9}$/;

const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s/g, ''))
  .refine((v) => INDIAN_MOBILE.test(v), 'Enter a valid Indian mobile number');

/**
 * backend/schemas.py — UserCreate.password_strong. Four separate checks
 * server-side, kept separate here too so the customer is told which one
 * failed rather than being handed the whole rule at once.
 */
const strongPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must have at least one uppercase letter (A-Z)')
  .regex(/[a-z]/, 'Password must have at least one lowercase letter (a-z)')
  .regex(/\d/, 'Password must have at least one number (0-9)');

/** backend/schemas.py — OTPVerify.otp_valid. */
const otpCode = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'OTP must be 6 digits');

/* ── Auth ─────────────────────────────────────────────────────────── */

export const loginSchema = z.object({
  // UserLogin.identifier_valid only requires non-blank — it accepts either an
  // email or a phone, so no format check belongs here.
  identifier: z.string().trim().min(1, 'Email or phone number is required'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    full_name: z
      .string()
      .trim()
      .min(2, 'Full name must be at least 2 characters')
      .regex(/^[a-zA-Z\s]+$/, 'Name must contain only letters and spaces'),
    email: z.string().trim().email('Enter a valid email address'),
    phone,
    password: strongPassword,
    confirm_password: z.string(),
  })
  // Confirmation is a client-only concern — the backend never receives it —
  // but getting it wrong is the most common registration failure, so it is
  // caught here rather than after a round trip.
  .refine((d) => d.password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });
export type RegisterValues = z.infer<typeof registerSchema>;

export const otpSchema = z.object({ otp: otpCode });
export type OtpValues = z.infer<typeof otpSchema>;

export const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(1, 'Email or phone is required'),
});
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    identifier: z.string().trim().min(1, 'Email or phone is required'),
    otp: otpCode,
    password: strongPassword,
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

/* ── Checkout ─────────────────────────────────────────────────────── */

/**
 * backend/schemas.py:370 — ShippingAddress. Field-for-field, including
 * address_line2 being the only nullable one.
 */
export const shippingAddressSchema = z.object({
  full_name: z.string().trim().min(1, 'Full name is required'),
  phone,
  address_line1: z.string().trim().min(1, 'Address is required'),
  address_line2: z.string().trim().optional().nullable(),
  city: z.string().trim().min(1, 'City is required'),
  state: z.string().trim().min(1, 'State is required'),
  // Not validated server-side beyond being a string, but a wrong pincode is a
  // failed delivery — worth catching before the order exists.
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter a valid 6-digit pincode'),
});
export type ShippingAddressValues = z.infer<typeof shippingAddressSchema>;

/**
 * backend/schemas.py:446 — OrderCreate.payment.
 *
 * Card and UPI fields are typed for completeness because the contract carries
 * them, but this frontend never collects raw card details: payment goes
 * through Razorpay Checkout, which returns the three razorpay_* values.
 */
export const paymentDetailsSchema = z.object({
  method: z.string().min(1),
  card_number: z.string().nullable().optional(),
  card_expiry: z.string().nullable().optional(),
  card_cvv: z.string().nullable().optional(),
  card_holder_name: z.string().nullable().optional(),
  upi_id: z.string().nullable().optional(),
  razorpay_order_id: z.string().nullable().optional(),
  razorpay_payment_id: z.string().nullable().optional(),
  razorpay_signature: z.string().nullable().optional(),
});
export type PaymentDetailsValues = z.infer<typeof paymentDetailsSchema>;

/** backend/schemas.py:446 — OrderCreate, the full request body. */
export const orderCreateSchema = z.object({
  shipping_address: shippingAddressSchema,
  payment: paymentDetailsSchema,
  notes: z.string().nullable().optional(),
  open_box_delivery: z.boolean().default(false),
});
export type OrderCreateValues = z.infer<typeof orderCreateSchema>;

/* ── Account ──────────────────────────────────────────────────────── */

export const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Name must contain only letters and spaces'),
  phone,
});
export type ProfileValues = z.infer<typeof profileSchema>;

/* ── Reviews ──────────────────────────────────────────────────────── */

export const reviewSchema = z.object({
  rating: z.number().int().min(1, 'Choose a rating').max(5),
  comment: z.string().trim().max(2000, 'Review is too long').optional(),
});
export type ReviewValues = z.infer<typeof reviewSchema>;
