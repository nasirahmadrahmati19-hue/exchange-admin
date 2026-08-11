"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";

type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";
type OpType = "deposit" | "withdraw" | "exchange" | "fee" | "correction";
type CustomerStatus = "active" | "inactive";

type Customer = {
  id: string; name: string; phone?: string; tazkira?: string;
  address?: string; note?: string; status: CustomerStatus;
  registeredAt: string; balances: Record<Currency, number>;
};

type AccountEntry = {
  id: string; trackingCode: string; date: string; customerId: string;
  type: OpType; description: string;
  fromCurrency?: Currency; fromAmount?: number;
  toCurrency?: Currency; toAmount?: number;
  feeCurrency?: Currency; feeAmount?: number;
  rate?: number; rateLabel?: string;
  status: "active" | "voided";
};

type LedgerEntry = {
  id: string; date: string; customerId: string; type: string;
  description: string; currency: Currency; amount: number;
  direction: "in" | "out"; balanceAfter: number;
  referenceId?: string; referenceNumber?: string;
  feeAmount?: number; feeCurrency?: Currency; rateLabel?: string;
};

const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const labels: Record<Currency, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };
const opLabels: Record<OpType, string> = {
  deposit: "واریز", withdraw: "برداشت", exchange: "تبادل ارز", fee: "فی/کارمزد", correction: "اصلاح",
};
const opPrefix: Record<OpType, string> = {
  deposit: "DP", withdraw: "WD", exchange: "EX", fee: "FE", correction: "AD",
};
const opColors: Record<OpType, { light: string; dark: string }> = {
  deposit: { light: "bg-emerald-100 text-emerald-700", dark: "bg-emerald-400/15 text-emerald-300" },
  withdraw: { light: "bg-rose-100 text-rose-700", dark: "bg-rose-400/15 text-rose-300" },
  exchange: { light: "bg-sky-100 text-sky-700", dark: "bg-sky-400/15 text-sky-300" },
  fee: { light: "bg-amber-100 text-amber-700", dark: "bg-amber-400/15 text-amber-300" },
  correction: { light: "bg-orange-100 text-orange-700", dark: "bg-orange-400/15 text-orange-300" },
};
const currencyColors: Record<Currency, { light: string; dark: string; gradient: string }> = {
  AFN: { light: "text-emerald-700", dark: "text-emerald-300", gradient: "from-emerald-500 to-teal-400" },
  USD: { light: "text-sky-700", dark: "text-sky-300", gradient: "from-sky-500 to-cyan-400" },
  EUR: { light: "text-blue-700", dark: "text-blue-300", gradient: "from-blue-600 to-blue-400" },
  IRR: { light: "text-amber-700", dark: "text-amber-300", gradient: "from-amber-500 to-orange-400" },
  PKR: { light: "text-rose-700", dark: "text-rose-300", gradient: "from-rose-500 to-pink-400" },
};

const CUSTOMERS_KEY = "fx-customers";
const TRANSACTIONS_KEY = "fx-transactions";
const HAWALAS_KEY = "hawalas";
const ACCOUNT_ENTRIES_KEY = "account-entries";
const SHARED_COUNTER_KEY = "shared-tracking-counter";

const defaultCustomers: Customer[] = [
  { id: "1", name: "احمد رحیمی", phone: "0700123456", tazkira: "1400-001-001", address: "هرات، گلران", note: "مشتری ویژه", status: "active", registeredAt: "2025-01-15T10:00:00Z", balances: { AFN: 500000, USD: 10000, EUR: 0, IRR: 0, PKR: 0 } },
  { id: "2", name: "محمد ظاهر", phone: "0700654321", tazkira: "1400-002-002", address: "هرات، انجیل", note: "", status: "active", registeredAt: "2025-02-20T14:30:00Z", balances: { AFN: 200000, USD: 5000, EUR: 0, IRR: 0, PKR: 0 } },
  { id: "3", name: "فاطمه حسینی", phone: "0700789123", tazkira: "1400-003-003", address: "هرات، مرکز", note: "معاملات عمده", status: "active", registeredAt: "2025-03-05T09:15:00Z", balances: { AFN: 0, USD: 0, EUR: 0, IRR: 50000000, PKR: 0 } },
];

const generateId = (): string => {
  try { if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID(); } catch {}
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const safeGetItem = (key: string): any => {
  if (typeof window === "undefined") return null;
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
};

const isCurrency = (v: any): v is Currency => typeof v === "string" && (currencies as string[]).includes(v);

const normalizeDigits = (value: string) => {
  const pd = "۰۱۲۳۴۵۶۷۸۹"; const ad = "٠١٢٣٤٥٦٧٨٩";
  return String(value || "").replace(/[۰-۹]/g, d => String(pd.indexOf(d))).replace(/[٠-٩]/g, d => String(ad.indexOf(d)));
};

const toNumericText = (v: string) => {
  let s = normalizeDigits(String(v || "")).replace(/[^0-9.]/g, "");
  const fd = s.indexOf(".");
  if (fd !== -1) s = s.slice(0, fd + 1) + s.slice(fd + 1).replace(/\./g, "");
  return s;
};

const parseAmount = (v: string) => {
  const n = Number(normalizeDigits(String(v || "")).replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const fmt = (n: number) => (Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0");

function shamsiParts(d: Date) {
  try {
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
    const get = (type: string) => parts.find((p) => p.type === type)?.value || "0";
    return { year: get("year"), month: get("month"), day: get("day") };
  } catch { return { year: "0", month: "0", day: "0" }; }
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

/* ✅ کد پیگیری مشترک */
function getSharedCounter(): number {
  if (typeof window === "undefined") return 0;
  try { const v = localStorage.getItem(SHARED_COUNTER_KEY); return v ? (parseInt(v, 10) || 0) : 0; } catch { return 0; }
}

function setSharedCounter(value: number) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(SHARED_COUNTER_KEY, String(value)); } catch {}
}

function getNextSharedCode(prefix: string): string {
  return `${prefix}-${String(getSharedCounter() + 1).padStart(4, "0")}`;
}

function consumeSharedCode(prefix: string): string {
  const next = getSharedCounter() + 1;
  setSharedCounter(next);
  return `${prefix}-${String(next).padStart(4, "0")}`;
}

function initSharedCounterFromAllSources(): void {
  try {
    let maxNum = 0;
    for (const key of [TRANSACTIONS_KEY, HAWALAS_KEY, ACCOUNT_ENTRIES_KEY]) {
      const items = safeGetItem(key);
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (!item) continue;
        const code = item.trackingCode || item.number || "";
        const match = String(code).match(/(\d+)$/);
        if (match) maxNum = Math.max(maxNum, Number(match[1]) || 0);
      }
    }
    if (getSharedCounter() < maxNum) setSharedCounter(maxNum);
  } catch {}
}

const loadCustomers = (): Customer[] => {
  if (typeof window === "undefined") return defaultCustomers;
  try {
    const parsed = safeGetItem(CUSTOMERS_KEY);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.id && parsed[0]?.name) {
      return parsed.map((c: any) => ({
        id: c.id || generateId(), name: c.name || "", phone: c.phone || "", tazkira: c.tazkira || "",
        address: c.address || "", note: c.note || "", status: c.status === "inactive" ? "inactive" : "active",
        registeredAt: c.registeredAt || c.createdAt || new Date().toISOString(),
        balances: {
          AFN: Number(c.balances?.AFN || 0) || 0, USD: Number(c.balances?.USD || 0) || 0,
          EUR: Number(c.balances?.EUR || 0) || 0, IRR: Number(c.balances?.IRR || 0) || 0,
          PKR: Number(c.balances?.PKR || 0) || 0,
        },
      }));
    }
    return defaultCustomers;
  } catch { return defaultCustomers; }
};

const loadEntries = (): AccountEntry[] => {
  if (typeof window === "undefined") return [];
  try {
    const parsed = safeGetItem(ACCOUNT_ENTRIES_KEY);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e: any) => e?.id).map((e: any): AccountEntry => ({
      id: e.id, trackingCode: e.trackingCode || "",
      type: (["deposit", "withdraw", "exchange", "fee", "correction"] as OpType[]).includes(e.type) ? e.type : "deposit",
      date: e.date || new Date().toISOString(), customerId: e.customerId || "",
      description: e.description || "",
      fromCurrency: isCurrency(e.fromCurrency) ? e.fromCurrency : undefined,
      fromAmount: Number(e.fromAmount || 0) || 0,
      toCurrency: isCurrency(e.toCurrency) ? e.toCurrency : undefined,
      toAmount: Number(e.toAmount || 0) || 0,
      feeCurrency: isCurrency(e.feeCurrency) ? e.feeCurrency : undefined,
      feeAmount: Number(e.feeAmount || 0) || 0,
      rate: Number(e.rate || 0) || 0, rateLabel: e.rateLabel || "",
      status: e.status === "voided" ? "voided" : "active",
    }));
  } catch { return []; }
};

/* ✅ Build Ledger - ترکیب همه منابع */
function buildCombinedLedger(customers: Customer[], entries: AccountEntry[], txs: any[], hws: any[]): LedgerEntry[] {
  const ledger: LedgerEntry[] = [];
  try {
    // از تب حساب مشتریان
    for (const e of entries) {
      if (!e || e.status === "voided") continue;
      if (e.type === "deposit" && e.fromCurrency && e.fromAmount) {
        ledger.push({ id: `${e.id}-in`, date: e.date, customerId: e.customerId, type: "deposit",
          description: e.description || `واریز ${labels[e.fromCurrency]}`,
          currency: e.fromCurrency, amount: e.fromAmount, direction: "in", balanceAfter: 0,
          referenceId: e.id, referenceNumber: e.trackingCode });
      }
      if (e.type === "withdraw" && e.fromCurrency && e.fromAmount) {
        ledger.push({ id: `${e.id}-out`, date: e.date, customerId: e.customerId, type: "withdraw",
          description: e.description || `برداشت ${labels[e.fromCurrency]}`,
          currency: e.fromCurrency, amount: e.fromAmount, direction: "out", balanceAfter: 0,
          referenceId: e.id, referenceNumber: e.trackingCode });
      }
      if (e.type === "exchange" && e.fromCurrency && e.toCurrency && e.fromAmount && e.toAmount) {
        ledger.push({ id: `${e.id}-out`, date: e.date, customerId: e.customerId, type: "exchange",
          description: `فروش ${labels[e.fromCurrency]} ${e.rateLabel ? `- ${e.rateLabel}` : ""}`,
          currency: e.fromCurrency, amount: e.fromAmount, direction: "out", balanceAfter: 0,
          referenceId: e.id, referenceNumber: e.trackingCode, rateLabel: e.rateLabel });
        ledger.push({ id: `${e.id}-in`, date: e.date, customerId: e.customerId, type: "exchange",
          description: `خرید ${labels[e.toCurrency]} ${e.rateLabel ? `- ${e.rateLabel}` : ""}`,
          currency: e.toCurrency, amount: e.toAmount, direction: "in", balanceAfter: 0,
          referenceId: e.id, referenceNumber: e.trackingCode, rateLabel: e.rateLabel });
        if (e.feeAmount && e.feeAmount > 0 && e.feeCurrency) {
          ledger.push({ id: `${e.id}-fee`, date: e.date, customerId: e.customerId, type: "fee",
            description: "فی/کارمزد", currency: e.feeCurrency, amount: e.feeAmount, direction: "out",
            balanceAfter: 0, referenceId: e.id, referenceNumber: e.trackingCode });
        }
      }
      if (e.type === "fee" && e.feeCurrency && e.feeAmount) {
        ledger.push({ id: `${e.id}-fee`, date: e.date, customerId: e.customerId, type: "fee",
          description: e.description || "فی/کارمزد",
          currency: e.feeCurrency, amount: e.feeAmount, direction: "out", balanceAfter: 0,
          referenceId: e.id, referenceNumber: e.trackingCode });
      }
    }

    // از تب معاملات
    for (const tx of txs) {
      if (!tx || tx.status === "voided") continue;
      const date = tx.date || new Date().toISOString();
      const refNum = tx.trackingCode || (tx.id ? String(tx.id).slice(-6) : "");
      if (tx.type === "exchange" && tx.customerId && isCurrency(tx.fromCurrency) && isCurrency(tx.toCurrency)) {
        ledger.push({ id: `${tx.id}-ex-out`, date, customerId: tx.customerId, type: "exchange",
          description: `فروش ${labels[tx.fromCurrency]} - ${tx.rateLabel || ""}`,
          currency: tx.fromCurrency, amount: Number(tx.fromAmount || 0) || 0, direction: "out",
          balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum, rateLabel: tx.rateLabel });
        ledger.push({ id: `${tx.id}-ex-in`, date, customerId: tx.customerId, type: "exchange",
          description: `خرید ${labels[tx.toCurrency]} - ${tx.rateLabel || ""}`,
          currency: tx.toCurrency, amount: Number(tx.toAmount || 0) || 0, direction: "in",
          balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum, rateLabel: tx.rateLabel });
        if (tx.commission && isCurrency(tx.commissionCurrency)) {
          ledger.push({ id: `${tx.id}-ex-fee`, date, customerId: tx.customerId, type: "fee",
            description: "فی معامله", currency: tx.commissionCurrency,
            amount: Number(tx.commission || 0) || 0, direction: "out",
            balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum });
        }
      }
      if (tx.type === "transfer") {
        if (tx.senderId && isCurrency(tx.fromCurrency)) {
          ledger.push({ id: `${tx.id}-tr-s`, date, customerId: tx.senderId, type: "transfer",
            description: `انتقال به ${customers.find(c => c.id === tx.receiverId)?.name || "—"}`,
            currency: tx.fromCurrency, amount: Number(tx.fromAmount || 0) || 0, direction: "out",
            balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum });
        }
        if (tx.receiverId && isCurrency(tx.toCurrency)) {
          ledger.push({ id: `${tx.id}-tr-r`, date, customerId: tx.receiverId, type: "transfer",
            description: `دریافت از ${customers.find(c => c.id === tx.senderId)?.name || "—"}`,
            currency: tx.toCurrency, amount: Number(tx.toAmount || 0) || 0, direction: "in",
            balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum });
        }
      }
    }

    // از تب حواله‌جات
    for (const h of hws) {
      if (!h || h.status === "cancelled") continue;
      const sender = customers.find(c => c.name === h.senderName);
      const receiver = customers.find(c => c.name === h.receiverName);
      if (sender && isCurrency(h.currencyFrom)) {
        ledger.push({ id: `${h.id}-hw-s`, date: h.date, customerId: sender.id, type: "hawala",
          description: `حواله به ${h.receiverName}`, currency: h.currencyFrom,
          amount: Number(h.amountFrom || 0) || 0, direction: "out", balanceAfter: 0,
          referenceId: h.id, referenceNumber: h.number });
        if (h.feePayer === "sender" && h.fee && isCurrency(h.feeCurrency)) {
          ledger.push({ id: `${h.id}-hw-sf`, date: h.date, customerId: sender.id, type: "fee",
            description: "فی حواله", currency: h.feeCurrency, amount: Number(h.fee || 0) || 0,
            direction: "out", balanceAfter: 0, referenceId: h.id, referenceNumber: h.number });
        }
      }
      if (receiver && h.status === "paid" && isCurrency(h.currencyTo)) {
        ledger.push({ id: `${h.id}-hw-r`, date: h.paidAt || h.date, customerId: receiver.id, type: "hawala",
          description: `دریافت حواله از ${h.senderName}`, currency: h.currencyTo,
          amount: Number(h.finalAmount || 0) || 0, direction: "in", balanceAfter: 0,
          referenceId: h.id, referenceNumber: h.number });
        if (h.feePayer === "receiver" && h.fee && isCurrency(h.feeCurrency)) {
          ledger.push({ id: `${h.id}-hw-rf`, date: h.paidAt || h.date, customerId: receiver.id, type: "fee",
            description: "فی حواله", currency: h.feeCurrency, amount: Number(h.fee || 0) || 0,
            direction: "out", balanceAfter: 0, referenceId: h.id, referenceNumber: h.number });
        }
      }
    }

    ledger.sort((a, b) => {
      try { return new Date(a.date).getTime() - new Date(b.date).getTime(); } catch { return 0; }
    });

    const running: Record<string, Record<Currency, number>> = {};
    for (const c of customers) running[c.id] = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    for (const e of ledger) {
      if (!running[e.customerId]) running[e.customerId] = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
      if (!isCurrency(e.currency)) continue;
      running[e.customerId][e.currency] += (e.direction === "in" ? e.amount : -e.amount);
      e.balanceAfter = running[e.customerId][e.currency];
    }
  } catch (err) { console.error("Ledger error:", err); }
  return ledger;
}

function computeBalances(ledger: LedgerEntry[], customerId: string): Record<Currency, number> {
  const balances: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
  for (const e of ledger) {
    if (e.customerId !== customerId || !isCurrency(e.currency)) continue;
    balances[e.currency] += (e.direction === "in" ? e.amount : -e.amount);
  }
  return balances;
}

const iconPaths = {
  users: "M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z",
  user: "M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z",
  search: "m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z",
  plus: "M12 4.5v15m7.5-7.5h-15",
  chevron: "m19.5 8.25-7.5 7.5-7.5-7.5",
  check: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  doc: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
  wallet: "M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3",
  history: "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  chart: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z",
  printer: "M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z",
  arrowUp: "M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18",
  arrowDown: "M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3",
  eye: "M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  inbox: "M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z",
  alert: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z",
  sun: "M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z",
  moon: "M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z",
  sparkle: "M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z",
  arrowLeft: "M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18",
  swap: "M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5",
  tag: "M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z",
  x: "M6 18 18 6M6 6l12 12",
  filter: "M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.406a1.5 1.5 0 0 1-.44 1.061l-4.67 4.66V19.5a1.5 1.5 0 0 1-.64 1.235l-3 2A1.5 1.5 0 0 1 10.5 21.5v-8.404l-4.67-4.66a1.5 1.5 0 0 1-.44-1.06V5.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z",
};

type IconName = keyof typeof iconPaths;
function Ic({ n, className = "h-5 w-5" }: { n: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={iconPaths[n]} />
    </svg>
  );
}

export default function CustomerAccountsPage() {
  const [mounted, setMounted] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>(defaultCustomers);
  const [entries, setEntries] = useState<AccountEntry[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [hawalas, setHawalas] = useState<any[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [toast, setToast] = useState("");

  const [mainTab, setMainTab] = useState<"list" | "operation" | "journal">("list");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // فرم عملیات
  const [opType, setOpType] = useState<OpType>("deposit");
  const [opCustomerId, setOpCustomerId] = useState<string[]>([]);
  const [opCurrency, setOpCurrency] = useState<Currency>("AFN");
  const [opAmount, setOpAmount] = useState("");
  const [opCurrencyTo, setOpCurrencyTo] = useState<Currency>("USD");
  const [opAmountTo, setOpAmountTo] = useState("");
  const [opRate, setOpRate] = useState("");
  const [opFeeCurrency, setOpFeeCurrency] = useState<Currency>("AFN");
  const [opFeeAmount, setOpFeeAmount] = useState("");
  const [opDescription, setOpDescription] = useState("");

  // گزارش
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");

  // فیلتر روزنامه
  const [journalSearch, setJournalSearch] = useState("");
  const [journalTypeFilter, setJournalTypeFilter] = useState<string>("all");
  const [journalCurrencyFilter, setJournalCurrencyFilter] = useState<string>("all");

  // رسید
  const [viewEntry, setViewEntry] = useState<LedgerEntry | null>(null);

  useEffect(() => {
    try { const s = window.localStorage.getItem("fx-theme"); if (s === "dark" || s === "light") setTheme(s); } catch {}
  }, []);
  useEffect(() => { try { window.localStorage.setItem("fx-theme", theme); } catch {} }, [theme]);
  const dk = theme === "dark";

  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const currentDateTime = now ? formatDateTime(now) : "";

  useEffect(() => {
    try {
      setCustomers(loadCustomers());
      setEntries(loadEntries());
      setTransactions(safeGetItem(TRANSACTIONS_KEY) || []);
      setHawalas(safeGetItem(HAWALAS_KEY) || []);
      initSharedCounterFromAllSources();
    } catch (err) { console.error(err); }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try { localStorage.setItem(ACCOUNT_ENTRIES_KEY, JSON.stringify(entries)); } catch {}
  }, [entries, mounted]);

  const ledger = useMemo(() => buildCombinedLedger(customers, entries, transactions, hawalas),
    [customers, entries, transactions, hawalas]);

  const filteredCustomers = useMemo(() => {
    const q = normalizeDigits(search.trim()).toLowerCase();
    if (!q) return customers;
    return customers.filter(c => {
      const fields = [c.name, c.phone || "", c.tazkira || "", c.id].map(f => normalizeDigits(String(f)).toLowerCase());
      return fields.some(f => f.includes(q));
    });
  }, [customers, search]);

  const selectedCustomer = selectedCustomerId ? customers.find(c => c.id === selectedCustomerId) : null;
  const customerLedger = useMemo(() => ledger.filter(e => e.customerId === selectedCustomerId), [ledger, selectedCustomerId]);
  const customerBalances = useMemo(() => selectedCustomerId ? computeBalances(ledger, selectedCustomerId) : null, [ledger, selectedCustomerId]);

  // گزارش با فیلتر بازه زمانی
  const reportData = useMemo(() => {
    if (!selectedCustomerId || !customerBalances) return null;
    const fromTs = reportFrom ? new Date(reportFrom).getTime() : -Infinity;
    const toTs = reportTo ? new Date(reportTo).getTime() + 86400000 : Infinity;
    const filtered = customerLedger.filter(e => {
      const t = new Date(e.date).getTime();
      return t >= fromTs && t <= toTs;
    });
    const stats: Record<Currency, { in: number; out: number; fee: number }> = {
      AFN: { in: 0, out: 0, fee: 0 }, USD: { in: 0, out: 0, fee: 0 }, EUR: { in: 0, out: 0, fee: 0 },
      IRR: { in: 0, out: 0, fee: 0 }, PKR: { in: 0, out: 0, fee: 0 },
    };
    for (const e of filtered) {
      if (!isCurrency(e.currency)) continue;
      if (e.type === "fee") stats[e.currency].fee += e.amount;
      else if (e.direction === "in") stats[e.currency].in += e.amount;
      else stats[e.currency].out += e.amount;
    }
    return { entries: filtered, stats, count: filtered.length };
  }, [selectedCustomerId, customerLedger, reportFrom, reportTo, customerBalances]);

  // روزنامه کل
  const journalEntries = useMemo(() => {
    const q = normalizeDigits(journalSearch.trim()).toLowerCase();
    return ledger.filter(e => {
      if (journalTypeFilter !== "all" && e.type !== journalTypeFilter) return false;
      if (journalCurrencyFilter !== "all" && e.currency !== journalCurrencyFilter) return false;
      if (!q) return true;
      const custName = customers.find(c => c.id === e.customerId)?.name || "";
      const fields = [e.description, e.referenceNumber || "", custName, String(e.amount)].map(f => normalizeDigits(String(f)).toLowerCase());
      return fields.some(f => f.includes(q));
    }).reverse();
  }, [ledger, journalSearch, journalTypeFilter, journalCurrencyFilter, customers]);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(""), 3500); };

  const resetOpForm = () => {
    setOpCustomerId([]); setOpCurrency("AFN"); setOpAmount("");
    setOpCurrencyTo("USD"); setOpAmountTo(""); setOpRate("");
    setOpFeeCurrency("AFN"); setOpFeeAmount(""); setOpDescription("");
  };

  const submitOperation = () => {
    if (opCustomerId.length === 0) { showToast("مشتری را انتخاب کنید."); return; }
    const amt = parseAmount(opAmount);
    const amtTo = parseAmount(opAmountTo);
    const fee = parseAmount(opFeeAmount);
    const rate = parseAmount(opRate);

    if (opType === "deposit" && amt <= 0) { showToast("مبلغ واریز باید بزرگتر از صفر باشد."); return; }
    if (opType === "withdraw" && amt <= 0) { showToast("مبلغ برداشت باید بزرگتر از صفر باشد."); return; }
    if (opType === "exchange" && (amt <= 0 || amtTo <= 0)) { showToast("هر دو مبلغ باید پر شوند."); return; }
    if (opType === "fee" && fee <= 0) { showToast("مبلغ فی باید بزرگتر از صفر باشد."); return; }

    // چک موجودی برای برداشت (اجازه مانده منفی)
    // اما نمایش هشدار اگر مانده منفی می‌شود

    const prefix = opPrefix[opType];
    const nowDate = new Date().toISOString();

    const newEntries: AccountEntry[] = [];
    for (const cid of opCustomerId) {
      newEntries.push({
        id: generateId(), trackingCode: consumeSharedCode(prefix), type: opType,
        date: nowDate, customerId: cid, description: opDescription.trim(),
        fromCurrency: opType !== "fee" ? opCurrency : undefined,
        fromAmount: opType !== "fee" ? amt : undefined,
        toCurrency: opType === "exchange" ? opCurrencyTo : undefined,
        toAmount: opType === "exchange" ? amtTo : undefined,
        feeCurrency: opType === "exchange" ? (fee > 0 ? opFeeCurrency : undefined) : (opType === "fee" ? opFeeCurrency : undefined),
        feeAmount: opType === "exchange" ? (fee > 0 ? fee : undefined) : (opType === "fee" ? fee : undefined),
        rate: opType === "exchange" ? rate : undefined,
        rateLabel: opType === "exchange" ? `${fmt(rate)} ${labels[opCurrencyTo]} = 1 ${labels[opCurrency]}` : undefined,
        status: "active",
      });
    }

    setEntries(prev => [...newEntries, ...prev]);
    resetOpForm();
    showToast(`${opLabels[opType]} برای ${opCustomerId.length} مشتری ثبت شد.`);
    setMainTab("journal");
  };

  const voidEntry = (entry: AccountEntry) => {
    if (entry.status === "voided") return;
    if (!window.confirm("این عملیات لغو شود؟")) return;
    setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: "voided" } : e));
    showToast("عملیات لغو شد.");
  };

  const openCustomer = (id: string) => { setSelectedCustomerId(id); setReportFrom(""); setReportTo(""); };
  const backToList = () => { setSelectedCustomerId(null); setMainTab("list"); };

  const printReceipt = (e: LedgerEntry) => {
    try {
      const win = window.open("", "_blank", "width=700,height=800");
      if (!win) return;
      const cust = customers.find(c => c.id === e.customerId);
      const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>رسید</title>
        <style>body{font-family:Tahoma;padding:24px;direction:rtl}
        h1{text-align:center;color:#0369a1;border-bottom:3px double #0ea5e9;padding-bottom:12px}
        table{width:100%;border-collapse:collapse;margin-top:16px}
        td,th{border:1px solid #cbd5e1;padding:10px;text-align:right;font-size:13px}
        th{background:#f0f9ff;color:#0369a1}
        .tracking{text-align:center;background:#ecfeff;border:2px solid #0ea5e9;border-radius:8px;padding:16px;font-size:24px;font-weight:bold;color:#0369a1;margin:16px 0}
        .footer{margin-top:24px;padding-top:12px;border-top:1px solid #cbd5e1;font-size:11px;color:#64748b;text-align:center}
        </style></head><body>
        <h1>رسید معامله</h1>
        <div class="tracking">${e.referenceNumber || "-"}</div>
        <table>
          <tr><th>شماره سند</th><td>${e.referenceNumber || "-"}</td></tr>
          <tr><th>تاریخ و ساعت</th><td dir="ltr">${dateLabel(e.date)}</td></tr>
          <tr><th>نوع عملیات</th><td>${e.type}</td></tr>
          <tr><th>مشتری</th><td>${cust?.name || "-"}</td></tr>
          <tr><th>شرح</th><td>${e.description}</td></tr>
          <tr><th>ارز</th><td>${labels[e.currency]}</td></tr>
          <tr><th>مبلغ</th><td>${e.direction === "in" ? "+" : "-"}${fmt(e.amount)}</td></tr>
          ${e.rateLabel ? `<tr><th>نرخ</th><td>${e.rateLabel}</td></tr>` : ""}
          ${e.feeAmount ? `<tr><th>فی/کارمزد</th><td>${fmt(e.feeAmount)} ${e.feeCurrency ? labels[e.feeCurrency] : ""}</td></tr>` : ""}
          <tr><th>مانده پس از معامله</th><td>${fmt(e.balanceAfter)}</td></tr>
        </table>
        <div class="footer">این رسید به‌صورت خودکار توسط سیستم صرافی تولید شده است.</div>
        </body></html>`;
      win.document.write(html); win.document.close(); win.focus(); win.print();
    } catch {}
  };

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
  const uiCard = `rounded-2xl border backdrop-blur ${dk ? "border-slate-700 bg-slate-800/90 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.6)]" : "border-sky-100 bg-white/95 shadow-[0_16px_40px_-28px_rgba(2,132,199,0.35)]"}`;
  const inputShell = `rounded-xl border text-sm font-medium shadow-sm outline-none transition-all focus:ring-4 ${dk ? "border-slate-600 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-indigo-400 focus:ring-indigo-400/10" : "border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-indigo-500/10"}`;
  const uiInput = `h-12 w-full px-3.5 ${inputShell}`;
  const uiLabel = `mb-1.5 block text-[11px] font-black ${dk ? "text-slate-400" : "text-slate-500"}`;
  const chevPos = `pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${dk ? "text-slate-500" : "text-slate-400"}`;

  const fld = (label: string, node: ReactNode, cls = "") => (<div className={cls}><label className={uiLabel}>{label}</label>{node}</div>);

  const mainTabs = [
    { id: "list" as const, label: "فهرست مشتریان", icon: "users" as IconName },
    { id: "operation" as const, label: "ثبت عملیات", icon: "plus" as IconName },
    { id: "journal" as const, label: "روزنامه معاملات", icon: "doc" as IconName },
  ];

  return (
    <div dir="rtl" className={dk ? "dark" : ""}>
      <style>{`@import url("https://fonts.googleapis.com/css2?family=Lalezar&family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap");.ca-font{font-family:"Vazirmatn","Segoe UI",Tahoma,sans-serif}.ca-display{font-family:"Lalezar","Vazirmatn",Tahoma,sans-serif;letter-spacing:.01em}.dark{color-scheme:dark}@keyframes caUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}.ca-up{animation:caUp .5s cubic-bezier(.22,.8,.35,1) both}.ca-scroll::-webkit-scrollbar{height:6px;width:6px}.ca-scroll::-webkit-scrollbar-thumb{background:rgba(99,102,241,.3);border-radius:3px}.ca-scroll{scrollbar-width:thin}`}</style>

      <div className={`ca-font relative min-h-screen ${dk ? "bg-[#0f172a] text-slate-100" : "bg-gradient-to-br from-indigo-50 via-violet-50 to-sky-50 text-slate-800"}`}>
        <div className={`fixed inset-x-0 top-0 z-30 h-1 bg-gradient-to-l ${dk ? "from-indigo-400 via-violet-400 to-fuchsia-400" : "from-indigo-500 via-violet-500 to-fuchsia-500"}`} />

        <div className="relative z-10 mx-auto w-full max-w-7xl space-y-4 px-3 pb-16 pt-5 md:px-8 md:pt-9">
          {/* سربرگ */}
          <header className="ca-up flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative grid h-11 w-11 md:h-14 md:w-14 place-items-center rounded-xl md:rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-400 text-white shadow-lg">
                <Ic n="wallet" className="h-5 w-5 md:h-6 md:w-6" />
                <span className={`absolute -bottom-1 -left-1 grid h-4 min-w-4 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-400 px-1 text-[7px] font-black text-white ring-2 ${dk ? "ring-[#0f172a]" : "ring-white"}`}>CA</span>
              </div>
              <div>
                <h1 className={`ca-display text-2xl md:text-4xl leading-none ${heading}`}>حساب مشتریان</h1>
                <p className={`mt-1 text-[10px] md:text-xs font-bold ${subText}`}>حساب جاری و گردش مالی مشتریان</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`hidden sm:flex items-center gap-2 rounded-xl border px-3 py-2 ${glassChip}`}>
                <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" /></span>
                <span dir="ltr" className={`text-xs font-bold tabular-nums ${dk ? "text-slate-100" : "text-slate-700"}`}>{currentDateTime || "--:--"}</span>
              </div>
              <button onClick={() => setTheme(dk ? "light" : "dark")} className={`grid h-10 w-10 place-items-center rounded-xl border ${dk ? "border-slate-600 bg-slate-800 text-amber-300" : "border-slate-200 bg-white text-slate-600"}`}>
                {dk ? <Ic n="sun" className="h-4 w-4" /> : <Ic n="moon" className="h-4 w-4" />}
              </button>
            </div>
          </header>

          {/* تب‌های اصلی */}
          {!selectedCustomerId && (
            <div className={`ca-up flex gap-1.5 rounded-xl border p-1.5 ${glassChip}`}>
              {mainTabs.map(tab => (
                <button key={tab.id} onClick={() => setMainTab(tab.id)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-black transition-all ${mainTab === tab.id ? `bg-gradient-to-l ${dk ? "from-indigo-400 to-violet-400 text-slate-950" : "from-indigo-500 to-violet-500 text-white"}` : dk ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-700"}`}>
                  <Ic n={tab.icon} className="h-4 w-4" />{tab.label}
                </button>
              ))}
            </div>
          )}

          {/* ================= صفحه حساب مشتری ================= */}
          {selectedCustomerId && selectedCustomer && customerBalances && (
            <section className="ca-up space-y-4">
              <button onClick={backToList} className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold ${dk ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                <Ic n="chevron" className="h-3.5 w-3.5 rotate-90" />بازگشت به فهرست
              </button>

              {/* اطلاعات مشتری */}
              <div className={`relative overflow-hidden rounded-2xl border p-5 ${uiCard}`}>
                <div className="flex flex-wrap items-start gap-4">
                  <div className={`grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white font-black text-3xl shadow-xl`}>
                    {selectedCustomer.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className={`ca-display text-2xl ${heading}`}>{selectedCustomer.name}</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs mt-2">
                      <div><span className={`font-bold ${subText}`}>کد:</span> <span className="font-black tabular-nums" dir="ltr">{selectedCustomer.id.slice(-6)}</span></div>
                      <div><span className={`font-bold ${subText}`}>تلفن:</span> <span className="font-black tabular-nums" dir="ltr">{selectedCustomer.phone || "-"}</span></div>
                      <div><span className={`font-bold ${subText}`}>تذکره:</span> <span className="font-black tabular-nums" dir="ltr">{selectedCustomer.tazkira || "-"}</span></div>
                      <div><span className={`font-bold ${subText}`}>ثبت:</span> <span className="font-black tabular-nums" dir="ltr">{shortDateLabel(selectedCustomer.registeredAt)}</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ۵ کارت موجودی */}
              <div className={`rounded-2xl border p-4 ${uiCard}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Ic n="wallet" className={`h-5 w-5 ${dk ? "text-emerald-300" : "text-emerald-600"}`} />
                  <b className={`text-sm font-black ${heading}`}>موجودی فعلی</b>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {currencies.map(cur => {
                    const bal = customerBalances[cur];
                    const colors = currencyColors[cur];
                    const isDebt = bal < 0;
                    return (
                      <div key={cur} className={`rounded-xl border p-3 ${dk ? "border-slate-700 bg-slate-900/50" : "border-slate-200 bg-slate-50"}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[10px] font-black ${subText}`}>{labels[cur]}</span>
                          <span className={`grid h-5 w-5 place-items-center rounded-md bg-gradient-to-br ${colors.gradient} text-white text-[9px] font-black`}>{cur}</span>
                        </div>
                        <div className={`text-lg font-black tabular-nums ${isDebt ? "text-rose-500" : colors[dk ? "dark" : "light"]}`}>
                          {fmt(bal)}
                        </div>
                        {isDebt && <div className="text-[9px] font-bold text-rose-500 mt-1">قرض از صرافی</div>}
                        {bal > 0 && <div className={`text-[9px] font-bold mt-1 ${subText}`}>طلب از صرافی</div>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* فیلتر گزارش */}
              <div className={`rounded-2xl border p-4 ${uiCard}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Ic n="filter" className={`h-5 w-5 ${dk ? "text-amber-300" : "text-amber-600"}`} />
                  <b className={`text-sm font-black ${heading}`}>گزارش با بازه زمانی</b>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)} className={uiInput} />
                  <input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)} className={uiInput} />
                </div>
                {reportData && (
                  <div className="mt-3">
                    <div className={`mb-2 text-xs font-bold ${subText}`}>تعداد رویدادها در این بازه: {reportData.count}</div>
                    <div className="space-y-2">
                      {currencies.map(cur => {
                        const s = reportData.stats[cur];
                        if (s.in === 0 && s.out === 0 && s.fee === 0) return null;
                        return (
                          <div key={cur} className={`rounded-lg border p-2.5 ${dk ? "border-slate-700 bg-slate-900/50" : "border-slate-200 bg-white"}`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <b className={`text-xs font-black ${currencyColors[cur][dk ? "dark" : "light"]}`}>{labels[cur]}</b>
                              <span className={`text-xs font-black tabular-nums ${currencyColors[cur][dk ? "dark" : "light"]}`}>{fmt(customerBalances[cur])}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-1 text-[10px]">
                              <div className={`rounded px-1.5 py-1 ${dk ? "bg-emerald-400/10 text-emerald-300" : "bg-emerald-50 text-emerald-700"}`}>
                                <div className="font-bold">دریافت</div>
                                <div className="font-black tabular-nums">{fmt(s.in)}</div>
                              </div>
                              <div className={`rounded px-1.5 py-1 ${dk ? "bg-rose-400/10 text-rose-300" : "bg-rose-50 text-rose-700"}`}>
                                <div className="font-bold">پرداخت</div>
                                <div className="font-black tabular-nums">{fmt(s.out)}</div>
                              </div>
                              <div className={`rounded px-1.5 py-1 ${dk ? "bg-amber-400/10 text-amber-300" : "bg-amber-50 text-amber-700"}`}>
                                <div className="font-bold">فی/کارمزد</div>
                                <div className="font-black tabular-nums">{fmt(s.fee)}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* گردش حساب */}
              <div className={`rounded-2xl border p-4 ${uiCard}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Ic n="history" className={`h-5 w-5 ${dk ? "text-sky-300" : "text-sky-600"}`} />
                    <b className={`text-sm font-black ${heading}`}>گردش حساب</b>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${dk ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"}`}>{customerLedger.length}</span>
                  </div>
                </div>
                {customerLedger.length === 0 ? (
                  <div className={`text-center py-10 ${subText}`}>
                    <Ic n="inbox" className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-bold">هنوز عملیاتی ثبت نشده است.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto ca-scroll">
                    <table className="w-full min-w-[1000px] text-xs">
                      <thead>
                        <tr className={`border-y ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
                          {["تاریخ", "ساعت", "شماره سند", "نوع", "شرح", "ارز", "دریافت", "پرداخت", "نرخ", "فی", "مانده", ""].map(h => (
                            <th key={h} className="px-3 py-2.5 text-right text-[10px] font-black text-slate-400">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${dk ? "divide-slate-700/60" : "divide-slate-100"}`}>
                        {[...customerLedger].reverse().map(e => {
                          const isOut = e.direction === "out";
                          const txType = e.type as OpType;
                          return (
                            <tr key={e.id} className={dk ? "hover:bg-slate-700/30" : "hover:bg-indigo-50/50"}>
                              <td className={`whitespace-nowrap px-3 py-2 tabular-nums ${dk ? "text-slate-300" : "text-slate-600"}`} dir="ltr">{shortDateLabel(e.date)}</td>
                              <td className={`whitespace-nowrap px-3 py-2 tabular-nums ${dk ? "text-slate-300" : "text-slate-600"}`} dir="ltr">{timeLabel(e.date)}</td>
                              <td className="px-3 py-2">
                                <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-black tabular-nums ${dk ? "border-slate-600 text-slate-300" : "border-slate-200 text-slate-600"}`} dir="ltr">
                                  <Ic n="tag" className="h-2.5 w-2.5" />{e.referenceNumber || "-"}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-black ${(opColors as any)[txType]?.[dk ? "dark" : "light"] || (dk ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600")}`}>
                                  {(opLabels as any)[txType] || e.type}
                                </span>
                              </td>
                              <td className={`px-3 py-2 max-w-[180px] truncate ${dk ? "text-slate-200" : "text-slate-700"}`}>{e.description}</td>
                              <td className={`px-3 py-2 font-black ${currencyColors[e.currency][dk ? "dark" : "light"]}`}>{labels[e.currency]}</td>
                              <td className={`px-3 py-2 font-black tabular-nums ${!isOut ? "text-emerald-500" : ""}`}>{!isOut ? fmt(e.amount) : ""}</td>
                              <td className={`px-3 py-2 font-black tabular-nums ${isOut ? "text-rose-500" : ""}`}>{isOut ? fmt(e.amount) : ""}</td>
                              <td className={`px-3 py-2 text-[10px] ${subText}`}>{e.rateLabel || "-"}</td>
                              <td className={`px-3 py-2 text-[10px] font-bold ${subText}`}>{e.feeAmount ? `${fmt(e.feeAmount)} ${e.feeCurrency ? labels[e.feeCurrency] : ""}` : "-"}</td>
                              <td className={`px-3 py-2 font-black tabular-nums ${currencyColors[e.currency][dk ? "dark" : "light"]}`}>{fmt(e.balanceAfter)}</td>
                              <td className="px-3 py-2">
                                <button onClick={() => printReceipt(e)} className={`rounded-md border px-2 py-1 text-[10px] font-bold ${dk ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                                  <Ic n="printer" className="h-3 w-3" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ================= فهرست مشتریان ================= */}
          {!selectedCustomerId && mainTab === "list" && (
            <section className={`ca-up ${uiCard}`}>
              <div className="flex flex-wrap items-center gap-3 p-4 md:p-5 border-b border-slate-200 dark:border-slate-700">
                <Ic n="users" className={`h-5 w-5 ${dk ? "text-indigo-300" : "text-indigo-600"}`} />
                <b className={`text-sm font-black ${heading}`}>فهرست مشتریان</b>
                <div className="ml-auto relative flex-1 min-w-[200px] max-w-sm">
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو (نام، تلفن، تذکره)…" className={`${uiInput} pr-10`} />
                  <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${dk ? "text-slate-500" : "text-slate-400"}`}><Ic n="search" className="h-4 w-4" /></span>
                </div>
              </div>
              {filteredCustomers.length === 0 ? (
                <div className={`flex flex-col items-center gap-3 py-14 ${subText}`}>
                  <Ic n="inbox" className="h-10 w-10 opacity-50" />
                  <p className="text-sm font-bold">هیچ مشتری یافت نشد.</p>
                </div>
              ) : (
                <div className="overflow-x-auto ca-scroll">
                  <table className="w-full min-w-[1100px] text-sm">
                    <thead>
                      <tr className={`border-y ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
                        {["نام", "تلفن", "تذکره", "AFN", "USD", "IRR", "EUR", "PKR", "آخرین فعالیت", ""].map(h => (
                          <th key={h} className="px-3 py-3 text-right text-[11px] font-black text-slate-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${dk ? "divide-slate-700/60" : "divide-slate-100"}`}>
                      {filteredCustomers.map(c => {
                        const bal = computeBalances(ledger, c.id);
                        const lastActivity = ledger.filter(e => e.customerId === c.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                        return (
                          <tr key={c.id} className={dk ? "hover:bg-slate-700/30" : "hover:bg-indigo-50/50"}>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <div className={`grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white font-black text-xs`}>{c.name.charAt(0)}</div>
                                <div className={`text-xs font-black ${dk ? "text-slate-200" : "text-slate-700"}`}>{c.name}</div>
                              </div>
                            </td>
                            <td className={`px-3 py-3 text-xs tabular-nums ${dk ? "text-slate-300" : "text-slate-600"}`} dir="ltr">{c.phone || "-"}</td>
                            <td className={`px-3 py-3 text-xs tabular-nums ${dk ? "text-slate-300" : "text-slate-600"}`} dir="ltr">{c.tazkira || "-"}</td>
                            {currencies.map(cur => {
                              const b = bal[cur];
                              return (
                                <td key={cur} className={`px-3 py-3 text-xs font-black tabular-nums ${b < 0 ? "text-rose-500" : currencyColors[cur][dk ? "dark" : "light"]}`}>
                                  {fmt(b)}
                                </td>
                              );
                            })}
                            <td className={`px-3 py-3 text-[10px] tabular-nums ${subText}`} dir="ltr">
                              {lastActivity ? shortDateLabel(lastActivity.date) : "-"}
                            </td>
                            <td className="px-3 py-3">
                              <button onClick={() => openCustomer(c.id)} className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold ${dk ? "border-indigo-400/30 text-indigo-300 hover:bg-indigo-400/10" : "border-indigo-300 text-indigo-600 hover:bg-indigo-50"}`}>
                                <Ic n="eye" className="h-3.5 w-3.5 inline ml-1" />مشاهده حساب
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* ================= ثبت عملیات ================= */}
          {!selectedCustomerId && mainTab === "operation" && (
            <section className={`ca-up space-y-4 p-5 ${uiCard}`}>
              <div className="flex items-center gap-2">
                <Ic n="plus" className={`h-5 w-5 ${dk ? "text-indigo-300" : "text-indigo-600"}`} />
                <b className={`text-sm font-black ${heading}`}>ثبت عملیات جدید</b>
              </div>

              {/* Toggle نوع عملیات */}
              <div className={`grid grid-cols-2 md:grid-cols-5 gap-1 rounded-xl border p-1 ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-slate-50"}`}>
                {(Object.keys(opLabels) as OpType[]).map(t => (
                  <button key={t} onClick={() => setOpType(t)} className={`rounded-lg px-2 py-2 text-[11px] font-black transition-all ${opType === t ? `bg-gradient-to-l ${dk ? "from-indigo-400 to-violet-400 text-slate-950" : "from-indigo-500 to-violet-500 text-white"}` : dk ? "text-slate-400" : "text-slate-500"}`}>
                    {opPrefix[t]}- {opLabels[t]}
                  </button>
                ))}
              </div>

              {/* مشتری (چند انتخابی) */}
              {fld("مشتری (امکان انتخاب چند مشتری) *", (
                <div className={`rounded-xl border p-2 max-h-[180px] overflow-y-auto ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-white"}`}>
                  {customers.map(c => (
                    <label key={c.id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer ${dk ? "hover:bg-slate-800" : "hover:bg-slate-50"}`}>
                      <input type="checkbox" checked={opCustomerId.includes(c.id)}
                        onChange={e => {
                          if (e.target.checked) setOpCustomerId(prev => [...prev, c.id]);
                          else setOpCustomerId(prev => prev.filter(id => id !== c.id));
                        }}
                        className="h-4 w-4" />
                      <span className={`text-xs font-bold ${dk ? "text-slate-200" : "text-slate-700"}`}>{c.name}</span>
                      <span className={`text-[10px] ${subText}`} dir="ltr">{c.phone}</span>
                    </label>
                  ))}
                </div>
              ))}

              {/* فیلدهای عملیات */}
              {opType === "deposit" && (
                <div className="grid gap-3 md:grid-cols-2">
                  {fld("ارز", (
                    <div className="relative">
                      <select value={opCurrency} onChange={e => setOpCurrency(e.target.value as Currency)} className={`${uiInput} cursor-pointer appearance-none pl-9`}>
                        {currencies.map(c => <option key={c} value={c}>{labels[c]}</option>)}
                      </select>
                      <span className={chevPos}><Ic n="chevron" className="h-4 w-4" /></span>
                    </div>
                  ))}
                  {fld("مبلغ *", (<input type="text" inputMode="decimal" dir="ltr" value={opAmount} onChange={e => setOpAmount(toNumericText(e.target.value))} placeholder="0" className={`${uiInput} text-left tabular-nums`} />))}
                  <div className="md:col-span-2">{fld("کد پیگیری", (<input readOnly dir="ltr" value={getNextSharedCode("DP")} className={`${uiInput} ${dk ? "bg-slate-800/70 text-slate-400" : "bg-slate-100 text-slate-500"} text-left font-black`} />))}</div>
                </div>
              )}

              {opType === "withdraw" && (
                <div className="grid gap-3 md:grid-cols-2">
                  {fld("ارز", (
                    <div className="relative">
                      <select value={opCurrency} onChange={e => setOpCurrency(e.target.value as Currency)} className={`${uiInput} cursor-pointer appearance-none pl-9`}>
                        {currencies.map(c => <option key={c} value={c}>{labels[c]}</option>)}
                      </select>
                      <span className={chevPos}><Ic n="chevron" className="h-4 w-4" /></span>
                    </div>
                  ))}
                  {fld("مبلغ *", (<input type="text" inputMode="decimal" dir="ltr" value={opAmount} onChange={e => setOpAmount(toNumericText(e.target.value))} placeholder="0" className={`${uiInput} text-left tabular-nums`} />))}
                  <div className="md:col-span-2">{fld("کد پیگیری", (<input readOnly dir="ltr" value={getNextSharedCode("WD")} className={`${uiInput} ${dk ? "bg-slate-800/70 text-slate-400" : "bg-slate-100 text-slate-500"} text-left font-black`} />))}</div>
                </div>
              )}

              {opType === "exchange" && (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    {fld("ارز فروخته‌شده (از حساب مشتری)", (
                      <div className="relative">
                        <select value={opCurrency} onChange={e => setOpCurrency(e.target.value as Currency)} className={`${uiInput} cursor-pointer appearance-none pl-9`}>
                          {currencies.map(c => <option key={c} value={c}>{labels[c]}</option>)}
                        </select>
                        <span className={chevPos}><Ic n="chevron" className="h-4 w-4" /></span>
                      </div>
                    ))}
                    {fld("مبلغ فروخته‌شده *", (<input type="text" inputMode="decimal" dir="ltr" value={opAmount} onChange={e => setOpAmount(toNumericText(e.target.value))} placeholder="0" className={`${uiInput} text-left tabular-nums`} />))}
                    {fld("ارز خریداری‌شده (به حساب مشتری)", (
                      <div className="relative">
                        <select value={opCurrencyTo} onChange={e => setOpCurrencyTo(e.target.value as Currency)} className={`${uiInput} cursor-pointer appearance-none pl-9`}>
                          {currencies.map(c => <option key={c} value={c}>{labels[c]}</option>)}
                        </select>
                        <span className={chevPos}><Ic n="chevron" className="h-4 w-4" /></span>
                      </div>
                    ))}
                    {fld("مبلغ خریداری‌شده *", (<input type="text" inputMode="decimal" dir="ltr" value={opAmountTo} onChange={e => setOpAmountTo(toNumericText(e.target.value))} placeholder="0" className={`${uiInput} text-left tabular-nums`} />))}
                    {fld("نرخ تبدیل", (<input type="text" inputMode="decimal" dir="ltr" value={opRate} onChange={e => setOpRate(toNumericText(e.target.value))} placeholder="نرخ" className={`${uiInput} text-left tabular-nums`} />))}
                    <div className="grid grid-cols-2 gap-2">
                      {fld("ارز فی", (
                        <div className="relative">
                          <select value={opFeeCurrency} onChange={e => setOpFeeCurrency(e.target.value as Currency)} className={`${uiInput} cursor-pointer appearance-none pl-9`}>
                            {currencies.map(c => <option key={c} value={c}>{labels[c]}</option>)}
                          </select>
                          <span className={chevPos}><Ic n="chevron" className="h-4 w-4" /></span>
                        </div>
                      ))}
                      {fld("مبلغ فی", (<input type="text" inputMode="decimal" dir="ltr" value={opFeeAmount} onChange={e => setOpFeeAmount(toNumericText(e.target.value))} placeholder="0" className={`${uiInput} text-left tabular-nums`} />))}
                    </div>
                  </div>
                  <div>{fld("کد پیگیری", (<input readOnly dir="ltr" value={getNextSharedCode("EX")} className={`${uiInput} ${dk ? "bg-slate-800/70 text-slate-400" : "bg-slate-100 text-slate-500"} text-left font-black`} />))}</div>
                </div>
              )}

              {opType === "fee" && (
                <div className="grid gap-3 md:grid-cols-2">
                  {fld("ارز فی", (
                    <div className="relative">
                      <select value={opFeeCurrency} onChange={e => setOpFeeCurrency(e.target.value as Currency)} className={`${uiInput} cursor-pointer appearance-none pl-9`}>
                        {currencies.map(c => <option key={c} value={c}>{labels[c]}</option>)}
                      </select>
                      <span className={chevPos}><Ic n="chevron" className="h-4 w-4" /></span>
                    </div>
                  ))}
                  {fld("مبلغ فی *", (<input type="text" inputMode="decimal" dir="ltr" value={opFeeAmount} onChange={e => setOpFeeAmount(toNumericText(e.target.value))} placeholder="0" className={`${uiInput} text-left tabular-nums`} />))}
                  <div className="md:col-span-2">{fld("کد پیگیری", (<input readOnly dir="ltr" value={getNextSharedCode("FE")} className={`${uiInput} ${dk ? "bg-slate-800/70 text-slate-400" : "bg-slate-100 text-slate-500"} text-left font-black`} />))}</div>
                </div>
              )}

              {fld("توضیحات", (<input value={opDescription} onChange={e => setOpDescription(e.target.value)} placeholder="توضیحات اختیاری..." className={uiInput} />))}

              <button onClick={submitOperation} className={`flex h-[50px] w-full items-center justify-center gap-2 rounded-xl text-sm font-black shadow-lg transition-all hover:brightness-110 active:scale-[0.98] ${dk ? "bg-gradient-to-l from-indigo-400 to-violet-400 text-slate-950" : "bg-gradient-to-l from-indigo-500 to-violet-500 text-white"}`}>
                <Ic n="check" className="h-4 w-4" />ثبت {opLabels[opType]}
              </button>
            </section>
          )}

          {/* ================= روزنامه معاملات ================= */}
          {!selectedCustomerId && mainTab === "journal" && (
            <section className={`ca-up ${uiCard}`}>
              <div className="flex flex-wrap items-center gap-3 p-4 md:p-5 border-b border-slate-200 dark:border-slate-700">
                <Ic n="doc" className={`h-5 w-5 ${dk ? "text-indigo-300" : "text-indigo-600"}`} />
                <b className={`text-sm font-black ${heading}`}>روزنامه معاملات</b>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${dk ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"}`}>{journalEntries.length} رویداد</span>
              </div>
              <div className="p-4 md:p-5 space-y-3">
                <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
                  <div className="relative">
                    <input value={journalSearch} onChange={e => setJournalSearch(e.target.value)} placeholder="جستجو (نام مشتری، شرح، شماره سند)…" className={`${uiInput} pr-10`} />
                    <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${dk ? "text-slate-500" : "text-slate-400"}`}><Ic n="search" className="h-4 w-4" /></span>
                  </div>
                  <select value={journalTypeFilter} onChange={e => setJournalTypeFilter(e.target.value)} className={`${uiInput} cursor-pointer appearance-none pl-9 w-auto min-w-[140px]`}>
                    <option value="all">همه انواع</option>
                    <option value="deposit">واریز</option>
                    <option value="withdraw">برداشت</option>
                    <option value="exchange">تبادل</option>
                    <option value="fee">فی</option>
                    <option value="transfer">انتقال</option>
                    <option value="hawala">حواله</option>
                  </select>
                  <select value={journalCurrencyFilter} onChange={e => setJournalCurrencyFilter(e.target.value)} className={`${uiInput} cursor-pointer appearance-none pl-9 w-auto min-w-[120px]`}>
                    <option value="all">همه ارزها</option>
                    {currencies.map(c => <option key={c} value={c}>{labels[c]}</option>)}
                  </select>
                </div>

                {journalEntries.length === 0 ? (
                  <div className={`flex flex-col items-center gap-3 py-14 ${subText}`}>
                    <Ic n="inbox" className="h-10 w-10 opacity-50" />
                    <p className="text-sm font-bold">هیچ رویدادی یافت نشد.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto ca-scroll">
                    <table className="w-full min-w-[1200px] text-xs">
                      <thead>
                        <tr className={`border-y ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
                          {["تاریخ", "ساعت", "شماره سند", "مشتری", "نوع", "شرح", "ارز", "دریافت", "پرداخت", "نرخ", "فی", "مانده", ""].map(h => (
                            <th key={h} className="px-2 py-2.5 text-right text-[10px] font-black text-slate-400">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${dk ? "divide-slate-700/60" : "divide-slate-100"}`}>
                        {journalEntries.map(e => {
                          const isOut = e.direction === "out";
                          const txType = e.type as OpType;
                          const custName = customers.find(c => c.id === e.customerId)?.name || "-";
                          return (
                            <tr key={e.id} className={dk ? "hover:bg-slate-700/30" : "hover:bg-indigo-50/50"}>
                              <td className={`whitespace-nowrap px-2 py-2 tabular-nums ${subText}`} dir="ltr">{shortDateLabel(e.date)}</td>
                              <td className={`whitespace-nowrap px-2 py-2 tabular-nums ${subText}`} dir="ltr">{timeLabel(e.date)}</td>
                              <td className="px-2 py-2">
                                <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-black tabular-nums ${dk ? "border-slate-600 text-slate-300" : "border-slate-200 text-slate-600"}`} dir="ltr">
                                  <Ic n="tag" className="h-2.5 w-2.5" />{e.referenceNumber || "-"}
                                </span>
                              </td>
                              <td className={`px-2 py-2 font-bold ${dk ? "text-slate-200" : "text-slate-700"}`}>{custName}</td>
                              <td className="px-2 py-2">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-black ${(opColors as any)[txType]?.[dk ? "dark" : "light"] || (dk ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600")}`}>
                                  {(opLabels as any)[txType] || e.type}
                                </span>
                              </td>
                              <td className={`px-2 py-2 max-w-[150px] truncate ${dk ? "text-slate-200" : "text-slate-700"}`}>{e.description}</td>
                              <td className={`px-2 py-2 font-black ${currencyColors[e.currency][dk ? "dark" : "light"]}`}>{labels[e.currency]}</td>
                              <td className={`px-2 py-2 font-black tabular-nums ${!isOut ? "text-emerald-500" : ""}`}>{!isOut ? fmt(e.amount) : ""}</td>
                              <td className={`px-2 py-2 font-black tabular-nums ${isOut ? "text-rose-500" : ""}`}>{isOut ? fmt(e.amount) : ""}</td>
                              <td className={`px-2 py-2 text-[9px] ${subText}`}>{e.rateLabel || "-"}</td>
                              <td className={`px-2 py-2 text-[9px] font-bold ${subText}`}>{e.feeAmount ? `${fmt(e.feeAmount)} ${e.feeCurrency ? labels[e.feeCurrency] : ""}` : "-"}</td>
                              <td className={`px-2 py-2 font-black tabular-nums ${currencyColors[e.currency][dk ? "dark" : "light"]}`}>{fmt(e.balanceAfter)}</td>
                              <td className="px-2 py-2">
                                <button onClick={() => printReceipt(e)} className={`rounded-md border px-1.5 py-1 text-[9px] font-bold ${dk ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                                  <Ic n="eye" className="h-3 w-3" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
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
