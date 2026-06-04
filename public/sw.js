/**
 * tez-motors service worker — push notifications only.
 *
 * Deliberately boring: no offline caching, no background sync. It exists so the
 * browser can deliver Web Push messages (price drops, order status) and open the
 * relevant page when the user taps a notification.
 */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "Tez Motors";
  const options = {
    body: data.body || "",
    icon: "/images/icon-192.png",
    badge: "/images/icon-192.png",
    tag: data.tag || undefined,
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Constrain the click target to our own origin. We control the push sender, but
// validating defense-in-depth means a future compromise (leaked VAPID key, bug
// in src/lib/push.ts) can't cross-site-navigate the user. Relative paths "/x"
// pass; absolute URLs only if their origin matches the registration's.
function safeTargetUrl(raw) {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 1000) return "/";
  try {
    const u = new URL(raw, self.registration.scope);
    if (u.origin !== self.location.origin) return "/";
    return u.pathname + u.search + u.hash;
  } catch {
    return "/";
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = safeTargetUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
