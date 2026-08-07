"use client";

import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [d, setD] = useState<any>({
    hawalaCount: 0,
    hawalaVolume: 0,
    hawalaTotals: { AFN: 0, USD: 0, IRR: 0 },
    tradeCount: 0,
    tradeVolume: 0,
    tradeTotals: { AFN: 0, USD: 0, IRR: 0 },
    accounts: { AFN: 0, USD: 0, IRR: 0 },
    totalFee: 0,
    tradeProfit: 0,
    pending: 0,
    today: 0,
    cur: { "افغانی": 0, "دلار": 0, "تومان": 0, "یورو": 0 },
    rates: { usd: "70.5", eur: "76", toman: "0.64" },
    commission: "0.5",
    latest: [] as any[],
  });

  useEffect(() => {
    try {
      const h = JSON.parse(localStorage.getItem("db_hawala") || "[]");
      const t = JSON.parse(localStorage.getItem("db_trades") || "[]");
      const u = JSON.parse(localStorage.getItem("db_users") || "[]");
      let rates = { usd: "70.5", eur: "76", toman: "0.64" };
      const r = localStorage.getItem("db_rates");
      if (r) rates = { ...rates, ...JSON.parse(r) };
      let commission = "0.5";
      const s = localStorage.getItem("db_settings");
      if (s) { const p = JSON.parse(s); if (p && p.commission) commission = p.commission; }

      const toAFN = (amount: number, cur: string) => {
        if (cur === "تومان") return (amount / 1000) * Number(rates.toman);
        if (cur === "دلار" || cur === "دالر") return amount * Number(rates.usd);
        if (cur === "یورو") return amount * Number(rates.eur);
        return amount;
      };

      // ---------- مجموع حواله‌جات ----------
      const hawalaTotals = { AFN: 0, USD: 0, IRR: 0 };
      const curSum: Record<string, number> = { "افغانی": 0, "دلار": 0, "تومان": 0, "یورو": 0 };
      let hawalaVolume = 0, totalFee = 0, pending = 0, today = 0;
      const todayStr = new Date().toLocaleDateString("fa-IR");

      h.forEach((x: any) => {
        const amt = Number(x.amount || 0);
        if (x.payCur === "افغانی") hawalaTotals.AFN += amt;
        else if (x.payCur === "دلار" || x.payCur === "دالر") hawalaTotals.USD += amt;
        else if (x.payCur === "تومان") hawalaTotals.IRR += amt;

        hawalaVolume += toAFN(amt, x.payCur);
        totalFee += Number(x.fee || 0);
        if (curSum[x.payCur] !== undefined) curSum[x.payCur] += amt;
        if (curSum[x.getCur] !== undefined) curSum[x.getCur] += Number(x.result || 0);
        if (x.status === "در انتظار" || x.status === "در حال انتظار") pending++;
        if (x.date === todayStr) today++;
      });

      // ---------- مجموع تبادل ارز ----------
      const tradeTotals = { AFN: 0, USD: 0, IRR: 0 };
      let tradeVolume = 0, tradeProfit = 0;
      t.forEach((x: any) => {
        const amt = Number(x.amount || 0);
        if (x.currency === "افغانی") tradeTotals.AFN += amt;
        else if (x.currency === "دالر" || x.currency === "دلار") tradeTotals.USD += amt;
        else if (x.currency === "تومان") tradeTotals.IRR += amt;

        const v = Number(x.afnValue || 0);
        tradeVolume += v;
        tradeProfit += v * (Number(commission) / 100);
        if (curSum[x.currency] !== undefined) curSum[x.currency] += amt;
      });

      // ---------- مانده کل سیستم ----------
      const acc = { AFN: 0, USD: 0, IRR: 0 };
      u.forEach((x: any) => {
        const b = x.balances || { AFN: Number(x.balance || 0), USD: 0, IRR: 0 };
        acc.AFN += b.AFN || 0; acc.USD += b.USD || 0; acc.IRR += b.IRR || 0;
      });

      setD({
        hawalaCount: h.length, hawalaVolume, hawalaTotals,
        tradeCount: t.length, tradeVolume, tradeTotals,
        accounts: acc, totalFee, tradeProfit, pending, today,
        cur: curSum, rates, commission, latest: h.slice(0, 4),
      });
    } catch {}
  }, []);

  const fa = (n: number) => n.toLocaleString("fa-IR", { maximumFractionDigits: 0 });

  const summary = [
    { t: "مجموع حواله‌جات", v: fa(d.hawalaCount) + " حواله", sub: "حجم: " + fa(d.hawalaVolume) + " افغانی" },
    { t: "مجموع تبادل ارز", v: fa(d.tradeCount) + " معامله", sub: "حجم: " + fa(d.tradeVolume) + " افغانی" },
    { t: "مجموع کمیشن‌ها", v: fa(d.totalFee) + " افغانی", sub: "از حواله‌جات" },
    { t: "مفاد از تبادل ارز", v: fa(d.tradeProfit) + " افغانی", sub: "کارمزد " + d.commission + "٪" },
  ];

  const turnover = [
    { name: "افغانی", symbol: "؋", color: "from-emerald-500 to-teal-600" },
    { name: "دلار", symbol: "$", color: "from-blue-500 to-indigo-600" },
    { name: "تومان", symbol: "﷼", color: "from-amber-500 to-orange-600" },
    { name: "یورو", symbol: "€", color: "from-purple-500 to-fuchsia-600" },
  ];

  return (
    <div className="space-y-8">
      {/* بنر نرخ روز */}
      <div className="rounded-2xl bg-gradient-to-l from-[#0b1f2e] to-[#16374d] text-white p-6">
        <p className="text-[#e3b45c] text-sm font-bold">صرافی و حواله‌جات برادران نورزاد</p>
        <h2 className="text-xl font-extrabold mt-1">هرات، افغانستان</h2>
        <div className="flex flex-wrap gap-3 mt-4 text-sm">
          <span className="bg-white/10 rounded-xl px-4 py-2">دلار: <b className="text-[#e3b45c]">{d.rates.usd}</b> افغانی</span>
          <span className="bg-white/10 rounded-xl px-4 py-2">۱۰۰ تومان: <b className="text-[#e3b45c]">{d.rates.toman}</b> افغانی</span>
          <span className="bg-white/10 rounded-xl px-4 py-2">یورو: <b className="text-[#e3b45c]">{d.rates.eur}</b> افغانی</span>
        </div>
      </div>

      {/* ========== سه کارت افقی (طرح جدید طبق عکس) ========== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* کارت ۱: مجموع حواله‌جات */}
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-slate-600 font-bold">مجموع حواله‌جات</p>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-emerald-600">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v8" />
              <path d="M9 13l3 3 3-3" />
            </svg>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 mt-1">{fa(d.hawalaCount)}</p>
          <div className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">افغانی</span>
              <span className="text-emerald-600 font-bold">{fa(d.hawalaTotals.AFN)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">دالر</span>
              <span className="text-emerald-600 font-bold">{fa(d.hawalaTotals.USD)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">تومان</span>
              <span className="text-emerald-600 font-bold">{fa(d.hawalaTotals.IRR)}</span>
            </div>
          </div>
        </div>

        {/* کارت ۲: مجموع تبادل ارز */}
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-slate-600 font-bold">مجموع تبادل ارز</p>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-rose-600">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 16V8" />
              <path d="M9 11l3-3 3 3" />
            </svg>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 mt-1">{fa(d.tradeCount)}</p>
          <div className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">افغانی</span>
              <span className="text-rose-600 font-bold">{fa(d.tradeTotals.AFN)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">دالر</span>
              <span className="text-rose-600 font-bold">{fa(d.tradeTotals.USD)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">تومان</span>
              <span className="text-rose-600 font-bold">{fa(d.tradeTotals.IRR)}</span>
            </div>
          </div>
        </div>

        {/* کارت ۳: مانده کل سیستم */}
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-slate-600 font-bold">مانده کل سیستم</p>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-[#c98f2d]">
              <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
              <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
              <path d="M7 21h10" />
              <path d="M12 3v18" />
              <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
            </svg>
          </div>
          <div className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">افغانی</span>
              <span className="text-[#c98f2d] font-bold">{fa(d.accounts.AFN)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">دالر</span>
              <span className="text-[#c98f2d] font-bold">{fa(d.accounts.USD)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">تومان</span>
              <span className="text-[#c98f2d] font-bold">{fa(d.accounts.IRR)}</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-4">مجموع مانده همه مشتریان</p>
        </div>
      </div>

      {/* ========== کارت‌های خلاصه کسب‌وکار (برگشت) ========== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {summary.map(s => (
          <div key={s.t} className="card p-5">
            <p className="text-slate-500 text-xs mb-2">{s.t}</p>
            <p className="text-xl font-extrabold text-[#0b1f2e]">{s.v}</p>
            <p className="text-xs text-[#c98f2d] font-bold mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ========== گردش به تفکیک ارز (برگشت) ========== */}
      <div>
        <h3 className="font-extrabold mb-4">مجموع گردش به تفکیک ارز (حواله + تبادل)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {turnover.map(c => (
            <div key={c.name} className={`rounded-2xl bg-gradient-to-br ${c.color} p-5 text-white shadow-lg`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold opacity-90">{c.name}</span>
                <span className="text-2xl font-extrabold opacity-80">{c.symbol}</span>
              </div>
              <p className="text-2xl font-extrabold mt-3">{fa(d.cur[c.name] || 0)}</p>
              <p className="text-[11px] opacity-80 mt-1">مجموع حواله + تبادل</p>
            </div>
          ))}
        </div>
      </div>

      {/* ========== وضعیت امروز + آخرین حواله‌ها ========== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6">
          <h3 className="font-extrabold mb-6">وضعیت امروز</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-100">
              <span className="text-sm font-bold text-amber-700">حواله‌های امروز</span>
              <span className="text-xl font-extrabold text-amber-700">{fa(d.today)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 border border-blue-100">
              <span className="text-sm font-bold text-blue-700">در انتظار ارسال</span>
              <span className="text-xl font-extrabold text-blue-700">{fa(d.pending)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100">
              <span className="text-sm font-bold text-emerald-700">مجموع مفاد و کمیشن</span>
              <span className="text-xl font-extrabold text-emerald-700">{fa(d.totalFee + d.tradeProfit)}</span>
            </div>
          </div>
        </div>

        <div className="card p-6 lg:col-span-2">
          <h3 className="font-extrabold mb-6">آخرین حواله‌ها</h3>
          {d.latest.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">هنوز حواله‌ای ثبت نشده است</p>
          ) : (
            <div className="space-y-3">
              {d.latest.map((h: any) => (
                <div key={h.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#0b1f2e] text-[#e3b45c] flex items-center justify-center font-bold text-sm">
                      {h.sender ? h.sender.charAt(0) : "-"}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{h.sender} ← {h.receiver}</p>
                      <p className="text-xs text-slate-500">{h.fromCity} به {h.toCity}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm text-[#c98f2d]">{Number(h.result).toLocaleString("fa-IR")} {h.getCur}</p>
                    <p className="text-xs text-slate-500">{h.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
