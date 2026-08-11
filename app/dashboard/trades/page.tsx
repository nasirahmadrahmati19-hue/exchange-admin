"use client";
import { useEffect, useMemo, useState, useRef, type ReactNode } from "react";

type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";
type RateMode = "same" | "afn" | "direct";
type DealType = "buy" | "sell";
type CommissionPayer = "sender" | "receiver";

type Customer = {
  id: string;
  name: string;
  phone?: string;
  tazkira?: string;
  address?: string;
  note?: string;
  telegram?: string;
  registeredAt: string;
  balances: Record<Currency, number>;
};

type Transaction = {
  id: string; trackingCode: string; type: "exchange" | "transfer" | "convert";
  dealType?: DealType; date: string; customerId?: string; senderId?: string; receiverId?: string;
  fromCurrency: Currency; fromAmount: number; toCurrency: Currency; toAmount: number;
  rate: number; rateLabel: string; rateBase?: Currency;
  commission?: number; commissionCurrency?: Currency; commissionPayer?: CommissionPayer;
  description?: string; status: "active" | "voided";
  profit?: number; profitCurrency?: Currency;
  customerPhone?: string; customerTelegram?: string;
};

const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const labels: Record<Currency, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };
const rateUnits: Record<Currency, number> = { AFN: 1, USD: 1, EUR: 1, IRR: 1000, PKR: 1000 };
const CUSTOMERS_KEY = "fx-customers";
const TRANSACTIONS_KEY = "fx-transactions";
const HAWALAS_KEY = "hawalas";
const SHARED_COUNTER_KEY = "shared-tracking-counter";

const defaultCustomers: Customer[] = [
  { id: "1", name: "احمد رحیمی", phone: "0700123456", tazkira: "1400-001-001", address: "هرات، گلران", note: "مشتری ویژه", telegram: "@ahmad_rahimi", registeredAt: "2025-01-15T10:00:00Z", balances: { AFN: 500000, USD: 10000, EUR: 0, IRR: 0, PKR: 0 } },
  { id: "2", name: "محمد ظاهر", phone: "0700654321", tazkira: "1400-002-002", address: "هرات، انجیل", note: "", telegram: "@mohammad_zahir", registeredAt: "2025-02-20T14:30:00Z", balances: { AFN: 200000, USD: 5000, EUR: 0, IRR: 0, PKR: 0 } },
  { id: "3", name: "فاطمه حسینی", phone: "0700789123", tazkira: "1400-003-003", address: "هرات، مرکز", note: "معاملات عمده", telegram: "@fatema_hosseini", registeredAt: "2025-03-05T09:15:00Z", balances: { AFN: 0, USD: 0, EUR: 0, IRR: 50000000, PKR: 0 } },
];

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

function dateLabel(s: string) {
  try { const d = new Date(s); return Number.isNaN(d.getTime()) ? "-" : formatDateTime(d); } catch { return "-"; }
}

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
        address: c.address || "", note: c.note || "", telegram: c.telegram || "",
        registeredAt: c.registeredAt || c.createdAt || new Date().toISOString(),
        balances: { AFN: Number(c.balances?.AFN || 0) || 0, USD: Number(c.balances?.USD || 0) || 0, EUR: Number(c.balances?.EUR || 0) || 0, IRR: Number(c.balances?.IRR || 0) || 0, PKR: Number(c.balances?.PKR || 0) || 0 },
      }));
    }
    return defaultCustomers;
  } catch { return defaultCustomers; }
};

const loadTransactions = (): Transaction[] => {
  if (typeof window === "undefined") return [];
  try {
    const parsed = safeGetItem(TRANSACTIONS_KEY);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t: any) => t?.id).map((t: any): Transaction => ({
      id: t.id, trackingCode: t.trackingCode || "", type: t.type === "transfer" ? "transfer" : t.type === "convert" ? "convert" : "exchange",
      dealType: t.dealType, date: t.date || new Date().toISOString(), customerId: t.customerId, senderId: t.senderId, receiverId: t.receiverId,
      fromCurrency: isCurrency(t.fromCurrency) ? t.fromCurrency : "AFN", fromAmount: Number(t.fromAmount || 0) || 0,
      toCurrency: isCurrency(t.toCurrency) ? t.toCurrency : "AFN", toAmount: Number(t.toAmount || 0) || 0,
      rate: Number(t.rate || 0) || 0, rateLabel: t.rateLabel || "", rateBase: t.rateBase,
      commission: Number(t.commission || 0) || 0, commissionCurrency: isCurrency(t.commissionCurrency) ? t.commissionCurrency : undefined,
      commissionPayer: t.commissionPayer, description: t.description,
      status: t.status === "voided" ? "voided" : "active",
      profit: Number(t.profit || 0) || 0, profitCurrency: isCurrency(t.profitCurrency) ? t.profitCurrency : undefined,
      customerPhone: t.customerPhone, customerTelegram: t.customerTelegram,
    }));
  } catch { return []; }
};

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
    for (const key of [TRANSACTIONS_KEY, HAWALAS_KEY]) {
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

function getRateMode(from: Currency, to: Currency): RateMode { if (from === to) return "same"; if (from === "AFN" || to === "AFN") return "afn"; return "direct"; }
function getAfnForeign(from: Currency, to: Currency): Currency | null { if (from === to) return null; if (from === "AFN") return to; if (to === "AFN") return from; return null; }
function preferredDirectBase(a: Currency, b: Currency): Currency { const p: Currency[] = ["USD","EUR","PKR","IRR"]; for (const c of p) { if (a === c) return c; if (b === c) return c; } return a; }
function getSafeDirectBase(baseState: Currency, a: Currency, b: Currency): Currency { if (a === baseState || b === baseState) return baseState; return preferredDirectBase(a, b); }
function getDirectCounter(base: Currency, a: Currency, b: Currency): Currency | null { if (a === base) return b; if (b === base) return a; return null; }

function convertAfnRate(amount: number, from: Currency, to: Currency, rate: number) {
  if (!Number.isFinite(amount) || amount === 0) return 0;
  if (from === to) return amount;
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  const foreign = getAfnForeign(from, to);
  if (!foreign) return 0;
  const unit = rateUnits[foreign] || 1;
  if (from === "AFN" && to === foreign) return (amount / rate) * unit;
  if (from === foreign && to === "AFN") return (amount / unit) * rate;
  return 0;
}

function convertDirectRate(amount: number, from: Currency, to: Currency, base: Currency, rate: number) {
  if (!Number.isFinite(amount) || amount === 0) return 0;
  if (from === to) return amount;
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  const counter = getDirectCounter(base, from, to);
  if (!counter) return 0;
  const unitBase = rateUnits[base] || 1;
  if (from === base) return (amount / unitBase) * rate;
  if (to === base) return (amount / rate) * unitBase;
  return 0;
}

const afnRateLabel = (foreign: Currency, rate: number) => `${rateUnits[foreign]} ${labels[foreign]} = ${rate} ${labels.AFN}`;
const directRateLabel = (base: Currency, counter: Currency, rate: number) => `${rateUnits[base]} ${labels[base]} = ${rate} ${labels[counter]}`;

type BalanceChange = { customerId: string; currency: Currency; amount: number; };

function getBalanceChangesForTransaction(tx: Transaction): BalanceChange[] {
  const changes: BalanceChange[] = [];
  try {
    if (tx.type === "exchange" && tx.customerId) {
      changes.push({ customerId: tx.customerId, currency: tx.fromCurrency, amount: -tx.fromAmount });
      changes.push({ customerId: tx.customerId, currency: tx.toCurrency, amount: tx.toAmount });
      if (tx.commission && tx.commission > 0 && tx.commissionCurrency) {
        changes.push({ customerId: tx.customerId, currency: tx.commissionCurrency, amount: -tx.commission });
      }
    }
    if (tx.type === "transfer") {
      if (tx.senderId) {
        changes.push({ customerId: tx.senderId, currency: tx.fromCurrency, amount: -tx.fromAmount });
        if (tx.commissionPayer === "sender" && tx.commission && tx.commission > 0 && tx.commissionCurrency) {
          changes.push({ customerId: tx.senderId, currency: tx.commissionCurrency, amount: -tx.commission });
        }
      }
      if (tx.receiverId) {
        changes.push({ customerId: tx.receiverId, currency: tx.toCurrency, amount: tx.toAmount });
        if (tx.commissionPayer === "receiver" && tx.commission && tx.commission > 0 && tx.commissionCurrency) {
          changes.push({ customerId: tx.receiverId, currency: tx.commissionCurrency, amount: -tx.commission });
        }
      }
    }
    if (tx.type === "convert" && tx.customerId) {
      changes.push({ customerId: tx.customerId, currency: tx.fromCurrency, amount: -tx.fromAmount });
      changes.push({ customerId: tx.customerId, currency: tx.toCurrency, amount: tx.toAmount });
      if (tx.commission && tx.commission > 0 && tx.commissionCurrency) {
        changes.push({ customerId: tx.customerId, currency: tx.commissionCurrency, amount: -tx.commission });
      }
    }
  } catch {}
  return changes;
}

function applyBalanceChanges(customers: Customer[], changes: BalanceChange[]): Customer[] {
  try {
    return customers.map(c => {
      const cc = changes.filter(ch => ch.customerId === c.id);
      if (cc.length === 0) return c;
      const nb = { ...c.balances };
      for (const ch of cc) {
        if (nb[ch.currency] === undefined) nb[ch.currency] = 0;
        nb[ch.currency] = (nb[ch.currency] || 0) + ch.amount;
      }
      return { ...c, balances: nb };
    });
  } catch { return customers; }
}

const iconPaths = {
  swap: "M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5",
  users: "M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z",
  user: "M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z",
  chevron: "m19.5 8.25-7.5 7.5-7.5-7.5",
  check: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  x: "M6 18 18 6M6 6l12 12",
  xCircle: "m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  alert: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z",
  doc: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
  inbox: "M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z",
  arrowLeft: "M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18",
  rate: "M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941",
  info: "m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z",
  sun: "M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z",
  moon: "M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z",
  plus: "M12 4.5v15m7.5-7.5h-15",
  tag: "M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z",
  wallet: "M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3",
  dots: "M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z",
  trash: "M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0",
  undo: "M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3",
};

type IconName = keyof typeof iconPaths;

function Ic({ n, className = "h-5 w-5" }: { n: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={iconPaths[n]} />
    </svg>
  );
}

export default function CurrencyExchangePage() {
  const [mounted, setMounted] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>(defaultCustomers);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<"exchange" | "transfer" | "convert">("exchange");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [toast, setToast] = useState("");

  // ✅ state‌های فیلد مشتری
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [customerFilter, setCustomerFilter] = useState("");
  const customerListRef = useRef<HTMLDivElement>(null);

  // ✅ state‌های dropdown عملیات
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // ✅ state‌های مودال پیش‌نمایش
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<Transaction | null>(null);

  // فرم تبادل ارز
  const [customer, setCustomer] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerTelegram, setCustomerTelegram] = useState("");
  const [dealType, setDealType] = useState<DealType | "">("");
  const [fromCurrency, setFromCurrency] = useState<Currency>("AFN");
  const [toCurrency, setToCurrency] = useState<Currency>("USD");
  const [fromAmount, setFromAmount] = useState("");
  const [rate, setRate] = useState("");
  const [commission, setCommission] = useState("");
  const [commissionCurrency, setCommissionCurrency] = useState<Currency>("AFN");
  const [commissionPayer, setCommissionPayer] = useState<CommissionPayer>("sender");
  const [description, setDescription] = useState("");

  // فرم انتقال
  const [sender, setSender] = useState("");
  const [receiver, setReceiver] = useState("");
  const [senderFromCurrency, setSenderFromCurrency] = useState<Currency>("AFN");
  const [receiverToCurrency, setReceiverToCurrency] = useState<Currency>("AFN");
  const [senderAmount, setSenderAmount] = useState("");
  const [transferRate, setTransferRate] = useState("");
  const [transferCommission, setTransferCommission] = useState("");
  const [transferCommissionCurrency, setTransferCommissionCurrency] = useState<Currency>("AFN");
  const [transferCommissionPayer, setTransferCommissionPayer] = useState<CommissionPayer>("sender");
  const [transferDescription, setTransferDescription] = useState("");

  // فرم تبدیل
  const [convertCustomer, setConvertCustomer] = useState("");
  const [convertFromCurrency, setConvertFromCurrency] = useState<Currency>("AFN");
  const [convertToCurrency, setConvertToCurrency] = useState<Currency>("USD");
  const [convertAmount, setConvertAmount] = useState("");
  const [convertRate, setConvertRate] = useState("");
  const [convertCommission, setConvertCommission] = useState("");
  const [convertCommissionCurrency, setConvertCommissionCurrency] = useState<Currency>("AFN");
  const [convertDescription, setConvertDescription] = useState("");

  useEffect(() => {
    try { const saved = window.localStorage.getItem("fx-theme"); if (saved === "dark" || saved === "light") setTheme(saved); } catch {}
  }, []);
  useEffect(() => { try { window.localStorage.setItem("fx-theme", theme); } catch {} }, [theme]);
  const dk = theme === "dark";

  useEffect(() => {
    try {
      setCustomers(loadCustomers());
      setTransactions(loadTransactions());
      initSharedCounterFromAllSources();
    } catch (err) { console.error("Load error:", err); }
    setMounted(true);
  }, []);

  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const currentDateTime = now ? formatDateTime(now) : "";

  useEffect(() => { try { localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers)); } catch {} }, [customers]);
  useEffect(() => { try { localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions)); } catch {} }, [transactions]);

  // ✅ بستن لیست مشتریان هنگام کلیک بیرون
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerListRef.current && !customerListRef.current.contains(event.target as Node)) {
        setShowCustomerList(false);
      }
    };
    if (showCustomerList) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showCustomerList]);

  // ✅ بستن dropdown عملیات هنگام کلیک بیرون
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    if (openMenuId) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openMenuId]);

  // ✅ فیلتر مشتریان
  const filteredCustomerList = useMemo(() => {
    if (!customerFilter) return customers;
    const q = normalizeDigits(customerFilter.trim()).toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.phone && normalizeDigits(c.phone).includes(q))
    );
  }, [customers, customerFilter]);

  // ✅ مشتری انتخاب‌شده برای نمایش موجودی
  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.name === customer) || null;
  }, [customers, customer]);

  const rateMode = getRateMode(fromCurrency, toCurrency);
  const afnForeign = getAfnForeign(fromCurrency, toCurrency);
  const directBaseValue = rateMode === "direct" ? getSafeDirectBase(fromCurrency, fromCurrency, toCurrency) : fromCurrency;
  const directCounter = rateMode === "direct" ? getDirectCounter(directBaseValue, fromCurrency, toCurrency) : null;
  const [directBase, setDirectBase] = useState<Currency>("USD");

  useEffect(() => { if (rateMode === "direct" && directBase !== directBaseValue) setDirectBase(directBaseValue); }, [rateMode, directBase, directBaseValue]);
  useEffect(() => { setRate(""); }, [rateMode, afnForeign, directBaseValue, directCounter]);

  const amountFrom = parseAmount(fromAmount);
  const rateValue = parseAmount(rate);
  const commissionValue = parseAmount(commission);

  const convertedAmount = useMemo(() => {
    try {
      if (!amountFrom) return 0;
      if (rateMode === "same") return amountFrom;
      if (!rateValue) return 0;
      if (rateMode === "afn") return convertAfnRate(amountFrom, fromCurrency, toCurrency, rateValue);
      if (rateMode === "direct" && directCounter) return convertDirectRate(amountFrom, fromCurrency, toCurrency, directBaseValue, rateValue);
      return 0;
    } catch { return 0; }
  }, [amountFrom, rateValue, rateMode, fromCurrency, toCurrency, directCounter, directBaseValue]);

  const finalAmount = Math.max(0, convertedAmount - commissionValue);
  const nextTrackingCode = getNextSharedCode("FX");

  const showToast = (message: string) => { setToast(message); setTimeout(() => setToast(""), 3500); };

  // ✅ انتخاب مشتری از لیست
  const selectCustomer = (c: Customer) => {
    setCustomer(c.name);
    setCustomerPhone(c.phone || "");
    setCustomerTelegram(c.telegram || "");
    setCustomerFilter("");
    setShowCustomerList(false);
  };

  // ✅ ثبت معامله با مودال پیش‌نمایش
  const handleSubmitClick = () => {
    if (!customer.trim()) { showToast("لطفاً مشتری را انتخاب کنید."); return; }
    if (!dealType) { showToast("لطفاً نوع معامله را انتخاب کنید."); return; }
    if (!fromAmount || amountFrom <= 0) { showToast("لطفاً مبلغ را وارد کنید."); return; }

    const tx: Transaction = {
      id: generateId(), trackingCode: nextTrackingCode, type: "exchange",
      dealType: dealType as DealType, date: new Date().toISOString(), customerId: customer,
      fromCurrency, fromAmount: amountFrom, toCurrency, toAmount: convertedAmount,
      rate: rateMode === "same" ? 1 : rateValue,
      rateLabel: rateMode === "same" ? "بدون تبدیل" : rateMode === "afn" && afnForeign ? afnRateLabel(afnForeign, rateValue) : rateMode === "direct" && directCounter ? directRateLabel(directBaseValue, directCounter, rateValue) : "",
      rateBase: rateMode === "direct" ? directBaseValue : undefined,
      commission: commissionValue, commissionCurrency, commissionPayer,
      description, status: "active", profit: commissionValue, profitCurrency: commissionCurrency,
      customerPhone, customerTelegram,
    };
    setPreviewData(tx);
    setPreviewOpen(true);
  };

  const confirmRegister = () => {
    if (!previewData) return;
    try {
      const tx = { ...previewData, trackingCode: consumeSharedCode("FX") };
      if (customers.some(c => c.name === tx.customerId)) {
        setCustomers(prev => applyBalanceChanges(prev, getBalanceChangesForTransaction(tx)));
      }
      setTransactions(prev => [tx, ...prev]);
      setCustomer(""); setCustomerPhone(""); setCustomerTelegram("");
      setDealType(""); setFromAmount(""); setRate(""); setCommission("");
      setDescription("");
      setPreviewOpen(false);
      setPreviewData(null);
      showToast("معامله با موفقیت ثبت شد.");
    } catch (err) {
      console.error("Register error:", err);
      showToast("خطا در ثبت معامله");
    }
  };

  // ✅ برگرداندن معامله لغو شده
  const restoreTransaction = (tx: Transaction) => {
    if (tx.status !== "voided") return;
    if (!window.confirm(`آیا از برگرداندن معامله ${tx.trackingCode} مطمئن هستید؟`)) return;
    try {
      if (tx.customerId && customers.some(c => c.name === tx.customerId)) {
        setCustomers(prev => applyBalanceChanges(prev, getBalanceChangesForTransaction(tx)));
      }
      setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, status: "active" as const } : t));
      showToast(`معامله ${tx.trackingCode} برگردانده شد.`);
    } catch (err) {
      console.error("Restore error:", err);
      showToast("خطا در برگرداندن معامله");
    }
  };

  // ✅ لغو معامله
  const voidTransaction = (tx: Transaction) => {
    if (tx.status === "voided") return;
    if (!window.confirm(`آیا از لغو معامله ${tx.trackingCode} مطمئن هستید؟`)) return;
    try {
      if (tx.customerId && customers.some(c => c.name === tx.customerId)) {
        setCustomers(prev => applyBalanceChanges(prev, getBalanceChangesForTransaction(tx).map(ch => ({ ...ch, amount: -ch.amount }))));
      }
      setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, status: "voided" as const } : t));
      showToast(`معامله ${tx.trackingCode} لغو شد.`);
    } catch (err) {
      console.error("Void error:", err);
      showToast("خطا در لغو معامله");
    }
  };

  // ✅ حذف معامله
  const deleteTransaction = (tx: Transaction) => {
    if (!window.confirm(`آیا از حذف کامل معامله ${tx.trackingCode} مطمئن هستید؟`)) return;
    try {
      if (tx.status === "active" && tx.customerId && customers.some(c => c.name === tx.customerId)) {
        setCustomers(prev => applyBalanceChanges(prev, getBalanceChangesForTransaction(tx).map(ch => ({ ...ch, amount: -ch.amount }))));
      }
      setTransactions(prev => prev.filter(t => t.id !== tx.id));
      showToast(`معامله ${tx.trackingCode} حذف شد.`);
    } catch (err) {
      console.error("Delete error:", err);
      showToast("خطا در حذف معامله");
    }
  };

  const toggleMenu = (id: string) => {
    setOpenMenuId(openMenuId === id ? null : id);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-500" />
          <p className="mt-4 text-slate-500">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  const heading = dk ? "text-white" : "text-slate-900";
  const subText = dk ? "text-slate-500" : "text-slate-400";
  const glassChip = dk ? "border-slate-600/70 bg-slate-800/80" : "border-sky-100 bg-white/85";
  const uiCard = `rounded-2xl border backdrop-blur transition-colors duration-300 ${dk ? "border-slate-700 bg-slate-800/90 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.6)]" : "border-sky-100 bg-white/95 shadow-[0_16px_40px_-28px_rgba(2,132,199,0.35)]"}`;
  const inputShell = `rounded-xl border text-sm font-medium shadow-sm outline-none transition-all duration-200 focus:ring-4 ${dk ? "border-slate-600 bg-slate-900 text-slate-100 placeholder:text-slate-500 hover:border-slate-500 focus:border-cyan-400 focus:ring-cyan-400/10" : "border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 hover:border-sky-400 focus:border-sky-500 focus:ring-sky-500/10"}`;
  const uiInput = `h-12 w-full px-3.5 ${inputShell}`;
  const roInput = dk ? "cursor-default bg-slate-800/70 text-slate-400 hover:border-slate-600 focus:border-slate-600 focus:ring-0" : "cursor-default bg-slate-100 text-slate-500 hover:border-slate-200 focus:border-slate-200 focus:ring-0";
  const uiLabel = `mb-1.5 block text-[11px] font-black tracking-wide ${dk ? "text-slate-400" : "text-slate-500"}`;
  const rateChip = `flex h-12 items-center whitespace-nowrap rounded-xl border px-3.5 text-sm font-bold shadow-sm ${dk ? "border-slate-600 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-700"}`;
  const chevPos = `pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${dk ? "text-slate-500" : "text-slate-400"}`;
  const identExIcon = dk ? "from-cyan-400/20 to-cyan-400/5 text-cyan-300 ring-cyan-400/25" : "from-cyan-400/20 to-cyan-400/10 text-cyan-600 ring-cyan-400/30";

  const cBlue = { wrap: dk ? "border-blue-400/25 bg-blue-400/[0.07]" : "border-blue-300 bg-blue-50", icon: dk ? "bg-blue-400/15 text-blue-300" : "bg-blue-100 text-blue-600", title: dk ? "text-blue-300" : "text-blue-700", badge: dk ? "bg-blue-400/15 text-blue-300" : "bg-blue-100 text-blue-700" };
  const cAmber = { wrap: dk ? "border-amber-400/25 bg-amber-400/[0.07]" : "border-amber-300 bg-amber-50", icon: dk ? "bg-amber-400/15 text-amber-300" : "bg-amber-100 text-amber-600", title: dk ? "text-amber-300" : "text-amber-700", badge: dk ? "bg-amber-400/15 text-amber-300" : "bg-amber-100 text-amber-700" };
  const cEmerald = { wrap: dk ? "border-emerald-400/25 bg-emerald-400/[0.07]" : "border-emerald-300 bg-emerald-50", icon: dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-600", title: dk ? "text-emerald-300" : "text-emerald-700", badge: dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-700" };

  const fld = (label: string, node: ReactNode, cls = "") => (<div className={cls}><label className={uiLabel}>{label}</label>{node}</div>);
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

  const sameBox = (txt: string) => (
    <div className={`flex items-start gap-3 rounded-2xl border p-4 text-sm font-bold ${dk ? "border-slate-600 bg-slate-700/40 text-slate-300" : "border-slate-200 bg-slate-100 text-slate-600"}`}>
      <Ic n="info" className="h-5 w-5 shrink-0 opacity-70 mt-0.5" /><span className="leading-6">{txt}</span>
    </div>
  );

  const rateBox = (c: { wrap: string; icon: string; title: string }, title: string, formContent: ReactNode, badges: ReactNode) => (
    <div className={`space-y-4 rounded-2xl border p-4 transition-colors md:p-5 ${c.wrap}`}>
      <div className="flex items-center gap-2.5"><span className={`grid h-9 w-9 place-items-center rounded-xl ${c.icon}`}><Ic n="rate" className="h-4 w-4" /></span><b className={`text-sm font-black ${c.title}`}>{title}</b></div>
      {formContent}<div className="flex flex-wrap items-center gap-2.5">{badges}</div>
    </div>
  );

  const pill = (cls: string, txt: string, check = false) => !txt ? null : (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${cls}`}>{check && <Ic n="check" className="h-3.5 w-3.5" />}{txt}</span>
  );

  // ✅ کامپوننت dropdown عملیات
  const ActionMenu = ({ tx }: { tx: Transaction }) => {
    const isOpen = openMenuId === tx.id;
    const isVoided = tx.status === "voided";

    return (
      <div className="relative" ref={isOpen ? menuRef : null}>
        <button
          onClick={(e) => { e.stopPropagation(); toggleMenu(tx.id); }}
          className={`grid h-8 w-8 place-items-center rounded-lg border transition active:scale-95 ${
            isOpen
              ? dk ? "border-blue-400/50 bg-blue-400/20 text-blue-300" : "border-blue-400 bg-blue-50 text-blue-600"
              : dk ? "border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-slate-200" : "border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          }`}
        >
          <Ic n="dots" className="h-4 w-4" />
        </button>

        {isOpen && (
          <div className={`hw-menu absolute left-0 top-full z-20 mt-1.5 w-44 overflow-hidden rounded-xl border shadow-xl ${dk ? "border-slate-600 bg-slate-800" : "border-slate-200 bg-white"}`}>
            {!isVoided && (
              <>
                <button onClick={() => { setOpenMenuId(null); voidTransaction(tx); }} className={`flex w-full items-center gap-2 px-3 py-2.5 text-right text-xs font-bold transition ${dk ? "text-slate-200 hover:bg-amber-400/15 hover:text-amber-300" : "text-slate-700 hover:bg-amber-50 hover:text-amber-600"}`}>
                  <Ic n="xCircle" className="h-4 w-4" /><span>لغو معامله</span>
                </button>
                <div className={`h-px ${dk ? "bg-slate-700" : "bg-slate-100"}`} />
              </>
            )}
            {isVoided && (
              <>
                <button onClick={() => { setOpenMenuId(null); restoreTransaction(tx); }} className={`flex w-full items-center gap-2 px-3 py-2.5 text-right text-xs font-bold transition ${dk ? "text-slate-200 hover:bg-emerald-400/15 hover:text-emerald-300" : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-600"}`}>
                  <Ic n="undo" className="h-4 w-4" /><span>برگرداندن معامله</span>
                </button>
                <div className={`h-px ${dk ? "bg-slate-700" : "bg-slate-100"}`} />
              </>
            )}
            <button onClick={() => { setOpenMenuId(null); deleteTransaction(tx); }} className={`flex w-full items-center gap-2 px-3 py-2.5 text-right text-xs font-bold transition ${dk ? "text-rose-300 hover:bg-rose-400/15" : "text-rose-600 hover:bg-rose-50"}`}>
              <Ic n="trash" className="h-4 w-4" /><span>حذف</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  const tabs = [
    { id: "exchange" as const, label: "تبادل ارز", icon: "swap" as IconName },
    { id: "transfer" as const, label: "انتقال بین مشتریان", icon: "users" as IconName },
    { id: "convert" as const, label: "تبدیل ارز مشتری", icon: "user" as IconName },
  ];

  return (
    <div dir="rtl" className={dk ? "dark" : ""}>
      <style>{`@import url("https://fonts.googleapis.com/css2?family=Lalezar&family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap");.ex-font{font-family:"Vazirmatn","Segoe UI",Tahoma,sans-serif}.ex-display{font-family:"Lalezar","Vazirmatn",Tahoma,sans-serif;letter-spacing:.01em}.dark{color-scheme:dark}@keyframes exUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}.ex-up{animation:exUp .5s cubic-bezier(.22,.8,.35,1) both}@keyframes menuIn{from{opacity:0;transform:scale(.95) translateY(-4px)}to{opacity:1;transform:scale(1) translateY(0)}}.ex-menu{animation:menuIn .15s ease-out}details>summary{list-style:none}details>summary::-webkit-details-marker{display:none}::selection{background:rgba(59,130,246,.25)}`}</style>

      <div className={`ex-font relative min-h-screen overflow-x-hidden antialiased transition-colors duration-500 ${dk ? "bg-[#0f172a] text-slate-100" : "bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 text-slate-800"}`}>
        <div className={`fixed inset-x-0 top-0 z-30 h-1 bg-gradient-to-l ${dk ? "from-cyan-400 via-sky-400 to-emerald-400" : "from-cyan-500 via-sky-500 to-emerald-500"}`} />
        <div className="relative z-10 mx-auto w-full max-w-7xl space-y-4 md:space-y-6 px-3 pb-16 pt-5 md:px-8 md:pt-9">
          <header className="ex-up flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0">
              <div className="relative grid h-11 w-11 md:h-14 md:w-14 shrink-0 place-items-center rounded-xl md:rounded-2xl bg-gradient-to-br from-cyan-500 via-sky-500 to-emerald-400 text-white shadow-lg shadow-cyan-500/30 ring-1 ring-white/30">
                <Ic n="swap" className="h-5 w-5 md:h-6 md:w-6" />
                <span className={`absolute -bottom-1 -left-1 md:-bottom-1.5 md:-left-1.5 grid h-4 min-w-4 md:h-5 md:min-w-5 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-400 px-1 text-[7px] md:text-[8px] font-black text-white ring-2 ${dk ? "ring-[#0f172a]" : "ring-[#eff6ff]"}`}>EX</span>
              </div>
              <div className="min-w-0">
                <h1 className={`ex-display text-2xl md:text-4xl leading-none ${heading}`}>تبادل ارز</h1>
                <p className={`mt-1 text-[10px] md:text-xs font-bold ${subText}`}>خرید، فروش، انتقال و تبدیل ارز</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2.5">
              <div className={`hidden sm:flex items-center gap-2 rounded-xl border px-3 py-2 shadow-sm backdrop-blur ${glassChip}`}>
                <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" /></span>
                <span dir="ltr" className={`text-xs font-bold tabular-nums ${dk ? "text-slate-100" : "text-slate-700"}`}>{currentDateTime || "--:--"}</span>
              </div>
              <button onClick={() => setTheme(dk ? "light" : "dark")} className={`group grid h-10 w-10 md:h-11 md:w-11 cursor-pointer place-items-center rounded-lg md:rounded-xl border shadow-sm backdrop-blur transition-all duration-300 active:scale-90 ${dk ? "border-slate-600 bg-slate-800/85 text-amber-300 hover:border-amber-300" : "border-slate-200 bg-white/85 text-slate-600 hover:border-cyan-400"}`}>
                {dk ? <Ic n="sun" className="h-4 w-4 transition-transform duration-500 group-hover:rotate-45" /> : <Ic n="moon" className="h-4 w-4 transition-transform duration-500 group-hover:-rotate-12" />}
              </button>
            </div>
          </header>

          <div className="ex-up grid grid-cols-2 md:grid-cols-4 gap-3" style={{ animationDelay: "70ms" }}>
            {[
              { label: "تعداد معاملات", value: transactions.length, color: dk ? "text-cyan-300" : "text-cyan-600" },
              { label: "معاملات فعال", value: transactions.filter(t => t.status === "active").length, color: dk ? "text-emerald-300" : "text-emerald-600" },
              { label: "معاملات لغوشده", value: transactions.filter(t => t.status === "voided").length, color: dk ? "text-rose-300" : "text-rose-600" },
              { label: "مشتریان", value: customers.length, color: dk ? "text-amber-300" : "text-amber-600" },
            ].map((stat, i) => (
              <div key={i} className={`rounded-xl border p-3 text-center ${dk ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-white"}`}>
                <div className={`text-xl font-black tabular-nums ${stat.color}`}>{stat.value}</div>
                <div className={`text-[10px] font-bold mt-1 ${subText}`}>{stat.label}</div>
              </div>
            ))}
          </div>

          <div className={`ex-up flex gap-1.5 md:gap-2 rounded-xl md:rounded-2xl border p-1.5 md:p-2 shadow-sm backdrop-blur ${glassChip}`} style={{ animationDelay: "140ms" }}>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 md:gap-2 rounded-lg md:rounded-xl px-3 md:px-5 py-2.5 md:py-3 text-xs md:text-sm font-black transition-all duration-300 active:scale-[0.97] ${activeTab === tab.id ? `bg-gradient-to-l shadow-lg ${dk ? "from-cyan-400 to-sky-400 text-slate-950" : "from-cyan-500 via-sky-500 to-emerald-500 text-white"}` : dk ? "text-slate-400 hover:bg-slate-700/60 hover:text-slate-100" : "text-slate-500 hover:bg-cyan-50 hover:text-slate-800"}`}>
                <Ic n={tab.icon} className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {activeTab === "exchange" && (
            <section className={`ex-up space-y-4 md:space-y-5 p-4 md:p-7 ${uiCard}`}>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${identExIcon}`}><Ic n="swap" className="h-5 w-5" /></span>
                <div className="flex-1 min-w-0">
                  <h2 className={`ex-display text-xl md:text-2xl leading-none ${heading}`}>تبادل ارز</h2>
                  <p className={`mt-1 text-[11px] font-bold ${subText}`}>خرید و فروش ارز با مشتری</p>
                </div>
              </div>

              {/* ✅ نمایش موجودی مشتری */}
              {selectedCustomer && (
                <div className={`rounded-xl border p-3 ${dk ? "border-cyan-400/30 bg-cyan-400/10" : "border-cyan-200 bg-cyan-50"}`}>
                  <div className="flex items-center gap-2 mb-2"><Ic n="wallet" className={`h-4 w-4 ${dk ? "text-cyan-300" : "text-cyan-600"}`} /><b className={`text-xs font-black ${dk ? "text-cyan-300" : "text-cyan-700"}`}>موجودی حساب {selectedCustomer.name}</b></div>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-2 text-[10px] font-bold">
                    {currencies.map(cur => (
                      <div key={cur} className={`rounded-lg px-2 py-1.5 ${dk ? "bg-slate-900/50" : "bg-white"}`}>
                        <div className={subText}>{labels[cur]}</div>
                        <div className={`font-black tabular-nums ${dk ? "text-slate-100" : "text-slate-700"}`}>{fmt(selectedCustomer.balances[cur] || 0)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className={`rounded-2xl border p-4 ${dk ? "border-slate-600 bg-slate-900/50" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-center gap-2.5 mb-4"><span className={`grid h-9 w-9 place-items-center rounded-xl ${dk ? "bg-cyan-400/15 text-cyan-300" : "bg-cyan-100 text-cyan-600"}`}><Ic n="swap" className="h-4 w-4" /></span><b className={`text-sm font-black ${dk ? "text-cyan-300" : "text-cyan-700"}`}>معلومات معامله</b></div>
                <div className="grid gap-3 md:gap-4 sm:grid-cols-3 mb-4">
                  {/* ✅ فیلد مشتری با custom dropdown */}
                  {fld("مشتری *", (
                    <div className="relative" ref={customerListRef}>
                      <input
                        value={customer}
                        onChange={e => {
                          const val = e.target.value;
                          setCustomer(val);
                          setCustomerFilter(val);
                          setShowCustomerList(true);
                          const c = customers.find(c => c.name === val);
                          if (c) {
                            setCustomerPhone(c.phone || "");
                            setCustomerTelegram(c.telegram || "");
                          } else {
                            setCustomerPhone("");
                            setCustomerTelegram("");
                          }
                        }}
                        onFocus={() => setShowCustomerList(true)}
                        placeholder="انتخاب از لیست یا نوشتن نام جدید…"
                        className={uiInput}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCustomerList(!showCustomerList)}
                        className={`absolute left-2 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-lg transition ${dk ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}
                      >
                        <Ic n="chevron" className={`h-4 w-4 transition-transform ${showCustomerList ? "rotate-180" : ""}`} />
                      </button>

                      {showCustomerList && (
                        <div className={`ex-menu absolute left-0 top-full z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border shadow-xl ${dk ? "border-slate-600 bg-slate-800" : "border-slate-200 bg-white"}`}>
                          {filteredCustomerList.length === 0 ? (
                            <div className={`px-4 py-3 text-xs text-center ${subText}`}>مشتری‌ای یافت نشد</div>
                          ) : (
                            filteredCustomerList.map((c, idx) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => selectCustomer(c)}
                                className={`flex w-full items-center gap-2 px-3 py-2.5 text-right text-xs font-bold transition ${dk ? "text-slate-200 hover:bg-cyan-400/15 hover:text-cyan-300" : "text-slate-700 hover:bg-cyan-50 hover:text-cyan-600"}`}
                              >
                                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-black text-white bg-gradient-to-br from-cyan-500 to-sky-500`}>
                                  {idx + 1}
                                </span>
                                <span className="flex-1 truncate">{c.name}</span>
                                {c.phone && <span className={`text-[10px] ${subText}`} dir="ltr">{c.phone}</span>}
                              </button>
                            ))
                          )}
                          <div className={`h-px ${dk ? "bg-slate-700" : "bg-slate-100"}`} />
                          <div className={`px-3 py-2 text-[10px] text-center ${subText}`}>
                            یا نام جدید بنویسید (در لیست مشتریان ذخیره نمی‌شود)
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {fld("کد پیگیری", (
                    <div className="relative">
                      <input readOnly dir="ltr" value={nextTrackingCode} className={`${uiInput} ${roInput} pl-14 text-left tabular-nums font-black text-[15px]`} />
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 rounded-lg bg-gradient-to-r from-cyan-500 to-sky-500 px-2 py-1 text-[9px] font-black text-white">FX</span>
                    </div>
                  ))}
                  {fld("تاریخ (شمسی)", (<input readOnly value={currentDateTime} className={`${uiInput} ${roInput}`} />))}
                </div>
                <div className="grid gap-3 md:gap-4 sm:grid-cols-2 mb-4">
                  {fld("شماره تماس مشتری", (<input className={uiInput} value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="07xxxxxxxx" />))}
                  {fld("چت آی‌دی تلگرام", (<input className={uiInput} value={customerTelegram} onChange={e => setCustomerTelegram(e.target.value)} placeholder="@example یا شماره" />))}
                </div>
                <div className="grid gap-3 md:gap-4 sm:grid-cols-3 mb-4">
                  {fld("نوع معامله *", sel(dealType, (v) => setDealType(v as DealType | ""), [["", "انتخاب کنید"], ["buy", "خرید"], ["sell", "فروش"]]))}
                  {fld("ارز مبدا *", sel(fromCurrency, (v) => setFromCurrency(v as Currency), currencies.map(c => [c, labels[c]])))}
                  {fld("ارز مقصد *", sel(toCurrency, (v) => setToCurrency(v as Currency), currencies.map(c => [c, labels[c]])))}
                </div>
                <div className="grid gap-3 md:gap-4 sm:grid-cols-3 mb-4">
                  {fld("مبلغ *", (<input type="text" inputMode="decimal" dir="ltr" className={`${uiInput} text-left tabular-nums`} value={fromAmount} onChange={e => setFromAmount(toNumericText(e.target.value))} placeholder="مثلاً 10000" />))}
                  {fld("کمیشن", (<input type="text" inputMode="decimal" dir="ltr" className={`${uiInput} text-left tabular-nums`} value={commission} onChange={e => setCommission(toNumericText(e.target.value))} placeholder="مثلاً 200" />))}
                  {fld("مبلغ نهایی", (<input readOnly value={`${fmt(finalAmount)} ${labels[toCurrency]}`} className={`${uiInput} ${roInput} text-left tabular-nums`} />))}
                </div>
              </div>

              {rateMode === "same" && (<div>{sameBox("ارز مبدا و مقصد یکسان است؛ مبلغ نهایی برابر مبلغ مبدا خواهد بود.")}</div>)}
              {rateMode === "afn" && afnForeign && (
                <div>{rateBox(cBlue, "نرخ دستی در برابر افغانی", (
                  <div><label className={uiLabel}>نرخ</label>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className={rateChip}>{rateUnits[afnForeign]} {labels[afnForeign]} =</span>
                      <input type="text" inputMode="decimal" dir="ltr" value={rate} onChange={(e) => setRate(toNumericText(e.target.value))} placeholder="0" className={`h-12 w-32 md:w-44 px-3 text-left text-sm font-bold tabular-nums ${inputShell}`} />
                      <span className={rateChip}>{labels.AFN}</span>
                    </div>
                  </div>
                ), (<>{pill(cBlue.badge, rateValue > 0 ? `نرخ ثبت‌شده: ${afnRateLabel(afnForeign, rateValue)}` : "", true)}{pill(cEmerald.badge, convertedAmount > 0 ? `نتیجه: ${fmt(convertedAmount)} ${labels[toCurrency]}` : "")}</>))}</div>
              )}
              {rateMode === "direct" && (
                <div>{rateBox(cAmber, "نرخ مستقیم جفت‌ارز", (
                  <div className="grid items-end gap-3 md:gap-4 md:grid-cols-2">
                    {fld("مبنای نرخ", sel(directBaseValue, (v) => setDirectBase(v as Currency), [[fromCurrency, labels[fromCurrency]], [toCurrency, labels[toCurrency]]]))}
                    <div>
                      <label className={uiLabel}>نرخ مستقیم</label>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={rateChip}>{rateUnits[directBaseValue]} {labels[directBaseValue]} =</span>
                        <input type="text" inputMode="decimal" dir="ltr" value={rate} onChange={(e) => setRate(toNumericText(e.target.value))} placeholder="0" className={`h-12 w-28 md:w-40 px-3 text-left text-sm font-bold tabular-nums ${inputShell}`} />
                        <span className={rateChip}>{directCounter ? labels[directCounter] : ""}</span>
                      </div>
                    </div>
                  </div>
                ), (<>{pill(cAmber.badge, rateValue > 0 && directCounter ? `نرخ ثبت‌شده: ${directRateLabel(directBaseValue, directCounter, rateValue)}` : "", true)}{pill(cEmerald.badge, convertedAmount > 0 ? `نتیجه: ${fmt(convertedAmount)} ${labels[toCurrency]}` : "")}</>))}</div>
              )}

              <div className={`rounded-2xl border p-4 ${dk ? "border-slate-600 bg-slate-900/50" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-center gap-2.5 mb-4"><span className={`grid h-9 w-9 place-items-center rounded-xl ${dk ? "bg-amber-400/15 text-amber-300" : "bg-amber-100 text-amber-600"}`}><Ic n="rate" className="h-4 w-4" /></span><b className={`text-sm font-black ${dk ? "text-amber-300" : "text-amber-700"}`}>کارمزد</b></div>
                <div className="grid gap-3 md:gap-4 sm:grid-cols-2">
                  {fld("کارمزد از حساب", (
                    <div className={`flex rounded-xl border p-1 ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-white"}`}>
                      <button type="button" onClick={() => setCommissionPayer("sender")} className={`flex-1 rounded-lg px-3 py-2 text-xs font-black transition-all ${commissionPayer === "sender" ? dk ? "bg-cyan-400 text-slate-950 shadow" : "bg-sky-500 text-white shadow" : dk ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-700"}`}>فرستنده</button>
                      <button type="button" onClick={() => setCommissionPayer("receiver")} className={`flex-1 rounded-lg px-3 py-2 text-xs font-black transition-all ${commissionPayer === "receiver" ? dk ? "bg-cyan-400 text-slate-950 shadow" : "bg-sky-500 text-white shadow" : dk ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-700"}`}>گیرنده</button>
                    </div>
                  ))}
                  {fld("ارز کارمزد", (
                    <div className="relative">
                      <select value={commissionCurrency} onChange={(e) => setCommissionCurrency(e.target.value as Currency)} className={`${uiInput} cursor-pointer appearance-none pl-9`}>
                        {currencies.map((c) => (<option key={c} value={c}>{labels[c]}</option>))}
                      </select>
                      <span className={chevPos}><Ic n="chevron" className="h-4 w-4" /></span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button onClick={handleSubmitClick} className={`group flex h-[50px] md:h-[52px] flex-1 min-w-[200px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-l text-base font-black shadow-lg transition-all duration-300 hover:shadow-xl hover:brightness-110 active:scale-[0.985] ${dk ? "from-cyan-400 to-sky-400 text-slate-950" : "from-cyan-500 via-sky-500 to-emerald-500 text-white"}`}>
                  ثبت معامله
                  <Ic n="arrowLeft" className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
                </button>
              </div>
            </section>
          )}

          {/* لیست معاملات */}
          <section className={`ex-up overflow-hidden ${uiCard}`}>
            <div className="flex flex-wrap items-center gap-3 p-4 md:p-5 pb-3 md:pb-4 md:px-7 md:pt-6">
              <span className={`grid h-10 w-10 md:h-11 md:w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${identExIcon}`}><Ic n="doc" className="h-5 w-5" /></span>
              <div className="flex-1 min-w-0">
                <h2 className={`ex-display text-xl md:text-2xl leading-none ${heading}`}>لیست معاملات</h2>
                <p className={`mt-1 text-[11px] font-bold ${subText}`}>مشاهده، لغو، برگرداندن و حذف معاملات</p>
              </div>
            </div>
            <div className="px-4 md:px-7 pb-4">
              {transactions.length === 0 ? (
                <div className={`flex flex-col items-center gap-3 px-6 py-12 ${dk ? "text-slate-500" : "text-slate-400"}`}>
                  <span className={`grid h-14 w-14 place-items-center rounded-2xl border border-dashed ${dk ? "border-slate-600 bg-slate-800/40" : "border-slate-300 bg-slate-50"}`}><Ic n="inbox" className="h-6 w-6 opacity-70" /></span>
                  <p className="text-sm font-black text-center">هیچ معامله‌ای وجود ندارد.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px] text-sm">
                    <thead>
                      <tr className={`border-y ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
                        {["شماره", "کد پیگیری", "تاریخ", "مشتری", "نوع", "مبلغ مبدا", "مبلغ مقصد", "نرخ", "کارمزد", "وضعیت", "عملیات"].map((h, i) => (
                          <th key={h} className={`px-4 py-3 text-right text-[11px] font-black text-slate-400 ${i === 0 ? "md:px-7" : ""} ${i === 10 ? "md:px-7" : ""}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${dk ? "divide-slate-700/60" : "divide-slate-100"}`}>
                      {transactions.map((tx, index) => (
                        <tr key={tx.id} className={`transition-colors ${dk ? "hover:bg-slate-700/30" : "hover:bg-cyan-50/70"}`}>
                          <td className="px-4 py-3.5 md:px-7"><span className={`grid h-8 w-8 place-items-center rounded-lg text-[11px] font-black tabular-nums ${dk ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"}`}>{index + 1}</span></td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[12px] font-black tabular-nums ${dk ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300" : "border-cyan-300 bg-cyan-50 text-cyan-700"}`} dir="ltr">
                              <Ic n="tag" className="h-3 w-3" />{tx.trackingCode}
                            </span>
                          </td>
                          <td className={`whitespace-nowrap px-4 py-3.5 text-xs tabular-nums ${dk ? "text-slate-400" : "text-slate-500"}`}><span dir="ltr">{dateLabel(tx.date)}</span></td>
                          <td className={`px-4 py-3.5 text-[13px] font-bold ${dk ? "text-slate-200" : "text-slate-700"}`}>{tx.customerId || tx.senderId || "-"}</td>
                          <td className="px-4 py-3.5"><span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-black ${tx.type === "exchange" ? dk ? "bg-cyan-400/15 text-cyan-300" : "bg-cyan-100 text-cyan-700" : tx.type === "transfer" ? dk ? "bg-violet-400/15 text-violet-300" : "bg-violet-100 text-violet-700" : dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-700"}`}>{tx.type === "exchange" ? "تبادل" : tx.type === "transfer" ? "انتقال" : "تبدیل"}</span></td>
                          <td className="px-4 py-3.5"><div className="text-[13px] font-black tabular-nums">{fmt(tx.fromAmount)}</div><div className={`text-[10px] font-bold ${subText}`}>{labels[tx.fromCurrency]}</div></td>
                          <td className="px-4 py-3.5"><div className="text-[13px] font-black tabular-nums">{fmt(tx.toAmount)}</div><div className={`text-[10px] font-bold ${subText}`}>{labels[tx.toCurrency]}</div></td>
                          <td className={`px-4 py-3.5 text-xs ${subText}`}>{tx.rateLabel || "-"}</td>
                          <td className="px-4 py-3.5 text-xs font-bold tabular-nums">{tx.commission ? `${fmt(tx.commission)} ${tx.commissionCurrency ? labels[tx.commissionCurrency] : ""}` : "-"}</td>
                          <td className="px-4 py-3.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${tx.status === "active" ? dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-700" : dk ? "bg-rose-400/15 text-rose-300" : "bg-rose-100 text-rose-700"}`}>{tx.status === "active" ? "فعال" : "لغوشده"}</span></td>
                          <td className="px-4 py-3.5 md:px-7"><ActionMenu tx={tx} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* ✅ مودال پیش‌نمایش قبل از ثبت */}
      {previewOpen && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 md:p-4 backdrop-blur-sm" onClick={() => { setPreviewOpen(false); setPreviewData(null); }}>
          <div className={`ex-up w-full max-w-2xl overflow-hidden rounded-xl md:rounded-2xl border shadow-2xl ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-white"}`} onClick={(e) => e.stopPropagation()}>
            <div className={`flex items-center justify-between border-b px-4 md:px-5 py-3 md:py-4 ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
              <b className={`flex items-center gap-2 text-sm ${dk ? "text-slate-100" : "text-slate-800"}`}>
                <span className={`grid h-8 w-8 place-items-center rounded-lg ${dk ? "bg-cyan-400/10 text-cyan-300" : "bg-cyan-100 text-cyan-600"}`}><Ic n="doc" className="h-4 w-4" /></span>
                جزئیات معامله قبل از ثبت
              </b>
              <button onClick={() => { setPreviewOpen(false); setPreviewData(null); }} className={`grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-slate-400 transition-all duration-300 hover:rotate-90 ${dk ? "hover:bg-slate-700 hover:text-white" : "hover:bg-slate-100 hover:text-slate-700"}`}><Ic n="x" className="h-4 w-4" /></button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-4 md:px-5 py-4 space-y-4">
              <div className={`flex items-center justify-between rounded-xl border p-3 ${dk ? "border-cyan-400/30 bg-cyan-400/10" : "border-cyan-300 bg-cyan-50"}`}>
                <b className={`text-xs font-black ${dk ? "text-cyan-300" : "text-cyan-700"}`}>کد پیگیری</b>
                <span className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-black tabular-nums ${dk ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300" : "border-cyan-300 bg-cyan-50 text-cyan-700"}`} dir="ltr">
                  <Ic n="tag" className="h-3.5 w-3.5" />{previewData.trackingCode}
                </span>
              </div>
              <div className={`rounded-xl border p-4 ${dk ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-center gap-2 mb-3"><span className={`grid h-7 w-7 place-items-center rounded-lg ${dk ? "bg-cyan-400/15 text-cyan-300" : "bg-cyan-100 text-cyan-600"}`}><Ic n="swap" className="h-3.5 w-3.5" /></span><b className={`text-xs font-black ${dk ? "text-cyan-300" : "text-cyan-700"}`}>معلومات معامله</b></div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className={subText}>تاریخ: </span><b>{currentDateTime}</b></div>
                  <div><span className={subText}>نوع: </span><b>{previewData.dealType === "buy" ? "خرید" : "فروش"}</b></div>
                  <div><span className={subText}>مشتری: </span><b>{previewData.customerId}</b></div>
                  <div><span className={subText}>تلفن: </span><b dir="ltr">{previewData.customerPhone || "-"}</b></div>
                  <div><span className={subText}>تلگرام: </span><b dir="ltr">{previewData.customerTelegram || "-"}</b></div>
                  <div><span className={subText}>مبلغ مبدا: </span><b>{fmt(previewData.fromAmount)} {labels[previewData.fromCurrency]}</b></div>
                  <div><span className={subText}>مبلغ مقصد: </span><b>{fmt(previewData.toAmount)} {labels[previewData.toCurrency]}</b></div>
                  <div><span className={subText}>نرخ: </span><b>{previewData.rateLabel}</b></div>
                  <div><span className={subText}>کارمزد: </span><b>{previewData.commission ? `${fmt(previewData.commission)} ${previewData.commissionCurrency ? labels[previewData.commissionCurrency] : ""}` : "-"}</b></div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <button onClick={confirmRegister} className={`flex h-[48px] flex-1 min-w-[180px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-l text-sm font-black shadow-lg transition-all hover:brightness-110 active:scale-[0.98] ${dk ? "from-emerald-400 to-teal-400 text-slate-950" : "from-emerald-500 to-teal-500 text-white"}`}>
                  ثبت نهایی معامله<Ic n="check" className="h-4 w-4" />
                </button>
                <button onClick={() => { setPreviewOpen(false); setPreviewData(null); }} className={`flex h-[48px] px-6 cursor-pointer items-center justify-center rounded-xl border text-sm font-bold transition-all active:scale-95 ${dk ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>انصراف</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 left-6 z-[99] rounded-xl px-4 py-3 text-sm font-bold shadow-lg ${dk ? "bg-slate-800 text-slate-100 border border-slate-600" : "bg-slate-900 text-white"}`}>{toast}</div>
      )}
    </div>
  );
}
