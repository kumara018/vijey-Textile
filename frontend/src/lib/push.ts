'use client';

import api from './api';

/**
 * Turning order updates on, from the browser's side.
 *
 * WHY THE PROMPT IS NEVER SHOWN ON ARRIVAL. A notification permission prompt
 * is asked once and remembered forever: if a customer dismisses it — which is
 * what almost everybody does to a prompt that appears before they have seen
 * anything — the browser records a denial and will not ask again. The chance
 * is spent, permanently, on somebody who had no reason yet to say yes.
 *
 * So `enablePush` is only ever called from a control the customer pressed,
 * after they have placed an order and have an actual reason to want to know
 * where it is. Same reasoning as the location prompt at checkout.
 *
 * WHAT THIS IS FOR. Every other channel this shop has can be priced or
 * switched off — SMS always costs, WhatsApp's free window closes in October.
 * The browser's push service charges nothing and has no account to suspend.
 */

/** Why a subscription attempt did not end with notifications switched on. */
export type PushOutcome =
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'denied' | 'dismissed' | 'not-configured' | 'failed' };

/** Whether this browser can do web push at all. */
export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * What the browser currently thinks, without asking it anything.
 *
 * `denied` is worth reading before rendering a control: offering "turn on
 * notifications" to somebody whose browser has already refused produces a
 * button that silently does nothing, and they will press it twice before
 * concluding the shop is broken.
 */
export function permissionState(): NotificationPermission | 'unsupported' {
  if (!pushSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * The VAPID key arrives base64url-encoded and `subscribe` wants raw bytes.
 *
 * The padding matters: base64url strips `=`, and `atob` rejects a string whose
 * length is not a multiple of four. Restoring it is not optional tidying —
 * without it this throws on roughly half of all keys, which is the kind of bug
 * that looks like "push works on my machine".
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalised);

  /*
   * The buffer is allocated explicitly rather than using `Uint8Array.from`,
   * because that returns `Uint8Array<ArrayBufferLike>` — a type that also
   * covers views onto a SharedArrayBuffer, which `applicationServerKey` will
   * not accept. Allocating a plain ArrayBuffer here makes the type exact
   * instead of casting the mismatch away.
   */
  const buffer = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * The reverse, so an existing subscription can be compared with the shop's
 * current key. Padding is stripped because the server sends its key unpadded
 * and two spellings of the same key must not read as different.
 */
function uint8ArrayToUrlBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Same key, however it happens to be spelled.
 *
 * Exported for tests. Getting this wrong is expensive in both directions: say
 * "different" when they match and every page load unsubscribes and resubscribes
 * the customer; say "same" when they differ and the rotation this function
 * exists to detect goes unnoticed.
 */
export function sameKey(a: string, b: string): boolean {
  const strip = (s: string) => s.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return strip(a) === strip(b);
}

/**
 * Ask permission, subscribe, and register the device with the shop.
 *
 * Only call this from a real user gesture. See the note at the top.
 */
export async function enablePush(): Promise<PushOutcome> {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };

  let key: string | null = null;
  try {
    const res = await api.get('/api/push/key');
    if (!res.data?.enabled || !res.data?.key) return { ok: false, reason: 'not-configured' };
    key = res.data.key;
  } catch {
    return { ok: false, reason: 'not-configured' };
  }

  // Asked before registering the worker: a customer who says no should not
  // have left a service worker installed on their machine for nothing.
  const permission = await Notification.requestPermission();
  if (permission === 'denied') return { ok: false, reason: 'denied' };
  if (permission !== 'granted') return { ok: false, reason: 'dismissed' };

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    /*
     * Reuse an existing subscription rather than creating a second one — the
     * browser returns the same endpoint either way, so this saves a round trip.
     *
     * UNLESS IT IS BOUND TO A KEY THE SHOP NO LONGER HAS. A subscription is
     * tied to the VAPID key it was created with; rotate the keys and every
     * existing one is permanently undeliverable. The push service answers 403
     * to those, not 404 or 410, so the server cannot safely prune them either —
     * a misconfigured VAPID subject produces the same 403 for every device, and
     * treating that as "dead subscription" would delete the lot.
     *
     * The browser is the only place that can tell the two apart, because only
     * it can see which key its own subscription was made with. So compare, and
     * if they differ, retire the old one and subscribe afresh. Without this a
     * customer who turned notifications on before a rotation stays silently
     * broken forever: the code reuses their stale subscription, so they never
     * resubscribe, and pressing the button again changes nothing.
     */
    const existing = await registration.pushManager.getSubscription();
    let subscription = existing;

    if (existing) {
      const boundTo = existing.options?.applicationServerKey;
      const stale = !boundTo || !sameKey(uint8ArrayToUrlBase64(boundTo), key!);
      if (stale) {
        // Told to the shop first, so the row is removed rather than left
        // behind as an endpoint nothing can ever reach — same ordering as
        // disablePush, and for the same reason.
        try {
          const old = existing.toJSON();
          await api.post('/api/push/unsubscribe', {
            endpoint: existing.endpoint,
            p256dh: old.keys?.p256dh,
            auth: old.keys?.auth,
          });
        } catch {
          // Best effort. A row we could not delete is untidy; failing to
          // resubscribe the customer because of it would be worse.
        }
        await existing.unsubscribe();
        subscription = null;
      }
    }

    subscription =
      subscription ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key!),
      }));

    const json = subscription.toJSON();
    await api.post('/api/push/subscribe', {
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    });

    return { ok: true };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

/** Stop notifications on this device, both here and at the shop. */
export async function disablePush(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return false;

    const json = subscription.toJSON();
    // Told to the shop FIRST. Unsubscribing locally first would leave the
    // server holding an endpoint it can never reach and never prune.
    await api.post('/api/push/unsubscribe', {
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    });
    await subscription.unsubscribe();
    return true;
  } catch {
    return false;
  }
}

/**
 * True when this device is already receiving updates — genuinely, not just
 * holding a subscription object.
 *
 * A subscription bound to a rotated-away VAPID key still exists in the browser
 * and still looks live from here. Reporting that as "on" is the worst answer
 * available: the customer is shown "we will buzz this device", offered nothing
 * but a Turn-off button, and never buzzed. Saying "off" is both true and
 * actionable — the button they then press resubscribes them properly.
 *
 * The key check costs one small GET. If it cannot be made, fall back to
 * reporting what the browser holds rather than logging somebody out of
 * notifications over a dropped connection.
 */
export async function isSubscribed(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return false;

    try {
      const res = await api.get('/api/push/key');
      const current: string | undefined = res.data?.key;
      if (res.data?.enabled && current) {
        const boundTo = subscription.options?.applicationServerKey;
        if (!boundTo) return false;
        return sameKey(uint8ArrayToUrlBase64(boundTo), current);
      }
    } catch {
      // Network trouble, not a stale key. Fall through.
    }
    return true;
  } catch {
    return false;
  }
}
