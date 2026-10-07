"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { doc, onSnapshot, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

// ============================================================
// توابع کمکی
// ============================================================

function removeUndefinedFields(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(removeUndefinedFields);
  const cleaned: any = {};
  for (const key in obj) {
    if (obj[key] !== undefined) cleaned[key] = removeUndefinedFields(obj[key]);
  }
  return cleaned;
}

// ============================================================
// هوک اصلی (Main Hook) - بهینه‌شده برای عملکرد آفلاین و جلوگیری از فریز
// ============================================================

export function useSyncedState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const valueRef = useRef<T>(initialValue);
  const lastUpdatedRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    const docRef = doc(db, "appData", key);

    // ✅ استفاده از onSnapshot به جای getDoc برای دریافت خودکار آپدیت‌ها و کش آفلاین
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (!isMountedRef.current) return;

        // ✅ نکته حیاتی: در حالت آفلاین، fromCache true است. ما نباید آن را نادیده بگیریم!
        // فایربیس خودش مدیریت می‌کند که آیا داده جدید است یا خیر.
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          const incomingTimestamp = data.lastUpdated || 0;

          // ✅ مقایسه سبک با Timestamp به جای JSON.stringify سنگین (جلوگیری از کرش)
          if (incomingTimestamp > lastUpdatedRef.current) {
            lastUpdatedRef.current = incomingTimestamp;
            valueRef.current = data.value;
            setValue(data.value);
            setError(null); // اگر قبلاً خطای آفلاین بود، حالا رفع شده
          }
        } else {
          // اگر سند وجود نداشت و این اولین بار است
          if (lastUpdatedRef.current === 0) {
            valueRef.current = initialValue;
            setValue(initialValue);
            
            // ایجاد سند اولیه در فایربیس (در صف آفلاین قرار می‌گیرد اگر اینترنت نباشد)
            setDoc(docRef, { value: initialValue, lastUpdated: Date.now() }, { merge: true }).catch(() => {
              // اگر آفلاین باشد، فایربیس خودش بعداً سینک می‌کند. نیازی به ارور دادن نیست.
            });
          }
        }
        
        setIsLoading(false);
      },
      (err) => {
        if (!isMountedRef.current) return;
        console.warn(`⚠️ [${key}] Snapshot Error (احتمالاً آفلاین):`, err.message);
        
        // ✅ مدیریت هوشمند خطا: به جای کرش یا صفحه سفید، فقط وضعیت را مشخص می‌کنیم
        // داده‌های قبلی (valueRef.current) همچنان در UI نمایش داده می‌شوند.
        if (err.code === 'unavailable' || err.message?.includes('offline')) {
          setError("offline");
        } else {
          setError(err.message);
        }
        setIsLoading(false);
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      isMountedRef.current = false;
      if (unsubscribeRef.current) {
        try { unsubscribeRef.current(); } catch {}
        unsubscribeRef.current = null;
      }
    };
  }, [key, initialValue]);

  // ============================================================
  // تابع نوشتن (Write Operation)
  // ============================================================

  const setSyncedValue = useCallback(async (newValue: T | ((prev: T) => T)) => {
    const resolvedValue = typeof newValue === "function" 
      ? (newValue as (prev: T) => T)(valueRef.current) 
      : newValue;

    if (resolvedValue === undefined || resolvedValue === null) {
      console.warn(`⚠️ [${key}] Attempted to save undefined/null.`);
      return valueRef.current;
    }

    const newTimestamp = Date.now();
    const payload = { value: resolvedValue, lastUpdated: newTimestamp };

    // 1. آپدیت فوری UI (Optimistic UI) - کاربر منتظر شبکه نمی‌ماند
    valueRef.current = resolvedValue;
    setValue(resolvedValue);
    lastUpdatedRef.current = newTimestamp;

    // 2. ارسال به فایربیس
    try {
      const docRef = doc(db, "appData", key);
      // ✅ اگر آفلاین باشید، فایربیس این دستور را در صف (Queue) نگه می‌دارد
      // و به محض وصل شدن اینترنت، خودش آن را ارسال می‌کند.
      await setDoc(docRef, removeUndefinedFields(payload), { merge: true });
    } catch (err: any) {
      // این بخش فقط در صورتی اجرا می‌شود که خطای غیر از شبکه باشد (مثل Permission Denied)
      // خطای شبکه توسط persistentLocalCache فایربیس جذب می‌شود.
      console.warn(`⚠️ [${key}] Write queued or failed:`, err.message);
      setError("sync_pending");
    }

    return resolvedValue;
  }, [key]);

  return [value, setSyncedValue, isLoading, error] as const;
}
