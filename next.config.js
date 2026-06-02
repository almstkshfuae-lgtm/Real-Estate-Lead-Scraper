import { fileURLToPath } from 'url';
import { dirname } from 'path';
import withPWAInit from "@ducanh2912/next-pwa";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,

  // ─── PWA Navigation Fix ─────────────────────────────────────────────────────
  // Prevent the Service Worker from intercepting page navigation requests
  // and returning a stale/timeout 408 when the server is slow to respond.
  // The old default (aggressiveFrontEndNavCaching: true) caused the SW to
  // cut navigation requests after Workbox's internal 3-5s timeout, producing
  // the phantom 408 errors seen in production logs.
  aggressiveFrontEndNavCaching: false,
  cacheOnFrontEndNav: false,

  // ─── Workbox Runtime Caching ─────────────────────────────────────────────────
  // Explicitly exclude all /api/* routes from being cached by the Service Worker.
  // API responses must always come from the network — caching them causes
  // stale data, and a NetworkFirst strategy with a tight timeout causes 408s.
  workboxOptions: {
    // Network timeout for navigation (document) requests.
    // If Vercel doesn't respond within 10s, fall back to the offline page.
    // This is generous enough to survive cold starts but short enough to
    // avoid the user seeing a blank loading screen forever.
    navigateFallbackDenylist: [
      // Exclude all API routes from SW interception entirely
      /^\/api\//,
      // Exclude auth routes
      /^\/api\/auth\//,
    ],
    runtimeCaching: [
      {
        // API routes: Network Only — never cache, never intercept
        urlPattern: /^https?:\/\/.*\/api\/.*/i,
        handler: "NetworkOnly",
      },
      {
        // Static assets: Cache First (long-lived)
        urlPattern: /\.(?:js|css|woff2?|png|jpg|jpeg|svg|ico)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "static-assets",
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          },
        },
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['lucide-react'],
  turbopack: {
    root: __dirname,
  },
};

export default withPWA(nextConfig);
