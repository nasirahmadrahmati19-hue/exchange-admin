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
  const [internalReceiverId, setInternalReceiverId] = useState("");

  const user = users.find(u => u.id === Number(customerId)) as any;
  const amt = Number(amount || 0);
  const exchTo = fromAFNk(toAFNk(amt, fromCur, rates), toCur, rates);

  const clear = () => { setError(""); setTgStatus(""); };

  const submit = async () => {
    try {
      // ========== حالت حساب به حساب ==========
      if (mode === "حساب به حساب") {
        if (!customerId || !internalReceiverId || !amount.trim() || amt <= 0) {
          setError("لطفاً فرستنده، گیرنده و مبلغ را وارد کنید"); return;
        }
        if (!user) { setError("فرستنده پیدا نشد"); return; }
        const receiverUser = users.find(u => u.id === Number(internalReceiverId)) as any;
        if (!receiverUser) { setError("گیرنده پیدا نشد"); return; }
        if (user.id === receiverUser.id) { setError("فرستنده و گیرنده نمی‌توانند یک نفر باشند"); return; }
        if ((user.balances[fromCur] || 0) < amt) {
          setError(`موجودی کافی نیست. مانده ${CURRENCY_META[fromCur].label}: ${fa(user.balances[fromCur] || 0)}`); return;
        }

        const senderBalancesBefore = { ...user.balances };
        const receiverBalancesBefore = { ...receiverUser.balances };

        const senderUpdated = applyTransfer(user, fromCur, amt);
        const receiverAmount = fromCur === toCur ? amt : fromAFNk(toAFNk(amt, fromCur, rates), toCur, rates);
        const receiverUpdated = { ...receiverUser, balances: { ...receiverUser.balances, [toCur]: (receiverUser.balances[toCur] || 0) + receiverAmount } };

        setUsers(users.map(u => u.id === user.id ? senderUpdated : u.id === receiverUser.id ? receiverUpdated : u));

        const receiptNo = nextReceiptNo();
        const receiptNoClean = receiptNo.replace("#", "");
        const date = todayFa(), time = nowTime();
        const siteName = loadSiteName() || "برادران نورزاد";
        const amountLabel = fromCur === toCur
          ? `${fa(amt)} ${CURRENCY_META[fromCur].code}`
          : `${fa(amt)} ${CURRENCY_META[fromCur].code} → ${fa(receiverAmount)} ${CURRENCY_META[toCur].code}`;

        // ✅ ساخت رسید برای فرستنده (بدون commission و serviceFee)
        const senderText = buildReceipt({
          receiptNo,
          customer: user.name,
          typeLabel: `انتقال داخلی به ${receiverUser.name}`,
          amountLabel,
          receiver: receiverUser.name,
          balances: senderUpdated.balances || { AFN: 0, USD: 0, IRR: 0 },
          balancesBefore: senderBalancesBefore,
          deductedAmount: amt,
          deductedCurrency: CURRENCY_META[fromCur].label,
          exchangeRate: fromCur !== toCur ? fa(fromAFNk(toAFNk(1, fromCur, rates), toCur, rates)) : "—",
          description: `انتقال ${amountLabel} به ${receiverUser.name}`,
          date, time, siteName,
        });

        // ✅ ساخت رسید برای گیرنده (بدون commission و serviceFee)
        const receiverText = buildReceipt({
          receiptNo,
          customer: receiverUser.name,
          typeLabel: `دریافت داخلی از ${user.name}`,
          amountLabel: `${fa(receiverAmount)} ${CURRENCY_META[toCur].code}`,
          receiver: user.name,
          balances: receiverUpdated.balances || { AFN: 0, USD: 0, IRR: 0 },
          balancesBefore: receiverBalancesBefore,
          description: `دریافت ${fa(receiverAmount)} ${CURRENCY_META[toCur].label} از ${user.name}`,
          date, time, siteName,
        });

        const senderTx: Tx = {
          id: Date.now(), receiptNo: `#${receiptNoClean}-A`,
          typeLabel: `انتقال داخلی به ${receiverUser.name}`,
          customer: user.name, receiver: receiverUser.name,
          currency: CURRENCY_META[fromCur].label, amount: amt,
          afnValue: String(toAFNk(amt, fromCur, rates)),
          status: "موفق", date, time,
          balancesAfter: senderUpdated.balances || { AFN: 0, USD: 0, IRR: 0 },
          phone: user.phone || "",
        };
        const receiverTx: Tx = {
          id: Date.now() + 1, receiptNo: `#${receiptNoClean}-B`,
          typeLabel: `دریافت داخلی از ${user.name}`,
          customer: receiverUser.name, receiver: user.name,
          currency: CURRENCY_META[toCur].label, amount: receiverAmount,
          afnValue: String(toAFNk(receiverAmount, toCur, rates)),
          status: "موفق", date, time,
          balancesAfter: receiverUpdated.balances || { AFN: 0, USD: 0, IRR: 0 },
          phone: receiverUser.phone || "",
        };
        setTrades([receiverTx, senderTx, ...trades]);

        const phone1 = (user.phone || "").replace(/\D/g, "");
        if (phone1) try { window.open(`https://wa.me/${phone1}?text=${encodeURIComponent(senderText)}`, "_blank"); } catch {}

        try {
          const settings = loadJSON<any>("db_settings", {});
          const tgToken = (settings.telegramToken || "").trim();
          const silent = settings.telegramSilent === true;
          if (tgToken) {
            setSendingTg(true);
            const results: string[] = [];
            const senderTgId = (user.telegram || "").trim();
            if (senderTgId) {
              const ok = await sendTelegram(tgToken, senderTgId, senderText, { silent });
              results.push(ok ? `✅ ${user.name}` : `⚠️ ${user.name}`);
            }
            const receiverTgId = (receiverUser.telegram || "").trim();
            if (receiverTgId) {
              const ok = await sendTelegram(tgToken, receiverTgId, receiverText, { silent });
              results.push(ok ? `✅ ${receiverUser.name}` : `⚠️ ${receiverUser.name}`);
            }
            setSendingTg(false);
            setTgStatus(results.length > 0 ? "🧾 تلگرام: " + results.join(" | ") : "ℹ️ chat_id یافت نشد");
          } else {
            setSendingTg(false);
            setTgStatus("ℹ️ ربات تلگرام فعال نشده");
          }
        } catch { setSendingTg(false); setTgStatus("⚠️ خطا در ارسال تلگرام"); }

        setReceipt(senderText); setLastTx(senderTx); setAmount(""); setInternalReceiverId("");
        return;
      }

      // ========== حالت انتقال / تبادل ==========
      if (!customerId || !receiver.trim() || !amount.trim() || amt <= 0) {
        setError("لطفاً مشتری، گیرنده و مبلغ را وارد کنید"); return;
      }
      if (!user) { setError("مشتری پیدا نشد"); return; }

      const balancesBefore = { ...user.balances };

      let updated: any, typeLabel: string, curKey: CurKey;
      if (mode === "انتقال") {
        if ((user.balances[cur] || 0) < amt) {
          setError(`موجودی کافی نیست. مانده ${CURRENCY_META[cur].label}: ${fa(user.balances[cur] || 0)}`); return;
        }
        updated = applyTransfer(user, cur, amt);
        typeLabel = "انتقال " + CURRENCY_META[cur].label;
        curKey = cur;
      } else {
        if ((user.balances[fromCur] || 0) < amt) {
          setError(`موجودی کافی نیست. مانده ${CURRENCY_META[fromCur].label}: ${fa(user.balances[fromCur] || 0)}`); return;
        }
        updated = applyExchange(user, fromCur, toCur, amt, exchTo);
        typeLabel = `تبادل ${CURRENCY_META[fromCur].label} به ${CURRENCY_META[toCur].label}`;
        curKey = fromCur;
      }

      setUsers(users.map(u => u.id === updated.id ? updated : u));

      const receiptNo = nextReceiptNo();
      const date = todayFa(), time = nowTime();
      const amountLabel = mode === "انتقال"
        ? `${fa(amt)} ${CURRENCY_META[curKey].code}`
        : `${fa(amt)} ${CURRENCY_META[fromCur].code} → ${fa(exchTo)} ${CURRENCY_META[toCur].code}`;
      const siteName = loadSiteName() || "برادران نورزاد";

      // ✅ ساخت رسید (بدون commission و serviceFee)
      const text = buildReceipt({
        receiptNo,
        customer: user.name,
        typeLabel,
        amountLabel,
        receiver,
        balances: updated.balances || { AFN: 0, USD: 0, IRR: 0 },
        balancesBefore,
        deductedAmount: amt,
        deductedCurrency: mode === "انتقال" ? CURRENCY_META[curKey].label : CURRENCY_META[fromCur].label,
        exchangeRate: mode === "تبادل" ? fa(fromAFNk(toAFNk(1, fromCur, rates), toCur, rates)) : "—",
        description: mode === "انتقال"
          ? `انتقال مبلغ ${fa(amt)} ${CURRENCY_META[curKey].label} به گیرنده`
          : `تبادل ${fa(amt)} ${CURRENCY_META[fromCur].label} به ${fa(exchTo)} ${CURRENCY_META[toCur].label}`,
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

      const phone = (user.phone || "").replace(/\D/g, "");
      if (phone) try { window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank"); } catch {}

      try {
        const settings = loadJSON<any>("db_settings", {});
        const tgId = (user.telegram || "").trim();
        const tgToken = (settings.telegramToken || "").trim();
        const silent = settings.telegramSilent === true;
        if (tgToken && tgId) {
          setSendingTg(true);
          const ok = await sendTelegram(tgToken, tgId, text, { silent });
          setSendingTg(false);
          setTgStatus(ok ? "🧾 رسید به تلگرام ارسال شد" : "⚠️ ارسال ناموفق");
        } else {
          setSendingTg(false);
          setTgStatus(tgId ? "ℹ️ توکن ربات تنظیم نشده" : "ℹ️ مشتری chat_id ندارد");
        }
      } catch { setSendingTg(false); setTgStatus("⚠️ خطا در ارسال تلگرام"); }

      setReceipt(text); setLastTx(tx); setAmount(""); setReceiver("");
    } catch (e) { setError("خطای غیرمنتظره: " + String(e)); }
  };

  const reopen = (t: Tx) => {
    try {
      const text = buildReceipt({
        receiptNo: t.receiptNo, customer: t.customer, typeLabel: t.typeLabel,
        amountLabel: `${fa(t.amount)} ${t.currency}`, receiver: t.receiver,
        balances: t.balancesAfter || { AFN: 0, USD: 0, IRR: 0 },
        date: t.date, time: t.time,
        siteName: loadSiteName() || "برادران نورزاد",
      });
      setReceipt(text); setLastTx(t);
    } catch (e) { setError("خطا در نمایش رسید: " + String(e)); }
  };

  const internalReceiver = users.find(u => u.id === Number(internalReceiverId)) as any;
  const internalReceiverAmount = user && internalReceiver && amt > 0
    ? (fromCur === toCur ? amt : fromAFNk(toAFNk(amt, fromCur, rates), toCur, rates)) : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold">ثبت معامله (موتور خودکار)</h1>

      <div className="card p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-bold mb-2">{mode === "حساب به حساب" ? "فرستنده" : "مشتری"}</label>
          <select className="input" value={customerId} onChange={e => { setCustomerId(e.target.value); clear(); }}>
            <option value="">انتخاب مشتری</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name} {(u as any).telegram ? "📨" : ""}</option>)}
          </select>
        </div>

        <SelectField label="نوع معامله" value={mode}
          onChange={v => { setMode(v); clear(); if (v === "حساب به حساب") { setInternalReceiverId(""); setFromCur("AFN"); setToCur("AFN"); } }}
          options={["انتقال", "تبادل", "حساب به حساب"]} />

        {mode === "حساب به حساب" ? (
          <>
            <SelectField label="از ارز (فرستنده)" value={fromCur} onChange={v => setFromCur(v as CurKey)} options={curOptions as any} />
            <div>
              <label className="block text-sm font-bold mb-2">مشتری گیرنده</label>
              <select className="input" value={internalReceiverId} onChange={e => setInternalReceiverId(e.target.value)}>
                <option value="">انتخاب گیرنده</option>
                {users.filter(u => u.id !== user?.id).map(u => <option key={u.id} value={u.id}>{u.name} - {u.phone}</option>)}
              </select>
            </div>
            <SelectField label="به ارز (گیرنده)" value={toCur} onChange={v => setToCur(v as CurKey)} options={curOptions as any} />
            <Field label="مبلغ" value={amount} onChange={v => { setAmount(v); clear(); }} placeholder="مقدار" />
            {user && internalReceiver && amt > 0 && (
              <div className="sm:col-span-2 lg:col-span-4 bg-gradient-to-r from-[#0b1f2e] to-[#0f2839] rounded-xl p-4 text-white space-y-2">
                <p className="text-[#e3b45c] font-bold text-sm">💱 پیش‌نمایش انتقال داخلی</p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-slate-300">کسر از <b>{user.name}</b>:</p>
                    <p className="text-red-300 font-bold text-base">-{fa(amt)} {CURRENCY_META[fromCur].label}</p>
                  </div>
                  <div>
                    <p className="text-slate-300">افزودن به <b>{internalReceiver.name}</b>:</p>
                    <p className="text-emerald-300 font-bold text-base">+{fa(internalReceiverAmount)} {CURRENCY_META[toCur].label}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
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
                {mode === "تبادل" && amt > 0 && <p className="text-[#c98f2d] font-bold">معادل دریافتی: {fa(exchTo)} {CURRENCY_META[toCur].label}</p>}
              </div>
            )}
          </>
        )}

        <div className="lg:col-span-4"><ErrorBox error={error} /></div>
        {tgStatus && (
          <div className={`lg:col-span-4 text-sm rounded-xl p-3 ${tgStatus.startsWith("✅") || tgStatus.startsWith("🧾") ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : tgStatus.startsWith("⚠️") ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
            {tgStatus}
          </div>
        )}
        <div className="lg:col-span-4">
          <button className="btn-gold w-full" onClick={submit} disabled={sendingTg}>
            {sendingTg ? "⏳ در حال ارسال..." : mode === "حساب به حساب" ? "ثبت انتقال داخلی ✅" : "ثبت معامله ✅"}
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#0b1f2e] text-[#e3b45c]">
            <tr>
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
            {trades.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate-400">هنوز معامله‌ای ثبت نشده</td></tr>}
            {trades.map((t, index) => (
              <tr key={t.id} className="hover:bg-amber-50/40">
                <td className="px-4 py-3 text-center font-mono font-bold text-[#0b1f2e]">{(index + 1).toLocaleString("en-US")}</td>
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
