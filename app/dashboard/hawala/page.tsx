"use client";

import { useEffect, useState } from "react";

interface Hawala {
  id: number; sender: string; receiver: string; phone: string;
  fromCity: string; toCity: string; payCur: string; getCur: string;
  amount: string; result: string; fee: string; date: string; status: string;
}

const cities = ["هرات", "کابل", "اسلام‌قلعه", "مشهد", "تهران", "دوغارون"];
const currencies = ["افغانی", "تومان", "دلار", "یورو"];

export default function HawalaPage() {
  const [list, setList] = useState<Hawala[]>([]);
  const [rates, setRates] = useState({ usd: "70.5", eur: "76", toman: "0.64" });
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    sender: "", receiver: "", phone: "",
    fromCity: "هرات", toCity: "مشهد",
    payCur: "افغانی", getCur: "تومان",
    amount: "", fee: "0"
  });

  useEffect(() => {
    try {
      const h = localStorage.getItem("db_hawala");
      if (h) setList(JSON.parse(h));
      const r = localStorage.getItem("db_rates");
      if (r) setRates({ ...rates, ...JSON.parse(r) });
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem("db_hawala", JSON.stringify(list));
  }, [list]);

  const update = (patch: any) => {
    setForm({ ...form, ...patch });
    setMissing([]);
    setError("");
  };

  const fc = (name: string) => `input ${missing.includes(name) ? "!border-red-500" : ""}`;

  const toAFN = (amount: number, cur: string) => {
    if (cur === "تومان") return (amount / 1000) * Number(rates.toman);
    if (cur === "دلار") return amount * Number(rates.usd);
    if (cur === "یورو") return amount * Number(rates.eur);
    return amount;
  };

  const fromAFN = (afn: number, cur: string) => {
    if (cur === "تومان") return (afn / Number(rates.toman)) * 1000;
    if (cur === "دلار") return afn / Number(rates.usd);
    if (cur === "یورو") return afn / Number(rates.eur);
    return afn;
  };

  const amountNum = Number(form.amount || 0);
  const afnValue = toAFN(amountNum, form.payCur);
  const result = fromAFN(Math.max(afnValue - Number(form.fee || 0), 0), form.getCur);

  const add = () => {
    const m: string[] = [];
    if (!form.sender.trim()) m.push("نام فرستنده");
    if (!form.receiver.trim()) m.push("نام گیرنده");
    if (!form.amount.trim()) m.push("مبلغ");
    if (m.length > 0) {
      setMissing(m);
      setError("لطفاً این فیلدها را پر کنید: " + m.join("، "));
      return;
    }
    setMissing([]);
    setError("");
    setList([{
      id: Date.now(), ...form,
      result: result.toFixed(0),
      date: new Date().toLocaleDateString("fa-IR"),
      status: "در انتظار"
    }, ...list]);
    setForm({ ...form, sender: "", receiver: "", phone: "", amount: "", fee: "0" });
  };

  const setStatus = (id: number, status: string) => {
    setList(list.map(x => x.id === id ? { ...x, status } : x));
  };

  const wa = (h: Hawala) => {
    const msg = encodeURIComponent(
      `صرافی برادران نورزاد هرات\nحواله از ${h.fromCity} به ${h.toCity}\nگیرنده: ${h.receiver}\nمبلغ قابل دریافت: ${Number(h.result).toLocaleString("fa-IR")} ${h.getCur}\nفرستنده: ${h.sender}`
    );
    return `https://wa.me/${h.phone}?text=${msg}`;
  };

  const chip = (s: string) => {
    if (s === "در انتظار") return "bg-amber-50 text-amber-700 border-amber-200";
    if (s === "ارسال شده") return "bg-blue-50 text-blue-700 border-blue-200";
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold">ثبت حواله جدید</h1>

      <div className="card p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-bold mb-2">نام فرستنده</label>
          <input className={fc("نام فرستنده")} placeholder="مثال: احمد ولی" value={form.sender} onChange={e => update({ sender: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">نام گیرنده</label>
          <input className={fc("نام گیرنده")} placeholder="مثال: کریم الله" value={form.receiver} onChange={e => update({ receiver: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">شماره واتساپ گیرنده</label>
          <input className="input" placeholder="93... یا 989..." value={form.phone} onChange={e => update({ phone: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">مبلغ</label>
          <input className={fc("مبلغ")} placeholder="مبلغ پرداختی" value={form.amount} onChange={e => update({ amount: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">شهر مبدأ</label>
          <select className="input" value={form.fromCity} onChange={e => update({ fromCity: e.target.value })}>
            {cities.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">شهر مقصد</label>
          <select className="input" value={form.toCity} onChange={e => update({ toCity: e.target.value })}>
            {cities.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">ارز پرداخت</label>
          <select className="input" value={form.payCur} onChange={e => update({ payCur: e.target.value })}>
            {currencies.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">ارز دریافت</label>
          <select className="input" value={form.getCur} onChange={e => update({ getCur: e.target.value })}>
            {currencies.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">کارمزد (افغانی)</label>
          <input className="input" placeholder="0" value={form.fee} onChange={e => update({ fee: e.target.value })} />
        </div>
        <div className="sm:col-span-2 lg:col-span-2">
          <label className="block text-sm font-bold mb-2 invisible">-</label>
          <div className="flex items-center justify-between gap-3 bg-[#0b1f2e] rounded-xl px-4 py-2.5">
            <span className="text-[#e3b45c] text-sm font-bold">مبلغ قابل دریافت:</span>
            <span className="text-white font-extrabold">{result.toLocaleString("fa-IR", { maximumFractionDigits: 0 })} {form.getCur}</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold mb-2 invisible">-</label>
          <button className="btn-gold w-full" onClick={add}>ثبت حواله</button>
        </div>
        {error && (
          <div className="sm:col-span-2 lg:col-span-4 bg-red-50 text-red-600 text-sm rounded-xl p-3 border border-red-200">
            {error}
          </div>
        )}
      </div>

      <h1 className="text-xl font-extrabold pt-4">لیست حواله‌ها</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#0b1f2e] text-[#e3b45c]">
            <tr>
              <th className="text-right px-4 py-3 font-bold">فرستنده</th>
              <th className="text-right px-4 py-3 font-bold">گیرنده</th>
              <th className="text-right px-4 py-3 font-bold">مسیر</th>
              <th className="text-right px-4 py-3 font-bold">پرداختی</th>
              <th className="text-right px-4 py-3 font-bold">دریافتی</th>
              <th className="text-right px-4 py-3 font-bold">وضعیت</th>
              <th className="text-right px-4 py-3 font-bold">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-slate-400">هنوز حواله‌ای ثبت نشده است</td></tr>
            )}
            {list.map(h => (
              <tr key={h.id} className="hover:bg-amber-50/40">
                <td className="px-4 py-3 font-bold">{h.sender}</td>
                <td className="px-4 py-3">{h.receiver}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{h.fromCity} ← {h.toCity}</td>
                <td className="px-4 py-3">{Number(h.amount).toLocaleString("fa-IR")} {h.payCur}</td>
                <td className="px-4 py-3 font-bold text-[#c98f2d]">{Number(h.result).toLocaleString("fa-IR")} {h.getCur}</td>
                <td className="px-4 py-3">
                  <select className={`text-xs px-2 py-1.5 rounded-full border ${chip(h.status)}`} value={h.status} onChange={e => setStatus(h.id, e.target.value)}>
                    <option>در انتظار</option>
                    <option>ارسال شده</option>
                    <option>تحویل شده</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <a href={wa(h)} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700">واتساپ</a>
                    <button className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100" onClick={() => setList(list.filter(x => x.id !== h.id))}>حذف</button>
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
