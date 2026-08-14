"use client";
import { useEffect, useMemo, useState } from "react";

type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";
type Transaction = {
  id: string;
  trackingCode: string;
  date: string;
  type: "exchange" | "transfer" | "convert";
  fromCurrency: Currency;
  fromAmount: number;
  toCurrency: Currency;
  toAmount: number;
  rate: number;
  rateLabel: string;
  status: "active" | "voided";
};

const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const labels: Record<Currency, string> = {
  AFN: "افغانی",
  USD: "دالر",
  EUR: "یورو",
  IRR: "تومان",
  PKR: "کلدار"
};

const currencyColors: Record<Currency, { light: string; dark: string; gradient: string }> = {
  AFN: { light: "text-emerald-700", dark: "text-emerald-300", gradient: "from-emerald-500 to-teal-400" },
  USD: { light: "text-sky-700", dark: "text-sky-300", gradient: "from-sky-500 to-cyan-400" },
  EUR: { light: "text-blue-700", dark: "text-blue-300", gradient: "from-blue-600 to-blue-400" },
  IRR: { light: "text-amber-700", dark: "text-amber-300", gradient: "from-amber-500 to-orange-400" },
  PKR: { light: "text-rose-700", dark: "text-rose-300", gradient: "from-rose-500 to-pink-400" }
};

const TRANSACTIONS_KEY = "fx-transactions";

function loadTransactions(): Transaction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TRANSACTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t: any) => t?.id && t.status === "active");
  } catch {
    return [];
  }
}

function calculateAverageRate(transactions: Transaction[], from: Currency, to: Currency): { rate: number; count: number; lastDate: string } {
  const relevant = transactions.filter(t => 
    (t.fromCurrency === from && t.toCurrency === to) || 
    (t.fromCurrency === to && t.toCurrency === from)
  );
  
  if (relevant.length === 0) {
    return { rate: 0, count: 0, lastDate: "" };
  }
  
  const totalRate = relevant.reduce((sum, t) => sum + t.rate, 0);
  const avgRate = totalRate / relevant.length;
  const lastDate = relevant[relevant.length - 1].date;
  
  return { rate: avgRate, count: relevant.length, lastDate };
}

function formatDateTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "-";
    
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    
    const get = (type: string) => parts.find(p => p.type === type)?.value || "0";
    const pad = (n: number) => String(n).padStart(2, "0");
    
    return `${get("year")}/${get("month")}/${get("day")} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  } catch {
    return "-";
  }
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0";
}

export default function RatesPage() {
  const [mounted, setMounted] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("fx-theme");
      if (saved === "dark" || saved === "light") setTheme(saved);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("fx-theme", theme);
    } catch {}
  }, [theme]);

  const dk = theme === "dark";

  useEffect(() => {
    try {
      setTransactions(loadTransactions());
    } catch (err) {
      console.error("Load error:", err);
    }
    setMounted(true);
  }, []);

  const rates = useMemo(() => {
    const result: Record<string, { rate: number; count: number; lastDate: string }> = {};
    
    for (let i = 0; i < currencies.length; i++) {
      for (let j = i + 1; j < currencies.length; j++) {
        const from = currencies[i];
        const to = currencies[j];
        const key = `${from}-${to}`;
        result[key] = calculateAverageRate(transactions, from, to);
      }
    }
    
    return result;
  }, [transactions]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-emerald-500" />
          <p className="mt-4 text-slate-500">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  const heading = dk ? "text-white" : "text-slate-900";
  const subText = dk ? "text-slate-500" : "text-slate-400";
  const uiCard = `rounded-2xl border backdrop-blur transition-colors duration-300 ${
    dk 
      ? "border-slate-700 bg-slate-800/90 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.6)]" 
      : "border-emerald-100 bg-white/95 shadow-[0_16px_40px_-28px_rgba(16,185,129,0.35)]"
  }`;

  return (
    <div dir="rtl" className={dk ? "dark" : ""}>
      <style>{`
        @import url("https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap");
        .rt-font { font-family: "Vazirmatn", "Segoe UI", Tahoma, sans-serif; }
        .dark { color-scheme: dark; }
      `}</style>
      
      <div className={`rt-font relative min-h-screen overflow-x-hidden antialiased transition-colors duration-500 ${
        dk ? "bg-[#0f172a] text-slate-100" : "bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 text-slate-800"
      }`}>
        <div className={`fixed inset-x-0 top-0 z-30 h-1 bg-gradient-to-l ${
          dk ? "from-emerald-400 via-teal-400 to-cyan-400" : "from-emerald-500 via-teal-500 to-cyan-500"
        }`} />
        
        <div className="relative z-10 mx-auto w-full max-w-7xl space-y-6 px-3 pb-16 pt-5 md:px-8 md:pt-9">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-400 text-white shadow-lg shadow-emerald-500/30 ring-1 ring-white/30">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
                </svg>
                <span className={`absolute -bottom-1.5 -left-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-400 px-1 text-[8px] font-black text-white ring-2 ${
                  dk ? "ring-[#0f172a]" : "ring-[#ecfdf5]"
                }`}>
                  RT
                </span>
              </div>
              <div>
                <h1 className={`text-3xl font-bold leading-none ${heading}`}>مدیریت نرخ‌ها</h1>
                <p className={`mt-1 text-xs font-bold ${subText}`}>نرخ‌های ارز محاسبه‌شده از معاملات</p>
              </div>
            </div>
            
            <button
              onClick={() => setTheme(dk ? "light" : "dark")}
              className={`group grid h-11 w-11 cursor-pointer place-items-center rounded-xl border shadow-sm backdrop-blur transition-all duration-300 active:scale-90 ${
                dk 
                  ? "border-slate-600 bg-slate-800/85 text-amber-300 hover:border-amber-300" 
                  : "border-slate-200 bg-white/85 text-slate-600 hover:border-emerald-400"
              }`}
            >
              {dk ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="h-4 w-4 transition-transform duration-500 group-hover:rotate-45">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.375 3.375 0 1 1-7.5 0 3.375 3.375 0 0 1 7.5 0Z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="h-4 w-4 transition-transform duration-500 group-hover:-rotate-12">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                </svg>
              )}
            </button>
          </header>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className={`rounded-2xl border p-4 ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-white/80"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-[10px] font-black ${subText}`}>کل معاملات</div>
                  <div className={`text-2xl font-black tabular-nums mt-1 ${dk ? "text-emerald-300" : "text-emerald-600"}`}>
                    {transactions.length}
                  </div>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                  </svg>
                </div>
              </div>
            </div>

            <div className={`rounded-2xl border p-4 ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-white/80"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-[10px] font-black ${subText}`}>جفت‌ارزهای فعال</div>
                  <div className={`text-2xl font-black tabular-nums mt-1 ${dk ? "text-sky-300" : "text-sky-600"}`}>
                    {Object.values(rates).filter(r => r.count > 0).length}
                  </div>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-cyan-500 text-white shadow-lg">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className={`rounded-2xl border p-4 col-span-2 md:col-span-1 ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-white/80"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-[10px] font-black ${subText}`}>آخرین به‌روزرسانی</div>
                  <div className={`text-sm font-black tabular-nums mt-1 ${dk ? "text-amber-300" : "text-amber-600"}`}>
                    {transactions.length > 0 ? formatDateTime(transactions[transactions.length - 1].date) : "-"}
                  </div>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <section className={`p-6 ${uiCard}`}>
            <div className="flex items-center gap-2 mb-6">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className={`h-5 w-5 ${dk ? "text-emerald-300" : "text-emerald-600"}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
              </svg>
              <h2 className={`text-xl font-bold ${heading}`}>نرخ‌های جفت‌ارزها</h2>
            </div>

            {transactions.length === 0 ? (
              <div className={`flex flex-col items-center gap-3 py-16 ${dk ? "text-slate-500" : "text-slate-400"}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="h-16 w-16 opacity-70">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z" />
                </svg>
                <p className="text-sm font-black">هنوز معامله‌ای ثبت نشده است.</p>
                <p className="text-xs">نرخ‌ها پس از ثبت معاملات به صورت خودکار محاسبه می‌شوند.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(rates).map(([key, data]) => {
                  const [from, to] = key.split("-") as [Currency, Currency];
                  const fromColors = currencyColors[from];
                  const toColors = currencyColors[to];
                  
                  if (data.count === 0) return null;
                  
                  return (
                    <div
                      key={key}
                      className={`rounded-xl border p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
                        dk ? "border-slate-700 bg-slate-900/50" : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br ${fromColors.gradient} text-white text-xs font-black`}>
                            {from}
                          </span>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`h-4 w-4 ${subText}`}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                          </svg>
                          <span className={`grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br ${toColors.gradient} text-white text-xs font-black`}>
                            {to}
                          </span>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                          dk ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"
                        }`}>
                          {data.count} معامله
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <div className={`text-[10px] ${subText} mb-1`}>نرخ میانگین</div>
                          <div className={`text-lg font-black tabular-nums ${fromColors[dk ? "dark" : "light"]}`}>
                            {fmt(data.rate)}
                          </div>
                        </div>
                        
                        <div className={`text-[10px] ${subText} pt-2 border-t border-dashed ${dk ? "border-slate-700" : "border-slate-200"}`}>
                          <div>از: <b>{labels[from]}</b></div>
                          <div>به: <b>{labels[to]}</b></div>
                          <div className="mt-1">آخرین: <span dir="ltr">{formatDateTime(data.lastDate)}</span></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {transactions.length > 0 && (
            <section className={`p-6 ${uiCard}`}>
              <div className="flex items-center gap-2 mb-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className={`h-5 w-5 ${dk ? "text-amber-300" : "text-amber-600"}`}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                </svg>
                <h2 className={`text-lg font-bold ${heading}`}>نحوه محاسبه نرخ‌ها</h2>
              </div>
              <div className={`text-sm space-y-2 ${dk ? "text-slate-300" : "text-slate-600"}`}>
                <p>• نرخ‌ها به صورت <b>خودکار</b> از معاملات ثبت‌شده محاسبه می‌شوند.</p>
                <p>• برای هر جفت‌ارز، <b>میانگین</b> نرخ تمام معاملات فعال محاسبه می‌شود.</p>
                <p>• معاملات <b>لغو‌شده</b> در محاسبه نرخ لحاظ نمی‌شوند.</p>
                <p>• تاریخ آخرین معامله برای هر جفت‌ارز نمایش داده می‌شود.</p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
