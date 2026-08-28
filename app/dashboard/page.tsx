"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { useSyncedState } from "./lib/useSyncedState"; // ✅ مسیر اصلاح شد (./lib)
import {
  CUSTOMERS_KEY,
  TRANSACTIONS_KEY,
  HAWALAS_KEY,
  CASH_KEY,
} from "./lib/defaultData"; // ✅ مسیر اصلاح شد (./lib)

// ============================================================
// تایپ‌ها و ثابت‌ها
// ============================================================
type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";

const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const labels: Record<Currency, string> = {
  AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار",
};

const CASH_BOX_ID = "CASH_BOX";
const EXCHANGE_ACCOUNT_ID = "EXCHANGE_ACCOUNT";

interface CashEntry {
  id: string;
  trackingCode: string;
  date: string;
  type: string;
  currency: Currency;
  amount: number;
  direction: "in" | "out";
  status: "active" | "voided";
  customerId?: string;
}

interface Customer {
  id: string;
  name: string;
  balances: Record<Currency, number>;
}

interface Transaction {
  id: string;
  date: string;
  type: "exchange" | "transfer" | "convert";
  currency?: Currency;
  amount?: number;
  afnValue?: number;
  commission?: number;
  commissionCurrency?: Currency;
  status: "active" | "voided";
}

interface Hawala {
  id: string;
  date: string;
  amountFrom: number;
  currencyFrom: Currency;
  fee?: number;
  feeCurrency?: Currency;
  status: "pending" | "sent" | "paid" | "cancelled";
}

// ============================================================
// توابع کمکی
// ============================================================
function normalizeDigits(value: string) {
  const pd = "۰۱۲۳۴۵۶۷۸۹", ad = "٠١٢٣٤٥٦٧٨٩";
  return String(value || "")
    .replace(/[۰-۹]/g, d => String(pd.indexOf(d)))
    .replace(/[٠-٩]/g, d => String(ad.indexOf(d)));
}

function fmt(n: number) {
  return (Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0");
}

function fa(n: number) {
  return (Number.isFinite(n) ? n.toLocaleString("fa-IR", { maximumFractionDigits: 0 }) : "۰");
}

function shamsiParts(d: Date) {
  try {
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
      year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(d);
    const get = (type: string) => parts.find(p => p.type === type)?.value || "0";
    return { year: get("year"), month: get("month"), day: get("day") };
  } catch {
    return { year: "0", month: "0", day: "0" };
  }
}

function formatShamsiDate(d: Date) {
  const s = shamsiParts(d);
  return `${s.year}/${s.month}/${s.day}`;
}

function isToday(dateStr: string | number | undefined | null): boolean {
  if (!dateStr) return false;
  try {
    const str = String(dateStr);
    const now = new Date();
    const todayISO = now.toISOString().split("T")[0];
    if (str.startsWith(todayISO)) return true;
    const todayFa = formatShamsiDate(now);
    if (str.includes(todayFa)) return true;
    const num = Number(dateStr);
    if (!isNaN(num) && num > 1000000000000) {
      const d = new Date(num);
      return d.toDateString() === now.toDateString();
    }
  } catch {}
  return false;
}

function getLedgerBalance(customerId: string, currency: Currency, entries: CashEntry[]): number {
  let balance = 0;
  for (const entry of entries) {
    if (entry.status === "voided" || entry.currency !== currency) continue;
    
    if (customerId === CASH_BOX_ID) {
      balance += entry.direction === "in" ? entry.amount : -entry.amount;
    } 
    else if (customerId === EXCHANGE_ACCOUNT_ID) {
      if (entry.type === "owner_deposit" || entry.type === "loan_received") balance += entry.amount;
      else if (entry.type === "owner_withdraw" || entry.type === "loan_given") balance -= entry.amount;
    } 
    else {
      if (entry.customerId === customerId) {
        if (entry.type === "customer_deposit") balance += entry.amount;
        else if (entry.type === "customer_withdraw") balance -= entry.amount;
      }
    }
  }
  return balance;
}

// ============================================================
// کامپوننت اصلی
// ============================================================
export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  
  // ✅ استفاده از useSyncedState برای هماهنگی کامل بین تمام تب‌ها
  const [customers, setCustomers] = useSyncedState<Customer[]>(CUSTOMERS_KEY, []);
  const [entries, setEntries] = useSyncedState<CashEntry[]>(CASH_KEY, []);
  const [transactions, setTransactions] = useSyncedState<Transaction[]>(TRANSACTIONS_KEY, []);
  const [hawalas, setHawalas] = useSyncedState<Hawala[]>(HAWALAS_KEY, []);
  
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("fx-theme");
      if (saved === "dark" || saved === "light") setTheme(saved);
    } catch {}
    setMounted(true);
  }, []);

  // ── محاسبات مبتنی بر Ledger (منبع واحد حقیقت) ──
  
  // ۱. موجودی فیزیکی صندوق
  const physicalCashBalances = useMemo(() => {
    const balances: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    for (const cur of currencies) {
      balances[cur] = getLedgerBalance(CASH_BOX_ID, cur, entries);
    }
    return balances;
  }, [entries]);

  // ۲. موجودی حساب صرافی (واریز/برداشت مالک + قرض)
  const exchangeBalance = useMemo(() => {
    const balances: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    for (const cur of currencies) {
      balances[cur] = getLedgerBalance(EXCHANGE_ACCOUNT_ID, cur, entries);
    }
    return balances;
  }, [entries]);

  // ۳. مجموع طلب مشتریان (فقط مقادیر مثبت)
  const customerDeposits = useMemo(() => {
    const totals: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    for (const c of customers) {
      if (c.id === CASH_BOX_ID || c.id === EXCHANGE_ACCOUNT_ID) continue;
      for (const cur of currencies) {
        const bal = getLedgerBalance(c.id, cur, entries);
        if (bal > 0) totals[cur] += bal;
      }
    }
    return totals;
  }, [customers, entries]);

  // ۴. مجموع بدهی مشتریان (فقط مقادیر منفی)
  const customerDebts = useMemo(() => {
    const totals: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    for (const c of customers) {
      if (c.id === CASH_BOX_ID || c.id === EXCHANGE_ACCOUNT_ID) continue;
      for (const cur of currencies) {
        const bal = getLedgerBalance(c.id, cur, entries);
        if (bal < 0) totals[cur] += Math.abs(bal);
      }
    }
    return totals;
  }, [customers, entries]);

  // ۵. کارمزدها
  const totalCommissionEarned = useMemo(() => {
    const totals: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    for (const tx of transactions) {
      if (tx.status === "voided") continue;
      if (tx.commission && tx.commission > 0 && tx.commissionCurrency) {
        totals[tx.commissionCurrency] += tx.commission;
      }
    }
    for (const h of hawalas) {
      if (h.status === "cancelled") continue;
      if (h.fee && h.fee > 0 && h.feeCurrency) {
        totals[h.feeCurrency] += h.fee;
      }
    }
    return totals;
  }, [transactions, hawalas]);

  const commissionWithdrawn = useMemo(() => {
    const totals: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    for (const e of entries) {
      if (e.type === "commission_withdraw" && e.status === "active" && e.direction === "out") {
        totals[e.currency] += e.amount;
      }
    }
    return totals;
  }, [entries]);

  const availableCommission = useMemo(() => {
    const totals: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    for (const cur of currencies) {
      totals[cur] = Math.max(0, (totalCommissionEarned[cur] || 0) - (commissionWithdrawn[cur] || 0));
    }
    return totals;
  }, [totalCommissionEarned, commissionWithdrawn]);

  // ۶. آمار روزانه
  const todayStats = useMemo(() => {
    let tradeCount = 0, hawalaCount = 0;
    let tradeAmountSum = 0, hawalaAmountSum = 0;
    let tradeCommissionSum = 0, hawalaFeeSum = 0;

    for (const tx of transactions) {
      if (tx.status === "voided") continue;
      if (isToday(tx.date)) {
        tradeCount++;
        tradeAmountSum += tx.amount || 0;
        if (tx.commission && tx.commission > 0) {
          tradeCommissionSum += tx.commission;
        }
      }
    }

    for (const h of hawalas) {
      if (h.status === "cancelled") continue;
      if (isToday(h.date)) {
        hawalaCount++;
        hawalaAmountSum += h.amountFrom || 0;
        if (h.fee && h.fee > 0) {
          hawalaFeeSum += h.fee;
        }
      }
    }

    return { tradeCount, hawalaCount, tradeAmountSum, hawalaAmountSum, tradeCommissionSum, hawalaFeeSum };
  }, [transactions, hawalas]);

  // ۷. تعداد مشتریان بدهکار (بر اساس Ledger)
  const debtorsCount = useMemo(() => {
    return customers.filter(c => {
      if (c.id === CASH_BOX_ID || c.id === EXCHANGE_ACCOUNT_ID) return false;
      return currencies.some(cur => getLedgerBalance(c.id, cur, entries) < 0);
    }).length;
  }, [customers, entries]);

  // ── استایل‌ها ──
  const dk = theme === "dark";
  const heading = dk ? "text-white" : "text-slate-900";
  const subText = dk ? "text-slate-500" : "text-slate-400";
  const uiCard = dk
    ? "border-slate-700 bg-slate-800/90 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.6)]"
    : "border-emerald-100 bg-white/95 shadow-[0_16px_40px_-28px_rgba(16,185,129,0.35)]";

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-emerald-500" />
          <p className="mt-4 text-slate-500">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className={dk ? "dark" : ""}>
      <style>{`@import url("https://fonts.googleapis.com/css2?family=Lalezar&family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap");.cs-font{font-family:"Vazirmatn","Segoe UI",Tahoma,sans-serif}.cs-display{font-family:"Lalezar","Vazirmatn",Tahoma,sans-serif;letter-spacing:.01em}.dark{color-scheme:dark}@keyframes csUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}.cs-up{animation:csUp .5s cubic-bezier(.22,.8,.35,1) both}::selection{background:rgba(16,185,129,.25)}`}</style>

      <div className={`cs-font relative min-h-screen overflow-x-hidden antialiased transition-colors duration-500 ${dk ? "bg-[#0f172a] text-slate-100" : "bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 text-slate-800"}`}>

        <div className={`fixed inset-x-0 top-0 z-30 h-1 bg-gradient-to-l ${dk ? "from-emerald-400 via-teal-400 to-cyan-400" : "from-emerald-500 via-teal-500 to-cyan-500"}`} />

        <div className="relative z-10 mx-auto w-full max-w-7xl space-y-4 md:space-y-6 px-3 pb-16 pt-5 md:px-8 md:pt-9">

          {/* ═══════════ هدر ═══════════ */}
          <header className="cs-up flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0">
              <div className="relative grid h-11 w-11 md:h-14 md:w-14 shrink-0 place-items-center rounded-xl md:rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-400 text-white shadow-lg shadow-emerald-500/30 ring-1 ring-white/30">
                <span className="text-2xl md:text-3xl">📊</span>
                <span className={`absolute -bottom-1 -left-1 md:-bottom-1.5 md:-left-1.5 grid h-4 min-w-4 md:h-5 md:min-w-5 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-400 px-1 text-[7px] md:text-[8px] font-black text-white ring-2 ${dk ? "ring-[#0f172a]" : "ring-[#ecfdf5]"}`}>
                  DB
                </span>
              </div>
              <div className="min-w-0">
                <h1 className={`cs-display text-2xl md:text-4xl leading-none ${heading}`}>
                  داشبورد حساب‌ها
                </h1>
                <p className={`mt-1 text-[10px] md:text-xs font-bold ${subText}`}>
                  صرافی برادران نورزاد — هرات
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 md:gap-2.5">
              <div className={`hidden sm:flex items-center gap-2 rounded-xl border px-3 py-2 shadow-sm backdrop-blur ${dk ? "border-slate-600/70 bg-slate-800/80" : "border-emerald-100 bg-white/85"}`}>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                <span dir="ltr" className={`text-xs font-bold tabular-nums ${dk ? "text-slate-100" : "text-slate-700"}`}>
                  {lastUpdated ? formatShamsiDate(lastUpdated) : "--"}
                </span>
              </div>
              <button
                onClick={() => setTheme(dk ? "light" : "dark")}
                className={`group grid h-10 w-10 md:h-11 md:w-11 cursor-pointer place-items-center rounded-lg md:rounded-xl border shadow-sm backdrop-blur transition-all duration-300 active:scale-90 ${dk ? "border-slate-600 bg-slate-800/85 text-amber-300 hover:border-amber-300" : "border-slate-200 bg-white/85 text-slate-600 hover:border-emerald-400"}`}
              >
                <span className="text-lg transition-transform duration-500 group-hover:rotate-12">
                  {dk ? "☀️" : "🌙"}
                </span>
              </button>
            </div>
          </header>

          {/* ═══════════ آمار امروز ═══════════ */}
          <section className="cs-up space-y-4 md:space-y-5" style={{ animationDelay: "70ms" }}>
            <div className="flex items-center gap-3 mb-1">
              <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl shadow-md ${dk ? "bg-gradient-to-br from-blue-500 to-sky-500 text-white" : "bg-gradient-to-br from-blue-500 to-cyan-500 text-white"}`}>
                <span className="text-xl">🗓️</span>
              </div>
              <div>
                <h2 className={`cs-display text-xl md:text-2xl leading-none ${heading}`}>آمار امروز</h2>
                <p className={`mt-1 text-[10px] md:text-xs font-bold ${subText}`}>خلاصه فعالیت‌های روزانه (فقط امروز)</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {/* 💱 مجموع مبلغ تبادل ارز */}
              <div className={`group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] ${dk ? "border-blue-400/25 bg-gradient-to-br from-blue-900/30 to-slate-900/50" : "border-blue-200 bg-gradient-to-br from-blue-50 to-white"}`}>
                <div className="relative flex items-center gap-2.5 mb-2">
                  <span className={`grid h-10 w-10 place-items-center rounded-xl shadow-sm ${dk ? "bg-blue-400/15 text-blue-300" : "bg-blue-100 text-blue-600"}`}>
                    <span className="text-xl">💱</span>
                  </span>
                  <span className={`text-[11px] md:text-[12px] font-black ${dk ? "text-blue-300" : "text-blue-700"}`}>مجموع تبادل ارز</span>
                </div>
                <p className={`relative text-2xl md:text-3xl font-black tabular-nums leading-none ${dk ? "text-blue-300" : "text-blue-700"}`}>{fmt(todayStats.tradeAmountSum)}</p>
                <div className={`mt-1.5 text-[9px] font-bold ${dk ? "text-blue-400/70" : "text-blue-600/70"}`}>{fa(todayStats.tradeCount)} معامله</div>
              </div>

              {/* 💸 مجموع مبلغ حواله‌ها */}
              <div className={`group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] ${dk ? "border-purple-400/25 bg-gradient-to-br from-purple-900/30 to-slate-900/50" : "border-purple-200 bg-gradient-to-br from-purple-50 to-white"}`}>
                <div className="relative flex items-center gap-2.5 mb-2">
                  <span className={`grid h-10 w-10 place-items-center rounded-xl shadow-sm ${dk ? "bg-purple-400/15 text-purple-300" : "bg-purple-100 text-purple-600"}`}>
                    <span className="text-xl">💸</span>
                  </span>
                  <span className={`text-[11px] md:text-[12px] font-black ${dk ? "text-purple-300" : "text-purple-700"}`}>مجموع حواله‌ها</span>
                </div>
                <p className={`relative text-2xl md:text-3xl font-black tabular-nums leading-none ${dk ? "text-purple-300" : "text-purple-700"}`}>{fmt(todayStats.hawalaAmountSum)}</p>
                <div className={`mt-1.5 text-[9px] font-bold ${dk ? "text-purple-400/70" : "text-purple-600/70"}`}>{fa(todayStats.hawalaCount)} حواله</div>
              </div>

              {/* 💰 کارمزد تبادل ارز */}
              <div className={`group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] ${dk ? "border-amber-400/25 bg-gradient-to-br from-amber-900/30 to-slate-900/50" : "border-amber-200 bg-gradient-to-br from-amber-50 to-white"}`}>
                <div className="relative flex items-center gap-2.5 mb-2">
                  <span className={`grid h-10 w-10 place-items-center rounded-xl shadow-sm ${dk ? "bg-amber-400/15 text-amber-300" : "bg-amber-100 text-amber-600"}`}>
                    <span className="text-xl">💰</span>
                  </span>
                  <span className={`text-[11px] md:text-[12px] font-black ${dk ? "text-amber-300" : "text-amber-700"}`}>کارمزد تبادل ارز</span>
                </div>
                <div className="relative flex items-center justify-between gap-2">
                  <div className="text-center flex-1">
                    <div className={`text-xl md:text-2xl font-black tabular-nums leading-none ${dk ? "text-amber-300" : "text-amber-700"}`}>{fa(todayStats.tradeCount)}</div>
                    <div className={`mt-1 text-[9px] font-bold ${dk ? "text-amber-400/70" : "text-amber-600/70"}`}>تعداد</div>
                  </div>
                  <div className={`w-px h-10 ${dk ? "bg-amber-400/20" : "bg-amber-200"}`} />
                  <div className="text-center flex-1">
                    <div className={`text-xl md:text-2xl font-black tabular-nums leading-none ${dk ? "text-amber-300" : "text-amber-700"}`}>{fmt(todayStats.tradeCommissionSum)}</div>
                    <div className={`mt-1 text-[9px] font-bold ${dk ? "text-amber-400/70" : "text-amber-600/70"}`}>کارمزد</div>
                  </div>
                </div>
              </div>

              {/* 🎯 کارمزد حواله‌جات */}
              <div className={`group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] ${dk ? "border-rose-400/25 bg-gradient-to-br from-rose-900/30 to-slate-900/50" : "border-rose-200 bg-gradient-to-br from-rose-50 to-white"}`}>
                <div className="relative flex items-center gap-2.5 mb-2">
                  <span className={`grid h-10 w-10 place-items-center rounded-xl shadow-sm ${dk ? "bg-rose-400/15 text-rose-300" : "bg-rose-100 text-rose-600"}`}>
                    <span className="text-xl">🎯</span>
                  </span>
                  <span className={`text-[11px] md:text-[12px] font-black ${dk ? "text-rose-300" : "text-rose-700"}`}>کارمزد حواله‌جات</span>
                </div>
                <div className="relative flex items-center justify-between gap-2">
                  <div className="text-center flex-1">
                    <div className={`text-xl md:text-2xl font-black tabular-nums leading-none ${dk ? "text-rose-300" : "text-rose-700"}`}>{fa(todayStats.hawalaCount)}</div>
                    <div className={`mt-1 text-[9px] font-bold ${dk ? "text-rose-400/70" : "text-rose-600/70"}`}>تعداد</div>
                  </div>
                  <div className={`w-px h-10 ${dk ? "bg-rose-400/20" : "bg-rose-200"}`} />
                  <div className="text-center flex-1">
                    <div className={`text-xl md:text-2xl font-black tabular-nums leading-none ${dk ? "text-rose-300" : "text-rose-700"}`}>{fmt(todayStats.hawalaFeeSum)}</div>
                    <div className={`mt-1 text-[9px] font-bold ${dk ? "text-rose-400/70" : "text-rose-600/70"}`}>کارمزد</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════ موجودی فیزیکی صندوق ═══════════ */}
          <section className="cs-up space-y-4 md:space-y-5" style={{ animationDelay: "140ms" }}>
            <div className={`relative overflow-hidden rounded-2xl md:rounded-3xl border-2 p-5 md:p-7 transition-all duration-300 hover:shadow-2xl ${dk ? "border-emerald-400/40 bg-gradient-to-br from-emerald-900/40 via-slate-900/60 to-teal-900/40 shadow-[0_20px_60px_-15px_rgba(16,185,129,0.3)]" : "border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-teal-50 shadow-[0_20px_60px_-15px_rgba(16,185,129,0.25)]"}`}>
              <div className={`absolute -top-24 -left-24 h-48 w-48 rounded-full blur-3xl opacity-20 ${dk ? "bg-emerald-400" : "bg-emerald-300"}`} />
              <div className={`absolute -bottom-24 -right-24 h-48 w-48 rounded-full blur-3xl opacity-20 ${dk ? "bg-teal-400" : "bg-teal-300"}`} />
              
              <div className="relative flex items-center gap-4 mb-5 md:mb-6">
                <div className={`relative grid h-14 w-14 md:h-16 md:w-16 shrink-0 place-items-center rounded-2xl shadow-lg ${dk ? "bg-gradient-to-br from-emerald-400 to-teal-400 text-slate-950" : "bg-gradient-to-br from-emerald-500 to-teal-500 text-white"}`}>
                  <span className="text-3xl md:text-4xl">🏦</span>
                  <span className="absolute -top-1 -right-1 flex h-4 w-4"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-500 ring-2 ring-white" /></span>
                </div>
                <div className="flex-1 min-w-0">
                  <b className={`block text-base md:text-lg font-black ${dk ? "text-emerald-300" : "text-emerald-700"}`}>💰 موجودی فیزیکی صندوق</b>
                  <span className={`block text-[11px] md:text-xs font-bold mt-0.5 ${dk ? "text-slate-400" : "text-slate-500"}`}>محاسبه‌شده مستقیم از دفتر کل (Ledger)</span>
                </div>
              </div>
              
              <div className="relative grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
                {currencies.map(cur => {
                  const bal = physicalCashBalances[cur];
                  const isNeg = bal < 0;
                  return (
                    <div key={cur} className={`group relative overflow-hidden rounded-2xl p-4 text-center transition-all duration-300 hover:scale-[1.02] ${dk ? "bg-slate-950/60 ring-1 ring-slate-700/50" : "bg-white/90 ring-1 ring-emerald-100 shadow-sm"}`}>
                      <div className={`text-[12px] md:text-[13px] font-black mb-2 ${dk ? "text-slate-400" : "text-slate-500"}`}>{labels[cur]}</div>
                      <div className={`text-xl md:text-2xl font-black tabular-nums leading-tight ${isNeg ? "text-rose-500" : dk ? "text-emerald-300" : "text-emerald-700"}`}>{fmt(bal)}</div>
                      <div className={`mt-1.5 text-[9px] md:text-[10px] font-black ${isNeg ? "text-rose-500" : dk ? "text-emerald-400/70" : "text-emerald-600/70"}`}>{isNeg ? "⚠️ کسری" : "✅ نقدی"}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ═══════════ چهار کارت حساب‌ها ═══════════ */}
          <section className="cs-up grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4" style={{ animationDelay: "210ms" }}>

            {/* ۱. موجودی مشتریان */}
            <div className={`group relative overflow-hidden rounded-2xl border p-4 md:p-5 transition-all duration-300 hover:shadow-xl hover:scale-[1.01] ${dk ? "border-sky-400/25 bg-gradient-to-br from-sky-900/30 to-slate-900/50" : "border-sky-200 bg-gradient-to-br from-sky-50 to-white"}`}>
              <div className={`absolute top-0 right-0 h-24 w-24 rounded-full blur-2xl opacity-10 ${dk ? "bg-sky-400" : "bg-sky-300"}`} />
              <div className="relative flex items-center gap-3 mb-4">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${dk ? "bg-sky-400/15 text-sky-300" : "bg-sky-100 text-sky-600"}`}>
                  <span className="text-xl">💳</span>
                </span>
                <div className="min-w-0">
                  <b className={`block text-[13px] md:text-[14px] font-black leading-tight ${dk ? "text-sky-300" : "text-sky-700"}`}>💳 موجودی مشتریان</b>
                  <span className={`block text-[10px] md:text-[11px] font-bold mt-0.5 ${subText}`}>پول مشتری نزد صرافی</span>
                </div>
              </div>
              <div className="relative space-y-1.5">
                {currencies.map(cur => {
                  const bal = customerDeposits[cur];
                  return (
                    <div key={cur} className={`flex items-center justify-between rounded-xl px-3 py-2 transition-colors ${dk ? "bg-slate-900/50" : "bg-white/80"}`}>
                      <span className={`text-[12px] font-black ${dk ? "text-slate-400" : "text-slate-500"}`}>
                        {labels[cur]}
                      </span>
                      <span className={`text-[15px] md:text-base font-black tabular-nums ${bal > 0 ? (dk ? "text-sky-300" : "text-sky-700") : subText}`}>
                        {fmt(bal)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ۲. بدهی مشتریان */}
            <div className={`group relative overflow-hidden rounded-2xl border p-4 md:p-5 transition-all duration-300 hover:shadow-xl hover:scale-[1.01] ${dk ? "border-rose-400/25 bg-gradient-to-br from-rose-900/30 to-slate-900/50" : "border-rose-200 bg-gradient-to-br from-rose-50 to-white"}`}>
              <div className={`absolute top-0 right-0 h-24 w-24 rounded-full blur-2xl opacity-10 ${dk ? "bg-rose-400" : "bg-rose-300"}`} />
              <div className="relative flex items-center gap-3 mb-4">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${dk ? "bg-rose-400/15 text-rose-300" : "bg-rose-100 text-rose-600"}`}>
                  <span className="text-xl">📉</span>
                </span>
                <div className="min-w-0">
                  <b className={`block text-[13px] md:text-[14px] font-black leading-tight ${dk ? "text-rose-300" : "text-rose-700"}`}>🔻 بدهی مشتریان</b>
                  <span className={`block text-[10px] md:text-[11px] font-bold mt-0.5 ${subText}`}>صرافی قرض داده</span>
                </div>
              </div>
              <div className="relative space-y-1.5">
                {currencies.map(cur => {
                  const bal = customerDebts[cur];
                  return (
                    <div key={cur} className={`flex items-center justify-between rounded-xl px-3 py-2 transition-colors ${dk ? "bg-slate-900/50" : "bg-white/80"}`}>
                      <span className={`text-[12px] font-black ${dk ? "text-slate-400" : "text-slate-500"}`}>
                        {labels[cur]}
                      </span>
                      <span className={`text-[15px] md:text-base font-black tabular-nums ${bal > 0 ? "text-rose-500" : subText}`}>
                        {fmt(bal)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ۳. موجودی حساب صرافی */}
            <div className={`group relative overflow-hidden rounded-2xl border p-4 md:p-5 transition-all duration-300 hover:shadow-xl hover:scale-[1.01] ${dk ? "border-violet-400/25 bg-gradient-to-br from-violet-900/30 to-slate-900/50" : "border-violet-200 bg-gradient-to-br from-violet-50 to-white"}`}>
              <div className={`absolute top-0 right-0 h-24 w-24 rounded-full blur-2xl opacity-10 ${dk ? "bg-violet-400" : "bg-violet-300"}`} />
              <div className="relative flex items-center gap-3 mb-4">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${dk ? "bg-violet-400/15 text-violet-300" : "bg-violet-100 text-violet-600"}`}>
                  <span className="text-xl">💼</span>
                </span>
                <div className="min-w-0">
                  <b className={`block text-[13px] md:text-[14px] font-black leading-tight ${dk ? "text-violet-300" : "text-violet-700"}`}>💼 موجودی حساب صرافی</b>
                  <span className={`block text-[10px] md:text-[11px] font-bold mt-0.5 ${subText}`}>واریز/برداشت مالک + قرض</span>
                </div>
              </div>
              <div className="relative space-y-1.5">
                {currencies.map(cur => {
                  const bal = exchangeBalance[cur];
                  return (
                    <div key={cur} className={`flex items-center justify-between rounded-xl px-3 py-2 transition-colors ${dk ? "bg-slate-900/50" : "bg-white/80"}`}>
                      <span className={`text-[12px] font-black ${dk ? "text-slate-400" : "text-slate-500"}`}>
                        {labels[cur]}
                      </span>
                      <span className={`text-[15px] md:text-base font-black tabular-nums ${bal < 0 ? "text-rose-500" : dk ? "text-violet-300" : "text-violet-700"}`}>
                        {fmt(bal)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ۴. وضعیت مشتریان (دو قسمتی) */}
            <div className={`group relative overflow-hidden rounded-2xl border p-4 md:p-5 transition-all duration-300 hover:shadow-xl hover:scale-[1.01] ${dk ? "border-cyan-400/25 bg-gradient-to-br from-cyan-900/30 to-slate-900/50" : "border-cyan-200 bg-gradient-to-br from-cyan-50 to-white"}`}>
              <div className={`absolute top-0 right-0 h-24 w-24 rounded-full blur-2xl opacity-10 ${dk ? "bg-cyan-400" : "bg-cyan-300"}`} />
              <div className="relative flex items-center gap-3 mb-3">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${dk ? "bg-cyan-400/15 text-cyan-300" : "bg-cyan-100 text-cyan-600"}`}>
                  <span className="text-xl">👥</span>
                </span>
                <div className="min-w-0">
                  <b className={`block text-[13px] md:text-[14px] font-black leading-tight ${dk ? "text-cyan-300" : "text-cyan-700"}`}>👥 وضعیت مشتریان</b>
                  <span className={`block text-[10px] md:text-[11px] font-bold mt-0.5 ${subText}`}>کل و بدهکاران</span>
                </div>
              </div>
              
              <div className={`relative flex items-center justify-center py-3 mb-2 rounded-xl ${dk ? "bg-slate-900/50" : "bg-white/80"}`}>
                <div className="text-center">
                  <div className={`text-[10px] font-black mb-1 ${dk ? "text-cyan-300/70" : "text-cyan-600/70"}`}>کل مشتریان</div>
                  <div className={`text-3xl md:text-4xl font-black tabular-nums leading-none ${dk ? "text-cyan-300" : "text-cyan-700"}`}>{fa(customers.length)}</div>
                  <div className={`mt-1 text-[9px] font-black ${subText}`}>نفر</div>
                </div>
              </div>

              <div className={`h-px my-2 ${dk ? "bg-cyan-400/20" : "bg-cyan-200"}`} />

              <div className={`relative flex items-center justify-center py-3 rounded-xl ${dk ? "bg-rose-400/10" : "bg-rose-50"}`}>
                <div className="text-center">
                  <div className={`text-[10px] font-black mb-1 ${dk ? "text-rose-300/80" : "text-rose-600/80"}`}>مشتریان بدهکار</div>
                  <div className={`text-3xl md:text-4xl font-black tabular-nums leading-none ${debtorsCount > 0 ? "text-rose-500" : subText}`}>{fa(debtorsCount)}</div>
                  <div className={`mt-1 text-[9px] font-black ${debtorsCount > 0 ? (dk ? "text-rose-300/70" : "text-rose-600/70") : subText}`}>
                    {debtorsCount > 0 ? "⚠️ دارای بدهی" : "✅ بدون بدهی"}
                  </div>
                </div>
              </div>
            </div>

          </section>

          {/* ═══════════ فرمول حسابداری ═══════════ */}
          <div className={`cs-up rounded-2xl border-2 px-5 py-4 md:py-5 ${dk ? "border-slate-700/70 bg-gradient-to-r from-slate-800/60 to-slate-900/60" : "border-slate-200 bg-gradient-to-r from-white to-slate-50"}`} style={{ animationDelay: "280ms" }}>
            <div className={`flex flex-wrap items-center justify-center gap-3 md:gap-4 text-[12px] md:text-[13px] font-black ${dk ? "text-slate-300" : "text-slate-600"}`}>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${dk ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/30" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"}`}>
                💰 صندوق
              </span>
              <span className="text-slate-400">=</span>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${dk ? "bg-violet-400/10 text-violet-300 ring-1 ring-violet-400/30" : "bg-violet-50 text-violet-700 ring-1 ring-violet-200"}`}>
                💼 حساب صرافی
              </span>
              <span className="text-slate-400">+</span>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${dk ? "bg-sky-400/10 text-sky-300 ring-1 ring-sky-400/30" : "bg-sky-50 text-sky-700 ring-1 ring-sky-200"}`}>
                💳 موجودی مشتریان
              </span>
              <span className="text-rose-500 font-black">−</span>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${dk ? "bg-rose-400/10 text-rose-300 ring-1 ring-rose-400/30" : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"}`}>
                📉 بدهی مشتریان
              </span>
            </div>
          </div>

          {/* ═══════════ جدول وضعیت کلی سیستم ═══════════ */}
          <section className={`cs-up rounded-2xl md:rounded-3xl border-2 overflow-hidden ${uiCard}`} style={{ animationDelay: "350ms" }}>
            <div className="flex items-center gap-3 p-4 md:p-5 pb-3 md:pb-4 md:px-7 md:pt-6">
              <div className={`grid h-11 w-11 md:h-12 md:w-12 place-items-center rounded-xl shadow-md ${dk ? "bg-gradient-to-br from-cyan-400 to-sky-500 text-slate-950" : "bg-gradient-to-br from-cyan-500 to-sky-500 text-white"}`}>
                <span className="text-xl">📋</span>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className={`cs-display text-xl md:text-2xl leading-none ${heading}`}>
                  وضعیت کلی سیستم
                </h2>
                <p className={`mt-1 text-[11px] font-bold ${subText}`}>
                  خلاصه تمام بخش‌های حساب‌ها به تفکیک ارز
                </p>
              </div>
            </div>

            <div className="overflow-x-auto px-4 md:px-7 pb-4">
              <table className="w-full min-w-[800px] text-sm">
                <thead>
                  <tr className={`border-y ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
                    <th className="px-3 py-3 text-right text-[11px] font-black text-slate-400 whitespace-nowrap">ارز</th>
                    <th className="px-3 py-3 text-center text-[11px] font-black text-slate-400 whitespace-nowrap">💰 صندوق</th>
                    <th className="px-3 py-3 text-center text-[11px] font-black text-slate-400 whitespace-nowrap">💳 طلب مشتریان</th>
                    <th className="px-3 py-3 text-center text-[11px] font-black text-slate-400 whitespace-nowrap">📉 بدهی مشتریان</th>
                    <th className="px-3 py-3 text-center text-[11px] font-black text-slate-400 whitespace-nowrap">💼 حساب صرافی</th>
                    <th className="px-3 py-3 text-center text-[11px] font-black text-slate-400 whitespace-nowrap">💎 کارمزد</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${dk ? "divide-slate-700/60" : "divide-slate-100"}`}>
                  {currencies.map(cur => {
                    const cash = physicalCashBalances[cur];
                    const deps = customerDeposits[cur];
                    const debts = customerDebts[cur];
                    const equity = exchangeBalance[cur];
                    const comm = availableCommission[cur];

                    return (
                      <tr key={cur} className={`transition-colors ${dk ? "hover:bg-slate-700/30" : "hover:bg-emerald-50/70"}`}>
                        <td className="px-3 py-3 text-right">
                          <span className={`font-bold ${dk ? "text-slate-200" : "text-slate-700"}`}>
                            {labels[cur]}
                          </span>
                        </td>
                        <td className={`px-3 py-3 text-center text-[13px] font-black tabular-nums ${cash < 0 ? "text-rose-500" : dk ? "text-emerald-300" : "text-emerald-700"}`}>
                          {fmt(cash)}
                        </td>
                        <td className={`px-3 py-3 text-center text-[13px] font-black tabular-nums ${deps > 0 ? (dk ? "text-sky-300" : "text-sky-700") : subText}`}>
                          {fmt(deps)}
                        </td>
                        <td className={`px-3 py-3 text-center text-[13px] font-black tabular-nums ${debts > 0 ? "text-rose-500" : subText}`}>
                          {fmt(debts)}
                        </td>
                        <td className={`px-3 py-3 text-center text-[13px] font-black tabular-nums ${equity < 0 ? "text-rose-500" : dk ? "text-violet-300" : "text-violet-700"}`}>
                          {fmt(equity)}
                        </td>
                        <td className={`px-3 py-3 text-center text-[13px] font-black tabular-nums ${comm > 0 ? (dk ? "text-amber-300" : "text-amber-700") : subText}`}>
                          {fmt(comm)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* ═══════════ فوتر ═══════════ */}
          <div className={`cs-up text-center py-4 text-[11px] font-bold ${subText}`} style={{ animationDelay: "420ms" }}>
            🏦 صرافی برادران نورزاد — هرات | سیستم هماهنگ‌سازی هوشمند فعال است
          </div>
        </div>
      </div>
    </div>
  );
}
