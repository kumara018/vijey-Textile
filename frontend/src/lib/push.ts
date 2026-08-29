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
     * Reuse an existing subscription rather than creating a second one. The
     * browser returns the same endpoint either way, so this mostly saves a
     * round trip — but calling `subscribe` again with a DIFFERENT key throws,
     * which is exactly what happens after the shop rotates its VAPID keys.
     */
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
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

/** True when this device is already receiving updates. */
export async function isSubscribed(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    return Boolean(await registration?.pushManager.getSubscription());
  } catch {
    return false;
  }
}
