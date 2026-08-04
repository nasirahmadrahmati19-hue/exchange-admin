"use client";

import { useEffect, useState } from "react";

interface Trade { id: number; customer: string; phone: string; pair: string; type: string; amount: string; price: string; total: string; fee: string; date: string; }

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [commission, setCommission] = useState("0.5");
  const [form, setForm] = useState({ customer: "", phone: "", pair: "BTC/USDT", type: "خرید", amount: "", price: "" });

  useEffect(() => {
    const t = localStorage.getItem("db_trades"); if (t) setTrades(JSON.parse(t));
    const s = localStorage.getItem("db_settings"); if (s) { try { setCommission(JSON.parse(s).commission || "0.5"); } catch {} }
  }, []);
  useEffect(() => { localStorage.setItem("db_trades", JSON.stringify(trades)); }, [trades]);

  const total = (Number(form.amount || 0) * Number(form.price || 0));
  const fee = total * (Number(commission) / 100);

  const add = () => {
    if (!form.customer || !form.amount || !form.price) return;
    setTrades([{ id: Date.now(), ...form, total: total.toFixed(2), fee: fee.toFixed(2), date: new Date().toLocaleDateString("fa-IR") }, ...trades]);
    setForm({ ...form, customer: "", amount: "", price: "" });
  };

  const wa = (t: Trade) => {
    const msg = encodeURIComponent(`سلام ${t.customer} عزیز 🌹\nمعامله ${t.type} ${t.pair}\nمقدار: ${t.amount}\nقیمت: ${t.price}\nجمع: ${t.total} دلار\nکارمزد: ${t.fee} دلار\nصرافی برادران نورزاد`);
    return `https://wa.me/${t.phone}?text=${msg}`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold">ثبت معاملات</h1>

      <div className="card p-5 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <input className="input" placeholder="نام مشتری" value={form.customer} onChange={e => setForm({ ...form, customer: e.target.value })} />
        <input className="input" placeholder="شماره واتساپ (989...)" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        <select className="input" value={form.pair} onChange={e => setForm({ ...form, pair: e.target.value })}>
          <option>BTC/USDT</option><option>ETH/USDT</option><option>BNB/USDT</option>
        </select>
        <select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
          <option>خرید</option><option>فروش</option>
        </select>
        <input className="input" placeholder="مقدار" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
        <input className="input" placeholder="قیمت" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
      </div>

      <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">جمع: <b className="text-[#c98f2d]">{total.toLocaleString("fa-IR")}</b> دلار — کارمزد: <b>{fee.toLocaleString("fa-IR")}</b> دلار</p>
        <button className="btn-gold" onClick={add}>ثبت معامله</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#0b1f2e] text-[#e3b45c]">
            <tr>
              <th className="text-right px-4 py-3 font-bold">مشتری</th>
              <th className="text-right px-4 py-3 font-bold">نوع</th>
              <th className="text-right px-4 py-3 font-bold">جمع (دلار)</th>
              <th className="text-right px-4 py-3 font-bold">تاریخ</th>
              <th className="text-right px-4 py-3 font-bold">واتساپ</th>
              <th className="text-right px-4 py-3 font-bold">حذف</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {trades.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-400">هنوز معامله‌ای ثبت نشده است</td></tr>}
            {trades.map(t => (
              <tr key={t.id} className="hover:bg-amber-50/40">
                <td className="px-4 py-3 font-bold">{t.customer}</td>
                <td className="px-4 py-3"><span className={`text-xs px-3 py-1 rounded-full ${t.type === "خرید" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{t.type}</span></td>
                <td className="px-4 py-3">{Number(t.total).toLocaleString("fa-IR")}</td>
                <td className="px-4 py-3 text-slate-500">{t.date}</td>
                <td className="px-4 py-3">
                  <a href={wa(t)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700">📱 ارسال به واتساپ</a>
                </td>
                <td className="px-4 py-3">
                  <button className="text-red-600 text-xs hover:underline" onClick={() => setTrades(trades.filter(x => x.id !== t.id))}>حذف</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
