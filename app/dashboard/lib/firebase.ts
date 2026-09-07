"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export function useSyncedState<T>(key: string, initialValue: T) {
  const isMounted = useRef(true);

  // ۱. مقداردهی اولیه فوری از localStorage (برای نمایش بدون تأخیر در UI)
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item);
        // پشتیبانی هم از فرمت قدیمی و هم فرمت جدید دارای timestamp
        return parsed && typeof parsed === 'object' && '_timestamp' in parsed ? parsed.value : parsed;
      }
      return initialValue;
    } catch (error) {
      console.warn(`[useSyncedState] خطا در خواندن "${key}" از localStorage`);
      return initialValue;
    }
  });

  // ۲. شنود تغییرات از فایربیس (برای هماهنگی لحظه‌ای بین گوشی و کامپیوتر)
  useEffect(() => {
    isMounted.current = true;
    const docRef = doc(db, "synced_states", key);

    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (!isMounted.current) return;
      
      if (snapshot.exists()) {
        const data = snapshot.data();
        const fbValue = data.value;
        
        if (fbValue !== undefined) {
          setState((prev) => {
            // مقایسه عمیق برای جلوگیری از رندرهای اضافی و بی‌مورد
            if (JSON.stringify(prev) === JSON.stringify(fbValue)) {
              return prev;
            }
            
            // اگر مقدار از دستگاه دیگری تغییر کرد، localStorage این دستگاه را هم به‌روز کن
            if (typeof window !== "undefined") {
              try {
                window.localStorage.setItem(key, JSON.stringify({
                  value: fbValue,
                  _timestamp: data._timestamp || Date.now()
                }));
              } catch (e) {
                console.warn("⚠️ خطا در به‌روزرسانی localStorage");
              }
            }
            return fbValue;
          });
        }
      }
    }, (error) => {
      console.error(`[useSyncedState] خطای شنود فایربیس برای "${key}":`, error.message);
      console.log("👉 لطفاً قوانین امنیتی (Security Rules) فایربیس را بررسی کنید.");
    });

    return () => {
      isMounted.current = false;
      unsubscribe();
    };
  }, [key]);

  // ۳. تابع به‌روزرسانی: ذخیره همزمان در localStorage (فوری) و فایربیس (هماهنگ‌سازی)
  const setSyncedState = useCallback((value: T | ((prev: T) => T)) => {
    setState((prev) => {
      const newValue = value instanceof Function ? value(prev) : value;
      const timestamp = Date.now();
      const dataWithTimestamp = {
        value: newValue,
        _timestamp: timestamp
      };

      // ذخیره فوری در localStorage برای پاسخ‌دهی سریع UI
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(key, JSON.stringify(dataWithTimestamp));
        } catch (e) {
          console.warn("⚠️ خطا در ذخیره localStorage (احتمالاً حافظه پر است)");
        }
      }

      // ارسال به فایربیس برای هماهنگی با سایر دستگاه‌ها (گوشی، کامپیوتر، تب‌های دیگر)
      const docRef = doc(db, "synced_states", key);
      setDoc(docRef, dataWithTimestamp, { merge: true }).catch((err) => {
        console.error(`[useSyncedState] خطای ذخیره در فایربیس برای "${key}":`, err);
      });

      return newValue;
    });
  }, [key]);

  return [state, setSyncedState] as const;
}
