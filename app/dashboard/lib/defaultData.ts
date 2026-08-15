// ============================================================
// app/dashboard/lib/defaultData.ts
// فایل مشترک داده‌های پیش‌فرض برای همه تب‌ها
// نسخه اصلاح‌شده: حل مشکل بازگشت مشتریان پیش‌فرض
// ============================================================

export type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";

export const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];

export const labels: Record<Currency, string> = {
  AFN: "افغانی",
  USD: "دالر",
  EUR: "یورو",
  IRR: "تومان",
  PKR: "کلدار",
};

export const CUSTOMERS_KEY = "fx-customers";
export const TRANSACTIONS_KEY = "fx-transactions";
export const HAWALAS_KEY = "hawalas";
export const CASH_KEY = "cash-entries";

export interface CustomerBase {
  id: string;
  name: string;
  phone?: string;
  tazkira?: string;
  address?: string;
  note?: string;
  telegram?: string;
  registeredAt: string;
  balances: Record<Currency, number>;
}

export const defaultCustomers: CustomerBase[] = [
  {
    id: "1",
    name: "احمد رحیمی",
    phone: "0700123456",
    tazkira: "1400-001-001",
    address: "هرات، گلران",
    note: "مشتری ویژه",
    telegram: "@ahmad_rahimi",
    registeredAt: "2025-01-15T10:00:00Z",
    balances: { AFN: 500000, USD: 10000, EUR: 0, IRR: 0, PKR: 0 },
  },
  {
    id: "2",
    name: "محمد ظاهر",
    phone: "0700654321",
    tazkira: "1400-002-002",
    address: "هرات، انجیل",
    note: "",
    telegram: "@mohammad_zahir",
    registeredAt: "2025-02-20T14:30:00Z",
    balances: { AFN: 200000, USD: 5000, EUR: 0, IRR: 0, PKR: 0 },
  },
  {
    id: "3",
    name: "فاطمه حسینی",
    phone: "0700789123",
    tazkira: "1400-003-003",
    address: "هرات، مرکز",
    note: "معاملات عمده",
    telegram: "@fatema_hosseini",
    registeredAt: "2025-03-05T09:15:00Z",
    balances: { AFN: 0, USD: 0, EUR: 0, IRR: 50000000, PKR: 0 },
  },
];

// ============================================================
// تابع بارگذاری مشتریان (اصلاح‌شده)
// ============================================================
export const loadCustomersShared = (): CustomerBase[] => {
  // در سمت سرور (SSR)، default برگردان
  if (typeof window === "undefined") return defaultCustomers;

  try {
    const raw = localStorage.getItem(CUSTOMERS_KEY);

    // ✅ اگر کلید اصلاً وجود ندارد (اولین بار)، default برگردان
    if (raw === null) return defaultCustomers;

    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      // ✅ اگر آرایه خالی است (کاربر همه مشتریان را حذف کرده)
      // آرایه خالی برگردان، NOT defaultCustomers
      if (parsed.length === 0) return [];

      // ✅ اگر داده معتبر دارد، داده‌ها را برگردان
      if (parsed.length > 0 && parsed[0]?.id && parsed[0]?.name) {
        return parsed.map((c: any) => ({
          id: c.id || "",
          name: c.name || "",
          phone: c.phone || "",
          tazkira: c.tazkira || "",
          address: c.address || "",
          note: c.note || "",
          telegram: c.telegram || "",
          registeredAt: c.registeredAt || new Date().toISOString(),
          balances: {
            AFN: Number(c.balances?.AFN || 0) || 0,
            USD: Number(c.balances?.USD || 0) || 0,
            EUR: Number(c.balances?.EUR || 0) || 0,
            IRR: Number(c.balances?.IRR || 0) || 0,
            PKR: Number(c.balances?.PKR || 0) || 0,
          },
        }));
      }
    }

    // اگر داده نامعتبر بود، default برگردان
    return defaultCustomers;
  } catch {
    return defaultCustomers;
  }
};

// ============================================================
// تابع بارگذاری تراکنش‌ها
// ============================================================
export const loadTransactionsShared = (): any[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TRANSACTIONS_KEY);
    if (raw === null) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// ============================================================
// تابع بارگذاری حواله‌ها
// ============================================================
export const loadHawalasShared = (): any[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HAWALAS_KEY);
    if (raw === null) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// ============================================================
// تابع بارگذاری اسناد صندوق
// ============================================================
export const loadCashEntriesShared = (): any[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CASH_KEY);
    if (raw === null) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
