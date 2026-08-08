"use client";
import { useState, useMemo } from "react";

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
  rate: number;
  rateBaseCurrency: string;
  rateUnit: number;
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
  rateBaseCurrency: string;
  rateUnit: number;
  commission: number;
  commissionCurrency: string;
}

type Transaction = ExchangeTransaction | TransferTransaction;

interface Customer {
  id: string;
  name: string;
  balances: Record<string, number>; // AFN, USD, IRR, PKR
}

// ---------- Universal conversion engine ----------
function convert(
  fromCurrency: string,
  fromAmount: number,
  toCurrency: string,
  rate: number,
  rateBaseCurrency: string,
  rateUnit: number
): number {
  if (rateBaseCurrency === fromCurrency) {
    return (fromAmount * rate) / rateUnit;
  } else if (rateBaseCurrency === toCurrency) {
    return (fromAmount * rateUnit) / rate;
  } else {
    return 0;
  }
}

function formatNumber(n: number): string {
  return n % 1 === 0 ? n.toString() : n.toFixed(2);
}

// ---------- Initial Data ----------
const initialCustomers: Customer[] = [
  { id: "c1", name: "احمد رحیمی", balances: { AFN: 500000, USD: 10000, IRR: 0, PKR: 0 } },
  { id: "c2", name: "محمد ظاهر", balances: { AFN: 200000, USD: 5000, IRR: 0, PKR: 0 } },
  { id: "c3", name: "فاطمه حسینی", balances: { AFN: 0, USD: 0, IRR: 50000000, PKR: 0 } },
  { id: "c4", name: "علی کریمی", balances: { AFN: 0, USD: 0, IRR: 0, PKR: 200000 } },
];

const currencies = ["AFN", "USD", "IRR", "PKR"];
const currencyLabels: Record<string, string> = {
  AFN: "افغانی",
  USD: "دالر",
  IRR: "تومان",
  PKR: "کلدار",
};

const generateDocId = () => {
  const now = new Date();
  return `EX-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`;
};

// ---------- Balance calculation from transactions ----------
function computeBalances(customers: Customer[], transactions: Transaction[]) {
  const balances: Record<string, Record<string, number>> = {};
  customers.forEach((c) => {
    balances[c.id] = { ...c.balances };
  });

  transactions.forEach((tx) => {
    if (tx.status === "voided") return;

    if (tx.type === "صرافی-مشتری") {
      const cust = balances[tx.customerId];
      if (cust) {
        cust[tx.paidCurrency] = (cust[tx.paidCurrency] || 0) - tx.paidAmount;
        cust[tx.receivedCurrency] = (cust[tx.receivedCurrency] || 0) + tx.receivedAmount;
      }
    } else if (tx.type === "بین-مشتریان") {
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

// ---------- Component ----------
export default function CurrencyExchangePage() {
  const [customers] = useState<Customer[]>(initialCustomers);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<"صرافی-مشتری" | "بین-مشتریان">("صرافی-مشتری");

  const liveBalances = useMemo(
    () => computeBalances(customers, transactions),
    [customers, transactions]
  );

  // ---------- Form States ----------
  // Common
  const [docId, setDocId] = useState(generateDocId());
  const [note, setNote] = useState("");
  const [terms, setTerms] = useState("نقدی");

  // Exchange form
  const [exCustomer, setExCustomer] = useState("");
  const [exReceivedCurrency, setExReceivedCurrency] = useState("AFN");
  const [exReceivedAmount, setExReceivedAmount] = useState("");
  const [exPaidCurrency, setExPaidCurrency] = useState("USD");
  const [exPaidAmount, setExPaidAmount] = useState("");
  const [exRate, setExRate] = useState("");
  const [exRateBaseCurrency, setExRateBaseCurrency] = useState("USD");
  const [exRateUnit, setExRateUnit] = useState("1");

  // Transfer form
  const [trSender, setTrSender] = useState("");
  const [trSenderCurrency, setTrSenderCurrency] = useState("AFN");
  const [trSenderAmount, setTrSenderAmount] = useState("");
  const [trReceiver, setTrReceiver] = useState("");
  const [trReceiverCurrency, setTrReceiverCurrency] = useState("AFN");
  const [trReceiverAmount, setTrReceiverAmount] = useState("");
  const [trRate, setTrRate] = useState("1");
  const [trRateBaseCurrency, setTrRateBaseCurrency] = useState("AFN");
  const [trRateUnit, setTrRateUnit] = useState("1");
  const [trCommission, setTrCommission] = useState("0");
  const [trCommissionCurrency, setTrCommissionCurrency] = useState("AFN");

  // Edit / View states
  const [editMode, setEditMode] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [viewTx, setViewTx] = useState<Transaction | null>(null);

  // ---------- Auto-calculation: Exchange ----------
  const computeExchangePaid = () => {
    if (!exRate || !exReceivedAmount || !exRateUnit) return;
    const received = parseFloat(exReceivedAmount);
    const rate = parseFloat(exRate);
    const unit = parseFloat(exRateUnit);
    if (isNaN(received) || isNaN(rate) || isNaN(unit) || rate === 0) return;

    const paid = convert(
      exReceivedCurrency,
      received,
      exPaidCurrency,
      rate,
      exRateBaseCurrency,
      unit
    );
    setExPaidAmount(formatNumber(paid));
  };

  useMemo(() => computeExchangePaid(), [exReceivedAmount, exRate, exRateBaseCurrency, exRateUnit, exReceivedCurrency, exPaidCurrency]);

  // ---------- Auto-calculation: Transfer ----------
  const computeTransferReceiver = () => {
    if (!trRate || !trSenderAmount || !trRateUnit) return;
    const senderAmt = parseFloat(trSenderAmount);
    const rate = parseFloat(trRate);
    const unit = parseFloat(trRateUnit);
    if (isNaN(senderAmt) || isNaN(rate) || isNaN(unit) || rate === 0) return;

    const receiver = convert(
      trSenderCurrency,
      senderAmt,
      trReceiverCurrency,
      rate,
      trRateBaseCurrency,
      unit
    );
    setTrReceiverAmount(formatNumber(receiver));
  };

  useMemo(() => computeTransferReceiver(), [trSenderAmount, trRate, trRateBaseCurrency, trRateUnit, trSenderCurrency, trReceiverCurrency]);

  // ---------- Reset Form ----------
  const resetForm = () => {
    setDocId(generateDocId());
    setNote("");
    setTerms("نقدی");
    setExCustomer("");
    setExReceivedCurrency("AFN");
    setExReceivedAmount("");
    setExPaidCurrency("USD");
    setExPaidAmount("");
    setExRate("");
    setExRateBaseCurrency("USD");
    setExRateUnit("1");
    setTrSender("");
    setTrSenderCurrency("AFN");
    setTrSenderAmount("");
    setTrReceiver("");
    setTrReceiverCurrency("AFN");
    setTrReceiverAmount("");
    setTrRate("1");
    setTrRateBaseCurrency("AFN");
    setTrRateUnit("1");
    setTrCommission("0");
    setTrCommissionCurrency("AFN");
  };

  // ---------- Submit Exchange ----------
  const submitExchange = () => {
    if (!exCustomer || !exReceivedAmount || !exPaidAmount || !exRate || !exRateUnit) return;
    const tx: ExchangeTransaction = {
      id: docId,
      type: "صرافی-مشتری",
      date: new Date().toISOString(),
      customerId: exCustomer,
      receivedCurrency: exReceivedCurrency,
      receivedAmount: parseFloat(exReceivedAmount),
      paidCurrency: exPaidCurrency,
      paidAmount: parseFloat(exPaidAmount),
      rate: parseFloat(exRate),
      rateBaseCurrency: exRateBaseCurrency,
      rateUnit: parseFloat(exRateUnit),
      terms,
      note,
      status: "active",
    };
    setTransactions([tx, ...transactions]);
    resetForm();
  };

  // ---------- Submit Transfer ----------
  const submitTransfer = () => {
    if (!trSender || !trReceiver || !trSenderAmount || !trReceiverAmount || !trRate || !trRateUnit) return;
    if (trSender === trReceiver) {
      alert("فرستنده و گیرنده نمی‌توانند یکسان باشند");
      return;
    }
    const tx: TransferTransaction = {
      id: docId,
      type: "بین-مشتریان",
      date: new Date().toISOString(),
      senderId: trSender,
      receiverId: trReceiver,
      senderCurrency: trSenderCurrency,
      senderAmount: parseFloat(trSenderAmount),
      receiverCurrency: trReceiverCurrency,
      receiverAmount: parseFloat(trReceiverAmount),
      rate: parseFloat(trRate),
      rateBaseCurrency: trRateBaseCurrency,
      rateUnit: parseFloat(trRateUnit),
      commission: parseFloat(trCommission) || 0,
      commissionCurrency: trCommissionCurrency,
      note,
      terms,
      status: "active",
    };
    setTransactions([tx, ...transactions]);
    resetForm();
  };

  // ---------- Void Transaction ----------
  const voidTransaction = (id: string) => {
    setTransactions((prev) =>
      prev.map((tx) => (tx.id === id ? { ...tx, status: "voided" } : tx))
    );
  };

  // ---------- Edit ----------
  const startEdit = (tx: Transaction) => {
    setEditingTx({ ...tx });
    setEditMode(true);
  };

  const saveEdit = () => {
    if (!editingTx) return;
    setTransactions((prev) =>
      prev.map((tx) => (tx.id === editingTx.id ? { ...editingTx } : tx))
    );
    setEditMode(false);
    setEditingTx(null);
  };

  // ---------- Print Receipt ----------
  const printReceipt = (tx: Transaction) => {
    const w = window.open("", "_blank");
    if (!w) return;
    let content = `<div style="direction:rtl; font-family:Tahoma; padding:20px;">`;
    content += `<h2>رسید معامله - ${tx.id}</h2>`;
    content += `<p><strong>تاریخ:</strong> ${new Date(tx.date).toLocaleString("fa-IR")}</p>`;
    content += `<p><strong>نوع:</strong> ${tx.type}</p>`;
    if (tx.type === "صرافی-مشتری") {
      const cust = customers.find((c) => c.id === tx.customerId);
      content += `<p><strong>مشتری:</strong> ${cust?.name || tx.customerId}</p>`;
      content += `<p><strong>دریافت:</strong> ${tx.receivedAmount} ${currencyLabels[tx.receivedCurrency]}</p>`;
      content += `<p><strong>پرداخت:</strong> ${tx.paidAmount} ${currencyLabels[tx.paidCurrency]}</p>`;
      content += `<p><strong>نرخ:</strong> ${tx.rateUnit} ${currencyLabels[tx.rateBaseCurrency]} = ${tx.rate} ${currencyLabels[tx.rateBaseCurrency === tx.receivedCurrency ? tx.paidCurrency : tx.receivedCurrency]}</p>`;
    } else {
      const sender = customers.find((c) => c.id === tx.senderId);
      const receiver = customers.find((c) => c.id === tx.receiverId);
      content += `<p><strong>فرستنده:</strong> ${sender?.name} | ${tx.senderAmount} ${currencyLabels[tx.senderCurrency]}</p>`;
      content += `<p><strong>گیرنده:</strong> ${receiver?.name} | ${tx.receiverAmount} ${currencyLabels[tx.receiverCurrency]}</p>`;
      content += `<p><strong>نرخ:</strong> ${tx.rateUnit} ${currencyLabels[tx.rateBaseCurrency]} = ${tx.rate} ${currencyLabels[tx.rateBaseCurrency === tx.senderCurrency ? tx.receiverCurrency : tx.senderCurrency]}</p>`;
      if (tx.commission > 0) {
        content += `<p><strong>کارمزد:</strong> ${tx.commission} ${currencyLabels[tx.commissionCurrency]}</p>`;
      }
    }
    content += `<p><strong>مفاد:</strong> ${tx.terms}</p>`;
    content += `<p><strong>یادداشت:</strong> ${tx.note || "-"}</p>`;
    content += `<p><strong>وضعیت:</strong> ${tx.status === "voided" ? "ابطال شده" : "فعال"}</p>`;
    content += `</div>`;
    w.document.write(content);
    w.document.close();
    w.print();
  };

  // ---------- Render helpers ----------
  const customerName = (id: string) => customers.find((c) => c.id === id)?.name || id;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">معاملات ارزی</h1>

      {/* Tab buttons */}
      <div className="flex gap-2 border-b pb-2">
        <button
          onClick={() => setActiveTab("صرافی-مشتری")}
          className={`px-4 py-2 rounded-t-lg text-sm font-medium transition ${
            activeTab === "صرافی-مشتری"
              ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          تبادل ارز (صرافی با مشتری)
        </button>
        <button
          onClick={() => setActiveTab("بین-مشتریان")}
          className={`px-4 py-2 rounded-t-lg text-sm font-medium transition ${
            activeTab === "بین-مشتریان"
              ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          تبادل بین حساب مشتریان
        </button>
      </div>

      {/* Exchange Form */}
      {activeTab === "صرافی-مشتری" ? (
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">تبادل ارز</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-gray-600 font-bold">شماره سند</label>
              <input value={docId} readOnly className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-600 font-bold">تاریخ و ساعت</label>
              <input value={new Date().toLocaleString("fa-IR")} readOnly className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-600 font-bold">مشتری</label>
              <select value={exCustomer} onChange={(e) => setExCustomer(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">انتخاب مشتری</option>
                {customers.map((c, index) => (
                  <option key={c.id} value={c.id}>{index + 1}. {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 font-bold">ارز دریافتی (مشتری دریافت می‌کند)</label>
              <select value={exReceivedCurrency} onChange={(e) => setExReceivedCurrency(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                {currencies.map((cur) => (
                  <option key={cur} value={cur}>{currencyLabels[cur]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 font-bold">مبلغ دریافتی</label>
              <input type="number" value={exReceivedAmount} onChange={(e) => setExReceivedAmount(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-600 font-bold">ارز پرداختی (مشتری می‌پردازد)</label>
              <select value={exPaidCurrency} onChange={(e) => setExPaidCurrency(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                {currencies.map((cur) => (
                  <option key={cur} value={cur}>{currencyLabels[cur]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 font-bold">مبلغ پرداختی (محاسبه شده)</label>
              <input type="text" value={exPaidAmount} readOnly className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-600 font-bold">نرخ تبدیل</label>
              <input type="number" step="any" value={exRate} onChange={(e) => setExRate(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-600 font-bold">مبنای نرخ (ارز پایه)</label>
              <select value={exRateBaseCurrency} onChange={(e) => setExRateBaseCurrency(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value={exReceivedCurrency}>{currencyLabels[exReceivedCurrency]} (دریافتی)</option>
                <option value={exPaidCurrency}>{currencyLabels[exPaidCurrency]} (پرداختی)</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 font-bold">واحد نرخ (مثلاً 1، 100، 1000)</label>
              <input type="number" value={exRateUnit} onChange={(e) => setExRateUnit(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-600 font-bold">مفاد معامله</label>
              <input value={terms} onChange={(e) => setTerms(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-600 font-bold">یادداشت</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div className="flex items-end">
              <button onClick={submitExchange} className="w-full py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg hover:shadow-lg text-sm">ثبت معامله</button>
            </div>
          </div>
        </div>
      ) : (
        /* Transfer Form */
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">تبادل بین حساب مشتریان</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-gray-600 font-bold">شماره سند</label>
              <input value={docId} readOnly className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-600 font-bold">تاریخ و ساعت</label>
              <input value={new Date().toLocaleString("fa-IR")} readOnly className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-600 font-bold">مشتری فرستنده</label>
              <select value={trSender} onChange={(e) => setTrSender(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">انتخاب مشتری</option>
                {customers.map((c, index) => (
                  <option key={c.id} value={c.id}>{index + 1}. {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 font-bold">ارز فرستنده</label>
              <select value={trSenderCurrency} onChange={(e) => setTrSenderCurrency(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                {currencies.map((cur) => (
                  <option key={cur} value={cur}>{currencyLabels[cur]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 font-bold">مبلغ فرستنده</label>
              <input type="number" value={trSenderAmount} onChange={(e) => setTrSenderAmount(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-600 font-bold">مشتری گیرنده</label>
              <select value={trReceiver} onChange={(e) => setTrReceiver(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">انتخاب مشتری</option>
                {customers.map((c, index) => (
                  <option key={c.id} value={c.id}>{index + 1}. {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 font-bold">ارز گیرنده</label>
              <select value={trReceiverCurrency} onChange={(e) => setTrReceiverCurrency(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                {currencies.map((cur) => (
                  <option key={cur} value={cur}>{currencyLabels[cur]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 font-bold">مبلغ گیرنده (محاسبه شده)</label>
              <input type="text" value={trReceiverAmount} readOnly className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-600 font-bold">نرخ تبدیل</label>
              <input type="number" step="any" value={trRate} onChange={(e) => setTrRate(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-600 font-bold">مبنای نرخ (ارز پایه)</label>
              <select value={trRateBaseCurrency} onChange={(e) => setTrRateBaseCurrency(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value={trSenderCurrency}>{currencyLabels[trSenderCurrency]} (فرستنده)</option>
                <option value={trReceiverCurrency}>{currencyLabels[trReceiverCurrency]} (گیرنده)</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 font-bold">واحد نرخ (مثلاً 1، 100، 1000)</label>
              <input type="number" value={trRateUnit} onChange={(e) => setTrRateUnit(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-600 font-bold">کارمزد (اختیاری)</label>
              <input type="number" value={trCommission} onChange={(e) => setTrCommission(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-600 font-bold">ارز کارمزد</label>
              <select value={trCommissionCurrency} onChange={(e) => setTrCommissionCurrency(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                {currencies.map((cur) => (
                  <option key={cur} value={cur}>{currencyLabels[cur]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 font-bold">یادداشت</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div className="flex items-end">
              <button onClick={submitTransfer} className="w-full py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:shadow-lg text-sm">ثبت معامله</button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Balances */}
      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">موجودی فعلی مشتریان</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="py-2 px-3 text-right font-bold">مشتری</th>
                {currencies.map((c) => (
                  <th key={c} className="py-2 px-3 text-right font-bold">{currencyLabels[c]}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map((cust) => {
                const bal = liveBalances[cust.id] || cust.balances;
                return (
                  <tr key={cust.id} className="hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium">{cust.name}</td>
                    {currencies.map((cur) => (
                      <td key={cur} className="py-2 px-3">{bal[cur]?.toLocaleString()}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <h2 className="text-lg font-semibold text-gray-700 p-5 pb-2">آخرین معاملات</h2>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="py-3 px-2 text-right font-bold">سند</th>
              <th className="py-3 px-2 text-right font-bold">تاریخ</th>
              <th className="py-3 px-2 text-right font-bold">نوع معامله</th>
              <th className="py-3 px-2 text-right font-bold">مشتری/فرستنده</th>
              <th className="py-3 px-2 text-right font-bold">دریافت</th>
              <th className="py-3 px-2 text-right font-bold">پرداخت</th>
              <th className="py-3 px-2 text-right font-bold">نرخ</th>
              <th className="py-3 px-2 text-right font-bold">مفاد</th>
              <th className="py-3 px-2 text-right font-bold">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {transactions.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-8 text-gray-400">هیچ معامله‌ای ثبت نشده است</td>
              </tr>
            )}
            {transactions.map((tx) => {
              const isVoided = tx.status === "voided";
              return (
                <tr key={tx.id} className={`hover:bg-gray-50 ${isVoided ? "opacity-60 line-through" : ""}`}>
                  <td className="py-3 px-2 font-mono text-xs">{tx.id}</td>
                  <td className="py-3 px-2 text-xs">{new Date(tx.date).toLocaleString("fa-IR")}</td>
                  <td className="py-3 px-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      tx.type === "صرافی-مشتری" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                    }`}>
                      {tx.type === "صرافی-مشتری" ? "صرافی-مشتری" : "بین مشتریان"}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    {tx.type === "صرافی-مشتری" ? customerName(tx.customerId) : customerName(tx.senderId)}
                  </td>
                  <td className="py-3 px-2">
                    {tx.type === "صرافی-مشتری"
                      ? `${tx.receivedAmount} ${currencyLabels[tx.receivedCurrency]}`
                      : `${tx.receiverAmount} ${currencyLabels[tx.receiverCurrency]}`
                    }
                  </td>
                  <td className="py-3 px-2">
                    {tx.type === "صرافی-مشتری"
                      ? `${tx.paidAmount} ${currencyLabels[tx.paidCurrency]}`
                      : `${tx.senderAmount} ${currencyLabels[tx.senderCurrency]}`
                    }
                  </td>
                  <td className="py-3 px-2 text-xs">
                    {`${tx.rateUnit} ${currencyLabels[tx.rateBaseCurrency]} = ${tx.rate} ${
                      tx.rateBaseCurrency ===
                        (tx.type === "صرافی-مشتری" ? tx.receivedCurrency : tx.senderCurrency)
                        ? (tx.type === "صرافی-مشتری" ? tx.paidCurrency : tx.receiverCurrency)
                        : (tx.type === "صرافی-مشتری" ? tx.receivedCurrency : tx.senderCurrency)
                    } ${currencyLabels[
                      tx.rateBaseCurrency ===
                        (tx.type === "صرافی-مشتری" ? tx.receivedCurrency : tx.senderCurrency)
                        ? (tx.type === "صرافی-مشتری" ? tx.paidCurrency : tx.receiverCurrency)
                        : (tx.type === "صرافی-مشتری" ? tx.receivedCurrency : tx.senderCurrency)
                    ]}`}
                  </td>
                  <td className="py-3 px-2 text-xs">{tx.terms}</td>
                  <td className="py-3 px-2">
                    <div className="flex gap-1 flex-wrap">
                      <button onClick={() => setViewTx(tx)} className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100">مشاهده</button>
                      <button onClick={() => printReceipt(tx)} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200">چاپ</button>
                      {!isVoided && (
                        <>
                          <button onClick={() => startEdit(tx)} className="px-2 py-1 text-xs bg-yellow-50 text-yellow-700 rounded hover:bg-yellow-100">ویرایش</button>
                          <button onClick={() => voidTransaction(tx.id)} className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100">ابطال</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* View Modal */}
      {viewTx && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setViewTx(null)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">جزئیات معامله</h2>
            <div className="space-y-2 text-sm">
              <p><strong>شماره:</strong> {viewTx.id}</p>
              <p><strong>تاریخ:</strong> {new Date(viewTx.date).toLocaleString("fa-IR")}</p>
              <p><strong>نوع:</strong> {viewTx.type}</p>
              {viewTx.type === "صرافی-مشتری" && (
                <>
                  <p><strong>مشتری:</strong> {customerName(viewTx.customerId)}</p>
                  <p><strong>دریافت:</strong> {viewTx.receivedAmount} {currencyLabels[viewTx.receivedCurrency]}</p>
                  <p><strong>پرداخت:</strong> {viewTx.paidAmount} {currencyLabels[viewTx.paidCurrency]}</p>
                  <p><strong>نرخ:</strong> {viewTx.rateUnit} {currencyLabels[viewTx.rateBaseCurrency]} = {viewTx.rate} {currencyLabels[viewTx.rateBaseCurrency === viewTx.receivedCurrency ? viewTx.paidCurrency : viewTx.receivedCurrency]}</p>
                </>
              )}
              {viewTx.type === "بین-مشتریان" && (
                <>
                  <p><strong>فرستنده:</strong> {customerName(viewTx.senderId)} | {viewTx.senderAmount} {currencyLabels[viewTx.senderCurrency]}</p>
                  <p><strong>گیرنده:</strong> {customerName(viewTx.receiverId)} | {viewTx.receiverAmount} {currencyLabels[viewTx.receiverCurrency]}</p>
                  {viewTx.commission > 0 && <p><strong>کارمزد:</strong> {viewTx.commission} {currencyLabels[viewTx.commissionCurrency]}</p>}
                  <p><strong>نرخ:</strong> {viewTx.rateUnit} {currencyLabels[viewTx.rateBaseCurrency]} = {viewTx.rate} {currencyLabels[viewTx.rateBaseCurrency === viewTx.senderCurrency ? viewTx.receiverCurrency : viewTx.senderCurrency]}</p>
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

      {/* Edit Modal */}
      {editMode && editingTx && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-2xl">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">ویرایش معامله</h2>
            {editingTx.type === "صرافی-مشتری" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold">مشتری</label>
                  <select
                    value={(editingTx as ExchangeTransaction).customerId}
                    onChange={(e) => setEditingTx({ ...editingTx, customerId: e.target.value } as ExchangeTransaction)}
                    className="w-full border rounded p-1"
                  >
                    {customers.map((c, index) => (
                      <option key={c.id} value={c.id}>{index + 1}. {c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold">ارز دریافتی</label>
                  <select
                    value={(editingTx as ExchangeTransaction).receivedCurrency}
                    onChange={(e) => setEditingTx({ ...editingTx, receivedCurrency: e.target.value } as ExchangeTransaction)}
                    className="w-full border rounded p-1"
                  >
                    {currencies.map((c) => <option key={c} value={c}>{currencyLabels[c]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-bold">مبلغ دریافتی</label>
                  <input
                    type="number"
                    value={(editingTx as ExchangeTransaction).receivedAmount}
                    onChange={(e) => setEditingTx({ ...editingTx, receivedAmount: +e.target.value } as ExchangeTransaction)}
                    className="w-full border rounded p-1"
                  />
                </div>
                <div>
                  <label className="font-bold">ارز پرداختی</label>
                  <select
                    value={(editingTx as ExchangeTransaction).paidCurrency}
                    onChange={(e) => setEditingTx({ ...editingTx, paidCurrency: e.target.value } as ExchangeTransaction)}
                    className="w-full border rounded p-1"
                  >
                    {currencies.map((c) => <option key={c} value={c}>{currencyLabels[c]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-bold">مبلغ پرداختی</label>
                  <input
                    type="number"
                    value={(editingTx as ExchangeTransaction).paidAmount}
                    onChange={(e) => setEditingTx({ ...editingTx, paidAmount: +e.target.value } as ExchangeTransaction)}
                    className="w-full border rounded p-1"
                  />
                </div>
                <div>
                  <label className="font-bold">نرخ</label>
                  <input
                    type="number"
                    value={(editingTx as ExchangeTransaction).rate}
                    onChange={(e) => setEditingTx({ ...editingTx, rate: +e.target.value } as ExchangeTransaction)}
                    className="w-full border rounded p-1"
                  />
                </div>
                <div>
                  <label className="font-bold">مبنای نرخ</label>
                  <select
                    value={(editingTx as ExchangeTransaction).rateBaseCurrency}
                    onChange={(e) => setEditingTx({ ...editingTx, rateBaseCurrency: e.target.value } as ExchangeTransaction)}
                    className="w-full border rounded p-1"
                  >
                    <option value={(editingTx as ExchangeTransaction).receivedCurrency}>{(editingTx as ExchangeTransaction).receivedCurrency}</option>
                    <option value={(editingTx as ExchangeTransaction).paidCurrency}>{(editingTx as ExchangeTransaction).paidCurrency}</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold">واحد نرخ</label>
                  <input
                    type="number"
                    value={(editingTx as ExchangeTransaction).rateUnit}
                    onChange={(e) => setEditingTx({ ...editingTx, rateUnit: +e.target.value } as ExchangeTransaction)}
                    className="w-full border rounded p-1"
                  />
                </div>
                <div>
                  <label className="font-bold">مفاد</label>
                  <input
                    value={editingTx.terms}
                    onChange={(e) => setEditingTx({ ...editingTx, terms: e.target.value })}
                    className="w-full border rounded p-1"
                  />
                </div>
                <div>
                  <label className="font-bold">یادداشت</label>
                  <input
                    value={editingTx.note}
                    onChange={(e) => setEditingTx({ ...editingTx, note: e.target.value })}
                    className="w-full border rounded p-1"
                  />
                </div>
              </div>
            )}
            {editingTx.type === "بین-مشتریان" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold">فرستنده</label>
                  <select
                    value={(editingTx as TransferTransaction).senderId}
                    onChange={(e) => setEditingTx({ ...editingTx, senderId: e.target.value } as TransferTransaction)}
                    className="w-full border rounded p-1"
                  >
                    {customers.map((c, index) => (
                      <option key={c.id} value={c.id}>{index + 1}. {c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold">گیرنده</label>
                  <select
                    value={(editingTx as TransferTransaction).receiverId}
                    onChange={(e) => setEditingTx({ ...editingTx, receiverId: e.target.value } as TransferTransaction)}
                    className="w-full border rounded p-1"
                  >
                    {customers.map((c, index) => (
                      <option key={c.id} value={c.id}>{index + 1}. {c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold">ارز فرستنده</label>
                  <select
                    value={(editingTx as TransferTransaction).senderCurrency}
                    onChange={(e) => setEditingTx({ ...editingTx, senderCurrency: e.target.value } as TransferTransaction)}
                    className="w-full border rounded p-1"
                  >
                    {currencies.map((c) => <option key={c} value={c}>{currencyLabels[c]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-bold">مبلغ فرستنده</label>
                  <input
                    type="number"
                    value={(editingTx as TransferTransaction).senderAmount}
                    onChange={(e) => setEditingTx({ ...editingTx, senderAmount: +e.target.value } as TransferTransaction)}
                    className="w-full border rounded p-1"
                  />
                </div>
                <div>
                  <label className="font-bold">ارز گیرنده</label>
                  <select
                    value={(editingTx as TransferTransaction).receiverCurrency}
                    onChange={(e) => setEditingTx({ ...editingTx, receiverCurrency: e.target.value } as TransferTransaction)}
                    className="w-full border rounded p-1"
                  >
                    {currencies.map((c) => <option key={c} value={c}>{currencyLabels[c]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-bold">مبلغ گیرنده</label>
                  <input
                    type="number"
                    value={(editingTx as TransferTransaction).receiverAmount}
                    onChange={(e) => setEditingTx({ ...editingTx, receiverAmount: +e.target.value } as TransferTransaction)}
                    className="w-full border rounded p-1"
                  />
                </div>
                <div>
                  <label className="font-bold">نرخ</label>
                  <input
                    type="number"
                    value={(editingTx as TransferTransaction).rate}
                    onChange={(e) => setEditingTx({ ...editingTx, rate: +e.target.value } as TransferTransaction)}
                    className="w-full border rounded p-1"
                  />
                </div>
                <div>
                  <label className="font-bold">مبنای نرخ</label>
                  <select
                    value={(editingTx as TransferTransaction).rateBaseCurrency}
                    onChange={(e) => setEditingTx({ ...editingTx, rateBaseCurrency: e.target.value } as TransferTransaction)}
                    className="w-full border rounded p-1"
                  >
                    <option value={(editingTx as TransferTransaction).senderCurrency}>{(editingTx as TransferTransaction).senderCurrency}</option>
                    <option value={(editingTx as TransferTransaction).receiverCurrency}>{(editingTx as TransferTransaction).receiverCurrency}</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold">واحد نرخ</label>
                  <input
                    type="number"
                    value={(editingTx as TransferTransaction).rateUnit}
                    onChange={(e) => setEditingTx({ ...editingTx, rateUnit: +e.target.value } as TransferTransaction)}
                    className="w-full border rounded p-1"
                  />
                </div>
                <div>
                  <label className="font-bold">کارمزد</label>
                  <input
                    type="number"
                    value={(editingTx as TransferTransaction).commission}
                    onChange={(e) => setEditingTx({ ...editingTx, commission: +e.target.value } as TransferTransaction)}
                    className="w-full border rounded p-1"
                  />
                </div>
                <div>
                  <label className="font-bold">ارز کارمزد</label>
                  <select
                    value={(editingTx as TransferTransaction).commissionCurrency}
                    onChange={(e) => setEditingTx({ ...editingTx, commissionCurrency: e.target.value } as TransferTransaction)}
                    className="w-full border rounded p-1"
                  >
                    {currencies.map((c) => <option key={c} value={c}>{currencyLabels[c]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-bold">یادداشت</label>
                  <input
                    value={editingTx.note}
                    onChange={(e) => setEditingTx({ ...editingTx, note: e.target.value })}
                    className="w-full border rounded p-1"
                  />
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditMode(false)} className="px-4 py-2 bg-gray-200 rounded-lg">انصراف</button>
              <button onClick={saveEdit} className="px-4 py-2 bg-blue-500 text-white rounded-lg">ذخیره</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
