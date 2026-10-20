"use client";

// ============================================================
// lib/migrateFromLocalStorage.ts
// ✅ اسکریپت مهاجرت یک‌باره: داده‌های قدیمی کاربر از localStorage → Firestore
//
// پس از مهاجرت موفق، کلیدهای مربوطه از localStorage پاک می‌شوند تا
// 🔴 اصل «Firestore تنها منبع حقیقت» نقض نشود.
//
// توجه: توکن نشست Firebase Auth استثنای مجاز است و اصلاً با آن کار نداریم.
// تنظیمات ظاهری (تم روشن/تاریخ) داده کاربر محسوب نمی‌شود ولی طبق درخواست
// مرحله ۱، کلیدهای قدیمی تم هم پاک‌سازی می‌شوند.
// ============================================================

import { doc, setDoc, writeBatch, getDoc, collection } from "firebase/firestore";
import { db } from "./firebase";
import {
  USER_COLLECTIONS,
  SETTINGS_DOC_ID,
  COUNTER_RECEIPT_DOC_ID,
  OFFLINE_TRACKING_KEY_PREFIX,
  defaultSettingsSchema,
  type SettingsSchema,
} from "./schema";

const MIGRATION_FLAG = "fx_migration_v1_done"; // فقط یک فلگ وضعیت — داده کاربر نیست

// کلیدهای قدیمی localStorage که باید مهاجرت/پاک شوند
const LEGACY_KEYS = {
  customers: ["fx-customers"],
  transactions: ["fx-transactions"],
  hawalas: ["fx-hawalas", "hawalas"],
  cash: ["fx-cash", "cash-entries"],
  kyc: ["db_kyc"],
  wallets: ["db_wallets"],
  markets: ["db_markets"],
  withdrawals: ["db_withdrawals"],
  settings: ["fx-settings"],
  receiptCounter: ["db_receipt_counter"],
  rates: ["db_rates"],
  appSettings: ["db_settings"],
  theme: ["fx-theme", "hawala-theme"],
  lastTrackingCode: ["fx_last_tracking_code"],
};

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    // مقدار غیر JSON (مثل شمارنده ساده یا رشته خام)
    try { return localStorage.getItem(key) as unknown as T; } catch { return null; }
  }
}

function firstNonNull<T>(keys: string[]): { key: string; value: T } | null {
  for (const k of keys) {
    const v = readJSON<T>(k);
    if (v !== null && v !== undefined) return { key: k, value: v };
  }
  return null;
}

/** مهاجرت یک Array از آیتم‌های قدیمی به collection کاربر در Firestore */
async function migrateArray(
  uid: string,
  colName: string,
  items: any[]
): Promise<number> {
  if (!Array.isArray(items) || items.length === 0) return 0;
  const BATCH_LIMIT = 450;
  let migrated = 0;
  for (let i = 0; i < items.length; i += BATCH_LIMIT) {
    const chunk = items.slice(i, i + BATCH_LIMIT);
    if (!db) return migrated;
    const batch = writeBatch(db!);
    for (const item of chunk) {
      if (!item || typeof item !== "object") continue;
      const id = String(item.id ?? `${Date.now()}_${migrated}`);
      const cleaned: Record<string, any> = {};
      for (const [k, v] of Object.entries(item)) {
        if (v !== undefined && k !== "id") cleaned[k] = v;
      }
      const docRef = doc(db!, "users", uid, colName, id);
      batch.set(docRef, { ...cleaned, migratedAt: Date.now(), migratedFrom: "localStorage" }, { merge: true });
      migrated++;
    }
    await batch.commit();
  }
  return migrated;
}

export interface MigrationResult {
  ran: boolean;
  customers: number;
  transactions: number;
  hawalas: number;
  cashEntries: number;
  kyc: number;
  wallets: number;
  markets: number;
  withdrawals: number;
  settingsMigrated: boolean;
  countersMigrated: boolean;
  keysCleared: string[];
}

/**
 * اجرای یک‌باره مهاجرت برای کاربر فعلی.
 * اگر قبلاً اجرا شده باشد (فلگ)، کاری نمی‌کند.
 */
/** نتیجه خالی برای حالت SSR/بدون Firestore */
function EMPTY_RESULT(): MigrationResult {
  return {
    ran: false,
    customers: 0,
    transactions: 0,
    hawalas: 0,
    cashEntries: 0,
    kyc: 0,
    wallets: 0,
    markets: 0,
    withdrawals: 0,
    settingsMigrated: false,
    countersMigrated: false,
    keysCleared: [],
  };
}

export async function migrateLocalDataToFirestore(uid: string): Promise<MigrationResult> {
  if (!db) return EMPTY_RESULT();
  const result: MigrationResult = {
    ran: false,
    customers: 0,
    transactions: 0,
    hawalas: 0,
    cashEntries: 0,
    kyc: 0,
    wallets: 0,
    markets: 0,
    withdrawals: 0,
    settingsMigrated: false,
    countersMigrated: false,
    keysCleared: [],
  };

  if (typeof window === "undefined") return result;

  // ⚠️ هرگز قبل از لاگین صدا زده نشود؛ در Layout بعد از آماده‌شدن user فراخوانی می‌شود.
  try {
    if (localStorage.getItem(MIGRATION_FLAG) === uid) {
      return result; // این کاربر قبلاً مهاجرت کرده است
    }
    result.ran = true;

    // ۱) مجموعه‌های آرایه‌ای
    const cust = firstNonNull<any[]>(LEGACY_KEYS.customers);
    if (cust) result.customers = await migrateArray(uid, USER_COLLECTIONS.customers, cust.value);

    const tx = firstNonNull<any[]>(LEGACY_KEYS.transactions);
    if (tx) result.transactions = await migrateArray(uid, USER_COLLECTIONS.transactions, tx.value);

    const hw = firstNonNull<any[]>(LEGACY_KEYS.hawalas);
    if (hw) result.hawalas = await migrateArray(uid, USER_COLLECTIONS.hawalas, hw.value);

    const cash = firstNonNull<any[]>(LEGACY_KEYS.cash);
    if (cash) result.cashEntries = await migrateArray(uid, USER_COLLECTIONS.cash_entries, cash.value);

    const kyc = firstNonNull<any[]>(LEGACY_KEYS.kyc);
    if (kyc) result.kyc = await migrateArray(uid, USER_COLLECTIONS.kyc, kyc.value);

    const mkts = firstNonNull<any[]>(LEGACY_KEYS.markets);
    if (mkts) result.markets = await migrateArray(uid, USER_COLLECTIONS.markets, mkts.value);

    const wd = firstNonNull<any[]>(LEGACY_KEYS.withdrawals);
    if (wd) result.withdrawals = await migrateArray(uid, USER_COLLECTIONS.withdrawals, wd.value);

    // ۲) کیف پول‌ها: ممکن است در appData قدیمی باشند نه localStorage
    const wal = firstNonNull<any[]>(LEGACY_KEYS.wallets);
    if (wal) {
      result.wallets = await migrateArray(uid, USER_COLLECTIONS.wallets, wal.value);
    } else {
      try {
        const legacyAppData = await getDoc(doc(db!, "appData", "db_wallets"));
        if (legacyAppData.exists()) {
          const val = (legacyAppData.data() as any)?.value;
          if (Array.isArray(val) && val.length > 0) {
            result.wallets = await migrateArray(uid, USER_COLLECTIONS.wallets, val);
          }
        }
      } catch {}
    }

    // ۳) تنظیمات: fx-settings (localStorage) → users/{uid}/settings/user_settings
    //    فقط اگر سند تنظیمات در Firestore هنوز وجود ندارد (Firestore اولویت دارد).
    try {
      const settingsDocRef = doc(db, "users", uid, USER_COLLECTIONS.settings, SETTINGS_DOC_ID);
      const existing = await getDoc(settingsDocRef);
      const legacySettings = firstNonNull<Partial<SettingsSchema>>(LEGACY_KEYS.settings);
      if (!existing.exists() && legacySettings && typeof legacySettings.value === "object") {
        const merged: SettingsSchema = {
          ...defaultSettingsSchema,
          ...legacySettings.value,
          telegram: { ...defaultSettingsSchema.telegram, ...(legacySettings.value as any).telegram },
        };
        await setDoc(settingsDocRef, merged as any);
        result.settingsMigrated = true;
      }
    } catch (e) {
      console.warn("⚠️ مهاجرت تنظیمات انجام نشد:", e);
    }

    // ۴) شمارنده رسید و شمارنده کد پیگیری آفلاین → users/{uid}/counters/*
    try {
      const rc = firstNonNull<string>(LEGACY_KEYS.receiptCounter);
      if (rc) {
        const n = Number(rc.value);
        if (Number.isFinite(n)) {
          await setDoc(
            doc(db, "users", uid, USER_COLLECTIONS.counters, COUNTER_RECEIPT_DOC_ID),
            { last: n, updatedAt: Date.now() },
            { merge: true }
          );
          result.countersMigrated = true;
        }
      }
      // شمارنده‌های آفلاین سالانه
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("fx_offline_counter_")) {
          const year = k.replace("fx_offline_counter_", "");
          const n = Number(localStorage.getItem(k));
          if (Number.isFinite(n)) {
            await setDoc(
              doc(db, "users", uid, USER_COLLECTIONS.counters, `${OFFLINE_TRACKING_KEY_PREFIX}${year}`),
              { last: n, updatedAt: Date.now() },
              { merge: true }
            );
            result.countersMigrated = true;
          }
        }
      }
    } catch (e) {
      console.warn("⚠️ مهاجرت شمارنده‌ها انجام نشد:", e);
    }

    // ۵) نرخ‌ها/تنظیمات قدیمی appData-محور (db_rates / db_settings) → users/{uid}/rates/main
    try {
      const ratesLegacy = firstNonNull<any>(LEGACY_KEYS.rates);
      const appSetLegacy = firstNonNull<any>(LEGACY_KEYS.appSettings);
      if (ratesLegacy || appSetLegacy) {
        const rateVal = (ratesLegacy?.value || {}) as any;
        const setVal = (appSetLegacy?.value || {}) as any;
        await setDoc(
          doc(db, "users", uid, USER_COLLECTIONS.rates, "main"),
          {
            usd: String(rateVal.usd ?? "70.5"),
            eur: String(rateVal.eur ?? "76"),
            pkr: String(rateVal.pkr ?? "25"),
            toman: String(rateVal.toman ?? "0.64"),
            commission: String(setVal.commission ?? "0.5"),
            siteName: String(setVal.siteName ?? "برادران نورزاد"),
            updatedAt: Date.now(),
          },
          { merge: true }
        );
      }
    } catch {}

    // ۶) ✅ پاک‌سازی localStorage — فقط بعد از مهاجرت موفق
    const allKeys = [
      ...LEGACY_KEYS.customers,
      ...LEGACY_KEYS.transactions,
      ...LEGACY_KEYS.hawalas,
      ...LEGACY_KEYS.cash,
      ...LEGACY_KEYS.kyc,
      ...LEGACY_KEYS.wallets,
      ...LEGACY_KEYS.markets,
      ...LEGACY_KEYS.withdrawals,
      ...LEGACY_KEYS.settings,
      ...LEGACY_KEYS.receiptCounter,
      ...LEGACY_KEYS.rates,
      ...LEGACY_KEYS.appSettings,
      ...LEGACY_KEYS.theme,
      ...LEGACY_KEYS.lastTrackingCode,
    ];
    // کلیدهای شمارنده آفلاین سالانه
    const offlineKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("fx_offline_counter_"))) offlineKeys.push(k);
    }
    for (const k of [...allKeys, ...offlineKeys]) {
      try {
        localStorage.removeItem(k);
        result.keysCleared.push(k);
      } catch {}
    }

    // فلگ وضعیت مهاجرت (داده کاربر نیست — صرفاً per-device flag)
    try { localStorage.setItem(MIGRATION_FLAG, uid); } catch {}

    if (result.customers || result.transactions || result.hawalas || result.cashEntries ||
        result.kyc || result.wallets || result.markets || result.withdrawals ||
        result.settingsMigrated || result.countersMigrated) {
      console.log(
        `✅ مهاجرت کامل شد → مشتریان:${result.customers} معاملات:${result.transactions} حواله‌ها:${result.hawalas} صندوق:${result.cashEntries} KYC:${result.kyc} کیف‌پول:${result.wallets} بازار:${result.markets} برداشت:${result.withdrawals}`,
        "| پاک‌شده از localStorage:", result.keysCleared.join(", ")
      );
    }
  } catch (err) {
    // در خطا (مثلاً آفلاین بودن شدید) فلگ ست نمی‌شود تا دفعه بعد دوباره تلاش شود
    console.error("🔴 خطا در مهاجرت داده‌های محلی:", err);
  }

  return result;
}
