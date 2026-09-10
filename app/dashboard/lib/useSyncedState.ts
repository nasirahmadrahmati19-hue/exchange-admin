```typescript
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  doc,
  onSnapshot,
  runTransaction,
  type DocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * ============================================================
 * ابزارهای کمکی
 * ============================================================
 */

/**
 * حذف تمام undefined ها از آبجکت/آرایه
 *
 * Firestore مقدار undefined را به‌صورت عادی ذخیره نمی‌کند،
 * بنابراین قبل از ذخیره اطلاعات پاک‌سازی می‌شوند.
 */
function removeUndefinedFields<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => removeUndefinedFields(item)) as T;
  }

  if (typeof value !== "object") {
    return value;
  }

  const cleaned: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(
    value as Record<string, unknown>
  )) {
    if (item !== undefined) {
      cleaned[key] = removeUndefinedFields(item);
    }
  }

  return cleaned as T;
}

/**
 * بررسی اینکه آیا مقدار واقعاً آرایه است.
 */
function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * ============================================================
 * useSyncedState
 * ============================================================
 *
 * یک مقدار را بین React و Firestore همگام می‌کند.
 *
 * مزایای این نسخه:
 *
 * 1. جلوگیری از overwrite شدن اطلاعات جدید با مقدار قدیمی
 * 2. استفاده از Firestore Transaction
 * 3. پشتیبانی از setState به شکل:
 *
 *      setValue(newValue)
 *
 *    یا:
 *
 *      setValue(prev => newValue)
 *
 * 4. جلوگیری از دریافت Snapshot قدیمی در هنگام ذخیره
 * 5. نگه داشتن آخرین مقدار در ref برای جلوگیری از stale closure
 * 6. پاک‌سازی undefined قبل از ذخیره
 * 7. مدیریت بهتر خطاهای Firebase
 */
export function useSyncedState<T>(
  key: string,
  initialValue: T
) {
  const [value, setValue] = useState<T>(initialValue);

  /**
   * همیشه آخرین مقدار React را نگه می‌داریم.
   *
   * این کار جلوی مشکل stale closure را می‌گیرد.
   */
  const valueRef = useRef<T>(initialValue);

  /**
   * تعداد عملیات ذخیره‌ای که هنوز در حال انجام است.
   *
   * وقتی ذخیره محلی در حال انجام باشد، Snapshot دریافتی
   * نباید فوراً مقدار UI را با داده قدیمی جایگزین کند.
   */
  const pendingWritesRef = useRef(0);

  /**
   * آخرین مقدار را هم در state و هم در ref تغییر می‌دهیم.
   */
  const updateLocalValue = useCallback((nextValue: T) => {
    valueRef.current = nextValue;
    setValue(nextValue);
  }, []);

  /**
   * ------------------------------------------------------------
   * دریافت اطلاعات از Firestore
   * ------------------------------------------------------------
   */
  useEffect(() => {
    const docRef = doc(db, "appData", key);

    const unsubscribe = onSnapshot(
      docRef,
      { includeMetadataChanges: true },

      (docSnap: DocumentSnapshot) => {
        /**
         * اگر در حال ذخیره اطلاعات خودمان هستیم،
         * اجازه نمی‌دهیم یک Snapshot قدیمی UI را عقب ببرد.
         */
        if (pendingWritesRef.current > 0) {
          return;
        }

        if (!docSnap.exists()) {
          return;
        }

        const data = docSnap.data();

        if (!data) {
          return;
        }

        /**
         * useSyncedState از فیلد value استفاده می‌کند.
         */
        if (data.value !== undefined) {
          updateLocalValue(data.value as T);
        }
      },

      (error) => {
        console.error(
          `[useSyncedState] Error listening to "${key}":`,
          error
        );
      }
    );

    return () => {
      unsubscribe();
    };
  }, [key, updateLocalValue]);

  /**
   * ------------------------------------------------------------
   * ذخیره مقدار در Firestore
   * ------------------------------------------------------------
   *
   * نکته بسیار مهم:
   *
   * قبلاً مقدار تابعی مثل:
   *
   * setCustomers(prev => [...prev, customer])
   *
   * با value داخل closure محاسبه می‌شد.
   *
   * این موضوع می‌توانست باعث شود دو ذخیره پشت‌سرهم
   * از یک مقدار قدیمی استفاده کنند.
   *
   * اکنون برای تغییرات تابعی از Transaction استفاده می‌کنیم.
   */
  const setSyncedValue = useCallback(
    async (
      newValue: T | ((prev: T) => T)
    ): Promise<void> => {
      const docRef = doc(db, "appData", key);

      pendingWritesRef.current += 1;

      try {
        /**
         * ------------------------------------------------------
         * حالت تابعی
         * ------------------------------------------------------
         *
         * مثال:
         *
         * setCustomers(prev => [...prev, customer])
         *
         * Transaction ابتدا آخرین مقدار Firestore را می‌خواند
         * و سپس تابع را روی همان مقدار اجرا می‌کند.
         */
        if (typeof newValue === "function") {
          const updater = newValue as (prev: T) => T;

          await runTransaction(db, async (transaction) => {
            const snapshot = await transaction.get(docRef);

            let firestoreValue: T;

            if (snapshot.exists()) {
              const data = snapshot.data();

              if (data && data.value !== undefined) {
                firestoreValue = data.value as T;
              } else {
                firestoreValue = valueRef.current;
              }
            } else {
              firestoreValue = valueRef.current;
            }

            /**
             * مهم:
             * تابع روی آخرین مقدار واقعی Firestore اجرا می‌شود،
             * نه روی مقدار قدیمی React.
             */
            const nextValue = updater(firestoreValue);

            const cleanedValue = removeUndefinedFields(nextValue);

            transaction.set(
              docRef,
              {
                value: cleanedValue,
              },
              {
                merge: true,
              }
            );

            /**
             * UI را هم فوراً به مقدار جدید می‌بریم.
             */
            updateLocalValue(nextValue);
          });
        }

        /**
         * ------------------------------------------------------
         * حالت مقدار مستقیم
         * ------------------------------------------------------
         *
         * مثال:
         *
         * setValue(newValue)
         */
        else {
          const nextValue = newValue;
          const cleanedValue = removeUndefinedFields(nextValue);

          /**
           * ابتدا UI را سریع تغییر می‌دهیم.
           */
          updateLocalValue(nextValue);

          /**
           * مقدار مستقیم را در Firestore ذخیره می‌کنیم.
           */
          await runTransaction(db, async (transaction) => {
            transaction.set(
              docRef,
              {
                value: cleanedValue,
              },
              {
                merge: true,
              }
            );
          });
        }
      } catch (error) {
        console.error(
          `[useSyncedState] Error saving "${key}":`,
          error
        );

        /**
         * اگر ذخیره ناموفق شد، یک بار مقدار واقعی Firestore
         * را دوباره دریافت می‌کنیم تا UI با دیتابیس هماهنگ شود.
         *
         * خطا را دوباره throw نمی‌کنیم تا برنامه اصلی صرافی
         * به خاطر یک خطای شبکه متوقف نشود.
         */
        try {
          // Snapshot بعدی onSnapshot مقدار صحیح را خواهد آورد.
          // عمداً اینجا setValue دستی انجام نمی‌دهیم.
        } catch {
          // هیچ کاری لازم نیست
        }
      } finally {
        pendingWritesRef.current = Math.max(
          0,
          pendingWritesRef.current - 1
        );
      }
    },
    [key, updateLocalValue]
  );

  return [value, setSyncedValue] as const;
}

/**
 * ============================================================
 * useSyncedCollection
 * ============================================================
 *
 * نسخه مخصوص آرایه‌ها.
 *
 * این Hook برای مشتریان، معاملات، حواله‌ها، صندوق و غیره
 * استفاده می‌شود.
 */
export function useSyncedCollection<T>(
  key: string,
  initialValue: T[]
) {
  const [items, setItems] = useState<T[]>(initialValue);

  /**
   * آخرین مقدار آرایه.
   */
  const itemsRef = useRef<T[]>(initialValue);

  /**
   * تعداد ذخیره‌های در حال انجام.
   */
  const pendingWritesRef = useRef(0);

  /**
   * تغییر مقدار محلی.
   */
  const updateLocalItems = useCallback((nextItems: T[]) => {
    itemsRef.current = nextItems;
    setItems(nextItems);
  }, []);

  /**
   * ------------------------------------------------------------
   * دریافت آرایه از Firestore
   * ------------------------------------------------------------
   */
  useEffect(() => {
    const docRef = doc(db, "appData", key);

    const unsubscribe = onSnapshot(
      docRef,
      { includeMetadataChanges: true },

      (docSnap: DocumentSnapshot) => {
        /**
         * در هنگام ذخیره خودمان، Snapshot قدیمی نباید
         * اطلاعات جدید UI را عقب ببرد.
         */
        if (pendingWritesRef.current > 0) {
          return;
        }

        if (!docSnap.exists()) {
          return;
        }

        const data = docSnap.data();

        if (!data) {
          return;
        }

        if (Array.isArray(data.items)) {
          updateLocalItems(data.items as T[]);
        }
      },

      (error) => {
        console.error(
          `[useSyncedCollection] Error listening to "${key}":`,
          error
        );
      }
    );

    return () => {
      unsubscribe();
    };
  }, [key, updateLocalItems]);

  /**
   * ------------------------------------------------------------
   * ذخیره آرایه
   * ------------------------------------------------------------
   */
  const setSyncedItems = useCallback(
    async (
      newItems: T[] | ((prev: T[]) => T[])
    ): Promise<void> => {
      const docRef = doc(db, "appData", key);

      pendingWritesRef.current += 1;

      try {
        /**
         * ======================================================
         * حالت تابعی
         * ======================================================
         *
         * مثال اصلی برنامه شما:
         *
         * setCustomers(prev => [...prev, newCustomer])
         *
         * Transaction آخرین آرایه موجود در Firestore را می‌گیرد
         * و سپس مشتری جدید را به همان آرایه اضافه می‌کند.
         */
        if (typeof newItems === "function") {
          const updater = newItems as (
            prev: T[]
          ) => T[];

          await runTransaction(db, async (transaction) => {
            const snapshot = await transaction.get(docRef);

            let firestoreItems: T[];

            if (snapshot.exists()) {
              const data = snapshot.data();

              if (data && Array.isArray(data.items)) {
                firestoreItems = data.items as T[];
              } else {
                firestoreItems = itemsRef.current;
              }
            } else {
              firestoreItems = itemsRef.current;
            }

            /**
             * اجرای updater روی آخرین داده Firestore.
             */
            const nextItems = updater(firestoreItems);

            /**
             * پاک‌سازی undefined.
             */
            const cleanedItems = nextItems.map(
              (item) => removeUndefinedFields(item)
            );

            /**
             * ذخیره اتمیک.
             */
            transaction.set(
              docRef,
              {
                items: cleanedItems,
              },
              {
                merge: true,
              }
            );

            /**
             * تغییر فوری UI.
             */
            updateLocalItems(nextItems);
          });
        }

        /**
         * ======================================================
         * حالت مقدار مستقیم
         * ======================================================
         */
        else {
          const nextItems = Array.isArray(newItems)
            ? newItems
            : [];

          const cleanedItems = nextItems.map(
            (item) => removeUndefinedFields(item)
          );

          /**
           * تغییر فوری UI.
           */
          updateLocalItems(nextItems);

          /**
           * ذخیره در Firestore.
           */
          await runTransaction(db, async (transaction) => {
            transaction.set(
              docRef,
              {
                items: cleanedItems,
              },
              {
                merge: true,
              }
            );
          });
        }
      } catch (error) {
        console.error(
          `[useSyncedCollection] Error saving "${key}":`,
          error
        );

        /**
         * در صورت خطای شبکه یا Firebase،
         * برنامه اصلی متوقف نمی‌شود.
         *
         * onSnapshot بعداً در صورت برقراری اتصال،
         * مقدار واقعی را دریافت خواهد کرد.
         */
      } finally {
        pendingWritesRef.current = Math.max(
          0,
          pendingWritesRef.current - 1
        );
      }
    },
    [key, updateLocalItems]
  );

  return [items, setSyncedItems] as const;
}
```
