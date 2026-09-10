import { useState, useEffect } from "react";

/**
 * هوک سفارشی برای مدیریت State همگام‌شده با localStorage
 * این هوک به طور خودکار داده‌ها را ذخیره، بازیابی و بین تب‌های مرورگر همگام می‌کند.
 * 
 * @param key کلید منحصر به فرد برای ذخیره در localStorage
 * @param initialValue مقدار پیش‌فرض در صورتی که داده‌ای در حافظه وجود نداشته باشد
 * @returns آرایه‌ای شامل [مقدار فعلی, تابع به‌روزرسانی]
 */
export function useSyncedState<T>(
  key: string, 
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  
  // ۱. مقداردهی اولیه ایمن (سازگار با SSR در Next.js)
  const [state, setState] = useState<T>(() => {
    if (typeof window !== "undefined") {
      try {
        const item = window.localStorage.getItem(key);
        if (item) {
          return JSON.parse(item) as T;
        }
      } catch (error) {
        console.error(`❌ خطا در خواندن کلید "${key}" از localStorage:`, error);
        // در صورت خرابی داده‌ها، مقدار پیش‌فرض را برمی‌گرداند تا برنامه کرش نکند
        return initialValue;
      }
    }
    return initialValue;
  });

  // ۲. ذخیره خودکار در localStorage هر بار که state تغییر می‌کند
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        if (state !== undefined && state !== null) {
          window.localStorage.setItem(key, JSON.stringify(state));
        } else {
          // اگر مقدار null یا undefined شد، کلید را از حافظه پاک کن
          window.localStorage.removeItem(key);
        }
      } catch (error) {
        console.error(`❌ خطا در ذخیره کلید "${key}" در localStorage:`, error);
      }
    }
  }, [key, state]);

  // ۳. همگام‌سازی بین تب‌های مختلف مرورگر (جلوگیری از بازنویسی داده‌ها)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorageChange = (e: StorageEvent) => {
      // فقط اگر کلید تغییر یافته مربوط به همین هوک باشد
      if (e.key === key) {
        try {
          if (e.newValue !== null) {
            setState(JSON.parse(e.newValue) as T);
          } else {
            setState(initialValue);
          }
        } catch (error) {
          console.error(`❌ خطا در پردازش تغییر حافظه برای کلید "${key}":`, error);
        }
      }
    };

    // گوش دادن به رویداد تغییر localStorage در سایر تب‌ها
    window.addEventListener("storage", handleStorageChange);
    
    // پاکسازی گوش‌دهنده هنگام حذف کامپوننت
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [key, initialValue]);

  return [state, setState];
}
