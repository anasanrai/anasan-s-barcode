const CACHE_PREFIX = "number-to-barcode-shell-";
const CACHE_NAME = `${CACHE_PREFIX}v6-numeric-fast-release`;
const APP_SHELL = ["/", "/manifest.webmanifest?v=numeric-fast-v3"];

self.addEventListener("install", event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(APP_SHELL);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (
          response.ok &&
          response.type === "basic" &&
          new URL(event.request.url).origin === self.location.origin
        ) {
          const copy = response.clone();
          void caches
            .open(CACHE_NAME)
            .then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(
        async () =>
          (await caches.match(event.request)) || (await caches.match("/"))
      )
  );
});
