/*
 * Phila service worker  the installable PWA shell + an offline fallback
 * (ROADMAP Task 0.3). Low-data-first: static assets are served stale-while-
 * revalidate; navigations are network-first with an offline page fallback so a
 * counsellor on metered data still gets a calm, honest screen when the network
 * drops. The durable offline send-queue + background sync land in Phase 11.
 */
const VERSION = "phila-v2";
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll([OFFLINE_URL, "/manifest.webmanifest"])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first, fall back to the offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL)),
      ),
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  if (["style", "script", "font", "image"].includes(request.destination)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});

/*
 * Batch 4m - web push. The payload never carries a message body (title + a
 * short "open it" line + the conversation link). `tag` replaces an earlier
 * card for the same conversation instead of stacking; a click focuses an
 * open Phila tab when there is one, otherwise opens the link.
 */
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "Phila", body: event.data ? event.data.text() : "" }; }
  const title = data.title || "Phila";
  const options = {
    body: data.body || "Open Phila to read it.",
    tag: data.tag || "phila",
    renotify: true,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: data.url || "/open/messages" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/open/messages", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.focus();
          if ("navigate" in client) return client.navigate(target).catch(() => undefined);
          return undefined;
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
