'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { productsAPI, adminAPI } from './api';
import { qk } from './query';
import { FALLBACK_CATEGORIES } from './categories';
import type { ShopCategory } from '@/types';

/**
 * The shop's categories, as every menu, filter and form should read them.
 *
 * WHY THIS EXISTS. The list used to be typed out by hand in each place that
 * showed it — the menu, the footer, the listing's filter rail, the admin's
 * product form — about ten copies per shop. Adding a category meant finding
 * all of them and redeploying; missing one meant a garment filed under a name
 * that one of the menus did not offer. The `categories` table is the list now,
 * edited from the workroom, and this is the only way the frontend reads it.
 *
 * NEVER EMPTY, NEVER AN ERROR. Until the API answers — and if it cannot — the
 * built-in list stands in, so a slow or sleeping server shows the usual menu
 * rather than a blank one. Same identical file in both shops; only
 * FALLBACK_CATEGORIES differs.
 */
export function useCategories() {
  const q = useQuery({
    queryKey: qk.products.categories,
    queryFn: async () => (await productsAPI.getCategories()).data as ShopCategory[],
    // Categories change when an admin changes them, not minute to minute.
    staleTime: 5 * 60_000,
    placeholderData: FALLBACK_CATEGORIES,
  });

  const categories: ShopCategory[] =
    Array.isArray(q.data) && q.data.length > 0 ? q.data : FALLBACK_CATEGORIES;

  /** The row for one category, for its landing-page copy. */
  const find = (name?: string | null) =>
    name ? categories.find((c) => c.name.toLowerCase() === name.toLowerCase()) ?? null : null;

  return {
    categories,
    names: categories.map((c) => c.name),
    find,
    /** The icon the workroom set for a category, or null if it has none. */
    emojiFor: (name?: string | null) => find(name)?.emoji || null,
    /** True once the live list has arrived, rather than the stand-in. */
    isLive: !q.isPlaceholderData && Array.isArray(q.data) && q.data.length > 0,
  };
}

/** Query key for the workroom's own list, which includes hidden categories. */
export const ADMIN_CATEGORIES_KEY = ['admin', 'categories'] as const;

/**
 * Every category, hidden ones included — for the workroom only.
 *
 * The product form reads this rather than the shop's list: hiding a category
 * takes it out of the menus, but the admin still has to be able to file and
 * edit pieces under it.
 */
export function useAdminCategories(enabled = true) {
  const q = useQuery({
    queryKey: ADMIN_CATEGORIES_KEY,
    queryFn: async () => (await adminAPI.getCategories()).data as ShopCategory[],
    enabled,
    staleTime: 30_000,
  });
  return { categories: Array.isArray(q.data) ? q.data : [], ...q };
}

/**
 * Tell every open menu the list changed. The workroom calls this after each
 * edit, so the admin sees their change in the shop's own navigation at once
 * instead of five minutes later.
 */
export function useRefreshCategories() {
  const client = useQueryClient();
  return () => {
    client.invalidateQueries({ queryKey: qk.products.categories });
    client.invalidateQueries({ queryKey: ADMIN_CATEGORIES_KEY });
  };
}
