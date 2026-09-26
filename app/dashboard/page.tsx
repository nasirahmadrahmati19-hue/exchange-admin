"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation"; // ✅ جایگزین redirect برای کلاینت
import { signOut } from "firebase/auth"; // ✅ برای خروج اجباری در صورت ایمیل نامعتبر
import { useAuth } from "../AuthProvider";
import { auth } from "./lib/firebase"; // ✅ مسیر صحیح بر اساس ساختار پوشه‌های شما
import { useSafeSyncedState } from "./lib/useSafeSyncedState";

// ============================================================
// ⚠️ قانون سخت‌گیرانه: ایمیل مجاز را دقیقاً اینجا وارد کنید
// ============================================================
const ALLOWED_EMAIL = "nasirahmadrahmati19@gmail.com"; // ایمیل خود را جایگزین کنید

// ============================================================
// تایپ‌ها و ثابت‌ها (بدون تغییر)
// ============================================================
type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";

const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const labels: Record<Currency, string> = {
  AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار",
};

const CASH_BOX_ID = "CASH_BOX";
const EXCHANGE_ACCOUNT_ID = "EXCHANGE_ACCOUNT";

const INITIAL_CUSTOMERS: any[] = [];
const INITIAL_TRANSACTIONS: any[] = [];
const INITIAL_HAWALAS: any[] = [];
const INITIAL_CASH: any[] = [];

interface Customer {
  id: string; name: string; phone?: string; tazkira?: string; address?: string;
  note?: string; telegram?: string; telegramChatId?: string; registeredAt: string;
  balances: Record<Currency, number>;
}

interface Transaction {
  id: string; trackingCode: string; type: "exchange" | "transfer" | "convert";
  dealType?: "buy" | "sell"; date: string; customerId?: string; customerName?: string;
  senderId?: string; senderName?: string; receiverId?: string; receiverName?: string;
  fromCurrency: Currency; fromAmount: number; toCurrency: Currency; toAmount: number;
  rate: number; rateLabel: string; rateBase?: Currency; commission?: number;
  commissionCurrency?: Currency; commissionPayer?: "sender" | "receiver";
  description?: string; status: "active" | "voided"; profit?: number; profitCurrency?: Currency;
}

interface Hawala {
  id: string; number: string; date: string; time: string; type: string;
  destinationCountry: string; province: string; district: string; destinationText: string;
  currencyFrom: Currency; currencyTo: Currency; amountFrom: number; rate: number;
  rateLabel: string; rateBase?: Currency; fee: number; feeCurrency: Currency;
  feePayer: "sender" | "receiver"; finalAmount: number; balance: string; note: string;
  profit: number; profitCurrency: Currency; senderId?: string; senderName: string;
  senderPhone: string; senderTelegram: string; receiverId?: string; receiverName: string;
  receiverTazkira: string; receiverPhone: string; receiverAddress: string;
  status: "pending" | "sent" | "paid" | "cancelled"; paidAt?: string; paidBy?: string;
  paidAmount?: number; cancelReason?: string;
}

interface CashEntry {
  id: string; trackingCode: string; date: string; type: string; currency: Currency;
  amount: number; direction: "in" | "out"; status: "active" | "voided";
  customerId?: string; linkedHawalaId?: string;
}

// ============================================================
// توابع کمکی (بدون تغییر)
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
    const normalizedStr = normalizeDigits(String(dateStr));
    const now = new Date();
    const num = Number(normalizedStr);
    if (!isNaN(num) && num > 1000000000000) {
      const d = new Date(num);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    }
    const todayISO = now.toISOString().split("T")[0];
    if (normalizedStr.startsWith(todayISO)) return true;
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
      year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(now);
    const y = parts.find(p => p.type === "year")?.value || "0";
    const m = parts.find(p => p.type === "month")?.value || "0";
    const d = parts.find(p => p.type === "day")?.value || "0";
    const todayFa = `${y}/${m}/${d}`;
    const todayFaDash = `${y}-${m}-${d}`;
    if (normalizedStr.includes(todayFa) || normalizedStr.includes(todayFaDash)) return true;
  } catch (e) {
    console.warn("isToday error:", e);
  }
  return false;
}

function getLedgerBalance(customerId: string, currency: Currency, entries: any[], transactions: any[], hawalas: any[]): number {
  let balance = 0;
  const strCustomerId = String(customerId);
  const accountedHawalaIds = new Set<string>();

  for (const entry of entries) {
    if (entry.status === "voided" || entry.currency !== currency) continue;
    if (strCustomerId === String(CASH_BOX_ID)) {
      if (entry.type === "exchange_account_in" || entry.type === "exchange_account_out") continue;
      if (entry.type === "loan_given") balance -= Number(entry.amount);
      else if (entry.type === "loan_received") balance += Number(entry.amount);
      else { const physicalMultiplier = entry.direction === "in" ? 1 : -1; balance += Number(entry.amount) * physicalMultiplier; }
    } else if (strCustomerId === String(EXCHANGE_ACCOUNT_ID)) {
      if (entry.type === "owner_deposit") balance += Number(entry.amount);
      else if (entry.type === "owner_withdraw") balance -= Number(entry.amount);
      else if (entry.type === "exchange_account_in") balance += Number(entry.amount);
      else if (entry.type === "exchange_account_out") balance -= Number(entry.amount);
      else if (entry.type === "loan_given") balance -= Number(entry.amount);
      else if (entry.type === "loan_received") balance += Number(entry.amount);
    } else {
      if (String(entry.customerId) === strCustomerId) {
        if (entry.type === "customer_deposit") balance += Number(entry.amount);
        else if (entry.type === "customer_withdraw") balance -= Number(entry.amount);
        else if (entry.type === "loan_given") balance -= Number(entry.amount);
        else if (entry.type === "loan_received") balance += Number(entry.amount);
        if (entry.linkedHawalaId) accountedHawalaIds.add(String(entry.linkedHawalaId));
      }
    }
  }

  if (strCustomerId !== String(CASH_BOX_ID) && strCustomerId !== String(EXCHANGE_ACCOUNT_ID)) {
    for (const tx of transactions) {
      if (tx.status === "voided") continue;
      if (tx.type === "exchange" && String(tx.customerId) === strCustomerId) {
        if (tx.fromCurrency === currency) balance -= Number(tx.fromAmount || 0);
        if (tx.toCurrency === currency) balance += Number(tx.toAmount || 0);
        if (tx.commission && tx.commissionCurrency === currency) balance -= Number(tx.commission || 0);
      }
      if (tx.type === "transfer") {
        if (String(tx.senderId) === strCustomerId) {
          if (tx.fromCurrency === currency) balance -= Number(tx.fromAmount || 0);
          if (tx.commissionPayer === "sender" && tx.commission && tx.commissionCurrency === currency) balance -= Number(tx.commission || 0);
        }
        if (String(tx.receiverId) === strCustomerId) {
          if (tx.toCurrency === currency) balance += Number(tx.toAmount || 0);
          if (tx.commissionPayer === "receiver" && tx.commission && tx.commissionCurrency === currency) balance -= Number(tx.commission || 0);
        }
      }
      if (tx.type === "convert" && String(tx.customerId) === strCustomerId) {
        if (tx.fromCurrency === currency) balance -= Number(tx.fromAmount || 0);
        if (tx.toCurrency === currency) balance += Number(tx.toAmount || 0);
        if (tx.commission && tx.commissionCurrency === currency) balance -= Number(tx.commission || 0);
      }
    }

    for (const h of hawalas) {
      if (h.status === "cancelled") continue;
      if (accountedHawalaIds.has(String(h.id))) continue;
      if (String(h.senderId) === strCustomerId) {
        if (h.currencyFrom === currency) balance -= Number(h.amountFrom || 0);
        if (h.feePayer === "sender" && h.feeCurrency === currency) balance -= Number(h.fee || 0);
      }
      if (h.status === "paid" && String(h.receiverId) === strCustomerId) {
        if (h.currencyTo === currency) balance += Number(h.finalAmount || 0);
        if (h.feePayer === "receiver" && h.feeCurrency === currency) balance -= Number(h.fee || 0);
      }
    }
  }
  return balance;
}

// ============================================================
// کامپوننت اصلی داشبورد
// ============================================================
export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // ✅ مدیریت نرم و بدون پرش ریدایرکت و قوانین سخت‌گیرانه
  useEffect(() => {
    if (!loading) {
      if (!user) {
        // اگر کاربر لاگین نیست، به لاگین برود
        router.replace("/login");
      } else if (user.email !== ALLOWED_EMAIL) {
        // ✅ قانون سخت‌گیرانه: اگر ایمیل مطابقت نداشت، فوراً خارج شود
        signOut(auth).then(() => {
          router.replace("/login");
        });
      }
    }
  }, [user, loading, router]);

  // ✅ تا زمانی که لودینگ تمام نشده یا کاربر معتبر نیست، هیچ چیزی از داشبورد رندر نشود
  // این خط جلوی "فلش زدن" محتوا را به طور کامل می‌گیرد
  if (loading || !user || user.email !== ALLOWED_EMAIL) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-300 mb-2 font-bold">در حال بررسی دسترسی...</p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  // ============================================================
  // از اینجا به بعد، فقط و فقط کاربر مجاز و لاگین‌شده کد را می‌بیند
  // ============================================================
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const [customers] = useSafeSyncedState<Customer>("customers", INITIAL_CUSTOMERS);
  const [entries] = useSafeSyncedState<CashEntry>("cash_entries", INITIAL_CASH);
  const [transactions] = useSafeSyncedState<Transaction>("transactions", INITIAL_TRANSACTIONS);
  const [hawalas] = useSafeSyncedState<Hawala>("hawalas", INITIAL_HAWALAS);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("fx-theme");
      if (saved === "dark" || saved === "light") setTheme(saved);
    } catch {}
    setLastUpdated(new Date());
  }, []);

  // ... (بقیه کدهای useMemo و JSX شما دقیقاً به همین شکل باقی می‌ماند) ...
  // برای کوتاه شدن پاسخ، بخش JSX را خلاصه کردم، اما شما باید کل بخش return (JSX) 
  // که در کد اصلی خودتان بود را دقیقاً بعد از این خط کپی کنید.

  const customerDeposits = useMemo(() => {
    const totals: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    for (const c of customers) {
      if (c.id === CASH_BOX_ID || c.id === EXCHANGE_ACCOUNT_ID) continue;
      for (const cur of currencies) {
        const bal = getLedgerBalance(c.id, cur, entries, transactions, hawalas);
        if (bal > 0) totals[cur] += bal;
      }
    }
    return totals;
  }, [customers, entries, transactions, hawalas]);

  const customerDebts = useMemo(() => {
    const totals: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    for (const c of customers) {
      if (c.id === CASH_BOX_ID || c.id === EXCHANGE_ACCOUNT_ID) continue;
      for (const cur of currencies) {
        const bal = getLedgerBalance(c.id, cur, entries, transactions, hawalas);
        if (bal < 0) totals[cur] += Math.abs(bal);
      }
    }
    return totals;
  }, [customers, entries, transactions, hawalas]);

  const exchangeBalance = useMemo(() => {
    const balances: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    for (const cur of currencies) {
      let ownerBalance = 0;
      for (const entry of entries) {
        if (entry.status === "voided" || entry.currency !== cur) continue;
        if (entry.type === "owner_deposit") ownerBalance += Number(entry.amount);
        else if (entry.type === "owner_withdraw") ownerBalance -= Number(entry.amount);
      }
      balances[cur] = ownerBalance - (customerDebts[cur] || 0);
    }
    return balances;
  }, [entries, customerDebts]);

  const physicalCashBalances = useMemo(() => {
    const balances: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    for (const cur of currencies) {
      balances[cur] = customerDeposits[cur] + exchangeBalance[cur];
    }
    return balances;
  }, [customerDeposits, exchangeBalance]);

  const totalCommissionEarned = useMemo(() => {
    const totals: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    for (const tx of transactions) {
      if (tx.status === "voided") continue;
      if (tx.commission && tx.commission > 0 && tx.commissionCurrency) {
        totals[tx.commissionCurrency] += Number(tx.commission);
      }
    }
    for (const h of hawalas) {
      if (h.status === "cancelled") continue;
      if (h.fee && h.fee > 0 && h.feeCurrency) {
        totals[h.feeCurrency] += Number(h.fee);
      }
    }
    return totals;
  }, [transactions, hawalas]);

  const commissionWithdrawn = useMemo(() => {
    const totals: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    for (const e of entries) {
      if (e.type === "commission_withdraw" && e.status === "active" && e.direction === "out") {
        totals[e.currency] += Number(e.amount);
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

  const todayStats = useMemo(() => {
    let tradeCount = 0, hawalaCount = 0;
    for (const tx of transactions) {
      if (tx.status === "voided") continue;
      if (isToday(tx.date)) tradeCount++;
    }
    for (const h of hawalas) {
      if (h.status === "cancelled") continue;
      if (isToday(h.date)) hawalaCount++;
    }
    return { tradeCount, hawalaCount };
  }, [transactions, hawalas]);

  const todayTradeByCurrency = useMemo(() => {
    const result: Record<Currency, { amount: number; count: number; commission: number }> = {
      AFN: { amount: 0, count: 0, commission: 0 }, USD: { amount: 0, count: 0, commission: 0 },
      EUR: { amount: 0, count: 0, commission: 0 }, IRR: { amount: 0, count: 0, commission: 0 },
      PKR: { amount: 0, count: 0, commission: 0 },
    };
    for (const tx of transactions) {
      if (tx.status === "voided") continue;
      if (isToday(tx.date)) {
        result[tx.fromCurrency].amount += Number(tx.fromAmount || 0);
        result[tx.fromCurrency].count++;
        if (tx.commission && tx.commission > 0 && tx.commissionCurrency) {
          result[tx.commissionCurrency].commission += Number(tx.commission);
        }
      }
    }
    return result;
  }, [transactions]);

  const todayHawalaByCurrency = useMemo(() => {
    const result: Record<Currency, { amount: number; count: number; fee: number }> = {
      AFN: { amount: 0, count: 0, fee: 0 }, USD: { amount: 0, count: 0, fee: 0 },
      EUR: { amount: 0, count: 0, fee: 0 }, IRR: { amount: 0, count: 0, fee: 0 },
      PKR: { amount: 0, count: 0, fee: 0 },
    };
    for (const h of hawalas) {
      if (h.status === "cancelled") continue;
      if (isToday(h.date)) {
        result[h.currencyFrom].amount += Number(h.amountFrom || 0);
        result[h.currencyFrom].count++;
        if (h.fee && h.fee > 0 && h.feeCurrency) {
          result[h.feeCurrency].fee += Number(h.fee);
        }
      }
    }
    return result;
  }, [hawalas]);

  const debtorsCount = useMemo(() => {
    return customers.filter(c => {
      if (c.id === CASH_BOX_ID || c.id === EXCHANGE_ACCOUNT_ID) return false;
      return currencies.some(cur => getLedgerBalance(c.id, cur, entries, transactions, hawalas) < 0);
    }).length;
  }, [customers, entries, transactions, hawalas]);

  const dk = theme === "dark";
  const heading = dk ? "text-white" : "text-slate-900";
  const subText = dk ? "text-slate-500" : "text-slate-400";
  const uiCard = dk
    ? "border-slate-700 bg-slate-800/90 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.6)]"
    : "border-emerald-100 bg-white/95 shadow-[0_16px_40px_-28px_rgba(16,185,129,0.35)]";

  return (
    <div dir="rtl" className={dk ? "dark" : ""}>
      <div className={`cs-font relative min-h-screen overflow-x-hidden antialiased transition-colors duration-500 safe-fade-in ${dk ? "bg-[#0f172a] text-slate-100" : "bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 text-slate-800"}`}>
        <div className={`fixed inset-x-0 top-0 z-30 h-1 bg-gradient-to-l ${dk ? "from-emerald-400 via-teal-400 to-cyan-400" : "from-emerald-500 via-teal-500 to-cyan-500"}`} />

        <div className="relative z-10 mx-auto w-full max-w-7xl space-y-4 md:space-y-6 px-3 pb-16 pt-5 md:px-8 md:pt-9">
          {/* هدر */}
          <header className="safe-fade-in flex flex-wrap items-center justify-between gap-3" style={{ animationDelay: "50ms" }}>
            <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0">
              <div className="relative grid h-11 w-11 md:h-14 md:w-14 shrink-0 place-items-center rounded-xl md:rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-400 text-white shadow-lg shadow-emerald-500/30 ring-1 ring-white/30">
                <span className="text-2xl md:text-3xl">📊</span>
                <span className={`absolute -bottom-1 -left-1 md:-bottom-1.5 md:-left-1.5 grid h-4 min-w-4 md:h-5 md:min-w-5 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-400 px-1 text-[7px] md:text-[8px] font-black text-white ring-2 ${dk ? "ring-[#0f172a]" : "ring-[#ecfdf5]"}`}>DB</span>
              </div>
              <div className="min-w-0">
                <h1 className={`cs-display text-2xl md:text-4xl leading-none ${heading}`}>داشبورد حساب‌ها</h1>
                <p className={`mt-1 text-[10px] md:text-xs font-bold ${subText}`}>صرافی برادران نورزاد — هرات</p>
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
                onClick={() => {
                  const newTheme = dk ? "light" : "dark";
                  setTheme(newTheme);
                  try { window.localStorage.setItem("fx-theme", newTheme); } catch {}
                }}
                className={`group grid h-10 w-10 md:h-11 md:w-11 cursor-pointer place-items-center rounded-lg md:rounded-xl border shadow-sm backdrop-blur transition-all duration-300 active:scale-90 ${dk ? "border-slate-600 bg-slate-800/85 text-amber-300 hover:border-amber-300" : "border-slate-200 bg-white/85 text-slate-600 hover:border-emerald-400"}`}
              >
                <span className="text-lg transition-transform duration-500 group-hover:rotate-12">
                  {dk ? "☀️" : "🌙"}
                </span>
              </button>
            </div>
          </header>

          {/* آمار امروز */}
          <section className="safe-fade-in space-y-4 md:space-y-6" style={{ animationDelay: "100ms" }}>
            <div className="flex items-center gap-3 mb-1">
              <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl shadow-md ${dk ? "bg-gradient-to-br from-blue-500 to-sky-500 text-white" : "bg-gradient-to-br from-blue-500 to-cyan-500 text-white"}`}>
                <span className="text-xl">🗓️</span>
              </div>
              <div>
                <h2 className={`cs-display text-xl md:text-2xl leading-none ${heading}`}>آمار امروز</h2>
                <p className={`mt-1 text-[10px] md:text-xs font-bold ${subText}`}>خلاصه فعالیت‌های روزانه به تفکیک ارز</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className={`group relative overflow-hidden rounded-2xl border p-5 md:p-6 transition-all duration-300 hover:shadow-xl hover:scale-[1.01] ${dk ? "border-blue-400/25 bg-gradient-to-br from-blue-900/30 to-slate-900/50" : "border-blue-200 bg-gradient-to-br from-blue-50 to-white"}`}>
                <div className="relative flex items-center gap-3 mb-4">
                  <span className={`grid h-12 w-12 place-items-center rounded-xl shadow-sm ${dk ? "bg-blue-400/15 text-blue-300" : "bg-blue-100 text-blue-600"}`}><span className="text-2xl">💱</span></span>
                  <div>
                    <span className={`block text-sm md:text-base font-black ${dk ? "text-blue-300" : "text-blue-700"}`}>مجموع تبادل ارز</span>
                    <div className={`text-[10px] md:text-xs font-bold ${dk ? "text-blue-400/70" : "text-blue-600/70"}`}>{fa(todayStats.tradeCount)} معامله امروز</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 md:gap-3">
                  {currencies.map(cur => {
                    const data = todayTradeByCurrency[cur];
                    const hasValue = data.amount > 0;
                    return (
                      <div key={cur} className={`rounded-xl px-1.5 md:px-2 py-3 text-center transition-all duration-300 min-h-[70px] flex flex-col justify-center ${hasValue ? (dk ? "bg-blue-500/10 ring-1 ring-blue-400/20" : "bg-blue-100/80 ring-1 ring-blue-200") : (dk ? "bg-slate-800/40" : "bg-slate-50")}`}>
                        <div className={`text-[10px] md:text-xs font-black mb-1 ${hasValue ? (dk ? "text-blue-300" : "text-blue-700") : subText}`}>{labels[cur]}</div>
                        <div className={`text-xs md:text-sm lg:text-base font-black tabular-nums leading-tight break-all whitespace-nowrap ${hasValue ? (dk ? "text-blue-200" : "text-blue-800") : subText}`}>{hasValue ? fmt(data.amount) : "—"}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className={`group relative overflow-hidden rounded-2xl border p-5 md:p-6 transition-all duration-300 hover:shadow-xl hover:scale-[1.01] ${dk ? "border-purple-400/25 bg-gradient-to-br from-purple-900/30 to-slate-900/50" : "border-purple-200 bg-gradient-to-br from-purple-50 to-white"}`}>
                <div className="relative flex items-center gap-3 mb-4">
                  <span className={`grid h-12 w-12 place-items-center rounded-xl shadow-sm ${dk ? "bg-purple-400/15 text-purple-300" : "bg-purple-100 text-purple-600"}`}><span className="text-2xl">💸</span></span>
                  <div>
                    <span className={`block text-sm md:text-base font-black ${dk ? "text-purple-300" : "text-purple-700"}`}>مجموع حواله‌ها</span>
                    <div className={`text-[10px] md:text-xs font-bold ${dk ? "text-purple-400/70" : "text-purple-600/70"}`}>{fa(todayStats.hawalaCount)} حواله امروز</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 md:gap-3">
                  {currencies.map(cur => {
                    const data = todayHawalaByCurrency[cur];
                    const hasValue = data.amount > 0;
                    return (
                      <div key={cur} className={`rounded-xl px-1.5 md:px-2 py-3 text-center transition-all duration-300 min-h-[70px] flex flex-col justify-center ${hasValue ? (dk ? "bg-purple-500/10 ring-1 ring-purple-400/20" : "bg-purple-100/80 ring-1 ring-purple-200") : (dk ? "bg-slate-800/40" : "bg-slate-50")}`}>
                        <div className={`text-[10px] md:text-xs font-black mb-1 ${hasValue ? (dk ? "text-purple-300" : "text-purple-700") : subText}`}>{labels[cur]}</div>
                        <div className={`text-xs md:text-sm lg:text-base font-black tabular-nums leading-tight break-all whitespace-nowrap ${hasValue ? (dk ? "text-purple-200" : "text-purple-800") : subText}`}>{hasValue ? fmt(data.amount) : "—"}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className={`group relative overflow-hidden rounded-2xl border p-5 md:p-6 transition-all duration-300 hover:shadow-xl hover:scale-[1.01] ${dk ? "border-amber-400/25 bg-gradient-to-br from-amber-900/30 to-slate-900/50" : "border-amber-200 bg-gradient-to-br from-amber-50 to-white"}`}>
                <div className="relative flex items-center gap-3 mb-4">
                  <span className={`grid h-12 w-12 place-items-center rounded-xl shadow-sm ${dk ? "bg-amber-400/15 text-amber-300" : "bg-amber-100 text-amber-600"}`}><span className="text-2xl">💰</span></span>
                  <span className={`text-sm md:text-base font-black ${dk ? "text-amber-300" : "text-amber-700"}`}>کارمزد تبادل ارز</span>
                </div>
                <div className="relative flex items-center justify-between gap-4 mt-2">
                  <div className={`text-center flex-1 p-3 rounded-xl ${dk ? "bg-white/5" : "bg-black/5"}`}>
                    <div className={`text-2xl md:text-3xl font-black tabular-nums leading-none ${dk ? "text-amber-300" : "text-amber-700"}`}>{fa(todayStats.tradeCount)}</div>
                    <div className={`mt-1.5 text-xs font-bold ${dk ? "text-amber-400/70" : "text-amber-600/70"}`}>تعداد معامله</div>
                  </div>
                  <div className={`w-px h-16 ${dk ? "bg-amber-400/20" : "bg-amber-200"}`} />
                  <div className={`text-center flex-1 p-3 rounded-xl ${dk ? "bg-white/5" : "bg-black/5"}`}>
                    <div className={`text-2xl md:text-3xl font-black tabular-nums leading-none ${dk ? "text-amber-300" : "text-amber-700"}`}>{fmt(Object.values(todayTradeByCurrency).reduce((sum, item) => sum + item.commission, 0))}</div>
                    <div className={`mt-1.5 text-xs font-bold ${dk ? "text-amber-400/70" : "text-amber-600/70"}`}>مجموع کارمزد</div>
                  </div>
                </div>
              </div>
              <div className={`group relative overflow-hidden rounded-2xl border p-5 md:p-6 transition-all duration-300 hover:shadow-xl hover:scale-[1.01] ${dk ? "border-rose-400/25 bg-gradient-to-br from-rose-900/30 to-slate-900/50" : "border-rose-200 bg-gradient-to-br from-rose-50 to-white"}`}>
                <div className="relative flex items-center gap-3 mb-4">
                  <span className={`grid h-12 w-12 place-items-center rounded-xl shadow-sm ${dk ? "bg-rose-400/15 text-rose-300" : "bg-rose-100 text-rose-600"}`}><span className="text-2xl">🎯</span></span>
                  <span className={`text-sm md:text-base font-black ${dk ? "text-rose-300" : "text-rose-700"}`}>کارمزد حواله‌جات</span>
                </div>
                <div className="relative flex items-center justify-between gap-4 mt-2">
                  <div className={`text-center flex-1 p-3 rounded-xl ${dk ? "bg-white/5" : "bg-black/5"}`}>
                    <div className={`text-2xl md:text-3xl font-black tabular-nums leading-none ${dk ? "text-rose-300" : "text-rose-700"}`}>{fa(todayStats.hawalaCount)}</div>
                    <div className={`mt-1.5 text-xs font-bold ${dk ? "text-rose-400/70" : "text-rose-600/70"}`}>تعداد حواله</div>
                  </div>
                  <div className={`w-px h-16 ${dk ? "bg-rose-400/20" : "bg-rose-200"}`} />
                  <div className={`text-center flex-1 p-3 rounded-xl ${dk ? "bg-white/5" : "bg-black/5"}`}>
                    <div className={`text-2xl md:text-3xl font-black tabular-nums leading-none ${dk ? "text-rose-300" : "text-rose-700"}`}>{fmt(Object.values(todayHawalaByCurrency).reduce((sum, item) => sum + item.fee, 0))}</div>
                    <div className={`mt-1.5 text-xs font-bold ${dk ? "text-rose-400/70" : "text-rose-600/70"}`}>مجموع کارمزد</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* موجودی فیزیکی صندوق */}
          <section className="safe-fade-in space-y-4 md:space-y-5" style={{ animationDelay: "150ms" }}>
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
                  <span className={`block text-[11px] md:text-xs font-bold mt-0.5 ${dk ? "text-slate-400" : "text-slate-500"}`}>حساب صرافی + طلب مشتریان</span>
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

          {/* چهار کارت حساب‌ها */}
          <section className="safe-fade-in grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4" style={{ animationDelay: "200ms" }}>
            <div className={`group relative overflow-hidden rounded-2xl border p-4 md:p-5 transition-all duration-300 hover:shadow-xl hover:scale-[1.01] ${dk ? "border-sky-400/25 bg-gradient-to-br from-sky-900/30 to-slate-900/50" : "border-sky-200 bg-gradient-to-br from-sky-50 to-white"}`}>
              <div className={`absolute top-0 right-0 h-24 w-24 rounded-full blur-2xl opacity-10 ${dk ? "bg-sky-400" : "bg-sky-300"}`} />
              <div className="relative flex items-center gap-3 mb-4">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${dk ? "bg-sky-400/15 text-sky-300" : "bg-sky-100 text-sky-600"}`}><span className="text-xl">💳</span></span>
                <div className="min-w-0">
                  <b className={`block text-[13px] md:text-[14px] font-black leading-tight ${dk ? "text-sky-300" : "text-sky-700"}`}>💳 طلب مشتریان</b>
                  <span className={`block text-[10px] md:text-[11px] font-bold mt-0.5 ${subText}`}>پول مشتری نزد صرافی</span>
                </div>
              </div>
              <div className="relative space-y-1.5">
                {currencies.map(cur => {
                  const bal = customerDeposits[cur];
                  return (
                    <div key={cur} className={`flex items-center justify-between rounded-xl px-3 py-2 transition-colors ${dk ? "bg-slate-900/50" : "bg-white/80"}`}>
                      <span className={`text-[12px] font-black ${dk ? "text-slate-400" : "text-slate-500"}`}>{labels[cur]}</span>
                      <span className={`text-[15px] md:text-base font-black tabular-nums ${bal > 0 ? (dk ? "text-sky-300" : "text-sky-700") : subText}`}>{fmt(bal)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`group relative overflow-hidden rounded-2xl border p-4 md:p-5 transition-all duration-300 hover:shadow-xl hover:scale-[1.01] ${dk ? "border-rose-400/25 bg-gradient-to-br from-rose-900/30 to-slate-900/50" : "border-rose-200 bg-gradient-to-br from-rose-50 to-white"}`}>
              <div className={`absolute top-0 right-0 h-24 w-24 rounded-full blur-2xl opacity-10 ${dk ? "bg-rose-400" : "bg-rose-300"}`} />
              <div className="relative flex items-center gap-3 mb-4">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${dk ? "bg-rose-400/15 text-rose-300" : "bg-rose-100 text-rose-600"}`}><span className="text-xl">📉</span></span>
                <div className="min-w-0">
                  <b className={`block text-[13px] md:text-[14px] font-black leading-tight ${dk ? "text-rose-300" : "text-rose-700"}`}>🔻 بدهی مشتریان</b>
                  <span className={`block text-[10px] md:text-[11px] font-bold mt-0.5 ${subText}`}>از حساب صرافی کسر شده</span>
                </div>
              </div>
              <div className="relative space-y-1.5">
                {currencies.map(cur => {
                  const bal = customerDebts[cur];
                  return (
                    <div key={cur} className={`flex items-center justify-between rounded-xl px-3 py-2 transition-colors ${dk ? "bg-slate-900/50" : "bg-white/80"}`}>
                      <span className={`text-[12px] font-black ${dk ? "text-slate-400" : "text-slate-500"}`}>{labels[cur]}</span>
                      <span className={`text-[15px] md:text-base font-black tabular-nums ${bal > 0 ? "text-rose-500" : subText}`}>{fmt(bal)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`group relative overflow-hidden rounded-2xl border p-4 md:p-5 transition-all duration-300 hover:shadow-xl hover:scale-[1.01] ${dk ? "border-violet-400/25 bg-gradient-to-br from-violet-900/30 to-slate-900/50" : "border-violet-200 bg-gradient-to-br from-violet-50 to-white"}`}>
              <div className={`absolute top-0 right-0 h-24 w-24 rounded-full blur-2xl opacity-10 ${dk ? "bg-violet-400" : "bg-violet-300"}`} />
              <div className="relative flex items-center gap-3 mb-4">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${dk ? "bg-violet-400/15 text-violet-300" : "bg-violet-100 text-violet-600"}`}><span className="text-xl">💼</span></span>
                <div className="min-w-0">
                  <b className={`block text-[13px] md:text-[14px] font-black leading-tight ${dk ? "text-violet-300" : "text-violet-700"}`}>💼 موجودی حساب صرافی</b>
                  <span className={`block text-[10px] md:text-[11px] font-bold mt-0.5 ${subText}`}>سرمایه مالک (پس از کسر بدهی)</span>
                </div>
              </div>
              <div className="relative space-y-1.5">
                {currencies.map(cur => {
                  const bal = exchangeBalance[cur];
                  return (
                    <div key={cur} className={`flex items-center justify-between rounded-xl px-3 py-2 transition-colors ${dk ? "bg-slate-900/50" : "bg-white/80"}`}>
                      <span className={`text-[12px] font-black ${dk ? "text-slate-400" : "text-slate-500"}`}>{labels[cur]}</span>
                      <span className={`text-[15px] md:text-base font-black tabular-nums ${bal < 0 ? "text-rose-500" : dk ? "text-violet-300" : "text-violet-700"}`}>{fmt(bal)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`group relative overflow-hidden rounded-2xl border p-4 md:p-5 transition-all duration-300 hover:shadow-xl hover:scale-[1.01] ${dk ? "border-cyan-400/25 bg-gradient-to-br from-cyan-900/30 to-slate-900/50" : "border-cyan-200 bg-gradient-to-br from-cyan-50 to-white"}`}>
              <div className={`absolute top-0 right-0 h-24 w-24 rounded-full blur-2xl opacity-10 ${dk ? "bg-cyan-400" : "bg-cyan-300"}`} />
              <div className="relative flex items-center gap-3 mb-3">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${dk ? "bg-cyan-400/15 text-cyan-300" : "bg-cyan-100 text-cyan-600"}`}><span className="text-xl">👥</span></span>
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
                  <div className={`mt-1 text-[9px] font-black ${debtorsCount > 0 ? (dk ? "text-rose-300/70" : "text-rose-600/70") : subText}`}>{debtorsCount > 0 ? "⚠️ دارای بدهی" : "✅ بدون بدهی"}</div>
                </div>
              </div>
            </div>
          </section>

          {/* فرمول حسابداری */}
          <div className={`safe-fade-in rounded-2xl border-2 px-5 py-4 md:py-5 ${dk ? "border-slate-700/70 bg-gradient-to-r from-slate-800/60 to-slate-900/60" : "border-slate-200 bg-gradient-to-r from-white to-slate-50"}`} style={{ animationDelay: "250ms" }}>
            <div className={`flex flex-wrap items-center justify-center gap-3 md:gap-4 text-[12px] md:text-[13px] font-black ${dk ? "text-slate-300" : "text-slate-600"}`}>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${dk ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/30" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"}`}>💰 صندوق</span>
              <span className="text-slate-400">=</span>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${dk ? "bg-violet-400/10 text-violet-300 ring-1 ring-violet-400/30" : "bg-violet-50 text-violet-700 ring-1 ring-violet-200"}`}>💼 حساب صرافی</span>
              <span className="text-slate-400">+</span>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${dk ? "bg-sky-400/10 text-sky-300 ring-1 ring-sky-400/30" : "bg-sky-50 text-sky-700 ring-1 ring-sky-200"}`}>💳 طلب مشتریان</span>
            </div>
          </div>

          {/* جدول وضعیت کلی سیستم */}
          <section className={`safe-fade-in rounded-2xl md:rounded-3xl border-2 overflow-hidden ${uiCard}`} style={{ animationDelay: "300ms" }}>
            <div className="flex items-center gap-3 p-4 md:p-5 pb-3 md:pb-4 md:px-7 md:pt-6">
              <div className={`grid h-11 w-11 md:h-12 md:w-12 place-items-center rounded-xl shadow-md ${dk ? "bg-gradient-to-br from-cyan-400 to-sky-500 text-slate-950" : "bg-gradient-to-br from-cyan-500 to-sky-500 text-white"}`}>
                <span className="text-xl">📋</span>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className={`cs-display text-xl md:text-2xl leading-none ${heading}`}>وضعیت کلی سیستم</h2>
                <p className={`mt-1 text-[11px] font-bold ${subText}`}>خلاصه تمام بخش‌های حساب‌ها به تفکیک ارز</p>
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
                        <td className="px-3 py-3 text-right"><span className={`font-bold ${dk ? "text-slate-200" : "text-slate-700"}`}>{labels[cur]}</span></td>
                        <td className={`px-3 py-3 text-center text-[13px] font-black tabular-nums ${cash < 0 ? "text-rose-500" : dk ? "text-emerald-300" : "text-emerald-700"}`}>{fmt(cash)}</td>
                        <td className={`px-3 py-3 text-center text-[13px] font-black tabular-nums ${deps > 0 ? (dk ? "text-sky-300" : "text-sky-700") : subText}`}>{fmt(deps)}</td>
                        <td className={`px-3 py-3 text-center text-[13px] font-black tabular-nums ${debts > 0 ? "text-rose-500" : subText}`}>{fmt(debts)}</td>
                        <td className={`px-3 py-3 text-center text-[13px] font-black tabular-nums ${equity < 0 ? "text-rose-500" : dk ? "text-violet-300" : "text-violet-700"}`}>{fmt(equity)}</td>
                        <td className={`px-3 py-3 text-center text-[13px] font-black tabular-nums ${comm > 0 ? (dk ? "text-amber-300" : "text-amber-700") : subText}`}>{fmt(comm)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* فوتر */}
          <div className={`safe-fade-in text-center py-4 text-[11px] font-bold ${subText}`} style={{ animationDelay: "350ms" }}>
            🏦 صرافی برادران نورزاد — هرات | سیستم هماهنگ‌سازی هوشمند فعال است
          </div>
        </div>
      </div>
    </div>
  );
}
