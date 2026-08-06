"use client";

import { useState } from "react";
import { useStored, Field, SelectField, ErrorBox, Modal, ShareBar } from "../lib/ui";
import {
  loadRates, loadSiteName, loadJSON, fa, todayFa, nowTime, nextReceiptNo,
  CURRENCY_META, applyTransfer, applyExchange, buildReceipt, toAFNk, fromAFNk, statusChipClass,
} from "../lib/helpers";
import { sendTelegram } from "../lib/telegram";
import type { AccountUser, CurKey, Tx } from "../lib/helpers";

const curOptions: CurKey[] = ["AFN", "USD", "IRR"];

export default function TradesPage() {
  const [users, setUsers] = useStored<AccountUser[]>("db_users", [
    { id: 1, name: "احمد", phone: "93700000000", telegram: "", balances: { AFN: 300000, USD: 1200, IRR: 85000000 }, status: "فعال" },
  ] as any);
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
  const [sendingTg, setSendingTg] = useState(false);
  const [tgStatus, setTgStatus] = useState("");

  const user = users.find(u => u.id === Number(customerId)) as any;
  const amt = Number(amount || 0);
  const exchTo = fromAFNk(toAFNk(amt, fromCur, rates), toCur, rates);

  const clear = () => { setError(""); setTgStatus(""); };

  const submit = async () => {
    try {
      const m: string[] = [];
      if (!customerId) m.push("مشتری");
      if (!receiver.trim()) m.push("گیرنده");
      if (!amount.trim() || amt <= 0) m.push("مبلغ");
      if (m.length) { setError("لطفاً این فیلدها را پر کنید: " + m.join("، ")); return; }
      if (!user) { setError("مشتری پیدا نشد"); return; }

      let updated: any;
      let typeLabel: string;
      let curKey: CurKey;

      if (mode === "انتقال") {
        if ((user.balances[cur] || 0) < amt) {
          setError(`موجودی کافی نیست. مانده ${CURRENCY_META[cur].label}: ${fa(user.balances[cur] || 0)}`);
          return;
        }
        updated = applyTransfer(user, cur, amt);
        typeLabel = "انتقال " + CURRENCY_META[cur].label;
        curKey = cur;
      } else {
        if ((user.balances[fromCur] || 0) < amt) {
          setError(`موجودی کافی نیست. مانده ${CURRENCY_META[fromCur].label}: ${fa(user.balances[fromCur] || 0)}`);
          return;
        }
        updated = applyExchange(user, fromCur, toCur, amt, exchTo);
        typeLabel = `تبادل ${CURRENCY_META[fromCur].label} به ${CURRENCY_META[toCur].label}`;
        curKey = fromCur;
      }

      setUsers(users.map(u => u.id === updated.id ? updated : u));

      const receiptNo = nextReceiptNo();
      const date = todayFa();
      const time = nowTime();
      const amountLabel = mode === "انتقال"
        ? `${fa(amt)} ${CURRENCY_META[curKey].code}`
        : `${fa(amt)} ${CURRENCY_META[fromCur].code} → ${fa(exchTo)} ${CURRENCY_META[toCur].code}`;

      const siteName = loadSiteName() || "برادران نورزاد";
      const text = buildReceipt({
        receiptNo, customer: user.name, typeLabel, amountLabel, receiver,
        balances: updated.balances || { AFN: 0, USD: 0, IRR: 0 },
        date, time, siteName,
      });

      const tx: Tx = {
        id: Date.now(), receiptNo, typeLabel, customer: user.name, receiver,
        currency: CURRENCY_META[curKey].label, amount: amt,
        afnValue: String(toAFNk(amt, curKey, rates)),
        status: "موفق", date, time,
        balancesAfter: updated.balances || { AFN: 0, USD: 0, IRR: 0 },
        phone: user.phone || "",
      };
      setTrades([tx, ...trades]);

      // باز کردن واتساپ
      const phone = (user.phone || "").replace(/\D/g, "");
      if (phone) {
        try {
          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
        } catch (e) {
          console.error("WhatsApp open failed:", e);
        }
      }

      // ارسال خودکار به تلگرام مشتری
      try {
        const settings = loadJSON<any>("db_settings", {});
        const tgId = (user.telegram || "").trim();
        const tgToken = (settings.telegramToken || "").trim();

        if (tgToken && tgId) {
          setSendingTg(true);
          setTgStatus("📨 در حال ارسال به تلگرام مشتری...");
          const ok = await sendTelegram(tgToken, tgId, text);
          setSendingTg(false);
          if (ok) {
            setTgStatus("✅ رسید به تلگرام مشتری ارسال شد");
          } else {
            setTgStatus("⚠️ معامله ثبت شد ولی ارسال تلگرام ناموفق بود");
          }
        } else if (tgToken && !tgId) {
          setTgStatus("ℹ️ این مشتری chat_id تلگرام ندارد (رسید فقط در واتساپ)");
        } else {
          setTgStatus("ℹ️ ربات تلگرام در تنظیمات فعال نشده است");
        }
      } catch (e) {
        console.error("Telegram send error:", e);
        setTgStatus("⚠️ خطا در ارسال تلگرام");
      }

      setReceipt(text);
      setLastTx(tx);
      setAmount("");
      setReceiver("");
    } catch (e) {
      console.error("Submit error:", e);
      setError("خطای غیرمنتظره: " + String(e));
    }
  };

  const reopen = (t: Tx) => {
    try {
      const text = buildReceipt({
        receiptNo: t.receiptNo, customer: t.customer, typeLabel: t.typeLabel,
        amountLabel: `${fa(t.amount)} ${t.currency}`, receiver: t.receiver,
        balances: t.balancesAfter || { AFN: 0, USD: 0, IRR: 0 },
        date: t.date, time: t.time, siteName: loadSiteName() || "برادران نورزاد",
      });
      setReceipt(text);
      setLastTx(t);
    } catch (e) {
      setError("خطا در نمایش رسید: " + String(e));
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold">ثبت معامله (موتور خودکار)</h1>

      <div className="card p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-bold mb-2">مشتری</label>
          <select className="input" value={customerId} onChange={e => { setCustomerId(e.target.value); clear(); }}>
            <option value="">انتخاب مشتری</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.name} {(u as any).telegram ? "📨" : ""}
              </option>
            ))}
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
          <div className="sm:col-span-2 lg:col-span-4 bg-slate-50 rounded-xl p-3 text-xs text-slate-600 space-y-1">
            <p>مانده <b>{user.name}</b>: 🇦🇫 {fa(user.balances?.AFN || 0)} | 🇺🇸 {fa(user.balances?.USD || 0)} | 🇮🇷 {fa(user.balances?.IRR || 0)}</p>
            {(user as any).telegram && <p className="text-sky-600 font-bold">📨 رسید به تلگرام این مشتری ارسال می‌شود</p>}
            {mode === "تبادل" && amt > 0 && <p className="text-[#c98f2d] font-bold">معادل دریافتی: {fa(exchTo)} {CURRENCY_META[toCur].label}</p>}
          </div>
        )}

        <div className="lg:col-span-4"><ErrorBox error={error} /></div>
        {tgStatus && (
          <div className={`lg:col-span-4 text-sm rounded-xl p-3 ${tgStatus.startsWith("✅") ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : tgStatus.startsWith("⚠️") ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
            {tgStatus}
          </div>
        )}
        <div className="lg:col-span-4">
          <button className="btn-gold w-full" onClick={submit} disabled={sendingTg}>
            {sendingTg ? "⏳ در حال ارسال تلگرام..." : "ثبت معامله ✅"}
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#0b1f2e] text-[#e3b45c]">
            <tr>
              {/* 🆕 ستون شماره */}
              <th className="text-center px-4 py-3 font-bold w-20">شماره</th>
              <th className="text-right px-4 py-3 font-bold">رسید</th>
              <th className="text-right px-4 py-3 font-bold">مشتری</th>
              <th className="text-right px-4 py-3 font-bold">نوع</th>
              <th className="text-right px-4 py-3 font-bold">مبلغ</th>
              <th className="text-right px-4 py-3 font-bold">وضعیت</th>
              <th className="text-right px-4 py-3 font-bold">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {/* 🆕 colSpan را از 6 به 7 تغییر دادیم */}
            {trades.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate-400">هنوز معامله‌ای ثبت نشده</td></tr>}
            {/* 🆕 اضافه کردن index به map */}
            {trades.map((t, index) => (
              <tr key={t.id} className="hover:bg-amber-50/40">
                {/* 🆕 ستون شماره با اعداد انگلیسی */}
                <td className="px-4 py-3 text-center font-mono font-bold text-[#0b1f2e]">
                  {(index + 1).toLocaleString("en-US")}
                </td>
                <td className="px-4 py-3 font-bold text-[#c98f2d]">{t.receiptNo}</td>
                <td className="px-4 py-3 font-bold">{t.customer}</td>
                <td className="px-4 py-3">{t.typeLabel}</td>
                <td className="px-4 py-3">{fa(t.amount)} {t.currency}</td>
                <td className="px-4 py-3"><span className={`text-xs px-3 py-1 rounded-full border ${statusChipClass(t.status)}`}>{t.status}</span></td>
                <td className="px-4 py-3">
                  <button className="px-3 py-1.5 rounded-lg bg-sky-50 text-sky-600 text-xs font-bold" onClick={() => reopen(t)}>مشاهده رسید</button>
                </td>
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
