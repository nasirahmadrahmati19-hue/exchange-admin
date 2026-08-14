"use client";
import { useEffect, useMemo, useState, useRef, useCallback, memo, type ReactNode } from "react";
import { getNextTrackingCode, consumeTrackingCode, initTrackingSystem } from "../lib/trackingCode";

type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";
type Customer = { id: string; name: string; phone?: string; tazkira?: string; address?: string; note?: string; telegram?: string; registeredAt: string; balances: Record<Currency, number>; };
type CashEntryType = "customer_deposit" | "customer_withdraw" | "owner_deposit" | "owner_withdraw" | "adjustment";
type BalanceChange = { customerId?: string; customerName: string; currency: Currency; amount: number; };

type CashEntry = {
  id: string; trackingCode: string; date: string; type: CashEntryType; currency: Currency; amount: number;
  direction: "in" | "out"; reason: string; balanceAfter: number; customerId?: string; customerName?: string;
  customerPhone?: string; customerTazkira?: string; closeActual?: number; closeDiff?: number;
};

type FormState = { type: CashEntryType; currency: Currency; amount: string; reason: string; customerId: string; customerName: string; };
type FormErrors = Partial<Record<keyof FormState, string>>;

const CASH_KEY = "cash-entries";
const CUSTOMERS_KEY = "fx-customers";
const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const labels: Record<Currency, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };

const entryTypeLabels: Record<CashEntryType, string> = { customer_deposit: "واریز مشتری", customer_withdraw: "برداشت مشتری", owner_deposit: "واریز مالک", owner_withdraw: "برداشت مالک", adjustment: "اصلاح صندوق" };
const entryTypeColors: Record<CashEntryType, { light: string; dark: string }> = { customer_deposit: { light: "bg-teal-100 text-teal-700", dark: "bg-teal-400/15 text-teal-300" }, customer_withdraw: { light: "bg-orange-100 text-orange-700", dark: "bg-orange-400/15 text-orange-300" }, owner_deposit: { light: "bg-sky-100 text-sky-700", dark: "bg-sky-400/15 text-sky-300" }, owner_withdraw: { light: "bg-amber-100 text-amber-700", dark: "bg-amber-400/15 text-amber-300" }, adjustment: { light: "bg-violet-100 text-violet-700", dark: "bg-violet-400/15 text-violet-300" } };
const currencyColors: Record<Currency, { light: string; dark: string; gradient: string }> = { AFN: { light: "text-emerald-700", dark: "text-emerald-300", gradient: "from-emerald-500 to-teal-400" }, USD: { light: "text-sky-700", dark: "text-sky-300", gradient: "from-sky-500 to-cyan-400" }, EUR: { light: "text-blue-700", dark: "text-blue-300", gradient: "from-blue-600 to-blue-400" }, IRR: { light: "text-amber-700", dark: "text-amber-300", gradient: "from-amber-500 to-orange-400" }, PKR: { light: "text-rose-700", dark: "text-rose-300", gradient: "from-rose-500 to-pink-400" } };

const generateId = (): string => { if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") { try { return crypto.randomUUID(); } catch {} } return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; const v = c === "x" ? r : (r & 0x3) | 0x8; return v.toString(16); }); };
const normalizeDigits = (value: string) => { const pd = "۰۱۲۳۴۵۶۷۸۹", ad = "٠١٢٣٤٥٦٧٨٩"; return String(value || "").replace(/[۰-۹]/g, d => String(pd.indexOf(d))).replace(/[٠-٩]/g, d => String(ad.indexOf(d))); };
const toNumericText = (v: string) => { let s = normalizeDigits(String(v || "")).replace(/[^0-9.]/g, ""); const fd = s.indexOf("."); if (fd !== -1) s = s.slice(0, fd + 1) + s.slice(fd + 1).replace(/\./g, ""); return s; };
const parseAmount = (v: string) => { const n = Number(normalizeDigits(String(v || "")).replace(/,/g, "")); return Number.isFinite(n) && n >= 0 ? n : 0; };
const fmt = (n: number) => (Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0");

function shamsiParts(d: Date) { try { const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d); const get = (type: string) => parts.find((p) => p.type === type)?.value || "0"; return { year: get("year"), month: get("month"), day: get("day") }; } catch { return { year: "0", month: "0", day: "0" }; } }
function formatDateTime(d: Date) { const pad = (n: number) => String(n).padStart(2, "0"); const s = shamsiParts(d); return `${s.year}/${s.month}/${s.day} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function formatShamsiDate(d: Date) { const s = shamsiParts(d); return `${s.year}/${s.month}/${s.day}`; }
function shortDateLabel(s: string) { try { const d = new Date(s); return Number.isNaN(d.getTime()) ? "-" : formatShamsiDate(d); } catch { return "-"; } }
function timeLabel(s: string) { try { const d = new Date(s); if (Number.isNaN(d.getTime())) return "-"; const pad = (n: number) => String(n).padStart(2, "0"); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; } catch { return "-"; } }

const safeGetItem = (key: string): any => { if (typeof window === "undefined") return null; try { const raw = localStorage.getItem(key); if (!raw) return null; return JSON.parse(raw); } catch { return null; } };

function loadCustomers(): Customer[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = safeGetItem(CUSTOMERS_KEY);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object" && parsed[0] !== null && "id" in parsed[0] && "name" in parsed[0]) {
      return parsed.map((c: any) => ({ id: c.id || generateId(), name: c.name || "", phone: c.phone || "", tazkira: c.tazkira || "", address: c.address || "", note: c.note || "", telegram: c.telegram || "", registeredAt: c.registeredAt || c.createdAt || new Date().toISOString(), balances: { AFN: Number(c.balances?.AFN || 0) || 0, USD: Number(c.balances?.USD || 0) || 0, EUR: Number(c.balances?.EUR || 0) || 0, IRR: Number(c.balances?.IRR || 0) || 0, PKR: Number(c.balances?.PKR || 0) || 0 } }));
    }
    return [];
  } catch { return []; }
}

function loadCashEntries(): CashEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = safeGetItem(CASH_KEY);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e: any) => e?.id).map((e: any): CashEntry => ({ id: e.id, trackingCode: e.trackingCode || "", date: e.date || new Date().toISOString(), type: (["customer_deposit","customer_withdraw","owner_deposit","owner_withdraw","adjustment"].includes(e.type) ? e.type : "customer_deposit") as CashEntryType, currency: currencies.includes(e.currency) ? e.currency : "AFN", amount: Number(e.amount || 0) || 0, direction: e.direction === "out" ? "out" : "in", reason: e.reason || "", balanceAfter: Number(e.balanceAfter || 0) || 0, customerId: e.customerId, customerName: e.customerName, customerPhone: e.customerPhone, customerTazkira: e.customerTazkira, closeActual: e.closeActual, closeDiff: e.closeDiff }));
  } catch { return []; }
}

function computeCashBalances(entries: CashEntry[]): Record<Currency, number> {
  const balances: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
  const sorted = [...entries].sort((a, b) => { try { return new Date(a.date).getTime() - new Date(b.date).getTime(); } catch { return 0; } });
  for (const e of sorted) { if (!currencies.includes(e.currency)) continue; const delta = e.direction === "in" ? e.amount : -e.amount; balances[e.currency] += delta; }
  return balances;
}

function applyBalanceChanges(customers: Customer[], changes: BalanceChange[]): Customer[] {
  return customers.map(c => {
    const cc = changes.filter(ch => ch.customerId === c.id || (!ch.customerId && ch.customerName === c.name));
    if (cc.length === 0) return c;
    const nb = { ...c.balances };
    for (const ch of cc) { if (nb[ch.currency] === undefined) nb[ch.currency] = 0; nb[ch.currency] = (nb[ch.currency] || 0) + ch.amount; }
    return { ...c, balances: nb };
  });
}

function getBalanceChangesForCashEntry(entry: CashEntry, action: "register" | "reverse"): BalanceChange[] {
  const changes: BalanceChange[] = [];
  const sign = action === "register" ? 1 : -1;
  if (entry.customerId && (entry.type === "customer_deposit" || entry.type === "customer_withdraw")) {
    const delta = entry.type === "customer_deposit" ? entry.amount : -entry.amount;
    changes.push({ customerId: entry.customerId, customerName: entry.customerName || "", currency: entry.currency, amount: delta * sign });
  }
  return changes;
}

const emptyForm: FormState = { type: "customer_deposit", currency: "AFN", amount: "", reason: "", customerId: "", customerName: "" };

const iconPaths = { wallet: "M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3", plus: "M12 4.5v15m7.5-7.5h-15", arrowDown: "M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3", arrowUp: "M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18", user: "M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z", doc: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z", search: "m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 1 10.607 10.607Z", chevron: "m19.5 8.25-7.5 7.5-7.5-7.5", x: "M6 18 18 6M6 6l12 12", check: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z", alert: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z", inbox: "M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z", sun: "M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.375 3.375 0 1 1-7.5 0 3.375 3.375 0 0 1 7.5 0Z", moon: "M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z", clock: "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z", tag: "M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z", trash: "M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0", lock: "M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z", history: "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" };
type IconName = keyof typeof iconPaths;
const Ic = memo(function Ic({ n, className = "h-5 w-5" }: { n: IconName; className?: string }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d={iconPaths[n]} /></svg>; });

export default function CashPage() {
  const [mounted, setMounted] = useState(false);
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [activeTab, setActiveTab] = useState<"register" | "ledger" | "close">("register");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [toast, setToast] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<CashEntry | null>(null);
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [customerFilter, setCustomerFilter] = useState("");
  const customerListRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<CashEntryType | "all">("all");
  const [filterCurrency, setFilterCurrency] = useState<Currency | "all">("all");
  const [closeAmounts, setCloseAmounts] = useState<Record<Currency, string>>({ AFN: "", USD: "", EUR: "", IRR: "", PKR: "" });
  const [closeResult, setCloseResult] = useState<Record<Currency, { actual: number; system: number; diff: number }> | null>(null);

  useEffect(() => { try { const saved = window.localStorage.getItem("fx-theme"); if (saved === "dark" || saved === "light") setTheme(saved); } catch {} }, []);
  useEffect(() => { try { window.localStorage.setItem("fx-theme", theme); } catch {} }, [theme]);
  const dk = theme === "dark";

  useEffect(() => { try { setEntries(loadCashEntries()); setCustomers(loadCustomers()); initTrackingSystem(); } catch (err) { console.error("Load error:", err); } setMounted(true); }, []);

  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  const currentDateTime = now ? formatDateTime(now) : "";

  useEffect(() => { if (!mounted) return; try { localStorage.setItem(CASH_KEY, JSON.stringify(entries)); } catch {} }, [entries, mounted]);
  useEffect(() => { if (!mounted) return; try { localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers)); } catch {} }, [customers, mounted]);

  useEffect(() => { if (!showCustomerList) return; const handler = (e: MouseEvent) => { if (customerListRef.current && !customerListRef.current.contains(e.target as Node)) setShowCustomerList(false); }; const timer = setTimeout(() => document.addEventListener("mousedown", handler), 0); return () => { clearTimeout(timer); document.removeEventListener("mousedown", handler); }; }, [showCustomerList]);

  const cashBalances = useMemo(() => computeCashBalances(entries), [entries]);
  const nextCode = useMemo(() => getNextTrackingCode(), []);

  const filteredCustomerList = useMemo(() => { if (!customerFilter) return customers; const q = normalizeDigits(customerFilter.trim()).toLowerCase(); return customers.filter(c => c.name.toLowerCase().includes(q) || (c.phone && normalizeDigits(c.phone).includes(q)) || (c.tazkira && normalizeDigits(c.tazkira).includes(q))); }, [customers, customerFilter]);

  const filteredEntries = useMemo(() => {
    let result = [...entries];
    if (filterType !== "all") result = result.filter(e => e.type === filterType);
    if (filterCurrency !== "all") result = result.filter(e => e.currency === filterCurrency);
    const q = normalizeDigits(search.trim()).toLowerCase();
    if (q) { result = result.filter(e => { const fields = [e.trackingCode, e.reason, entryTypeLabels[e.type], e.customerName || "", e.customerPhone || "", e.customerTazkira || ""].map(f => normalizeDigits(String(f)).toLowerCase()); return fields.some(f => f.includes(q)); }); }
    return result.sort((a, b) => { try { return new Date(b.date).getTime() - new Date(a.date).getTime(); } catch { return 0; } });
  }, [entries, search, filterType, filterCurrency]);

  const isInType = form.type === "customer_deposit" || form.type === "owner_deposit";
  const isCustomerType = form.type === "customer_deposit" || form.type === "customer_withdraw";
  const selectedCustomer = useMemo(() => customers.find(c => c.id === form.customerId) || null, [customers, form.customerId]);

  const showToast = useCallback((message: string) => { setToast(message); setTimeout(() => setToast(""), 3500); }, []);
  const setField = useCallback((field: keyof FormState, value: string) => { setForm(prev => ({ ...prev, [field]: value })); setErrors(prev => ({ ...prev, [field]: undefined })); }, []);

  const validateForm = useCallback(() => {
    const errs: FormErrors = {};
    const amount = parseAmount(form.amount);
    if (!amount) errs.amount = "مبلغ خالی یا صفر است.";
    if (!form.reason.trim()) errs.reason = "دلیل / شرح ضروری است.";
    if (isCustomerType && !form.customerName.trim()) errs.customerName = "انتخاب مشتری ضروری است.";
    if (form.type === "customer_withdraw" && form.customerId) {
      const cust = customers.find(c => c.id === form.customerId);
      if (cust) { const bal = cust.balances[form.currency] || 0; if (amount > bal) errs.amount = `موجودی کافی نیست. موجودی فعلی: ${fmt(bal)} ${labels[form.currency]}`; }
    }
    return errs;
  }, [form, isCustomerType, customers]);

  const handleSubmitClick = useCallback(() => {
    const errs = validateForm();
    setErrors(errs);
    if (Object.keys(errs).length > 0) { showToast("لطفاً فیلدهای ضروری را تکمیل کنید."); return; }
    const amount = parseAmount(form.amount);
    const direction: "in" | "out" = isInType ? "in" : "out";
    const currentBal = cashBalances[form.currency] || 0;
    const newBal = isInType ? currentBal + amount : currentBal - amount;
    const entry: CashEntry = {
      id: generateId(), trackingCode: getNextTrackingCode(), date: new Date().toISOString(), type: form.type,
      currency: form.currency, amount, direction, reason: form.reason.trim(), balanceAfter: newBal,
      customerId: isCustomerType ? form.customerId : undefined, customerName: isCustomerType ? form.customerName : undefined
    };
    setPreviewData(entry);
    setPreviewOpen(true);
  }, [validateForm, form, cashBalances, isInType, isCustomerType, showToast]);

  const confirmRegister = useCallback(() => {
    if (!previewData) return;
    const entry = { ...previewData, trackingCode: consumeTrackingCode() };
    if (entry.customerId) {
      const cust = customers.find(c => c.id === entry.customerId);
      if (cust) { entry.customerPhone = cust.phone || ""; entry.customerTazkira = cust.tazkira || ""; }
    }
    setEntries(prev => [...prev, entry]);
    setCustomers(prev => applyBalanceChanges(prev, getBalanceChangesForCashEntry(entry, "register")));
    setForm(emptyForm); setErrors({}); setPreviewOpen(false); setPreviewData(null);
    showToast("عملیات صندوق با موفقیت ثبت شد.");
  }, [previewData, showToast, customers]);

  const deleteEntry = useCallback((entry: CashEntry) => {
    if (!window.confirm(`آیا از حذف سند ${entry.trackingCode} مطمئن هستید؟`)) return;
    setCustomers(prev => applyBalanceChanges(prev, getBalanceChangesForCashEntry(entry, "reverse")));
    setEntries(prev => prev.filter(e => e.id !== entry.id));
    showToast(`سند ${entry.trackingCode} حذف شد.`);
  }, [showToast]);

  const handleClose = useCallback(() => {
    const result: Record<Currency, { actual: number; system: number; diff: number }> = {} as any;
    let hasData = false;
    for (const cur of currencies) {
      const actualStr = closeAmounts[cur];
      if (actualStr.trim() === "") { result[cur] = { actual: 0, system: cashBalances[cur], diff: -cashBalances[cur] }; continue; }
      hasData = true;
      const actual = parseAmount(actualStr);
      const system = cashBalances[cur];
      result[cur] = { actual, system, diff: actual - system };
    }
    if (!hasData) { showToast("لطفاً حداقل موجودی واقعی یک ارز را وارد کنید."); return; }
    setCloseResult(result);
    showToast("شمارش صندوق انجام شد.");
  }, [closeAmounts, cashBalances, showToast]);

  const saveClose = useCallback(() => {
    if (!closeResult) return;
    const nowDate = new Date();
    const newEntries: CashEntry[] = [];
    for (const cur of currencies) {
      const r = closeResult[cur];
      if (Math.abs(r.diff) < 0.005) continue;
      const entry: CashEntry = { id: generateId(), trackingCode: consumeTrackingCode(), date: nowDate.toISOString(), type: "adjustment", currency: cur, amount: Math.abs(r.diff), direction: r.diff > 0 ? "in" : "out", reason: `اصلاح صندوق - ${r.diff > 0 ? "اضافه" : "کسری"} شمارش واقعی`, balanceAfter: r.actual, closeActual: r.actual, closeDiff: r.diff };
      newEntries.push(entry);
    }
    if (newEntries.length > 0) { setEntries(prev => [...prev, ...newEntries]); showToast("اصلاحات صندوق ثبت شد."); }
    else { showToast("موجودی صندوق دقیق است. نیازی به اصلاح نیست."); }
    setCloseResult(null);
    setCloseAmounts({ AFN: "", USD: "", EUR: "", IRR: "", PKR: "" });
  }, [closeResult, showToast]);

  if (!mounted) return (<div className="min-h-screen flex items-center justify-center"><div className="text-center"><div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-emerald-500" /><p className="mt-4 text-slate-500">در حال بارگذاری...</p></div></div>);

  const heading = dk ? "text-white" : "text-slate-900";
  const subText = dk ? "text-slate-500" : "text-slate-400";
  const glassChip = dk ? "border-slate-600/70 bg-slate-800/80" : "border-emerald-100 bg-white/85";
  const uiCard = `rounded-2xl border backdrop-blur transition-colors duration-300 ${dk ? "border-slate-700 bg-slate-800/90 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.6)]" : "border-emerald-100 bg-white/95 shadow-[0_16px_40px_-28px_rgba(16,185,129,0.35)]"}`;
  const inputShell = `rounded-xl border text-sm font-medium shadow-sm outline-none transition-all duration-200 focus:ring-4 ${dk ? "border-slate-600 bg-slate-900 text-slate-100 placeholder:text-slate-500 hover:border-slate-500 focus:border-emerald-400 focus:ring-emerald-400/10" : "border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 hover:border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500/10"}`;
  const uiInput = `h-12 w-full px-3.5 ${inputShell}`;
  const errInput = dk ? "border-rose-400/70" : "border-rose-400";
  const roInput = dk ? "cursor-default bg-slate-800/70 text-slate-400" : "cursor-default bg-slate-100 text-slate-500";
  const uiLabel = `mb-1.5 block text-[11px] font-black tracking-wide ${dk ? "text-slate-400" : "text-slate-500"}`;
  const chevPos = `pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${dk ? "text-slate-500" : "text-slate-400"}`;
  const identIcon = dk ? "from-emerald-400/20 to-teal-400/5 text-emerald-300 ring-emerald-400/25" : "from-emerald-400/20 to-teal-400/10 text-emerald-600 ring-emerald-400/30";

  const fld = (label: string, node: ReactNode, cls = "") => (<div className={cls}><label className={uiLabel}>{label}</label>{node}</div>);
  const errorList = Object.values(errors).filter((msg): msg is string => Boolean(msg));

  const tabs = [
    { id: "register" as const, label: "ثبت عملیات", icon: "plus" as IconName },
    { id: "ledger" as const, label: "روزنامچه صندوق", icon: "history" as IconName, count: entries.length },
    { id: "close" as const, label: "بستن صندوق", icon: "lock" as IconName }
  ];

  const entryTypeOptions: [string, string][] = [
    ["customer_deposit", "واریز مشتری به حساب"],
    ["customer_withdraw", "برداشت مشتری از حساب"],
    ["owner_deposit", "واریز مالک به صندوق"],
    ["owner_withdraw", "برداشت مالک از صندوق"]
  ];

  return (
    <div dir="rtl" className={dk ? "dark" : ""}>
      <style>{`@import url("https://fonts.googleapis.com/css2?family=Lalezar&family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap");.cs-font{font-family:"Vazirmatn","Segoe UI",Tahoma,sans-serif}.cs-display{font-family:"Lalezar","Vazirmatn",Tahoma,sans-serif;letter-spacing:.01em}.dark{color-scheme:dark}@keyframes csUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}.cs-up{animation:csUp .5s cubic-bezier(.22,.8,.35,1) both}.cs-scroll::-webkit-scrollbar{height:6px;width:6px}.cs-scroll::-webkit-scrollbar-thumb{background:rgba(16,185,129,.3);border-radius:3px}.cs-scroll{scrollbar-width:thin}::selection{background:rgba(16,185,129,.25)}`}</style>
      <div className={`cs-font relative min-h-screen overflow-x-hidden antialiased transition-colors duration-500 ${dk ? "bg-[#0f172a] text-slate-100" : "bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 text-slate-800"}`}>
        <div className={`fixed inset-x-0 top-0 z-30 h-1 bg-gradient-to-l ${dk ? "from-emerald-400 via-teal-400 to-cyan-400" : "from-emerald-500 via-teal-500 to-cyan-500"}`} />
        <div className="relative z-10 mx-auto w-full max-w-7xl space-y-4 md:space-y-6 px-3 pb-16 pt-5 md:px-8 md:pt-9">
          <header className="cs-up flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0">
              <div className="relative grid h-11 w-11 md:h-14 md:w-14 shrink-0 place-items-center rounded-xl md:rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-400 text-white shadow-lg shadow-emerald-500/30 ring-1 ring-white/30"><Ic n="wallet" className="h-5 w-5 md:h-6 md:w-6" /><span className={`absolute -bottom-1 -left-1 md:-bottom-1.5 md:-left-1.5 grid h-4 min-w-4 md:h-5 md:min-w-5 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-400 px-1 text-[7px] md:text-[8px] font-black text-white ring-2 ${dk ? "ring-[#0f172a]" : "ring-[#ecfdf5]"}`}>CS</span></div>
              <div className="min-w-0"><h1 className={`cs-display text-2xl md:text-4xl leading-none ${heading}`}>صندوق</h1><p className={`mt-1 text-[10px] md:text-xs font-bold ${subText}`}>مدیریت واریز، برداشت و موجودی نقدی</p></div>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2.5">
              <div className={`hidden sm:flex items-center gap-2 rounded-xl border px-3 py-2 shadow-sm backdrop-blur ${glassChip}`}><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" /></span><span dir="ltr" className={`text-xs font-bold tabular-nums ${dk ? "text-slate-100" : "text-slate-700"}`}>{currentDateTime || "--:--"}</span></div>
              <button onClick={() => setTheme(dk ? "light" : "dark")} className={`group grid h-10 w-10 md:h-11 md:w-11 cursor-pointer place-items-center rounded-lg md:rounded-xl border shadow-sm backdrop-blur transition-all duration-300 active:scale-90 ${dk ? "border-slate-600 bg-slate-800/85 text-amber-300 hover:border-amber-300" : "border-slate-200 bg-white/85 text-slate-600 hover:border-emerald-400"}`}>{dk ? <Ic n="sun" className="h-4 w-4 transition-transform duration-500 group-hover:rotate-45" /> : <Ic n="moon" className="h-4 w-4 transition-transform duration-500 group-hover:-rotate-12" />}</button>
            </div>
          </header>

          <div className="cs-up grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3" style={{ animationDelay: "70ms" }}>
            {currencies.map(cur => {
              const bal = cashBalances[cur];
              const colors = currencyColors[cur];
              const isNeg = bal < 0;
              return (
                <div key={cur} className={`rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-white/80"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-black ${subText}`}>{labels[cur]}</span>
                    <span className={`grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br ${colors.gradient} text-white text-[8px] font-black`}>{cur}</span>
                  </div>
                  <div className={`text-xl md:text-2xl font-black tabular-nums ${isNeg ? "text-rose-500" : colors[dk ? "dark" : "light"]}`}>{fmt(bal)}</div>
                  <div className={`text-[9px] font-bold mt-1 ${isNeg ? "text-rose-500" : subText}`}>{isNeg ? "منفی - کسری" : "موجودی فعلی"}</div>
                </div>
              );
            })}
          </div>

          <div className={`cs-up flex gap-1.5 md:gap-2 rounded-xl md:rounded-2xl border p-1.5 md:p-2 shadow-sm backdrop-blur ${glassChip}`} style={{ animationDelay: "140ms" }}>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 md:gap-2 rounded-lg md:rounded-xl px-3 md:px-5 py-2.5 md:py-3 text-xs md:text-sm font-black transition-all duration-300 active:scale-[0.97] ${activeTab === tab.id ? `bg-gradient-to-l shadow-lg ${dk ? "from-emerald-400 to-teal-400 text-slate-950" : "from-emerald-500 via-teal-500 to-cyan-500 text-white"}` : dk ? "text-slate-400 hover:bg-slate-700/60 hover:text-slate-100" : "text-slate-500 hover:bg-emerald-50 hover:text-slate-800"}`}>
                <Ic n={tab.icon} className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${activeTab === tab.id ? dk ? "bg-slate-950/20 text-slate-950" : "bg-white/30 text-white" : dk ? "bg-slate-700 text-slate-300" : "bg-emerald-100 text-emerald-700"}`}>{tab.count}</span>}
              </button>
            ))}
          </div>

          {activeTab === "register" && (
            <section className={`cs-up space-y-4 md:space-y-5 p-4 md:p-7 ${uiCard}`} style={{ animationDelay: "160ms" }}>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${identIcon}`}><Ic n="plus" className="h-5 w-5" /></span>
                <div className="flex-1 min-w-0"><h2 className={`cs-display text-xl md:text-2xl leading-none ${heading}`}>ثبت عملیات صندوق</h2><p className={`mt-1 text-[11px] font-bold ${subText}`}>واریز و برداشت مشتری یا مالک</p></div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {fld("نوع عملیات *", (<div className="relative"><select value={form.type} onChange={e => { setField("type", e.target.value); if (e.target.value !== "customer_deposit" && e.target.value !== "customer_withdraw") { setField("customerId", ""); setField("customerName", ""); } }} className={`${uiInput} cursor-pointer appearance-none pl-9`}>{entryTypeOptions.map(o => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select><span className={chevPos}><Ic n="chevron" className="h-4 w-4" /></span></div>))}
                {fld("نوع ارز *", (<div className="relative"><select value={form.currency} onChange={e => setField("currency", e.target.value)} className={`${uiInput} cursor-pointer appearance-none pl-9`}>{currencies.map(c => <option key={c} value={c}>{labels[c]}</option>)}</select><span className={chevPos}><Ic n="chevron" className="h-4 w-4" /></span></div>))}
                {fld("مبلغ *", (<input type="text" inputMode="decimal" dir="ltr" value={form.amount} onChange={e => setField("amount", toNumericText(e.target.value))} placeholder="0" className={`${uiInput} text-left tabular-nums ${errors.amount ? errInput : ""}`} />))}
                {fld("کد پیگیری", (<div className="relative"><input readOnly dir="ltr" value={nextCode} className={`${uiInput} ${roInput} pl-14 text-left tabular-nums font-black`} /><span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-2 py-1 text-[9px] font-black text-white">TR</span></div>))}
              </div>
              {isCustomerType && (
                <div className={`rounded-xl border p-4 ${dk ? "border-teal-400/25 bg-teal-400/[0.07]" : "border-teal-200 bg-teal-50"}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`grid h-8 w-8 place-items-center rounded-lg ${dk ? "bg-teal-400/15 text-teal-300" : "bg-teal-100 text-teal-600"}`}><Ic n="user" className="h-4 w-4" /></span>
                    <b className={`text-xs font-black ${dk ? "text-teal-300" : "text-teal-700"}`}>مشتری {form.type === "customer_deposit" ? "واریزکننده" : "برداشت‌کننده"}</b>
                  </div>
                  {fld("انتخاب مشتری *", (
                    <div className="relative" ref={customerListRef}>
                      <input value={form.customerName} onChange={e => { const val = e.target.value; setField("customerName", val); setCustomerFilter(val); if (!showCustomerList) setShowCustomerList(true); const c = customers.find(x => x.name === val); if (c) { setField("customerId", c.id); } else { setField("customerId", ""); } }} placeholder="نام مشتری را بنویسید یا انتخاب کنید…" className={`${uiInput} pl-12 ${errors.customerName ? errInput : ""}`} autoComplete="off" />
                      <button type="button" onClick={(e) => { e.stopPropagation(); setShowCustomerList(!showCustomerList); }} className={`absolute left-2 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-lg transition ${dk ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}><Ic n="chevron" className={`h-4 w-4 transition-transform ${showCustomerList ? "rotate-180" : ""}`} /></button>
                      {showCustomerList && (
                        <div className={`absolute left-0 top-full z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border shadow-xl ${dk ? "border-slate-600 bg-slate-800" : "border-slate-200 bg-white"}`}>
                          {filteredCustomerList.length === 0 ? (<div className={`px-4 py-3 text-xs text-center ${subText}`}>مشتری‌ای یافت نشد</div>) : (
                            filteredCustomerList.map((c, idx) => (
                              <button key={c.id} type="button" onClick={() => { setField("customerId", c.id); setField("customerName", c.name); setCustomerFilter(""); setShowCustomerList(false); }} className={`flex w-full items-center gap-2 px-3 py-2.5 text-right text-xs font-bold transition ${dk ? "text-slate-200 hover:bg-teal-400/15 hover:text-teal-300" : "text-slate-700 hover:bg-teal-50 hover:text-teal-600"}`}>
                                <span className="flex-1 truncate">{c.name}</span>
                                <span className={`text-[10px] tabular-nums font-bold ${currencyColors[form.currency][dk ? "dark" : "light"]}`}>{fmt(c.balances[form.currency] || 0)} {labels[form.currency]}</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {selectedCustomer && (
                    <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 ${dk ? "bg-slate-900/50" : "bg-white"}`}>
                      <Ic n="wallet" className={`h-4 w-4 ${dk ? "text-teal-300" : "text-teal-600"}`} />
                      <span className={`text-xs font-bold ${subText}`}>موجودی {selectedCustomer.name} ({labels[form.currency]}):</span>
                      <b className={`text-sm font-black tabular-nums ${(selectedCustomer.balances[form.currency] || 0) >= 0 ? currencyColors[form.currency][dk ? "dark" : "light"] : "text-rose-500"}`}>{fmt(selectedCustomer.balances[form.currency] || 0)}</b>
                    </div>
                  )}
                </div>
              )}
              {fld("دلیل / شرح عملیات *", (<textarea rows={3} value={form.reason} onChange={e => setField("reason", e.target.value)} placeholder={form.type === "customer_deposit" ? "مثلاً: واریز نقدی مشتری به حساب…" : form.type === "customer_withdraw" ? "مثلاً: برداشت نقدی مشتری از حساب…" : form.type === "owner_deposit" ? "مثلاً: واریز سرمایه مالک به صندوق…" : "مثلاً: برداشت مالک برای مصارف شخصی…"} className={`${uiInput} h-auto py-3 resize-none ${errors.reason ? errInput : ""}`} />))}
              <div className={`flex items-center gap-3 rounded-xl border p-4 ${isInType ? dk ? "border-emerald-400/25 bg-emerald-400/[0.07]" : "border-emerald-200 bg-emerald-50" : dk ? "border-rose-400/25 bg-rose-400/[0.07]" : "border-rose-200 bg-rose-50"}`}>
                <span className={`grid h-10 w-10 place-items-center rounded-xl ${isInType ? dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-600" : dk ? "bg-rose-400/15 text-rose-300" : "bg-rose-100 text-rose-600"}`}><Ic n={isInType ? "arrowDown" : "arrowUp"} className="h-5 w-5" /></span>
                <div>
                  <b className={`text-sm font-black ${isInType ? dk ? "text-emerald-300" : "text-emerald-700" : dk ? "text-rose-300" : "text-rose-700"}`}>{isInType ? "افزایش موجودی صندوق" : "کاهش موجودی صندوق"}</b>
                  <p className={`text-[11px] ${subText}`}>{isInType ? "مبلغ به موجودی" : "مبلغ از موجودی"} {labels[form.currency]} {isInType ? "اضافه" : "کم"} می‌شود.{isCustomerType && form.customerId && (form.type === "customer_deposit" ? " موجودی حساب مشتری هم افزایش می‌یابد." : " موجودی حساب مشتری هم کاهش می‌یابد.")}</p>
                </div>
              </div>
              {errorList.length > 0 && (
                <div className={`space-y-2 rounded-xl border p-4 ${dk ? "border-rose-400/30 bg-rose-400/10 text-rose-300" : "border-rose-300 bg-rose-50 text-rose-600"}`}>
                  <b className="flex items-center gap-2 text-sm"><Ic n="alert" className="h-5 w-5 shrink-0" />لطفاً تکمیل کنید:</b>
                  <ul className="list-disc pr-5 text-sm space-y-1">{errorList.map((msg, i) => (<li key={i}>{msg}</li>))}</ul>
                </div>
              )}
              <button onClick={handleSubmitClick} className={`group flex h-[50px] md:h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-l text-base font-black shadow-lg transition-all duration-300 hover:shadow-xl hover:brightness-110 active:scale-[0.985] ${dk ? "from-emerald-400 to-teal-400 text-slate-950" : "from-emerald-500 via-teal-500 to-cyan-500 text-white"}`}>ثبت عملیات<Ic n="check" className="h-5 w-5" /></button>
            </section>
          )}

          {activeTab === "ledger" && (
            <section className={`cs-up overflow-hidden ${uiCard}`} style={{ animationDelay: "160ms" }}>
              <div className="flex flex-wrap items-center gap-3 p-4 md:p-5 pb-3 md:pb-4 md:px-7 md:pt-6">
                <span className={`grid h-10 w-10 md:h-11 md:w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${identIcon}`}><Ic n="history" className="h-5 w-5" /></span>
                <div className="flex-1 min-w-0"><h2 className={`cs-display text-xl md:text-2xl leading-none ${heading}`}>روزنامچه صندوق</h2><p className={`mt-1 text-[11px] font-bold ${subText}`}>تمام دریافتی‌ها و پرداختی‌ها با جزئیات کامل</p></div>
                <span className={`rounded-full px-3 py-1.5 text-[10px] font-black ${dk ? "bg-slate-700 text-slate-300" : "bg-emerald-100 text-emerald-700"}`}>{filteredEntries.length} عملیات</span>
              </div>
              <div className="px-4 md:px-7 pb-4 space-y-4">
                <div className="flex flex-wrap gap-3">
                  <div className="relative flex-1 min-w-[250px]">
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو: نام مشتری، کد پیگیری، شماره تماس، تذکره، شرح…" className={`${uiInput} pr-10`} />
                    <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${dk ? "text-slate-500" : "text-slate-400"}`}><Ic n="search" className="h-4 w-4" /></span>
                  </div>
                  <select value={filterType} onChange={e => setFilterType(e.target.value as any)} className={`${uiInput} w-auto min-w-[170px] cursor-pointer appearance-none pl-9`}>
                    <option value="all">همه انواع</option>
                    <option value="customer_deposit">واریز مشتری</option>
                    <option value="customer_withdraw">برداشت مشتری</option>
                    <option value="owner_deposit">واریز مالک</option>
                    <option value="owner_withdraw">برداشت مالک</option>
                    <option value="adjustment">اصلاح صندوق</option>
                  </select>
                  <select value={filterCurrency} onChange={e => setFilterCurrency(e.target.value as any)} className={`${uiInput} w-auto min-w-[130px] cursor-pointer appearance-none pl-9`}>
                    <option value="all">همه ارزها</option>
                    {currencies.map(c => <option key={c} value={c}>{labels[c]}</option>)}
                  </select>
                  {(search || filterType !== "all" || filterCurrency !== "all") && (
                    <button onClick={() => { setSearch(""); setFilterType("all"); setFilterCurrency("all"); }} className={`flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-black transition-all active:scale-95 cursor-pointer ${dk ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}><Ic n="x" className="h-3.5 w-3.5" />پاک کردن</button>
                  )}
                </div>
                {filteredEntries.length === 0 ? (
                  <div className={`flex flex-col items-center gap-3 px-6 py-16 ${dk ? "text-slate-500" : "text-slate-400"}`}>
                    <span className={`grid h-16 w-16 place-items-center rounded-2xl border border-dashed ${dk ? "border-slate-600 bg-slate-800/40" : "border-slate-300 bg-slate-50"}`}><Ic n="inbox" className="h-7 w-7 opacity-70" /></span>
                    <p className="text-sm font-black text-center">{entries.length === 0 ? "هنوز عملیاتی در صندوق ثبت نشده است." : "هیچ عملیاتی با این فیلتر یافت نشد."}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto cs-scroll">
                    <table className="w-full min-w-[1200px] text-sm">
                      <thead>
                        <tr className={`border-y ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
                          {["#", "کد پیگیری", "تاریخ", "نوع عملیات", "مشتری", "تماس", "تذکره", "شرح", "ارز", "دریافت", "پرداخت", "مانده", "حذف"].map(h => (
                            <th key={h} className="px-3 py-3 text-right text-[10px] font-black text-slate-400 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${dk ? "divide-slate-700/60" : "divide-slate-100"}`}>
                        {filteredEntries.map((e, idx) => {
                          const isIn = e.direction === "in";
                          const isOwner = e.type === "owner_deposit" || e.type === "owner_withdraw";
                          const isAdjust = e.type === "adjustment";
                          return (
                            <tr key={e.id} className={`transition-colors ${dk ? "hover:bg-slate-700/30" : "hover:bg-emerald-50/70"}`}>
                              <td className="px-3 py-3"><span className={`grid h-7 w-7 place-items-center rounded-lg text-[10px] font-black tabular-nums ${dk ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"}`}>{idx + 1}</span></td>
                              <td className="px-3 py-3"><span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-black tabular-nums ${dk ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300" : "border-sky-300 bg-sky-50 text-sky-700"}`} dir="ltr"><Ic n="tag" className="h-2.5 w-2.5" />{e.trackingCode}</span></td>
                              <td className={`whitespace-nowrap px-3 py-3 text-[11px] tabular-nums ${dk ? "text-slate-400" : "text-slate-500"}`}><div dir="ltr">{shortDateLabel(e.date)}</div><div dir="ltr" className={`text-[9px] ${subText}`}>{timeLabel(e.date)}</div></td>
                              <td className="px-3 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-black whitespace-nowrap ${entryTypeColors[e.type][dk ? "dark" : "light"]}`}>{entryTypeLabels[e.type]}</span></td>
                              <td className={`px-3 py-3 text-[12px] font-bold whitespace-nowrap ${dk ? "text-slate-200" : "text-slate-700"}`}>{isOwner ? <span className={dk ? "text-amber-300" : "text-amber-700"}>👤 مالک</span> : isAdjust ? <span className={subText}>سیستم</span> : (e.customerName || "—")}</td>
                              <td className={`px-3 py-3 text-[11px] tabular-nums whitespace-nowrap ${dk ? "text-slate-300" : "text-slate-600"}`} dir="ltr">{e.customerPhone || "—"}</td>
                              <td className={`px-3 py-3 text-[11px] tabular-nums whitespace-nowrap ${dk ? "text-slate-300" : "text-slate-600"}`} dir="ltr">{e.customerTazkira || "—"}</td>
                              <td className={`px-3 py-3 text-[11px] max-w-[180px] truncate ${dk ? "text-slate-300" : "text-slate-600"}`}>{e.reason || "—"}</td>
                              <td className={`px-3 py-3 text-[11px] font-black whitespace-nowrap ${currencyColors[e.currency][dk ? "dark" : "light"]}`}>{labels[e.currency]}</td>
                              <td className={`px-3 py-3 text-[12px] font-black tabular-nums whitespace-nowrap ${isIn ? "text-emerald-500" : ""}`}>{isIn ? fmt(e.amount) : ""}</td>
                              <td className={`px-3 py-3 text-[12px] font-black tabular-nums whitespace-nowrap ${!isIn ? "text-rose-500" : ""}`}>{!isIn ? fmt(e.amount) : ""}</td>
                              <td className={`px-3 py-3 text-[12px] font-black tabular-nums whitespace-nowrap ${currencyColors[e.currency][dk ? "dark" : "light"]}`}>{fmt(e.balanceAfter)}</td>
                              <td className="px-3 py-3"><button onClick={() => deleteEntry(e)} className={`grid h-7 w-7 place-items-center rounded-lg border transition-all active:scale-90 cursor-pointer ${dk ? "border-rose-400/30 text-rose-300 hover:bg-rose-400/10" : "border-rose-200 text-rose-500 hover:bg-rose-50"}`}><Ic n="trash" className="h-3 w-3" /></button></td>
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

          {activeTab === "close" && (
            <section className={`cs-up space-y-4 md:space-y-5 p-4 md:p-7 ${uiCard}`} style={{ animationDelay: "160ms" }}>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${identIcon}`}><Ic n="lock" className="h-5 w-5" /></span>
                <div className="flex-1 min-w-0"><h2 className={`cs-display text-xl md:text-2xl leading-none ${heading}`}>بستن صندوق و شمارش واقعی</h2><p className={`mt-1 text-[11px] font-bold ${subText}`}>مقایسه موجودی ثبت‌شده با شمارش واقعی در پایان روز</p></div>
              </div>
              <div className={`rounded-xl border p-4 ${dk ? "border-amber-400/25 bg-amber-400/[0.07]" : "border-amber-300 bg-amber-50"}`}>
                <div className="flex items-start gap-2"><Ic n="alert" className={`h-4 w-4 shrink-0 mt-0.5 ${dk ? "text-amber-300" : "text-amber-600"}`} /><span className={`text-xs leading-6 ${dk ? "text-amber-200" : "text-amber-800"}`}>موجودی واقعی هر ارز را که در صندوق فیزیکی شمارش کرده‌اید وارد کنید. سیستم اختلاف را محاسبه و به‌صورت خودکار در روزنامچه ثبت می‌کند.</span></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {currencies.map(cur => {
                  const colors = currencyColors[cur];
                  const sysBal = cashBalances[cur];
                  return (
                    <div key={cur} className={`rounded-xl border p-4 ${dk ? "border-slate-700 bg-slate-900/50" : "border-slate-200 bg-slate-50"}`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-xs font-black ${colors[dk ? "dark" : "light"]}`}>{labels[cur]}</span>
                        <span className={`grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br ${colors.gradient} text-white text-[8px] font-black`}>{cur}</span>
                      </div>
                      <div className={`text-[10px] ${subText} mb-1`}>موجودی سیستم: <b className="tabular-nums">{fmt(sysBal)}</b></div>
                      <input type="text" inputMode="decimal" dir="ltr" value={closeAmounts[cur]} onChange={e => setCloseAmounts(prev => ({ ...prev, [cur]: toNumericText(e.target.value) }))} placeholder="موجودی واقعی" className={`${uiInput} text-left tabular-nums text-sm`} />
                      {closeResult && (
                        <div className={`mt-2 text-[11px] font-black tabular-nums ${closeResult[cur].diff === 0 ? dk ? "text-emerald-300" : "text-emerald-600" : closeResult[cur].diff > 0 ? dk ? "text-sky-300" : "text-sky-600" : "text-rose-500"}`}>
                          {closeResult[cur].diff === 0 ? "✅ دقیق" : closeResult[cur].diff > 0 ? `➕ اضافه: ${fmt(closeResult[cur].diff)}` : `➖ کسری: ${fmt(Math.abs(closeResult[cur].diff))}`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {closeResult && (
                <div className={`rounded-xl border p-4 ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-white"}`}>
                  <div className="flex items-center gap-2 mb-3"><Ic n="check" className={`h-4 w-4 ${dk ? "text-emerald-300" : "text-emerald-600"}`} /><b className={`text-sm font-black ${heading}`}>نتیجه شمارش</b></div>
                  <div className="overflow-x-auto cs-scroll">
                    <table className="w-full text-xs">
                      <thead><tr className={`border-b ${dk ? "border-slate-700" : "border-slate-200"}`}><th className="px-3 py-2 text-right font-black text-slate-400">ارز</th><th className="px-3 py-2 text-right font-black text-slate-400">موجودی سیستم</th><th className="px-3 py-2 text-right font-black text-slate-400">موجودی واقعی</th><th className="px-3 py-2 text-right font-black text-slate-400">اختلاف</th><th className="px-3 py-2 text-right font-black text-slate-400">وضعیت</th></tr></thead>
                      <tbody>
                        {currencies.map(cur => {
                          const r = closeResult[cur];
                          const statusText = r.diff === 0 ? "دقیق" : r.diff > 0 ? "اضافه" : "کسری";
                          const statusColor = r.diff === 0 ? dk ? "text-emerald-300" : "text-emerald-600" : r.diff > 0 ? dk ? "text-sky-300" : "text-sky-600" : "text-rose-500";
                          return (
                            <tr key={cur} className={`border-b ${dk ? "border-slate-700/50" : "border-slate-100"}`}>
                              <td className={`px-3 py-2 font-black ${currencyColors[cur][dk ? "dark" : "light"]}`}>{labels[cur]}</td>
                              <td className="px-3 py-2 font-black tabular-nums">{fmt(r.system)}</td>
                              <td className="px-3 py-2 font-black tabular-nums">{fmt(r.actual)}</td>
                              <td className={`px-3 py-2 font-black tabular-nums ${statusColor}`}>{r.diff > 0 ? "+" : ""}{fmt(r.diff)}</td>
                              <td className={`px-3 py-2 font-black ${statusColor}`}>{statusText}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                {!closeResult ? (
                  <button onClick={handleClose} className={`flex h-[50px] flex-1 min-w-[200px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-l text-base font-black shadow-lg transition-all hover:brightness-110 active:scale-[0.985] ${dk ? "from-emerald-400 to-teal-400 text-slate-950" : "from-emerald-500 to-teal-500 text-white"}`}><Ic n="lock" className="h-5 w-5" />شمارش و مقایسه</button>
                ) : (
                  <>
                    <button onClick={saveClose} className={`flex h-[50px] flex-1 min-w-[200px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-l text-base font-black shadow-lg transition-all hover:brightness-110 active:scale-[0.985] ${dk ? "from-emerald-400 to-teal-400 text-slate-950" : "from-emerald-500 to-teal-500 text-white"}`}><Ic n="check" className="h-5 w-5" />ثبت اصلاحات در روزنامچه</button>
                    <button onClick={() => setCloseResult(null)} className={`flex h-[50px] px-6 cursor-pointer items-center justify-center gap-2 rounded-xl border text-sm font-bold transition-all active:scale-95 ${dk ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>انصراف</button>
                  </>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      {previewOpen && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 md:p-4 backdrop-blur-sm" onClick={() => { setPreviewOpen(false); setPreviewData(null); }}>
          <div className={`cs-up w-full max-w-lg overflow-hidden rounded-xl md:rounded-2xl border shadow-2xl ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-white"}`} onClick={(e) => e.stopPropagation()}>
            <div className={`flex items-center justify-between border-b px-4 md:px-5 py-3 md:py-4 ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
              <b className={`flex items-center gap-2 text-sm ${dk ? "text-slate-100" : "text-slate-800"}`}><span className={`grid h-8 w-8 place-items-center rounded-lg ${dk ? "bg-emerald-400/10 text-emerald-300" : "bg-emerald-100 text-emerald-600"}`}><Ic n="doc" className="h-4 w-4" /></span>تأیید عملیات صندوق</b>
              <button onClick={() => { setPreviewOpen(false); setPreviewData(null); }} className={`grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-slate-400 transition-all duration-300 hover:rotate-90 ${dk ? "hover:bg-slate-700 hover:text-white" : "hover:bg-slate-100 hover:text-slate-700"}`}><Ic n="x" className="h-4 w-4" /></button>
            </div>
            <div className="px-4 md:px-5 py-4 space-y-4">
              <div className={`flex items-center justify-between rounded-xl border p-3 ${dk ? "border-cyan-400/30 bg-cyan-400/10" : "border-sky-300 bg-sky-50"}`}>
                <b className={`text-xs font-black ${dk ? "text-cyan-300" : "text-sky-700"}`}>کد پیگیری</b>
                <span className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-black tabular-nums ${dk ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300" : "border-sky-300 bg-sky-50 text-sky-700"}`} dir="ltr"><Ic n="tag" className="h-3.5 w-3.5" />{previewData.trackingCode}</span>
              </div>
              <div className={`rounded-xl border p-4 ${dk ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"}`}>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className={subText}>نوع: </span><b>{entryTypeLabels[previewData.type]}</b></div>
                  <div><span className={subText}>ارز: </span><b>{labels[previewData.currency]}</b></div>
                  <div><span className={subText}>مبلغ: </span><b className={`tabular-nums ${previewData.direction === "in" ? dk ? "text-emerald-300" : "text-emerald-700" : "text-rose-500"}`}>{fmt(previewData.amount)}</b></div>
                  <div><span className={subText}>جهت: </span><b>{previewData.direction === "in" ? "دریافت ➕" : "پرداخت ➖"}</b></div>
                  {previewData.customerName && (<div className="col-span-2"><span className={subText}>مشتری: </span><b>{previewData.customerName}</b></div>)}
                  <div className="col-span-2"><span className={subText}>شرح: </span><b>{previewData.reason}</b></div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <button onClick={confirmRegister} className={`flex h-[48px] flex-1 min-w-[180px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-l text-sm font-black shadow-lg transition-all hover:brightness-110 active:scale-[0.98] ${dk ? "from-emerald-400 to-teal-400 text-slate-950" : "from-emerald-500 to-teal-500 text-white"}`}>ثبت نهایی<Ic n="check" className="h-4 w-4" /></button>
                <button onClick={() => { setPreviewOpen(false); setPreviewData(null); }} className={`flex h-[48px] px-6 cursor-pointer items-center justify-center rounded-xl border text-sm font-bold transition-all active:scale-95 ${dk ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>انصراف</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (<div className={`fixed bottom-6 left-6 z-[99] rounded-xl px-4 py-3 text-sm font-bold shadow-lg ${dk ? "bg-slate-800 text-slate-100 border border-slate-600" : "bg-slate-900 text-white"}`}>{toast}</div>)}
    </div>
  );
}
