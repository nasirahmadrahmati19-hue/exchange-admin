"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase"; // ✅ استفاده از ایمپورت ثابت و سریع

const channel = typeof window !== "undefined" ? new BroadcastChannel("exchange-app-sync-channel") : null;

export function useSyncedState<T>(key: string, initialValue: T) {
  const localTimestampRef = useRef<number>(0);
  
  // ۱. خواندن فوری از localStorage
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item);
        if (parsed && typeof parsed === 'object' && '_timestamp' in parsed) {
          localTimestampRef.current = parsed._timestamp;
          return parsed.value;
        }
        return parsed;
      }
      return initialValue;
    } catch (error) {
      console.warn(`[useSyncedState] خطا در خواندن "${key}".`);
      return initialValue;
    }
  });

  const latestState = useRef(state);
  latestState.current = state;

  useEffect(() => {
    // ۲. لیسنرهای تب‌های مرورگر (برای sync در یک دستگاه)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const parsed = JSON.parse(e.newValue);
          const value = parsed._timestamp ? parsed.value : parsed;
          const timestamp = parsed._timestamp || 0;
          if (timestamp >= localTimestampRef.current) {
            if (JSON.stringify(latestState.current) !== JSON.stringify(value)) {
              setState(value);
              localTimestampRef.current = timestamp;
            }
          }
        } catch (error) {}
      }
    };

    const handleBroadcast = (event: MessageEvent) => {
      if (event.data.key === key && event.data.value !== undefined) {
        const value = event.data.value;
        const timestamp = event.data.timestamp || 0;
        if (timestamp >= localTimestampRef.current) {
          if (JSON.stringify(latestState.current) !== JSON.stringify(value)) {
            setState(value);
            localTimestampRef.current = timestamp;
          }
        }
      }
    };

    // ۳. ✅ لیسنر فایربیس (بدون ایمپورت داینامیک!)
    const docRef = doc(db, "synced_states", key);
    const unsubscribeFirestore = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const fbValue = data.value;
        const fbTimestamp = data._timestamp || 0;
        
        if (fbTimestamp >= localTimestampRef.current) {
          if (fbValue !== undefined && JSON.stringify(latestState.current) !== JSON.stringify(fbValue)) {
            setState(fbValue);
            localTimestampRef.current = fbTimestamp;
            try {
              window.localStorage.setItem(key, JSON.stringify({ value: fbValue, _timestamp: fbTimestamp }));
            } catch (e) {
              console.warn("⚠️ حافظه مرورگر پر است.");
            }
          }
        }
      }
    }, (error) => {
      console.error(`[useSyncedState] ❌ خطای شنود فایربیس برای "${key}":`, error.message);
    });

    window.addEventListener("storage", handleStorage);
    channel?.addEventListener("message", handleBroadcast);

    return () => {
      window.removeEventListener("storage", handleStorage);
      channel?.removeEventListener("message", handleBroadcast);
      unsubscribeFirestore(); // ✅ پاکسازی لیسنر
    };
  }, [key]);

  // ۴. تابع به‌روزرسانی (سریع و بدون ایمپورت داینامیک)
  const setSyncedState = useCallback((value: T | ((prev: T) => T)) => {
    setState((prev) => {
      const newValue = value instanceof Function ? value(prev) : value;
      const timestamp = Date.now();
      localTimestampRef.current = timestamp;
      
      if (typeof window !== "undefined") {
        try {
          const dataWithTimestamp = { value: newValue, _timestamp: timestamp };
          const serialized = JSON.stringify(dataWithTimestamp);
          
          window.localStorage.setItem(key, serialized);
          channel?.postMessage({ key, value: newValue, timestamp });
          
          // ✅ نوشتن مستقیم در فایربیس با استفاده از ایمپورت‌های بالای فایل
          const docRef = doc(db, "synced_states", key);
          setDoc(docRef, dataWithTimestamp, { merge: true })
            .catch((err) => console.error(`[useSyncedState] ❌ خطای نوشتن در فایربیس برای "${key}":`, err));

        } catch (error) {
          console.error(`[useSyncedState] خطای کلی در ذخیره "${key}":`, error);
        }
      }
      return newValue;
    });
  }, [key]);

  return [state, setSyncedState] as const;
}
