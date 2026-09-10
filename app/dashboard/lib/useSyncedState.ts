import { useState, useEffect } from "react";

/**
 * هوک همگام‌سازی State با localStorage (نسخه نهایی و ضد خطای Next.js)
 * این نسخه از Hydration Mismatch و لوپ بی‌نهایت جلوگیری می‌کند.
 */
export function useSyncedState<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  // ۱. همیشه با مقدار اولیه شروع می‌کنیم تا رندر سرور و کلاینت در لحظه اول کاملاً یکسان باشد
  // این کار جلوی خطای Hydration Mismatch را می‌گیرد
  const [state, setState] = useState<T>(initialValue);
  const [isHydrated, setIsHydrated] = useState(false);

  // ۲. فقط بعد از اینکه کامپوننت در مرورگر کاملاً لود شد، مقدار را از localStorage می‌خوانیم
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const item = window.localStorage.getItem(key);
        if (item !== null) {
          setState(JSON.parse(item) as T);
        }
      } catch (error) {
        console.error(`❌ خطا در خواندن کلید "${key}" از localStorage:`, error);
      } finally {
        // علامت‌گذاری می‌کنیم که فرآیند خواندن اولیه تمام شده است
        setIsHydrated(true);
      }
    }
  }, [key]); // ✅ فقط key در وابستگی‌هاست (initialValue نیست تا لوپ ایجاد نشود)

  // ۳. هر بار که state تغییر کرد، آن را در localStorage ذخیره می‌کنیم
  useEffect(() => {
    // تا زمانی که هایدریشن اولیه تمام نشده، چیزی ذخیره نکن
    if (!isHydrated || typeof window === "undefined") return;

    try {
      if (state === undefined || state === null) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, JSON.stringify(state));
      }
    } catch (error) {
      console.error(`❌ خطا در ذخیره کلید "${key}" در localStorage:`, error);
    }
  }, [key, state, isHydrated]);

  // ۴. همگام‌سازی بین تب‌های مختلف مرورگر
  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key) {
        try {
          if (e.newValue === null) {
            // اگر در تب دیگر پاک شد، به مقدار اولیه برگرد
            // نکته: اینجا از initialValue استفاده می‌کنیم چون رفرنس آن توسط هوک مدیریت می‌شود
            setState(initialValue); 
          } else {
            setState(JSON.parse(e.newValue) as T);
          }
        } catch (error) {
          console.error(`❌ خطا در همگام‌سازی تب‌ها برای کلید "${key}":`, error);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [key, isHydrated]); // ✅ initialValue عمداً حذف شده تا اگر آرایه/آبجکت بود، باعث لوپ بی‌نهایت نشود

  return [state, setState];
}
