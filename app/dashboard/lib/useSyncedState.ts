"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

function removeUndefinedFields(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(removeUndefinedFields);
  
  const cleaned: any = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      cleaned[key] = removeUndefinedFields(obj[key]);
    }
  }
  return cleaned;
}

export function useSyncedState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    const docRef = doc(db, "appData", key);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (!isMounted.current) return;
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && data.value !== undefined) {
          setValue(data.value);
        }
      }
    }, (error) => {
      console.error(`Error listening to ${key}:`, error);
    });

    return () => {
      isMounted.current = false;
      unsubscribe();
    };
  }, [key]);

  const setSyncedValue = useCallback(async (newValue: T | ((prev: T) => T)) => {
    // استفاده از آپدیت تابعی برای دسترسی به آخرین مقدار state و جلوگیری از Stale Closure
    setValue(prevValue => {
      const resolvedValue = typeof newValue === "function" 
        ? (newValue as (prev: T) => T)(prevValue)
        : newValue;
      
      // عملیات ذخیره‌سازی در پس‌زمینه
      (async () => {
        try {
          const docRef = doc(db, "appData", key);
          const cleanedValue = removeUndefinedFields(resolvedValue);
          await setDoc(docRef, { value: cleanedValue }, { merge: true });
        } catch (error) {
          console.error(`Error saving ${key}:`, error);
          // ⚠️ حیاتی: در صورت خطا، state را به حالت قبل برمی‌گردانیم (Rollback)
          // تا داده به صورت "شبح" در UI نماند و ناگهان غیب نشود
          if (isMounted.current) {
            setValue(prevValue);
            alert("خطا در ذخیره‌سازی! لطفاً اتصال اینترنت یا دسترسی‌های فایربیس (Rules) را بررسی کنید.");
          }
        }
      })();
      
      return resolvedValue;
    });
  }, [key]);

  return [value, setSyncedValue] as const;
}
