// lib/useSyncedState.ts
import { useState, useEffect } from "react";

export function useSyncedState<T>(key: string, initialValue: T) {
  // ۱. خواندن مقدار اولیه از localStorage
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // ۲. گوش دادن به تغییرات (هم از تب‌های دیگر مرورگر، هم از همین تب)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        setState(JSON.parse(e.newValue));
      }
    };
    
    const handleCustomUpdate = () => {
      try {
        const item = window.localStorage.getItem(key);
        if (item) setState(JSON.parse(item));
      } catch {}
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("db-updated", handleCustomUpdate);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("db-updated", handleCustomUpdate);
    };
  }, [key]);

  // ۳. تابعی که هم داده را ذخیره می‌کند، هم به همه تب‌ها خبر می‌دهد
  const setSyncedState = (value: T | ((val: T) => T)) => {
    const newValue = value instanceof Function ? value(state) : value;
    setState(newValue);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, JSON.stringify(newValue));
      window.dispatchEvent(new Event("db-updated")); // سیگنال جادویی
    }
  };

  return [state, setSyncedState] as const;
}
