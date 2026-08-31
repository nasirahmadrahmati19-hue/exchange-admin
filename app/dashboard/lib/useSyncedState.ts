"use client";
import { useState, useEffect, useCallback, useRef } from "react";

// ایجاد یک کانال ارتباطی سراسری و مشترک بین تمام تب‌های برنامه
const channel = typeof window !== "undefined" ? new BroadcastChannel("exchange-app-sync-channel") : null;

export function useSyncedState<T>(key: string, initialValue: T) {
  // ۱. خواندن مقدار اولیه از localStorage
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`[useSyncedState] خطا در خواندن کلید "${key}":`, error);
      return initialValue;
    }
  });

  // نگهداری آخرین مقدار برای جلوگیری از حلقه‌های بی‌نهایت
  const latestState = useRef(state);
  latestState.current = state;

  useEffect(() => {
    // ۲. گوش دادن به تغییرات localStorage (به عنوان پشتیبان)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (JSON.stringify(latestState.current) !== JSON.stringify(parsed)) {
            setState(parsed);
          }
        } catch (error) {
          console.error(`[useSyncedState] خطا در پارس کردن کلید "${key}":`, error);
        }
      }
    };

    // ۳. گوش دادن به پیام‌های BroadcastChannel (روش اصلی و سریع)
    const handleBroadcast = (event: MessageEvent) => {
      if (event.data.key === key && event.data.value !== undefined) {
        if (JSON.stringify(latestState.current) !== JSON.stringify(event.data.value)) {
          setState(event.data.value);
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    channel?.addEventListener("message", handleBroadcast);

    return () => {
      window.removeEventListener("storage", handleStorage);
      channel?.removeEventListener("message", handleBroadcast);
    };
  }, [key]);

  // ۴. تابع به‌روزرسانی که هم localStorage و هم سایر تب‌ها را مطلع می‌کند
  const setSyncedState = useCallback((value: T | ((prev: T) => T)) => {
    setState((prev) => {
      // پشتیبانی کامل از الگوی تابعی (prev => ...)
      const newValue = value instanceof Function ? value(prev) : value;
      
      if (typeof window !== "undefined") {
        try {
          const serialized = JSON.stringify(newValue);
          window.localStorage.setItem(key, serialized);
          // ارسال فوری پیام به سایر تب‌ها
          channel?.postMessage({ key, value: newValue });
        } catch (error) {
          console.error(`[useSyncedState] خطا در ذخیره کلید "${key}":`, error);
        }
      }
      return newValue;
    });
  }, [key]);

  return [state, setSyncedState] as const;
}
