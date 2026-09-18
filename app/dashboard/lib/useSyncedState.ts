"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { doc, setDoc, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "./firebase";

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
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
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
  } catch {}
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
// ✅ کش سراسری در سطح ماژول (بین mount/unmount زنده می‌مونه)
// ============================================================
type CacheEntry = {
  value: any;
  lastUpdated: number;
  loaded: boolean;
};
const globalCache = new Map<string, CacheEntry>();

export function useSyncedState<T>(key: string, initialValue: T) {
  // 🛡️ مقدار اولیه از کش سراسری (اگه موجود باشه) — جلوگیری از پرش داده
  const cached = globalCache.get(key);
  const initial = cached?.loaded ? (cached.value as T) : initialValue;

  const [value, setValue] = useState<T>(initial);
  const [isLoaded, setIsLoaded] = useState(cached?.loaded ?? false);
  const [isLoading, setIsLoading] = useState(!(cached?.loaded ?? false));

  const valueRef = useRef<T>(initial);
  const lastUpdatedRef = useRef<number>(cached?.lastUpdated ?? 0);
  const pendingWritesRef = useRef<number>(0);
  const lastLocalWriteRef = useRef<string>("");
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // ۱. بارگذاری اولیه
  useEffect(() => {
    isMountedRef.current = true;
    let ignore = false;

    // اگه قبلاً لود شده (از کش سراسری)، دیگه از صفر شروع نکن
    const alreadyLoaded = globalCache.get(key)?.loaded;
    if (alreadyLoaded) {
      setIsLoaded(true);
      setIsLoading(false);
    }

    const init = async () => {
      const docRef = doc(db, "appData", key);
      try {
        const snap = await getDoc(docRef);
        let finalPayload: any;

        if (snap.exists() && snap.data().value !== undefined && hasData(snap.data().value)) {
          finalPayload = snap.data();
        } else {
          // fallback: local storage / idb
          const localData = readFromLS(key) ?? (await readFromIDB(key));
          if (localData !== undefined && hasData(localData)) {
            finalPayload = { value: localData, lastUpdated: Date.now() };
            await setDoc(docRef, removeUndefinedFields(finalPayload), { merge: true });
          } else {
            const isInitialValueEmpty = isEmptyData(initialValue);
            if (!isInitialValueEmpty) {
              finalPayload = { value: initialValue, lastUpdated: Date.now() };
              await setDoc(docRef, removeUndefinedFields(finalPayload), { merge: true });
            } else {
              finalPayload = { value: initialValue, lastUpdated: Date.now() };
            }
          }
        }

        // 🛡️ فقط اگه داده جدیدتره، overwrite کن
        if (!ignore && isMountedRef.current) {
          const serverTs = finalPayload.lastUpdated || 0;

          // اگه داده لوکال جدیدتره، ازش استفاده کن (ننویس روی سرور)
          if (lastUpdatedRef.current > serverTs && hasData(valueRef.current)) {
            // داده لوکال معتبرتره، پس دست نزن
            setIsLoaded(true);
            setIsLoading(false);
            return;
          }

          setValue(finalPayload.value);
          valueRef.current = finalPayload.value;
          lastUpdatedRef.current = serverTs || Date.now();

          globalCache.set(key, {
            value: finalPayload.value,
            lastUpdated: lastUpdatedRef.current,
            loaded: true,
          });

          setIsLoaded(true);
          setIsLoading(false);
        }
      } catch (error) {
        console.error(`🔴 [${key}] Init Error:`, error);
        if (!ignore && isMountedRef.current) {
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
    return () => {
      ignore = true;
      isMountedRef.current = false;
      // 🛡️ کش سراسری رو با آخرین مقدار معتبر به‌روز کن
      if (hasData(valueRef.current)) {
        globalCache.set(key, {
          value: valueRef.current,
          lastUpdated: lastUpdatedRef.current,
          loaded: true,
        });
      }
    };
  }, [key]);

  // ۲. onSnapshot
  useEffect(() => {
    if (!isLoaded) return;
    isMountedRef.current = true;

    const docRef = doc(db, "appData", key);
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (!isMountedRef.current) return;

        // echo خودمون رو ignore کن
        if (pendingWritesRef.current > 0 && docSnap.exists()) {
          const incomingStr = JSON.stringify(docSnap.data().value);
          if (incomingStr === lastLocalWriteRef.current) {
            const incomingTs = docSnap.data().lastUpdated || 0;
            if (incomingTs > lastUpdatedRef.current) {
              lastUpdatedRef.current = incomingTs;
              globalCache.set(key, {
                value: valueRef.current,
                lastUpdated: incomingTs,
                loaded: true,
              });
            }
            return;
          }
        }

        if (docSnap.metadata.fromCache && lastUpdatedRef.current > 0) return;

        if (docSnap.exists() && docSnap.data().value !== undefined) {
          const payload = docSnap.data();
          const incomingTimestamp = payload.lastUpdated || 0;

          if (incomingTimestamp > lastUpdatedRef.current) {
            const hadData = hasData(valueRef.current);
            const isNowEmpty = isEmptyData(payload.value);
            if (hadData && isNowEmpty) {
              console.error(`🚨 [${key}] BLOCKED SERVER WIPEOUT!`);
              return;
            }

            lastUpdatedRef.current = incomingTimestamp;
            valueRef.current = payload.value;
            setValue(payload.value);

            globalCache.set(key, {
              value: payload.value,
              lastUpdated: incomingTimestamp,
              loaded: true,
            });

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
      unsubscribe();
    };
  }, [key, isLoaded]);

  // ۳. sync بین تب‌ها
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
            globalCache.set(key, {
              value: parsed,
              lastUpdated: lastUpdatedRef.current,
              loaded: true,
            });
          }
        } catch {}
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [key]);

  // ۴. setSyncedValue
  const setSyncedValue = useCallback(
    async (newValue: T | ((prev: T) => T)) => {
      pendingWritesRef.current += 1;
      try {
        const resolvedValue =
          typeof newValue === "function"
            ? (newValue as (prev: T) => T)(valueRef.current)
            : newValue;

        const hadData = hasData(valueRef.current);
        const isNowEmpty = isEmptyData(resolvedValue);
        if (hadData && isNowEmpty) {
          console.error(`🚨 [${key}] BLOCKED LOCAL WIPEOUT!`);
          return valueRef.current;
        }

        const newTimestamp = Date.now();
        const payload = { value: resolvedValue, lastUpdated: newTimestamp };

        // آپدیت فوری
        valueRef.current = resolvedValue;
        setValue(resolvedValue);
        lastUpdatedRef.current = newTimestamp;
        lastLocalWriteRef.current = JSON.stringify(resolvedValue);

        // 🛡️ کش سراسری رو فوری آپدیت کن (جلوگیری از پرش در unmount)
        globalCache.set(key, {
          value: resolvedValue,
          lastUpdated: newTimestamp,
          loaded: true,
        });

        saveToLS(key, resolvedValue);
        saveToIDB(key, resolvedValue).catch(() => {});

        const docRef = doc(db, "appData", key);
        await setDoc(docRef, removeUndefinedFields(payload), { merge: true });

        return resolvedValue;
      } catch (error) {
        console.error(`🔴 [${key}] Firebase Save Failed:`, error);
        return valueRef.current;
      } finally {
        pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
      }
    },
    [key]
  );

  return [value, setSyncedValue, isLoading] as const;
}
