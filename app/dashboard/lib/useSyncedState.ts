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

// ✅ تابع کمکی برای خواندن از LocalStorage
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

// ✅ تابع کمکی برای ذخیره در LocalStorage
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
  const lastFirebaseValueRef = useRef<T | null>(null);
  
  // ✅ مقدار اولیه را از LocalStorage بخوان (نه initialValue خام)
  const [value, setValue] = useState<T>(() => {
    return readFromLocalStorage<T>(key, initialValue);
  });

  // ✅ گوش دادن به تغییرات فایربیس
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
            lastFirebaseValueRef.current = firebaseValue;
            
            // ✅ فقط زمانی state را آپدیت کن که مقدار واقعاً متفاوت باشد
            setValue(prevValue => {
              // مقایسه ساده با JSON (برای آرایه‌ها و آبجکت‌ها)
              const prevJson = JSON.stringify(prevValue);
              const newJson = JSON.stringify(firebaseValue);
              
              if (prevJson !== newJson) {
                // ✅ مقدار جدید فایربیس را در LocalStorage هم ذخیره کن
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

  // ✅ ذخیره در LocalStorage و فایربیس
  const setSyncedValue = useCallback(async (newValue: T | ((prev: T) => T)) => {
    setValue(prevValue => {
      const resolvedValue = typeof newValue === "function" 
        ? (newValue as (prev: T) => T)(prevValue)
        : newValue;
      
      // ✅ فوراً در LocalStorage ذخیره کن (این باعث می‌شود وقتی از تب خارج می‌شوید، داده حفظ شود)
      saveToLocalStorage(key, resolvedValue);
      
      // ✅ سپس در فایربیس ذخیره کن (در پس‌زمینه)
      (async () => {
        try {
          const docRef = doc(db, "appData", key);
          const cleanedValue = removeUndefinedFields(resolvedValue);
          await setDoc(docRef, { value: cleanedValue }, { merge: true });
        } catch (error) {
          console.error(`[useSyncedState] ❌ Error saving ${key} to Firebase:`, error);
        }
      })();
      
      return resolvedValue;
    });
  }, [key]);

  return [value, setSyncedValue] as const;
}
