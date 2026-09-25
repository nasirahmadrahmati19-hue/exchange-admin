"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  onSnapshot,
  doc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

// ============================================================
// توابع کمکی (Helpers)
// ============================================================

// ✅ اصلاح ۱: تولید ID امن برای جلوگیری از تداخل (Collision)
function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // فال‌بک امن: ترکیب زمان + عدد تصادفی (بسیار بهتر از Date.now().toString() خالی)
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

// ============================================================
// سیستم کش چندلایه (Multi-layer Cache)
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
  } catch {
    // خطای ذخیره‌سازی نباید باعث توقف برنامه شود
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
// هوک اصلی
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

  const cached = globalCache.get(collectionName);
  const initial = cached?.loaded ? (cached.value as T[]) : initialValue;

  const [data, setData] = useState<T[]>(initial);
  const [isLoading, setIsLoading] = useState<boolean>(!(cached?.loaded ?? false));
  const [error, setError] = useState<string | null>(null);

  const dataRef = useRef<T[]>(initial);
  const lastUpdatedRef = useRef<number>(cached?.lastUpdated ?? 0);
  const pendingWritesRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(false);
  const isProcessingSnapshotRef = useRef<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    isMountedRef.current = true;
    isProcessingSnapshotRef.current = false;

    const init = async () => {
      try {
        if (cancelled) return;

        const colRef = collection(db, collectionName);
        const localData = readFromLS(collectionName) ?? (await readFromIDB(collectionName));

        if (cancelled) return;

        if (localData && hasData(localData) && !cached?.loaded) {
          if (!cancelled && isMountedRef.current) {
            dataRef.current = localData;
            setData(localData);
            setIsLoading(false);
          }
        }

        if (cancelled) return;

        unsubscribe = onSnapshot(
          colRef,
          (snapshot) => {
            if (cancelled || !isMountedRef.current) return;
            if (isProcessingSnapshotRef.current) return;
            
            isProcessingSnapshotRef.current = true;

            try {
              const newData = snapshot.docs.map((document) => ({
                id: document.id,
                ...document.data(),
              })) as T[];

              newData.sort((a, b) => {
                const aTime = (a as any).updatedAt || (a as any).createdAt || 0;
                const bTime = (b as any).updatedAt || (b as any).createdAt || 0;
                return bTime - aTime;
              });

              const isLengthSame = dataRef.current.length === newData.length;
              const isDataSame = isLengthSame && JSON.stringify(dataRef.current) === JSON.stringify(newData);

              if (isDataSame) {
                isProcessingSnapshotRef.current = false;
                return;
              }

              if (cancelled || !isMountedRef.current) {
                isProcessingSnapshotRef.current = false;
                return;
              }

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
                itemCount: newData.length,
              });

              saveToLS(collectionName, newData);
              saveToIDB(collectionName, newData).catch(() => {});
            } finally {
              isProcessingSnapshotRef.current = false;
            }
          },
          (err) => {
            if (cancelled || !isMountedRef.current) return;
            console.error(`🔴 [${collectionName}] Snapshot Error:`, err);
            isProcessingSnapshotRef.current = false;
            setError(err?.message || "Firebase snapshot error");
            setIsLoading(false);
          }
        );
      } catch (err: any) {
        if (cancelled || !isMountedRef.current) return;
        console.error(`🔴 [${collectionName}] Init Error:`, err);
        isProcessingSnapshotRef.current = false;
        setError(err?.message || "Initialization error");
        setIsLoading(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      isMountedRef.current = false;
      isProcessingSnapshotRef.current = false;

      if (unsubscribe) {
        try {
          unsubscribe();
        } catch {}
        unsubscribe = null;
      }

      if (hasData(dataRef.current)) {
        globalCache.set(collectionName, {
          value: dataRef.current,
          lastUpdated: lastUpdatedRef.current,
          loaded: true,
          itemCount: dataRef.current.length,
        });
      }
    };
  }, [collectionName]);

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
        itemCount: resolvedValue.length,
      });

      saveToLS(collectionName, resolvedValue);
      saveToIDB(collectionName, resolvedValue).catch(() => {});

      const currentMap = new Map(previousData.map((item) => [String(item.id), item]));
      const newMap = new Map(resolvedValue.map((item) => [String(item.id), item]));

      const toAdd: T[] = [];
      const toUpdate: T[] = [];
      const toDelete: string[] = [];

      for (const [idStr, newItem] of newMap) {
        const currentItem = currentMap.get(idStr);
        if (!currentItem) {
          toAdd.push({
            ...newItem,
            id: String(newItem.id) || generateId(), // ✅ استفاده از تابع امن
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
        // ✅ اصلاح ۲: مدیریت محدودیت ۵۰۰ تایی Firestore Batch (Chunking)
        const allOperations = [
          ...toAdd.map((item) => ({ type: "set" as const, id: String(item.id), data: removeUndefinedFields(item) })),
          ...toUpdate.map((item) => ({ type: "update" as const, id: String(item.id), data: removeUndefinedFields(item) })),
          ...toDelete.map((id) => ({ type: "delete" as const, id })),
        ];

        const BATCH_LIMIT = 450; // حاشیه امنیت زیر ۵۰۰
        let hasChanges = false;

        for (let i = 0; i < allOperations.length; i += BATCH_LIMIT) {
          const chunk = allOperations.slice(i, i + BATCH_LIMIT);
          const batch = writeBatch(db);

          for (const op of chunk) {
            const docRef = doc(db, collectionName, op.id);
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
          console.log(`✅ [${collectionName}] ${allOperations.length} تغییر با موفقیت ارسال شد`);
        }

        return resolvedValue;
      } catch (err: any) {
        console.error(`🔴 [${collectionName}] Firebase Save Failed:`, err);
        setError(err?.message || "Firebase Save Failed");
        
        // Rollback
        dataRef.current = previousData;
        setData(previousData);
        return previousData;
      } finally {
        pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
      }
    },
    [collectionName]
  );

  const addItem = useCallback(
    async (item: Omit<T, "id">) => {
      const timestamp = Date.now();
      const newItem = {
        ...item,
        id: generateId(), // ✅ استفاده از تابع امن
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
    globalCache.delete(collectionName);
    
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(LS_PREFIX + collectionName);
      } catch {}
    }

    try {
      const dbInstance = await openIDB();
      dbInstance.transaction(IDB_STORE, "readwrite").objectStore(IDB_STORE).delete(collectionName);
    } catch {}
    
    // ✅ اصلاح ۳: حذف setIsLoading(false) از اینجا.
    // تابع onSnapshot به طور خودکار پس از دریافت داده‌ی جدید از سرور، isLoading را false می‌کند.
    // قرار دادن آن در اینجا باعث می‌شود UI زودتر از موعد لودینگ را متوقف کند.
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
      itemCount: data.length,
    },
  ] as const;
}
