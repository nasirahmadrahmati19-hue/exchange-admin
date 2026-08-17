"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import {
  CUSTOMERS_KEY,
  TRANSACTIONS_KEY,
  HAWALAS_KEY,
  CASH_KEY,
  loadCustomersShared,
  loadTransactionsShared,
  loadHawalasShared,
  loadCashEntriesShared,
} from "./lib/defaultData";

// ============================================================
// تایپ‌ها و ثابت‌ها (هماهنگ با تب Cash)
// ============================================================
type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";

const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const labels: Record<Currency, string> = {
  AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار",
};
const flags: Record<Currency, string> = {
  AFN: "🇦🇫", USD: "🇺🇸", EUR: "🇪🇺", IRR: "🇮🇷", PKR: "🇵🇰",
};

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

// تشخیص اینکه آیا تاریخ مربوط به امروز است (هم ISO و هم شمسی و هم timestamp)
function isToday(dateStr: string | number | undefined | null): boolean {
  if (!dateStr) return false;
  try {
    const str = String(dateStr);
    const now = new Date();

    // چک ISO date
    const todayISO = now.toISOString().split("T")[0];
    if (str.startsWith(todayISO)) return true;

    // چک شمسی
    const todayFa = formatShamsiDate(now);
    if (str.includes(todayFa)) return true;

    // چک timestamp
    const num = Number(dateStr);
    if (!isNaN(num) && num > 1000000000000) {
      const d = new Date(num);
      return d.toDateString() === now.toDateString();
    }
  } catch {}
  return false;
}

// ============================================================
// تایپ‌های داده (هماهنگ با tab Cash)
// ============================================================
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
  fee?: number;
  feeCurrency?: Currency;
  status: "pending" | "sent" | "paid" | "cancelled";
}

// ============================================================
// کامپوننت اصلی
// ============================================================
export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [hawalas, setHawalas] = useState<Hawala[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // ── بارگذاری اولیه ──
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("fx-theme");
      if (saved === "dark" || saved === "light") setTheme(saved);
    } catch {}

    try {
      setCustomers(loadCustomersShared() as Customer[]);
      setEntries(loadCashEntriesShared() as CashEntry[]);
      setTransactions(loadTransactionsShared() as Transaction[]);
      setHawalas(loadHawalasShared() as Hawala[]);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Load error:", err);
    }
    setMounted(true);
  }, []);

  // ── Sync با تب‌های دیگر ──
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      try {
        if (e.key === CASH_KEY && e.newValue) setEntries(JSON.parse(e.newValue));
        if (e.key === CUSTOMERS_KEY && e.newValue) setCustomers(JSON.parse(e.newValue));
        if (e.key === TRANSACTIONS_KEY && e.newValue) setTransactions(JSON.parse(e.newValue));
        if (e.key === HAWALAS_KEY && e.newValue) setHawalas(JSON.parse(e.newValue));
        setLastUpdated(new Date());
      } catch {}
    };

    const handleFocus = () => {
      try {
        setCustomers(loadCustomersShared() as Customer[]);
        setEntries(loadCashEntriesShared() as CashEntry[]);
        setTransactions(loadTransactionsShared() as Transaction[]);
        setHawalas(loadHawalasShared() as Hawala[]);
        setLastUpdated(new Date());
      } catch {}
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleFocus);
    const interval = setInterval(handleFocus, 15000);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
    };
  }, []);

  // ── محاسبات (دقیقاً هم‌راستا با tab Cash) ──

  // موجودی فیزیکی صندوق
  const physicalCashBalances = useMemo(() => {
    const balances: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    const sorted = [...entries].sort((a, b) => {
      try { return new Date(a.date).getTime() - new Date(b.date).getTime(); }
      catch { return 0; }
    });
    for (const e of sorted) {
      if (!currencies.includes(e.currency)) continue;
      if (e.status === "voided") continue;
      balances[e.currency] += e.direction === "in" ? e.amount : -e.amount;
    }
    return balances;
  }, [entries]);

  // موجودی طلبکاران (مشتریانی که نزد صرافی پول دارند)
  const customerDeposits = useMemo(() => {
    const totals: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    for (const c of customers) {
      for (const cur of currencies) {
        const bal = c.balances?.[cur] || 0;
        if (bal > 0) totals[cur] += bal;
      }
    }
    return totals;
  }, [customers]);

  // بدهی مشتریان (صرافی از آنها طلب دارد)
  const customerDebts = useMemo(() => {
    const totals: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    for (const c of customers) {
      for (const cur of currencies) {
        const bal = c.balances?.[cur] || 0;
        if (bal < 0) totals[cur] += Math.abs(bal);
      }
    }
    return totals;
  }, [customers]);

  // سرمایه خالص مالک (دقیقاً همان فرمول تب Cash)
  const ownerNetCapital = useMemo(() => {
    const totals: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    for (const cur of currencies) {
      totals[cur] = (physicalCashBalances[cur] || 0) - (customerDeposits[cur] || 0) + (customerDebts[cur] || 0);
    }
    return totals;
  }, [physicalCashBalances, customerDeposits, customerDebts]);

  // کارمزد کل کسب‌شده (از معاملات + حواله‌ها)
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

  // کارمزد برداشت‌شده
  const commissionWithdrawn = useMemo(() => {
    const totals: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    for (const e of entries) {
      if (e.type === "commission_withdraw" && e.status === "active" && e.direction === "out") {
        totals[e.currency] += e.amount;
      }
    }
    return totals;
  }, [entries]);

  // کارمزد قابل برداشت
  const availableCommission = useMemo(() => {
    const totals: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    for (const cur of currencies) {
      totals[cur] = Math.max(0, (totalCommissionEarned[cur] || 0) - (commissionWithdrawn[cur] || 0));
    }
    return totals;
  }, [totalCommissionEarned, commissionWithdrawn]);

  // آمار امروز
  const todayStats = useMemo(() => {
    let tradeCount = 0, hawalaCount = 0, cashCount = 0;
    const tradeCommission: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    const hawalaFee: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };

    for (const tx of transactions) {
      if (tx.status === "voided") continue;
      if (isToday(tx.date)) {
        tradeCount++;
        if (tx.commission && tx.commission > 0 && tx.commissionCurrency) {
          tradeCommission[tx.commissionCurrency] += tx.commission;
        }
      }
    }

    for (const h of hawalas) {
      if (h.status === "cancelled") continue;
      if (isToday(h.date)) {
        hawalaCount++;
        if (h.fee && h.fee > 0 && h.feeCurrency) {
          hawalaFee[h.feeCurrency] += h.fee;
        }
      }
    }

    for (const e of entries) {
      if (e.status === "voided") continue;
      if (isToday(e.date)) cashCount++;
    }

    return { tradeCount, hawalaCount, cashCount, tradeCommission, hawalaFee };
  }, [transactions, hawalas, entries]);

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

        {/* نوار بالا */}
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
          <section className="cs-up space-y-3" style={{ animationDelay: "70ms" }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">📅</span>
              <h2 className={`cs-display text-xl ${heading}`}>آمار امروز</h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <TodayStat dk={dk} icon="💱" label="معاملات" value={fa(todayStats.tradeCount)} color="blue" />
              <TodayStat dk={dk} icon="💸" label="حواله‌ها" value={fa(todayStats.hawalaCount)} color="purple" />
              <TodayStat dk={dk} icon="🏦" label="عملیات صندوق" value={fa(todayStats.cashCount)} color="emerald" />
              <TodayStat
                dk={dk}
                icon="💰"
                label="کارمزد معاملات"
                value={Object.values(todayStats.tradeCommission).reduce((a, b) => a + b, 0) > 0 ? "✅" : "۰"}
                color="amber"
              />
              <TodayStat
                dk={dk}
                icon="🎯"
                label="کارمزد حواله‌ها"
                value={Object.values(todayStats.hawalaFee).reduce((a, b) => a + b, 0) > 0 ? "✅" : "۰"}
                color="rose"
              />
              <TodayStat
                dk={dk}
                icon="👥"
                label="مشتریان فعال"
                value={fa(customers.length)}
                color="sky"
              />
            </div>
          </section>

          {/* ═══════════ موجودی فیزیکی صندوق ═══════════ */}
          <section className="cs-up space-y-3" style={{ animationDelay: "140ms" }}>
            <div className={`rounded-2xl border p-4 md:p-5 ${dk ? "border-emerald-400/30 bg-gradient-to-r from-emerald-400/10 to-teal-400/5" : "border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50"}`}>
              <div className="flex items-center gap-3 mb-3">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${dk ? "bg-emerald-400/20 text-emerald-300" : "bg-emerald-100 text-emerald-600"}`}>
                  <span className="text-xl">🏦</span>
                </span>
                <div>
                  <b className={`block text-sm font-black ${dk ? "text-emerald-300" : "text-emerald-700"}`}>
                    💰 موجودی فیزیکی صندوق
                  </b>
                  <span className={`text-[10px] font-bold ${subText}`}>
                    فقط اسناد صندوق — بدون موجودی مشتریان
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {currencies.map(cur => {
                  const bal = physicalCashBalances[cur];
                  return (
                    <div key={cur} className={`rounded-xl px-3 py-2.5 text-center ${dk ? "bg-slate-900/60" : "bg-white shadow-sm"}`}>
                      <div className="text-xl mb-1">{flags[cur]}</div>
                      <div className={`text-[10px] font-bold mb-1 ${subText}`}>{labels[cur]}</div>
                      <div className={`text-lg font-black tabular-nums ${bal < 0 ? "text-rose-500" : dk ? "text-emerald-300" : "text-emerald-700"}`}>
                        {fmt(bal)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ═══════════ چهار کارت حساب‌ها ═══════════ */}
          <section className="cs-up grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" style={{ animationDelay: "210ms" }}>

            {/* موجودی مشتریان (طلبکار) */}
            <div className={`rounded-2xl border p-4 ${dk ? "border-sky-400/25 bg-sky-400/[0.06]" : "border-sky-200 bg-sky-50"}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${dk ? "bg-sky-400/15 text-sky-300" : "bg-sky-100 text-sky-600"}`}>
                  👥
                </span>
                <div>
                  <b className={`block text-[11px] font-black ${dk ? "text-sky-300" : "text-sky-700"}`}>
                    💳 موجودی مشتریان (طلب)
                  </b>
                  <span className={`text-[9px] font-bold ${subText}`}>پول مشتری نزد صرافی</span>
                </div>
              </div>
              <div className="space-y-1">
                {currencies.map(cur => {
                  const bal = customerDeposits[cur];
                  return (
                    <div key={cur} className={`flex items-center justify-between rounded-lg px-2 py-1 ${dk ? "bg-slate-900/40" : "bg-white/70"}`}>
                      <span className={`text-[10px] font-bold flex items-center gap-1 ${subText}`}>
                        {flags[cur]} {labels[cur]}
                      </span>
                      <span className={`text-[11px] font-black tabular-nums ${bal > 0 ? (dk ? "text-sky-300" : "text-sky-700") : subText}`}>
                        {fmt(bal)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* بدهی مشتریان */}
            <div className={`rounded-2xl border p-4 ${dk ? "border-rose-400/25 bg-rose-400/[0.06]" : "border-rose-200 bg-rose-50"}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${dk ? "bg-rose-400/15 text-rose-300" : "bg-rose-100 text-rose-600"}`}>
                  📉
                </span>
                <div>
                  <b className={`block text-[11px] font-black ${dk ? "text-rose-300" : "text-rose-700"}`}>
                    🔻 بدهی مشتریان
                  </b>
                  <span className={`text-[9px] font-bold ${subText}`}>صرافی قرض داده</span>
                </div>
              </div>
              <div className="space-y-1">
                {currencies.map(cur => {
                  const bal = customerDebts[cur];
                  return (
                    <div key={cur} className={`flex items-center justify-between rounded-lg px-2 py-1 ${dk ? "bg-slate-900/40" : "bg-white/70"}`}>
                      <span className={`text-[10px] font-bold flex items-center gap-1 ${subText}`}>
                        {flags[cur]} {labels[cur]}
                      </span>
                      <span className={`text-[11px] font-black tabular-nums ${bal > 0 ? "text-rose-500" : subText}`}>
                        {fmt(bal)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* سرمایه خالص مالک */}
            <div className={`rounded-2xl border p-4 ${dk ? "border-violet-400/25 bg-violet-400/[0.06]" : "border-violet-200 bg-violet-50"}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${dk ? "bg-violet-400/15 text-violet-300" : "bg-violet-100 text-violet-600"}`}>
                  👑
                </span>
                <div>
                  <b className={`block text-[11px] font-black ${dk ? "text-violet-300" : "text-violet-700"}`}>
                    💼 سرمایه خالص مالک
                  </b>
                  <span className={`text-[9px] font-bold ${subText}`}>صندوق - طلب + بدهی</span>
                </div>
              </div>
              <div className="space-y-1">
                {currencies.map(cur => {
                  const bal = ownerNetCapital[cur];
                  return (
                    <div key={cur} className={`flex items-center justify-between rounded-lg px-2 py-1 ${dk ? "bg-slate-900/40" : "bg-white/70"}`}>
                      <span className={`text-[10px] font-bold flex items-center gap-1 ${subText}`}>
                        {flags[cur]} {labels[cur]}
                      </span>
                      <span className={`text-[11px] font-black tabular-nums ${bal < 0 ? "text-rose-500" : dk ? "text-violet-300" : "text-violet-700"}`}>
                        {fmt(bal)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* کارمزد قابل برداشت */}
            <div className={`rounded-2xl border p-4 ${dk ? "border-amber-400/25 bg-amber-400/[0.06]" : "border-amber-200 bg-amber-50"}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${dk ? "bg-amber-400/15 text-amber-300" : "bg-amber-100 text-amber-600"}`}>
                  💎
                </span>
                <div>
                  <b className={`block text-[11px] font-black ${dk ? "text-amber-300" : "text-amber-700"}`}>
                    💎 کارمزد قابل برداشت
                  </b>
                  <span className={`text-[9px] font-bold ${subText}`}>درآمد خالص صرافی</span>
                </div>
              </div>
              <div className="space-y-1">
                {currencies.map(cur => {
                  const bal = availableCommission[cur];
                  return (
                    <div key={cur} className={`flex items-center justify-between rounded-lg px-2 py-1 ${dk ? "bg-slate-900/40" : "bg-white/70"}`}>
                      <span className={`text-[10px] font-bold flex items-center gap-1 ${subText}`}>
                        {flags[cur]} {labels[cur]}
                      </span>
                      <span className={`text-[11px] font-black tabular-nums ${bal > 0 ? (dk ? "text-amber-300" : "text-amber-700") : subText}`}>
                        {fmt(bal)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ═══════════ فرمول حسابداری ═══════════ */}
          <div className={`cs-up rounded-xl border px-4 py-3 ${dk ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-white/70"}`} style={{ animationDelay: "280ms" }}>
            <div className={`flex flex-wrap items-center justify-center gap-2 text-[10px] font-bold ${subText}`}>
              <span className={`px-2 py-1 rounded-lg ${dk ? "bg-emerald-400/10 text-emerald-300" : "bg-emerald-50 text-emerald-700"}`}>
                💰 صندوق
              </span>
              <span>=</span>
              <span className={`px-2 py-1 rounded-lg ${dk ? "bg-violet-400/10 text-violet-300" : "bg-violet-50 text-violet-700"}`}>
                👑 سرمایه مالک
              </span>
              <span>+</span>
              <span className={`px-2 py-1 rounded-lg ${dk ? "bg-sky-400/10 text-sky-300" : "bg-sky-50 text-sky-700"}`}>
                👥 موجودی مشتریان
              </span>
              <span>−</span>
              <span className={`px-2 py-1 rounded-lg ${dk ? "bg-rose-400/10 text-rose-300" : "bg-rose-50 text-rose-700"}`}>
                📉 بدهی مشتریان
              </span>
            </div>
          </div>

          {/* ═══════════ جدول وضعیت کلی سیستم ═══════════ */}
          <section className={`cs-up rounded-2xl border overflow-hidden ${uiCard}`} style={{ animationDelay: "350ms" }}>
            <div className="flex items-center gap-3 p-4 md:p-5 pb-3 md:pb-4 md:px-7 md:pt-6">
              <span className={`grid h-10 w-10 md:h-11 md:w-11 place-items-center rounded-xl ${dk ? "bg-cyan-400/15 text-cyan-300" : "bg-cyan-100 text-cyan-600"}`}>
                📋
              </span>
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
                    <th className="px-3 py-3 text-right text-[10px] font-black text-slate-400 whitespace-nowrap">ارز</th>
                    <th className="px-3 py-3 text-center text-[10px] font-black text-slate-400 whitespace-nowrap">💰 صندوق</th>
                    <th className="px-3 py-3 text-center text-[10px] font-black text-slate-400 whitespace-nowrap">👥 طلب مشتریان</th>
                    <th className="px-3 py-3 text-center text-[10px] font-black text-slate-400 whitespace-nowrap">📉 بدهی مشتریان</th>
                    <th className="px-3 py-3 text-center text-[10px] font-black text-slate-400 whitespace-nowrap">👑 سرمایه مالک</th>
                    <th className="px-3 py-3 text-center text-[10px] font-black text-slate-400 whitespace-nowrap">💎 کارمزد</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${dk ? "divide-slate-700/60" : "divide-slate-100"}`}>
                  {currencies.map(cur => {
                    const cash = physicalCashBalances[cur];
                    const deps = customerDeposits[cur];
                    const debts = customerDebts[cur];
                    const equity = ownerNetCapital[cur];
                    const comm = availableCommission[cur];

                    return (
                      <tr key={cur} className={`transition-colors ${dk ? "hover:bg-slate-700/30" : "hover:bg-emerald-50/70"}`}>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{flags[cur]}</span>
                            <span className={`font-bold ${dk ? "text-slate-200" : "text-slate-700"}`}>
                              {labels[cur]}
                            </span>
                          </div>
                        </td>
                        <td className={`px-3 py-3 text-center text-[12px] font-black tabular-nums ${cash < 0 ? "text-rose-500" : dk ? "text-emerald-300" : "text-emerald-700"}`}>
                          {fmt(cash)}
                        </td>
                        <td className={`px-3 py-3 text-center text-[12px] font-black tabular-nums ${deps > 0 ? (dk ? "text-sky-300" : "text-sky-700") : subText}`}>
                          {fmt(deps)}
                        </td>
                        <td className={`px-3 py-3 text-center text-[12px] font-black tabular-nums ${debts > 0 ? "text-rose-500" : subText}`}>
                          {fmt(debts)}
                        </td>
                        <td className={`px-3 py-3 text-center text-[12px] font-black tabular-nums ${equity < 0 ? "text-rose-500" : dk ? "text-violet-300" : "text-violet-700"}`}>
                          {fmt(equity)}
                        </td>
                        <td className={`px-3 py-3 text-center text-[12px] font-black tabular-nums ${comm > 0 ? (dk ? "text-amber-300" : "text-amber-700") : subText}`}>
                          {fmt(comm)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className={`border-t-2 ${dk ? "border-slate-600 bg-slate-800/80" : "border-slate-200 bg-slate-50"}`}>
                    <td className="px-3 py-3 text-right">
                      <span className={`text-[11px] font-black ${dk ? "text-slate-300" : "text-slate-700"}`}>
                        📊 مجموع (AFN)
                      </span>
                    </td>
                    <td className={`px-3 py-3 text-center text-[12px] font-black tabular-nums ${dk ? "text-emerald-300" : "text-emerald-700"}`}>
                      {fmt(physicalCashBalances.AFN)}
                    </td>
                    <td className={`px-3 py-3 text-center text-[12px] font-black tabular-nums ${dk ? "text-sky-300" : "text-sky-700"}`}>
                      {fmt(customerDeposits.AFN)}
                    </td>
                    <td className={`px-3 py-3 text-center text-[12px] font-black tabular-nums text-rose-500`}>
                      {fmt(customerDebts.AFN)}
                    </td>
                    <td className={`px-3 py-3 text-center text-[12px] font-black tabular-nums ${dk ? "text-violet-300" : "text-violet-700"}`}>
                      {fmt(ownerNetCapital.AFN)}
                    </td>
                    <td className={`px-3 py-3 text-center text-[12px] font-black tabular-nums ${dk ? "text-amber-300" : "text-amber-700"}`}>
                      {fmt(availableCommission.AFN)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* ═══════════ فوتر ═══════════ */}
          <div className={`cs-up text-center py-4 text-[11px] font-bold ${subText}`} style={{ animationDelay: "420ms" }}>
            🏦 صرافی برادران نورزاد — هرات | هر ۱۵ ثانیه به‌روزرسانی می‌شود
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// کامپوننت کمکی: کارت آمار امروز
// ============================================================
function TodayStat({ dk, icon, label, value, color }: {
  dk: boolean;
  icon: string;
  label: string;
  value: string;
  color: "blue" | "emerald" | "amber" | "purple" | "rose" | "sky";
}) {
  const colorMap = {
    blue: dk ? "border-blue-400/25 bg-blue-400/[0.06]" : "border-blue-200 bg-blue-50",
    emerald: dk ? "border-emerald-400/25 bg-emerald-400/[0.06]" : "border-emerald-200 bg-emerald-50",
    amber: dk ? "border-amber-400/25 bg-amber-400/[0.06]" : "border-amber-200 bg-amber-50",
    purple: dk ? "border-purple-400/25 bg-purple-400/[0.06]" : "border-purple-200 bg-purple-50",
    rose: dk ? "border-rose-400/25 bg-rose-400/[0.06]" : "border-rose-200 bg-rose-50",
    sky: dk ? "border-sky-400/25 bg-sky-400/[0.06]" : "border-sky-200 bg-sky-50",
  };
  const iconMap = {
    blue: dk ? "bg-blue-400/15 text-blue-300" : "bg-blue-100 text-blue-600",
    emerald: dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-600",
    amber: dk ? "bg-amber-400/15 text-amber-300" : "bg-amber-100 text-amber-600",
    purple: dk ? "bg-purple-400/15 text-purple-300" : "bg-purple-100 text-purple-600",
    rose: dk ? "bg-rose-400/15 text-rose-300" : "bg-rose-100 text-rose-600",
    sky: dk ? "bg-sky-400/15 text-sky-300" : "bg-sky-100 text-sky-600",
  };
  const textMap = {
    blue: dk ? "text-blue-300" : "text-blue-700",
    emerald: dk ? "text-emerald-300" : "text-emerald-700",
    amber: dk ? "text-amber-300" : "text-amber-700",
    purple: dk ? "text-purple-300" : "text-purple-700",
    rose: dk ? "text-rose-300" : "text-rose-700",
    sky: dk ? "text-sky-300" : "text-sky-700",
  };

  return (
    <div className={`rounded-2xl border p-4 ${colorMap[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${iconMap[color]}`}>
          {icon}
        </span>
        <span className={`text-[10px] font-black ${textMap[color]}`}>{label}</span>
      </div>
      <p className={`text-2xl font-black tabular-nums ${textMap[color]}`}>{value}</p>
    </div>
  );
}
