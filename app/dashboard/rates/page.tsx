"use client";

import { useEffect, useState } from "react";

export default function RatesPage() {
  const [rates, setRates] = useState({ usd: "70.5", eur: "76", toman: "0.64" });
  const [updated, setUpdated] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const r = localStorage.getItem("db_rates");
      if (r) setRates({ ...rates, ...JSON.parse(r) });
      const u = localStorage.getItem("db_rates_updated");
      if (u) setUpdated(u);
    } catch {}
  }, []);

  const save = () => {
    const now = new Date().toLocaleString("fa-IR");
    localStorage.setItem("db_rates", JSON.stringify(rates));
    localStorage.setItem("db_rates_updated", now);
    setUpdated(now);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const items = [
    { key: "usd", title: "دلار آمریکا", desc: "نرخ ۱ دلار به افغانی" },
    { key: "eur", title: "یورو", desc: "نرخ ۱ یورو به افغانی" },
    { key: "toman", title: "تومان ایران", desc: "نرخ ۱۰۰ تومان به افغانی" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">نرخ روز ارزها</h1>
          {updated && <p className="text-xs text-slate-500 mt-1">آخرین به‌روزرسانی: {updated}</p>}
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-gold" onClick={save}>ذخیره نرخ‌ها</button>
          {saved && <span className="text-emerald-600 text-sm font-bold">ذخیره شد</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {items.map(item => (
          <div key={item.key} className="card p-6">
            <p className="font-extrabold">{item.title}</p>
            <p className="text-xs text-slate-500 mt-1 mb-4">{item.desc}</p>
            <input
              className="input text-center text-xl font-extrabold text-[#c98f2d]"
              value={rates[item.key as keyof typeof rates]}
              onChange={e => setRates({ ...rates, [item.key]: e.target.value })}
            />
            <p className="text-xs text-slate-400 mt-3 text-center">افغانی</p>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h3 className="font-extrabold mb-3">راهنمای محاسبه</h3>
        <ul className="text-sm text-slate-600 space-y-2">
          <li>• حواله تومان به افغانی: مبلغ تومان تقسیم بر ۱۰۰ ضربدر نرخ تومان</li>
          <li>• حواله افغانی به تومان: مبلغ افغانی تقسیم بر نرخ تومان ضربدر ۱۰۰۰</li>
          <li>• حواله دلار: ضربدر نرخ دلار</li>
          <li>• این نرخ‌ها به صورت خودکار در صفحه حواله‌جات و تبادل ارز استفاده می‌شوند</li>
        </ul>
      </div>
    </div>
  );
}
