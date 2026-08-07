"use client";

import { useEffect, useState } from "react";

export default function RatesPage() {
  const [rates, setRates] = useState({ usd: "70.5", eur: "76", pkr: "25", toman: "0.64" });
  const [updated, setUpdated] = useState("");
  const [saved, setSaved] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const r = localStorage.getItem("db_rates");
      if (r) setRates({ ...rates, ...JSON.parse(r) });
      const u = localStorage.getItem("db_rates_updated");
      if (u) setUpdated(u);
    } catch {}
  }, []);

  const update = (key: string, value: string) => {
    setRates({ ...rates, [key]: value });
    setMissing([]);
    setError("");
  };

  const fc = (name: string) => `input text-center text-xl font-extrabold text-[#c98f2d] ${missing.includes(name) ? "!border-red-500" : ""}`;

  const save = () => {
    const m: string[] = [];
    if (!rates.usd.trim() || isNaN(Number(rates.usd))) m.push("نرخ دلار");
    if (!rates.eur.trim() || isNaN(Number(rates.eur))) m.push("نرخ یورو");
    if (!rates.pkr.trim() || isNaN(Number(rates.pkr))) m.push("نرخ کلدار");
    if (!rates.toman.trim() || isNaN(Number(rates.toman))) m.push("نرخ تومان");
    if (m.length > 0) {
      setMissing(m);
      setError("لطفاً این نرخ‌ها را درست وارد کنید: " + m.join("، "));
      return;
    }
    setMissing([]);
    setError("");
    const now = new Date().toLocaleString("fa-IR");
    localStorage.setItem("db_rates", JSON.stringify(rates));
    localStorage.setItem("db_rates_updated", now);
    setUpdated(now);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const items = [
    { key: "usd", title: "دلار آمریکا", desc: "نرخ ۱ دلار به افغانی", flag: "🇺🇸" },
    { key: "eur", title: "یورو", desc: "نرخ ۱ یورو به افغانی", flag: "🇪🇺" },
    { key: "pkr", title: "کلدار پاکستان", desc: "نرخ ۱ کلدار به افغانی", flag: "🇵🇰" },
    { key: "toman", title: "تومان ایران", desc: "نرخ ۱۰۰ تومان به افغانی", flag: "🇮🇷" },
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

      {error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-xl p-3 border border-red-200">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {items.map(item => (
          <div key={item.key} className="card p-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{item.flag}</span>
              <p className="font-extrabold">{item.title}</p>
            </div>
            <p className="text-xs text-slate-500 mt-1 mb-4">{item.desc}</p>
            <label className="block text-sm font-bold mb-2">نرخ به افغانی</label>
            <input
              className={fc(item.title)}
              value={rates[item.key as keyof typeof rates]}
              onChange={e => update(item.key, e.target.value)}
            />
            <p className="text-xs text-slate-400 mt-3 text-center">افغانی</p>
          </div>
        ))}
      </div>

      <div className="card p-5 bg-blue-50 border border-blue-200">
        <p className="text-sm text-blue-900">
          <span className="font-bold">💡 نکته:</span> این نرخ‌ها به‌عنوان پیش‌فرض استفاده می‌شوند. در هر معامله می‌توانید نرخ توافقی جداگانه‌ای وارد کنید.
        </p>
      </div>
    </div>
  );
}
