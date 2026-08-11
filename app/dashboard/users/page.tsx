"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";

type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";
type CustomerStatus = "active" | "inactive";

type Customer = {
  id: string;
  name: string;
  phone?: string;
  tazkira?: string;
  address?: string;
  note?: string;
  status: CustomerStatus;
  registeredAt: string;
  balances: Record<Currency, number>;
};

type TxType = "exchange" | "transfer" | "convert" | "hawala" | "deposit" | "withdraw" | "fee" | "correction";

type LedgerEntry = {
  id: string;
  date: string;
  customerId: string;
  type: TxType;
  description: string;
  currency: Currency;
  amount: number;
  direction: "in" | "out";
  balanceAfter: number;
  referenceId?: string;
  referenceNumber?: string;
};

type FormState = {
  name: string;
  tazkira: string;
  phone: string;
  address: string;
  note: string;
  status: CustomerStatus;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const labels: Record<Currency, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };
const currencyColors: Record<Currency, { light: string; dark: string; gradient: string }> = {
  AFN: { light: "text-emerald-700", dark: "text-emerald-300", gradient: "from-emerald-500 to-teal-400" },
  USD: { light: "text-sky-700", dark: "text-sky-300", gradient: "from-sky-500 to-cyan-400" },
  EUR: { light: "text-blue-700", dark: "text-blue-300", gradient: "from-blue-600 to-blue-400" },
  IRR: { light: "text-amber-700", dark: "text-amber-300", gradient: "from-amber-500 to-orange-400" },
  PKR: { light: "text-rose-700", dark: "text-rose-300", gradient: "from-rose-500 to-pink-400" },
};

const txLabels: Record<TxType, string> = {
  exchange: "تبادل ارز", transfer: "انتقال", convert: "تبدیل ارز", hawala: "حواله",
  deposit: "واریز", withdraw: "برداشت", fee: "کارمزد", correction: "اصلاح",
};

const txColors: Record<TxType, { light: string; dark: string }> = {
  exchange: { light: "bg-sky-100 text-sky-700", dark: "bg-sky-400/15 text-sky-300" },
  transfer: { light: "bg-violet-100 text-violet-700", dark: "bg-violet-400/15 text-violet-300" },
  convert: { light: "bg-purple-100 text-purple-700", dark: "bg-purple-400/15 text-purple-300" },
  hawala: { light: "bg-blue-100 text-blue-700", dark: "bg-blue-400/15 text-blue-300" },
  deposit: { light: "bg-emerald-100 text-emerald-700", dark: "bg-emerald-400/15 text-emerald-300" },
  withdraw: { light: "bg-rose-100 text-rose-700", dark: "bg-rose-400/15 text-rose-300" },
  fee: { light: "bg-amber-100 text-amber-700", dark: "bg-amber-400/15 text-amber-300" },
  correction: { light: "bg-orange-100 text-orange-700", dark: "bg-orange-400/15 text-orange-300" },
};

const CUSTOMERS_KEY = "fx-customers";
const TRANSACTIONS_KEY = "fx-transactions";
const HAWALAS_KEY = "hawalas";

const defaultCustomers: Customer[] = [
  { id: "1", name: "احمد رحیمی", phone: "0700123456", tazkira: "1400-001-001", address: "هرات، گلران", note: "مشتری ویژه", status: "active", registeredAt: "2025-01-15T10:00:00Z", balances: { AFN: 500000, USD: 10000, EUR: 0, IRR: 0, PKR: 0 } },
  { id: "2", name: "محمد ظاهر", phone: "0700654321", tazkira: "1400-002-002", address: "هرات، انجیل", note: "", status: "active", registeredAt: "2025-02-20T14:30:00Z", balances: { AFN: 200000, USD: 5000, EUR: 0, IRR: 0, PKR: 0 } },
  { id: "3", name: "فاطمه حسینی", phone: "0700789123", tazkira: "1400-003-003", address: "هرات، مرکز", note: "معاملات عمده", status: "active", registeredAt: "2025-03-05T09:15:00Z", balances: { AFN: 0, USD: 0, EUR: 0, IRR: 50000000, PKR: 0 } },
];

// ✅ UUID ساز ایمن با fallback
const generateId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try { return crypto.randomUUID(); } catch {}
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// ✅ توابع کمکی برای دسترسی امن
const isCurrency = (v: any): v is Currency => typeof v === "string" && (currencies as string[]).includes(v);
const getCurrencyLabel = (cur: any): string => isCurrency(cur) ? labels[cur] : "—";

const normalizeDigits = (value: string) => {
  const pd = "۰۱۲۳۴۵۶۷۸۹"; const ad = "٠١٢٣٤٥٦٧٨٩";
  return String(value || "").replace(/[۰-۹]/g, d => String(pd.indexOf(d))).replace(/[٠-٩]/g, d => String(ad.indexOf(d)));
};

const fmt = (n: number) => (Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0");

function shamsiParts(d: Date) {
  try {
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
    const get = (type: string) => parts.find((p) => p.type === type)?.value || "0";
    return { year: get("year"), month: get("month"), day: get("day") };
  } catch {
    return { year: "0", month: "0", day: "0" };
  }
}

function formatDateTime(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const s = shamsiParts(d);
  return `${s.year}/${s.month}/${s.day} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatShamsiDate(d: Date) {
  const s = shamsiParts(d);
  return `${s.year}/${s.month}/${s.day}`;
}

function dateLabel(s: string) {
  try { const d = new Date(s); return Number.isNaN(d.getTime()) ? "-" : formatDateTime(d); } catch { return "-"; }
}

function shortDateLabel(s: string) {
  try { const d = new Date(s); return Number.isNaN(d.getTime()) ? "-" : formatShamsiDate(d); } catch { return "-"; }
}

function timeLabel(s: string) {
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return "-";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return "-"; }
}

const emptyForm: FormState = { name: "", tazkira: "", phone: "", address: "", note: "", status: "active" };

// ✅ توابع safe برای خواندن از localStorage
const safeGetItem = (key: string): any => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
};

const loadCustomers = (): Customer[] => {
  if (typeof window === "undefined") return defaultCustomers;
  try {
    const parsed = safeGetItem(CUSTOMERS_KEY);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object" && parsed[0] !== null && "id" in parsed[0] && "name" in parsed[0]) {
      return parsed.map((c: any) => ({
        id: c.id || generateId(), name: c.name || "", phone: c.phone || "", tazkira: c.tazkira || "",
        address: c.address || "", note: c.note || "", status: (c.status === "inactive" ? "inactive" : "active"),
        registeredAt: c.registeredAt || c.createdAt || new Date().toISOString(),
        balances: { AFN: Number(c.balances?.AFN || 0) || 0, USD: Number(c.balances?.USD || 0) || 0, EUR: Number(c.balances?.EUR || 0) || 0, IRR: Number(c.balances?.IRR || 0) || 0, PKR: Number(c.balances?.PKR || 0) || 0 },
      }));
    }
    if (Array.isArray(parsed) && typeof parsed[0] === "string") {
      const migrated = parsed.map((name: string, i: number): Customer => ({
        id: `cust-migrated-${i}`, name, phone: "", tazkira: "", address: "", note: "",
        status: "active", registeredAt: new Date().toISOString(),
        balances: { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 },
      }));
      try { localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(migrated)); } catch {}
      return migrated;
    }
    return defaultCustomers;
  } catch { return defaultCustomers; }
};

const loadTransactions = (): any[] => {
  if (typeof window === "undefined") return [];
  try {
    const parsed = safeGetItem(TRANSACTIONS_KEY);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

const loadHawalas = (): any[] => {
  if (typeof window === "undefined") return [];
  try {
    const parsed = safeGetItem(HAWALAS_KEY);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

const iconPaths = {
  users: "M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z",
  user: "M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z",
  search: "m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z",
  plus: "M12 4.5v15m7.5-7.5h-15",
  chevron: "m19.5 8.25-7.5 7.5-7.5-7.5",
  x: "M6 18 18 6M6 6l12 12",
  check: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  doc: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
  wallet: "M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3",
  history: "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  chart: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z",
  printer: "M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z",
  arrowUp: "M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18",
  arrowDown: "M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3",
  edit: "m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125",
  eye: "M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  inbox: "M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z",
  alert: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z",
  info: "m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z",
  sun: "M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z",
  moon: "M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z",
  sparkle: "M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z",
  arrowLeft: "M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18",
};

type IconName = keyof typeof iconPaths;

function Ic({ n, className = "h-5 w-5" }: { n: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={iconPaths[n]} />
    </svg>
  );
}

// ✅ Build ledger با defensive programming کامل و اصلاح TypeScript
function buildLedger(customers: Customer[], transactions: any[], hawalas: any[]): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  if (!Array.isArray(customers) || !Array.isArray(transactions) || !Array.isArray(hawalas)) return entries;

  // پردازش تراکنش‌ها
  for (const tx of transactions) {
    if (!tx || typeof tx !== "object") continue;
    if (tx.status === "voided" || tx.status === "cancelled") continue;
    const date = tx.date || new Date().toISOString();
    const refNum = tx.trackingCode || (tx.id ? String(tx.id).slice(-6) : "");
    
    // ✅ cast به Currency برای جلوگیری از خطای TypeScript
    const fromCur = tx.fromCurrency as Currency;
    const toCur = tx.toCurrency as Currency;
    const commCur = tx.commissionCurrency as Currency | undefined;
    const fromAmt = Number(tx.fromAmount || 0) || 0;
    const toAmt = Number(tx.toAmount || 0) || 0;
    const commAmt = Number(tx.commission || 0) || 0;

    if (tx.type === "exchange" && tx.customerId && isCurrency(fromCur) && isCurrency(toCur)) {
      entries.push({
        id: `${tx.id || generateId()}-out`, date, customerId: tx.customerId, type: "exchange",
        description: `فروش ${getCurrencyLabel(fromCur)} - ${tx.rateLabel || ""}`,
        currency: fromCur, amount: fromAmt, direction: "out",
        balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum,
      });
      entries.push({
        id: `${tx.id || generateId()}-in`, date, customerId: tx.customerId, type: "exchange",
        description: `خرید ${getCurrencyLabel(toCur)} - ${tx.rateLabel || ""}`,
        currency: toCur, amount: toAmt, direction: "in",
        balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum,
      });
      if (commAmt > 0 && isCurrency(commCur)) {
        entries.push({
          id: `${tx.id || generateId()}-fee`, date, customerId: tx.customerId, type: "fee",
          description: `کارمزد معامله`,
          currency: commCur, amount: commAmt, direction: "out",
          balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum,
        });
      }
    }

    if (tx.type === "transfer") {
      if (tx.senderId && isCurrency(fromCur)) {
        entries.push({
          id: `${tx.id || generateId()}-s-out`, date, customerId: tx.senderId, type: "transfer",
          description: `انتقال ${getCurrencyLabel(fromCur)} به ${customers.find(c => c.id === tx.receiverId)?.name || "—"}`,
          currency: fromCur, amount: fromAmt, direction: "out",
          balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum,
        });
        if (tx.commissionPayer === "sender" && commAmt > 0 && isCurrency(commCur)) {
          entries.push({
            id: `${tx.id || generateId()}-s-fee`, date, customerId: tx.senderId, type: "fee",
            description: `کارمزد انتقال`,
            currency: commCur, amount: commAmt, direction: "out",
            balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum,
          });
        }
      }
      if (tx.receiverId && isCurrency(toCur)) {
        entries.push({
          id: `${tx.id || generateId()}-r-in`, date, customerId: tx.receiverId, type: "transfer",
          description: `دریافت ${getCurrencyLabel(toCur)} از ${customers.find(c => c.id === tx.senderId)?.name || "—"}`,
          currency: toCur, amount: toAmt, direction: "in",
          balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum,
        });
        if (tx.commissionPayer === "receiver" && commAmt > 0 && isCurrency(commCur)) {
          entries.push({
            id: `${tx.id || generateId()}-r-fee`, date, customerId: tx.receiverId, type: "fee",
            description: `کارمزد انتقال`,
            currency: commCur, amount: commAmt, direction: "out",
            balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum,
          });
        }
      }
    }

    if (tx.type === "convert" && tx.customerId && isCurrency(fromCur) && isCurrency(toCur)) {
      entries.push({
        id: `${tx.id || generateId()}-c-out`, date, customerId: tx.customerId, type: "convert",
        description: `تبدیل از ${getCurrencyLabel(fromCur)}`,
        currency: fromCur, amount: fromAmt, direction: "out",
        balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum,
      });
      entries.push({
        id: `${tx.id || generateId()}-c-in`, date, customerId: tx.customerId, type: "convert",
        description: `تبدیل به ${getCurrencyLabel(toCur)}`,
        currency: toCur, amount: toAmt, direction: "in",
        balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum,
      });
      if (commAmt > 0 && isCurrency(commCur)) {
        entries.push({
          id: `${tx.id || generateId()}-c-fee`, date, customerId: tx.customerId, type: "fee",
          description: `کارمزد تبدیل`,
          currency: commCur, amount: commAmt, direction: "out",
          balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum,
        });
      }
    }
  }

  // پردازش حواله‌ها
  for (const h of hawalas) {
    if (!h || typeof h !== "object") continue;
    if (h.status === "cancelled") continue;
    const date = h.date || new Date().toISOString();
    const refNum = h.number || "";
    const sender = customers.find(c => c.name === h.senderName);
    const receiver = customers.find(c => c.name === h.receiverName);
    
    // ✅ cast به Currency
    const hFromCur = h.currencyFrom as Currency;
    const hToCur = h.currencyTo as Currency;
    const hFeeCur = h.feeCurrency as Currency;
    const hAmtFrom = Number(h.amountFrom || 0) || 0;
    const hFinalAmt = Number(h.finalAmount || 0) || 0;
    const hFee = Number(h.fee || 0) || 0;

    if (sender && isCurrency(hFromCur)) {
      entries.push({
        id: `${h.id || generateId()}-hs-out`, date, customerId: sender.id, type: "hawala",
        description: `حواله ارسالی به ${h.receiverName || "—"} (${h.destinationText || ""})`,
        currency: hFromCur, amount: hAmtFrom, direction: "out",
        balanceAfter: 0, referenceId: h.id, referenceNumber: refNum,
      });
      if (h.feePayer === "sender" && hFee > 0 && isCurrency(hFeeCur)) {
        entries.push({
          id: `${h.id || generateId()}-hs-fee`, date, customerId: sender.id, type: "fee",
          description: `کارمزد حواله`,
          currency: hFeeCur, amount: hFee, direction: "out",
          balanceAfter: 0, referenceId: h.id, referenceNumber: refNum,
        });
      }
    }
    if (receiver && h.status === "paid" && isCurrency(hToCur)) {
      entries.push({
        id: `${h.id || generateId()}-hr-in`, date: h.paidAt || h.date || date, customerId: receiver.id, type: "hawala",
        description: `دریافت حواله از ${h.senderName || "—"}`,
        currency: hToCur, amount: hFinalAmt, direction: "in",
        balanceAfter: 0, referenceId: h.id, referenceNumber: refNum,
      });
      if (h.feePayer === "receiver" && hFee > 0 && isCurrency(hFeeCur)) {
        entries.push({
          id: `${h.id || generateId()}-hr-fee`, date: h.paidAt || h.date || date, customerId: receiver.id, type: "fee",
          description: `کارمزد حواله`,
          currency: hFeeCur, amount: hFee, direction: "out",
          balanceAfter: 0, referenceId: h.id, referenceNumber: refNum,
        });
      }
    }
  }

  entries.sort((a, b) => {
    try { return new Date(a.date).getTime() - new Date(b.date).getTime(); } catch { return 0; }
  });

  const runningBal: Record<string, Record<Currency, number>> = {};
  for (const c of customers) {
    runningBal[c.id] = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
  }
  for (const e of entries) {
    if (!runningBal[e.customerId]) runningBal[e.customerId] = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    if (!isCurrency(e.currency)) continue;
    const delta = e.direction === "in" ? e.amount : -e.amount;
    runningBal[e.customerId][e.currency] += delta;
    e.balanceAfter = runningBal[e.customerId][e.currency];
  }

  return entries;
}

function computeBalances(entries: LedgerEntry[], customerId: string): Record<Currency, number> {
  const balances: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
  for (const e of entries) {
    if (e.customerId !== customerId || !isCurrency(e.currency)) continue;
    const delta = e.direction === "in" ? e.amount : -e.amount;
    balances[e.currency] += delta;
  }
  return balances;
}

export default function CustomersPage() {
  // ✅ شروع با مقادیر خالی و load در useEffect
  const [mounted, setMounted] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>(defaultCustomers);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [hawalas, setHawalas] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<"list" | "new" | "profile">("list");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState<"info" | "balances" | "ledger" | "statement">("info");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [toast, setToast] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Load theme
  useEffect(() => {
    try { const saved = window.localStorage.getItem("fx-theme"); if (saved === "dark" || saved === "light") setTheme(saved); } catch {}
  }, []);
  useEffect(() => { try { window.localStorage.setItem("fx-theme", theme); } catch {} }, [theme]);
  const dk = theme === "dark";

  // ✅ Load all data safely in useEffect
  useEffect(() => {
    try {
      setCustomers(loadCustomers());
      setTransactions(loadTransactions());
      setHawalas(loadHawalas());
    } catch (err) {
      console.error("Load error:", err);
    }
    setMounted(true);
  }, []);

  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const currentDateTime = now ? formatDateTime(now) : "";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CustomerStatus>("all");
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<TxType | "all">("all");
  const [ledgerCurrencyFilter, setLedgerCurrencyFilter] = useState<Currency | "all">("all");
  const [ledgerDirFilter, setLedgerDirFilter] = useState<"all" | "in" | "out">("all");

  useEffect(() => {
    if (!mounted) return;
    try { localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers)); } catch {}
  }, [customers, mounted]);

  const ledger = useMemo(() => {
    try { return buildLedger(customers, transactions, hawalas); } catch (err) { console.error("Ledger error:", err); return []; }
  }, [customers, transactions, hawalas]);

  const activeCount = customers.filter(c => c.status === "active").length;
  const inactiveCount = customers.filter(c => c.status === "inactive").length;

  const filteredCustomers = useMemo(() => {
    const q = normalizeDigits(search.trim()).toLowerCase();
    return customers.filter(c => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!q) return true;
      const fields = [c.name, c.phone || "", c.tazkira || "", c.id].map(f => normalizeDigits(String(f)).toLowerCase());
      return fields.some(f => f.includes(q));
    });
  }, [customers, search, statusFilter]);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId) || null;
  const customerLedger = useMemo(() => ledger.filter(e => e.customerId === selectedCustomerId), [ledger, selectedCustomerId]);
  const customerBalances = useMemo(() => selectedCustomerId ? computeBalances(ledger, selectedCustomerId) : null, [ledger, selectedCustomerId]);

  const filteredLedger = useMemo(() => {
    const q = normalizeDigits(ledgerSearch.trim()).toLowerCase();
    return customerLedger.filter(e => {
      if (ledgerTypeFilter !== "all" && e.type !== ledgerTypeFilter) return false;
      if (ledgerCurrencyFilter !== "all" && e.currency !== ledgerCurrencyFilter) return false;
      if (ledgerDirFilter !== "all" && e.direction !== ledgerDirFilter) return false;
      if (!q) return true;
      const fields = [e.description, e.referenceNumber || "", getCurrencyLabel(e.currency), String(e.amount)].map(f => normalizeDigits(String(f)).toLowerCase());
      return fields.some(f => f.includes(q));
    }).reverse();
  }, [customerLedger, ledgerSearch, ledgerTypeFilter, ledgerCurrencyFilter, ledgerDirFilter]);

  const showToast = (message: string) => { setToast(message); setTimeout(() => setToast(""), 3500); };
  const setField = (field: keyof FormState, value: string) => { setForm(prev => ({ ...prev, [field]: value })); setErrors(prev => ({ ...prev, [field]: undefined })); };

  const openProfile = (id: string) => { setSelectedCustomerId(id); setProfileTab("info"); setActiveTab("profile"); };
  const backToList = () => { setActiveTab("list"); setSelectedCustomerId(null); };

  const validateForm = () => {
    const errs: FormErrors = {};
    if (!form.name.trim()) errs.name = "نام و نام خانوادگی ضروری است.";
    if (!form.phone.trim()) errs.phone = "شماره تماس ضروری است.";
    const dupPhone = customers.find(c => c.phone === form.phone.trim());
    if (dupPhone) errs.phone = "این شماره تماس قبلاً ثبت شده است.";
    if (form.tazkira.trim()) {
      const dupTazkira = customers.find(c => c.tazkira === form.tazkira.trim());
      if (dupTazkira) errs.tazkira = "این شماره تذکره قبلاً ثبت شده است.";
    }
    return errs;
  };

  const submitNew = () => {
    const errs = validateForm();
    setErrors(errs);
    if (Object.keys(errs).length > 0) { showToast("لطفاً فیلدهای ضروری را تکمیل کنید."); return; }
    const newCustomer: Customer = {
      id: generateId(), name: form.name.trim(), phone: form.phone.trim(),
      tazkira: form.tazkira.trim(), address: form.address.trim(), note: form.note.trim(),
      status: form.status, registeredAt: new Date().toISOString(),
      balances: { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 },
    };
    setCustomers(prev => [newCustomer, ...prev]);
    setForm(emptyForm);
    setErrors({});
    setActiveTab("list");
    showToast(`مشتری "${newCustomer.name}" با موفقیت ثبت شد.`);
  };

  const toggleStatus = (id: string) => {
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, status: c.status === "active" ? "inactive" : "active" } : c));
    showToast("وضعیت مشتری تغییر کرد.");
  };

  const updateCustomer = () => {
    if (!selectedCustomer) return;
    setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? { ...c, name: form.name.trim(), phone: form.phone.trim(), tazkira: form.tazkira.trim(), address: form.address.trim(), note: form.note.trim(), status: form.status } : c));
    showToast("اطلاعات مشتری به‌روز شد.");
  };

  useEffect(() => {
    if (profileTab === "info" && selectedCustomer) {
      setForm({ name: selectedCustomer.name, phone: selectedCustomer.phone || "", tazkira: selectedCustomer.tazkira || "", address: selectedCustomer.address || "", note: selectedCustomer.note || "", status: selectedCustomer.status });
    }
  }, [profileTab, selectedCustomer]);

  const printStatement = () => {
    if (!selectedCustomer || !customerBalances) return;
    try {
      const win = window.open("", "_blank", "width=900,height=700");
      if (!win) return;
      const totalIn: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
      const totalOut: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
      for (const e of customerLedger) {
        if (!isCurrency(e.currency)) continue;
        if (e.direction === "in") totalIn[e.currency] += e.amount;
        else totalOut[e.currency] += e.amount;
      }
      const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>صورت‌حساب ${selectedCustomer.name}</title><style>
        body{font-family:Tahoma,Arial,sans-serif;padding:24px;direction:rtl;color:#0f172a}
        h1{margin:0 0 8px;color:#0369a1}h2{margin:16px 0 8px;color:#0f172a;border-bottom:2px solid #0ea5e9;padding-bottom:4px}
        .header{display:flex;justify-content:space-between;border-bottom:3px double #0ea5e9;padding-bottom:12px;margin-bottom:16px}
        .info{font-size:13px;line-height:1.8}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
        th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:right}th{background:#f0f9ff;color:#0369a1;font-weight:bold}
        .in{color:#059669;font-weight:bold}.out{color:#dc2626;font-weight:bold}
        .balance-box{display:inline-block;padding:8px 14px;border:2px solid #0ea5e9;border-radius:8px;margin:4px;font-weight:bold}
        .footer{margin-top:24px;padding-top:12px;border-top:1px solid #cbd5e1;font-size:11px;color:#64748b}
      </style></head><body>
        <div class="header">
          <div><h1>صورت‌حساب مشتری</h1><div class="info"><b>${selectedCustomer.name}</b><br>شماره مشتری: ${selectedCustomer.id.slice(-6)}<br>تذکره: ${selectedCustomer.tazkira || "-"}<br>تلفن: ${selectedCustomer.phone || "-"}<br>آدرس: ${selectedCustomer.address || "-"}</div></div>
          <div style="text-align:left"><div class="info">تاریخ صدور: ${currentDateTime}<br>دوره: تمام سوابق</div></div>
        </div>
        <h2>مانده حساب</h2>
        <div>${currencies.map(c => `<span class="balance-box">${getCurrencyLabel(c)}: ${fmt(customerBalances[c])}</span>`).join("")}</div>
        <h2>گردش حساب (${customerLedger.length} رویداد)</h2>
        <table><thead><tr><th>#</th><th>تاریخ</th><th>شماره سند</th><th>نوع</th><th>شرح</th><th>ارز</th><th>دریافت</th><th>پرداخت</th><th>مانده</th></tr></thead><tbody>
        ${customerLedger.map((e, i) => `<tr>
          <td>${i + 1}</td><td>${dateLabel(e.date)}</td><td>${e.referenceNumber || "-"}</td>
          <td>${txLabels[e.type]}</td><td>${e.description}</td><td>${getCurrencyLabel(e.currency)}</td>
          <td class="in">${e.direction === "in" ? fmt(e.amount) : ""}</td>
          <td class="out">${e.direction === "out" ? fmt(e.amount) : ""}</td>
          <td>${fmt(e.balanceAfter)}</td>
        </tr>`).join("")}
        </tbody></table>
        <h2>جمع کل</h2>
        <table><thead><tr><th>ارز</th><th>جمع دریافت</th><th>جمع پرداخت</th><th>مانده نهایی</th></tr></thead><tbody>
        ${currencies.map(c => `<tr><td>${getCurrencyLabel(c)}</td><td class="in">${fmt(totalIn[c])}</td><td class="out">${fmt(totalOut[c])}</td><td><b>${fmt(customerBalances[c])}</b></td></tr>`).join("")}
        </tbody></table>
        <div class="footer">این صورت‌حساب به‌صورت خودکار توسط سیستم صرافی تولید شده است.</div>
      </body></html>`;
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    } catch (err) { console.error("Print error:", err); showToast("خطا در چاپ صورت‌حساب"); }
  };

  // ✅ اگر هنوز mount نشده، فقط loading نشان بده
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-indigo-500" />
          <p className="mt-4 text-slate-500">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  const heading = dk ? "text-white" : "text-slate-900";
  const subText = dk ? "text-slate-500" : "text-slate-400";
  const glassChip = dk ? "border-slate-600/70 bg-slate-800/80" : "border-sky-100 bg-white/85";
  const uiCard = `rounded-2xl border backdrop-blur transition-colors duration-300 ${dk ? "border-slate-700 bg-slate-800/90 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.6)]" : "border-sky-100 bg-white/95 shadow-[0_16px_40px_-28px_rgba(2,132,199,0.35)]"}`;
  const glassCard = `rounded-2xl border backdrop-blur transition-all duration-300 ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-white/80"}`;
  const inputShell = `rounded-xl border text-sm font-medium shadow-sm outline-none transition-all duration-200 focus:ring-4 ${dk ? "border-slate-600 bg-slate-900 text-slate-100 placeholder:text-slate-500 hover:border-slate-500 focus:border-cyan-400 focus:ring-cyan-400/10" : "border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 hover:border-sky-400 focus:border-sky-500 focus:ring-sky-500/10"}`;
  const uiInput = `h-12 w-full px-3.5 ${inputShell}`;
  const errInput = dk ? "border-rose-400/70" : "border-rose-400";
  const uiLabel = `mb-1.5 block text-[11px] font-black tracking-wide ${dk ? "text-slate-400" : "text-slate-500"}`;
  const chevPos = `pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${dk ? "text-slate-500" : "text-slate-400"}`;
  const identIcon = dk ? "from-indigo-400/20 to-violet-400/5 text-violet-300 ring-violet-400/25" : "from-indigo-400/20 to-violet-400/10 text-violet-600 ring-violet-400/30";

  const fld = (label: string, node: ReactNode) => (<div><label className={uiLabel}>{label}</label>{node}</div>);
  const sel = (value: string, onCh: (v: string) => void, opts: string[][], cls = "") => (
    <div className="relative">
      <select value={value} onChange={(e) => onCh(e.target.value)} className={`${uiInput} cursor-pointer appearance-none pl-9 ${cls}`}>
        {opts.map((o) => (<option key={o[0]} value={o[0]}>{o[1]}</option>))}
      </select>
      <span className={chevPos}><Ic n="chevron" className="h-4 w-4" /></span>
    </div>
  );

  const errBox = (list: string[]) => list.length === 0 ? null : (
    <div className={`space-y-2 rounded-xl border p-4 ${dk ? "border-rose-400/30 bg-rose-400/10 text-rose-300" : "border-rose-300 bg-rose-50 text-rose-600"}`}>
      <b className="flex items-center gap-2 text-sm"><Ic n="alert" className="h-5 w-5 shrink-0" />لطفاً این فیلدها را تکمیل کنید:</b>
      <ul className="list-disc pr-5 text-sm marker:text-rose-400 space-y-1">{list.map((msg, i) => (<li key={i}>{msg}</li>))}</ul>
    </div>
  );

  const tabs = [
    { id: "list" as const, label: "فهرست مشتریان", icon: "users" as IconName, count: customers.length },
    { id: "new" as const, label: "ثبت مشتری جدید", icon: "plus" as IconName, count: null },
  ];

  const profileTabs = [
    { id: "info" as const, label: "اطلاعات", icon: "user" as IconName },
    { id: "balances" as const, label: "موجودی", icon: "wallet" as IconName },
    { id: "ledger" as const, label: "روزنامچه", icon: "history" as IconName },
    { id: "statement" as const, label: "صورت‌حساب", icon: "doc" as IconName },
  ];

  const errorList = Object.values(errors).filter((msg): msg is string => Boolean(msg));

  return (
    <div dir="rtl" className={dk ? "dark" : ""}>
      <style>{`@import url("https://fonts.googleapis.com/css2?family=Lalezar&family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap");.cu-font{font-family:"Vazirmatn","Segoe UI",Tahoma,sans-serif}.cu-display{font-family:"Lalezar","Vazirmatn",Tahoma,sans-serif;letter-spacing:.01em}.dark{color-scheme:dark}.cu-grid{background-image:radial-gradient(circle at 1px 1px,rgba(139,92,246,.12) 1px,transparent 0);background-size:24px 24px;-webkit-mask-image:linear-gradient(to bottom,rgba(0,0,0,.9),rgba(0,0,0,.25) 60%,transparent);mask-image:linear-gradient(to bottom,rgba(0,0,0,.9),rgba(0,0,0,.25) 60%,transparent)}.dark .cu-grid{background-image:radial-gradient(circle at 1px 1px,rgba(148,163,184,.08) 1px,transparent 0)}@keyframes cuUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}@keyframes cuPulse{0%,100%{opacity:1}50%{opacity:.6}}.cu-up{animation:cuUp .5s cubic-bezier(.22,.8,.35,1) both}.cu-pulse{animation:cuPulse 2s ease-in-out infinite}details>summary{list-style:none}details>summary::-webkit-details-marker{display:none}.cu-scroll::-webkit-scrollbar{height:6px;width:6px}.cu-scroll::-webkit-scrollbar-thumb{background:rgba(139,92,246,.3);border-radius:3px}.cu-scroll{scrollbar-width:thin}::selection{background:rgba(139,92,246,.25)}`}</style>

      <div className={`cu-font relative min-h-screen overflow-x-hidden antialiased transition-colors duration-500 ${dk ? "bg-[#0f172a] text-slate-100" : "bg-gradient-to-br from-indigo-50 via-violet-50 to-sky-50 text-slate-800"}`}>
        <div className={`fixed inset-x-0 top-0 z-30 h-1 bg-gradient-to-l ${dk ? "from-indigo-400 via-violet-400 to-fuchsia-400" : "from-indigo-500 via-violet-500 to-fuchsia-500"}`} />
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
          <div className="cu-grid absolute inset-0" />
          <div className={`absolute -top-36 right-[-12rem] h-[30rem] w-[30rem] rounded-full blur-[110px] ${dk ? "bg-violet-500/10" : "bg-violet-400/20"}`} />
          <div className={`absolute left-[-12rem] top-1/4 h-[26rem] w-[26rem] rounded-full blur-[110px] ${dk ? "bg-indigo-500/10" : "bg-indigo-300/20"}`} />
          <div className={`absolute bottom-[-10rem] right-1/3 h-[24rem] w-[24rem] rounded-full blur-[100px] ${dk ? "bg-fuchsia-500/10" : "bg-fuchsia-300/20"}`} />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-7xl space-y-4 md:space-y-6 px-3 pb-16 pt-5 md:px-8 md:pt-9">
          <header className="cu-up flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0">
              <div className="relative grid h-11 w-11 md:h-14 md:w-14 shrink-0 place-items-center rounded-xl md:rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-400 text-white shadow-lg shadow-violet-500/30 ring-1 ring-white/30">
                <Ic n="users" className="h-5 w-5 md:h-6 md:w-6" />
                <span className={`absolute -bottom-1 -left-1 md:-bottom-1.5 md:-left-1.5 grid h-4 min-w-4 md:h-5 md:min-w-5 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-400 px-1 text-[7px] md:text-[8px] font-black text-white ring-2 ${dk ? "ring-[#0f172a]" : "ring-[#eef6fa]"}`}>VIP</span>
              </div>
              <div className="min-w-0">
                <h1 className={`cu-display text-2xl md:text-4xl leading-none ${heading}`}>مدیریت مشتریان</h1>
                <p className={`mt-1 text-[10px] md:text-xs font-bold ${subText}`}>پروندهٔ کامل، گردش حساب و سوابق مالی هر مشتری</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2.5">
              <div className={`hidden sm:flex items-center gap-2 rounded-xl border px-3 py-2 shadow-sm backdrop-blur ${glassChip}`}>
                <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" /></span>
                <span dir="ltr" className={`text-xs font-bold tabular-nums ${dk ? "text-slate-100" : "text-slate-700"}`}>{currentDateTime || "--:--"}</span>
              </div>
              <button onClick={() => setTheme(dk ? "light" : "dark")} className={`group grid h-10 w-10 md:h-11 md:w-11 cursor-pointer place-items-center rounded-lg md:rounded-xl border shadow-sm backdrop-blur transition-all duration-300 active:scale-90 ${dk ? "border-slate-600 bg-slate-800/85 text-amber-300 hover:border-amber-300" : "border-slate-200 bg-white/85 text-slate-600 hover:border-violet-400"}`}>
                {dk ? <Ic n="sun" className="h-4 w-4 transition-transform duration-500 group-hover:rotate-45" /> : <Ic n="moon" className="h-4 w-4 transition-transform duration-500 group-hover:-rotate-12" />}
              </button>
            </div>
          </header>

          <div className="cu-up grid grid-cols-2 md:grid-cols-4 gap-3" style={{ animationDelay: "70ms" }}>
            {[
              { label: "کل مشتریان", value: customers.length, icon: "users", color: dk ? "from-indigo-500 to-violet-500" : "from-indigo-500 to-violet-500", text: dk ? "text-violet-300" : "text-violet-600" },
              { label: "فعال", value: activeCount, icon: "check", color: dk ? "from-emerald-500 to-teal-500" : "from-emerald-500 to-teal-500", text: dk ? "text-emerald-300" : "text-emerald-600" },
              { label: "غیرفعال", value: inactiveCount, icon: "x", color: dk ? "from-rose-500 to-pink-500" : "from-rose-500 to-pink-500", text: dk ? "text-rose-300" : "text-rose-600" },
              { label: "رویدادهای مالی", value: ledger.length, icon: "history", color: dk ? "from-amber-500 to-orange-500" : "from-amber-500 to-orange-500", text: dk ? "text-amber-300" : "text-amber-600" },
            ].map((stat, i) => (
              <div key={i} className={`group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${glassCard}`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 transition-opacity group-hover:opacity-10`} />
                <div className="relative flex items-center justify-between">
                  <div>
                    <div className={`text-[10px] font-black ${subText}`}>{stat.label}</div>
                    <div className={`text-2xl md:text-3xl font-black tabular-nums mt-1 ${stat.text}`}>{stat.value}</div>
                  </div>
                  <div className={`grid h-10 w-10 md:h-12 md:w-12 place-items-center rounded-xl bg-gradient-to-br ${stat.color} text-white shadow-lg`}>
                    <Ic n={stat.icon as IconName} className="h-5 w-5 md:h-6 md:w-6" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className={`cu-up flex gap-1.5 md:gap-2 rounded-xl md:rounded-2xl border p-1.5 md:p-2 shadow-sm backdrop-blur ${glassChip}`} style={{ animationDelay: "140ms" }}>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 md:gap-2 rounded-lg md:rounded-xl px-3 md:px-5 py-2.5 md:py-3 text-xs md:text-sm font-black transition-all duration-300 active:scale-[0.97] ${activeTab === tab.id ? `bg-gradient-to-l shadow-lg ${dk ? "from-indigo-400 to-violet-400 text-slate-950" : "from-indigo-500 via-violet-500 to-fuchsia-500 text-white"}` : dk ? "text-slate-400 hover:bg-slate-700/60 hover:text-slate-100" : "text-slate-500 hover:bg-violet-50 hover:text-slate-800"}`}>
                <Ic n={tab.icon} className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.count !== null && <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${activeTab === tab.id ? dk ? "bg-slate-950/20 text-slate-950" : "bg-white/30 text-white" : dk ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"}`}>{tab.count}</span>}
              </button>
            ))}
            {selectedCustomer && (
              <button onClick={() => setActiveTab("profile")} className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 md:gap-2 rounded-lg md:rounded-xl px-3 md:px-5 py-2.5 md:py-3 text-xs md:text-sm font-black transition-all duration-300 active:scale-[0.97] ${activeTab === "profile" ? `bg-gradient-to-l shadow-lg ${dk ? "from-emerald-400 to-teal-400 text-slate-950" : "from-emerald-500 via-teal-500 to-cyan-500 text-white"}` : dk ? "text-slate-400 hover:bg-slate-700/60" : "text-slate-500 hover:bg-emerald-50"}`}>
                <Ic n="sparkle" className="h-4 w-4" />
                <span className="hidden xs:inline md:inline">پرونده:</span>
                <span className="truncate max-w-[100px]">{selectedCustomer.name}</span>
              </button>
            )}
          </div>

          {activeTab === "list" && (
            <section className={`cu-up overflow-hidden ${uiCard}`} style={{ animationDelay: "160ms" }}>
              <div className="flex flex-wrap items-center gap-3 p-4 md:p-5 pb-3 md:pb-4 md:px-7 md:pt-6">
                <span className={`grid h-10 w-10 md:h-11 md:w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${identIcon}`}><Ic n="users" className="h-5 w-5" /></span>
                <div className="flex-1 min-w-0">
                  <h2 className={`cu-display text-xl md:text-2xl leading-none ${heading}`}>فهرست مشتریان</h2>
                  <p className={`mt-1 text-[11px] font-bold ${subText}`}>جستجو، فیلتر و مدیریت پرونده‌ها</p>
                </div>
                <button onClick={() => { setForm(emptyForm); setActiveTab("new"); }} className={`flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-l px-4 py-2.5 text-sm font-black shadow-lg transition-all hover:brightness-110 active:scale-95 ${dk ? "from-indigo-400 to-violet-400 text-slate-950" : "from-indigo-500 to-violet-500 text-white"}`}>
                  <Ic n="plus" className="h-4 w-4" />ثبت مشتری جدید
                </button>
              </div>

              <div className="px-4 md:px-7 pb-4 space-y-3">
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <div className="relative">
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو بر اساس نام، شماره مشتری، تلفن یا تذکره…" className={`${uiInput} pr-10`} />
                    <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${dk ? "text-slate-500" : "text-slate-400"}`}><Ic n="search" className="h-4 w-4" /></span>
                  </div>
                  <div className="flex gap-2">
                    {(["all", "active", "inactive"] as const).map(s => (
                      <button key={s} onClick={() => setStatusFilter(s)} className={`cursor-pointer rounded-xl border px-4 py-2 text-xs font-black transition-all ${statusFilter === s ? dk ? "bg-violet-400/15 border-violet-400/40 text-violet-300" : "bg-violet-100 border-violet-300 text-violet-700" : dk ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                        {s === "all" ? "همه" : s === "active" ? "فعال" : "غیرفعال"}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredCustomers.length === 0 ? (
                  <div className={`flex flex-col items-center gap-3 px-6 py-16 ${dk ? "text-slate-500" : "text-slate-400"}`}>
                    <span className={`grid h-16 w-16 place-items-center rounded-2xl border border-dashed ${dk ? "border-slate-600 bg-slate-800/40" : "border-slate-300 bg-slate-50"}`}><Ic n="inbox" className="h-7 w-7 opacity-70" /></span>
                    <p className="text-sm font-black">{customers.length === 0 ? "هنوز مشتری ثبت نشده است." : "هیچ مشتری با این فیلتر یافت نشد."}</p>
                  </div>
                ) : (
                  <>
                    <div className="md:hidden space-y-2">
                      {filteredCustomers.map(c => {
                        const bal = computeBalances(ledger, c.id);
                        return (
                          <div key={c.id} className={`rounded-2xl border p-4 transition-all hover:shadow-md ${glassCard}`}>
                            <div className="flex items-start gap-3">
                              <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${c.status === "active" ? "from-emerald-500 to-teal-500" : "from-slate-400 to-slate-500"} text-white font-black text-lg shadow-lg`}>
                                {c.name.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <b className={`text-sm font-black truncate ${dk ? "text-slate-100" : "text-slate-800"}`}>{c.name}</b>
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-black ${c.status === "active" ? dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-700" : dk ? "bg-slate-500/15 text-slate-300" : "bg-slate-200 text-slate-600"}`}>
                                    {c.status === "active" ? "فعال" : "غیرفعال"}
                                  </span>
                                </div>
                                <div className={`text-[11px] ${subText} mt-1 space-y-0.5`}>
                                  <div>📱 {c.phone || "-"}</div>
                                  <div>🆔 {c.tazkira || "-"}</div>
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-5 gap-1 mt-3">
                              {currencies.map(cur => (
                                <div key={cur} className={`rounded-lg px-1.5 py-1.5 text-center ${dk ? "bg-slate-900/50" : "bg-slate-50"}`}>
                                  <div className={`text-[8px] font-black ${subText}`}>{cur}</div>
                                  <div className={`text-[10px] font-black tabular-nums ${bal[cur] >= 0 ? currencyColors[cur][dk ? "dark" : "light"] : "text-rose-500"}`}>{fmt(bal[cur])}</div>
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2 mt-3">
                              <button onClick={() => openProfile(c.id)} className={`flex-1 cursor-pointer rounded-lg border px-2 py-2 text-[11px] font-bold transition active:scale-95 ${dk ? "border-violet-400/30 text-violet-300 hover:bg-violet-400/10" : "border-violet-300 text-violet-600 hover:bg-violet-50"}`}>
                                <Ic n="eye" className="h-3.5 w-3.5 inline ml-1" />مشاهده
                              </button>
                              <button onClick={() => toggleStatus(c.id)} className={`flex-1 cursor-pointer rounded-lg border px-2 py-2 text-[11px] font-bold transition active:scale-95 ${dk ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                                {c.status === "active" ? "غیرفعال" : "فعال"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="hidden md:block overflow-x-auto cu-scroll">
                      <table className="w-full min-w-[1000px] text-sm">
                        <thead>
                          <tr className={`border-y ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
                            {["شماره", "مشتری", "تلفن", "تذکره", "تاریخ ثبت", "وضعیت", "موجودی", "عملیات"].map(h => (
                              <th key={h} className="px-4 py-3 text-right text-[11px] font-black text-slate-400">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className={`divide-y ${dk ? "divide-slate-700/60" : "divide-slate-100"}`}>
                          {filteredCustomers.map((c, idx) => {
                            const bal = computeBalances(ledger, c.id);
                            const activeBal = currencies.find(cur => bal[cur] !== 0);
                            return (
                              <tr key={c.id} className={`transition-colors ${dk ? "hover:bg-slate-700/30" : "hover:bg-violet-50/70"}`}>
                                <td className="px-4 py-3.5"><span className={`grid h-8 w-8 place-items-center rounded-lg text-[11px] font-black tabular-nums ${dk ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"}`}>{idx + 1}</span></td>
                                <td className="px-4 py-3.5">
                                  <div className="flex items-center gap-2.5">
                                    <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${c.status === "active" ? "from-emerald-500 to-teal-500" : "from-slate-400 to-slate-500"} text-white font-black text-sm shadow`}>
                                      {c.name.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                      <div className={`text-[13px] font-black truncate ${dk ? "text-slate-100" : "text-slate-800"}`}>{c.name}</div>
                                      <div className={`text-[10px] ${subText} truncate`}>{c.address || "—"}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className={`px-4 py-3.5 text-xs tabular-nums ${dk ? "text-slate-300" : "text-slate-600"}`} dir="ltr">{c.phone || "-"}</td>
                                <td className={`px-4 py-3.5 text-xs tabular-nums ${dk ? "text-slate-300" : "text-slate-600"}`} dir="ltr">{c.tazkira || "-"}</td>
                                <td className={`whitespace-nowrap px-4 py-3.5 text-xs tabular-nums ${dk ? "text-slate-400" : "text-slate-500"}`} dir="ltr">{shortDateLabel(c.registeredAt)}</td>
                                <td className="px-4 py-3.5">
                                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black ${c.status === "active" ? dk ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/25" : "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300/60" : dk ? "bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/25" : "bg-slate-200 text-slate-600 ring-1 ring-slate-300/60"}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${c.status === "active" ? "bg-emerald-500 cu-pulse" : "bg-slate-400"}`} />
                                    {c.status === "active" ? "فعال" : "غیرفعال"}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5">
                                  <div className="flex flex-wrap gap-1">
                                    {currencies.map(cur => bal[cur] !== 0 && (
                                      <span key={cur} className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-black tabular-nums ${dk ? "bg-slate-900/60" : "bg-slate-50"}`}>
                                        <span className={currencyColors[cur][dk ? "dark" : "light"]}>{fmt(bal[cur])}</span>
                                        <span className={subText}>{cur}</span>
                                      </span>
                                    ))}
                                    {!activeBal && <span className={`text-[10px] ${subText}`}>بدون موجودی</span>}
                                  </div>
                                </td>
                                <td className="px-4 py-3.5">
                                  <div className="flex gap-1.5">
                                    <button onClick={() => openProfile(c.id)} className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition active:scale-95 ${dk ? "border-violet-400/30 text-violet-300 hover:bg-violet-400/10" : "border-violet-300 text-violet-600 hover:bg-violet-50"}`}>
                                      <Ic n="eye" className="h-3.5 w-3.5" />
                                    </button>
                                    <button onClick={() => toggleStatus(c.id)} className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition active:scale-95 ${dk ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                                      {c.status === "active" ? <Ic n="x" className="h-3.5 w-3.5" /> : <Ic n="check" className="h-3.5 w-3.5" />}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          {activeTab === "new" && (
            <section className={`cu-up space-y-4 md:space-y-5 p-4 md:p-7 ${uiCard}`} style={{ animationDelay: "160ms" }}>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${identIcon}`}><Ic n="plus" className="h-5 w-5" /></span>
                <div className="flex-1 min-w-0">
                  <h2 className={`cu-display text-xl md:text-2xl leading-none ${heading}`}>ثبت مشتری جدید</h2>
                  <p className={`mt-1 text-[11px] font-bold ${subText}`}>ایجاد پروندهٔ جدید در سامانه</p>
                </div>
              </div>

              <div className={`rounded-2xl border p-4 ${dk ? "border-indigo-400/25 bg-indigo-400/[0.07]" : "border-indigo-300 bg-indigo-50"}`}>
                <div className="flex items-start gap-3">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${dk ? "bg-indigo-400/15 text-indigo-300" : "bg-indigo-100 text-indigo-600"}`}><Ic n="info" className="h-4 w-4" /></span>
                  <div className={`text-xs leading-6 ${dk ? "text-indigo-200" : "text-indigo-800"}`}>
                    <b>نکته مهم:</b> موجودی مشتری پس از ثبت، از طریق معاملات، حواله‌جات و صندوق مالی به‌صورت خودکار به‌روزرسانی می‌شود. امکان تغییر دستی موجودی وجود ندارد.
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {fld("نام و نام خانوادگی *", (<input className={`${uiInput} ${errors.name ? errInput : ""}`} value={form.name} onChange={e => setField("name", e.target.value)} placeholder="مثلاً علی احمدی" />))}
                {fld("شماره تماس *", (<input className={`${uiInput} ${errors.phone ? errInput : ""}`} value={form.phone} onChange={e => setField("phone", e.target.value)} placeholder="07xxxxxxxx" />))}
                {fld("شماره تذکره", (<input className={`${uiInput} ${errors.tazkira ? errInput : ""}`} value={form.tazkira} onChange={e => setField("tazkira", e.target.value)} placeholder="مثلاً 1400-001-001" />))}
                {fld("وضعیت", sel(form.status, v => setField("status", v), [["active", "فعال"], ["inactive", "غیرفعال"]]))}
                <div className="md:col-span-2">{fld("آدرس", (<input className={uiInput} value={form.address} onChange={e => setField("address", e.target.value)} placeholder="ولایت، ولسوالی، منطقه" />))}</div>
                <div className="md:col-span-2">{fld("توضیحات", (<textarea rows={3} className={`${uiInput} h-auto py-3 resize-none`} value={form.note} onChange={e => setField("note", e.target.value)} placeholder="توضیحات اختیاری..." />))}</div>
              </div>

              {errBox(errorList)}

              <div className="flex flex-wrap gap-3">
                <button onClick={submitNew} className={`group flex h-[50px] md:h-[52px] flex-1 min-w-[200px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-l text-base font-black shadow-lg transition-all duration-300 hover:shadow-xl hover:brightness-110 active:scale-[0.985] ${dk ? "from-indigo-400 to-violet-400 text-slate-950" : "from-indigo-500 via-violet-500 to-fuchsia-500 text-white"}`}>
                  ثبت مشتری
                  <Ic n="arrowLeft" className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
                </button>
                <button onClick={() => { setForm(emptyForm); setErrors({}); setActiveTab("list"); }} className={`flex h-[50px] md:h-[52px] px-6 cursor-pointer items-center justify-center gap-2 rounded-xl border text-sm font-bold transition-all active:scale-95 ${dk ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>انصراف</button>
              </div>
            </section>
          )}

          {activeTab === "profile" && selectedCustomer && customerBalances && (
            <section className="cu-up space-y-4 md:space-y-5" style={{ animationDelay: "160ms" }}>
              <div className={`relative overflow-hidden rounded-2xl border p-5 md:p-7 ${uiCard}`}>
                <div className={`absolute inset-0 bg-gradient-to-br opacity-30 ${dk ? "from-violet-500/10 via-transparent to-fuchsia-500/10" : "from-violet-200/40 via-transparent to-fuchsia-200/40"}`} />
                <div className="relative">
                  <button onClick={backToList} className={`mb-4 flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${dk ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                    <Ic n="chevron" className="h-3.5 w-3.5 rotate-90" />
                    بازگشت به فهرست
                  </button>

                  <div className="flex flex-wrap items-start gap-4 md:gap-6">
                    <div className={`relative grid h-20 w-20 md:h-24 md:w-24 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${selectedCustomer.status === "active" ? "from-indigo-500 via-violet-500 to-fuchsia-500" : "from-slate-400 to-slate-600"} text-white font-black text-3xl md:text-4xl shadow-2xl ring-4 ${dk ? "ring-slate-800" : "ring-white"}`}>
                      {selectedCustomer.name.charAt(0)}
                      <span className={`absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full ${selectedCustomer.status === "active" ? "bg-emerald-500" : "bg-slate-500"} ring-2 ${dk ? "ring-slate-800" : "ring-white"}`}>
                        {selectedCustomer.status === "active" ? <Ic n="check" className="h-3 w-3 text-white" /> : <Ic n="x" className="h-3 w-3 text-white" />}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h2 className={`cu-display text-2xl md:text-3xl leading-none ${heading}`}>{selectedCustomer.name}</h2>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black ${selectedCustomer.status === "active" ? dk ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/25" : "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300/60" : dk ? "bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/25" : "bg-slate-200 text-slate-600 ring-1 ring-slate-300/60"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${selectedCustomer.status === "active" ? "bg-emerald-500 cu-pulse" : "bg-slate-400"}`} />
                          {selectedCustomer.status === "active" ? "فعال" : "غیرفعال"}
                        </span>
                      </div>
                      <div className={`grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs mt-2 ${subText}`}>
                        <div><span className="font-bold">کد مشتری:</span> <span className="font-black tabular-nums" dir="ltr">{selectedCustomer.id.slice(-6)}</span></div>
                        <div><span className="font-bold">تلفن:</span> <span className="font-black tabular-nums" dir="ltr">{selectedCustomer.phone || "-"}</span></div>
                        <div><span className="font-bold">تذکره:</span> <span className="font-black tabular-nums" dir="ltr">{selectedCustomer.tazkira || "-"}</span></div>
                        <div><span className="font-bold">ثبت:</span> <span className="font-black tabular-nums" dir="ltr">{shortDateLabel(selectedCustomer.registeredAt)}</span></div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => toggleStatus(selectedCustomer.id)} className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-bold transition active:scale-95 ${dk ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                        {selectedCustomer.status === "active" ? "غیرفعال کردن" : "فعال کردن"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`rounded-2xl border p-4 md:p-5 ${uiCard}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`grid h-8 w-8 place-items-center rounded-lg ${dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-600"}`}><Ic n="wallet" className="h-4 w-4" /></span>
                  <b className={`text-sm font-black ${heading}`}>موجودی فعلی</b>
                  <span className={`ml-auto text-[10px] font-bold ${subText}`}>محاسبه خودکار از گردش حساب</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3">
                  {currencies.map(cur => {
                    const bal = customerBalances[cur];
                    const colors = currencyColors[cur];
                    return (
                      <div key={cur} className={`group relative overflow-hidden rounded-xl border p-3 transition-all hover:-translate-y-0.5 hover:shadow-lg ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-white"}`}>
                        <div className={`absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity group-hover:opacity-20 ${colors.gradient}`} />
                        <div className="relative">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[10px] font-black ${subText}`}>{getCurrencyLabel(cur)}</span>
                            <span className={`grid h-5 w-5 place-items-center rounded-md bg-gradient-to-br ${colors.gradient} text-white text-[9px] font-black`}>{cur}</span>
                          </div>
                          <div className={`text-lg md:text-xl font-black tabular-nums ${bal >= 0 ? colors[dk ? "dark" : "light"] : "text-rose-500"}`}>
                            {fmt(bal)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={`flex flex-wrap gap-1.5 rounded-xl border p-1.5 ${glassChip}`}>
                {profileTabs.map(pt => (
                  <button key={pt.id} onClick={() => setProfileTab(pt.id)} className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black transition-all ${profileTab === pt.id ? dk ? "bg-violet-400/15 text-violet-300 ring-1 ring-violet-400/30" : "bg-violet-100 text-violet-700 ring-1 ring-violet-300" : dk ? "text-slate-400 hover:bg-slate-700/60" : "text-slate-500 hover:bg-slate-50"}`}>
                    <Ic n={pt.icon} className="h-3.5 w-3.5" />
                    {pt.label}
                  </button>
                ))}
              </div>

              {profileTab === "info" && (
                <div className={`rounded-2xl border p-4 md:p-6 ${uiCard}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`grid h-8 w-8 place-items-center rounded-lg ${dk ? "bg-indigo-400/15 text-indigo-300" : "bg-indigo-100 text-indigo-600"}`}><Ic n="edit" className="h-4 w-4" /></span>
                    <b className={`text-sm font-black ${heading}`}>ویرایش اطلاعات مشتری</b>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {fld("نام و نام خانوادگی", (<input className={uiInput} value={form.name} onChange={e => setField("name", e.target.value)} />))}
                    {fld("شماره تماس", (<input className={uiInput} value={form.phone} onChange={e => setField("phone", e.target.value)} />))}
                    {fld("شماره تذکره", (<input className={uiInput} value={form.tazkira} onChange={e => setField("tazkira", e.target.value)} />))}
                    {fld("وضعیت", sel(form.status, v => setField("status", v), [["active", "فعال"], ["inactive", "غیرفعال"]]))}
                    <div className="md:col-span-2">{fld("آدرس", (<input className={uiInput} value={form.address} onChange={e => setField("address", e.target.value)} />))}</div>
                    <div className="md:col-span-2">{fld("توضیحات", (<textarea rows={3} className={`${uiInput} h-auto py-3 resize-none`} value={form.note} onChange={e => setField("note", e.target.value)} />))}</div>
                  </div>
                  <button onClick={updateCustomer} className={`mt-4 flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-l px-5 py-2.5 text-sm font-black shadow-lg transition-all hover:brightness-110 active:scale-95 ${dk ? "from-indigo-400 to-violet-400 text-slate-950" : "from-indigo-500 to-violet-500 text-white"}`}>
                    <Ic n="check" className="h-4 w-4" />ذخیره تغییرات
                  </button>
                </div>
              )}

              {profileTab === "balances" && (
                <div className={`rounded-2xl border p-4 md:p-6 ${uiCard}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`grid h-8 w-8 place-items-center rounded-lg ${dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-600"}`}><Ic n="chart" className="h-4 w-4" /></span>
                    <b className={`text-sm font-black ${heading}`}>جزئیات موجودی</b>
                  </div>
                  <div className={`rounded-xl border p-3 mb-4 ${dk ? "border-amber-400/25 bg-amber-400/[0.07]" : "border-amber-300 bg-amber-50"}`}>
                    <div className="flex items-start gap-2">
                      <Ic n="alert" className={`h-4 w-4 shrink-0 mt-0.5 ${dk ? "text-amber-300" : "text-amber-600"}`} />
                      <span className={`text-xs leading-6 ${dk ? "text-amber-200" : "text-amber-800"}`}>
                        موجودی‌ها فقط از گردش واقعی حساب محاسبه می‌شوند. برای واریز یا برداشت، از تب صندوق مالی استفاده کنید.
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {currencies.map(cur => {
                      const bal = customerBalances[cur];
                      const txCount = customerLedger.filter(e => e.currency === cur).length;
                      const totalIn = customerLedger.filter(e => e.currency === cur && e.direction === "in").reduce((s, e) => s + e.amount, 0);
                      const totalOut = customerLedger.filter(e => e.currency === cur && e.direction === "out").reduce((s, e) => s + e.amount, 0);
                      const colors = currencyColors[cur];
                      return (
                        <div key={cur} className={`rounded-xl border p-4 transition-all ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-white"}`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className={`grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br ${colors.gradient} text-white font-black shadow-md`}>{cur}</span>
                              <div>
                                <b className={`text-sm font-black ${heading}`}>{getCurrencyLabel(cur)}</b>
                                <div className={`text-[10px] ${subText}`}>{txCount} رویداد</div>
                              </div>
                            </div>
                            <div className={`text-2xl font-black tabular-nums ${bal >= 0 ? colors[dk ? "dark" : "light"] : "text-rose-500"}`}>
                              {fmt(bal)}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-dashed border-slate-300/30">
                            <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${dk ? "bg-emerald-400/10" : "bg-emerald-50"}`}>
                              <Ic n="arrowDown" className={`h-4 w-4 ${dk ? "text-emerald-300" : "text-emerald-600"}`} />
                              <div>
                                <div className={`text-[10px] font-bold ${subText}`}>جمع دریافت</div>
                                <div className={`text-sm font-black tabular-nums ${dk ? "text-emerald-300" : "text-emerald-700"}`}>{fmt(totalIn)}</div>
                              </div>
                            </div>
                            <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${dk ? "bg-rose-400/10" : "bg-rose-50"}`}>
                              <Ic n="arrowUp" className={`h-4 w-4 ${dk ? "text-rose-300" : "text-rose-600"}`} />
                              <div>
                                <div className={`text-[10px] font-bold ${subText}`}>جمع پرداخت</div>
                                <div className={`text-sm font-black tabular-nums ${dk ? "text-rose-300" : "text-rose-700"}`}>{fmt(totalOut)}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {profileTab === "ledger" && (
                <div className={`rounded-2xl border p-4 md:p-6 ${uiCard}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <span className={`grid h-8 w-8 place-items-center rounded-lg ${dk ? "bg-amber-400/15 text-amber-300" : "bg-amber-100 text-amber-600"}`}><Ic n="history" className="h-4 w-4" /></span>
                      <b className={`text-sm font-black ${heading}`}>روزنامچه و گردش حساب</b>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${dk ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"}`}>{filteredLedger.length} رویداد</span>
                    </div>
                  </div>

                  <div className="grid gap-2 mb-4 md:grid-cols-[1fr_auto_auto_auto]">
                    <div className="relative">
                      <input value={ledgerSearch} onChange={e => setLedgerSearch(e.target.value)} placeholder="جستجو در شرح، شماره سند…" className={`${uiInput} pr-10`} />
                      <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${dk ? "text-slate-500" : "text-slate-400"}`}><Ic n="search" className="h-4 w-4" /></span>
                    </div>
                    <select value={ledgerTypeFilter} onChange={e => setLedgerTypeFilter(e.target.value as any)} className={`${uiInput} cursor-pointer appearance-none pl-9 w-auto min-w-[140px]`}>
                      <option value="all">همه انواع</option>
                      {(Object.keys(txLabels) as TxType[]).map(t => <option key={t} value={t}>{txLabels[t]}</option>)}
                    </select>
                    <select value={ledgerCurrencyFilter} onChange={e => setLedgerCurrencyFilter(e.target.value as any)} className={`${uiInput} cursor-pointer appearance-none pl-9 w-auto min-w-[120px]`}>
                      <option value="all">همه ارزها</option>
                      {currencies.map(c => <option key={c} value={c}>{getCurrencyLabel(c)}</option>)}
                    </select>
                    <select value={ledgerDirFilter} onChange={e => setLedgerDirFilter(e.target.value as any)} className={`${uiInput} cursor-pointer appearance-none pl-9 w-auto min-w-[120px]`}>
                      <option value="all">همه</option>
                      <option value="in">دریافت</option>
                      <option value="out">پرداخت</option>
                    </select>
                  </div>

                  {filteredLedger.length === 0 ? (
                    <div className={`flex flex-col items-center gap-3 px-6 py-12 ${dk ? "text-slate-500" : "text-slate-400"}`}>
                      <span className={`grid h-14 w-14 place-items-center rounded-2xl border border-dashed ${dk ? "border-slate-600 bg-slate-800/40" : "border-slate-300 bg-slate-50"}`}><Ic n="inbox" className="h-6 w-6 opacity-70" /></span>
                      <p className="text-sm font-black text-center">هیچ رویداد مالی یافت نشد.</p>
                    </div>
                  ) : (
                    <>
                      <div className="md:hidden space-y-2">
                        {filteredLedger.map(e => {
                          const isOut = e.direction === "out";
                          return (
                            <div key={e.id} className={`rounded-xl border p-3 ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-white"}`}>
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${txColors[e.type][dk ? "dark" : "light"]}`}>
                                    <Ic n={isOut ? "arrowUp" : "arrowDown"} className="h-4 w-4" />
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className={`text-[12px] font-black truncate ${heading}`}>{e.description}</div>
                                    <div className={`text-[10px] ${subText} truncate`}>#{e.referenceNumber || "-"} · {shortDateLabel(e.date)} {timeLabel(e.date)}</div>
                                  </div>
                                </div>
                                <span className={`text-[9px] font-black rounded-full px-2 py-0.5 ${txColors[e.type][dk ? "dark" : "light"]}`}>{txLabels[e.type]}</span>
                              </div>
                              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-dashed border-slate-300/30">
                                <div>
                                  <div className={`text-[9px] font-bold ${subText}`}>مبلغ</div>
                                  <div className={`text-sm font-black tabular-nums ${isOut ? "text-rose-500" : "text-emerald-500"}`}>
                                    {isOut ? "-" : "+"}{fmt(e.amount)}
                                  </div>
                                  <div className={`text-[9px] ${subText}`}>{getCurrencyLabel(e.currency)}</div>
                                </div>
                                <div>
                                  <div className={`text-[9px] font-bold ${subText}`}>مانده پس از</div>
                                  <div className={`text-sm font-black tabular-nums ${currencyColors[e.currency][dk ? "dark" : "light"]}`}>{fmt(e.balanceAfter)}</div>
                                </div>
                                <div>
                                  <div className={`text-[9px] font-bold ${subText}`}>نوع</div>
                                  <div className={`text-[11px] font-black ${dk ? "text-slate-300" : "text-slate-600"}`}>{getCurrencyLabel(e.currency)}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="hidden md:block overflow-x-auto cu-scroll">
                        <table className="w-full min-w-[900px] text-sm">
                          <thead>
                            <tr className={`border-y ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
                              {["#", "تاریخ", "ساعت", "شماره سند", "نوع", "شرح", "ارز", "دریافت", "پرداخت", "مانده"].map(h => (
                                <th key={h} className="px-3 py-2.5 text-right text-[10px] font-black text-slate-400">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className={`divide-y ${dk ? "divide-slate-700/60" : "divide-slate-100"}`}>
                            {filteredLedger.map((e, i) => {
                              const isOut = e.direction === "out";
                              return (
                                <tr key={e.id} className={`transition-colors ${dk ? "hover:bg-slate-700/30" : "hover:bg-violet-50/50"}`}>
                                  <td className="px-3 py-2.5 text-[11px] font-black tabular-nums">{filteredLedger.length - i}</td>
                                  <td className={`whitespace-nowrap px-3 py-2.5 text-[11px] tabular-nums ${dk ? "text-slate-300" : "text-slate-600"}`} dir="ltr">{shortDateLabel(e.date)}</td>
                                  <td className={`whitespace-nowrap px-3 py-2.5 text-[11px] tabular-nums ${dk ? "text-slate-300" : "text-slate-600"}`} dir="ltr">{timeLabel(e.date)}</td>
                                  <td className="px-3 py-2.5">
                                    <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-black tabular-nums ${dk ? "border-slate-600 text-slate-300" : "border-slate-200 text-slate-600"}`} dir="ltr">
                                      {e.referenceNumber || "-"}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-black ${txColors[e.type][dk ? "dark" : "light"]}`}>{txLabels[e.type]}</span>
                                  </td>
                                  <td className={`px-3 py-2.5 text-[11px] max-w-xs truncate ${dk ? "text-slate-200" : "text-slate-700"}`}>{e.description}</td>
                                  <td className={`px-3 py-2.5 text-[11px] font-black ${currencyColors[e.currency][dk ? "dark" : "light"]}`}>{getCurrencyLabel(e.currency)}</td>
                                  <td className={`px-3 py-2.5 text-[11px] font-black tabular-nums ${!isOut ? "text-emerald-500" : ""}`}>{!isOut ? fmt(e.amount) : ""}</td>
                                  <td className={`px-3 py-2.5 text-[11px] font-black tabular-nums ${isOut ? "text-rose-500" : ""}`}>{isOut ? fmt(e.amount) : ""}</td>
                                  <td className={`px-3 py-2.5 text-[11px] font-black tabular-nums ${currencyColors[e.currency][dk ? "dark" : "light"]}`}>{fmt(e.balanceAfter)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}

              {profileTab === "statement" && (
                <div className={`rounded-2xl border p-4 md:p-6 ${uiCard}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <span className={`grid h-8 w-8 place-items-center rounded-lg ${dk ? "bg-fuchsia-400/15 text-fuchsia-300" : "bg-fuchsia-100 text-fuchsia-600"}`}><Ic n="doc" className="h-4 w-4" /></span>
                      <b className={`text-sm font-black ${heading}`}>صورت‌حساب کامل</b>
                    </div>
                    <button onClick={printStatement} className={`flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-l px-4 py-2 text-sm font-black shadow-lg transition-all hover:brightness-110 active:scale-95 ${dk ? "from-fuchsia-400 to-pink-400 text-slate-950" : "from-fuchsia-500 to-pink-500 text-white"}`}>
                      <Ic n="printer" className="h-4 w-4" />چاپ صورت‌حساب
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 mb-4">
                    <div className={`rounded-xl border p-4 ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-white"}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Ic n="user" className={`h-4 w-4 ${dk ? "text-violet-300" : "text-violet-600"}`} />
                        <b className={`text-xs font-black ${heading}`}>مشخصات</b>
                      </div>
                      <div className={`space-y-1 text-xs ${dk ? "text-slate-300" : "text-slate-600"}`}>
                        <div><b>نام:</b> {selectedCustomer.name}</div>
                        <div><b>کد:</b> <span dir="ltr">{selectedCustomer.id.slice(-6)}</span></div>
                        <div><b>تلفن:</b> <span dir="ltr">{selectedCustomer.phone || "-"}</span></div>
                        <div><b>تذکره:</b> <span dir="ltr">{selectedCustomer.tazkira || "-"}</span></div>
                        <div><b>آدرس:</b> {selectedCustomer.address || "-"}</div>
                      </div>
                    </div>
                    <div className={`rounded-xl border p-4 ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-white"}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Ic n="chart" className={`h-4 w-4 ${dk ? "text-emerald-300" : "text-emerald-600"}`} />
                        <b className={`text-xs font-black ${heading}`}>آمار</b>
                      </div>
                      <div className={`space-y-1 text-xs ${dk ? "text-slate-300" : "text-slate-600"}`}>
                        <div><b>تعداد رویدادها:</b> {customerLedger.length}</div>
                        <div><b>اولین رویداد:</b> {customerLedger.length > 0 ? shortDateLabel(customerLedger[0].date) : "-"}</div>
                        <div><b>آخرین رویداد:</b> {customerLedger.length > 0 ? shortDateLabel(customerLedger[customerLedger.length - 1].date) : "-"}</div>
                        <div><b>وضعیت:</b> {selectedCustomer.status === "active" ? "فعال" : "غیرفعال"}</div>
                      </div>
                    </div>
                  </div>

                  <div className={`rounded-xl border p-4 ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-white"}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <Ic n="wallet" className={`h-4 w-4 ${dk ? "text-sky-300" : "text-sky-600"}`} />
                      <b className={`text-xs font-black ${heading}`}>خلاصه مالی</b>
                    </div>
                    <div className="overflow-x-auto cu-scroll">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className={`border-b ${dk ? "border-slate-700" : "border-slate-200"}`}>
                            <th className="px-3 py-2 text-right font-black text-slate-400">ارز</th>
                            <th className="px-3 py-2 text-right font-black text-emerald-500">جمع دریافت</th>
                            <th className="px-3 py-2 text-right font-black text-rose-500">جمع پرداخت</th>
                            <th className="px-3 py-2 text-right font-black text-slate-400">خالص</th>
                            <th className="px-3 py-2 text-right font-black text-slate-400">مانده نهایی</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currencies.map(cur => {
                            const totalIn = customerLedger.filter(e => e.currency === cur && e.direction === "in").reduce((s, e) => s + e.amount, 0);
                            const totalOut = customerLedger.filter(e => e.currency === cur && e.direction === "out").reduce((s, e) => s + e.amount, 0);
                            const net = totalIn - totalOut;
                            const bal = customerBalances[cur];
                            if (totalIn === 0 && totalOut === 0) return null;
                            return (
                              <tr key={cur} className={`border-b ${dk ? "border-slate-700/50" : "border-slate-100"}`}>
                                <td className={`px-3 py-2 font-black ${currencyColors[cur][dk ? "dark" : "light"]}`}>{getCurrencyLabel(cur)}</td>
                                <td className="px-3 py-2 font-black tabular-nums text-emerald-500">{fmt(totalIn)}</td>
                                <td className="px-3 py-2 font-black tabular-nums text-rose-500">{fmt(totalOut)}</td>
                                <td className={`px-3 py-2 font-black tabular-nums ${net >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{net >= 0 ? "+" : ""}{fmt(net)}</td>
                                <td className={`px-3 py-2 font-black tabular-nums ${currencyColors[cur][dk ? "dark" : "light"]}`}>{fmt(bal)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {customerLedger.length > 0 && (
                    <div className={`rounded-xl border p-4 mt-3 ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-white"}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <Ic n="history" className={`h-4 w-4 ${dk ? "text-amber-300" : "text-amber-600"}`} />
                        <b className={`text-xs font-black ${heading}`}>آخرین رویدادها (۵ مورد آخر)</b>
                      </div>
                      <div className="space-y-2">
                        {customerLedger.slice(-5).reverse().map(e => (
                          <div key={e.id} className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${dk ? "bg-slate-900/50" : "bg-slate-50"}`}>
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${txColors[e.type][dk ? "dark" : "light"]}`}>
                                <Ic n={e.direction === "out" ? "arrowUp" : "arrowDown"} className="h-3 w-3" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className={`text-[11px] font-black truncate ${heading}`}>{e.description}</div>
                                <div className={`text-[9px] ${subText}`}>{shortDateLabel(e.date)} · #{e.referenceNumber || "-"}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-[12px] font-black tabular-nums ${e.direction === "out" ? "text-rose-500" : "text-emerald-500"}`}>
                                {e.direction === "out" ? "-" : "+"}{fmt(e.amount)}
                              </div>
                              <div className={`text-[9px] ${subText}`}>{getCurrencyLabel(e.currency)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-6 left-6 z-[99] rounded-xl px-4 py-3 text-sm font-bold shadow-lg ${dk ? "bg-slate-800 text-slate-100 border border-slate-600" : "bg-slate-900 text-white"}`}>{toast}</div>
      )}
    </div>
  );
}
