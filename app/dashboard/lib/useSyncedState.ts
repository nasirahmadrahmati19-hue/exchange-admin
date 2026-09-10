"use client";

import { useState, useEffect } from "react";
import {
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  collection,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * حذف فیلدهای undefined از آبجکت
 * این تابع بسیار مهم است چون Firestore نمی‌تواند مقادیر undefined را ذخیره کند
 */
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

/**
 * هوک برای sync کردن یک state ساده (یک آبجکت یا مقدار واحد) با Firestore
 * مناسب برای تنظیمات، پروفایل، یا هر مقدار غیرآرایه‌ای
 *
 * @param key - نام document در Firestore (داخل کالکشن appData)
 * @param initialValue - مقدار اولیه
 */
export function useSyncedState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);

  useEffect(() => {
    const docRef = doc(db, "appData", key);

    // گوش دادن به تغییرات Firestore
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && data.value !== undefined) {
            setValue(data.value);
          }
        }
      },
      (error) => {
        console.error(Error listening to ${key}:, error);
      }
    );

    return () => unsubscribe();
  }, [key]);

  // ذخیره در Firestore
  const setSyncedValue = async (newValue: T | ((prev: T) => T)) => {
    const resolvedValue =
      typeof newValue === "function"
        ? (newValue as (prev: T) => T)(value)
        : newValue;

    setValue(resolvedValue);

    try {
      const docRef = doc(db, "appData", key);
      const cleanedValue = removeUndefinedFields(resolvedValue);
      await setDoc(docRef, { value: cleanedValue }, { merge: true });
    } catch (error) {
      console.error(Error saving ${key}:, error);
    }
  };

  return [value, setSyncedValue] as const;
}

/**
 * هوک برای sync کردن یک لیست (collection) با Firestore
 *
 * ⚠️ نکته مهم درباره‌ی رفع باگ «پاک شدن دیتا بعد از چند لحظه»:
 * در نسخه‌ی قبلی، کل آرایه در یک فیلد از یک document ذخیره می‌شد.
 * اگر این هوک در چند کامپوننت مختلف صدا زده می‌شد، یا هر رندری با
 * state قدیمی (stale) دوباره ذخیره می‌کرد، کل آرایه Overwrite می‌شد
 * و آیتم‌های تازه‌اضافه‌شده از بین می‌رفتند.
 *
 * در این نسخه، هر آیتم (مثلاً هر مشتری) در یک document مجزا در یک
 * subcollection ذخیره می‌شود. بنابراین اضافه/ویرایش/حذف یک آیتم
 * هرگز روی آیتم‌های دیگر تاثیر نمی‌گذارد، حتی اگر چند نمونه از این
 * هوک به‌طور همزمان در جاهای مختلف اپلیکیشن استفاده شوند.
 *
 * نیازمندی: هر آیتم باید یک فیلد id از نوع string داشته باشد.
 *
 * @param key - نام مجموعه (مثلاً "customers")
 * @param initialValue - آرایه اولیه (پیش از دریافت داده از Firestore)
 */
export function useSyncedCollection<T extends { id: string }>(
  key: string,
  initialValue: T[]
) {
  const [items, setItems] = useState<T[]>(initialValue);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const colRef = collection(db, "appData", key, "items");

    const unsubscribe = onSnapshot(
      colRef,
      (snap) => {
        const docs = snap.docs.map((d) => d.data() as T);
        setItems(docs);
        setIsLoading(false);
      },
      (error) => {
        console.error(Error listening to collection ${key}:, error);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [key]);

  /**
   * اضافه کردن یک آیتم جدید یا به‌روزرسانی یک آیتم موجود
   * (بر اساس item.id تشخیص می‌دهد)
   */
  const addOrUpdateItem = async (item: T) => {
    if (!item.id) {
      console.error("Item must have an id field");
      return;
    }
    try {
      const itemRef = doc(db, "appData", key, "items", item.id);
      const cleanedItem = removeUndefinedFields(item);
      await setDoc(itemRef, cleanedItem, { merge: true });
    } catch (error) {
      console.error(Error saving item in ${key}:, error);
    }
  };

  /**
   * حذف یک آیتم بر اساس id
   */
  const removeItem = async (id: string) => {
    try {
      const itemRef = doc(db, "appData", key, "items", id);
      await deleteDoc(itemRef);
    } catch (error) {
      console.error(Error deleting item in ${key}:, error);
    }
  };

  /**
   * جایگزین کردن کل لیست (فقط زمانی استفاده کنید که واقعاً نیاز
   * دارید همه چیز را یک‌جا بازنویسی کنید - مثلاً برای import اولیه)
   * توجه: این تابع به همان مشکل قدیمی race condition دچار می‌شود
   * اگر بی‌دلیل زیاد صدا زده شود، پس با احتیاط استفاده کنید.
   */
  const replaceAllItems = async (newItems: T[]) => {
    try {
      await Promise.all(
        newItems.map((item) => {
          const itemRef = doc(db, "appData", key, "items", item.id);
          return setDoc(itemRef, removeUndefinedFields(item), {
            merge: true,
          });
        })
      );
    } catch (error) {
      console.error(Error replacing items in ${key}:, error);
    }
  };

  return {
    items,
    isLoading,
    addOrUpdateItem,
    removeItem,
    replaceAllItems,
  };
}
