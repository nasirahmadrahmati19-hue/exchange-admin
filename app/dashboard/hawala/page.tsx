"use client";
import { useEffect, useMemo, useState, useRef, type ReactNode, type ChangeEvent } from "react";

type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";
type RateMode = "same" | "afn" | "direct";
type HawalaStatus = "pending" | "sent" | "paid" | "cancelled";
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

interface Hawala {
  id: string; number: string; date: string; time: string; type: string;
  destinationCountry: string; province: string; district: string; destinationText: string;
  currencyFrom: Currency; currencyTo: Currency; amountFrom: number;
  rate: number; rateLabel: string; rateBase?: Currency;
  fee: number; feeCurrency: Currency; feePayer: CommissionPayer;
  finalAmount: number; balance: string; note: string;
  profit: number; profitCurrency: Currency;
  senderName: string; senderPhone: string; senderTelegram: string;
  receiverName: string; receiverTazkira: string; receiverPhone: string; receiverAddress: string;
  status: HawalaStatus; paidAt?: string; paidBy?: string; paidAmount?: number; cancelReason?: string;
}

interface FormState {
  type: string; currencyFrom: Currency; currencyTo: Currency;
  senderName: string; senderPhone: string; senderTelegram: string;
  amountFrom: string; rate: string; fee: string; feeCurrency: Currency; feePayer: CommissionPayer;
  balance: string; province: string; district: string;
  receiverName: string; receiverTazkira: string; receiverPhone: string; receiverAddress: string; note: string;
}

interface LastNames { senderName: string; receiverName: string; }
type FormErrors = Partial<Record<keyof FormState, string>>;

const provinces = ["هرات","ارزگان","بادغیس","بدخشان","بامیان","بغلان","بلخ","پکتیا","پکتیکا","پنجشیر","پروان","تخار","جوزجان","خوست","دایکندی","زابل","سرپل","سمنگان","فاریاب","فراه","غزنی","غور","کابل","کندهار","کاپیسا","قندوز","کنر","لغمان","لوگر","میدان وردک","ننگرهار","نیمروز","نورستان","هلمند"] as const;
const heratDistricts = ["گلران","مرکز هرات","ادرسکن","چشت شریف","فارسی","غوریان","گذره","انجیل","کرخ","کوهسان","کشک","کشک کهنه","اوبه","پشتون زرغون","شیندند","زنده جان"] as const;
const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const labels: Record<Currency, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };
const rateUnits: Record<Currency, number> = { AFN: 1, USD: 1, EUR: 1, IRR: 1000, PKR: 1000 };
const CUSTOMERS_KEY = "fx-customers";
const HAWALAS_KEY = "hawalas";
const TRANSACTIONS_KEY = "fx-transactions";
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

const emptyForm: FormState = {
  type: "", currencyFrom: "AFN", currencyTo: "USD", senderName: "", senderPhone: "", senderTelegram: "",
  amountFrom: "", rate: "", fee: "", feeCurrency: "AFN", feePayer: "sender", balance: "",
  province: "هرات", district: "گلران", receiverName: "", receiverTazkira: "", receiverPhone: "", receiverAddress: "", note: ""
};

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

const loadTransactions = (): any[] => {
  if (typeof window === "undefined") return [];
  try { const parsed = safeGetItem(TRANSACTIONS_KEY); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
};

const loadHawalas = (): Hawala[] => {
  if (typeof window === "undefined") return [];
  try {
    const parsed = safeGetItem(HAWALAS_KEY);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((h: any) => h?.id && h?.number).map((h: any): Hawala => ({
      id: h.id, number: h.number, date: h.date || new Date().toISOString(), time: h.time || "",
      type: h.type === "receive" ? "receive" : "send",
      destinationCountry: h.destinationCountry || "افغانستان", province: h.province || "",
      district: h.district || "", destinationText: h.destinationText || "",
      currencyFrom: isCurrency(h.currencyFrom) ? h.currencyFrom : "AFN",
      currencyTo: isCurrency(h.currencyTo) ? h.currencyTo : "AFN",
      amountFrom: Number(h.amountFrom || 0) || 0, rate: Number(h.rate || 0) || 0,
      rateLabel: h.rateLabel || "", rateBase: h.rateBase,
      fee: Number(h.fee || 0) || 0,
      feeCurrency: isCurrency(h.feeCurrency) ? h.feeCurrency : "AFN",
      feePayer: h.feePayer === "receiver" ? "receiver" : "sender",
      finalAmount: Number(h.finalAmount || 0) || 0, balance: h.balance || "", note: h.note || "",
      profit: Number(h.profit || 0) || 0,
      profitCurrency: isCurrency(h.profitCurrency) ? h.profitCurrency : "AFN",
      senderName: h.senderName || "", senderPhone: h.senderPhone || "", senderTelegram: h.senderTelegram || "",
      receiverName: h.receiverName || "", receiverTazkira: h.receiverTazkira || "",
      receiverPhone: h.receiverPhone || "", receiverAddress: h.receiverAddress || "",
      status: h.status === "sent" ? "sent" : h.status === "paid" ? "paid" : h.status === "cancelled" ? "cancelled" : "pending",
      paidAt: h.paidAt, paidBy: h.paidBy, paidAmount: h.paidAmount, cancelReason: h.cancelReason,
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

const statusLabels: Record<HawalaStatus, string> = { pending: "در انتظار", sent: "ارسال‌شده", paid: "پرداخت‌شده", cancelled: "لغوشده" };
const statusColors: Record<HawalaStatus, { light: string; dark: string }> = {
  pending: { light: "bg-amber-100 text-amber-700", dark: "bg-amber-400/15 text-amber-300" },
  sent: { light: "bg-sky-100 text-sky-700", dark: "bg-sky-400/15 text-sky-300" },
  paid: { light: "bg-emerald-100 text-emerald-700", dark: "bg-emerald-400/15 text-emerald-300" },
  cancelled: { light: "bg-rose-100 text-rose-700", dark: "bg-rose-400/15 text-rose-300" },
};

const formatDestination = (province: string, district: string) => province === "هرات" ? `${province} — ${district}` : province;

const getHawalaNumberValue = (number: string) => {
  const match = String(number || "").match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
};

const sortByHawalaNumber = (items: Hawala[], order: "asc" | "desc") =>
  [...items].sort((a, b) => {
    const an = getHawalaNumberValue(a.number);
    const bn = getHawalaNumberValue(b.number);
    return order === "asc" ? an - bn : bn - an;
  });

type BalanceChange = { customerName: string; currency: Currency; amount: number; };

function getBalanceChangesForHawala(h: Hawala, action: "register" | "settle" | "cancel"): BalanceChange[] {
  const changes: BalanceChange[] = [];
  try {
    if (action === "register") {
      changes.push({ customerName: h.senderName, currency: h.currencyFrom, amount: -h.amountFrom });
    } else if (action === "settle") {
      changes.push({ customerName: h.receiverName, currency: h.currencyTo, amount: h.finalAmount });
    } else if (action === "cancel") {
      changes.push({ customerName: h.senderName, currency: h.currencyFrom, amount: h.amountFrom });
      if (h.status === "paid") changes.push({ customerName: h.receiverName, currency: h.currencyTo, amount: -h.finalAmount });
    }
  } catch {}
  return changes;
}

function applyBalanceChanges(customers: Customer[], changes: BalanceChange[]): Customer[] {
  try {
    return customers.map(c => {
      const cc = changes.filter(ch => ch.customerName === c.name);
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
  send: "M6 12 3.269 3.126A59.768 59.768 0 0 1 21.485 12 59.77 59.77 0 0 1 3.27 20.876L5.999 12Zm0 0h7.5",
  receive: "M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3",
  clock: "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  chevron: "m19.5 8.25-7.5 7.5-7.5-7.5",
  check: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  x: "M6 18 18 6M6 6l12 12",
  xCircle: "m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  alert: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z",
  doc: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
  inbox: "M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z",
  arrowLeft: "M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18",
  swap: "M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5",
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

export default function HawalaPage() {
  const [mounted, setMounted] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>(defaultCustomers);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [hawalas, setHawalas] = useState<Hawala[]>([]);
  const [lastNames, setLastNames] = useState<LastNames>({ senderName: "", receiverName: "" });

  const [activeTab, setActiveTab] = useState<"new" | "current" | "history">("new");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [showSenderList, setShowSenderList] = useState(false);
  const [senderFilter, setSenderFilter] = useState("");
  const senderListRef = useRef<HTMLDivElement>(null);

  // ✅ state‌های جدید برای لیست حواله‌گیرنده
  const [showReceiverList, setShowReceiverList] = useState(false);
  const [receiverFilter, setReceiverFilter] = useState("");
  const receiverListRef = useRef<HTMLDivElement>(null);

  const [nameSearch, setNameSearch] = useState("");
  const [amountSearch, setAmountSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [settleTarget, setSettleTarget] = useState<Hawala | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Hawala | null>(null);
  const [paidBy, setPaidBy] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    try { const saved = window.localStorage.getItem("hawala-theme"); if (saved === "dark" || saved === "light") setTheme(saved); } catch {}
  }, []);
  useEffect(() => { try { window.localStorage.setItem("hawala-theme", theme); } catch {} }, [theme]);
  const dk = theme === "dark";

  useEffect(() => {
    try {
      setCustomers(loadCustomers());
      setTransactions(loadTransactions());
      setHawalas(loadHawalas());
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

  useEffect(() => { try { localStorage.setItem("hawalaLastNames", JSON.stringify(lastNames)); } catch {} }, [lastNames]);
  useEffect(() => { try { localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers)); } catch {} }, [customers]);
  useEffect(() => { try { localStorage.setItem(HAWALAS_KEY, JSON.stringify(hawalas)); } catch {} }, [hawalas]);

  // ✅ استفاده از click بجای mousedown برای جلوگیری از مشکل باز/بسته شدن خودکار
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    if (openMenuId) {
      document.addEventListener("click", handleClickOutside);
    }
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [openMenuId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (senderListRef.current && !senderListRef.current.contains(target)) setShowSenderList(false);
      if (receiverListRef.current && !receiverListRef.current.contains(target)) setShowReceiverList(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  const filteredSenderList = useMemo(() => {
    if (!senderFilter) return customers;
    const q = normalizeDigits(senderFilter.trim()).toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.phone && normalizeDigits(c.phone).includes(q))
    );
  }, [customers, senderFilter]);

  // ✅ فیلتر لیست حواله‌گیرنده
  const filteredReceiverList = useMemo(() => {
    if (!receiverFilter) return customers;
    const q = normalizeDigits(receiverFilter.trim()).toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.phone && normalizeDigits(c.phone).includes(q))
    );
  }, [customers, receiverFilter]);

  const rateMode = getRateMode(form.currencyFrom, form.currencyTo);
  const afnForeign = getAfnForeign(form.currencyFrom, form.currencyTo);
  const directBaseValue = rateMode === "direct" ? getSafeDirectBase(form.currencyFrom, form.currencyFrom, form.currencyTo) : form.currencyFrom;
  const directCounter = rateMode === "direct" ? getDirectCounter(directBaseValue, form.currencyFrom, form.currencyTo) : null;
  const [directBase, setDirectBase] = useState<Currency>("USD");

  useEffect(() => { if (rateMode === "direct" && directBase !== directBaseValue) setDirectBase(directBaseValue); }, [rateMode, directBase, directBaseValue]);
  useEffect(() => { setForm(prev => ({ ...prev, rate: "" })); }, [rateMode, afnForeign, directBaseValue, directCounter]);

  const amountFrom = parseAmount(form.amountFrom);
  const rateValue = parseAmount(form.rate);
  const feeValue = parseAmount(form.fee);

  const convertedAmount = useMemo(() => {
    try {
      if (!amountFrom) return 0;
      if (rateMode === "same") return amountFrom;
      if (!rateValue) return 0;
      if (rateMode === "afn") return convertAfnRate(amountFrom, form.currencyFrom, form.currencyTo, rateValue);
      if (rateMode === "direct" && directCounter) return convertDirectRate(amountFrom, form.currencyFrom, form.currencyTo, directBaseValue, rateValue);
      return 0;
    } catch { return 0; }
  }, [amountFrom, rateValue, rateMode, form.currencyFrom, form.currencyTo, directCounter, directBaseValue]);

  const finalAmount = Math.max(0, convertedAmount - feeValue);
  const nextHawalaNumber = getNextSharedCode("HW");
  const isHerat = form.province === "هرات";
  const destinationText = formatDestination(form.province, form.district);
  const totalCount = hawalas.length;
  const pendingCount = hawalas.filter(item => item.status === "pending").length;
  const sentCount = hawalas.filter(item => item.status === "sent").length;
  const paidCount = hawalas.filter(item => item.status === "paid").length;
  const cancelledCount = hawalas.filter(item => item.status === "cancelled").length;

  // ✅ محاسبه موجودی برای حواله‌دهنده و حواله‌گیرنده
  const selectedSender = useMemo(() => customers.find(c => c.name === form.senderName) || null, [customers, form.senderName]);
  const selectedReceiver = useMemo(() => customers.find(c => c.name === form.receiverName) || null, [customers, form.receiverName]);

  const matchesSearch = (item: Hawala, query: string) => {
    const q = normalizeDigits(query).trim().toLowerCase();
    if (!q) return true;
    const fields = [item.senderName, item.receiverName, item.number, item.senderPhone, item.receiverPhone, item.receiverTazkira];
    return fields.some(f => f && normalizeDigits(String(f)).toLowerCase().includes(q));
  };

  const matchesAmount = (item: Hawala, query: string) => {
    const raw = normalizeDigits(query).replace(/[,،\s]/g, "");
    if (!raw) return true;
    const queryNumber = Number(raw);
    const values = [item.amountFrom, item.finalAmount, item.paidAmount];
    if (!Number.isNaN(queryNumber)) return values.some(v => typeof v === "number" && (v === queryNumber || String(v).includes(raw)));
    return values.some(v => String(v ?? "").includes(raw));
  };

  const currentHawalas = useMemo(() => {
    try {
      let filtered = hawalas.filter(item => item.status === "pending" || item.status === "sent");
      if (nameSearch) filtered = filtered.filter(item => matchesSearch(item, nameSearch));
      if (amountSearch) filtered = filtered.filter(item => matchesAmount(item, amountSearch));
      return sortByHawalaNumber(filtered, sortOrder);
    } catch { return []; }
  }, [hawalas, nameSearch, amountSearch, sortOrder]);

  const historyHawalas = useMemo(() => {
    try {
      let filtered = hawalas.filter(item => item.status === "paid" || item.status === "cancelled");
      if (nameSearch) filtered = filtered.filter(item => matchesSearch(item, nameSearch));
      if (amountSearch) filtered = filtered.filter(item => matchesAmount(item, amountSearch));
      return sortByHawalaNumber(filtered, sortOrder);
    } catch { return []; }
  }, [hawalas, nameSearch, amountSearch, sortOrder]);

  const showToast = (message: string) => { setToast(message); setTimeout(() => setToast(""), 3500); };
  const setField = (field: keyof FormState, value: string) => { setForm(prev => ({ ...prev, [field]: value })); setErrors(prev => ({ ...prev, [field]: undefined })); };

  const handleProvinceChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const np = event.target.value;
    setForm(prev => ({ ...prev, province: np, district: np === "هرات" ? "گلران" : np }));
    setErrors(prev => ({ ...prev, province: undefined }));
  };

  const validateForm = () => {
    const errs: FormErrors = {};
    if (!form.type.trim()) errs.type = "نوع حواله را انتخاب کنید.";
    if (!form.senderName.trim()) errs.senderName = "نام حواله‌دهنده ضروری است.";
    if (!form.senderPhone.trim()) errs.senderPhone = "شماره تماس حواله‌دهنده ضروری است.";
    if (!form.receiverName.trim()) errs.receiverName = "نام حواله‌گیرنده ضروری است.";
    if (!form.receiverTazkira.trim()) errs.receiverTazkira = "شماره تذکره حواله‌گیرنده ضروری است.";
    if (!form.receiverPhone.trim()) errs.receiverPhone = "شماره تماس حواله‌گیرنده ضروری است.";
    if (!form.amountFrom.trim() || amountFrom <= 0) errs.amountFrom = "مبلغ حواله ضروری است.";
    if (feeValue < 0) errs.fee = "کمیشن نمی‌تواند منفی باشد.";
    if (amountFrom > 0 && feeValue >= convertedAmount) errs.fee = "کمیشن نمی‌تواند بیشتر یا برابر مبلغ تبدیل‌شده باشد.";
    if (!form.province.trim()) errs.province = "ولایت مقصد ضروری است.";
    if (rateMode !== "same") {
      if (!rateValue) errs.rate = rateMode === "afn" ? "نرخ در برابر افغانی خالی است." : "نرخ مستقیم خالی است.";
      if (rateMode === "direct" && !directCounter) errs.rate = "مبنای نرخ مستقیم معتبر نیست.";
    }
    if (amountFrom > 0 && rateMode !== "same" && !convertedAmount) errs.rate = "مبلغ تبدیل محاسبه نشد؛ لطفاً نرخ را بررسی کنید.";
    return errs;
  };

  const handleRegisterClick = () => {
    const errs = validateForm();
    setErrors(errs);
    if (Object.keys(errs).length > 0) { showToast("لطفاً فیلدهای ضروری را خانه‌پری کنید."); return; }
    setPreviewOpen(true);
  };

  const confirmRegister = () => {
    try {
      const nowDate = new Date();
      const senderName = form.senderName.trim();
      const receiverName = form.receiverName.trim();
      
      let rateLabel = "";
      const txRate = rateMode === "same" ? 1 : rateValue;
      if (rateMode === "same") rateLabel = "بدون تبدیل";
      if (rateMode === "afn" && afnForeign) rateLabel = afnRateLabel(afnForeign, txRate);
      if (rateMode === "direct" && directCounter) rateLabel = directRateLabel(directBaseValue, directCounter, txRate);
      const trackingNumber = consumeSharedCode("HW");
      const newHawala: Hawala = {
        id: generateId(), number: trackingNumber, date: nowDate.toISOString(), time: "", type: form.type,
        destinationCountry: "افغانستان", province: form.province,
        district: form.province === "هرات" ? form.district : form.province, destinationText,
        currencyFrom: form.currencyFrom, currencyTo: form.currencyTo, amountFrom, rate: txRate, rateLabel,
        rateBase: rateMode === "direct" ? directBaseValue : undefined, fee: feeValue,
        feeCurrency: form.feeCurrency, feePayer: form.feePayer, finalAmount, balance: form.balance,
        note: form.note, profit: feeValue, profitCurrency: form.feeCurrency,
        senderName, senderPhone: form.senderPhone, senderTelegram: form.senderTelegram,
        receiverName, receiverTazkira: form.receiverTazkira, receiverPhone: form.receiverPhone,
        receiverAddress: form.receiverAddress, status: "pending" as HawalaStatus
      };
      
      if (customers.some(c => c.name === senderName)) {
        setCustomers(prev => applyBalanceChanges(prev, getBalanceChangesForHawala(newHawala, "register")));
      }
      
      setHawalas(prev => [newHawala, ...prev]);
      setLastNames({ senderName, receiverName });
      setForm(emptyForm);
      setErrors({});
      setPreviewOpen(false);
      setActiveTab("current");
      showToast("حواله با موفقیت ثبت شد.");
    } catch (err) {
      console.error("Register error:", err);
      showToast("خطا در ثبت حواله");
    }
  };

  const resetForm = () => { setForm(emptyForm); setErrors({}); showToast("فورم پاک شد."); };

  const toggleMenu = (id: string) => {
    setOpenMenuId(openMenuId === id ? null : id);
  };

  const markAsSent = (item: Hawala) => {
    setHawalas(prev => prev.map(h => h.id === item.id ? { ...h, status: "sent" as HawalaStatus } : h));
    setOpenMenuId(null);
    showToast("وضعیت حواله به ارسال‌شده تغییر کرد.");
  };

  const openSettlement = (item: Hawala) => {
    setSettleTarget(item);
    setPaidAmount(String(item.finalAmount));
    setPaidBy("");
    setOpenMenuId(null);
  };

  const confirmSettlement = () => {
    if (!settleTarget) return;
    if (!paidBy.trim()) { showToast("نام پرداخت‌کننده را بنویسید."); return; }
    const amountPaid = Number(paidAmount || settleTarget.finalAmount);
    if (!Number.isFinite(amountPaid) || amountPaid <= 0) { showToast("مبلغ پرداخت‌شده معتبر نیست."); return; }
    try {
      const paidHawala = { ...settleTarget, status: "paid" as HawalaStatus };
      if (customers.some(c => c.name === settleTarget.receiverName)) {
        setCustomers(prev => applyBalanceChanges(prev, getBalanceChangesForHawala(paidHawala, "settle")));
      }
      setHawalas(prev => prev.map(item => item.id === settleTarget.id ? { ...item, status: "paid" as HawalaStatus, paidAt: new Date().toISOString(), paidBy, paidAmount: amountPaid } : item));
      setSettleTarget(null);
      showToast("حواله تسویه شد و به تاریخچه منتقل شد.");
    } catch (err) {
      console.error("Settle error:", err);
      showToast("خطا در تسویه حواله");
    }
  };

  const openCancel = (item: Hawala) => {
    setCancelTarget(item);
    setCancelReason("");
    setOpenMenuId(null);
  };

  const confirmCancel = () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) { showToast("دلیل لغو حواله را بنویسید."); return; }
    try {
      if (customers.some(c => c.name === cancelTarget.senderName)) {
        setCustomers(prev => applyBalanceChanges(prev, getBalanceChangesForHawala(cancelTarget, "cancel")));
      }
      setHawalas(prev => prev.map(item => item.id === cancelTarget.id ? { ...item, status: "cancelled" as HawalaStatus, cancelReason } : item));
      setCancelTarget(null);
      showToast("حواله ابطال شد و به تاریخچه منتقل شد.");
    } catch (err) {
      console.error("Cancel error:", err);
      showToast("خطا در ابطال حواله");
    }
  };

  const restoreToSent = (item: Hawala) => {
    setHawalas(prev => prev.map(h => h.id === item.id ? { ...h, status: "sent" as HawalaStatus, paidAt: undefined, paidBy: undefined, paidAmount: undefined, cancelReason: undefined } : h));
    setOpenMenuId(null);
    showToast("حواله به وضعیت ارسال‌شده برگشت و به تب جاری منتقل شد.");
  };

  const deleteHawala = (item: Hawala) => {
    setOpenMenuId(null);
    const msg = `آیا از حذف کامل حواله ${item.number} مطمئن هستید؟\n\nاین عملیات قابل بازگشت نیست و حواله از سیستم پاک می‌شود.`;
    if (!window.confirm(msg)) return;
    try {
      if (item.status === "pending" || item.status === "sent") {
        if (customers.some(c => c.name === item.senderName)) {
          setCustomers(prev => applyBalanceChanges(prev, [{ customerName: item.senderName, currency: item.currencyFrom, amount: item.amountFrom }]));
        }
      }
      if (item.status === "paid") {
        if (customers.some(c => c.name === item.senderName)) {
          setCustomers(prev => applyBalanceChanges(prev, [
            { customerName: item.senderName, currency: item.currencyFrom, amount: item.amountFrom },
          ]));
        }
        if (customers.some(c => c.name === item.receiverName)) {
          setCustomers(prev => applyBalanceChanges(prev, [
            { customerName: item.receiverName, currency: item.currencyTo, amount: -item.finalAmount },
          ]));
        }
      }
      setHawalas(prev => prev.filter(h => h.id !== item.id));
      showToast(`حواله ${item.number} حذف شد.`);
    } catch (err) {
      console.error("Delete error:", err);
      showToast("خطا در حذف حواله");
    }
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
  const errInput = dk ? "border-rose-400/70" : "border-rose-400";
  const roInput = dk ? "cursor-default bg-slate-800/70 text-slate-400 hover:border-slate-600 focus:border-slate-600 focus:ring-0" : "cursor-default bg-slate-100 text-slate-500 hover:border-slate-200 focus:border-slate-200 focus:ring-0";
  const uiLabel = `mb-1.5 block text-[11px] font-black tracking-wide ${dk ? "text-slate-400" : "text-slate-500"}`;
  const rateChip = `flex h-12 items-center whitespace-nowrap rounded-xl border px-3.5 text-sm font-bold shadow-sm ${dk ? "border-slate-600 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-700"}`;
  const chevPos = `pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${dk ? "text-slate-500" : "text-slate-400"}`;
  const identHwIcon = dk ? "from-blue-400/20 to-blue-400/5 text-blue-300 ring-blue-400/25" : "from-blue-400/20 to-cyan-400/10 text-blue-600 ring-blue-400/30";

  const cBlue = { wrap: dk ? "border-blue-400/25 bg-blue-400/[0.07]" : "border-blue-300 bg-blue-50", icon: dk ? "bg-blue-400/15 text-blue-300" : "bg-blue-100 text-blue-600", title: dk ? "text-blue-300" : "text-blue-700", badge: dk ? "bg-blue-400/15 text-blue-300" : "bg-blue-100 text-blue-700" };
  const cAmber = { wrap: dk ? "border-amber-400/25 bg-amber-400/[0.07]" : "border-amber-300 bg-amber-50", icon: dk ? "bg-amber-400/15 text-amber-300" : "bg-amber-100 text-amber-600", title: dk ? "text-amber-300" : "text-amber-700", badge: dk ? "bg-amber-400/15 text-amber-300" : "bg-amber-100 text-amber-700" };
  const cEmerald = { wrap: dk ? "border-emerald-400/25 bg-emerald-400/[0.07]" : "border-emerald-300 bg-emerald-50", icon: dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-600", title: dk ? "text-emerald-300" : "text-emerald-700", badge: dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-700" };
  const cOrange = { wrap: dk ? "border-orange-400/25 bg-orange-400/[0.07]" : "border-orange-300 bg-orange-50", icon: dk ? "bg-orange-400/15 text-orange-300" : "bg-orange-100 text-orange-600", title: dk ? "text-orange-300" : "text-orange-700", badge: dk ? "bg-orange-400/15 text-orange-300" : "bg-orange-100 text-orange-700" };

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

  // ✅ کامپوننت کارت موجودی با نمایش قرض/طلب
  const CustomerBalanceCard = ({ customer, color }: { customer: Customer | null; color: "blue" | "orange" | "emerald" }) => {
    if (!customer) return null;
    const colors = {
      blue: { border: dk ? "border-blue-400/30 bg-blue-400/10" : "border-blue-200 bg-blue-50", text: dk ? "text-blue-300" : "text-blue-700", icon: dk ? "text-blue-300" : "text-blue-600" },
      orange: { border: dk ? "border-orange-400/30 bg-orange-400/10" : "border-orange-200 bg-orange-50", text: dk ? "text-orange-300" : "text-orange-700", icon: dk ? "text-orange-300" : "text-orange-600" },
      emerald: { border: dk ? "border-emerald-400/30 bg-emerald-400/10" : "border-emerald-200 bg-emerald-50", text: dk ? "text-emerald-300" : "text-emerald-700", icon: dk ? "text-emerald-300" : "text-emerald-600" },
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

  const ActionMenu = ({ item, isInHistory }: { item: Hawala; isInHistory: boolean }) => {
    const isOpen = openMenuId === item.id;
    const isPending = item.status === "pending";
    const isSent = item.status === "sent";
    const isPaid = item.status === "paid";
    const isCancelled = item.status === "cancelled";

    return (
      <div className="relative" ref={isOpen ? menuRef : null}>
        <button
          onClick={(e) => { e.stopPropagation(); toggleMenu(item.id); }}
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
            {!isInHistory && (
              <>
                {isPending && (
                  <button onClick={() => markAsSent(item)} className={`flex w-full items-center gap-2 px-3 py-2.5 text-right text-xs font-bold transition ${dk ? "text-slate-200 hover:bg-blue-400/15 hover:text-blue-300" : "text-slate-700 hover:bg-blue-50 hover:text-blue-600"}`}>
                    <Ic n="send" className="h-4 w-4" /><span>ارسال</span>
                  </button>
                )}
                {(isPending || isSent) && (
                  <button onClick={() => openSettlement(item)} className={`flex w-full items-center gap-2 px-3 py-2.5 text-right text-xs font-bold transition ${dk ? "text-slate-200 hover:bg-emerald-400/15 hover:text-emerald-300" : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-600"}`}>
                    <Ic n="check" className="h-4 w-4" /><span>تسویه</span>
                  </button>
                )}
                {(isPending || isSent) && (
                  <button onClick={() => openCancel(item)} className={`flex w-full items-center gap-2 px-3 py-2.5 text-right text-xs font-bold transition ${dk ? "text-slate-200 hover:bg-amber-400/15 hover:text-amber-300" : "text-slate-700 hover:bg-amber-50 hover:text-amber-600"}`}>
                    <Ic n="xCircle" className="h-4 w-4" /><span>ابطال</span>
                  </button>
                )}
                <div className={`h-px ${dk ? "bg-slate-700" : "bg-slate-100"}`} />
                <button onClick={() => deleteHawala(item)} className={`flex w-full items-center gap-2 px-3 py-2.5 text-right text-xs font-bold transition ${dk ? "text-rose-300 hover:bg-rose-400/15" : "text-rose-600 hover:bg-rose-50"}`}>
                  <Ic n="trash" className="h-4 w-4" /><span>حذف</span>
                </button>
              </>
            )}

            {isInHistory && (
              <>
                {isCancelled && (
                  <button onClick={() => restoreToSent(item)} className={`flex w-full items-center gap-2 px-3 py-2.5 text-right text-xs font-bold transition ${dk ? "text-slate-200 hover:bg-blue-400/15 hover:text-blue-300" : "text-slate-700 hover:bg-blue-50 hover:text-blue-600"}`}>
                    <Ic n="undo" className="h-4 w-4" /><span>برگشت به ارسال</span>
                  </button>
                )}
                {isPaid && (
                  <button onClick={() => openCancel(item)} className={`flex w-full items-center gap-2 px-3 py-2.5 text-right text-xs font-bold transition ${dk ? "text-slate-200 hover:bg-amber-400/15 hover:text-amber-300" : "text-slate-700 hover:bg-amber-50 hover:text-amber-600"}`}>
                    <Ic n="xCircle" className="h-4 w-4" /><span>ابطال</span>
                  </button>
                )}
                <div className={`h-px ${dk ? "bg-slate-700" : "bg-slate-100"}`} />
                <button onClick={() => deleteHawala(item)} className={`flex w-full items-center gap-2 px-3 py-2.5 text-right text-xs font-bold transition ${dk ? "text-rose-300 hover:bg-rose-400/15" : "text-rose-600 hover:bg-rose-50"}`}>
                  <Ic n="trash" className="h-4 w-4" /><span>حذف</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const errorList = Object.values(errors).filter((msg): msg is string => Boolean(msg));
  
  const tabs = [
    { id: "new" as const, label: "ثبت حواله جدید", icon: "plus" as IconName },
    { id: "current" as const, label: "حواله‌های جاری", icon: "clock" as IconName, count: currentHawalas.length },
    { id: "history" as const, label: "تاریخچه حواله‌ها", icon: "doc" as IconName, count: historyHawalas.length },
  ];

  return (
    <div dir="rtl" className={dk ? "dark" : ""}>
      <style>{`@import url("https://fonts.googleapis.com/css2?family=Lalezar&family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap");.hw-font{font-family:"Vazirmatn","Segoe UI",Tahoma,sans-serif}.hw-display{font-family:"Lalezar","Vazirmatn",Tahoma,sans-serif;letter-spacing:.01em}.dark{color-scheme:dark}@keyframes hwUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}.hw-up{animation:hwUp .5s cubic-bezier(.22,.8,.35,1) both}@keyframes menuIn{from{opacity:0;transform:scale(.95) translateY(-4px)}to{opacity:1;transform:scale(1) translateY(0)}}.hw-menu{animation:menuIn .15s ease-out}details>summary{list-style:none}details>summary::-webkit-details-marker{display:none}::selection{background:rgba(59,130,246,.25)}`}</style>

      <div className={`hw-font relative min-h-screen overflow-x-hidden antialiased transition-colors duration-500 ${dk ? "bg-[#0f172a] text-slate-100" : "bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 text-slate-800"}`}>
        <div className={`fixed inset-x-0 top-0 z-30 h-1 bg-gradient-to-l ${dk ? "from-blue-400 via-cyan-400 to-emerald-400" : "from-blue-500 via-cyan-500 to-emerald-500"}`} />
        <div className="relative z-10 mx-auto w-full max-w-7xl space-y-4 md:space-y-6 px-3 pb-16 pt-5 md:px-8 md:pt-9">
          <header className="hw-up flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0">
              <div className="relative grid h-11 w-11 md:h-14 md:w-14 shrink-0 place-items-center rounded-xl md:rounded-2xl bg-gradient-to-br from-blue-500 via-cyan-500 to-emerald-400 text-white shadow-lg shadow-blue-500/30 ring-1 ring-white/30">
                <Ic n="send" className="h-5 w-5 md:h-6 md:w-6" />
                <span className={`absolute -bottom-1 -left-1 md:-bottom-1.5 md:-left-1.5 grid h-4 min-w-4 md:h-5 md:min-w-5 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-400 px-1 text-[7px] md:text-[8px] font-black text-white ring-2 ${dk ? "ring-[#0f172a]" : "ring-[#eff6ff]"}`}>HW</span>
              </div>
              <div className="min-w-0">
                <h1 className={`hw-display text-2xl md:text-4xl leading-none ${heading}`}>حواله‌جات</h1>
                <p className={`mt-1 text-[10px] md:text-xs font-bold ${subText}`}>ثبت، پیگیری و تسویه حواله‌ها</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2.5">
              <div className={`hidden sm:flex items-center gap-2 rounded-xl border px-3 py-2 shadow-sm backdrop-blur ${glassChip}`}>
                <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" /></span>
                <span dir="ltr" className={`text-xs font-bold tabular-nums ${dk ? "text-slate-100" : "text-slate-700"}`}>{currentDateTime || "--:--"}</span>
              </div>
              <button onClick={() => setTheme(dk ? "light" : "dark")} className={`group grid h-10 w-10 md:h-11 md:w-11 cursor-pointer place-items-center rounded-lg md:rounded-xl border shadow-sm backdrop-blur transition-all duration-300 active:scale-90 ${dk ? "border-slate-600 bg-slate-800/85 text-amber-300 hover:border-amber-300" : "border-slate-200 bg-white/85 text-slate-600 hover:border-blue-400"}`}>
                {dk ? <Ic n="sun" className="h-4 w-4 transition-transform duration-500 group-hover:rotate-45" /> : <Ic n="moon" className="h-4 w-4 transition-transform duration-500 group-hover:-rotate-12" />}
              </button>
            </div>
          </header>

          <div className="hw-up grid grid-cols-2 md:grid-cols-4 gap-3" style={{ animationDelay: "70ms" }}>
            {[
              { label: "تعداد حواله‌ها", value: totalCount, color: dk ? "text-blue-300" : "text-blue-600" },
              { label: "در انتظار / ارسال", value: pendingCount + sentCount, color: dk ? "text-amber-300" : "text-amber-600" },
              { label: "پرداخت‌شده", value: paidCount, color: dk ? "text-emerald-300" : "text-emerald-600" },
              { label: "ابطال‌شده", value: cancelledCount, color: dk ? "text-rose-300" : "text-rose-600" },
            ].map((stat, i) => (
              <div key={i} className={`rounded-xl border p-3 text-center ${dk ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-white"}`}>
                <div className={`text-xl font-black tabular-nums ${stat.color}`}>{stat.value}</div>
                <div className={`text-[10px] font-bold mt-1 ${subText}`}>{stat.label}</div>
              </div>
            ))}
          </div>

          <div className={`hw-up flex gap-1.5 md:gap-2 rounded-xl md:rounded-2xl border p-1.5 md:p-2 shadow-sm backdrop-blur ${glassChip}`} style={{ animationDelay: "140ms" }}>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 md:gap-2 rounded-lg md:rounded-xl px-3 md:px-5 py-2.5 md:py-3 text-xs md:text-sm font-black transition-all duration-300 active:scale-[0.97] ${activeTab === tab.id ? `bg-gradient-to-l shadow-lg ${dk ? "from-blue-400 to-cyan-400 text-slate-950" : "from-blue-500 via-cyan-500 to-emerald-500 text-white"}` : dk ? "text-slate-400 hover:bg-slate-700/60 hover:text-slate-100" : "text-slate-500 hover:bg-blue-50 hover:text-slate-800"}`}>
                <Ic n={tab.icon} className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${activeTab === tab.id ? dk ? "bg-slate-950/20 text-slate-950" : "bg-white/30 text-white" : dk ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"}`}>{tab.count}</span>}
              </button>
            ))}
          </div>

          {activeTab === "new" && (
            <section className={`hw-up space-y-4 md:space-y-5 p-4 md:p-7 ${uiCard}`}>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${identHwIcon}`}><Ic n="send" className="h-5 w-5" /></span>
                <div className="flex-1 min-w-0">
                  <h2 className={`hw-display text-xl md:text-2xl leading-none ${heading}`}>ثبت حواله جدید</h2>
                  <p className={`mt-1 text-[11px] font-bold ${subText}`}>معلومات حواله‌دهنده، مقصد و حواله‌گیرنده</p>
                </div>
              </div>

              {/* ✅ نمایش کارت‌های موجودی با قرض/طلب برای حواله‌دهنده و حواله‌گیرنده */}
              <div className="grid gap-3 md:grid-cols-2">
                <CustomerBalanceCard customer={selectedSender} color="blue" />
                <CustomerBalanceCard customer={selectedReceiver} color="orange" />
              </div>

              <div className={`rounded-2xl border p-4 ${dk ? "border-slate-600 bg-slate-900/50" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-center gap-2.5 mb-4"><span className={`grid h-9 w-9 place-items-center rounded-xl ${dk ? "bg-blue-400/15 text-blue-300" : "bg-blue-100 text-blue-600"}`}><Ic n="send" className="h-4 w-4" /></span><b className={`text-sm font-black ${dk ? "text-blue-300" : "text-blue-700"}`}>معلومات حواله‌دهنده و حواله</b></div>
                <div className="grid gap-3 md:gap-4 sm:grid-cols-3 mb-4">
                  {fld("نام حواله‌دهنده *", (
                    <div className="relative" ref={senderListRef}>
                      <input
                        value={form.senderName}
                        onChange={e => {
                          const val = e.target.value;
                          setField("senderName", val);
                          setSenderFilter(val);
                          if (!showSenderList) setShowSenderList(true);
                          const customer = customers.find(c => c.name === val);
                          if (customer) {
                            setField("senderPhone", customer.phone || "");
                            setField("senderTelegram", customer.telegram || "");
                          } else {
                            setField("senderPhone", "");
                            setField("senderTelegram", "");
                          }
                        }}
                        onFocus={() => { if (!showSenderList) setShowSenderList(true); }}
                        placeholder="انتخاب از لیست یا نوشتن نام جدید…"
                        className={`${uiInput} pl-12 ${errors.senderName ? errInput : ""}`}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setShowSenderList(!showSenderList); }}
                        className={`absolute left-2 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-lg transition ${dk ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}
                      >
                        <Ic n="chevron" className={`h-4 w-4 transition-transform ${showSenderList ? "rotate-180" : ""}`} />
                      </button>

                      {showSenderList && (
                        <div className={`hw-menu absolute left-0 top-full z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border shadow-xl ${dk ? "border-slate-600 bg-slate-800" : "border-slate-200 bg-white"}`}>
                          {filteredSenderList.length === 0 ? (
                            <div className={`px-4 py-3 text-xs text-center ${subText}`}>مشتری‌ای یافت نشد</div>
                          ) : (
                            filteredSenderList.map((c, idx) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setField("senderName", c.name);
                                  setField("senderPhone", c.phone || "");
                                  setField("senderTelegram", c.telegram || "");
                                  setSenderFilter("");
                                  setShowSenderList(false);
                                }}
                                className={`flex w-full items-center gap-2 px-3 py-2.5 text-right text-xs font-bold transition ${dk ? "text-slate-200 hover:bg-blue-400/15 hover:text-blue-300" : "text-slate-700 hover:bg-blue-50 hover:text-blue-600"}`}
                              >
                                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-black text-white bg-gradient-to-br from-blue-500 to-cyan-500`}>
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
                      <input readOnly dir="ltr" value={nextHawalaNumber} className={`${uiInput} ${roInput} pl-14 text-left tabular-nums font-black text-[15px]`} />
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 px-2 py-1 text-[9px] font-black text-white">HW</span>
                    </div>
                  ))}
                  {fld("تاریخ (شمسی)", (<input readOnly value={currentDateTime} className={`${uiInput} ${roInput}`} />))}
                </div>
                <div className="grid gap-3 md:gap-4 sm:grid-cols-2 mb-4">
                  {fld("شماره تماس حواله‌دهنده *", (<input className={`${uiInput} ${errors.senderPhone ? errInput : ""}`} value={form.senderPhone} onChange={e => setField("senderPhone", e.target.value)} placeholder="07xxxxxxxx" />))}
                  {fld("چت آی‌دی تلگرام", (<input className={uiInput} value={form.senderTelegram} onChange={e => setField("senderTelegram", e.target.value)} placeholder="@example یا شماره" />))}
                </div>
                <div className="grid gap-3 md:gap-4 sm:grid-cols-3 mb-4">
                  {fld("نوع حواله *", sel(form.type, (v) => setField("type", v), [["", "انتخاب کنید"], ["send", "ارسال"], ["receive", "دریافت"]], errors.type ? errInput : ""))}
                  {fld("ارز مبدا *", sel(form.currencyFrom, (v) => setField("currencyFrom", v), currencies.map(c => [c, labels[c]])))}
                  {fld("ارز مقصد *", sel(form.currencyTo, (v) => setField("currencyTo", v), currencies.map(c => [c, labels[c]])))}
                </div>
                <div className="grid gap-3 md:gap-4 sm:grid-cols-3 mb-4">
                  {fld("مبلغ حواله *", (<input type="text" inputMode="decimal" dir="ltr" className={`${uiInput} text-left tabular-nums ${errors.amountFrom ? errInput : ""}`} value={form.amountFrom} onChange={e => setField("amountFrom", toNumericText(e.target.value))} placeholder="مثلاً 10000" />))}
                  {fld("کمیشن حواله", (<input type="text" inputMode="decimal" dir="ltr" className={`${uiInput} text-left tabular-nums ${errors.fee ? errInput : ""}`} value={form.fee} onChange={e => setField("fee", toNumericText(e.target.value))} placeholder="مثلاً 200" />))}
                  {fld("مبلغ نهایی", (<input readOnly value={`${fmt(finalAmount)} ${labels[form.currencyTo]}`} className={`${uiInput} ${roInput} text-left tabular-nums`} />))}
                </div>
                <div className="grid gap-3 md:gap-4 sm:grid-cols-2">
                  {fld("باقی مانده حساب مشتری", (<input className={uiInput} value={form.balance} onChange={e => setField("balance", e.target.value)} placeholder="اختیاری" />))}
                </div>
              </div>

              {rateMode === "same" && (<div>{sameBox("ارز مبدا و مقصد یکسان است؛ مبلغ نهایی برابر مبلغ حواله خواهد بود.")}</div>)}
              {rateMode === "afn" && afnForeign && (
                <div>{rateBox(cBlue, "نرخ دستی در برابر افغانی", (
                  <div><label className={uiLabel}>نرخ</label>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className={rateChip}>{rateUnits[afnForeign]} {labels[afnForeign]} =</span>
                      <input type="text" inputMode="decimal" dir="ltr" value={form.rate} onChange={(e) => setField("rate", toNumericText(e.target.value))} placeholder="0" className={`h-12 w-32 md:w-44 px-3 text-left text-sm font-bold tabular-nums ${inputShell} ${errors.rate ? errInput : ""}`} />
                      <span className={rateChip}>{labels.AFN}</span>
                    </div>
                  </div>
                ), (<>{pill(cBlue.badge, rateValue > 0 ? `نرخ ثبت‌شده: ${afnRateLabel(afnForeign, rateValue)}` : "", true)}{pill(cEmerald.badge, convertedAmount > 0 ? `نتیجه: ${fmt(convertedAmount)} ${labels[form.currencyTo]}` : "")}</>))}</div>
              )}
              {rateMode === "direct" && (
                <div>{rateBox(cAmber, "نرخ مستقیم جفت‌ارز", (
                  <div className="grid items-end gap-3 md:gap-4 md:grid-cols-2">
                    {fld("مبنای نرخ", sel(directBaseValue, (v) => setDirectBase(v as Currency), [[form.currencyFrom, labels[form.currencyFrom]], [form.currencyTo, labels[form.currencyTo]]]))}
                    <div>
                      <label className={uiLabel}>نرخ مستقیم</label>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={rateChip}>{rateUnits[directBaseValue]} {labels[directBaseValue]} =</span>
                        <input type="text" inputMode="decimal" dir="ltr" value={form.rate} onChange={(e) => setField("rate", toNumericText(e.target.value))} placeholder="0" className={`h-12 w-28 md:w-40 px-3 text-left text-sm font-bold tabular-nums ${inputShell} ${errors.rate ? errInput : ""}`} />
                        <span className={rateChip}>{directCounter ? labels[directCounter] : ""}</span>
                      </div>
                    </div>
                  </div>
                ), (<>{pill(cAmber.badge, rateValue > 0 && directCounter ? `نرخ ثبت‌شده: ${directRateLabel(directBaseValue, directCounter, rateValue)}` : "", true)}{pill(cEmerald.badge, convertedAmount > 0 ? `نتیجه: ${fmt(convertedAmount)} ${labels[form.currencyTo]}` : "")}</>))}</div>
              )}

              <div className={`rounded-2xl border p-4 ${dk ? "border-slate-600 bg-slate-900/50" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-center gap-2.5 mb-4"><span className={`grid h-9 w-9 place-items-center rounded-xl ${dk ? "bg-amber-400/15 text-amber-300" : "bg-amber-100 text-amber-600"}`}><Ic n="rate" className="h-4 w-4" /></span><b className={`text-sm font-black ${dk ? "text-amber-300" : "text-amber-700"}`}>کارمزد</b></div>
                <div className="grid gap-3 md:gap-4 sm:grid-cols-2">
                  {fld("کارمزد از حساب", (
                    <div className={`flex rounded-xl border p-1 ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-white"}`}>
                      <button type="button" onClick={() => setField("feePayer", "sender")} className={`flex-1 rounded-lg px-3 py-2 text-xs font-black transition-all ${form.feePayer === "sender" ? dk ? "bg-cyan-400 text-slate-950 shadow" : "bg-sky-500 text-white shadow" : dk ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-700"}`}>حواله‌دهنده</button>
                      <button type="button" onClick={() => setField("feePayer", "receiver")} className={`flex-1 rounded-lg px-3 py-2 text-xs font-black transition-all ${form.feePayer === "receiver" ? dk ? "bg-cyan-400 text-slate-950 shadow" : "bg-sky-500 text-white shadow" : dk ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-700"}`}>حواله‌گیرنده</button>
                    </div>
                  ))}
                  {fld("ارز کارمزد", (
                    <div className="relative">
                      <select value={form.feeCurrency} onChange={(e) => setField("feeCurrency", e.target.value)} className={`${uiInput} cursor-pointer appearance-none pl-9`}>
                        {currencies.map((c) => (<option key={c} value={c}>{labels[c]}</option>))}
                      </select>
                      <span className={chevPos}><Ic n="chevron" className="h-4 w-4" /></span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`rounded-2xl border p-4 ${dk ? "border-slate-600 bg-slate-900/50" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-center gap-2.5 mb-4"><span className={`grid h-9 w-9 place-items-center rounded-xl ${dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-600"}`}><Ic n="doc" className="h-4 w-4" /></span><b className={`text-sm font-black ${dk ? "text-emerald-300" : "text-emerald-700"}`}>معلومات مقصد</b></div>
                <div className="grid gap-3 md:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {fld("ولایت مقصد *", sel(form.province, handleProvinceChange as any, provinces.map(p => [p, p]), errors.province ? errInput : ""))}
                  {fld("ولسوالی مقصد", isHerat ? sel(form.district, (v) => setField("district", v), heratDistricts.map(d => [d, d])) : (<input readOnly value={form.province} className={`${uiInput} ${roInput}`} />))}
                  {fld("مقصد نهایی", (<input readOnly value={destinationText} className={`${uiInput} ${roInput}`} />))}
                </div>
              </div>

              <div className={`rounded-2xl border p-4 ${dk ? "border-slate-600 bg-slate-900/50" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-center gap-2.5 mb-4"><span className={`grid h-9 w-9 place-items-center rounded-xl ${dk ? "bg-amber-400/15 text-amber-300" : "bg-amber-100 text-amber-600"}`}><Ic n="receive" className="h-4 w-4" /></span><b className={`text-sm font-black ${dk ? "text-amber-300" : "text-amber-700"}`}>معلومات حواله‌گیرنده</b></div>
                <div className="grid gap-3 md:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {/* ✅ فیلد نام حواله‌گیرنده با قابلیت نوشتن و انتخاب از لیست */}
                  {fld("نام حواله‌گیرنده *", (
                    <div className="relative" ref={receiverListRef}>
                      <input
                        value={form.receiverName}
                        onChange={e => {
                          const val = e.target.value;
                          setField("receiverName", val);
                          setReceiverFilter(val);
                          if (!showReceiverList) setShowReceiverList(true);
                          const customer = customers.find(c => c.name === val);
                          if (customer) {
                            setField("receiverTazkira", customer.tazkira || "");
                            setField("receiverPhone", customer.phone || "");
                            setField("receiverAddress", customer.address || "");
                          } else {
                            setField("receiverTazkira", "");
                            setField("receiverPhone", "");
                            setField("receiverAddress", "");
                          }
                        }}
                        onFocus={() => { if (!showReceiverList) setShowReceiverList(true); }}
                        placeholder="انتخاب از لیست یا نوشتن نام جدید…"
                        className={`${uiInput} pl-12 ${errors.receiverName ? errInput : ""}`}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setShowReceiverList(!showReceiverList); }}
                        className={`absolute left-2 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-lg transition ${dk ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}
                      >
                        <Ic n="chevron" className={`h-4 w-4 transition-transform ${showReceiverList ? "rotate-180" : ""}`} />
                      </button>

                      {showReceiverList && (
                        <div className={`hw-menu absolute left-0 top-full z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border shadow-xl ${dk ? "border-slate-600 bg-slate-800" : "border-slate-200 bg-white"}`}>
                          {filteredReceiverList.length === 0 ? (
                            <div className={`px-4 py-3 text-xs text-center ${subText}`}>مشتری‌ای یافت نشد</div>
                          ) : (
                            filteredReceiverList.map((c, idx) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setField("receiverName", c.name);
                                  setField("receiverTazkira", c.tazkira || "");
                                  setField("receiverPhone", c.phone || "");
                                  setField("receiverAddress", c.address || "");
                                  setReceiverFilter("");
                                  setShowReceiverList(false);
                                }}
                                className={`flex w-full items-center gap-2 px-3 py-2.5 text-right text-xs font-bold transition ${dk ? "text-slate-200 hover:bg-amber-400/15 hover:text-amber-300" : "text-slate-700 hover:bg-amber-50 hover:text-amber-600"}`}
                              >
                                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-black text-white bg-gradient-to-br from-amber-500 to-orange-500`}>
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
                  {fld("شماره تذکره *", (<input className={`${uiInput} ${errors.receiverTazkira ? errInput : ""}`} value={form.receiverTazkira} onChange={e => setField("receiverTazkira", e.target.value)} placeholder="شماره تذکره" />))}
                  {fld("شماره تماس *", (<input className={`${uiInput} ${errors.receiverPhone ? errInput : ""}`} value={form.receiverPhone} onChange={e => setField("receiverPhone", e.target.value)} placeholder="07xxxxxxxx" />))}
                  {fld("آدرس", (<input className={`${uiInput} sm:col-span-2 lg:col-span-3`} value={form.receiverAddress} onChange={e => setField("receiverAddress", e.target.value)} placeholder="اختیاری" />))}
                </div>
              </div>

              <div className={`rounded-2xl border p-4 ${dk ? "border-slate-600 bg-slate-900/50" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-center gap-2.5 mb-4"><span className={`grid h-9 w-9 place-items-center rounded-xl ${dk ? "bg-slate-400/15 text-slate-300" : "bg-slate-100 text-slate-600"}`}><Ic n="info" className="h-4 w-4" /></span><b className={`text-sm font-black ${dk ? "text-slate-300" : "text-slate-700"}`}>یادداشت</b></div>
                <textarea rows={4} value={form.note} onChange={e => setField("note", e.target.value)} placeholder="یادداشت اختیاری..." className={`${uiInput} h-auto py-3 resize-none`} />
              </div>

              {errBox(errorList)}

              <div className="flex flex-wrap gap-3">
                <button onClick={handleRegisterClick} className={`group flex h-[50px] md:h-[52px] flex-1 min-w-[200px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-l text-base font-black shadow-lg transition-all duration-300 hover:shadow-xl hover:brightness-110 active:scale-[0.985] ${dk ? "from-blue-400 to-cyan-400 text-slate-950" : "from-blue-500 via-cyan-500 to-emerald-500 text-white"}`}>
                  ثبت حواله
                  <Ic n="arrowLeft" className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
                </button>
                <button onClick={resetForm} className={`flex h-[50px] md:h-[52px] px-6 cursor-pointer items-center justify-center gap-2 rounded-xl border text-sm font-bold transition-all active:scale-95 ${dk ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>پاک کردن فورم</button>
              </div>
            </section>
          )}

          {activeTab === "current" && (
            <section className={`hw-up overflow-hidden ${uiCard}`}>
              <div className="flex flex-wrap items-center gap-3 p-4 md:p-5 pb-3 md:pb-4 md:px-7 md:pt-6">
                <span className={`grid h-10 w-10 md:h-11 md:w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${identHwIcon}`}><Ic n="clock" className="h-5 w-5" /></span>
                <div className="flex-1 min-w-0">
                  <h2 className={`hw-display text-xl md:text-2xl leading-none ${heading}`}>حواله‌های جاری</h2>
                  <p className={`mt-1 text-[11px] font-bold ${subText}`}>حواله‌های در انتظار و ارسال‌شده</p>
                </div>
              </div>
              <div className="px-4 md:px-7 pb-4 space-y-4">
                <div className="flex flex-wrap gap-3">
                  <input value={nameSearch} onChange={e => setNameSearch(e.target.value)} placeholder="نام، کد پیگیری، تلفن یا تذکره…" className={`${uiInput} flex-1 min-w-[200px]`} />
                  <input value={amountSearch} onChange={e => setAmountSearch(e.target.value)} placeholder="جستجو بر اساس مبلغ…" inputMode="numeric" className={`${uiInput} flex-1 min-w-[150px]`} />
                  <select value={sortOrder} onChange={e => setSortOrder(e.target.value as "asc" | "desc")} className={`${uiInput} w-auto min-w-[180px] cursor-pointer appearance-none pl-9`}>
                    <option value="desc">جدیدترین شماره</option>
                    <option value="asc">قدیمی‌ترین شماره</option>
                  </select>
                </div>
                {currentHawalas.length === 0 ? (
                  <div className={`flex flex-col items-center gap-3 px-6 py-12 ${dk ? "text-slate-500" : "text-slate-400"}`}>
                    <span className={`grid h-14 w-14 place-items-center rounded-2xl border border-dashed ${dk ? "border-slate-600 bg-slate-800/40" : "border-slate-300 bg-slate-50"}`}><Ic n="inbox" className="h-6 w-6 opacity-70" /></span>
                    <p className="text-sm font-black text-center">هیچ حواله جاری وجود ندارد.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1000px] text-sm">
                      <thead>
                        <tr className={`border-y ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
                          {["شماره", "کد پیگیری", "تاریخ", "حواله‌دهنده", "حواله‌گیرنده", "مبلغ نهایی", "کارمزد", "پرداخت‌کننده", "مقصد", "وضعیت", "عملیات"].map((h, i) => (
                            <th key={h} className={`px-4 py-3 text-right text-[11px] font-black text-slate-400 ${i === 0 ? "md:px-7" : ""} ${i === 10 ? "md:px-7" : ""}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${dk ? "divide-slate-700/60" : "divide-slate-100"}`}>
                        {currentHawalas.map((item, index) => (
                          <tr key={item.id} className={`transition-colors ${dk ? "hover:bg-slate-700/30" : "hover:bg-blue-50/70"}`}>
                            <td className="px-4 py-3.5 md:px-7"><span className={`grid h-8 w-8 place-items-center rounded-lg text-[11px] font-black tabular-nums ${dk ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"}`}>{index + 1}</span></td>
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[12px] font-black tabular-nums ${dk ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300" : "border-sky-300 bg-sky-50 text-sky-700"}`} dir="ltr">
                                <Ic n="tag" className="h-3 w-3" />{item.number}
                              </span>
                            </td>
                            <td className={`whitespace-nowrap px-4 py-3.5 text-xs tabular-nums ${dk ? "text-slate-400" : "text-slate-500"}`}><span dir="ltr">{dateLabel(item.date)}</span></td>
                            <td className={`px-4 py-3.5 text-[13px] font-bold ${dk ? "text-slate-200" : "text-slate-700"}`}>{item.senderName}</td>
                            <td className={`px-4 py-3.5 text-[13px] font-bold ${dk ? "text-slate-200" : "text-slate-700"}`}>{item.receiverName}</td>
                            <td className="px-4 py-3.5"><div className="text-[13px] font-black tabular-nums">{fmt(item.finalAmount)}</div><div className={`text-[10px] font-bold ${subText}`}>{labels[item.currencyTo]}</div></td>
                            <td className="px-4 py-3.5 text-xs font-bold tabular-nums">{fmt(item.fee)} {labels[item.feeCurrency]}</td>
                            <td className="px-4 py-3.5"><span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-black ${item.feePayer === "sender" ? dk ? "bg-sky-400/15 text-sky-300" : "bg-sky-100 text-sky-700" : dk ? "bg-amber-400/15 text-amber-300" : "bg-amber-100 text-amber-700"}`}>{item.feePayer === "sender" ? "از فرستنده" : "از گیرنده"}</span></td>
                            <td className={`px-4 py-3.5 text-xs ${subText}`}>{item.destinationText}</td>
                            <td className="px-4 py-3.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${statusColors[item.status][dk ? "dark" : "light"]}`}>{statusLabels[item.status]}</span></td>
                            <td className="px-4 py-3.5 md:px-7"><ActionMenu item={item} isInHistory={false} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === "history" && (
            <section className={`hw-up overflow-hidden ${uiCard}`}>
              <div className="flex flex-wrap items-center gap-3 p-4 md:p-5 pb-3 md:pb-4 md:px-7 md:pt-6">
                <span className={`grid h-10 w-10 md:h-11 md:w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${identHwIcon}`}><Ic n="doc" className="h-5 w-5" /></span>
                <div className="flex-1 min-w-0">
                  <h2 className={`hw-display text-xl md:text-2xl leading-none ${heading}`}>تاریخچه حواله‌ها</h2>
                  <p className={`mt-1 text-[11px] font-bold ${subText}`}>حواله‌های پرداخت‌شده و ابطال‌شده</p>
                </div>
              </div>
              <div className="px-4 md:px-7 pb-4 space-y-4">
                <div className="flex flex-wrap gap-3">
                  <input value={nameSearch} onChange={e => setNameSearch(e.target.value)} placeholder="نام، کد پیگیری، تلفن یا تذکره…" className={`${uiInput} flex-1 min-w-[200px]`} />
                  <input value={amountSearch} onChange={e => setAmountSearch(e.target.value)} placeholder="جستجو بر اساس مبلغ…" inputMode="numeric" className={`${uiInput} flex-1 min-w-[150px]`} />
                  <select value={sortOrder} onChange={e => setSortOrder(e.target.value as "asc" | "desc")} className={`${uiInput} w-auto min-w-[180px] cursor-pointer appearance-none pl-9`}>
                    <option value="desc">جدیدترین شماره</option>
                    <option value="asc">قدیمی‌ترین شماره</option>
                  </select>
                </div>
                {historyHawalas.length === 0 ? (
                  <div className={`flex flex-col items-center gap-3 px-6 py-12 ${dk ? "text-slate-500" : "text-slate-400"}`}>
                    <span className={`grid h-14 w-14 place-items-center rounded-2xl border border-dashed ${dk ? "border-slate-600 bg-slate-800/40" : "border-slate-300 bg-slate-50"}`}><Ic n="inbox" className="h-6 w-6 opacity-70" /></span>
                    <p className="text-sm font-black text-center">هیچ حواله‌ای در تاریخچه وجود ندارد.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1000px] text-sm">
                      <thead>
                        <tr className={`border-y ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
                          {["شماره", "کد پیگیری", "تاریخ", "حواله‌دهنده", "حواله‌گیرنده", "مبلغ نهایی", "کارمزد", "پرداخت‌کننده", "مقصد", "وضعیت", "عملیات"].map((h, i) => (
                            <th key={h} className={`px-4 py-3 text-right text-[11px] font-black text-slate-400 ${i === 0 ? "md:px-7" : ""} ${i === 10 ? "md:px-7" : ""}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${dk ? "divide-slate-700/60" : "divide-slate-100"}`}>
                        {historyHawalas.map((item, index) => (
                          <tr key={item.id} className={`transition-colors ${dk ? "hover:bg-slate-700/30" : "hover:bg-blue-50/70"}`}>
                            <td className="px-4 py-3.5 md:px-7"><span className={`grid h-8 w-8 place-items-center rounded-lg text-[11px] font-black tabular-nums ${dk ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"}`}>{index + 1}</span></td>
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[12px] font-black tabular-nums ${dk ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300" : "border-sky-300 bg-sky-50 text-sky-700"}`} dir="ltr">
                                <Ic n="tag" className="h-3 w-3" />{item.number}
                              </span>
                            </td>
                            <td className={`whitespace-nowrap px-4 py-3.5 text-xs tabular-nums ${dk ? "text-slate-400" : "text-slate-500"}`}><span dir="ltr">{dateLabel(item.date)}</span></td>
                            <td className={`px-4 py-3.5 text-[13px] font-bold ${dk ? "text-slate-200" : "text-slate-700"}`}>{item.senderName}</td>
                            <td className={`px-4 py-3.5 text-[13px] font-bold ${dk ? "text-slate-200" : "text-slate-700"}`}>{item.receiverName}</td>
                            <td className="px-4 py-3.5"><div className="text-[13px] font-black tabular-nums">{fmt(item.finalAmount)}</div><div className={`text-[10px] font-bold ${subText}`}>{labels[item.currencyTo]}</div></td>
                            <td className="px-4 py-3.5 text-xs font-bold tabular-nums">{fmt(item.fee)} {labels[item.feeCurrency]}</td>
                            <td className="px-4 py-3.5"><span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-black ${item.feePayer === "sender" ? dk ? "bg-sky-400/15 text-sky-300" : "bg-sky-100 text-sky-700" : dk ? "bg-amber-400/15 text-amber-300" : "bg-amber-100 text-amber-700"}`}>{item.feePayer === "sender" ? "از فرستنده" : "از گیرنده"}</span></td>
                            <td className={`px-4 py-3.5 text-xs ${subText}`}>{item.destinationText}</td>
                            <td className="px-4 py-3.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${statusColors[item.status][dk ? "dark" : "light"]}`}>{statusLabels[item.status]}</span></td>
                            <td className="px-4 py-3.5 md:px-7"><ActionMenu item={item} isInHistory={true} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 md:p-4 backdrop-blur-sm" onClick={() => setPreviewOpen(false)}>
          <div className={`hw-up w-full max-w-2xl overflow-hidden rounded-xl md:rounded-2xl border shadow-2xl ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-white"}`} onClick={(e) => e.stopPropagation()}>
            <div className={`flex items-center justify-between border-b px-4 md:px-5 py-3 md:py-4 ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
              <b className={`flex items-center gap-2 text-sm ${dk ? "text-slate-100" : "text-slate-800"}`}>
                <span className={`grid h-8 w-8 place-items-center rounded-lg ${dk ? "bg-blue-400/10 text-blue-300" : "bg-blue-100 text-blue-600"}`}><Ic n="doc" className="h-4 w-4" /></span>
                جزئیات حواله قبل از ثبت
              </b>
              <button onClick={() => setPreviewOpen(false)} className={`grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-slate-400 transition-all duration-300 hover:rotate-90 ${dk ? "hover:bg-slate-700 hover:text-white" : "hover:bg-slate-100 hover:text-slate-700"}`}><Ic n="x" className="h-4 w-4" /></button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-4 md:px-5 py-4 space-y-4">
              <div className={`flex items-center justify-between rounded-xl border p-3 ${dk ? "border-cyan-400/30 bg-cyan-400/10" : "border-sky-300 bg-sky-50"}`}>
                <b className={`text-xs font-black ${dk ? "text-cyan-300" : "text-sky-700"}`}>کد پیگیری</b>
                <span className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-black tabular-nums ${dk ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300" : "border-sky-300 bg-sky-50 text-sky-700"}`} dir="ltr">
                  <Ic n="tag" className="h-3.5 w-3.5" />{nextHawalaNumber}
                </span>
              </div>
              <div className={`rounded-xl border p-4 ${dk ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-center gap-2 mb-3"><span className={`grid h-7 w-7 place-items-center rounded-lg ${dk ? "bg-cyan-400/15 text-cyan-300" : "bg-cyan-100 text-cyan-600"}`}><Ic n="swap" className="h-3.5 w-3.5" /></span><b className={`text-xs font-black ${dk ? "text-cyan-300" : "text-cyan-700"}`}>معلومات حواله</b></div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className={subText}>تاریخ: </span><b>{currentDateTime}</b></div>
                  <div><span className={subText}>نوع: </span><b>{form.type === "send" ? "ارسال" : "دریافت"}</b></div>
                  <div><span className={subText}>مقصد: </span><b>{destinationText}</b></div>
                  <div><span className={subText}>مبلغ: </span><b>{fmt(amountFrom)} {labels[form.currencyFrom]}</b></div>
                  <div><span className={subText}>مبلغ نهایی: </span><b className={dk ? "text-emerald-300" : "text-emerald-700"}>{fmt(finalAmount)} {labels[form.currencyTo]}</b></div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <button onClick={confirmRegister} className={`flex h-[48px] flex-1 min-w-[180px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-l text-sm font-black shadow-lg transition-all hover:brightness-110 active:scale-[0.98] ${dk ? "from-emerald-400 to-teal-400 text-slate-950" : "from-emerald-500 to-teal-500 text-white"}`}>
                  ثبت نهایی حواله<Ic n="check" className="h-4 w-4" />
                </button>
                <button onClick={() => setPreviewOpen(false)} className={`flex h-[48px] px-6 cursor-pointer items-center justify-center rounded-xl border text-sm font-bold transition-all active:scale-95 ${dk ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>انصراف</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {settleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 md:p-4 backdrop-blur-sm" onClick={() => setSettleTarget(null)}>
          <div className={`hw-up w-full max-w-lg overflow-hidden rounded-xl md:rounded-2xl border shadow-2xl ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-white"}`} onClick={(e) => e.stopPropagation()}>
            <div className={`flex items-center justify-between border-b px-4 md:px-5 py-3 md:py-4 ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
              <b className={`text-sm ${dk ? "text-slate-100" : "text-slate-800"}`}>تسویه حواله {settleTarget.number}</b>
              <button onClick={() => setSettleTarget(null)} className={`grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-slate-400 transition-all hover:rotate-90 ${dk ? "hover:bg-slate-700 hover:text-white" : "hover:bg-slate-100 hover:text-slate-700"}`}><Ic n="x" className="h-4 w-4" /></button>
            </div>
            <div className="px-4 md:px-5 py-4 space-y-4">
              <div className={`rounded-xl border p-4 ${dk ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"}`}>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className={subText}>گیرنده: </span><b>{settleTarget.receiverName}</b></div>
                  <div><span className={subText}>مبلغ نهایی: </span><b className={dk ? "text-emerald-300" : "text-emerald-700"}>{fmt(settleTarget.finalAmount)} {labels[settleTarget.currencyTo]}</b></div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className={uiLabel}>نام پرداخت‌کننده</label><input value={paidBy} onChange={e => setPaidBy(e.target.value)} placeholder="مثلاً صندوقکار" className={uiInput} /></div>
                <div><label className={uiLabel}>مبلغ پرداخت‌شده</label><input type="text" inputMode="decimal" dir="ltr" value={paidAmount} onChange={e => setPaidAmount(toNumericText(e.target.value))} className={`${uiInput} text-left tabular-nums`} /></div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button onClick={confirmSettlement} className={`flex h-[48px] flex-1 min-w-[150px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-l text-sm font-black shadow-lg transition-all hover:brightness-110 active:scale-[0.98] ${dk ? "from-emerald-400 to-teal-400 text-slate-950" : "from-emerald-500 to-teal-500 text-white"}`}>
                  تأیید پرداخت<Ic n="check" className="h-4 w-4" />
                </button>
                <button onClick={() => setSettleTarget(null)} className={`flex h-[48px] px-6 cursor-pointer items-center justify-center rounded-xl border text-sm font-bold transition-all active:scale-95 ${dk ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>انصراف</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 md:p-4 backdrop-blur-sm" onClick={() => setCancelTarget(null)}>
          <div className={`hw-up w-full max-w-lg overflow-hidden rounded-xl md:rounded-2xl border shadow-2xl ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-white"}`} onClick={(e) => e.stopPropagation()}>
            <div className={`flex items-center justify-between border-b px-4 md:px-5 py-3 md:py-4 ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
              <b className={`text-sm ${dk ? "text-slate-100" : "text-slate-800"}`}>لغو حواله {cancelTarget.number}</b>
              <button onClick={() => setCancelTarget(null)} className={`grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-slate-400 transition-all hover:rotate-90 ${dk ? "hover:bg-slate-700 hover:text-white" : "hover:bg-slate-100 hover:text-slate-700"}`}><Ic n="x" className="h-4 w-4" /></button>
            </div>
            <div className="px-4 md:px-5 py-4 space-y-4">
              <div><label className={uiLabel}>دلیل لغو حواله</label><textarea rows={4} value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="دلیل لغو را بنویسید..." className={`${uiInput} h-auto py-3 resize-none`} /></div>
              <div className="flex flex-wrap gap-3">
                <button onClick={confirmCancel} className={`flex h-[48px] flex-1 min-w-[150px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-l text-sm font-black shadow-lg transition-all hover:brightness-110 active:scale-[0.98] ${dk ? "from-rose-400 to-red-400 text-slate-950" : "from-rose-500 to-red-500 text-white"}`}>
                  لغو حواله<Ic n="xCircle" className="h-4 w-4" />
                </button>
                <button onClick={() => setCancelTarget(null)} className={`flex h-[48px] px-6 cursor-pointer items-center justify-center rounded-xl border text-sm font-bold transition-all active:scale-95 ${dk ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>انصراف</button>
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
