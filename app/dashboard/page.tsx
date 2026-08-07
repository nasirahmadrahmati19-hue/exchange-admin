"use client";

import { useCallback, useEffect, useState } from "react";
import {
  loadRates,
  loadCommission,
  defaultRates,
  fa,
  type Rates,
  type AccountUser,
} from "./lib/helpers";

type CurCode = "AFN" | "USD" | "IRT" | "EUR" | "PKR";

interface Hawala {
  id: string | number;
  amount: number;
  payCur: string;
  getCur: string;
  result: number;
  fee?: number;
  status?: string;
  date?: string;
  createdAt?: number;
  sender?: string;
  receiver?: string;
  fromCity?: string;
  toCity?: string;
  manualRate?: string;
}

interface Trade {
  id?: string | number;
  amount: number;
  currency: string;
  afnValue: number;
  type?: string;
  status?: string;
  date?: string;
  createdAt?: number;
  customer?: string;
  description?: string;
  manualRate?: string;
}

interface DashboardData {
  hawalaCount: number;
  hawalaVolume: number;
  hawalaTotals: Record<CurCode, number>;
  hawalaFee: number;
  tradeCount: number;
  tradeVolume: number;
  tradeTotals: Record<CurCode, number>;
  tradeProfit: number;
  todayHawalaCount: number;
  todayHawalaFee: number;
  todayTradeCount: number;
  todayTradeProfit: number;
  accounts: { AFN: number; USD: number; IRR: number; EUR: number; PKR: number };
  totalDebt: number;
  totalReceivable: number;
  pendingHawala: number;
  rates: Rates;
  commission: string;
  lastUpdated: Date | null;
}

const EMPTY_TOTALS: Record<CurCode, number> = { AFN: 0, USD: 0, IRT: 0, EUR: 0, PKR: 0 };

const EMPTY_DATA: DashboardData = {
  hawalaCount: 0,
  hawalaVolume: 0,
  hawalaTotals: { ...EMPTY_TOTALS },
  hawalaFee: 0,
  tradeCount: 0,
  tradeVolume: 0,
  tradeTotals: { ...EMPTY_TOTALS },
  tradeProfit: 0,
  todayHawalaCount: 0,
  todayHawalaFee: 0,
  todayTradeCount: 0,
  todayTradeProfit: 0,
  accounts: { AFN: 0, USD: 0, IRR: 0, EUR: 0, PKR: 0 },
  totalDebt: 0,
  totalReceivable: 0,
  pendingHawala: 0,
  rates: defaultRates,
  commission: "0.5",
  lastUpdated: null,
};

const PENDING_STATUSES = ["در انتظار", "در حال انتظار", "در حال ارسال", "معلق"];

const CUR_ALIASES: Record<string, CurCode> = {
  "افغانی": "AFN",
  "افغانی ": "AFN",
  "دلار": "USD",
  "دالر": "USD",
  "تومان": "IRT",
  "یورو": "EUR",
  "کلدار": "PKR",
};

function normalizeCur(name: string | undefined | null): CurCode | null {
  if (!name) return null;
  return CUR_ALIASES[name.trim()] ?? null;
}

function toAFN(amount: number, curCode: CurCode | null, rates: Rates): number {
  if (!curCode || !Number.isFinite(amount)) return 0;
  switch (curCode) {
    case "IRT":
      return (amount / 1000) * Number(rates.toman || 0);
    case "USD":
      return amount * Number(rates.usd || 0);
    case "EUR":
      return amount * Number(rates.eur || 0);
    case "PKR":
      return amount * Number(rates.pkr || 0);
    default:
      return amount;
  }
}

function safeParse<T>(key: string, fallback: T): { value: T; error: string | null } {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { value: fallback, error: null };
    return { value: JSON.parse(raw) as T, error: null };
  } catch {
    return { value: fallback, error: `داده ${key} در حافظه محلی خراب است.` };
  }
}

export default function DashboardPage() {
  const [d, setD] = useState<DashboardData>(EMPTY_DATA);
  const [errors, setErrors] = useState<string[]>([]);

  const load = useCallback(() => {
    const collectedErrors: string[] = [];

    const { value: h, error: eH } = safeParse<Hawala[]>("db_hawala", []);
    const { value: t, error: eT } = safeParse<Trade[]>("db_trades", []);
    const { value: u, error: eU } = safeParse<AccountUser[]>("db_users", []);
    const rates = loadRates();
    const commission = loadCommission();

    const { value: settingsRaw, error: eS } = safeParse<{ commission?: string }>("db_settings", {});
    [eH, eT, eU, eS].forEach((e) => e && collectedErrors.push(e));

    const commissionRate = Number(commission) / 100;

    const hawalaTotals: Record<CurCode, number> = { ...EMPTY_TOTALS };
    const tradeTotals: Record<CurCode, number> = { ...EMPTY_TOTALS };

    let hawalaVolume = 0, hawalaFee = 0;
    let tradeVolume = 0, tradeProfit = 0;
    let todayHawalaCount = 0, todayHawalaFee = 0;
    let todayTradeCount = 0, todayTradeProfit = 0;
    let pendingHawala = 0;

    const todayStr = new Date().toLocaleDateString("fa-IR");

    for (const x of h) {
      const amt = Number(x.amount || 0);
      const payCode = normalizeCur(x.payCur);
      const fee = Number(x.fee || 0);

      if (payCode) hawalaTotals[payCode] += amt;
      hawalaVolume += toAFN(amt, payCode, rates);
      hawalaFee += fee;

      if (x.date === todayStr) {
        todayHawalaCount++;
        todayHawalaFee += fee;
      }

      if (x.status && PENDING_STATUSES.includes(x.status)) pendingHawala++;
    }

    for (const x of t) {
      const amt = Number(x.amount || 0);
      const code = normalizeCur(x.currency);
      if (code) tradeTotals[code] += amt;
      const v = Number(x.afnValue || 0);
      tradeVolume += v;
      tradeProfit += v * commissionRate;

      if (x.date === todayStr) {
        todayTradeCount++;
        todayTradeProfit += v * commissionRate;
      }
    }

    const accounts = { AFN: 0, USD: 0, IRR: 0, EUR: 0, PKR: 0 };
    let totalDebt = 0;
    let totalReceivable = 0;

    for (const x of u) {
      const b = x.balances || { AFN: 0, USD: 0, IRR: 0, EUR: 0, PKR: 0 };
      const afnBalance = b.AFN || 0;
      const usdBalance = b.USD || 0;
      const irrBalance = b.IRR || 0;
      const eurBalance = b.EUR || 0;
      const pkrBalance = b.PKR || 0;

      accounts.AFN += afnBalance;
      accounts.USD += usdBalance;
      accounts.IRR += irrBalance;
      accounts.EUR += eurBalance;
      accounts.PKR += pkrBalance;

      const afnValue = afnBalance +
                       (usdBalance * Number(rates.usd || 0)) +
                       ((irrBalance / 1000) * Number(rates.toman || 0)) +
                       (eurBalance * Number(rates.eur || 0)) +
                       (pkrBalance * Number(rates.pkr || 0));

      if (afnValue > 0) totalDebt += afnValue;
      else if (afnValue < 0) totalReceivable += Math.abs(afnValue);
    }

    setD({
      hawalaCount: h.length,
      hawalaVolume,
      hawalaTotals,
      hawalaFee,
      tradeCount: t.length,
      tradeVolume,
      tradeTotals,
      tradeProfit,
      todayHawalaCount,
      todayHawalaFee,
      todayTradeCount,
      todayTradeProfit,
      accounts,
      totalDebt,
      totalReceivable,
      pendingHawala,
      rates,
      commission,
      lastUpdated: new Date(),
    });
    setErrors(collectedErrors);
  }, []);

  useEffect(() => {
    load();
    const onStorage = () => load();
    const onCustom = () => load();
    window.addEventListener("storage", onStorage);
    window.addEventListener("db:updated", onCustom);
    const interval = setInterval(load, 15000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("db:updated", onCustom);
      clearInterval(interval);
    };
  }, [load]);

  const faNum = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString("fa-IR", { maximumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      {/* بنر نرخ روز - مدرن */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0b1f2e] via-[#16374d] to-[#1e4a6b] p-8 shadow-2xl">
        {/* Background decorations */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#e3b45c] rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-400 rounded-full blur-3xl"></div>
        </div>
        
        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#e3b45c] to-[#c98f2d] flex items-center justify-center shadow-lg">
                  <span className="text-[#0b1f2e] text-2xl font-black">ن</span>
                </div>
                <div>
                  <p className="text-[#e3b45c] text-xs font-bold tracking-wider uppercase">صرافی و حواله‌جات</p>
                  <h2 className="text-white text-2xl font-black">برادران نورزاد</h2>
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

          {/* نرخ ارزها - ۵ کارت شفاف */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <CurrencyCard flag="🇦🇫" name="افغانی" rate="۱.۰۰" color="from-blue-500/20 to-blue-600/20" borderColor="border-blue-400/30" />
            <CurrencyCard flag="🇺🇸" name="دلار" rate={d.rates.usd} color="from-emerald-500/20 to-emerald-600/20" borderColor="border-emerald-400/30" />
            <CurrencyCard flag="🇪🇺" name="یورو" rate={d.rates.eur} color="from-purple-500/20 to-purple-600/20" borderColor="border-purple-400/30" />
            <CurrencyCard flag="🇵🇰" name="کلدار" rate={d.rates.pkr} color="from-amber-500/20 to-amber-600/20" borderColor="border-amber-400/30" />
            <CurrencyCard flag="🇮🇷" name="تومان" rate={d.rates.toman} color="from-rose-500/20 to-rose-600/20" borderColor="border-rose-400/30" />
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
                {errors.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}

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
          title="مانده سیستم"
          value={null}
          sub="مجموع مانده مشتریان"
          totals={{ AFN: d.accounts.AFN, USD: d.accounts.USD, IRT: d.accounts.IRR, EUR: d.accounts.EUR, PKR: d.accounts.PKR }}
          fa={faNum}
          icon="⚖️"
          gradient="from-amber-500 via-amber-600 to-orange-700"
        />
      </div>

      {/* کارت‌های آماری */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatChip label="حواله امروز" value={faNum(d.todayHawalaCount)} sub={faNum(d.todayHawalaFee) + " کمیشن"} icon="📊" color="blue" />
        <StatChip label="تبادل امروز" value={faNum(d.todayTradeCount)} sub={faNum(d.todayTradeProfit) + " مفاد"} icon="📈" color="emerald" />
        <StatChip label="در انتظار" value={faNum(d.pendingHawala)} sub="حواله" icon="⏱️" color="amber" />
        <StatChip label="طلب مشتری" value={faNum(d.totalDebt)} icon="💳" color="purple" />
        <StatChip label="طلب صرافی" value={faNum(d.totalReceivable)} icon="🏦" color="rose" />
      </div>

      {/* ردیف پایین */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700 p-6 shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <span className="text-2xl">💰</span>
              </div>
              <div>
                <p className="text-white/80 text-xs font-medium">کمیشن کل حواله‌جات</p>
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
                <p className="text-white/80 text-xs font-medium">مفاد کل تبادل ارز</p>
                <p className="text-white text-3xl font-black mt-1">{faNum(d.tradeProfit)}</p>
              </div>
            </div>
            <p className="text-white/90 text-xs font-bold bg-white/20 inline-block px-3 py-1 rounded-full">
              کارمزد {d.commission}٪
            </p>
          </div>
        </div>
      </div>
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
      <p className="text-white/70 text-xs font-medium mb-1">{name}</p>
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
    { code: "IRT", label: "تومان", flag: "🇮🇷" },
    { code: "EUR", label: "یورو", flag: "🇪🇺" },
    { code: "PKR", label: "کلدار", flag: "🇵🇰" },
  ];

  return (
    <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${gradient} p-6 shadow-xl hover:shadow-2xl transition-shadow`}>
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -ml-16 -mb-16"></div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
            <span className="text-3xl">{icon}</span>
          </div>
          <div>
            <p className="text-white/80 text-xs font-medium">{title}</p>
            {value && <p className="text-white text-3xl font-black mt-1">{value}</p>}
          </div>
        </div>

        {/* Totals */}
        <div className="space-y-2 mt-6">
          {rows.map((r) => {
            const amount = totals[r.code] || 0;
            if (amount === 0) return null;
            return (
              <div key={r.code} className="flex justify-between items-center bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-white/20">
                <span className="text-white/90 text-sm font-medium flex items-center gap-2">
                  <span className="text-lg">{r.flag}</span>
                  {r.label}
                </span>
                <span className="text-white font-bold">{fa(amount)}</span>
              </div>
            );
          })}
        </div>

        {/* Subtitle */}
        <p className="text-white/60 text-xs mt-4 text-center">{sub}</p>
      </div>
    </div>
  );
}

function StatChip({ label, value, sub, note, icon, color }: {
  label: string;
  value: string | number;
  sub?: string;
  note?: string;
  icon: string;
  color: "blue" | "emerald" | "amber" | "purple" | "rose";
}) {
  const colorClasses = {
    blue: "from-blue-50 to-blue-100 border-blue-200 text-blue-900",
    emerald: "from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-900",
    amber: "from-amber-50 to-amber-100 border-amber-200 text-amber-900",
    purple: "from-purple-50 to-purple-100 border-purple-200 text-purple-900",
    rose: "from-rose-50 to-rose-100 border-rose-200 text-rose-900",
  };

  const iconBgClasses = {
    blue: "bg-blue-500/20 text-blue-600",
    emerald: "bg-emerald-500/20 text-emerald-600",
    amber: "bg-amber-500/20 text-amber-600",
    purple: "bg-purple-500/20 text-purple-600",
    rose: "bg-rose-500/20 text-rose-600",
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${colorClasses[color]} border-2 p-5 shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-12 h-12 rounded-xl ${iconBgClasses[color]} flex items-center justify-center`}>
          <span className="text-2xl">{icon}</span>
        </div>
      </div>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-black mb-1">{value}</p>
      {sub && <p className="text-xs opacity-60">{sub}</p>}
      {note && <p className="text-xs font-bold mt-2 text-[#c98f2d]">{note}</p>}
    </div>
  );
}
