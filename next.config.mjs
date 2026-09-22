import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  
  // ✅ حیاتی: در حالت توسعه (لوکال) PWA کاملاً غیرفعال شود تا کش ایجاد نکند
  disable: process.env.NODE_ENV === 'development',
  
  register: true,
  skipWaiting: true, // ✅ حیاتی: Service Worker جدید بلافاصله فعال شود
  clientsClaim: true, // ✅ حیاتی: Service Worker جدید بلافاصله کنترل صفحه را به دست بگیرد
  
  // ✅ حذف کش کردن دستی فایل‌های JS/CSS برای جلوگیری از گیر کردن روی نسخه قدیمی
  // نکست جی‌اس خودش فایل‌ها را با هش (Hash) مدیریت می‌کند و نیازی به این تنظیم دستی نیست.
  runtimeCaching: [
    {
      // ۱. Firebase و APIها: همیشه مستقیم به شبکه (بدون کش)
      urlPattern: /^https:\/\/(?:[a-zA-Z0-9-]+\.)?(?:googleapis\.com|firebaseio\.com|firebaseapp\.com)\//,
      handler: 'NetworkOnly',
    },
    {
      // ۲. صفحات HTML: اول شبکه، اگر نشد کش (با تایم‌اوت کوتاه)
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages-cache',
        networkTimeoutSeconds: 5, // کاهش به ۵ ثانیه برای سرعت بیشتر
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 24 * 60 * 60,
        },
      },
    },
  ],
});

export default withPWA({
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
});
