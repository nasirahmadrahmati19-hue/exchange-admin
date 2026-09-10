import { useState, useEffect, useRef } from "react";

/**
 * هوک همگام‌سازی State با localStorage
 * نسخه پایدار و بدون باگ لوپ بی‌نهایت
 */
export function useSyncedState<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  // استفاده از ref برای جلوگیری از لوپ بی‌نهایت
  const initialValueRef = useRef(initialValue);
  
  // ۱. مقداردهی اولیه ایمن
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        const parsed = JSON.parse(item);
        return parsed as T;
      }
    } catch (error) {
      console.warn(`خطا در خواندن ${key}:`, error);
    }
    return initialValue;
  });

  // ۲. ذخیره در localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (state === undefined || state === null) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, JSON.stringify(state));
      }
    } catch (error) {
      console.warn(`خطا در ذخیره ${key}:`, error);
    }
  }, [key, state]);

  // ۳. همگام‌سازی بین تب‌ها (بدون initialValue در dependency)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorage = (e: StorageEvent) => {
      if (e.key === key && e.key !== null) {
        try {
          if (e.newValue === null) {
            setState(initialValueRef.current);
          } else {
            setState(JSON.parse(e.newValue) as T);
          }
        } catch {
          // نادیده گرفتن خطای parse
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [key]); // ✅ فقط key در dependency

  return [state, setState];
}
