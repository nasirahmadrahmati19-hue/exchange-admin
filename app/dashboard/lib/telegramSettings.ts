"use client";

// ============================================================
// lib/telegramSettings.ts
// 🔴 اصل معماری: Firestore تنها منبع حقیقت است.
// جایگزین تابع قدیمی getTelegramSettings() که از localStorage
// (کلید fx-settings) می‌خواند. اکنون از کش در-حافظه‌ای سند
// users/{uid}/settings/user_settings خوانده می‌شود.
// هیچ داده‌ای روی دیسک/مرورگر ذخیره نمی‌شود.
// ============================================================

import { defaultSettingsSchema } from "./schema";
import type { TelegramSettingsSchema } from "./schema";
import { getSettingsCache } from "./firestoreSettings";

/** تنظیمات تلگرام کاربر لاگین‌شده — فقط از Firestore (کش مموری) */
export function getTelegramSettings(): TelegramSettingsSchema {
  const cached = getSettingsCache();
  return cached?.telegram ?? defaultSettingsSchema.telegram;
}
