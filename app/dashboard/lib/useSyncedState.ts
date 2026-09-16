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

function isEmptyData(data: any): boolean {
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === 'object' && data !== null) return Object.keys(data).length === 0;
  return data === null || data === undefined || data === "";
}

function hasData(data: any): boolean {
  return !isEmptyData(data);
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
// ✅ هوک اصلی - نسخه نهایی ضد پاک‌شدن هنگام تعویض تب
// ============================================================
export function useSyncedState<T>(key: string, initialValue: T) {
  const isMounted = useRef(true);
  const [value, setValue] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // 🛡️ جلوگیری از توهم بصری
  
  const valueRef = useRef<T>(initialValue);
  const lastUpdatedRef = useRef<number>(0);
  const isSavingRef = useRef<boolean>(false);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // ۱. بارگذاری اولیه با منطق "اولویت مطلق با داده محلی"
  useEffect(() => {
    let ignore = false;
    setIsLoading(true);
    
    const init = async () => {
      const docRef = doc(db, "appData", key);
      try {
        const snap = await getDoc(docRef);
        let finalPayload: any;
        
        // اولویت ۱: داده معتبر در سرور وجود دارد
        if (snap.exists() && snap.data().value !== undefined && hasData(snap.data().value)) {
          finalPayload = snap.data();
        } else {
          // اولویت ۲: سرور خالی یا نامعتبر است، اما داده محلی (LocalStorage/IDB) داریم
          const localData = readFromLS(key) ?? (await readFromIDB(key));
          
          if (localData !== undefined && hasData(localData)) {
            finalPayload = { 
              value: localData,
              lastUpdated: Date.now()
            };
            // 🛡️ تعمیر سرور: داده محلی معتبر را به سرور برمی‌گردانیم
            await setDoc(docRef, removeUndefinedFields(finalPayload), { merge: true });
          } else {
            // اولویت ۳: نه سرور داده دارد، نه محلی. 
            // 🛡️ دفاع نهایی: اگر initialValue خالی است، هرگز آن را به سرور نفرست تا داده دستگاه‌های دیگر پاک نشود!
            const isInitialValueEmpty = isEmptyData(initialValue);
            
            if (!isInitialValueEmpty) {
              finalPayload = { 
                value: initialValue,
                lastUpdated: Date.now()
              };
              await setDoc(docRef, removeUndefinedFields(finalPayload), { merge: true });
            } else {
              // اگر initialValue هم خالی است، فقط یک آبجکت خالی با زمان فعلی برمی‌گردانیم، اما به سرور نمی‌نویسیم
              finalPayload = { 
                value: initialValue,
                lastUpdated: Date.now()
              };
            }
          }
        }

        if (!ignore && isMounted.current) {
          setValue(finalPayload.value);
          valueRef.current = finalPayload.value;
          lastUpdatedRef.current = finalPayload.lastUpdated || Date.now();
          setIsLoaded(true);
          setIsLoading(false);
        }
      } catch (error) {
        console.error(`🔴 [${key}] Init Error:`, error);
        if (!ignore && isMounted.current) {
          // در صورت خطای شبکه، حتماً از داده محلی استفاده کن
          const localData = readFromLS(key) ?? (await readFromIDB(key));
          if (localData !== undefined && hasData(localData)) {
            setValue(localData);
            valueRef.current = localData;
          }
          setIsLoaded(true);
          setIsLoading(false);
        }
      }
    };

    init();
    return () => { ignore = true; isMounted.current = false; };
  }, [key]); // initialValue را از وابستگی‌ها حذف کردیم تا با رندرهای مجدد بازنشانی نشود

  // ۲. شنونده بلادرنگ
  useEffect(() => {
    if (!isLoaded) return;
    const docRef = doc(db, "appData", key);
    
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (!isMounted.current) return;
        
        if (docSnap.metadata.fromCache && lastUpdatedRef.current > 0) {
          return; 
        }

        if (docSnap.exists() && docSnap.data().value !== undefined) {
          const payload = docSnap.data();
          const incomingTimestamp = payload.lastUpdated || 0;

          if (incomingTimestamp > lastUpdatedRef.current) {
            // 🛡️ دفاع در برابر پاک‌شدن از سمت سرور
            const hadData = hasData(valueRef.current);
            const isNowEmpty = isEmptyData(payload.value);
            
            if (hadData && isNowEmpty) {
              console.error(`🚨 [${key}] BLOCKED SERVER WIPEOUT! Ignored empty server data.`);
              return; 
            }

            lastUpdatedRef.current = incomingTimestamp;
            valueRef.current = payload.value;
            setValue(payload.value);
            
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
          if (JSON.stringify(valueRef.current) !== JSON.stringify(parsed)) {
            valueRef.current = parsed;
            setValue(parsed);
            lastUpdatedRef.current = Date.now(); 
          }
        } catch {}
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [key]);

  // ۴. تابع به‌روزرسانی داده
  const setSyncedValue = useCallback(async (newValue: T | ((prev: T) => T)) => {
    if (isSavingRef.current) {
      console.warn(`⚠️ [${key}] Save already in progress, skipping.`);
      return valueRef.current;
    }
    isSavingRef.current = true;

    try {
      const resolvedValue = typeof newValue === "function" 
        ? (newValue as (prev: T) => T)(valueRef.current)
        : newValue;

      // 🛡️ دفاع در برابر پاک‌کردن تصادفی توسط کد برنامه
      const hadData = hasData(valueRef.current);
      const isNowEmpty = isEmptyData(resolvedValue);
      
      if (hadData && isNowEmpty) {
        console.error(`🚨 [${key}] BLOCKED LOCAL WIPEOUT! Script tried to set empty data. Blocked.`);
        return valueRef.current; 
      }

      const newTimestamp = Date.now();
      const payload = {
        value: resolvedValue,
        lastUpdated: newTimestamp
      };

      valueRef.current = resolvedValue;
      setValue(resolvedValue);
      lastUpdatedRef.current = newTimestamp;
      saveToLS(key, resolvedValue);
      saveToIDB(key, resolvedValue).catch(() => {});

      const docRef = doc(db, "appData", key);
      await setDoc(docRef, removeUndefinedFields(payload), { merge: true });
      
      return resolvedValue;
    } catch (error) {
      console.error(`🔴 [${key}] Firebase Save Failed:`, error);
      return valueRef.current;
    } finally {
      isSavingRef.current = false;
    }
  }, [key]);

  return [value, setSyncedValue, isLoading] as const; // 🛡️ خروجی isLoading اضافه شد
}
