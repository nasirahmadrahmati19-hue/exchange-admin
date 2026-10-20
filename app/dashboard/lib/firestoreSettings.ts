"use client";

// ============================================================
// lib/firestoreSettings.ts
// 🔴 Firestore تنها منبع حقیقت تنظیمات است (جایگزین fx-settings در localStorage).
// این ماژول یک کش در-حافظه‌ای (نه دیسک!) از سند
// users/{uid}/settings/user_settings نگه می‌دارد تا توابع همگام
// (sync) مثل getTelegramSettings در صفحات مختلف سریع کار کنند.
// کش در حافظه با رفرش صفحه پاک می‌شود و هیچ داده‌ای در مرورگر ذخیره نمی‌کند.
// ============================================================

import {
  doc,
  onSnapshot,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import {
  USER_COLLECTIONS,
  SETTINGS_DOC_ID,
  defaultSettingsSchema,
  type SettingsSchema,
  type TelegramSettingsSchema,
} from "./schema";

// کش سراسری در مموری (موقت، فقط برای همان Session — روی دیسک/مرورگر چیزی ذخیره نمی‌شود)
let cachedSettings: SettingsSchema | null = null;
let settingsUnsub: (() => void) | null = null;
let subscribedUid: string | null = null;

export function getSettingsCache(): SettingsSchema | null {
  return cachedSettings;
}

/**
 * اشتراک روی سند تنظیمات کاربر فعلی.
 * باید یک‌بار بعد از لاگین (در DashboardLayout) صدا زده شود.
 */
export function subscribeUserSettings(): () => void {
  if (!db) return () => {};
  const uid = auth.currentUser?.uid;
  if (!uid) return () => {};

  if (subscribedUid === uid && settingsUnsub) {
    return settingsUnsub; // قبلاً مشترک شده‌ایم
  }

  // تغییر کاربر: اشتراک قبلی را ببند
  if (settingsUnsub) {
    try { settingsUnsub(); } catch {}
    settingsUnsub = null;
  }
  cachedSettings = null;
  subscribedUid = uid;

  const docRef = doc(db!, "users", uid, USER_COLLECTIONS.settings, SETTINGS_DOC_ID);
  settingsUnsub = onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        cachedSettings = {
          ...defaultSettingsSchema,
          ...data,
          telegram: { ...defaultSettingsSchema.telegram, ...(data.telegram || {}) },
        };
      } else {
        cachedSettings = { ...defaultSettingsSchema };
      }
    },
    (err) => {
      console.warn("⚠️ خطا در خواندن تنظیمات از Firestore:", err?.message);
    }
  );

  return () => {
    try { settingsUnsub?.(); } catch {}
    settingsUnsub = null;
    subscribedUid = null;
    cachedSettings = null;
  };
}

/** ذخیره (مرج) تنظیمات در Firestore — تنها مسیر نوشتن تنظیمات */
export async function saveUserSettings(partial: Partial<SettingsSchema>): Promise<void> {
  if (!db) throw new Error("Firestore is only available on the client");
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("کاربر وارد نشده است — امکان ذخیره تنظیمات نیست.");
  const docRef = doc(db!, "users", uid, USER_COLLECTIONS.settings, SETTINGS_DOC_ID);
  await setDoc(docRef, partial as any, { merge: true });
  // به‌روزرسانی آنی کش (onSnapshot هم بعداً تأیید می‌کند)
  cachedSettings = {
    ...(cachedSettings || defaultSettingsSchema),
    ...partial,
    telegram: { ...(cachedSettings?.telegram || defaultSettingsSchema.telegram), ...(partial.telegram || {}) },
  };
}

/** خواندن یک‌باره تنظیمات (برای محیط‌هایی که اشتراک فعال ندارند) */
export async function fetchUserSettingsOnce(): Promise<SettingsSchema> {
  if (!db) return defaultSettingsSchema;
  const uid = auth.currentUser?.uid;
  if (!uid) return { ...defaultSettingsSchema };
  try {
    const snap = await getDoc(doc(db!, "users", uid, USER_COLLECTIONS.settings, SETTINGS_DOC_ID));
    if (!snap.exists()) return { ...defaultSettingsSchema };
    const data = snap.data() as any;
    return {
      ...defaultSettingsSchema,
      ...data,
      telegram: { ...defaultSettingsSchema.telegram, ...(data.telegram || {}) },
    };
  } catch {
    return { ...defaultSettingsSchema };
  }
}

/**
 * ✅ جایگزین تمام تابع‌های getTelegramSettings محلی که از localStorage می‌خواندند.
 * فقط از کش در-حافظه‌ای (که از Firestore پر شده) می‌خواند.
 */
export function getTelegramSettingsFromStore(): TelegramSettingsSchema {
  return cachedSettings?.telegram ?? defaultSettingsSchema.telegram;
}
