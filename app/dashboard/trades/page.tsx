"use client";

import { useState, useMemo, useEffect } from "react";

// ---------- Types ----------
type ExchangeType = "صرافی-مشتری" | "بین-مشتریان";

interface BaseTransaction {
  id: string;
  type: ExchangeType;
  date: string;
  terms: string;
  note: string;
  status: "active" | "voided";
}

interface ExchangeTransaction extends BaseTransaction {
  type: "صرافی-مشتری";
  customerId: string;
  receivedCurrency: string;
  receivedAmount: number;
  paidCurrency: string;
  paidAmount: number;
  rate: number;                 // نرخ تبدیل (مقدار paidCurrency به ازای هر واحد پایه‌ای از receivedCurrency)
  rateBaseCurrency: string;     // ارز پایه نرخ (همان ارز دریافتی)
}

interface TransferTransaction extends BaseTransaction {
  type: "بین-مشتریان";
  senderId: string;
  receiverId: string;
  senderCurrency: string;
  senderAmount: number;
  receiverCurrency: string;
  receiverAmount: number;
  rate: number;
  rateBaseCurrency: string;     // ارز پایه نرخ (فرستنده یا گیرنده بسته به جفت)
  commission: number;
  commissionCurrency: string;
}

type Transaction = ExchangeTransaction | TransferTransaction;

interface Customer {
  id: string;
  name: string;
  balances: Record<string, number>;
}

// ---------- واحد پایه داخلی هر ارز ----------
const baseUnits: Record<string, number> = {
  AFN: 1,
  USD: 1,
  EUR: 1,
  PKR: 1,
  IRR_BANK: 1000,
  IRR_CHECK: 1000,
};

// ---------- برچسب ارزها ----------
const currencies = ["AFN", "USD", "EUR", "PKR", "IRR_BANK", "IRR_CHECK"];
const currencyLabels: Record<string, string> = {
  AFN: "افغانی",
  USD: "دالر",
  EUR: "یورو",
  PKR: "کلدار",
  IRR_BANK: "تومان بانکی",
  IRR_CHECK: "تومان چک",
};

// ---------- جفت‌ارزهای پشتیبانی‌شده با نرخ خرید/فروش ----------
interface RatePair {
  baseCurrency: string;      // ارز پایه
  quoteCurrency: string;     // ارز مقابل
  buyRate: number;           // نرخ خرید (صرافی ارز پایه را می‌خرد)
  sellRate: number;          // نرخ فروش (صرافی ارز پایه را می‌فروشد)
}

const ratePairs: RatePair[] = [
  { baseCurrency: "USD", quoteCurrency: "AFN", buyRate: 65.90, sellRate: 65.95 },
  { baseCurrency: "EUR", quoteCurrency: "AFN", buyRate: 74.90, sellRate: 75.00 },
  { baseCurrency: "AFN", quoteCurrency: "PKR", buyRate: 229.00, sellRate: 229.50 },
  { baseCurrency: "IRR_BANK", quoteCurrency: "AFN", buyRate: 0.350, sellRate: 0.360 },
  { baseCurrency: "IRR_CHECK", quoteCurrency: "AFN", buyRate: 0.490, sellRate: 0.500 },
];

// ---------- یافتن جفت‌ارز ----------
function findPair(currencyA: string, currencyB: string): RatePair | null {
  return ratePairs.find(p =>
    (p.baseCurrency === currencyA && p.quoteCurrency === currencyB) ||
    (p.baseCurrency === currencyB && p.quoteCurrency === currencyA)
  ) || null;
}

// ---------- محاسبه نرخ مؤثر (مبلغ paidCurrency به ازای هر واحد پایه‌ای از receivedCurrency) ----------
function getEffectiveRate(receivedCurrency: string, paidCurrency: string): { rate: number; rateBaseCurrency: string } | null {
  const pair = findPair(receivedCurrency, paidCurrency);
  if (!pair) return null;

  if (receivedCurrency === pair.baseCurrency && paidCurrency === pair.quoteCurrency) {
    // مشتری ارز پایه را دریافت می‌کند → صرافی ارز پایه را می‌فروشد → نرخ فروش
    return { rate: pair.sellRate, rateBaseCurrency: pair.baseCurrency };
  } else if (receivedCurrency === pair.quoteCurrency && paidCurrency === pair.baseCurrency) {
    // مشتری ارز پایه را پرداخت می‌کند → صرافی ارز پایه را می‌خرد → نرخ خرید
    return { rate: pair.buyRate, rateBaseCurrency: pair.baseCurrency };
  }
  return null;
}

// ---------- تبدیل مبلغ با استفاده از نرخ و ارز پایه ----------
function convertAmount(
  amount: number,
  receivedCurrency: string,
  paidCurrency: string,
  rate: number,
  rateBaseCurrency: string
): number {
  if (!Number.isFinite(amount) || !Number.isFinite(rate) || rate <= 0) return 0;
  if (receivedCurrency === paidCurrency) return amount;

  const baseReceived = baseUnits[receivedCurrency] || 1;

  // نرخ ذخیره شده: 1 baseUnit(rateBaseCurrency) = rate paidCurrency
  if (rateBaseCurrency === receivedCurrency) {
    // تبدیل عادی: paid = (receivedAmount / baseUnit(received)) * rate
    return (amount / baseReceived) * rate;
  } else if (rateBaseCurrency === paidCurrency) {
    // تبدیل معکوس: paid = (receivedAmount * baseUnit(received)) / rate
    return (amount * baseReceived) / rate;
  }
  return 0;
}

// ---------- نمایش نرخ به صورت جفت ثابت ----------
function formatRateQuote(receivedCurrency: string, paidCurrency: string, rate: number, rateBaseCurrency: string): string {
  if (receivedCurrency === paidCurrency) return "۱ = ۱";

  const pair = findPair(receivedCurrency, paidCurrency);
  if (pair) {
    const baseUnit = baseUnits[pair.baseCurrency] || 1;
    return `${baseUnit.toLocaleString()} ${currencyLabels[pair.baseCurrency]} = ${rate} ${currencyLabels[pair.quoteCurrency]}`;
  }
  return `${rate}`;
}

// ---------- قالب‌بندی عدد ----------
function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (n % 1 === 0) return n.toLocaleString("en-US");
  return n.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

// ---------- داده‌های اولیه مشتریان ----------
const initialCustomers: Customer[] = [
  { id: "c1", name: "احمد رحیمی", balances: { AFN: 500000, USD: 10000, EUR: 0, PKR: 0, IRR_BANK: 0, IRR_CHECK: 0 } },
  { id: "c2", name: "محمد ظاهر", balances: { AFN: 200000, USD: 5000, EUR: 0, PKR: 0, IRR_BANK: 0, IRR_CHECK: 0 } },
  { id: "c3", name: "فاطمه حسینی", balances: { AFN: 0, USD: 0, EUR: 0, PKR: 0, IRR_BANK: 50000000, IRR_CHECK: 0 } },
  { id: "c4", name: "علی کریمی", balances: { AFN: 0, USD: 0, EUR: 0, PKR: 200000, IRR_BANK: 0, IRR_CHECK: 0 } },
];

// ---------- ساخت شماره سند ----------
const generateDocId = () => {
  const now = new Date();
  return `EX-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`;
};

// ---------- محاسبه موجودی مشتریان ----------
function computeBalances(customers: Customer[], transactions: Transaction[]) {
  const balances: Record<string, Record<string, number>> = {};
  customers.forEach(c => { balances[c.id] = { ...c.balances }; });

  transactions.forEach(tx => {
    if (tx.status === "voided") return;
    if (tx.type === "صرافی-مشتری") {
      const cust = balances[tx.customerId];
      if (!cust) return;
      cust[tx.paidCurrency] = (cust[tx.paidCurrency] || 0) - tx.paidAmount;
      cust[tx.receivedCurrency] = (cust[tx.receivedCurrency] || 0) + tx.receivedAmount;
    } else {
      const sender = balances[tx.senderId];
      const receiver = balances[tx.receiverId];
      if (sender) {
        sender[tx.senderCurrency] = (sender[tx.senderCurrency] || 0) - tx.senderAmount;
        if (tx.commission > 0 && tx.commissionCurrency) {
          sender[tx.commissionCurrency] = (sender[tx.commissionCurrency] || 0) - tx.commission;
        }
      }
      if (receiver) {
        receiver[tx.receiverCurrency] = (receiver[tx.receiverCurrency] || 0) + tx.receiverAmount;
      }
    }
  });

  return balances;
}

// ---------- کامپوننت ----------
export default function CurrencyExchangePage() {
  const [customers] = useState<Customer[]>(initialCustomers);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<"صرافی-مشتری" | "بین-مشتریان">("صرافی-مشتری");

  const liveBalances = useMemo(() => computeBalances(customers, transactions), [customers, transactions]);

  // States فرم‌ها
  const [docId, setDocId] = useState(generateDocId());
  const [note, setNote] = useState("");
  const [terms, setTerms] = useState("نقدی");

  // تبادل با مشتری
  const [exCustomer, setExCustomer] = useState("");
  const [exReceivedCurrency, setExReceivedCurrency] = useState("USD");
  const [exReceivedAmount, setExReceivedAmount] = useState("");
  const [exPaidCurrency, setExPaidCurrency] = useState("AFN");
  const [exPaidAmount, setExPaidAmount] = useState("");
  const [exRate, setExRate] = useState("");
  const [exRateBaseCurrency, setExRateBaseCurrency] = useState("USD");

  // تبادل بین مشتریان
  const [trSender, setTrSender] = useState("");
  const [trSenderCurrency, setTrSenderCurrency] = useState("USD");
  const [trSenderAmount, setTrSenderAmount] = useState("");
  const [trReceiver, setTrReceiver] = useState("");
  const [trReceiverCurrency, setTrReceiverCurrency] = useState("AFN");
  const [trReceiverAmount, setTrReceiverAmount] = useState("");
  const [trRate, setTrRate] = useState("");
  const [trRateBaseCurrency, setTrRateBaseCurrency] = useState("USD");
  const [trCommission, setTrCommission] = useState("0");
  const [trCommissionCurrency, setTrCommissionCurrency] = useState("AFN");

  // ویرایش / مشاهده
  const [editMode, setEditMode] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [viewTx, setViewTx] = useState<Transaction | null>(null);

  // ─── به‌روزرسانی خودکار نرخ و مبنای آن (صرافی‑مشتری) ───
  useEffect(() => {
    const effective = getEffectiveRate(exReceivedCurrency, exPaidCurrency);
    if (effective) {
      setExRate(effective.rate.toString());
      setExRateBaseCurrency(effective.rateBaseCurrency);
    } else {
      setExRate("");
      setExRateBaseCurrency(exReceivedCurrency);
    }
  }, [exReceivedCurrency, exPaidCurrency]);

  // ─── محاسبه خودکار مبلغ پرداختی (صرافی‑مشتری) ───
  useEffect(() => {
    if (!exRate || !exReceivedAmount) { setExPaidAmount(""); return; }
    const received = parseFloat(exReceivedAmount);
    const rate = parseFloat(exRate);
    if (!Number.isFinite(received) || !Number.isFinite(rate) || rate <= 0) { setExPaidAmount(""); return; }
    const paid = convertAmount(received, exReceivedCurrency, exPaidCurrency, rate, exRateBaseCurrency);
    setExPaidAmount(formatNumber(paid));
  }, [exReceivedAmount, exRate, exReceivedCurrency, exPaidCurrency, exRateBaseCurrency]);

  // ─── به‌روزرسانی خودکار نرخ (بین مشتریان) ───
  useEffect(() => {
    const effective = getEffectiveRate(trReceiverCurrency, trSenderCurrency);
    if (effective) {
      setTrRate(effective.rate.toString());
      setTrRateBaseCurrency(effective.rateBaseCurrency);
    } else {
      setTrRate("");
      setTrRateBaseCurrency(trReceiverCurrency);
    }
  }, [trSenderCurrency, trReceiverCurrency]);

  // ─── محاسبه خودکار مبلغ گیرنده (بین مشتریان) ───
  useEffect(() => {
    if (!trRate || !trSenderAmount) { setTrReceiverAmount(""); return; }
    const senderAmt = parseFloat(trSenderAmount);
    const rate = parseFloat(trRate);
    if (!Number.isFinite(senderAmt) || !Number.isFinite(rate) || rate <= 0) { setTrReceiverAmount(""); return; }
    const receiver = convertAmount(senderAmt, trSenderCurrency, trReceiverCurrency, rate, trRateBaseCurrency);
    setTrReceiverAmount(formatNumber(receiver));
  }, [trSenderAmount, trRate, trSenderCurrency, trReceiverCurrency, trRateBaseCurrency]);

  // ─── Reset فرم ───
  const resetForm = () => {
    setDocId(generateDocId());
    setNote(""); setTerms("نقدی");
    setExCustomer(""); setExReceivedCurrency("USD"); setExReceivedAmount(""); setExPaidCurrency("AFN"); setExPaidAmount(""); setExRate(""); setExRateBaseCurrency("USD");
    setTrSender(""); setTrSenderCurrency("USD"); setTrSenderAmount(""); setTrReceiver(""); setTrReceiverCurrency("AFN"); setTrReceiverAmount("");
    setTrRate(""); setTrRateBaseCurrency("USD"); setTrCommission("0"); setTrCommissionCurrency("AFN");
  };

  // ─── ثبت تبادل با مشتری ───
  const submitExchange = () => {
    if (!exCustomer || !exReceivedAmount || !exPaidAmount || !exRate) return;
    const receivedAmount = parseFloat(exReceivedAmount);
    const paidAmount = parseFloat(exPaidAmount);
    const rate = parseFloat(exRate);
    if (!Number.isFinite(receivedAmount) || !Number.isFinite(paidAmount) || !Number.isFinite(rate) || rate <= 0) return;
    const tx: ExchangeTransaction = {
      id: docId, type: "صرافی-مشتری", date: new Date().toISOString(),
      customerId: exCustomer,
      receivedCurrency: exReceivedCurrency, receivedAmount,
      paidCurrency: exPaidCurrency, paidAmount,
      rate, rateBaseCurrency: exRateBaseCurrency,
      terms, note, status: "active"
    };
    setTransactions(prev => [tx, ...prev]);
    resetForm();
  };

  // ─── ثبت تبادل بین مشتریان ───
  const submitTransfer = () => {
    if (!trSender || !trReceiver || !trSenderAmount || !trRate) return;
    if (trSender === trReceiver) { alert("فرستنده و گیرنده نمی‌توانند یکسان باشند"); return; }
    const senderAmountNum = parseFloat(trSenderAmount);
    const rateNum = parseFloat(trRate);
    const commissionNum = parseFloat(trCommission) || 0;
    if (!Number.isFinite(senderAmountNum) || !Number.isFinite(rateNum) || rateNum <= 0) return;
    if (!Number.isFinite(commissionNum) || commissionNum < 0) return;
    const receiverAmountNum = convertAmount(senderAmountNum, trSenderCurrency, trReceiverCurrency, rateNum, trRateBaseCurrency);
    const tx: TransferTransaction = {
      id: docId, type: "بین-مشتریان", date: new Date().toISOString(),
      senderId: trSender, receiverId: trReceiver,
      senderCurrency: trSenderCurrency, senderAmount: senderAmountNum,
      receiverCurrency: trReceiverCurrency, receiverAmount: receiverAmountNum,
      rate: rateNum, rateBaseCurrency: trRateBaseCurrency,
      commission: commissionNum, commissionCurrency: trCommissionCurrency,
      note, terms, status: "active"
    };
    setTransactions(prev => [tx, ...prev]);
    resetForm();
  };

  // ─── ابطال ───
  const voidTransaction = (id: string) => {
    setTransactions(prev => prev.map(tx => tx.id === id ? { ...tx, status: "voided" } : tx));
  };

  // ─── ویرایش ───
  const startEdit = (tx: Transaction) => { setEditingTx({ ...tx }); setEditMode(true); };
  const saveEdit = () => {
    if (!editingTx) return;
    setTransactions(prev => prev.map(tx => tx.id === editingTx.id ? { ...editingTx } : tx));
    setEditMode(false); setEditingTx(null);
  };

  // ─── چاپ رسید ───
  const printReceipt = (tx: Transaction) => {
    const w = window.open("", "_blank");
    if (!w) return;
    let html = `<div style="direction:rtl;font-family:Tahoma;padding:20px">`;
    html += `<h2>رسید معامله - ${tx.id}</h2>`;
    html += `<p><strong>تاریخ:</strong> ${new Date(tx.date).toLocaleString("fa-IR")}</p>`;
    html += `<p><strong>نوع:</strong> ${tx.type}</p>`;
    if (tx.type === "صرافی-مشتری") {
      const cust = customers.find(c => c.id === tx.customerId);
      html += `<p><strong>مشتری:</strong> ${cust?.name || tx.customerId}</p>`;
      html += `<p><strong>دریافت:</strong> ${formatNumber(tx.receivedAmount)} ${currencyLabels[tx.receivedCurrency]}</p>`;
      html += `<p><strong>پرداخت:</strong> ${formatNumber(tx.paidAmount)} ${currencyLabels[tx.paidCurrency]}</p>`;
      html += `<p><strong>نرخ:</strong> ${formatRateQuote(tx.receivedCurrency, tx.paidCurrency, tx.rate, tx.rateBaseCurrency)}</p>`;
    } else {
      const sender = customers.find(c => c.id === tx.senderId);
      const receiver = customers.find(c => c.id === tx.receiverId);
      html += `<p><strong>فرستنده:</strong> ${sender?.name} | ${formatNumber(tx.senderAmount)} ${currencyLabels[tx.senderCurrency]}</p>`;
      html += `<p><strong>گیرنده:</strong> ${receiver?.name} | ${formatNumber(tx.receiverAmount)} ${currencyLabels[tx.receiverCurrency]}</p>`;
      html += `<p><strong>نرخ:</strong> ${formatRateQuote(tx.senderCurrency, tx.receiverCurrency, tx.rate, tx.rateBaseCurrency)}</p>`;
      if (tx.commission > 0) html += `<p><strong>کارمزد:</strong> ${formatNumber(tx.commission)} ${currencyLabels[tx.commissionCurrency]}</p>`;
    }
    html += `<p><strong>مفاد:</strong> ${tx.terms}</p><p><strong>یادداشت:</strong> ${tx.note || "-"}</p>`;
    html += `<p><strong>وضعیت:</strong> ${tx.status === "voided" ? "ابطال شده" : "فعال"}</p></div>`;
    w.document.write(html);
    w.document.close();
    w.print();
  };

  const customerName = (id: string) => customers.find(c => c.id === id)?.name || id;

  return (
    <div dir="rtl" className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">معاملات ارزی</h1>

      {/* تب‌ها */}
      <div className="flex gap-2 border-b pb-2">
        <button onClick={() => setActiveTab("صرافی-مشتری")} className={`px-4 py-2 rounded-t-lg text-sm font-medium transition ${activeTab === "صرافی-مشتری" ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>تبادل ارز (صرافی با مشتری)</button>
        <button onClick={() => setActiveTab("بین-مشتریان")} className={`px-4 py-2 rounded-t-lg text-sm font-medium transition ${activeTab === "بین-مشتریان" ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>تبادل بین حساب مشتریان</button>
      </div>

      {activeTab === "صرافی-مشتری" ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">تبادل ارز</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <h3 className="text-sm font-bold text-gray-500 mb-4">اطلاعات مشتری و دریافتی</h3>
              <div className="space-y-4">
                <div><label className="block text-sm font-bold text-gray-700 mb-2">مشتری</label>
                  <select value={exCustomer} onChange={e => setExCustomer(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm">
                    <option value="">انتخاب مشتری</option>
                    {customers.map((c, i) => <option key={c.id} value={c.id}>{i+1}. {c.name}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-bold text-gray-700 mb-2">ارز دریافتی</label>
                  <select value={exReceivedCurrency} onChange={e => setExReceivedCurrency(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm">
                    {currencies.map(cur => <option key={cur} value={cur}>{currencyLabels[cur]}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-bold text-gray-700 mb-2">مبلغ دریافتی</label>
                  <input type="number" value={exReceivedAmount} onChange={e => setExReceivedAmount(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm" />
                </div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <h3 className="text-sm font-bold text-gray-500 mb-4">اطلاعات پرداختی</h3>
              <div className="space-y-4">
                <div><label className="block text-sm font-bold text-gray-700 mb-2">ارز پرداختی</label>
                  <select value={exPaidCurrency} onChange={e => setExPaidCurrency(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm">
                    {currencies.map(cur => <option key={cur} value={cur}>{currencyLabels[cur]}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-bold text-gray-700 mb-2">مبلغ پرداختی (محاسبه شده)</label>
                  <input type="text" value={exPaidAmount} readOnly className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-gray-100 text-gray-800 text-sm" />
                </div>
              </div>
            </div>
          </div>
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">نرخ تبدیل</label>
            <input type="number" step="any" value={exRate} onChange={e => setExRate(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
            <div><label className="block text-sm font-bold text-gray-700 mb-2">مفاد معامله</label><input value={terms} onChange={e => setTerms(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-2">یادداشت</label><input value={note} onChange={e => setNote(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm" /></div>
          </div>
          <button onClick={submitExchange} className="w-full h-14 rounded-2xl bg-[#092F3A] text-white font-medium hover:bg-[#0a3f4a]">ثبت معامله</button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">تبادل بین حساب مشتریان</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-blue-50/50 rounded-xl p-5 border border-blue-100">
              <h3 className="text-sm font-bold text-blue-700 mb-4">اطلاعات فرستنده</h3>
              <div className="space-y-4">
                <div><label className="block text-sm font-bold text-gray-700 mb-2">مشتری فرستنده</label>
                  <select value={trSender} onChange={e => setTrSender(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm">
                    <option value="">انتخاب مشتری</option>
                    {customers.map((c, i) => <option key={c.id} value={c.id}>{i+1}. {c.name}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-bold text-gray-700 mb-2">ارز فرستنده</label>
                  <select value={trSenderCurrency} onChange={e => setTrSenderCurrency(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm">
                    {currencies.map(cur => <option key={cur} value={cur}>{currencyLabels[cur]}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-bold text-gray-700 mb-2">مبلغ فرستنده</label>
                  <input type="number" value={trSenderAmount} onChange={e => setTrSenderAmount(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm" />
                </div>
              </div>
            </div>
            <div className="bg-green-50/50 rounded-xl p-5 border border-green-100">
              <h3 className="text-sm font-bold text-green-700 mb-4">اطلاعات گیرنده</h3>
              <div className="space-y-4">
                <div><label className="block text-sm font-bold text-gray-700 mb-2">مشتری گیرنده</label>
                  <select value={trReceiver} onChange={e => setTrReceiver(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm">
                    <option value="">انتخاب مشتری</option>
                    {customers.map((c, i) => <option key={c.id} value={c.id}>{i+1}. {c.name}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-bold text-gray-700 mb-2">ارز گیرنده</label>
                  <select value={trReceiverCurrency} onChange={e => setTrReceiverCurrency(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm">
                    {currencies.map(cur => <option key={cur} value={cur}>{currencyLabels[cur]}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-bold text-gray-700 mb-2">مبلغ گیرنده (محاسبه شده)</label>
                  <input type="text" value={trReceiverAmount} readOnly className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-gray-100 text-gray-800 text-sm" />
                </div>
              </div>
            </div>
          </div>
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">نرخ تبدیل</label>
            <input type="number" step="any" value={trRate} onChange={e => setTrRate(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
            <div><label className="block text-sm font-bold text-gray-700 mb-2">کارمزد (اختیاری)</label><input type="number" value={trCommission} onChange={e => setTrCommission(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-2">ارز کارمزد</label>
              <select value={trCommissionCurrency} onChange={e => setTrCommissionCurrency(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm">
                {currencies.map(cur => <option key={cur} value={cur}>{currencyLabels[cur]}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-bold text-gray-700 mb-2">یادداشت</label><input value={note} onChange={e => setNote(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm" /></div>
          </div>
          <button onClick={submitTransfer} className="w-full h-14 rounded-2xl bg-[#092F3A] text-white font-medium hover:bg-[#0a3f4a]">ثبت معامله</button>
        </div>
      )}

      {/* موجودی مشتریان */}
      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">موجودی فعلی مشتریان</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr><th className="py-2 px-3 text-right font-bold">مشتری</th>{currencies.map(c => <th key={c} className="py-2 px-3 text-right font-bold">{currencyLabels[c]}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map(cust => {
                const bal = liveBalances[cust.id] || cust.balances;
                return <tr key={cust.id} className="hover:bg-gray-50"><td className="py-2 px-3 font-medium">{cust.name}</td>{currencies.map(cur => <td key={cur} className="py-2 px-3">{formatNumber(bal[cur] || 0)}</td>)}</tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* جدول معاملات */}
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <h2 className="text-lg font-semibold text-gray-700 p-5 pb-2">آخرین معاملات</h2>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="py-3 px-2 text-right font-bold">شماره</th>
              <th className="py-3 px-2 text-right font-bold">تاریخ</th>
              <th className="py-3 px-2 text-right font-bold">نوع</th>
              <th className="py-3 px-2 text-right font-bold">مشتری/فرستنده</th>
              <th className="py-3 px-2 text-right font-bold">دریافت</th>
              <th className="py-3 px-2 text-right font-bold">پرداخت</th>
              <th className="py-3 px-2 text-right font-bold">نرخ</th>
              <th className="py-3 px-2 text-right font-bold">مفاد</th>
              <th className="py-3 px-2 text-right font-bold">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {transactions.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-gray-400">هیچ معامله‌ای ثبت نشده است</td></tr>}
            {transactions.map((tx, idx) => {
              const isVoided = tx.status === "voided";
              return (
                <tr key={tx.id} className={`hover:bg-gray-50 ${isVoided ? "opacity-60 line-through" : ""}`}>
                  <td className="py-3 px-2 font-mono text-xs">{idx + 1}</td>
                  <td className="py-3 px-2 text-xs">{new Date(tx.date).toLocaleString("fa-IR")}</td>
                  <td className="py-3 px-2"><span className={`px-2 py-0.5 rounded text-xs ${tx.type === "صرافی-مشتری" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>{tx.type === "صرافی-مشتری" ? "صرافی-مشتری" : "بین مشتریان"}</span></td>
                  <td className="py-3 px-2">{tx.type === "صرافی-مشتری" ? customerName(tx.customerId) : customerName(tx.senderId)}</td>
                  <td className="py-3 px-2">{tx.type === "صرافی-مشتری" ? `${formatNumber(tx.receivedAmount)} ${currencyLabels[tx.receivedCurrency]}` : `${formatNumber(tx.receiverAmount)} ${currencyLabels[tx.receiverCurrency]}`}</td>
                  <td className="py-3 px-2">{tx.type === "صرافی-مشتری" ? `${formatNumber(tx.paidAmount)} ${currencyLabels[tx.paidCurrency]}` : `${formatNumber(tx.senderAmount)} ${currencyLabels[tx.senderCurrency]}`}</td>
                  <td className="py-3 px-2 text-xs">{tx.type === "صرافی-مشتری" ? formatRateQuote(tx.receivedCurrency, tx.paidCurrency, tx.rate, tx.rateBaseCurrency) : formatRateQuote(tx.senderCurrency, tx.receiverCurrency, tx.rate, tx.rateBaseCurrency)}</td>
                  <td className="py-3 px-2 text-xs">{tx.terms}</td>
                  <td className="py-3 px-2 relative">
                    <button onClick={() => { const menu = document.getElementById(`menu-${tx.id}`); if (menu) menu.classList.toggle('hidden'); }} className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded">عملیات ▾</button>
                    <div id={`menu-${tx.id}`} className="absolute left-0 mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-10 hidden">
                      <button onClick={() => { setViewTx(tx); }} className="block w-full text-right px-4 py-2 text-xs text-gray-700 hover:bg-gray-50">مشاهده</button>
                      <button onClick={() => printReceipt(tx)} className="block w-full text-right px-4 py-2 text-xs text-gray-700 hover:bg-gray-50">چاپ</button>
                      {!isVoided && <>
                        <button onClick={() => startEdit(tx)} className="block w-full text-right px-4 py-2 text-xs text-gray-700 hover:bg-gray-50">ویرایش</button>
                        <button onClick={() => { if (window.confirm("آیا مطمئن هستید؟")) voidTransaction(tx.id); }} className="block w-full text-right px-4 py-2 text-xs text-red-600 hover:bg-red-50">ابطال</button>
                      </>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* مودال مشاهده */}
      {viewTx && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setViewTx(null)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">جزئیات معامله</h2>
            <div className="space-y-2 text-sm">
              <p><strong>شماره:</strong> {viewTx.id}</p>
              <p><strong>تاریخ:</strong> {new Date(viewTx.date).toLocaleString("fa-IR")}</p>
              <p><strong>نوع:</strong> {viewTx.type}</p>
              {viewTx.type === "صرافی-مشتری" ? (
                <>
                  <p><strong>مشتری:</strong> {customerName(viewTx.customerId)}</p>
                  <p><strong>دریافت:</strong> {formatNumber(viewTx.receivedAmount)} {currencyLabels[viewTx.receivedCurrency]}</p>
                  <p><strong>پرداخت:</strong> {formatNumber(viewTx.paidAmount)} {currencyLabels[viewTx.paidCurrency]}</p>
                  <p><strong>نرخ:</strong> {formatRateQuote(viewTx.receivedCurrency, viewTx.paidCurrency, viewTx.rate, viewTx.rateBaseCurrency)}</p>
                </>
              ) : (
                <>
                  <p><strong>فرستنده:</strong> {customerName(viewTx.senderId)} | {formatNumber(viewTx.senderAmount)} {currencyLabels[viewTx.senderCurrency]}</p>
                  <p><strong>گیرنده:</strong> {customerName(viewTx.receiverId)} | {formatNumber(viewTx.receiverAmount)} {currencyLabels[viewTx.receiverCurrency]}</p>
                  <p><strong>نرخ:</strong> {formatRateQuote(viewTx.senderCurrency, viewTx.receiverCurrency, viewTx.rate, viewTx.rateBaseCurrency)}</p>
                  {viewTx.commission > 0 && <p><strong>کارمزد:</strong> {formatNumber(viewTx.commission)} {currencyLabels[viewTx.commissionCurrency]}</p>}
                </>
              )}
              <p><strong>مفاد:</strong> {viewTx.terms}</p>
              <p><strong>یادداشت:</strong> {viewTx.note || "-"}</p>
              <p><strong>وضعیت:</strong> {viewTx.status === "voided" ? "ابطال شده" : "فعال"}</p>
            </div>
            <button onClick={() => setViewTx(null)} className="mt-4 px-4 py-2 bg-gray-200 rounded-lg">بستن</button>
          </div>
        </div>
      )}

      {/* مودال ویرایش */}
      {editMode && editingTx && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">ویرایش معامله</h2>
            {editingTx.type === "صرافی-مشتری" && (
              <div className="grid grid-cols-2 gap-4">
                <div><label className="font-bold">مشتری</label><select value={(editingTx as ExchangeTransaction).customerId} onChange={e => setEditingTx({...editingTx, customerId: e.target.value} as ExchangeTransaction)} className="w-full border rounded p-2">{customers.map((c,i) => <option key={c.id} value={c.id}>{i+1}. {c.name}</option>)}</select></div>
                <div><label className="font-bold">ارز دریافتی</label><select value={(editingTx as ExchangeTransaction).receivedCurrency} onChange={e => setEditingTx({...editingTx, receivedCurrency: e.target.value} as ExchangeTransaction)} className="w-full border rounded p-2">{currencies.map(cur => <option key={cur} value={cur}>{currencyLabels[cur]}</option>)}</select></div>
                <div><label className="font-bold">مبلغ دریافتی</label><input type="number" value={(editingTx as ExchangeTransaction).receivedAmount} onChange={e => setEditingTx({...editingTx, receivedAmount: +e.target.value} as ExchangeTransaction)} className="w-full border rounded p-2" /></div>
                <div><label className="font-bold">ارز پرداختی</label><select value={(editingTx as ExchangeTransaction).paidCurrency} onChange={e => setEditingTx({...editingTx, paidCurrency: e.target.value} as ExchangeTransaction)} className="w-full border rounded p-2">{currencies.map(cur => <option key={cur} value={cur}>{currencyLabels[cur]}</option>)}</select></div>
                <div><label className="font-bold">مبلغ پرداختی</label><input type="number" value={(editingTx as ExchangeTransaction).paidAmount} onChange={e => setEditingTx({...editingTx, paidAmount: +e.target.value} as ExchangeTransaction)} className="w-full border rounded p-2" /></div>
                <div><label className="font-bold">نرخ</label><input type="number" step="any" value={(editingTx as ExchangeTransaction).rate} onChange={e => setEditingTx({...editingTx, rate: +e.target.value} as ExchangeTransaction)} className="w-full border rounded p-2" /></div>
                <div><label className="font-bold">مفاد</label><input value={editingTx.terms} onChange={e => setEditingTx({...editingTx, terms: e.target.value})} className="w-full border rounded p-2" /></div>
                <div><label className="font-bold">یادداشت</label><input value={editingTx.note} onChange={e => setEditingTx({...editingTx, note: e.target.value})} className="w-full border rounded p-2" /></div>
              </div>
            )}
            {editingTx.type === "بین-مشتریان" && (
              <div className="grid grid-cols-2 gap-4">
                <div><label className="font-bold">فرستنده</label><select value={(editingTx as TransferTransaction).senderId} onChange={e => setEditingTx({...editingTx, senderId: e.target.value} as TransferTransaction)} className="w-full border rounded p-2">{customers.map((c,i) => <option key={c.id} value={c.id}>{i+1}. {c.name}</option>)}</select></div>
                <div><label className="font-bold">گیرنده</label><select value={(editingTx as TransferTransaction).receiverId} onChange={e => setEditingTx({...editingTx, receiverId: e.target.value} as TransferTransaction)} className="w-full border rounded p-2">{customers.map((c,i) => <option key={c.id} value={c.id}>{i+1}. {c.name}</option>)}</select></div>
                <div><label className="font-bold">ارز فرستنده</label><select value={(editingTx as TransferTransaction).senderCurrency} onChange={e => setEditingTx({...editingTx, senderCurrency: e.target.value} as TransferTransaction)} className="w-full border rounded p-2">{currencies.map(cur => <option key={cur} value={cur}>{currencyLabels[cur]}</option>)}</select></div>
                <div><label className="font-bold">مبلغ فرستنده</label><input type="number" value={(editingTx as TransferTransaction).senderAmount} onChange={e => setEditingTx({...editingTx, senderAmount: +e.target.value} as TransferTransaction)} className="w-full border rounded p-2" /></div>
                <div><label className="font-bold">ارز گیرنده</label><select value={(editingTx as TransferTransaction).receiverCurrency} onChange={e => setEditingTx({...editingTx, receiverCurrency: e.target.value} as TransferTransaction)} className="w-full border rounded p-2">{currencies.map(cur => <option key={cur} value={cur}>{currencyLabels[cur]}</option>)}</select></div>
                <div><label className="font-bold">مبلغ گیرنده</label><input type="number" value={(editingTx as TransferTransaction).receiverAmount} onChange={e => setEditingTx({...editingTx, receiverAmount: +e.target.value} as TransferTransaction)} className="w-full border rounded p-2" /></div>
                <div><label className="font-bold">نرخ</label><input type="number" step="any" value={(editingTx as TransferTransaction).rate} onChange={e => setEditingTx({...editingTx, rate: +e.target.value} as TransferTransaction)} className="w-full border rounded p-2" /></div>
                <div><label className="font-bold">کارمزد</label><input type="number" value={(editingTx as TransferTransaction).commission} onChange={e => setEditingTx({...editingTx, commission: +e.target.value} as TransferTransaction)} className="w-full border rounded p-2" /></div>
                <div><label className="font-bold">ارز کارمزد</label><select value={(editingTx as TransferTransaction).commissionCurrency} onChange={e => setEditingTx({...editingTx, commissionCurrency: e.target.value} as TransferTransaction)} className="w-full border rounded p-2">{currencies.map(cur => <option key={cur} value={cur}>{currencyLabels[cur]}</option>)}</select></div>
                <div><label className="font-bold">یادداشت</label><input value={editingTx.note} onChange={e => setEditingTx({...editingTx, note: e.target.value})} className="w-full border rounded p-2" /></div>
              </div>
            )}
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => { setEditMode(false); setEditingTx(null); }} className="px-4 py-2 bg-gray-200 rounded-lg">انصراف</button>
              <button onClick={saveEdit} className="px-4 py-2 bg-blue-500 text-white rounded-lg">ذخیره</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
