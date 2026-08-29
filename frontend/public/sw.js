/*
 * The service worker that receives order updates.
 *
 * WHY A SEPARATE FILE AT THE ROOT. A service worker can only control pages at
 * or below its own path, so this has to be served from `/sw.js` rather than
 * bundled — a worker at `/_next/static/…` could only ever wake for pages under
 * that directory, which is none of them.
 *
 * DELIBERATELY TINY, AND IT DOES NOT CACHE. A service worker sits between the
 * customer and every request the site makes, and a caching bug here does not
 * look like a caching bug: it looks like the shop showing a stale price, or a
 * sold-out piece still buyable, on a device that will not recover until the
 * worker is unregistered. This one only listens for pushes and handles a tap.
 * Nothing else. That is a decision, not an omission.
 */

self.addEventListener('push', (event) => {
  /*
   * A push with no readable body still deserves a notification.
   *
   * Some push services deliver an empty wake-up rather than the payload, and
   * on iOS a notification MUST be shown for every push received — a worker
   * that returns silently there has its permission revoked. So a malformed or
   * missing payload falls back to something honest rather than nothing.
   */
  let data = { title: 'Order update', body: 'Tap to see your order.', url: '/orders' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    /* not JSON — keep the fallback */
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-mark.jpg',
      badge: '/icon-mark.jpg',
      /*
       * Same tag, so a second update about the same order REPLACES the first
       * rather than stacking. A customer whose parcel moves through packed,
       * shipped and out-for-delivery should find one current notification on
       * their lock screen, not three stale ones.
       */
      tag: data.url || 'order',
      renotify: true,
      data: { url: data.url || '/orders' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/orders';

  /*
   * Focus a tab that is already open rather than piling up new ones. Somebody
   * who taps three notifications over a morning should end with one tab on
   * their order, not three.
   */
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
