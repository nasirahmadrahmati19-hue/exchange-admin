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
// لایه ذخیره‌سازی محلی (فقط به عنوان پشتیبان اضطراری)
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
      const request = transaction.objectStore(IDB_STORE).put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {}
}

async function readFromIDB(key: string): Promise<any> {
  if (typeof window === "undefined") return undefined;
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const request = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(key);
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
    if (cached !== null && cached !== "undefined") return JSON.parse(cached);
  } catch {}
  return undefined;
}

function saveToLS(key: string, value: any): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// ✅ هوک اصلی - نسخه نهایی و ضد باگ (Anti-Revert)
// ============================================================
export function useSyncedState<T>(key: string, initialValue: T) {
  const isMounted = useRef(true);
  const [value, setValue] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const valueRef = useRef<T>(initialValue);
  const lastUpdatedRef = useRef<number>(0);
  const isSavingRef = useRef<boolean>(false); // 🔒 قفل جلوگیری از تداخل نوشتن همزمان

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
        } else {
          const localData = readFromLS(key) ?? (await readFromIDB(key));
          finalPayload = { 
            value: localData !== undefined ? localData : initialValue,
            lastUpdated: Date.now()
          };
          await setDoc(docRef, removeUndefinedFields(finalPayload), { merge: true });
        }

        if (!ignore && isMounted.current) {
          setValue(finalPayload.value);
          valueRef.current = finalPayload.value;
          lastUpdatedRef.current = finalPayload.lastUpdated || Date.now();
          setIsLoaded(true);
        }
      } catch (error) {
        console.error(`🔴 [${key}] Init Error:`, error);
        if (!ignore && isMounted.current) {
          const localData = readFromLS(key) ?? (await readFromIDB(key));
          if (localData !== undefined) {
            setValue(localData);
            valueRef.current = localData;
            setIsLoaded(true);
          }
        }
      }
    };

    init();
    return () => { ignore = true; isMounted.current = false; };
  }, [key]);

  // ۲. شنونده بلادرنگ با مکانیزم دفاعی ضد بازگشت داده قدیمی
  useEffect(() => {
    if (!isLoaded) return;
    const docRef = doc(db, "appData", key);
    
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (!isMounted.current) return;
        
        // 🛡️ دفاع ۱: اگر داده از کش است و ما محلی داده‌ی جدیدتری داریم، آن را نادیده بگیر!
        // این خط اصلی‌ترین دلیل پاک شدن داده‌ها بعد از چند دقیقه را حل می‌کند.
        if (docSnap.metadata.fromCache && lastUpdatedRef.current > 0) {
          return; 
        }

        if (docSnap.exists() && docSnap.data().value !== undefined) {
          const payload = docSnap.data();
          const incomingTimestamp = payload.lastUpdated || 0;

          // 🛡️ دفاع ۲: فقط اگر داده سرور واقعاً جدیدتر بود، آن را اعمال کن
          if (incomingTimestamp > lastUpdatedRef.current) {
            
            // 🛡️ دفاع ۳: جلوگیری از پاک شدن تصادفی آرایه‌های پر
            const wasArrayWithData = Array.isArray(valueRef.current) && (valueRef.current as any[]).length > 0;
            const isNowEmptyArray = Array.isArray(payload.value) && payload.value.length === 0;
            
            if (wasArrayWithData && isNowEmptyArray) {
              console.error(`🚨 [${key}] BLOCKED WIPEOUT! Server tried to replace data with empty array. Ignored.`);
              return; 
            }

            lastUpdatedRef.current = incomingTimestamp;
            valueRef.current = payload.value;
            setValue(payload.value);
            
            // ذخیره پشتیبان
            saveToLS(key, payload.value);
            saveToIDB(key, payload.value).catch(() => {});
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
          const parsed = JSON.parse(e.newValue);
          // فقط اگر ترم‌استمپ آن جدیدتر بود آپدیت کن
          // (فرض بر این است که در شیء ذخیره شده در LS هم lastUpdated وجود دارد، اگر نه، همین مقایسه ساده کافیست)
          if (JSON.stringify(valueRef.current) !== JSON.stringify(parsed)) {
            valueRef.current = parsed;
            setValue(parsed);
          }
        } catch {}
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [key]);

  // ۴. تابع به‌روزرسانی داده
  const setSyncedValue = useCallback(async (newValue: T | ((prev: T) => T)) => {
    // 🔒 جلوگیری از تداخل اگر یک ذخیره‌سازی دیگر در حال انجام است
    if (isSavingRef.current) {
      console.warn(`⚠️ [${key}] Save already in progress, skipping.`);
      return valueRef.current;
    }
    isSavingRef.current = true;

    try {
      const resolvedValue = typeof newValue === "function" 
        ? (newValue as (prev: T) => T)(valueRef.current)
        : newValue;

      // 🛡️ دفاع ۳ (سمت کلاینت): جلوگیری از پاک کردن تصادفی آرایه
      const wasArrayWithData = Array.isArray(valueRef.current) && (valueRef.current as any[]).length > 0;
      const isNowEmptyArray = Array.isArray(resolvedValue) && resolvedValue.length === 0;
      
      if (wasArrayWithData && isNowEmptyArray) {
        console.error(`🚨 [${key}] BLOCKED LOCAL WIPEOUT! Script tried to set empty array. Blocked.`);
        return valueRef.current; 
      }

      const newTimestamp = Date.now();
      const payload = {
        value: resolvedValue,
        lastUpdated: newTimestamp
      };

      // ۱. آپدیت فوری و همگام محلی (Optimistic UI)
      valueRef.current = resolvedValue;
      setValue(resolvedValue);
      lastUpdatedRef.current = newTimestamp;
      saveToLS(key, resolvedValue);
      saveToIDB(key, resolvedValue).catch(() => {});

      // ۲. ارسال به سرور
      const docRef = doc(db, "appData", key);
      await setDoc(docRef, removeUndefinedFields(payload), { merge: true });
      
      return resolvedValue;
    } catch (error) {
      console.error(`🔴 [${key}] Firebase Save Failed:`, error);
      // در صورت خطا، مقدار را به آخرین حالت مطمئن برنگردان تا کاربر متوجه خطا شود، 
      // اما onSnapshot در نهایت وضعیت واقعی سرور را هماهنگ می‌کند.
      return valueRef.current;
    } finally {
      isSavingRef.current = false;
    }
  }, [key]);

  return [value, setSyncedValue] as const;
}
