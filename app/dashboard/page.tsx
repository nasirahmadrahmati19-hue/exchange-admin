"use client";

import { useCallback, useEffect, useState } from "react";

// ============================================================
// تایپ‌ها و ثابت‌ها
// ============================================================
type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";

const CURRENCIES: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];

const LABELS: Record<Currency, string> = {
  AFN: "افغانی",
  USD: "دالر",
  EUR: "یورو",
  IRR: "تومان",
  PKR: "کلدار",
};

const FLAGS: Record<Currency, string> = {
  AFN: "🇦🇫",
  USD: "🇺🇸",
  EUR: "🇪🇺",
  IRR: "🇮🇷",
  PKR: "🇵🇰",
};

const COLORS: Record<Currency, string> = {
  AFN: "from-blue-500 to-blue-600",
  USD: "from-emerald-500 to-emerald-600",
  EUR: "from-purple-500 to-purple-600",
  IRR: "from-rose-500 to-rose-600",
  PKR: "from-amber-500 to-amber-600",
};

// کلیدهای localStorage (مطابق با سیستم شما)
const CUSTOMERS_KEY = "fx-customers";
const TRANSACTIONS_KEY = "fx-transactions";
const HAWALAS_KEY = "hawalas";
const CASH_KEY = "cash-entries";

const EMPTY_BALANCE: Record<Currency, number> = {
  AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0,
};

// ============================================================
// توابع کمکی (همه داخل همین فایل - بدون import خارجی)
// ============================================================
function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function formatNum(n: number): string {
  return (Number.isFinite(n) ? n : 0).toLocaleString("fa-IR", {
    maximumFractionDigits: 0,
  });
}

// تشخیص اینکه آیا تاریخ مربوط به امروز است (هم ISO و هم شمسی)
function isToday(dateStr: string | undefined | null): boolean {
  if (!dateStr) return false;
  const str = String(dateStr);

  // چک با تاریخ میلادی ISO
  const todayISO = new Date().toISOString().split("T")[0];
  if (str.startsWith(todayISO)) return true;

  // چک با تاریخ شمسی (fa-IR)
  try {
    const todayFa = new Date().toLocaleDateString("fa-IR");
    if (str.includes(todayFa)) return true;

    // چک اگر timestamp باشد
    const num = Number(dateStr);
    if (!isNaN(num) && num > 1000000000000) {
      const d = new Date(num);
      return d.toDateString() === new Date().toDateString();
    }
  } catch {}

  return false;
}

// ============================================================
// تایپ داده داشبورد
// ============================================================
interface DashboardData {
  cashBox: Record<Currency, number>;
  customersTotal: Record<Currency, number>;
  ownerEquity: Record<Currency, number>;
  totalCommission: number;
  customersList: any[];
  todayStats: {
    tradeCount: number;
    tradeVolume: number;
    tradeFee: number;
    hawalaCount: number;
    hawalaFee: number;
    cashCount: number;
  };
  lastUpdated: Date | null;
}

const EMPTY_DATA: DashboardData = {
  cashBox: { ...EMPTY_BALANCE },
  customersTotal: { ...EMPTY_BALANCE },
  ownerEquity: { ...EMPTY_BALANCE },
  totalCommission: 0,
  customersList: [],
  todayStats: {
    tradeCount: 0, tradeVolume: 0, tradeFee: 0,
    hawalaCount: 0, hawalaFee: 0, cashCount: 0,
  },
  lastUpdated: null,
};

// ============================================================
// کامپوننت اصلی
// ============================================================
export default function DashboardPage() {
  const [d, setD] = useState<DashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    const customers = safeGet<any[]>(CUSTOMERS_KEY, []);
    const transactions = safeGet<any[]>(TRANSACTIONS_KEY, []);
    const hawalas = safeGet<any[]>(HAWALAS_KEY, []);
    const cashEntries = safeGet<any[]>(CASH_KEY, []);

    // ── ۱. محاسبه موجودی صندوق از cash-entries ──
    const cashBox: Record<Currency, number> = { ...EMPTY_BALANCE };
    let todayCashCount = 0;

    for (const entry of cashEntries) {
      const cur = entry.currency as Currency;
      if (!CURRENCIES.includes(cur)) continue;
      const amount = Number(entry.amount || 0);
      const type = entry.type || "";

      // انواعی که صندوق را زیاد می‌کنند
      if (["customer_deposit", "owner_deposit", "fee", "adjustment_in"].includes(type)) {
        cashBox[cur] += amount;
      }
      // انواعی که صندوق را کم می‌کنند
      else if (["customer_withdraw", "owner_withdraw", "commission_withdraw", "adjustment_out"].includes(type)) {
        cashBox[cur] -= amount;
      }

      if (isToday(entry.date) || isToday(entry.createdAt)) {
        todayCashCount++;
      }
    }

    // ── ۲. محاسبه موجودی کل مشتریان ──
    const customersTotal: Record<Currency, number> = { ...EMPTY_BALANCE };
    for (const customer of customers) {
      const balances = customer.balances || {};
      for (const cur of CURRENCIES) {
        customersTotal[cur] += Number(balances[cur] || 0);
      }
    }

    // ── ۳. محاسبه سرمایه خالص مالک = صندوق − مشتریان ──
    const ownerEquity: Record<Currency, number> = { ...EMPTY_BALANCE };
    for (const cur of CURRENCIES) {
      ownerEquity[cur] = cashBox[cur] - customersTotal[cur];
    }

    // ── ۴. محاسبه کارمزد قابل برداشت ──
    let totalCommission = 0;
    let todayTradeCount = 0;
    let todayTradeVolume = 0;
    let todayTradeFee = 0;

    for (const tx of transactions) {
      if (tx.status === "cancelled") continue;
      const fee = Number(tx.fee || tx.commission || 0);
      totalCommission += fee;

      if (isToday(tx.date) || isToday(tx.createdAt)) {
        todayTradeCount++;
        todayTradeVolume += Number(tx.afnValue || 0);
        todayTradeFee += fee;
      }
    }

    // ── ۵. آمار حواله‌ها ──
    let todayHawalaCount = 0;
    let todayHawalaFee = 0;

    for (const h of hawalas) {
      const fee = Number(h.fee || 0);
      totalCommission += fee;

      if (isToday(h.date) || isToday(h.createdAt)) {
        todayHawalaCount++;
        todayHawalaFee += fee;
      }
    }

    setD({
      cashBox,
      customersTotal,
      ownerEquity,
      totalCommission,
      customersList: customers,
      todayStats: {
        tradeCount: todayTradeCount,
        tradeVolume: todayTradeVolume,
        tradeFee: todayTradeFee,
        hawalaCount: todayHawalaCount,
        hawalaFee: todayHawalaFee,
        cashCount: todayCashCount,
      },
      lastUpdated: new Date(),
    });
    setLoading(false);
  }, []);

  // ── Sync با تب‌های دیگر ──
  useEffect(() => {
    load();

    const onStorage = () => load();
    const onFocus = () => load();
    const onCustom = () => load();

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    window.addEventListener("db:updated", onCustom);

    const interval = setInterval(load, 15000);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("db:updated", onCustom);
      clearInterval(interval);
    };
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400 font-bold">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">

      {/* ═══════════ هدر ═══════════ */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0b1f2e] via-[#16374d] to-[#1e4a6b] p-6 shadow-2xl">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#e3b45c] rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-400 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#e3b45c] to-[#c98f2d] flex items-center justify-center shadow-lg">
              <span className="text-[#0b1f2e] text-2xl font-black">ن</span>
            </div>
            <div>
              <h1 className="text-white text-2xl font-extrabold">داشبورد حساب‌ها</h1>
              <p className="text-[#e3b45c] text-sm font-bold">صرافی برادران نورزاد — هرات</p>
            </div>
          </div>

          {d.lastUpdated && (
            <button
              onClick={load}
              className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/20 hover:bg-white/20 transition-colors"
            >
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <p className="text-white/80 text-xs font-medium">
                {d.lastUpdated.toLocaleTimeString("fa-IR")}
              </p>
              <span className="text-white/60 text-sm">🔄</span>
            </button>
          )}
        </div>
      </div>

      {/* ═══════════ بخش ۱: آمار روزانه ═══════════ */}
      <section>
        <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          📅 آمار امروز
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <DailyStat
            icon="💱"
            label="معاملات"
            value={formatNum(d.todayStats.tradeCount)}
            color="blue"
          />
          <DailyStat
            icon="📊"
            label="حجم معاملات"
            value={formatNum(d.todayStats.tradeVolume)}
            sub="افغانی"
            color="emerald"
          />
          <DailyStat
            icon="💰"
            label="کارمزد معاملات"
            value={formatNum(d.todayStats.tradeFee)}
            color="amber"
          />
          <DailyStat
            icon="💸"
            label="حواله‌ها"
            value={formatNum(d.todayStats.hawalaCount)}
            color="purple"
          />
          <DailyStat
            icon="🎯"
            label="کارمزد حواله‌ها"
            value={formatNum(d.todayStats.hawalaFee)}
            color="rose"
          />
          <DailyStat
            icon="🏦"
            label="عملیات صندوق"
            value={formatNum(d.todayStats.cashCount)}
            color="sky"
          />
        </div>
      </section>

      {/* ═══════════ بخش ۲: موجودی صندوق ═══════════ */}
      <section>
        <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          🏦 موجودی فیزیکی صندوق
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {CURRENCIES.map((cur) => (
            <BalanceCard
              key={cur}
              flag={FLAGS[cur]}
              label={LABELS[cur]}
              amount={d.cashBox[cur]}
              gradient={COLORS[cur]}
            />
          ))}
        </div>
      </section>

      {/* ═══════════ بخش ۳: موجودی کل مشتریان ═══════════ */}
      <section>
        <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          👥 مجموع موجودی مشتریان
          <span className="text-sm font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
            {formatNum(d.customersList.length)} مشتری فعال
          </span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {CURRENCIES.map((cur) => (
            <BalanceCard
              key={cur}
              flag={FLAGS[cur]}
              label={LABELS[cur]}
              amount={d.customersTotal[cur]}
              gradient={COLORS[cur]}
            />
          ))}
        </div>
      </section>

      {/* ═══════════ بخش ۴: سرمایه خالص مالک ═══════════ */}
      <section>
        <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          💼 سرمایه خالص مالک
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
            (صندوق − موجودی مشتریان)
          </span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {CURRENCIES.map((cur) => {
            const value = d.ownerEquity[cur];
            const isPositive = value >= 0;
            return (
              <div
                key={cur}
                className={`relative overflow-hidden rounded-2xl p-4 border-2 transition-all hover:scale-[1.02] ${
                  isPositive
                    ? "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-300 dark:border-emerald-700"
                    : "bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-900/20 dark:to-red-900/20 border-rose-300 dark:border-rose-700"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-3xl">{FLAGS[cur]}</span>
                  <span
                    className={`text-xs font-black px-2 py-1 rounded-full ${
                      isPositive
                        ? "bg-emerald-500 text-white"
                        : "bg-rose-500 text-white"
                    }`}
                  >
                    {isPositive ? "طلبکار" : "بدهکار"}
                  </span>
                </div>
                <p className="text-sm font-bold text-gray-600 dark:text-gray-300 mb-1">
                  {LABELS[cur]}
                </p>
                <p
                  className={`text-xl font-black ${
                    isPositive
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-rose-700 dark:text-rose-300"
                  }`}
                >
                  {formatNum(Math.abs(value))}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══════════ بخش ۵: وضعیت بدهکار/بستانکار ═══════════ */}
      <section>
        <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          💳 وضعیت کلی سیستم
        </h2>
        <div className="rounded-2xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="text-right text-sm font-bold text-gray-600 dark:text-gray-300 px-4 py-3">ارز</th>
                <th className="text-center text-sm font-bold text-gray-600 dark:text-gray-300 px-4 py-3">صندوق</th>
                <th className="text-center text-sm font-bold text-gray-600 dark:text-gray-300 px-4 py-3">مشتریان</th>
                <th className="text-center text-sm font-bold text-gray-600 dark:text-gray-300 px-4 py-3">تفاضل</th>
                <th className="text-center text-sm font-bold text-gray-600 dark:text-gray-300 px-4 py-3">وضعیت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {CURRENCIES.map((cur) => {
                const diff = d.ownerEquity[cur];
                const isPositive = diff >= 0;
                return (
                  <tr key={cur} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{FLAGS[cur]}</span>
                        <span className="font-bold text-gray-900 dark:text-white">{LABELS[cur]}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-gray-700 dark:text-gray-200">
                      {formatNum(d.cashBox[cur])}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-gray-700 dark:text-gray-200">
                      {formatNum(d.customersTotal[cur])}
                    </td>
                    <td className={`px-4 py-3 text-center font-black ${
                      isPositive
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}>
                      {formatNum(diff)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block text-xs font-black px-3 py-1.5 rounded-full ${
                          isPositive
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                        }`}
                      >
                        {isPositive ? "✅ طلبکار" : "⚠️ بدهکار"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ═══════════ بخش ۶: کارمزد قابل برداشت ═══════════ */}
      <section>
        <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          💱 کارمزد قابل برداشت
        </h2>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#e3b45c] via-[#c98f2d] to-[#a06d1a] p-8 shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-2xl"></div>

          <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-white/80 text-sm font-bold mb-2">
                مجموع کارمزد معاملات و حواله‌جات
              </p>
              <p className="text-white text-5xl font-black">
                {formatNum(d.totalCommission)}
              </p>
              <p className="text-white/70 text-sm font-bold mt-2">افغانی</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 border border-white/20 min-w-[140px]">
                <p className="text-white/70 text-xs font-bold mb-1">کارمزد امروز معاملات</p>
                <p className="text-white text-2xl font-black">
                  {formatNum(d.todayStats.tradeFee)}
                </p>
              </div>
              <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 border border-white/20 min-w-[140px]">
                <p className="text-white/70 text-xs font-bold mb-1">کارمزد امروز حواله‌ها</p>
                <p className="text-white text-2xl font-black">
                  {formatNum(d.todayStats.hawalaFee)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ فوتر ═══════════ */}
      <div className="text-center py-4">
        <p className="text-sm text-gray-400 dark:text-gray-500 font-medium">
          🏦 صرافی برادران نورزاد — هرات | آخرین به‌روزرسانی:{" "}
          {d.lastUpdated?.toLocaleTimeString("fa-IR")}
        </p>
      </div>
    </div>
  );
}

// ============================================================
// کامپوننت‌های کمکی
// ============================================================

function BalanceCard({ flag, label, amount, gradient }: {
  flag: string;
  label: string;
  amount: number;
  gradient: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-4 shadow-lg hover:shadow-xl transition-all hover:scale-[1.03] cursor-default`}>
      <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-3xl">{flag}</span>
        </div>
        <p className="text-white/80 text-sm font-bold mb-1">{label}</p>
        <p className="text-white text-xl font-black">{formatNum(amount)}</p>
      </div>
    </div>
  );
}

function DailyStat({ icon, label, value, sub, color }: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  color: "blue" | "emerald" | "amber" | "purple" | "rose" | "sky";
}) {
  const colorMap = {
    blue: "from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-700 text-blue-900 dark:text-blue-100",
    emerald: "from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-emerald-200 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100",
    amber: "from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-amber-200 dark:border-amber-700 text-amber-900 dark:text-amber-100",
    purple: "from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-700 text-purple-900 dark:text-purple-100",
    rose: "from-rose-50 to-rose-100 dark:from-rose-900/20 dark:to-rose-800/20 border-rose-200 dark:border-rose-700 text-rose-900 dark:text-rose-100",
    sky: "from-sky-50 to-sky-100 dark:from-sky-900/20 dark:to-sky-800/20 border-sky-200 dark:border-sky-700 text-sky-900 dark:text-sky-100",
  };

  return (
    <div className={`rounded-2xl bg-gradient-to-br ${colorMap[color]} border-2 p-4 shadow hover:shadow-md transition-all hover:scale-[1.02]`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-xs font-bold opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-black">{value}</p>
      {sub && <p className="text-[10px] opacity-60 mt-1">{sub}</p>}
    </div>
  );
}
