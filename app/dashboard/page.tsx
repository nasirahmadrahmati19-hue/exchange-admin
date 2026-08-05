"use client";

import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [stats, setStats] = useState({ hawala: 0, pending: 0, trades: 0, users: 0 });
  const [hawala, setHawala] = useState<any[]>([]);
  const [rates, setRates] = useState({ usd: "70.5", eur: "76", toman: "0.64" });

  useEffect(() => {
    try {
      const h = JSON.parse(localStorage.getItem("db_hawala") || "[]");
      const t = JSON.parse(localStorage.getItem("db_trades") || "[]");
      const u = JSON.parse(localStorage.getItem("db_users") || "[]");
      const r = localStorage.getItem("db_rates");
      if (r) setRates({ ...rates, ...JSON.parse(r) });
      setStats({
        hawala: h.length,
        pending: h.filter((x: any) => x.status === "در انتظار").length,
        trades: t.length,
        users: u.length
      });
      setHawala(h.slice(0, 4));
    } catch {}
  }, []);

  const fa = (n: number) => n.toLocaleString("fa-IR");

  return (
    <div className="space-y-8">
      <div className="rounded-2xl bg-gradient-to-l from-[#0b1f2e] to-[#16374d] text-white p-6">
        <p className="text-[#e3b45c] text-sm font-bold">صرافی و حواله‌جات برادران نورزاد</p>
        <h2 className="text-xl font-extrabold mt-1">هرات، افغانستان</h2>
        <div className="flex flex-wrap gap-4 mt-4 text-sm">
          <span className="bg-white/10 rounded-xl px-4 py-2">دلار: <b className="text-[#e3b45c]">{rates.usd}</b> افغانی</span>
          <span className="bg-white/10 rounded-xl px-4 py-2">۱۰۰ تومان: <b className="text-[#e3b45c]">{rates.toman}</b> افغانی</span>
          <span className="bg-white/10 rounded-xl px-4 py-2">یورو: <b className="text-[#e3b45c]">{rates.eur}</b> افغانی</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { t: "کل حواله‌ها", v: fa(stats.hawala) },
          { t: "حواله‌های در انتظار", v: fa(stats.pending) },
          { t: "تبادلات ثبت‌شده", v: fa(stats.trades) },
          { t: "مشتریان", v: fa(stats.users) },
        ].map(s => (
          <div key={s.t} className="card p-5">
            <p className="text-slate-500 text-xs mb-1">{s.t}</p>
            <p className="text-2xl font-extrabold text-[#c98f2d]">{s.v}</p>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <h3 className="font-extrabold mb-6">آخرین حواله‌ها</h3>
        {hawala.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">هنوز حواله‌ای ثبت نشده است</p>
        ) : (
          <div className="space-y-3">
            {hawala.map(h => (
              <div key={h.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0b1f2e] text-[#e3b45c] flex items-center justify-center font-bold text-sm">
                    {h.sender?.charAt(0)}
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
  );
}
