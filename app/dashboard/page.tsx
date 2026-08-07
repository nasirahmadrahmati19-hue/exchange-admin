"use client";

import { useCallback, useEffect, useState } from "react";

/* ==========================================================================
   انواع داده (Types)
   ========================================================================== */

type CurCode = "AFN" | "USD" | "IRT" | "EUR";

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
}

interface Trade {
  id?: string | number;
  amount: number;
  currency: string;
  afnValue: number;
  type?: string; // "deposit" | "withdraw" | "exchange" | "account-transfer"
  status?: string;
  date?: string;
  createdAt?: number;
  customer?: string;
  description?: string;
}

interface UserAccount {
  id?: string | number;
  name: string;
  balance?: number;
  balances?: { AFN?: number; USD?: number; IRR?: number };
  phone?: string;
  telegram?: string;
}

interface Rates {
  usd: string;
  eur: string;
  toman: string;
}

interface DashboardData {
  // مجموع حواله‌ها
  hawalaCount: number;
  hawalaVolume: number;
  hawalaTotals: Record<CurCode, number>;
  hawalaFee: number;
  
  // مجموع تبادل ارز
  tradeCount: number;
  tradeVolume: number;
  tradeTotals: Record<CurCode, number>;
  tradeProfit: number;
  
  // امروز
  todayHawalaCount: number;
  todayHawalaFee: number;
  todayTradeCount: number;
  todayTradeProfit: number;
  
  // موجودی کل سیستم
  accounts: { AFN: number; USD: number; IRR: number };
  
  // طلب‌ها
  totalDebt: number; // طلب مشتری از صرافی
  totalReceivable: number; // طلب صرافی از مشتری
  
  rates: Rates;
  commission: string;
  lastUpdated: Date | null;
}

const EMPTY_TOTALS: Record<CurCode, number> = { AFN: 0, USD: 0, IRT: 0, EUR: 0 };

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
  accounts: { AFN: 0, USD: 0, IRR: 0 },
  totalDebt: 0,
  totalReceivable: 0,
  rates: { usd: "70.5", eur: "76", toman: "0.64" },
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
};

const CUR_LABEL: Record<CurCode, string> = {
  AFN: "افغانی",
  USD: "دالر",
  IRT: "تومان",
  EUR: "یورو",
};

const CUR_SYMBOL: Record<CurCode, string> = {
  AFN: "؋",
  USD: "$",
  IRT: "﷼",
  EUR: "€",
};

function normalizeCur(name: string | undefined | null): CurCode | null {
  if (!name) return null;
  return CUR_ALIASES[name.trim()] ?? null;
}

function toAFN(amount: number, curCode: CurCode | null, rates: Rates): number {
  if (!curCode || !Number.isFinite(amount)) return 0;
  switch (curCode) {
    case "IRT":
      return (amount / 100) * Number(rates.toman || 0);
    case "USD":
      return amount * Number(rates.usd || 0);
    case "EUR":
      return amount * Number(rates.eur || 0);
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
    const { value: u, error: eU } = safeParse<UserAccount[]>("db_users", []);
    const { value: ratesRaw, error: eR } = safeParse<Partial<Rates>>("db_rates", {});
    const { value: settingsRaw, error: eS } = safeParse<{ commission?: string }>("db_settings", {});
    [eH, eT, eU, eR, eS].forEach((e) => e && collectedErrors.push(e));

    const rates: Rates = { ...EMPTY_DATA.rates, ...ratesRaw };
    const commission = settingsRaw.commission || EMPTY_DATA.commission;
    const commissionRate = Number(commission) / 100;

    const hawalaTotals: Record<CurCode, number> = { ...EMPTY_TOTALS };
    const tradeTotals: Record<CurCode, number> = { ...EMPTY_TOTALS };

    let hawalaVolume = 0, hawalaFee = 0;
    let tradeVolume = 0, tradeProfit = 0;
    let todayHawalaCount = 0, todayHawalaFee = 0;
    let todayTradeCount = 0, todayTradeProfit = 0;
    
    const todayStr = new Date().toLocaleDateString("fa-IR");

    // محاسبه حواله‌ها
    for (const x of h) {
      const amt = Number(x.amount || 0);
      const payCode = normalizeCur(x.payCur);
      const fee = Number(x.fee || 0);
      
      if (payCode) {
        hawalaTotals[payCode] += amt;
      }
      hawalaVolume += toAFN(amt, payCode, rates);
      hawalaFee += fee;
      
      // حواله‌های امروز
      if (x.date === todayStr) {
        todayHawalaCount++;
        todayHawalaFee += fee;
      }
    }

    // محاسبه تبادل ارز
    for (const x of t) {
      const amt = Number(x.amount || 0);
      const code = normalizeCur(x.currency);
      if (code) {
        tradeTotals[code] += amt;
      }
      const v = Number(x.afnValue || 0);
      tradeVolume += v;
      tradeProfit += v * commissionRate;
      
      // تبادل‌های امروز
      if (x.date === todayStr) {
        todayTradeCount++;
        todayTradeProfit += v * commissionRate;
      }
    }

    // محاسبه موجودی و طلب‌ها
    const accounts = { AFN: 0, USD: 0, IRR: 0 };
    let totalDebt = 0; // طلب مشتری از صرافی (موجودی مثبت)
    let totalReceivable = 0; // طلب صرافی از مشتری (موجودی منفی)
    
    for (const x of u) {
      const b = x.balances || { AFN: Number(x.balance || 0), USD: 0, IRR: 0 };
      const afnBalance = b.AFN || 0;
      const usdBalance = b.USD || 0;
      const irrBalance = b.IRR || 0;
      
      accounts.AFN += afnBalance;
      accounts.USD += usdBalance;
      accounts.IRR += irrBalance;
      
      // محاسبه طلب‌ها به افغانی
      const afnValue = afnBalance + 
                       (usdBalance * Number(rates.usd || 0)) + 
                       ((irrBalance / 100) * Number(rates.toman || 0));
      
      if (afnValue > 0) {
        totalDebt += afnValue; // مشتری از صرافی طلب دارد
      } else if (afnValue < 0) {
        totalReceivable += Math.abs(afnValue); // صرافی از مشتری طلب دارد
      }
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

  const fa = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString("fa-IR", { maximumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      {/* بنر نرخ روز */}
      <div className="rounded-2xl bg-gradient-to-l from-[#0b1f2e] to-[#16374d] text-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[#e3b45c] text-sm font-bold">صرافی و حواله‌جات برادران نورزاد</p>
            <h2 className="text-xl font-extrabold mt-1">هرات، افغانستان</h2>
          </div>
          {d.lastUpdated && (
            <p className="text-[11px] text-white/50">
              آخرین به‌روزرسانی: {d.lastUpdated.toLocaleTimeString("fa-IR")}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3 mt-4 text-sm">
          <span className="bg-white/10 rounded-xl px-4 py-2">دالر: <b className="text-[#e3b45c]">{d.rates.usd}</b> افغانی</span>
          <span className="bg-white/10 rounded-xl px-4 py-2">۱۰۰ تومان: <b className="text-[#e3b45c]">{d.rates.toman}</b> افغانی</span>
          <span className="bg-white/10 rounded-xl px-4 py-2">یورو: <b className="text-[#e3b45c]">{d.rates.eur}</b> افغانی</span>
        </div>
      </div>

      {/* خطاها */}
      {errors.length > 0 && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700">
          <p className="font-bold mb-1">برخی داده‌ها قابل خواندن نبودند:</p>
          <ul className="list-disc pr-5 space-y-0.5">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* سه کارت اصلی */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <KpiCard
          title="مجموع حواله‌جات"
          value={fa(d.hawalaCount) + " حواله"}
          sub={"حجم: " + fa(d.hawalaVolume) + " افغانی"}
          accent="emerald"
          totals={d.hawalaTotals}
          fa={fa}
          icon={<TransferIcon />}
        />
        <KpiCard
          title="مجموع تبادل ارز"
          value={fa(d.tradeCount) + " معامله"}
          sub={"حجم: " + fa(d.tradeVolume) + " افغانی"}
          accent="rose"
          totals={d.tradeTotals}
          fa={fa}
          icon={<ExchangeIcon />}
        />
        <KpiCard
          title="موجودی کل سیستم"
          value={null}
          sub="مجموع مانده همه مشتریان"
          accent="amber"
          totals={{ AFN: d.accounts.AFN, USD: d.accounts.USD, IRT: d.accounts.IRR, EUR: 0 }}
          fa={fa}
          icon={<VaultIcon />}
          hideZeroEUR
        />
      </div>

      {/* آمار امروز و طلب‌ها */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatChip 
          label="📊 حواله‌های امروز" 
          value={fa(d.todayHawalaCount)} 
          sub={"کمیشن: " + fa(d.todayHawalaFee) + " افغانی"}
          tone="emerald" 
        />
        <StatChip 
          label="📈 تبادل امروز" 
          value={fa(d.todayTradeCount)} 
          sub={"مفاد: " + fa(d.todayTradeProfit) + " افغانی"}
          tone="rose" 
        />
        <StatChip 
          label="💰 طلب مشتری از صرافی" 
          value={fa(d.totalDebt) + " افغانی"}
          tone="blue" 
        />
        <StatChip 
          label="💳 طلب صرافی از مشتری" 
          value={fa(d.totalReceivable) + " افغانی"}
          tone="amber" 
        />
      </div>

      {/* کمیشن کل و مفاد کل */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <StatChip 
          label="کمیشن کل حواله‌جات" 
          value={fa(d.hawalaFee) + " افغانی"}
          tone="slate" 
        />
        <StatChip 
          label="مفاد کل تبادل ارز" 
          value={fa(d.tradeProfit) + " افغانی"}
          tone="slate" 
          note={`کارمزد ${d.commission}٪`}
        />
      </div>
    </div>
  );
}

/* ==========================================================================
   کامپوننت‌های کمکی
   ========================================================================== */

const ACCENT_MAP: Record<string, string> = {
  emerald: "text-emerald-600",
  rose: "text-rose-600",
  amber: "text-[#c98f2d]",
};

function KpiCard({
  title, value, sub, accent, totals, fa, icon, hideZeroEUR,
}: {
  title: string;
  value: string | null;
  sub: string;
  accent: "emerald" | "rose" | "amber";
  totals: Record<CurCode, number>;
  fa: (n: number) => string;
  icon: React.ReactNode;
  hideZeroEUR?: boolean;
}) {
  const color = ACCENT_MAP[accent];
  const rows: { code: CurCode; label: string }[] = [
    { code: "AFN", label: "افغانی" },
    { code: "USD", label: "دالر" },
    { code: "IRT", label: "تومان" },
  ];
  if (!hideZeroEUR) rows.push({ code: "EUR", label: "یورو" });

  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-slate-600 font-bold">{title}</p>
        <span className={color}>{icon}</span>
      </div>
      {value && <p className="text-3xl font-extrabold text-slate-900 mt-1">{value}</p>}
      <div className={value ? "mt-5 space-y-2 text-sm" : "mt-3 space-y-2 text-sm"}>
        {rows.map((r) => (
          <div key={r.code} className="flex justify-between">
            <span className="text-slate-600">{r.label}</span>
            <span className={`${color} font-bold`}>{fa(totals[r.code] || 0)}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-400 mt-4">{sub}</p>
    </div>
  );
}

function StatChip({
  label, value, sub, tone, note,
}: { 
  label: string; 
  value: string | number; 
  sub?: string;
  tone: "slate" | "emerald" | "rose" | "amber" | "blue"; 
  note?: string 
}) {
  const toneMap = {
    slate: "bg-white border-slate-200 text-[#0b1f2e]",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-700",
    rose: "bg-rose-50 border-rose-100 text-rose-700",
    amber: "bg-amber-50 border-amber-100 text-amber-700",
    blue: "bg-blue-50 border-blue-100 text-blue-700",
  } as const;
  return (
    <div className={`rounded-2xl border p-5 ${toneMap[tone]}`}>
      <p className="text-xs mb-2 opacity-70">{label}</p>
      <p className="text-xl font-extrabold">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-70">{sub}</p>}
      {note && <p className="text-xs font-bold mt-1 text-[#c98f2d]">{note}</p>}
    </div>
  );
}

function TransferIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8" />
      <path d="M9 13l3 3 3-3" />
    </svg>
  );
}

function ExchangeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16V8" />
      <path d="M9 11l3-3 3 3" />
    </svg>
  );
}

function VaultIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
      <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <path d="M7 21h10" />
      <path d="M12 3v18" />
      <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
    </svg>
  );
}
