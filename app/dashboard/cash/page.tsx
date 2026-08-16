"use client";
import { useEffect, useMemo, useState, useRef, useCallback, memo, type ReactNode } from "react";
import { getNextTrackingCode, consumeTrackingCode, initTrackingSystem } from "../lib/trackingCode";
import { CUSTOMERS_KEY, TRANSACTIONS_KEY, HAWALAS_KEY, CASH_KEY, loadCustomersShared, loadTransactionsShared, loadHawalasShared, loadCashEntriesShared } from "../lib/defaultData";

type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";
type Customer = { id: string; name: string; phone?: string; tazkira?: string; address?: string; note?: string; telegram?: string; registeredAt: string; balances: Record<Currency, number>; };
type CashEntryType = "customer_deposit" | "customer_withdraw" | "owner_deposit" | "owner_withdraw" | "adjustment" | "fee" | "commission_withdraw";
type BalanceChange = { customerId?: string; customerName: string; currency: Currency; amount: number; };
type CashEntry = { id: string; trackingCode: string; date: string; type: CashEntryType; currency: Currency; amount: number; direction: "in" | "out"; reason: string; balanceAfter: number; customerId?: string; customerName?: string; customerPhone?: string; customerTazkira?: string; linkedExchangeId?: string; linkedHawalaId?: string; linkedHawalaSettleId?: string; customerDeleted?: boolean; status: "active" | "voided"; };
type Transaction = { id: string; trackingCode: string; date: string; type: "exchange" | "transfer" | "convert"; fromCurrency: Currency; fromAmount: number; toCurrency: Currency; toAmount: number; rate: number; rateLabel: string; commission?: number; commissionCurrency?: Currency; commissionPayer?: "sender" | "receiver"; status: "active" | "voided"; customerId?: string; customerName?: string; senderId?: string; senderName?: string; receiverId?: string; receiverName?: string; };
type Hawala = { id: string; number: string; date: string; currencyFrom: Currency; currencyTo: Currency; amountFrom: number; finalAmount: number; fee: number; feeCurrency: Currency; feePayer: "sender" | "receiver"; status: "pending" | "sent" | "paid" | "cancelled"; senderId?: string; senderName: string; receiverId?: string; receiverName: string; };
type FormState = { type: CashEntryType | ""; currency: Currency; amount: string; reason: string; customerId: string; customerName: string; };
type FormErrors = Partial<Record<keyof FormState, string>>;

const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const labels: Record<Currency, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };
const entryTypeLabels: Record<CashEntryType, string> = { customer_deposit: "واریز مشتری", customer_withdraw: "برداشت مشتری", owner_deposit: "واریز مالک", owner_withdraw: "برداشت مالک", adjustment: "اصلاح صندوق", fee: "کارمزد", commission_withdraw: "برداشت کارمزد" };
const entryTypeColors: Record<CashEntryType, { light: string; dark: string }> = { customer_deposit: { light: "bg-teal-100 text-teal-700", dark: "bg-teal-400/15 text-teal-300" }, customer_withdraw: { light: "bg-orange-100 text-orange-700", dark: "bg-orange-400/15 text-orange-300" }, owner_deposit: { light: "bg-sky-100 text-sky-700", dark: "bg-sky-400/15 text-sky-300" }, owner_withdraw: { light: "bg-amber-100 text-amber-700", dark: "bg-amber-400/15 text-amber-300" }, adjustment: { light: "bg-violet-100 text-violet-700", dark: "bg-violet-400/15 text-violet-300" }, fee: { light: "bg-emerald-100 text-emerald-700", dark: "bg-emerald-400/15 text-emerald-300" }, commission_withdraw: { light: "bg-purple-100 text-purple-700", dark: "bg-purple-400/15 text-purple-300" } };
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

function computeCashBalances(entries: CashEntry[]): Record<Currency, number> {
  const balances: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
  const sorted = [...entries].sort((a, b) => { try { return new Date(a.date).getTime() - new Date(b.date).getTime(); } catch { return 0; } });
  for (const e of sorted) { if (!currencies.includes(e.currency)) continue; if (e.status === "voided") continue; balances[e.currency] += e.direction === "in" ? e.amount : -e.amount; }
  return balances;
}

function recomputeCashBalances(entries: CashEntry[]): CashEntry[] {
  const sorted = [...entries].sort((a, b) => { const t1 = new Date(a.date).getTime(); const t2 = new Date(b.date).getTime(); if (t1 !== t2) return t1 - t2; const aIsHawala = a.linkedHawalaId || a.linkedHawalaSettleId; const bIsHawala = b.linkedHawalaId || b.linkedHawalaSettleId; if (aIsHawala && bIsHawala) { if (a.direction === "out" && b.direction === "in") return -1; if (a.direction === "in" && b.direction === "out") return 1; } if (a.direction === "in" && b.direction === "out") return -1; if (a.direction === "out" && b.direction === "in") return 1; return 0; });
  const bals: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
  return sorted.map(e => {
    if (e.status === "voided") return { ...e, balanceAfter: bals[e.currency] || 0 };
    if (e.currency && bals[e.currency] !== undefined) {
      bals[e.currency] += e.direction === "in" ? (e.amount || 0) : -(e.amount || 0);
    }
    return { ...e, balanceAfter: bals[e.currency] || 0 };
  });
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

// ============================================================================
// ✅ تابع جدید: Migration برای entries قدیمی بدون status
// ============================================================================
function migrateEntries(entries: any[]): CashEntry[] {
  return entries.map(e => ({
    ...e,
    status: e.status || "active" // اگر status ندارد، "active" بگذار
  })) as CashEntry[];
}

const emptyForm: FormState = { type: "", currency: "AFN", amount: "", reason: "", customerId: "", customerName: "" };

const Ic = ({ n, className = "h-5 w-5" }: { n: string; className?: string }) => {
  const paths: Record<string, string> = {
    wallet: "M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3",
    plus: "M12 4.5v15m7.5-7.5h-15",
    arrowDown: "M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3",
    arrowUp: "M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18",
    user: "M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z",
    doc: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
    search: "m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 1 10.607 10.607Z",
    chevron: "m19.5 8.25-7.5 7.5-7.5-7.5",
    x: "M6 18 18 6M6 6l12 12",
    check: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    alert: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z",
    inbox: "M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z",
    sun: "M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.375 3.375 0 1 1-7.5 0 3.375 3.375 0 0 1 7.5 0Z",
    moon: "M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z",
    clock: "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    tag: "M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z",
    trash: "M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0",
    history: "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    pencil: "m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10",
    more: "M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z",
    eye: "M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
    xCircle: "m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    gem: "M12 2 2 7l10 15L22 7l-10-5Z",
    crown: "M2 18h20l-2-9-4 4-4-7-4 7-4-4-2 9Z"
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d={paths[n] || ""} /></svg>;
};

export default function CashPage() {
  const [mounted, setMounted] = useState(false);
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [hawalas, setHawalas] = useState<Hawala[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [activeTab, setActiveTab] = useState<"register" | "ledger">("register");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [toast, setToast] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<CashEntry | null>(null);
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [
