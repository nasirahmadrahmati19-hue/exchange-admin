"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

// ============================================================
// توابع کمکی (دقیقاً مطابق کد اصلی شما)
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
// ✅ لایه ذخیره‌سازی ترکیبی: localStorage + IndexedDB
// ============================================================
const IDB_NAME = "AppSyncDB";
const IDB_STORE = "syncedData";
const IDB_VERSION = 1;
const LS_PREFIX = "synced_";
const IDB_FLAG_PREFIX = "synced_idb_";

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject("Window is undefined");
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
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
    console.error(`[useSyncedState] Error saving to IDB for ${key}:`, error);
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
    console.error(`[useSyncedState] Error reading LS for ${key}:`, error);
  }
  return undefined;
}

function saveToLS<T>(key: string, value: T): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
    return true;
  } catch (error) {
    // Quota exceeded - داده خیلی بزرگ است
    console.warn(`[useSyncedState] LS quota exceeded for ${key}, falling back to IDB`);
    return false;
  }
}

// ============================================================
// خواندن ترکیبی: ابتدا IDB، سپس LS
// ============================================================
async function readData<T>(key: string, fallback: T): Promise<T> {
  const idbData = await readFromIDB<T>(key);
  if (idbData !== undefined) return idbData;
  
  const lsData = readFromLS<T>(key);
  if (lsData !== undefined) return lsData;
  
  return fallback;
}

// ============================================================
// نوشتن ترکیبی: ابتدا LS، اگر پر شد به IDB
// ============================================================
async function saveData<T>(key: string, value: T): Promise<void> {
  const lsSuccess = saveToLS(key, value);
  
  if (!lsSuccess) {
    await saveToIDB(key, value);
    try {
      localStorage.setItem(IDB_FLAG_PREFIX + key, "true");
    } catch {}
  } else {
    try {
      localStorage.removeItem(IDB_FLAG_PREFIX + key);
    } catch {}
  }
}

// ============================================================
// ✅ هوک اصلی (بدون تغییر در نحوه فراخوانی)
// ============================================================
export function useSyncedState<T>(key: string, initialValue: T) {
  const isMounted = useRef(true);
  const [value, setValue] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);

  // بارگذاری اولیه از storage
  useEffect(() => {
    let ignore = false;
    const loadInitialData = async () => {
      const cachedValue = await readData<T>(key, initialValue);
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
  }, [key]);

  // ✅ حیاتی: گوش دادن به تغییرات از تب‌های دیگر مرورگر
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LS_PREFIX + key && e.newValue) {
        try {
          const newValue = JSON.parse(e.newValue) as T;
          setValue(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(newValue)) {
              return newValue;
            }
            return prev;
          });
        } catch {}
      }
    };
    
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [key]);

  // گوش دادن به تغییرات فایربیس (sync بین دستگاه‌ها)
  useEffect(() => {
    if (!isLoaded) return;
    
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
                saveData(key, firebaseValue).catch(console.error);
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

  // تابع به‌روزرسانی
  const setSyncedValue = useCallback(async (newValue: T | ((prev: T) => T)): Promise<T> => {
    const resolvedValue = typeof newValue === "function" 
      ? (newValue as (prev: T) => T)(value)
      : newValue;

    // ۱. آپدیت فوری State ری‌اکت
    setValue(resolvedValue);
    
    // ۲. ذخیره در storage محلی (LS یا IDB)
    await saveData(key, resolvedValue);

    // ۳. ذخیره در فایربیس
    try {
      const docRef = doc(db, "appData", key);
      const cleanedValue = removeUndefinedFields(resolvedValue);
      
      const jsonString = JSON.stringify(cleanedValue);
      const sizeInMB = new Blob([jsonString]).size / (1024 * 1024);
      
      if (sizeInMB > 0.9) {
        console.warn(`⚠️ حجم داده برای "${key}" به ${sizeInMB.toFixed(2)} MB رسیده است.`);
      }

      await setDoc(docRef, { value: cleanedValue }, { merge: true });
      return resolvedValue;
    } catch (error: any) {
      console.error(`[useSyncedState] ❌ Error saving ${key} to Firebase:`, error);
      throw error;
    }
  }, [key, value]);

  return [value, setSyncedValue] as const;
}
