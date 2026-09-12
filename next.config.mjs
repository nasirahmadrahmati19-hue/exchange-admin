import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  clientsClaim: true, // حیاتی: باعث می‌شود SW جدید بلافاصله کنترل صفحه را به دست بگیرد
  runtimeCaching: [
    {
      // ۱. Firebase و Google APIs: کاملاً بدون کش (مستقیم به شبکه)
      // این Regex تمام زیردامنه‌ها (مثل firestore, identitytoolkit, firebasestorage) را پوشش می‌دهد
      urlPattern: /^https:\/\/(?:[a-zA-Z0-9-]+\.)?(?:googleapis\.com|firebaseio\.com|firebaseapp\.com)\//,
      handler: 'NetworkOnly',
    },
    {
      // ۲. صفحات HTML (درخواست‌های Navigation): NetworkFirst با تایم‌اوت ۱۰ ثانیه
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages-cache',
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 50, // حداکثر ۵۰ صفحه
          maxAgeSeconds: 24 * 60 * 60, // اعتبار ۲۴ ساعت
        },
      },
    },
    {
      // ۳. فایل‌های استاتیک سایت خودمان: StaleWhileRevalidate
      urlPattern: ({ url }) => 
        url.origin === self.location.origin && 
        /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i.test(url.pathname),
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-assets',
        expiration: {
          maxEntries: 100, // حداکثر ۱۰۰ فایل
          maxAgeSeconds: 7 * 24 * 60 * 60, // اعتبار ۷ روز
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
