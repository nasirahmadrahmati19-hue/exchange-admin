// ============================================================
// lib/schema.ts
// 🔴 اصل معماری: Firestore تنها منبع حقیقت (Single Source of Truth) است.
// هیچ داده مالی، هویتی (KYC)، تراکنشی یا تنظیماتی نباید در
// localStorage / sessionStorage / IndexedDB ذخیره شود.
// تنها استثنا: توکن نشست Firebase Auth (که خودش SDK مدیریت می‌کند).
//
// این فایل اسکیماهای تایپ‌شده و ثابت‌های Collectionهای فایروستور را تعریف می‌کند.
// ============================================================

import type { Timestamp } from "firebase/firestore";

// ------------------------------------------------------------
// نام Collectionها (سلسله‌مراتبی زیر users/{uid} برای جداسازی کامل داده هر کاربر)
// ------------------------------------------------------------
export const FS_USERS = "users" as const;

/** Collectionهای کاربر-محور: users/{uid}/{collection} */
export const USER_COLLECTIONS = {
  customers: "customers",
  transactions: "transactions",
  hawalas: "hawalas",
  cash_entries: "cash_entries",
  settings: "settings", // تنظیمات صرافی/تلگرام هر کاربر (جایگزین fx-settings در localStorage)
  kyc: "kyc", // درخواست‌های احراز هویت (جایگزین db_kyc)
  wallets: "wallets", // کیف پول‌ها (جایگزین appData/db_wallets و localStorage)
  markets: "markets", // بازارها (جایگزین db_markets)
  withdrawals: "withdrawals", // درخواست‌های برداشت (جایگزین db_withdrawals)
  rates: "rates", // نرخ ارز و کمیسیون (جایگزین db_rates / db_settings)
  counters: "counters", // شمارنده رسید و کد پیگیری آفلاین (جایگزین شمارنده‌های localStorage)
} as const;

export type UserCollectionName = (typeof USER_COLLECTIONS)[keyof typeof USER_COLLECTIONS];

/** Collection سراسری */
export const FS_SYSTEM_COUNTERS = "system_counters"; // شمارنده جهانی کد پیگیری (TR-year)
export const FS_APP_SETTINGS = "app_settings"; // سند global_settings (تنظیمات مشترک تیمی)
export const FS_AUTHORIZED_USERS = "authorized_users"; // کاربران مجاز (مدیریت دسترسی)

// کلید سند تنظیمات هر کاربر در collection کاربر
export const SETTINGS_DOC_ID = "user_settings";

// کلیدهای سند counters
export const COUNTER_RECEIPT_DOC_ID = "receipt"; // { last: number }
export const OFFLINE_TRACKING_KEY_PREFIX = "offline_tracking_"; // offline_tracking_{shamsiYear} -> { last: number }

// ------------------------------------------------------------
// اسکیماها
// ------------------------------------------------------------

export interface FirestoreDocumentBase {
  id?: string;
  createdAt?: number | string | Timestamp;
  updatedAt?: number | string | Timestamp;
}

// ===== تنظیمات (جایگزین fx-settings در localStorage) =====
export interface TelegramSettingsSchema {
  enabled: boolean;
  botToken: string;
  chatId: string;
  chatIds?: string[];
  notifyNewHawala: boolean;
  notifySettlement: boolean;
  notifyVoid: boolean;
  notifyExchange: boolean;
  notifyCash?: boolean;
}

export interface SettingsSchema extends FirestoreDocumentBase {
  email: string;
  supportEmail: string;
  language: "dari" | "pashto" | "english";
  teamName: string;
  teamAddress: string;
  teamPhone: string;
  telegram: TelegramSettingsSchema;
}

export const defaultSettingsSchema: SettingsSchema = {
  email: "",
  supportEmail: "",
  language: "dari",
  teamName: "صرافی برادران نورزاد",
  teamAddress: "هرات، افغانستان",
  teamPhone: "",
  telegram: {
    enabled: false,
    botToken: "",
    chatId: "",
    notifyNewHawala: true,
    notifySettlement: true,
    notifyVoid: true,
    notifyExchange: true,
    notifyCash: true,
  },
};

// ===== مشتری =====
export interface CustomerSchema extends FirestoreDocumentBase {
  id: string;
  name: string;
  phone?: string;
  tazkira?: string;
  address?: string;
  note?: string;
  telegram?: string;
  telegramChatId?: string;
  registeredAt: string;
  balances: Record<string, number>;
}

// ===== KYC (جایگزین db_kyc در localStorage) =====
export interface KycRequestSchema extends FirestoreDocumentBase {
  user: string;
  doc: string;
  date: string;
  status: string; // "در انتظار" | "تأیید شده" | "رد شده"
}

// ===== کیف پول (جایگزین appData/db_wallets) =====
export interface WalletSchema extends FirestoreDocumentBase {
  currency: string;
  balance: string;
  address: string;
}

// ===== بازار (جایگزین db_markets) =====
export interface MarketSchema extends FirestoreDocumentBase {
  pair: string;
  price: string;
  change: string;
}

// ===== برداشت (جایگزین db_withdrawals) =====
export interface WithdrawalSchema extends FirestoreDocumentBase {
  user: string;
  amount: string;
  currency: string;
  date: string;
  status: string;
}

// ===== نرخ ارز و کمیسیون (جایگزین db_rates / db_settings) =====
export interface RatesSchema extends FirestoreDocumentBase {
  usd: string;
  eur: string;
  pkr: string;
  toman: string;
  commission: string;
  siteName: string;
}

// ===== شمارنده‌ها (جایگزین db_receipt_counter و fx_offline_counter_* ) =====
export interface CounterDoc {
  last: number;
  updatedAt?: number;
}
