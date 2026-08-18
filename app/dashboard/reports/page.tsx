"use client";

import { useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import { initTrackingSystem } from "../lib/trackingCode";
import { CUSTOMERS_KEY, TRANSACTIONS_KEY, HAWALAS_KEY, CASH_KEY, loadCustomersShared, loadTransactionsShared, loadHawalasShared, loadCashEntriesShared } from "../lib/defaultData";

type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";
type Customer = { id: string; name: string; phone?: string; tazkira?: string; address?: string; note?: string; telegram?: string; registeredAt: string; balances: Record<Currency, number>; };
type TxType = "exchange" | "transfer" | "convert" | "hawala" | "deposit" | "withdraw" | "fee" | "correction";
type LedgerEntry = { id: string; date: string; customerId: string; type: TxType; description: string; currency: Currency; amount: number; direction: "in" | "out"; balanceAfter: number; referenceId?: string; referenceNumber?: string; };

const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const labels: Record<Currency, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };
const txLabels: Record<TxType, string> = { exchange: "تبادل ارز", transfer: "انتقال", convert: "تبدیل ارز", hawala: "حواله", deposit: "واریز", withdraw: "برداشت", fee: "کارمزد", correction: "اصلاح" };
const txColors: Record<TxType, { light: string; dark: string }> = { exchange: { light: "bg-sky-100 text-sky-700", dark: "bg-sky-400/15 text-sky-300" }, transfer: { light: "bg-violet-100 text-violet-700", dark: "bg-violet-400/15 text-violet-300" }, convert: { light: "bg-purple-100 text-purple-700", dark: "bg-purple-400/15 text-purple-300" }, hawala: { light: "bg-blue-100 text-blue-700", dark: "bg-blue-400/15 text-blue-300" }, deposit: { light: "bg-emerald-100 text-emerald-700", dark: "bg-emerald-400/15 text-emerald-300" }, withdraw: { light: "bg-rose-100 text-rose-700", dark: "bg-rose-400/15 text-rose-300" }, fee: { light: "bg-amber-100 text-amber-700", dark: "bg-amber-400/15 text-amber-300" }, correction: { light: "bg-orange-100 text-orange-700", dark: "bg-orange-400/15 text-orange-300" } };
const currencyColors: Record<Currency, { light: string; dark: string; gradient: string }> = { AFN: { light: "text-emerald-700", dark: "text-emerald-300", gradient: "from-emerald-500 to-teal-400" }, USD: { light: "text-sky-700", dark: "text-sky-300", gradient: "from-sky-500 to-cyan-400" }, EUR: { light: "text-blue-700", dark: "text-blue-300", gradient: "from-blue-600 to-blue-400" }, IRR: { light: "text-amber-700", dark: "text-amber-300", gradient: "from-amber-500 to-orange-400" }, PKR: { light: "text-rose-700", dark: "text-rose-300", gradient: "from-rose-500 to-pink-400" } };

const CASH_BOX_ID = "CASH_BOX";
const CASH_BOX_NAME = "صندوق";

const normalizeDigits = (v: string) => { const pd = "۰۱۲۳۴۵۶۷۸۹", ad = "٠١٢٣٤٥٦٧٨٩"; return String(v || "").replace(/[۰-۹]/g, d => String(pd.indexOf(d))).replace(/[٠-٩]/g, d => String(ad.indexOf(d))); };
const fmt = (n: number) => Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0";
const fa = (n: number) => Number.isFinite(n) ? n.toLocaleString("fa-IR", { maximumFractionDigits: 0 }) : "۰";

function shamsiParts(d: Date) { try { const p = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d); const g = (t: string) => p.find(x => x.type === t)?.value || "0"; return { year: g("year"), month: g("month"), day: g("day") }; } catch { return { year: "0", month: "0", day: "0" }; } }
function formatDateTime(d: Date) { const pad = (n: number) => String(n).padStart(2, "0"); const s = shamsiParts(d); return `${s.year}/${s.month}/${s.day} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function formatShamsiDate(d: Date) { const s = shamsiParts(d); return `${s.year}/${s.month}/${s.day}`; }
function shortDateLabel(s: string) { try { const d = new Date(s); return Number.isNaN(d.getTime()) ? "-" : formatShamsiDate(d); } catch { return "-"; } }
function timeLabel(s: string) { try { const d = new Date(s); if (Number.isNaN(d.getTime())) return "-"; const p = (n: number) => String(n).padStart(2, "0"); return `${p(d.getHours())}:${p(d.getMinutes())}`; } catch { return "-"; } }

function buildLedger(customers: Customer[], transactions: any[], hawalas: any[], cashEntries: any[]): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  if (!Array.isArray(customers) || !Array.isArray(transactions) || !Array.isArray(hawalas) || !Array.isArray(cashEntries)) return entries;
  for (const tx of transactions) {
    if (!tx || typeof tx !== "object") continue;
    if (tx.status === "voided" || tx.status === "cancelled") continue;
    const date = tx.date || new Date().toISOString();
    const refNum = tx.trackingCode || (tx.id ? String(tx.id).slice(-6) : "");
    const fromCur = tx.fromCurrency as Currency, toCur = tx.toCurrency as Currency;
    const commCur = tx.commissionCurrency as Currency | undefined;
    const fromAmt = Number(tx.fromAmount || 0) || 0, toAmt = Number(tx.toAmount || 0) || 0, commAmt = Number(tx.commission || 0) || 0;
    if (tx.type === "exchange") {
      const cid = tx.customerId || customers.find(c => c.name === (tx.customerName || tx.customerId))?.id;
      if (cid && cid !== CASH_BOX_ID) {
        entries.push({ id: `${tx.id}-out`, date, customerId: cid, type: "exchange", description: `فروش ${labels[fromCur]}`, currency: fromCur, amount: fromAmt, direction: "out", balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum });
        entries.push({ id: `${tx.id}-in`, date, customerId: cid, type: "exchange", description: `خرید ${labels[toCur]}`, currency: toCur, amount: toAmt, direction: "in", balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum });
        if (commAmt > 0 && commCur) entries.push({ id: `${tx.id}-fee`, date, customerId: cid, type: "fee", description: "کارمزد معامله", currency: commCur, amount: commAmt, direction: "out", balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum });
      }
    }
    if (tx.type === "transfer") {
      const sId = tx.senderId || customers.find(c => c.name === (tx.senderName || tx.senderId))?.id;
      const rId = tx.receiverId || customers.find(c => c.name === (tx.receiverName || tx.receiverId))?.id;
      if (sId && sId !== CASH_BOX_ID) {
        entries.push({ id: `${tx.id}-s-out`, date, customerId: sId, type: "transfer", description: `انتقال به ${customers.find(c => c.id === rId)?.name || tx.receiverName || "—"}`, currency: fromCur, amount: fromAmt, direction: "out", balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum });
      }
      if (rId && rId !== CASH_BOX_ID) {
        entries.push({ id: `${tx.id}-r-in`, date, customerId: rId, type: "transfer", description: `دریافت از ${customers.find(c => c.id === sId)?.name || tx.senderName || "—"}`, currency: toCur, amount: toAmt, direction: "in", balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum });
      }
    }
    if (tx.type === "convert") {
      const cid = tx.customerId || customers.find(c => c.name === (tx.customerName || tx.customerId))?.id;
      if (cid && cid !== CASH_BOX_ID) {
        entries.push({ id: `${tx.id}-c-out`, date, customerId: cid, type: "convert", description: `تبدیل از ${labels[fromCur]}`, currency: fromCur, amount: fromAmt, direction: "out", balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum });
        entries.push({ id: `${tx.id}-c-in`, date, customerId: cid, type: "convert", description: `تبدیل به ${labels[toCur]}`, currency: toCur, amount: toAmt, direction: "in", balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum });
        if (commAmt > 0 && commCur) entries.push({ id: `${tx.id}-c-fee`, date, customerId: cid, type: "fee", description: "کارمزد تبدیل", currency: commCur, amount: commAmt, direction: "out", balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum });
      }
    }
  }
  entries.sort((a, b) => { try { return new Date(b.date).getTime() - new Date(a.date).getTime(); } catch { return 0; } });
  return entries;
}

function buildDailyJournal(ledger: LedgerEntry[], cashEntries: any[], customers: Customer[]) {
  const days: Record<string, { transactions: LedgerEntry[]; cashEntries: any[]; date: Date }> = {};
  
  for (const entry of ledger) {
    const key = shortDateLabel(entry.date);
    if (!days[key]) days[key] = { transactions: [], cashEntries: [], date: new Date(entry.date) };
    days[key].transactions.push(entry);
  }
  
  for (const ce of cashEntries) {
    if (ce.status === "voided") continue;
    const key = shortDateLabel(ce.date);
    if (!days[key]) days[key] = { transactions: [], cashEntries: [], date: new Date(ce.date) };
    days[key].cashEntries.push(ce);
  }
  
  return Object.entries(days).sort(([, a], [, b]) => b.date.getTime() - a.date.getTime());
}

export default function ReportsPage() {
  const [mounted, setMounted] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [hawalas, setHawalas] = useState<any[]>([]);
  const [cashEntries, setCashEntries] = useState<any[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [activeSection, setActiveSection] = useState<"search" | "debtors" | "journal">("search");
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState("");

  useEffect(() => { try { const s = window.localStorage.getItem("fx-theme"); if (s === "dark" || s === "light") setTheme(s); } catch {} }, []);
  useEffect(() => { try { window.localStorage.setItem("fx-theme", theme); } catch {} }, [theme]);
  const dk = theme === "dark";

  useEffect(() => { try { setCustomers(loadCustomersShared() as Customer[]); setTransactions(loadTransactionsShared()); setHawalas(loadHawalasShared()); setCashEntries(loadCashEntriesShared()); initTrackingSystem(); } catch (err) { console.error(err); } setMounted(true); }, []);
  useEffect(() => { const handleStorage = (e: StorageEvent) => { try { if (e.key === CUSTOMERS_KEY && e.newValue) { const p = JSON.parse(e.newValue); if (Array.isArray(p)) setCustomers(p); } if (e.key === TRANSACTIONS_KEY && e.newValue) { const p = JSON.parse(e.newValue); if (Array.isArray(p)) setTransactions(p); } if (e.key === HAWALAS_KEY && e.newValue) { const p = JSON.parse(e.newValue); if (Array.isArray(p)) setHawalas(p); } if (e.key === CASH_KEY && e.newValue) { const p = JSON.parse(e.newValue); if (Array.isArray(p)) setCashEntries(p); } } catch {} }; window.addEventListener("storage", handleStorage); return () => window.removeEventListener("storage", handleStorage); }, []);
  useEffect(() => { const handleFocus = () => { try { setCustomers(loadCustomersShared() as Customer[]); setTransactions(loadTransactionsShared()); setHawalas(loadHawalasShared()); setCashEntries(loadCashEntriesShared()); } catch {} }; window.addEventListener("focus", handleFocus); return () => window.removeEventListener("focus", handleFocus); }, []);

  const ledger = useMemo(() => { try { return buildLedger(customers, transactions, hawalas, cashEntries); } catch { return []; } }, [customers, transactions, hawalas, cashEntries]);
  const dailyJournal = useMemo(() => buildDailyJournal(ledger, cashEntries, customers), [ledger, cashEntries, customers]);

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
    report += `📋 تاریخچه معاملات (${txs.length} معامله):\n\n`;
    txs.slice(0, 20).forEach((tx, i) => {
      report += `${i + 1}. ${txLabels[tx.type]}\n`;
      report += `   📅 ${shortDateLabel(tx.date)}\n`;
      report += `   💱 ${fmt(tx.amount)} ${labels[tx.currency]} (${tx.direction === "in" ? "دریافت" : "پرداخت"})\n`;
      report += `\n`;
    });
    if (txs.length > 20) report += `... و ${txs.length - 20} معامله دیگر\n`;
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

  if (!mounted) return (<div className="min-h-screen flex items-center justify-center"><div className="text-center"><div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-emerald-500" /><p className="mt-4 text-slate-500">در حال بارگذاری...</p></div></div>);

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
      <style>{`@import url("https://fonts.googleapis.com/css2?family=Lalezar&family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap");.cu-font{font-family:"Vazirmatn","Segoe UI",Tahoma,sans-serif}.cu-display{font-family:"Lalezar","Vazirmatn",Tahoma,sans-serif}.dark{color-scheme:dark}@keyframes cuUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}.cu-up{animation:cuUp .5s cubic-bezier(.22,.8,.35,1) both}.cu-scroll::-webkit-scrollbar{height:6px;width:6px}.cu-scroll::-webkit-scrollbar-thumb{background:rgba(16,185,129,.3);border-radius:3px}.cu-scroll{scrollbar-width:thin}`}</style>
      <div className={`cu-font relative min-h-screen overflow-x-hidden antialiased transition-colors duration-500 ${dk ? "bg-[#0f172a] text-slate-100" : "bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 text-slate-800"}`}>
        <div className={`fixed inset-x-0 top-0 z-30 h-1 bg-gradient-to-l ${dk ? "from-emerald-400 via-teal-400 to-cyan-400" : "from-emerald-500 via-teal-500 to-cyan-500"}`} />
        <div className="relative z-10 mx-auto w-full max-w-7xl space-y-4 md:space-y-6 px-3 pb-16 pt-5 md:px-8 md:pt-9">
          <header className="cu-up flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0">
              <div className="relative grid h-11 w-11 md:h-14 md:w-14 shrink-0 place-items-center rounded-xl md:rounded-2xl bg-gradient-to-br from-blue-500 via-sky-500 to-cyan-400 text-white shadow-lg shadow-blue-500/30 ring-1 ring-white/30">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 md:h-6 md:w-6" aria-hidden="true"><path d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" /></svg>
                <span className={`absolute -bottom-1 -left-1 grid h-4 min-w-4 md:h-5 md:min-w-5 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-400 px-1 text-[7px] md:text-[8px] font-black text-white ring-2 ${dk ? "ring-[#0f172a]" : "ring-[#ecfdf5]"}`}>RP</span>
              </div>
              <div className="min-w-0"><h1 className={`cu-display text-2xl md:text-4xl leading-none ${heading}`}>گزارشات</h1><p className={`mt-1 text-[10px] md:text-xs font-bold ${subText}`}>جستجو، بدهکاران و روزنامچه عمومی</p></div>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2.5">
              <button onClick={() => setTheme(dk ? "light" : "dark")} className={`group grid h-10 w-10 md:h-11 md:w-11 cursor-pointer place-items-center rounded-lg md:rounded-xl border shadow-sm backdrop-blur transition-all duration-300 active:scale-90 ${dk ? "border-slate-600 bg-slate-800/85 text-amber-300 hover:border-amber-300" : "border-slate-200 bg-white/85 text-slate-600 hover:border-emerald-400"}`}>{dk ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 group-hover:rotate-45 transition-transform duration-500" aria-hidden="true"><path d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.375 3.375 0 1 1-7.5 0 3.375 3.375 0 0 1 7.5 0Z" /></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 group-hover:-rotate-12 transition-transform duration-500" aria-hidden="true"><path d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" /></svg>}</button>
            </div>
          </header>

          <div className="cu-up grid grid-cols-2 md:grid-cols-4 gap-3" style={{ animationDelay: "70ms" }}>
            {[
              { label: "کل مشتریان", value: customers.length, icon: "users", color: "from-emerald-500 to-teal-500", text: dk ? "text-emerald-300" : "text-emerald-600" },
              { label: "مشتریان بدهکار", value: debtorCustomers.length, icon: "alert", color: "from-rose-500 to-pink-500", text: dk ? "text-rose-300" : "text-rose-600" },
              { label: "رویدادهای مالی", value: ledger.length, icon: "history", color: "from-amber-500 to-orange-500", text: dk ? "text-amber-300" : "text-amber-600" },
              { label: "روزهای ثبت‌شده", value: dailyJournal.length, icon: "calendar", color: "from-sky-500 to-cyan-500", text: dk ? "text-sky-300" : "text-sky-600" }
            ].map((s, i) => (
              <div key={i} className={`group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${glassCard}`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${s.color} opacity-0 transition-opacity group-hover:opacity-10`} />
                <div className="relative flex items-center justify-between">
                  <div><div className={`text-[10px] font-black ${subText}`}>{s.label}</div><div className={`text-2xl md:text-3xl font-black tabular-nums mt-1 ${s.text}`}>{s.value}</div></div>
                  <div className={`grid h-10 w-10 md:h-12 md:w-12 place-items-center rounded-xl bg-gradient-to-br ${s.color} text-white shadow-lg`}>
                    {s.icon === "users" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 md:h-6 md:w-6" aria-hidden="true"><path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>}
                    {s.icon === "alert" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 md:h-6 md:w-6" aria-hidden="true"><path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>}
                    {s.icon === "history" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 md:h-6 md:w-6" aria-hidden="true"><path d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>}
                    {s.icon === "calendar" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 md:h-6 md:w-6" aria-hidden="true"><path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className={`cu-up flex gap-1.5 md:gap-2 rounded-xl md:rounded-2xl border p-1.5 md:p-2 shadow-sm backdrop-blur ${glassChip}`} style={{ animationDelay: "140ms" }}>
            {[
              { id: "search" as const, label: "جستجوی مشتری", icon: "search" },
              { id: "debtors" as const, label: "مشتریان بدهکار", icon: "alert", count: debtorCustomers.length },
              { id: "journal" as const, label: "روزنامچه عمومی", icon: "calendar", count: dailyJournal.length }
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveSection(tab.id)} className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 md:gap-2 rounded-lg md:rounded-xl px-3 md:px-5 py-2.5 md:py-3 text-xs md:text-sm font-black transition-all duration-300 active:scale-[0.97] ${activeSection === tab.id ? `bg-gradient-to-l shadow-lg ${dk ? "from-blue-400 to-sky-400 text-slate-950" : "from-blue-500 to-sky-500 text-white"}` : dk ? "text-slate-400 hover:bg-slate-700/60 hover:text-slate-100" : "text-slate-500 hover:bg-blue-50 hover:text-slate-800"}`}>
                {tab.icon === "search" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><path d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 1 10.607 10.607Z" /></svg>}
                {tab.icon === "alert" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>}
                {tab.icon === "calendar" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>}
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${activeSection === tab.id ? dk ? "bg-slate-950/20 text-slate-950" : "bg-white/30 text-white" : dk ? "bg-slate-700 text-slate-300" : "bg-blue-100 text-blue-700"}`}>{fa(tab.count)}</span>}
              </button>
            ))}
          </div>

          {activeSection === "search" && (
            <section className={`cu-up space-y-4 ${uiCard}`} style={{ animationDelay: "160ms" }}>
              <div className="flex flex-wrap items-center gap-3 p-4 md:p-5 pb-3 md:pb-4 md:px-7 md:pt-6">
                <span className={`grid h-10 w-10 md:h-11 md:w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${identIcon}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 1 10.607 10.607Z" /></svg></span>
                <div className="flex-1 min-w-0"><h2 className={`cu-display text-xl md:text-2xl leading-none ${heading}`}>جستجوی مشتری</h2><p className={`mt-1 text-[11px] font-bold ${subText}`}>بر اساس نام، تلفن یا شماره تذکره</p></div>
              </div>
              <div className="px-4 md:px-7 pb-4 space-y-3">
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="نام، تلفن یا شماره تذکره را وارد کنید..." className={uiInput} />
                {search && (
                  <div className="space-y-2 max-h-96 overflow-y-auto cu-scroll">
                    {searchResults.length === 0 ? (
                      <div className={`text-center py-8 ${subText}`}><span className="text-4xl mb-2 block">🔍</span><p>مشتری‌ای یافت نشد</p></div>
                    ) : (
                      searchResults.map(c => (
                        <div key={c.id} className={`p-4 rounded-xl border ${dk ? "border-slate-700 bg-slate-800/50 hover:bg-slate-800" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <b className={`block text-sm font-black ${dk ? "text-white" : "text-slate-900"}`}>{c.name}</b>
                              <div className={`flex flex-wrap gap-3 mt-1 text-[11px] ${subText}`}>
                                {c.phone && <span>📞 {c.phone}</span>}
                                {c.tazkira && <span>🆔 {c.tazkira}</span>}
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
                            <button onClick={() => setSelectedCustomer(c)} className={`shrink-0 px-4 py-2 rounded-lg text-xs font-black ${dk ? "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30" : "bg-blue-100 text-blue-700 hover:bg-blue-200"}`}>مشاهده و اشتراک</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {activeSection === "debtors" && (
            <section className={`cu-up space-y-4 ${uiCard}`} style={{ animationDelay: "160ms" }}>
              <div className="flex flex-wrap items-center gap-3 p-4 md:p-5 pb-3 md:pb-4 md:px-7 md:pt-6">
                <span className={`grid h-10 w-10 md:h-11 md:w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${dk ? "from-rose-400/20 to-pink-400/5 text-rose-300 ring-rose-400/25" : "from-rose-400/20 to-pink-400/10 text-rose-600 ring-rose-400/30"}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg></span>
                <div className="flex-1 min-w-0"><h2 className={`cu-display text-xl md:text-2xl leading-none ${heading}`}>مشتریان بدهکار</h2><p className={`mt-1 text-[11px] font-bold ${subText}`}>{fa(debtorCustomers.length)} مشتری دارای بدهی</p></div>
              </div>
              <div className="px-4 md:px-7 pb-4 space-y-3 max-h-[600px] overflow-y-auto cu-scroll">
                {debtorCustomers.length === 0 ? (
                  <div className={`text-center py-8 ${subText}`}><span className="text-4xl mb-2 block">✅</span><p>هیچ مشتری بدهکاری وجود ندارد</p></div>
                ) : (
                  debtorCustomers.map(c => {
                    const debts = currencies.filter(cur => (c.balances?.[cur] || 0) < 0);
                    return (
                      <div key={c.id} className={`p-4 rounded-xl border ${dk ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-white"}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <b className={`block text-sm font-black ${dk ? "text-white" : "text-slate-900"}`}>{c.name}</b>
                            <div className={`flex flex-wrap gap-3 mt-1 text-[11px] ${subText}`}>
                              {c.phone && <span>📞 {c.phone}</span>}
                              {c.tazkira && <span>🆔 {c.tazkira}</span>}
                            </div>
                            <div className="mt-3 space-y-1">
                              {debts.map(cur => (
                                <div key={cur} className="flex items-center justify-between text-xs">
                                  <span className={subText}>{labels[cur]}</span>
                                  <span className={`font-black tabular-nums text-rose-500`}>{fmt(Math.abs(c.balances?.[cur] || 0))}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <button onClick={() => setSelectedCustomer(c)} className={`shrink-0 px-4 py-2 rounded-lg text-xs font-black ${dk ? "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30" : "bg-rose-100 text-rose-700 hover:bg-rose-200"}`}>ارسال گزارش</button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          )}

          {activeSection === "journal" && (
            <section className={`cu-up space-y-4 ${uiCard}`} style={{ animationDelay: "160ms" }}>
              <div className="flex flex-wrap items-center gap-3 p-4 md:p-5 pb-3 md:pb-4 md:px-7 md:pt-6">
                <span className={`grid h-10 w-10 md:h-11 md:w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${dk ? "from-amber-400/20 to-orange-400/5 text-amber-300 ring-amber-400/25" : "from-amber-400/20 to-orange-400/10 text-amber-600 ring-amber-400/30"}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg></span>
                <div className="flex-1 min-w-0"><h2 className={`cu-display text-xl md:text-2xl leading-none ${heading}`}>روزنامچه عمومی</h2><p className={`mt-1 text-[11px] font-bold ${subText}`}>{fa(dailyJournal.length)} روز ثبت‌شده</p></div>
              </div>
              <div className="px-4 md:px-7 pb-4 space-y-2 max-h-[700px] overflow-y-auto cu-scroll">
                {dailyJournal.map(([day, data]) => {
                  const isExpanded = expandedDays.has(day);
                  const txCount = data.transactions.length;
                  const cashCount = data.cashEntries.length;
                  const totalCommission = data.transactions.reduce((sum, tx) => sum + (tx.type === "fee" ? tx.amount : 0), 0);
                  return (
                    <div key={day} className={`rounded-xl border overflow-hidden ${dk ? "border-slate-700" : "border-slate-200"}`}>
                      <button onClick={() => toggleDay(day)} className={`w-full flex items-center justify-between p-4 transition-colors ${dk ? "bg-slate-800/50 hover:bg-slate-800" : "bg-white hover:bg-slate-50"}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-xl">📆</span>
                          <div className="text-right">
                            <b className={`block text-sm font-black ${dk ? "text-white" : "text-slate-900"}`}>{day}</b>
                            <div className={`flex gap-3 mt-1 text-[10px] ${subText}`}>
                              <span>{fa(txCount)} معامله</span>
                              <span>{fa(cashCount)} سند صندوق</span>
                              {totalCommission > 0 && <span className={dk ? "text-amber-300" : "text-amber-600"}>💰 {fmt(totalCommission)}</span>}
                            </div>
                          </div>
                        </div>
                        <span className={`text-xl transition-transform ${isExpanded ? "rotate-180" : ""}`}>⌄</span>
                      </button>
                      {isExpanded && (
                        <div className={`p-4 space-y-3 border-t ${dk ? "border-slate-700 bg-slate-900/50" : "border-slate-200 bg-slate-50"}`}>
                          {data.transactions.length > 0 && (
                            <div>
                              <b className={`block text-xs font-black mb-2 ${dk ? "text-blue-300" : "text-blue-600"}`}>معاملات مشتریان:</b>
                              <div className="space-y-1 max-h-64 overflow-y-auto cu-scroll">
                                {data.transactions.map(tx => {
                                  const customer = customers.find(c => c.id === tx.customerId);
                                  return (
                                    <div key={tx.id} className={`flex items-center justify-between p-2 rounded-lg text-xs ${dk ? "bg-slate-800/50" : "bg-white"}`}>
                                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-black ${txColors[tx.type][dk ? "dark" : "light"]}`}>{txLabels[tx.type]}</span>
                                      <span className={subText}>{customer?.name || "—"}</span>
                                      <span className={`font-black tabular-nums ${tx.direction === "in" ? "text-emerald-500" : "text-rose-500"}`}>{fmt(tx.amount)} {labels[tx.currency]}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {data.cashEntries.length > 0 && (
                            <div>
                              <b className={`block text-xs font-black mb-2 ${dk ? "text-emerald-300" : "text-emerald-600"}`}>اسناد صندوق:</b>
                              <div className="space-y-1 max-h-64 overflow-y-auto cu-scroll">
                                {data.cashEntries.map(ce => (
                                  <div key={ce.id} className={`flex items-center justify-between p-2 rounded-lg text-xs ${dk ? "bg-slate-800/50" : "bg-white"}`}>
                                    <span>{ce.reason || ce.type}</span>
                                    <span className={`font-black tabular-nums ${ce.direction === "in" ? "text-emerald-500" : "text-rose-500"}`}>{ce.direction === "in" ? "+" : "-"} {fmt(ce.amount)} {labels[ce.currency]}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>

      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3" onClick={() => setSelectedCustomer(null)}>
          <div className={`w-full max-w-md rounded-xl border shadow-2xl ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-white"}`} onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between border-b px-4 py-3 ${dk ? "border-slate-700" : "border-slate-100"}`}>
              <b className={`text-sm ${dk ? "text-slate-100" : "text-slate-800"}`}>اشتراک‌گذاری گزارش</b>
              <button onClick={() => setSelectedCustomer(null)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <p className={`text-xs ${subText}`}>گزارش معاملات {selectedCustomer.name} را از طریق کدام پلتفرم ارسال کنید؟</p>
              <button onClick={() => { shareViaTelegram(selectedCustomer); setSelectedCustomer(null); }} className={`w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 ${dk ? "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30" : "bg-blue-100 text-blue-700 hover:bg-blue-200"}`}>
                <span className="text-xl">📱</span> تلگرام
              </button>
              <button onClick={() => { shareViaWhatsApp(selectedCustomer); setSelectedCustomer(null); }} className={`w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 ${dk ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"}`}>
                <span className="text-xl">💬</span> واتساپ
              </button>
              <button onClick={() => { shareViaImo(selectedCustomer); setSelectedCustomer(null); }} className={`w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 ${dk ? "bg-violet-500/20 text-violet-300 hover:bg-violet-500/30" : "bg-violet-100 text-violet-700 hover:bg-violet-200"}`}>
                <span className="text-xl">📨</span> ایمو (کپی در کلیپ‌بورد)
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`fixed bottom-6 left-6 z-[99] rounded-xl px-4 py-3 text-sm font-bold shadow-lg ${dk ? "bg-slate-800 text-slate-100 border border-slate-600" : "bg-slate-900 text-white"}`}>{toast}</div>}
    </div>
  );
}
