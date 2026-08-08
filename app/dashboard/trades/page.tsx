```tsx
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

/**
 * واحد استاندارد برای نمایش نرخ:
 *
 * AFN = 1
 * USD = 1
 * IRR = 1000
 * PKR = 1000
 *
 * مثال:
 * 1 USD = 50 AFN
 * 1000 IRR = 0.38 AFN
 * 1000 PKR = 229 AFN
 */
const currencyRateUnits: Record<string, number> = {
  AFN: 1,
  USD: 1,
  IRR: 1000,
  PKR: 1000,
};

type ExchangeTransaction = BaseTransaction & {
  type: "صرافی-مشتری";
  customerId: string;

  receivedCurrency: string;
  receivedAmount: number;

  paidCurrency: string;
  paidAmount: number;

  /**
   * نرخ همیشه به شکل زیر تفسیر می‌شود:
   *
   * rateUnit از paidCurrency = rate از receivedCurrency
   *
   * مثال:
   * 1 USD = 50 AFN
   * 1000 IRR = 0.38 AFN
   * 1000 PKR = 229 AFN
   */
  rate: number;

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

  /**
   * نرخ:
   * واحد استاندارد ارز فرستنده = rate ارز گیرنده
   *
   * مثال:
   * 1 USD = 50 AFN
   * 1000 IRR = 0.38 AFN
   * 1000 PKR = 229 AFN
   */
  rate: number;

  commission: number;
  commissionCurrency: string;
};

type Transaction = ExchangeTransaction | TransferTransaction;

type Customer = {
  id: string;
  name: string;
  balances: Record<string, number>;
};

const currencies = ["AFN", "USD", "IRR", "PKR"];

const currencyLabels: Record<string, string> = {
  AFN: "افغانی",
  USD: "دالر",
  IRR: "تومان",
  PKR: "کلدار",
};

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

const formatNumber = (n: number) => {
  if (!Number.isFinite(n)) return "0";

  return n.toLocaleString("en-US", {
    maximumFractionDigits: 8,
  });
};

const generateDocId = () => {
  const d = new Date();

  return `EX-${d.getFullYear()}${String(
    d.getMonth() + 1
  ).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(
    Math.floor(Math.random() * 10000)
  ).padStart(4, "0")}`;
};

/**
 * ============================================================
 * منطق اصلی تبدیل ارز
 * ============================================================
 *
 * این سیستم نرخ را همیشه به صورت زیر تعریف می‌کند:
 *
 * واحد استاندارد ارز مبدأ = rate ارز مقصد
 *
 * مثال:
 *
 * 1 USD = 50 AFN
 *
 * 1000 IRR = 0.38 AFN
 *
 * 1000 PKR = 229 AFN
 *
 * اگر جهت معامله برعکس باشد، نرخ به صورت ریاضی معکوس می‌شود.
 *
 * مثال:
 *
 * 50,000 AFN با نرخ 50 AFN = 1 USD
 *
 * نتیجه:
 * 50,000 / 50 = 1,000 USD
 *
 * برعکس:
 *
 * 1,000 USD × 50 = 50,000 AFN
 */
function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rate: number
): number {
  if (
    !Number.isFinite(amount) ||
    !Number.isFinite(rate) ||
    amount < 0 ||
    rate <= 0
  ) {
    return 0;
  }

  if (fromCurrency === toCurrency) {
    return amount;
  }

  const fromUnit = currencyRateUnits[fromCurrency] ?? 1;
  const toUnit = currencyRateUnits[toCurrency] ?? 1;

  /**
   * نرخ در فرم معامله به این شکل ثبت می‌شود:
   *
   * fromUnit از ارز مبدأ = rate از ارز مقصد
   *
   * بنابراین:
   *
   * amount / fromUnit * rate
   *
   * مقدار ارز مقصد را می‌دهد.
   */
  return (amount / fromUnit) * rate * toUnit;
}

/**
 * تبدیل معکوس:
 *
 * اگر مبلغ ارز مقصد را داشته باشیم و بخواهیم
 * مبلغ ارز مبدأ را پیدا کنیم:
 *
 * destinationAmount / rate
 */
function convertCurrencyReverse(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rate: number
): number {
  if (
    !Number.isFinite(amount) ||
    !Number.isFinite(rate) ||
    amount < 0 ||
    rate <= 0
  ) {
    return 0;
  }

  if (fromCurrency === toCurrency) {
    return amount;
  }

  const fromUnit = currencyRateUnits[fromCurrency] ?? 1;
  const toUnit = currencyRateUnits[toCurrency] ?? 1;

  return (amount / toUnit / rate) * fromUnit;
}

function computeBalances(
  customers: Customer[],
  transactions: Transaction[]
) {
  const balances: Record<string, Record<string, number>> = {};

  customers.forEach((customer) => {
    balances[customer.id] = {
      ...customer.balances,
    };
  });

  transactions.forEach((tx) => {
    if (tx.status === "voided") return;

    if (tx.type === "صرافی-مشتری") {
      const customerBalance = balances[tx.customerId];

      if (!customerBalance) return;

      /**
       * در معامله صرافی:
       *
       * مشتری ارز دریافتی را به صرافی می‌دهد
       * و ارز پرداختی را از صرافی دریافت می‌کند.
       */

      customerBalance[tx.receivedCurrency] =
        (customerBalance[tx.receivedCurrency] || 0) -
        tx.receivedAmount;

      customerBalance[tx.paidCurrency] =
        (customerBalance[tx.paidCurrency] || 0) +
        tx.paidAmount;
    } else {
      const senderBalance = balances[tx.senderId];
      const receiverBalance = balances[tx.receiverId];

      if (senderBalance) {
        senderBalance[tx.senderCurrency] =
          (senderBalance[tx.senderCurrency] || 0) -
          tx.senderAmount;

        if (tx.commission > 0) {
          senderBalance[tx.commissionCurrency] =
            (senderBalance[tx.commissionCurrency] || 0) -
            tx.commission;
        }
      }

      if (receiverBalance) {
        receiverBalance[tx.receiverCurrency] =
          (receiverBalance[tx.receiverCurrency] || 0) +
          tx.receiverAmount;
      }
    }
  });

  return balances;
}

export default function CurrencyExchangePage() {
  const [customers] = useState<Customer[]>(initialCustomers);

  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [activeTab, setActiveTab] =
    useState<ExchangeType>("صرافی-مشتری");

  const [docId, setDocId] = useState(generateDocId());

  const [note, setNote] = useState("");
  const [terms, setTerms] = useState("نقدی");

  // ==========================================================
  // تب صرافی با مشتری
  // ==========================================================

  const [exCustomer, setExCustomer] = useState("");

  const [exReceivedCurrency, setExReceivedCurrency] =
    useState("AFN");

  const [exReceivedAmount, setExReceivedAmount] =
    useState("");

  const [exPaidCurrency, setExPaidCurrency] =
    useState("USD");

  const [exPaidAmount, setExPaidAmount] =
    useState("");

  /**
   * نرخ کاملاً دستی است.
   *
   * مثال:
   *
   * AFN -> USD
   * نرخ 50
   *
   * یعنی:
   * 50 AFN = 1 USD
   *
   * IRR -> AFN
   * نرخ 0.38
   *
   * یعنی:
   * 1000 تومان = 0.38 AFN
   */
  const [exRate, setExRate] = useState("");

  const [exProfit, setExProfit] = useState("");

  const [exProfitCurrency, setExProfitCurrency] =
    useState("AFN");

  // ==========================================================
  // تب بین مشتریان
  // ==========================================================

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

  const [trRate, setTrRate] = useState("1");

  const [trCommission, setTrCommission] =
    useState("0");

  const [trCommissionCurrency, setTrCommissionCurrency] =
    useState("AFN");

  const [viewTx, setViewTx] =
    useState<Transaction | null>(null);

  const [editingTx, setEditingTx] =
    useState<Transaction | null>(null);

  const [openMenu, setOpenMenu] =
    useState<string | null>(null);

  const liveBalances = useMemo(
    () => computeBalances(customers, transactions),
    [customers, transactions]
  );

  // ==========================================================
  // محاسبه خودکار مبلغ پرداختی
  // ==========================================================

  useEffect(() => {
    const amount = Number(exReceivedAmount);
    const rate = Number(exRate);

    if (
      amount > 0 &&
      rate > 0 &&
      exReceivedCurrency !== exPaidCurrency
    ) {
      const result = convertCurrency(
        amount,
        exReceivedCurrency,
        exPaidCurrency,
        rate
      );

      setExPaidAmount(formatNumber(result));
    } else if (
      amount > 0 &&
      exReceivedCurrency === exPaidCurrency
    ) {
      setExPaidAmount(formatNumber(amount));
    } else {
      setExPaidAmount("");
    }
  }, [
    exReceivedAmount,
    exReceivedCurrency,
    exPaidCurrency,
    exRate,
  ]);

  // ==========================================================
  // محاسبه خودکار مبلغ گیرنده
  // ==========================================================

  useEffect(() => {
    const amount = Number(trSenderAmount);
    const rate = Number(trRate);

    if (
      amount > 0 &&
      rate > 0 &&
      trSenderCurrency !== trReceiverCurrency
    ) {
      const result = convertCurrency(
        amount,
        trSenderCurrency,
        trReceiverCurrency,
        rate
      );

      setTrReceiverAmount(formatNumber(result));
    } else if (
      amount > 0 &&
      trSenderCurrency === trReceiverCurrency
    ) {
      setTrReceiverAmount(formatNumber(amount));
    } else {
      setTrReceiverAmount("");
    }
  }, [
    trSenderAmount,
    trSenderCurrency,
    trReceiverCurrency,
    trRate,
  ]);

  // ==========================================================
  // متن راهنمای نرخ
  // ==========================================================

  const getRateDescription = (
    fromCurrency: string,
    toCurrency: string,
    rate: string
  ) => {
    const numericRate = Number(rate);

    if (
      !numericRate ||
      numericRate <= 0 ||
      fromCurrency === toCurrency
    ) {
      return "نرخ را دستی وارد کنید";
    }

    const fromUnit =
      currencyRateUnits[fromCurrency] ?? 1;

    const toUnit =
      currencyRateUnits[toCurrency] ?? 1;

    return `${formatNumber(fromUnit)} ${currencyLabels[fromCurrency]} = ${formatNumber(
      numericRate * toUnit
    )} ${currencyLabels[toCurrency]}`;
  };

  // ==========================================================
  // ریست فرم
  // ==========================================================

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

    setExProfit("");
    setExProfitCurrency("AFN");

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

  // ==========================================================
  // ثبت معامله صرافی با مشتری
  // ==========================================================

  const submitExchange = () => {
    const receivedAmount = Number(exReceivedAmount);
    const paidAmount = Number(exPaidAmount);
    const rate = Number(exRate);

    if (!exCustomer) {
      alert("لطفاً مشتری را انتخاب کنید.");
      return;
    }

    if (
      !Number.isFinite(receivedAmount) ||
      receivedAmount <= 0
    ) {
      alert("مبلغ دریافتی صحیح نیست.");
      return;
    }

    if (
      !Number.isFinite(paidAmount) ||
      paidAmount <= 0
    ) {
      alert("مبلغ پرداختی صحیح نیست.");
      return;
    }

    if (
      !Number.isFinite(rate) ||
      rate <= 0
    ) {
      alert("نرخ تبدیل صحیح نیست.");
      return;
    }

    const tx: ExchangeTransaction = {
      id: docId,
      type: "صرافی-مشتری",
      date: new Date().toISOString(),

      customerId: exCustomer,

      receivedCurrency: exReceivedCurrency,
      receivedAmount,

      paidCurrency: exPaidCurrency,
      paidAmount,

      rate,

      profit: Number(exProfit) || 0,
      profitCurrency: exProfitCurrency,

      terms,
      note,
      status: "active",
    };

    setTransactions((previous) => [
      tx,
      ...previous,
    ]);

    resetForm();
  };

  // ==========================================================
  // ثبت انتقال بین مشتریان
  // ==========================================================

  const submitTransfer = () => {
    const senderAmount = Number(trSenderAmount);
    const receiverAmount = Number(trReceiverAmount);
    const rate = Number(trRate);
    const commission = Number(trCommission) || 0;

    if (!trSender || !trReceiver) {
      alert("لطفاً فرستنده و گیرنده را انتخاب کنید.");
      return;
    }

    if (trSender === trReceiver) {
      alert("فرستنده و گیرنده نمی‌توانند یک مشتری باشند.");
      return;
    }

    if (
      !Number.isFinite(senderAmount) ||
      senderAmount <= 0
    ) {
      alert("مبلغ فرستنده صحیح نیست.");
      return;
    }

    if (
      !Number.isFinite(receiverAmount) ||
      receiverAmount <= 0
    ) {
      alert("مبلغ گیرنده صحیح نیست.");
      return;
    }

    if (
      !Number.isFinite(rate) ||
      rate <= 0
    ) {
      alert("نرخ تبدیل صحیح نیست.");
      return;
    }

    if (commission < 0) {
      alert("کمیشن نمی‌تواند منفی باشد.");
      return;
    }

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

    setTransactions((previous) => [
      tx,
      ...previous,
    ]);

    resetForm();
  };

  // ==========================================================
  // ابطال معامله
  // ==========================================================

  const voidTransaction = (id: string) => {
    if (
      !confirm(
        "آیا از ابطال این معامله اطمینان دارید؟"
      )
    ) {
      return;
    }

    setTransactions((previous) =>
      previous.map((tx) =>
        tx.id === id
          ? {
              ...tx,
              status: "voided",
            }
          : tx
      )
    );

    setOpenMenu(null);
  };

  // ==========================================================
  // ویرایش
  // ==========================================================

  const saveEdit = () => {
    if (!editingTx) return;

    setTransactions((previous) =>
      previous.map((tx) =>
        tx.id === editingTx.id
          ? editingTx
          : tx
      )
    );

    setEditingTx(null);
    setOpenMenu(null);
  };

  // ==========================================================
  // نام مشتری
  // ==========================================================

  const customerName = (id: string) =>
    customers.find((c) => c.id === id)?.name || id;

  // ==========================================================
  // متن نرخ معامله
  // ==========================================================

  const rateText = (tx: Transaction) => {
    if (tx.type === "صرافی-مشتری") {
      const fromUnit =
        currencyRateUnits[tx.receivedCurrency] ?? 1;

      const toUnit =
        currencyRateUnits[tx.paidCurrency] ?? 1;

      return `${formatNumber(fromUnit)} ${
        currencyLabels[tx.receivedCurrency]
      } = ${formatNumber(tx.rate * toUnit)} ${
        currencyLabels[tx.paidCurrency]
      }`;
    }

    const fromUnit =
      currencyRateUnits[tx.senderCurrency] ?? 1;

    const toUnit =
      currencyRateUnits[tx.receiverCurrency] ?? 1;

    return `${formatNumber(fromUnit)} ${
      currencyLabels[tx.senderCurrency]
    } = ${formatNumber(tx.rate * toUnit)} ${
      currencyLabels[tx.receiverCurrency]
    }`;
  };

  // ==========================================================
  // انتخاب ارز
  // ==========================================================

  const currencySelect = (
    value: string,
    onChange: (value: string) => void
  ) => (
    <select
      value={value}
      onChange={(e) =>
        onChange(e.target.value)
      }
      className="h-14 rounded-[14px] w-full px-4 border border-gray-200 bg-white text-gray-800 text-sm"
    >
      {currencies.map((currency) => (
        <option
          key={currency}
          value={currency}
        >
          {currencyLabels[currency]} ({currency})
        </option>
      ))}
    </select>
  );

  // ==========================================================
  // چاپ رسید
  // ==========================================================

  const printReceipt = (tx: Transaction) => {
    const w = window.open("", "_blank");

    if (!w) return;

    const customer = (id: string) =>
      customers.find((c) => c.id === id)?.name || id;

    const content =
      tx.type === "صرافی-مشتری"
        ? `
          <div dir="rtl" style="font-family:Tahoma;padding:25px">
            <h2>رسید معامله ${tx.id}</h2>

            <p>
              تاریخ:
              ${new Date(tx.date).toLocaleString("fa-IR")}
            </p>

            <p>نوع معامله: تبادل ارز صرافی با مشتری</p>

            <p>
              مشتری:
              ${customer(tx.customerId)}
            </p>

            <hr/>

            <p>
              دریافتی:
              ${formatNumber(tx.receivedAmount)}
              ${currencyLabels[tx.receivedCurrency]}
            </p>

            <p>
              پرداختی:
              ${formatNumber(tx.paidAmount)}
              ${currencyLabels[tx.paidCurrency]}
            </p>

            <p>
              نرخ:
              ${rateText(tx)}
            </p>

            <p>
              مفاد:
              ${formatNumber(tx.profit)}
              ${currencyLabels[tx.profitCurrency]}
            </p>

            <p>
              شرایط:
              ${tx.terms || "-"}
            </p>

            <p>
              یادداشت:
              ${tx.note || "-"}
            </p>
          </div>
        `
        : `
          <div dir="rtl" style="font-family:Tahoma;padding:25px">
            <h2>رسید انتقال ${tx.id}</h2>

            <p>
              تاریخ:
              ${new Date(tx.date).toLocaleString("fa-IR")}
            </p>

            <p>نوع معامله: تبادل بین حساب مشتریان</p>

            <p>
              فرستنده:
              ${customer(tx.senderId)}
            </p>

            <p>
              گیرنده:
              ${customer(tx.receiverId)}
            </p>

            <hr/>

            <p>
              ارسال:
              ${formatNumber(tx.senderAmount)}
              ${currencyLabels[tx.senderCurrency]}
            </p>

            <p>
              دریافت:
              ${formatNumber(tx.receiverAmount)}
              ${currencyLabels[tx.receiverCurrency]}
            </p>

            <p>
              نرخ:
              ${rateText(tx)}
            </p>

            <p>
              کمیشن:
              ${formatNumber(tx.commission)}
              ${currencyLabels[tx.commissionCurrency]}
            </p>

            <p>
              شرایط:
              ${tx.terms || "-"}
            </p>

            <p>
              یادداشت:
              ${tx.note || "-"}
            </p>
          </div>
        `;

    w.document.write(content);
    w.document.close();
    w.print();

    setOpenMenu(null);
  };

  return (
    <div
      dir="rtl"
      className="space-y-6"
    >
      <h1 className="text-2xl font-bold text-gray-800">
        معاملات ارزی
      </h1>

      {/* =====================================================
          تب‌ها
      ===================================================== */}

      <div className="flex gap-2 border-b pb-2">
        <button
          onClick={() =>
            setActiveTab("صرافی-مشتری")
          }
          className={`px-4 py-2 rounded-t-lg text-sm font-medium ${
            activeTab === "صرافی-مشتری"
              ? "bg-cyan-600 text-white"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          تبادل ارز (صرافی با مشتری)
        </button>

        <button
          onClick={() =>
            setActiveTab("بین-مشتریان")
          }
          className={`px-4 py-2 rounded-t-lg text-sm font-medium ${
            activeTab === "بین-مشتریان"
              ? "bg-purple-600 text-white"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          تبادل بین حساب مشتریان
        </button>
      </div>

      {/* =====================================================
          صرافی با مشتری
      ===================================================== */}

      {activeTab === "صرافی-مشتری" ? (
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-6">
            تبادل ارز
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-50 rounded-xl p-5">
              <h3 className="font-bold text-gray-500 mb-4">
                اطلاعات دریافتی از مشتری
              </h3>

              <div className="space-y-4">
                <select
                  value={exCustomer}
                  onChange={(e) =>
                    setExCustomer(e.target.value)
                  }
                  className="h-14 rounded-[14px] w-full px-4 border"
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

                {currencySelect(
                  exReceivedCurrency,
                  setExReceivedCurrency
                )}

                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="مبلغ دریافتی"
                  value={exReceivedAmount}
                  onChange={(e) =>
                    setExReceivedAmount(
                      e.target.value
                    )
                  }
                  className="h-14 rounded-[14px] w-full px-4 border"
                />
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-5">
              <h3 className="font-bold text-gray-500 mb-4">
                اطلاعات پرداختی به مشتری
              </h3>

              <div className="space-y-4">
                {currencySelect(
                  exPaidCurrency,
                  setExPaidCurrency
                )}

                <input
                  readOnly
                  value={exPaidAmount}
                  placeholder="مبلغ پرداختی (محاسبه شده)"
                  className="h-14 rounded-[14px] w-full px-4 border bg-gray-100"
                />
              </div>
            </div>
          </div>

          {/* نرخ */}

          <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-5 mb-6">
            <label className="block font-bold mb-2">
              نرخ تبدیل دستی
            </label>

            <input
              type="number"
              min="0"
              step="any"
              value={exRate}
              onChange={(e) =>
                setExRate(e.target.value)
              }
              placeholder="مثلاً 50"
              className="h-14 rounded-[14px] w-full px-4 border bg-white"
            />

            <p className="mt-3 text-sm text-cyan-700">
              {getRateDescription(
                exReceivedCurrency,
                exPaidCurrency,
                exRate
              )}
            </p>

            <p className="mt-2 text-xs text-gray-500">
              نرخ را خودتان بر اساس نرخ روز بازار وارد کنید.
              سیستم مبلغ طرف مقابل را خودکار محاسبه می‌کند.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
            <div>
              <label className="block font-bold mb-2">
                مفاد تبادل ارز
              </label>

              <input
                type="number"
                min="0"
                step="any"
                value={exProfit}
                onChange={(e) =>
                  setExProfit(e.target.value)
                }
                className="h-14 rounded-[14px] w-full px-4 border"
              />
            </div>

            <div>
              <label className="block font-bold mb-2">
                ارز مفاد
              </label>

              {currencySelect(
                exProfitCurrency,
                setExProfitCurrency
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
            <input
              value={terms}
              onChange={(e) =>
                setTerms(e.target.value)
              }
              placeholder="شرایط معامله"
              className="h-14 rounded-[14px] w-full px-4 border"
            />

            <input
              value={note}
              onChange={(e) =>
                setNote(e.target.value)
              }
              placeholder="یادداشت"
              className="h-14 rounded-[14px] w-full px-4 border"
            />
          </div>

          <button
            onClick={submitExchange}
            className="w-full h-14 rounded-2xl bg-[#092F3A] text-white font-medium"
          >
            ثبت معامله
          </button>
        </div>
      ) : (
        /* ===================================================
           بین مشتریان
        =================================================== */

        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-6">
            تبادل بین حساب مشتریان
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-blue-50/50 rounded-xl p-5">
              <h3 className="font-bold text-blue-700 mb-4">
                فرستنده
              </h3>

              <div className="space-y-4">
                <select
                  value={trSender}
                  onChange={(e) =>
                    setTrSender(e.target.value)
                  }
                  className="h-14 rounded-[14px] w-full px-4 border"
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

                {currencySelect(
                  trSenderCurrency,
                  setTrSenderCurrency
                )}

                <input
                  type="number"
                  min="0"
                  step="any"
                  value={trSenderAmount}
                  onChange={(e) =>
                    setTrSenderAmount(
                      e.target.value
                    )
                  }
                  placeholder="مبلغ فرستنده"
                  className="h-14 rounded-[14px] w-full px-4 border"
                />
              </div>
            </div>

            <div className="bg-green-50/50 rounded-xl p-5">
              <h3 className="font-bold text-green-700 mb-4">
                گیرنده
              </h3>

              <div className="space-y-4">
                <select
                  value={trReceiver}
                  onChange={(e) =>
                    setTrReceiver(e.target.value)
                  }
                  className="h-14 rounded-[14px] w-full px-4 border"
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

                {currencySelect(
                  trReceiverCurrency,
                  setTrReceiverCurrency
                )}

                <input
                  readOnly
                  value={trReceiverAmount}
                  placeholder="مبلغ گیرنده (محاسبه شده)"
                  className="h-14 rounded-[14px] w-full px-4 border bg-gray-100"
                />
              </div>
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-100 rounded-xl p-5 mb-6">
            <label className="block font-bold mb-2">
              نرخ تبدیل دستی
            </label>

            <input
              type="number"
              min="0"
              step="any"
              value={trRate}
              onChange={(e) =>
                setTrRate(e.target.value)
              }
              className="h-14 rounded-[14px] w-full px-4 border bg-white"
            />

            <p className="mt-3 text-sm text-purple-700">
              {getRateDescription(
                trSenderCurrency,
                trReceiverCurrency,
                trRate
              )}
            </p>

            <p className="mt-2 text-xs text-gray-500">
              نرخ روز را دستی وارد کنید؛ سیستم مبلغ گیرنده
              را خودکار محاسبه می‌کند.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
            <div>
              <label className="block font-bold mb-2">
                کمیشن
              </label>

              <input
                type="number"
                min="0"
                step="any"
                value={trCommission}
                onChange={(e) =>
                  setTrCommission(e.target.value)
                }
                className="h-14 rounded-[14px] w-full px-4 border"
              />
            </div>

            <div>
              <label className="block font-bold mb-2">
                ارز کمیشن
              </label>

              {currencySelect(
                trCommissionCurrency,
                setTrCommissionCurrency
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
            <input
              value={terms}
              onChange={(e) =>
                setTerms(e.target.value)
              }
              placeholder="شرایط معامله"
              className="h-14 rounded-[14px] w-full px-4 border"
            />

            <input
              value={note}
              onChange={(e) =>
                setNote(e.target.value)
              }
              placeholder="یادداشت"
              className="h-14 rounded-[14px] w-full px-4 border"
            />
          </div>

          <button
            onClick={submitTransfer}
            className="w-full h-14 rounded-2xl bg-[#092F3A] text-white font-medium"
          >
            ثبت معامله
          </button>
        </div>
      )}

      {/* =====================================================
          موجودی مشتریان
      ===================================================== */}

      <div className="bg-white rounded-xl shadow p-5 overflow-x-auto">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">
          موجودی فعلی مشتریان
        </h2>

        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-right">
                مشتری
              </th>

              {currencies.map((currency) => (
                <th
                  key={currency}
                  className="p-2 text-right"
                >
                  {currencyLabels[currency]}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y">
            {customers.map((customer) => {
              const balance =
                liveBalances[customer.id] ||
                customer.balances;

              return (
                <tr key={customer.id}>
                  <td className="p-2 font-medium">
                    {customer.name}
                  </td>

                  {currencies.map((currency) => (
                    <td
                      key={currency}
                      className="p-2"
                    >
                      {formatNumber(
                        balance[currency] || 0
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* =====================================================
          آخرین معاملات
      ===================================================== */}

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <h2 className="text-lg font-semibold text-gray-700 p-5 pb-2">
          آخرین معاملات
        </h2>

        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-right">
                سند
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
                نرخ
              </th>

              <th className="p-3 text-right">
                مفاد/کمیشن
              </th>

              <th className="p-3 text-right">
                عملیات
              </th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {transactions.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="text-center py-8 text-gray-400"
                >
                  هیچ معامله‌ای ثبت نشده است
                </td>
              </tr>
            ) : (
              transactions.map((tx) => {
                const voided =
                  tx.status === "voided";

                return (
                  <tr
                    key={tx.id}
                    className={
                      voided
                        ? "opacity-50 line-through"
                        : ""
                    }
                  >
                    <td className="p-3 font-mono text-xs">
                      {tx.id}
                    </td>

                    <td className="p-3 text-xs">
                      {new Date(
                        tx.date
                      ).toLocaleString("fa-IR")}
                    </td>

                    <td className="p-3">
                      {tx.type}
                    </td>

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

                    <td className="p-3 text-xs">
                      {rateText(tx)}
                    </td>

                    <td className="p-3">
                      {tx.type ===
                      "صرافی-مشتری"
                        ? `${formatNumber(
                            tx.profit
                          )} ${
                            currencyLabels[
                              tx.profitCurrency
                            ]
                          }`
                        : `${formatNumber(
                            tx.commission
                          )} ${
                            currencyLabels[
                              tx.commissionCurrency
                            ]
                          }`}
                    </td>

                    <td className="p-3 relative">
                      <button
                        onClick={() =>
                          setOpenMenu(
                            openMenu === tx.id
                              ? null
                              : tx.id
                          )
                        }
                        className="px-3 py-2 rounded-lg bg-gray-100"
                      >
                        عملیات ▾
                      </button>

                      {openMenu === tx.id && (
                        <div className="absolute z-20 left-2 top-12 w-32 rounded-lg border bg-white shadow-lg p-1">
                          <button
                            onClick={() => {
                              setViewTx(tx);
                              setOpenMenu(null);
                            }}
                            className="block w-full text-right px-3 py-2 hover:bg-gray-50"
                          >
                            مشاهده
                          </button>

                          {!voided && (
                            <button
                              onClick={() => {
                                setEditingTx({
                                  ...tx,
                                });
                                setOpenMenu(null);
                              }}
                              className="block w-full text-right px-3 py-2 hover:bg-gray-50"
                            >
                              ویرایش
                            </button>
                          )}

                          <button
                            onClick={() =>
                              printReceipt(tx)
                            }
                            className="block w-full text-right px-3 py-2 hover:bg-gray-50"
                          >
                            چاپ
                          </button>

                          {!voided && (
                            <button
                              onClick={() =>
                                voidTransaction(
                                  tx.id
                                )
                              }
                              className="block w-full text-right px-3 py-2 text-red-600 hover:bg-red-50"
                            >
                              ابطال
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* =====================================================
          مشاهده معامله
      ===================================================== */}

      {viewTx && (
        <div
          className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
          onClick={() => setViewTx(null)}
        >
          <div
            className="bg-white rounded-xl p-6 max-w-md w-full"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <h2 className="text-lg font-bold mb-4">
              جزئیات معامله
            </h2>

            <div className="space-y-2 text-sm">
              <p>
                شماره: {viewTx.id}
              </p>

              <p>
                تاریخ:{" "}
                {new Date(
                  viewTx.date
                ).toLocaleString("fa-IR")}
              </p>

              <p>
                نوع: {viewTx.type}
              </p>

              {viewTx.type ===
              "صرافی-مشتری" ? (
                <>
                  <p>
                    مشتری:{" "}
                    {customerName(
                      viewTx.customerId
                    )}
                  </p>

                  <p>
                    دریافت:{" "}
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
                    پرداخت:{" "}
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
                    نرخ:{" "}
                    {rateText(viewTx)}
                  </p>

                  <p>
                    مفاد:{" "}
                    {formatNumber(
                      viewTx.profit
                    )}{" "}
                    {
                      currencyLabels[
                        viewTx.profitCurrency
                      ]
                    }
                  </p>
                </>
              ) : (
                <>
                  <p>
                    فرستنده:{" "}
                    {customerName(
                      viewTx.senderId
                    )}
                  </p>

                  <p>
                    گیرنده:{" "}
                    {customerName(
                      viewTx.receiverId
                    )}
                  </p>

                  <p>
                    ارسال:{" "}
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
                    دریافت:{" "}
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
                    نرخ:{" "}
                    {rateText(viewTx)}
                  </p>

                  <p>
                    کمیشن:{" "}
                    {formatNumber(
                      viewTx.commission
                    )}{" "}
                    {
                      currencyLabels[
                        viewTx.commissionCurrency
                      ]
                    }
                  </p>
                </>
              )}

              <p>
                یادداشت: {viewTx.note || "-"}
              </p>

              <p>
                وضعیت:{" "}
                {viewTx.status === "voided"
                  ? "ابطال شده"
                  : "فعال"}
              </p>
            </div>

            <button
              onClick={() =>
                setViewTx(null)
              }
              className="mt-5 px-4 py-2 bg-gray-200 rounded-lg"
            >
              بستن
            </button>
          </div>
        </div>
      )}

      {/* =====================================================
          ویرایش معامله
      ===================================================== */}

      {editingTx && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full">
            <h2 className="text-lg font-bold mb-4">
              ویرایش معامله
            </h2>

            {editingTx.type ===
            "صرافی-مشتری" ? (
              <div className="grid grid-cols-2 gap-3">
                <label>
                  مبلغ دریافتی

                  <input
                    className="w-full border rounded p-2"
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
                  />
                </label>

                <label>
                  مبلغ پرداختی

                  <input
                    className="w-full border rounded p-2"
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
                  />
                </label>

                <label>
                  نرخ تبدیل

                  <input
                    className="w-full border rounded p-2"
                    type="number"
                    step="any"
                    value={editingTx.rate}
                    onChange={(e) =>
                      setEditingTx({
                        ...editingTx,
                        rate:
                          Number(
                            e.target.value
                          ),
                      })
                    }
                  />
                </label>

                <label>
                  مفاد

                  <input
                    className="w-full border rounded p-2"
                    type="number"
                    step="any"
                    value={editingTx.profit}
                    onChange={(e) =>
                      setEditingTx({
                        ...editingTx,
                        profit:
                          Number(
                            e.target.value
                          ),
                      })
                    }
                  />
                </label>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <label>
                  مبلغ فرستنده

                  <input
                    className="w-full border rounded p-2"
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
                  />
                </label>

                <label>
                  مبلغ گیرنده

                  <input
                    className="w-full border rounded p-2"
                    type="number"
                    value={
                      editingTx.receiverAmount
                    }
                    onChange={(e) =>
                      setEditingTx({
                        ...editingTx,
                        receiverAmount:
                          Number(
                            e.target.value
                          ),
                      })
                    }
                  />
                </label>

                <label>
                  نرخ تبدیل

                  <input
                    className="w-full border rounded p-2"
                    type="number"
                    step="any"
                    value={editingTx.rate}
                    onChange={(e) =>
                      setEditingTx({
                        ...editingTx,
                        rate:
                          Number(
                            e.target.value
                          ),
                      })
                    }
                  />
                </label>

                <label>
                  کمیشن

                  <input
                    className="w-full border rounded p-2"
                    type="number"
                    step="any"
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
                  />
                </label>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() =>
                  setEditingTx(null)
                }
                className="px-4 py-2 bg-gray-200 rounded-lg"
              >
                انصراف
              </button>

              <button
                onClick={saveEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg"
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
