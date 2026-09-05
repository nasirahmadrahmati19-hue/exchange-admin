"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

const channel = typeof window !== "undefined" ? new BroadcastChannel("exchange-app-sync-channel") : null;

export function useSyncedState<T>(key: string, initialValue: T) {
  // ۱. خواندن فوری از localStorage
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`[useSyncedState] خطا در خواندن "${key}". استفاده از مقدار پیش‌فرض.`);
      return initialValue;
    }
  });

  const latestState = useRef(state);
  latestState.current = state;

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (JSON.stringify(latestState.current) !== JSON.stringify(parsed)) {
            setState(parsed);
          }
        } catch (error) {}
      }
    };

    const handleBroadcast = (event: MessageEvent) => {
      if (event.data.key === key && event.data.value !== undefined) {
        if (JSON.stringify(latestState.current) !== JSON.stringify(event.data.value)) {
          setState(event.data.value);
        }
      }
    };

    let unsubscribeFirestore: (() => void) | undefined;
    
    const setupFirestore = async () => {
      try {
        const { doc: firestoreDoc } = await import("firebase/firestore");
        const docRef = firestoreDoc(db, "synced_states", key);
        
        unsubscribeFirestore = onSnapshot(docRef, (snapshot) => {
          if (snapshot.exists()) {
            const fbValue = snapshot.data().value;
            if (fbValue !== undefined && JSON.stringify(latestState.current) !== JSON.stringify(fbValue)) {
              setState(fbValue);
              try {
                window.localStorage.setItem(key, JSON.stringify(fbValue));
              } catch (e) {
                // اگر حافظه پر بود، فقط در کنسول هشدار بده ولی برنامه را متوقف نکن
                console.warn("⚠️ حافظه مرورگر پر است. داده‌ها از فایربیس خوانده می‌شوند.");
              }
            }
          }
        }, (error) => {
          console.warn(`[useSyncedState] خطای شنود فایربیس:`, error.message);
        });
      } catch (error) {
        console.warn(`[useSyncedState] فایربیس در دسترس نیست.`);
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

  // ۵. تابع به‌روزرسانی (با مدیریت خطای پر شدن حافظه)
  const setSyncedState = useCallback((value: T | ((prev: T) => T)) => {
    setState((prev) => {
      const newValue = value instanceof Function ? value(prev) : value;
      
      if (typeof window !== "undefined") {
        try {
          const serialized = JSON.stringify(newValue);
          
          // تلاش برای ذخیره در localStorage
          try {
            window.localStorage.setItem(key, serialized);
          } catch (storageError: any) {
            if (storageError.name === 'QuotaExceededError') {
              console.warn("⚠️ ظرفیت localStorage پر شده است! داده‌ها فقط در فایربیس ذخیره می‌شوند.");
              // اختیاری: پاک کردن داده قدیمی برای آزاد کردن فضا
              window.localStorage.removeItem(key);
              try {
                window.localStorage.setItem(key, serialized);
              } catch (e) {
                console.error("❌ همچنان نمی‌توان در localStorage ذخیره کرد.");
              }
            } else {
              console.error("❌ خطای ناشناخته در localStorage:", storageError);
            }
          }
          
          channel?.postMessage({ key, value: newValue });
          
          // ارسال به فایربیس (این بخش همیشه کار می‌کند حتی اگر localStorage پر باشد)
          import("./firebase").then(({ db }) => {
            import("firebase/firestore").then(({ doc: firestoreDoc, setDoc }) => {
              const docRef = firestoreDoc(db, "synced_states", key);
              setDoc(docRef, { value: newValue }, { merge: true })
                .catch((err) => console.error(`[useSyncedState] خطای فایربیس:`, err));
            });
          }).catch(() => {});

        } catch (error) {
          console.error(`[useSyncedState] خطای کلی در ذخیره "${key}":`, error);
        }
      }
      return newValue;
    });
  }, [key]);

  return [state, setSyncedState] as const;
}
