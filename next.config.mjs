import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      // ۱. Firebase و Google APIs: کاملاً بدون کش (مستقیم به شبکه)
      // این قانون باید اول باشد تا بر قوانین بعدی اولویت داشته باشد
      urlPattern: /^https:\/\/(firestore\.googleapis\.com|firebaseio\.com|googleapis\.com|firebaseapp\.com|firebasestorage\.googleapis\.com)\//,
      handler: 'NetworkOnly',
      options: {
        cacheName: 'firebase-no-cache',
      },
    },
    {
      // ۲. صفحات HTML (Navigate requests): NetworkFirst با تایم‌اوت ۱۰ ثانیه
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages-cache',
        networkTimeoutSeconds: 10,
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
