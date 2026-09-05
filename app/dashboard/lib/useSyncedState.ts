"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

const channel = typeof window !== "undefined" ? new BroadcastChannel("exchange-app-sync-channel") : null;

export function useSyncedState<T>(key: string, initialValue: T) {
  // نگهداری timestamp محلی برای جلوگیری از override شدن داده‌های جدید
  const localTimestampRef = useRef<number>(0);
  
  // ۱. خواندن فوری از localStorage
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item);
        // اگر داده timestamp داشت، آن را ذخیره کن
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
    const handleStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const parsed = JSON.parse(e.newValue);
          let value = parsed;
          let timestamp = 0;
          
          if (parsed && typeof parsed === 'object' && '_timestamp' in parsed) {
            value = parsed.value;
            timestamp = parsed._timestamp;
          }
          
          // فقط اگر timestamp جدیدتر بود، آپدیت کن
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
        let value = event.data.value;
        let timestamp = event.data.timestamp || 0;
        
        if (timestamp >= localTimestampRef.current) {
          if (JSON.stringify(latestState.current) !== JSON.stringify(value)) {
            setState(value);
            localTimestampRef.current = timestamp;
          }
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
            const data = snapshot.data();
            const fbValue = data.value;
            const fbTimestamp = data._timestamp || 0;
            
            // ⚠️ حیاتی: فقط اگر timestamp فایربیس جدیدتر یا مساوی بود، اعمال کن
            if (fbTimestamp >= localTimestampRef.current) {
              if (fbValue !== undefined && JSON.stringify(latestState.current) !== JSON.stringify(fbValue)) {
                setState(fbValue);
                localTimestampRef.current = fbTimestamp;
                
                try {
                  window.localStorage.setItem(key, JSON.stringify({
                    value: fbValue,
                    _timestamp: fbTimestamp
                  }));
                } catch (e) {
                  console.warn("⚠️ حافظه مرورگر پر است.");
                }
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

  // ۵. تابع به‌روزرسانی (با timestamp برای جلوگیری از override)
  const setSyncedState = useCallback((value: T | ((prev: T) => T)) => {
    setState((prev) => {
      const newValue = value instanceof Function ? value(prev) : value;
      const timestamp = Date.now();
      
      // آپدیت timestamp محلی
      localTimestampRef.current = timestamp;
      
      if (typeof window !== "undefined") {
        try {
          const dataWithTimestamp = {
            value: newValue,
            _timestamp: timestamp
          };
          const serialized = JSON.stringify(dataWithTimestamp);
          
          try {
            window.localStorage.setItem(key, serialized);
          } catch (storageError: any) {
            if (storageError.name === 'QuotaExceededError') {
              console.warn("⚠️ ظرفیت localStorage پر شده است!");
              window.localStorage.removeItem(key);
              try {
                window.localStorage.setItem(key, serialized);
              } catch (e) {}
            }
          }
          
          channel?.postMessage({ key, value: newValue, timestamp });
          
          import("./firebase").then(({ db }) => {
            import("firebase/firestore").then(({ doc: firestoreDoc, setDoc }) => {
              const docRef = firestoreDoc(db, "synced_states", key);
              setDoc(docRef, dataWithTimestamp, { merge: true })
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
