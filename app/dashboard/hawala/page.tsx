"use client";

import { useState } from "react";
import { useStored, Field, SelectField, ErrorBox } from "../lib/ui";
import { loadRates, toAFN, fromAFN, fa, todayFa, checkRequired, requiredMessage, CURRENCIES, CITIES, statusChipClass } from "../lib/helpers";

interface Hawala { id:number; sender:string; receiver:string; phone:string; fromCity:string; toCity:string; payCur:string; getCur:string; amount:string; result:string; fee:string; date:string; status:string; }

const emptyForm = { sender:"", receiver:"", phone:"", fromCity:"هرات", toCity:"مشهد", payCur:"افغانی", getCur:"تومان", amount:"", fee:"0" };

export default function HawalaPage() {
  const [list, setList] = useStored<Hawala[]>("db_hawala", []);
  const [rates] = useState(loadRates());
  const [form, setForm] = useState(emptyForm);
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState("");

  const set = (patch: any) => { setForm({ ...form, ...patch }); setMissing([]); setError(""); };

  const result = fromAFN(Math.max(toAFN(Number(form.amount||0), form.payCur, rates) - Number(form.fee||0), 0), form.getCur, rates);

  const add = () => {
    const m = checkRequired(form, [{key:"sender",label:"نام فرستنده"},{key:"receiver",label:"نام گیرنده"},{key:"amount",label:"مبلغ"}]);
    if (m.length) { setMissing(m); setError(requiredMessage(m)); return; }
    setList([{ id:Date.now(), ...form, result:result.toFixed(0), date:todayFa(), status:"در انتظار" }, ...list]);
    setForm({ ...emptyForm });
  };

  const wa = (h: Hawala) => {
    const msg = encodeURIComponent(`صرافی برادران نورزاد هرات\nحواله از ${h.fromCity} به ${h.toCity}\nگیرنده: ${h.receiver}\nمبلغ قابل دریافت: ${fa(Number(h.result))} ${h.getCur}\nفرستنده: ${h.sender}`);
    return `https://wa.me/${h.phone}?text=${msg}`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold">ثبت حواله جدید</h1>

      <div className="card p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Field label="نام فرستنده" name="نام فرستنده" missing={missing} value={form.sender} onChange={v=>set({sender:v})} placeholder="مثال: احمد ولی" />
        <Field label="نام گیرنده" name="نام گیرنده" missing={missing} value={form.receiver} onChange={v=>set({receiver:v})} placeholder="مثال: کریم الله" />
        <Field label="شماره واتساپ گیرنده" value={form.phone} onChange={v=>set({phone:v})} placeholder="93... یا 989..." />
        <Field label="مبلغ" name="مبلغ" missing={missing} value={form.amount} onChange={v=>set({amount:v})} placeholder="مبلغ پرداختی" />
        <SelectField label="شهر مبدأ" value={form.fromCity} onChange={v=>set({fromCity:v})} options={CITIES} />
        <SelectField label="شهر مقصد" value={form.toCity} onChange={v=>set({toCity:v})} options={CITIES} />
        <SelectField label="ارز پرداخت" value={form.payCur} onChange={v=>set({payCur:v})} options={CURRENCIES} />
        <SelectField label="ارز دریافت" value={form.getCur} onChange={v=>set({getCur:v})} options={CURRENCIES} />
        <Field label="کارمزد (افغانی)" value={form.fee} onChange={v=>set({fee:v})} placeholder="0" />
        <div className="sm:col-span-2">
          <label className="block text-sm font-bold mb-2 invisible">-</label>
          <div className="flex items-center justify-between bg-[#0b1f2e] rounded-xl px-4 py-2.5">
            <span className="text-[#e3b45c] text-sm font-bold">قابل دریافت:</span>
            <span className="text-white font-extrabold">{fa(result)} {form.getCur}</span>
          </div>
        </div>
        <div className="flex items-end">
          <button className="btn-gold w-full" onClick={add}>ثبت حواله</button>
        </div>
        <div className="lg:col-span-4"><ErrorBox error={error} /></div>
      </div>

      <h1 className="text-xl font-extrabold pt-4">لیست حواله‌ها</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#0b1f2e] text-[#e3b45c]">
            <tr>
              {/* 🆕 ستون شماره */}
              <th className="text-center px-4 py-3 font-bold w-20">شماره</th>
              <th className="text-right px-4 py-3 font-bold">فرستنده</th>
              <th className="text-right px-4 py-3 font-bold">گیرنده</th>
              <th className="text-right px-4 py-3 font-bold">مسیر</th>
              <th className="text-right px-4 py-3 font-bold">دریافتی</th>
              <th className="text-right px-4 py-3 font-bold">وضعیت</th>
              <th className="text-right px-4 py-3 font-bold">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {/* 🆕 colSpan را از 6 به 7 تغییر دادیم */}
            {list.length===0 && <tr><td colSpan={7} className="text-center py-8 text-slate-400">هنوز حواله‌ای ثبت نشده</td></tr>}
            {/* 🆕 اضافه کردن index به map */}
            {list.map((h, index) => (
              <tr key={h.id} className="hover:bg-amber-50/40">
                {/* 🆕 ستون شماره با اعداد انگلیسی */}
                <td className="px-4 py-3 text-center font-mono font-bold text-[#0b1f2e]">
                  {(index + 1).toLocaleString("en-US")}
                </td>
                <td className="px-4 py-3 font-bold">{h.sender}</td>
                <td className="px-4 py-3">{h.receiver}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{h.fromCity} ← {h.toCity}</td>
                <td className="px-4 py-3 font-bold text-[#c98f2d]">{fa(Number(h.result))} {h.getCur}</td>
                <td className="px-4 py-3">
                  <select className={`text-xs px-2 py-1.5 rounded-full border ${statusChipClass(h.status)}`} value={h.status} onChange={e=>setList(list.map(x=>x.id===h.id?{...x,status:e.target.value}:x))}>
                    <option>در انتظار</option><option>ارسال شده</option><option>تحویل شده</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <a href={wa(h)} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold">واتساپ</a>
                    <button className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold" onClick={()=>setList(list.filter(x=>x.id!==h.id))}>حذف</button>
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
