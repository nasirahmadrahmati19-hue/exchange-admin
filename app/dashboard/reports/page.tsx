"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { initTrackingSystem } from "../lib/trackingCode";
import { CUSTOMERS_KEY, TRANSACTIONS_KEY, CASH_KEY, HAWALAS_KEY, loadCustomersShared, loadTransactionsShared, loadCashEntriesShared, loadHawalasShared } from "../lib/defaultData";

// ============================================================
// Types
// ============================================================
type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";
type TxType = "exchange" | "transfer" | "convert" | "hawala" | "deposit" | "withdraw" | "fee" | "correction";

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
  rateBase?: Currency;
  commission?: number;
  commissionCurrency?: Currency;
  commissionPayer?: "sender" | "receiver";
  description?: string;
  status: "active" | "voided";
  profit?: number;
  profitCurrency?: Currency;
  customerPhone?: string;
  customerTelegram?: string;
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

type LedgerEntry = {
  id: string;
  date: string;
  customerId: string;
  customerName?: string;
  type: TxType;
  description: string;
  currency: Currency;
  amount: number;
  direction: "in" | "out";
  balanceAfter: number;
  referenceNumber?: string;
};

// ============================================================
// Constants
// ============================================================
const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const labels: Record<Currency, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };
const CASH_BOX_ID = "CASH_BOX";
const CASH_BOX_NAME = "صندوق";

const txLabels: Record<TxType, string> = {
  exchange: "تبادل ارز", transfer: "انتقال", convert: "تبدیل ارز",
  hawala: "حواله", deposit: "واریز", withdraw: "برداشت",
  fee: "کارمزد", correction: "اصلاح"
};

const txColors: Record<TxType, { light: string; dark: string }> = {
  exchange: { light: "bg-sky-100 text-sky-700", dark: "bg-sky-400/15 text-sky-300" },
  transfer: { light: "bg-violet-100 text-violet-700", dark: "bg-violet-400/15 text-violet-300" },
  convert: { light: "bg-purple-100 text-purple-700", dark: "bg-purple-400/15 text-purple-300" },
  hawala: { light: "bg-blue-100 text-blue-700", dark: "bg-blue-400/15 text-blue-300" },
  deposit: { light: "bg-emerald-100 text-emerald-700", dark: "bg-emerald-400/15 text-emerald-300" },
  withdraw: { light: "bg-rose-100 text-rose-700", dark: "bg-rose-400/15 text-rose-300" },
  fee: { light: "bg-amber-100 text-amber-700", dark: "bg-amber-400/15 text-amber-300" },
  correction: { light: "bg-orange-100 text-orange-700", dark: "bg-orange-400/15 text-orange-300" }
};

const currencyColors: Record<Currency, { light: string; dark: string; gradient: string }> = {
  AFN: { light: "text-emerald-700", dark: "text-emerald-300", gradient: "from-emerald-500 to-teal-400" },
  USD: { light: "text-sky-700", dark: "text-sky-300", gradient: "from-sky-500 to-cyan-400" },
  EUR: { light: "text-blue-700", dark: "text-blue-300", gradient: "from-blue-600 to-blue-400" },
  IRR: { light: "text-amber-700", dark: "text-amber-300", gradient: "from-amber-500 to-orange-400" },
  PKR: { light: "text-rose-700", dark: "text-rose-300", gradient: "from-rose-500 to-pink-400" }
};

// ============================================================
// Icons
// ============================================================
const iconPaths = {
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

type IconName = keyof typeof iconPaths;

const Ic = ({ n, className = "h-5 w-5" }: { n: IconName; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d={iconPaths[n]} />
  </svg>
);

// ============================================================
// Helper Functions
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

// ============================================================
// Ledger Builder
// ============================================================
function buildLedger(customers: Customer[], transactions: Transaction[], hawalas: any[], cashEntries: CashEntry[]): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  if (!Array.isArray(customers) || !Array.isArray(transactions) || !Array.isArray(hawalas) || !Array.isArray(cashEntries)) return entries;

  for (const tx of transactions) {
    if (!tx || typeof tx !== "object") continue;
    if (tx.status === "voided") continue;
    
    const date = tx.date || new Date().toISOString();
    const refNum = tx.trackingCode || (tx.id ? String(tx.id).slice(-6) : "");
    const fromCur = tx.fromCurrency as Currency, toCur = tx.toCurrency as Currency;
    const commCur = tx.commissionCurrency as Currency | undefined;
    const fromAmt = Number(tx.fromAmount || 0) || 0, toAmt = Number(tx.toAmount || 0) || 0, commAmt = Number(tx.commission || 0) || 0;

    if (tx.type === "exchange") {
      const cid = tx.customerId || customers.find(c => c.name === (tx.customerName || tx.customerId))?.id;
      if (cid && cid !== CASH_BOX_ID) {
        entries.push({ id: `${tx.id}-out`, date, customerId: cid, customerName: tx.customerName, type: "exchange", description: `فروش ${labels[fromCur]}`, currency: fromCur, amount: fromAmt, direction: "out", balanceAfter: 0, referenceNumber: refNum });
        entries.push({ id: `${tx.id}-in`, date, customerId: cid, customerName: tx.customerName, type: "exchange", description: `خرید ${labels[toCur]}`, currency: toCur, amount: toAmt, direction: "in", balanceAfter: 0, referenceNumber: refNum });
        if (commAmt > 0 && commCur) entries.push({ id: `${tx.id}-fee`, date, customerId: cid, customerName: tx.customerName, type: "fee", description: "کارمزد معامله", currency: commCur, amount: commAmt, direction: "out", balanceAfter: 0, referenceNumber: refNum });
      }
    }
    if (tx.type === "transfer") {
      const sId = tx.senderId || customers.find(c => c.name === (tx.senderName || tx.senderId))?.id;
      const rId = tx.receiverId || customers.find(c => c.name === (tx.receiverName || tx.receiverId))?.id;
      if (sId && sId !== CASH_BOX_ID) entries.push({ id: `${tx.id}-s-out`, date, customerId: sId, customerName: tx.senderName, type: "transfer", description: `انتقال به ${customers.find(c => c.id === rId)?.name || tx.receiverName || "—"}`, currency: fromCur, amount: fromAmt, direction: "out", balanceAfter: 0, referenceNumber: refNum });
      if (rId && rId !== CASH_BOX_ID) entries.push({ id: `${tx.id}-r-in`, date, customerId: rId, customerName: tx.receiverName, type: "transfer", description: `دریافت از ${customers.find(c => c.id === sId)?.name || tx.senderName || "—"}`, currency: toCur, amount: toAmt, direction: "in", balanceAfter: 0, referenceNumber: refNum });
    }
    if (tx.type === "convert") {
      const cid = tx.customerId || customers.find(c => c.name === (tx.customerName || tx.customerId))?.id;
      if (cid && cid !== CASH_BOX_ID) {
        entries.push({ id: `${tx.id}-c-out`, date, customerId: cid, customerName: tx.customerName, type: "convert", description: `تبدیل از ${labels[fromCur]}`, currency: fromCur, amount: fromAmt, direction: "out", balanceAfter: 0, referenceNumber: refNum });
        entries.push({ id: `${tx.id}-c-in`, date, customerId: cid, customerName: tx.customerName, type: "convert", description: `تبدیل به ${labels[toCur]}`, currency: toCur, amount: toAmt, direction: "in", balanceAfter: 0, referenceNumber: refNum });
        if (commAmt > 0 && commCur) entries.push({ id: `${tx.id}-c-fee`, date, customerId: cid, customerName: tx.customerName, type: "fee", description: "کارمزد تبدیل", currency: commCur, amount: commAmt, direction: "out", balanceAfter: 0, referenceNumber: refNum });
      }
    }
  }

  for (const h of hawalas) {
    if (!h || typeof h !== "object") continue;
    if (h.status === "cancelled" || h.status === "voided") continue;
    const date = h.date || new Date().toISOString();
    const refNum = h.number || h.trackingCode || "";
    const sender = customers.find(c => c.id === h.senderId) || customers.find(c => c.name === h.senderName);
    const hFromCur = h.currencyFrom as Currency;
    const hAmt = Number(h.amountFrom || 0) || 0;
    if (sender && sender.id !== CASH_BOX_ID) {
      entries.push({ id: `${h.id}-hs-out`, date, customerId: sender.id, customerName: sender.name, type: "hawala", description: `حواله ارسالی به ${h.receiverName || "—"}`, currency: hFromCur, amount: hAmt, direction: "out", balanceAfter: 0, referenceNumber: refNum });
    }
  }

  for (const ce of cashEntries) {
    if (!ce || typeof ce !== "object") continue;
    if (ce.status === "voided") continue;
    if (ce.linkedHawalaId || ce.linkedHawalaSettleId || ce.linkedExchangeId || ce.linkedTransferId || ce.linkedConvertId) continue;
    if (ce.type !== "customer_deposit" && ce.type !== "customer_withdraw") continue;
    if (!ce.customerId || ce.customerId === CASH_BOX_ID) continue;
    if (!customers.find(c => c.id === ce.customerId)) continue;
    const cur = ce.currency as Currency;
    if (!currencies.includes(cur)) continue;
    const amt = Number(ce.amount || 0) || 0;
    if (amt <= 0) continue;
    const isIn = ce.type === "customer_deposit";
    entries.push({ id: `${ce.id}-cash`, date: ce.date || new Date().toISOString(), customerId: ce.customerId, customerName: ce.customerName, type: isIn ? "deposit" : "withdraw", description: isIn ? `واریز - ${ce.reason || ""}` : `برداشت - ${ce.reason || ""}`, currency: cur, amount: amt, direction: isIn ? "in" : "out", balanceAfter: 0, referenceNumber: ce.trackingCode || "" });
  }

  entries.sort((a, b) => {
    try { return new Date(b.date).getTime() - new Date(a.date).getTime(); } catch { return 0; }
  });
  return entries;
}

// ============================================================
// Main Component
// ============================================================
export default function ReportsPage() {
  const [mounted, setMounted] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [hawalas, setHawalas] = useState<any[]>([]);
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [activeSection, setActiveSection] = useState<"search" | "debtors" | "journal">("search");
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [shareCustomer, setShareCustomer] = useState<Customer | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState("");

  useEffect(() => { try { const s = window.localStorage.getItem("fx-theme"); if (s === "dark" || s === "light") setTheme(s); } catch {} }, []);
  useEffect(() => { try { window.localStorage.setItem("fx-theme", theme); } catch {} }, [theme]);
  const dk = theme === "dark";

  useEffect(() => {
    try {
      setCustomers(loadCustomersShared() as Customer[]);
      setTransactions(loadTransactionsShared() as Transaction[]);
      setHawalas(loadHawalasShared());
      setCashEntries(loadCashEntriesShared() as CashEntry[]);
      initTrackingSystem();
    } catch (err) { console.error(err); }
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      try {
        if (e.key === CUSTOMERS_KEY && e.newValue) { const p = JSON.parse(e.newValue); if (Array.isArray(p)) setCustomers(p); }
        if (e.key === TRANSACTIONS_KEY && e.newValue) { const p = JSON.parse(e.newValue); if (Array.isArray(p)) setTransactions(p); }
        if (e.key === HAWALAS_KEY && e.newValue) { const p = JSON.parse(e.newValue); if (Array.isArray(p)) setHawalas(p); }
        if (e.key === CASH_KEY && e.newValue) { const p = JSON.parse(e.newValue); if (Array.isArray(p)) setCashEntries(p); }
      } catch {}
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      try {
        setCustomers(loadCustomersShared() as Customer[]);
        setTransactions(loadTransactionsShared() as Transaction[]);
        setHawalas(loadHawalasShared());
        setCashEntries(loadCashEntriesShared() as CashEntry[]);
      } catch {}
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const currentDateTime = now ? formatDateTime(now) : "";

  const ledger = useMemo(() => {
    try { return buildLedger(customers, transactions, hawalas, cashEntries); } catch { return []; }
  }, [customers, transactions, hawalas, cashEntries]);

  const dailyJournal = useMemo(() => {
    const days: Record<string, { transactions: LedgerEntry[]; cashEntries: CashEntry[]; date: Date }> = {};

    for (const entry of ledger) {
      const key = shortDateLabel(entry.date);
      if (!days[key]) days[key] = { transactions: [], cashEntries: [], date: new Date(entry.date) };
      days[key].transactions.push(entry);
    }

    for (const ce of cashEntries) {
      if (ce.status === "voided") continue;
      if (ce.linkedExchangeId || ce.linkedTransferId || ce.linkedConvertId || ce.linkedHawalaId || ce.linkedHawalaSettleId) continue;
      const key = shortDateLabel(ce.date);
      if (!days[key]) days[key] = { transactions: [], cashEntries: [], date: new Date(ce.date) };
      days[key].cashEntries.push(ce);
    }

    return Object.entries(days).sort(([, a], [, b]) => b.date.getTime() - a.date.getTime());
  }, [ledger, cashEntries]);

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

  const debtorCustomers = useMemo(() => {
    return customers.filter(c => currencies.some(cur => (c.balances?.[cur] || 0) < 0));
  }, [customers]);

  const withBalanceCount = customers.filter(c => currencies.some(cur => (c.balances?.[cur] || 0) !== 0)).length;

  const getCustomerTransactions = useCallback((customerId: string) => {
    return ledger.filter(e => e.customerId === customerId);
  }, [ledger]);

  const generateCustomerReport = useCallback((customer: Customer): string => {
    const txs = getCustomerTransactions(customer.id);
    let report = `📊 گزارش معاملات مشتری\n\n`;
    report += `👤 نام: ${customer.name}\n`;
    if (customer.phone) report += `📞 تلفن: ${customer.phone}\n`;
    if (customer.tazkira) report += `🆔 تذکره: ${customer.tazkira}\n`;
    report += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    report += `💼 موجودی حساب:\n`;
    for (const cur of currencies) {
      const bal = customer.balances?.[cur] || 0;
      if (bal !== 0) {
        const status = bal > 0 ? "طلب" : "قرض";
        report += `  • ${labels[cur]}: ${fmt(Math.abs(bal))} (${status})\n`;
      }
    }
    report += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    report += `📋 تاریخچه معاملات (${txs.length} رویداد):\n\n`;
    txs.slice(0, 20).forEach((tx, i) => {
      report += `${i + 1}. ${txLabels[tx.type]}\n`;
      report += `   📅 ${shortDateLabel(tx.date)}\n`;
      report += `   💱 ${fmt(tx.amount)} ${labels[tx.currency]} (${tx.direction === "in" ? "دریافت" : "پرداخت"})\n`;
      report += `\n`;
    });
    if (txs.length > 20) report += `... و ${txs.length - 20} رویداد دیگر\n`;
    report += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    report += `🏦 صرافی برادران نورزاد — هرات`;
    return report;
  }, [getCustomerTransactions]);

  const shareViaTelegram = useCallback((customer: Customer) => {
    const text = generateCustomerReport(customer);
    const url = `https://t.me/share/url?url=${encodeURIComponent(" ")}&text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  }, [generateCustomerReport]);

  const shareViaWhatsApp = useCallback((customer: Customer) => {
    const text = generateCustomerReport(customer);
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
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
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }, []);

  const showToast = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 3500);
  }, []);

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
  const identIcon = dk ? "from-blue-400/20 to-sky-400/5 text-blue-300 ring-blue-400/25" : "from-blue-400/20 to-sky-400/10 text-blue-600 ring-blue-400/30";

  return (
    <div dir="rtl" className={dk ? "dark" : ""}>
      <style>{`@import url("https://fonts.googleapis.com/css2?family=Lalezar&family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap");.rp-font{font-family:"Vazirmatn","Segoe UI",Tahoma,sans-serif}.rp-display{font-family:"Lalezar","Vazirmatn",Tahoma,sans-serif}.dark{color-scheme:dark}@keyframes rpUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}.rp-up{animation:rpUp .5s cubic-bezier(.22,.8,.35,1) both}.rp-scroll::-webkit-scrollbar{height:6px;width:6px}.rp-scroll::-webkit-scrollbar-thumb{background:rgba(16,185,129,.3);border-radius:3px}.rp-scroll{scrollbar-width:thin}@keyframes menuIn{from{opacity:0;transform:scale(.95) translateY(-4px)}to{opacity:1;transform:scale(1) translateY(0)}}.rp-menu{animation:menuIn .15s ease-out}`}</style>
      <div className={`rp-font relative min-h-screen overflow-x-hidden antialiased transition-colors duration-500 ${dk ? "bg-[#0f172a] text-slate-100" : "bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 text-slate-800"}`}>
        <div className={`fixed inset-x-0 top-0 z-30 h-1 bg-gradient-to-l ${dk ? "from-emerald-400 via-teal-400 to-cyan-400" : "from-emerald-500 via-teal-500 to-cyan-500"}`} />
        <div className="relative z-10 mx-auto w-full max-w-7xl space-y-4 md:space-y-6 px-3 pb-16 pt-5 md:px-8 md:pt-9">

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
                    <div className={`text-2xl md:text-3xl font-black tabular-nums mt-1 ${s.text}`}>{s.value}</div>
                  </div>
                  <div className={`grid h-10 w-10 md:h-12 md:w-12 place-items-center rounded-xl bg-gradient-to-br ${s.color} text-white shadow-lg`}>
                    <Ic n={s.icon as IconName} className="h-5 w-5 md:h-6 md:w-6" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className={`rp-up flex gap-1.5 md:gap-2 rounded-xl md:rounded-2xl border p-1.5 md:p-2 shadow-sm backdrop-blur ${glassChip}`} style={{ animationDelay: "140ms" }}>
            {[
              { id: "search" as const, label: "جستجوی مشتری", icon: "search" },
              { id: "debtors" as const, label: "مشتریان بدهکار", icon: "alert", count: debtorCustomers.length },
              { id: "journal" as const, label: "روزنامچه عمومی", icon: "calendar", count: dailyJournal.length }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id)}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 md:gap-2 rounded-lg md:rounded-xl px-3 md:px-5 py-2.5 md:py-3 text-xs md:text-sm font-black transition-all duration-300 active:scale-[0.97] ${activeSection === tab.id ? `bg-gradient-to-l shadow-lg ${dk ? "from-blue-400 to-sky-400 text-slate-950" : "from-blue-500 to-sky-500 text-white"}` : dk ? "text-slate-400 hover:bg-slate-700/60 hover:text-slate-100" : "text-slate-500 hover:bg-blue-50 hover:text-slate-800"}`}
              >
                <Ic n={tab.icon as IconName} className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${activeSection === tab.id ? dk ? "bg-slate-950/20 text-slate-950" : "bg-white/30 text-white" : dk ? "bg-slate-700 text-slate-300" : "bg-blue-100 text-blue-700"}`}>
                    {fa(tab.count)}
                  </span>
                )}
              </button>
            ))}
          </div>

          {activeSection === "search" && (
            <section className={`rp-up space-y-4 ${uiCard}`} style={{ animationDelay: "160ms" }}>
              <div className="flex flex-wrap items-center gap-3 p-4 md:p-5 pb-3 md:pb-4 md:px-7 md:pt-6">
                <span className={`grid h-10 w-10 md:h-11 md:w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${identIcon}`}><Ic n="search" className="h-5 w-5" /></span>
                <div className="flex-1 min-w-0">
                  <h2 className={`rp-display text-xl md:text-2xl leading-none ${heading}`}>جستجوی مشتری</h2>
                  <p className={`mt-1 text-[11px] font-bold ${subText}`}>بر اساس نام، تلفن یا شماره تذکره</p>
                </div>
              </div>
              <div className="px-4 md:px-7 pb-4 space-y-3">
                <div className="relative">
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="نام، تلفن یا شماره تذکره را وارد کنید..." className={`${uiInput} pr-10`} />
                  <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${subText}`}><Ic n="search" className="h-4 w-4" /></span>
                </div>
                {search && (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto rp-scroll">
                    {searchResults.length === 0 ? (
                      <div className={`text-center py-12 ${subText}`}>
                        <div className={`grid h-16 w-16 place-items-center rounded-2xl border border-dashed mx-auto mb-3 ${dk ? "border-slate-600 bg-slate-800/40" : "border-slate-300 bg-slate-50"}`}><Ic n="inbox" className="h-7 w-7 opacity-70" /></div>
                        <p className="text-sm font-black">مشتری‌ای یافت نشد</p>
                      </div>
                    ) : (
                      searchResults.map(c => {
                        const hasDebt = currencies.some(cur => (c.balances?.[cur] || 0) < 0);
                        return (
                          <div key={c.id} className={`p-4 rounded-xl border transition-all ${hasDebt ? (dk ? "border-rose-400/30 bg-rose-400/[0.03]" : "border-rose-200 bg-rose-50/30") : (dk ? "border-slate-700 bg-slate-800/50 hover:bg-slate-800" : "border-slate-200 bg-white hover:bg-slate-50")}`}>
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className={`grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white font-black text-sm shadow-md`}>{c.name.charAt(0)}</div>
                                  <div>
                                    <b className={`block text-sm font-black ${dk ? "text-white" : "text-slate-900"}`}>{c.name}</b>
                                    {hasDebt && <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${dk ? "bg-rose-400/15 text-rose-300" : "bg-rose-100 text-rose-600"}`}>⚠️ بدهکار</span>}
                                  </div>
                                </div>
                                <div className={`flex flex-wrap gap-3 mt-2 text-[11px] ${subText}`}>
                                  {c.phone && <span>📱 <span dir="ltr">{c.phone}</span></span>}
                                  {c.tazkira && <span>🆔 <span dir="ltr">{c.tazkira}</span></span>}
                                </div>
                                <div className="grid grid-cols-5 gap-1 mt-3">
                                  {currencies.map(cur => {
                                    const bal = c.balances?.[cur] || 0;
                                    return (
                                      <div key={cur} className={`rounded-lg px-1.5 py-1.5 text-center ${dk ? "bg-slate-900/50" : "bg-slate-50"}`}>
                                        <div className={`text-[8px] font-black ${subText}`}>{labels[cur]}</div>
                                        <div className={`text-[10px] font-black tabular-nums ${bal < 0 ? "text-rose-500" : bal > 0 ? (dk ? "text-emerald-300" : "text-emerald-700") : subText}`}>{fmt(bal)}</div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                              <div className="flex flex-col gap-2 shrink-0">
                                <button onClick={() => setSelectedCustomer(c)} className={`px-4 py-2 rounded-lg text-xs font-black flex items-center gap-1.5 ${dk ? "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30" : "bg-blue-100 text-blue-700 hover:bg-blue-200"}`}><Ic n="eye" className="h-3.5 w-3.5" />مشاهده</button>
                                <button onClick={() => setShareCustomer(c)} className={`px-4 py-2 rounded-lg text-xs font-black flex items-center gap-1.5 ${dk ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"}`}><Ic n="share" className="h-3.5 w-3.5" />اشتراک</button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {activeSection === "debtors" && (
            <section className={`rp-up space-y-4 ${uiCard}`} style={{ animationDelay: "160ms" }}>
              <div className="flex flex-wrap items-center gap-3 p-4 md:p-5 pb-3 md:pb-4 md:px-7 md:pt-6">
                <span className={`grid h-10 w-10 md:h-11 md:w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${dk ? "from-rose-400/20 to-pink-400/5 text-rose-300 ring-rose-400/25" : "from-rose-400/20 to-pink-400/10 text-rose-600 ring-rose-400/30"}`}><Ic n="alert" className="h-5 w-5" /></span>
                <div className="flex-1 min-w-0">
                  <h2 className={`rp-display text-xl md:text-2xl leading-none ${heading}`}>مشتریان بدهکار</h2>
                  <p className={`mt-1 text-[11px] font-bold ${subText}`}>{fa(debtorCustomers.length)} مشتری دارای بدهی به صرافی</p>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-[10px] font-black ring-1 ${dk ? "bg-rose-400/15 text-rose-300 ring-rose-400/25" : "bg-rose-100 text-rose-700 ring-rose-300/60"}`}>⚠️ توجه ویژه</span>
              </div>
              <div className="px-4 md:px-7 pb-4 space-y-3 max-h-[600px] overflow-y-auto rp-scroll">
                {debtorCustomers.length === 0 ? (
                  <div className={`text-center py-12 ${subText}`}>
                    <div className={`grid h-16 w-16 place-items-center rounded-2xl border border-dashed mx-auto mb-3 ${dk ? "border-emerald-600 bg-emerald-400/10" : "border-emerald-300 bg-emerald-50"}`}><Ic n="check" className="h-7 w-7 text-emerald-500" /></div>
                    <p className="text-sm font-black">هیچ مشتری بدهکاری وجود ندارد</p>
                  </div>
                ) : (
                  debtorCustomers.map(c => {
                    const debts = currencies.filter(cur => (c.balances?.[cur] || 0) < 0);
                    return (
                      <div key={c.id} className={`p-4 rounded-xl border ${dk ? "border-rose-400/25 bg-rose-400/[0.03]" : "border-rose-200 bg-rose-50/30"}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className={`grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 text-white font-black text-sm shadow-md`}>{c.name.charAt(0)}</div>
                              <div>
                                <b className={`block text-sm font-black ${dk ? "text-white" : "text-slate-900"}`}>{c.name}</b>
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${dk ? "bg-rose-400/15 text-rose-300" : "bg-rose-100 text-rose-600"}`}>⚠️ بدهکار</span>
                              </div>
                            </div>
                            <div className={`flex flex-wrap gap-3 mt-2 text-[11px] ${subText}`}>
                              {c.phone && <span>📱 <span dir="ltr">{c.phone}</span></span>}
                              {c.tazkira && <span>🆔 <span dir="ltr">{c.tazkira}</span></span>}
                            </div>
                            <div className="mt-3 space-y-1.5">
                              {debts.map(cur => (
                                <div key={cur} className="flex items-center justify-between text-xs rounded-lg px-3 py-1.5 bg-white/50 dark:bg-slate-900/30">
                                  <span className={`font-black ${currencyColors[cur][dk ? "dark" : "light"]}`}>{labels[cur]}</span>
                                  <span className={`font-black tabular-nums text-rose-500`}>{fmt(Math.abs(c.balances?.[cur] || 0))}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 shrink-0">
                            <button onClick={() => setSelectedCustomer(c)} className={`px-4 py-2 rounded-lg text-xs font-black flex items-center gap-1.5 ${dk ? "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30" : "bg-blue-100 text-blue-700 hover:bg-blue-200"}`}><Ic n="eye" className="h-3.5 w-3.5" />مشاهده</button>
                            <button onClick={() => setShareCustomer(c)} className={`px-4 py-2 rounded-lg text-xs font-black flex items-center gap-1.5 ${dk ? "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30" : "bg-rose-100 text-rose-700 hover:bg-rose-200"}`}><Ic n="share" className="h-3.5 w-3.5" />ارسال گزارش</button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          )}

          {activeSection === "journal" && (
            <section className={`rp-up space-y-4 ${uiCard}`} style={{ animationDelay: "160ms" }}>
              <div className="flex flex-wrap items-center gap-3 p-4 md:p-5 pb-3 md:pb-4 md:px-7 md:pt-6">
                <span className={`grid h-10 w-10 md:h-11 md:w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${dk ? "from-amber-400/20 to-orange-400/5 text-amber-300 ring-amber-400/25" : "from-amber-400/20 to-orange-400/10 text-amber-600 ring-amber-400/30"}`}><Ic n="calendar" className="h-5 w-5" /></span>
                <div className="flex-1 min-w-0">
                  <h2 className={`rp-display text-xl md:text-2xl leading-none ${heading}`}>روزنامچه عمومی</h2>
                  <p className={`mt-1 text-[11px] font-bold ${subText}`}>{fa(dailyJournal.length)} روز ثبت‌شده — به ترتیب تاریخ</p>
                </div>
              </div>
              <div className="px-4 md:px-7 pb-4 space-y-2 max-h-[700px] overflow-y-auto rp-scroll">
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
                    const totalCommission = data.transactions.filter(t => t.type === "fee").reduce((sum, tx) => sum + tx.amount, 0);
                    return (
                      <div key={day} className={`rounded-xl border overflow-hidden ${dk ? "border-slate-700" : "border-slate-200"}`}>
                        <button onClick={() => toggleDay(day)} className={`w-full flex items-center justify-between p-4 transition-colors ${dk ? "bg-slate-800/50 hover:bg-slate-800" : "bg-white hover:bg-slate-50"}`}>
                          <div className="flex items-center gap-3">
                            <div className={`grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md`}><Ic n="calendar" className="h-4 w-4" /></div>
                            <div className="text-right">
                              <b className={`block text-sm font-black ${dk ? "text-white" : "text-slate-900"}`}>{day}</b>
                              <div className={`flex gap-3 mt-1 text-[10px] ${subText}`}>
                                <span>{fa(txCount)} معامله</span>
                                <span>{fa(cashCount)} سند صندوق</span>
                                {totalCommission > 0 && <span className={dk ? "text-amber-300" : "text-amber-600"}>💰 {fmt(totalCommission)}</span>}
                              </div>
                            </div>
                          </div>
                          <span className={`text-xl transition-transform ${isExpanded ? "rotate-180" : ""}`}><Ic n="chevron" className="h-5 w-5" /></span>
                        </button>
                        {isExpanded && (
                          <div className={`p-4 space-y-3 border-t ${dk ? "border-slate-700 bg-slate-900/50" : "border-slate-200 bg-slate-50"}`}>
                            {data.transactions.length > 0 && (
                              <div>
                                <b className={`block text-xs font-black mb-2 ${dk ? "text-blue-300" : "text-blue-600"}`}>معاملات مشتریان ({fa(data.transactions.length)}):</b>
                                <div className="space-y-1 max-h-64 overflow-y-auto rp-scroll">
                                  {data.transactions.map(tx => (
                                    <div key={tx.id} className={`flex items-center justify-between p-2.5 rounded-lg text-xs ${dk ? "bg-slate-800/50" : "bg-white"}`}>
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-black ${txColors[tx.type][dk ? "dark" : "light"]}`}>{txLabels[tx.type]}</span>
                                        <span className={`truncate ${dk ? "text-slate-300" : "text-slate-700"}`}>{tx.customerName || "—"}</span>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <span className={`font-black tabular-nums ${tx.direction === "in" ? "text-emerald-500" : "text-rose-500"}`}>{tx.direction === "in" ? "+" : "-"} {fmt(tx.amount)}</span>
                                        <span className={`text-[9px] ${subText} mr-1`}>{labels[tx.currency]}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {data.cashEntries.length > 0 && (
                              <div>
                                <b className={`block text-xs font-black mb-2 ${dk ? "text-emerald-300" : "text-emerald-600"}`}>اسناد صندوق ({fa(data.cashEntries.length)}):</b>
                                <div className="space-y-1 max-h-64 overflow-y-auto rp-scroll">
                                  {data.cashEntries.map(ce => {
                                    const cur = ce.currency as Currency;
                                    return (
                                      <div key={ce.id} className={`flex items-center justify-between p-2.5 rounded-lg text-xs ${dk ? "bg-slate-800/50" : "bg-white"}`}>
                                        <span className={`truncate ${dk ? "text-slate-300" : "text-slate-700"}`}>{ce.reason || ce.type}</span>
                                        <div className="text-right shrink-0">
                                          <span className={`font-black tabular-nums ${ce.direction === "in" ? "text-emerald-500" : "text-rose-500"}`}>{ce.direction === "in" ? "+" : "-"} {fmt(ce.amount)}</span>
                                          <span className={`text-[9px] ${subText} mr-1`}>{labels[cur]}</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            {data.transactions.length === 0 && data.cashEntries.length === 0 && (
                              <div className={`text-center py-6 ${subText}`}><p className="text-xs font-bold">هیچ رویدادی در این روز ثبت نشده</p></div>
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

      {/* ═══════════ Customer Details Modal - Full Details ═══════════ */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm" onClick={() => setSelectedCustomer(null)}>
          <div className={`w-full max-w-3xl rounded-2xl border shadow-2xl ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-white"}`} onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between border-b px-4 py-3 ${dk ? "border-slate-700" : "border-slate-100"}`}>
              <b className={`text-sm font-black flex items-center gap-2 ${dk ? "text-slate-100" : "text-slate-800"}`}>
                <Ic n="user" className="h-4 w-4" />
                جزئیات کامل مشتری
              </b>
              <button onClick={() => setSelectedCustomer(null)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700">
                <Ic n="x" className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[80vh] overflow-y-auto p-4 space-y-4">
              {/* Customer Info Section */}
              <div className={`rounded-xl border p-4 ${dk ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`grid h-14 w-14 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white font-black text-2xl shadow-lg`}>
                    {selectedCustomer.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <b className={`block text-lg font-black ${dk ? "text-white" : "text-slate-900"}`}>{selectedCustomer.name}</b>
                    <div className={`flex flex-wrap gap-3 mt-1 text-[11px] ${subText}`}>
                      {selectedCustomer.phone && <span>📱 <span dir="ltr">{selectedCustomer.phone}</span></span>}
                      {selectedCustomer.tazkira && <span>🆔 <span dir="ltr">{selectedCustomer.tazkira}</span></span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Balances Section */}
              <div>
                <b className={`block text-xs font-black mb-2 ${dk ? "text-emerald-300" : "text-emerald-600"}`}>💼 موجودی حساب:</b>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {currencies.map(cur => {
                    const bal = selectedCustomer.balances?.[cur] || 0;
                    return (
                      <div key={cur} className={`rounded-lg p-3 text-center ${dk ? "bg-slate-800/50" : "bg-slate-100"}`}>
                        <div className={`text-[9px] font-black ${subText}`}>{labels[cur]}</div>
                        <div className={`text-lg font-black tabular-nums mt-1 ${bal < 0 ? "text-rose-500" : bal > 0 ? (dk ? "text-emerald-300" : "text-emerald-700") : subText}`}>
                          {fmt(bal)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Transaction History Section - Corrected Logic */}
              <div>
                <b className={`block text-xs font-black mb-3 ${dk ? "text-blue-300" : "text-blue-600"}`}>📋 تاریخچه رویدادهای مالی:</b>
                <div className="space-y-3 max-h-96 overflow-y-auto rp-scroll">
                  {getCustomerTransactions(selectedCustomer.id).length === 0 ? (
                    <div className={`text-center py-8 ${subText}`}>
                      <p className="text-xs">هیچ رویداد مالی ثبت نشده</p>
                    </div>
                  ) : (
                    getCustomerTransactions(selectedCustomer.id).map(tx => {
                      const dt = splitDateTime(tx.date);
                      return (
                        <div key={tx.id} className={`rounded-xl border p-4 ${dk ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-white"}`}>
                          {/* Header Row */}
                          <div className="flex items-center justify-between mb-3 pb-3 border-b border-dashed border-slate-300/30">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${txColors[tx.type][dk ? "dark" : "light"]}`}>
                                {txLabels[tx.type]}
                              </span>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded ${dk ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-700"}`}>
                                {tx.description}
                              </span>
                            </div>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded ${dk ? "bg-cyan-400/15 text-cyan-300" : "bg-cyan-100 text-cyan-700"}`}>
                              <Ic n="tag" className="h-3 w-3" />
                              {tx.referenceNumber || "-"}
                            </span>
                          </div>

                          {/* Date and Time */}
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                              <div className={`text-[9px] font-black ${subText}`}>📅 تاریخ</div>
                              <div className={`text-xs font-black ${dk ? "text-slate-200" : "text-slate-700"}`} dir="ltr">{dt.datePart}</div>
                            </div>
                            <div>
                              <div className={`text-[9px] font-black ${subText}`}>⏰ ساعت</div>
                              <div className={`text-xs font-black ${dk ? "text-slate-200" : "text-slate-700"}`} dir="ltr">{dt.timePart}</div>
                            </div>
                          </div>

                          {/* Amount and Direction */}
                          <div className={`rounded-lg p-3 mb-3 ${tx.direction === "in" ? (dk ? "bg-emerald-400/10" : "bg-emerald-50") : (dk ? "bg-rose-400/10" : "bg-rose-50")}`}>
                            <div className={`text-[9px] font-black ${subText}`}>
                              {tx.direction === "in" ? "💵 مبلغ دریافتی / اضافه شده" : "💰 مبلغ پرداختی / کسر شده"}
                            </div>
                            <div className={`text-lg font-black tabular-nums ${tx.direction === "in" ? "text-emerald-500" : "text-rose-500"}`}>
                              {tx.direction === "in" ? "+" : "-"} {fmt(tx.amount)}
                            </div>
                            <div className={`text-[11px] font-black ${currencyColors[tx.currency][dk ? "dark" : "light"]}`}>{labels[tx.currency]}</div>
                          </div>

                          {/* Balance After */}
                          <div className={`rounded-lg p-2.5 ${dk ? "bg-slate-700/50" : "bg-slate-100"}`}>
                            <div className={`text-[9px] font-black ${subText}`}>💰 مانده حساب پس از این رویداد</div>
                            <div className={`text-sm font-black tabular-nums ${dk ? "text-slate-200" : "text-slate-700"}`}>{fmt(tx.balanceAfter)}</div>
                            <div className={`text-[10px] font-black ${currencyColors[tx.currency][dk ? "dark" : "light"]}`}>{labels[tx.currency]}</div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Share Button */}
              <button
                onClick={() => { setShareCustomer(selectedCustomer); setSelectedCustomer(null); }}
                className={`w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 ${dk ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}
              >
                <Ic n="share" className="h-4 w-4" />
                اشتراک‌گذاری گزارش
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ Share Modal ═══════════ */}
      {shareCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm" onClick={() => setShareCustomer(null)}>
          <div className={`w-full max-w-md rounded-2xl border shadow-2xl ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-white"}`} onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between border-b px-4 py-3 ${dk ? "border-slate-700" : "border-slate-100"}`}>
              <b className={`text-sm font-black flex items-center gap-2 ${dk ? "text-slate-100" : "text-slate-800"}`}>
                <Ic n="share" className="h-4 w-4" />
                اشتراک‌گذاری گزارش
              </b>
              <button onClick={() => setShareCustomer(null)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700">
                <Ic n="x" className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className={`rounded-xl border p-3 ${dk ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-center gap-2">
                  <div className={`grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 text-white font-black text-xs`}>
                    {shareCustomer.name.charAt(0)}
                  </div>
                  <div>
                    <p className={`text-xs font-black ${dk ? "text-white" : "text-slate-800"}`}>{shareCustomer.name}</p>
                    <p className={`text-[10px] ${subText}`}>گزارش معاملات این مشتری را ارسال کنید</p>
                  </div>
                </div>
              </div>
              <button onClick={() => { shareViaTelegram(shareCustomer); setShareCustomer(null); }} className={`w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 ${dk ? "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30" : "bg-blue-100 text-blue-700 hover:bg-blue-200"}`}><span className="text-xl">📱</span> تلگرام</button>
              <button onClick={() => { shareViaWhatsApp(shareCustomer); setShareCustomer(null); }} className={`w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 ${dk ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"}`}><span className="text-xl">💬</span> واتساپ</button>
              <button onClick={() => { shareViaImo(shareCustomer); setShareCustomer(null); }} className={`w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 ${dk ? "bg-violet-500/20 text-violet-300 hover:bg-violet-500/30" : "bg-violet-100 text-violet-700 hover:bg-violet-200"}`}><span className="text-xl">📨</span> ایمو (کپی در کلیپ‌بورد)</button>
              <button onClick={async () => { try { const text = generateCustomerReport(shareCustomer); await navigator.clipboard.writeText(text); showToast("✅ گزارش کپی شد"); } catch { showToast("❌ خطا در کپی"); } setShareCustomer(null); }} className={`w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 ${dk ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}><Ic n="copy" className="h-4 w-4" /> کپی متن گزارش</button>
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
