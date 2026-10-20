"use client";

// ============================================================
// lib/useSyncedState.ts — نسخه اصلاح‌شده (Firestore-only، کاربر-محور)
// 🔴 اصل معماری: Firestore تنها منبع حقیقت است.
// این هوک دیگر از collection عمومی «appData» نمی‌خواند (باگ قدیمی که
// داده همه کاربران را در یک سند مشترک قرار می‌داد و باعث تداخل داده می‌شد).
// اکنون داده در users/{uid}/{collection} ذخیره می‌شود و هر کاربر فقط
// داده خودش را می‌بیند. API سازگار با نسخه قبلی نگه داشته شده است:
//   [value, setValue, isLoading, { error, lastUpdated }]
// ============================================================

import { useState, useEffect, useCallback, useRef } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

// نگاشت کلیدهای قدیمی appData → نام collection کاربر-محور
const LEGACY_KEY_TO_COLLECTION: Record<string, string> = {
  "fx-customers": "customers",
  "fx-transactions": "transactions",
  "fx-hawalas": "hawalas",
  "hawalas": "hawalas",
  "fx-cash": "cash_entries",
  "cash-entries": "cash_entries",
  "db_wallets": "wallets",
  "db_kyc": "kyc",
  "db_markets": "markets",
  "db_withdrawals": "withdrawals",
};

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

export function useSyncedState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const valueRef = useRef<T>(initialValue);
  const lastUpdatedRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const userId = auth.currentUser?.uid ?? null;
  const collectionName = LEGACY_KEY_TO_COLLECTION[key] ?? key;

  useEffect(() => {
    isMountedRef.current = true;

    // 🔴 بدون احراز هویت هیچ داده‌ای خوانده نمی‌شود (Route Guard سطح داده)
    if (!userId) {
      setIsLoading(false);
      setError("unauthenticated");
      return;
    }

    const docRef = doc(db!, "users", userId, collectionName, "data");

    if (unsubscribeRef.current) {
      try { unsubscribeRef.current(); } catch {}
    }

    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (!isMountedRef.current) return;

        if (docSnap.exists()) {
          const data = docSnap.data() as any;
          const incomingTimestamp = data.lastUpdated || 0;
          if (incomingTimestamp > lastUpdatedRef.current) {
            lastUpdatedRef.current = incomingTimestamp;
            valueRef.current = data.value as T;
            setValue(data.value as T);
            setError(null);
          }
        } else if (lastUpdatedRef.current === 0) {
          // سند اولیه ساخته می‌شود (در صف آفلاین فایربیس اگر اینترنت نباشد)
          valueRef.current = initialValue;
          setValue(initialValue);
          setDoc(docRef, { value: initialValue, lastUpdated: Date.now(), owner: userId }, { merge: true }).catch(() => {});
        }

        setIsLoading(false);
      },
      (err) => {
        if (!isMountedRef.current) return;
        console.warn(`⚠️ [${collectionName}] Snapshot Error (احتمالاً آفلاین):`, err.message);
        setError(err?.message || "offline");
        setIsLoading(false);
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      isMountedRef.current = false;
      if (unsubscribeRef.current) {
        try { unsubscribeRef.current(); } catch {}
        unsubscribeRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, collectionName, userId]);

  const setSafeValue = useCallback(
    async (newValue: T | ((prev: T) => T)) => {
      const resolved =
        typeof newValue === "function"
          ? (newValue as (prev: T) => T)(valueRef.current)
          : newValue;

      valueRef.current = resolved;
      setValue(resolved);

      // 🔴 نوشتن فقط زیر سند کاربر خودی
      if (!userId) {
        console.error("🔴 بدون ورود به حساب، ذخیره‌سازی مجاز نیست.");
        return;
      }
      const ts = Date.now();
      lastUpdatedRef.current = ts;
      try {
        await setDoc(
          doc(db!, "users", userId, collectionName, "data"),
          removeUndefinedFields({ value: resolved, lastUpdated: ts, owner: userId }),
          { merge: true }
        );
      } catch (err: any) {
        // در حالت آفلاین، فایربیس نوشتار را در صف محلی SDK نگه می‌دارد و بعداً سینک می‌کند
        console.warn(`⚠️ [${collectionName}] خطا در ثبت تغییرات:`, err?.message);
      }
    },
    [collectionName, userId]
  );

  return [value, setSafeValue, isLoading, { error, lastUpdated: lastUpdatedRef.current }] as const;
}
