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

// ============================================================
// واحد پایه داخلی ارزها
// ============================================================
// AFN = 1 افغانی
// USD = 1 دالر
// IRR = 1000 تومان
// PKR = 1 کلدار
//
// واحد 1000 برای تومان فقط در موتور محاسبه داخلی استفاده می‌شود.
// ============================================================

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

// ============================================================
// ترتیب ثابت ارزها برای تعیین جفت ارز
// ============================================================

const currencyOrder = ["AFN", "USD", "IRR", "PKR"];

// ============================================================
// قالب‌بندی عدد
// ============================================================

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";

  if (n % 1 === 0) {
    return n.toLocaleString("en-US");
  }

  return n.toLocaleString("en-US", {
    maximumFractionDigits: 8,
  });
}

// ============================================================
// تعیین جفت ارز استاندارد
// ============================================================

function getCanonicalPair(
  currencyA: string,
  currencyB: string
): [string, string] {
  const indexA = currencyOrder.indexOf(currencyA);
  const indexB = currencyOrder.indexOf(currencyB);

  if (indexA <= indexB) {
    return [currencyA, currencyB];
  }

  return [currencyB, currencyA];
}

// ============================================================
// موتور اصلی تبدیل ارز
// ============================================================
//
// منطق اصلی بدون تغییر:
//
// مثال دالر:
//
// 1 USD = 65 AFN
//
// AFN -> USD
// 65000 / 65 = 1000 USD
//
// USD -> AFN
// 1000 * 65 = 65000 AFN
//
// مثال تومان:
//
// 1000 تومان = 0.38 AFN
//
// AFN -> تومان
// 15200 / 0.38 * 1000 = 40,000,000 تومان
//
// تومان -> AFN
// 40,000,000 / 1000 * 0.38 = 15,200 AFN
// ============================================================

function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rate: number
): number {
  if (!Number.isFinite(amount)) return 0;
  if (!Number.isFinite(rate) || rate <= 0) return 0;

  if (fromCurrency === toCurrency) {
    return amount;
  }

  const [currency1, currency2] = getCanonicalPair(
    fromCurrency,
    toCurrency
  );

  const base2 = baseUnits[currency2] || 1;

  // currency1 -> currency2
  if (
    fromCurrency === currency1 &&
    toCurrency === currency2
  ) {
    return (amount / rate) * base2;
  }

  // currency2 -> currency1
  if (
    fromCurrency === currency2 &&
    toCurrency === currency1
  ) {
    return (amount / base2) * rate;
  }

  return 0;
}

// ============================================================
// نمایش نرخ
// ============================================================

function formatRateQuote(
  currencyA: string,
  currencyB: string,
  rate: number
): string {
  if (currencyA === currencyB) {
    return `1 ${currencyLabels[currencyA]} = 1 ${currencyLabels[currencyB]}`;
  }

  const [currency1, currency2] = getCanonicalPair(
    currencyA,
    currencyB
  );

  const base2 = baseUnits[currency2] || 1;

  return `${base2.toLocaleString()} ${
    currencyLabels[currency2]
  } = ${formatNumber(rate)} ${
    currencyLabels[currency1]
  }`;
}

// ============================================================
// Initial Data
// ============================================================

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

// ============================================================
// ساخت شماره سند داخلی
// ============================================================

const generateDocId = () => {
  const now = new Date();

  return `EX-${now.getFullYear()}${(now.getMonth() + 1)
    .toString()
    .padStart(2, "0")}${now
    .getDate()
    .toString()
    .padStart(2, "0")}-${Math.floor(
    Math.random() * 10000
  )
    .toString()
    .padStart(4, "0")}`;
};

// ============================================================
// محاسبه موجودی مشتریان
// ============================================================

function computeBalances(
  customers: Customer[],
  transactions: Transaction[]
) {
  const balances: Record<
    string,
    Record<string, number>
  > = {};

  customers.forEach((customer) => {
    balances[customer.id] = {
      ...customer.balances,
    };
  });

  transactions.forEach((tx) => {
    if (tx.status === "voided") return;

    // ----------------------------------------------------------
    // صرافی با مشتری
    // ----------------------------------------------------------

    if (tx.type === "صرافی-مشتری") {
      const customerBalance =
        balances[tx.customerId];

      if (!customerBalance) return;

      // مشتری ارز پرداختی را می‌دهد
      customerBalance[tx.paidCurrency] =
        (customerBalance[tx.paidCurrency] || 0) -
        tx.paidAmount;

      // مشتری ارز دریافتی را دریافت می‌کند
      customerBalance[tx.receivedCurrency] =
        (customerBalance[tx.receivedCurrency] || 0) +
        tx.receivedAmount;

      return;
    }

    // ----------------------------------------------------------
    // انتقال بین مشتریان
    // ----------------------------------------------------------

    if (tx.type === "بین-مشتریان") {
      const senderBalance =
        balances[tx.senderId];

      const receiverBalance =
        balances[tx.receiverId];

      // کسر مبلغ اصلی از فرستنده
      if (senderBalance) {
        senderBalance[tx.senderCurrency] =
          (senderBalance[tx.senderCurrency] || 0) -
          tx.senderAmount;

        // کسر جداگانه کارمزد از حساب فرستنده
        if (
          tx.commission > 0 &&
          tx.commissionCurrency
        ) {
          senderBalance[
            tx.commissionCurrency
          ] =
            (senderBalance[
              tx.commissionCurrency
            ] || 0) - tx.commission;
        }
      }

      // اضافه کردن مبلغ به حساب گیرنده
      if (receiverBalance) {
        receiverBalance[tx.receiverCurrency] =
          (receiverBalance[
            tx.receiverCurrency
          ] || 0) + tx.receiverAmount;
      }
    }
  });

  return balances;
}

// ============================================================
// Component
// ============================================================

export default function CurrencyExchangePage() {
  const [customers] =
    useState<Customer[]>(initialCustomers);

  const [transactions, setTransactions] =
    useState<Transaction[]>([]);

  const [activeTab, setActiveTab] =
    useState<
      "صرافی-مشتری" | "بین-مشتریان"
    >("صرافی-مشتری");

  const liveBalances = useMemo(
    () =>
      computeBalances(
        customers,
        transactions
      ),
    [customers, transactions]
  );

  // ==========================================================
  // Form States
  // ==========================================================

  const [docId, setDocId] =
    useState(generateDocId());

  const [note, setNote] = useState("");

  const [terms, setTerms] =
    useState("نقدی");

  // ==========================================================
  // Exchange form
  // ==========================================================

  const [exCustomer, setExCustomer] =
    useState("");

  const [
    exReceivedCurrency,
    setExReceivedCurrency,
  ] = useState("AFN");

  const [
    exReceivedAmount,
    setExReceivedAmount,
  ] = useState("");

  const [
    exPaidCurrency,
    setExPaidCurrency,
  ] = useState("USD");

  const [
    exPaidAmount,
    setExPaidAmount,
  ] = useState("");

  const [exRate, setExRate] =
    useState("");

  // ==========================================================
  // Transfer form
  // ==========================================================

  const [trSender, setTrSender] =
    useState("");

  const [
    trSenderCurrency,
    setTrSenderCurrency,
  ] = useState("AFN");

  const [
    trSenderAmount,
    setTrSenderAmount,
  ] = useState("");

  const [trReceiver, setTrReceiver] =
    useState("");

  const [
    trReceiverCurrency,
    setTrReceiverCurrency,
  ] = useState("AFN");

  const [
    trReceiverAmount,
    setTrReceiverAmount,
  ] = useState("");

  const [trRate, setTrRate] =
    useState("");

  const [
    trCommission,
    setTrCommission,
  ] = useState("0");

  const [
    trCommissionCurrency,
    setTrCommissionCurrency,
  ] = useState("AFN");

  // ==========================================================
  // Edit / View
  // ==========================================================

  const [editMode, setEditMode] =
    useState(false);

  const [editingTx, setEditingTx] =
    useState<Transaction | null>(null);

  const [viewTx, setViewTx] =
    useState<Transaction | null>(null);

  // ==========================================================
  // منوی عملیات
  // ==========================================================

  const [openOperationId, setOpenOperationId] =
    useState<string | null>(null);

  // ==========================================================
  // محاسبه تبادل صرافی با مشتری
  // ==========================================================

  const computeExchangePaid = () => {
    if (!exRate || !exReceivedAmount) {
      setExPaidAmount("");
      return;
    }

    const received =
      parseFloat(exReceivedAmount);

    const rate = parseFloat(exRate);

    if (
      !Number.isFinite(received) ||
      !Number.isFinite(rate) ||
      rate <= 0
    ) {
      setExPaidAmount("");
      return;
    }

    const paid = convertAmount(
      received,
      exReceivedCurrency,
      exPaidCurrency,
      rate
    );

    setExPaidAmount(
      formatNumber(paid)
    );
  };

  useEffect(() => {
    computeExchangePaid();
  }, [
    exReceivedAmount,
    exRate,
    exReceivedCurrency,
    exPaidCurrency,
  ]);

  // ==========================================================
  // محاسبه تبادل بین مشتریان
  // ==========================================================

  const computeTransferReceiver = () => {
    if (!trRate || !trSenderAmount) {
      setTrReceiverAmount("");
      return;
    }

    const senderAmount =
      parseFloat(trSenderAmount);

    const rate = parseFloat(trRate);

    if (
      !Number.isFinite(senderAmount) ||
      !Number.isFinite(rate) ||
      rate <= 0
    ) {
      setTrReceiverAmount("");
      return;
    }

    const receiverAmount =
      convertAmount(
        senderAmount,
        trSenderCurrency,
        trReceiverCurrency,
        rate
      );

    setTrReceiverAmount(
      formatNumber(receiverAmount)
    );
  };

  useEffect(() => {
    computeTransferReceiver();
  }, [
    trSenderAmount,
    trRate,
    trSenderCurrency,
    trReceiverCurrency,
  ]);

  // ==========================================================
  // Reset
  // ==========================================================

  const resetForm = () => {
    setDocId(generateDocId());

    setNote("");
    setTerms("نقدی");

    // صرافی با مشتری
    setExCustomer("");
    setExReceivedCurrency("AFN");
    setExReceivedAmount("");
    setExPaidCurrency("USD");
    setExPaidAmount("");
    setExRate("");

    // بین مشتریان
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

  // ==========================================================
  // ثبت معامله صرافی با مشتری
  // ==========================================================

  const submitExchange = () => {
    if (
      !exCustomer ||
      !exReceivedAmount ||
      !exPaidAmount ||
      !exRate
    ) {
      return;
    }

    const receivedAmount =
      parseFloat(exReceivedAmount);

    const paidAmount =
      parseFloat(exPaidAmount);

    const rate = parseFloat(exRate);

    if (
      !Number.isFinite(receivedAmount) ||
      !Number.isFinite(paidAmount) ||
      !Number.isFinite(rate) ||
      rate <= 0
    ) {
      return;
    }

    const tx: ExchangeTransaction = {
      id: docId,
      type: "صرافی-مشتری",
      date: new Date().toISOString(),

      customerId: exCustomer,

      receivedCurrency:
        exReceivedCurrency,

      receivedAmount,

      paidCurrency: exPaidCurrency,

      paidAmount,

      rate,

      terms,
      note,

      status: "active",
    };

    setTransactions((prev) => [
      tx,
      ...prev,
    ]);

    resetForm();
  };

  // ==========================================================
  // ثبت تبادل بین مشتریان
  // ==========================================================

  const submitTransfer = () => {
    if (
      !trSender ||
      !trReceiver ||
      !trSenderAmount ||
      !trRate
    ) {
      return;
    }

    if (trSender === trReceiver) {
      alert(
        "فرستنده و گیرنده نمی‌توانند یکسان باشند"
      );
      return;
    }

    const senderAmountNum =
      parseFloat(trSenderAmount);

    const rateNum =
      parseFloat(trRate);

    const commissionNum =
      parseFloat(trCommission) || 0;

    if (
      !Number.isFinite(
        senderAmountNum
      ) ||
      !Number.isFinite(rateNum) ||
      rateNum <= 0
    ) {
      return;
    }

    if (
      !Number.isFinite(
        commissionNum
      ) ||
      commissionNum < 0
    ) {
      return;
    }

    // محاسبه با همان موتور مشترک
    const receiverAmountNum =
      convertAmount(
        senderAmountNum,
        trSenderCurrency,
        trReceiverCurrency,
        rateNum
      );

    const tx: TransferTransaction = {
      id: docId,
      type: "بین-مشتریان",

      date: new Date().toISOString(),

      senderId: trSender,

      receiverId: trReceiver,

      senderCurrency:
        trSenderCurrency,

      senderAmount:
        senderAmountNum,

      receiverCurrency:
        trReceiverCurrency,

      receiverAmount:
        receiverAmountNum,

      rate: rateNum,

      commission: commissionNum,

      commissionCurrency:
        trCommissionCurrency,

      note,

      terms,

      status: "active",
    };

    setTransactions((prev) => [
      tx,
      ...prev,
    ]);

    resetForm();
  };

  // ==========================================================
  // ابطال معامله
  // ==========================================================

  const voidTransaction = (
    id: string
  ) => {
    const confirmed = window.confirm(
      "آیا از ابطال این معامله اطمینان دارید؟"
    );

    if (!confirmed) return;

    setTransactions((prev) =>
      prev.map((tx) =>
        tx.id === id
          ? {
              ...tx,
              status: "voided",
            }
          : tx
      )
    );

    setOpenOperationId(null);
  };

  // ==========================================================
  // ویرایش
  // ==========================================================

  const startEdit = (
    tx: Transaction
  ) => {
    setEditingTx({
      ...tx,
    });

    setEditMode(true);
    setOpenOperationId(null);
  };

  const saveEdit = () => {
    if (!editingTx) return;

    setTransactions((prev) =>
      prev.map((tx) =>
        tx.id === editingTx.id
          ? {
              ...editingTx,
            }
          : tx
      )
    );

    setEditMode(false);
    setEditingTx(null);
  };

  // ==========================================================
  // چاپ رسید
  // ==========================================================

  const printReceipt = (
    tx: Transaction
  ) => {
    setOpenOperationId(null);

    const w = window.open(
      "",
      "_blank"
    );

    if (!w) return;

    let content = `
      <div style="
        direction:rtl;
        font-family:Tahoma, Arial, sans-serif;
        padding:30px;
        max-width:700px;
        margin:auto;
      ">
    `;

    content += `
      <h2 style="text-align:center;">
        رسید معامله
      </h2>
    `;

    content += `
      <hr />
    `;

    content += `
      <p>
        <strong>شماره:</strong>
        ${tx.id}
      </p>
    `;

    content += `
      <p>
        <strong>تاریخ:</strong>
        ${new Date(
          tx.date
        ).toLocaleString("fa-IR")}
      </p>
    `;

    content += `
      <p>
        <strong>نوع:</strong>
        ${tx.type}
      </p>
    `;

    // --------------------------------------------------------
    // صرافی با مشتری
    // --------------------------------------------------------

    if (
      tx.type ===
      "صرافی-مشتری"
    ) {
      const customer =
        customers.find(
          (c) =>
            c.id ===
            tx.customerId
        );

      content += `
        <p>
          <strong>مشتری:</strong>
          ${customer?.name ||
          tx.customerId}
        </p>
      `;

      content += `
        <p>
          <strong>دریافت:</strong>
          ${formatNumber(
            tx.receivedAmount
          )}
          ${
            currencyLabels[
              tx.receivedCurrency
            ]
          }
        </p>
      `;

      content += `
        <p>
          <strong>پرداخت:</strong>
          ${formatNumber(
            tx.paidAmount
          )}
          ${
            currencyLabels[
              tx.paidCurrency
            ]
          }
        </p>
      `;

      content += `
        <p>
          <strong>نرخ:</strong>
          ${formatRateQuote(
            tx.receivedCurrency,
            tx.paidCurrency,
            tx.rate
          )}
        </p>
      `;
    }

    // --------------------------------------------------------
    // بین مشتریان
    // --------------------------------------------------------

    else {
      const sender =
        customers.find(
          (c) =>
            c.id ===
            tx.senderId
        );

      const receiver =
        customers.find(
          (c) =>
            c.id ===
            tx.receiverId
        );

      content += `
        <p>
          <strong>فرستنده:</strong>
          ${sender?.name ||
          tx.senderId}
          |
          ${formatNumber(
            tx.senderAmount
          )}
          ${
            currencyLabels[
              tx.senderCurrency
            ]
          }
        </p>
      `;

      content += `
        <p>
          <strong>گیرنده:</strong>
          ${receiver?.name ||
          tx.receiverId}
          |
          ${formatNumber(
            tx.receiverAmount
          )}
          ${
            currencyLabels[
              tx.receiverCurrency
            ]
          }
        </p>
      `;

      content += `
        <p>
          <strong>نرخ:</strong>
          ${formatRateQuote(
            tx.senderCurrency,
            tx.receiverCurrency,
            tx.rate
          )}
        </p>
      `;

      if (tx.commission > 0) {
        content += `
          <p>
            <strong>کارمزد:</strong>
            ${formatNumber(
              tx.commission
            )}
            ${
              currencyLabels[
                tx.commissionCurrency
              ]
            }
          </p>
        `;
      }
    }

    content += `
      <p>
        <strong>مفاد:</strong>
        ${tx.terms}
      </p>
    `;

    content += `
      <p>
        <strong>یادداشت:</strong>
        ${tx.note || "-"}
      </p>
    `;

    content += `
      <p>
        <strong>وضعیت:</strong>
        ${
          tx.status ===
          "voided"
            ? "ابطال شده"
            : "فعال"
        }
      </p>
    `;

    content += `
      <hr />
      <p style="text-align:center;">
        با تشکر
      </p>
      </div>
    `;

    w.document.write(
      content
    );

    w.document.close();

    w.focus();

    setTimeout(() => {
      w.print();
    }, 300);
  };

  const customerName = (
    id: string
  ) =>
    customers.find(
      (c) => c.id === id
    )?.name || id;

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div
      dir="rtl"
      className="space-y-6"
    >
      {/* ======================================================
          عنوان
      ====================================================== */}

      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          معاملات ارزی
        </h1>

        <p className="text-sm text-gray-500 mt-1">
          مدیریت تبادل ارز و انتقال بین حساب مشتریان
        </p>
      </div>

      {/* ======================================================
          Tabs
      ====================================================== */}

      <div className="flex gap-2 border-b pb-2">
        <button
          onClick={() =>
            setActiveTab(
              "صرافی-مشتری"
            )
          }
          className={`px-4 py-2 rounded-t-lg text-sm font-medium transition ${
            activeTab ===
            "صرافی-مشتری"
              ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          تبادل ارز (صرافی با مشتری)
        </button>

        <button
          onClick={() =>
            setActiveTab(
              "بین-مشتریان"
            )
          }
          className={`px-4 py-2 rounded-t-lg text-sm font-medium transition ${
            activeTab ===
            "بین-مشتریان"
              ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          تبادل بین حساب مشتریان
        </button>
      </div>

      {/* ======================================================
          تب صرافی با مشتری
      ====================================================== */}

      {activeTab ===
      "صرافی-مشتری" ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">
            تبادل ارز
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* اطلاعات مشتری و دریافتی */}

            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <h3 className="text-sm font-bold text-gray-500 mb-4">
                اطلاعات مشتری و دریافتی
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    مشتری
                  </label>

                  <select
                    value={
                      exCustomer
                    }
                    onChange={(e) =>
                      setExCustomer(
                        e.target.value
                      )
                    }
                    className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm"
                  >
                    <option value="">
                      انتخاب مشتری
                    </option>

                    {customers.map(
                      (
                        customer,
                        index
                      ) => (
                        <option
                          key={
                            customer.id
                          }
                          value={
                            customer.id
                          }
                        >
                          {index + 1}.{" "}
                          {
                            customer.name
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    ارز دریافتی
                  </label>

                  <select
                    value={
                      exReceivedCurrency
                    }
                    onChange={(e) =>
                      setExReceivedCurrency(
                        e.target.value
                      )
                    }
                    className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm"
                  >
                    {currencies.map(
                      (
                        currency
                      ) => (
                        <option
                          key={
                            currency
                          }
                          value={
                            currency
                          }
                        >
                          {
                            currencyLabels[
                              currency
                            ]
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    مبلغ دریافتی
                  </label>

                  <input
                    type="number"
                    value={
                      exReceivedAmount
                    }
                    onChange={(e) =>
                      setExReceivedAmount(
                        e.target.value
                      )
                    }
                    className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* اطلاعات پرداختی */}

            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <h3 className="text-sm font-bold text-gray-500 mb-4">
                اطلاعات پرداختی
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    ارز پرداختی
                  </label>

                  <select
                    value={
                      exPaidCurrency
                    }
                    onChange={(e) =>
                      setExPaidCurrency(
                        e.target.value
                      )
                    }
                    className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm"
                  >
                    {currencies.map(
                      (
                        currency
                      ) => (
                        <option
                          key={
                            currency
                          }
                          value={
                            currency
                          }
                        >
                          {
                            currencyLabels[
                              currency
                            ]
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    مبلغ پرداختی (محاسبه شده)
                  </label>

                  <input
                    type="text"
                    value={
                      exPaidAmount
                    }
                    readOnly
                    className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-gray-100 text-gray-800 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* نرخ */}

          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              نرخ تبدیل
            </label>

            <input
              type="number"
              step="any"
              value={exRate}
              onChange={(e) =>
                setExRate(
                  e.target.value
                )
              }
              placeholder={
                exReceivedCurrency ===
                exPaidCurrency
                  ? "بدون تبدیل"
                  : `نرخ جفت ارز ${currencyLabels[exReceivedCurrency]} / ${currencyLabels[exPaidCurrency]} را وارد کنید`
              }
              className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                مفاد معامله
              </label>

              <input
                value={terms}
                onChange={(e) =>
                  setTerms(
                    e.target.value
                  )
                }
                className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                یادداشت
              </label>

              <input
                value={note}
                onChange={(e) =>
                  setNote(
                    e.target.value
                  )
                }
                className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm"
              />
            </div>
          </div>

          <button
            onClick={
              submitExchange
            }
            className="w-full h-14 rounded-2xl bg-[#092F3A] text-white font-medium hover:bg-[#0a3f4a]"
          >
            ثبت معامله
          </button>
        </div>
      ) : (
        /* ====================================================
           تب بین مشتریان
        ==================================================== */

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">
            تبادل بین حساب مشتریان
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* فرستنده */}

            <div className="bg-blue-50/50 rounded-xl p-5 border border-blue-100">
              <h3 className="text-sm font-bold text-blue-700 mb-4">
                اطلاعات فرستنده
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    مشتری فرستنده
                  </label>

                  <select
                    value={
                      trSender
                    }
                    onChange={(e) =>
                      setTrSender(
                        e.target.value
                      )
                    }
                    className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm"
                  >
                    <option value="">
                      انتخاب مشتری
                    </option>

                    {customers.map(
                      (
                        customer,
                        index
                      ) => (
                        <option
                          key={
                            customer.id
                          }
                          value={
                            customer.id
                          }
                        >
                          {index + 1}.{" "}
                          {
                            customer.name
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    ارز فرستنده
                  </label>

                  <select
                    value={
                      trSenderCurrency
                    }
                    onChange={(e) =>
                      setTrSenderCurrency(
                        e.target.value
                      )
                    }
                    className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm"
                  >
                    {currencies.map(
                      (
                        currency
                      ) => (
                        <option
                          key={
                            currency
                          }
                          value={
                            currency
                          }
                        >
                          {
                            currencyLabels[
                              currency
                            ]
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    مبلغ فرستنده
                  </label>

                  <input
                    type="number"
                    value={
                      trSenderAmount
                    }
                    onChange={(e) =>
                      setTrSenderAmount(
                        e.target.value
                      )
                    }
                    className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* گیرنده */}

            <div className="bg-green-50/50 rounded-xl p-5 border border-green-100">
              <h3 className="text-sm font-bold text-green-700 mb-4">
                اطلاعات گیرنده
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    مشتری گیرنده
                  </label>

                  <select
                    value={
                      trReceiver
                    }
                    onChange={(e) =>
                      setTrReceiver(
                        e.target.value
                      )
                    }
                    className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm"
                  >
                    <option value="">
                      انتخاب مشتری
                    </option>

                    {customers.map(
                      (
                        customer,
                        index
                      ) => (
                        <option
                          key={
                            customer.id
                          }
                          value={
                            customer.id
                          }
                        >
                          {index + 1}.{" "}
                          {
                            customer.name
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    ارز گیرنده
                  </label>

                  <select
                    value={
                      trReceiverCurrency
                    }
                    onChange={(e) =>
                      setTrReceiverCurrency(
                        e.target.value
                      )
                    }
                    className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm"
                  >
                    {currencies.map(
                      (
                        currency
                      ) => (
                        <option
                          key={
                            currency
                          }
                          value={
                            currency
                          }
                        >
                          {
                            currencyLabels[
                              currency
                            ]
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    مبلغ گیرنده (محاسبه شده)
                  </label>

                  <input
                    type="text"
                    value={
                      trReceiverAmount
                    }
                    readOnly
                    className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-gray-100 text-gray-800 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* نرخ */}

          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              نرخ تبدیل
            </label>

            <input
              type="number"
              step="any"
              value={trRate}
              onChange={(e) =>
                setTrRate(
                  e.target.value
                )
              }
              placeholder={
                trSenderCurrency ===
                trReceiverCurrency
                  ? "بدون تبدیل"
                  : `نرخ جفت ارز ${currencyLabels[trSenderCurrency]} / ${currencyLabels[trReceiverCurrency]} را وارد کنید`
              }
              className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm"
            />
          </div>

          {/* کارمزد و یادداشت */}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                کارمزد (اختیاری)
              </label>

              <input
                type="number"
                value={
                  trCommission
                }
                onChange={(e) =>
                  setTrCommission(
                    e.target.value
                  )
                }
                className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                ارز کارمزد
              </label>

              <select
                value={
                  trCommissionCurrency
                }
                onChange={(e) =>
                  setTrCommissionCurrency(
                    e.target.value
                  )
                }
                className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm"
              >
                {currencies.map(
                  (currency) => (
                    <option
                      key={currency}
                      value={currency}
                    >
                      {
                        currencyLabels[
                          currency
                        ]
                      }
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                یادداشت
              </label>

              <input
                value={note}
                onChange={(e) =>
                  setNote(
                    e.target.value
                  )
                }
                className="h-14 rounded-[14px] w-full px-4 py-2 border border-gray-200 bg-white text-gray-800 text-sm"
              />
            </div>
          </div>

          <button
            onClick={
              submitTransfer
            }
            className="w-full h-14 rounded-2xl bg-[#092F3A] text-white font-medium hover:bg-[#0a3f4a]"
          >
            ثبت معامله
          </button>
        </div>
      )}

      {/* ======================================================
          موجودی مشتریان
      ====================================================== */}

      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">
          موجودی فعلی مشتریان
        </h2>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="py-2 px-3 text-right font-bold">
                  مشتری
                </th>

                {currencies.map(
                  (currency) => (
                    <th
                      key={currency}
                      className="py-2 px-3 text-right font-bold"
                    >
                      {
                        currencyLabels[
                          currency
                        ]
                      }
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {customers.map(
                (customer) => {
                  const balance =
                    liveBalances[
                      customer.id
                    ] ||
                    customer.balances;

                  return (
                    <tr
                      key={
                        customer.id
                      }
                      className="hover:bg-gray-50"
                    >
                      <td className="py-2 px-3 font-medium">
                        {
                          customer.name
                        }
                      </td>

                      {currencies.map(
                        (
                          currency
                        ) => (
                          <td
                            key={
                              currency
                            }
                            className="py-2 px-3"
                          >
                            {formatNumber(
                              balance[
                                currency
                              ] || 0
                            )}
                          </td>
                        )
                      )}
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================
          آخرین معاملات
      ====================================================== */}

      <div className="bg-white rounded-xl shadow overflow-visible">
        <h2 className="text-lg font-semibold text-gray-700 p-5 pb-2">
          آخرین معاملات
        </h2>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                {/* ستون شماره به جای سند */}
                <th className="py-3 px-3 text-right font-bold">
                  شماره
                </th>

                <th className="py-3 px-3 text-right font-bold">
                  تاریخ
                </th>

                <th className="py-3 px-3 text-right font-bold">
                  نوع معامله
                </th>

                <th className="py-3 px-3 text-right font-bold">
                  مشتری/فرستنده
                </th>

                <th className="py-3 px-3 text-right font-bold">
                  دریافت
                </th>

                <th className="py-3 px-3 text-right font-bold">
                  پرداخت
                </th>

                <th className="py-3 px-3 text-right font-bold">
                  نرخ
                </th>

                <th className="py-3 px-3 text-right font-bold">
                  مفاد
                </th>

                <th className="py-3 px-3 text-right font-bold">
                  عملیات
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {transactions.length ===
                0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="text-center py-8 text-gray-400"
                  >
                    هیچ معامله‌ای ثبت نشده است
                  </td>
                </tr>
              )}

              {transactions.map(
                (tx, index) => {
                  const isVoided =
                    tx.status ===
                    "voided";

                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-gray-50 ${
                        isVoided
                          ? "opacity-60"
                          : ""
                      }`}
                    >
                      {/* شماره */}
                      <td
                        className={`py-3 px-3 font-bold ${
                          isVoided
                            ? "line-through"
                            : ""
                        }`}
                      >
                        {index + 1}
                      </td>

                      {/* تاریخ */}
                      <td className="py-3 px-3 text-xs">
                        {new Date(
                          tx.date
                        ).toLocaleString(
                          "fa-IR"
                        )}
                      </td>

                      {/* نوع */}
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-1 rounded text-xs whitespace-nowrap ${
                            tx.type ===
                            "صرافی-مشتری"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {tx.type ===
                          "صرافی-مشتری"
                            ? "صرافی-مشتری"
                            : "بین مشتریان"}
                        </span>
                      </td>

                      {/* مشتری / فرستنده */}
                      <td className="py-3 px-3">
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
                      <td className="py-3 px-3 whitespace-nowrap">
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
                      <td className="py-3 px-3 whitespace-nowrap">
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

                      {/* نرخ */}
                      <td className="py-3 px-3 text-xs whitespace-nowrap">
                        {tx.type ===
                        "صرافی-مشتری"
                          ? formatRateQuote(
                              tx.receivedCurrency,
                              tx.paidCurrency,
                              tx.rate
                            )
                          : formatRateQuote(
                              tx.senderCurrency,
                              tx.receiverCurrency,
                              tx.rate
                            )}
                      </td>

                      {/* مفاد */}
                      <td className="py-3 px-3 text-xs">
                        {tx.terms}
                      </td>

                      {/* عملیات */}
                      <td className="py-3 px-3 relative">
                        <div className="relative inline-block">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenOperationId(
                                openOperationId ===
                                  tx.id
                                  ? null
                                  : tx.id
                              )
                            }
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium whitespace-nowrap"
                          >
                            <span>
                              ⋮
                            </span>
                            <span>
                              عملیات
                            </span>
                            <span className="text-[10px]">
                              ▼
                            </span>
                          </button>

                          {openOperationId ===
                            tx.id && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() =>
                                  setOpenOperationId(
                                    null
                                  )
                                }
                              />

                              <div className="absolute left-0 top-full mt-2 w-36 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                                {/* مشاهده */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setViewTx(
                                      tx
                                    );
                                    setOpenOperationId(
                                      null
                                    );
                                  }}
                                  className="w-full text-right px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                                >
                                  👁 مشاهده
                                </button>

                                {/* ویرایش */}
                                {!isVoided && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      startEdit(
                                        tx
                                      )
                                    }
                                    className="w-full text-right px-4 py-3 text-sm text-gray-700 hover:bg-yellow-50 hover:text-yellow-700"
                                  >
                                    ✏️ ویرایش
                                  </button>
                                )}

                                {/* چاپ */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    printReceipt(
                                      tx
                                    )
                                  }
                                  className="w-full text-right px-4 py-3 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  🖨 چاپ
                                </button>

                                {/* ابطال */}
                                {!isVoided && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      voidTransaction(
                                        tx.id
                                      )
                                    }
                                    className="w-full text-right px-4 py-3 text-sm text-red-600 hover:bg-red-50 border-t border-gray-100"
                                  >
                                    ⛔ ابطال
                                  </button>
                                )}

                                {/* وضعیت ابطال */}
                                {isVoided && (
                                  <div className="px-4 py-3 text-xs text-red-500 border-t border-gray-100">
                                    ابطال شده
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================
          View Modal
      ====================================================== */}

      {viewTx && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-[100] p-4"
          onClick={() =>
            setViewTx(null)
          }
        >
          <div
            className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              جزئیات معامله
            </h2>

            <div className="space-y-3 text-sm">
              <p>
                <strong>
                  شماره:
                </strong>{" "}
                {viewTx.id}
              </p>

              <p>
                <strong>
                  تاریخ:
                </strong>{" "}
                {new Date(
                  viewTx.date
                ).toLocaleString(
                  "fa-IR"
                )}
              </p>

              <p>
                <strong>
                  نوع:
                </strong>{" "}
                {viewTx.type}
              </p>

              {viewTx.type ===
                "صرافی-مشتری" && (
                <>
                  <p>
                    <strong>
                      مشتری:
                    </strong>{" "}
                    {customerName(
                      viewTx.customerId
                    )}
                  </p>

                  <p>
                    <strong>
                      دریافت:
                    </strong>{" "}
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
                    <strong>
                      پرداخت:
                    </strong>{" "}
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
                    <strong>
                      نرخ:
                    </strong>{" "}
                    {formatRateQuote(
                      viewTx.receivedCurrency,
                      viewTx.paidCurrency,
                      viewTx.rate
                    )}
                  </p>
                </>
              )}

              {viewTx.type ===
                "بین-مشتریان" && (
                <>
                  <p>
                    <strong>
                      فرستنده:
                    </strong>{" "}
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
                    <strong>
                      گیرنده:
                    </strong>{" "}
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
                    <strong>
                      نرخ:
                    </strong>{" "}
                    {formatRateQuote(
                      viewTx.senderCurrency,
                      viewTx.receiverCurrency,
                      viewTx.rate
                    )}
                  </p>

                  {viewTx.commission >
                    0 && (
                    <p>
                      <strong>
                        کارمزد:
                      </strong>{" "}
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
                <strong>
                  مفاد:
                </strong>{" "}
                {viewTx.terms}
              </p>

              <p>
                <strong>
                  یادداشت:
                </strong>{" "}
                {viewTx.note || "-"}
              </p>

              <p>
                <strong>
                  وضعیت:
                </strong>{" "}
                {viewTx.status ===
                "voided"
                  ? "ابطال شده"
                  : "فعال"}
              </p>
            </div>

            <button
              onClick={() =>
                setViewTx(null)
              }
              className="mt-5 px-5 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
            >
              بستن
            </button>
          </div>
        </div>
      )}

      {/* ======================================================
          Edit Modal
      ====================================================== */}

      {editMode &&
        editingTx && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[100] p-4 overflow-y-auto">
            <div className="bg-white rounded-xl p-6 max-w-2xl w-full shadow-2xl my-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-5">
                ویرایش معامله
              </h2>

              {/* صرافی با مشتری */}

              {editingTx.type ===
                "صرافی-مشتری" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-bold text-sm">
                      مشتری
                    </label>

                    <select
                      value={
                        (
                          editingTx as ExchangeTransaction
                        )
                          .customerId
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          customerId:
                            e.target
                              .value,
                        } as ExchangeTransaction)
                      }
                      className="w-full border rounded-lg p-3 mt-1"
                    >
                      {customers.map(
                        (
                          customer,
                          index
                        ) => (
                          <option
                            key={
                              customer.id
                            }
                            value={
                              customer.id
                            }
                          >
                            {index +
                              1}
                            .{" "}
                            {
                              customer.name
                            }
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-sm">
                      ارز دریافتی
                    </label>

                    <select
                      value={
                        (
                          editingTx as ExchangeTransaction
                        )
                          .receivedCurrency
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          receivedCurrency:
                            e.target
                              .value,
                        } as ExchangeTransaction)
                      }
                      className="w-full border rounded-lg p-3 mt-1"
                    >
                      {currencies.map(
                        (
                          currency
                        ) => (
                          <option
                            key={
                              currency
                            }
                            value={
                              currency
                            }
                          >
                            {
                              currencyLabels[
                                currency
                              ]
                            }
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-sm">
                      مبلغ دریافتی
                    </label>

                    <input
                      type="number"
                      value={
                        (
                          editingTx as ExchangeTransaction
                        )
                          .receivedAmount
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          receivedAmount:
                            Number(
                              e.target
                                .value
                            ),
                        } as ExchangeTransaction)
                      }
                      className="w-full border rounded-lg p-3 mt-1"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-sm">
                      ارز پرداختی
                    </label>

                    <select
                      value={
                        (
                          editingTx as ExchangeTransaction
                        )
                          .paidCurrency
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          paidCurrency:
                            e.target
                              .value,
                        } as ExchangeTransaction)
                      }
                      className="w-full border rounded-lg p-3 mt-1"
                    >
                      {currencies.map(
                        (
                          currency
                        ) => (
                          <option
                            key={
                              currency
                            }
                            value={
                              currency
                            }
                          >
                            {
                              currencyLabels[
                                currency
                              ]
                            }
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-sm">
                      مبلغ پرداختی
                    </label>

                    <input
                      type="number"
                      value={
                        (
                          editingTx as ExchangeTransaction
                        )
                          .paidAmount
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          paidAmount:
                            Number(
                              e.target
                                .value
                            ),
                        } as ExchangeTransaction)
                      }
                      className="w-full border rounded-lg p-3 mt-1"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-sm">
                      نرخ
                    </label>

                    <input
                      type="number"
                      step="any"
                      value={
                        (
                          editingTx as ExchangeTransaction
                        ).rate
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          rate: Number(
                            e.target
                              .value
                          ),
                        } as ExchangeTransaction)
                      }
                      className="w-full border rounded-lg p-3 mt-1"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-sm">
                      مفاد
                    </label>

                    <input
                      value={
                        editingTx.terms
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          terms:
                            e.target
                              .value,
                        })
                      }
                      className="w-full border rounded-lg p-3 mt-1"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-sm">
                      یادداشت
                    </label>

                    <input
                      value={
                        editingTx.note
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          note:
                            e.target
                              .value,
                        })
                      }
                      className="w-full border rounded-lg p-3 mt-1"
                    />
                  </div>
                </div>
              )}

              {/* بین مشتریان */}

              {editingTx.type ===
                "بین-مشتریان" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-bold text-sm">
                      فرستنده
                    </label>

                    <select
                      value={
                        (
                          editingTx as TransferTransaction
                        ).senderId
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          senderId:
                            e.target
                              .value,
                        } as TransferTransaction)
                      }
                      className="w-full border rounded-lg p-3 mt-1"
                    >
                      {customers.map(
                        (
                          customer,
                          index
                        ) => (
                          <option
                            key={
                              customer.id
                            }
                            value={
                              customer.id
                            }
                          >
                            {index +
                              1}
                            .{" "}
                            {
                              customer.name
                            }
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-sm">
                      گیرنده
                    </label>

                    <select
                      value={
                        (
                          editingTx as TransferTransaction
                        ).receiverId
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          receiverId:
                            e.target
                              .value,
                        } as TransferTransaction)
                      }
                      className="w-full border rounded-lg p-3 mt-1"
                    >
                      {customers.map(
                        (
                          customer,
                          index
                        ) => (
                          <option
                            key={
                              customer.id
                            }
                            value={
                              customer.id
                            }
                          >
                            {index +
                              1}
                            .{" "}
                            {
                              customer.name
                            }
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-sm">
                      ارز فرستنده
                    </label>

                    <select
                      value={
                        (
                          editingTx as TransferTransaction
                        )
                          .senderCurrency
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          senderCurrency:
                            e.target
                              .value,
                        } as TransferTransaction)
                      }
                      className="w-full border rounded-lg p-3 mt-1"
                    >
                      {currencies.map(
                        (
                          currency
                        ) => (
                          <option
                            key={
                              currency
                            }
                            value={
                              currency
                            }
                          >
                            {
                              currencyLabels[
                                currency
                              ]
                            }
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-sm">
                      مبلغ فرستنده
                    </label>

                    <input
                      type="number"
                      value={
                        (
                          editingTx as TransferTransaction
                        )
                          .senderAmount
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          senderAmount:
                            Number(
                              e.target
                                .value
                            ),
                        } as TransferTransaction)
                      }
                      className="w-full border rounded-lg p-3 mt-1"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-sm">
                      ارز گیرنده
                    </label>

                    <select
                      value={
                        (
                          editingTx as TransferTransaction
                        )
                          .receiverCurrency
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          receiverCurrency:
                            e.target
                              .value,
                        } as TransferTransaction)
                      }
                      className="w-full border rounded-lg p-3 mt-1"
                    >
                      {currencies.map(
                        (
                          currency
                        ) => (
                          <option
                            key={
                              currency
                            }
                            value={
                              currency
                            }
                          >
                            {
                              currencyLabels[
                                currency
                              ]
                            }
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-sm">
                      مبلغ گیرنده
                    </label>

                    <input
                      type="number"
                      value={
                        (
                          editingTx as TransferTransaction
                        )
                          .receiverAmount
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          receiverAmount:
                            Number(
                              e.target
                                .value
                            ),
                        } as TransferTransaction)
                      }
                      className="w-full border rounded-lg p-3 mt-1"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-sm">
                      نرخ
                    </label>

                    <input
                      type="number"
                      step="any"
                      value={
                        (
                          editingTx as TransferTransaction
                        ).rate
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          rate: Number(
                            e.target
                              .value
                          ),
                        } as TransferTransaction)
                      }
                      className="w-full border rounded-lg p-3 mt-1"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-sm">
                      کارمزد
                    </label>

                    <input
                      type="number"
                      value={
                        (
                          editingTx as TransferTransaction
                        )
                          .commission
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          commission:
                            Number(
                              e.target
                                .value
                            ),
                        } as TransferTransaction)
                      }
                      className="w-full border rounded-lg p-3 mt-1"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-sm">
                      ارز کارمزد
                    </label>

                    <select
                      value={
                        (
                          editingTx as TransferTransaction
                        )
                          .commissionCurrency
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          commissionCurrency:
                            e.target
                              .value,
                        } as TransferTransaction)
                      }
                      className="w-full border rounded-lg p-3 mt-1"
                    >
                      {currencies.map(
                        (
                          currency
                        ) => (
                          <option
                            key={
                              currency
                            }
                            value={
                              currency
                            }
                          >
                            {
                              currencyLabels[
                                currency
                              ]
                            }
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-sm">
                      مفاد
                    </label>

                    <input
                      value={
                        editingTx.terms
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          terms:
                            e.target
                              .value,
                        })
                      }
                      className="w-full border rounded-lg p-3 mt-1"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-sm">
                      یادداشت
                    </label>

                    <input
                      value={
                        editingTx.note
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          note:
                            e.target
                              .value,
                        })
                      }
                      className="w-full border rounded-lg p-3 mt-1"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => {
                    setEditMode(
                      false
                    );
                    setEditingTx(
                      null
                    );
                  }}
                  className="px-5 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
                >
                  انصراف
                </button>

                <button
                  onClick={
                    saveEdit
                  }
                  className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
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
