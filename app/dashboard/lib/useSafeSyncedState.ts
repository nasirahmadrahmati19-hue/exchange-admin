"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  onSnapshot,
  doc,
  writeBatch,
  Timestamp,
  Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "./firebase"; 

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
// کش سراسری در مموری (فقط برای جلوگیری از لود مجدد در همان Session)
// ============================================================

type CacheEntry = {
  value: any[];
  loaded: boolean;
};

const globalCache = new Map<string, CacheEntry>();

// ============================================================
// هوک اصلی (Main Hook) - بهینه‌شده برای آفلاین
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

  const userId = auth.currentUser?.uid;
  const uniqueKey = userId ? `${userId}_${collectionName}` : collectionName;

  const cached = globalCache.get(uniqueKey);
  const initial = cached?.loaded ? (cached.value as T[]) : initialValue;

  const [data, setData] = useState<T[]>(initial);
  const [isLoading, setIsLoading] = useState<boolean>(!cached?.loaded);
  const [error, setError] = useState<string | null>(null);

  const dataRef = useRef<T[]>(initial);
  const isMountedRef = useRef<boolean>(false);
  const unsubscribeRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    let cancelled = false;
    isMountedRef.current = true;

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    const colRef = userId 
      ? collection(db, "users", userId, collectionName)
      : collection(db, collectionName);

    // استفاده از onSnapshot
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

          // مرتب‌سازی بر اساس زمان
          newData.sort((a, b) => {
            const aTime = (a as any).updatedAt || (a as any).createdAt || 0;
            const bTime = (b as any).updatedAt || (b as any).createdAt || 0;
            if (bTime !== aTime) return (bTime as number) - (aTime as number);
            return String(a.id).localeCompare(String(b.id));
          });

          // ✅ حذف مقایسه JSON.stringify (بسیار سنگین و عامل اصلی فریز شدن برنامه)
          // فایربیس فقط زمانی این تابع را صدا می‌زند که داده‌ها واقعاً تغییر کرده باشند.
          
          dataRef.current = newData;
          setData(newData);
          setError(null);
          setIsLoading(false);

          globalCache.set(uniqueKey, {
            value: newData,
            loaded: true,
          });

        } catch (err) {
          console.error(`🔴 [${collectionName}] Snapshot Processing Error:`, err);
        }
      },
      (err) => {
        if (cancelled || !isMountedRef.current) return;
        
        // ✅ مدیریت هوشمند خطای آفلاین
        // اگر اینترنت قطع باشد و کش محلی خالی باشد، فایربیس خطای unavailable می‌دهد.
        // به جای کرش کردن، فقط وضعیت را آفلاین اعلام می‌کنیم.
        if (err.code === 'unavailable' || err.code === 'failed-precondition' || err.message?.includes('offline')) {
          console.warn(`⚠️ [${collectionName}] آفلاین هستید. داده‌ها از کش محلی خوانده می‌شوند.`);
          setError("offline");
          setIsLoading(false);
          return;
        }

        console.error(`🔴 [${collectionName}] Snapshot Error:`, err);
        setError(err?.message || "Firebase snapshot error");
        setIsLoading(false);
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      cancelled = true;
      isMountedRef.current = false;
      if (unsubscribeRef.current) {
        try { unsubscribeRef.current(); } catch {}
        unsubscribeRef.current = null;
      }
    };
  }, [collectionName, uniqueKey, userId]);

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
        return dataRef.current;
      }

      const normalizedValue = resolvedValue.map(normalizeItem) as T[];
      const previousData = dataRef.current;

      // آپدیت فوری UI (Optimistic UI)
      dataRef.current = normalizedValue;
      setData(normalizedValue);
      
      globalCache.set(uniqueKey, {
        value: normalizedValue,
        loaded: true,
      });

      // محاسبه تغییرات برای ارسال به فایربیس
      const currentMap = new Map(previousData.map((item) => [String(item.id), item]));
      const newMap = new Map(normalizedValue.map((item) => [String(item.id), item]));

      const toAdd: T[] = [];
      const toUpdate: T[] = [];
      const toDelete: string[] = [];

      for (const [idStr, newItem] of newMap) {
        const currentItem = currentMap.get(idStr);
        if (!currentItem) {
          toAdd.push({ ...newItem, id: String(newItem.id) || generateId(), updatedAt: Date.now() } as T);
        } else if (currentItem !== newItem) { // مقایسه مرجع به جای JSON
          toUpdate.push({ ...newItem, updatedAt: Date.now() } as T);
        }
      }

      for (const idStr of currentMap.keys()) {
        if (!newMap.has(idStr)) {
          toDelete.push(idStr);
        }
      }

      // اگر هیچ تغییری نکرده، خروج
      if (toAdd.length === 0 && toUpdate.length === 0 && toDelete.length === 0) {
        return normalizedValue;
      }

      try {
        const allOperations = [
          ...toAdd.map((item) => ({ type: "set" as const, id: String(item.id), data: removeUndefinedFields(item) })),
          ...toUpdate.map((item) => ({ type: "update" as const, id: String(item.id), data: removeUndefinedFields(item) })),
          ...toDelete.map((id) => ({ type: "delete" as const, id })),
        ];

        const BATCH_LIMIT = 450;

        for (let i = 0; i < allOperations.length; i += BATCH_LIMIT) {
          const chunk = allOperations.slice(i, i + BATCH_LIMIT);
          const batch = writeBatch(db);

          for (const op of chunk) {
            const docRef = userId
              ? doc(db, "users", userId, collectionName, op.id)
              : doc(db, collectionName, op.id);

            if (op.type === "set") batch.set(docRef, op.data);
            else if (op.type === "update") batch.set(docRef, op.data, { merge: true });
            else if (op.type === "delete") batch.delete(docRef);
          }

          // ✅ فایربیس با persistentLocalCache این صف را در حالت آفلاین نگه می‌دارد
          // و به محض وصل شدن اینترنت، خودکار آن را سینک می‌کند.
          await batch.commit(); 
        }

        return normalizedValue;
      } catch (err: any) {
        // اگر خطای واقعی (مثل Security Rules) رخ داد، لاگ می‌کنیم
        // اما UI را برنمی‌گردانیم چون داده در کش محلی فایربیس ثبت شده است.
        console.warn(`⚠️ [${collectionName}] خطا در ثبت تغییرات:`, err.message);
        setError("sync_error");
        return normalizedValue;
      }
    },
    [collectionName, uniqueKey, userId]
  );

  const addItem = useCallback(
    async (item: Omit<T, "id">) => {
      const timestamp = Date.now();
      const newItem = { ...item, id: generateId(), createdAt: timestamp, updatedAt: timestamp } as unknown as T;
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
    // برای رفرش، فقط کافیست هوک دوباره اجرا شود یا یک تغییر کوچک در state ایجاد کنیم
    // اما چون از onSnapshot استفاده می‌کنیم، فایربیس خودش داده‌های جدید را می‌آورد.
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
