"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { doc, setDoc, onSnapshot, getDoc, serverTimestamp } from "firebase/firestore";
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
// لایه ذخیره‌سازی محلی
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

async function saveToIDB<T>(key: string, value: any): Promise<void> {
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

async function readFromIDB<T>(key: string): Promise<any> {
  if (typeof window === "undefined") return undefined;
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(IDB_STORE, "readonly");
      const store = transaction.objectStore(IDB_STORE);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined);
    });
  } catch {
    return undefined;
  }
}

function readFromLS(key: string): any {
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

function saveToLS(key: string, value: any): boolean {
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
// ✅ هوک اصلی - نسخه ضد باگ با بررسی Timestamp
// ============================================================
export function useSyncedState<T>(key: string, initialValue: T) {
  const isMounted = useRef(true);
  const [value, setValue] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // نگهداری آخرین زمان آپدیت برای جلوگیری از بازنویسی داده قدیمی روی جدید
  const lastUpdatedRef = useRef<number>(0);

  // ۱. بارگذاری اولیه
  useEffect(() => {
    let ignore = false;
    
    const init = async () => {
      const docRef = doc(db, "appData", key);
      
      try {
        const snap = await getDoc(docRef);
        let finalPayload: any;
        
        if (snap.exists() && snap.data().value !== undefined) {
          finalPayload = snap.data();
        } else {
          const localData = readFromLS(key) ?? (await readFromIDB(key));
          finalPayload = { 
            value: localData !== undefined ? localData : initialValue,
            lastUpdated: Date.now()
          };
          
          // فقط اگر واقعاً دیتایی نبود، لوکال را به فایربیس بفرست
          await setDoc(docRef, removeUndefinedFields(finalPayload), { merge: true });
        }

        if (!ignore && isMounted.current) {
          setValue(finalPayload.value);
          lastUpdatedRef.current = finalPayload.lastUpdated || Date.now();
          setIsLoaded(true);
        }
      } catch (error) {
        console.error(`[useSyncedState] Critical init error for ${key}:`, error);
        if (!ignore && isMounted.current) {
          const localData = readFromLS(key) ?? (await readFromIDB(key));
          if (localData !== undefined) {
            setValue(localData);
            setIsLoaded(true);
          }
        }
      }
    };

    init();

    return () => {
      ignore = true;
      isMounted.current = false;
    };
  }, [key]);

  // ۲. گوش دادن به تغییرات لحظه‌ای Firebase (با محافظت در برابر داده قدیمی)
  useEffect(() => {
    if (!isLoaded) return;
    const docRef = doc(db, "appData", key);
    
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (!isMounted.current) return;
        if (docSnap.exists() && docSnap.data().value !== undefined) {
          const payload = docSnap.data();
          const incomingTimestamp = payload.lastUpdated || 0;

          // ⚠️ نکته کلیدی: اگر داده‌ی سرور قدیمی‌تر از داده‌ی محلی بود، آن را نادیده بگیر!
          if (incomingTimestamp > lastUpdatedRef.current) {
            lastUpdatedRef.current = incomingTimestamp;
            setValue(payload.value);
            saveToLS(key, payload.value);
            saveToIDB(key, payload.value).catch(console.error);
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

  // ۳. تابع به‌روزرسانی داده
  const setSyncedValue = useCallback(async (newValue: T | ((prev: T) => T)) => {
    const resolvedValue = typeof newValue === "function" 
      ? (newValue as (prev: T) => T)(value) // استفاده از value به جای valueRef برای اطمینان
      : newValue;

    if (key === "customers" && Array.isArray(resolvedValue) && resolvedValue.length === 0) {
      console.warn("⚠️ Attempted to set customers to empty array. Blocked for safety.");
      return value; // لغو عملیات
    }

    const newTimestamp = Date.now();
    const payload = {
      value: resolvedValue,
      lastUpdated: newTimestamp
    };

    // ۱. آپدیت فوری محلی
    setValue(resolvedValue);
    lastUpdatedRef.current = newTimestamp;
    saveToLS(key, resolvedValue);
    saveToIDB(key, resolvedValue).catch(console.error);

    // ۲. ارسال به فایربیس
    try {
      const docRef = doc(db, "appData", key);
      await setDoc(docRef, removeUndefinedFields(payload), { merge: true });
    } catch (error) {
      console.error(`[useSyncedState] Firebase save error for ${key}:`, error);
      // در صورت خطا، یک رفرش اجباری از سرور انجام بده تا استیت خراب نشود
      const docRef = doc(db, "appData", key);
      const snap = await getDoc(docRef);
      if (snap.exists() && snap.data().lastUpdated > lastUpdatedRef.current) {
        setValue(snap.data().value);
        lastUpdatedRef.current = snap.data().lastUpdated;
      }
    }
    
    return resolvedValue;
  }, [key, value]);

  return [value, setSyncedValue] as const;
}
