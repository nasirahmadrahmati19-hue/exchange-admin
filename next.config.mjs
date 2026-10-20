import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  workboxOptions: {
    // don't precache the server-rendered offline page logic files twice
    skipWaiting: true,
    clientsClaim: true,
    runtimeCaching: [
      {
        // Static assets (JS/CSS/fonts/images): Cache First
        urlPattern: /^https?:\/\/.*\.(?:js|css|woff2?|png|jpg|jpeg|svg|webp|ico)(\?.*)?$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "static-assets",
          expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
      {
        // Firestore/Firebase API calls: Network First with cache fallback
        urlPattern: ({ url }) =>
          url.hostname.includes("firestore.googleapis.com") ||
          url.hostname.includes("identitytoolkit.googleapis.com") ||
          url.hostname.includes("firebase.googleapis.com"),
        handler: "NetworkFirst",
        options: {
          cacheName: "firebase-api",
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
        },
      },
      {
        // App pages: Stale-While-Revalidate
        urlPattern: ({ request }) => request.destination === "document",
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "pages",
          expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
        },
      },
    ],
  },
});

const nextConfig = {
  reactStrictMode: true,
};

export default withPWA(nextConfig);
