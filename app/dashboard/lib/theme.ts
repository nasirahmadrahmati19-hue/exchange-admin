"use client";

import { useEffect, useState } from "react";

// 🔴 طبق اصل معماری: هیچ داده‌ای (حتی تنظیمات ظاهری) در localStorage ذخیره نمی‌شود.
// تم فقط در مموری نگه داشته می‌شود و پیش‌فرض «روشن» است.
export type ThemeMode = "light" | "dark";

export function useThemeState(defaultMode: ThemeMode = "light") {
  const [theme, setTheme] = useState<ThemeMode>(defaultMode);

  // پاک‌سازی یک‌بارمصرف: حذف کلید قدیمی fx-theme از localStorage (اگر از نسخه‌های قبل باقی مانده)
  useEffect(() => {
    try {
      window.localStorage.removeItem("fx-theme");
    } catch {
      /* ignore */
    }
  }, []);

  return [theme, setTheme] as const;
}
