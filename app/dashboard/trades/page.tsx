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
  rate: number; // 1 baseUnit(receivedCurrency) = rate paidCurrency
}

interface TransferTransaction extends BaseTransaction {
  type: "بین-مشتریان";
  senderId: string;
  receiverId: string;
  senderCurrency: string;
  senderAmount: number;
  receiverCurrency: string;
  receiverAmount: number;
  rate: number; // 1 baseUnit(receiverCurrency) = rate senderCurrency
  commission: number;
  commissionCurrency: string;
}

type Transaction = ExchangeTransaction | TransferTransaction;

interface Customer {
  id: string;
  name: string;
  balances: Record<string, number>;
}

// ---------- واحد پایه هر ارز ----------
const baseUnits: Record<string, number> = {
  AFN: 1,
  USD: 1,
  IRR: 1000, // تومان
  PKR: 1,
};

function formatNumber(n: number): string {
  return n % 1 === 0 ? n.toString() : n.toFixed(2);
}

// ---------- موتور تبدیل مشترک ----------
function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rate: number,
  isFromReceiver: boolean
): number {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  const receiverCurrency = isFromReceiver ? fromCurrency : toCurrency;
  const baseReceiver = baseUnits[receiverCurrency] || 1;

  if (isFromReceiver) {
    // از ارز دریافتی (گیرنده) به فرستنده
    return (amount * rate) / baseReceiver;
  } else {
    // از فرستنده به گیرنده
    return (amount / rate) * baseReceiver;
  }
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

// ---------- Balance calculation ----------
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

  // Transfer form
  const [trSender, setTrSender] = useState("");
  const [trSenderCurrency, setTrSenderCurrency] = useState("AFN");
  const [trSenderAmount, setTrSenderAmount] = useState("");
  const [trReceiver, setTrReceiver] = useState("");
  const [trReceiverCurrency, setTrReceiverCurrency] = useState("AFN");
  const [trReceiverAmount, setTrReceiverAmount] = useState("");
  const [trRate, setTrRate] = useState("1");
  const [trCommission, setTrCommission] = useState("0");
  const [trCommissionCurrency, setTrCommissionCurrency] = useState("AFN");

  // Edit / View states
  const [editMode, setEditMode] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [viewTx, setViewTx] = useState<Transaction | null>(null);

  // ---------- محاسبه تبادل صرافی-مشتری (همان منطق انتقال) ----------
  const computeExchangePaid = () => {
    if (!exRate || !exReceivedAmount) return;
    const received = parseFloat(exReceivedAmount);
    const rate = parseFloat(exRate);
    if (isNaN(received) || isNaN(rate) || rate === 0) return;

    // استفاده از همان پارامتر false که در انتقال استفاده می‌شود
    const paid = convertCurrency(received, exReceivedCurrency, exPaidCurrency, rate, false);
    setExPaidAmount(formatNumber(paid));
  };

  useMemo(() => computeExchangePaid(), [exReceivedAmount, exRate, exReceivedCurrency, exPaidCurrency]);

  // ---------- محاسبه تبادل بین مشتریان ----------
  const computeTransferReceiver = () => {
    if (!trRate || !trSenderAmount) return;
    const senderAmt = parseFloat(trSenderAmount);
    const rate = parseFloat(trRate);
    if (isNaN(senderAmt) || isNaN(rate) || rate === 0) return;

    const receiver = convertCurrency(senderAmt, trSenderCurrency, trReceiverCurrency, rate, false);
    setTrReceiverAmount(formatNumber(receiver));
  };

  useMemo(() => computeTransferReceiver(), [trSenderAmount, trRate, trSenderCurrency, trReceiverCurrency]);

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
    setTrSender("");
    setTrSenderCurrency("AFN");
    setTrSenderAmount("");
    setTrReceiver("");
    setTrReceiverCurrency("AFN");
    setTrReceiverAmount("");
    setTrRate("1");
    setTrCommission("0");
    setTrCommissionCurrency("AFN");
  };

  // ---------- Submit Exchange ----------
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

  // ---------- Submit Transfer ----------
  const submitTransfer = () => {
    if (!trSender || !trReceiver || !trSenderAmount || !trRate) return;
    if (trSender === trReceiver) {
      alert("فرستنده و گیرنده نمی‌توانند یکسان باشند");
      return;
    }

    const senderAmountNum = parseFloat(trSenderAmount);
    const rateNum = parseFloat(trRate);
    const commissionNum = parseFloat(trCommission) || 0;

    const receiverAmountNum = convertCurrency(
      senderAmountNum,
      trSenderCurrency,
      trReceiverCurrency,
      rateNum,
      false
    );

    const tx: TransferTransaction = {
      id: docId,
      type: "بین-مشتریان",
      date: new Date().toISOString(),
      senderId: trSender,
      receiverId: trReceiver,
      senderCurrency: trSenderCurrency,
      senderAmount: senderAmountNum,
      receiverCurrency: trReceiverCurrency,
      receiverAmount: receiverAmountNum,
      rate: rateNum,
      commission: commissionNum,
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
      const bu = baseUnits[tx.receivedCurrency] || 1;
      content += `<p><strong>نرخ:</strong> ${bu} ${currencyLabels[tx.receivedCurrency]} = ${tx.rate} ${currencyLabels[tx.paidCurrency]}</p>`;
    } else {
      const sender = customers.find((c) => c.id === tx.senderId);
      const receiver = customers.find((c) => c.id === tx.receiverId);
      content += `<p><strong>فرستنده:</strong> ${sender?.name} | ${tx.senderAmount} ${currencyLabels[tx.senderCurrency]}</p>`;
      content += `<p><strong>گیرنده:</strong> ${receiver?.name} | ${tx.receiverAmount} ${currencyLabels[tx.receiverCurrency]}</p>`;
      const bu = baseUnits[tx.receiverCurrency] || 1;
      content += `<p><strong>نرخ:</strong> ${bu} ${currencyLabels[tx.receiverCurrency]} = ${tx.rate} ${currencyLabels[tx.senderCurrency]}</p>`;
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

  const customerName = (id: string) => customers.find((c) => c.id === id)?.name || id;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">معاملات ارزی</h1>

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

      {/* تب صرافی-مشتری */}
      {activeTab === "صرافی-مشتری" ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">تبادل ارز</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">شماره سند</label>
              <input value={docId} readOnly className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-gray-50 text-gray-800 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">تاریخ و ساعت</label>
              <input value={new Date().toLocaleString("fa-IR")} readOnly className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-gray-50 text-gray-800 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">مشتری</label>
              <select value={exCustomer} onChange={(e) => setExCustomer(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#092F3A]/20">
                <option value="">انتخاب مشتری</option>
                {customers.map((c, i) => (
                  <option key={c.id} value={c.id}>{i + 1}. {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">ارز دریافتی (مشتری دریافت می‌کند)</label>
              <select value={exReceivedCurrency} onChange={(e) => setExReceivedCurrency(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#092F3A]/20">
                {currencies.map(cur => <option key={cur} value={cur}>{currencyLabels[cur]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">مبلغ دریافتی</label>
              <input type="number" value={exReceivedAmount} onChange={(e) => setExReceivedAmount(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#092F3A]/20" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">ارز پرداختی (مشتری می‌پردازد)</label>
              <select value={exPaidCurrency} onChange={(e) => setExPaidCurrency(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#092F3A]/20">
                {currencies.map(cur => <option key={cur} value={cur}>{currencyLabels[cur]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">مبلغ پرداختی (محاسبه شده)</label>
              <input type="text" value={exPaidAmount} readOnly className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-gray-50 text-gray-800 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">نرخ تبدیل</label>
              <input type="number" step="any" value={exRate} onChange={(e) => setExRate(e.target.value)} placeholder={`${baseUnits[exReceivedCurrency]} ${currencyLabels[exReceivedCurrency]} = ? ${currencyLabels[exPaidCurrency]}`} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#092F3A]/20" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">مفاد معامله</label>
              <input value={terms} onChange={(e) => setTerms(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#092F3A]/20" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">یادداشت</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#092F3A]/20" />
            </div>
            <div className="flex items-end">
              <button onClick={submitExchange} className="w-full h-14 rounded-2xl bg-[#092F3A] text-white font-medium hover:bg-[#0a3f4a] transition-colors shadow-sm">
                ثبت معامله
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* تب تبادل بین مشتریان */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">تبادل بین حساب مشتریان</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">شماره سند</label>
              <input value={docId} readOnly className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-gray-50 text-gray-800 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">تاریخ و ساعت</label>
              <input value={new Date().toLocaleString("fa-IR")} readOnly className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-gray-50 text-gray-800 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">مشتری فرستنده</label>
              <select value={trSender} onChange={(e) => setTrSender(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#092F3A]/20">
                <option value="">انتخاب مشتری</option>
                {customers.map((c, i) => (
                  <option key={c.id} value={c.id}>{i + 1}. {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">ارز فرستنده</label>
              <select value={trSenderCurrency} onChange={(e) => setTrSenderCurrency(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#092F3A]/20">
                {currencies.map(cur => <option key={cur} value={cur}>{currencyLabels[cur]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">مبلغ فرستنده</label>
              <input type="number" value={trSenderAmount} onChange={(e) => setTrSenderAmount(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#092F3A]/20" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">مشتری گیرنده</label>
              <select value={trReceiver} onChange={(e) => setTrReceiver(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#092F3A]/20">
                <option value="">انتخاب مشتری</option>
                {customers.map((c, i) => (
                  <option key={c.id} value={c.id}>{i + 1}. {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">ارز گیرنده</label>
              <select value={trReceiverCurrency} onChange={(e) => setTrReceiverCurrency(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#092F3A]/20">
                {currencies.map(cur => <option key={cur} value={cur}>{currencyLabels[cur]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">مبلغ گیرنده (محاسبه شده)</label>
              <input type="text" value={trReceiverAmount} readOnly className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-gray-50 text-gray-800 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">نرخ تبدیل</label>
              <input type="number" step="any" value={trRate} onChange={(e) => setTrRate(e.target.value)} placeholder={`${baseUnits[trReceiverCurrency]} ${currencyLabels[trReceiverCurrency]} = ? ${currencyLabels[trSenderCurrency]}`} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#092F3A]/20" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">کارمزد (اختیاری)</label>
              <input type="number" value={trCommission} onChange={(e) => setTrCommission(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#092F3A]/20" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">ارز کارمزد</label>
              <select value={trCommissionCurrency} onChange={(e) => setTrCommissionCurrency(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#092F3A]/20">
                {currencies.map(cur => <option key={cur} value={cur}>{currencyLabels[cur]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">یادداشت</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#092F3A]/20" />
            </div>
            <div className="flex items-end">
              <button onClick={submitTransfer} className="w-full h-14 rounded-2xl bg-[#092F3A] text-white font-medium hover:bg-[#0a3f4a] transition-colors shadow-sm">
                ثبت معامله
              </button>
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
                    <span className={`px-2 py-0.5 rounded text-xs ${tx.type === "صرافی-مشتری" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
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
                    {tx.type === "صرافی-مشتری"
                      ? `${baseUnits[tx.receivedCurrency]} ${currencyLabels[tx.receivedCurrency]} = ${tx.rate} ${currencyLabels[tx.paidCurrency]}`
                      : `${baseUnits[tx.receiverCurrency]} ${currencyLabels[tx.receiverCurrency]} = ${tx.rate} ${currencyLabels[tx.senderCurrency]}`
                    }
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
                  <p><strong>نرخ:</strong> {baseUnits[viewTx.receivedCurrency]} {currencyLabels[viewTx.receivedCurrency]} = {viewTx.rate} {currencyLabels[viewTx.paidCurrency]}</p>
                </>
              )}
              {viewTx.type === "بین-مشتریان" && (
                <>
                  <p><strong>فرستنده:</strong> {customerName(viewTx.senderId)} | {viewTx.senderAmount} {currencyLabels[viewTx.senderCurrency]}</p>
                  <p><strong>گیرنده:</strong> {customerName(viewTx.receiverId)} | {viewTx.receiverAmount} {currencyLabels[viewTx.receiverCurrency]}</p>
                  <p><strong>نرخ:</strong> {baseUnits[viewTx.receiverCurrency]} {currencyLabels[viewTx.receiverCurrency]} = {viewTx.rate} {currencyLabels[viewTx.senderCurrency]}</p>
                  {viewTx.commission > 0 && <p><strong>کارمزد:</strong> {viewTx.commission} {currencyLabels[viewTx.commissionCurrency]}</p>}
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
                  <select value={(editingTx as ExchangeTransaction).customerId} onChange={(e) => setEditingTx({ ...editingTx, customerId: e.target.value } as ExchangeTransaction)} className="w-full border rounded p-1">
                    {customers.map((c, i) => <option key={c.id} value={c.id}>{i + 1}. {c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-bold">ارز دریافتی</label>
                  <select value={(editingTx as ExchangeTransaction).receivedCurrency} onChange={(e) => setEditingTx({ ...editingTx, receivedCurrency: e.target.value } as ExchangeTransaction)} className="w-full border rounded p-1">
                    {currencies.map(cur => <option key={cur} value={cur}>{currencyLabels[cur]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-bold">مبلغ دریافتی</label>
                  <input type="number" value={(editingTx as ExchangeTransaction).receivedAmount} onChange={(e) => setEditingTx({ ...editingTx, receivedAmount: +e.target.value } as ExchangeTransaction)} className="w-full border rounded p-1" />
                </div>
                <div>
                  <label className="font-bold">ارز پرداختی</label>
                  <select value={(editingTx as ExchangeTransaction).paidCurrency} onChange={(e) => setEditingTx({ ...editingTx, paidCurrency: e.target.value } as ExchangeTransaction)} className="w-full border rounded p-1">
                    {currencies.map(cur => <option key={cur} value={cur}>{currencyLabels[cur]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-bold">مبلغ پرداختی</label>
                  <input type="number" value={(editingTx as ExchangeTransaction).paidAmount} onChange={(e) => setEditingTx({ ...editingTx, paidAmount: +e.target.value } as ExchangeTransaction)} className="w-full border rounded p-1" />
                </div>
                <div>
                  <label className="font-bold">نرخ</label>
                  <input type="number" value={(editingTx as ExchangeTransaction).rate} onChange={(e) => setEditingTx({ ...editingTx, rate: +e.target.value } as ExchangeTransaction)} className="w-full border rounded p-1" />
                </div>
                <div>
                  <label className="font-bold">مفاد</label>
                  <input value={editingTx.terms} onChange={(e) => setEditingTx({ ...editingTx, terms: e.target.value })} className="w-full border rounded p-1" />
                </div>
                <div>
                  <label className="font-bold">یادداشت</label>
                  <input value={editingTx.note} onChange={(e) => setEditingTx({ ...editingTx, note: e.target.value })} className="w-full border rounded p-1" />
                </div>
              </div>
            )}
            {editingTx.type === "بین-مشتریان" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold">فرستنده</label>
                  <select value={(editingTx as TransferTransaction).senderId} onChange={(e) => setEditingTx({ ...editingTx, senderId: e.target.value } as TransferTransaction)} className="w-full border rounded p-1">
                    {customers.map((c, i) => <option key={c.id} value={c.id}>{i + 1}. {c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-bold">گیرنده</label>
                  <select value={(editingTx as TransferTransaction).receiverId} onChange={(e) => setEditingTx({ ...editingTx, receiverId: e.target.value } as TransferTransaction)} className="w-full border rounded p-1">
                    {customers.map((c, i) => <option key={c.id} value={c.id}>{i + 1}. {c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-bold">ارز فرستنده</label>
                  <select value={(editingTx as TransferTransaction).senderCurrency} onChange={(e) => setEditingTx({ ...editingTx, senderCurrency: e.target.value } as TransferTransaction)} className="w-full border rounded p-1">
                    {currencies.map(cur => <option key={cur} value={cur}>{currencyLabels[cur]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-bold">مبلغ فرستنده</label>
                  <input type="number" value={(editingTx as TransferTransaction).senderAmount} onChange={(e) => setEditingTx({ ...editingTx, senderAmount: +e.target.value } as TransferTransaction)} className="w-full border rounded p-1" />
                </div>
                <div>
                  <label className="font-bold">ارز گیرنده</label>
                  <select value={(editingTx as TransferTransaction).receiverCurrency} onChange={(e) => setEditingTx({ ...editingTx, receiverCurrency: e.target.value } as TransferTransaction)} className="w-full border rounded p-1">
                    {currencies.map(cur => <option key={cur} value={cur}>{currencyLabels[cur]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-bold">مبلغ گیرنده</label>
                  <input type="number" value={(editingTx as TransferTransaction).receiverAmount} onChange={(e) => setEditingTx({ ...editingTx, receiverAmount: +e.target.value } as TransferTransaction)} className="w-full border rounded p-1" />
                </div>
                <div>
                  <label className="font-bold">نرخ</label>
                  <input type="number" value={(editingTx as TransferTransaction).rate} onChange={(e) => setEditingTx({ ...editingTx, rate: +e.target.value } as TransferTransaction)} className="w-full border rounded p-1" />
                </div>
                <div>
                  <label className="font-bold">کارمزد</label>
                  <input type="number" value={(editingTx as TransferTransaction).commission} onChange={(e) => setEditingTx({ ...editingTx, commission: +e.target.value } as TransferTransaction)} className="w-full border rounded p-1" />
                </div>
                <div>
                  <label className="font-bold">ارز کارمزد</label>
                  <select value={(editingTx as TransferTransaction).commissionCurrency} onChange={(e) => setEditingTx({ ...editingTx, commissionCurrency: e.target.value } as TransferTransaction)} className="w-full border rounded p-1">
                    {currencies.map(cur => <option key={cur} value={cur}>{currencyLabels[cur]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-bold">یادداشت</label>
                  <input value={editingTx.note} onChange={(e) => setEditingTx({ ...editingTx, note: e.target.value })} className="w-full border rounded p-1" />
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
