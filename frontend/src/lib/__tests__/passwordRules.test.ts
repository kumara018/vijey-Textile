import { describe, it, expect } from 'vitest';
import { registerSchema, resetPasswordSchema } from '../schemas';

/**
 * The client's copy of the password rule has to match the server's, exactly.
 *
 * It did not: schemas.py checks five things and this file checked four, leaving
 * out the special character. A password like "Password123" was accepted by the
 * form, sent, and refused by the server — and the only place the missing rule
 * was named was inside a 422 body the reset screen was not built to render, so
 * the customer saw an error that did not say what was wrong with their
 * password.
 *
 * A mirror missing a rule is worse than no mirror: it promises the round trip
 * will succeed. These tests fail the moment the two sides drift apart again.
 *
 * Kept in step with backend/schemas.py — password_strong:
 *   8+ characters, one uppercase, one lowercase, one digit, one special.
 */

const GOOD = 'Customer@2026';

const BREAKS_ONE_RULE: Array<[string, string, RegExp]> = [
  ['too short',        'Ab@1cde',      /8 characters/i],
  ['no uppercase',     'customer@2026', /uppercase/i],
  ['no lowercase',     'CUSTOMER@2026', /lowercase/i],
  ['no digit',         'Customer@abcd', /number/i],
  ['no special',       'Customer2026',  /special character/i],
];

describe('the password rule the form enforces', () => {
  it('accepts a password the server accepts', () => {
    const r = resetPasswordSchema.safeParse({
      identifier: '9994168839', otp: '123456',
      password: GOOD, confirm_password: GOOD,
    });
    expect(r.success).toBe(true);
  });

  it.each(BREAKS_ONE_RULE)('rejects one that %s, and says which rule', (_label, password, says) => {
    const r = resetPasswordSchema.safeParse({
      identifier: '9994168839', otp: '123456',
      password, confirm_password: password,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toMatch(says);
    }
  });

  it('applies the same rule on the registration form', () => {
    const r = registerSchema.safeParse({
      full_name: 'Test Customer', email: 'someone@test.local', phone: '9994168839',
      password: 'Customer2026', confirm_password: 'Customer2026',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => /special character/i.test(i.message))).toBe(true);
    }
  });
});

describe('the code the reset form will submit', () => {
  it('insists on six digits before the round trip', () => {
    for (const otp of ['', '1234', '12345a', '1234567']) {
      const r = resetPasswordSchema.safeParse({
        identifier: '9994168839', otp,
        password: GOOD, confirm_password: GOOD,
      });
      expect(r.success, `accepted "${otp}" as a code`).toBe(false);
    }
  });

  it('catches two passwords that do not match', () => {
    const r = resetPasswordSchema.safeParse({
      identifier: '9994168839', otp: '123456',
      password: GOOD, confirm_password: 'Something@Else1',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => /do not match/i.test(i.message))).toBe(true);
    }
  });
});
