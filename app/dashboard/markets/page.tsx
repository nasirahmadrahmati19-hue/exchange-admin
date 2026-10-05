"use client";

import { useEffect, useState } from "react";

interface Market { id: number; pair: string; price: string; change: string; }

const defaults: Market[] = [
  { id: 1, pair: "BTC/USDT", price: "45230", change: "+2.4" },
  { id: 2, pair: "ETH/USDT", price: "3102", change: "-1.1" },
  { id: 3, pair: "BNB/USDT", price: "320", change: "+0.8" },
];

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>(defaults);
  const [form, setForm] = useState({ pair: "", price: "", change: "" });

  useEffect(() => { const s = localStorage.getItem("db_markets"); if (s) setMarkets(JSON.parse(s)); }, []);
  useEffect(() => { localStorage.setItem("db_markets", JSON.stringify(markets)); }, [markets]);

  const add = () => {
    if (!form.pair || !form.price) return;
    setMarkets([{ id: Date.now(), ...form }, ...markets]);
    setForm({ pair: "", price: "", change: "" });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold">بازارها</h1>

      <div className="card p-5 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <input className="input" placeholder="جفت ارز (مثلاً XRP/USDT)" value={form.pair} onChange={e => setForm({ ...form, pair: e.target.value })} />
        <input className="input" placeholder="قیمت" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
        <input className="input" placeholder="تغییر ٪ (مثلاً +1.2)" value={form.change} onChange={e => setForm({ ...form, change: e.target.value })} />
        <button className="btn-gold" onClick={add}>افزودن بازار</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {markets.map(m => (
          <div key={m.id} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="font-extrabold" dir="ltr">{m.pair}</p>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${m.change.startsWith("-") ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>{m.change}٪</span>
            </div>
            <p className="text-2xl font-extrabold text-[#c98f2d]">{Number(m.price).toLocaleString("fa-IR")}</p>
            <div className="flex gap-2 mt-4">
              <input className="input" placeholder="قیمت جدید" defaultValue={m.price} onBlur={e => setMarkets(markets.map(x => x.id === m.id ? { ...x, price: e.target.value } : x))} />
              <button className="px-3 rounded-xl text-red-600 hover:bg-red-50 text-xs font-bold" onClick={() => setMarkets(markets.filter(x => x.id !== m.id))}>حذف</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
