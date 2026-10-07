import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  
  // ✅ تنظیمات پیشرفته کش برای پایداری در حالت آفلاین
  runtimeCaching: [
    {
      // 1. کش کردن فایل‌های استاتیک (JS, CSS, تصاویر، فونت‌ها)
      // استراتژی CacheFirst: ابتدا از کش می‌خواند، اگر نبود از شبکه. (سریع‌ترین حالت)
      urlPattern: /^https?.*\.(png|jpg|jpeg|webp|svg|gif|ttf|woff|woff2|ico|css|js)$/,
      handler: "CacheFirst",
      options: {
        cacheName: "static-assets-cache",
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 روز نگهداری در کش
        },
      },
    },
    {
      // 2. کش کردن درخواست‌های شبکه و API (غیر از فایربیس)
      // استراتژی NetworkFirst: ابتدا از شبکه می‌خواهد، اما اگر تا 10 ثانیه جواب نداد (مثلاً آفلاین بود)، از کش استفاده می‌کند.
      // این خط طلایی، جلوی هنگ کردن و فریز شدن تب مرورگر را می‌گیرد.
      urlPattern: /^https?.*/,
      handler: "NetworkFirst",
      options: {
        cacheName: "network-cache",
        networkTimeoutSeconds: 10, // حداکثر زمان انتظار برای شبکه
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24, // 1 روز نگهداری در کش
        },
      },
    },
  ],
});

const nextConfig = {
  reactStrictMode: true,
  // غیرفعال کردن Source Map در پروداکشن برای کاهش حجم و افزایش سرعت لود
  productionBrowserSourceMaps: false,
};

export default withPWA(nextConfig);
