"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { doc, setDoc, onSnapshot, getDoc } from "firebase/firestore";
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
    if (obj[key] !== undefined) {
      cleaned[key] = removeUndefinedFields(obj[key]);
    }
  }
  return cleaned;
}

// ============================================================
// لایه ذخیره‌سازی محلی (IndexedDB + localStorage)
// ============================================================
const IDB_NAME = "AppSyncDB";
const IDB_STORE = "syncedData";
const LS_PREFIX = "synced_";

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject("Window is undefined");
    const request = indexedDB.open(IDB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
  });
}

async function saveToIDB<T>(key: string, value: T): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(IDB_STORE, "readwrite");
      const store = transaction.objectStore(IDB_STORE);
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error(`[IDB] Error saving ${key}:`, error);
  }
}

async function readFromIDB<T>(key: string): Promise<T | undefined> {
  if (typeof window === "undefined") return undefined;
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(IDB_STORE, "readonly");
      const store = transaction.objectStore(IDB_STORE);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => resolve(undefined);
    });
  } catch {
    return undefined;
  }
}

function readFromLS<T>(key: string): T | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const cached = localStorage.getItem(LS_PREFIX + key);
    if (cached !== null && cached !== "undefined") {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.error(`[LS] Error reading ${key}:`, error);
  }
  return undefined;
}

function saveToLS<T>(key: string, value: T): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`[LS] Quota exceeded for ${key}`);
    return false;
  }
}

// ============================================================
// ✅ هوک اصلی - نسخه نهایی و ایمن
// ============================================================
export function useSyncedState<T>(key: string, initialValue: T) {
  const isMounted = useRef(true);
  const [value, setValue] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);
  const valueRef = useRef<T>(initialValue);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // ۱. بارگذاری اولیه: اولویت با Firebase است، نه Local!
  useEffect(() => {
    let ignore = false;
    
    const init = async () => {
      const docRef = doc(db, "appData", key);
      
      try {
        // الف) ابتدا از Firebase بخوان (منبع اصلی حقیقت)
        const snap = await getDoc(docRef);
        
        let finalData: T;
        
        if (snap.exists() && snap.data().value !== undefined) {
          // اگر در Firebase داده بود، از آن استفاده کن
          finalData = snap.data().value as T;
        } else {
          // ب) اگر Firebase خالی بود، از Local بخوان
          const localData = readFromLS<T>(key) ?? (await readFromIDB<T>(key)) ?? initialValue;
          finalData = localData;
          
          // ج) داده‌های Local را به Firebase بفرست تا به عنوان پایه ثبت شوند
          await setDoc(docRef, { value: removeUndefinedFields(finalData) }, { merge: true });
        }

        if (!ignore && isMounted.current) {
          setValue(finalData);
          valueRef.current = finalData;
          setIsLoaded(true);
        }
      } catch (error) {
        console.error(`[useSyncedState] Critical init error for ${key}:`, error);
        // در صورت خطای شبکه، حداقل داده‌های Local را نشان بده
        if (!ignore && isMounted.current) {
          const localData = readFromLS<T>(key) ?? (await readFromIDB<T>(key)) ?? initialValue;
          setValue(localData);
          valueRef.current = localData;
          setIsLoaded(true);
        }
      }
    };

    init();

    return () => {
      ignore = true;
      isMounted.current = false;
    };
  }, [key]); // initialValue را از وابستگی‌ها حذف کردیم تا ریست نشود

  // ۲. گوش دادن به تغییرات لحظه‌ای Firebase
  useEffect(() => {
    if (!isLoaded) return;
    const docRef = doc(db, "appData", key);
    
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (!isMounted.current) return;
        if (docSnap.exists() && docSnap.data().value !== undefined) {
          const firebaseValue = docSnap.data().value as T;
          
          // مقایسه عمیق برای جلوگیری از رندرهای بی‌مورد
          const isDifferent = JSON.stringify(valueRef.current) !== JSON.stringify(firebaseValue);
          
          if (isDifferent) {
            valueRef.current = firebaseValue;
            setValue(firebaseValue);
            // ذخیره خاموش در Local
            saveToLS(key, firebaseValue);
            saveToIDB(key, firebaseValue).catch(console.error);
          }
        }
      },
      (error) => {
        console.error(`[useSyncedState] Snapshot error for ${key}:`, error);
      }
    );

    return () => {
      isMounted.current = false;
      unsubscribe();
    };
  }, [key, isLoaded]);

  // ۳. گوش دادن به تغییرات در تب‌های دیگر مرورگر
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LS_PREFIX + key && e.newValue) {
        try {
          const newValue = JSON.parse(e.newValue) as T;
          if (JSON.stringify(valueRef.current) !== JSON.stringify(newValue)) {
            valueRef.current = newValue;
            setValue(newValue);
          }
        } catch {}
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [key]);

  // ۴. تابع به‌روزرسانی داده
  const setSyncedValue = useCallback(async (newValue: T | ((prev: T) => T)) => {
    const resolvedValue = typeof newValue === "function" 
      ? (newValue as (prev: T) => T)(valueRef.current)
      : newValue;

    // جلوگیری تصادفی از پاک شدن کل دیتابیس مشتریان
    if (key === "customers" && Array.isArray(resolvedValue) && resolvedValue.length === 0) {
      console.warn("⚠️ Attempted to set customers to empty array. Blocked for safety.");
      // اگر واقعاً می‌خواهید پاک کنید، باید منطق خاصی داشته باشید، اما به صورت پیش‌فرض مسدود می‌شود
    }

    setValue(resolvedValue);
    valueRef.current = resolvedValue;

    // ذخیره محلی فوری
    saveToLS(key, resolvedValue);
    saveToIDB(key, resolvedValue).catch(console.error);

    // ذخیره در Firebase
    try {
      const docRef = doc(db, "appData", key);
      await setDoc(docRef, { value: removeUndefinedFields(resolvedValue) }, { merge: true });
    } catch (error) {
      console.error(`[useSyncedState] Firebase save error for ${key}:`, error);
    }
    
    return resolvedValue;
  }, [key]);

  return [value, setSyncedValue] as const;
}
