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

async function saveToIDB(key: string, value: any): Promise<void> {
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

async function readFromIDB(key: string): Promise<any> {
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
// ✅ هوک اصلی - نسخه نهایی با سپر محافظتی (Anti-Wipeout)
// ============================================================
export function useSyncedState<T>(key: string, initialValue: T) {
  const isMounted = useRef(true);
  const [value, setValue] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);
  const lastUpdatedRef = useRef<number>(0);
  const valueRef = useRef<T>(initialValue);

  // همگام‌سازی رفرانس با مقدار فعلی
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

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
          console.log(`🟢 [${key}] Init: Loaded from Firebase Server.`);
        } else {
          const localData = readFromLS(key) ?? (await readFromIDB(key));
          finalPayload = { 
            value: localData !== undefined ? localData : initialValue,
            lastUpdated: Date.now()
          };
          await setDoc(docRef, removeUndefinedFields(finalPayload), { merge: true });
          console.log(`🟡 [${key}] Init: Firebase was empty. Initialized from Local.`);
        }

        if (!ignore && isMounted.current) {
          setValue(finalPayload.value);
          lastUpdatedRef.current = finalPayload.lastUpdated || Date.now();
          setIsLoaded(true);
        }
      } catch (error) {
        console.error(`🔴 [${key}] Init Error:`, error);
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

  // ۲. گوش دادن به تغییرات لحظه‌ای Firebase (با سپر محافظتی)
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
          const source = docSnap.metadata.fromCache ? "Cache" : "Server";

          // 🛡️ سپر ۱: جلوگیری از بازنویسی داده قدیمی روی داده جدید
          if (incomingTimestamp < lastUpdatedRef.current) {
            console.warn(`🛡️ [${key}] Blocked old data from Firebase ${source}.`);
            return;
          }

          // 🛡️ سپر ۲: جلوگیری مطلق از پاک شدن آرایه‌های پر (Universal Wipeout Guard)
          const wasArrayWithData = Array.isArray(valueRef.current) && (valueRef.current as any[]).length > 0;
          const isNowEmptyArray = Array.isArray(payload.value) && payload.value.length === 0;
          
          if (wasArrayWithData && isNowEmptyArray) {
            console.error(`🚨 [${key}] BLOCKED WIPEOUT! Firebase ${source} tried to replace populated array with empty array. Ignoring to save your data.`);
            return; 
          }

          if (JSON.stringify(valueRef.current) !== JSON.stringify(payload.value)) {
            console.log(`✅ [${key}] State updated from Firebase ${source}.`);
            lastUpdatedRef.current = incomingTimestamp;
            valueRef.current = payload.value;
            setValue(payload.value);
            saveToLS(key, payload.value);
            saveToIDB(key, payload.value).catch(console.error);
          }
        }
      },
      (error) => {
        console.error(`🔴 [${key}] Snapshot Error:`, error);
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

    // 🛡️ سپر ۳: جلوگیری از فراخوانی تابع پاک‌سازی در سمت کلاینت
    const wasArrayWithData = Array.isArray(valueRef.current) && (valueRef.current as any[]).length > 0;
    const isNowEmptyArray = Array.isArray(resolvedValue) && resolvedValue.length === 0;
    
    if (wasArrayWithData && isNowEmptyArray) {
      console.error(`🚨 [${key}] BLOCKED WIPEOUT! A script tried to replace populated array with empty array. Blocked.`);
      return valueRef.current; 
    }

    const newTimestamp = Date.now();
    const payload = {
      value: resolvedValue,
      lastUpdated: newTimestamp
    };

    // آپدیت فوری محلی (Optimistic UI)
    valueRef.current = resolvedValue;
    setValue(resolvedValue);
    lastUpdatedRef.current = newTimestamp;
    saveToLS(key, resolvedValue);
    saveToIDB(key, resolvedValue).catch(console.error);

    // ارسال به سرور
    try {
      const docRef = doc(db, "appData", key);
      await setDoc(docRef, removeUndefinedFields(payload), { merge: true });
    } catch (error) {
      console.error(`🔴 [${key}] Firebase Save Failed:`, error);
    }
    
    return resolvedValue;
  }, [key]);

  return [value, setSyncedValue] as const;
}
