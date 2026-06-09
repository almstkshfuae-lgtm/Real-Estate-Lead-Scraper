const CACHE_NAME = "brilliance-pwa-cache-v2";
const OFFLINE_URL = "/offline";

const ASSETS_TO_CACHE = [
  "/",
  "/offline",
  "/manifest.json",
  "/favicon.ico",
  "/icon.png"
];

// Install Event
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching app shell and static assets");
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("[Service Worker] Clearing old cache:", cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener("fetch", (event) => {
  // Only handle GET requests and skip internal Next.js/chrome-extension requests
  if (event.request.method !== "GET" || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // CRITICAL: Never intercept API routes, Next.js internal routes, Server Actions, or RSC payloads.
  // Intercepting these causes the SW to swallow backend errors or timeout RSC navigation.
  const url = new URL(event.request.url);
  const isApi = url.pathname.startsWith("/api/");
  const isNextInternal = url.pathname.startsWith("/_next/");
  const isRsc = url.searchParams.has("_rsc") || 
                event.request.headers.get("RSC") === "1" || 
                event.request.headers.get("Next-Router-Prefetch") === "1";
  const isServerAction = event.request.method === "POST" && event.request.headers.has("Next-Action");
  const isSensitive = url.pathname.startsWith("/leads") ||
                      url.pathname.startsWith("/map") ||
                      url.pathname.startsWith("/search") ||
                      url.pathname.startsWith("/campaigns") ||
                      url.pathname.startsWith("/settings");

  if (isApi || isNextInternal || isRsc || isServerAction || isSensitive) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If the request was successful, clone the response and save it to cache
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch((err) => {
        // If network request fails, search in cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If the request is for a page navigation, return the offline fallback
          if (event.request.mode === "navigate") {
            return caches.match(OFFLINE_URL).then((offlineResponse) => {
              // Always return a valid Response — never undefined
              return offlineResponse || new Response("Offline", {
                status: 503,
                statusText: "Service Unavailable",
                headers: { "Content-Type": "text/html" }
              });
            });
          }
          // For non-navigation requests with no cache, return a native network error.
          // This avoids misleading "503 Service Unavailable" logs in the console.
          return Response.error();
        });
      })
  );
});
