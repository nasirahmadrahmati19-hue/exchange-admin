"use client";

import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [d, setD] = useState({
    hawalaCount: 0, hawalaVolume: 0, tradeCount: 0, tradeVolume: 0,
    totalFee: 0, tradeProfit: 0, pending: 0, today: 0,
    cur: { "افغانی": 0, "دلار": 0, "تومان": 0, "یورو": 0 } as Record<string, number>,
    accounts: { AFN: 0, USD: 0, IRR: 0 },
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

      const acc = { AFN: 0, USD: 0, IRR: 0 };
      u.forEach((x: any) => {
        const b = x.balances || { AFN: Number(x.balance || 0), USD: 0, IRR: 0 };
        acc.AFN += b.AFN || 0; acc.USD += b.USD || 0; acc.IRR += b.IRR || 0;
      });

      const curSum: Record<string, number> = { "افغانی": 0, "دلار": 0, "تومان": 0, "یورو": 0 };
      let hawalaVolume = 0, totalFee = 0, pending = 0, today = 0;
      const todayStr = new Date().toLocaleDateString("fa-IR");

      h.forEach((x: any) => {
        hawalaVolume += toAFN(Number(x.amount || 0), x.payCur);
        totalFee += Number(x.fee || 0);
        if (curSum[x.payCur] !== undefined) curSum[x.payCur] += Number(x.amount || 0);
        if (curSum[x.getCur] !== undefined) curSum[x.getCur] += Number(x.result || 0);
        if (x.status === "در انتظار") pending++;
        if (x.date === todayStr) today++;
      });

      let tradeVolume = 0, tradeProfit = 0;
      t.forEach((x: any) => {
        const v = Number(x.afnValue || 0);
        tradeVolume += v;
        tradeProfit += v * (Number(commission) / 100);
        if (curSum[x.currency] !== undefined) curSum[x.currency] += Number(x.amount || 0);
      });

      setD({
        hawalaCount: h.length, hawalaVolume, tradeCount: t.length, tradeVolume,
        totalFee, tradeProfit, pending, today,
        cur: curSum, accounts: acc, rates, commission, latest: h.slice(0, 4),
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

  const accountCards = [
    { name: "افغانی", flag: "🇦🇫", code: "AFN", value: d.accounts.AFN, color: "from-emerald-500 to-teal-600" },
    { name: "دالر", flag: "🇺🇸", code: "USD", value: d.accounts.USD, color: "from-blue-500 to-indigo-600" },
    { name: "تومان", flag: "🇮🇷", code: "IRR", value: d.accounts.IRR, color: "from-amber-500 to-orange-600" },
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

      {/* مانده کل حساب‌های مشتریان */}
      <div>
        <h3 className="font-extrabold mb-4">مانده کل حساب‌های مشتریان</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {accountCards.map(c => (
            <div key={c.code} className={`rounded-2xl bg-gradient-to-br ${c.color} p-5 text-white shadow-lg`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold opacity-90">{c.flag} {c.name}</span>
                <span className="text-xs font-bold opacity-70">{c.code}</span>
              </div>
              <p className="text-2xl font-extrabold mt-3">{fa(c.value)}</p>
              <p className="text-[11px] opacity-80 mt-1">مجموع مانده همه مشتریان</p>
            </div>
          ))}
        </div>
      </div>

      {/* کارت‌های خلاصه کسب‌وکار */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {summary.map(s => (
          <div key={s.t} className="card p-5">
            <p className="text-slate-500 text-xs mb-2">{s.t}</p>
            <p className="text-xl font-extrabold text-[#0b1f2e]">{s.v}</p>
            <p className="text-xs text-[#c98f2d] font-bold mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* گردش به تفکیک ارز */}
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

      {/* وضعیت امروز + آخرین حواله‌ها */}
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
              {d.latest.map(h => (
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
