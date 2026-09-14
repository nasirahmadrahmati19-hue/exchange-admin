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

function readFromLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const cached = localStorage.getItem(`synced_${key}`);
    if (cached !== null && cached !== "undefined") {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.error(`[useSyncedState] Error reading LocalStorage for ${key}:`, error);
  }
  return fallback;
}

function saveToLocalStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`synced_${key}`, JSON.stringify(value));
  } catch (error) {
    console.error(`[useSyncedState] Error saving LocalStorage for ${key}:`, error);
  }
}

export function useSyncedState<T>(key: string, initialValue: T) {
  const isMounted = useRef(true);
  
  const [value, setValue] = useState<T>(() => {
    return readFromLocalStorage<T>(key, initialValue);
  });

  useEffect(() => {
    isMounted.current = true;
    const docRef = doc(db, "appData", key);
    
    const unsubscribe = onSnapshot(
      docRef, 
      (docSnap) => {
        if (!isMounted.current) return;
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && data.value !== undefined) {
            const firebaseValue = data.value as T;
            
            setValue(prevValue => {
              const prevJson = JSON.stringify(prevValue);
              const newJson = JSON.stringify(firebaseValue);
              
              if (prevJson !== newJson) {
                saveToLocalStorage(key, firebaseValue);
                return firebaseValue;
              }
              return prevValue;
            });
          }
        }
      }, 
      (error) => {
        console.error(`[useSyncedState] Error listening to ${key}:`, error);
      }
    );

    return () => {
      isMounted.current = false;
      unsubscribe();
    };
  }, [key]);

  // ✅ نسخه نهایی و ۱۰۰٪ بدون باگ: استفاده از مقدار فعلی value برای محاسبه مقدار جدید
  const setSyncedValue = useCallback(async (newValue: T | ((prev: T) => T)): Promise<T> => {
    // ۱. محاسبه مقدار جدید بر اساس state فعلی (بدون استفاده از متغیرهای let خطرناک)
    const resolvedValue = typeof newValue === "function" 
      ? (newValue as (prev: T) => T)(value)
      : newValue;

    // ۲. آپدیت state ری‌اکت
    setValue(resolvedValue);
    
    // ۳. ذخیره در LocalStorage
    saveToLocalStorage(key, resolvedValue);

    // ۴. ذخیره در فایربیس
    try {
      const docRef = doc(db, "appData", key);
      const cleanedValue = removeUndefinedFields(resolvedValue);
      await setDoc(docRef, { value: cleanedValue }, { merge: true });
      return resolvedValue;
    } catch (error) {
      console.error(`[useSyncedState] ❌ Error saving ${key} to Firebase:`, error);
      throw error;
    }
  }, [key, value]); // اضافه کردن value به وابستگی‌ها برای اطمینان از دسترسی به آخرین مقدار

  return [value, setSyncedValue] as const;
}
