"use client";

import { useCallback, useEffect, useState } from "react";

/* ==========================================================================
   انواع داده (Types)
   ========================================================================== */

type CurCode = "AFN" | "USD" | "IRT" | "EUR"; // افغانی، دالر، تومان، یورو

interface Hawala {
  id: string | number;
  amount: number;
  payCur: string;
  getCur: string;
  result: number;
  fee?: number;
  status?: string;
  date?: string;      // تاریخ نمایشی (fa-IR)
  createdAt?: number;  // timestamp (اختیاری، برای مرتب‌سازی دقیق)
  sender?: string;
  receiver?: string;
  fromCity?: string;
  toCity?: string;
}

interface Trade {
  amount: number;
  currency: string;
  afnValue: number;
}

interface UserAccount {
  balance?: number;
  balances?: { AFN?: number; USD?: number; IRR?: number };
}

interface Rates {
  usd: string;
  eur: string;
  toman: string; // نرخ به ازای هر ۱۰۰ تومان
}

interface DashboardData {
  hawalaCount: number;
  hawalaVolume: number;
  hawalaTotals: Record<CurCode, number>;
  tradeCount: number;
  tradeVolume: number;
  tradeTotals: Record<CurCode, number>;
  turnover: Record<CurCode, number>; // حواله + تبادل
  accounts: { AFN: number; USD: number; IRR: number };
  totalFee: number;
  tradeProfit: number;
  pending: number;
  today: number;
  rates: Rates;
  commission: string;
  latest: Hawala[];
  lastUpdated: Date | null;
}

const EMPTY_TOTALS: Record<CurCode, number> = { AFN: 0, USD: 0, IRT: 0, EUR: 0 };

const EMPTY_DATA: DashboardData = {
  hawalaCount: 0,
  hawalaVolume: 0,
  hawalaTotals: { ...EMPTY_TOTALS },
  tradeCount: 0,
  tradeVolume: 0,
  tradeTotals: { ...EMPTY_TOTALS },
  turnover: { ...EMPTY_TOTALS },
  accounts: { AFN: 0, USD: 0, IRR: 0 },
  totalFee: 0,
  tradeProfit: 0,
  pending: 0,
  today: 0,
  rates: { usd: "70.5", eur: "76", toman: "0.64" },
  commission: "0.5",
  latest: [],
  lastUpdated: null,
};

const PENDING_STATUSES = ["در انتظار", "در حال انتظار", "در حال ارسال", "معلق"];

/* ==========================================================================
   نگاشت املاهای مختلف نام ارز به یک کد یکتا
   قبلاً «دالر» و «دلار» به‌صورت ناسازگار چک می‌شدند و باعث گم شدن بی‌صدای
   مبالغ در جمع «گردش به تفکیک ارز» می‌شدند. اینجا همه‌چیز یک‌بار نرمال می‌شود.
   ========================================================================== */
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

function normalizeCur(name: string | undefined | null): CurCode | null {
  if (!name) return null;
  return CUR_ALIASES[name.trim()] ?? null;
}

/* ==========================================================================
   تبدیل مبلغ به افغانی
   نکته‌ی مهم: نرخ تومان در این سیستم به‌ازای هر «۱۰۰ تومان» ثبت می‌شود
   (همان‌طور که در بنر نرخ روز نمایش داده می‌شود). نسخه‌ی قبلی کد به اشتباه
   بر ۱۰۰۰ تقسیم می‌کرد که حجم معاملات تومانی را ۱۰ برابر کمتر محاسبه می‌کرد.
   ========================================================================== */
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
    return { value: fallback, error: `داده «${key}» در حافظه محلی خراب است و نادیده گرفته شد.` };
  }
}

/** جدیدترین حواله‌ها را برمی‌گرداند؛ در صورت وجود createdAt دقیق مرتب می‌کند،
 *  در غیر این صورت فرض می‌شود آخرین آیتم‌های آرایه جدیدترین‌اند. */
function getLatest(hawala: Hawala[], count: number): Hawala[] {
  const hasTimestamps = hawala.some((h) => typeof h.createdAt === "number");
  const sorted = hasTimestamps
    ? [...hawala].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    : [...hawala].reverse();
  return sorted.slice(0, count);
}

/* ==========================================================================
   کامپوننت اصلی
   ========================================================================== */

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
    const turnover: Record<CurCode, number> = { ...EMPTY_TOTALS };

    let hawalaVolume = 0, totalFee = 0, pending = 0, today = 0;
    const todayStr = new Date().toLocaleDateString("fa-IR");

    for (const x of h) {
      const amt = Number(x.amount || 0);
      const payCode = normalizeCur(x.payCur);
      const getCode = normalizeCur(x.getCur);

      if (payCode) {
        hawalaTotals[payCode] += amt;
        turnover[payCode] += amt;
      }
      hawalaVolume += toAFN(amt, payCode, rates);
      totalFee += Number(x.fee || 0);
      if (getCode) turnover[getCode] += Number(x.result || 0);

      if (x.status && PENDING_STATUSES.includes(x.status)) pending++;
      if (x.date === todayStr) today++;
    }

    let tradeVolume = 0, tradeProfit = 0;
    for (const x of t) {
      const amt = Number(x.amount || 0);
      const code = normalizeCur(x.currency);
      if (code) {
        tradeTotals[code] += amt;
        turnover[code] += amt;
      }
      const v = Number(x.afnValue || 0);
      tradeVolume += v;
      tradeProfit += v * commissionRate;
    }

    const accounts = { AFN: 0, USD: 0, IRR: 0 };
    for (const x of u) {
      const b = x.balances || { AFN: Number(x.balance || 0), USD: 0, IRR: 0 };
      accounts.AFN += b.AFN || 0;
      accounts.USD += b.USD || 0;
      accounts.IRR += b.IRR || 0;
    }

    setD({
      hawalaCount: h.length,
      hawalaVolume,
      hawalaTotals,
      tradeCount: t.length,
      tradeVolume,
      tradeTotals,
      turnover,
      accounts,
      totalFee,
      tradeProfit,
      pending,
      today,
      rates,
      commission,
      latest: getLatest(h, 4),
      lastUpdated: new Date(),
    });
    setErrors(collectedErrors);
  }, []);

  useEffect(() => {
    load();
    // به‌روزرسانی خودکار: هنگام تغییر در همین تب (رویداد سفارشی) و تب‌های دیگر (storage)
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

  const turnoverCards: { code: CurCode; symbol: string; color: string }[] = [
    { code: "AFN", symbol: "؋", color: "from-emerald-500 to-teal-600" },
    { code: "USD", symbol: "$", color: "from-blue-500 to-indigo-600" },
    { code: "IRT", symbol: "﷼", color: "from-amber-500 to-orange-600" },
    { code: "EUR", symbol: "€", color: "from-purple-500 to-fuchsia-600" },
  ];

  return (
    <div className="space-y-8">
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

      {/* هشدار خرابی داده — قبلاً این خطاها بی‌صدا نادیده گرفته می‌شدند */}
      {errors.length > 0 && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700">
          <p className="font-bold mb-1">برخی داده‌ها قابل خواندن نبودند:</p>
          <ul className="list-disc pr-5 space-y-0.5">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* سه کارت اصلی — شامل تعداد، حجم و تفکیک ارز، بدون تکرار در جای دیگر */}
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
          title="مانده کل سیستم"
          value={null}
          sub="مجموع مانده همه مشتریان"
          accent="amber"
          totals={{ AFN: d.accounts.AFN, USD: d.accounts.USD, IRT: d.accounts.IRR, EUR: 0 }}
          fa={fa}
          icon={<VaultIcon />}
          hideZeroEUR
        />
      </div>

      {/* ردیف شاخص‌های کسب‌وکار — کمیشن، مفاد، وضعیت امروز؛ بدون تکرار تعداد/حجم بالا */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatChip label="کمیشن حواله‌جات" value={fa(d.totalFee) + " افغانی"} tone="slate" />
        <StatChip label="مفاد تبادل ارز" value={fa(d.tradeProfit) + " افغانی"} tone="slate" note={`کارمزد ${d.commission}٪`} />
        <StatChip label="حواله‌های امروز" value={fa(d.today)} tone="amber" />
        <StatChip label="در انتظار ارسال" value={fa(d.pending)} tone="blue" />
      </div>

      {/* گردش به تفکیک ارز (حواله + تبادل) */}
      <div>
        <h3 className="font-extrabold mb-4">مجموع گردش به تفکیک ارز (حواله + تبادل)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {turnoverCards.map((c) => (
            <div key={c.code} className={`rounded-2xl bg-gradient-to-br ${c.color} p-5 text-white shadow-lg`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold opacity-90">{CUR_LABEL[c.code]}</span>
                <span className="text-2xl font-extrabold opacity-80">{c.symbol}</span>
              </div>
              <p className="text-2xl font-extrabold mt-3">{fa(d.turnover[c.code] || 0)}</p>
              <p className="text-[11px] opacity-80 mt-1">مجموع حواله + تبادل</p>
            </div>
          ))}
        </div>
      </div>

      {/* آخرین حواله‌ها */}
      <div className="card p-6">
        <h3 className="font-extrabold mb-6">آخرین حواله‌ها</h3>
        {d.latest.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">هنوز حواله‌ای ثبت نشده است</p>
        ) : (
          <div className="space-y-3">
            {d.latest.map((h) => (
              <div key={h.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0b1f2e] text-[#e3b45c] flex items-center justify-center font-bold text-sm shrink-0">
                    {h.sender ? h.sender.charAt(0) : "-"}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{h.sender} ← {h.receiver}</p>
                    <p className="text-xs text-slate-500">{h.fromCity} به {h.toCity}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-[#c98f2d]">
                    {Number(h.result || 0).toLocaleString("fa-IR")} {h.getCur}
                  </p>
                  <p className="text-xs text-slate-500">{h.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   کامپوننت‌های کمکی — برای حذف تکرار سه‌بارهٔ JSX کارت‌های ارزی
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
  label, value, tone, note,
}: { label: string; value: string | number; tone: "slate" | "amber" | "blue"; note?: string }) {
  const toneMap = {
    slate: "bg-white border-slate-200 text-[#0b1f2e]",
    amber: "bg-amber-50 border-amber-100 text-amber-700",
    blue: "bg-blue-50 border-blue-100 text-blue-700",
  } as const;
  return (
    <div className={`card rounded-2xl border p-5 ${toneMap[tone]}`}>
      <p className="text-xs mb-2 opacity-70">{label}</p>
      <p className="text-xl font-extrabold">{value}</p>
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
