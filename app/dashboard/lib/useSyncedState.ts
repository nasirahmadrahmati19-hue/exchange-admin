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
  const isMounted = useRef(true);
  
  // ✅ ابتدا از LocalStorage بخوان (اگر موجود باشد)
  const getInitialValue = (): T => {
    if (typeof window === "undefined") return initialValue;
    try {
      const cached = localStorage.getItem(`synced_${key}`);
      if (cached) {
        console.log(`[useSyncedState] Loading ${key} from LocalStorage`);
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error(`[useSyncedState] Error reading LocalStorage for ${key}:`, error);
    }
    return initialValue;
  };

  const [value, setValue] = useState<T>(getInitialValue);

  // ✅ گوش دادن به تغییرات فایربیس
  useEffect(() => {
    isMounted.current = true;
    const docRef = doc(db, "appData", key);
    
    console.log(`[useSyncedState] Setting up listener for ${key}`);
    
    const unsubscribe = onSnapshot(
      docRef, 
      (docSnap) => {
        if (!isMounted.current) return;
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && data.value !== undefined) {
            console.log(`[useSyncedState] Received update from Firebase for ${key}`);
            setValue(data.value);
            
            // ✅ ذخیره در LocalStorage
            try {
              localStorage.setItem(`synced_${key}`, JSON.stringify(data.value));
            } catch (error) {
              console.error(`[useSyncedState] Error saving to LocalStorage for ${key}:`, error);
            }
          }
        } else {
          console.log(`[useSyncedState] Document ${key} does not exist in Firebase`);
        }
      }, 
      (error) => {
        console.error(`[useSyncedState] Error listening to ${key}:`, error);
      }
    );

    return () => {
      console.log(`[useSyncedState] Cleaning up listener for ${key}`);
      isMounted.current = false;
      unsubscribe();
    };
  }, [key]);

  // ✅ ذخیره در فایربیس و LocalStorage
  const setSyncedValue = useCallback(async (newValue: T | ((prev: T) => T)) => {
    setValue(prevValue => {
      const resolvedValue = typeof newValue === "function" 
        ? (newValue as (prev: T) => T)(prevValue)
        : newValue;
      
      console.log(`[useSyncedState] Updating ${key} locally`);
      
      // ✅ فوراً در LocalStorage ذخیره کن
      try {
        localStorage.setItem(`synced_${key}`, JSON.stringify(resolvedValue));
      } catch (error) {
        console.error(`[useSyncedState] Error saving to LocalStorage for ${key}:`, error);
      }
      
      // ✅ سپس در فایربیس ذخیره کن
      (async () => {
        try {
          const docRef = doc(db, "appData", key);
          const cleanedValue = removeUndefinedFields(resolvedValue);
          console.log(`[useSyncedState] Saving ${key} to Firebase...`);
          await setDoc(docRef, { value: cleanedValue }, { merge: true });
          console.log(`[useSyncedState] Successfully saved ${key} to Firebase`);
        } catch (error) {
          console.error(`[useSyncedState] ❌ Error saving ${key} to Firebase:`, error);
          
          // ✅ در صورت خطا، alert بده
          if (isMounted.current) {
            const errorMsg = error instanceof Error ? error.message : "Unknown error";
            alert(`خطا در ذخیره‌سازی "${key}" در فایربیس:\n${errorMsg}\n\nلطفاً Security Rules فایربیس را بررسی کنید.`);
          }
        }
      })();
      
      return resolvedValue;
    });
  }, [key]);

  return [value, setSyncedValue] as const;
}
