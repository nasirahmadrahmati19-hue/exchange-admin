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
      {/* بنر نرخ روز */}
      <div className="rounded-2xl bg-[#0b1f2e] text-white p-6 shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[#e3b45c] text-sm font-bold tracking-wide">صرافی و حواله‌جات برادران نورزاد</p>
            <h2 className="text-xl font-extrabold mt-1">هرات، افغانستان</h2>
          </div>
          {d.lastUpdated && (
            <p className="text-[11px] text-white/40 font-light">
              {d.lastUpdated.toLocaleTimeString("fa-IR")}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-4 mt-4 text-sm">
          <span className="bg-white/5 rounded-xl px-4 py-2 border border-white/5">🇺🇸 دلار <b className="text-[#e3b45c]">{d.rates.usd}</b></span>
          <span className="bg-white/5 rounded-xl px-4 py-2 border border-white/5">🇪🇺 یورو <b className="text-[#e3b45c]">{d.rates.eur}</b></span>
          <span className="bg-white/5 rounded-xl px-4 py-2 border border-white/5">🇵🇰 کلدار <b className="text-[#e3b45c]">{d.rates.pkr}</b></span>
          <span className="bg-white/5 rounded-xl px-4 py-2 border border-white/5">🇮🇷 تومان <b className="text-[#e3b45c]">{d.rates.toman}</b></span>
        </div>
      </div>

      {/* خطاها */}
      {errors.length > 0 && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700">
          <p className="font-bold mb-1">⚠️ برخی داده‌ها قابل خواندن نبودند:</p>
          <ul className="list-disc pr-5 space-y-0.5">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
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
        />
        <KpiCard
          title="تبادل ارز"
          value={faNum(d.tradeCount)}
          sub={"حجم " + faNum(d.tradeVolume)}
          totals={d.tradeTotals}
          fa={faNum}
        />
        <KpiCard
          title="مانده سیستم"
          value={null}
          sub="مجموع مانده مشتریان"
          totals={{ AFN: d.accounts.AFN, USD: d.accounts.USD, IRT: d.accounts.IRR, EUR: d.accounts.EUR, PKR: d.accounts.PKR }}
          fa={faNum}
        />
      </div>

      {/* کارت‌های آماری */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatChip label="امروز" value={faNum(d.todayHawalaCount)} sub={faNum(d.todayHawalaFee) + " کمیشن"} />
        <StatChip label="تبادل امروز" value={faNum(d.todayTradeCount)} sub={faNum(d.todayTradeProfit) + " مفاد"} />
        <StatChip label="در انتظار" value={faNum(d.pendingHawala)} sub="حواله" />
        <StatChip label="طلب مشتری" value={faNum(d.totalDebt)} />
        <StatChip label="طلب صرافی" value={faNum(d.totalReceivable)} />
      </div>

      {/* ردیف پایین */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <StatChip label="کمیشن کل" value={faNum(d.hawalaFee)} />
        <StatChip label="مفاد کل" value={faNum(d.tradeProfit)} note={`کارمزد ${d.commission}٪`} />
      </div>
    </div>
  );
}

/* ==========================================================================
   کامپوننت‌های کمکی
   ========================================================================== */

function KpiCard({
  title, value, sub, totals, fa,
}: {
  title: string;
  value: string | null;
  sub: string;
  totals: Record<CurCode, number>;
  fa: (n: number) => string;
}) {
  const rows: { code: CurCode; label: string }[] = [
    { code: "AFN", label: "افغانی" },
    { code: "USD", label: "دالر" },
    { code: "IRT", label: "تومان" },
    { code: "EUR", label: "یورو" },
    { code: "PKR", label: "کلدار" },
  ];

  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-6 shadow-sm">
      <p className="text-slate-600 font-bold text-sm">{title}</p>
      {value && <p className="text-3xl font-extrabold text-slate-900 mt-1">{value}</p>}
      <div className={value ? "mt-5 space-y-2 text-sm" : "mt-3 space-y-2 text-sm"}>
        {rows.map((r) => (
          <div key={r.code} className="flex justify-between border-b border-slate-50 pb-1 last:border-0">
            <span className="text-slate-500">{r.label}</span>
            <span className="font-bold text-slate-700">{fa(totals[r.code] || 0)}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-400 mt-4">{sub}</p>
    </div>
  );
}

function StatChip({
  label, value, sub, note,
}: {
  label: string;
  value: string | number;
  sub?: string;
  note?: string;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-5 shadow-sm">
      <p className="text-xs text-slate-400 font-medium">{label}</p>
      <p className="text-2xl font-extrabold text-slate-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      {note && <p className="text-xs font-bold mt-1 text-[#c98f2d]">{note}</p>}
    </div>
  );
}
