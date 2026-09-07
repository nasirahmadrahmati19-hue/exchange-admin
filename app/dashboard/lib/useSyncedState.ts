"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

const channel = typeof window !== "undefined" ? new BroadcastChannel("exchange-app-sync-channel") : null;

export function useSyncedState<T>(key: string, initialValue: T) {
  // برای جلوگیری از رندر مجدد با داده‌ی تکراری
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
    // ۱. همگام‌سازی بین تب‌های یک مرورگر (LocalStorage)
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

    // ۲. همگام‌سازی سریع بین تب‌ها (BroadcastChannel)
    const handleBroadcast = (event: MessageEvent) => {
      if (event.data.key === key && event.data.value !== undefined) {
        const value = event.data.value;
        if (JSON.stringify(latestState.current) !== JSON.stringify(value)) {
          setState(value);
        }
      }
    };

    // ۳. همگام‌سازی لحظه‌ای بین دستگاه‌ها (فایربیس) — بدون وابستگی به ساعت دستگاه
    const docRef = doc(db, "synced_states", key);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        // اگر این تغییر نتیجه‌ی نوشتن محلی خودمونه (هنوز روی سرور تأیید نشده)، نادیده بگیر
        // این باعث میشه دیگه به مقایسه‌ی Date.now() بین دستگاه‌ها نیازی نباشه
        if (snapshot.metadata.hasPendingWrites) return;

        if (snapshot.exists()) {
          const data = snapshot.data();
          const fbValue = data.value;

          if (fbValue !== undefined && JSON.stringify(latestState.current) !== JSON.stringify(fbValue)) {
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

  // ۴. تابع به‌روزرسانی داده (نوشتن هم‌زمان در همه‌جا)
  const setSyncedState = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const newValue = value instanceof Function ? value(prev) : value;

        if (typeof window !== "undefined") {
          try {
            const serialized = JSON.stringify({ value: newValue });

            // الف: ذخیره در مرورگر
            window.localStorage.setItem(key, serialized);

            // ب: ارسال به سایر تب‌های باز همین مرورگر
            channel?.postMessage({ key, value: newValue });

            // ج: ذخیره در فایربیس
            const docRef = doc(db, "synced_states", key);
            setDoc(docRef, { value: newValue }, { merge: true }).catch((err) =>
              console.error(`[useSyncedState] ❌ خطای نوشتن در فایربیس برای "${key}":`, err)
            );
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
