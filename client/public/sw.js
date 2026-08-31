const CACHE = "pelican-barcode-v7";

// Injected by build script with the current hashed asset list
const PRECACHE_ASSETS = self.__PRECACHE_ASSETS || [];

const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/og.svg",
  "/about/anasan.jpg",
  "/tessdata/eng.traineddata.gz",
  "/tesseract/worker.min.js",
  "/tesseract/tesseract-core-simd-lstm.wasm.js",
  "/tesseract/tesseract-core-simd-lstm.wasm",
  "/tesseract/tesseract-core-lstm.wasm.js",
  "/tesseract/tesseract-core-lstm.wasm",
];

const PRECACHE_URLS = [...APP_SHELL, ...PRECACHE_ASSETS];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/assets/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".json") ||
    url.pathname.endsWith(".gz") ||
    url.pathname.endsWith(".woff2")
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.status === 200) {
    const clone = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, clone));
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Navigation: network-first with offline fallback
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Update cached HTML in the background
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put("/", clone));
          return response;
        })
        .catch(async () => (await caches.match("/")) || (await caches.match("/index.html")))
    );
    return;
  }

  // API: network-only (server OCR won't work offline)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Static assets and cross-origin fonts: cache-first
  if (isStaticAsset(url) || url.origin !== self.location.origin) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Everything else: network-first, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
