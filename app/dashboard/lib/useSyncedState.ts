"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

// ============================================================
// توابع کمکی برای پاک‌سازی داده‌ها (دقیقاً همان منطق شما)
// ============================================================
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

// ============================================================
// ✅ ارتقاء یافته: استفاده از IndexedDB به جای LocalStorage
// این کار ظرفیت ذخیره‌سازی محلی را از ۵ مگابایت به ۵۰+ مگابایت افزایش می‌دهد
// ============================================================
const DB_NAME = "AppSyncDB";
const STORE_NAME = "syncedData";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject("Window is undefined");
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function readFromIndexedDB<T>(key: string, fallback: T): Promise<T> {
  if (typeof window === "undefined") return fallback;
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => {
        const cached = request.result;
        if (cached !== undefined && cached !== null) {
          resolve(cached);
        } else {
          resolve(fallback);
        }
      };
      request.onerror = () => resolve(fallback);
    });
  } catch (error) {
    console.error(`[useSyncedState] Error reading IndexedDB for ${key}:`, error);
    return fallback;
  }
}

async function saveToIndexedDB<T>(key: string, value: T): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error(`[useSyncedState] Error saving IndexedDB for ${key}:`, error);
  }
}

// ============================================================
// هوک اصلی (بدون تغییر در نحوه فراخوانی توسط کامپوننت‌ها)
// ============================================================
export function useSyncedState<T>(key: string, initialValue: T) {
  const isMounted = useRef(true);
  
  const [value, setValue] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);

  // بارگذاری اولیه از IndexedDB
  useEffect(() => {
    let ignore = false;
    const loadInitialData = async () => {
      const cachedValue = await readFromIndexedDB<T>(key, initialValue);
      if (!ignore && isMounted.current) {
        setValue(cachedValue);
        setIsLoaded(true);
      }
    };
    loadInitialData();

    return () => {
      ignore = true;
      isMounted.current = false;
    };
  }, [key, initialValue]);

  // گوش دادن به تغییرات فایربیس
  useEffect(() => {
    if (!isLoaded) return; // صبر کن تا داده اولیه لود شود
    
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
              // جلوگیری از رندر غیرضروری
              const prevJson = JSON.stringify(prevValue);
              const newJson = JSON.stringify(firebaseValue);
              
              if (prevJson !== newJson) {
                // به‌روزرسانی همزمان IndexedDB
                saveToIndexedDB(key, firebaseValue).catch(console.error);
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
  }, [key, isLoaded]);

  // تابع به‌روزرسانی (دقیقاً همان منطق شما، اما با ذخیره‌سازی ایمن‌تر)
  const setSyncedValue = useCallback(async (newValue: T | ((prev: T) => T)): Promise<T> => {
    const resolvedValue = typeof newValue === "function" 
      ? (newValue as (prev: T) => T)(value)
      : newValue;

    // ۱. آپدیت فوری State ری‌اکت (برای تجربه کاربری سریع)
    setValue(resolvedValue);
    
    // ۲. ذخیره فوری در IndexedDB (آفلاین)
    await saveToIndexedDB(key, resolvedValue);

    // ۳. ذخیره در فایربیس (آنلاین)
    try {
      const docRef = doc(db, "appData", key);
      const cleanedValue = removeUndefinedFields(resolvedValue);
      
      // بررسی حجم تقریبی برای جلوگیری از خطای 1MB فایربیس
      const jsonString = JSON.stringify(cleanedValue);
      const sizeInBytes = new Blob([jsonString]).size;
      const sizeInMB = sizeInBytes / (1024 * 1024);
      
      if (sizeInMB > 0.9) {
        console.warn(`⚠️ هشدار: حجم داده برای کلید "${key}" به ${sizeInMB.toFixed(2)} مگابایت رسیده است. نزدیک به محدودیت ۱ مگابایت فایربیس!`);
      }

      await setDoc(docRef, { value: cleanedValue }, { merge: true });
      return resolvedValue;
    } catch (error: any) {
      if (error?.code === "failed-precondition" || error?.message?.includes("1 MiB")) {
        console.error(`❌ خطای بحرانی: حجم داده برای "${key}" از ۱ مگابایت تجاوز کرده است. فایربیس اجازه ذخیره نمی‌دهد.`);
        alert("خطا: حجم داده‌ها بیش از حد مجاز سرور است. لطفاً با پشتیبانی تماس بگیرید.");
      } else {
        console.error(`[useSyncedState] ❌ Error saving ${key} to Firebase:`, error);
      }
      throw error;
    }
  }, [key, value]);

  return [value, setSyncedValue] as const;
}
