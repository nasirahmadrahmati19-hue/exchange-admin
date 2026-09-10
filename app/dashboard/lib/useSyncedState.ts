"use client";

import { useState, useEffect } from "react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

/**
 * حذف فیلدهای undefined از آبجکت
 * این تابع بسیار مهم است چون Firestore نمی‌تواند مقادیر undefined را ذخیره کند
 */
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

/**
 * هوک برای sync کردن یک state ساده با Firestore
 * @param key - نام document در Firestore
 * @param initialValue - مقدار اولیه
 */
export function useSyncedState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);

  useEffect(() => {
    const docRef = doc(db, "appData", key);
    
    // گوش دادن به تغییرات Firestore
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && data.value !== undefined) {
          setValue(data.value);
        }
      }
    }, (error) => {
      console.error(`Error listening to ${key}:`, error);
    });

    return () => unsubscribe();
  }, [key]);

  // ذخیره در Firestore
  const setSyncedValue = async (newValue: T | ((prev: T) => T)) => {
    const resolvedValue = typeof newValue === "function" 
      ? (newValue as (prev: T) => T)(value)
      : newValue;
    
    setValue(resolvedValue);
    
    try {
      const docRef = doc(db, "appData", key);
      const cleanedValue = removeUndefinedFields(resolvedValue);
      await setDoc(docRef, { value: cleanedValue }, { merge: true });
    } catch (error) {
      console.error(`Error saving ${key}:`, error);
    }
  };

  return [value, setSyncedValue] as const;
}

/**
 * هوک برای sync کردن یک collection (آرایه) با Firestore
 * @param key - نام document در Firestore
 * @param initialValue - آرایه اولیه
 */
export function useSyncedCollection<T>(key: string, initialValue: T[]) {
  const [items, setItems] = useState<T[]>(initialValue);

  useEffect(() => {
    const docRef = doc(db, "appData", key);
    
    // گوش دادن به تغییرات Firestore
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && Array.isArray(data.items)) {
          setItems(data.items);
        }
      }
    }, (error) => {
      console.error(`Error listening to collection ${key}:`, error);
    });

    return () => unsubscribe();
  }, [key]);

  // ذخیره در Firestore
  const setSyncedItems = async (newItems: T[] | ((prev: T[]) => T[])) => {
    const resolvedItems = typeof newItems === "function"
      ? (newItems as (prev: T[]) => T[])(items)
      : newItems;
    
    setItems(resolvedItems);
    
    try {
      const docRef = doc(db, "appData", key);
      const cleanedItems = resolvedItems.map(removeUndefinedFields);
      await setDoc(docRef, { items: cleanedItems }, { merge: true });
    } catch (error) {
      console.error(`Error saving collection ${key}:`, error);
    }
  };

  return [items, setSyncedItems] as const;
}
