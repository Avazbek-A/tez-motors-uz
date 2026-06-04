/**
 * tez-motors service worker — push + a lightweight offline shell (Phase AQ).
 *
 * Push: deliver Web Push (price drops, order status) and open the right page.
 * Offline: precache an offline fallback + serve a stale-while-revalidate cache
 * for same-origin GET navigations/static assets so a dropped connection shows
 * recently-viewed pages (or the branded offline page) instead of the browser
 * error. NEVER caches API, admin, or authenticated responses. Cache is versioned
 * so a deploy invalidates it.
 */
const CACHE = "tez-motors-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

// Same-origin GET, not API/admin → safe to cache.
function isCacheable(request) {
  if (request.method !== "GET") return false;
  let u;
  try {
    u = new URL(request.url);
  } catch {
    return false;
  }
  if (u.origin !== self.location.origin) return false;
  if (u.pathname.startsWith("/api/") || u.pathname.startsWith("/admin")) return false;
  return true;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!isCacheable(request)) return; // let the network handle it normally

  if (request.mode === "navigate") {
    // Navigations: network-first, fall back to cache, then the offline page.
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match(OFFLINE_URL))),
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});

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
