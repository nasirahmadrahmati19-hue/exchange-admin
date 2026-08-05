"use client";

import { useEffect, useState } from "react";

interface Trade {
  id: number;
  customer: string;
  phone: string;
  type: string;
  currency: string;
  amount: string;
  afnValue: string;
  date: string;
}

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [rates, setRates] = useState({ usd: "70.5", eur: "76", toman: "0.64" });
  const [form, setForm] = useState({
    customer: "", phone: "", type: "خرید از مشتری", currency: "دلار", amount: ""
  });

  useEffect(() => {
    try {
      const t = localStorage.getItem("db_trades");
      if (t) setTrades(JSON.parse(t));
      const r = localStorage.getItem("db_rates");
      if (r) setRates({ ...rates, ...JSON.parse(r) });
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem("db_trades", JSON.stringify(trades));
  }, [trades]);

  const toAFN = (amount: number, cur: string) => {
    if (cur === "تومان") return (amount / 1000) * Number(rates.toman);
    if (cur === "دلار") return amount * Number(rates.usd);
    if (cur === "یورو") return amount * Number(rates.eur);
    return amount;
  };

  const amountNum = Number(form.amount || 0);
  const afnValue = toAFN(amountNum, form.currency);

  const add = () => {
    if (!form.customer || !form.amount) return;
    setTrades([{
      id: Date.now(),
      ...form,
      afnValue: afnValue.toFixed(0),
      date: new Date().toLocaleDateString("fa-IR")
    }, ...trades]);
    setForm({ ...form, customer: "", amount: "" });
  };

  const wa = (t: Trade) => {
    const msg = encodeURIComponent(
      `صرافی برادران نورزاد هرات\nمعامله ${t.type}\nارز: ${t.currency}\nمقدار: ${Number(t.amount).toLocaleString("fa-IR")}\nمعادل افغانی: ${Number(t.afnValue).toLocaleString("fa-IR")}\nتاریخ: ${t.date}`
    );
    return `https://wa.me/${t.phone}?text=${msg}`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold">ثبت تبادل ارز</h1>

      <div className="card p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <input className="input" placeholder="نام مشتری" value={form.customer} onChange={e => setForm({ ...form, customer: e.target.value })} />
        <input className="input" placeholder="شماره واتساپ" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        <select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
          <option>خرید از مشتری</option>
          <option>فروش به مشتری</option>
        </select>
        <select className="input" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
          <option>دلار</option>
          <option>تومان</option>
          <option>یورو</option>
          <option>افغانی</option>
        </select>
        <input className="input" placeholder="مقدار" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
      </div>

      <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          معادل افغانی: <b className="text-[#c98f2d]">{afnValue.toLocaleString("fa-IR", { maximumFractionDigits: 0 })} افغانی</b>
        </p>
        <button className="btn-gold" onClick={add}>ثبت معامله</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#0b1f2e] text-[#e3b45c]">
            <tr>
              <th className="text-right px-4 py-3 font-bold">مشتری</th>
              <th className="text-right px-4 py-3 font-bold">نوع</th>
              <th className="text-right px-4 py-3 font-bold">مقدار</th>
              <th className="text-right px-4 py-3 font-bold">معادل افغانی</th>
              <th className="text-right px-4 py-3 font-bold">تاریخ</th>
              <th className="text-right px-4 py-3 font-bold">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {trades.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-slate-400">هنوز معامله‌ای ثبت نشده</td></tr>
            )}
            {trades.map(t => (
              <tr key={t.id} className="hover:bg-amber-50/40">
                <td className="px-4 py-3 font-bold">{t.customer}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-3 py-1 rounded-full ${t.type === "خرید از مشتری" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>
                    {t.type}
                  </span>
                </td>
                <td className="px-4 py-3">{Number(t.amount).toLocaleString("fa-IR")} {t.currency}</td>
                <td className="px-4 py-3 font-bold text-[#c98f2d]">{Number(t.afnValue).toLocaleString("fa-IR")}</td>
                <td className="px-4 py-3 text-slate-500">{t.date}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <a href={wa(t)} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700">واتساپ</a>
                    <button className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100" onClick={() => setTrades(trades.filter(x => x.id !== t.id))}>حذف</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
