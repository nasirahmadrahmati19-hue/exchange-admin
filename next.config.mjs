import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  // ما runtimeCaching را حذف کردیم تا از تداخل و باگ‌های قبلی جلوگیری شود.
  // فایربیس و Next.js خودشان مدیریت کش را به بهترین شکل انجام می‌دهند.
});

const nextConfig = {
  reactStrictMode: true,
};

export default withPWA(nextConfig);
