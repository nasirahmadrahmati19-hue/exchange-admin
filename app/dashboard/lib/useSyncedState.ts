"use client";
import { useState, useEffect, useCallback, useRef } from "react";
// ✅ اضافه کردن ایمپورت‌های فایربیس
import { db } from "./firebase"; 
import { doc, onSnapshot, setDoc } from "firebase/firestore";

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
    // ۲. گوش دادن به تغییرات localStorage (به عنوان پشتیبان آفلاین)
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

    // ۳. گوش دادن به پیام‌های BroadcastChannel (برای تب‌های مختلف در یک دستگاه)
    const handleBroadcast = (event: MessageEvent) => {
      if (event.data.key === key && event.data.value !== undefined) {
        if (JSON.stringify(latestState.current) !== JSON.stringify(event.data.value)) {
          setState(event.data.value);
        }
      }
    };

    // ✅ ۴. گوش دادن زنده به تغییرات فایربیس (برای همگام‌سازی بین گوشی و کامپیوتر)
    const stateDocRef = doc(db, "synced_states", key);
    const unsubscribeFirestore = onSnapshot(stateDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const firebaseValue = snapshot.data().value;
        // فقط اگر مقدار واقعاً تغییر کرده بود، آپدیت کن (جلوگیری از رندر اضافی)
        if (JSON.stringify(latestState.current) !== JSON.stringify(firebaseValue)) {
          setState(firebaseValue);
        }
      }
    });

    window.addEventListener("storage", handleStorage);
    channel?.addEventListener("message", handleBroadcast);

    // پاک‌سازی هنگام خروج از کامپوننت
    return () => {
      window.removeEventListener("storage", handleStorage);
      channel?.removeEventListener("message", handleBroadcast);
      unsubscribeFirestore(); // ✅ قطع اتصال فایربیس
    };
  }, [key]);

  // ۵. تابع به‌روزرسانی که هم localStorage، هم تب‌ها و هم فایربیس را مطلع می‌کند
  const setSyncedState = useCallback((value: T | ((prev: T) => T)) => {
    setState((prev) => {
      // پشتیبانی کامل از الگوی تابعی (prev => ...)
      const newValue = value instanceof Function ? value(prev) : value;
      
      if (typeof window !== "undefined") {
        try {
          const serialized = JSON.stringify(newValue);
          
          // ذخیره در گوشی (آفلاین)
          window.localStorage.setItem(key, serialized);
          
          // اطلاع‌رسانی به سایر تب‌های همین دستگاه
          channel?.postMessage({ key, value: newValue });
          
          // ✅ ارسال تغییرات به سرور فایربیس (برای سایر دستگاه‌ها)
          setDoc(stateDocRef, { value: newValue }, { merge: true })
            .catch((err) => console.error(`[useSyncedState] خطای فایربیس برای "${key}":`, err));

        } catch (error) {
          console.error(`[useSyncedState] خطا در ذخیره کلید "${key}":`, error);
        }
      }
      return newValue;
    });
  }, [key]);

  return [state, setSyncedState] as const;
}
