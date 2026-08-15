import { QueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import {
  productsAPI, ordersAPI, wishlistAPI, returnsAPI, addressAPI, authAPI, supportAPI,
} from './api';

/**
 * Server-state layer.
 *
 * This sits *on top of* the existing axios instance and never replaces it.
 * That instance carries two behaviours the whole session depends on:
 *
 *   1. the sliding session — an `x-new-token` response header is written to
 *      localStorage and a 90-day cookie on any authenticated call, which is
 *      what keeps a device signed in indefinitely while it is being used
 *   2. the 401 path — before logging anyone out it re-checks /api/auth/me,
 *      so a single endpoint failing does not sign the customer out
 *
 * Every query below therefore calls the same `*API` helpers the pages already
 * used. Query owns caching and revalidation; axios still owns the transport,
 * the auth header, and both interceptors.
 */

/**
 * A 4xx is an answer, not a failure to deliver one. Retrying a 401, 403 or 404
 * cannot change the outcome and — on the 401 path specifically — would fire
 * the interceptor's /api/auth/me re-check several times over.
 */
function retryPolicy(failureCount: number, error: unknown): boolean {
  const status = (error as AxiosError)?.response?.status;
  if (status && status >= 400 && status < 500) return false;
  return failureCount < 2;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: retryPolicy,
        // The backend runs on Render, where a cold start can take up to 60s.
        // Serving a slightly stale list instantly beats blocking on that, and
        // it is the whole reason a route change should not refetch a product
        // list the customer saw four seconds ago.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        // Refetching every time the tab regains focus is wrong for a
        // storefront — people tab away to check a size chart and come back.
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        // Never automatically retry a mutation: placing an order or adding to
        // cart twice is far worse than surfacing one failure.
        retry: false,
      },
    },
  });
}

/**
 * Query keys, centralised.
 *
 * Written as a hierarchy so an invalidation can target a whole branch —
 * invalidating `['orders']` covers the list and every detail view, which is
 * what you want after a cancellation.
 */
export const qk = {
  products: {
    all:    ['products'] as const,
    list:   (params: Record<string, unknown>) => ['products', 'list', params] as const,
    detail: (id: number) => ['products', 'detail', id] as const,
    reviews: (id: number) => ['products', 'reviews', id] as const,
    canReview: (id: number) => ['products', 'can-review', id] as const,
    categories: ['products', 'categories'] as const,
    recentReviews: (limit: number) => ['products', 'recent-reviews', limit] as const,
  },
  orders: {
    all:    ['orders'] as const,
    list:   ['orders', 'list'] as const,
    detail: (id: number) => ['orders', 'detail', id] as const,
    track:  (id: number) => ['orders', 'track', id] as const,
  },
  returns: {
    all:    ['returns'] as const,
    list:   ['returns', 'list'] as const,
    detail: (id: number) => ['returns', 'detail', id] as const,
  },
  wishlist: {
    all:  ['wishlist'] as const,
    list: ['wishlist', 'list'] as const,
    ids:  ['wishlist', 'ids'] as const,
  },
  addresses: ['addresses'] as const,
  auth: {
    me:       ['auth', 'me'] as const,
    sessions: ['auth', 'sessions'] as const,
  },
  support: {
    summary:      ['support', 'summary'] as const,
    interactions: ['support', 'interactions'] as const,
  },
} as const;

/* ── Query options ────────────────────────────────────────────────────
 * Thin factories rather than custom hooks: they compose with useQuery,
 * useSuspenseQuery and prefetchQuery alike, and keep the unwrapping of
 * axios's `.data` in exactly one place per resource.
 */

export const productListQuery = (params: Record<string, unknown>) => ({
  queryKey: qk.products.list(params),
  queryFn: async () => (await productsAPI.getAll(params)).data,
});

export const productDetailQuery = (id: number) => ({
  queryKey: qk.products.detail(id),
  queryFn: async () => (await productsAPI.getOne(id)).data,
  enabled: Number.isFinite(id) && id > 0,
});

export const productReviewsQuery = (id: number) => ({
  queryKey: qk.products.reviews(id),
  queryFn: async () => (await productsAPI.getReviews(id)).data,
  enabled: Number.isFinite(id) && id > 0,
});

export const recentReviewsQuery = (limit = 6) => ({
  queryKey: qk.products.recentReviews(limit),
  queryFn: async () => (await productsAPI.getRecentReviews(limit)).data,
  // Homepage social proof: worth holding far longer than a product list.
  staleTime: 5 * 60_000,
});

export const ordersQuery = () => ({
  queryKey: qk.orders.list,
  queryFn: async () => (await ordersAPI.getAll()).data,
});

export const orderDetailQuery = (id: number) => ({
  queryKey: qk.orders.detail(id),
  queryFn: async () => (await ordersAPI.getOne(id)).data,
  enabled: Number.isFinite(id) && id > 0,
});

/**
 * The returns list is decoration on the orders page — an order must still
 * render if this fails. Swallowing to [] here preserves exactly the
 * behaviour the page had before, where the call was `.catch(() => ({data:[]}))`.
 */
export const returnsQuery = () => ({
  queryKey: qk.returns.list,
  queryFn: async () => {
    try {
      return (await returnsAPI.getAll()).data;
    } catch {
      return [];
    }
  },
});

export const returnDetailQuery = (id: number) => ({
  queryKey: qk.returns.detail(id),
  queryFn: async () => (await returnsAPI.getOne(id)).data,
  enabled: Number.isFinite(id) && id > 0,
});

export const wishlistQuery = () => ({
  queryKey: qk.wishlist.list,
  queryFn: async () => (await wishlistAPI.getAll()).data,
});

export const addressesQuery = () => ({
  queryKey: qk.addresses,
  queryFn: async () => (await addressAPI.getAll()).data,
});

export const sessionsQuery = () => ({
  queryKey: qk.auth.sessions,
  queryFn: async () => (await authAPI.getSessions()).data,
});

export const supportSummaryQuery = () => ({
  queryKey: qk.support.summary,
  queryFn: async () => (await supportAPI.getRatingSummary()).data,
  staleTime: 5 * 60_000,
});

/**
 * Pulls a human-readable message out of a FastAPI error response.
 *
 * FastAPI returns `detail` as a string for HTTPException and as an array of
 * per-field objects for a 422 validation failure. Rendering the array
 * directly is how "[object Object]" ends up in front of a customer.
 */
export function errorMessage(error: unknown, fallback = 'Something went wrong'): string {
  const detail = (error as AxiosError<{ detail?: unknown }>)?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: string } | undefined;
    if (first?.msg) return first.msg;
  }
  const message = (error as Error)?.message;
  return message || fallback;
}
