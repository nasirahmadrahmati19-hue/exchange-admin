"use client";
import { useState, useMemo } from "react";

// ---------- Types ----------
type ExchangeType = "صرافی-مشتری" | "بین-مشتریان";

interface BaseTransaction {
  id: string;
  type: ExchangeType;
  date: string; // ISO
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
  rate: number; // receivedAmount / paidAmount
}

interface TransferTransaction extends BaseTransaction {
  type: "بین-مشتریان";
  senderId: string;
  receiverId: string;
  senderCurrency: string;
  senderAmount: number;
  receiverCurrency: string;
  receiverAmount: number;
  rate: number; // senderAmount / receiverAmount (or 1 if same currency)
  commission: number;
  commissionCurrency: string;
}

type Transaction = ExchangeTransaction | TransferTransaction;

interface Customer {
  id: string;
  name: string;
  balances: Record<string, number>; // AFN, USD, IRR, PKR
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

// ---------- Helper to recalc balances from transactions ----------
function computeBalances(customers: Customer[], transactions: Transaction[]) {
  const balances: Record<string, Record<string, number>> = {};
  customers.forEach((c) => {
    balances[c.id] = { ...c.balances };
  });

  transactions.forEach((tx) => {
    if (tx.status === "voided") return;

    if (tx.type === "صرافی-مشتری") {
      // Customer gives "paidCurrency" amount, gets "receivedCurrency" amount
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
        // commission deducted from sender
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
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<"صرافی-مشتری" | "بین-مشتریان">("صرافی-مشتری");

  // derived balances
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
  const [exCustomer, setExCustomer] = useState(customers[0]?.id || "");
  const [exReceivedCurrency, setExReceivedCurrency] = useState("AFN");
  const [exReceivedAmount, setExReceivedAmount] = useState("");
  const [exPaidCurrency, setExPaidCurrency] = useState("USD");
  const [exPaidAmount, setExPaidAmount] = useState("");
  const [exRate, setExRate] = useState("");

  // Transfer form
  const [trSender, setTrSender] = useState(customers[0]?.id || "");
  const [trSenderCurrency, setTrSenderCurrency] = useState("AFN");
  const [trSenderAmount, setTrSenderAmount] = useState("");
  const [trReceiver, setTrReceiver] = useState(customers[1]?.id || "");
  const [trReceiverCurrency, setTrReceiverCurrency] = useState("AFN");
  const [trReceiverAmount, setTrReceiverAmount] = useState("");
  const [trRate, setTrRate] = useState("1");
  const [trCommission, setTrCommission] = useState("0");
  const [trCommissionCurrency, setTrCommissionCurrency] = useState("AFN");

  // Edit state
  const [editMode, setEditMode] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // View / Print state
  const [viewTx, setViewTx] = useState<Transaction | null>(null);

  // ---------- Handlers: auto-calc ----------
  const handleExRateChange = (val: string) => {
    setExRate(val);
    if (val && exReceivedAmount) {
      const calcPaid = (parseFloat(exReceivedAmount) / parseFloat(val)).toFixed(2);
      setExPaidAmount(calcPaid);
    }
  };
  const handleExReceivedChange = (val: string) => {
    setExReceivedAmount(val);
    if (val && exRate) {
      setExPaidAmount((parseFloat(val) / parseFloat(exRate)).toFixed(2));
    }
  };

  const handleTrRateChange = (val: string) => {
    setTrRate(val);
    if (val && trSenderAmount && trSenderCurrency === trReceiverCurrency) {
      setTrReceiverAmount(trSenderAmount); // same currency
    } else if (val && trSenderAmount) {
      setTrReceiverAmount((parseFloat(trSenderAmount) / parseFloat(val)).toFixed(2));
    }
  };
  const handleTrSenderAmountChange = (val: string) => {
    setTrSenderAmount(val);
    if (val && trRate && trSenderCurrency === trReceiverCurrency) {
      setTrReceiverAmount(val);
    } else if (val && trRate) {
      setTrReceiverAmount((parseFloat(val) / parseFloat(trRate)).toFixed(2));
    }
  };

  // Reset form
  const resetForm = () => {
    setDocId(generateDocId());
    setNote("");
    setTerms("نقدی");
    setExCustomer(customers[0]?.id || "");
    setExReceivedCurrency("AFN");
    setExReceivedAmount("");
    setExPaidCurrency("USD");
    setExPaidAmount("");
    setExRate("");
    setTrSender(customers[0]?.id || "");
    setTrSenderCurrency("AFN");
    setTrSenderAmount("");
    setTrReceiver(customers[1]?.id || "");
    setTrReceiverCurrency("AFN");
    setTrReceiverAmount("");
    setTrRate("1");
    setTrCommission("0");
    setTrCommissionCurrency("AFN");
  };

  // ---------- Submit ----------
  const submitExchange = () => {
    if (!exCustomer || !exReceivedAmount || !exPaidAmount || !exRate) return;
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
      terms,
      note,
      status: "active",
    };
    setTransactions([tx, ...transactions]);
    resetForm();
  };

  const submitTransfer = () => {
    if (!trSender || !trReceiver || !trSenderAmount || !trReceiverAmount || !trRate) return;
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
      commission: parseFloat(trCommission) || 0,
      commissionCurrency: trCommissionCurrency,
      note,
      terms,
      status: "active",
    };
    setTransactions([tx, ...transactions]);
    resetForm();
  };

  // ---------- Void ----------
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
      content += `<p><strong>نرخ:</strong> ${tx.rate}</p>`;
    } else {
      const sender = customers.find((c) => c.id === tx.senderId);
      const receiver = customers.find((c) => c.id === tx.receiverId);
      content += `<p><strong>فرستنده:</strong> ${sender?.name} | ${tx.senderAmount} ${currencyLabels[tx.senderCurrency]}</p>`;
      content += `<p><strong>گیرنده:</strong> ${receiver?.name} | ${tx.receiverAmount} ${currencyLabels[tx.receiverCurrency]}</p>`;
      content += `<p><strong>نرخ تبدیل:</strong> ${tx.rate}</p>`;
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

  // ---------- Render ----------
  const customerName = (id: string) => customers.find((c) => c.id === id)?.name || id;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">معاملات ارزی</h1>

      {/* تب‌های انتخاب نوع معامله */}
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

      {/* فرم‌ها */}
      {activeTab === "صرافی-مشتری" ? (
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">تبادل ارز</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-gray-600">شماره سند</label>
              <input value={docId} readOnly className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-600">تاریخ و ساعت</label>
              <input value={new Date().toLocaleString("fa-IR")} readOnly className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-600">مشتری</label>
              <select value={exCustomer} onChange={(e) => setExCustomer(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600">ارز دریافتی (مشتری دریافت می‌کند)</label>
              <select value={exReceivedCurrency} onChange={(e) => setExReceivedCurrency(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                {currencies.map((cur) => (
                  <option key={cur} value={cur}>{currencyLabels[cur]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600">مبلغ دریافتی</label>
              <input type="number" value={exReceivedAmount} onChange={(e) => handleExReceivedChange(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-600">ارز پرداختی (مشتری می‌پردازد)</label>
              <select value={exPaidCurrency} onChange={(e) => setExPaidCurrency(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                {currencies.map((cur) => (
                  <option key={cur} value={cur}>{currencyLabels[cur]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600">مبلغ پرداختی</label>
              <input type="number" value={exPaidAmount} readOnly className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-600">نرخ تبدیل</label>
              <input type="number" step="any" value={exRate} onChange={(e) => handleExRateChange(e.target.value)} placeholder="مثلاً 85" className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-600">مفاد معامله</label>
              <input value={terms} onChange={(e) => setTerms(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-600">یادداشت</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div className="flex items-end">
              <button onClick={submitExchange} className="w-full py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg hover:shadow-lg text-sm">ثبت معامله</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">تبادل بین حساب مشتریان</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-gray-600">شماره سند</label>
              <input value={docId} readOnly className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-600">تاریخ و ساعت</label>
              <input value={new Date().toLocaleString("fa-IR")} readOnly className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-600">مشتری فرستنده</label>
              <select value={trSender} onChange={(e) => setTrSender(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600">ارز فرستنده</label>
              <select value={trSenderCurrency} onChange={(e) => { setTrSenderCurrency(e.target.value); setTrReceiverAmount(""); }} className="w-full px-3 py-2 border rounded-lg text-sm">
                {currencies.map((cur) => (
                  <option key={cur} value={cur}>{currencyLabels[cur]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600">مبلغ فرستنده</label>
              <input type="number" value={trSenderAmount} onChange={(e) => handleTrSenderAmountChange(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-600">مشتری گیرنده</label>
              <select value={trReceiver} onChange={(e) => setTrReceiver(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600">ارز گیرنده</label>
              <select value={trReceiverCurrency} onChange={(e) => setTrReceiverCurrency(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                {currencies.map((cur) => (
                  <option key={cur} value={cur}>{currencyLabels[cur]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600">مبلغ گیرنده</label>
              <input type="number" value={trReceiverAmount} readOnly className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-600">نرخ تبدیل</label>
              <input type="number" step="any" value={trRate} onChange={(e) => handleTrRateChange(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-600">کارمزد (اختیاری)</label>
              <input type="number" value={trCommission} onChange={(e) => setTrCommission(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-600">ارز کارمزد</label>
              <select value={trCommissionCurrency} onChange={(e) => setTrCommissionCurrency(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                {currencies.map((cur) => (
                  <option key={cur} value={cur}>{currencyLabels[cur]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600">یادداشت</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div className="flex items-end">
              <button onClick={submitTransfer} className="w-full py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:shadow-lg text-sm">ثبت معامله</button>
            </div>
          </div>
        </div>
      )}

      {/* موجودی مشتریان */}
      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">موجودی فعلی مشتریان</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="py-2 px-3 text-right">مشتری</th>
                {currencies.map((c) => (
                  <th key={c} className="py-2 px-3 text-right">{currencyLabels[c]}</th>
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

      {/* جدول آخرین معاملات */}
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <h2 className="text-lg font-semibold text-gray-700 p-5 pb-2">آخرین معاملات</h2>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="py-3 px-2 text-right">سند</th>
              <th className="py-3 px-2 text-right">تاریخ</th>
              <th className="py-3 px-2 text-right">نوع معامله</th>
              <th className="py-3 px-2 text-right">مشتری/فرستنده</th>
              <th className="py-3 px-2 text-right">دریافت</th>
              <th className="py-3 px-2 text-right">پرداخت</th>
              <th className="py-3 px-2 text-right">نرخ</th>
              <th className="py-3 px-2 text-right">مفاد</th>
              <th className="py-3 px-2 text-right">عملیات</th>
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
                  <td className="py-3 px-2">{tx.rate}</td>
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

      {/* مودال مشاهده جزئیات */}
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
                </>
              )}
              {viewTx.type === "بین-مشتریان" && (
                <>
                  <p><strong>فرستنده:</strong> {customerName(viewTx.senderId)} | {viewTx.senderAmount} {currencyLabels[viewTx.senderCurrency]}</p>
                  <p><strong>گیرنده:</strong> {customerName(viewTx.receiverId)} | {viewTx.receiverAmount} {currencyLabels[viewTx.receiverCurrency]}</p>
                  {viewTx.commission > 0 && <p><strong>کارمزد:</strong> {viewTx.commission} {currencyLabels[viewTx.commissionCurrency]}</p>}
                </>
              )}
              <p><strong>نرخ:</strong> {viewTx.rate}</p>
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
          <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-2xl">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">ویرایش معامله</h2>
            {editingTx.type === "صرافی-مشتری" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label>مشتری</label>
                  <select value={(editingTx as ExchangeTransaction).customerId} onChange={(e) => setEditingTx({...editingTx, customerId: e.target.value} as ExchangeTransaction)} className="w-full border rounded p-1">
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label>ارز دریافتی</label>
                  <select value={(editingTx as ExchangeTransaction).receivedCurrency} onChange={(e) => setEditingTx({...editingTx, receivedCurrency: e.target.value} as ExchangeTransaction)} className="w-full border rounded p-1">
                    {currencies.map(c => <option key={c} value={c}>{currencyLabels[c]}</option>)}
                  </select>
                </div>
                <div>
                  <label>مبلغ دریافتی</label>
                  <input type="number" value={(editingTx as ExchangeTransaction).receivedAmount} onChange={(e) => setEditingTx({...editingTx, receivedAmount: +e.target.value} as ExchangeTransaction)} className="w-full border rounded p-1" />
                </div>
                <div>
                  <label>ارز پرداختی</label>
                  <select value={(editingTx as ExchangeTransaction).paidCurrency} onChange={(e) => setEditingTx({...editingTx, paidCurrency: e.target.value} as ExchangeTransaction)} className="w-full border rounded p-1">
                    {currencies.map(c => <option key={c} value={c}>{currencyLabels[c]}</option>)}
                  </select>
                </div>
                <div>
                  <label>مبلغ پرداختی</label>
                  <input type="number" value={(editingTx as ExchangeTransaction).paidAmount} onChange={(e) => setEditingTx({...editingTx, paidAmount: +e.target.value} as ExchangeTransaction)} className="w-full border rounded p-1" />
                </div>
                <div>
                  <label>نرخ</label>
                  <input type="number" value={(editingTx as ExchangeTransaction).rate} onChange={(e) => setEditingTx({...editingTx, rate: +e.target.value} as ExchangeTransaction)} className="w-full border rounded p-1" />
                </div>
              </div>
            )}
            {editingTx.type === "بین-مشتریان" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label>فرستنده</label>
                  <select value={(editingTx as TransferTransaction).senderId} onChange={(e) => setEditingTx({...editingTx, senderId: e.target.value} as TransferTransaction)} className="w-full border rounded p-1">
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label>گیرنده</label>
                  <select value={(editingTx as TransferTransaction).receiverId} onChange={(e) => setEditingTx({...editingTx, receiverId: e.target.value} as TransferTransaction)} className="w-full border rounded p-1">
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label>ارز فرستنده</label>
                  <select value={(editingTx as TransferTransaction).senderCurrency} onChange={(e) => setEditingTx({...editingTx, senderCurrency: e.target.value} as TransferTransaction)} className="w-full border rounded p-1">
                    {currencies.map(c => <option key={c} value={c}>{currencyLabels[c]}</option>)}
                  </select>
                </div>
                <div>
                  <label>مبلغ فرستنده</label>
                  <input type="number" value={(editingTx as TransferTransaction).senderAmount} onChange={(e) => setEditingTx({...editingTx, senderAmount: +e.target.value} as TransferTransaction)} className="w-full border rounded p-1" />
                </div>
                <div>
                  <label>ارز گیرنده</label>
                  <select value={(editingTx as TransferTransaction).receiverCurrency} onChange={(e) => setEditingTx({...editingTx, receiverCurrency: e.target.value} as TransferTransaction)} className="w-full border rounded p-1">
                    {currencies.map(c => <option key={c} value={c}>{currencyLabels[c]}</option>)}
                  </select>
                </div>
                <div>
                  <label>مبلغ گیرنده</label>
                  <input type="number" value={(editingTx as TransferTransaction).receiverAmount} onChange={(e) => setEditingTx({...editingTx, receiverAmount: +e.target.value} as TransferTransaction)} className="w-full border rounded p-1" />
                </div>
                <div>
                  <label>نرخ</label>
                  <input type="number" value={(editingTx as TransferTransaction).rate} onChange={(e) => setEditingTx({...editingTx, rate: +e.target.value} as TransferTransaction)} className="w-full border rounded p-1" />
                </div>
                <div>
                  <label>کارمزد</label>
                  <input type="number" value={(editingTx as TransferTransaction).commission} onChange={(e) => setEditingTx({...editingTx, commission: +e.target.value} as TransferTransaction)} className="w-full border rounded p-1" />
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
