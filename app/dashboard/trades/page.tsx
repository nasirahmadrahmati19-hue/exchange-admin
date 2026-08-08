"use client";

import { useEffect, useMemo, useState } from "react";

type ExchangeType = "صرافی-مشتری" | "بین-مشتریان";
type Status = "active" | "voided";

interface BaseTransaction {
  id: string;
  type: ExchangeType;
  date: string;
  terms: string;
  note: string;
  status: Status;
}

interface ExchangeTransaction extends BaseTransaction {
  type: "صرافی-مشتری";
  customerId: string;
  receivedCurrency: string;
  receivedAmount: number;
  paidCurrency: string;
  paidAmount: number;
  rate: number;
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
  commission: number;
  commissionCurrency: string;
}

type Transaction = ExchangeTransaction | TransferTransaction;

interface Customer {
  id: string;
  name: string;
  balances: Record<string, number>;
}

/* =========================
   ارزها
========================= */

const baseUnits: Record<string, number> = {
  AFN: 1,
  USD: 1,
  IRR: 1000,
  PKR: 1,
};

const currencies = ["AFN", "USD", "IRR", "PKR"];

const currencyLabels: Record<string, string> = {
  AFN: "افغانی",
  USD: "دالر",
  IRR: "تومان",
  PKR: "کلدار",
};

const currencyOrder = ["AFN", "USD", "IRR", "PKR"];

/* =========================
   ابزارها
========================= */

function formatNumber(n: number) {
  if (!Number.isFinite(n)) return "0";

  return n % 1 === 0
    ? n.toLocaleString("en-US")
    : n.toLocaleString("en-US", {
        maximumFractionDigits: 8,
      });
}

function getCanonicalPair(a: string, b: string): [string, string] {
  return currencyOrder.indexOf(a) <= currencyOrder.indexOf(b)
    ? [a, b]
    : [b, a];
}

/* =========================
   موتور اصلی تبدیل ارز
   این قسمت تغییر نکرده
========================= */

function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rate: number
) {
  if (!Number.isFinite(amount)) return 0;
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  if (fromCurrency === toCurrency) return amount;

  const [currency1, currency2] = getCanonicalPair(
    fromCurrency,
    toCurrency
  );

  const base2 = baseUnits[currency2] || 1;

  if (fromCurrency === currency1 && toCurrency === currency2) {
    return (amount / rate) * base2;
  }

  if (fromCurrency === currency2 && toCurrency === currency1) {
    return (amount / base2) * rate;
  }

  return 0;
}

function formatRateQuote(
  a: string,
  b: string,
  rate: number
) {
  if (a === b) {
    return `1 ${currencyLabels[a]} = 1 ${currencyLabels[b]}`;
  }

  const [c1, c2] = getCanonicalPair(a, b);
  const base2 = baseUnits[c2] || 1;

  return `${base2.toLocaleString()} ${
    currencyLabels[c2]
  } = ${formatNumber(rate)} ${currencyLabels[c1]}`;
}

/* =========================
   مشتریان
========================= */

const initialCustomers: Customer[] = [
  {
    id: "c1",
    name: "احمد رحیمی",
    balances: {
      AFN: 500000,
      USD: 10000,
      IRR: 0,
      PKR: 0,
    },
  },
  {
    id: "c2",
    name: "محمد ظاهر",
    balances: {
      AFN: 200000,
      USD: 5000,
      IRR: 0,
      PKR: 0,
    },
  },
  {
    id: "c3",
    name: "فاطمه حسینی",
    balances: {
      AFN: 0,
      USD: 0,
      IRR: 50000000,
      PKR: 0,
    },
  },
  {
    id: "c4",
    name: "علی کریمی",
    balances: {
      AFN: 0,
      USD: 0,
      IRR: 0,
      PKR: 200000,
    },
  },
];

const generateDocId = () =>
  `EX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

/* =========================
   محاسبه موجودی
========================= */

function computeBalances(
  customers: Customer[],
  transactions: Transaction[]
) {
  const balances: Record<string, Record<string, number>> = {};

  customers.forEach((c) => {
    balances[c.id] = { ...c.balances };
  });

  transactions.forEach((tx) => {
    if (tx.status === "voided") return;

    if (tx.type === "صرافی-مشتری") {
      const b = balances[tx.customerId];
      if (!b) return;

      b[tx.paidCurrency] =
        (b[tx.paidCurrency] || 0) - tx.paidAmount;

      b[tx.receivedCurrency] =
        (b[tx.receivedCurrency] || 0) + tx.receivedAmount;

      return;
    }

    const sender = balances[tx.senderId];
    const receiver = balances[tx.receiverId];

    if (sender) {
      sender[tx.senderCurrency] =
        (sender[tx.senderCurrency] || 0) - tx.senderAmount;

      if (tx.commission > 0) {
        sender[tx.commissionCurrency] =
          (sender[tx.commissionCurrency] || 0) -
          tx.commission;
      }
    }

    if (receiver) {
      receiver[tx.receiverCurrency] =
        (receiver[tx.receiverCurrency] || 0) +
        tx.receiverAmount;
    }
  });

  return balances;
}

/* =========================
   Component
========================= */

export default function CurrencyExchangePage() {
  const [customers] = useState(initialCustomers);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] =
    useState<ExchangeType>("صرافی-مشتری");

  const [docId, setDocId] = useState(generateDocId());
  const [terms, setTerms] = useState("نقدی");
  const [note, setNote] = useState("");

  /* صرافی با مشتری */
  const [exCustomer, setExCustomer] = useState("");
  const [exReceivedCurrency, setExReceivedCurrency] =
    useState("AFN");
  const [exReceivedAmount, setExReceivedAmount] =
    useState("");
  const [exPaidCurrency, setExPaidCurrency] =
    useState("USD");
  const [exPaidAmount, setExPaidAmount] =
    useState("");
  const [exRate, setExRate] = useState("");

  /* بین مشتریان */
  const [trSender, setTrSender] = useState("");
  const [trSenderCurrency, setTrSenderCurrency] =
    useState("AFN");
  const [trSenderAmount, setTrSenderAmount] =
    useState("");

  const [trReceiver, setTrReceiver] = useState("");
  const [trReceiverCurrency, setTrReceiverCurrency] =
    useState("AFN");
  const [trReceiverAmount, setTrReceiverAmount] =
    useState("");

  const [trRate, setTrRate] = useState("");
  const [trCommission, setTrCommission] = useState("0");
  const [trCommissionCurrency, setTrCommissionCurrency] =
    useState("AFN");

  const [viewTx, setViewTx] =
    useState<Transaction | null>(null);

  const [editingTx, setEditingTx] =
    useState<Transaction | null>(null);

  const [menuId, setMenuId] = useState<string | null>(null);

  const liveBalances = useMemo(
    () => computeBalances(customers, transactions),
    [customers, transactions]
  );

  /* =========================
     محاسبه خودکار مبلغ پرداختی
  ========================= */

  useEffect(() => {
    const amount = Number(exReceivedAmount);
    const rate = Number(exRate);

    if (
      !exReceivedAmount ||
      !exRate ||
      !Number.isFinite(amount) ||
      !Number.isFinite(rate) ||
      rate <= 0
    ) {
      setExPaidAmount("");
      return;
    }

    setExPaidAmount(
      formatNumber(
        convertAmount(
          amount,
          exReceivedCurrency,
          exPaidCurrency,
          rate
        )
      )
    );
  }, [
    exReceivedAmount,
    exRate,
    exReceivedCurrency,
    exPaidCurrency,
  ]);

  /* =========================
     محاسبه خودکار مبلغ گیرنده
  ========================= */

  useEffect(() => {
    const amount = Number(trSenderAmount);
    const rate = Number(trRate);

    if (
      !trSenderAmount ||
      !trRate ||
      !Number.isFinite(amount) ||
      !Number.isFinite(rate) ||
      rate <= 0
    ) {
      setTrReceiverAmount("");
      return;
    }

    setTrReceiverAmount(
      formatNumber(
        convertAmount(
          amount,
          trSenderCurrency,
          trReceiverCurrency,
          rate
        )
      )
    );
  }, [
    trSenderAmount,
    trRate,
    trSenderCurrency,
    trReceiverCurrency,
  ]);

  /* =========================
     پاک کردن فرم
  ========================= */

  const resetForm = () => {
    setDocId(generateDocId());
    setTerms("نقدی");
    setNote("");

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
    setTrRate("");
    setTrCommission("0");
    setTrCommissionCurrency("AFN");
  };

  /* =========================
     ثبت صرافی با مشتری
  ========================= */

  const submitExchange = () => {
    const received = Number(exReceivedAmount);
    const paid = Number(exPaidAmount);
    const rate = Number(exRate);

    if (
      !exCustomer ||
      !Number.isFinite(received) ||
      !Number.isFinite(paid) ||
      !Number.isFinite(rate) ||
      rate <= 0
    )
      return;

    const tx: ExchangeTransaction = {
      id: docId,
      type: "صرافی-مشتری",
      date: new Date().toISOString(),
      customerId: exCustomer,
      receivedCurrency: exReceivedCurrency,
      receivedAmount: received,
      paidCurrency: exPaidCurrency,
      paidAmount: paid,
      rate,
      terms,
      note,
      status: "active",
    };

    setTransactions((p) => [tx, ...p]);
    resetForm();
  };

  /* =========================
     ثبت بین مشتریان
  ========================= */

  const submitTransfer = () => {
    const senderAmount = Number(trSenderAmount);
    const rate = Number(trRate);
    const commission = Number(trCommission) || 0;

    if (!trSender || !trReceiver) return;

    if (trSender === trReceiver) {
      alert("فرستنده و گیرنده نمی‌توانند یکسان باشند");
      return;
    }

    if (
      !Number.isFinite(senderAmount) ||
      !Number.isFinite(rate) ||
      rate <= 0 ||
      commission < 0
    )
      return;

    const receiverAmount = convertAmount(
      senderAmount,
      trSenderCurrency,
      trReceiverCurrency,
      rate
    );

    const tx: TransferTransaction = {
      id: docId,
      type: "بین-مشتریان",
      date: new Date().toISOString(),
      senderId: trSender,
      receiverId: trReceiver,
      senderCurrency: trSenderCurrency,
      senderAmount,
      receiverCurrency: trReceiverCurrency,
      receiverAmount,
      rate,
      commission,
      commissionCurrency: trCommissionCurrency,
      terms,
      note,
      status: "active",
    };

    setTransactions((p) => [tx, ...p]);
    resetForm();
  };

  /* =========================
     عملیات
  ========================= */

  const voidTransaction = (id: string) => {
    if (!confirm("آیا این معامله ابطال شود؟")) return;

    setTransactions((p) =>
      p.map((tx) =>
        tx.id === id
          ? { ...tx, status: "voided" }
          : tx
      )
    );

    setMenuId(null);
  };

  const customerName = (id: string) =>
    customers.find((c) => c.id === id)?.name || id;

  /* =========================
     چاپ
  ========================= */

  const printReceipt = (tx: Transaction) => {
    const w = window.open("", "_blank");
    if (!w) return;

    const customer =
      tx.type === "صرافی-مشتری"
        ? customerName(tx.customerId)
        : `${customerName(tx.senderId)} → ${customerName(
            tx.receiverId
          )}`;

    const amounts =
      tx.type === "صرافی-مشتری"
        ? `
          <p>دریافت: ${formatNumber(tx.receivedAmount)}
          ${currencyLabels[tx.receivedCurrency]}</p>
          <p>پرداخت: ${formatNumber(tx.paidAmount)}
          ${currencyLabels[tx.paidCurrency]}</p>
        `
        : `
          <p>فرستنده: ${customerName(tx.senderId)}
          | ${formatNumber(tx.senderAmount)}
          ${currencyLabels[tx.senderCurrency]}</p>

          <p>گیرنده: ${customerName(tx.receiverId)}
          | ${formatNumber(tx.receiverAmount)}
          ${currencyLabels[tx.receiverCurrency]}</p>

          ${
            tx.commission > 0
              ? `<p>کارمزد: ${formatNumber(
                  tx.commission
                )} ${
                  currencyLabels[tx.commissionCurrency]
                }</p>`
              : ""
          }
        `;

    w.document.write(`
      <html dir="rtl">
      <head>
        <title>رسید ${tx.id}</title>
        <style>
          body{
            font-family:Tahoma;
            padding:30px;
            direction:rtl;
          }
        </style>
      </head>
      <body>
        <h2>رسید معامله</h2>
        <p><b>شماره:</b> ${tx.id}</p>
        <p><b>تاریخ:</b> ${new Date(
          tx.date
        ).toLocaleString("fa-IR")}</p>
        <p><b>نوع:</b> ${tx.type}</p>
        <p><b>مشتری:</b> ${customer}</p>
        ${amounts}
        <p><b>نرخ:</b> ${formatRateQuote(
          tx.type === "صرافی-مشتری"
            ? tx.receivedCurrency
            : tx.senderCurrency,
          tx.type === "صرافی-مشتری"
            ? tx.paidCurrency
            : tx.receiverCurrency,
          tx.rate
        )}</p>
        <p><b>مفاد:</b> ${tx.terms}</p>
        <p><b>یادداشت:</b> ${tx.note || "-"}</p>
        <p><b>وضعیت:</b> ${
          tx.status === "voided"
            ? "ابطال شده"
            : "فعال"
        }</p>
      </body>
      </html>
    `);

    w.document.close();
    w.print();
    setMenuId(null);
  };

  /* =========================
     UI
  ========================= */

  const CurrencySelect = ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-12 w-full rounded-xl border border-gray-200 px-3 bg-white"
    >
      {currencies.map((c) => (
        <option key={c} value={c}>
          {currencyLabels[c]}
        </option>
      ))}
    </select>
  );

  const CustomerSelect = ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-12 w-full rounded-xl border border-gray-200 px-3 bg-white"
    >
      <option value="">انتخاب مشتری</option>

      {customers.map((c, i) => (
        <option key={c.id} value={c.id}>
          {i + 1}. {c.name}
        </option>
      ))}
    </select>
  );

  return (
    <div
      dir="rtl"
      className="p-4 md:p-6 space-y-6 bg-gray-50 min-h-screen"
    >
      <h1 className="text-2xl font-bold text-gray-800">
        معاملات ارزی
      </h1>

      {/* تب‌ها */}

      <div className="flex gap-2 border-b pb-2">
        {(["صرافی-مشتری", "بین-مشتریان"] as ExchangeType[]).map(
          (tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 rounded-xl text-sm font-bold ${
                activeTab === tab
                  ? "bg-[#092F3A] text-white"
                  : "bg-white text-gray-600"
              }`}
            >
              {tab === "صرافی-مشتری"
                ? "تبادل ارز"
                : "تبادل بین حساب مشتریان"}
            </button>
          )
        )}
      </div>

      {/* =========================
          فرم صرافی با مشتری
      ========================= */}

      {activeTab === "صرافی-مشتری" && (
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-6">
          <h2 className="text-lg font-bold">
            تبادل ارز
          </h2>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="bg-gray-50 rounded-xl p-5 space-y-4">
              <h3 className="font-bold">
                اطلاعات مشتری و دریافتی
              </h3>

              <CustomerSelect
                value={exCustomer}
                onChange={setExCustomer}
              />

              <CurrencySelect
                value={exReceivedCurrency}
                onChange={setExReceivedCurrency}
              />

              <input
                type="number"
                value={exReceivedAmount}
                onChange={(e) =>
                  setExReceivedAmount(e.target.value)
                }
                placeholder="مبلغ دریافتی"
                className="h-12 w-full rounded-xl border px-3"
              />
            </div>

            <div className="bg-gray-50 rounded-xl p-5 space-y-4">
              <h3 className="font-bold">
                اطلاعات پرداختی
              </h3>

              <CurrencySelect
                value={exPaidCurrency}
                onChange={setExPaidCurrency}
              />

              <input
                value={exPaidAmount}
                readOnly
                placeholder="مبلغ پرداختی"
                className="h-12 w-full rounded-xl border px-3 bg-gray-100"
              />
            </div>
          </div>

          {/* فیلد نرخ مورد نظر شما */}

          <div>
            <label className="font-bold block mb-2">
              نرخ تبدیل
            </label>

            <input
              type="number"
              step="any"
              value={exRate}
              onChange={(e) => setExRate(e.target.value)}
              placeholder={
                exReceivedCurrency === exPaidCurrency
                  ? "بدون تبدیل"
                  : `مثلاً 65.90`
              }
              className="h-14 w-full rounded-xl border px-4"
            />

            {exRate &&
              exReceivedCurrency !== exPaidCurrency && (
                <p className="text-sm text-gray-500 mt-2">
                  {formatRateQuote(
                    exReceivedCurrency,
                    exPaidCurrency,
                    Number(exRate)
                  )}
                </p>
              )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <input
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="مفاد معامله"
              className="h-12 rounded-xl border px-3"
            />

            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="یادداشت"
              className="h-12 rounded-xl border px-3"
            />
          </div>

          <button
            onClick={submitExchange}
            className="w-full h-14 rounded-2xl bg-[#092F3A] text-white font-bold"
          >
            ثبت معامله
          </button>
        </div>
      )}

      {/* =========================
          انتقال بین مشتریان
      ========================= */}

      {activeTab === "بین-مشتریان" && (
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-6">
          <h2 className="text-lg font-bold">
            تبادل بین حساب مشتریان
          </h2>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="bg-blue-50 rounded-xl p-5 space-y-4">
              <h3 className="font-bold text-blue-700">
                فرستنده
              </h3>

              <CustomerSelect
                value={trSender}
                onChange={setTrSender}
              />

              <CurrencySelect
                value={trSenderCurrency}
                onChange={setTrSenderCurrency}
              />

              <input
                type="number"
                value={trSenderAmount}
                onChange={(e) =>
                  setTrSenderAmount(e.target.value)
                }
                placeholder="مبلغ فرستنده"
                className="h-12 w-full rounded-xl border px-3"
              />
            </div>

            <div className="bg-green-50 rounded-xl p-5 space-y-4">
              <h3 className="font-bold text-green-700">
                گیرنده
              </h3>

              <CustomerSelect
                value={trReceiver}
                onChange={setTrReceiver}
              />

              <CurrencySelect
                value={trReceiverCurrency}
                onChange={setTrReceiverCurrency}
              />

              <input
                value={trReceiverAmount}
                readOnly
                placeholder="مبلغ گیرنده"
                className="h-12 w-full rounded-xl border px-3 bg-gray-100"
              />
            </div>
          </div>

          {/* نرخ تبدیل */}

          <div>
            <label className="font-bold block mb-2">
              نرخ تبدیل
            </label>

            <input
              type="number"
              step="any"
              value={trRate}
              onChange={(e) => setTrRate(e.target.value)}
              placeholder="مثلاً 65.90"
              className="h-14 w-full rounded-xl border px-4"
            />

            {trRate &&
              trSenderCurrency !== trReceiverCurrency && (
                <p className="text-sm text-gray-500 mt-2">
                  {formatRateQuote(
                    trSenderCurrency,
                    trReceiverCurrency,
                    Number(trRate)
                  )}
                </p>
              )}
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <input
              type="number"
              value={trCommission}
              onChange={(e) =>
                setTrCommission(e.target.value)
              }
              placeholder="کارمزد"
              className="h-12 rounded-xl border px-3"
            />

            <CurrencySelect
              value={trCommissionCurrency}
              onChange={setTrCommissionCurrency}
            />

            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="یادداشت"
              className="h-12 rounded-xl border px-3"
            />
          </div>

          <button
            onClick={submitTransfer}
            className="w-full h-14 rounded-2xl bg-[#092F3A] text-white font-bold"
          >
            ثبت معامله
          </button>
        </div>
      )}

      {/* =========================
          موجودی مشتریان
      ========================= */}

      <div className="bg-white rounded-xl shadow p-5 overflow-x-auto">
        <h2 className="text-lg font-bold mb-4">
          موجودی فعلی مشتریان
        </h2>

        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-right">مشتری</th>

              {currencies.map((c) => (
                <th key={c} className="p-3 text-right">
                  {currencyLabels[c]}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {customers.map((customer) => {
              const balance =
                liveBalances[customer.id] ||
                customer.balances;

              return (
                <tr
                  key={customer.id}
                  className="border-t"
                >
                  <td className="p-3 font-bold">
                    {customer.name}
                  </td>

                  {currencies.map((c) => (
                    <td key={c} className="p-3">
                      {formatNumber(balance[c] || 0)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* =========================
          آخرین معاملات
      ========================= */}

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <h2 className="text-lg font-bold p-5">
          آخرین معاملات
        </h2>

        <table className="min-w-[1100px] w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-right">شماره</th>
              <th className="p-3 text-right">تاریخ</th>
              <th className="p-3 text-right">نوع معامله</th>
              <th className="p-3 text-right">
                مشتری/فرستنده
              </th>
              <th className="p-3 text-right">دریافت</th>
              <th className="p-3 text-right">پرداخت</th>
              <th className="p-3 text-right">نرخ</th>
              <th className="p-3 text-right">مفاد</th>
              <th className="p-3 text-right">عملیات</th>
            </tr>
          </thead>

          <tbody>
            {transactions.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="text-center p-8 text-gray-400"
                >
                  هیچ معامله‌ای ثبت نشده است
                </td>
              </tr>
            )}

            {transactions.map((tx) => {
              const voided = tx.status === "voided";

              const received =
                tx.type === "صرافی-مشتری"
                  ? `${formatNumber(
                      tx.receivedAmount
                    )} ${
                      currencyLabels[
                        tx.receivedCurrency
                      ]
                    }`
                  : `${formatNumber(
                      tx.receiverAmount
                    )} ${
                      currencyLabels[
                        tx.receiverCurrency
                      ]
                    }`;

              const paid =
                tx.type === "صرافی-مشتری"
                  ? `${formatNumber(
                      tx.paidAmount
                    )} ${
                      currencyLabels[
                        tx.paidCurrency
                      ]
                    }`
                  : `${formatNumber(
                      tx.senderAmount
                    )} ${
                      currencyLabels[
                        tx.senderCurrency
                      ]
                    }`;

              const rate =
                tx.type === "صرافی-مشتری"
                  ? formatRateQuote(
                      tx.receivedCurrency,
                      tx.paidCurrency,
                      tx.rate
                    )
                  : formatRateQuote(
                      tx.senderCurrency,
                      tx.receiverCurrency,
                      tx.rate
                    );

              return (
                <tr
                  key={tx.id}
                  className={`border-t hover:bg-gray-50 ${
                    voided
                      ? "opacity-50 line-through"
                      : ""
                  }`}
                >
                  {/* شماره */}

                  <td className="p-3 font-mono text-xs">
                    {tx.id}
                  </td>

                  <td className="p-3 text-xs">
                    {new Date(tx.date).toLocaleString(
                      "fa-IR"
                    )}
                  </td>

                  <td className="p-3">
                    <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs">
                      {tx.type}
                    </span>
                  </td>

                  <td className="p-3">
                    {tx.type === "صرافی-مشتری"
                      ? customerName(tx.customerId)
                      : customerName(tx.senderId)}
                  </td>

                  <td className="p-3">
                    {received}
                  </td>

                  <td className="p-3">
                    {paid}
                  </td>

                  <td className="p-3 text-xs">
                    {rate}
                  </td>

                  <td className="p-3">
                    {tx.terms}
                  </td>

                  {/* عملیات لیستی */}

                  <td className="p-3">
                    <select
                      value=""
                      onChange={(e) => {
                        const action = e.target.value;

                        if (action === "view") {
                          setViewTx(tx);
                        }

                        if (action === "edit") {
                          setEditingTx({
                            ...tx,
                          });
                        }

                        if (action === "print") {
                          printReceipt(tx);
                        }

                        if (action === "void") {
                          voidTransaction(tx.id);
                        }
                      }}
                      className="border rounded-lg px-2 py-1 bg-white text-xs"
                    >
                      <option value="">
                        عملیات
                      </option>

                      <option value="view">
                        مشاهده
                      </option>

                      {!voided && (
                        <option value="edit">
                          ویرایش
                        </option>
                      )}

                      <option value="print">
                        چاپ
                      </option>

                      {!voided && (
                        <option value="void">
                          ابطال
                        </option>
                      )}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* =========================
          مشاهده
      ========================= */}

      {viewTx && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setViewTx(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-5">
              جزئیات معامله
            </h2>

            <div className="space-y-3 text-sm">
              <p>
                <b>شماره:</b> {viewTx.id}
              </p>

              <p>
                <b>تاریخ:</b>{" "}
                {new Date(
                  viewTx.date
                ).toLocaleString("fa-IR")}
              </p>

              <p>
                <b>نوع:</b> {viewTx.type}
              </p>

              {viewTx.type === "صرافی-مشتری" ? (
                <>
                  <p>
                    <b>مشتری:</b>{" "}
                    {customerName(
                      viewTx.customerId
                    )}
                  </p>

                  <p>
                    <b>دریافت:</b>{" "}
                    {formatNumber(
                      viewTx.receivedAmount
                    )}{" "}
                    {
                      currencyLabels[
                        viewTx.receivedCurrency
                      ]
                    }
                  </p>

                  <p>
                    <b>پرداخت:</b>{" "}
                    {formatNumber(
                      viewTx.paidAmount
                    )}{" "}
                    {
                      currencyLabels[
                        viewTx.paidCurrency
                      ]
                    }
                  </p>

                  <p>
                    <b>نرخ:</b>{" "}
                    {formatRateQuote(
                      viewTx.receivedCurrency,
                      viewTx.paidCurrency,
                      viewTx.rate
                    )}
                  </p>
                </>
              ) : (
                <>
                  <p>
                    <b>فرستنده:</b>{" "}
                    {customerName(
                      viewTx.senderId
                    )}{" "}
                    |{" "}
                    {formatNumber(
                      viewTx.senderAmount
                    )}{" "}
                    {
                      currencyLabels[
                        viewTx.senderCurrency
                      ]
                    }
                  </p>

                  <p>
                    <b>گیرنده:</b>{" "}
                    {customerName(
                      viewTx.receiverId
                    )}{" "}
                    |{" "}
                    {formatNumber(
                      viewTx.receiverAmount
                    )}{" "}
                    {
                      currencyLabels[
                        viewTx.receiverCurrency
                      ]
                    }
                  </p>

                  <p>
                    <b>نرخ:</b>{" "}
                    {formatRateQuote(
                      viewTx.senderCurrency,
                      viewTx.receiverCurrency,
                      viewTx.rate
                    )}
                  </p>

                  {viewTx.commission > 0 && (
                    <p>
                      <b>کارمزد:</b>{" "}
                      {formatNumber(
                        viewTx.commission
                      )}{" "}
                      {
                        currencyLabels[
                          viewTx.commissionCurrency
                        ]
                      }
                    </p>
                  )}
                </>
              )}

              <p>
                <b>مفاد:</b> {viewTx.terms}
              </p>

              <p>
                <b>یادداشت:</b>{" "}
                {viewTx.note || "-"}
              </p>

              <p>
                <b>وضعیت:</b>{" "}
                {viewTx.status === "voided"
                  ? "ابطال شده"
                  : "فعال"}
              </p>
            </div>

            <button
              onClick={() => setViewTx(null)}
              className="mt-6 px-5 py-2 bg-gray-200 rounded-xl"
            >
              بستن
            </button>
          </div>
        </div>
      )}

      {/* =========================
          ویرایش
      ========================= */}

      {editingTx && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl">
            <h2 className="text-xl font-bold mb-5">
              ویرایش معامله
            </h2>

            {editingTx.type === "صرافی-مشتری" ? (
              <div className="grid md:grid-cols-2 gap-4">
                <CustomerSelect
                  value={editingTx.customerId}
                  onChange={(v) =>
                    setEditingTx({
                      ...editingTx,
                      customerId: v,
                    })
                  }
                />

                <CurrencySelect
                  value={editingTx.receivedCurrency}
                  onChange={(v) =>
                    setEditingTx({
                      ...editingTx,
                      receivedCurrency: v,
                    })
                  }
                />

                <input
                  type="number"
                  value={editingTx.receivedAmount}
                  onChange={(e) =>
                    setEditingTx({
                      ...editingTx,
                      receivedAmount:
                        Number(e.target.value),
                    })
                  }
                  className="h-12 border rounded-xl px-3"
                />

                <CurrencySelect
                  value={editingTx.paidCurrency}
                  onChange={(v) =>
                    setEditingTx({
                      ...editingTx,
                      paidCurrency: v,
                    })
                  }
                />

                <input
                  type="number"
                  value={editingTx.paidAmount}
                  onChange={(e) =>
                    setEditingTx({
                      ...editingTx,
                      paidAmount:
                        Number(e.target.value),
                    })
                  }
                  className="h-12 border rounded-xl px-3"
                />

                <input
                  type="number"
                  step="any"
                  value={editingTx.rate}
                  onChange={(e) =>
                    setEditingTx({
                      ...editingTx,
                      rate: Number(e.target.value),
                    })
                  }
                  className="h-12 border rounded-xl px-3"
                  placeholder="نرخ تبدیل"
                />
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                <CustomerSelect
                  value={editingTx.senderId}
                  onChange={(v) =>
                    setEditingTx({
                      ...editingTx,
                      senderId: v,
                    })
                  }
                />

                <CustomerSelect
                  value={editingTx.receiverId}
                  onChange={(v) =>
                    setEditingTx({
                      ...editingTx,
                      receiverId: v,
                    })
                  }
                />

                <CurrencySelect
                  value={editingTx.senderCurrency}
                  onChange={(v) =>
                    setEditingTx({
                      ...editingTx,
                      senderCurrency: v,
                    })
                  }
                />

                <input
                  type="number"
                  value={editingTx.senderAmount}
                  onChange={(e) =>
                    setEditingTx({
                      ...editingTx,
                      senderAmount:
                        Number(e.target.value),
                    })
                  }
                  className="h-12 border rounded-xl px-3"
                />

                <CurrencySelect
                  value={editingTx.receiverCurrency}
                  onChange={(v) =>
                    setEditingTx({
                      ...editingTx,
                      receiverCurrency: v,
                    })
                  }
                />

                <input
                  type="number"
                  value={editingTx.receiverAmount}
                  onChange={(e) =>
                    setEditingTx({
                      ...editingTx,
                      receiverAmount:
                        Number(e.target.value),
                    })
                  }
                  className="h-12 border rounded-xl px-3"
                />

                <input
                  type="number"
                  step="any"
                  value={editingTx.rate}
                  onChange={(e) =>
                    setEditingTx({
                      ...editingTx,
                      rate: Number(e.target.value),
                    })
                  }
                  className="h-12 border rounded-xl px-3"
                  placeholder="نرخ تبدیل"
                />

                <input
                  type="number"
                  value={editingTx.commission}
                  onChange={(e) =>
                    setEditingTx({
                      ...editingTx,
                      commission:
                        Number(e.target.value),
                    })
                  }
                  className="h-12 border rounded-xl px-3"
                  placeholder="کارمزد"
                />
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingTx(null)}
                className="px-5 py-2 bg-gray-200 rounded-xl"
              >
                انصراف
              </button>

              <button
                onClick={() => {
                  if (!editingTx) return;

                  setTransactions((p) =>
                    p.map((tx) =>
                      tx.id === editingTx.id
                        ? editingTx
                        : tx
                    )
                  );

                  setEditingTx(null);
                }}
                className="px-5 py-2 bg-[#092F3A] text-white rounded-xl"
              >
                ذخیره تغییرات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
