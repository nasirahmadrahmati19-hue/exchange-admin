"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useSyncedState } from "../lib/useSyncedState";
import { CUSTOMERS_KEY, TRANSACTIONS_KEY, CASH_KEY, HAWALAS_KEY } from "../lib/defaultData";

// ============================================================
// تایپ‌ها و ثابت‌ها
// ============================================================
type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";
const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const labels: Record<Currency, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };
const flags: Record<Currency, string> = { AFN: "🇦🇫", USD: "🇺🇸", EUR: "🇪🇺", IRR: "🇮🇷", PKR: "🇵🇰" };

const CASH_BOX_ID = "CASH_BOX";
const EXCHANGE_ACCOUNT_ID = "EXCHANGE_ACCOUNT";

interface Customer {
  id: string;
  name: string;
  phone?: string;
  tazkira?: string;
  address?: string;
  note?: string;
  telegram?: string;
  telegramChatId?: string;
  registeredAt: string;
  balances: Record<Currency, number>;
}

const emptyBalances: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };

const fmt = (n: number) => Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0";

const newId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try { return crypto.randomUUID(); } catch {}
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
};

const normalizeDigits = (s: string) =>
  String(s || "")
    .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

function shamsiParts(d: Date) {
  try {
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
    const g = (t: string) => parts.find(p => p.type === t)?.value || "0";
    return { year: g("year"), month: g("month"), day: g("day") };
  } catch { return { year: "0", month: "0", day: "0" }; }
}

function formatShamsiDate(d: Date) {
  const s = shamsiParts(d);
  return `${s.year}/${s.month}/${s.day}`;
}

// ============================================================
// توابع محاسبه موجودی (محلی - بدون ایمپورت خارجی)
// ============================================================
function computeCustomerBalance(customerId: string, transactions: any[], hawalas: any[], cashEntries: any[]): Record<Currency, number> {
  const balances: Record<Currency, number> = { ...emptyBalances };
  if (!customerId || customerId === CASH_BOX_ID || customerId === EXCHANGE_ACCOUNT_ID) return balances;

  const add = (currency: Currency, amount: number) => {
    if (!currencies.includes(currency) || !Number.isFinite(amount)) return;
    balances[currency] += amount;
  };

  for (const tx of transactions) {
    if (!tx || tx.status === "voided") continue;
    if (tx.type === "exchange" && tx.customerId === customerId) {
      if (tx.dealType === "sell") add(tx.fromCurrency, -Number(tx.fromAmount || 0));
      else if (tx.dealType === "buy") add(tx.toCurrency, Number(tx.toAmount || 0));
      else {
        add(tx.fromCurrency, -Number(tx.fromAmount || 0));
        add(tx.toCurrency, Number(tx.toAmount || 0));
      }
      if (tx.commission && tx.commissionCurrency) add(tx.commissionCurrency, -Number(tx.commission || 0));
    }
    if (tx.type === "transfer") {
      if (tx.senderId === customerId) {
        add(tx.fromCurrency, -Number(tx.fromAmount || 0));
        if (tx.commissionPayer === "sender" && tx.commission && tx.commissionCurrency) add(tx.commissionCurrency, -Number(tx.commission || 0));
      }
      if (tx.receiverId === customerId) {
        add(tx.toCurrency, Number(tx.toAmount || 0));
        if (tx.commissionPayer === "receiver" && tx.commission && tx.commissionCurrency) add(tx.commissionCurrency, -Number(tx.commission || 0));
      }
    }
    if (tx.type === "convert" && tx.customerId === customerId) {
      add(tx.fromCurrency, -Number(tx.fromAmount || 0));
      add(tx.toCurrency, Number(tx.toAmount || 0));
      if (tx.commission && tx.commissionCurrency) add(tx.commissionCurrency, -Number(tx.commission || 0));
    }
  }

  for (const h of hawalas) {
    if (!h || h.status === "cancelled") continue;
    if (h.senderId === customerId) {
      add(h.currencyFrom, -Number(h.amountFrom || 0));
      if (h.feePayer === "sender" && h.fee > 0 && h.feeCurrency) add(h.feeCurrency, -Number(h.fee || 0));
    }
    if (h.receiverId === customerId && h.status === "paid") {
      add(h.currencyTo, Number(h.finalAmount || 0));
      if (h.feePayer === "receiver" && h.fee > 0 && h.feeCurrency) add(h.feeCurrency, -Number(h.fee || 0));
    }
  }

  for (const ce of cashEntries) {
    if (!ce || ce.status === "voided" || ce.customerId !== customerId) continue;
    if (ce.linkedExchangeId || ce.linkedTransferId || ce.linkedConvertId || ce.linkedHawalaId || ce.linkedHawalaSettleId) continue;
    const amount = Number(ce.amount || 0);
    if (!amount || !currencies.includes(ce.currency as Currency)) continue;
    if (ce.type === "customer_deposit" || ce.type === "loan_received") add(ce.currency, amount);
    else if (ce.type === "customer_withdraw" || ce.type === "loan_given") add(ce.currency, -amount);
  }

  return balances;
}

// ============================================================
// آیکون‌ها
// ============================================================
const iconPaths: Record<string, string> = {
  user: "M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z",
  users: "M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z",
  plus: "M12 4.5v15m7.5-7.5h-15",
  search: "m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 1 10.607 10.607Z",
  x: "M6 18 18 6M6 6l12 12",
  check: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  pencil: "m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10",
  trash: "M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0",
  wallet: "M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3",
  eye: "M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  chevron: "m19.5 8.25-7.5 7.5-7.5-7.5",
  inbox: "M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z",
  alert: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z",
  sun: "M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.375 3.375 0 1 1-7.5 0 3.375 3.375 0 0 1 7.5 0Z",
  moon: "M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z",
  more: "M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z",
  phone: "M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z",
  id: "M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 6.72 6.72 0 0 0 1.41 2.48 6.721 6.721 0 0 0 3.513 1.545 6.72 6.72 0 0 0 3.516-1.545 6.72 6.72 0 0 0 1.41-2.48Z",
  telegram: "M6 12 3.269 3.126A59.768 59.768 0 0 1 21.485 12 59.77 59.77 0 0 1 3.27 20.876L5.999 12Zm0 0h7.5",
  note: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
};

const Ic = ({ n, className = "h-5 w-5" }: { n: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d={iconPaths[n] || ""} /></svg>
);

// ============================================================
// کامپوننت اصلی
// ============================================================
export default function UsersPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [customers, setCustomers] = useSyncedState<Customer[]>(CUSTOMERS_KEY, []);
  const [transactions] = useSyncedState<any[]>(TRANSACTIONS_KEY, []);
  const [hawalas] = useSyncedState<any[]>(HAWALAS_KEY, []);
  const [cashEntries] = useSyncedState<any[]>(CASH_KEY, []);

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [toast, setToast] = useState("");
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formTazkira, setFormTazkira] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formTelegram, setFormTelegram] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ✅ اصلاح حیاتی: تغییر نوع Ref به HTMLTableCellElement برای هماهنگی با <td>
  const actionRef = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    try {
      const s = window.localStorage.getItem("fx-theme");
      if (s === "dark" || s === "light") setTheme(s);
    } catch {}
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem("fx-theme", theme); } catch {}
  }, [theme]);

  const dk = theme === "dark";

  useEffect(() => {
    if (!openActionId) return;
    const handler = (e: MouseEvent) => {
      if (actionRef.current && !actionRef.current.contains(e.target as Node)) setOpenActionId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openActionId]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }, []);

  const realCustomers = useMemo(() => {
    return customers.filter(c => c.id !== CASH_BOX_ID && c.id !== EXCHANGE_ACCOUNT_ID);
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return realCustomers;
    const q = normalizeDigits(search.trim()).toLowerCase();
    return realCustomers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.phone && normalizeDigits(c.phone).includes(q)) ||
      (c.tazkira && normalizeDigits(c.tazkira).includes(q))
    );
  }, [realCustomers, search]);

  const getLiveBalance = useCallback((customerId: string): Record<Currency, number> => {
    return computeCustomerBalance(customerId, transactions, hawalas, cashEntries);
  }, [transactions, hawalas, cashEntries]);

  const hasAnyDebt = useCallback((customerId: string): boolean => {
    const bal = getLiveBalance(customerId);
    return currencies.some(c => bal[c] < 0);
  }, [getLiveBalance]);

  const hasAnyCredit = useCallback((customerId: string): boolean => {
    const bal = getLiveBalance(customerId);
    return currencies.some(c => bal[c] > 0);
  }, [getLiveBalance]);

  const handleSave = useCallback(() => {
    const errs: Record<string, string> = {};
    if (!formName.trim()) errs.name = "نام مشتری ضروری است.";
    if (!formPhone.trim()) errs.phone = "شماره تماس ضروری است.";
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    if (editingId) {
      setCustomers((prev: Customer[]) =>
        prev.map(c =>
          c.id === editingId
            ? { ...c, name: formName.trim(), phone: formPhone.trim(), tazkira: formTazkira.trim(), address: formAddress.trim(), telegram: formTelegram.trim(), note: formNote.trim() }
            : c
        )
      );
      showToast("✅ اطلاعات مشتری با موفقیت به‌روز شد.");
    } else {
      const newCustomer: Customer = {
        id: newId(),
        name: formName.trim(),
        phone: formPhone.trim(),
        tazkira: formTazkira.trim(),
        address: formAddress.trim(),
        telegram: formTelegram.trim(),
        telegramChatId: "",
        note: formNote.trim(),
        registeredAt: new Date().toISOString(),
        balances: { ...emptyBalances },
      };
      setCustomers((prev: Customer[]) => [...prev, newCustomer]);
      showToast("✅ مشتری جدید با موفقیت ثبت شد.");
    }
    resetForm();
  }, [formName, formPhone, formTazkira, formAddress, formTelegram, formNote, editingId, setCustomers, showToast]);

  const resetForm = useCallback(() => {
    setFormName(""); setFormPhone(""); setFormTazkira(""); setFormAddress(""); setFormTelegram(""); setFormNote("");
    setFormErrors({}); setEditingId(null); setShowForm(false);
  }, []);

  const startEdit = useCallback((c: Customer) => {
    setEditingId(c.id); setFormName(c.name); setFormPhone(c.phone || ""); setFormTazkira(c.tazkira || "");
    setFormAddress(c.address || ""); setFormTelegram(c.telegram || ""); setFormNote(c.note || "");
    setFormErrors({}); setShowForm(true); setOpenActionId(null);
  }, []);

  const handleDelete = useCallback((c: Customer) => {
    if (!window.confirm(`آیا از حذف مشتری "${c.name}" مطمئن هستید؟\nاین عمل قابل بازگشت نیست.`)) return;
    setCustomers((prev: Customer[]) => prev.filter(x => x.id !== c.id));
    showToast(`🗑️ مشتری "${c.name}" حذف شد.`);
    setOpenActionId(null);
  }, [setCustomers, showToast]);

  const heading = dk ? "text-white" : "text-slate-900";
  const subText = dk ? "text-slate-500" : "text-slate-400";
  const uiCard = `rounded-2xl border backdrop-blur transition-colors duration-300 ${dk ? "border-slate-700 bg-slate-800/90 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.6)]" : "border-emerald-100 bg-white/95 shadow-[0_16px_40px_-28px_rgba(16,185,129,0.35)]"}`;
  const inputShell = `rounded-xl border text-sm font-medium shadow-sm outline-none transition-all duration-200 focus:ring-4 ${dk ? "border-slate-600 bg-slate-900 text-slate-100 placeholder:text-slate-500 hover:border-slate-500 focus:border-emerald-400 focus:ring-emerald-400/10" : "border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 hover:border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500/10"}`;
  const uiInput = `h-12 w-full px-3.5 ${inputShell}`;
  const errInput = dk ? "border-rose-500 bg-rose-500/10 ring-rose-500/20" : "border-rose-500 bg-rose-50 ring-rose-500/20";
  const uiLabel = `mb-1.5 block text-[11px] font-black tracking-wide ${dk ? "text-slate-400" : "text-slate-500"}`;

  return (
    <div dir="rtl" className={dk ? "dark" : ""}>
      <style>{`@import url("https://fonts.googleapis.com/css2?family=Lalezar&family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap");.us-font{font-family:"Vazirmatn","Segoe UI",Tahoma,sans-serif}.us-display{font-family:"Lalezar","Vazirmatn",Tahoma,sans-serif;letter-spacing:.01em}.dark{color-scheme:dark}@keyframes usUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}.us-up{animation:usUp .5s cubic-bezier(.22,.8,.35,1) both}::selection{background:rgba(16,185,129,.25)}`}</style>
      <div className={`us-font relative min-h-screen overflow-x-hidden antialiased transition-colors duration-500 ${dk ? "bg-[#0f172a] text-slate-100" : "bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 text-slate-800"}`}>
        <div className={`fixed inset-x-0 top-0 z-30 h-1 bg-gradient-to-l ${dk ? "from-emerald-400 via-teal-400 to-cyan-400" : "from-emerald-500 via-teal-500 to-cyan-500"}`} />
        <div className="relative z-10 mx-auto w-full max-w-7xl space-y-4 md:space-y-6 px-3 pb-16 pt-5 md:px-8 md:pt-9">

          <header className="us-up flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0">
              <div className="relative grid h-11 w-11 md:h-14 md:w-14 shrink-0 place-items-center rounded-xl md:rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-400 text-white shadow-lg shadow-emerald-500/30 ring-1 ring-white/30">
                <Ic n="users" className="h-5 w-5 md:h-6 md:w-6" />
                <span className={`absolute -bottom-1 -left-1 md:-bottom-1.5 md:-left-1.5 grid h-4 min-w-4 md:h-5 md:min-w-5 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-400 px-1 text-[7px] md:text-[8px] font-black text-white ring-2 ${dk ? "ring-[#0f172a]" : "ring-[#ecfdf5]"}`}>US</span>
              </div>
              <div className="min-w-0">
                <h1 className={`us-display text-2xl md:text-4xl leading-none ${heading}`}>مشتریان</h1>
                <p className={`mt-1 text-[10px] md:text-xs font-bold ${subText}`}>مدیریت اطلاعات و موجودی حساب مشتریان</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2.5">
              <div className={`hidden sm:flex items-center gap-2 rounded-xl border px-3 py-2 shadow-sm backdrop-blur ${dk ? "border-slate-600/70 bg-slate-800/80" : "border-emerald-100 bg-white/85"}`}>
                <span className={`rounded-full px-3 py-1 text-[11px] font-black ${dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-700"}`}>
                  {realCustomers.length} مشتری
                </span>
              </div>
              <button onClick={() => setTheme(dk ? "light" : "dark")} className={`group grid h-10 w-10 md:h-11 md:w-11 cursor-pointer place-items-center rounded-lg md:rounded-xl border shadow-sm backdrop-blur transition-all duration-300 active:scale-90 ${dk ? "border-slate-600 bg-slate-800/85 text-amber-300 hover:border-amber-300" : "border-slate-200 bg-white/85 text-slate-600 hover:border-emerald-400"}`}>
                {dk ? <Ic n="sun" className="h-4 w-4 group-hover:rotate-45 transition-transform duration-500" /> : <Ic n="moon" className="h-4 w-4 group-hover:-rotate-12 transition-transform duration-500" />}
              </button>
            </div>
          </header>

          <div className="us-up flex flex-col sm:flex-row gap-3" style={{ animationDelay: "70ms" }}>
            <div className="relative flex-1">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو بر اساس نام، تلفن یا تذکره..." className={`${uiInput} pr-10`} />
              <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${subText}`}><Ic n="search" className="h-4 w-4" /></span>
            </div>
            <button onClick={() => { resetForm(); setShowForm(true); }} className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black transition-all active:scale-95 shadow-lg ${dk ? "bg-gradient-to-l from-emerald-400 to-teal-400 text-slate-950 hover:brightness-110" : "bg-gradient-to-l from-emerald-500 via-teal-500 to-cyan-500 text-white hover:brightness-110"}`}>
              <Ic n="plus" className="h-4 w-4" /> ثبت مشتری جدید
            </button>
          </div>

          {showForm && (
            <section className={`us-up space-y-4 p-4 md:p-7 ${uiCard}`} style={{ animationDelay: "140ms" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className={`grid h-9 w-9 place-items-center rounded-xl ${dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-600"}`}>
                    <Ic n={editingId ? "pencil" : "plus"} className="h-4 w-4" />
                  </span>
                  <h2 className={`us-display text-xl ${heading}`}>{editingId ? "ویرایش مشتری" : "ثبت مشتری جدید"}</h2>
                </div>
                <button onClick={resetForm} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-700/50 transition"><Ic n="x" className="h-5 w-5" /></button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className={uiLabel}>نام مشتری *</label>
                  <input value={formName} onChange={e => { setFormName(e.target.value); setFormErrors(p => ({ ...p, name: "" })); }} placeholder="مثلاً: علی احمدی" className={`${uiInput} ${formErrors.name ? errInput : ""}`} />
                  {formErrors.name && <p className="text-[10px] text-rose-500 mt-1 font-bold">{formErrors.name}</p>}
                </div>
                <div>
                  <label className={uiLabel}>شماره تماس *</label>
                  <input value={formPhone} onChange={e => { setFormPhone(e.target.value); setFormErrors(p => ({ ...p, phone: "" })); }} placeholder="07xxxxxxxx" dir="ltr" className={`${uiInput} text-left ${formErrors.phone ? errInput : ""}`} />
                  {formErrors.phone && <p className="text-[10px] text-rose-500 mt-1 font-bold">{formErrors.phone}</p>}
                </div>
                <div>
                  <label className={uiLabel}>شماره تذکره</label>
                  <input value={formTazkira} onChange={e => setFormTazkira(e.target.value)} placeholder="اختیاری" dir="ltr" className={`${uiInput} text-left`} />
                </div>
                <div>
                  <label className={uiLabel}>آدرس</label>
                  <input value={formAddress} onChange={e => setFormAddress(e.target.value)} placeholder="اختیاری" className={uiInput} />
                </div>
                <div>
                  <label className={uiLabel}>تلگرام / چت آی‌دی</label>
                  <input value={formTelegram} onChange={e => setFormTelegram(e.target.value)} placeholder="@username یا chat_id" dir="ltr" className={`${uiInput} text-left`} />
                </div>
                <div>
                  <label className={uiLabel}>یادداشت</label>
                  <input value={formNote} onChange={e => setFormNote(e.target.value)} placeholder="اختیاری" className={uiInput} />
                </div>
              </div>
              <button onClick={handleSave} className={`flex h-[50px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-l text-base font-black shadow-lg transition-all hover:brightness-110 active:scale-[0.985] ${dk ? "from-emerald-400 to-teal-400 text-slate-950" : "from-emerald-500 via-teal-500 to-cyan-500 text-white"}`}>
                <Ic n="check" className="h-5 w-5" /> {editingId ? "ذخیره تغییرات" : "ثبت مشتری"}
              </button>
            </section>
          )}

          <section className={`us-up overflow-hidden ${uiCard}`} style={{ animationDelay: "210ms" }}>
            <div className="flex flex-wrap items-center gap-3 p-4 md:p-5 pb-3 md:pb-4 md:px-7 md:pt-6">
              <span className={`grid h-10 w-10 md:h-11 md:w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${dk ? "from-emerald-400/20 to-teal-400/5 text-emerald-300 ring-emerald-400/25" : "from-emerald-400/20 to-teal-400/10 text-emerald-600 ring-emerald-400/30"}`}>
                <Ic n="users" className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <h2 className={`us-display text-xl md:text-2xl leading-none ${heading}`}>لیست مشتریان</h2>
                <p className={`mt-1 text-[11px] font-bold ${subText}`}>موجودی حساب‌ها به صورت زنده محاسبه می‌شود</p>
              </div>
              <span className={`rounded-full px-3 py-1.5 text-[10px] font-black ring-1 ${dk ? "bg-emerald-400/15 text-emerald-300 ring-emerald-400/25" : "bg-emerald-100 text-emerald-700 ring-emerald-300/60"}`}>
                {filteredCustomers.length} نفر
              </span>
            </div>

            <div className="px-4 md:px-7 pb-4">
              {filteredCustomers.length === 0 ? (
                <div className={`flex flex-col items-center gap-3 py-16 ${dk ? "text-slate-500" : "text-slate-400"}`}>
                  <div className={`grid h-16 w-16 place-items-center rounded-2xl border border-dashed ${dk ? "border-slate-600 bg-slate-800/40" : "border-slate-300 bg-slate-50"}`}>
                    <Ic n="inbox" className="h-7 w-7 opacity-70" />
                  </div>
                  <p className="text-sm font-black">{search ? "مشتری‌ای با این مشخصات یافت نشد." : "هنوز مشتری‌ای ثبت نشده است."}</p>
                </div>
              ) : (
                <>
                  <div className="md:hidden space-y-3">
                    {filteredCustomers.map((c) => {
                      const bal = getLiveBalance(c.id);
                      const isDebtor = hasAnyDebt(c.id);
                      const isCreditor = hasAnyCredit(c.id);
                      return (
                        <div key={c.id} className={`rounded-xl border p-4 ${isDebtor ? (dk ? "border-rose-400/30 bg-rose-400/[0.03]" : "border-rose-200 bg-rose-50/30") : isCreditor ? (dk ? "border-emerald-400/30 bg-emerald-400/[0.03]" : "border-emerald-200 bg-emerald-50/30") : (dk ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-white")}`}>
                          <div className="flex items-center gap-3 mb-3">
                            <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white font-black text-sm">{c.name.charAt(0)}</span>
                            <div className="flex-1 min-w-0">
                              <b className={`block text-sm font-black ${dk ? "text-white" : "text-slate-900"}`}>{c.name}</b>
                              {c.phone && <span className={`text-[11px] ${subText}`} dir="ltr">📞 {c.phone}</span>}
                            </div>
                            {isDebtor && <span className="text-[9px] font-black text-rose-500 bg-rose-500/10 px-2 py-1 rounded">⚠️ بدهکار</span>}
                            {isCreditor && <span className={`text-[9px] font-black ${dk ? "text-emerald-300 bg-emerald-400/10" : "text-emerald-700 bg-emerald-100"} px-2 py-1 rounded`}>✅ طلبکار</span>}
                          </div>
                          <div className="grid grid-cols-5 gap-1 mb-3">
                            {currencies.map(cur => {
                              const b = bal[cur] || 0;
                              return (
                                <div key={cur} className={`rounded-lg px-1 py-1.5 text-center ${dk ? "bg-slate-900/50" : "bg-slate-50"}`}>
                                  <div className={`text-[8px] font-black ${subText}`}>{flags[cur]}</div>
                                  <div className={`text-[10px] font-black tabular-nums ${b < 0 ? "text-rose-500" : b > 0 ? (dk ? "text-emerald-300" : "text-emerald-700") : subText}`}>{fmt(b)}</div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => setSelectedCustomer(c)} className={`flex-1 py-2 rounded-lg text-[11px] font-black ${dk ? "bg-sky-500/20 text-sky-300 hover:bg-sky-500/30" : "bg-sky-100 text-sky-700 hover:bg-sky-200"}`}>
                              <Ic n="eye" className="h-3 w-3 inline ml-1" /> مشاهده
                            </button>
                            <button onClick={() => startEdit(c)} className={`flex-1 py-2 rounded-lg text-[11px] font-black ${dk ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30" : "bg-amber-100 text-amber-700 hover:bg-amber-200"}`}>
                              <Ic n="pencil" className="h-3 w-3 inline ml-1" /> ویرایش
                            </button>
                            <button onClick={() => handleDelete(c)} className={`py-2 px-3 rounded-lg text-[11px] font-black ${dk ? "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30" : "bg-rose-100 text-rose-700 hover:bg-rose-200"}`}>
                              <Ic n="trash" className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="hidden md:block overflow-x-auto">
                    <div className="max-h-[672px] overflow-y-auto">
                      <table className="w-full min-w-[1100px] text-sm">
                        <thead className="sticky top-0 z-10">
                          <tr className={`border-y ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
                            {["#", "نام", "تلفن", "تذکره", "افغانی", "دالر", "یورو", "تومان", "کلدار", "وضعیت", "عملیات"].map(h => (
                              <th key={h} className="px-3 py-3 text-center text-[11px] font-black text-slate-400 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className={`divide-y ${dk ? "divide-slate-700/60" : "divide-slate-100"}`}>
                          {filteredCustomers.map((c, idx) => {
                            const bal = getLiveBalance(c.id);
                            const isDebtor = hasAnyDebt(c.id);
                            const isCreditor = hasAnyCredit(c.id);
                            const isOpen = openActionId === c.id;

                            return (
                              <tr key={c.id} className={`transition-colors ${dk ? "hover:bg-slate-700/30" : "hover:bg-emerald-50/50"}`}>
                                <td className="px-3 py-3 text-center">
                                  <span className={`inline-grid h-7 w-7 place-items-center rounded-lg text-[10px] font-black ${dk ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"}`}>{idx + 1}</span>
                                </td>
                                <td className="px-3 py-3 text-center">
                                  <div className="flex items-center gap-2 justify-center">
                                    <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-[10px] font-black">{c.name.charAt(0)}</span>
                                    <span className={`text-[12px] font-bold ${dk ? "text-slate-200" : "text-slate-700"}`}>{c.name}</span>
                                  </div>
                                </td>
                                <td className={`px-3 py-3 text-center text-[11px] font-bold tabular-nums ${dk ? "text-slate-300" : "text-slate-600"}`} dir="ltr">{c.phone || "—"}</td>
                                <td className={`px-3 py-3 text-center text-[11px] font-bold tabular-nums ${dk ? "text-slate-300" : "text-slate-600"}`} dir="ltr">{c.tazkira || "—"}</td>
                                {currencies.map(cur => {
                                  const b = bal[cur] || 0;
                                  return (
                                    <td key={cur} className={`px-3 py-3 text-center text-[11px] font-black tabular-nums ${b < 0 ? "text-rose-500" : b > 0 ? (dk ? "text-emerald-300" : "text-emerald-600") : subText}`}>
                                      {fmt(b)}
                                    </td>
                                  );
                                })}
                                <td className="px-3 py-3 text-center">
                                  {isDebtor ? (
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-black ${dk ? "bg-rose-400/15 text-rose-300" : "bg-rose-100 text-rose-700"}`}>⚠️ بدهکار</span>
                                  ) : isCreditor ? (
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-black ${dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-700"}`}>✅ طلبکار</span>
                                  ) : (
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-black ${dk ? "bg-slate-700 text-slate-400" : "bg-slate-100 text-slate-500"}`}>⚪ صفر</span>
                                  )}
                                </td>
                                {/* ✅ اصلاح شده: ref اکنون با نوع HTMLTableCellElement هماهنگ است */}
                                <td className="px-3 py-3 text-center" ref={isOpen ? actionRef : undefined}>
                                  <div className="relative flex justify-center">
                                    <button onClick={() => setOpenActionId(isOpen ? null : c.id)} className={`grid h-8 w-8 place-items-center rounded-lg border transition-all active:scale-90 cursor-pointer ${dk ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-200 text-slate-500 hover:bg-slate-100"}`}>
                                      <Ic n="more" className="h-4 w-4" />
                                    </button>
                                    {isOpen && (
                                      <div className={`absolute left-1/2 -translate-x-1/2 top-full z-50 mt-1.5 w-40 overflow-hidden rounded-xl border shadow-xl ${dk ? "border-slate-600 bg-slate-800" : "border-slate-200 bg-white"}`}>
                                        <button onClick={() => { setSelectedCustomer(c); setOpenActionId(null); }} className={`flex w-full items-center gap-2 px-3 py-2 text-right text-xs font-bold transition ${dk ? "text-cyan-300 hover:bg-cyan-400/15" : "text-cyan-600 hover:bg-cyan-50"}`}>
                                          <Ic n="eye" className="h-3.5 w-3.5" /> مشاهده
                                        </button>
                                        <button onClick={() => startEdit(c)} className={`flex w-full items-center gap-2 px-3 py-2 text-right text-xs font-bold transition ${dk ? "text-sky-300 hover:bg-sky-400/15" : "text-sky-600 hover:bg-sky-50"}`}>
                                          <Ic n="pencil" className="h-3.5 w-3.5" /> ویرایش
                                        </button>
                                        <div className={`my-1 h-px ${dk ? "bg-slate-700" : "bg-slate-100"}`} />
                                        <button onClick={() => handleDelete(c)} className={`flex w-full items-center gap-2 px-3 py-2 text-right text-xs font-bold transition ${dk ? "text-rose-300 hover:bg-rose-400/15" : "text-rose-500 hover:bg-rose-50"}`}>
                                          <Ic n="trash" className="h-3.5 w-3.5" /> حذف
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          <div className={`us-up text-center py-4 text-[11px] font-bold ${subText}`} style={{ animationDelay: "280ms" }}>
            🏦 صرافی برادران نورزاد — هرات
          </div>
        </div>
      </div>

      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm" onClick={() => setSelectedCustomer(null)}>
          <div className={`w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-white"}`} onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between border-b px-5 py-4 ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white font-black">{selectedCustomer.name.charAt(0)}</span>
                <div>
                  <h3 className={`text-sm font-black ${dk ? "text-white" : "text-slate-800"}`}>{selectedCustomer.name}</h3>
                  <p className={`text-[10px] font-bold ${subText}`}>{selectedCustomer.phone || "بدون تلفن"}</p>
                </div>
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-700/50"><Ic n="x" className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className={`rounded-xl p-3 ${dk ? "bg-slate-800/50" : "bg-slate-50"}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Ic n="id" className={`h-3.5 w-3.5 ${subText}`} />
                    <p className={`text-[10px] font-black ${subText}`}>تذکره</p>
                  </div>
                  <p className={`font-bold ${dk ? "text-slate-200" : "text-slate-700"}`} dir="ltr">{selectedCustomer.tazkira || "—"}</p>
                </div>
                <div className={`rounded-xl p-3 ${dk ? "bg-slate-800/50" : "bg-slate-50"}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Ic n="telegram" className={`h-3.5 w-3.5 ${subText}`} />
                    <p className={`text-[10px] font-black ${subText}`}>تلگرام</p>
                  </div>
                  <p className={`font-bold ${dk ? "text-slate-200" : "text-slate-700"}`} dir="ltr">{selectedCustomer.telegram || "—"}</p>
                </div>
              </div>
              {selectedCustomer.address && (
                <div className={`rounded-xl p-3 ${dk ? "bg-slate-800/50" : "bg-slate-50"}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Ic n="phone" className={`h-3.5 w-3.5 ${subText}`} />
                    <p className={`text-[10px] font-black ${subText}`}>آدرس</p>
                  </div>
                  <p className={`font-bold ${dk ? "text-slate-200" : "text-slate-700"}`}>{selectedCustomer.address}</p>
                </div>
              )}
              {selectedCustomer.note && (
                <div className={`rounded-xl p-3 ${dk ? "bg-slate-800/50" : "bg-slate-50"}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Ic n="note" className={`h-3.5 w-3.5 ${subText}`} />
                    <p className={`text-[10px] font-black ${subText}`}>یادداشت</p>
                  </div>
                  <p className={`font-bold ${dk ? "text-slate-200" : "text-slate-700"}`}>{selectedCustomer.note}</p>
                </div>
              )}
              <div>
                <p className={`text-xs font-black mb-3 flex items-center gap-1.5 ${dk ? "text-emerald-300" : "text-emerald-700"}`}>
                  <Ic n="wallet" className="h-4 w-4" /> موجودی حساب (محاسبه‌شده از تمام تراکنش‌ها)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {currencies.map(cur => {
                    const b = getLiveBalance(selectedCustomer.id)[cur] || 0;
                    const isDebt = b < 0;
                    const isCredit = b > 0;
                    return (
                      <div key={cur} className={`rounded-xl p-3 text-center border ${isDebt ? (dk ? "border-rose-400/30 bg-rose-400/5" : "border-rose-200 bg-rose-50") : isCredit ? (dk ? "border-emerald-400/30 bg-emerald-400/5" : "border-emerald-200 bg-emerald-50") : (dk ? "border-slate-700 bg-slate-800/30" : "border-slate-200 bg-slate-50")}`}>
                        <p className={`text-[9px] font-black ${subText}`}>{flags[cur]} {labels[cur]}</p>
                        <p className={`text-sm font-black mt-1 tabular-nums ${isDebt ? "text-rose-500" : isCredit ? (dk ? "text-emerald-300" : "text-emerald-600") : subText}`}>{fmt(b)}</p>
                        <p className="text-[8px] font-black mt-0.5">
                          {isDebt && <span className="text-rose-500">قرض</span>}
                          {isCredit && <span className={dk ? "text-emerald-300" : "text-emerald-600"}>طلب</span>}
                          {!isDebt && !isCredit && <span className={subText}>صفر</span>}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className={`rounded-xl p-3 ${dk ? "bg-slate-800/30" : "bg-slate-50"}`}>
                <p className={`text-[10px] font-black ${subText}`}>تاریخ ثبت</p>
                <p className={`text-xs font-bold mt-1 ${dk ? "text-slate-300" : "text-slate-600"}`} dir="ltr">
                  {selectedCustomer.registeredAt ? formatShamsiDate(new Date(selectedCustomer.registeredAt)) : "—"}
                </p>
              </div>
            </div>
            <div className={`border-t px-5 py-4 flex gap-3 ${dk ? "border-slate-700 bg-slate-800/30" : "border-slate-100 bg-slate-50"}`}>
              <button onClick={() => { startEdit(selectedCustomer); setSelectedCustomer(null); }} className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-black transition active:scale-95 ${dk ? "bg-sky-500 text-slate-950 hover:bg-sky-400" : "bg-sky-600 text-white hover:bg-sky-700"}`}>
                <Ic n="pencil" className="h-4 w-4" /> ویرایش
              </button>
              <button onClick={() => setSelectedCustomer(null)} className={`flex-1 rounded-xl py-2.5 text-sm font-black border transition active:scale-95 ${dk ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-200 text-slate-600 hover:bg-slate-100"}`}>بستن</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[99] rounded-xl px-5 py-3 text-sm font-black shadow-lg ${dk ? "bg-slate-800 text-slate-100 border border-slate-600" : "bg-slate-900 text-white"}`}>
          {toast}
        </div>
      )}
    </div>
  );
}
