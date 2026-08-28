"use client";
import { useState, useEffect, useCallback } from "react";

export function useSyncedState<T>(key: string, initialValue: T) {
  const [state, setStateInternal] = useState<T>(() => {
    if (typeof window !== "undefined") {
      try {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : initialValue;
      } catch (e) {
        return initialValue;
      }
    }
    return initialValue;
  });

  // گوش دادن به تغییرات از تب‌های دیگر مرورگر
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStateInternal(JSON.parse(e.newValue));
        } catch (err) {
          console.error("Sync error:", err);
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [key]);

  // تابع تنظیم‌کننده هوشمند (پشتیبانی از both: مقدار مستقیم و تابع prev =>)
  const setSyncedState = useCallback((value: T | ((prev: T) => T)) => {
    setStateInternal((prev) => {
      // اگر ورودی یک تابع بود (مثل prev => ...) آن را اجرا کن
      const nextValue = typeof value === "function" 
        ? (value as (prev: T) => T)(prev) 
        : value;
      
      // ذخیره در حافظه مرورگر
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(key, JSON.stringify(nextValue));
        } catch (e) {
          console.error("LocalStorage save error:", e);
        }
      }
      
      return nextValue;
    });
  }, [key]);

  return [state, setSyncedState] as const;
}
