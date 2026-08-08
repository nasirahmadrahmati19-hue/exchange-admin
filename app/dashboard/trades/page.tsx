```tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type ExchangeType = "صرافی-مشتری" | "بین-مشتریان";

interface BaseTransaction {
  id: string;
  type: ExchangeType;
  date: string;
  note: string;
  profit: number;
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
  rateBasis: number;
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
  rateBasis: number;
  commission: number;
  commissionCurrency: string;
}

type Transaction =
  | ExchangeTransaction
  | TransferTransaction;

interface Customer {
  id: string;
  name: string;
  balances: Record<string, number>;
}

const currencies = ["AFN", "USD", "IRR", "PKR"];

const currencyLabels: Record<string, string> = {
  AFN: "افغانی",
  USD: "دالر",
  IRR: "تومان",
  PKR: "کلدار",
};

const currencyOrder = ["AFN", "USD", "IRR", "PKR"];

/*
  مبنای پیش‌فرض ارزها
  AFN = 1
  USD = 1
  IRR = 1000 تومان
  PKR = 1
*/
const defaultRateBasis: Record<string, number> = {
  AFN: 1,
  USD: 1,
  IRR: 1000,
  PKR: 1,
};

function formatNumber(n: number) {
  if (!Number.isFinite(n)) return "0";
  return n % 1 === 0
    ? n.toLocaleString("en-US")
    : n.toLocaleString("en-US", {
        maximumFractionDigits: 8,
      });
}

function getCanonicalPair(
  a: string,
  b: string
): [string, string] {
  const ia = currencyOrder.indexOf(a);
  const ib = currencyOrder.indexOf(b);
  return ia <= ib ? [a, b] : [b, a];
}

/*
============================================================
موتور محاسبه ارز
============================================================

مثال دالر:

1 USD = 65 AFN

AFN -> USD
65000 / 65 × 1 = 1000 USD

USD -> AFN
1000 / 1 × 65 = 65000 AFN


مثال تومان:

1000 تومان = 0.38 AFN

AFN -> تومان
15200 / 0.38 × 1000 = 40,000,000 تومان

تومان -> AFN
40,000,000 / 1000 × 0.38 = 15,200 AFN
============================================================
*/

function convertAmount(
  amount: number,
  from: string,
  to: string,
  rate: number,
  rateBasis: number
) {
  if (
    !Number.isFinite(amount) ||
    !Number.isFinite(rate) ||
    !Number.isFinite(rateBasis) ||
    rate <= 0 ||
    rateBasis <= 0
  )
    return 0;

  if (from === to) return amount;

  const [c1, c2] = getCanonicalPair(from, to);

  if (from === c1 && to === c2) {
    return (amount / rate) * rateBasis;
  }

  if (from === c2 && to === c1) {
    return (amount / rateBasis) * rate;
  }

  return 0;
}

function formatRateQuote(
  a: string,
  b: string,
  rate: number,
  rateBasis: number
) {
  if (a === b)
    return `1 ${currencyLabels[a]} = 1 ${currencyLabels[b]}`;

  const [c1, c2] = getCanonicalPair(a, b);

  return `${formatNumber(rateBasis)} ${
    currencyLabels[c2]
  } = ${formatNumber(rate)} ${currencyLabels[c1]}`;
}

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

const generateId = () =>
  `EX-${Date.now()}-${Math.floor(
    Math.random() * 1000
  )}`;

function computeBalances(
  customers: Customer[],
  transactions: Transaction[]
) {
  const balances: Record<
    string,
    Record<string, number>
  > = {};

  customers.forEach(
    (c) => (balances[c.id] = { ...c.balances })
  );

  transactions.forEach((tx) => {
    if (tx.status === "voided") return;

    if (tx.type === "صرافی-مشتری") {
      const b = balances[tx.customerId];
      if (!b) return;

      b[tx.paidCurrency] =
        (b[tx.paidCurrency] || 0) -
        tx.paidAmount;

      b[tx.receivedCurrency] =
        (b[tx.receivedCurrency] || 0) +
        tx.receivedAmount;

      return;
    }

    const sender = balances[tx.senderId];
    const receiver = balances[tx.receiverId];

    if (sender) {
      sender[tx.senderCurrency] =
        (sender[tx.senderCurrency] || 0) -
        tx.senderAmount;

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

export default function CurrencyExchangePage() {
  const [customers] =
    useState<Customer[]>(initialCustomers);

  const [transactions, setTransactions] =
    useState<Transaction[]>([]);

  const [activeTab, setActiveTab] =
    useState<ExchangeType>("صرافی-مشتری");

  const balances = useMemo(
    () =>
      computeBalances(
        customers,
        transactions
      ),
    [customers, transactions]
  );

  // --------------------------------------------------
  // عمومی
  // --------------------------------------------------

  const [note, setNote] = useState("");
  const [profit, setProfit] = useState("0");

  // --------------------------------------------------
  // صرافی با مشتری
  // --------------------------------------------------

  const [exCustomer, setExCustomer] =
    useState("");

  const [exReceivedCurrency, setExReceivedCurrency] =
    useState("AFN");

  const [exReceivedAmount, setExReceivedAmount] =
    useState("");

  const [exPaidCurrency, setExPaidCurrency] =
    useState("USD");

  const [exPaidAmount, setExPaidAmount] =
    useState("");

  const [exRate, setExRate] =
    useState("");

  const [exRateBasis, setExRateBasis] =
    useState("1");

  // --------------------------------------------------
  // بین مشتریان
  // --------------------------------------------------

  const [sender, setSender] = useState("");
  const [senderCurrency, setSenderCurrency] =
    useState("AFN");
  const [senderAmount, setSenderAmount] =
    useState("");

  const [receiver, setReceiver] =
    useState("");
  const [receiverCurrency, setReceiverCurrency] =
    useState("AFN");
  const [receiverAmount, setReceiverAmount] =
    useState("");

  const [transferRate, setTransferRate] =
    useState("");

  const [transferRateBasis, setTransferRateBasis] =
    useState("1");

  const [commission, setCommission] =
    useState("0");

  const [commissionCurrency, setCommissionCurrency] =
    useState("AFN");

  // --------------------------------------------------
  // منوی عملیات
  // --------------------------------------------------

  const [viewTx, setViewTx] =
    useState<Transaction | null>(null);

  const [editingTx, setEditingTx] =
    useState<Transaction | null>(null);

  // --------------------------------------------------
  // تغییر خودکار مبنای نرخ
  // --------------------------------------------------

  useEffect(() => {
    setExRateBasis(
      String(
        defaultRateBasis[exPaidCurrency] || 1
      )
    );
  }, [exPaidCurrency]);

  useEffect(() => {
    setTransferRateBasis(
      String(
        defaultRateBasis[
          receiverCurrency
        ] || 1
      )
    );
  }, [receiverCurrency]);

  // --------------------------------------------------
  // محاسبه پرداختی
  // --------------------------------------------------

  useEffect(() => {
    const amount = Number(exReceivedAmount);
    const rate = Number(exRate);
    const basis = Number(exRateBasis);

    if (
      amount > 0 &&
      rate > 0 &&
      basis > 0
    ) {
      const result = convertAmount(
        amount,
        exReceivedCurrency,
        exPaidCurrency,
        rate,
        basis
      );

      setExPaidAmount(
        formatNumber(result)
      );
    } else {
      setExPaidAmount("");
    }
  }, [
    exReceivedAmount,
    exReceivedCurrency,
    exPaidCurrency,
    exRate,
    exRateBasis,
  ]);

  // --------------------------------------------------
  // محاسبه مبلغ گیرنده
  // --------------------------------------------------

  useEffect(() => {
    const amount = Number(senderAmount);
    const rate = Number(transferRate);
    const basis = Number(
      transferRateBasis
    );

    if (
      amount > 0 &&
      rate > 0 &&
      basis > 0
    ) {
      const result = convertAmount(
        amount,
        senderCurrency,
        receiverCurrency,
        rate,
        basis
      );

      setReceiverAmount(
        formatNumber(result)
      );
    } else {
      setReceiverAmount("");
    }
  }, [
    senderAmount,
    senderCurrency,
    receiverCurrency,
    transferRate,
    transferRateBasis,
  ]);

  // --------------------------------------------------
  // پاک کردن فرم
  // --------------------------------------------------

  const resetForm = () => {
    setNote("");
    setProfit("0");

    setExCustomer("");
    setExReceivedCurrency("AFN");
    setExReceivedAmount("");
    setExPaidCurrency("USD");
    setExPaidAmount("");
    setExRate("");
    setExRateBasis("1");

    setSender("");
    setSenderCurrency("AFN");
    setSenderAmount("");
    setReceiver("");
    setReceiverCurrency("AFN");
    setReceiverAmount("");
    setTransferRate("");
    setTransferRateBasis("1");
    setCommission("0");
    setCommissionCurrency("AFN");
  };

  // --------------------------------------------------
  // ثبت صرافی با مشتری
  // --------------------------------------------------

  const submitExchange = () => {
    const received = Number(
      exReceivedAmount
    );
    const paid = Number(exPaidAmount);
    const rate = Number(exRate);
    const basis = Number(exRateBasis);

    if (
      !exCustomer ||
      received <= 0 ||
      paid <= 0 ||
      rate <= 0 ||
      basis <= 0
    )
      return;

    const tx: ExchangeTransaction = {
      id: generateId(),
      type: "صرافی-مشتری",
      date: new Date().toISOString(),
      customerId: exCustomer,
      receivedCurrency:
        exReceivedCurrency,
      receivedAmount: received,
      paidCurrency: exPaidCurrency,
      paidAmount: paid,
      rate,
      rateBasis: basis,
      note,
      profit: Number(profit) || 0,
      status: "active",
    };

    setTransactions((p) => [tx, ...p]);
    resetForm();
  };

  // --------------------------------------------------
  // ثبت بین مشتریان
  // --------------------------------------------------

  const submitTransfer = () => {
    if (
      !sender ||
      !receiver ||
      sender === receiver
    ) {
      if (sender === receiver)
        alert(
          "فرستنده و گیرنده نمی‌توانند یکسان باشند"
        );
      return;
    }

    const amount = Number(senderAmount);
    const rate = Number(transferRate);
    const basis = Number(
      transferRateBasis
    );

    if (
      amount <= 0 ||
      rate <= 0 ||
      basis <= 0
    )
      return;

    const received = convertAmount(
      amount,
      senderCurrency,
      receiverCurrency,
      rate,
      basis
    );

    const tx: TransferTransaction = {
      id: generateId(),
      type: "بین-مشتریان",
      date: new Date().toISOString(),
      senderId: sender,
      receiverId: receiver,
      senderCurrency,
      senderAmount: amount,
      receiverCurrency,
      receiverAmount: received,
      rate,
      rateBasis: basis,
      commission: Number(commission) || 0,
      commissionCurrency,
      note,
      profit: Number(profit) || 0,
      status: "active",
    };

    setTransactions((p) => [tx, ...p]);
    resetForm();
  };

  // --------------------------------------------------
  // ابطال
  // --------------------------------------------------

  const voidTransaction = (id: string) => {
    if (
      !confirm(
        "آیا از ابطال این معامله مطمئن هستید؟"
      )
    )
      return;

    setTransactions((p) =>
      p.map((tx) =>
        tx.id === id
          ? {
              ...tx,
              status: "voided",
            }
          : tx
      )
    );
  };

  const customerName = (id: string) =>
    customers.find(
      (c) => c.id === id
    )?.name || id;

  // --------------------------------------------------
  // چاپ
  // --------------------------------------------------

  const printReceipt = (tx: Transaction) => {
    const w = window.open("", "_blank");
    if (!w) return;

    let html = `
      <html dir="rtl">
      <head>
        <title>رسید معامله</title>
        <style>
          body {
            font-family: Tahoma;
            padding: 30px;
            direction: rtl;
          }
          p {
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
      <h2>رسید معامله</h2>
      <p><b>شماره:</b> ${tx.id}</p>
      <p><b>تاریخ:</b>
      ${new Date(tx.date).toLocaleString("fa-IR")}
      </p>
      <p><b>نوع:</b> ${tx.type}</p>
    `;

    if (tx.type === "صرافی-مشتری") {
      html += `
        <p><b>مشتری:</b>
        ${customerName(tx.customerId)}</p>

        <p><b>دریافت:</b>
        ${formatNumber(tx.receivedAmount)}
        ${currencyLabels[tx.receivedCurrency]}</p>

        <p><b>پرداخت:</b>
        ${formatNumber(tx.paidAmount)}
        ${currencyLabels[tx.paidCurrency]}</p>

        <p><b>مبنای نرخ:</b>
        ${formatNumber(tx.rateBasis)}</p>

        <p><b>نرخ تبدیل:</b>
        ${formatRateQuote(
          tx.receivedCurrency,
          tx.paidCurrency,
          tx.rate,
          tx.rateBasis
        )}</p>
      `;
    } else {
      html += `
        <p><b>فرستنده:</b>
        ${customerName(tx.senderId)}
        -
        ${formatNumber(tx.senderAmount)}
        ${currencyLabels[tx.senderCurrency]}</p>

        <p><b>گیرنده:</b>
        ${customerName(tx.receiverId)}
        -
        ${formatNumber(tx.receiverAmount)}
        ${currencyLabels[tx.receiverCurrency]}</p>

        <p><b>مبنای نرخ:</b>
        ${formatNumber(tx.rateBasis)}</p>

        <p><b>نرخ تبدیل:</b>
        ${formatRateQuote(
          tx.senderCurrency,
          tx.receiverCurrency,
          tx.rate,
          tx.rateBasis
        )}</p>

        <p><b>کارمزد:</b>
        ${formatNumber(tx.commission)}
        ${currencyLabels[tx.commissionCurrency]}</p>
      `;
    }

    html += `
      <p><b>مفاد معامله:</b>
      ${formatNumber(tx.profit)}</p>

      <p><b>یادداشت:</b>
      ${tx.note || "-"}</p>

      <p><b>وضعیت:</b>
      ${
        tx.status === "voided"
          ? "ابطال شده"
          : "فعال"
      }</p>

      </body></html>
    `;

    w.document.write(html);
    w.document.close();
    w.print();
  };

  return (
    <div
      dir="rtl"
      className="space-y-6 p-4"
    >
      <h1 className="text-2xl font-bold">
        معاملات ارزی
      </h1>

      {/* ==================================================
          TABS
      ================================================== */}

      <div className="flex gap-2 border-b pb-2">
        <button
          onClick={() =>
            setActiveTab("صرافی-مشتری")
          }
          className={`px-4 py-2 rounded-lg ${
            activeTab === "صرافی-مشتری"
              ? "bg-blue-600 text-white"
              : "bg-gray-100"
          }`}
        >
          تبادل ارز
        </button>

        <button
          onClick={() =>
            setActiveTab("بین-مشتریان")
          }
          className={`px-4 py-2 rounded-lg ${
            activeTab === "بین-مشتریان"
              ? "bg-purple-600 text-white"
              : "bg-gray-100"
          }`}
        >
          تبادل بین حساب مشتریان
        </button>
      </div>

      {/* ==================================================
          EXCHANGE
      ================================================== */}

      {activeTab === "صرافی-مشتری" ? (
        <div className="bg-white rounded-2xl border p-6 space-y-5">

          <h2 className="text-lg font-bold">
            تبادل ارز
          </h2>

          <div className="grid md:grid-cols-2 gap-5">

            <div className="bg-gray-50 p-5 rounded-xl space-y-4">

              <select
                value={exCustomer}
                onChange={(e) =>
                  setExCustomer(e.target.value)
                }
                className="w-full h-12 border rounded-xl px-3"
              >
                <option value="">
                  انتخاب مشتری
                </option>

                {customers.map((c, i) => (
                  <option
                    key={c.id}
                    value={c.id}
                  >
                    {i + 1}. {c.name}
                  </option>
                ))}
              </select>

              <select
                value={exReceivedCurrency}
                onChange={(e) =>
                  setExReceivedCurrency(
                    e.target.value
                  )
                }
                className="w-full h-12 border rounded-xl px-3"
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    ارز دریافتی:{" "}
                    {currencyLabels[c]}
                  </option>
                ))}
              </select>

              <input
                type="number"
                placeholder="مبلغ دریافتی"
                value={exReceivedAmount}
                onChange={(e) =>
                  setExReceivedAmount(
                    e.target.value
                  )
                }
                className="w-full h-12 border rounded-xl px-3"
              />

            </div>

            <div className="bg-gray-50 p-5 rounded-xl space-y-4">

              <select
                value={exPaidCurrency}
                onChange={(e) =>
                  setExPaidCurrency(
                    e.target.value
                  )
                }
                className="w-full h-12 border rounded-xl px-3"
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    ارز پرداختی:{" "}
                    {currencyLabels[c]}
                  </option>
                ))}
              </select>

              <input
                type="number"
                placeholder="مبنای نرخ"
                value={exRateBasis}
                onChange={(e) =>
                  setExRateBasis(
                    e.target.value
                  )
                }
                className="w-full h-12 border rounded-xl px-3"
              />

              <input
                type="number"
                step="any"
                placeholder="نرخ تبدیل"
                value={exRate}
                onChange={(e) =>
                  setExRate(e.target.value)
                }
                className="w-full h-12 border rounded-xl px-3"
              />

              <input
                type="text"
                readOnly
                value={exPaidAmount}
                placeholder="مبلغ پرداختی محاسبه شده"
                className="w-full h-12 border rounded-xl px-3 bg-gray-100"
              />

            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5">

            <input
              type="number"
              placeholder="مفاد معامله (سود صراف)"
              value={profit}
              onChange={(e) =>
                setProfit(e.target.value)
              }
              className="w-full h-12 border rounded-xl px-3"
            />

            <input
              placeholder="یادداشت"
              value={note}
              onChange={(e) =>
                setNote(e.target.value)
              }
              className="w-full h-12 border rounded-xl px-3"
            />

          </div>

          <button
            onClick={submitExchange}
            className="w-full h-12 bg-[#092F3A] text-white rounded-xl"
          >
            ثبت معامله
          </button>
        </div>
      ) : (

        /* ==================================================
           TRANSFER
        ================================================== */

        <div className="bg-white rounded-2xl border p-6 space-y-5">

          <h2 className="text-lg font-bold">
            تبادل بین حساب مشتریان
          </h2>

          <div className="grid md:grid-cols-2 gap-5">

            <div className="bg-blue-50 p-5 rounded-xl space-y-4">

              <select
                value={sender}
                onChange={(e) =>
                  setSender(e.target.value)
                }
                className="w-full h-12 border rounded-xl px-3"
              >
                <option value="">
                  مشتری فرستنده
                </option>

                {customers.map((c, i) => (
                  <option
                    key={c.id}
                    value={c.id}
                  >
                    {i + 1}. {c.name}
                  </option>
                ))}
              </select>

              <select
                value={senderCurrency}
                onChange={(e) =>
                  setSenderCurrency(
                    e.target.value
                  )
                }
                className="w-full h-12 border rounded-xl px-3"
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {currencyLabels[c]}
                  </option>
                ))}
              </select>

              <input
                type="number"
                placeholder="مبلغ فرستنده"
                value={senderAmount}
                onChange={(e) =>
                  setSenderAmount(
                    e.target.value
                  )
                }
                className="w-full h-12 border rounded-xl px-3"
              />

            </div>

            <div className="bg-green-50 p-5 rounded-xl space-y-4">

              <select
                value={receiver}
                onChange={(e) =>
                  setReceiver(e.target.value)
                }
                className="w-full h-12 border rounded-xl px-3"
              >
                <option value="">
                  مشتری گیرنده
                </option>

                {customers.map((c, i) => (
                  <option
                    key={c.id}
                    value={c.id}
                  >
                    {i + 1}. {c.name}
                  </option>
                ))}
              </select>

              <select
                value={receiverCurrency}
                onChange={(e) =>
                  setReceiverCurrency(
                    e.target.value
                  )
                }
                className="w-full h-12 border rounded-xl px-3"
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {currencyLabels[c]}
                  </option>
                ))}
              </select>

              <input
                readOnly
                value={receiverAmount}
                placeholder="مبلغ گیرنده محاسبه شده"
                className="w-full h-12 border rounded-xl px-3 bg-gray-100"
              />

            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">

            <input
              type="number"
              placeholder="مبنای نرخ"
              value={transferRateBasis}
              onChange={(e) =>
                setTransferRateBasis(
                  e.target.value
                )
              }
              className="h-12 border rounded-xl px-3"
            />

            <input
              type="number"
              step="any"
              placeholder="نرخ تبدیل"
              value={transferRate}
              onChange={(e) =>
                setTransferRate(
                  e.target.value
                )
              }
              className="h-12 border rounded-xl px-3"
            />

            <input
              type="number"
              placeholder="مفاد معامله (سود صراف)"
              value={profit}
              onChange={(e) =>
                setProfit(e.target.value)
              }
              className="h-12 border rounded-xl px-3"
            />

          </div>

          <div className="grid md:grid-cols-3 gap-4">

            <input
              type="number"
              placeholder="کارمزد"
              value={commission}
              onChange={(e) =>
                setCommission(e.target.value)
              }
              className="h-12 border rounded-xl px-3"
            />

            <select
              value={commissionCurrency}
              onChange={(e) =>
                setCommissionCurrency(
                  e.target.value
                )
              }
              className="h-12 border rounded-xl px-3"
            >
              {currencies.map((c) => (
                <option key={c} value={c}>
                  ارز کارمزد:{" "}
                  {currencyLabels[c]}
                </option>
              ))}
            </select>

            <input
              placeholder="یادداشت"
              value={note}
              onChange={(e) =>
                setNote(e.target.value)
              }
              className="h-12 border rounded-xl px-3"
            />

          </div>

          <button
            onClick={submitTransfer}
            className="w-full h-12 bg-[#092F3A] text-white rounded-xl"
          >
            ثبت معامله
          </button>
        </div>
      )}

      {/* ==================================================
          BALANCES
      ================================================== */}

      <div className="bg-white rounded-xl border p-5 overflow-x-auto">

        <h2 className="font-bold mb-4">
          موجودی فعلی مشتریان
        </h2>

        <table className="min-w-full text-sm">

          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-right">
                مشتری
              </th>

              {currencies.map((c) => (
                <th
                  key={c}
                  className="p-3 text-right"
                >
                  {currencyLabels[c]}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {customers.map((c) => {
              const b =
                balances[c.id] ||
                c.balances;

              return (
                <tr
                  key={c.id}
                  className="border-t"
                >
                  <td className="p-3 font-bold">
                    {c.name}
                  </td>

                  {currencies.map((cur) => (
                    <td
                      key={cur}
                      className="p-3"
                    >
                      {formatNumber(
                        b[cur] || 0
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>

        </table>
      </div>

      {/* ==================================================
          TRANSACTIONS
      ================================================== */}

      <div className="bg-white rounded-xl border overflow-x-auto">

        <h2 className="font-bold p-5">
          آخرین معاملات
        </h2>

        <table className="min-w-full text-sm">

          <thead className="bg-gray-50">
            <tr>

              <th className="p-3 text-right">
                شماره
              </th>

              <th className="p-3 text-right">
                تاریخ
              </th>

              <th className="p-3 text-right">
                نوع معامله
              </th>

              <th className="p-3 text-right">
                مشتری/فرستنده
              </th>

              <th className="p-3 text-right">
                دریافت
              </th>

              <th className="p-3 text-right">
                پرداخت
              </th>

              <th className="p-3 text-right">
                مبنای نرخ
              </th>

              <th className="p-3 text-right">
                نرخ تبدیل
              </th>

              <th className="p-3 text-right">
                مفاد
              </th>

              <th className="p-3 text-right">
                عملیات
              </th>

            </tr>
          </thead>

          <tbody>

            {transactions.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="text-center p-8 text-gray-400"
                >
                  هیچ معامله‌ای ثبت نشده است
                </td>
              </tr>
            )}

            {transactions.map((tx) => {

              const voided =
                tx.status === "voided";

              return (
                <tr
                  key={tx.id}
                  className={`border-t ${
                    voided
                      ? "opacity-50"
                      : ""
                  }`}
                >

                  {/* شماره */}
                  <td className="p-3 font-mono">
                    {tx.id}
                  </td>

                  {/* تاریخ */}
                  <td className="p-3 text-xs">
                    {new Date(
                      tx.date
                    ).toLocaleString(
                      "fa-IR"
                    )}
                  </td>

                  {/* نوع */}
                  <td className="p-3">
                    {tx.type}
                  </td>

                  {/* مشتری */}
                  <td className="p-3">
                    {tx.type ===
                    "صرافی-مشتری"
                      ? customerName(
                          tx.customerId
                        )
                      : customerName(
                          tx.senderId
                        )}
                  </td>

                  {/* دریافت */}
                  <td className="p-3">
                    {tx.type ===
                    "صرافی-مشتری"
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
                        }`}
                  </td>

                  {/* پرداخت */}
                  <td className="p-3">
                    {tx.type ===
                    "صرافی-مشتری"
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
                        }`}
                  </td>

                  {/* مبنای نرخ */}
                  <td className="p-3">
                    {formatNumber(
                      tx.rateBasis
                    )}
                  </td>

                  {/* نرخ تبدیل */}
                  <td className="p-3 text-xs">

                    {tx.type ===
                    "صرافی-مشتری"
                      ? formatRateQuote(
                          tx.receivedCurrency,
                          tx.paidCurrency,
                          tx.rate,
                          tx.rateBasis
                        )
                      : formatRateQuote(
                          tx.senderCurrency,
                          tx.receiverCurrency,
                          tx.rate,
                          tx.rateBasis
                        )}

                  </td>

                  {/* مفاد */}
                  <td className="p-3">
                    {formatNumber(
                      tx.profit
                    )}
                  </td>

                  {/* عملیات */}
                  <td className="p-3">

                    <select
                      defaultValue=""
                      disabled={voided}
                      onChange={(e) => {

                        const action =
                          e.target.value;

                        e.target.value = "";

                        if (
                          action ===
                          "view"
                        )
                          setViewTx(tx);

                        if (
                          action ===
                          "edit"
                        )
                          setEditingTx(tx);

                        if (
                          action ===
                          "print"
                        )
                          printReceipt(tx);

                        if (
                          action ===
                          "void"
                        )
                          voidTransaction(
                            tx.id
                          );
                      }}
                      className="border rounded-lg px-3 py-2 bg-white"
                    >

                      <option value="">
                        عملیات
                      </option>

                      <option value="view">
                        مشاهده
                      </option>

                      <option value="edit">
                        ویرایش
                      </option>

                      <option value="print">
                        چاپ
                      </option>

                      <option value="void">
                        ابطال
                      </option>

                    </select>

                  </td>

                </tr>
              );
            })}

          </tbody>

        </table>
      </div>

      {/* ==================================================
          VIEW
      ================================================== */}

      {viewTx && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() =>
            setViewTx(null)
          }
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <h2 className="text-lg font-bold">
              مشاهده معامله
            </h2>

            <p>
              <b>شماره:</b>{" "}
              {viewTx.id}
            </p>

            <p>
              <b>تاریخ:</b>{" "}
              {new Date(
                viewTx.date
              ).toLocaleString("fa-IR")}
            </p>

            <p>
              <b>نوع:</b>{" "}
              {viewTx.type}
            </p>

            {viewTx.type ===
              "صرافی-مشتری" ? (
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
              </>
            ) : (
              <>
                <p>
                  <b>فرستنده:</b>{" "}
                  {customerName(
                    viewTx.senderId
                  )}
                </p>

                <p>
                  <b>گیرنده:</b>{" "}
                  {customerName(
                    viewTx.receiverId
                  )}
                </p>

                <p>
                  <b>مبلغ فرستنده:</b>{" "}
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
                  <b>مبلغ گیرنده:</b>{" "}
                  {formatNumber(
                    viewTx.receiverAmount
                  )}{" "}
                  {
                    currencyLabels[
                      viewTx.receiverCurrency
                    ]
                  }
                </p>
              </>
            )}

            <p>
              <b>مبنای نرخ:</b>{" "}
              {formatNumber(
                viewTx.rateBasis
              )}
            </p>

            <p>
              <b>نرخ تبدیل:</b>{" "}
              {viewTx.type ===
              "صرافی-مشتری"
                ? formatRateQuote(
                    viewTx.receivedCurrency,
                    viewTx.paidCurrency,
                    viewTx.rate,
                    viewTx.rateBasis
                  )
                : formatRateQuote(
                    viewTx.senderCurrency,
                    viewTx.receiverCurrency,
                    viewTx.rate,
                    viewTx.rateBasis
                  )}
            </p>

            <p>
              <b>مفاد معامله:</b>{" "}
              {formatNumber(
                viewTx.profit
              )}
            </p>

            <p>
              <b>وضعیت:</b>{" "}
              {viewTx.status ===
              "voided"
                ? "ابطال شده"
                : "فعال"}
            </p>

            <button
              onClick={() =>
                setViewTx(null)
              }
              className="w-full bg-gray-200 py-2 rounded-lg"
            >
              بستن
            </button>

          </div>
        </div>
      )}

      {/* ==================================================
          EDIT
      ================================================== */}

      {editingTx && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">

          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4">

            <h2 className="text-lg font-bold">
              ویرایش معامله
            </h2>

            {editingTx.type ===
            "صرافی-مشتری" ? (
              <>
                <select
                  value={
                    editingTx.customerId
                  }
                  onChange={(e) =>
                    setEditingTx({
                      ...editingTx,
                      customerId:
                        e.target.value,
                    })
                  }
                  className="w-full border rounded-lg p-3"
                >
                  {customers.map((c) => (
                    <option
                      key={c.id}
                      value={c.id}
                    >
                      {c.name}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  value={
                    editingTx.receivedAmount
                  }
                  onChange={(e) =>
                    setEditingTx({
                      ...editingTx,
                      receivedAmount:
                        Number(
                          e.target.value
                        ),
                    })
                  }
                  className="w-full border rounded-lg p-3"
                  placeholder="مبلغ دریافتی"
                />

                <input
                  type="number"
                  value={
                    editingTx.paidAmount
                  }
                  onChange={(e) =>
                    setEditingTx({
                      ...editingTx,
                      paidAmount:
                        Number(
                          e.target.value
                        ),
                    })
                  }
                  className="w-full border rounded-lg p-3"
                  placeholder="مبلغ پرداختی"
                />

                <input
                  type="number"
                  value={
                    editingTx.rateBasis
                  }
                  onChange={(e) =>
                    setEditingTx({
                      ...editingTx,
                      rateBasis:
                        Number(
                          e.target.value
                        ),
                    })
                  }
                  className="w-full border rounded-lg p-3"
                  placeholder="مبنای نرخ"
                />

                <input
                  type="number"
                  step="any"
                  value={
                    editingTx.rate
                  }
                  onChange={(e) =>
                    setEditingTx({
                      ...editingTx,
                      rate:
                        Number(
                          e.target.value
                        ),
                    })
                  }
                  className="w-full border rounded-lg p-3"
                  placeholder="نرخ تبدیل"
                />
              </>
            ) : (
              <>
                <select
                  value={
                    editingTx.senderId
                  }
                  onChange={(e) =>
                    setEditingTx({
                      ...editingTx,
                      senderId:
                        e.target.value,
                    })
                  }
                  className="w-full border rounded-lg p-3"
                >
                  {customers.map((c) => (
                    <option
                      key={c.id}
                      value={c.id}
                    >
                      {c.name}
                    </option>
                  ))}
                </select>

                <select
                  value={
                    editingTx.receiverId
                  }
                  onChange={(e) =>
                    setEditingTx({
                      ...editingTx,
                      receiverId:
                        e.target.value,
                    })
                  }
                  className="w-full border rounded-lg p-3"
                >
                  {customers.map((c) => (
                    <option
                      key={c.id}
                      value={c.id}
                    >
                      {c.name}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  value={
                    editingTx.senderAmount
                  }
                  onChange={(e) =>
                    setEditingTx({
                      ...editingTx,
                      senderAmount:
                        Number(
                          e.target.value
                        ),
                    })
                  }
                  className="w-full border rounded-lg p-3"
                  placeholder="مبلغ فرستنده"
                />

                <input
                  type="number"
                  value={
                    editingTx.rateBasis
                  }
                  onChange={(e) =>
                    setEditingTx({
                      ...editingTx,
                      rateBasis:
                        Number(
                          e.target.value
                        ),
                    })
                  }
                  className="w-full border rounded-lg p-3"
                  placeholder="مبنای نرخ"
                />

                <input
                  type="number"
                  step="any"
                  value={
                    editingTx.rate
                  }
                  onChange={(e) =>
                    setEditingTx({
                      ...editingTx,
                      rate:
                        Number(
                          e.target.value
                        ),
                    })
                  }
                  className="w-full border rounded-lg p-3"
                  placeholder="نرخ تبدیل"
                />

                <input
                  type="number"
                  value={
                    editingTx.commission
                  }
                  onChange={(e) =>
                    setEditingTx({
                      ...editingTx,
                      commission:
                        Number(
                          e.target.value
                        ),
                    })
                  }
                  className="w-full border rounded-lg p-3"
                  placeholder="کارمزد"
                />
              </>
            )}

            <input
              type="number"
              value={editingTx.profit}
              onChange={(e) =>
                setEditingTx({
                  ...editingTx,
                  profit:
                    Number(e.target.value),
                })
              }
              className="w-full border rounded-lg p-3"
              placeholder="مفاد معامله"
            />

            <input
              value={editingTx.note}
              onChange={(e) =>
                setEditingTx({
                  ...editingTx,
                  note: e.target.value,
                })
              }
              className="w-full border rounded-lg p-3"
              placeholder="یادداشت"
            />

            <div className="flex gap-2">

              <button
                onClick={() =>
                  setEditingTx(null)
                }
                className="flex-1 bg-gray-200 py-3 rounded-lg"
              >
                انصراف
              </button>

              <button
                onClick={() => {
                  setTransactions(
                    (p) =>
                      p.map((tx) =>
                        tx.id ===
                        editingTx.id
                          ? editingTx
                          : tx
                      )
                  );

                  setEditingTx(null);
                }}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg"
              >
                ذخیره
              </button>

            </div>

          </div>
        </div>
      )}
    </div>
  );
}
```
