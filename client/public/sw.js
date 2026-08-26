const CACHE_PREFIX = "number-to-barcode-shell-";
const CACHE_NAME = `${CACHE_PREFIX}v6-numeric-fast-release`;
const APP_SHELL = ["/", "/manifest.webmanifest?v=numeric-fast-v3"];

// Assets with content-hash are immutable — cache-first
const IMMUTABLE_PATTERNS = [
  /\/assets\//,
  /\.[a-f0-9]{8,}\./,
  /\.(js|css|woff2|png|svg)$/,
];

function isImmutable(request) {
  const url = new URL(request.url);
  return IMMUTABLE_PATTERNS.some((pattern) => pattern.test(url.pathname));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(APP_SHELL);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (isImmutable(event.request)) {
    // Cache-first for hashed assets
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            void caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(event.request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first for HTML, manifest, and dynamic requests
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (
          response.ok &&
          response.type === "basic" &&
          new URL(event.request.url).origin === self.location.origin
        ) {
          const copy = response.clone();
          void caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(
        async () =>
          (await caches.match(event.request)) ||
          (await caches.match("/"))
      )
  );
});
