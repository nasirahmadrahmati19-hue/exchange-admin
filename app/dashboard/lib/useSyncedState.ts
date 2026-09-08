"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

const channel = typeof window !== "undefined" ? new BroadcastChannel("exchange-app-sync-channel") : null;

export function useSyncedState<T>(key: string, initialValue: T) {
  const latestState = useRef<T>(initialValue);

  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item);
        const value = parsed && typeof parsed === "object" && "value" in parsed ? parsed.value : parsed;
        latestState.current = value;
        return value;
      }
      return initialValue;
    } catch (error) {
      console.warn(`[useSyncedState] خطا در خواندن "${key}".`, error);
      return initialValue;
    }
  });

  latestState.current = state;

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const parsed = JSON.parse(e.newValue);
          const value = parsed && typeof parsed === "object" && "value" in parsed ? parsed.value : parsed;
          if (JSON.stringify(latestState.current) !== JSON.stringify(value)) {
            setState(value);
          }
        } catch (error) {}
      }
    };

    const handleBroadcast = (event: MessageEvent) => {
      if (event.data.key === key && event.data.value !== undefined) {
        const value = event.data.value;
        if (JSON.stringify(latestState.current) !== JSON.stringify(value)) {
          setState(value);
        }
      }
    };

    const docRef = doc(db, "synced_states", key);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.metadata.hasPendingWrites) return;

        if (snapshot.exists()) {
          const data = snapshot.data();
          const fbValue = data.value;

          if (fbValue !== undefined && JSON.stringify(latestState.current) !== JSON.stringify(fbValue)) {
            console.warn(`[useSyncedState] ⚠️ داده‌ی سرور برای "${key}" با داده‌ی محلی تفاوت داشت و بازنویسی شد.`);
            setState(fbValue);
            try {
              window.localStorage.setItem(key, JSON.stringify({ value: fbValue }));
            } catch (e) {
              console.warn("⚠️ حافظه مرورگر پر است.");
            }
          }
        }
      },
      (error) => {
        console.error(`[useSyncedState] ❌ خطای شنود فایربیس برای "${key}":`, error);
      }
    );

    window.addEventListener("storage", handleStorage);
    channel?.addEventListener("message", handleBroadcast);

    return () => {
      window.removeEventListener("storage", handleStorage);
      channel?.removeEventListener("message", handleBroadcast);
      unsubscribe();
    };
  }, [key]);

  const setSyncedState = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const newValue = value instanceof Function ? value(prev) : value;

        if (typeof window !== "undefined") {
          try {
            const serialized = JSON.stringify({ value: newValue });
            window.localStorage.setItem(key, serialized);
            channel?.postMessage({ key, value: newValue });

            const docRef = doc(db, "synced_states", key);
            setDoc(docRef, { value: newValue }, { merge: true })
              .then(() => {
                console.log(`[useSyncedState] ✅ ذخیره موفق در فایربیس برای: "${key}"`);
              })
              .catch((err) => {
                console.error(`[useSyncedState] ❌❌❌ شکست در نوشتن فایربیس برای "${key}":`, err);
                console.error("مقداری که سعی شد ذخیره شود:", newValue);
              });
          } catch (error) {
            console.error(`[useSyncedState] خطای کلی در ذخیره "${key}":`, error);
          }
        }
        return newValue;
      });
    },
    [key]
  );

  return [state, setSyncedState] as const;
}
