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
  const lastFirebaseValueRef = useRef<T | null>(null);
  
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
            lastFirebaseValueRef.current = firebaseValue;
            
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

  // ✅ تغییر کلیدی: حالا Promise برمی‌گرداند و خطا را throw می‌کند
  const setSyncedValue = useCallback(async (newValue: T | ((prev: T) => T)): Promise<T> => {
    let resolvedValue: T;
    
    // ۱. ابتدا state را آپدیت کن (مثل قبل)
    setValue(prevValue => {
      resolvedValue = typeof newValue === "function" 
        ? (newValue as (prev: T) => T)(prevValue)
        : newValue;
      
      // فوراً در LocalStorage ذخیره کن
      saveToLocalStorage(key, resolvedValue);
      return resolvedValue;
    });
    
    // ۲. سپس در Firebase ذخیره کن و Promise برگردان
    try {
      const docRef = doc(db, "appData", key);
      const cleanedValue = removeUndefinedFields(resolvedValue!);
      await setDoc(docRef, { value: cleanedValue }, { merge: true });
      return resolvedValue; // موفقیت
    } catch (error) {
      console.error(`[useSyncedState] ❌ Error saving ${key} to Firebase:`, error);
      throw error; // خطا را به کامپوننت برگردان تا بتواند catch کند
    }
  }, [key]);

  return [value, setSyncedValue] as const;
}
