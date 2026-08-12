"use client";

import { useEffect, useState, useMemo, useCallback, memo, useRef, type ReactNode } from "react";
import {
  getNextTrackingCode,
  consumeTrackingCode,
  initTrackingSystem,
  getTrackingNumberValue,
} from "../lib/trackingCode";

type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";
type CashType = "deposit" | "withdraw";

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

type CashTransaction = {
  id: string;
  trackingCode: string;
  type: CashType;
  date: string;
  customerId?: string;
  customerName: string;
  currency: Currency;
  amount: number;
  description?: string;
  status: "active" | "voided";
};

const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const labels: Record<Currency, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };
const CUSTOMERS_KEY = "fx-customers";
const CASH_KEY = "fx-cash-transactions";

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

const loadCashTransactions = (): CashTransaction[] => {
  if (typeof window === "undefined") return [];
  try {
    const parsed = safeGetItem(CASH_KEY);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t: any) => t?.id && t?.trackingCode).map((t: any): CashTransaction => ({
      id: t.id, trackingCode: t.trackingCode || "", date: t.date || new Date().toISOString(),
      type: t.type === "withdraw" ? "withdraw" : "deposit",
      customerId: t.customerId, customerName: t.customerName || "",
      currency: isCurrency(t.currency) ? t.currency : "AFN",
      amount: Number(t.amount || 0) || 0,
      description: t.description || "",
      status: t.status === "voided" ? "voided" : "active",
    }));
  } catch { return []; }
};

const iconPaths = {
  wallet: "M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3",
  arrowDown: "M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3",
  arrowUp: "M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18",
  plus: "M12 4.5v15m7.5-7.5h-15",
  clock: "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  search: "m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 1 10.607 10.607Z",
  chevron: "m19.5 8.25-7.5 7.5-7.5-7.5",
  x: "M6 18 18 6M6 6l12 12",
  check: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  xCircle: "m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  inbox: "M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z",
  eye: "M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  trash: "M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0",
  sun: "M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z",
  moon: "M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z",
  tag: "M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z",
  arrowLeft: "M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18",
  alert: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z",
};

type IconName = keyof typeof iconPaths;

const Ic = memo(function Ic({ n, className = "h-5 w-5" }: { n: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={iconPaths[n]} />
    </svg>
  );
});

export default function CashBoxPage() {
  const [mounted, setMounted] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>(defaultCustomers);
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [cashType, setCashType] = useState<CashType>("deposit");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedCustomerName, setSelectedCustomerName] = useState("");
  const [currency, setCurrency] = useState<Currency>("AFN");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<{ customer?: string; amount?: string }>({});
  const [toast, setToast] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | CashType>("all");
  const [currencyFilter, setCurrencyFilter] = useState<Currency | "all">("all");

  const [showCustomerList, setShowCustomerList] = useState(false);
  const [customerFilter, setCustomerFilter] = useState("");
  const customerListRef = useRef<HTMLDivElement>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<CashTransaction | null>(null);

  useEffect(() => {
    try { const saved = window.localStorage.getItem("fx-theme"); if (saved === "dark" || saved === "light") setTheme(saved); } catch {}
  }, []);
  useEffect(() => { try { window.localStorage.setItem("fx-theme", theme); } catch {} }, [theme]);
  const dk = theme === "dark";

  useEffect(() => {
    try {
      setCustomers(loadCustomers());
      setCashTransactions(loadCashTransactions());
      initTrackingSystem();
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

  useEffect(() => { try { localStorage.setItem(CASH_KEY, JSON.stringify(cashTransactions)); } catch {} }, [cashTransactions]);

  useEffect(() => {
    if (!showCustomerList) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (customerListRef.current && !customerListRef.current.contains(t)) setShowCustomerList(false);
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handler); };
  }, [showCustomerList]);

  const filteredCustomerList = useMemo(() => {
    if (!customerFilter) return customers;
    const q = normalizeDigits(customerFilter.trim()).toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(q) || (c.phone && normalizeDigits(c.phone).includes(q)));
  }, [customers, customerFilter]);

  const selectedCustomer = useMemo(() => customers.find(c => c.id === selectedCustomerId) || null, [customers, selectedCustomerId]);

  const amountValue = parseAmount(amount);
  const nextCode = getNextTrackingCode();

  const totalCount = cashTransactions.length;
  const depositCount = cashTransactions.filter(t => t.type === "deposit" && t.status === "active").length;
  const withdrawCount = cashTransactions.filter(t => t.type === "withdraw" && t.status === "active").length;
  const voidedCount = cashTransactions.filter(t => t.status === "voided").length;

  const matchesSearch = (item: CashTransaction, query: string) => {
    const q = normalizeDigits(query).trim().toLowerCase();
    if (!q) return true;
    const fields = [item.customerName, item.trackingCode, item.description || ""];
    return fields.some(f => f && normalizeDigits(String(f)).toLowerCase().includes(q));
  };

  const filteredTransactions = useMemo(() => {
    try {
      let filtered = [...cashTransactions];
      if (typeFilter !== "all") filtered = filtered.filter(t => t.type === typeFilter);
      if (currencyFilter !== "all") filtered = filtered.filter(t => t.currency === currencyFilter);
      if (search) filtered = filtered.filter(t => matchesSearch(t, search));
      return filtered.sort((a, b) => getTrackingNumberValue(b.trackingCode) - getTrackingNumberValue(a.trackingCode));
    } catch { return []; }
  }, [cashTransactions, search, typeFilter, currencyFilter]);

  const showToast = useCallback((message: string) => { setToast(message); setTimeout(() => setToast(""), 3500); }, []);

  const validateForm = useCallback(() => {
    const errs: { customer?: string; amount?: string } = {};
    if (!selectedCustomerName.trim()) errs.customer = "مشتری را انتخاب کنید.";
    if (!amount.trim() || amountValue <= 0) errs.amount = "مبلغ ضروری است.";
    return errs;
  }, [selectedCustomerName, amount, amountValue]);

  const handleSubmit = useCallback(() => {
    const errs = validateForm();
    setErrors(errs);
    if (Object.keys(errs).length > 0) { showToast("لطفاً فیلدهای ضروری را تکمیل کنید."); return; }

    const customer = customers.find(c => c.id === selectedCustomerId || c.name === selectedCustomerName.trim());
    const tx: CashTransaction = {
      id: generateId(),
      trackingCode: nextCode,
      type: cashType,
      date: new Date().toISOString(),
      customerId: customer?.id,
      customerName: customer?.name || selectedCustomerName.trim(),
      currency,
      amount: amountValue,
      description: description.trim(),
      status: "active",
    };
    setPreviewData(tx);
    setPreviewOpen(true);
  }, [validateForm, customers, selectedCustomerId, selectedCustomerName, cashType, currency, amountValue, description, nextCode, showToast]);

  const confirmRegister = useCallback(() => {
    if (!previewData) return;
    const tx = { ...previewData, trackingCode: consumeTrackingCode() };
    setCashTransactions(prev => [tx, ...prev]);
    setSelectedCustomerId("");
    setSelectedCustomerName("");
    setAmount("");
    setDescription("");
    setErrors({});
    setPreviewOpen(false);
    setPreviewData(null);
    setActiveTab("history");
    showToast(cashType === "deposit" ? "واریز با موفقیت ثبت شد." : "برداشت با موفقیت ثبت شد.");
  }, [previewData, cashType, showToast]);

  const voidTransaction = useCallback((tx: CashTransaction) => {
    if (tx.status === "voided") return;
    if (!window.confirm(`آیا از لغو تراکنش ${tx.trackingCode} مطمئن هستید؟`)) return;
    setCashTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, status: "voided" } : t));
    showToast("تراکنش لغو شد.");
  }, [showToast]);

  const deleteTransaction = useCallback((tx: CashTransaction) => {
    if (!window.confirm(`آیا از حذف تراکنش ${tx.trackingCode} مطمئن هستید؟\n\nاین عملیات قابل بازگشت نیست.`)) return;
    setCashTransactions(prev => prev.filter(t => t.id !== tx.id));
    showToast("تراکنش حذف شد.");
  }, [showToast]);

  const resetForm = useCallback(() => {
    setSelectedCustomerId("");
    setSelectedCustomerName("");
    setAmount("");
    setDescription("");
    setErrors({});
    showToast("فورم پاک شد.");
  }, [showToast]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-amber-500" />
          <p className="mt-4 text-slate-500">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  const heading = dk ? "text-white" : "text-slate-900";
  const subText = dk ? "text-slate-500" : "text-slate-400";
  const glassChip = dk ? "border-slate-600/70 bg-slate-800/80" : "border-amber-100 bg-white/85";
  const uiCard = `rounded-2xl border backdrop-blur transition-colors duration-300 ${dk ? "border-slate-700 bg-slate-800/90 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.6)]" : "border-amber-100 bg-white/95 shadow-[0_16px_40px_-28px_rgba(245,158,11,0.35)]"}`;
  const inputShell = `rounded-xl border text-sm font-medium shadow-sm outline-none transition-all duration-200 focus:ring-4 ${dk ? "border-slate-600 bg-slate-900 text-slate-100 placeholder:text-slate-500 hover:border-slate-500 focus:border-amber-400 focus:ring-amber-400/10" : "border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 hover:border-amber-400 focus:border-amber-500 focus:ring-amber-500/10"}`;
  const uiInput = `h-12 w-full px-3.5 ${inputShell}`;
  const errInput = dk ? "border-rose-400/70" : "border-rose-400";
  const roInput = dk ? "cursor-default bg-slate-800/70 text-slate-400" : "cursor-default bg-slate-100 text-slate-500";
  const uiLabel = `mb-1.5 block text-[11px] font-black tracking-wide ${dk ? "text-slate-400" : "text-slate-500"}`;
  const chevPos = `pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${dk ? "text-slate-500" : "text-slate-400"}`;
  const identIcon = dk ? "from-amber-400/20 to-amber-400/5 text-amber-300 ring-amber-400/25" : "from-amber-400/20 to-orange-400/10 text-amber-600 ring-amber-400/30";

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

  const ActionButtons = memo(function ActionButtons({ tx }: { tx: CashTransaction }) {
    const isVoided = tx.status === "voided";
    const btn = "grid h-8 w-8 place-items-center rounded-lg border transition-all duration-150 active:scale-90 cursor-pointer";
    return (
      <div className="flex items-center gap-1.5">
        <button title="مشاهده" onClick={() => showToast(`تراکنش ${tx.trackingCode} - ${tx.customerName}`)} className={`${btn} ${dk ? "border-cyan-400/30 text-cyan-300 hover:bg-cyan-400/15" : "border-cyan-200 text-cyan-600 hover:bg-cyan-50"}`}>
          <Ic n="eye" className="h-3.5 w-3.5" />
        </button>
        {!isVoided && (
          <button title="لغو" onClick={() => voidTransaction(tx)} className={`${btn} ${dk ? "border-amber-400/30 text-amber-300 hover:bg-amber-400/15" : "border-amber-200 text-amber-600 hover:bg-amber-50"}`}>
            <Ic n="xCircle" className="h-3.5 w-3.5" />
          </button>
        )}
        <button title="حذف" onClick={() => deleteTransaction(tx)} className={`${btn} ${dk ? "border-rose-400/30 text-rose-300 hover:bg-rose-400/15" : "border-rose-200 text-rose-500 hover:bg-rose-50"}`}>
          <Ic n="trash" className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  });

  const errorList = Object.values(errors).filter((msg): msg is string => Boolean(msg));

  const tabs = [
    { id: "new" as const, label: "ثبت تراکنش جدید", icon: "plus" as IconName },
    { id: "history" as const, label: "تاریخچه صندوق", icon: "clock" as IconName, count: cashTransactions.length },
  ];

  return (
    <div dir="rtl" className={dk ? "dark" : ""}>
      <style>{`@import url("https://fonts.googleapis.com/css2?family=Lalezar&family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap");.cb-font{font-family:"Vazirmatn","Segoe UI",Tahoma,sans-serif}.cb-display{font-family:"Lalezar","Vazirmatn",Tahoma,sans-serif;letter-spacing:.01em}.dark{color-scheme:dark}@keyframes cbUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}.cb-up{animation:cbUp .5s cubic-bezier(.22,.8,.35,1) both}::selection{background:rgba(245,158,11,.25)}`}</style>

      <div className={`cb-font relative min-h-screen overflow-x-hidden antialiased transition-colors duration-500 ${dk ? "bg-[#0f172a] text-slate-100" : "bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 text-slate-800"}`}>
        <div className={`fixed inset-x-0 top-0 z-30 h-1 bg-gradient-to-l ${dk ? "from-amber-400 via-orange-400 to-yellow-400" : "from-amber-500 via-orange-500 to-yellow-500"}`} />
        <div className="relative z-10 mx-auto w-full max-w-7xl space-y-4 md:space-y-6 px-3 pb-16 pt-5 md:px-8 md:pt-9">
          <header className="cb-up flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0">
              <div className="relative grid h-11 w-11 md:h-14 md:w-14 shrink-0 place-items-center rounded-xl md:rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-400 text-white shadow-lg shadow-amber-500/30 ring-1 ring-white/30">
                <Ic n="wallet" className="h-5 w-5 md:h-6 md:w-6" />
                <span className={`absolute -bottom-1 -left-1 md:-bottom-1.5 md:-left-1.5 grid h-4 min-w-4 md:h-5 md:min-w-5 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-400 px-1 text-[7px] md:text-[8px] font-black text-white ring-2 ${dk ? "ring-[#0f172a]" : "ring-[#fffbeb]"}`}>CB</span>
              </div>
              <div className="min-w-0">
                <h1 className={`cb-display text-2xl md:text-4xl leading-none ${heading}`}>صندوق مالی</h1>
                <p className={`mt-1 text-[10px] md:text-xs font-bold ${subText}`}>مدیریت واریز و برداشت نقدی</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2.5">
              <div className={`hidden sm:flex items-center gap-2 rounded-xl border px-3 py-2 shadow-sm backdrop-blur ${glassChip}`}>
                <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-70" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" /></span>
                <span dir="ltr" className={`text-xs font-bold tabular-nums ${dk ? "text-slate-100" : "text-slate-700"}`}>{currentDateTime || "--:--"}</span>
              </div>
              <button onClick={() => setTheme(dk ? "light" : "dark")} className={`group grid h-10 w-10 md:h-11 md:w-11 cursor-pointer place-items-center rounded-lg md:rounded-xl border shadow-sm backdrop-blur transition-all duration-300 active:scale-90 ${dk ? "border-slate-600 bg-slate-800/85 text-amber-300 hover:border-amber-300" : "border-slate-200 bg-white/85 text-slate-600 hover:border-amber-400"}`}>
                {dk ? <Ic n="sun" className="h-4 w-4 transition-transform duration-500 group-hover:rotate-45" /> : <Ic n="moon" className="h-4 w-4 transition-transform duration-500 group-hover:-rotate-12" />}
              </button>
            </div>
          </header>

          <div className="cb-up grid grid-cols-2 md:grid-cols-4 gap-3" style={{ animationDelay: "70ms" }}>
            {[
              { label: "کل تراکنش‌ها", value: totalCount, color: dk ? "text-amber-300" : "text-amber-600" },
              { label: "واریزها", value: depositCount, color: dk ? "text-emerald-300" : "text-emerald-600" },
              { label: "برداشت‌ها", value: withdrawCount, color: dk ? "text-rose-300" : "text-rose-600" },
              { label: "لغوشده", value: voidedCount, color: dk ? "text-slate-400" : "text-slate-500" },
            ].map((stat, i) => (
              <div key={i} className={`rounded-xl border p-3 text-center ${dk ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-white"}`}>
                <div className={`text-xl font-black tabular-nums ${stat.color}`}>{stat.value}</div>
                <div className={`text-[10px] font-bold mt-1 ${subText}`}>{stat.label}</div>
              </div>
            ))}
          </div>

          <div className={`cb-up flex gap-1.5 md:gap-2 rounded-xl md:rounded-2xl border p-1.5 md:p-2 shadow-sm backdrop-blur ${glassChip}`} style={{ animationDelay: "140ms" }}>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 md:gap-2 rounded-lg md:rounded-xl px-3 md:px-5 py-2.5 md:py-3 text-xs md:text-sm font-black transition-all duration-300 active:scale-[0.97] ${activeTab === tab.id ? `bg-gradient-to-l shadow-lg ${dk ? "from-amber-400 to-orange-400 text-slate-950" : "from-amber-500 via-orange-500 to-yellow-500 text-white"}` : dk ? "text-slate-400 hover:bg-slate-700/60 hover:text-slate-100" : "text-slate-500 hover:bg-amber-50 hover:text-slate-800"}`}>
                <Ic n={tab.icon} className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${activeTab === tab.id ? dk ? "bg-slate-950/20 text-slate-950" : "bg-white/30 text-white" : dk ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"}`}>{tab.count}</span>}
              </button>
            ))}
          </div>

          {activeTab === "new" && (
            <section className={`cb-up space-y-4 md:space-y-5 p-4 md:p-7 ${uiCard}`}>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${identIcon}`}><Ic n="wallet" className="h-5 w-5" /></span>
                <div className="flex-1 min-w-0">
                  <h2 className={`cb-display text-xl md:text-2xl leading-none ${heading}`}>ثبت تراکنش صندوق</h2>
                  <p className={`mt-1 text-[11px] font-bold ${subText}`}>واریز یا برداشت نقدی به/از حساب مشتری</p>
                </div>
              </div>

              <div className={`rounded-2xl border p-4 ${dk ? "border-slate-600 bg-slate-900/50" : "border-slate-200 bg-slate-50"}`}>
                <div className="grid gap-3 md:gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-4">
                  {fld("نوع تراکنش *", (
                    <div className={`flex rounded-xl border p-1 ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-white"}`}>
                      <button type="button" onClick={() => setCashType("deposit")} className={`flex-1 rounded-lg px-3 py-2 text-xs font-black transition-all ${cashType === "deposit" ? dk ? "bg-emerald-400 text-slate-950 shadow" : "bg-emerald-500 text-white shadow" : dk ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-700"}`}>
                        <span className="flex items-center justify-center gap-1"><Ic n="arrowDown" className="h-3.5 w-3.5" />واریز</span>
                      </button>
                      <button type="button" onClick={() => setCashType("withdraw")} className={`flex-1 rounded-lg px-3 py-2 text-xs font-black transition-all ${cashType === "withdraw" ? dk ? "bg-rose-400 text-slate-950 shadow" : "bg-rose-500 text-white shadow" : dk ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-700"}`}>
                        <span className="flex items-center justify-center gap-1"><Ic n="arrowUp" className="h-3.5 w-3.5" />برداشت</span>
                      </button>
                    </div>
                  ))}
                  {fld("کد پیگیری", (
                    <div className="relative">
                      <input readOnly dir="ltr" value={nextCode} className={`${uiInput} ${roInput} pl-16 text-left tabular-nums font-black text-[14px]`} />
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-1 text-[9px] font-black text-white">TR</span>
                    </div>
                  ))}
                  {fld("تاریخ (شمسی)", (<input readOnly value={currentDateTime} className={`${uiInput} ${roInput}`} />))}
                </div>

                <div className="grid gap-3 md:gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-4">
                  {fld("مشتری *", (
                    <div className="relative" ref={customerListRef}>
                      <input
                        value={selectedCustomerName}
                        onChange={e => {
                          const val = e.target.value;
                          setSelectedCustomerName(val);
                          setCustomerFilter(val);
                          if (!showCustomerList) setShowCustomerList(true);
                          const customer = customers.find(c => c.name === val);
                          if (customer) setSelectedCustomerId(customer.id);
                          else setSelectedCustomerId("");
                          setErrors(prev => ({ ...prev, customer: undefined }));
                        }}
                        placeholder="انتخاب از لیست یا نوشتن نام جدید…"
                        className={`${uiInput} pl-12 ${errors.customer ? errInput : ""}`}
                        autoComplete="off"
                      />
                      <button type="button" onClick={(e) => { e.stopPropagation(); setShowCustomerList(!showCustomerList); }} className={`absolute left-2 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-lg transition ${dk ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}>
                        <Ic n="chevron" className={`h-4 w-4 transition-transform ${showCustomerList ? "rotate-180" : ""}`} />
                      </button>
                      {showCustomerList && (
                        <div className={`absolute left-0 top-full z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border shadow-xl ${dk ? "border-slate-600 bg-slate-800" : "border-slate-200 bg-white"}`}>
                          {filteredCustomerList.length === 0 ? (
                            <div className={`px-4 py-3 text-xs text-center ${subText}`}>مشتری‌ای یافت نشد</div>
                          ) : (
                            filteredCustomerList.map((c, idx) => (
                              <button key={c.id} type="button" onClick={() => { setSelectedCustomerId(c.id); setSelectedCustomerName(c.name); setCustomerFilter(""); setShowCustomerList(false); setErrors(prev => ({ ...prev, customer: undefined })); }} className={`flex w-full items-center gap-2 px-3 py-2.5 text-right text-xs font-bold transition ${dk ? "text-slate-200 hover:bg-amber-400/15 hover:text-amber-300" : "text-slate-700 hover:bg-amber-50 hover:text-amber-600"}`}>
                                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-black text-white bg-gradient-to-br from-amber-500 to-orange-500`}>{idx + 1}</span>
                                <span className="flex-1 truncate">{c.name}</span>
                                {c.phone && <span className={`text-[10px] ${subText}`} dir="ltr">{c.phone}</span>}
                              </button>
                            ))
                          )}
                          <div className={`h-px ${dk ? "bg-slate-700" : "bg-slate-100"}`} />
                          <div className={`px-3 py-2 text-[10px] text-center ${subText}`}>یا نام جدید بنویسید (خودکار ثبت می‌شود)</div>
                        </div>
                      )}
                    </div>
                  ))}
                  {fld("ارز *", sel(currency, (v) => setCurrency(v as Currency), currencies.map(c => [c, labels[c]])))}
                  {fld("مبلغ *", (<input type="text" inputMode="decimal" dir="ltr" className={`${uiInput} text-left tabular-nums ${errors.amount ? errInput : ""}`} value={amount} onChange={e => { setAmount(toNumericText(e.target.value)); setErrors(prev => ({ ...prev, amount: undefined })); }} placeholder="مثلاً 10000" />))}
                </div>

                <div className="grid gap-3 md:gap-4">
                  {fld("توضیحات", (<input className={uiInput} value={description} onChange={e => setDescription(e.target.value)} placeholder="توضیحات اختیاری..." />))}
                </div>
              </div>

              {selectedCustomer && (
                <div className={`rounded-xl border p-3 ${dk ? "border-amber-400/30 bg-amber-400/10" : "border-amber-200 bg-amber-50"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Ic n="wallet" className={`h-4 w-4 ${dk ? "text-amber-300" : "text-amber-600"}`} />
                    <b className={`text-xs font-black ${dk ? "text-amber-300" : "text-amber-700"}`}>موجودی حساب {selectedCustomer.name}</b>
                    {selectedCustomer.telegram && <span className={`text-[10px] ${subText}`} dir="ltr">💬 {selectedCustomer.telegram}</span>}
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-2 text-[10px] font-bold">
                    {currencies.map(cur => (
                      <div key={cur} className={`rounded-lg px-2 py-1.5 ${dk ? "bg-slate-900/50" : "bg-white"}`}>
                        <div className={subText}>{labels[cur]}</div>
                        <div className={`font-black tabular-nums ${dk ? "text-slate-200" : "text-slate-700"}`}>{fmt(selectedCustomer.balances[cur] || 0)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {errBox(errorList)}

              <div className="flex flex-wrap gap-3">
                <button onClick={handleSubmit} className={`group flex h-[50px] md:h-[52px] flex-1 min-w-[200px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-l text-base font-black shadow-lg transition-all duration-300 hover:shadow-xl hover:brightness-110 active:scale-[0.985] ${dk ? "from-amber-400 to-orange-400 text-slate-950" : "from-amber-500 via-orange-500 to-yellow-500 text-white"}`}>
                  {cashType === "deposit" ? "ثبت واریز" : "ثبت برداشت"}
                  <Ic n="arrowLeft" className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
                </button>
                <button onClick={resetForm} className={`flex h-[50px] md:h-[52px] px-6 cursor-pointer items-center justify-center gap-2 rounded-xl border text-sm font-bold transition-all active:scale-95 ${dk ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>پاک کردن فورم</button>
              </div>
            </section>
          )}

          {activeTab === "history" && (
            <section className={`cb-up overflow-hidden ${uiCard}`}>
              <div className="flex flex-wrap items-center gap-3 p-4 md:p-5 pb-3 md:pb-4 md:px-7 md:pt-6">
                <span className={`grid h-10 w-10 md:h-11 md:w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${identIcon}`}><Ic n="clock" className="h-5 w-5" /></span>
                <div className="flex-1 min-w-0">
                  <h2 className={`cb-display text-xl md:text-2xl leading-none ${heading}`}>تاریخچه صندوق</h2>
                  <p className={`mt-1 text-[11px] font-bold ${subText}`}>تمام تراکنش‌های واریز و برداشت</p>
                </div>
              </div>
              <div className="px-4 md:px-7 pb-4 space-y-4">
                <div className="flex flex-wrap gap-3">
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو بر اساس نام، کد پیگیری یا توضیحات…" className={`${uiInput} flex-1 min-w-[200px]`} />
                  <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className={`${uiInput} w-auto min-w-[140px] cursor-pointer appearance-none pl-9`}>
                    <option value="all">همه انواع</option>
                    <option value="deposit">واریز</option>
                    <option value="withdraw">برداشت</option>
                  </select>
                  <select value={currencyFilter} onChange={e => setCurrencyFilter(e.target.value as any)} className={`${uiInput} w-auto min-w-[120px] cursor-pointer appearance-none pl-9`}>
                    <option value="all">همه ارزها</option>
                    {currencies.map(c => <option key={c} value={c}>{labels[c]}</option>)}
                  </select>
                </div>

                {filteredTransactions.length === 0 ? (
                  <div className={`flex flex-col items-center gap-3 px-6 py-12 ${dk ? "text-slate-500" : "text-slate-400"}`}>
                    <span className={`grid h-14 w-14 place-items-center rounded-2xl border border-dashed ${dk ? "border-slate-600 bg-slate-800/40" : "border-slate-300 bg-slate-50"}`}><Ic n="inbox" className="h-6 w-6 opacity-70" /></span>
                    <p className="text-sm font-black text-center">هیچ تراکنشی در صندوق وجود ندارد.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-sm">
                      <thead>
                        <tr className={`border-y ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
                          {["شماره", "کد پیگیری", "تاریخ", "مشتری", "نوع", "ارز", "مبلغ", "توضیحات", "وضعیت", "عملیات"].map(h => (
                            <th key={h} className="px-4 py-3 text-right text-[11px] font-black text-slate-400">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${dk ? "divide-slate-700/60" : "divide-slate-100"}`}>
                        {filteredTransactions.map((item, index) => (
                          <tr key={item.id} className={`transition-colors ${dk ? "hover:bg-slate-700/30" : "hover:bg-amber-50/70"} ${item.status === "voided" ? (dk ? "opacity-50" : "opacity-60") : ""}`}>
                            <td className="px-4 py-3.5"><span className={`grid h-8 w-8 place-items-center rounded-lg text-[11px] font-black tabular-nums ${dk ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"}`}>{index + 1}</span></td>
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-black tabular-nums ${dk ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300" : "border-sky-300 bg-sky-50 text-sky-700"}`} dir="ltr">
                                <Ic n="tag" className="h-3 w-3" />{item.trackingCode}
                              </span>
                            </td>
                            <td className={`whitespace-nowrap px-4 py-3.5 text-xs tabular-nums ${dk ? "text-slate-400" : "text-slate-500"}`}><span dir="ltr">{dateLabel(item.date)}</span></td>
                            <td className={`px-4 py-3.5 text-[13px] font-bold ${dk ? "text-slate-200" : "text-slate-700"}`}>{item.customerName}</td>
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black ${item.type === "deposit" ? dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-700" : dk ? "bg-rose-400/15 text-rose-300" : "bg-rose-100 text-rose-700"}`}>
                                <Ic n={item.type === "deposit" ? "arrowDown" : "arrowUp"} className="h-3 w-3" />
                                {item.type === "deposit" ? "واریز" : "برداشت"}
                              </span>
                            </td>
                            <td className={`px-4 py-3.5 text-xs font-bold ${dk ? "text-slate-300" : "text-slate-600"}`}>{labels[item.currency]}</td>
                            <td className="px-4 py-3.5">
                              <div className={`text-[13px] font-black tabular-nums ${item.type === "deposit" ? (dk ? "text-emerald-300" : "text-emerald-600") : (dk ? "text-rose-300" : "text-rose-600")}`}>
                                {item.type === "deposit" ? "+" : "-"}{fmt(item.amount)}
                              </div>
                            </td>
                            <td className={`px-4 py-3.5 text-xs max-w-[150px] truncate ${subText}`}>{item.description || "—"}</td>
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${item.status === "active" ? dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-700" : dk ? "bg-rose-400/15 text-rose-300" : "bg-rose-100 text-rose-700"}`}>
                                {item.status === "active" ? "فعال" : "لغوشده"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5"><ActionButtons tx={item} /></td>
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

      {previewOpen && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 md:p-4 backdrop-blur-sm" onClick={() => setPreviewOpen(false)}>
          <div className={`cb-up w-full max-w-lg overflow-hidden rounded-xl md:rounded-2xl border shadow-2xl ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-white"}`} onClick={(e) => e.stopPropagation()}>
            <div className={`flex items-center justify-between border-b px-4 md:px-5 py-3 md:py-4 ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
              <b className={`flex items-center gap-2 text-sm ${dk ? "text-slate-100" : "text-slate-800"}`}>
                <span className={`grid h-8 w-8 place-items-center rounded-lg ${dk ? "bg-amber-400/10 text-amber-300" : "bg-amber-100 text-amber-600"}`}><Ic n="wallet" className="h-4 w-4" /></span>
                تأیید {previewData.type === "deposit" ? "واریز" : "برداشت"}
              </b>
              <button onClick={() => setPreviewOpen(false)} className={`grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-slate-400 transition-all duration-300 hover:rotate-90 ${dk ? "hover:bg-slate-700 hover:text-white" : "hover:bg-slate-100 hover:text-slate-700"}`}><Ic n="x" className="h-4 w-4" /></button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-4 md:px-5 py-4 space-y-4">
              <div className={`flex items-center justify-between rounded-xl border p-3 ${dk ? "border-cyan-400/30 bg-cyan-400/10" : "border-sky-300 bg-sky-50"}`}>
                <b className={`text-xs font-black ${dk ? "text-cyan-300" : "text-sky-700"}`}>کد پیگیری</b>
                <span className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-black tabular-nums ${dk ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300" : "border-sky-300 bg-sky-50 text-sky-700"}`} dir="ltr">
                  <Ic n="tag" className="h-3.5 w-3.5" />{previewData.trackingCode}
                </span>
              </div>
              <div className={`rounded-xl border p-4 ${dk ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"}`}>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className={subText}>نوع: </span><b>{previewData.type === "deposit" ? "واریز" : "برداشت"}</b></div>
                  <div><span className={subText}>مشتری: </span><b>{previewData.customerName}</b></div>
                  <div><span className={subText}>مبلغ: </span><b className={previewData.type === "deposit" ? (dk ? "text-emerald-300" : "text-emerald-700") : (dk ? "text-rose-300" : "text-rose-700")}>{fmt(previewData.amount)} {labels[previewData.currency]}</b></div>
                  <div><span className={subText}>تاریخ: </span><b>{currentDateTime}</b></div>
                  {previewData.description && <div className="col-span-2"><span className={subText}>توضیحات: </span><b>{previewData.description}</b></div>}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <button onClick={confirmRegister} className={`flex h-[48px] flex-1 min-w-[180px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-l text-sm font-black shadow-lg transition-all hover:brightness-110 active:scale-[0.98] ${dk ? "from-emerald-400 to-teal-400 text-slate-950" : "from-emerald-500 to-teal-500 text-white"}`}>
                  ثبت نهایی<Ic n="check" className="h-4 w-4" />
                </button>
                <button onClick={() => setPreviewOpen(false)} className={`flex h-[48px] px-6 cursor-pointer items-center justify-center rounded-xl border text-sm font-bold transition-all active:scale-95 ${dk ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>انصراف</button>
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
