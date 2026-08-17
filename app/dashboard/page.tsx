"use client";

import { useCallback, useEffect, useState } from "react";
import {
  loadCustomers,
  loadTransactions,
  loadCashEntries,
  loadHawalas,
  loadRates,
  loadCommission,
  defaultRates,
  type Customer,
  type Transaction,
  type CashEntry,
  type Hawala,
  type Rates,
  type Currency,
} from "@/lib/defaultData";

type CurCode = "AFN" | "USD" | "EUR" | "IRR" | "PKR";

interface DashboardData {
  // معاملات
  tradeCount: number;
  tradeVolume: number;
  tradeTotals: Record<CurCode, number>;
  tradeProfit: number;
  todayTradeCount: number;
  todayTradeProfit: number;
  
  // حواله‌ها
  hawalaCount: number;
  hawalaVolume: number;
  hawalaTotals: Record<CurCode, number>;
  hawalaFee: number;
  todayHawalaCount: number;
  todayHawalaFee: number;
  pendingHawala: number;
  
  // صندوق و مشتریان
  accounts: Record<CurCode, number>;
  cashBoxBalance: Record<CurCode, number>;
  totalCustomerBalance: Record<CurCode, number>;
  totalDebt: number;
  totalReceivable: number;
  ownerEquity: number;
  withdrawableCommission: number;
  
  // سیستم
  customerCount: number;
  rates: Rates;
  commission: string;
  lastUpdated: Date | null;
  
  // آخرین معاملات
  recentTransactions: Transaction[];
}

const EMPTY_TOTALS: Record<CurCode, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };

const EMPTY_DATA: DashboardData = {
  tradeCount: 0,
  tradeVolume: 0,
  tradeTotals: { ...EMPTY_TOTALS },
  tradeProfit: 0,
  todayTradeCount: 0,
  todayTradeProfit: 0,
  hawalaCount: 0,
  hawalaVolume: 0,
  hawalaTotals: { ...EMPTY_TOTALS },
  hawalaFee: 0,
  todayHawalaCount: 0,
  todayHawalaFee: 0,
  pendingHawala: 0,
  accounts: { ...EMPTY_TOTALS },
  cashBoxBalance: { ...EMPTY_TOTALS },
  totalCustomerBalance: { ...EMPTY_TOTALS },
  totalDebt: 0,
  totalReceivable: 0,
  ownerEquity: 0,
  withdrawableCommission: 0,
  customerCount: 0,
  rates: defaultRates,
  commission: "0.5",
  lastUpdated: null,
  recentTransactions: [],
};

const PENDING_STATUSES = ["pending", "در انتظار", "در حال انتظار", "در حال ارسال", "معلق"];

const CURRENCY_LABELS: Record<CurCode, string> = {
  AFN: "افغانی",
  USD: "دالر",
  EUR: "یورو",
  IRR: "تومان",
  PKR: "کلدار",
};

const CURRENCY_FLAGS: Record<CurCode, string> = {
  AFN: "🇦🇫",
  USD: "🇺🇸",
  EUR: "🇪🇺",
  IRR: "🇮🇷",
  PKR: "🇵🇰",
};

function toAFN(amount: number, curCode: CurCode | null, rates: Rates): number {
  if (!curCode || !Number.isFinite(amount)) return 0;
  switch (curCode) {
    case "IRR":
      return (amount / 1000) * Number(rates.IRR || 0);
    case "USD":
      return amount * Number(rates.USD || 0);
    case "EUR":
      return amount * Number(rates.EUR || 0);
    case "PKR":
      return amount * Number(rates.PKR || 0);
    default:
      return amount;
  }
}

function isToday(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  const today = new Date().toISOString().split("T")[0];
  return dateStr.startsWith(today);
}

export default function DashboardPage() {
  const [d, setD] = useState<DashboardData>(EMPTY_DATA);
  const [errors, setErrors] = useState<string[]>([]);

  const load = useCallback(() => {
    const collectedErrors: string[] = [];

    try {
      const customers = loadCustomers();
      const transactions = loadTransactions();
      const cashEntries = loadCashEntries();
      const hawalas = loadHawalas();
      const rates = loadRates();
      const commissionRate = loadCommission() / 100;

      // محاسبات معاملات
      const tradeTotals: Record<CurCode, number> = { ...EMPTY_TOTALS };
      let tradeVolume = 0;
      let tradeProfit = 0;
      let todayTradeCount = 0;
      let todayTradeProfit = 0;

      for (const tx of transactions) {
        const amount = Number(tx.amount || 0);
        const cur = tx.currency as CurCode;
        
        if (cur in tradeTotals) {
          tradeTotals[cur] += amount;
        }
        
        const afnValue = toAFN(amount, cur, rates);
        tradeVolume += afnValue;
        tradeProfit += afnValue * commissionRate;

        if (isToday(tx.date)) {
          todayTradeCount++;
          todayTradeProfit += afnValue * commissionRate;
        }
      }

      // محاسبات حواله‌ها
      const hawalaTotals: Record<CurCode, number> = { ...EMPTY_TOTALS };
      let hawalaVolume = 0;
      let hawalaFee = 0;
      let todayHawalaCount = 0;
      let todayHawalaFee = 0;
      let pendingHawala = 0;

      for (const h of hawalas) {
        const amount = Number(h.amount || 0);
        const payCur = h.payCur as CurCode;
        const fee = Number(h.fee || 0);

        if (payCur in hawalaTotals) {
          hawalaTotals[payCur] += amount;
        }
        
        hawalaVolume += toAFN(amount, payCur, rates);
        hawalaFee += fee;

        if (isToday(h.date)) {
          todayHawalaCount++;
          todayHawalaFee += fee;
        }

        if (h.status && PENDING_STATUSES.includes(h.status)) {
          pendingHawala++;
        }
      }

      // محاسبات صندوق و مشتریان
      const cashBoxBalance: Record<CurCode, number> = { ...EMPTY_TOTALS };
      const totalCustomerBalance: Record<CurCode, number> = { ...EMPTY_TOTALS };
      let totalDebt = 0;
      let totalReceivable = 0;

      // محاسبه موجودی صندوق
      for (const entry of cashEntries) {
        const cur = entry.currency as CurCode;
        const amount = Number(entry.amount || 0);
        const type = entry.type;

        if (cur in cashBoxBalance) {
          if (type === "deposit" || type === "customer_withdraw" || type === "owner_withdraw") {
            cashBoxBalance[cur] += amount;
          } else if (type === "withdraw" || type === "customer_deposit" || type === "owner_deposit") {
            cashBoxBalance[cur] -= amount;
          }
        }
      }

      // محاسبه موجودی مشتریان
      for (const customer of customers) {
        const balances = customer.balances || {};
        for (const cur of Object.keys(balances) as CurCode[]) {
          const balance = Number(balances[cur] || 0);
          if (cur in totalCustomerBalance) {
            totalCustomerBalance[cur] += balance;
          }
        }

        // محاسبه بدهی/طلب بر اساس AFN
        const afnValue = 
          (balances.AFN || 0) +
          (balances.USD || 0) * Number(rates.USD || 0) +
          ((balances.IRR || 0) / 1000) * Number(rates.IRR || 0) +
          (balances.EUR || 0) * Number(rates.EUR || 0) +
          (balances.PKR || 0) * Number(rates.PKR || 0);

        if (afnValue > 0) {
          totalDebt += afnValue;
        } else if (afnValue < 0) {
          totalReceivable += Math.abs(afnValue);
        }
      }

      // محاسبه سرمایه خالص مالک و کارمزد قابل برداشت
      let ownerEquity = 0;
      let withdrawableCommission = 0;

      for (const cur of Object.keys(cashBoxBalance) as CurCode[]) {
        const cashAmount = cashBoxBalance[cur];
        const customerAmount = totalCustomerBalance[cur];
        const difference = cashAmount - customerAmount;
        
        ownerEquity += toAFN(difference, cur, rates);
      }

      // محاسبه کارمزد قابل برداشت (از fee معاملات)
      for (const tx of transactions) {
        const fee = Number(tx.fee || 0);
        if (fee > 0) {
          withdrawableCommission += fee;
        }
      }

      setD({
        tradeCount: transactions.length,
        tradeVolume,
        tradeTotals,
        tradeProfit,
        todayTradeCount,
        todayTradeProfit,
        hawalaCount: hawalas.length,
        hawalaVolume,
        hawalaTotals,
        hawalaFee,
        todayHawalaCount,
        todayHawalaFee,
        pendingHawala,
        accounts: cashBoxBalance,
        cashBoxBalance,
        totalCustomerBalance,
        totalDebt,
        totalReceivable,
        ownerEquity,
        withdrawableCommission,
        customerCount: customers.length,
        rates,
        commission: String(loadCommission()),
        lastUpdated: new Date(),
        recentTransactions: transactions.slice(-5).reverse(),
      });

      setErrors(collectedErrors);
    } catch (error) {
      collectedErrors.push(`خطا در بارگذاری داده‌ها: ${error}`);
      setErrors(collectedErrors);
    }
  }, []);

  useEffect(() => {
    load();
    const onStorage = () => load();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onStorage);
    const interval = setInterval(load, 15000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onStorage);
      clearInterval(interval);
    };
  }, [load]);

  const faNum = (n: number) => 
    (Number.isFinite(n) ? n : 0).toLocaleString("fa-IR", { 
      maximumFractionDigits: 0 
    });

  const faNumWithDecimals = (n: number) => 
    (Number.isFinite(n) ? n : 0).toLocaleString("fa-IR", { 
      maximumFractionDigits: 2 
    });

  return (
    <div className="space-y-6">
      {/* بنر اصلی - مدرن */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0b1f2e] via-[#16374d] to-[#1e4a6b] p-8 shadow-2xl">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#e3b45c] rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-400 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#e3b45c] to-[#c98f2d] flex items-center justify-center shadow-lg">
                  <span className="text-[#0b1f2e] text-2xl font-black">ن</span>
                </div>
                <div>
                  <p className="text-[#e3b45c] text-sm font-bold tracking-wider">صرافی و حواله‌جات</p>
                  <h2 className="text-white text-3xl font-extrabold">برادران نورزاد</h2>
                </div>
              </div>
              <p className="text-white/60 text-sm">هرات، افغانستان</p>
            </div>
            
            {d.lastUpdated && (
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/20">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <p className="text-white/80 text-xs font-medium">
                  {d.lastUpdated.toLocaleTimeString("fa-IR")}
                </p>
              </div>
            )}
          </div>

          {/* نرخ ارزها */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(Object.keys(CURRENCY_LABELS) as CurCode[]).map((cur) => (
              <CurrencyCard 
                key={cur}
                flag={CURRENCY_FLAGS[cur]}
                name={CURRENCY_LABELS[cur]}
                rate={faNumWithDecimals(Number(d.rates[cur] || 0))}
                color="from-blue-500/20 to-blue-600/20"
                borderColor="border-blue-400/30"
              />
            ))}
          </div>
        </div>
      </div>

      {/* خطاها */}
      {errors.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-r from-rose-50 to-red-50 border-2 border-rose-200 p-5 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
              <span className="text-rose-600 text-xl">⚠️</span>
            </div>
            <div>
              <p className="font-bold text-rose-900 mb-1">برخی داده‌ها قابل خواندن نبودند</p>
              <ul className="list-disc pr-5 space-y-0.5 text-sm text-rose-700">
                {errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickAction
          icon="💱"
          label="معامله جدید"
          href="/dashboard/trades"
          color="from-emerald-500 to-teal-600"
        />
        <QuickAction
          icon="💸"
          label="حواله جدید"
          href="/dashboard/hawalas"
          color="from-blue-500 to-indigo-600"
        />
        <QuickAction
          icon="👤"
          label="مشتری جدید"
          href="/dashboard/customers"
          color="from-purple-500 to-pink-600"
        />
        <QuickAction
          icon="💰"
          label="عملیات صندوق"
          href="/dashboard/cash"
          color="from-amber-500 to-orange-600"
        />
      </div>

      {/* سه کارت اصلی */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <KpiCard 
          title="حواله‌ها"
          value={faNum(d.hawalaCount)}
          sub={"حجم " + faNum(d.hawalaVolume)}
          totals={d.hawalaTotals}
          fa={faNum}
          icon="💸"
          gradient="from-blue-500 via-blue-600 to-indigo-700"
        />
        <KpiCard 
          title="تبادل ارز"
          value={faNum(d.tradeCount)}
          sub={"حجم " + faNum(d.tradeVolume)}
          totals={d.tradeTotals}
          fa={faNum}
          icon="💱"
          gradient="from-emerald-500 via-emerald-600 to-teal-700"
        />
        <KpiCard 
          title="مانده صندوق"
          value={null}
          sub="موجودی فیزیکی صندوق"
          totals={d.cashBoxBalance}
          fa={faNum}
          icon="🏦"
          gradient="from-amber-500 via-amber-600 to-orange-700"
        />
      </div>

      {/* کارت‌های آماری */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatChip 
          label="حواله امروز" 
          value={faNum(d.todayHawalaCount)} 
          sub={faNum(d.todayHawalaFee) + " کمیشن"} 
          icon="📊" 
          color="blue" 
        />
        <StatChip 
          label="تبادل امروز" 
          value={faNum(d.todayTradeCount)} 
          sub={faNum(d.todayTradeProfit) + " مفاد"} 
          icon="📈" 
          color="emerald" 
        />
        <StatChip 
          label="در انتظار" 
          value={faNum(d.pendingHawala)} 
          sub="حواله" 
          icon="⏳" 
          color="amber" 
        />
        <StatChip 
          label="طلب مشتری" 
          value={faNum(d.totalDebt)} 
          icon="💳" 
          color="purple" 
        />
        <StatChip 
          label="طلب صرافی" 
          value={faNum(d.totalReceivable)} 
          icon="🏛️" 
          color="rose" 
        />
      </div>

      {/* ردیف پایین - کارمزدها */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700 p-6 shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <span className="text-2xl">💰</span>
              </div>
              <div>
                <p className="text-white/80 text-sm font-bold">کمیشن کل حواله‌جات</p>
                <p className="text-white text-3xl font-black mt-1">{faNum(d.hawalaFee)}</p>
              </div>
            </div>
            <p className="text-white/60 text-xs">افغانی</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 p-6 shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <span className="text-2xl">📈</span>
              </div>
              <div>
                <p className="text-white/80 text-sm font-bold">مفاد کل تبادل ارز</p>
                <p className="text-white text-3xl font-black mt-1">{faNum(d.tradeProfit)}</p>
              </div>
            </div>
            <p className="text-white/90 text-xs font-bold bg-white/20 inline-block px-3 py-1 rounded-full">
              کارمزد {d.commission}٪
            </p>
          </div>
        </div>
      </div>

      {/* آخرین معاملات */}
      {d.recentTransactions.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">آخرین معاملات</h3>
            <a 
              href="/dashboard/trades"
              className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline"
            >
              مشاهده همه →
            </a>
          </div>
          <div className="space-y-3">
            {d.recentTransactions.map((tx, i) => (
              <TransactionRow key={i} tx={tx} fa={faNum} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   کامپوننت‌های کمکی
   ========================================================================== */

function CurrencyCard({ flag, name, rate, color, borderColor }: {
  flag: string;
  name: string;
  rate: string;
  color: string;
  borderColor: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${color} backdrop-blur-sm border ${borderColor} p-4 hover:scale-105 transition-transform cursor-pointer`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-3xl">{flag}</span>
      </div>
      <p className="text-white/70 text-sm font-bold mb-1">{name}</p>
      <p className="text-white text-xl font-black">{rate}</p>
      <p className="text-white/50 text-[10px] mt-1">افغانی</p>
    </div>
  );
}

function KpiCard({ title, value, sub, totals, fa, icon, gradient }: {
  title: string;
  value: string | null;
  sub: string;
  totals: Record<CurCode, number>;
  fa: (n: number) => string;
  icon: string;
  gradient: string;
}) {
  const rows: { code: CurCode; label: string; flag: string }[] = [
    { code: "AFN", label: "افغانی", flag: "🇦🇫" },
    { code: "USD", label: "دالر", flag: "🇺🇸" },
    { code: "IRR", label: "تومان", flag: "🇮🇷" },
    { code: "EUR", label: "یورو", flag: "🇪🇺" },
    { code: "PKR", label: "کلدار", flag: "🇵🇰" },
  ];

  return (
    <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${gradient} p-6 shadow-xl hover:shadow-2xl transition-shadow`}>
      <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -ml-16 -mb-16"></div>

      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
            <span className="text-3xl">{icon}</span>
          </div>
          <div>
            <p className="text-white text-lg font-extrabold">{title}</p>
            {value && <p className="text-white text-3xl font-black mt-1">{value}</p>}
          </div>
        </div>

        <div className="space-y-2 mt-6">
          {rows.map((r) => {
            const amount = totals[r.code] || 0;
            if (amount === 0) return null;
            return (
              <div key={r.code} className="flex justify-between items-center bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-white/20">
                <span className="text-white text-sm font-bold flex items-center gap-2">
                  <span className="text-lg">{r.flag}</span>
                  {r.label}
                </span>
                <span className="text-white font-bold">{fa(amount)}</span>
              </div>
            );
          })}
        </div>

        <p className="text-white/60 text-xs mt-4 text-center">{sub}</p>
      </div>
    </div>
  );
}

function StatChip({ label, value, sub, icon, color }: {
  label: string;
  value: string | number;
  sub?: string;
  icon: string;
  color: "blue" | "emerald" | "amber" | "purple" | "rose";
}) {
  const colorClasses = {
    blue: "from-blue-50 to-blue-100 border-blue-200 text-blue-900 dark:from-blue-900/20 dark:to-blue-800/20 dark:border-blue-700 dark:text-blue-100",
    emerald: "from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-900 dark:from-emerald-900/20 dark:to-emerald-800/20 dark:border-emerald-700 dark:text-emerald-100",
    amber: "from-amber-50 to-amber-100 border-amber-200 text-amber-900 dark:from-amber-900/20 dark:to-amber-800/20 dark:border-amber-700 dark:text-amber-100",
    purple: "from-purple-50 to-purple-100 border-purple-200 text-purple-900 dark:from-purple-900/20 dark:to-purple-800/20 dark:border-purple-700 dark:text-purple-100",
    rose: "from-rose-50 to-rose-100 border-rose-200 text-rose-900 dark:from-rose-900/20 dark:to-rose-800/20 dark:border-rose-700 dark:text-rose-100",
  };

  const iconBgClasses = {
    blue: "bg-blue-500/20 text-blue-600 dark:bg-blue-500/30",
    emerald: "bg-emerald-500/20 text-emerald-600 dark:bg-emerald-500/30",
    amber: "bg-amber-500/20 text-amber-600 dark:bg-amber-500/30",
    purple: "bg-purple-500/20 text-purple-600 dark:bg-purple-500/30",
    rose: "bg-rose-500/20 text-rose-600 dark:bg-rose-500/30",
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${colorClasses[color]} border-2 p-5 shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-12 h-12 rounded-xl ${iconBgClasses[color]} flex items-center justify-center`}>
          <span className="text-2xl">{icon}</span>
        </div>
      </div>
      <p className="text-sm font-extrabold mb-1">{label}</p>
      <p className="text-2xl font-black mb-1">{value}</p>
      {sub && <p className="text-xs opacity-60">{sub}</p>}
    </div>
  );
}

function QuickAction({ icon, label, href, color }: {
  icon: string;
  label: string;
  href: string;
  color: string;
}) {
  return (
    <a
      href={href}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${color} p-5 shadow-lg hover:shadow-xl transition-all hover:scale-105 cursor-pointer group`}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
      <div className="relative z-10 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
          <span className="text-2xl">{icon}</span>
        </div>
        <div>
          <p className="text-white font-bold">{label}</p>
        </div>
      </div>
    </a>
  );
}

function TransactionRow({ tx, fa }: { tx: Transaction; fa: (n: number) => string }) {
  const cur = tx.currency as CurCode;
  const flag = CURRENCY_FLAGS[cur] || "💱";
  const curLabel = CURRENCY_LABELS[cur] || tx.currency;

  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <span className="text-xl">{flag}</span>
        </div>
        <div>
          <p className="font-bold text-gray-900 dark:text-white">
            {tx.type === "exchange" ? "تبادل" : tx.type === "transfer" ? "انتقال" : "تبدیل"}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {tx.trackingCode || "بدون کد"}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-bold text-gray-900 dark:text-white">
          {fa(Number(tx.amount || 0))} {curLabel}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {tx.date || "بدون تاریخ"}
        </p>
      </div>
    </div>
  );
}
