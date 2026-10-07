"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  onSnapshot,
  doc,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase"; // ✅ auth اضافه شد

// ============================================================
// توابع کمکی (Helpers)
// ============================================================

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

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

function normalizeItem(item: any): any {
  if (!item || typeof item !== "object") return item;
  if (Array.isArray(item)) return item.map(normalizeItem);

  const normalized: any = { ...item };
  for (const key in normalized) {
    const val = normalized[key];
    if (val instanceof Timestamp) {
      normalized[key] = val.toMillis();
    } else if (val && typeof val === 'object' && 'toMillis' in val && typeof val.toMillis === 'function') {
       normalized[key] = val.toMillis();
    } else if (typeof val === "object" && val !== null) {
      normalized[key] = normalizeItem(val);
    }
  }
  return normalized;
}

// ============================================================
// سیستم کش چندلایه (Multi-layer Cache) - ایزوله شده با UID
// ============================================================

const IDB_NAME = "SafeSyncDB";
const IDB_STORE = "safeSyncedData";
const LS_PREFIX = "safe_synced_";

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject("Window is undefined");
      return;
    }
    try {
      const request = indexedDB.open(IDB_NAME, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
    } catch (e) {
      reject(e);
    }
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
  } catch (e) {
    console.warn("IDB Save Error:", e);
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
// هوک اصلی (Main Hook) - با پشتیبانی از ایزوله‌سازی کاربر
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
      {
        error: "Missing collection name",
        addItem: async () => {},
        updateItem: async () => {},
        deleteItem: async () => {},
        refreshData: async () => {},
        itemCount: 0,
      },
    ] as const;
  }

  // ✅ دریافت UID کاربر فعلی
  const userId = auth.currentUser?.uid;
  
  // ✅ ساخت کلیدهای یکتا بر اساس UID کاربر (جلوگیری از تداخل داده‌ها روی یک دستگاه)
  const uniqueKey = userId ? `${userId}_${collectionName}` : collectionName;

  const cached = globalCache.get(uniqueKey);
  const localData = readFromLS(uniqueKey);
  const initial = cached?.loaded ? (cached.value as T[]) : (localData || initialValue);

  const [data, setData] = useState<T[]>(initial);
  const [isLoading, setIsLoading] = useState<boolean>(!(cached?.loaded || localData));
  const [error, setError] = useState<string | null>(null);

  const dataRef = useRef<T[]>(initial);
  const lastUpdatedRef = useRef<number>(cached?.lastUpdated ?? 0);
  const pendingWritesRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    isMountedRef.current = true;

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    const init = async () => {
      try {
        if (cancelled) return;

        // ✅ مسیردهی صریح و بدون خطای تایپ‌اسکریپت
        const colRef = userId 
          ? collection(db, "users", userId, collectionName)
          : collection(db, collectionName);

        let persistedData = localData;
        if (!persistedData) {
          persistedData = await readFromIDB(uniqueKey);
        }

        if (!cancelled && persistedData && hasData(persistedData) && !cached?.loaded) {
          dataRef.current = persistedData;
          setData(persistedData);
          setIsLoading(false);
        }

        if (cancelled) return;

        const unsubscribe = onSnapshot(
          colRef,
          (snapshot) => {
            if (cancelled || !isMountedRef.current) return;

            try {
              const rawData = snapshot.docs.map((document) => ({
                id: document.id,
                ...document.data(),
              }));
              
              const newData = rawData.map(normalizeItem) as T[];

              newData.sort((a, b) => {
                const aTime = (a as any).updatedAt || (a as any).createdAt || 0;
                const bTime = (b as any).updatedAt || (b as any).createdAt || 0;
                
                if (bTime !== aTime) {
                  return (bTime as number) - (aTime as number);
                }
                return String(a.id).localeCompare(String(b.id));
              });

              const oldData = dataRef.current;
              let isDataSame = oldData.length === newData.length;
              
              if (isDataSame) {
                const oldStr = JSON.stringify(oldData);
                const newStr = JSON.stringify(newData);
                if (oldStr !== newStr) isDataSame = false;
              }

              if (isDataSame) {
                setIsLoading(false);
                return;
              }

              if (cancelled || !isMountedRef.current) return;

              const now = Date.now();
              lastUpdatedRef.current = now;
              dataRef.current = newData;
              setData(newData);
              setError(null);
              setIsLoading(false);

              globalCache.set(uniqueKey, {
                value: newData,
                lastUpdated: now,
                loaded: true,
                itemCount: newData.length,
              });

              saveToLS(uniqueKey, newData);
              saveToIDB(uniqueKey, newData).catch(() => {});

            } catch (err) {
              console.error(`🔴 [${collectionName}] Snapshot Processing Error:`, err);
            }
          },
          (err) => {
            if (cancelled || !isMountedRef.current) return;
            console.warn(`⚠️ [${collectionName}] خطای Snapshot (احتمالاً قطع اینترنت):`, err.message);
            
            if (dataRef.current.length > 0) {
              setIsLoading(false);
              setError("offline");
            } else {
              setError(err?.message || "Firebase snapshot error");
              setIsLoading(false);
            }
          }
        );

        unsubscribeRef.current = unsubscribe;

      } catch (err: any) {
        if (cancelled || !isMountedRef.current) return;
        console.error(`🔴 [${collectionName}] Init Error:`, err);
        setError(err?.message || "Initialization error");
        setIsLoading(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      isMountedRef.current = false;

      if (unsubscribeRef.current) {
        try {
          unsubscribeRef.current();
        } catch {}
        unsubscribeRef.current = null;
      }

      if (hasData(dataRef.current)) {
        globalCache.set(uniqueKey, {
          value: dataRef.current,
          lastUpdated: lastUpdatedRef.current,
          loaded: true,
          itemCount: dataRef.current.length,
        });
      }
    };
  }, [collectionName, uniqueKey, userId]); // ✅ وابستگی‌ها به‌روز شدند

  // ============================================================
  // توابع نوشتن (Write Operations)
  // ============================================================

  const setSafeValue = useCallback(
    async (newValue: T[] | ((prev: T[]) => T[])) => {
      const resolvedValue =
        typeof newValue === "function"
          ? (newValue as (prev: T[]) => T[])(dataRef.current)
          : newValue;

      if (!resolvedValue || !Array.isArray(resolvedValue)) {
        console.warn(`⚠️ [${collectionName}] مقدار نامعتبر`);
        return dataRef.current;
      }

      const normalizedValue = resolvedValue.map(normalizeItem) as T[];
      const previousData = dataRef.current;

      let isSame = previousData.length === normalizedValue.length;
      if (isSame) {
        const prevStr = JSON.stringify(previousData);
        const newStr = JSON.stringify(normalizedValue);
        if (prevStr !== newStr) isSame = false;
      }

      if (isSame) {
        return previousData;
      }

      dataRef.current = normalizedValue;
      setData(normalizedValue);
      
      const now = Date.now();
      lastUpdatedRef.current = now;

      globalCache.set(uniqueKey, {
        value: normalizedValue,
        lastUpdated: now,
        loaded: true,
        itemCount: normalizedValue.length,
      });

      saveToLS(uniqueKey, normalizedValue);
      saveToIDB(uniqueKey, normalizedValue).catch(() => {});

      const currentMap = new Map(previousData.map((item) => [String(item.id), item]));
      const newMap = new Map(normalizedValue.map((item) => [String(item.id), item]));

      const toAdd: T[] = [];
      const toUpdate: T[] = [];
      const toDelete: string[] = [];

      for (const [idStr, newItem] of newMap) {
        const currentItem = currentMap.get(idStr);
        if (!currentItem) {
          toAdd.push({
            ...newItem,
            id: String(newItem.id) || generateId(),
            updatedAt: now,
          } as T);
        } else if (JSON.stringify(currentItem) !== JSON.stringify(newItem)) {
          toUpdate.push({
            ...newItem,
            updatedAt: now,
          } as T);
        }
      }

      for (const idStr of currentMap.keys()) {
        if (!newMap.has(idStr)) {
          toDelete.push(idStr);
        }
      }

      pendingWritesRef.current += 1;

      try {
        const allOperations = [
          ...toAdd.map((item) => ({ type: "set" as const, id: String(item.id), data: removeUndefinedFields(item) })),
          ...toUpdate.map((item) => ({ type: "update" as const, id: String(item.id), data: removeUndefinedFields(item) })),
          ...toDelete.map((id) => ({ type: "delete" as const, id })),
        ];

        const BATCH_LIMIT = 450;
        let hasChanges = false;

        for (let i = 0; i < allOperations.length; i += BATCH_LIMIT) {
          const chunk = allOperations.slice(i, i + BATCH_LIMIT);
          const batch = writeBatch(db);

          for (const op of chunk) {
            // ✅ مسیردهی صریح برای سند (Document)
            const docRef = userId
              ? doc(db, "users", userId, collectionName, op.id)
              : doc(db, collectionName, op.id);

            if (op.type === "set") {
              batch.set(docRef, op.data);
            } else if (op.type === "update") {
              batch.set(docRef, op.data, { merge: true });
            } else if (op.type === "delete") {
              batch.delete(docRef);
            }
          }

          await batch.commit();
          hasChanges = true;
        }

        if (hasChanges) {
          console.log(`✅ [${collectionName}] تغییرات با موفقیت ثبت شد.`);
        }

        return normalizedValue;
      } catch (err: any) {
        console.warn(`⚠️ [${collectionName}] خطای شبکه (احتمالاً آفلاین). تغییرات در حافظه محلی حفظ شدند.`);
        setError("offline");
        return normalizedValue;
      } finally {
        pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
      }
    },
    [collectionName, uniqueKey, userId] // ✅ وابستگی‌ها به‌روز شدند
  );

  const addItem = useCallback(
    async (item: Omit<T, "id">) => {
      const timestamp = Date.now();
      const newItem = {
        ...item,
        id: generateId(),
        createdAt: timestamp,
        updatedAt: timestamp,
      } as unknown as T;

      return setSafeValue((prev) => [...prev, newItem]);
    },
    [setSafeValue]
  );

  const updateItem = useCallback(
    async (id: string | number, updates: Partial<T>) => {
      return setSafeValue((prev) =>
        prev.map((item) =>
          String(item.id) === String(id)
            ? ({ ...item, ...updates, updatedAt: Date.now() } as unknown as T)
            : item
        )
      );
    },
    [setSafeValue]
  );

  const deleteItem = useCallback(
    async (id: string | number) => {
      return setSafeValue((prev) => prev.filter((item) => String(item.id) !== String(id)));
    },
    [setSafeValue]
  );

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    globalCache.delete(uniqueKey);
    
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(LS_PREFIX + uniqueKey);
      } catch {}
    }

    try {
      const dbInstance = await openIDB();
      dbInstance.transaction(IDB_STORE, "readwrite").objectStore(IDB_STORE).delete(uniqueKey);
    } catch {}
  }, [uniqueKey]);

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
      itemCount: data.length,
    },
  ] as const;
}
