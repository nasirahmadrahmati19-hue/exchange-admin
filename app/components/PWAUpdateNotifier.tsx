"use client";

import { useEffect, useState } from "react";

export default function PWAUpdateNotifier() {
  const [showReload, setShowReload] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // وقتی Service Worker جدید کنترل صفحه را می‌گیرد، این رویداد فعال می‌شود
      const handleControllerChange = () => {
        setShowReload(true);
      };

      navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

      // پاک‌سازی رویداد هنگام unmount شدن کامپوننت
      return () => {
        navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      };
    }
  }, []);

  const handleReload = () => {
    // رفرش کردن صفحه برای بارگذاری نسخه‌ی جدید از سرور
    window.location.reload();
  };

  // اگر نیازی به بروزرسانی نبود، چیزی نمایش نده
  if (!showReload) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white p-4 rounded-lg shadow-xl flex flex-col sm:flex-row items-center gap-4 border border-blue-400 animate-fade-in-up">
      <span className="text-sm sm:text-base font-medium text-center sm:text-right">
        نسخه‌ی جدیدی از برنامه موجود است. برای دریافت آخرین تغییرات، بروزرسانی کنید.
      </span>
      <button
        onClick={handleReload}
        className="bg-white text-blue-600 px-5 py-2 rounded-md font-bold hover:bg-gray-100 active:scale-95 transition-all whitespace-nowrap shadow-sm"
      >
        بروزرسانی
      </button>
    </div>
  );
}
