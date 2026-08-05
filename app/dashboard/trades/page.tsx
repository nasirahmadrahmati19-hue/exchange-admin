"use client";

import { useState } from "react";
import { useStored, Field, SelectField, ErrorBox, Modal, ShareBar } from "../lib/ui";
import { loadRates, toAFN, fa, todayFa, checkRequired, requiredMessage, statusChipClass } from "../lib/helpers";

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
  const [trades, setTrades] = useStored<Trade[]>("db_trades", []);
  const [rates] = useState(loadRates());
  const [form, setForm] = useState({ customer: "", phone: "", type: "خرید از مشتری", currency: "دلار", amount: "" });
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [shareTrade, setShareTrade] = useState<Trade | null>(null);

  const set = (patch: any) => { setForm({ ...form, ...patch }); setMissing([]); setError(""); };

  const afnValue = toAFN(Number(form.amount || 0), form.currency, rates);

  const add = () => {
    const m = checkRequired(form, [
      { key: "customer", label: "نام مشتری" },
      { key: "phone", label: "شماره واتساپ" },
      { key: "amount", label: "مقدار" },
    ]);
    if (m.length) { setMissing(m); setError(requiredMessage(m)); return; }
    setTrades([{ id: Date.now(), ...form, afnValue: afnValue.toFixed(0), date: todayFa() }, ...trades]);
    setForm({ ...form, customer: "", amount: "" });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold">ثبت تبادل ارز</h1>

      <div className="card p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Field label="نام مشتری" name="نام مشتری" missing={missing} value={form.customer} onChange={v => set({ customer: v })} />
        <Field label="شماره واتساپ" name="شماره واتساپ" missing={missing} value={form.phone} onChange={v => set({ phone: v })} placeholder="93... یا 989..." />
        <SelectField label="نوع معامله" value={form.type} onChange={v => set({ type: v })} options={["خرید از مشتری", "فروش به مشتری"]} />
        <SelectField label="ارز" value={form.currency} onChange={v => set({ currency: v })} options={["دلار", "تومان", "یورو", "افغانی"]} />
        <Field label="مقدار" name="مقدار" missing={missing} value={form.amount} onChange={v => set({ amount: v })} />
        <div className="lg:col-span-3 flex items-center gap-3 bg-[#0b1f2e] rounded-xl px-4 py-2.5">
          <span className="text-[#e3b45c] text-sm font-bold">معادل افغانی:</span>
          <span className="text-white font-extrabold">{fa(afnValue)} افغانی</span>
        </div>
        <div className="lg:col-span-2 flex items-center">
          <button className="btn-gold w-full" onClick={add}>ثبت معامله</button>
        </div>
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
                  <span className={`text-xs px-3 py-1 rounded-full border ${statusChipClass(t.type === "خرید از مشتری" ? "تأیید شده" : "ارسال شده")}`}>{t.type}</span>
                </td>
                <td className="px-4 py-3">{fa(Number(t.amount))} {t.currency}</td>
                <td className="px-4 py-3 font-bold text-[#c98f2d]">{fa(Number(t.afnValue))}</td>
                <td className="px-4 py-3 text-slate-500">{t.date}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button className="px-3 py-1.5 rounded-lg bg-sky-50 text-sky-600 text-xs font-bold hover:bg-sky-100" onClick={() => setShareTrade(t)}>اشتراک</button>
                    <button className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100" onClick={() => setTrades(trades.filter(x => x.id !== t.id))}>حذف</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {shareTrade && (
        <Modal title="اشتراک‌گذاری جزئیات معامله" onClose={() => setShareTrade(null)}>
          <div className="text-sm space-y-1 mb-4 bg-slate-50 rounded-xl p-4">
            <p><b>مشتری:</b> {shareTrade.customer}</p>
            <p><b>نوع:</b> {shareTrade.type}</p>
            <p><b>مقدار:</b> {fa(Number(shareTrade.amount))} {shareTrade.currency}</p>
            <p><b>معادل افغانی:</b> {fa(Number(shareTrade.afnValue))}</p>
            <p><b>تاریخ:</b> {shareTrade.date}</p>
          </div>
          <ShareBar
            text={`صرافی برادران نورزاد هرات\nمعامله ${shareTrade.type}\nمشتری: ${shareTrade.customer}\nارز: ${shareTrade.currency}\nمقدار: ${fa(Number(shareTrade.amount))}\nمعادل افغانی: ${fa(Number(shareTrade.afnValue))}\nتاریخ: ${shareTrade.date}`}
            phone={shareTrade.phone}
            pdfTitle="رسید معامله"
            pdfRows={[
              { label: "مشتری", value: shareTrade.customer },
              { label: "نوع معامله", value: shareTrade.type },
              { label: "ارز", value: shareTrade.currency },
              { label: "مقدار", value: fa(Number(shareTrade.amount)) },
              { label: "معادل افغانی", value: fa(Number(shareTrade.afnValue)) },
              { label: "تاریخ", value: shareTrade.date },
            ]}
          />
          <button className="mt-4 w-full rounded-xl border border-slate-200 py-2 text-sm font-bold" onClick={() => setShareTrade(null)}>بستن</button>
        </Modal>
      )}
    </div>
  );
}
