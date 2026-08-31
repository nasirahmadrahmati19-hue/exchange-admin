"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useSyncedState } from "../lib/useSyncedState";
import { initTrackingSystem } from "../lib/trackingCode";
import { CUSTOMERS_KEY, TRANSACTIONS_KEY, CASH_KEY, HAWALAS_KEY } from "../lib/defaultData";

// ============================================================
// Types
// ============================================================
type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";

type Customer = {
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
};

type Transaction = {
  id: string;
  trackingCode: string;
  type: "exchange" | "transfer" | "convert";
  dealType?: "buy" | "sell";
  date: string;
  customerId?: string;
  customerName?: string;
  senderId?: string;
  senderName?: string;
  receiverId?: string;
  receiverName?: string;
  fromCurrency: Currency;
  fromAmount: number;
  toCurrency: Currency;
  toAmount: number;
  rate: number;
  rateLabel: string;
  commission?: number;
  commissionCurrency?: Currency;
  commissionPayer?: "sender" | "receiver";
  description?: string;
  status: "active" | "voided";
};

type CashEntry = {
  id: string;
  trackingCode: string;
  date: string;
  type: string;
  currency: Currency;
  amount: number;
  direction: "in" | "out";
  reason?: string;
  status: "active" | "voided";
  customerId?: string;
  customerName?: string;
  linkedExchangeId?: string;
  linkedTransferId?: string;
  linkedConvertId?: string;
  linkedHawalaId?: string;
  linkedHawalaSettleId?: string;
};

// ============================================================
// Constants
// ============================================================
const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const labels: Record<Currency, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };
const CASH_BOX_ID = "CASH_BOX";
const EXCHANGE_ACCOUNT_ID = "EXCHANGE_ACCOUNT";

// ============================================================
// Icons
// ============================================================
const iconPaths: Record<string, string> = {
  users: "M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z",
  user: "M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z",
  sun: "M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.375 3.375 0 1 1-7.5 0 3.375 3.375 0 0 1 7.5 0Z",
  moon: "M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z",
  search: "m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 1 10.607 10.607Z",
  chevron: "m19.5 8.25-7.5 7.5-7.5-7.5",
  alert: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z",
  doc: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
  calendar: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5",
  x: "M6 18 18 6M6 6l12 12",
  tag: "M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z",
  share: "M7.21 14 2.1 9l2.24-2.24a12 12 0 0 0 15.09 0L21.67 9l-5.11 5a9.5 9.5 0 0 1-9.35 0ZM4.03 19.5h15.94",
  eye: "M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  inbox: "M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z",
  check: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  copy: "M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125h3.375m7.5 10.5V8.39a1.125 1.125 0 0 1 .33-.795l2.355-2.355a1.125 1.125 0 0 1 .795-.33v12.34a1.125 1.125 0 0 1-1.125 1.125h-9.75m7.5-10.5V7.875c0-.621-.504-1.125-1.125-1.125H8.39a1.125 1.125 0 0 1 .795-.33L11.54 4.07a1.125 1.125 0 0 1 .795-.33h4.905a1.125 1.125 0 0 1 1.125 1.125V9.75",
};

const Ic = ({ n, className = "h-5 w-5" }: { n: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d={iconPaths[n] || ""} />
  </svg>
);

// ============================================================
// Helpers
// ============================================================
const normalizeDigits = (s: string) => String(s || "").replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
const fmt = (n: number) => Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0";
const fa = (n: number) => Number.isFinite(n) ? n.toLocaleString("fa-IR", { maximumFractionDigits: 0 }) : "۰";

function shamsiParts(d: Date) {
  try {
    const p = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
    const g = (t: string) => p.find(x => x.type === t)?.value || "0";
    return { year: g("year"), month: g("month"), day: g("day") };
  } catch {
    return { year: "0", month: "0", day: "0" };
  }
}

function formatDateTime(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const s = shamsiParts(d);
  return `${s.year}/${s.month}/${s.day} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatShamsiDate(d: Date) {
  const s = shamsiParts(d);
  return `${s.year}/${s.month}/${s.day}`;
}

function shortDateLabel(s: string) {
  try {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? "-" : formatShamsiDate(d);
  } catch {
    return "-";
  }
}

function splitDateTime(s: string): { datePart: string; timePart: string } {
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return { datePart: "-", timePart: "" };
    const full = formatDateTime(d);
    const parts = full.split(" ");
    return { datePart: parts[0] || "-", timePart: parts[1] || "" };
  } catch {
    return { datePart: "-", timePart: "" };
  }
}

function transactionTypeLabel(tx: Transaction): string {
  if (tx.type === "exchange") return tx.dealType === "buy" ? "خرید ارز" : tx.dealType === "sell" ? "فروش ارز" : "تبادل ارز";
  if (tx.type === "transfer") return "انتقال";
  return "تبدیل ارز";
}

function transactionCustomerLabel(tx: Transaction): string {
  if (tx.type === "transfer") return `${tx.senderName || "—"} ← ${tx.receiverName || "—"}`;
  if (tx.customerId === CASH_BOX_ID) return "💰 صندوق";
  return tx.customerName || "—";
}

function transactionCommissionLabel(tx: Transaction): string {
  if (!tx.commission || tx.commission <= 0 || !tx.commissionCurrency) return "—";
  return `${fmt(tx.commission)} ${labels[tx.commissionCurrency]}`;
}

function commissionPayerLabel(tx: Transaction): string {
  if (!tx.commission || tx.commission <= 0) return "—";
  if (tx.type === "transfer") return tx.commissionPayer === "sender" ? "فرستنده" : tx.commissionPayer === "receiver" ? "گیرنده" : "—";
  return "مشتری";
}

const typeChipClass = (tx: Transaction, dk: boolean): string => {
  if (tx.type === "exchange") return dk ? "bg-sky-400/15 text-sky-300" : "bg-sky-100 text-sky-700";
  if (tx.type === "transfer") return dk ? "bg-violet-400/15 text-violet-300" : "bg-violet-100 text-violet-700";
  return dk ? "bg-purple-400/15 text-purple-300" : "bg-purple-100 text-purple-700";
};

// ✅ تابع جامع محاسبه موجودی (دقیقاً منطبق با داشبورد و صندوق)
function getLedgerBalance(customerId: string, currency: Currency, entries: any[], transactions: any[] = []): number {
  let balance = 0;
  for (const entry of entries) {
    if (entry.status === "voided" || entry.currency !== currency) continue;
    if (customerId === CASH_BOX_ID) {
      if (entry.type === "exchange_account_in" || entry.type === "exchange_account_out") continue;
      if (entry.type === "loan_given") balance -= entry.amount;
      else if (entry.type === "loan_received") balance += entry.amount;
      else { const physicalMultiplier = entry.direction === "in" ? 1 : -1; balance += entry.amount * physicalMultiplier; }
    } else if (customerId === EXCHANGE_ACCOUNT_ID) {
      if (entry.type === "owner_deposit") balance += entry.amount;
      else if (entry.type === "owner_withdraw") balance -= entry.amount;
      else if (entry.type === "exchange_account_in") balance += entry.amount;
      else if (entry.type === "exchange_account_out") balance -= entry.amount;
      else if (entry.type === "loan_given") balance -= entry.amount;
      else if (entry.type === "loan_received") balance += entry.amount;
    } else {
      if (entry.customerId === customerId) {
        if (entry.type === "customer_deposit") balance += entry.amount;
        else if (entry.type === "customer_withdraw") balance -= entry.amount;
        else if (entry.type === "loan_given") balance -= entry.amount;
        else if (entry.type === "loan_received") balance += entry.amount;
      }
    }
  }
  
  if (customerId !== CASH_BOX_ID && customerId !== EXCHANGE_ACCOUNT_ID) {
    for (const tx of transactions) {
      if (tx.status === "voided") continue;
      if (tx.type === "exchange" && tx.customerId === customerId) {
        if (tx.fromCurrency === currency) balance -= (tx.fromAmount || 0);
        if (tx.toCurrency === currency) balance += (tx.toAmount || 0);
        if (tx.commission && tx.commissionCurrency === currency) balance -= (tx.commission || 0);
      }
      if (tx.type === "transfer") {
        if (tx.senderId === customerId) {
          if (tx.fromCurrency === currency) balance -= (tx.fromAmount || 0);
          if (tx.commissionPayer === "sender" && tx.commission && tx.commissionCurrency === currency) balance -= (tx.commission || 0);
        }
        if (tx.receiverId === customerId) {
          if (tx.toCurrency === currency) balance += (tx.toAmount || 0);
          if (tx.commissionPayer === "receiver" && tx.commission && tx.commissionCurrency === currency) balance -= (tx.commission || 0);
        }
      }
      if (tx.type === "convert" && tx.customerId === customerId) {
        if (tx.fromCurrency === currency) balance -= (tx.fromAmount || 0);
        if (tx.toCurrency === currency) balance += (tx.toAmount || 0);
        if (tx.commission && tx.commissionCurrency === currency) balance -= (tx.commission || 0);
      }
    }
  }
  return balance;
}

// ============================================================
// Main Component
// ============================================================
export default function ReportsPage() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  
  const [customers, setCustomers] = useSyncedState<Customer[]>(CUSTOMERS_KEY, []);
  const [transactions, setTransactions] = useSyncedState<Transaction[]>(TRANSACTIONS_KEY, []);
  const [hawalas, setHawalas] = useSyncedState<any[]>(HAWALAS_KEY, []);
  const [cashEntries, setCashEntries] = useSyncedState<CashEntry[]>(CASH_KEY, []);
  
  const [activeSection, setActiveSection] = useState<"search" | "debtors" | "journal">("search");
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [shareCustomer, setShareCustomer] = useState<Customer | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState("");

  useEffect(() => { 
    try { 
      const s = window.localStorage.getItem("fx-theme"); 
      if (s === "dark" || s === "light") setTheme(s); 
    } catch {} 
    try {
      initTrackingSystem();
    } catch (err) { 
      console.error(err); 
    }
    setMounted(true);
  }, []);

  useEffect(() => { try { window.localStorage.setItem("fx-theme", theme); } catch {} }, [theme]);
  
  const dk = theme === "dark";

  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const currentDateTime = now ? formatDateTime(now) : "";

  // ── Daily Journal ──
  const dailyJournal = useMemo(() => {
    const days: Record<string, { transactions: Transaction[]; cashEntries: CashEntry[]; date: Date }> = {};
    for (const tx of transactions) {
      if (tx.status === "voided") continue;
      const key = shortDateLabel(tx.date);
      if (!days[key]) days[key] = { transactions: [], cashEntries: [], date: new Date(tx.date) };
      days[key].transactions.push(tx);
    }
    for (const ce of cashEntries) {
      if (ce.status === "voided") continue;
      if (ce.linkedExchangeId || ce.linkedTransferId || ce.linkedConvertId || ce.linkedHawalaId || ce.linkedHawalaSettleId) continue;
      const key = shortDateLabel(ce.date);
      if (!days[key]) days[key] = { transactions: [], cashEntries: [], date: new Date(ce.date) };
      days[key].cashEntries.push(ce);
    }
    return Object.entries(days).sort(([, a], [, b]) => b.date.getTime() - a.date.getTime());
  }, [transactions, cashEntries]);

  // ── Day summary ──
  const computeDaySummary = useCallback((txs: Transaction[], ces: CashEntry[]) => {
    const received: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    const paid: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    const commission: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    const cashIn: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    const cashOut: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    for (const tx of txs) {
      if (tx.fromCurrency && currencies.includes(tx.fromCurrency)) paid[tx.fromCurrency] += Number(tx.fromAmount || 0) || 0;
      if (tx.toCurrency && currencies.includes(tx.toCurrency)) received[tx.toCurrency] += Number(tx.toAmount || 0) || 0;
      if (tx.commission && tx.commission > 0 && tx.commissionCurrency && currencies.includes(tx.commissionCurrency)) commission[tx.commissionCurrency] += tx.commission;
    }
    for (const ce of ces) {
      const cur = ce.currency as Currency;
      if (!currencies.includes(cur)) continue;
      if (ce.direction === "in") cashIn[cur] += Number(ce.amount || 0) || 0;
      else cashOut[cur] += Number(ce.amount || 0) || 0;
    }
    return { received, paid, commission, cashIn, cashOut };
  }, []);

  const getCustomerTransactions = useCallback((customerId: string): Transaction[] => {
    return transactions
      .filter(tx => tx.status !== "voided" && (tx.customerId === customerId || tx.senderId === customerId || tx.receiverId === customerId))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = normalizeDigits(search.trim()).toLowerCase();
    return customers.filter(c => {
      const name = normalizeDigits(c.name).toLowerCase();
      const phone = normalizeDigits(c.phone || "");
      const tazkira = normalizeDigits(c.tazkira || "");
      return name.includes(q) || phone.includes(q) || tazkira.includes(q);
    });
  }, [customers, search]);

  // ✅ اصلاح شده: محاسبه بدهکاران با استفاده از getLedgerBalance برای هماهنگی ۱۰۰٪ با داشبورد
  const debtorCustomers = useMemo(() => {
    return customers.filter(c => {
      if (c.id === CASH_BOX_ID || c.id === EXCHANGE_ACCOUNT_ID) return false;
      return currencies.some(cur => getLedgerBalance(c.id, cur, cashEntries, transactions) < 0);
    });
  }, [customers, cashEntries, transactions]);

  const withBalanceCount = useMemo(() => {
    return customers.filter(c => {
      if (c.id === CASH_BOX_ID || c.id === EXCHANGE_ACCOUNT_ID) return false;
      return currencies.some(cur => getLedgerBalance(c.id, cur, cashEntries, transactions) !== 0);
    }).length;
  }, [customers, cashEntries, transactions]);

  // ── Share functions ──
  const generateCustomerReport = useCallback((customer: Customer): string => {
    const txs = getCustomerTransactions(customer.id);
    let report = `📊 گزارش معاملات مشتری\n\n`;
    report += `👤 نام: ${customer.name}\n`;
    if (customer.phone) report += `📞 تلفن: ${customer.phone}\n`;
    if (customer.tazkira) report += `🆔 تذکره: ${customer.tazkira}\n`;
    report += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    report += `💼 موجودی حساب:\n`;
    for (const cur of currencies) {
      // ✅ اصلاح شده: استفاده از getLedgerBalance
      const bal = getLedgerBalance(customer.id, cur, cashEntries, transactions);
      if (bal !== 0) report += `  • ${labels[cur]}: ${fmt(Math.abs(bal))} (${bal > 0 ? "طلب" : "قرض"})\n`;
    }
    report += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    report += `📋 تاریخچه معاملات (${txs.length} معامله):\n\n`;
    txs.slice(0, 20).forEach((tx, i) => {
      report += `${i + 1}. ${transactionTypeLabel(tx)}\n`;
      report += `   📅 ${shortDateLabel(tx.date)}\n`;
      report += `   💱 ${fmt(tx.fromAmount)} ${labels[tx.fromCurrency]} → ${fmt(tx.toAmount)} ${labels[tx.toCurrency]}\n`;
      if (tx.commission && tx.commission > 0 && tx.commissionCurrency) report += `   💼 کارمزد: ${fmt(tx.commission)} ${labels[tx.commissionCurrency]}\n`;
      report += `\n`;
    });
    if (txs.length > 20) report += `... و ${txs.length - 20} معامله دیگر\n`;
    report += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    report += `🏦 صرافی برادران نورزاد — هرات`;
    return report;
  }, [getCustomerTransactions, cashEntries, transactions]);

  const shareViaTelegram = useCallback((customer: Customer) => {
    const text = generateCustomerReport(customer);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(" ")}&text=${encodeURIComponent(text)}`, "_blank");
  }, [generateCustomerReport]);

  const shareViaWhatsApp = useCallback((customer: Customer) => {
    const text = generateCustomerReport(customer);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }, [generateCustomerReport]);

  const shareViaImo = useCallback(async (customer: Customer) => {
    const text = generateCustomerReport(customer);
    try {
      await navigator.clipboard.writeText(text);
      setToast("✅ گزارش کپی شد! حالا می‌توانید در ایمو paste کنید.");
      setTimeout(() => setToast(""), 3500);
    } catch {
      setToast("❌ خطا در کپی گزارش");
      setTimeout(() => setToast(""), 3500);
    }
  }, [generateCustomerReport]);

  const toggleDay = useCallback((day: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day); else next.add(day);
      return next;
    });
  }, []);

  const showToast = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(""), 3500); }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-emerald-500" />
          <p className="mt-4 text-slate-500">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  const heading = dk ? "text-white" : "text-slate-900";
  const subText = dk ? "text-slate-500" : "text-slate-400";
  const glassChip = dk ? "border-slate-600/70 bg-slate-800/80" : "border-emerald-100 bg-white/85";
  const uiCard = `rounded-2xl border backdrop-blur transition-colors duration-300 ${dk ? "border-slate-700 bg-slate-800/90 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.6)]" : "border-emerald-100 bg-white/95 shadow-[0_16px_40px_-28px_rgba(16,185,129,0.35)]"}`;
  const glassCard = `rounded-2xl border backdrop-blur transition-all duration-300 ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-white/80"}`;
  const inputShell = `rounded-xl border text-sm font-medium shadow-sm outline-none transition-all duration-200 focus:ring-4 ${dk ? "border-slate-600 bg-slate-900 text-slate-100 placeholder:text-slate-500 hover:border-slate-500 focus:border-emerald-400 focus:ring-emerald-400/10" : "border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 hover:border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500/10"}`;
  const uiInput = `h-12 w-full px-3.5 ${inputShell}`;
  const cellClass = "px-4 py-3.5 text-center";

  return (
    <div dir="rtl" className={dk ? "dark" : ""}>
      <style>{`@import url("https://fonts.googleapis.com/css2?family=Lalezar&family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap");.rp-font{font-family:"Vazirmatn","Segoe UI",Tahoma,sans-serif}.rp-display{font-family:"Lalezar","Vazirmatn",Tahoma,sans-serif}.dark{color-scheme:dark}@keyframes rpUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}.rp-up{animation:rpUp .5s cubic-bezier(.22,.8,.35,1) both}.rp-scroll::-webkit-scrollbar{height:6px;width:6px}.rp-scroll::-webkit-scrollbar-thumb{background:rgba(16,185,129,.3);border-radius:3px}.rp-scroll{scrollbar-width:thin}`}</style>
      <div className={`rp-font relative min-h-screen overflow-x-hidden antialiased transition-colors duration-500 ${dk ? "bg-[#0f172a] text-slate-100" : "bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 text-slate-800"}`}>
        <div className={`fixed inset-x-0 top-0 z-30 h-1 bg-gradient-to-l ${dk ? "from-emerald-400 via-teal-400 to-cyan-400" : "from-emerald-500 via-teal-500 to-cyan-500"}`} />
        <div className="relative z-10 mx-auto w-full max-w-7xl space-y-4 md:space-y-6 px-3 pb-16 pt-5 md:px-8 md:pt-9">

          {/* Header */}
          <header className="rp-up flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0">
              <div className="relative grid h-11 w-11 md:h-14 md:w-14 shrink-0 place-items-center rounded-xl md:rounded-2xl bg-gradient-to-br from-blue-500 via-sky-500 to-cyan-400 text-white shadow-lg shadow-blue-500/30 ring-1 ring-white/30">
                <Ic n="doc" className="h-5 w-5 md:h-6 md:w-6" />
                <span className={`absolute -bottom-1 -left-1 grid h-4 min-w-4 md:h-5 md:min-w-5 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-400 px-1 text-[7px] md:text-[8px] font-black text-white ring-2 ${dk ? "ring-[#0f172a]" : "ring-[#ecfdf5]"}`}>RP</span>
              </div>
              <div className="min-w-0">
                <h1 className={`rp-display text-2xl md:text-4xl leading-none ${heading}`}>گزارشات</h1>
                <p className={`mt-1 text-[10px] md:text-xs font-bold ${subText}`}>جستجو، بدهکاران و روزنامچه عمومی</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2.5">
              <div className={`hidden sm:flex items-center gap-2 rounded-xl border px-3 py-2 shadow-sm backdrop-blur ${glassChip}`}>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                <span dir="ltr" className={`text-xs font-bold tabular-nums ${dk ? "text-slate-100" : "text-slate-700"}`}>{currentDateTime || "--"}</span>
              </div>
              <button onClick={() => setTheme(dk ? "light" : "dark")} className={`group grid h-10 w-10 md:h-11 md:w-11 cursor-pointer place-items-center rounded-lg md:rounded-xl border shadow-sm backdrop-blur transition-all duration-300 active:scale-90 ${dk ? "border-slate-600 bg-slate-800/85 text-amber-300 hover:border-amber-300" : "border-slate-200 bg-white/85 text-slate-600 hover:border-emerald-400"}`}>
                {dk ? <Ic n="sun" className="h-4 w-4 group-hover:rotate-45 transition-transform duration-500" /> : <Ic n="moon" className="h-4 w-4 group-hover:-rotate-12 transition-transform duration-500" />}
              </button>
            </div>
          </header>

          {/* Stats */}
          <div className="rp-up grid grid-cols-2 md:grid-cols-4 gap-3" style={{ animationDelay: "70ms" }}>
            {[
              { label: "کل مشتریان", value: customers.length, icon: "users", color: "from-emerald-500 to-teal-500", text: dk ? "text-emerald-300" : "text-emerald-600" },
              { label: "مشتریان بدهکار", value: debtorCustomers.length, icon: "alert", color: "from-rose-500 to-pink-500", text: dk ? "text-rose-300" : "text-rose-600" },
              { label: "با موجودی", value: withBalanceCount, icon: "tag", color: "from-sky-500 to-cyan-500", text: dk ? "text-sky-300" : "text-sky-600" },
              { label: "روزهای ثبت‌شده", value: dailyJournal.length, icon: "calendar", color: "from-amber-500 to-orange-500", text: dk ? "text-amber-300" : "text-amber-600" }
            ].map((s, i) => (
              <div key={i} className={`group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${glassCard}`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${s.color} opacity-0 transition-opacity group-hover:opacity-10`} />
                <div className="relative flex items-center justify-between">
                  <div>
                    <div className={`text-[10px] font-black ${subText}`}>{s.label}</div>
                    <div className={`text-2xl md:text-3xl font-black tabular-nums mt-1 ${s.text}`}>{fa(s.value)}</div>
                  </div>
                  <div className={`grid h-10 w-10 md:h-12 md:w-12 place-items-center rounded-xl bg-gradient-to-br ${s.color} text-white shadow-lg`}>
                    <Ic n={s.icon} className="h-5 w-5 md:h-6 md:w-6" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tab Navigation */}
          <div className={`rp-up flex gap-1.5 md:gap-2 rounded-xl md:rounded-2xl border p-1.5 md:p-2 shadow-sm backdrop-blur ${glassChip}`} style={{ animationDelay: "140ms" }}>
            {[
              { id: "search" as const, label: "جستجوی مشتری", icon: "search" },
              { id: "debtors" as const, label: "مشتریان بدهکار", icon: "alert", count: debtorCustomers.length },
              { id: "journal" as const, label: "روزنامچه عمومی", icon: "calendar", count: dailyJournal.length }
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveSection(tab.id)} className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 md:gap-2 rounded-lg md:rounded-xl px-3 md:px-5 py-2.5 md:py-3 text-xs md:text-sm font-black transition-all duration-300 active:scale-[0.97] ${activeSection === tab.id ? `bg-gradient-to-l shadow-lg ${dk ? "from-blue-400 to-sky-400 text-slate-950" : "from-blue-500 to-sky-500 text-white"}` : dk ? "text-slate-400 hover:bg-slate-700/60 hover:text-slate-100" : "text-slate-500 hover:bg-blue-50 hover:text-slate-800"}`}>
                <Ic n={tab.icon} className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${activeSection === tab.id ? dk ? "bg-slate-950/20 text-slate-950" : "bg-white/30 text-white" : dk ? "bg-slate-700 text-slate-300" : "bg-blue-100 text-blue-700"}`}>{fa(tab.count)}</span>
                )}
              </button>
            ))}
          </div>

          {/* ═══════════ SEARCH SECTION ═══════════ */}
          {activeSection === "search" && (
            <section className={`rp-up space-y-4 ${uiCard}`} style={{ animationDelay: "160ms" }}>
              <div className="flex flex-wrap items-center gap-3 p-4 md:p-5 pb-3 md:pb-4 md:px-7 md:pt-6">
                <span className={`grid h-10 w-10 md:h-11 md:w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${dk ? "from-blue-400/20 to-sky-400/5 text-blue-300 ring-blue-400/25" : "from-blue-400/20 to-sky-400/10 text-blue-600 ring-blue-400/30"}`}><Ic n="search" className="h-5 w-5" /></span>
                <div className="flex-1 min-w-0">
                  <h2 className={`rp-display text-xl md:text-2xl leading-none ${heading}`}>جستجوی مشتری</h2>
                </div>
              </div>
              <div className="px-4 md:px-7 pb-4 space-y-3">
                <div className="relative">
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="نام، تلفن یا شماره تذکره را وارد کنید..." className={`${uiInput} pr-10`} />
                  <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${subText}`}><Ic n="search" className="h-4 w-4" /></span>
                </div>
                {search && searchResults.length === 0 && (
                  <div className={`text-center py-12 ${subText}`}>
                    <div className={`grid h-16 w-16 place-items-center rounded-2xl border border-dashed mx-auto mb-3 ${dk ? "border-slate-600 bg-slate-800/40" : "border-slate-300 bg-slate-50"}`}><Ic n="inbox" className="h-7 w-7 opacity-70" /></div>
                    <p className="text-sm font-black">مشتری‌ای یافت نشد</p>
                  </div>
                )}
                {search && searchResults.length > 0 && (
                  <>
                    <div className="hidden md:block overflow-x-auto rp-scroll">
                      <div className="max-h-[500px] overflow-y-auto rp-scroll">
                        <table className="w-full min-w-[1100px] text-sm">
                          <thead className="sticky top-0 z-10">
                            <tr className={`border-y ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
                              {["شماره", "مشتری", "تلفن", "تذکره", "تاریخ ثبت", "افغانی", "دالر", "یورو", "تومان", "کلدار", "وضعیت", "عملیات"].map(h => (
                                <th key={h} className="px-4 py-3 text-center text-[11px] font-black text-slate-400 whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className={`divide-y ${dk ? "divide-slate-700/60" : "divide-slate-100"}`}>
                            {searchResults.map((c, idx) => {
                              // ✅ اصلاح شده: استفاده از getLedgerBalance برای نمایش دقیق موجودی
                              const hasDebt = currencies.some(cur => getLedgerBalance(c.id, cur, cashEntries, transactions) < 0);
                              const hasCredit = currencies.some(cur => getLedgerBalance(c.id, cur, cashEntries, transactions) > 0);
                              return (
                                <tr key={c.id} className={`transition-colors ${dk ? "hover:bg-slate-700/30" : "hover:bg-emerald-50/50"}`}>
                                  <td className={cellClass}><span className={`inline-grid h-7 w-7 place-items-center rounded-lg text-[11px] font-black tabular-nums ${dk ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"}`}>{idx + 1}</span></td>
                                  <td className={cellClass}>
                                    <div className="flex items-center gap-2 justify-center">
                                      <div className={`grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white font-black text-xs shadow`}>{c.name.charAt(0)}</div>
                                      <span className={`text-[13px] font-black ${dk ? "text-slate-100" : "text-slate-800"}`}>{c.name}</span>
                                    </div>
                                  </td>
                                  <td className={`${cellClass} text-[12px] font-bold tabular-nums ${dk ? "text-slate-200" : "text-slate-700"}`} dir="ltr">{c.phone || "—"}</td>
                                  <td className={`${cellClass} text-[12px] font-bold tabular-nums ${dk ? "text-slate-200" : "text-slate-700"}`} dir="ltr">{c.tazkira || "—"}</td>
                                  <td className={`${cellClass} text-[11px] tabular-nums ${subText}`} dir="ltr">{c.registeredAt ? shortDateLabel(c.registeredAt) : "—"}</td>
                                  {currencies.map(cur => {
                                    const bal = getLedgerBalance(c.id, cur, cashEntries, transactions);
                                    return (
                                      <td key={cur} className={`${cellClass} text-[13px] font-black tabular-nums ${bal < 0 ? "text-rose-500" : bal > 0 ? (dk ? "text-emerald-300" : "text-emerald-700") : subText}`}>{fmt(bal)}</td>
                                    );
                                  })}
                                  <td className={cellClass}>
                                    {hasDebt ? (
                                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${dk ? "bg-rose-400/15 text-rose-300" : "bg-rose-100 text-rose-700"}`}>⚠️ بدهکار</span>
                                    ) : hasCredit ? (
                                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-700"}`}>✅ طلبکار</span>
                                    ) : (
                                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${dk ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"}`}>⚪ صفر</span>
                                    )}
                                  </td>
                                  <td className={cellClass}>
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button onClick={() => setSelectedCustomer(c)} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-black ${dk ? "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30" : "bg-blue-100 text-blue-700 hover:bg-blue-200"}`}><Ic n="eye" className="h-3 w-3" />مشاهده</button>
                                      <button onClick={() => setShareCustomer(c)} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-black ${dk ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"}`}><Ic n="share" className="h-3 w-3" />اشتراک</button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="md:hidden space-y-2">
                      {searchResults.map(c => {
                        const hasDebt = currencies.some(cur => getLedgerBalance(c.id, cur, cashEntries, transactions) < 0);
                        return (
                          <div key={c.id} className={`p-4 rounded-xl border ${hasDebt ? (dk ? "border-rose-400/30 bg-rose-400/[0.03]" : "border-rose-200 bg-rose-50/30") : (dk ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-white")}`}>
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white font-black text-sm`}>{c.name.charAt(0)}</div>
                              <div>
                                <b className={`block text-sm font-black ${dk ? "text-white" : "text-slate-900"}`}>{c.name}</b>
                                {c.phone && <span className={`text-[11px] ${subText}`} dir="ltr">📱 {c.phone}</span>}
                              </div>
                            </div>
                            <div className="grid grid-cols-5 gap-1 mt-2">
                              {currencies.map(cur => {
                                const bal = getLedgerBalance(c.id, cur, cashEntries, transactions);
                                return (
                                  <div key={cur} className={`rounded-lg px-1 py-1.5 text-center ${dk ? "bg-slate-900/50" : "bg-slate-50"}`}>
                                    <div className={`text-[8px] font-black ${subText}`}>{labels[cur]}</div>
                                    <div className={`text-[10px] font-black tabular-nums ${bal < 0 ? "text-rose-500" : bal > 0 ? (dk ? "text-emerald-300" : "text-emerald-700") : subText}`}>{fmt(bal)}</div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="flex gap-2 mt-3">
                              <button onClick={() => setSelectedCustomer(c)} className={`flex-1 py-2 rounded-lg text-[11px] font-black ${dk ? "bg-blue-500/20 text-blue-300" : "bg-blue-100 text-blue-700"}`}>مشاهده</button>
                              <button onClick={() => setShareCustomer(c)} className={`flex-1 py-2 rounded-lg text-[11px] font-black ${dk ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-100 text-emerald-700"}`}>اشتراک</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          {/* ═══════════ DEBTORS SECTION ═══════════ */}
          {activeSection === "debtors" && (
            <section className={`rp-up space-y-4 ${uiCard}`} style={{ animationDelay: "160ms" }}>
              <div className="flex flex-wrap items-center gap-3 p-4 md:p-5 pb-3 md:pb-4 md:px-7 md:pt-6">
                <span className={`grid h-10 w-10 md:h-11 md:w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${dk ? "from-rose-400/20 to-pink-400/5 text-rose-300 ring-rose-400/25" : "from-rose-400/20 to-pink-400/10 text-rose-600 ring-rose-400/30"}`}><Ic n="alert" className="h-5 w-5" /></span>
                <div className="flex-1 min-w-0">
                  <h2 className={`rp-display text-xl md:text-2xl leading-none ${heading}`}>مشتریان بدهکار</h2>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-[10px] font-black ring-1 ${dk ? "bg-rose-400/15 text-rose-300 ring-rose-400/25" : "bg-rose-100 text-rose-700 ring-rose-300/60"}`}>⚠️ توجه ویژه</span>
              </div>
              <div className="px-4 md:px-7 pb-4">
                {debtorCustomers.length === 0 ? (
                  <div className={`text-center py-12 ${subText}`}>
                    <div className={`grid h-16 w-16 place-items-center rounded-2xl border border-dashed mx-auto mb-3 ${dk ? "border-emerald-600 bg-emerald-400/10" : "border-emerald-300 bg-emerald-50"}`}><Ic n="check" className="h-7 w-7 text-emerald-500" /></div>
                    <p className="text-sm font-black">هیچ مشتری بدهکاری وجود ندارد</p>
                  </div>
                ) : (
                  <>
                    <div className="hidden md:block overflow-x-auto rp-scroll">
                      <div className="max-h-[500px] overflow-y-auto rp-scroll">
                        <table className="w-full min-w-[1100px] text-sm">
                          <thead className="sticky top-0 z-10">
                            <tr className={`border-y ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
                              {["شماره", "مشتری", "تلفن", "تذکره", "بدهی افغانی", "بدهی دالر", "بدهی یورو", "بدهی تومان", "بدهی کلدار", "عملیات"].map(h => (
                                <th key={h} className="px-4 py-3 text-center text-[11px] font-black text-slate-400 whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className={`divide-y ${dk ? "divide-slate-700/60" : "divide-slate-100"}`}>
                            {debtorCustomers.map((c, idx) => (
                              <tr key={c.id} className={`transition-colors ${dk ? "hover:bg-slate-700/30" : "hover:bg-rose-50/30"}`}>
                                <td className={cellClass}><span className={`inline-grid h-7 w-7 place-items-center rounded-lg text-[11px] font-black tabular-nums ${dk ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"}`}>{idx + 1}</span></td>
                                <td className={cellClass}>
                                  <div className="flex items-center gap-2 justify-center">
                                    <div className={`grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 text-white font-black text-xs shadow`}>{c.name.charAt(0)}</div>
                                    <span className={`text-[13px] font-black ${dk ? "text-slate-100" : "text-slate-800"}`}>{c.name}</span>
                                  </div>
                                </td>
                                <td className={`${cellClass} text-[12px] font-bold tabular-nums ${dk ? "text-slate-200" : "text-slate-700"}`} dir="ltr">{c.phone || "—"}</td>
                                <td className={`${cellClass} text-[12px] font-bold tabular-nums ${dk ? "text-slate-200" : "text-slate-700"}`} dir="ltr">{c.tazkira || "—"}</td>
                                {currencies.map(cur => {
                                  const bal = getLedgerBalance(c.id, cur, cashEntries, transactions);
                                  const debt = bal < 0 ? Math.abs(bal) : 0;
                                  return (
                                    <td key={cur} className={`${cellClass} text-[13px] font-black tabular-nums ${debt > 0 ? "text-rose-500" : subText}`}>{debt > 0 ? fmt(debt) : "—"}</td>
                                  );
                                })}
                                <td className={cellClass}>
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button onClick={() => setSelectedCustomer(c)} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-black ${dk ? "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30" : "bg-blue-100 text-blue-700 hover:bg-blue-200"}`}><Ic n="eye" className="h-3 w-3" />مشاهده</button>
                                    <button onClick={() => setShareCustomer(c)} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-black ${dk ? "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30" : "bg-rose-100 text-rose-700 hover:bg-rose-200"}`}><Ic n="share" className="h-3 w-3" />گزارش</button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className={`border-t-2 ${dk ? "border-rose-400/50 bg-rose-400/10" : "border-rose-300 bg-rose-50"}`}>
                              <td colSpan={4} className="px-4 py-3.5 text-right">
                                <span className={`text-[12px] font-black ${dk ? "text-rose-300" : "text-rose-700"}`}>📊 مجموع کل بدهی‌ها</span>
                              </td>
                              {currencies.map(cur => {
                                const totalDebt = debtorCustomers.reduce((sum, c) => {
                                  const bal = getLedgerBalance(c.id, cur, cashEntries, transactions);
                                  return sum + (bal < 0 ? Math.abs(bal) : 0);
                                }, 0);
                                return (
                                  <td key={cur} className={`${cellClass} text-[13px] font-black tabular-nums text-rose-500`}>{totalDebt > 0 ? fmt(totalDebt) : "—"}</td>
                                );
                              })}
                              <td className={cellClass} />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                    <div className="md:hidden space-y-2">
                      {debtorCustomers.map(c => {
                        const debts = currencies.filter(cur => getLedgerBalance(c.id, cur, cashEntries, transactions) < 0);
                        return (
                          <div key={c.id} className={`p-4 rounded-xl border ${dk ? "border-rose-400/25 bg-rose-400/[0.03]" : "border-rose-200 bg-rose-50/30"}`}>
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 text-white font-black text-sm`}>{c.name.charAt(0)}</div>
                              <div>
                                <b className={`block text-sm font-black ${dk ? "text-white" : "text-slate-900"}`}>{c.name}</b>
                                {c.phone && <span className={`text-[11px] ${subText}`} dir="ltr">📱 {c.phone}</span>}
                              </div>
                            </div>
                            <div className="space-y-1.5 mt-2">
                              {debts.map(cur => (
                                <div key={cur} className={`flex items-center justify-between text-xs rounded-lg px-3 py-1.5 ${dk ? "bg-slate-900/30" : "bg-white/70"}`}>
                                  <span className={`font-black ${dk ? "text-slate-300" : "text-slate-600"}`}>{labels[cur]}</span>
                                  <span className="font-black tabular-nums text-rose-500">{fmt(Math.abs(getLedgerBalance(c.id, cur, cashEntries, transactions)))}</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2 mt-3">
                              <button onClick={() => setSelectedCustomer(c)} className={`flex-1 py-2 rounded-lg text-[11px] font-black ${dk ? "bg-blue-500/20 text-blue-300" : "bg-blue-100 text-blue-700"}`}>مشاهده</button>
                              <button onClick={() => setShareCustomer(c)} className={`flex-1 py-2 rounded-lg text-[11px] font-black ${dk ? "bg-rose-500/20 text-rose-300" : "bg-rose-100 text-rose-700"}`}>ارسال گزارش</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          {/* ═══════════ DAILY JOURNAL ═══════════ */}
          {activeSection === "journal" && (
            <section className={`rp-up space-y-4 ${uiCard}`} style={{ animationDelay: "160ms" }}>
              <div className="flex flex-wrap items-center gap-3 p-4 md:p-5 pb-3 md:pb-4 md:px-7 md:pt-6">
                <span className={`grid h-10 w-10 md:h-11 md:w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${dk ? "from-amber-400/20 to-orange-400/5 text-amber-300 ring-amber-400/25" : "from-amber-400/20 to-orange-400/10 text-amber-600 ring-amber-400/30"}`}><Ic n="calendar" className="h-5 w-5" /></span>
                <div className="flex-1 min-w-0">
                  <h2 className={`rp-display text-xl md:text-2xl leading-none ${heading}`}>روزنامچه عمومی</h2>
                </div>
              </div>
              <div className="px-4 md:px-7 pb-4 space-y-3 max-h-[750px] overflow-y-auto rp-scroll">
                {dailyJournal.length === 0 ? (
                  <div className={`text-center py-12 ${subText}`}>
                    <div className={`grid h-16 w-16 place-items-center rounded-2xl border border-dashed mx-auto mb-3 ${dk ? "border-slate-600 bg-slate-800/40" : "border-slate-300 bg-slate-50"}`}><Ic n="inbox" className="h-7 w-7 opacity-70" /></div>
                    <p className="text-sm font-black">روزی ثبت نشده است</p>
                  </div>
                ) : (
                  dailyJournal.map(([day, data]) => {
                    const isExpanded = expandedDays.has(day);
                    const txCount = data.transactions.length;
                    const cashCount = data.cashEntries.length;
                    const summary = computeDaySummary(data.transactions, data.cashEntries);
                    const totalCommission = currencies.reduce((sum, cur) => sum + summary.commission[cur], 0);
                    return (
                      <div key={day} className={`rounded-xl border overflow-hidden ${dk ? "border-slate-700" : "border-slate-200"}`}>
                        <button onClick={() => toggleDay(day)} className={`w-full flex items-center justify-between p-4 transition-colors ${dk ? "bg-slate-800/50 hover:bg-slate-800" : "bg-white hover:bg-slate-50"}`}>
                          <div className="flex items-center gap-3">
                            <div className={`grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md`}><Ic n="calendar" className="h-4 w-4" /></div>
                            <div className="text-right">
                              <b className={`block text-sm font-black ${dk ? "text-white" : "text-slate-900"}`}>{day}</b>
                              <div className={`flex flex-wrap gap-3 mt-1 text-[10px] ${subText}`}>
                                <span>{fa(txCount)} معامله</span>
                                <span>{fa(cashCount)} سند صندوق</span>
                                {totalCommission > 0 && <span className={dk ? "text-amber-300" : "text-amber-600"}>💰 کارمزد: {fmt(totalCommission)}</span>}
                              </div>
                            </div>
                          </div>
                          <span className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}><Ic n="chevron" className="h-5 w-5" /></span>
                        </button>

                        {isExpanded && (
                          <div className={`p-4 space-y-4 border-t ${dk ? "border-slate-700 bg-slate-900/50" : "border-slate-200 bg-slate-50"}`}>
                            {data.transactions.length > 0 && (
                              <div>
                                <b className={`block text-xs font-black mb-2 ${dk ? "text-blue-300" : "text-blue-600"}`}>📋 معاملات ({fa(data.transactions.length)}):</b>
                                <div className="overflow-x-auto rp-scroll">
                                  <table className="w-full min-w-[1200px] text-sm">
                                    <thead>
                                      <tr className={`border-y ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
                                        {["شماره", "کد پیگیری", "مشتری", "تاریخ", "نوع", "دریافت", "پرداخت", "نرخ", "کارمزد", "پرداخت‌کننده"].map(h => (
                                          <th key={h} className="px-3 py-2.5 text-center text-[10px] font-black text-slate-400 whitespace-nowrap">{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className={`divide-y ${dk ? "divide-slate-700/60" : "divide-slate-100"}`}>
                                      {data.transactions.map((tx, index) => {
                                        const dt = splitDateTime(tx.date);
                                        return (
                                          <tr key={tx.id} className={`transition-colors ${dk ? "hover:bg-slate-700/30" : "hover:bg-emerald-50/50"}`}>
                                            <td className={cellClass}><span className={`inline-grid h-7 w-7 place-items-center rounded-lg text-[11px] font-black tabular-nums ${dk ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"}`}>{index + 1}</span></td>
                                            <td className={cellClass}><span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-black ${dk ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300" : "border-cyan-300 bg-cyan-50 text-cyan-700"}`} dir="ltr"><Ic n="tag" className="h-3 w-3" />{tx.trackingCode}</span></td>
                                            <td className={`${cellClass} text-[12px] font-bold ${dk ? "text-slate-200" : "text-slate-700"}`}>{transactionCustomerLabel(tx)}</td>
                                            <td className={cellClass}><div className="flex flex-col items-center gap-0.5"><span dir="ltr" className={`text-xs font-bold tabular-nums ${dk ? "text-slate-200" : "text-slate-700"}`}>{dt.datePart}</span><span dir="ltr" className={`text-[10px] tabular-nums ${subText}`}>{dt.timePart}</span></div></td>
                                            <td className={cellClass}><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${typeChipClass(tx, dk)}`}>{transactionTypeLabel(tx)}</span></td>
                                            <td className={cellClass}><div className={`text-[13px] font-black tabular-nums ${dk ? "text-emerald-300" : "text-emerald-700"}`}>{fmt(tx.toAmount)}</div><div className={`text-[10px] ${subText}`}>{labels[tx.toCurrency]}</div></td>
                                            <td className={cellClass}><div className={`text-[13px] font-black tabular-nums ${dk ? "text-rose-300" : "text-rose-700"}`}>{fmt(tx.fromAmount)}</div><div className={`text-[10px] ${subText}`}>{labels[tx.fromCurrency]}</div></td>
                                            <td className={`${cellClass} text-[11px] ${dk ? "text-slate-400" : "text-slate-500"}`}>{tx.rateLabel}</td>
                                            <td className={`${cellClass} text-xs font-bold tabular-nums ${tx.commission && tx.commission > 0 ? (dk ? "text-amber-300" : "text-amber-700") : subText}`}>{transactionCommissionLabel(tx)}</td>
                                            <td className={`${cellClass} text-[11px] ${dk ? "text-slate-300" : "text-slate-600"}`}>{commissionPayerLabel(tx)}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {data.cashEntries.length > 0 && (
                              <div>
                                <b className={`block text-xs font-black mb-2 ${dk ? "text-emerald-300" : "text-emerald-600"}`}>🏦 اسناد صندوق ({fa(data.cashEntries.length)}):</b>
                                <div className="overflow-x-auto rp-scroll">
                                  <table className="w-full min-w-[900px] text-sm">
                                    <thead>
                                      <tr className={`border-y ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
                                        {["شماره", "کد پیگیری", "مشتری", "تاریخ", "نوع", "شرح", "دریافت", "پرداخت", "ارز"].map(h => (
                                          <th key={h} className="px-3 py-2.5 text-center text-[10px] font-black text-slate-400 whitespace-nowrap">{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className={`divide-y ${dk ? "divide-slate-700/60" : "divide-slate-100"}`}>
                                      {data.cashEntries.map((ce, index) => {
                                        const dt = splitDateTime(ce.date);
                                        const cur = ce.currency as Currency;
                                        return (
                                          <tr key={ce.id} className={`transition-colors ${dk ? "hover:bg-slate-700/30" : "hover:bg-emerald-50/50"}`}>
                                            <td className={cellClass}><span className={`inline-grid h-7 w-7 place-items-center rounded-lg text-[11px] font-black tabular-nums ${dk ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"}`}>{index + 1}</span></td>
                                            <td className={cellClass}><span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-black ${dk ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300" : "border-cyan-300 bg-cyan-50 text-cyan-700"}`} dir="ltr"><Ic n="tag" className="h-3 w-3" />{ce.trackingCode || "-"}</span></td>
                                            <td className={`${cellClass} text-[12px] font-bold ${dk ? "text-slate-200" : "text-slate-700"}`}>{ce.customerName || "💰 صندوق"}</td>
                                            <td className={cellClass}><div className="flex flex-col items-center gap-0.5"><span dir="ltr" className={`text-xs font-bold tabular-nums ${dk ? "text-slate-200" : "text-slate-700"}`}>{dt.datePart}</span><span dir="ltr" className={`text-[10px] tabular-nums ${subText}`}>{dt.timePart}</span></div></td>
                                            <td className={cellClass}><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${ce.direction === "in" ? (dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-700") : (dk ? "bg-rose-400/15 text-rose-300" : "bg-rose-100 text-rose-700")}`}>{ce.direction === "in" ? "واریز" : "برداشت"}</span></td>
                                            <td className={`${cellClass} text-[12px] max-w-[200px] truncate ${dk ? "text-slate-200" : "text-slate-700"}`}>{ce.reason || ce.type}</td>
                                            <td className={`${cellClass} text-[13px] font-black tabular-nums ${dk ? "text-emerald-300" : "text-emerald-700"}`}>{ce.direction === "in" ? fmt(ce.amount) : "—"}</td>
                                            <td className={`${cellClass} text-[13px] font-black tabular-nums ${dk ? "text-rose-300" : "text-rose-700"}`}>{ce.direction === "out" ? fmt(ce.amount) : "—"}</td>
                                            <td className={`${cellClass} text-[11px] font-black ${dk ? "text-slate-300" : "text-slate-600"}`}>{labels[cur]}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          )}

          <div className={`rp-up text-center py-4 text-[11px] font-bold ${subText}`} style={{ animationDelay: "420ms" }}>
            🏦 صرافی برادران نورزاد — هرات | گزارشات لحظه‌ای
          </div>
        </div>
      </div>

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm" onClick={() => setSelectedCustomer(null)}>
          <div className={`w-full max-w-4xl rounded-2xl border shadow-2xl ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-white"}`} onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between border-b px-4 py-3 ${dk ? "border-slate-700" : "border-slate-100"}`}>
              <b className={`text-sm font-black flex items-center gap-2 ${dk ? "text-slate-100" : "text-slate-800"}`}><Ic n="user" className="h-4 w-4" />جزئیات کامل — {selectedCustomer.name}</b>
              <button onClick={() => setSelectedCustomer(null)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"><Ic n="x" className="h-4 w-4" /></button>
            </div>
            <div className="max-h-[80vh] overflow-y-auto p-4 space-y-4">
              <div className={`rounded-xl border p-4 ${dk ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"}`}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div><span className={`block text-[9px] font-black ${subText}`}>👤 نام</span><b className={dk ? "text-slate-200" : "text-slate-700"}>{selectedCustomer.name}</b></div>
                  <div><span className={`block text-[9px] font-black ${subText}`}>📱 تلفن</span><b className={dk ? "text-slate-200" : "text-slate-700"} dir="ltr">{selectedCustomer.phone || "—"}</b></div>
                  <div><span className={`block text-[9px] font-black ${subText}`}>🆔 تذکره</span><b className={dk ? "text-slate-200" : "text-slate-700"} dir="ltr">{selectedCustomer.tazkira || "—"}</b></div>
                  <div><span className={`block text-[9px] font-black ${subText}`}>📅 ثبت</span><b className={dk ? "text-slate-200" : "text-slate-700"} dir="ltr">{selectedCustomer.registeredAt ? shortDateLabel(selectedCustomer.registeredAt) : "—"}</b></div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {currencies.map(cur => {
                  // ✅ اصلاح شده: استفاده از getLedgerBalance در مودال جزئیات
                  const bal = getLedgerBalance(selectedCustomer.id, cur, cashEntries, transactions);
                  return (
                    <div key={cur} className={`rounded-lg p-3 text-center ${dk ? "bg-slate-800/50" : "bg-slate-100"}`}>
                      <div className={`text-[9px] font-black ${subText}`}>{labels[cur]}</div>
                      <div className={`text-lg font-black tabular-nums mt-1 ${bal < 0 ? "text-rose-500" : bal > 0 ? (dk ? "text-emerald-300" : "text-emerald-700") : subText}`}>{fmt(bal)}</div>
                    </div>
                  );
                })}
              </div>
              <div>
                <b className={`block text-xs font-black mb-2 ${dk ? "text-blue-300" : "text-blue-600"}`}>📋 تاریخچه معاملات ({fa(getCustomerTransactions(selectedCustomer.id).length)}):</b>
                {getCustomerTransactions(selectedCustomer.id).length === 0 ? (
                  <div className={`text-center py-6 ${subText}`}><p className="text-xs">هیچ معامله‌ای ثبت نشده</p></div>
                ) : (
                  <div className="overflow-x-auto rp-scroll">
                    <div className="max-h-72 overflow-y-auto rp-scroll">
                      <table className="w-full min-w-[900px] text-sm">
                        <thead className="sticky top-0 z-10">
                          <tr className={`border-y ${dk ? "border-slate-700 bg-slate-800" : "border-slate-100 bg-slate-50"}`}>
                            {["شماره", "کد", "تاریخ", "نوع", "دریافت", "پرداخت", "نرخ", "کارمزد"].map(h => (
                              <th key={h} className="px-3 py-2.5 text-center text-[10px] font-black text-slate-400 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className={`divide-y ${dk ? "divide-slate-700/60" : "divide-slate-100"}`}>
                          {getCustomerTransactions(selectedCustomer.id).map((tx, index) => {
                            const dt = splitDateTime(tx.date);
                            return (
                              <tr key={tx.id} className={dk ? "hover:bg-slate-700/30" : "hover:bg-emerald-50/50"}>
                                <td className={cellClass}><span className={`inline-grid h-6 w-6 place-items-center rounded-lg text-[10px] font-black ${dk ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"}`}>{index + 1}</span></td>
                                <td className={cellClass}><span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-black ${dk ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300" : "border-cyan-300 bg-cyan-50 text-cyan-700"}`} dir="ltr"><Ic n="tag" className="h-3 w-3" />{tx.trackingCode}</span></td>
                                <td className={cellClass}><div className="flex flex-col items-center gap-0.5"><span dir="ltr" className={`text-[11px] font-bold tabular-nums ${dk ? "text-slate-200" : "text-slate-700"}`}>{dt.datePart}</span><span dir="ltr" className={`text-[9px] tabular-nums ${subText}`}>{dt.timePart}</span></div></td>
                                <td className={cellClass}><span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-black ${typeChipClass(tx, dk)}`}>{transactionTypeLabel(tx)}</span></td>
                                <td className={cellClass}><div className={`text-[12px] font-black tabular-nums ${dk ? "text-emerald-300" : "text-emerald-700"}`}>{fmt(tx.toAmount)}</div><div className={`text-[9px] ${subText}`}>{labels[tx.toCurrency]}</div></td>
                                <td className={cellClass}><div className={`text-[12px] font-black tabular-nums ${dk ? "text-rose-300" : "text-rose-700"}`}>{fmt(tx.fromAmount)}</div><div className={`text-[9px] ${subText}`}>{labels[tx.fromCurrency]}</div></td>
                                <td className={`${cellClass} text-[10px] ${subText}`}>{tx.rateLabel}</td>
                                <td className={`${cellClass} text-[11px] font-bold tabular-nums ${tx.commission && tx.commission > 0 ? (dk ? "text-amber-300" : "text-amber-700") : subText}`}>{transactionCommissionLabel(tx)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              <button onClick={() => { setShareCustomer(selectedCustomer); setSelectedCustomer(null); }} className={`w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 ${dk ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}><Ic n="share" className="h-4 w-4" />اشتراک‌گذاری گزارش</button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm" onClick={() => setShareCustomer(null)}>
          <div className={`w-full max-w-md rounded-2xl border shadow-2xl ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-white"}`} onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between border-b px-4 py-3 ${dk ? "border-slate-700" : "border-slate-100"}`}>
              <b className={`text-sm font-black flex items-center gap-2 ${dk ? "text-slate-100" : "text-slate-800"}`}><Ic n="share" className="h-4 w-4" />اشتراک‌گذاری گزارش</b>
              <button onClick={() => setShareCustomer(null)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"><Ic n="x" className="h-4 w-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className={`rounded-xl border p-3 ${dk ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-center gap-2">
                  <div className={`grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 text-white font-black text-xs`}>{shareCustomer.name.charAt(0)}</div>
                  <div>
                    <p className={`text-xs font-black ${dk ? "text-white" : "text-slate-800"}`}>{shareCustomer.name}</p>
                    <p className={`text-[10px] ${subText}`}>گزارش معاملات این مشتری را ارسال کنید</p>
                  </div>
                </div>
              </div>
              <button onClick={() => { shareViaTelegram(shareCustomer); setShareCustomer(null); }} className={`w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 ${dk ? "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30" : "bg-blue-100 text-blue-700 hover:bg-blue-200"}`}><span className="text-xl">📱</span> تلگرام</button>
              <button onClick={() => { shareViaWhatsApp(shareCustomer); setShareCustomer(null); }} className={`w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 ${dk ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"}`}><span className="text-xl">💬</span> واتساپ</button>
              <button onClick={() => { shareViaImo(shareCustomer); setShareCustomer(null); }} className={`w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 ${dk ? "bg-violet-500/20 text-violet-300 hover:bg-violet-500/30" : "bg-violet-100 text-violet-700 hover:bg-violet-200"}`}><span className="text-xl">📨</span> ایمو (کپی در کلیپ‌بورد)</button>
              <button onClick={async () => { try { await navigator.clipboard.writeText(generateCustomerReport(shareCustomer)); showToast("✅ گزارش کپی شد"); } catch { showToast("❌ خطا در کپی"); } setShareCustomer(null); }} className={`w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 ${dk ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}><Ic n="copy" className="h-4 w-4" /> کپی متن گزارش</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[99] rounded-xl px-4 py-3 text-sm font-bold shadow-lg ${dk ? "bg-slate-800 text-slate-100 border border-slate-600" : "bg-slate-900 text-white"}`}>{toast}</div>
      )}
    </div>
  );
}
