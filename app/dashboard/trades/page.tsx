"use client";

import { useState } from "react";
import { useStored, Field, SelectField, ErrorBox } from "../lib/ui";
import { loadRates, loadCommission, toAFN, fa, todayFa, checkRequired, requiredMessage, statusChipClass } from "../lib/helpers";

interface Trade { id:number; customer:string; phone:string; type:string; currency:string; amount:string; afnValue:string; date:string; }

export default function TradesPage() {
  const [trades, setTrades] = useStored<Trade[]>("db_trades", []);
  const [rates] = useState(loadRates());
  const [form, setForm] = useState({ customer:"", phone:"", type:"خرید از مشتری", currency:"دلار", amount:"" });
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState("");

  const set = (patch:any) => { setForm({...form, ...patch}); setMissing([]); setError(""); };
  const afnValue = toAFN(Number(form.amount||0), form.currency, rates);

  const add = () => {
    const m = checkRequired(form, [{key:"customer",label:"نام مشتری"},{key:"phone",label:"شماره واتساپ"},{key:"amount",label:"مقدار"}]);
    if (m.length){ setMissing(m); setError(requiredMessage(m)); return; }
    setTrades([{ id:Date.now(), ...form, afnValue:afnValue.toFixed(0), date:todayFa() }, ...trades]);
    setForm({...form, customer:"", amount:""});
  };

  const wa = (t:Trade) => {
    const msg = encodeURIComponent(`صرافی برادران نورزاد هرات\nمعامله ${t.type}\nارز: ${t.currency}\nمقدار: ${fa(Number(t.amount))}\nمعادل افغانی: ${fa(Number(t.afnValue))}\nتاریخ: ${t.date}`);
    return `https://wa.me/${t.phone}?text=${msg}`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold">ثبت تبادل ارز</h1>
      <div className="card p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Field label="نام مشتری" name="نام مشتری" missing={missing} value={form.customer} onChange={v=>set({customer:v})} />
        <Field label="شماره واتساپ" name="شماره واتساپ" missing={missing} value={form.phone} onChange={v=>set({phone:v})} placeholder="93... یا 989..." />
        <SelectField label="نوع معامله" value={form.type} onChange={v=>set({type:v})} options={["خرید از مشتری","فروش به مشتری"]} />
        <SelectField label="ارز" value={form.currency} onChange={v=>set({currency:v})} options={["دلار","تومان","یورو","افغانی"]} />
        <Field label="مقدار" name="مقدار" missing={missing} value={form.amount} onChange={v=>set({amount:v})} />
        <div className="lg:col-span-3 flex items-center gap-3 bg-[#0b1f2e] rounded-xl px-4 py-2.5">
          <span className="text-[#e3b45c] text-sm font-bold">معادل افغانی:</span>
          <span className="text-white font-extrabold">{fa(afnValue)} افغانی</span>
        </div>
        <div className="lg:col-span-2 flex items-center"><button className="btn-gold w-full" onClick={add}>ثبت معامله</button></div>
        <div className="lg:col-span-5"><ErrorBox error={error} /></div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#0b1f2e] text-[#e3b45c]">
            <tr>
              <th className="text-right px-4 py-3 font-bold">مشتری</th>
              <th className="text-right px-4 py-3 font-bold">نوع</th>
              <th className="text-right px-4 py-3 font-bold">مقدار</th>
              <th className="text-right px-4 py-3 font-bold">معادل افغانی</th>
              <th className="text-right px-4 py-3 font-bold">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {trades.length===0 && <tr><td colSpan={5} className="text-center py-8 text-slate-400">هنوز معامله‌ای ثبت نشده</td></tr>}
            {trades.map(t => (
              <tr key={t.id} className="hover:bg-amber-50/40">
                <td className="px-4 py-3 font-bold">{t.customer}</td>
                <td className="px-4 py-3"><span className={`text-xs px-3 py-1 rounded-full border ${statusChipClass(t.type==="خرید از مشتری"?"تأیید شده":"ارسال شده")}`}>{t.type}</span></td>
                <td className="px-4 py-3">{fa(Number(t.amount))} {t.currency}</td>
                <td className="px-4 py-3 font-bold text-[#c98f2d]">{fa(Number(t.afnValue))}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <a href={wa(t)} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold">واتساپ</a>
                    <button className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold" onClick={()=>setTrades(trades.filter(x=>x.id!==t.id))}>حذف</button>
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
