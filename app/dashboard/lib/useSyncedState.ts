"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

const channel = typeof window !== "undefined" ? new BroadcastChannel("exchange-app-sync-channel") : null;

export function useSyncedState<T>(key: string, initialValue: T) {
  // ۱. خواندن فوری از localStorage برای جلوگیری از صفحه سفید
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`[useSyncedState] خطا در خواندن "${key}":`, error);
      return initialValue;
    }
  });

  const latestState = useRef(state);
  latestState.current = state;

  useEffect(() => {
    // ۲. گوش دادن به تغییرات localStorage (برای تب‌های دیگر در همین دستگاه)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (JSON.stringify(latestState.current) !== JSON.stringify(parsed)) {
            setState(parsed);
          }
        } catch (error) {
          console.error(`[useSyncedState] خطا در پارس "${key}":`, error);
        }
      }
    };

    // ۳. گوش دادن به BroadcastChannel
    const handleBroadcast = (event: MessageEvent) => {
      if (event.data.key === key && event.data.value !== undefined) {
        if (JSON.stringify(latestState.current) !== JSON.stringify(event.data.value)) {
          setState(event.data.value);
        }
      }
    };

    // ۴. ✅ گوش دادن زنده به فایربیس (با منطق ضد پاک‌شدن)
    let unsubscribeFirestore: (() => void) | undefined;
    
    const setupFirestore = async () => {
      try {
        const { doc: firestoreDoc } = await import("firebase/firestore");
        const docRef = firestoreDoc(db, "synced_states", key);
        
        unsubscribeFirestore = onSnapshot(docRef, (snapshot) => {
          // ⚠️ نکته حیاتی: فقط اگر فایربیس واقعاً داده داشت، آن را اعمال کن
          if (snapshot.exists()) {
            const fbValue = snapshot.data().value;
            
            // اگر داده فایربیس با داده فعلی متفاوت بود، آپدیت کن
            if (fbValue !== undefined && JSON.stringify(latestState.current) !== JSON.stringify(fbValue)) {
              setState(fbValue);
              // همگام‌سازی معکوس: داده فایربیس را در localStorage هم ذخیره کن
              localStorage.setItem(key, JSON.stringify(fbValue));
            }
          }
          // ✅ اگر snapshot.exists() false بود (فایربیس خالی بود)، هیچ کاری نمی‌کنیم!
          // این کار باعث می‌شود داده‌های localStorage پاک نشوند.
        }, (error) => {
          console.warn(`[useSyncedState] خطای شنود فایربیس برای "${key}":`, error.message);
        });
      } catch (error) {
        console.warn(`[useSyncedState] فایربیس در دسترس نیست برای "${key}".`);
      }
    };

    if (typeof window !== "undefined") {
      setupFirestore();
    }

    window.addEventListener("storage", handleStorage);
    channel?.addEventListener("message", handleBroadcast);

    return () => {
      window.removeEventListener("storage", handleStorage);
      channel?.removeEventListener("message", handleBroadcast);
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, [key]);

  // ۵. تابع به‌روزرسانی (ذخیره همزمان در هر سه جا)
  const setSyncedState = useCallback((value: T | ((prev: T) => T)) => {
    setState((prev) => {
      const newValue = value instanceof Function ? value(prev) : value;
      
      if (typeof window !== "undefined") {
        try {
          const serialized = JSON.stringify(newValue);
          
          // ۱. ذخیره در حافظه دستگاه
          window.localStorage.setItem(key, serialized);
          
          // ۲. اطلاع‌رسانی به سایر تب‌ها
          channel?.postMessage({ key, value: newValue });
          
          // ۳. ارسال به فایربیس (با مدیریت خطا)
          import("./firebase").then(({ db }) => {
            import("firebase/firestore").then(({ doc: firestoreDoc, setDoc }) => {
              const docRef = firestoreDoc(db, "synced_states", key);
              setDoc(docRef, { value: newValue }, { merge: true })
                .catch((err) => console.warn(`[useSyncedState] خطای ذخیره فایربیس "${key}":`, err.message));
            });
          }).catch(() => {});

        } catch (error) {
          console.error(`[useSyncedState] خطا در ذخیره "${key}":`, error);
        }
      }
      return newValue;
    });
  }, [key]);

  return [state, setSyncedState] as const;
}
