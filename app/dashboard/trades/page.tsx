"use client";

import { useEffect, useMemo, useState } from "react";

type ExchangeType = "صرافی-مشتری" | "بین-مشتریان";

type BaseTransaction = {
  id: string;
  type: ExchangeType;
  date: string;
  terms: string;
  note: string;
  status: "active" | "voided";
};

type ExchangeTransaction = BaseTransaction & {
  type: "صرافی-مشتری";
  customerId: string;
  receivedCurrency: string;
  receivedAmount: number;
  paidCurrency: string;
  paidAmount: number;
  rate: number;
  rateBaseCurrency: string;
  profit: number;
  profitCurrency: string;
};

type TransferTransaction = BaseTransaction & {
  type: "بین-مشتریان";
  senderId: string;
  receiverId: string;
  senderCurrency: string;
  senderAmount: number;
  receiverCurrency: string;
  receiverAmount: number;
  rate: number;
  rateBaseCurrency: string;
  commission: number;
  commissionCurrency: string;
};

type Transaction = ExchangeTransaction | TransferTransaction;
type Customer = { id: string; name: string; balances: Record<string, number> };

const currencies = ["AFN", "USD", "IRR", "PKR"];
const currencyLabels: Record<string, string> = {
  AFN: "افغانی",
  USD: "دالر",
  IRR: "تومان",
  PKR: "کلدار",
};

// واحد مبنا برای نرخ: تومان همیشه بر اساس 1000 تومان است.
const rateUnits: Record<string, number> = { AFN: 1, USD: 1, IRR: 1000, PKR: 1 };

const initialCustomers: Customer[] = [
  { id: "c1", name: "احمد رحیمی", balances: { AFN: 500000, USD: 10000, IRR: 0, PKR: 0 } },
  { id: "c2", name: "محمد ظاهر", balances: { AFN: 200000, USD: 5000, IRR: 0, PKR: 0 } },
  { id: "c3", name: "فاطمه حسینی", balances: { AFN: 0, USD: 0, IRR: 50000000, PKR: 0 } },
  { id: "c4", name: "علی کریمی", balances: { AFN: 0, USD: 0, IRR: 0, PKR: 200000 } },
];

const formatNumber = (n: number) =>
  Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 8 }) : "0";

const generateDocId = () => {
  const d = new Date();
  return `EX-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
};

// نرخ یعنی: rateUnit از ارز مبنا = rate از ارز مقابل.
// مثال: 1000 تومان = 0.35 افغانی.
function convertCurrency(amount: number, from: string, to: string, rate: number, base: string) {
  if (from === to) return amount;
  if (!Number.isFinite(amount) || !Number.isFinite(rate) || rate <= 0) return 0;

  const fromUnit = rateUnits[from] || 1;
  const toUnit = rateUnits[to] || 1;
  const baseUnit = rateUnits[base] || 1;

  if (base === from) return (amount / fromUnit) * rate * toUnit;
  if (base === to) return (amount / fromUnit) / rate * baseUnit;

  return 0;
}

function computeBalances(customers: Customer[], transactions: Transaction[]) {
  const balances: Record<string, Record<string, number>> = {};
  customers.forEach((c) => (balances[c.id] = { ...c.balances }));

  transactions.forEach((tx) => {
    if (tx.status === "voided") return;
    if (tx.type === "صرافی-مشتری") {
      const c = balances[tx.customerId];
      if (!c) return;
      c[tx.paidCurrency] = (c[tx.paidCurrency] || 0) - tx.paidAmount;
      c[tx.receivedCurrency] = (c[tx.receivedCurrency] || 0) + tx.receivedAmount;
    } else {
      const s = balances[tx.senderId];
      const r = balances[tx.receiverId];
      if (s) {
        s[tx.senderCurrency] = (s[tx.senderCurrency] || 0) - tx.senderAmount;
        if (tx.commission > 0) s[tx.commissionCurrency] = (s[tx.commissionCurrency] || 0) - tx.commission;
      }
      if (r) r[tx.receiverCurrency] = (r[tx.receiverCurrency] || 0) + tx.receiverAmount;
    }
  });
  return balances;
}

export default function CurrencyExchangePage() {
  const [customers] = useState<Customer[]>(initialCustomers);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<ExchangeType>("صرافی-مشتری");
  const [docId, setDocId] = useState(generateDocId());
  const [note, setNote] = useState("");
  const [terms, setTerms] = useState("نقدی");

  const [exCustomer, setExCustomer] = useState("");
  const [exReceivedCurrency, setExReceivedCurrency] = useState("AFN");
  const [exReceivedAmount, setExReceivedAmount] = useState("");
  const [exPaidCurrency, setExPaidCurrency] = useState("USD");
  const [exPaidAmount, setExPaidAmount] = useState("");
  const [exRate, setExRate] = useState("");
  const [exRateBaseCurrency, setExRateBaseCurrency] = useState("USD");
  const [exProfit, setExProfit] = useState("");
  const [exProfitCurrency, setExProfitCurrency] = useState("AFN");

  const [trSender, setTrSender] = useState("");
  const [trSenderCurrency, setTrSenderCurrency] = useState("AFN");
  const [trSenderAmount, setTrSenderAmount] = useState("");
  const [trReceiver, setTrReceiver] = useState("");
  const [trReceiverCurrency, setTrReceiverCurrency] = useState("AFN");
  const [trReceiverAmount, setTrReceiverAmount] = useState("");
  const [trRate, setTrRate] = useState("1");
  const [trRateBaseCurrency, setTrRateBaseCurrency] = useState("AFN");
  const [trCommission, setTrCommission] = useState("0");
  const [trCommissionCurrency, setTrCommissionCurrency] = useState("AFN");

  const [viewTx, setViewTx] = useState<Transaction | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const liveBalances = useMemo(() => computeBalances(customers, transactions), [customers, transactions]);

  useEffect(() => {
    const amount = Number(exReceivedAmount);
    const rate = Number(exRate);
    if (amount > 0 && rate > 0) {
      setExPaidAmount(formatNumber(convertCurrency(amount, exReceivedCurrency, exPaidCurrency, rate, exRateBaseCurrency)));
    } else setExPaidAmount("");
  }, [exReceivedAmount, exReceivedCurrency, exPaidCurrency, exRate, exRateBaseCurrency]);

  useEffect(() => {
    const amount = Number(trSenderAmount);
    const rate = Number(trRate);
    if (amount > 0 && rate > 0) {
      setTrReceiverAmount(formatNumber(convertCurrency(amount, trSenderCurrency, trReceiverCurrency, rate, trRateBaseCurrency)));
    } else setTrReceiverAmount("");
  }, [trSenderAmount, trSenderCurrency, trReceiverCurrency, trRate, trRateBaseCurrency]);

  const resetForm = () => {
    setDocId(generateDocId()); setNote(""); setTerms("نقدی");
    setExCustomer(""); setExReceivedCurrency("AFN"); setExReceivedAmount("");
    setExPaidCurrency("USD"); setExPaidAmount(""); setExRate(""); setExRateBaseCurrency("USD");
    setExProfit(""); setExProfitCurrency("AFN");
    setTrSender(""); setTrSenderCurrency("AFN"); setTrSenderAmount(""); setTrReceiver("");
    setTrReceiverCurrency("AFN"); setTrReceiverAmount(""); setTrRate("1"); setTrRateBaseCurrency("AFN");
    setTrCommission("0"); setTrCommissionCurrency("AFN");
  };

  const submitExchange = () => {
    if (!exCustomer || !exReceivedAmount || !exPaidAmount || !exRate) return;
    const tx: ExchangeTransaction = {
      id: docId, type: "صرافی-مشتری", date: new Date().toISOString(), customerId: exCustomer,
      receivedCurrency: exReceivedCurrency, receivedAmount: Number(exReceivedAmount),
      paidCurrency: exPaidCurrency, paidAmount: Number(exPaidAmount), rate: Number(exRate),
      rateBaseCurrency: exRateBaseCurrency, profit: Number(exProfit) || 0,
      profitCurrency: exProfitCurrency, terms, note, status: "active",
    };
    setTransactions((p) => [tx, ...p]); resetForm();
  };

  const submitTransfer = () => {
    if (!trSender || !trReceiver || trSender === trReceiver || !trSenderAmount || !trRate) return;
    const tx: TransferTransaction = {
      id: docId, type: "بین-مشتریان", date: new Date().toISOString(), senderId: trSender, receiverId: trReceiver,
      senderCurrency: trSenderCurrency, senderAmount: Number(trSenderAmount), receiverCurrency: trReceiverCurrency,
      receiverAmount: Number(trReceiverAmount), rate: Number(trRate), rateBaseCurrency: trRateBaseCurrency,
      commission: Number(trCommission) || 0, commissionCurrency: trCommissionCurrency, terms, note, status: "active",
    };
    setTransactions((p) => [tx, ...p]); resetForm();
  };

  const voidTransaction = (id: string) => {
    if (!confirm("آیا از ابطال این معامله اطمینان دارید؟")) return;
    setTransactions((p) => p.map((tx) => tx.id === id ? { ...tx, status: "voided" } : tx));
    setOpenMenu(null);
  };

  const saveEdit = () => {
    if (!editingTx) return;
    setTransactions((p) => p.map((tx) => tx.id === editingTx.id ? editingTx : tx));
    setEditingTx(null); setOpenMenu(null);
  };

  const printReceipt = (tx: Transaction) => {
    const w = window.open("", "_blank");
    if (!w) return;
    const customer = (id: string) => customers.find((c) => c.id === id)?.name || id;
    const rateText = tx.type === "صرافی-مشتری"
      ? `مبنای نرخ: ${currencyLabels[tx.rateBaseCurrency]} | نرخ تبدیل: ${tx.rate}`
      : `مبنای نرخ: ${currencyLabels[tx.rateBaseCurrency]} | نرخ تبدیل: ${tx.rate}`;
    const content = `<div dir="rtl" style="font-family:Tahoma;padding:25px"><h2>رسید معامله ${tx.id}</h2><p>تاریخ: ${new Date(tx.date).toLocaleString("fa-IR")}</p><p>نوع: ${tx.type}</p>${tx.type === "صرافی-مشتری" ? `<p>مشتری: ${customer(tx.customerId)}</p><p>دریافت: ${formatNumber(tx.receivedAmount)} ${currencyLabels[tx.receivedCurrency]}</p><p>پرداخت: ${formatNumber(tx.paidAmount)} ${currencyLabels[tx.paidCurrency]}</p><p>${rateText}</p><p>مفاد: ${formatNumber(tx.profit)} ${currencyLabels[tx.profitCurrency]}</p>` : `<p>فرستنده: ${customer(tx.senderId)}</p><p>گیرنده: ${customer(tx.receiverId)}</p><p>ارسال: ${formatNumber(tx.senderAmount)} ${currencyLabels[tx.senderCurrency]}</p><p>دریافت: ${formatNumber(tx.receiverAmount)} ${currencyLabels[tx.receiverCurrency]}</p><p>${rateText}</p><p>کمیشن: ${formatNumber(tx.commission)} ${currencyLabels[tx.commissionCurrency]}</p>`}<p>یادداشت: ${tx.note || "-"}</p></div>`;
    w.document.write(content); w.document.close(); w.print();
    setOpenMenu(null);
  };

  const customerName = (id: string) => customers.find((c) => c.id === id)?.name || id;
  const edit = (tx: Transaction) => { setEditingTx({ ...tx }); setOpenMenu(null); };

  const rateText = (tx: Transaction) => {
    const other = tx.type === "صرافی-مشتری" ? tx.paidCurrency : tx.senderCurrency;
    return `${rateUnits[tx.rateBaseCurrency] || 1} ${currencyLabels[tx.rateBaseCurrency]} = ${tx.rate} ${currencyLabels[other]}`;
  };

  const currencySelect = (value: string, onChange: (v: string) => void) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-14 rounded-[14px] w-full px-4 border border-gray-200 bg-white text-gray-800 text-sm">
      {currencies.map((c) => <option key={c} value={c}>{currencyLabels[c]}</option>)}
    </select>
  );

  return (
    <div dir="rtl" className="space-y-6 pb-8">
      <h1 className="text-2xl font-bold text-gray-800">معاملات ارزی</h1>

      <div className="flex gap-2 border-b pb-2">
        <button onClick={() => setActiveTab("صرافی-مشتری")} className={`px-4 py-2 rounded-t-lg text-sm font-medium ${activeTab === "صرافی-مشتری" ? "bg-cyan-600 text-white" : "bg-gray-100 text-gray-600"}`}>تبادل ارز (صرافی با مشتری)</button>
        <button onClick={() => setActiveTab("بین-مشتریان")} className={`px-4 py-2 rounded-t-lg text-sm font-medium ${activeTab === "بین-مشتریان" ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600"}`}>تبادل بین حساب مشتریان</button>
      </div>

      {activeTab === "صرافی-مشتری" ? (
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-6">تبادل ارز</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-50 rounded-xl p-5">
              <h3 className="font-bold text-gray-500 mb-4">اطلاعات دریافتی</h3>
              <div className="space-y-4">
                <select value={exCustomer} onChange={(e) => setExCustomer(e.target.value)} className="h-14 rounded-[14px] w-full px-4 border"><option value="">انتخاب مشتری</option>{customers.map((c, i) => <option key={c.id} value={c.id}>{i + 1}. {c.name}</option>)}</select>
                {currencySelect(exReceivedCurrency, setExReceivedCurrency)}
                <input type="number" placeholder="مبلغ دریافتی" value={exReceivedAmount} onChange={(e) => setExReceivedAmount(e.target.value)} className="h-14 rounded-[14px] w-full px-4 border" />
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-5">
              <h3 className="font-bold text-gray-500 mb-4">اطلاعات پرداختی</h3>
              <div className="space-y-4">
                {currencySelect(exPaidCurrency, setExPaidCurrency)}
                <input readOnly value={exPaidAmount} placeholder="مبلغ پرداختی (محاسبه شده)" className="h-14 rounded-[14px] w-full px-4 border bg-gray-100" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
            <div><label className="block font-bold mb-2">نرخ تبدیل</label><input type="number" step="any" value={exRate} onChange={(e) => setExRate(e.target.value)} className="h-14 rounded-[14px] w-full px-4 border" /></div>
            <div><label className="block font-bold mb-2">مبنای نرخ</label><select value={exRateBaseCurrency} onChange={(e) => setExRateBaseCurrency(e.target.value)} className="h-14 rounded-[14px] w-full px-4 border"><option value={exReceivedCurrency}>{currencyLabels[exReceivedCurrency]}</option><option value={exPaidCurrency}>{currencyLabels[exPaidCurrency]}</option></select></div>
            <div><label className="block font-bold mb-2">مفاد تبادل ارز</label><input type="number" step="any" value={exProfit} onChange={(e) => setExProfit(e.target.value)} className="h-14 rounded-[14px] w-full px-4 border" /></div>
            <div><label className="block font-bold mb-2">ارز مفاد</label>{currencySelect(exProfitCurrency, setExProfitCurrency)}</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6"><input value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="شرایط معامله" className="h-14 rounded-[14px] w-full px-4 border" /><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="یادداشت" className="h-14 rounded-[14px] w-full px-4 border" /></div>
          <button onClick={submitExchange} className="w-full h-14 rounded-2xl bg-[#092F3A] text-white font-medium">ثبت معامله</button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-6">تبادل بین حساب مشتریان</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-blue-50/50 rounded-xl p-5"><h3 className="font-bold text-blue-700 mb-4">فرستنده</h3><div className="space-y-4"><select value={trSender} onChange={(e) => setTrSender(e.target.value)} className="h-14 rounded-[14px] w-full px-4 border"><option value="">انتخاب مشتری</option>{customers.map((c, i) => <option key={c.id} value={c.id}>{i + 1}. {c.name}</option>)}</select>{currencySelect(trSenderCurrency, setTrSenderCurrency)}<input type="number" value={trSenderAmount} onChange={(e) => setTrSenderAmount(e.target.value)} placeholder="مبلغ فرستنده" className="h-14 rounded-[14px] w-full px-4 border" /></div></div>
            <div className="bg-green-50/50 rounded-xl p-5"><h3 className="font-bold text-green-700 mb-4">گیرنده</h3><div className="space-y-4"><select value={trReceiver} onChange={(e) => setTrReceiver(e.target.value)} className="h-14 rounded-[14px] w-full px-4 border"><option value="">انتخاب مشتری</option>{customers.map((c, i) => <option key={c.id} value={c.id}>{i + 1}. {c.name}</option>)}</select>{currencySelect(trReceiverCurrency, setTrReceiverCurrency)}<input readOnly value={trReceiverAmount} placeholder="مبلغ گیرنده (محاسبه شده)" className="h-14 rounded-[14px] w-full px-4 border bg-gray-100" /></div></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
            <div><label className="block font-bold mb-2">نرخ تبدیل</label><input type="number" step="any" value={trRate} onChange={(e) => setTrRate(e.target.value)} className="h-14 rounded-[14px] w-full px-4 border" /></div>
            <div><label className="block font-bold mb-2">مبنای نرخ</label><select value={trRateBaseCurrency} onChange={(e) => setTrRateBaseCurrency(e.target.value)} className="h-14 rounded-[14px] w-full px-4 border"><option value={trSenderCurrency}>{currencyLabels[trSenderCurrency]}</option><option value={trReceiverCurrency}>{currencyLabels[trReceiverCurrency]}</option></select></div>
            <div><label className="block font-bold mb-2">کمیشن</label><input type="number" value={trCommission} onChange={(e) => setTrCommission(e.target.value)} className="h-14 rounded-[14px] w-full px-4 border" /></div>
            <div><label className="block font-bold mb-2">ارز کمیشن</label>{currencySelect(trCommissionCurrency, setTrCommissionCurrency)}</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6"><input value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="شرایط معامله" className="h-14 rounded-[14px] w-full px-4 border" /><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="یادداشت" className="h-14 rounded-[14px] w-full px-4 border" /></div>
          <button onClick={submitTransfer} className="w-full h-14 rounded-2xl bg-[#092F3A] text-white font-medium">ثبت معامله</button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-5 overflow-x-auto">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">موجودی فعلی مشتریان</h2>
        <table className="min-w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-2 text-right">مشتری</th>{currencies.map((c) => <th key={c} className="p-2 text-right">{currencyLabels[c]}</th>)}</tr></thead><tbody className="divide-y">{customers.map((c) => { const b = liveBalances[c.id] || c.balances; return <tr key={c.id}><td className="p-2 font-medium">{c.name}</td>{currencies.map((cur) => <td key={cur} className="p-2">{formatNumber(b[cur] || 0)}</td>)}</tr>; })}</tbody></table>
      </div>

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <h2 className="text-lg font-semibold text-gray-700 p-5 pb-2">آخرین معاملات</h2>
        <table className="min-w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-3 text-right">سند</th><th className="p-3 text-right">تاریخ</th><th className="p-3 text-right">نوع معامله</th><th className="p-3 text-right">مشتری/فرستنده</th><th className="p-3 text-right">دریافت</th><th className="p-3 text-right">پرداخت</th><th className="p-3 text-right">نرخ</th><th className="p-3 text-right">مفاد</th><th className="p-3 text-right">عملیات</th></tr></thead>
          <tbody className="divide-y">{transactions.length === 0 ? <tr><td colSpan={9} className="text-center py-8 text-gray-400">هیچ معامله‌ای ثبت نشده است</td></tr> : transactions.map((tx) => {
            const voided = tx.status === "voided";
            return <tr key={tx.id} className={voided ? "opacity-50 line-through" : ""}>
              <td className="p-3 font-mono text-xs">{tx.id}</td><td className="p-3 text-xs">{new Date(tx.date).toLocaleString("fa-IR")}</td>
              <td className="p-3">{tx.type}</td><td className="p-3">{tx.type === "صرافی-مشتری" ? customerName(tx.customerId) : customerName(tx.senderId)}</td>
              <td className="p-3">{tx.type === "صرافی-مشتری" ? `${formatNumber(tx.receivedAmount)} ${currencyLabels[tx.receivedCurrency]}` : `${formatNumber(tx.receiverAmount)} ${currencyLabels[tx.receiverCurrency]}`}</td>
              <td className="p-3">{tx.type === "صرافی-مشتری" ? `${formatNumber(tx.paidAmount)} ${currencyLabels[tx.paidCurrency]}` : `${formatNumber(tx.senderAmount)} ${currencyLabels[tx.senderCurrency]}`}</td>
              <td className="p-3 text-xs">{rateText(tx)}</td>
              <td className="p-3">{tx.type === "صرافی-مشتری" ? `${formatNumber(tx.profit)} ${currencyLabels[tx.profitCurrency]}` : `${formatNumber(tx.commission)} ${currencyLabels[tx.commissionCurrency]}`}</td>
              <td className="p-3 relative"><button onClick={() => setOpenMenu(openMenu === tx.id ? null : tx.id)} className="px-3 py-2 rounded-lg bg-gray-100">عملیات ▾</button>
                {openMenu === tx.id && <div className="absolute z-20 left-2 top-12 w-32 rounded-lg border bg-white shadow-lg p-1">
                  <button onClick={() => { setViewTx(tx); setOpenMenu(null); }} className="block w-full text-right px-3 py-2 hover:bg-gray-50">مشاهده</button>
                  {!voided && <button onClick={() => edit(tx)} className="block w-full text-right px-3 py-2 hover:bg-gray-50">ویرایش</button>}
                  <button onClick={() => printReceipt(tx)} className="block w-full text-right px-3 py-2 hover:bg-gray-50">چاپ</button>
                  {!voided && <button onClick={() => voidTransaction(tx.id)} className="block w-full text-right px-3 py-2 text-red-600 hover:bg-red-50">ابطال</button>}
                </div>}
              </td>
            </tr>;
          })}</tbody>
        </table>
      </div>

      {viewTx && <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setViewTx(null)}><div className="bg-white rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}><h2 className="text-lg font-bold mb-4">جزئیات معامله</h2><div className="space-y-2 text-sm"><p>شماره: {viewTx.id}</p><p>تاریخ: {new Date(viewTx.date).toLocaleString("fa-IR")}</p><p>نوع: {viewTx.type}</p>{viewTx.type === "صرافی-مشتری" ? <><p>مشتری: {customerName(viewTx.customerId)}</p><p>دریافت: {formatNumber(viewTx.receivedAmount)} {currencyLabels[viewTx.receivedCurrency]}</p><p>پرداخت: {formatNumber(viewTx.paidAmount)} {currencyLabels[viewTx.paidCurrency]}</p><p>نرخ تبدیل: {rateText(viewTx)}</p><p>مفاد تبادل ارز: {formatNumber(viewTx.profit)} {currencyLabels[viewTx.profitCurrency]}</p></> : <><p>فرستنده: {customerName(viewTx.senderId)}</p><p>گیرنده: {customerName(viewTx.receiverId)}</p><p>ارسال: {formatNumber(viewTx.senderAmount)} {currencyLabels[viewTx.senderCurrency]}</p><p>دریافت: {formatNumber(viewTx.receiverAmount)} {currencyLabels[viewTx.receiverCurrency]}</p><p>نرخ تبدیل: {rateText(viewTx)}</p><p>کمیشن: {formatNumber(viewTx.commission)} {currencyLabels[viewTx.commissionCurrency]}</p></>}<p>یادداشت: {viewTx.note || "-"}</p><p>وضعیت: {viewTx.status === "voided" ? "ابطال شده" : "فعال"}</p></div><button onClick={() => setViewTx(null)} className="mt-5 px-4 py-2 bg-gray-200 rounded-lg">بستن</button></div></div>}

      {editingTx && <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"><div className="bg-white rounded-xl p-6 max-w-lg w-full"><h2 className="text-lg font-bold mb-4">ویرایش معامله</h2>{editingTx.type === "صرافی-مشتری" ? <div className="grid grid-cols-2 gap-3"><label>مبلغ دریافتی<input className="w-full border rounded p-2" type="number" value={editingTx.receivedAmount} onChange={(e) => setEditingTx({ ...editingTx, receivedAmount: Number(e.target.value) })} /></label><label>مبلغ پرداختی<input className="w-full border rounded p-2" type="number" value={editingTx.paidAmount} onChange={(e) => setEditingTx({ ...editingTx, paidAmount: Number(e.target.value) })} /></label><label>نرخ تبدیل<input className="w-full border rounded p-2" type="number" value={editingTx.rate} onChange={(e) => setEditingTx({ ...editingTx, rate: Number(e.target.value) })} /></label><label>مفاد<input className="w-full border rounded p-2" type="number" value={editingTx.profit} onChange={(e) => setEditingTx({ ...editingTx, profit: Number(e.target.value) })} /></label><label className="col-span-2">مبنای نرخ<select className="w-full border rounded p-2" value={editingTx.rateBaseCurrency} onChange={(e) => setEditingTx({ ...editingTx, rateBaseCurrency: e.target.value })}><option value={editingTx.receivedCurrency}>{currencyLabels[editingTx.receivedCurrency]}</option><option value={editingTx.paidCurrency}>{currencyLabels[editingTx.paidCurrency]}</option></select></label></div> : <div className="grid grid-cols-2 gap-3"><label>مبلغ فرستنده<input className="w-full border rounded p-2" type="number" value={editingTx.senderAmount} onChange={(e) => setEditingTx({ ...editingTx, senderAmount: Number(e.target.value) })} /></label><label>مبلغ گیرنده<input className="w-full border rounded p-2" type="number" value={editingTx.receiverAmount} onChange={(e) => setEditingTx({ ...editingTx, receiverAmount: Number(e.target.value) })} /></label><label>نرخ تبدیل<input className="w-full border rounded p-2" type="number" value={editingTx.rate} onChange={(e) => setEditingTx({ ...editingTx, rate: Number(e.target.value) })} /></label><label>کمیشن<input className="w-full border rounded p-2" type="number" value={editingTx.commission} onChange={(e) => setEditingTx({ ...editingTx, commission: Number(e.target.value) })} /></label></div>}<div className="flex justify-end gap-2 mt-5"><button onClick={() => setEditingTx(null)} className="px-4 py-2 bg-gray-200 rounded-lg">انصراف</button><button onClick={saveEdit} className="px-4 py-2 bg-blue-600 text-white rounded-lg">ذخیره</button></div></div></div>}
    </div>
  );
}
