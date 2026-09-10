import { useState, useEffect, useRef } from "react";

/**
 * هوک همگام‌سازی State با localStorage (نسخه نهایی و ضد خطای Next.js)
 * رفع باگ Stale Closure و جلوگیری از لوپ بی‌نهایت با استفاده از useRef
 */
export function useSyncedState<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  // ۱. شروع با مقدار اولیه برای یکسان بودن رندر سرور و کلاینت (جلوگیری از Hydration Mismatch)
  const [state, setState] = useState<T>(initialValue);
  const [isHydrated, setIsHydrated] = useState(false);
  
  // ۲. استفاده از useRef برای نگهداری آخرین مقدار initialValue بدون ایجاد رندر اضافی
  const initialValueRef = useRef(initialValue);

  // به‌روزرسانی رفرنس هر بار که initialValue تغییر کند (بدون تریگر کردن لوپ)
  useEffect(() => {
    initialValueRef.current = initialValue;
  }, [initialValue]);

  // ۳. خواندن از localStorage فقط در سمت کلاینت
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
        // اطمینان از اینکه فرآیند خواندن اولیه تمام شده است
        setIsHydrated(true);
      }
    }
  }, [key]); // ✅ فقط key (جلوگیری از لوپ)

  // ۴. ذخیره در localStorage هنگام تغییر state
  useEffect(() => {
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

  // ۵. همگام‌سازی بین تب‌های مختلف مرورگر
  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key) {
        try {
          if (e.newValue === null) {
            // ✅ FIX: استفاده از initialValueRef.current به جای initialValue
            // این کار جلوی باگ Stale Closure و لوپ بی‌نهایت را می‌گیرد
            setState(initialValueRef.current); 
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
  }, [key, isHydrated]); // ✅ initialValue عمداً حذف شده، چون از طریق Ref مدیریت می‌شود

  return [state, setState];
}
