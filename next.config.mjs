// next.config.mjs
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  // در حالت development سرویس‌ورکر غیرفعال می‌شود تا Hot Reload خراب نشود
  disable: process.env.NODE_ENV === "development",
  register: true,
  sw: "service-worker.js",
  workboxOptions: {
    disableDevLogs: process.env.NODE_ENV === "production",
    skipWaiting: false,
    clientsClaim: true,
    runtimeCaching: [
      {
        // تصاویر و فونت‌ها
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|woff2?)$/,
        handler: "CacheFirst",
        options: {
          cacheName: "static-assets",
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 60 * 60 * 24 * 30, // ۳۰ روز
          },
        },
      },
      {
        // فایل‌های JS و CSS اپ
        urlPattern: /\.(?:js|css)$/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "app-assets",
        },
      },
      {
        // صفحات HTML (NetworkFirst برای همیشه آخرین نسخه)
        urlPattern: ({ url }) =>
          url.origin === self.location.origin &&
          !url.pathname.startsWith("/api/"),
        handler: "NetworkFirst",
        options: {
          cacheName: "pages",
          networkTimeoutSeconds: 5,
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24 * 7, // یک هفته
          },
        },
      },
      {
        // ⚠️ درخواست‌های Firestore را به Service Worker نسپارید
        // چون Firestore خودش IndexedDB دارد و تداخل ایجاد می‌شود
        urlPattern: /firestore\.googleapis\.com/,
        handler: "NetworkOnly",
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // اگر تنظیمات دیگری دارید (مثل images.domains)، اینجا اضافه کنید
};

export default withPWA(nextConfig);
