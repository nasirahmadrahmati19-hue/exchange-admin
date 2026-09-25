"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { 
  collection, 
  onSnapshot, 
  doc, 
  writeBatch 
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
    const dbInstance = await openIDB();
    return new Promise((resolve, reject) => {
      const transaction = dbInstance.transaction(IDB_STORE, "readwrite");
      const request = transaction.objectStore(IDB_STORE).put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    // در موبایل خطاهای ذخیره‌سازی را نادیده می‌گیریم تا برنامه کرش نکند
  }
}

async function readFromIDB(key: string): Promise<any> {
  if (typeof window === "undefined") return undefined;
  try {
    const dbInstance = await openIDB();
    return new Promise((resolve) => {
      const request = dbInstance.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(key);
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
// هوک اصلی (Main Hook) - بهینه‌شده برای موبایل
// ============================================================

export function useSafeSyncedState<T extends { id: string | number }>(
  collectionName: string, 
  initialValue: T[]
) {
  if (!collectionName) {
    console.error("🔴 useSafeSyncedState: collectionName is required!");
    return [
      initialValue,
      () => {},
      false,
      { error: "Missing collection name", addItem: async () => {}, updateItem: async () => {}, deleteItem: async () => {}, refreshData: async () => {}, itemCount: 0 }
    ] as const;
  }

  const cached = globalCache.get(collectionName);
  const initial = cached?.loaded ? (cached.value as T[]) : initialValue;

  const [data, setData] = useState<T[]>(initial);
  const [isLoading, setIsLoading] = useState(!(cached?.loaded ?? false));
  const [error, setError] = useState<string | null>(null);

  const dataRef = useRef<T[]>(initial);
  const lastUpdatedRef = useRef<number>(cached?.lastUpdated ?? 0);
  const pendingWritesRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);
  
  // 📱 بهینه‌سازی موبایل ۱: جلوگیری از پردازش همزمان اسنپ‌شات‌های پشت‌سرهم
  const isProcessingSnapshotRef = useRef<boolean>(false);

  useEffect(() => {
    isMountedRef.current = true;
    let ignore = false;

    const init = async () => {
      const colRef = collection(db, collectionName);

      try {
        // 📱 بهینه‌سازی موبایل ۲: خواندن کش با اولویت LocalStorage (سریع‌تر از IDB در موبایل)
        const localData = readFromLS(collectionName) ?? (await readFromIDB(collectionName));
        
        if (localData && hasData(localData) && !cached?.loaded) {
          if (!ignore && isMountedRef.current) {
            dataRef.current = localData;
            setData(localData);
            setIsLoading(false);
          }
        }

        const unsubscribe = onSnapshot(colRef, (snapshot) => {
          if (!isMountedRef.current || ignore) return;

          // 📱 بهینه‌سازی موبایل ۳: اگر در حال پردازش هستیم، این اسنپ‌شات را نادیده بگیر
          // این کار از فریز شدن UI موبایل در شبکه‌های ناپایدار جلوگیری می‌کند
          if (isProcessingSnapshotRef.current) return;
          isProcessingSnapshotRef.current = true;

          try {
            const newData = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as T[];

            newData.sort((a, b) => {
              const aTime = (a as any).updatedAt || (a as any).createdAt || 0;
              const bTime = (b as any).updatedAt || (b as any).createdAt || 0;
              return bTime - aTime; 
            });

            // 📱 بهینه‌سازی موبایل ۴: بررسی سریع طول آرایه قبل از JSON.stringify سنگین
            const isLengthSame = dataRef.current.length === newData.length;
            const isDataSame = isLengthSame && JSON.stringify(dataRef.current) === JSON.stringify(newData);

            if (isDataSame) {
              isProcessingSnapshotRef.current = false;
              return; // داده تغییر نکرده، رندر اضافی انجام نده
            }

            if (!ignore && isMountedRef.current) {
              const now = Date.now();
              lastUpdatedRef.current = now;
              
              dataRef.current = newData;
              setData(newData);
              setError(null);
              setIsLoading(false);

              globalCache.set(collectionName, { 
                value: newData, 
                lastUpdated: now, 
                loaded: true,
                itemCount: newData.length 
              });

              // ذخیره‌سازی در پس‌زمینه (بدون await تا UI بلاک نشود)
              saveToLS(collectionName, newData);
              saveToIDB(collectionName, newData).catch(() => {});
            }
          } finally {
            isProcessingSnapshotRef.current = false;
          }
        }, (err) => {
          console.error(`🔴 [${collectionName}] Snapshot Error:`, err);
          isProcessingSnapshotRef.current = false;
          if (!ignore && isMountedRef.current) {
            setError(err.message);
            setIsLoading(false);
          }
        });

        return () => {
          ignore = true;
          isMountedRef.current = false;
          isProcessingSnapshotRef.current = false;
          unsubscribe();
          
          if (hasData(dataRef.current)) {
            globalCache.set(collectionName, { 
              value: dataRef.current, 
              lastUpdated: lastUpdatedRef.current, 
              loaded: true,
              itemCount: dataRef.current.length 
            });
          }
        };
      } catch (err: any) {
        console.error(`🔴 [${collectionName}] Init Error:`, err);
        isProcessingSnapshotRef.current = false;
        if (!ignore && isMountedRef.current) {
          setError(err.message);
          setIsLoading(false);
        }
      }
    };

    init();
  }, [collectionName]);

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

    const previousData = dataRef.current;
    
    if (JSON.stringify(previousData) === JSON.stringify(resolvedValue)) {
      return resolvedValue;
    }

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

    saveToLS(collectionName, resolvedValue);
    saveToIDB(collectionName, resolvedValue).catch(() => {});

    const currentMap = new Map(previousData.map(item => [String(item.id), item]));
    const newMap = new Map(resolvedValue.map(item => [String(item.id), item]));

    const toAdd: T[] = [];
    const toUpdate: T[] = [];
    const toDelete: string[] = [];

    for (const [idStr, newItem] of newMap) {
      const currentItem = currentMap.get(idStr);
      if (!currentItem) {
        toAdd.push({ ...newItem, id: newItem.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()), updatedAt: now } as T);
      } else if (JSON.stringify(currentItem) !== JSON.stringify(newItem)) {
        toUpdate.push({ ...newItem, updatedAt: now } as T);
      }
    }

    for (const idStr of currentMap.keys()) {
      if (!newMap.has(idStr)) {
        toDelete.push(idStr);
      }
    }

    pendingWritesRef.current += 1;

    try {
      const batch = writeBatch(db);
      let hasChanges = false;

      for (const item of toAdd) {
        const cleanItem = removeUndefinedFields(item);
        batch.set(doc(db, collectionName, String(item.id)), cleanItem);
        hasChanges = true;
      }

      for (const item of toUpdate) {
        const cleanItem = removeUndefinedFields(item);
        batch.set(doc(db, collectionName, String(item.id)), cleanItem, { merge: true });
        hasChanges = true;
      }

      for (const idStr of toDelete) {
        batch.delete(doc(db, collectionName, idStr));
        hasChanges = true;
      }

      if (hasChanges) {
        await batch.commit();
        console.log(`✅ [${collectionName}] تغییرات ارسال شد`);
      }

      return resolvedValue;
    } catch (err: any) {
      console.error(`🔴 [${collectionName}] Firebase Save Failed:`, err);
      setError(err.message);
      dataRef.current = previousData;
      setData(previousData);
      return previousData;
    } finally {
      pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
    }
  }, [collectionName]);

  const addItem = useCallback(async (item: Omit<T, "id">) => {
    const newItem = { 
      ...item, 
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    } as unknown as T;
    
    return setSafeValue(prev => [...prev, newItem]);
  }, [setSafeValue]);

  const updateItem = useCallback(async (id: string | number, updates: Partial<T>) => {
    return setSafeValue(prev => 
      prev.map(item => 
        String(item.id) === String(id)
          ? ({ ...item, ...updates, updatedAt: Date.now() } as unknown as T)
          : item
      )
    );
  }, [setSafeValue]);

  const deleteItem = useCallback(async (id: string | number) => {
    return setSafeValue(prev => prev.filter(item => String(item.id) !== String(id)));
  }, [setSafeValue]);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    globalCache.delete(collectionName);
    localStorage.removeItem(LS_PREFIX + collectionName);
    try {
      const dbInstance = await openIDB();
      dbInstance.transaction(IDB_STORE, "readwrite").objectStore(IDB_STORE).delete(collectionName);
    } catch {}
    setIsLoading(false);
  }, [collectionName]);

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
