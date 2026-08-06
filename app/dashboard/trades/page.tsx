"use client";

import { useState } from "react";
import { useStored, Field, SelectField, ErrorBox, Modal, ShareBar } from "../lib/ui";
import {
  loadRates, loadSiteName, fa, todayFa, nowTime, nextReceiptNo,
  CURRENCY_META, emptyBalances, applyTransfer, applyExchange, buildReceipt, toAFNk, fromAFNk, statusChipClass,
} from "../lib/helpers";
import type { AccountUser, CurKey, Tx } from "../lib/helpers";

const curOptions: CurKey[] = ["AFN", "USD", "IRR"];

export default function TradesPage() {
  const [users, setUsers] = useStored<AccountUser[]>("db_users", [
    { id: 1, name: "احمد", phone: "93700000000", balances: { AFN: 300000, USD: 1200, IRR: 85000000 }, status: "فعال" },
  ]);
  const [trades, setTrades] = useStored<Tx[]>("db_trades", []);
  const [rates] = useState(loadRates());

  const [customerId, setCustomerId] = useState("");
  const [mode, setMode] = useState("انتقال");
  const [cur, setCur] = useState<CurKey>("AFN");
  const [fromCur, setFromCur] = useState<CurKey>("AFN");
  const [toCur, setToCur] = useState<CurKey>("IRR");
  const [receiver, setReceiver] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const [lastTx, setLastTx] = useState<Tx | null>(null);

  const user = users.find(u => u.id === Number(customerId));
  const amt = Number(amount || 0);
  const exchTo = fromAFNk(toAFNk(amt, fromCur, rates), toCur, rates);

  const clear = () => { setError(""); };

  const submit = () => {
    const m: string[] = [];
    if (!customerId) m.push("مشتری");
    if (!receiver.trim()) m.push("گیرنده");
    if (!amount.trim()) m.push("مبلغ");
    if (m.length) { setError(requiredMessageLocal(m)); return; }
    if (!user) { setError("مشتری پیدا نشد"); return; }

    let updated: AccountUser; let typeLabel: string; let curKey: CurKey;
    if (mode === "انتقال") {
      if ((user.balances[cur] || 0) < amt) { setError(`موجودی کافی نیست. مانده ${CURRENCY_META[cur].label}: ${fa(user.balances[cur] || 0)}`); return; }
      updated = applyTransfer(user, cur, amt);
      typeLabel = "انتقال " + CURRENCY_META[cur].label;
      curKey = cur;
    } else {
      if ((user.balances[fromCur] || 0) < amt) { setError(`موجودی کافی نیست. مانده ${CURRENCY_META[fromCur].label}: ${fa(user.balances[fromCur] || 0)}`); return; }
      updated = applyExchange(user, fromCur, toCur, amt, exchTo);
      typeLabel = `تبادل ${CURRENCY_META[fromCur].label} به ${CURRENCY_META[toCur].label}`;
      curKey = fromCur;
    }

    setUsers(users.map(u => u.id === updated.id ? updated : u));

    const receiptNo = nextReceiptNo();
    const date = todayFa(); const time = nowTime();
    const amountLabel = mode === "انتقال" ? `${fa(amt)} ${CURRENCY_META[curKey].code}` : `${fa(amt)} ${CURRENCY_META[fromCur].code} → ${fa(exchTo)} ${CURRENCY_META[toCur].code}`;
    const text = buildReceipt({ receiptNo, customer: user.name, typeLabel, amountLabel, receiver, balances: updated.balances, date, time, siteName: loadSiteName() });

    const tx: Tx = {
      id: Date.now(), receiptNo, typeLabel, customer: user.name, receiver,
      currency: CURRENCY_META[curKey].label, amount: amt, afnValue: String(toAFNk(amt, curKey, rates)),
      status: "موفق", date, time, balancesAfter: updated.balances, phone: user.phone,
    };
    setTrades([tx, ...trades]);

    window.open(`https://wa.me/${user.phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`, "_blank");
    setReceipt(text); setLastTx(tx);
    setAmount(""); setReceiver("");
  };

  const requiredMessageLocal = (m: string[]) => "لطفاً این فیلدها را پر کنید: " + m.join("، ");

  const reopen = (t: Tx) => {
    const text = buildReceipt({ receiptNo: t.receiptNo, customer: t.customer, typeLabel: t.typeLabel, amountLabel: `${fa(t.amount)} ${t.currency}`, receiver: t.receiver, balances: t.balancesAfter, date: t.date, time: t.time, siteName: loadSiteName() });
    setReceipt(text); setLastTx(t);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold">ثبت معامله (موتور خودکار)</h1>

      <div className="card p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-bold mb-2">مشتری</label>
          <select className="input" value={customerId} onChange={e => { setCustomerId(e.target.value); clear(); }}>
            <option value="">انتخاب مشتری</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <SelectField label="نوع معامله" value={mode} onChange={v => setMode(v)} options={["انتقال", "تبادل"]} />
        {mode === "انتقال" ? (
          <SelectField label="ارز انتقال" value={cur} onChange={v => setCur(v as CurKey)} options={curOptions as any} />
        ) : (
          <>
            <SelectField label="از ارز" value={fromCur} onChange={v => setFromCur(v as CurKey)} options={curOptions as any} />
            <SelectField label="به ارز" value={toCur} onChange={v => setToCur(v as CurKey)} options={curOptions as any} />
          </>
        )}
        <Field label="گیرنده" value={receiver} onChange={v => { setReceiver(v); clear(); }} placeholder="نام گیرنده" />
        <Field label="مبلغ" value={amount} onChange={v => { setAmount(v); clear(); }} placeholder="مقدار" />
        {user && (
          <div className="sm:col-span-2 lg:col-span-4 bg-slate-50 rounded-xl p-3 text-xs text-slate-600">
            مانده {user.name}: 🇦 {fa(user.balances.AFN)} | 🇺🇸 {fa(user.balances.USD)} | 🇮🇷 {fa(user.balances.IRR)}
            {mode === "تبادل" && amt > 0 && <span className="mr-3 text-[#c98f2d] font-bold">معادل دریافتی: {fa(exchTo)} {CURRENCY_META[toCur].label}</span>}
          </div>
        )}
        <div className="lg:col-span-4"><ErrorBox error={error} /></div>
        <div className="lg:col-span-4"><button className="btn-gold w-full" onClick={submit}>ثبت معامله ✅</button></div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#0b1f2e] text-[#e3b45c]">
            <tr>
              <th className="text-right px-4 py-3 font-bold">رسید</th>
              <th className="text-right px-4 py-3 font-bold">مشتری</th>
              <th className="text-right px-4 py-3 font-bold">نوع</th>
              <th className="text-right px-4 py-3 font-bold">مبلغ</th>
              <th className="text-right px-4 py-3 font-bold">وضعیت</th>
              <th className="text-right px-4 py-3 font-bold">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {trades.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-400">هنوز معامله‌ای ثبت نشده</td></tr>}
            {trades.map(t => (
              <tr key={t.id} className="hover:bg-amber-50/40">
                <td className="px-4 py-3 font-bold text-[#c98f2d]">{t.receiptNo}</td>
                <td className="px-4 py-3 font-bold">{t.customer}</td>
                <td className="px-4 py-3">{t.typeLabel}</td>
                <td className="px-4 py-3">{fa(t.amount)} {t.currency}</td>
                <td className="px-4 py-3"><span className={`text-xs px-3 py-1 rounded-full border ${statusChipClass(t.status)}`}>{t.status}</span></td>
                <td className="px-4 py-3"><button className="px-3 py-1.5 rounded-lg bg-sky-50 text-sky-600 text-xs font-bold" onClick={() => reopen(t)}>مشاهده رسید</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {receipt && lastTx && (
        <Modal title={`رسید ${lastTx.receiptNo}`} onClose={() => setReceipt("")}>
          <pre className="whitespace-pre-wrap text-sm bg-slate-50 rounded-xl p-4 leading-6">{receipt}</pre>
          <div className="mt-4">
            <ShareBar text={receipt} phone={lastTx.phone} pdfTitle={`رسید ${lastTx.receiptNo}`}
              pdfRows={[
                { label: "شماره رسید", value: lastTx.receiptNo },
                { label: "مشتری", value: lastTx.customer },
                { label: "نوع", value: lastTx.typeLabel },
                { label: "گیرنده", value: lastTx.receiver },
                { label: "تاریخ", value: lastTx.date + " " + lastTx.time },
              ]} />
          </div>
          <button className="mt-4 w-full rounded-xl border border-slate-200 py-2 text-sm font-bold" onClick={() => setReceipt("")}>بستن</button>
        </Modal>
      )}
    </div>
  );
}
