import { useState, useEffect, useRef } from "react";

/**
 * هوک همگام‌سازی State با localStorage (نسخه ضد خطای Next.js)
 * این نسخه از Hydration Mismatch جلوگیری می‌کند.
 */
export function useSyncedState<T>(
  key: string, 
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  
  // ۱. همیشه با مقدار اولیه شروع می‌کنیم تا رندر سرور و کلاینت در اولین لحظه یکسان باشد
  const [state, setState] = useState<T>(initialValue);
  const [isMounted, setIsMounted] = useState(false);
  const initialValueRef = useRef(initialValue);

  // ۲. فقط بعد از Mount شدن در مرورگر، مقدار واقعی را از localStorage می‌خوانیم
  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined") {
      try {
        const item = window.localStorage.getItem(key);
        if (item !== null) {
          setState(JSON.parse(item) as T);
        }
      } catch (error) {
        console.warn(`⚠️ خطا در خواندن کلید "${key}" از localStorage:`, error);
      }
    }
  }, [key]);

  // ۳. هر بار که state تغییر کرد، آن را در localStorage ذخیره می‌کنیم (فقط اگر Mount شده باشد)
  useEffect(() => {
    if (!isMounted || typeof window === "undefined") return;
    
    try {
      if (state === undefined || state === null) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, JSON.stringify(state));
      }
    } catch (error) {
      console.warn(`⚠️ خطا در ذخیره کلید "${key}" در localStorage:`, error);
    }
  }, [key, state, isMounted]);

  // ۴. همگام‌سازی بین تب‌های مختلف مرورگر
  useEffect(() => {
    if (!isMounted || typeof window === "undefined") return;

    const handleStorage = (e: StorageEvent) => {
      if (e.key === key) {
        try {
          if (e.newValue === null) {
            setState(initialValueRef.current);
          } else {
            setState(JSON.parse(e.newValue) as T);
          }
        } catch (error) {
          console.warn(`⚠️ خطا در پردازش تغییر حافظه برای کلید "${key}":`, error);
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [key, isMounted]);

  return [state, setState];
}
