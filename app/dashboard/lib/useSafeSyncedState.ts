"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  writeBatch,
  getDoc,
  query,
  orderBy
} from "firebase/firestore";
import { db } from "./firebase";

// ============================================================
// توابع کمکی (Helpers)
// ============================================================

function removeUndefinedFields(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(removeUndefinedFields);
  const cleaned: any = {};
  for (const key in obj) {
    if (obj[key] !== undefined) cleaned[key] = removeUndefinedFields(obj[key]);
  }
  return cleaned;
}

function isEmptyData(data: any): boolean {
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === "object" && data !== null) return Object.keys(data).length === 0;
  return data === null || data === undefined || data === "";
}

function hasData(data: any): boolean { 
  return !isEmptyData(data); 
}

// ============================================================
// سیستم کش چندلایه (Multi-layer Cache)
// ============================================================

const IDB_NAME = "SafeSyncDB";
const IDB_STORE = "safeSyncedData";
const LS_PREFIX = "safe_synced_";

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
  } catch (error) {
    console.warn(`⚠️ [IDB Save] خطا در ذخیره ${key}:`, error);
  }
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
// کش سراسری (Global Cache)
// ============================================================

type CacheEntry = { 
  value: any[]; 
  lastUpdated: number; 
  loaded: boolean;
  itemCount: number;
};

const globalCache = new Map<string, CacheEntry>();

// ============================================================
// هوک اصلی (Main Hook)
// ============================================================

export function useSafeSyncedState<T extends { id: string }>(
  collectionName: string, 
  initialValue: T[]
) {
  const cached = globalCache.get(collectionName);
  const initial = cached?.loaded ? (cached.value as T[]) : initialValue;

  const [data, setData] = useState<T[]>(initial);
  const [isLoading, setIsLoading] = useState(!(cached?.loaded ?? false));
  const [error, setError] = useState<string | null>(null);

  const dataRef = useRef<T[]>(initial);
  const lastUpdatedRef = useRef<number>(cached?.lastUpdated ?? 0);
  const pendingWritesRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingChangesRef = useRef<Map<string, T | null>>(new Map());

  useEffect(() => { 
    dataRef.current = data; 
  }, [data]);

  // ============================================================
  // بارگذاری اولیه (Initial Load)
  // ============================================================

  useEffect(() => {
    isMountedRef.current = true;
    let ignore = false;

    const init = async () => {
      const colRef = collection(db, collectionName);

      try {
        // ۱. تلاش برای خواندن از کش محلی (برای سرعت)
        const localData = readFromLS(collectionName) ?? (await readFromIDB(collectionName));
        
        if (localData && hasData(localData) && !cached?.loaded) {
          if (!ignore && isMountedRef.current) {
            setData(localData);
            dataRef.current = localData;
            setIsLoading(false);
          }
        }

        // ۲. گوش دادن به تغییرات بلادرنگ از فایربیس
        const unsubscribe = onSnapshot(colRef, (snapshot) => {
          if (!isMountedRef.current || ignore) return;

          const newData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as T[];

          // مرتب‌سازی بر اساس createdAt یا updatedAt (اگر وجود داشته باشد)
          newData.sort((a, b) => {
            const aTime = (a as any).updatedAt || (a as any).createdAt || 0;
            const bTime = (b as any).updatedAt || (b as any).createdAt || 0;
            return bTime - aTime; // جدیدترین اول
          });

          if (!ignore && isMountedRef.current) {
            const now = Date.now();
            lastUpdatedRef.current = now;
            
            setData(newData);
            dataRef.current = newData;
            setError(null);
            setIsLoading(false);

            // ذخیره در کش سراسری
            globalCache.set(collectionName, { 
              value: newData, 
              lastUpdated: now, 
              loaded: true,
              itemCount: newData.length 
            });

            // ذخیره در کش محلی (برای دفعات بعد)
            saveToLS(collectionName, newData);
            saveToIDB(collectionName, newData).catch(() => {});
          }
        }, (error) => {
          console.error(`🔴 [${collectionName}] Snapshot Error:`, error);
          if (!ignore && isMountedRef.current) {
            setError(error.message);
            setIsLoading(false);
          }
        });

        return () => {
          ignore = true;
          isMountedRef.current = false;
          unsubscribe();
          
          // ذخیره نهایی در کش
          if (hasData(dataRef.current)) {
            globalCache.set(collectionName, { 
              value: dataRef.current, 
              lastUpdated: lastUpdatedRef.current, 
              loaded: true,
              itemCount: dataRef.current.length 
            });
          }
        };
      } catch (error: any) {
        console.error(`🔴 [${collectionName}] Init Error:`, error);
        if (!ignore && isMountedRef.current) {
          setError(error.message);
          setIsLoading(false);
        }
      }
    };

    init();
  }, [collectionName]);

  // ============================================================
  // به‌روزرسانی هوشمند (Smart Update with Batching)
  // ============================================================

  const setSafeValue = useCallback(async (
    newValue: T[] | ((prev: T[]) => T[])
  ) => {
    const resolvedValue = typeof newValue === "function" 
      ? newValue(dataRef.current) 
      : newValue;

    if (!resolvedValue || !Array.isArray(resolvedValue)) {
      console.warn(`⚠️ [${collectionName}] مقدار نامعتبر`);
      return dataRef.current;
    }

    // به‌روزرسانی فوری UI (Optimistic Update)
    dataRef.current = resolvedValue;
    setData(resolvedValue);
    
    const now = Date.now();
    lastUpdatedRef.current = now;
    globalCache.set(collectionName, { 
      value: resolvedValue, 
      lastUpdated: now, 
      loaded: true,
      itemCount: resolvedValue.length 
    });

    // ذخیره در کش محلی
    saveToLS(collectionName, resolvedValue);
    saveToIDB(collectionName, resolvedValue).catch(() => {});

    // ============================================================
    // محاسبه تغییرات (Delta Calculation)
    // ============================================================

    const currentMap = new Map(data.map(item => [item.id, item]));
    const newMap = new Map(resolvedValue.map(item => [item.id, item]));

    const toAdd: T[] = [];
    const toUpdate: T[] = [];
    const toDelete: string[] = [];

    // پیدا کردن آیتم‌های جدید و تغییر کرده
    for (const [id, newItem] of newMap) {
      const currentItem = currentMap.get(id);
      
      if (!currentItem) {
        // آیتم جدید
        toAdd.push({ ...newItem, id: id || crypto.randomUUID(), updatedAt: now });
      } else if (JSON.stringify(currentItem) !== JSON.stringify(newItem)) {
        // آیتم تغییر کرده
        toUpdate.push({ ...newItem, updatedAt: now });
      }
    }

    // پیدا کردن آیتم‌های حذف شده
    for (const id of currentMap.keys()) {
      if (!newMap.has(id)) {
        toDelete.push(id);
      }
    }

    // ============================================================
    // ارسال تغییرات به فایربیس (Batch Operations)
    // ============================================================

    pendingWritesRef.current += 1;

    try {
      const batch = writeBatch(db);
      let hasChanges = false;

      // افزودن آیتم‌های جدید
      for (const item of toAdd) {
        const cleanItem = removeUndefinedFields(item);
        batch.set(doc(db, collectionName, item.id), cleanItem);
        hasChanges = true;
      }

      // به‌روزرسانی آیتم‌های تغییر کرده
      for (const item of toUpdate) {
        const cleanItem = removeUndefinedFields(item);
        batch.set(doc(db, collectionName, item.id), cleanItem, { merge: true });
        hasChanges = true;
      }

      // حذف آیتم‌های حذف شده
      for (const id of toDelete) {
        batch.delete(doc(db, collectionName, id));
        hasChanges = true;
      }

      // ارسال دسته‌ای (بسیار سریع‌تر از ارسال تکی)
      if (hasChanges) {
        await batch.commit();
        console.log(`✅ [${collectionName}] تغییرات ارسال شد: ${toAdd.length} جدید، ${toUpdate.length} به‌روزرسانی، ${toDelete.length} حذف`);
      }

      return resolvedValue;
    } catch (error: any) {
      console.error(`🔴 [${collectionName}] Firebase Save Failed:`, error);
      setError(error.message);
      
      // بازگشت به حالت قبل در صورت خطا
      setData(dataRef.current);
      return dataRef.current;
    } finally {
      pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
    }
  }, [collectionName]);

  // ============================================================
  // توابع کمکی (Helper Functions)
  // ============================================================

  const addItem = useCallback(async (item: Omit<T, "id">) => {
    const newItem = { 
      ...item, 
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    } as T;
    
    return setSafeValue(prev => [...prev, newItem]);
  }, [setSafeValue]);

  const updateItem = useCallback(async (id: string, updates: Partial<T>) => {
    return setSafeValue(prev => 
      prev.map(item => 
        item.id === id 
          ? { ...item, ...updates, updatedAt: Date.now() }
          : item
      )
    );
  }, [setSafeValue]);

  const deleteItem = useCallback(async (id: string) => {
    return setSafeValue(prev => prev.filter(item => item.id !== id));
  }, [setSafeValue]);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    // پاک کردن کش محلی برای بارگذاری مجدد
    globalCache.delete(collectionName);
    localStorage.removeItem(LS_PREFIX + collectionName);
    
    try {
      const db = await openIDB();
      db.transaction(IDB_STORE, "readwrite").objectStore(IDB_STORE).delete(collectionName);
    } catch {}

    // راه‌اندازی مجدد listener
    setIsLoading(false);
  }, [collectionName]);

  // ============================================================
  // خروجی (Return)
  // ============================================================

  return [
    data, 
    setSafeValue, 
    isLoading,
    {
      error,
      addItem,
      updateItem,
      deleteItem,
      refreshData,
      itemCount: data.length
    }
  ] as const;
}
