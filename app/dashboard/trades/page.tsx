"use client";

import { useEffect, useState, useMemo, useRef, type ReactNode } from "react";

type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";
type RateMode = "same" | "afn" | "direct";
type DealType = "buy" | "sell";
type CommissionPayer = "sender" | "receiver";

type Customer = {
  id: string;
  name: string;
  phone?: string;
  telegram?: string;
  balances: Record<Currency, number>;
};

type Transaction = {
  id: string;
  trackingCode: string;
  type: "exchange" | "transfer" | "convert";
  dealType?: DealType;
  date: string;
  customerId?: string;
  senderId?: string;
  receiverId?: string;
  fromCurrency: Currency;
  fromAmount: number;
  toCurrency: Currency;
  toAmount: number;
  rate: number;
  rateLabel: string;
  rateBase?: Currency;
  commission?: number;
  commissionCurrency?: Currency;
  commissionPayer?: CommissionPayer;
  description?: string;
  status: "active" | "voided";
  profit?: number;
  profitCurrency?: Currency;
  customerPhone?: string;
  customerTelegram?: string;
};

type ExchangeFormErrors = { dealType?: string; customer?: string; receivedAmount?: string; rate?: string; paidAmount?: string; exchangeCommission?: string; };
type TransferFormErrors = { sender?: string; receiver?: string; senderAmount?: string; transferRate?: string; receiverAmount?: string; commission?: string; };
type ConvertFormErrors = { customer?: string; amount?: string; rate?: string; convertedAmount?: string; commission?: string; };

const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const labels: Record<Currency, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };
const rateUnits: Record<Currency, number> = { AFN: 1, USD: 1, EUR: 1, IRR: 1000, PKR: 1000 };

const CUSTOMERS_KEY = "fx-customers";
const TRANSACTIONS_KEY = "fx-transactions";
const HAWALAS_KEY = "hawalas";
const SHARED_COUNTER_KEY = "shared-tracking-counter";

const initialCustomers: Customer[] = [
  { id: "1", name: "احمد رحیمی", phone: "0700123456", telegram: "@ahmad_rahimi", balances: { AFN: 500000, USD: 10000, EUR: 0, IRR: 0, PKR: 0 } },
  { id: "2", name: "محمد ظاهر", phone: "0700654321", telegram: "@mohammad_zahir", balances: { AFN: 200000, USD: 5000, EUR: 0, IRR: 0, PKR: 0 } },
  { id: "3", name: "فاطمه حسینی", phone: "0700789123", telegram: "@fatema_hosseini", balances: { AFN: 0, USD: 0, EUR: 0, IRR: 50000000, PKR: 0 } },
];

function getStoredCustomers(): Customer[] {
  if (typeof window === "undefined") return initialCustomers;
  try {
    const raw = localStorage.getItem(CUSTOMERS_KEY);
    if (!raw) return initialCustomers;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object" && parsed[0] !== null && "id" in parsed[0] && "name" in parsed[0]) {
      return parsed as Customer[];
    }
    return initialCustomers;
  } catch {
    return initialCustomers;
  }
}

const normalizeDigits = (s: string) =>
  s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

function toNumericText(v: string) {
  let s = normalizeDigits(String(v || "")).replace(/[^0-9.]/g, "");
  const firstDot = s.indexOf(".");
  if (firstDot !== -1) s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
  return s;
}

const parseAmount = (v: string) => {
  const n = Number(normalizeDigits(String(v || "")).replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const fmt = (n: number) => (Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 8 }) : "0");

const newId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try { return crypto.randomUUID(); } catch {}
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
const shortId = (id: string) => id.slice(-6);

function shamsiParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "0";
  return { year: get("year"), month: get("month"), day: get("day") };
}

function formatDateTime(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const s = shamsiParts(d);
  return `${s.year}/${s.month}/${s.day} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const shamsiMonthNames = ["حمل", "ثور", "جوزا", "سرطان", "اسد", "سنبله", "میزان", "عقرب", "قوس", "جدی", "دلو", "حوت"];

function shamsiMonthLabel(d: Date) {
  const s = shamsiParts(d);
  const m = parseInt(s.month, 10);
  const day = parseInt(s.day, 10);
  if (!Number.isFinite(m) || m < 1 || m > 12 || !Number.isFinite(day)) return "";
  return `${day} ${shamsiMonthNames[m - 1]} ${s.year}`;
}

function dateLabel(s: string) {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "-" : formatDateTime(d);
}

function dealTypeLabel(d?: DealType) {
  if (d === "buy") return "خرید";
  if (d === "sell") return "فروش";
  return "-";
}

function getRateMode(from: Currency, to: Currency): RateMode {
  if (from === to) return "same";
  if (from === "AFN" || to === "AFN") return "afn";
  return "direct";
}

function getAfnForeign(from: Currency, to: Currency): Currency | null {
  if (from === to) return null;
  if (from === "AFN") return to;
  if (to === "AFN") return from;
  return null;
}

function preferredDirectBase(a: Currency, b: Currency): Currency {
  const priority: Currency[] = ["USD", "EUR", "PKR", "IRR"];
  for (const c of priority) {
    if (a === c) return c;
    if (b === c) return c;
  }
  return a;
}

function getSafeDirectBase(baseState: Currency, a: Currency, b: Currency): Currency {
  if (a === baseState || b === baseState) return baseState;
  return preferredDirectBase(a, b);
}

function getDirectCounter(base: Currency, a: Currency, b: Currency): Currency | null {
  if (a === base) return b;
  if (b === base) return a;
  return null;
}

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

const afnRateLabel = (foreign: Currency, rate: number) =>
  `${fmt(rateUnits[foreign])} ${labels[foreign]} = ${fmt(rate)} ${labels.AFN}`;

const directRateLabel = (base: Currency, counter: Currency, rate: number) =>
  `${fmt(rateUnits[base])} ${labels[base]} = ${fmt(rate)} ${labels[counter]}`;

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
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const items = JSON.parse(raw);
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

const iconPaths = {
  swap: "M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5",
  users: "M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z",
  user: "M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z",
  sun: "M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z",
  moon: "M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z",
  clock: "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  search: "m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z",
  chevron: "m19.5 8.25-7.5 7.5-7.5-7.5",
  pencil: "m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10",
  printer: "M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z",
  eye: "M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  x: "M6 18 18 6M6 6l12 12",
  xCircle: "m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  check: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  alert: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z",
  doc: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
  inbox: "M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z",
  arrowLeft: "M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18",
  down: "M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3",
  up: "M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18",
  rate: "M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941",
  info: "m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z",
  dots: "M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z",
  trash: "M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0",
  undo: "M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3",
  wallet: "M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3",
  tag: "M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z",
};

type IconName = keyof typeof iconPaths;

function Ic({ n, className = "h-5 w-5" }: { n: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={iconPaths[n]} />
    </svg>
  );
}

function DetailRow({ label, value, valueClass = "", dark = false }: { label: string; value: string; valueClass?: string; dark?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-4 border-b border-dashed py-3 last:border-0 ${dark ? "border-slate-700" : "border-slate-200"}`}>
      <span className={`shrink-0 text-[11px] font-black ${dark ? "text-slate-500" : "text-slate-400"}`}>{label}</span>
      <span className={`text-left text-[13px] font-bold ${dark ? "text-slate-200" : "text-slate-700"} ${valueClass}`}>{value}</span>
    </div>
  );
}

const currencyBadge: Record<Currency, string> = {
  AFN: "from-emerald-500 to-teal-400",
  USD: "from-sky-500 to-cyan-400",
  EUR: "from-blue-600 to-blue-400",
  IRR: "from-amber-500 to-orange-400",
  PKR: "from-rose-500 to-pink-400",
};

export default function CurrencyExchangePage() {
  const [customers, setCustomers] = useState<Customer[]>(getStoredCustomers);
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = window.localStorage.getItem(TRANSACTIONS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  useEffect(() => {
    try { localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers)); } catch {}
  }, [customers]);

  useEffect(() => {
    try { window.localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions)); } catch {}
  }, [transactions]);

  useEffect(() => {
    try { initSharedCounterFromAllSources(); } catch {}
  }, []);

  const [tab, setTab] = useState<"exchange" | "transfer" | "convert">("exchange");
  const [now, setNow] = useState<Date | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<Transaction | null>(null);

  const [showCustomerList, setShowCustomerList] = useState(false);
  const [customerFilter, setCustomerFilter] = useState("");
  const customerListRef = useRef<HTMLDivElement>(null);

  const [showSenderList, setShowSenderList] = useState(false);
  const [senderFilter, setSenderFilter] = useState("");
  const senderListRef = useRef<HTMLDivElement>(null);

  const [showReceiverList, setShowReceiverList] = useState(false);
  const [receiverFilter, setReceiverFilter] = useState("");
  const receiverListRef = useRef<HTMLDivElement>(null);

  const [showConvertList, setShowConvertList] = useState(false);
  const [convertFilter, setConvertFilter] = useState("");
  const convertListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("fx-theme");
      if (saved === "dark" || saved === "light") setTheme(saved);
    } catch {}
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem("fx-theme", theme); } catch {}
  }, [theme]);

  const dk = theme === "dark";

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const currentDateTime = now ? formatDateTime(now) : "";

  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [editingExchangeId, setEditingExchangeId] = useState<string | null>(null);
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null);
  const [editingConvertId, setEditingConvertId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [customer, setCustomer] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerTelegram, setCustomerTelegram] = useState("");
  const [exchangeDealType, setExchangeDealType] = useState<DealType | "">("");
  const [exchangeCommission, setExchangeCommission] = useState("");
  const [exchangeCommissionPayer, setExchangeCommissionPayer] = useState<CommissionPayer>("sender");
  const [exchangeCommissionCurrency, setExchangeCommissionCurrency] = useState<Currency>("AFN");
  const [exchangeDescription, setExchangeDescription] = useState("");
  const [receivedCurrency, setReceivedCurrency] = useState<Currency>("AFN");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [paidCurrency, setPaidCurrency] = useState<Currency>("USD");
  const [paidAmount, setPaidAmount] = useState("");
  const [rate, setRate] = useState("");
  const [exchangeDirectBase, setExchangeDirectBase] = useState<Currency>("USD");
  const [exchangeErrors, setExchangeErrors] = useState<ExchangeFormErrors>({});

  const [sender, setSender] = useState("");
  const [receiver, setReceiver] = useState("");
  const [senderCurrency, setSenderCurrency] = useState<Currency>("AFN");
  const [receiverCurrency, setReceiverCurrency] = useState<Currency>("AFN");
  const [senderAmount, setSenderAmount] = useState("");
  const [receiverAmount, setReceiverAmount] = useState("");
  const [transferRate, setTransferRate] = useState("");
  const [transferDirectBase, setTransferDirectBase] = useState<Currency>("USD");
  const [commission, setCommission] = useState("");
  const [transferCommissionPayer, setTransferCommissionPayer] = useState<CommissionPayer>("sender");
  const [transferCommissionCurrency, setTransferCommissionCurrency] = useState<Currency>("AFN");
  const [transferDescription, setTransferDescription] = useState("");
  const [transferErrors, setTransferErrors] = useState<TransferFormErrors>({});

  const [convertCustomer, setConvertCustomer] = useState("");
  const [convertFromCurrency, setConvertFromCurrency] = useState<Currency>("AFN");
  const [convertToCurrency, setConvertToCurrency] = useState<Currency>("USD");
  const [convertAmount, setConvertAmount] = useState("");
  const [convertRate, setConvertRate] = useState("");
  const [convertDirectBase, setConvertDirectBase] = useState<Currency>("USD");
  const [convertCommission, setConvertCommission] = useState("");
  const [convertCommissionCurrency, setConvertCommissionCurrency] = useState<Currency>("AFN");
  const [convertDescription, setConvertDescription] = useState("");
  const [convertErrors, setConvertErrors] = useState<ConvertFormErrors>({});
  const [convertedAmount, setConvertedAmount] = useState("");

  const exchangeMode = getRateMode(receivedCurrency, paidCurrency);
  const exchangeForeign = getAfnForeign(receivedCurrency, paidCurrency);
  const exchangeDirectBaseValue = exchangeMode === "direct" ? getSafeDirectBase(exchangeDirectBase, receivedCurrency, paidCurrency) : receivedCurrency;
  const exchangeDirectCounter = exchangeMode === "direct" ? getDirectCounter(exchangeDirectBaseValue, receivedCurrency, paidCurrency) : null;

  useEffect(() => {
    if (exchangeMode === "direct" && exchangeDirectBase !== exchangeDirectBaseValue) {
      setExchangeDirectBase(exchangeDirectBaseValue);
    }
  }, [exchangeMode, exchangeDirectBase, exchangeDirectBaseValue]);

  useEffect(() => { setRate(""); }, [exchangeMode, exchangeForeign, exchangeDirectBaseValue, exchangeDirectCounter]);

  const transferMode = getRateMode(senderCurrency, receiverCurrency);
  const transferForeign = getAfnForeign(senderCurrency, receiverCurrency);
  const transferDirectBaseValue = transferMode === "direct" ? getSafeDirectBase(transferDirectBase, senderCurrency, receiverCurrency) : senderCurrency;
  const transferDirectCounter = transferMode === "direct" ? getDirectCounter(transferDirectBaseValue, senderCurrency, receiverCurrency) : null;

  useEffect(() => {
    if (transferMode === "direct" && transferDirectBase !== transferDirectBaseValue) {
      setTransferDirectBase(transferDirectBaseValue);
    }
  }, [transferMode, transferDirectBase, transferDirectBaseValue]);

  useEffect(() => { setTransferRate(""); }, [transferMode, transferForeign, transferDirectBaseValue, transferDirectCounter]);

  const convertMode = getRateMode(convertFromCurrency, convertToCurrency);
  const convertForeign = getAfnForeign(convertFromCurrency, convertToCurrency);
  const convertDirectBaseValue = convertMode === "direct" ? getSafeDirectBase(convertDirectBase, convertFromCurrency, convertToCurrency) : convertFromCurrency;
  const convertDirectCounter = convertMode === "direct" ? getDirectCounter(convertDirectBaseValue, convertFromCurrency, convertToCurrency) : null;

  useEffect(() => {
    if (convertMode === "direct" && convertDirectBase !== convertDirectBaseValue) {
      setConvertDirectBase(convertDirectBaseValue);
    }
  }, [convertMode, convertDirectBase, convertDirectBaseValue]);

  useEffect(() => { setConvertRate(""); }, [convertMode, convertForeign, convertDirectBaseValue, convertDirectCounter]);

  useEffect(() => {
    const amount = parseAmount(receivedAmount);
    if (!amount) { setPaidAmount(""); return; }
    if (exchangeMode === "same") { setPaidAmount(fmt(amount)); return; }
    const r = parseAmount(rate);
    if (!r) { setPaidAmount(""); return; }
    let result = 0;
    if (exchangeMode === "afn") result = convertAfnRate(amount, receivedCurrency, paidCurrency, r);
    if (exchangeMode === "direct" && exchangeDirectCounter)
      result = convertDirectRate(amount, receivedCurrency, paidCurrency, exchangeDirectBaseValue, r);
    setPaidAmount(result ? fmt(result) : "");
  }, [receivedAmount, receivedCurrency, paidCurrency, rate, exchangeMode, exchangeDirectBaseValue, exchangeDirectCounter]);

  useEffect(() => {
    const amount = parseAmount(senderAmount);
    if (!amount) { setReceiverAmount(""); return; }
    if (transferMode === "same") { setReceiverAmount(fmt(amount)); return; }
    const r = parseAmount(transferRate);
    if (!r) { setReceiverAmount(""); return; }
    let result = 0;
    if (transferMode === "afn") result = convertAfnRate(amount, senderCurrency, receiverCurrency, r);
    if (transferMode === "direct" && transferDirectCounter)
      result = convertDirectRate(amount, senderCurrency, receiverCurrency, transferDirectBaseValue, r);
    setReceiverAmount(result ? fmt(result) : "");
  }, [senderAmount, senderCurrency, receiverCurrency, transferRate, transferMode, transferDirectBaseValue, transferDirectCounter]);

  useEffect(() => {
    const amount = parseAmount(convertAmount);
    if (!amount) { setConvertedAmount(""); return; }
    if (convertMode === "same") { setConvertedAmount(fmt(amount)); return; }
    const r = parseAmount(convertRate);
    if (!r) { setConvertedAmount(""); return; }
    let result = 0;
    if (convertMode === "afn") result = convertAfnRate(amount, convertFromCurrency, convertToCurrency, r);
    if (convertMode === "direct" && convertDirectCounter)
      result = convertDirectRate(amount, convertFromCurrency, convertToCurrency, convertDirectBaseValue, r);
    setConvertedAmount(result ? fmt(result) : "");
  }, [convertAmount, convertFromCurrency, convertToCurrency, convertRate, convertMode, convertDirectBaseValue, convertDirectCounter]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (customerListRef.current && !customerListRef.current.contains(target)) setShowCustomerList(false);
      if (senderListRef.current && !senderListRef.current.contains(target)) setShowSenderList(false);
      if (receiverListRef.current && !receiverListRef.current.contains(target)) setShowReceiverList(false);
      if (convertListRef.current && !convertListRef.current.contains(target)) setShowConvertList(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => { document.removeEventListener("click", handleClickOutside); };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    if (openMenuId) {
      document.addEventListener("click", handleClickOutside);
    }
    return () => { document.removeEventListener("click", handleClickOutside); };
  }, [openMenuId]);

  const filteredCustomerList = useMemo(() => {
    if (!customerFilter) return customers;
    const q = normalizeDigits(customerFilter.trim()).toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(q) || (c.phone && normalizeDigits(c.phone).includes(q)));
  }, [customers, customerFilter]);

  const filteredSenderList = useMemo(() => {
    if (!senderFilter) return customers;
    const q = normalizeDigits(senderFilter.trim()).toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(q) || (c.phone && normalizeDigits(c.phone).includes(q)));
  }, [customers, senderFilter]);

  const filteredReceiverList = useMemo(() => {
    if (!receiverFilter) return customers;
    const q = normalizeDigits(receiverFilter.trim()).toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(q) || (c.phone && normalizeDigits(c.phone).includes(q)));
  }, [customers, receiverFilter]);

  const filteredConvertList = useMemo(() => {
    if (!convertFilter) return customers;
    const q = normalizeDigits(convertFilter.trim()).toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(q) || (c.phone && normalizeDigits(c.phone).includes(q)));
  }, [customers, convertFilter]);

  const selectedCustomer = useMemo(() => customers.find(c => c.name === customer) || null, [customers, customer]);
  const selectedSender = useMemo(() => customers.find(c => c.name === sender) || null, [customers, sender]);
  const selectedReceiver = useMemo(() => customers.find(c => c.name === receiver) || null, [customers, receiver]);
  const selectedConvertCustomer = useMemo(() => customers.find(c => c.name === convertCustomer) || null, [customers, convertCustomer]);

  function resetExchangeForm() {
    setCustomer(""); setCustomerPhone(""); setCustomerTelegram(""); setExchangeDealType(""); setReceivedAmount(""); setPaidAmount(""); setRate("");
    setExchangeCommission(""); setExchangeCommissionPayer("sender"); setExchangeCommissionCurrency("AFN");
    setExchangeDescription(""); setExchangeErrors({}); setEditingExchangeId(null);
  }

  function resetTransferForm() {
    setSender(""); setReceiver(""); setSenderAmount(""); setReceiverAmount(""); setTransferRate("");
    setCommission(""); setTransferCommissionPayer("sender"); setTransferCommissionCurrency("AFN");
    setTransferDescription(""); setTransferErrors({}); setEditingTransferId(null);
  }

  function resetConvertForm() {
    setConvertCustomer(""); setConvertFromCurrency("AFN"); setConvertToCurrency("USD");
    setConvertAmount(""); setConvertRate(""); setConvertedAmount("");
    setConvertCommission(""); setConvertCommissionCurrency("AFN");
    setConvertDescription(""); setConvertErrors({}); setEditingConvertId(null);
  }

  function validateExchange(): ExchangeFormErrors {
    const errs: ExchangeFormErrors = {};
    if (!exchangeDealType) errs.dealType = "فیلد نوع معامله خالی است.";
    if (!customer) errs.customer = "فیلد مشتری خالی است.";
    const amount = parseAmount(receivedAmount);
    if (!amount) errs.receivedAmount = "مبلغ دریافتی خالی یا صفر است.";
    if (exchangeMode !== "same") {
      if (!parseAmount(rate)) errs.rate = exchangeMode === "afn" ? "نرخ در برابر افغانی خالی است." : "نرخ مستقیم خالی است.";
      if (exchangeMode === "direct" && !exchangeDirectCounter) errs.rate = "مبنای نرخ مستقیم معتبر نیست.";
    }
    if (amount && !parseAmount(paidAmount)) {
      errs.paidAmount = exchangeMode === "same" ? "مبلغ پرداختی محاسبه نشد." : "مبلغ پرداختی محاسبه نشد؛ لطفاً نرخ را بررسی کنید.";
    }
    if (exchangeCommission.trim().length === 0) errs.exchangeCommission = "فیلد کارمزد خالی است.";
    return errs;
  }

  function validateTransfer(): TransferFormErrors {
    const errs: TransferFormErrors = {};
    if (!sender) errs.sender = "فیلد فرستنده خالی است.";
    if (!receiver) errs.receiver = "فیلد گیرنده خالی است.";
    if (sender && receiver && sender === receiver) errs.receiver = "فرستنده و گیرنده نباید یکسان باشند.";
    const amount = parseAmount(senderAmount);
    if (!amount) errs.senderAmount = "مبلغ فرستنده خالی یا صفر است.";
    if (transferMode !== "same") {
      if (!parseAmount(transferRate)) errs.transferRate = transferMode === "afn" ? "نرخ در برابر افغانی خالی است." : "نرخ مستقیم خالی است.";
      if (transferMode === "direct" && !transferDirectCounter) errs.transferRate = "مبنای نرخ مستقیم معتبر نیست.";
    }
    if (amount && !parseAmount(receiverAmount)) {
      errs.receiverAmount = transferMode === "same" ? "مبلغ گیرنده محاسبه نشد." : "مبلغ گیرنده محاسبه نشد؛ لطفاً نرخ را بررسی کنید.";
    }
    if (commission.trim().length === 0) errs.commission = "فیلد کارمزد خالی است.";
    return errs;
  }

  function validateConvert(): ConvertFormErrors {
    const errs: ConvertFormErrors = {};
    if (!convertCustomer) errs.customer = "فیلد مشتری خالی است.";
    const amount = parseAmount(convertAmount);
    if (!amount) errs.amount = "مبلغ خالی یا صفر است.";
    if (convertMode !== "same") {
      if (!parseAmount(convertRate)) errs.rate = convertMode === "afn" ? "نرخ در برابر افغانی خالی است." : "نرخ مستقیم خالی است.";
      if (convertMode === "direct" && !convertDirectCounter) errs.rate = "مبنای نرخ مستقیم معتبر نیست.";
    }
    if (amount && !parseAmount(convertedAmount)) {
      errs.convertedAmount = convertMode === "same" ? "مبلغ تبدیل محاسبه نشد." : "مبلغ تبدیل محاسبه نشد؛ لطفاً نرخ را بررسی کنید.";
    }
    if (convertCommission.trim().length === 0) errs.commission = "فیلد کارمزد خالی است.";
    return errs;
  }

  const exchangeFromAmount = parseAmount(receivedAmount);
  const exchangeToAmount = parseAmount(paidAmount);
  const exchangeRateValue = parseAmount(rate);
  const exchangeCommissionValue = Math.max(0, parseAmount(exchangeCommission));
  const exchangeRateBase = exchangeMode === "direct" ? exchangeDirectBaseValue : undefined;

  function submitExchange() {
    const errs = validateExchange();
    setExchangeErrors(errs);
    if (Object.values(errs).some((x) => Boolean(x))) return;
    const fromAmount = exchangeFromAmount;
    const toAmount = exchangeToAmount;
    const txRate = exchangeMode === "same" ? 1 : exchangeRateValue;
    let rateLabel = "";
    if (exchangeMode === "same") rateLabel = "بدون تبدیل";
    if (exchangeMode === "afn" && exchangeForeign) rateLabel = afnRateLabel(exchangeForeign, txRate);
    if (exchangeMode === "direct" && exchangeDirectCounter) rateLabel = directRateLabel(exchangeDirectBaseValue, exchangeDirectCounter, txRate);
    const description = exchangeDescription.trim() || undefined;
    const calculatedProfit = exchangeCommissionValue;
    const calculatedProfitCurrency: Currency | undefined = exchangeCommissionCurrency;

    const tx: Transaction = {
      id: editingExchangeId || newId(),
      trackingCode: editingExchangeId ? (transactions.find(t => t.id === editingExchangeId)?.trackingCode || getNextSharedCode("FX")) : getNextSharedCode("FX"),
      type: "exchange", dealType: exchangeDealType as DealType,
      date: editingExchangeId ? (transactions.find(t => t.id === editingExchangeId)?.date || new Date().toISOString()) : new Date().toISOString(),
      customerId: customer, fromCurrency: receivedCurrency, fromAmount, toCurrency: paidCurrency, toAmount,
      rate: txRate, rateLabel, rateBase: exchangeRateBase, commission: exchangeCommissionValue,
      commissionCurrency: exchangeCommissionCurrency, commissionPayer: exchangeCommissionPayer,
      description, status: "active", profit: calculatedProfit, profitCurrency: calculatedProfitCurrency,
      customerPhone, customerTelegram,
    };
    setPreviewData(tx);
    setPreviewOpen(true);
  }

  const transferFromAmount = parseAmount(senderAmount);
  const transferToAmount = parseAmount(receiverAmount);
  const transferRateValue = parseAmount(transferRate);
  const commissionValue = Math.max(0, parseAmount(commission));
  const transferRateBase = transferMode === "direct" ? transferDirectBaseValue : undefined;

  function submitTransfer() {
    const errs = validateTransfer();
    setTransferErrors(errs);
    if (Object.values(errs).some((x) => Boolean(x))) return;
    const fromAmount = transferFromAmount;
    const toAmount = transferToAmount;
    const txRate = transferMode === "same" ? 1 : transferRateValue;
    let rateLabel = "";
    if (transferMode === "same") rateLabel = "بدون تبدیل";
    if (transferMode === "afn" && transferForeign) rateLabel = afnRateLabel(transferForeign, txRate);
    if (transferMode === "direct" && transferDirectCounter) rateLabel = directRateLabel(transferDirectBaseValue, transferDirectCounter, txRate);
    const description = transferDescription.trim() || undefined;
    const calculatedProfit = commissionValue;
    const calculatedProfitCurrency: Currency | undefined = transferCommissionCurrency;

    const tx: Transaction = {
      id: editingTransferId || newId(),
      trackingCode: editingTransferId ? (transactions.find(t => t.id === editingTransferId)?.trackingCode || getNextSharedCode("FX")) : getNextSharedCode("FX"),
      type: "transfer", date: editingTransferId ? (transactions.find(t => t.id === editingTransferId)?.date || new Date().toISOString()) : new Date().toISOString(),
      senderId: sender, receiverId: receiver, fromCurrency: senderCurrency, fromAmount, toCurrency: receiverCurrency, toAmount,
      rate: txRate, rateLabel, rateBase: transferRateBase, commission: commissionValue,
      commissionCurrency: transferCommissionCurrency, commissionPayer: transferCommissionPayer,
      description, status: "active", profit: calculatedProfit, profitCurrency: calculatedProfitCurrency,
    };
    setPreviewData(tx);
    setPreviewOpen(true);
  }

  const convertFromAmount = parseAmount(convertAmount);
  const convertToAmount = parseAmount(convertedAmount);
  const convertRateValue = parseAmount(convertRate);
  const convertCommissionValue = Math.max(0, parseAmount(convertCommission));
  const convertRateBase = convertMode === "direct" ? convertDirectBaseValue : undefined;

  function submitConvert() {
    const errs = validateConvert();
    setConvertErrors(errs);
    if (Object.values(errs).some((x) => Boolean(x))) return;
    const fromAmount = convertFromAmount;
    const toAmount = convertToAmount;
    const txRate = convertMode === "same" ? 1 : convertRateValue;
    let rateLabel = "";
    if (convertMode === "same") rateLabel = "بدون تبدیل";
    if (convertMode === "afn" && convertForeign) rateLabel = afnRateLabel(convertForeign, txRate);
    if (convertMode === "direct" && convertDirectCounter) rateLabel = directRateLabel(convertDirectBaseValue, convertDirectCounter, txRate);
    const description = convertDescription.trim() || undefined;
    const calculatedProfit = convertCommissionValue;
    const calculatedProfitCurrency: Currency | undefined = convertCommissionCurrency;

    const tx: Transaction = {
      id: editingConvertId || newId(),
      trackingCode: editingConvertId ? (transactions.find(t => t.id === editingConvertId)?.trackingCode || getNextSharedCode("FX")) : getNextSharedCode("FX"),
      type: "convert", date: editingConvertId ? (transactions.find(t => t.id === editingConvertId)?.date || new Date().toISOString()) : new Date().toISOString(),
      customerId: convertCustomer, fromCurrency: convertFromCurrency, fromAmount,
      toCurrency: convertToCurrency, toAmount, rate: txRate, rateLabel,
      rateBase: convertRateBase, commission: convertCommissionValue,
      commissionCurrency: convertCommissionCurrency, commissionPayer: "sender",
      description, status: "active", profit: calculatedProfit, profitCurrency: calculatedProfitCurrency,
    };
    setPreviewData(tx);
    setPreviewOpen(true);
  }

  function confirmRegister() {
    if (!previewData) return;
    const tx = { ...previewData, trackingCode: consumeSharedCode("FX") };
    
    if (editingExchangeId) {
      setTransactions((prev) => prev.map((t) => t.id === editingExchangeId ? { ...tx, id: editingExchangeId, trackingCode: t.trackingCode, date: t.date } : t));
    } else if (editingTransferId) {
      setTransactions((prev) => prev.map((t) => t.id === editingTransferId ? { ...tx, id: editingTransferId, trackingCode: t.trackingCode, date: t.date } : t));
    } else if (editingConvertId) {
      setTransactions((prev) => prev.map((t) => t.id === editingConvertId ? { ...tx, id: editingConvertId, trackingCode: t.trackingCode, date: t.date } : t));
    } else {
      setTransactions((x) => [tx, ...x]);
    }
    
    resetExchangeForm();
    resetTransferForm();
    resetConvertForm();
    setPreviewOpen(false);
    setPreviewData(null);
  }

  const customerName = (id?: string) => customers.find((c) => c.id === id)?.name || customers.find((c) => c.name === id)?.name || id || "-";

  function transactionCustomerLabel(tx: Transaction) {
    if (tx.type === "exchange") return customerName(tx.customerId);
    if (tx.type === "convert") return customerName(tx.customerId);
    return `${customerName(tx.senderId)} - ${customerName(tx.receiverId)}`;
  }

  function transactionTypeLabel(tx: Transaction) {
    if (tx.type === "exchange") return dealTypeLabel(tx.dealType);
    if (tx.type === "convert") return "تبدیل ارز";
    return "انتقال";
  }

  function transactionCommissionLabel(tx: Transaction) {
    if (tx.commission === undefined) return "-";
    return `${fmt(tx.commission)} ${tx.commissionCurrency ? labels[tx.commissionCurrency] : ""}`;
  }

  function transactionProfitLabel(tx: Transaction) {
    if (tx.profit === undefined) return "-";
    return `${fmt(tx.profit)} ${tx.profitCurrency ? labels[tx.profitCurrency] : ""}`;
  }

  function commissionPayerLabel(tx: Transaction) {
    if (!tx.commissionPayer) return "-";
    if (tx.type === "convert") return "خود مشتری";
    return tx.commissionPayer === "sender" ? "فرستنده" : "گیرنده";
  }

  const rawSearch = normalizeDigits(search.trim()).toLowerCase();
  const amountSearch = rawSearch.replace(/[,،]/g, "");
  const isSearching = amountSearch.trim().length > 0;
  const activeCount = transactions.filter((t) => t.status === "active").length;
  const voidedCount = transactions.length - activeCount;

  function transactionMatchesSearch(tx: Transaction) {
    if (!isSearching) return true;
    const names = [customerName(tx.customerId), customerName(tx.senderId), customerName(tx.receiverId), transactionCustomerLabel(tx), tx.trackingCode];
    if (names.some((n) => normalizeDigits(n).toLowerCase().includes(rawSearch))) return true;
    return [tx.fromAmount, tx.toAmount, tx.commission || 0].some((a) => {
      const plain = normalizeDigits(String(a));
      const formatted = normalizeDigits(fmt(a)).replace(/,/g, "");
      return plain.includes(amountSearch) || formatted.includes(amountSearch);
    });
  }

  const exchangeErrorList = Object.values(exchangeErrors).filter((msg): msg is string => Boolean(msg));
  const transferErrorList = Object.values(transferErrors).filter((msg): msg is string => Boolean(msg));
  const convertErrorList = Object.values(convertErrors).filter((msg): msg is string => Boolean(msg));
  const editingExchangeTransaction = transactions.find((t) => t.id === editingExchangeId);
  const editingTransferTransaction = transactions.find((t) => t.id === editingTransferId);
  const editingConvertTransaction = transactions.find((t) => t.id === editingConvertId);
  const exchangeDateDisplay = editingExchangeTransaction ? dateLabel(editingExchangeTransaction.date) : currentDateTime;
  const transferDateDisplay = editingTransferTransaction ? dateLabel(editingTransferTransaction.date) : currentDateTime;
  const convertDateDisplay = editingConvertTransaction ? dateLabel(editingConvertTransaction.date) : currentDateTime;
  const nextTrackingCode = getNextSharedCode("FX");

  function editTransaction(tx: Transaction) {
    if (tx.status === "voided") return;
    if (tx.type === "exchange") {
      setTab("exchange"); setEditingTransferId(null); setEditingConvertId(null); setEditingExchangeId(tx.id);
      setCustomer(tx.customerId || ""); setExchangeDealType(tx.dealType || "");
      setCustomerPhone(tx.customerPhone || ""); setCustomerTelegram(tx.customerTelegram || "");
      setReceivedCurrency(tx.fromCurrency); setPaidCurrency(tx.toCurrency);
      setReceivedAmount(String(tx.fromAmount));
      setExchangeCommission(tx.commission ? String(tx.commission) : "0");
      setExchangeCommissionPayer(tx.commissionPayer || "sender");
      setExchangeCommissionCurrency(tx.commissionCurrency || "AFN");
      setExchangeDescription(tx.description || ""); setRate(String(tx.rate));
      if (getRateMode(tx.fromCurrency, tx.toCurrency) === "direct") {
        setExchangeDirectBase(tx.rateBase || preferredDirectBase(tx.fromCurrency, tx.toCurrency));
      }
      setExchangeErrors({});
    }
    if (tx.type === "transfer") {
      setTab("transfer"); setEditingExchangeId(null); setEditingConvertId(null); setEditingTransferId(tx.id);
      setSender(tx.senderId || ""); setReceiver(tx.receiverId || "");
      setSenderCurrency(tx.fromCurrency); setReceiverCurrency(tx.toCurrency);
      setSenderAmount(String(tx.fromAmount));
      setCommission(tx.commission ? String(tx.commission) : "0");
      setTransferCommissionPayer(tx.commissionPayer || "sender");
      setTransferCommissionCurrency(tx.commissionCurrency || "AFN");
      setTransferDescription(tx.description || ""); setTransferRate(String(tx.rate));
      if (getRateMode(tx.fromCurrency, tx.toCurrency) === "direct") {
        setTransferDirectBase(tx.rateBase || preferredDirectBase(tx.fromCurrency, tx.toCurrency));
      }
      setTransferErrors({});
    }
    if (tx.type === "convert") {
      setTab("convert"); setEditingExchangeId(null); setEditingTransferId(null); setEditingConvertId(tx.id);
      setConvertCustomer(tx.customerId || "");
      setConvertFromCurrency(tx.fromCurrency); setConvertToCurrency(tx.toCurrency);
      setConvertAmount(String(tx.fromAmount));
      setConvertCommission(tx.commission ? String(tx.commission) : "0");
      setConvertCommissionCurrency(tx.commissionCurrency || "AFN");
      setConvertDescription(tx.description || ""); setConvertRate(String(tx.rate));
      if (getRateMode(tx.fromCurrency, tx.toCurrency) === "direct") {
        setConvertDirectBase(tx.rateBase || preferredDirectBase(tx.fromCurrency, tx.toCurrency));
      }
      setConvertErrors({});
    }
  }

  function viewTransaction(tx: Transaction) { setSelectedTransaction(tx); }

  function voidTransaction(tx: Transaction) {
    if (tx.status === "voided") return;
    if (!window.confirm("آیا مطمئن هستید که این معامله لغو شود؟")) return;
    setTransactions((prev) => prev.map((t) => (t.id === tx.id ? { ...t, status: "voided" } : t)));
    if (editingExchangeId === tx.id) setEditingExchangeId(null);
    if (editingTransferId === tx.id) setEditingTransferId(null);
    if (editingConvertId === tx.id) setEditingConvertId(null);
    setOpenMenuId(null);
  }

  function restoreTransaction(tx: Transaction) {
    if (tx.status !== "voided") return;
    if (!window.confirm(`آیا از برگرداندن معامله ${tx.trackingCode} مطمئن هستید؟`)) return;
    setTransactions((prev) => prev.map((t) => (t.id === tx.id ? { ...t, status: "active" } : t)));
    setOpenMenuId(null);
  }

  function deleteTransaction(tx: Transaction) {
    if (!window.confirm(`آیا از حذف کامل معامله ${tx.trackingCode} مطمئن هستید؟\n\nاین عملیات قابل بازگشت نیست.`)) return;
    setTransactions((prev) => prev.filter(t => t.id !== tx.id));
    setOpenMenuId(null);
  }

  function printReceipt(tx: Transaction) {
    const win = window.open("", "_blank", "width=650,height=800");
    if (!win) return;
    const html = `
      <html dir="rtl">
        <head><meta charset="utf-8" /><title>رسید معامله</title>
          <style>
            body { font-family: Tahoma, Arial, sans-serif; padding: 24px; direction: rtl; }
            h2 { margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; }
            td, th { border: 1px solid #ccc; padding: 8px; text-align: right; }
          </style>
        </head>
        <body>
          <h2>رسید معامله</h2>
          <table>
            <tr><th>کد پیگیری</th><td>${tx.trackingCode}</td></tr>
            <tr><th>تاریخ (هجری شمسی)</th><td>${dateLabel(tx.date)}</td></tr>
            <tr><th>نوع معامله</th><td>${transactionTypeLabel(tx)}</td></tr>
            <tr><th>مشتری</th><td>${transactionCustomerLabel(tx)}</td></tr>
            <tr><th>دریافت</th><td>${fmt(tx.fromAmount)} ${labels[tx.fromCurrency]}</td></tr>
            <tr><th>پرداخت</th><td>${fmt(tx.toAmount)} ${labels[tx.toCurrency]}</td></tr>
            <tr><th>نرخ ارز</th><td>${tx.rateLabel}</td></tr>
            <tr><th>کارمزد</th><td>${transactionCommissionLabel(tx)}</td></tr>
            <tr><th>پرداخت‌کننده کارمزد</th><td>${commissionPayerLabel(tx)}</td></tr>
            <tr><th>سود صرافی</th><td>${transactionProfitLabel(tx)}</td></tr>
            <tr><th>توضیحات</th><td>${tx.description || "-"}</td></tr>
            <tr><th>وضعیت</th><td>${tx.status === "voided" ? "لغو شده" : "فعال"}</td></tr>
          </table>
        </body>
      </html>
    `;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  const toggleMenu = (id: string) => {
    setOpenMenuId(openMenuId === id ? null : id);
  };

  const heading = dk ? "text-white" : "text-slate-900";
  const subText = dk ? "text-slate-500" : "text-slate-400";
  const iconMuted = dk ? "text-slate-500" : "text-slate-400";
  const glassChip = dk ? "border-slate-600/70 bg-slate-800/80" : "border-sky-100 bg-white/85";

  const uiCard = `rounded-2xl border backdrop-blur transition-colors duration-300 ${
    dk
      ? "border-slate-700 bg-slate-800/90 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.6)]"
      : "border-sky-100 bg-white/95 shadow-[0_16px_40px_-28px_rgba(2,132,199,0.35)]"
  }`;

  const inputShell = `rounded-xl border text-sm font-medium shadow-sm outline-none transition-all duration-200 focus:ring-4 ${
    dk
      ? "border-slate-600 bg-slate-900 text-slate-100 placeholder:text-slate-500 hover:border-slate-500 focus:border-cyan-400 focus:ring-cyan-400/10"
      : "border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 hover:border-sky-400 focus:border-sky-500 focus:ring-sky-500/10"
  }`;

  const uiInput = `h-12 w-full px-3.5 ${inputShell}`;

  const errInput = dk
    ? "border-rose-400/70 hover:border-rose-300 focus:border-rose-300 focus:ring-rose-400/10"
    : "border-rose-400 hover:border-rose-500 focus:border-rose-500 focus:ring-rose-500/10";

  const roInput = dk
    ? "cursor-default bg-slate-800/70 text-slate-400 hover:border-slate-600 focus:border-slate-600 focus:ring-0"
    : "cursor-default bg-slate-100 text-slate-500 hover:border-slate-200 focus:border-slate-200 focus:ring-0";

  const uiLabel = `mb-1.5 block text-[11px] font-black tracking-wide ${dk ? "text-slate-400" : "text-slate-500"}`;

  const rateChip = `flex h-12 items-center whitespace-nowrap rounded-xl border px-3.5 text-sm font-bold shadow-sm ${
    dk ? "border-slate-600 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-700"
  }`;

  const cSky = {
    wrap: dk ? "border-sky-400/25 bg-sky-400/[0.07]" : "border-sky-300 bg-sky-50",
    icon: dk ? "bg-sky-400/15 text-sky-300" : "bg-sky-100 text-sky-600",
    title: dk ? "text-sky-300" : "text-sky-700",
    badge: dk ? "bg-sky-400/15 text-sky-300" : "bg-sky-100 text-sky-700",
  };
  const cEmerald = {
    wrap: dk ? "border-emerald-400/25 bg-emerald-400/[0.07]" : "border-emerald-300 bg-emerald-50",
    icon: dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-600",
    title: dk ? "text-emerald-300" : "text-emerald-700",
    badge: dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-700",
  };
  const cOrange = {
    wrap: dk ? "border-orange-400/25 bg-orange-400/[0.07]" : "border-orange-300 bg-orange-50",
    icon: dk ? "bg-orange-400/15 text-orange-300" : "bg-orange-100 text-orange-600",
    title: dk ? "text-orange-300" : "text-orange-700",
    badge: dk ? "bg-orange-400/15 text-orange-300" : "bg-orange-100 text-orange-700",
  };
  const cAmber = {
    wrap: dk ? "border-amber-400/25 bg-amber-400/[0.07]" : "border-amber-300 bg-amber-50",
    icon: dk ? "bg-amber-400/15 text-amber-300" : "bg-amber-100 text-amber-600",
    title: dk ? "text-amber-300" : "text-amber-700",
    badge: dk ? "bg-amber-400/15 text-amber-300" : "bg-amber-100 text-amber-700",
  };
  const cTeal = {
    wrap: dk ? "border-teal-400/25 bg-teal-400/[0.07]" : "border-teal-300 bg-teal-50",
    icon: dk ? "bg-teal-400/15 text-teal-300" : "bg-teal-100 text-teal-600",
    title: dk ? "text-teal-300" : "text-teal-700",
    badge: dk ? "bg-teal-400/15 text-teal-300" : "bg-teal-100 text-teal-700",
  };
  const cViolet = {
    wrap: dk ? "border-violet-400/25 bg-violet-400/[0.07]" : "border-violet-300 bg-violet-50",
    icon: dk ? "bg-violet-400/15 text-violet-300" : "bg-violet-100 text-violet-600",
    title: dk ? "text-violet-300" : "text-violet-700",
    badge: dk ? "bg-violet-400/15 text-violet-300" : "bg-violet-100 text-violet-700",
  };

  const identExIcon = dk
    ? "from-cyan-400/20 to-cyan-400/5 text-cyan-300 ring-cyan-400/25"
    : "from-sky-400/20 to-cyan-400/10 text-sky-600 ring-sky-400/30";
  const identExChip = dk ? "bg-cyan-400/10 text-cyan-300 ring-cyan-400/25" : "bg-sky-100 text-sky-700 ring-sky-300/60";
  const identTrIcon = dk
    ? "from-orange-400/20 to-orange-400/5 text-orange-300 ring-orange-400/25"
    : "from-orange-400/20 to-amber-400/10 text-orange-600 ring-orange-400/30";
  const identTrChip = dk ? "bg-orange-400/10 text-orange-300 ring-orange-400/25" : "bg-orange-100 text-orange-700 ring-orange-300/60";
  const identCvIcon = dk
    ? "from-violet-400/20 to-violet-400/5 text-violet-300 ring-violet-400/25"
    : "from-violet-400/20 to-purple-400/10 text-violet-600 ring-violet-400/30";
  const identCvChip = dk ? "bg-violet-400/10 text-violet-300 ring-violet-400/25" : "bg-violet-100 text-violet-700 ring-violet-300/60";

  function typeChipClass(tx: Transaction) {
    if (tx.type === "transfer")
      return dk ? "bg-orange-400/15 text-orange-300 ring-1 ring-orange-400/25" : "bg-orange-100 text-orange-700 ring-1 ring-orange-300/60";
    if (tx.type === "convert")
      return dk ? "bg-violet-400/15 text-violet-300 ring-1 ring-violet-400/25" : "bg-violet-100 text-violet-700 ring-1 ring-violet-300/60";
    if (tx.dealType === "buy")
      return dk ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/25" : "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300/60";
    if (tx.dealType === "sell")
      return dk ? "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/25" : "bg-amber-100 text-amber-700 ring-1 ring-amber-300/60";
    return dk ? "bg-slate-400/10 text-slate-300 ring-1 ring-slate-400/20" : "bg-slate-100 text-slate-600 ring-1 ring-slate-300/60";
  }

  const chevPos = `pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${iconMuted}`;

  const fld = (label: string, node: ReactNode) => (
    <div>
      <label className={uiLabel}>{label}</label>
      {node}
    </div>
  );

  const sel = (value: string, onCh: (v: string) => void, opts: string[][], cls = "") => (
    <div className="relative">
      <select value={value} onChange={(e) => onCh(e.target.value)} className={`${uiInput} cursor-pointer appearance-none pl-9 ${cls}`}>
        {opts.map((o) => (
          <option key={o[0]} value={o[0]}>{o[1]}</option>
        ))}
      </select>
      <span className={chevPos}><Ic n="chevron" className="h-4 w-4" /></span>
    </div>
  );

  const dateField = (v: string) => (
    <div className="relative">
      <input readOnly dir="ltr" value={v} className={`${uiInput} ${roInput} pl-10 text-left tabular-nums`} />
      <span className={chevPos}><Ic n="clock" className="h-4 w-4" /></span>
    </div>
  );

  const searchField = (
    <div className="relative">
      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="نام مشتری یا مبلغ…" className={`${uiInput} pr-10`} />
      <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${iconMuted}`}>
        <Ic n="search" className="h-4 w-4" />
      </span>
    </div>
  );

  const rateInput = (val: string, onCh: (s: string) => void, err: boolean, w: string) => (
    <input type="text" inputMode="decimal" dir="ltr" value={val} onChange={(e) => onCh(toNumericText(e.target.value))} placeholder="0"
      className={`h-12 ${w} px-3 text-left text-sm font-bold tabular-nums ${inputShell} ${err ? errInput : ""}`} />
  );

  const moneyField = (val: string, onCh: (s: string) => void, err: boolean, suffix: string, suffixCls: string) => (
    <div className="relative">
      <input type="text" inputMode="decimal" dir="ltr" value={val} onChange={(e) => onCh(toNumericText(e.target.value))} placeholder="0"
        className={`${uiInput} pl-24 text-left tabular-nums ${err ? errInput : ""}`} />
      <span className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[10px] font-black ${suffixCls}`}>
        {suffix}
      </span>
    </div>
  );

  const panel = (c: { wrap: string; icon: string; title: string }, icon: IconName, title: string, children: ReactNode) => (
    <div className={`space-y-4 rounded-2xl border p-4 transition-colors ${c.wrap}`}>
      <div className="flex items-center gap-2.5">
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${c.icon}`}><Ic n={icon} className="h-4 w-4" /></span>
        <b className={`text-sm font-black ${c.title}`}>{title}</b>
      </div>
      {children}
    </div>
  );

  const rateBox = (c: { wrap: string; icon: string; title: string }, title: string, form: ReactNode, badges: ReactNode) => (
    <div className={`space-y-4 rounded-2xl border p-4 transition-colors md:p-5 ${c.wrap}`}>
      <div className="flex items-center gap-2.5">
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${c.icon}`}><Ic n="rate" className="h-4 w-4" /></span>
        <b className={`text-sm font-black ${c.title}`}>{title}</b>
      </div>
      {form}
      <div className="flex flex-wrap items-center gap-2.5">{badges}</div>
    </div>
  );

  const pill = (cls: string, txt: string, check = false) =>
    !txt ? null : (
      <span className={`fx-pop inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${cls}`}>
        {check && <Ic n="check" className="h-3.5 w-3.5" />}
        {txt}
      </span>
    );

  const midBadge = (icon: IconName, cls: string) => (
    <div className="hidden flex-col items-center justify-center lg:flex">
      <span className={`grid h-12 w-12 place-items-center rounded-full border shadow-md ${cls}`}>
        <Ic n={icon} className="h-5 w-5" />
      </span>
    </div>
  );

  const midBadgeMobile = (icon: IconName, cls: string) => (
    <div className="flex items-center justify-center lg:hidden py-1">
      <span className={`grid h-10 w-10 place-items-center rounded-full border shadow-md ${cls}`}>
        <Ic n={icon} className="h-4 w-4" />
      </span>
    </div>
  );

  const secHead = (iconCls: string, icon: IconName, title: string, sub: string, chipCls: string, chipTxt: string) => (
    <div className="flex flex-wrap items-center gap-3">
      <span className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${iconCls}`}>
        <Ic n={icon} className="h-5 w-5" />
      </span>
      <div className="flex-1 min-w-0">
        <h2 className={`fx-display text-xl leading-tight md:text-2xl ${heading}`}>{title}</h2>
        <p className={`mt-1 text-[11px] font-bold ${subText}`}>{sub}</p>
      </div>
      <span className={`rounded-full px-3 py-1.5 text-[10px] font-black ring-1 ${chipCls}`}>{chipTxt}</span>
    </div>
  );

  const editBanner = (txt: ReactNode, cancel: () => void) => (
    <div className={`fx-pop flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-bold ${
      dk ? "border-amber-400/30 bg-amber-400/10 text-amber-300" : "border-amber-300 bg-amber-100/70 text-amber-800"
    }`}>
      <span className="flex items-center gap-2">
        <Ic n="pencil" className="h-4 w-4 shrink-0" />
        {txt}
      </span>
      <button onClick={cancel} className="cursor-pointer rounded-lg bg-amber-400/30 px-3.5 py-1.5 text-xs font-black transition-all hover:bg-amber-400/40 active:scale-95">
        انصراف
      </button>
    </div>
  );

  const sameBox = (txt: string) => (
    <div className={`flex items-start gap-3 rounded-2xl border p-4 text-sm font-bold ${
      dk ? "border-slate-600 bg-slate-700/40 text-slate-300" : "border-slate-200 bg-slate-100 text-slate-600"
    }`}>
      <Ic n="info" className="h-5 w-5 shrink-0 opacity-70 mt-0.5" />
      <span className="leading-6">{txt}</span>
    </div>
  );

  const errBox = (list: string[]) =>
    list.length === 0 ? null : (
      <div className={`fx-pop space-y-2 rounded-xl border p-4 ${dk ? "border-rose-400/30 bg-rose-400/10 text-rose-300" : "border-rose-300 bg-rose-50 text-rose-600"}`}>
        <b className="flex items-center gap-2 text-sm">
          <Ic n="alert" className="h-5 w-5 shrink-0" />
          لطفاً این فیلدها را تکمیل کنید:
        </b>
        <ul className="list-disc pr-5 text-sm marker:text-rose-400 space-y-1">
          {list.map((msg, i) => (<li key={i}>{msg}</li>))}
        </ul>
      </div>
    );

  const commissionFields = (
    payerValue: CommissionPayer,
    onPayerChange: (v: CommissionPayer) => void,
    currencyValue: Currency,
    onCurrencyChange: (v: Currency) => void,
    showPayer: boolean = true
  ) => (
    <div className="grid gap-3 md:gap-4 sm:grid-cols-2">
      {showPayer && fld("کارمزد از حساب", (
        <div className={`flex rounded-xl border p-1 ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-slate-50"}`}>
          <button type="button" onClick={() => onPayerChange("sender")}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-black transition-all ${
              payerValue === "sender" ? dk ? "bg-cyan-400 text-slate-950 shadow" : "bg-sky-500 text-white shadow" : dk ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-700"
            }`}>فرستنده</button>
          <button type="button" onClick={() => onPayerChange("receiver")}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-black transition-all ${
              payerValue === "receiver" ? dk ? "bg-cyan-400 text-slate-950 shadow" : "bg-sky-500 text-white shadow" : dk ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-700"
            }`}>گیرنده</button>
        </div>
      ))}
      {fld("ارز کارمزد", (
        <div className="relative">
          <select value={currencyValue} onChange={(e) => onCurrencyChange(e.target.value as Currency)} className={`${uiInput} cursor-pointer appearance-none pl-9`}>
            {currencies.map((c) => (<option key={c} value={c}>{labels[c]}</option>))}
          </select>
          <span className={chevPos}><Ic n="chevron" className="h-4 w-4" /></span>
        </div>
      ))}
    </div>
  );

  function currencySelect(value: Currency, change: (v: Currency) => void) {
    return (
      <div className="relative">
        <select value={value} onChange={(e) => change(e.target.value as Currency)} className={`${uiInput} cursor-pointer appearance-none pl-9`}>
          {currencies.map((c) => (<option key={c} value={c}>{labels[c]}</option>))}
        </select>
        <span className={chevPos}><Ic n="chevron" className="h-4 w-4" /></span>
      </div>
    );
  }

  /* ✅ CustomerBalanceCard با نمایش طلب/قرض از صرافی */
  const CustomerBalanceCard = ({ customer, color }: { customer: Customer | null; color: "cyan" | "orange" | "violet" }) => {
    if (!customer) return null;
    const colors = {
      cyan: { border: dk ? "border-cyan-400/30 bg-cyan-400/10" : "border-cyan-200 bg-cyan-50", text: dk ? "text-cyan-300" : "text-cyan-700", icon: dk ? "text-cyan-300" : "text-cyan-600" },
      orange: { border: dk ? "border-orange-400/30 bg-orange-400/10" : "border-orange-200 bg-orange-50", text: dk ? "text-orange-300" : "text-orange-700", icon: dk ? "text-orange-300" : "text-orange-600" },
      violet: { border: dk ? "border-violet-400/30 bg-violet-400/10" : "border-violet-200 bg-violet-50", text: dk ? "text-violet-300" : "text-violet-700", icon: dk ? "text-violet-300" : "text-violet-600" },
    };
    const c = colors[color];
    return (
      <div className={`rounded-xl border p-3 ${c.border}`}>
        <div className="flex items-center gap-2 mb-2">
          <Ic n="wallet" className={`h-4 w-4 ${c.icon}`} />
          <b className={`text-xs font-black ${c.text}`}>موجودی حساب {customer.name}</b>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2 text-[10px] font-bold">
          {currencies.map(cur => {
            const bal = customer.balances[cur] || 0;
            const isDebt = bal < 0;
            const isCredit = bal > 0;
            const isZero = bal === 0;
            return (
              <div key={cur} className={`rounded-lg px-2 py-1.5 ${dk ? "bg-slate-900/50" : "bg-white"}`}>
                <div className={subText}>{labels[cur]}</div>
                <div className={`font-black tabular-nums ${
                  isDebt ? "text-rose-500" : 
                  isCredit ? (dk ? "text-emerald-300" : "text-emerald-600") : 
                  dk ? "text-slate-400" : "text-slate-500"
                }`}>
                  {fmt(bal)}
                </div>
                <div className="min-h-[12px] mt-0.5">
                  {isDebt && (
                    <div className="text-[8px] font-black text-rose-500">
                      قرض از صرافی
                    </div>
                  )}
                  {isCredit && (
                    <div className={`text-[8px] font-black ${dk ? "text-emerald-300" : "text-emerald-600"}`}>
                      طلب از صرافی
                    </div>
                  )}
                  {isZero && (
                    <div className={`text-[8px] font-bold ${subText}`}>
                      بدون بدهی
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ✅ CustomerDropdown اصلاح‌شده - بدون preventDefault اضافی */
  const CustomerDropdown = ({
    value, onInputChange, showList, onToggleList, filter, onFilterChange, listRef, filteredList, err
  }: {
    value: string;
    onInputChange: (name: string) => void;
    showList: boolean;
    onToggleList: () => void;
    filter: string;
    onFilterChange: (v: string) => void;
    listRef: React.RefObject<HTMLDivElement>;
    filteredList: Customer[];
    err?: boolean;
  }) => (
    <div className="relative" ref={listRef}>
      <input
        value={value}
        onChange={e => {
          onInputChange(e.target.value);
          onFilterChange(e.target.value);
          if (!showList) onToggleList();
        }}
        onFocus={() => { if (!showList) onToggleList(); }}
        placeholder="انتخاب از لیست یا نوشتن نام جدید…"
        className={`${uiInput} pl-12 ${err ? errInput : ""}`}
        autoComplete="off"
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleList();
        }}
        className={`absolute left-2 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-lg transition ${dk ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}
      >
        <Ic n="chevron" className={`h-4 w-4 transition-transform ${showList ? "rotate-180" : ""}`} />
      </button>
      {showList && (
        <div className={`fx-pop absolute left-0 top-full z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border shadow-xl ${dk ? "border-slate-600 bg-slate-800" : "border-slate-200 bg-white"}`}>
          {filteredList.length === 0 ? (
            <div className={`px-4 py-3 text-xs text-center ${subText}`}>مشتری‌ای یافت نشد</div>
          ) : (
            filteredList.map((c, idx) => (
              <button
                key={c.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onInputChange(c.name);
                  onFilterChange("");
                  onToggleList();
                }}
                className={`flex w-full items-center gap-2 px-3 py-2.5 text-right text-xs font-bold transition ${dk ? "text-slate-200 hover:bg-cyan-400/15 hover:text-cyan-300" : "text-slate-700 hover:bg-cyan-50 hover:text-cyan-600"}`}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-black text-white bg-gradient-to-br from-cyan-500 to-sky-500">{idx + 1}</span>
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
  );

  /* ✅ ActionMenu اصلاح‌شده - بدون preventDefault اضافی */
  const ActionMenu = ({ tx }: { tx: Transaction }) => {
    const isOpen = openMenuId === tx.id;
    const isVoided = tx.status === "voided";

    return (
      <div className="relative" ref={isOpen ? menuRef : null}>
        <button 
          onClick={(e) => { 
            e.stopPropagation();
            toggleMenu(tx.id); 
          }}
          className={`inline-flex cursor-pointer select-none items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-black shadow-sm transition-all ${
            isOpen
              ? dk ? "border-blue-400/50 bg-blue-400/20 text-blue-300" : "border-blue-400 bg-blue-50 text-blue-600"
              : dk ? "border-slate-600 bg-slate-900 text-cyan-300 hover:border-cyan-400/50 hover:bg-cyan-400/10" : "border-slate-200 bg-white text-sky-600 hover:border-sky-400 hover:bg-sky-50"
          }`}>
          عملیات
          <Ic n="chevron" className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen && (
          <ul className={`fx-pop absolute left-0 top-full z-20 mt-1.5 w-44 space-y-1 rounded-xl border p-1.5 shadow-xl ${dk ? "border-slate-600 bg-slate-900 shadow-black/40" : "border-slate-200 bg-white shadow-slate-900/10"}`}>
            {!isVoided && (
              <>
                <li>
                  <button onClick={() => { setOpenMenuId(null); editTransaction(tx); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-xs font-bold transition ${dk ? "text-slate-300 hover:bg-cyan-400/10 hover:text-cyan-300" : "text-slate-600 hover:bg-sky-50 hover:text-sky-700"}`}>
                    <Ic n="pencil" className="h-3.5 w-3.5" /> ویرایش
                  </button>
                </li>
                <li>
                  <button onClick={() => { setOpenMenuId(null); printReceipt(tx); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-xs font-bold transition ${dk ? "text-slate-300 hover:bg-cyan-400/10 hover:text-cyan-300" : "text-slate-600 hover:bg-sky-50 hover:text-sky-700"}`}>
                    <Ic n="printer" className="h-3.5 w-3.5" /> چاپ رسید
                  </button>
                </li>
                <li>
                  <button onClick={() => { setOpenMenuId(null); viewTransaction(tx); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-xs font-bold transition ${dk ? "text-slate-300 hover:bg-cyan-400/10 hover:text-cyan-300" : "text-slate-600 hover:bg-sky-50 hover:text-sky-700"}`}>
                    <Ic n="eye" className="h-3.5 w-3.5" /> مشاهده
                  </button>
                </li>
                <li>
                  <button onClick={() => { setOpenMenuId(null); voidTransaction(tx); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-xs font-bold transition ${dk ? "text-rose-300 hover:bg-rose-400/10" : "text-rose-500 hover:bg-rose-50"}`}>
                    <Ic n="xCircle" className="h-3.5 w-3.5" /> لغو معامله
                  </button>
                </li>
                <li className={`h-px ${dk ? "bg-slate-700" : "bg-slate-100"}`} />
                <li>
                  <button onClick={() => { setOpenMenuId(null); deleteTransaction(tx); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-xs font-bold transition ${dk ? "text-rose-300 hover:bg-rose-400/10" : "text-rose-500 hover:bg-rose-50"}`}>
                    <Ic n="trash" className="h-3.5 w-3.5" /> حذف
                  </button>
                </li>
              </>
            )}
            {isVoided && (
              <>
                <li>
                  <button onClick={() => { setOpenMenuId(null); viewTransaction(tx); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-xs font-bold transition ${dk ? "text-slate-300 hover:bg-cyan-400/10 hover:text-cyan-300" : "text-slate-600 hover:bg-sky-50 hover:text-sky-700"}`}>
                    <Ic n="eye" className="h-3.5 w-3.5" /> مشاهده
                  </button>
                </li>
                <li>
                  <button onClick={() => { setOpenMenuId(null); printReceipt(tx); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-xs font-bold transition ${dk ? "text-slate-300 hover:bg-cyan-400/10 hover:text-cyan-300" : "text-slate-600 hover:bg-sky-50 hover:text-sky-700"}`}>
                    <Ic n="printer" className="h-3.5 w-3.5" /> چاپ رسید
                  </button>
                </li>
                <li className={`h-px ${dk ? "bg-slate-700" : "bg-slate-100"}`} />
                <li>
                  <button onClick={() => { setOpenMenuId(null); restoreTransaction(tx); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-xs font-bold transition ${dk ? "text-emerald-300 hover:bg-emerald-400/10" : "text-emerald-600 hover:bg-emerald-50"}`}>
                    <Ic n="undo" className="h-3.5 w-3.5" /> برگرداندن
                  </button>
                </li>
                <li>
                  <button onClick={() => { setOpenMenuId(null); deleteTransaction(tx); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-xs font-bold transition ${dk ? "text-rose-300 hover:bg-rose-400/10" : "text-rose-500 hover:bg-rose-50"}`}>
                    <Ic n="trash" className="h-3.5 w-3.5" /> حذف
                  </button>
                </li>
              </>
            )}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div dir="rtl" className={dk ? "dark" : ""}>
      <style>{`
        @import url("https://fonts.googleapis.com/css2?family=Lalezar&family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap");
        .fx-font { font-family: "Vazirmatn", "Segoe UI", Tahoma, sans-serif; }
        .fx-display { font-family: "Lalezar", "Vazirmatn", Tahoma, sans-serif; letter-spacing: 0.01em; }
        .dark { color-scheme: dark; }
        .fx-grid {
          background-image: radial-gradient(circle at 1px 1px, rgba(2,132,199,0.10) 1px, transparent 0);
          background-size: 24px 24px;
          -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(0,0,0,0.25) 60%, transparent);
          mask-image: linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(0,0,0,0.25) 60%, transparent);
        }
        .dark .fx-grid {
          background-image: radial-gradient(circle at 1px 1px, rgba(148,163,184,0.08) 1px, transparent 0);
        }
        @keyframes fxUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fxPop { from { opacity: 0; transform: scale(0.96) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .fx-up { animation: fxUp 0.5s cubic-bezier(0.22, 0.8, 0.35, 1) both; }
        .fx-pop { animation: fxPop 0.28s cubic-bezier(0.22, 0.8, 0.35, 1) both; }
        details > summary { list-style: none; }
        details > summary::-webkit-details-marker { display: none; }
        .fx-scroll::-webkit-scrollbar { height: 0; width: 0; }
        .fx-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        ::selection { background: rgba(14,165,233,0.25); }
      `}</style>

      <div className={`fx-font relative min-h-screen overflow-x-hidden antialiased transition-colors duration-500 ${dk ? "bg-[#0f172a] text-slate-100" : "bg-[#eef6fa] text-slate-800"}`}>
        <div className={`fixed inset-x-0 top-0 z-30 h-1 bg-gradient-to-l ${dk ? "from-cyan-400 via-sky-400 to-emerald-400" : "from-sky-500 via-cyan-400 to-emerald-400"}`} />

        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
          <div className="fx-grid absolute inset-0" />
          <div className={`absolute -top-36 right-[-12rem] h-[30rem] w-[30rem] rounded-full blur-[110px] ${dk ? "bg-cyan-500/10" : "bg-sky-400/20"}`} />
          <div className={`absolute left-[-12rem] top-1/4 h-[26rem] w-[26rem] rounded-full blur-[110px] ${dk ? "bg-emerald-500/10" : "bg-emerald-300/20"}`} />
          <div className={`absolute bottom-[-10rem] right-1/3 h-[24rem] w-[24rem] rounded-full blur-[100px] ${dk ? "bg-violet-500/10" : "bg-violet-300/20"}`} />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-7xl space-y-4 md:space-y-6 px-3 pb-16 pt-5 md:px-8 md:pt-9">
          <header className="fx-up flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0">
              <div className="relative grid h-11 w-11 md:h-14 md:w-14 shrink-0 place-items-center rounded-xl md:rounded-2xl bg-gradient-to-br from-sky-500 via-cyan-500 to-emerald-400 text-white shadow-lg shadow-sky-500/30 ring-1 ring-white/30">
                <Ic n="swap" className="h-5 w-5 md:h-6 md:w-6" />
                <span className={`absolute -bottom-1 -left-1 md:-bottom-1.5 md:-left-1.5 grid h-4 min-w-4 md:h-5 md:min-w-5 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-400 px-1 text-[7px] md:text-[8px] font-black text-white ring-2 ${dk ? "ring-[#0f172a]" : "ring-[#eef6fa]"}`}>AFN</span>
              </div>
              <div className="min-w-0">
                <h1 className={`fx-display text-2xl md:text-4xl leading-none ${heading}`}>معاملات ارزی</h1>
                <p className={`mt-1 text-[10px] md:text-xs font-bold ${subText}`}>سامانهٔ تبادل و حوالهٔ صرافی</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 md:gap-2.5">
              <div className={`hidden sm:flex items-center gap-2 rounded-xl border px-3 py-2 shadow-sm backdrop-blur ${glassChip}`}>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                <span dir="ltr" className={`text-xs font-bold tabular-nums ${dk ? "text-slate-100" : "text-slate-700"}`}>{currentDateTime || "--:--:--"}</span>
                {now && (
                  <>
                    <span className={`h-4 w-px ${dk ? "bg-slate-600" : "bg-slate-200"}`} />
                    <span className={`whitespace-nowrap text-[10px] font-black ${dk ? "text-cyan-300" : "text-sky-600"}`}>{shamsiMonthLabel(now)}</span>
                  </>
                )}
              </div>
              <button onClick={() => setTheme(dk ? "light" : "dark")} title={dk ? "پوستهٔ روشن" : "پوستهٔ تیره"}
                className={`group grid h-10 w-10 md:h-11 md:w-11 cursor-pointer place-items-center rounded-lg md:rounded-xl border shadow-sm backdrop-blur transition-all duration-300 active:scale-90 ${
                  dk ? "border-slate-600 bg-slate-800/85 text-amber-300 hover:border-amber-300" : "border-slate-200 bg-white/85 text-slate-600 hover:border-sky-400"
                }`}>
                {dk ? <Ic n="sun" className="h-4 w-4 transition-transform duration-500 group-hover:rotate-45" /> : <Ic n="moon" className="h-4 w-4 transition-transform duration-500 group-hover:-rotate-12" />}
              </button>
            </div>
          </header>

          <div className="fx-up space-y-2" style={{ animationDelay: "70ms" }}>
            <div className="fx-scroll flex gap-2 overflow-x-auto -mx-3 px-3 pb-1 md:mx-0 md:px-0 md:pb-0">
              {currencies.map((c) => (
                <span key={c} className={`flex shrink-0 cursor-default items-center gap-1.5 rounded-full border py-1 pl-3 pr-1.5 md:py-1.5 md:pl-3.5 text-xs font-bold shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${glassChip} ${dk ? "text-slate-300 hover:border-cyan-400/50" : "text-slate-600 hover:border-sky-400/60"}`}>
                  <span className={`grid h-5 w-5 md:h-6 md:w-6 place-items-center rounded-full bg-gradient-to-br text-[7px] md:text-[8px] font-black text-white ${currencyBadge[c]}`}>{c}</span>
                  {labels[c]}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-black">
              <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 shadow-sm backdrop-blur ${glassChip} ${dk ? "text-slate-300" : "text-slate-600"}`}>
                کل <b className={`tabular-nums ${dk ? "text-cyan-300" : "text-sky-600"}`}>{transactions.length}</b>
              </span>
              <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ring-1 ${dk ? "bg-emerald-400/15 text-emerald-300 ring-emerald-400/25" : "bg-emerald-400/15 text-emerald-700 ring-emerald-400/40"}`}>
                فعال <b className="tabular-nums">{activeCount}</b>
              </span>
              <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ring-1 ${dk ? "bg-rose-400/15 text-rose-300 ring-rose-400/25" : "bg-rose-400/15 text-rose-600 ring-rose-400/40"}`}>
                لغو <b className="tabular-nums">{voidedCount}</b>
              </span>
            </div>
          </div>

          <div className={`fx-up flex gap-1.5 md:gap-2 rounded-xl md:rounded-2xl border p-1.5 md:p-2 shadow-sm backdrop-blur ${glassChip}`} style={{ animationDelay: "140ms" }}>
            <button onClick={() => setTab("exchange")} className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 md:gap-2 rounded-lg md:rounded-xl px-3 md:px-5 py-2.5 md:py-3 text-xs md:text-sm font-black transition-all duration-300 active:scale-[0.97] ${
              tab === "exchange" ? `bg-gradient-to-l shadow-lg ${dk ? "from-cyan-400 to-emerald-400 text-slate-950" : "from-sky-500 via-cyan-500 to-emerald-400 text-white"}` : dk ? "text-slate-400 hover:bg-slate-700/60" : "text-slate-500 hover:bg-sky-50"
            }`}>
              <Ic n="swap" className="h-4 w-4" /><span>تبادل ارز</span>
            </button>
            <button onClick={() => setTab("transfer")} className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 md:gap-2 rounded-lg md:rounded-xl px-3 md:px-5 py-2.5 md:py-3 text-xs md:text-sm font-black transition-all duration-300 active:scale-[0.97] ${
              tab === "transfer" ? `bg-gradient-to-l shadow-lg ${dk ? "from-orange-400 to-amber-300 text-slate-950" : "from-orange-500 via-orange-400 to-amber-400 text-white"}` : dk ? "text-slate-400 hover:bg-slate-700/60" : "text-slate-500 hover:bg-sky-50"
            }`}>
              <Ic n="users" className="h-4 w-4" /><span>بین مشتریان</span>
            </button>
            <button onClick={() => setTab("convert")} className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 md:gap-2 rounded-lg md:rounded-xl px-3 md:px-5 py-2.5 md:py-3 text-xs md:text-sm font-black transition-all duration-300 active:scale-[0.97] ${
              tab === "convert" ? `bg-gradient-to-l shadow-lg ${dk ? "from-violet-400 to-purple-400 text-slate-950" : "from-violet-500 via-purple-500 to-fuchsia-400 text-white"}` : dk ? "text-slate-400 hover:bg-slate-700/60" : "text-slate-500 hover:bg-violet-50"
            }`}>
              <Ic n="user" className="h-4 w-4" /><span>تبدیل ارز مشتری</span>
            </button>
          </div>

          {tab === "exchange" && (
            <section className={`fx-up space-y-4 md:space-y-5 p-4 md:p-7 ${uiCard}`}>
              {secHead(identExIcon, "swap", "تبادل ارز صرافی با مشتری", "دریافت یک ارز از مشتری و پرداخت ارز دیگر", identExChip, editingExchangeId ? `ویرایش ${shortId(editingExchangeId)}` : "معاملهٔ جدید")}
              {editingExchangeId && editBanner(<>در حال ویرایش معامله {shortId(editingExchangeId)}. تاریخ اصلی حفظ می‌شود.</>, resetExchangeForm)}

              <CustomerBalanceCard customer={selectedCustomer} color="cyan" />

              <div className="grid gap-3 md:gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {fld(`تاریخ و ساعت (شمسی) ${editingExchangeId ? "(اصل)" : "(خودکار)"}`, dateField(exchangeDateDisplay))}
                {fld("نوع معامله", sel(exchangeDealType, (v) => { setExchangeDealType(v as DealType | ""); setExchangeErrors((p) => ({ ...p, dealType: undefined })); }, [["", "انتخاب نوع معامله"], ["buy", "خرید"], ["sell", "فروش"]], exchangeErrors.dealType ? errInput : ""))}
                {fld("کد پیگیری", (
                  <div className="relative">
                    <input readOnly dir="ltr" value={editingExchangeId ? (editingExchangeTransaction?.trackingCode || "-") : nextTrackingCode} className={`${uiInput} ${roInput} pl-14 text-left tabular-nums font-black text-[15px]`} />
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 rounded-lg bg-gradient-to-r from-cyan-500 to-sky-500 px-2 py-1 text-[9px] font-black text-white">FX</span>
                  </div>
                ))}
                {fld("مشتری", (
                  <CustomerDropdown
                    value={customer}
                    onInputChange={(name) => {
                      setCustomer(name);
                      const c = customers.find(x => x.name === name);
                      if (c) {
                        setCustomerPhone(c.phone || "");
                        setCustomerTelegram(c.telegram || "");
                      } else {
                        setCustomerPhone("");
                        setCustomerTelegram("");
                      }
                      setExchangeErrors((p) => ({ ...p, customer: undefined }));
                    }}
                    showList={showCustomerList}
                    onToggleList={() => setShowCustomerList(!showCustomerList)}
                    filter={customerFilter}
                    onFilterChange={setCustomerFilter}
                    listRef={customerListRef}
                    filteredList={filteredCustomerList}
                    err={!!exchangeErrors.customer}
                  />
                ))}
              </div>

              <div className="grid gap-3 md:gap-4 lg:grid-cols-[1fr_auto_1fr]">
                {panel(cEmerald, "down", "دریافت از مشتری", (
                  <>
                    {fld("ارز دریافتی", currencySelect(receivedCurrency, (v) => { setReceivedCurrency(v); setExchangeErrors((p) => ({ ...p, rate: undefined, paidAmount: undefined })); }))}
                    {fld("مبلغ دریافتی", (
                      <input type="text" inputMode="decimal" dir="ltr" value={receivedAmount}
                        onChange={(e) => { setReceivedAmount(toNumericText(e.target.value)); setExchangeErrors((p) => ({ ...p, receivedAmount: undefined, paidAmount: undefined })); }}
                        placeholder="0.00" className={`${uiInput} text-left tabular-nums ${exchangeErrors.receivedAmount ? errInput : ""}`} />
                    ))}
                  </>
                ))}
                {midBadgeMobile("down", dk ? "border-slate-600 bg-slate-900 text-emerald-300" : "border-slate-200 bg-white text-emerald-600")}
                {midBadge("swap", dk ? "border-slate-600 bg-slate-900 text-cyan-300" : "border-slate-200 bg-white text-sky-600")}
                {panel(cSky, "up", "پرداخت به مشتری", (
                  <>
                    {fld("ارز پرداختی", currencySelect(paidCurrency, (v) => { setPaidCurrency(v); setExchangeErrors((p) => ({ ...p, rate: undefined, paidAmount: undefined })); }))}
                    {fld("مبلغ پرداختی", (<input readOnly dir="ltr" value={paidAmount} className={`${uiInput} ${roInput} text-left tabular-nums ${exchangeErrors.paidAmount ? errInput : ""}`} />))}
                  </>
                ))}
              </div>

              {exchangeMode === "same" && sameBox("ارز دریافت و پرداخت یکسان است؛ مبلغ پرداختی برابر مبلغ دریافتی خواهد بود.")}
              {exchangeMode === "afn" && exchangeForeign && rateBox(cSky, "نرخ دستی در برابر افغانی", (
                <div>
                  <label className={uiLabel}>نرخ</label>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className={rateChip}>{fmt(rateUnits[exchangeForeign])} {labels[exchangeForeign]} =</span>
                    {rateInput(rate, (s) => { setRate(s); setExchangeErrors((p) => ({ ...p, rate: undefined, paidAmount: undefined })); }, !!exchangeErrors.rate, "w-32 md:w-44")}
                    <span className={rateChip}>{labels.AFN}</span>
                  </div>
                </div>
              ), (<>
                {pill(cSky.badge, exchangeRateValue > 0 ? `نرخ ثبت‌شده: ${afnRateLabel(exchangeForeign, exchangeRateValue)}` : "", true)}
                {pill(cEmerald.badge, paidAmount ? `نتیجه: ${paidAmount} ${labels[paidCurrency]}` : "")}
              </>))}
              {exchangeMode === "direct" && rateBox(cAmber, "نرخ مستقیم جفت‌ارز", (
                <div className="grid items-end gap-3 md:gap-4 md:grid-cols-2">
                  {fld("مبنای نرخ", sel(exchangeDirectBaseValue, (v) => { setExchangeDirectBase(v as Currency); setExchangeErrors((p) => ({ ...p, rate: undefined, paidAmount: undefined })); }, [[receivedCurrency, labels[receivedCurrency]], [paidCurrency, labels[paidCurrency]]]))}
                  <div>
                    <label className={uiLabel}>نرخ مستقیم</label>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={rateChip}>{fmt(rateUnits[exchangeDirectBaseValue])} {labels[exchangeDirectBaseValue]} =</span>
                      {rateInput(rate, (s) => { setRate(s); setExchangeErrors((p) => ({ ...p, rate: undefined, paidAmount: undefined })); }, !!exchangeErrors.rate, "w-28 md:w-40")}
                      <span className={rateChip}>{exchangeDirectCounter ? labels[exchangeDirectCounter] : ""}</span>
                    </div>
                  </div>
                </div>
              ), (<>
                {pill(cAmber.badge, exchangeRateValue > 0 && exchangeDirectCounter ? `نرخ ثبت‌شده: ${directRateLabel(exchangeDirectBaseValue, exchangeDirectCounter, exchangeRateValue)}` : "", true)}
                {pill(cEmerald.badge, paidAmount ? `نتیجه: ${paidAmount} ${labels[paidCurrency]}` : "")}
              </>))}

              <div className="grid gap-3 md:gap-4 md:grid-cols-2">
                {fld("کارمزد", moneyField(exchangeCommission, (s) => { setExchangeCommission(s); setExchangeErrors((p) => ({ ...p, exchangeCommission: undefined })); }, !!exchangeErrors.exchangeCommission, labels[exchangeCommissionCurrency], dk ? "bg-cyan-400/15 text-cyan-300" : "bg-sky-100 text-sky-700"))}
                {fld("توضیحات", (<input type="text" value={exchangeDescription} onChange={(e) => setExchangeDescription(e.target.value)} placeholder="توضیحات اختیاری…" className={uiInput} />))}
              </div>

              {commissionFields(exchangeCommissionPayer, setExchangeCommissionPayer, exchangeCommissionCurrency, setExchangeCommissionCurrency, true)}

              {errBox(exchangeErrorList)}

              <button onClick={submitExchange} className={`group flex h-[50px] md:h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-l text-base font-black shadow-lg transition-all duration-300 hover:shadow-xl hover:brightness-110 active:scale-[0.985] ${dk ? "from-cyan-400 to-emerald-400 text-slate-950" : "from-sky-500 via-cyan-500 to-emerald-400 text-white"}`}>
                {editingExchangeId ? "به‌روزرسانی معامله" : "ثبت معامله"}
                <Ic n="arrowLeft" className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
              </button>
            </section>
          )}

          {tab === "transfer" && (
            <section className={`fx-up space-y-4 md:space-y-5 p-4 md:p-7 ${uiCard}`}>
              {secHead(identTrIcon, "users", "تبادل بین حساب مشتریان", "انتقال موجودی از حساب مشتری به مشتری دیگر", identTrChip, editingTransferId ? `ویرایش ${shortId(editingTransferId)}` : "انتقال جدید")}
              {editingTransferId && editBanner(<>در حال ویرایش انتقال {shortId(editingTransferId)}. تاریخ اصلی حفظ می‌شود.</>, resetTransferForm)}

              <div className="grid gap-3 md:grid-cols-2">
                <CustomerBalanceCard customer={selectedSender} color="orange" />
                <CustomerBalanceCard customer={selectedReceiver} color="cyan" />
              </div>

              <div className="grid gap-3 md:gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {fld(`تاریخ و ساعت (شمسی) ${editingTransferId ? "(اصل)" : "(خودکار)"}`, dateField(transferDateDisplay))}
                {fld("کد پیگیری", (
                  <div className="relative">
                    <input readOnly dir="ltr" value={editingTransferId ? (editingTransferTransaction?.trackingCode || "-") : nextTrackingCode} className={`${uiInput} ${roInput} pl-14 text-left tabular-nums font-black text-[15px]`} />
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-2 py-1 text-[9px] font-black text-white">FX</span>
                  </div>
                ))}
                {fld("جستجو", searchField)}
                <div></div>
              </div>

              <div className="grid gap-3 md:gap-4 lg:grid-cols-[1fr_auto_1fr]">
                {panel(cOrange, "up", "فرستنده", (
                  <>
                    {fld("مشتری فرستنده", (
                      <CustomerDropdown
                        value={sender}
                        onInputChange={(name) => { setSender(name); setTransferErrors((p) => ({ ...p, sender: undefined })); }}
                        showList={showSenderList}
                        onToggleList={() => setShowSenderList(!showSenderList)}
                        filter={senderFilter}
                        onFilterChange={setSenderFilter}
                        listRef={senderListRef}
                        filteredList={filteredSenderList}
                        err={!!transferErrors.sender}
                      />
                    ))}
                    {fld("ارز فرستنده", currencySelect(senderCurrency, (v) => { setSenderCurrency(v); setTransferErrors((p) => ({ ...p, transferRate: undefined, receiverAmount: undefined })); }))}
                    {fld("مبلغ فرستنده", (
                      <input type="text" inputMode="decimal" dir="ltr" value={senderAmount}
                        onChange={(e) => { setSenderAmount(toNumericText(e.target.value)); setTransferErrors((p) => ({ ...p, senderAmount: undefined, receiverAmount: undefined })); }}
                        placeholder="0.00" className={`${uiInput} text-left tabular-nums ${transferErrors.senderAmount ? errInput : ""}`} />
                    ))}
                  </>
                ))}
                {midBadgeMobile("arrowLeft", dk ? "border-slate-600 bg-slate-900 text-orange-300" : "border-slate-200 bg-white text-orange-500")}
                {midBadge("arrowLeft", dk ? "border-slate-600 bg-slate-900 text-orange-300" : "border-slate-200 bg-white text-orange-500")}
                {panel(cEmerald, "down", "گیرنده", (
                  <>
                    {fld("مشتری گیرنده", (
                      <CustomerDropdown
                        value={receiver}
                        onInputChange={(name) => { setReceiver(name); setTransferErrors((p) => ({ ...p, receiver: undefined })); }}
                        showList={showReceiverList}
                        onToggleList={() => setShowReceiverList(!showReceiverList)}
                        filter={receiverFilter}
                        onFilterChange={setReceiverFilter}
                        listRef={receiverListRef}
                        filteredList={filteredReceiverList}
                        err={!!transferErrors.receiver}
                      />
                    ))}
                    {fld("ارز گیرنده", currencySelect(receiverCurrency, (v) => { setReceiverCurrency(v); setTransferErrors((p) => ({ ...p, transferRate: undefined, receiverAmount: undefined })); }))}
                    {fld("مبلغ گیرنده", (<input readOnly dir="ltr" value={receiverAmount} className={`${uiInput} ${roInput} text-left tabular-nums ${transferErrors.receiverAmount ? errInput : ""}`} />))}
                  </>
                ))}
              </div>

              {transferMode === "same" && sameBox("ارز فرستنده و گیرنده یکسان است؛ مبلغ گیرنده برابر مبلغ فرستنده خواهد بود.")}
              {transferMode === "afn" && transferForeign && rateBox(cTeal, "نرخ دستی در برابر افغانی", (
                <div>
                  <label className={uiLabel}>نرخ</label>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className={rateChip}>{fmt(rateUnits[transferForeign])} {labels[transferForeign]} =</span>
                    {rateInput(transferRate, (s) => { setTransferRate(s); setTransferErrors((p) => ({ ...p, transferRate: undefined, receiverAmount: undefined })); }, !!transferErrors.transferRate, "w-32 md:w-44")}
                    <span className={rateChip}>{labels.AFN}</span>
                  </div>
                </div>
              ), (<>
                {pill(cTeal.badge, transferRateValue > 0 ? `نرخ ثبت‌شده: ${afnRateLabel(transferForeign, transferRateValue)}` : "", true)}
                {pill(cEmerald.badge, receiverAmount ? `نتیجه: ${receiverAmount} ${labels[receiverCurrency]}` : "")}
              </>))}
              {transferMode === "direct" && rateBox(cOrange, "نرخ مستقیم جفت‌ارز", (
                <div className="grid items-end gap-3 md:gap-4 md:grid-cols-2">
                  {fld("مبنای نرخ", sel(transferDirectBaseValue, (v) => { setTransferDirectBase(v as Currency); setTransferErrors((p) => ({ ...p, transferRate: undefined, receiverAmount: undefined })); }, [[senderCurrency, labels[senderCurrency]], [receiverCurrency, labels[receiverCurrency]]]))}
                  <div>
                    <label className={uiLabel}>نرخ مستقیم</label>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={rateChip}>{fmt(rateUnits[transferDirectBaseValue])} {labels[transferDirectBaseValue]} =</span>
                      {rateInput(transferRate, (s) => { setTransferRate(s); setTransferErrors((p) => ({ ...p, transferRate: undefined, receiverAmount: undefined })); }, !!transferErrors.transferRate, "w-28 md:w-40")}
                      <span className={rateChip}>{transferDirectCounter ? labels[transferDirectCounter] : ""}</span>
                    </div>
                  </div>
                </div>
              ), (<>
                {pill(cOrange.badge, transferRateValue > 0 && transferDirectCounter ? `نرخ ثبت‌شده: ${directRateLabel(transferDirectBaseValue, transferDirectCounter, transferRateValue)}` : "", true)}
                {pill(cEmerald.badge, receiverAmount ? `نتیجه: ${receiverAmount} ${labels[receiverCurrency]}` : "")}
              </>))}

              <div className="grid gap-3 md:gap-4 md:grid-cols-2">
                {fld("کارمزد", moneyField(commission, (s) => { setCommission(s); setTransferErrors((p) => ({ ...p, commission: undefined })); }, !!transferErrors.commission, labels[transferCommissionCurrency], dk ? "bg-orange-400/15 text-orange-300" : "bg-orange-100 text-orange-700"))}
                {fld("توضیحات", (<input type="text" value={transferDescription} onChange={(e) => setTransferDescription(e.target.value)} placeholder="توضیحات اختیاری…" className={uiInput} />))}
              </div>

              {commissionFields(transferCommissionPayer, setTransferCommissionPayer, transferCommissionCurrency, setTransferCommissionCurrency, true)}

              {errBox(transferErrorList)}

              <button onClick={submitTransfer} className={`group flex h-[50px] md:h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-l text-base font-black shadow-lg transition-all duration-300 hover:shadow-xl hover:brightness-110 active:scale-[0.985] ${dk ? "from-orange-400 to-amber-300 text-slate-950" : "from-orange-500 via-orange-400 to-amber-400 text-white"}`}>
                {editingTransferId ? "به‌روزرسانی انتقال" : "ثبت انتقال"}
                <Ic n="arrowLeft" className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
              </button>
            </section>
          )}

          {tab === "convert" && (
            <section className={`fx-up space-y-4 md:space-y-5 p-4 md:p-7 ${uiCard}`}>
              {secHead(identCvIcon, "user", "تبدیل ارز مشتری", "تبدیل یک ارز به ارز دیگر در حساب خود مشتری", identCvChip, editingConvertId ? `ویرایش ${shortId(editingConvertId)}` : "تبدیل جدید")}
              {editingConvertId && editBanner(<>در حال ویرایش تبدیل {shortId(editingConvertId)}. تاریخ اصلی حفظ می‌شود.</>, resetConvertForm)}

              <CustomerBalanceCard customer={selectedConvertCustomer} color="violet" />

              <div className="grid gap-3 md:gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {fld(`تاریخ و ساعت (شمسی) ${editingConvertId ? "(اصل)" : "(خودکار)"}`, dateField(convertDateDisplay))}
                {fld("کد پیگیری", (
                  <div className="relative">
                    <input readOnly dir="ltr" value={editingConvertId ? (editingConvertTransaction?.trackingCode || "-") : nextTrackingCode} className={`${uiInput} ${roInput} pl-14 text-left tabular-nums font-black text-[15px]`} />
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 px-2 py-1 text-[9px] font-black text-white">FX</span>
                  </div>
                ))}
                {fld("مشتری", (
                  <CustomerDropdown
                    value={convertCustomer}
                    onInputChange={(name) => { setConvertCustomer(name); setConvertErrors((p) => ({ ...p, customer: undefined })); }}
                    showList={showConvertList}
                    onToggleList={() => setShowConvertList(!showConvertList)}
                    filter={convertFilter}
                    onFilterChange={setConvertFilter}
                    listRef={convertListRef}
                    filteredList={filteredConvertList}
                    err={!!convertErrors.customer}
                  />
                ))}
                <div></div>
              </div>

              <div className="grid gap-3 md:gap-4 lg:grid-cols-[1fr_auto_1fr]">
                {panel(cViolet, "down", "از حساب مشتری", (
                  <>
                    {fld("ارز مبدا", currencySelect(convertFromCurrency, (v) => { setConvertFromCurrency(v); setConvertErrors((p) => ({ ...p, rate: undefined, convertedAmount: undefined })); }))}
                    {fld("مبلغ مبدا", (
                      <input type="text" inputMode="decimal" dir="ltr" value={convertAmount}
                        onChange={(e) => { setConvertAmount(toNumericText(e.target.value)); setConvertErrors((p) => ({ ...p, amount: undefined, convertedAmount: undefined })); }}
                        placeholder="0.00" className={`${uiInput} text-left tabular-nums ${convertErrors.amount ? errInput : ""}`} />
                    ))}
                  </>
                ))}
                {midBadgeMobile("swap", dk ? "border-slate-600 bg-slate-900 text-violet-300" : "border-slate-200 bg-white text-violet-600")}
                {midBadge("swap", dk ? "border-slate-600 bg-slate-900 text-violet-300" : "border-slate-200 bg-white text-violet-600")}
                {panel(cEmerald, "up", "به حساب مشتری", (
                  <>
                    {fld("ارز مقصد", currencySelect(convertToCurrency, (v) => { setConvertToCurrency(v); setConvertErrors((p) => ({ ...p, rate: undefined, convertedAmount: undefined })); }))}
                    {fld("مبلغ مقصد", (<input readOnly dir="ltr" value={convertedAmount} className={`${uiInput} ${roInput} text-left tabular-nums ${convertErrors.convertedAmount ? errInput : ""}`} />))}
                  </>
                ))}
              </div>

              {convertMode === "same" && sameBox("ارز مبدا و مقصد یکسان است؛ مبلغ تبدیل برابر مبلغ مبدا خواهد بود.")}
              {convertMode === "afn" && convertForeign && rateBox(cSky, "نرخ دستی در برابر افغانی", (
                <div>
                  <label className={uiLabel}>نرخ</label>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className={rateChip}>{fmt(rateUnits[convertForeign])} {labels[convertForeign]} =</span>
                    {rateInput(convertRate, (s) => { setConvertRate(s); setConvertErrors((p) => ({ ...p, rate: undefined, convertedAmount: undefined })); }, !!convertErrors.rate, "w-32 md:w-44")}
                    <span className={rateChip}>{labels.AFN}</span>
                  </div>
                </div>
              ), (<>
                {pill(cSky.badge, convertRateValue > 0 ? `نرخ ثبت‌شده: ${afnRateLabel(convertForeign, convertRateValue)}` : "", true)}
                {pill(cEmerald.badge, convertedAmount ? `نتیجه: ${convertedAmount} ${labels[convertToCurrency]}` : "")}
              </>))}
              {convertMode === "direct" && rateBox(cAmber, "نرخ مستقیم جفت‌ارز", (
                <div className="grid items-end gap-3 md:gap-4 md:grid-cols-2">
                  {fld("مبنای نرخ", sel(convertDirectBaseValue, (v) => { setConvertDirectBase(v as Currency); setConvertErrors((p) => ({ ...p, rate: undefined, convertedAmount: undefined })); }, [[convertFromCurrency, labels[convertFromCurrency]], [convertToCurrency, labels[convertToCurrency]]]))}
                  <div>
                    <label className={uiLabel}>نرخ مستقیم</label>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={rateChip}>{fmt(rateUnits[convertDirectBaseValue])} {labels[convertDirectBaseValue]} =</span>
                      {rateInput(convertRate, (s) => { setConvertRate(s); setConvertErrors((p) => ({ ...p, rate: undefined, convertedAmount: undefined })); }, !!convertErrors.rate, "w-28 md:w-40")}
                      <span className={rateChip}>{convertDirectCounter ? labels[convertDirectCounter] : ""}</span>
                    </div>
                  </div>
                </div>
              ), (<>
                {pill(cAmber.badge, convertRateValue > 0 && convertDirectCounter ? `نرخ ثبت‌شده: ${directRateLabel(convertDirectBaseValue, convertDirectCounter, convertRateValue)}` : "", true)}
                {pill(cEmerald.badge, convertedAmount ? `نتیجه: ${convertedAmount} ${labels[convertToCurrency]}` : "")}
              </>))}

              <div className="grid gap-3 md:gap-4 md:grid-cols-2">
                {fld("کارمزد", moneyField(convertCommission, (s) => { setConvertCommission(s); setConvertErrors((p) => ({ ...p, commission: undefined })); }, !!convertErrors.commission, labels[convertCommissionCurrency], dk ? "bg-violet-400/15 text-violet-300" : "bg-violet-100 text-violet-700"))}
                {fld("توضیحات", (<input type="text" value={convertDescription} onChange={(e) => setConvertDescription(e.target.value)} placeholder="توضیحات اختیاری…" className={uiInput} />))}
              </div>

              {commissionFields("sender", () => {}, convertCommissionCurrency, setConvertCommissionCurrency, false)}

              {errBox(convertErrorList)}

              <button onClick={submitConvert} className={`group flex h-[50px] md:h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-l text-base font-black shadow-lg transition-all duration-300 hover:shadow-xl hover:brightness-110 active:scale-[0.985] ${dk ? "from-violet-400 to-purple-400 text-slate-950" : "from-violet-500 via-purple-500 to-fuchsia-400 text-white"}`}>
                {editingConvertId ? "به‌روزرسانی تبدیل" : "ثبت تبدیل"}
                <Ic n="arrowLeft" className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
              </button>
            </section>
          )}

          <section className={`fx-up overflow-hidden ${uiCard}`} style={{ animationDelay: "160ms" }}>
            <div className="flex flex-wrap items-center gap-3 p-4 md:p-5 pb-3 md:pb-4 md:px-7 md:pt-6">
              <span className={`grid h-10 w-10 md:h-11 md:w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${identExIcon}`}><Ic n="doc" className="h-5 w-5" /></span>
              <div className="flex-1 min-w-0">
                <h2 className={`fx-display text-xl md:text-2xl leading-none ${heading}`}>آخرین معاملات</h2>
                <p className={`mt-1 text-[11px] font-bold ${subText}`}>ثبت، ویرایش، چاپ رسید و لغو معاملات</p>
              </div>
              {isSearching && (
                <button onClick={() => setSearch("")} className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black ring-1 transition ${dk ? "bg-amber-400/10 text-amber-300 ring-amber-400/25" : "bg-amber-100 text-amber-700 ring-amber-300/60"}`}>
                  نتایج جستجو<Ic n="x" className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className={`border-y ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
                    {["کد پیگیری", "نام مشتری", "تاریخ (شمسی)", "نوع معامله", "دریافت", "پرداخت", "نرخ ارز", "کارمزد", "پرداخت‌کننده", "عملیات"].map((h, i) => (
                      <th key={h} className={`px-4 py-3 text-right text-[11px] font-black text-slate-400 ${i === 0 ? "md:px-7" : ""} ${i === 9 ? "md:px-7" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className={`divide-y ${dk ? "divide-slate-700/60" : "divide-slate-100"}`}>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={10}>
                        <div className={`flex flex-col items-center gap-3 px-6 py-14 ${dk ? "text-slate-500" : "text-slate-400"}`}>
                          <span className={`grid h-16 w-16 place-items-center rounded-2xl border border-dashed ${dk ? "border-slate-600 bg-slate-800/40" : "border-slate-300 bg-slate-50"}`}>
                            <Ic n="inbox" className="h-7 w-7 opacity-70" />
                          </span>
                          <p className="text-sm font-black">هنوز معامله‌ای ثبت نشده است</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => {
                      const matchesSearch = transactionMatchesSearch(tx);
                      let rowClass = dk ? "transition-colors hover:bg-slate-700/30" : "transition-colors hover:bg-sky-50/70";
                      if (isSearching) {
                        rowClass += matchesSearch ? dk ? " bg-amber-400/10" : " bg-amber-100" : " opacity-30";
                      }
                      if (tx.status === "voided") rowClass += dk ? " bg-rose-400/[0.05] text-slate-500" : " bg-rose-50 text-slate-400";

                      return (
                        <tr key={tx.id} className={rowClass}>
                          <td className="px-4 py-3.5 md:px-7">
                            <span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-black tabular-nums ${dk ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300" : "border-cyan-300 bg-cyan-50 text-cyan-700"}`} dir="ltr">
                              <Ic n="tag" className="h-3 w-3" />{tx.trackingCode}
                            </span>
                          </td>
                          <td className={`px-4 py-3.5 text-[13px] font-bold ${dk ? "text-slate-200" : "text-slate-700"}`}>{transactionCustomerLabel(tx)}</td>
                          <td className={`whitespace-nowrap px-4 py-3.5 text-xs tabular-nums ${dk ? "text-slate-400" : "text-slate-500"}`}><span dir="ltr">{dateLabel(tx.date)}</span></td>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${typeChipClass(tx)}`}>{transactionTypeLabel(tx)}</span>
                              {tx.status === "voided" && <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ${dk ? "bg-rose-400/10 text-rose-300 ring-rose-400/20" : "bg-rose-100 text-rose-600 ring-rose-300/60"}`}>لغو</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="text-[13px] font-black tabular-nums">{fmt(tx.fromAmount)}</div>
                            <div className={`text-[10px] font-bold ${subText}`}>{labels[tx.fromCurrency]}</div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="text-[13px] font-black tabular-nums">{fmt(tx.toAmount)}</div>
                            <div className={`text-[10px] font-bold ${subText}`}>{labels[tx.toCurrency]}</div>
                          </td>
                          <td className={`px-4 py-3.5 text-[11px] font-medium ${dk ? "text-slate-400" : "text-slate-500"}`}>{tx.rateLabel}</td>
                          <td className="px-4 py-3.5 text-xs font-bold tabular-nums">{transactionCommissionLabel(tx)}</td>
                          <td className={`px-4 py-3.5 text-xs font-bold ${dk ? "text-slate-300" : "text-slate-600"}`}>{commissionPayerLabel(tx)}</td>
                          <td className="px-4 py-3.5 md:px-7">
                            <ActionMenu tx={tx} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      {selectedTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 md:p-4 backdrop-blur-sm" onClick={() => setSelectedTransaction(null)}>
          <div className={`fx-pop w-full max-w-lg overflow-hidden rounded-xl md:rounded-2xl border shadow-2xl ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-white"}`} onClick={(e) => e.stopPropagation()}>
            <div className={`flex items-center justify-between border-b px-4 md:px-5 py-3 md:py-4 ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
              <b className={`flex items-center gap-2 text-sm ${dk ? "text-slate-100" : "text-slate-800"}`}>
                <span className={`grid h-8 w-8 place-items-center rounded-lg ${dk ? "bg-cyan-400/10 text-cyan-300" : "bg-sky-100 text-sky-600"}`}><Ic n="doc" className="h-4 w-4" /></span>
                جزئیات معامله
              </b>
              <button onClick={() => setSelectedTransaction(null)} className={`grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-slate-400 transition-all duration-300 hover:rotate-90 ${dk ? "hover:bg-slate-700 hover:text-white" : "hover:bg-slate-100 hover:text-slate-700"}`}>
                <Ic n="x" className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-4 md:px-5 py-2">
              <DetailRow dark={dk} label="کد پیگیری" value={selectedTransaction.trackingCode} />
              <DetailRow dark={dk} label="تاریخ (هجری شمسی)" value={dateLabel(selectedTransaction.date)} />
              <DetailRow dark={dk} label="نوع معامله" value={transactionTypeLabel(selectedTransaction)} />
              <DetailRow dark={dk} label="نام مشتری" value={transactionCustomerLabel(selectedTransaction)} />
              <DetailRow dark={dk} label="دریافت" value={`${fmt(selectedTransaction.fromAmount)} ${labels[selectedTransaction.fromCurrency]}`} />
              <DetailRow dark={dk} label="پرداخت" value={`${fmt(selectedTransaction.toAmount)} ${labels[selectedTransaction.toCurrency]}`} />
              <DetailRow dark={dk} label="نرخ ارز" value={selectedTransaction.rateLabel} />
              <DetailRow dark={dk} label="کارمزد" value={transactionCommissionLabel(selectedTransaction)} />
              <DetailRow dark={dk} label="پرداخت‌کننده کارمزد" value={commissionPayerLabel(selectedTransaction)} />
              <DetailRow dark={dk} label="سود صرافی" value={transactionProfitLabel(selectedTransaction)} valueClass={dk ? "text-emerald-300" : "text-emerald-700"} />
              <DetailRow dark={dk} label="توضیحات" value={selectedTransaction.description || "-"} />
              <DetailRow dark={dk} label="وضعیت" value={selectedTransaction.status === "voided" ? "لغو شده" : "فعال"} valueClass={selectedTransaction.status === "voided" ? dk ? "text-rose-300" : "text-rose-500" : dk ? "text-emerald-300" : "text-emerald-600"} />
            </div>
          </div>
        </div>
      )}

      {previewOpen && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 md:p-4 backdrop-blur-sm" onClick={() => { setPreviewOpen(false); setPreviewData(null); }}>
          <div className={`fx-pop w-full max-w-2xl overflow-hidden rounded-xl md:rounded-2xl border shadow-2xl ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-white"}`} onClick={(e) => e.stopPropagation()}>
            <div className={`flex items-center justify-between border-b px-4 md:px-5 py-3 md:py-4 ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
              <b className={`flex items-center gap-2 text-sm ${dk ? "text-slate-100" : "text-slate-800"}`}>
                <span className={`grid h-8 w-8 place-items-center rounded-lg ${dk ? "bg-cyan-400/10 text-cyan-300" : "bg-cyan-100 text-cyan-600"}`}><Ic n="doc" className="h-4 w-4" /></span>
                جزئیات معامله قبل از ثبت
              </b>
              <button onClick={() => { setPreviewOpen(false); setPreviewData(null); }} className={`grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-slate-400 transition-all duration-300 hover:rotate-90 ${dk ? "hover:bg-slate-700 hover:text-white" : "hover:bg-slate-100 hover:text-slate-700"}`}>
                <Ic n="x" className="h-4 w-4" />
              </button>
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
                  <div><span className={subText}>تاریخ: </span><b>{dateLabel(previewData.date)}</b></div>
                  <div><span className={subText}>نوع: </span><b>{transactionTypeLabel(previewData)}</b></div>
                  <div><span className={subText}>مشتری: </span><b>{transactionCustomerLabel(previewData)}</b></div>
                  <div><span className={subText}>مبلغ مبدا: </span><b>{fmt(previewData.fromAmount)} {labels[previewData.fromCurrency]}</b></div>
                  <div><span className={subText}>مبلغ مقصد: </span><b>{fmt(previewData.toAmount)} {labels[previewData.toCurrency]}</b></div>
                  <div><span className={subText}>نرخ: </span><b>{previewData.rateLabel}</b></div>
                  <div><span className={subText}>کارمزد: </span><b>{transactionCommissionLabel(previewData)}</b></div>
                  <div><span className={subText}>سود صرافی: </span><b className={dk ? "text-emerald-300" : "text-emerald-700"}>{transactionProfitLabel(previewData)}</b></div>
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
    </div>
  );
}
