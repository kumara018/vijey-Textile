import { describe, it, expect } from 'vitest';
import { safeReturnPath } from '../returnPath';

/**
 * Where Back and a finished sign-in may send the customer.
 *
 * The whole value of this is the safety of it: a return path that accepts an
 * outside address turns the sign-in page into an open redirect — sign in on the
 * real shop, land on a lookalike. Identical in both shops.
 */
describe('safeReturnPath', () => {
  it('keeps the page the customer was on, query and all', () => {
    expect(safeReturnPath('/products/12')).toBe('/products/12');
    expect(safeReturnPath('/products?category=Lehenga&sort=price')).toBe('/products?category=Lehenga&sort=price');
    expect(safeReturnPath('/cart')).toBe('/cart');
    expect(safeReturnPath('/checkout?buy=1')).toBe('/checkout?buy=1');
    expect(safeReturnPath('/')).toBe('/');
  });

  it('refuses anything that would leave the shop', () => {
    for (const bad of [
      '//evil.example/path',
      '/\\evil.example',
      'https://evil.example',
      'http://evil.example/products',
      'javascript:alert(1)',
      'evil.example',
      '',
      '   ',
    ]) {
      expect(safeReturnPath(bad), bad).toBeNull();
    }
  });

  it('never sends Back into the sign-in pages themselves', () => {
    expect(safeReturnPath('/auth/login')).toBeNull();
    expect(safeReturnPath('/auth/login?switch=1')).toBeNull();
    expect(safeReturnPath('/auth/register')).toBeNull();
    expect(safeReturnPath('/auth/forgot-password')).toBeNull();
  });

  it('never sends a customer who signed in to the admin', () => {
    expect(safeReturnPath('/admin')).toBeNull();
    expect(safeReturnPath('/admin/orders')).toBeNull();
    expect(safeReturnPath('/admin?tab=products')).toBeNull();
    // ...but a shop page that merely starts with the same letters is fine.
    expect(safeReturnPath('/administration-policy')).toBe('/administration-policy');
  });

  it('survives junk rather than throwing', () => {
    expect(safeReturnPath(null)).toBeNull();
    expect(safeReturnPath(undefined)).toBeNull();
    expect(safeReturnPath(42)).toBeNull();
    expect(safeReturnPath('/products\n/evil')).toBeNull();
    expect(safeReturnPath('/' + 'a'.repeat(600))).toBeNull();
  });
});
