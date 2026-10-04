"use client";

import { useEffect, useState } from "react";

interface W { id: number; user: string; amount: string; currency: string; date: string; status: string; }

const defaults: W[] = [
  { id: 1, user: "علی محمدی", amount: "0.5", currency: "BTC", date: "۱۴۰۵/۰۵/۱۲", status: "در انتظار" },
  { id: 2, user: "سارا احمدی", amount: "250000000", currency: "ریال", date: "۱۴۰/۰۵/۱", status: "تأیید شده" },
];

export default function WithdrawalsPage() {
  const [list, setList] = useState<W[]>(defaults);
  const [form, setForm] = useState({ user: "", amount: "", currency: "BTC" });

  useEffect(() => { const s = localStorage.getItem("db_withdrawals"); if (s) setList(JSON.parse(s)); }, []);
  useEffect(() => { localStorage.setItem("db_withdrawals", JSON.stringify(list)); }, [list]);

  const add = () => {
    if (!form.user || !form.amount) return;
    setList([{ id: Date.now(), ...form, date: new Date().toLocaleDateString("fa-IR"), status: "در انتظار" }, ...list]);
    setForm({ user: "", amount: "", currency: "BTC" });
  };

  const setStatus = (id: number, status: string) => setList(list.map(x => x.id === id ? { ...x, status } : x));

  const chip: Record<string, string> = {
    "در انتظار": "bg-amber-50 text-amber-700 border-amber-200",
    "تأیید شده": "bg-emerald-50 text-emerald-700 border-emerald-200",
    "رد شده": "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold">درخواست‌های برداشت</h1>

      <div className="card p-5 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <input className="input" placeholder="نام مشتری" value={form.user} onChange={e => setForm({ ...form, user: e.target.value })} />
        <input className="input" placeholder="مقدار" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
        <select className="input" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
          <option>BTC</option><option>ETH</option><option>USDT</option><option>ریال</option>
        </select>
        <button className="btn-gold" onClick={add}>ثبت درخواست</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#0b1f2e] text-[#e3b45c]">
            <tr>
              <th className="text-right px-5 py-3 font-bold">کاربر</th>
              <th className="text-right px-5 py-3 font-bold">مقدار</th>
              <th className="text-right px-5 py-3 font-bold">تاریخ</th>
              <th className="text-right px-5 py-3 font-bold">وضعیت</th>
              <th className="text-right px-5 py-3 font-bold">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map(w => (
              <tr key={w.id} className="hover:bg-amber-50/40">
                <td className="px-5 py-3 font-bold">{w.user}</td>
                <td className="px-5 py-3">{Number(w.amount).toLocaleString("fa-IR")} {w.currency}</td>
                <td className="px-5 py-3 text-slate-500">{w.date}</td>
                <td className="px-5 py-3"><span className={`text-xs px-3 py-1 rounded-full border ${chip[w.status]}`}>{w.status}</span></td>
                <td className="px-5 py-3">
                  {w.status === "در انتظار" && (
                    <div className="flex gap-2">
                      <button className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700" onClick={() => setStatus(w.id, "تأیید شده")}>تأیید</button>
                      <button className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700" onClick={() => setStatus(w.id, "رد شده")}>رد</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
