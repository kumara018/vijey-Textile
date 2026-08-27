import * as C from './contracts';
import axios from 'axios';
import { noteRequestId } from './errorReporter';

// Determine backend URL based on where the app is running.
// - localhost / 127.0.0.1  →  local FastAPI server
// - anywhere else (Vercel) →  Render backend
export function getApiBase(): string {
  if (typeof window === 'undefined') {
    // Server-side (Next.js SSR) — always use Render
    return 'https://vijey-textile.onrender.com';
  }
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:8000';
  }
  return 'https://vijey-textile.onrender.com';
}

const API_BASE = getApiBase();

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 65000, // 65s — Render cold starts can take up to 60s
});

// Attach JWT token to every request. Callers that need to authenticate as a
// specific (soon-to-change) account — e.g. logging out of one saved account
// while switching to another — can set config.headers.Authorization
// themselves; that explicit value is left alone instead of being clobbered
// by whatever localStorage holds when this interceptor actually runs (it
// runs as a microtask, i.e. after the current account switch has already
// written the new token to localStorage — see authAPI.logout).
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined' && !config.headers.Authorization) {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Sliding session: the backend silently re-issues a fresh, longer-lived
// token on any authenticated call once the current one is due for renewal
// (see auth.py::get_current_user) — pick it up here so it applies no matter
// which API call triggered it, not just /me. This is what keeps a device
// signed in indefinitely as long as it's actually being used, matching
// Amazon/Flipkart rather than forcing a re-login once a fixed window passes.
function _applyNewTokenHeader(res: any) {
  const newToken = res?.headers?.['x-new-token'];
  if (newToken && typeof window !== 'undefined') {
    localStorage.setItem('token', newToken);
    document.cookie = `auth_token=${newToken}; path=/; max-age=7776000; SameSite=Lax`; // 90 days
  }
}

// Auto-logout on 401 — but NEVER on auth endpoints or page-load API calls.
// Only redirect to login if /api/auth/me ALSO fails (token truly invalid).
api.interceptors.response.use(
  (res) => {
    _applyNewTokenHeader(res);
    // Remember the backend's id for this request, so a crash reported later can
    // name the exact server-side record. See errorReporter.noteRequestId.
    noteRequestId(res.headers?.['x-request-id']);
    return res;
  },
  async (err) => {
    const url    = err.config?.url || '';
    const status = err.response?.status;
    // A FAILED request is the one most worth correlating, so capture the id
    // here too — this is the path that ends in an error boundary.
    noteRequestId(err.response?.headers?.['x-request-id']);

    const isAuthEndpoint =
      url.includes('/api/auth/login')             ||
      url.includes('/api/auth/register')          ||
      url.includes('/api/auth/forgot')            ||
      url.includes('/api/auth/reset')             ||
      url.includes('/api/auth/send-login-otp')    ||
      url.includes('/api/auth/verify-login-otp')  ||
      url.includes('/api/auth/me');

    if (status === 401 && !isAuthEndpoint && typeof window !== 'undefined') {
      // Verify the token is truly dead before logging out
      try {
        await api.get('/api/auth/me');
        // Token is still valid — just this endpoint had an issue, don't logout
      } catch (meErr: any) {
        if (meErr.response?.status === 401) {
          // Token is truly invalid — clear everything and redirect
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('sessions');
          document.cookie = 'auth_token=; path=/; max-age=0';
          window.location.href = '/auth/login';
        }
      }
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  register:            (data: C.UserRegisterPayload) => api.post('/api/auth/register', data),
  verifyRegisterOtp:   (data: { identifier: string; otp_code: string }) => api.post('/api/auth/verify-register-otp', data),
  resendRegisterOtp:   (data: C.OtpRequestPayload) => api.post('/api/auth/resend-register-otp', data),
  login:               (data: object) => api.post('/api/auth/login', data),
  sendLoginOtp:        (data: C.UserLoginPayload) => api.post('/api/auth/send-login-otp', data),
  verifyLoginOtp:      (data: C.LoginOtpVerifyPayload) => api.post('/api/auth/verify-login-otp', data),
  evictAndLogin:       (data: C.DeviceEvictLoginPayload) => api.post('/api/auth/sessions/evict-and-login', data),
  // token: pass the account's own token explicitly when signing it out while
  // switching to another saved account — see the request interceptor above.
  logout:              (token?: string) => api.post('/api/auth/logout', {}, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined),
  getMe:               ()             => api.get('/api/auth/me'),
  updateProfile:       (data: object) => api.put('/api/auth/me', data),
  forgotPassword:      (data: C.OtpRequestPayload) => api.post('/api/auth/forgot-password', data),
  resetPassword:       (data: C.ResetPasswordPayload) => api.post('/api/auth/reset-password', data),
  requestDeleteAccount:    ()             => api.post('/api/auth/request-delete-account'),
  confirmDeleteAccount:    (data: object) => api.post('/api/auth/confirm-delete-account', data),
  cancelDeleteAccount:     ()             => api.post('/api/auth/cancel-delete-account'),
  requestDeactivateAccount:()             => api.post('/api/auth/request-deactivate-account'),
  confirmDeactivateAccount:(data: object) => api.post('/api/auth/confirm-deactivate-account', data),
  getSessions:         ()             => api.get('/api/auth/sessions'),
  revokeSession:       (id: number)   => api.delete(`/api/auth/sessions/${id}`),
  /**
   * Sign out everywhere, in ONE transaction on the server.  (AUTH-SPEC R5)
   *
   * Not a loop over revokeSession. The loop is fine for tidying up an old
   * tablet and wrong for the case this exists to serve — a customer who thinks
   * their account is compromised: it is not atomic, it races the sliding-session
   * refresh below, and a partial failure leaves them believing they are safe
   * when an attacker still holds a live token.
   */
  revokeAllSessions:   (exceptCurrent = true) =>
    api.post('/api/auth/sessions/revoke-all', { except_current: exceptCurrent }),
};

export const productsAPI = {
  /* `config` carries an AbortSignal for the search-as-you-type finder. It must
     be a SECOND argument: passing a signal inside `params` would serialise it
     into the query string and silently never abort anything. */
  getAll:           (params?: object, config?: object) => api.get('/api/products/', { params, ...config }),
  getOne:           (id: number)               => api.get(`/api/products/${id}`),
  getCategories:    ()                         => api.get('/api/products/categories'),
  getReviews:       (id: number)               => api.get(`/api/products/${id}/reviews`),
  canReview:        (id: number)               => api.get(`/api/products/${id}/can-review`),
  addReview:        (id: number, data: object) => api.post(`/api/products/${id}/reviews`, data),
  getRecentReviews: (limit = 6)               => api.get('/api/products/recent-reviews', { params: { limit, min_rating: 4 } }),
};

export const cartAPI = {
  get:    ()                             => api.get('/api/cart/'),
  add:    (data: object)                 => api.post('/api/cart/', data),
  update: (id: number, quantity: number) => api.put(`/api/cart/${id}?quantity=${quantity}`),
  remove: (id: number)                   => api.delete(`/api/cart/${id}`),
  clear:  ()                             => api.delete('/api/cart/'),
};

export const ordersAPI = {
  place:       (data: C.OrderCreatePayload)  => api.post('/api/orders/', data),
  getAll:      ()                            => api.get('/api/orders/'),
  getOne:      (id: number)                  => api.get(`/api/orders/${id}`),
  track:       (id: number)                  => api.get(`/api/orders/${id}/track`),
  sendInvoice: (id: number)                  => api.post(`/api/orders/${id}/send-invoice`),
  cancel:      (id: number, reason?: string) => api.post(`/api/orders/${id}/cancel`, { reason: reason || '' }),
};

export const addressAPI = {
  getAll:     ()                             => api.get('/api/addresses/'),
  add:        (data: object)                 => api.post('/api/addresses/', data),
  update:     (id: number, data: object)     => api.put(`/api/addresses/${id}`, data),
  remove:     (id: number)                   => api.delete(`/api/addresses/${id}`),
  setDefault: (id: number)                   => api.put(`/api/addresses/${id}/set-default`),
};

export const adminAPI = {
  /** Which third parties are actually switched on. Admin-only, never returns a key. */
  getIntegrations:     ()             => api.get('/api/diagnostics/integrations'),
  dashboard:          ()                           => api.get('/api/admin/dashboard'),
  getProducts:        ()                           => api.get('/api/admin/products'),
  createProduct:      (data: object)               => api.post('/api/admin/products', data),
  updateProduct:      (id: number, data: object)   => api.put(`/api/admin/products/${id}`, data),
  deleteProduct:      (id: number)                 => api.delete(`/api/admin/products/${id}`),
  uploadImage:        (form: FormData)             => api.post('/api/admin/products/upload-image', form, { headers: { 'Content-Type': 'multipart/form-data' } }),
  uploadVideo:        (form: FormData)             => api.post('/api/admin/products/upload-video', form, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getOrders:               (status?: string)            => api.get('/api/admin/orders', { params: status ? { status } : {} }),
  updateOrderStatus:       (id: number, data: object)   => api.put(`/api/admin/orders/${id}/status`, data),
  createDelhiveryShipment: (id: number)                 => api.post(`/api/admin/orders/${id}/create-delhivery-shipment`),
  syncDelhivery:           (id: number)                 => api.post(`/api/admin/orders/${id}/sync-delhivery`),
  checkServiceability:     (id: number)                 => api.get(`/api/admin/orders/${id}/check-serviceability`),
  initiateRefund:          (id: number)                 => api.post(`/api/payments/admin/orders/${id}/initiate-refund`),
  markRefunded:            (id: number)                 => api.post(`/api/payments/admin/orders/${id}/mark-refunded`),
  resetToRefundInitiated:  (id: number)                 => api.post(`/api/payments/admin/orders/${id}/reset-to-refund-initiated`),
  getUsers:                ()                           => api.get('/api/admin/users'),
  // GET /api/admin/admins — any admin may list. The revoke below is
  // primary-only and enforced server-side (routers/admin.py:459); the client
  // hides the control, it does not gate the action.
  getAdmins:               ()                           => api.get('/api/admin/admins'),
  // Admin-only read. Writing a report needs no auth (a crashing page has no
  // session to offer); reading one does, because a stack trace names
  // internal paths and component names.
  getClientErrors:         ()                           => api.get('/api/client-errors/recent'),
  revokeAdmin:             (id: number)                 => api.patch(`/api/admin/users/${id}/revoke-admin`),
  updateSettings:          (data: object)               => api.put('/api/admin/settings', data),
  getSupportRatings:       ()                           => api.get('/api/admin/support-ratings'),
};

export const supportAPI = {
  submitRating:     (data: object) => api.post('/api/support/rating', data),
  getRatingSummary: ()             => api.get('/api/support/rating/summary'),
  // CS Interaction flow
  createInteraction: (data: object) => api.post('/api/support/interactions', data),
  listInteractions:  ()             => api.get('/api/support/interactions'),
  getRatingPage:     (token: string) => api.get(`/api/support/rate/${token}`),
  submitTokenRating: (token: string, data: C.SupportRatingSubmitPayload) => api.post(`/api/support/rate/${token}`, data),
};

export const returnsAPI = {
  create:      (data: object)    => api.post('/api/returns/', data),
  getAll:      ()                => api.get('/api/returns/'),
  getOne:      (id: number)      => api.get(`/api/returns/${id}`),
  uploadImage: (form: FormData)  => api.post('/api/returns/upload-image', form, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

export const wishlistAPI = {
  getAll:  ()                => api.get('/api/wishlist/'),
  getIds:  ()                => api.get('/api/wishlist/ids'),
  add:     (product_id: number) => api.post('/api/wishlist/', { product_id }),
  remove:  (product_id: number) => api.delete(`/api/wishlist/${product_id}`),
};

export const adminReturnsAPI = {
  getAll:       ()                          => api.get('/api/admin/returns'),
  updateStatus: (id: number, data: object) => api.put(`/api/admin/returns/${id}/status`, data),
  syncDelhivery: (id: number)               => api.post(`/api/admin/returns/${id}/sync-delhivery`),
  retryPickup:      (id: number)            => api.post(`/api/admin/returns/${id}/retry-pickup`),
  retryReplacement: (id: number)            => api.post(`/api/admin/returns/${id}/retry-replacement`),
  attachAwb:        (id: number, awb: string) => api.post(`/api/admin/returns/${id}/attach-awb`, { awb }),
};

export const adminNotifAPI = {
  getAll:    ()           => api.get('/api/admin/notifications'),
  readOne:   (id: number) => api.put(`/api/admin/notifications/${id}/read`),
  readAll:   ()           => api.put('/api/admin/notifications/read-all'),
};

export default api;
