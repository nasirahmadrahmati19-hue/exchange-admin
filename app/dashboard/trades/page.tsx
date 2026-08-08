"use client";

import { useEffect, useMemo, useState } from "react";

/* =========================================================
   Types
========================================================= */

type ExchangeType = "صرافی-مشتری" | "بین-مشتریان";

type Currency = "AFN" | "USD" | "IRR" | "PKR";

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

  receivedCurrency: Currency;
  receivedAmount: number;

  paidCurrency: Currency;
  paidAmount: number;

  /*
    نرخ ذخیره‌شده همان نرخ دستی کاربر است.

    مثال:
    AFN/USD
    1 USD = 50 AFN
    rate = 50

    اگر معامله برعکس شود:
    USD/AFN
    همچنان:
    1 USD = 50 AFN
    rate = 50
  */
  rate: number;

  profit: number;
  profitCurrency: Currency;
};

type TransferTransaction = BaseTransaction & {
  type: "بین-مشتریان";

  senderId: string;
  receiverId: string;

  senderCurrency: Currency;
  senderAmount: number;

  receiverCurrency: Currency;
  receiverAmount: number;

  rate: number;

  commission: number;
  commissionCurrency: Currency;
};

type Transaction = ExchangeTransaction | TransferTransaction;

type Customer = {
  id: string;
  name: string;
  balances: Record<Currency, number>;
};

/* =========================================================
   Currency Configuration
========================================================= */

const currencies: Currency[] = ["AFN", "USD", "IRR", "PKR"];

const currencyLabels: Record<Currency, string> = {
  AFN: "افغانی",
  USD: "دالر",
  IRR: "تومان",
  PKR: "کلدار",
};

/*
  ترتیب استاندارد داخلی جفت ارزها.

  این ترتیب فقط برای اینکه نرخ معکوس
  بدون تبدیل 0.02 ذخیره و نمایش شود استفاده می‌شود.

  USD همیشه مرجع بالاتر از AFN قرار دارد.
  بنابراین:

  USD / AFN
  => 1 USD = X AFN

  USD / IRR
  => 1 USD = X IRR

  AFN / IRR
  => 1 AFN = X IRR

  کاربر این ترتیب داخلی را نمی‌بیند.
*/
const currencyPriority: Record<Currency, number> = {
  USD: 1,
  AFN: 2,
  IRR: 3,
  PKR: 4,
};

/* =========================================================
   Initial Customers
========================================================= */

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

/* =========================================================
   Number Helpers
========================================================= */

const formatNumber = (n: number) =>
  Number.isFinite(n)
    ? n.toLocaleString("en-US", {
        maximumFractionDigits: 8,
      })
    : "0";

const parseNumber = (value: string | number) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const roundAmount = (value: number, decimals = 8) => {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

/* =========================================================
   Document ID
========================================================= */

const generateDocId = () => {
  const d = new Date();

  return `EX-${d.getFullYear()}${String(
    d.getMonth() + 1
  ).padStart(2, "0")}${String(d.getDate()).padStart(
    2,
    "0"
  )}-${String(Math.floor(Math.random() * 10000)).padStart(
    4,
    "0"
  )}`;
};

/* =========================================================
   Rate Logic
========================================================= */

/*
  تعیین جهت استاندارد جفت ارز.

  مثال:

  AFN + USD
  => USD → AFN
  => 1 USD = X AFN

  USD + AFN
  => همان جفت
  => 1 USD = X AFN

  AFN + IRR
  => AFN → IRR
  => 1 AFN = X IRR

  بنابراین نرخ معکوس هرگز به 0.02 تبدیل نمی‌شود.
*/
function getStandardPair(
  currencyA: Currency,
  currencyB: Currency
): [Currency, Currency] {
  if (currencyPriority[currencyA] < currencyPriority[currencyB]) {
    return [currencyA, currencyB];
  }

  return [currencyB, currencyA];
}

/*
  متن استاندارد نرخ.

  مثال:
  rate = 50
  pair = USD / AFN

  خروجی:
  1 دالر = 50 افغانی
*/
function getRateDisplay(
  currencyA: Currency,
  currencyB: Currency,
  rate: number
) {
  if (currencyA === currencyB) {
    return `1 ${currencyLabels[currencyA]} = 1 ${currencyLabels[currencyA]}`;
  }

  const [standardFrom, standardTo] = getStandardPair(
    currencyA,
    currencyB
  );

  return `1 ${currencyLabels[standardFrom]} = ${formatNumber(
    rate
  )} ${currencyLabels[standardTo]}`;
}

/*
  تبدیل ارز اصلی سیستم.

  نرخ همیشه بر اساس جفت استاندارد است.

  مثال:

  1 USD = 50 AFN

  AFN → USD:
  50000 / 50 = 1000

  USD → AFN:
  1000 * 50 = 50000
*/
function convertCurrency(
  amount: number,
  from: Currency,
  to: Currency,
  rate: number
): number {
  if (from === to) {
    return amount;
  }

  if (
    !Number.isFinite(amount) ||
    amount < 0 ||
    !Number.isFinite(rate) ||
    rate <= 0
  ) {
    return 0;
  }

  const [standardFrom, standardTo] = getStandardPair(
    from,
    to
  );

  /*
    اگر جهت معامله همان جهت استاندارد باشد:

    مثال:
    USD → AFN
    rate = 50

    1000 USD × 50 = 50000 AFN
  */
  if (from === standardFrom && to === standardTo) {
    return roundAmount(amount * rate);
  }

  /*
    اگر جهت معامله برعکس باشد:

    مثال:
    AFN → USD
    rate = 50

    50000 AFN ÷ 50 = 1000 USD
  */
  return roundAmount(amount / rate);
}

/* =========================================================
   Balance Calculation
========================================================= */

function computeBalances(
  customers: Customer[],
  transactions: Transaction[]
) {
  const balances: Record<
    string,
    Record<Currency, number>
  > = {};

  customers.forEach((customer) => {
    balances[customer.id] = {
      AFN: customer.balances.AFN || 0,
      USD: customer.balances.USD || 0,
      IRR: customer.balances.IRR || 0,
      PKR: customer.balances.PKR || 0,
    };
  });

  transactions.forEach((tx) => {
    if (tx.status === "voided") return;

    if (tx.type === "صرافی-مشتری") {
      const customer = balances[tx.customerId];

      if (!customer) return;

      /*
        مشتری ارز دریافتی را به صرافی می‌دهد.
        بنابراین از حساب مشتری کم می‌شود.
      */
      customer[tx.receivedCurrency] =
        (customer[tx.receivedCurrency] || 0) -
        tx.receivedAmount;

      /*
        صرافی ارز پرداختی را به مشتری می‌دهد.
        بنابراین به حساب مشتری اضافه می‌شود.
      */
      customer[tx.paidCurrency] =
        (customer[tx.paidCurrency] || 0) +
        tx.paidAmount;
    }

    if (tx.type === "بین-مشتریان") {
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
    }
  });

  return balances;
}

/* =========================================================
   Main Component
========================================================= */

export default function CurrencyExchangePage() {
  const [customers] =
    useState<Customer[]>(initialCustomers);

  const [transactions, setTransactions] =
    useState<Transaction[]>([]);

  const [activeTab, setActiveTab] =
    useState<ExchangeType>("صرافی-مشتری");

  const [docId, setDocId] =
    useState(generateDocId());

  const [note, setNote] = useState("");
  const [terms, setTerms] = useState("نقدی");

  /* =====================================================
     Exchange Form
  ===================================================== */

  const [exCustomer, setExCustomer] =
    useState("");

  const [exReceivedCurrency, setExReceivedCurrency] =
    useState<Currency>("AFN");

  const [exReceivedAmount, setExReceivedAmount] =
    useState("");

  const [exPaidCurrency, setExPaidCurrency] =
    useState<Currency>("USD");

  const [exPaidAmount, setExPaidAmount] =
    useState("");

  const [exRate, setExRate] =
    useState("");

  const [exProfit, setExProfit] =
    useState("");

  const [exProfitCurrency, setExProfitCurrency] =
    useState<Currency>("AFN");

  /* =====================================================
     Transfer Form
  ===================================================== */

  const [trSender, setTrSender] =
    useState("");

  const [trSenderCurrency, setTrSenderCurrency] =
    useState<Currency>("AFN");

  const [trSenderAmount, setTrSenderAmount] =
    useState("");

  const [trReceiver, setTrReceiver] =
    useState("");

  const [trReceiverCurrency, setTrReceiverCurrency] =
    useState<Currency>("AFN");

  const [trReceiverAmount, setTrReceiverAmount] =
    useState("");

  const [trRate, setTrRate] =
    useState("1");

  const [trCommission, setTrCommission] =
    useState("0");

  const [trCommissionCurrency, setTrCommissionCurrency] =
    useState<Currency>("AFN");

  /* =====================================================
     UI State
  ===================================================== */

  const [viewTx, setViewTx] =
    useState<Transaction | null>(null);

  const [editingTx, setEditingTx] =
    useState<Transaction | null>(null);

  const [openMenu, setOpenMenu] =
    useState<string | null>(null);

  /* =====================================================
     Live Balances
  ===================================================== */

  const liveBalances = useMemo(
    () => computeBalances(customers, transactions),
    [customers, transactions]
  );

  /* =====================================================
     Exchange Calculation
  ===================================================== */

  useEffect(() => {
    const amount = parseNumber(exReceivedAmount);
    const rate = parseNumber(exRate);

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

  /* =====================================================
     Transfer Calculation
  ===================================================== */

  useEffect(() => {
    const amount = parseNumber(trSenderAmount);
    const rate = parseNumber(trRate);

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

  /* =====================================================
     Reset
  ===================================================== */

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

  /* =====================================================
     Customer Balance Validation
  ===================================================== */

  const hasEnoughBalance = (
    customerId: string,
    currency: Currency,
    amount: number,
    extraAmount = 0,
    extraCurrency?: Currency
  ) => {
    const balance =
      liveBalances[customerId]?.[currency] || 0;

    if (balance < amount) {
      return false;
    }

    if (
      extraCurrency &&
      extraCurrency === currency &&
      extraAmount > 0
    ) {
      return balance >= amount + extraAmount;
    }

    return true;
  };

  /* =====================================================
     Submit Exchange
  ===================================================== */

  const submitExchange = () => {
    if (!exCustomer) {
      alert("لطفاً مشتری را انتخاب کنید.");
      return;
    }

    const receivedAmount =
      parseNumber(exReceivedAmount);

    const paidAmount =
      parseNumber(exPaidAmount);

    const rate =
      parseNumber(exRate);

    const profit =
      parseNumber(exProfit);

    if (receivedAmount <= 0) {
      alert("مبلغ دریافتی باید بیشتر از صفر باشد.");
      return;
    }

    if (rate <= 0) {
      alert("نرخ تبدیل باید بیشتر از صفر باشد.");
      return;
    }

    if (paidAmount <= 0) {
      alert("مبلغ پرداختی معتبر نیست.");
      return;
    }

    /*
      بررسی موجودی مشتری.

      مشتری باید بتواند ارز دریافتی را پرداخت کند.
    */
    if (
      !hasEnoughBalance(
        exCustomer,
        exReceivedCurrency,
        receivedAmount
      )
    ) {
      alert(
        `موجودی مشتری در ${currencyLabels[exReceivedCurrency]} کافی نیست.`
      );
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

      profit,
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

  /* =====================================================
     Submit Transfer
  ===================================================== */

  const submitTransfer = () => {
    if (!trSender) {
      alert("لطفاً فرستنده را انتخاب کنید.");
      return;
    }

    if (!trReceiver) {
      alert("لطفاً گیرنده را انتخاب کنید.");
      return;
    }

    if (trSender === trReceiver) {
      alert(
        "فرستنده و گیرنده نمی‌توانند یک مشتری باشند."
      );
      return;
    }

    const senderAmount =
      parseNumber(trSenderAmount);

    const receiverAmount =
      parseNumber(trReceiverAmount);

    const rate =
      parseNumber(trRate);

    const commission =
      parseNumber(trCommission);

    if (senderAmount <= 0) {
      alert("مبلغ فرستنده باید بیشتر از صفر باشد.");
      return;
    }

    if (rate <= 0) {
      alert("نرخ تبدیل باید بیشتر از صفر باشد.");
      return;
    }

    if (receiverAmount <= 0) {
      alert("مبلغ گیرنده معتبر نیست.");
      return;
    }

    /*
      محاسبه مقدار مورد نیاز از ارز فرستنده.

      اگر کمیسیون همان ارز فرستنده باشد،
      هر دو مقدار باید در موجودی موجود باشد.
    */
    const commissionSameCurrency =
      trCommission > 0 &&
      trCommissionCurrency === trSenderCurrency;

    const requiredSenderBalance =
      senderAmount +
      (commissionSameCurrency
        ? commission
        : 0);

    if (
      !hasEnoughBalance(
        trSender,
        trSenderCurrency,
        requiredSenderBalance
      )
    ) {
      alert(
        `موجودی فرستنده در ${currencyLabels[trSenderCurrency]} کافی نیست.`
      );
      return;
    }

    /*
      اگر کمیسیون ارز دیگری باشد،
      موجودی آن نیز باید بررسی شود.
    */
    if (
      commission > 0 &&
      trCommissionCurrency !== trSenderCurrency
    ) {
      if (
        !hasEnoughBalance(
          trSender,
          trCommissionCurrency,
          commission
        )
      ) {
        alert(
          `موجودی فرستنده برای پرداخت کمیسیون در ${currencyLabels[trCommissionCurrency]} کافی نیست.`
        );
        return;
      }
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

  /* =====================================================
     Void Transaction
  ===================================================== */

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

  /* =====================================================
     Edit Transaction
  ===================================================== */

  const saveEdit = () => {
    if (!editingTx) return;

    /*
      برای معامله صرافی مشتری
      مبلغ مقابل از نرخ جدید محاسبه می‌شود.
    */
    if (
      editingTx.type === "صرافی-مشتری"
    ) {
      const calculatedPaid =
        convertCurrency(
          editingTx.receivedAmount,
          editingTx.receivedCurrency,
          editingTx.paidCurrency,
          editingTx.rate
        );

      editingTx = {
        ...editingTx,
        paidAmount: calculatedPaid,
      };
    }

    /*
      برای انتقال بین مشتریان
      مبلغ گیرنده نیز از نرخ جدید محاسبه می‌شود.
    */
    if (
      editingTx.type === "بین-مشتریان"
    ) {
      const calculatedReceiver =
        convertCurrency(
          editingTx.senderAmount,
          editingTx.senderCurrency,
          editingTx.receiverCurrency,
          editingTx.rate
        );

      editingTx = {
        ...editingTx,
        receiverAmount: calculatedReceiver,
      };
    }

    setTransactions((previous) =>
      previous.map((tx) =>
        tx.id === editingTx!.id
          ? editingTx!
          : tx
      )
    );

    setEditingTx(null);
    setOpenMenu(null);
  };

  /* =====================================================
     Customer Name
  ===================================================== */

  const customerName = (id: string) =>
    customers.find(
      (customer) => customer.id === id
    )?.name || id;

  /* =====================================================
     Rate Text
  ===================================================== */

  const rateText = (tx: Transaction) => {
    if (tx.type === "صرافی-مشتری") {
      return getRateDisplay(
        tx.receivedCurrency,
        tx.paidCurrency,
        tx.rate
      );
    }

    return getRateDisplay(
      tx.senderCurrency,
      tx.receiverCurrency,
      tx.rate
    );
  };

  /* =====================================================
     Print Receipt
  ===================================================== */

  const printReceipt = (tx: Transaction) => {
    const w = window.open("", "_blank");

    if (!w) {
      alert("امکان باز کردن صفحه چاپ وجود ندارد.");
      return;
    }

    const customer = (id: string) =>
      customers.find(
        (c) => c.id === id
      )?.name || id;

    const content =
      tx.type === "صرافی-مشتری"
        ? `
          <div dir="rtl" style="font-family:Tahoma;padding:25px;line-height:2">
            <h2>رسید معامله صرافی</h2>

            <hr/>

            <p><strong>شماره رسید:</strong> ${tx.id}</p>
            <p><strong>تاریخ:</strong> ${new Date(
              tx.date
            ).toLocaleString("fa-IR")}</p>

            <p><strong>نوع معامله:</strong> ${
              tx.type
            }</p>

            <p><strong>مشتری:</strong> ${customer(
              tx.customerId
            )}</p>

            <hr/>

            <p>
              <strong>دریافت از مشتری:</strong>
              ${formatNumber(tx.receivedAmount)}
              ${currencyLabels[tx.receivedCurrency]}
            </p>

            <p>
              <strong>پرداخت به مشتری:</strong>
              ${formatNumber(tx.paidAmount)}
              ${currencyLabels[tx.paidCurrency]}
            </p>

            <p>
              <strong>نرخ:</strong>
              ${rateText(tx)}
            </p>

            <p>
              <strong>مفاد:</strong>
              ${formatNumber(tx.profit)}
              ${currencyLabels[tx.profitCurrency]}
            </p>

            <p>
              <strong>شرایط:</strong>
              ${tx.terms || "-"}
            </p>

            <p>
              <strong>یادداشت:</strong>
              ${tx.note || "-"}
            </p>

            <hr/>

            <p>وضعیت: ${
              tx.status === "voided"
                ? "ابطال شده"
                : "فعال"
            }</p>
          </div>
        `
        : `
          <div dir="rtl" style="font-family:Tahoma;padding:25px;line-height:2">
            <h2>رسید انتقال بین مشتریان</h2>

            <hr/>

            <p><strong>شماره رسید:</strong> ${tx.id}</p>
            <p><strong>تاریخ:</strong> ${new Date(
              tx.date
            ).toLocaleString("fa-IR")}</p>

            <p><strong>فرستنده:</strong> ${customer(
              tx.senderId
            )}</p>

            <p><strong>گیرنده:</strong> ${customer(
              tx.receiverId
            )}</p>

            <hr/>

            <p>
              <strong>ارسال:</strong>
              ${formatNumber(tx.senderAmount)}
              ${currencyLabels[tx.senderCurrency]}
            </p>

            <p>
              <strong>دریافت:</strong>
              ${formatNumber(tx.receiverAmount)}
              ${currencyLabels[tx.receiverCurrency]}
            </p>

            <p>
              <strong>نرخ:</strong>
              ${rateText(tx)}
            </p>

            <p>
              <strong>کمیشن:</strong>
              ${formatNumber(tx.commission)}
              ${currencyLabels[tx.commissionCurrency]}
            </p>

            <p>
              <strong>شرایط:</strong>
              ${tx.terms || "-"}
            </p>

            <p>
              <strong>یادداشت:</strong>
              ${tx.note || "-"}
            </p>

            <hr/>

            <p>وضعیت: ${
              tx.status === "voided"
                ? "ابطال شده"
                : "فعال"
            }</p>
          </div>
        `;

    w.document.write(content);
    w.document.close();
    w.print();

    setOpenMenu(null);
  };

  /* =====================================================
     Currency Select
  ===================================================== */

  const currencySelect = (
    value: Currency,
    onChange: (value: Currency) => void
  ) => (
    <select
      value={value}
      onChange={(e) =>
        onChange(e.target.value as Currency)
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

  /* =====================================================
     Current Rate Explanation
  ===================================================== */

  const exchangeRatePreview =
    exReceivedCurrency !== exPaidCurrency &&
    parseNumber(exRate) > 0
      ? getRateDisplay(
          exReceivedCurrency,
          exPaidCurrency,
          parseNumber(exRate)
        )
      : "";

  const transferRatePreview =
    trSenderCurrency !== trReceiverCurrency &&
    parseNumber(trRate) > 0
      ? getRateDisplay(
          trSenderCurrency,
          trReceiverCurrency,
          parseNumber(trRate)
        )
      : "";

  /* =====================================================
     Render
  ===================================================== */

  return (
    <div
      dir="rtl"
      className="space-y-6 p-4 md:p-6 bg-gray-50 min-h-screen"
    >
      {/* =================================================
          Header
      ================================================= */}

      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          معاملات ارزی
        </h1>

        <p className="text-sm text-gray-500 mt-1">
          ثبت و مدیریت معاملات ارز و انتقال بین مشتریان
        </p>
      </div>

      {/* =================================================
          Tabs
      ================================================= */}

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

      {/* =================================================
          Exchange Tab
      ================================================= */}

      {activeTab === "صرافی-مشتری" ? (
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-6">
            تبادل ارز
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Received */}
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

                  {customers.map(
                    (customer, index) => (
                      <option
                        key={customer.id}
                        value={customer.id}
                      >
                        {index + 1}.{" "}
                        {customer.name}
                      </option>
                    )
                  )}
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

            {/* Paid */}
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
                  placeholder="مبلغ پرداختی محاسبه می‌شود"
                  className="h-14 rounded-[14px] w-full px-4 border bg-gray-100"
                />
              </div>
            </div>
          </div>

          {/* Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
            <div>
              <label className="block font-bold mb-2">
                نرخ تبدیل
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
                className="h-14 rounded-[14px] w-full px-4 border"
              />

              {exchangeRatePreview && (
                <div className="mt-2 text-sm font-medium text-cyan-700 bg-cyan-50 rounded-lg p-3">
                  {exchangeRatePreview}
                </div>
              )}
            </div>

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
                placeholder="مفاد معامله"
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

          {/* Terms */}
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
        /* =================================================
           Transfer Tab
        ================================================= */
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-6">
            تبادل بین حساب مشتریان
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Sender */}
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

                  {customers.map(
                    (customer, index) => (
                      <option
                        key={customer.id}
                        value={customer.id}
                      >
                        {index + 1}.{" "}
                        {customer.name}
                      </option>
                    )
                  )}
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

            {/* Receiver */}
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

                  {customers.map(
                    (customer, index) => (
                      <option
                        key={customer.id}
                        value={customer.id}
                      >
                        {index + 1}.{" "}
                        {customer.name}
                      </option>
                    )
                  )}
                </select>

                {currencySelect(
                  trReceiverCurrency,
                  setTrReceiverCurrency
                )}

                <input
                  readOnly
                  value={trReceiverAmount}
                  placeholder="مبلغ گیرنده محاسبه می‌شود"
                  className="h-14 rounded-[14px] w-full px-4 border bg-gray-100"
                />
              </div>
            </div>
          </div>

          {/* Transfer Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
            <div>
              <label className="block font-bold mb-2">
                نرخ تبدیل
              </label>

              <input
                type="number"
                min="0"
                step="any"
                value={trRate}
                onChange={(e) =>
                  setTrRate(e.target.value)
                }
                className="h-14 rounded-[14px] w-full px-4 border"
              />

              {transferRatePreview && (
                <div className="mt-2 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg p-3">
                  {transferRatePreview}
                </div>
              )}
            </div>

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
                  setTrCommission(
                    e.target.value
                  )
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
            ثبت انتقال
          </button>
        </div>
      )}

      {/* =================================================
          Customer Balances
      ================================================= */}

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

                  {currencies.map(
                    (currency) => (
                      <td
                        key={currency}
                        className="p-2"
                      >
                        {formatNumber(
                          balance[currency] || 0
                        )}
                      </td>
                    )
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* =================================================
          Transactions
      ================================================= */}

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

      {/* =================================================
          View Transaction Modal
      ================================================= */}

      {viewTx && (
        <div
          className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
          onClick={() =>
            setViewTx(null)
          }
        >
          <div
            className="bg-white rounded-xl p-6 max-w-md w-full"
            onClick={(event) =>
              event.stopPropagation()
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
                    نرخ: {rateText(viewTx)}
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
                    نرخ: {rateText(viewTx)}
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
                یادداشت:{" "}
                {viewTx.note || "-"}
              </p>

              <p>
                شرایط:{" "}
                {viewTx.terms || "-"}
              </p>

              <p>
                وضعیت:{" "}
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
              className="mt-5 px-4 py-2 bg-gray-200 rounded-lg"
            >
              بستن
            </button>
          </div>
        </div>
      )}

      {/* =================================================
          Edit Modal
      ================================================= */}

      {editingTx && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-5">
              ویرایش معامله
            </h2>

            {editingTx.type ===
            "صرافی-مشتری" ? (
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  ارز دریافتی

                  <select
                    className="w-full border rounded p-2 mt-1"
                    value={
                      editingTx.receivedCurrency
                    }
                    onChange={(e) =>
                      setEditingTx({
                        ...editingTx,
                        receivedCurrency:
                          e.target
                            .value as Currency,
                      })
                    }
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
                </label>

                <label className="text-sm">
                  مبلغ دریافتی

                  <input
                    className="w-full border rounded p-2 mt-1"
                    type="number"
                    min="0"
                    step="any"
                    value={
                      editingTx.receivedAmount
                    }
                    onChange={(e) =>
                      setEditingTx({
                        ...editingTx,
                        receivedAmount:
                          parseNumber(
                            e.target.value
                          ),
                      })
                    }
                  />
                </label>

                <label className="text-sm">
                  ارز پرداختی

                  <select
                    className="w-full border rounded p-2 mt-1"
                    value={
                      editingTx.paidCurrency
                    }
                    onChange={(e) =>
                      setEditingTx({
                        ...editingTx,
                        paidCurrency:
                          e.target
                            .value as Currency,
                      })
                    }
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
                </label>

                <label className="text-sm">
                  نرخ تبدیل

                  <input
                    className="w-full border rounded p-2 mt-1"
                    type="number"
                    min="0"
                    step="any"
                    value={
                      editingTx.rate
                    }
                    onChange={(e) =>
                      setEditingTx({
                        ...editingTx,
                        rate: parseNumber(
                          e.target.value
                        ),
                      })
                    }
                  />
                </label>

                <div className="col-span-2 rounded-lg bg-gray-50 p-3 text-sm">
                  مبلغ پرداختی پس از ذخیره
                  بر اساس نرخ جدید محاسبه
                  خواهد شد.
                </div>

                <label className="text-sm">
                  مفاد

                  <input
                    className="w-full border rounded p-2 mt-1"
                    type="number"
                    min="0"
                    step="any"
                    value={
                      editingTx.profit
                    }
                    onChange={(e) =>
                      setEditingTx({
                        ...editingTx,
                        profit:
                          parseNumber(
                            e.target.value
                          ),
                      })
                    }
                  />
                </label>

                <label className="text-sm">
                  ارز مفاد

                  <select
                    className="w-full border rounded p-2 mt-1"
                    value={
                      editingTx.profitCurrency
                    }
                    onChange={(e) =>
                      setEditingTx({
                        ...editingTx,
                        profitCurrency:
                          e.target
                            .value as Currency,
                      })
                    }
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
                </label>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  ارز فرستنده

                  <select
                    className="w-full border rounded p-2 mt-1"
                    value={
                      editingTx.senderCurrency
                    }
                    onChange={(e) =>
                      setEditingTx({
                        ...editingTx,
                        senderCurrency:
                          e.target
                            .value as Currency,
                      })
                    }
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
                </label>

                <label className="text-sm">
                  مبلغ فرستنده

                  <input
                    className="w-full border rounded p-2 mt-1"
                    type="number"
                    min="0"
                    step="any"
                    value={
                      editingTx.senderAmount
                    }
                    onChange={(e) =>
                      setEditingTx({
                        ...editingTx,
                        senderAmount:
                          parseNumber(
                            e.target.value
                          ),
                      })
                    }
                  />
                </label>

                <label className="text-sm">
                  ارز گیرنده

                  <select
                    className="w-full border rounded p-2 mt-1"
                    value={
                      editingTx.receiverCurrency
                    }
                    onChange={(e) =>
                      setEditingTx({
                        ...editingTx,
                        receiverCurrency:
                          e.target
                            .value as Currency,
                      })
                    }
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
                </label>

                <label className="text-sm">
                  نرخ تبدیل

                  <input
                    className="w-full border rounded p-2 mt-1"
                    type="number"
                    min="0"
                    step="any"
                    value={
                      editingTx.rate
                    }
                    onChange={(e) =>
                      setEditingTx({
                        ...editingTx,
                        rate: parseNumber(
                          e.target.value
                        ),
                      })
                    }
                  />
                </label>

                <div className="col-span-2 rounded-lg bg-gray-50 p-3 text-sm">
                  مبلغ گیرنده پس از ذخیره
                  بر اساس نرخ جدید محاسبه
                  خواهد شد.
                </div>

                <label className="text-sm">
                  کمیشن

                  <input
                    className="w-full border rounded p-2 mt-1"
                    type="number"
                    min="0"
                    step="any"
                    value={
                      editingTx.commission
                    }
                    onChange={(e) =>
                      setEditingTx({
                        ...editingTx,
                        commission:
                          parseNumber(
                            e.target.value
                          ),
                      })
                    }
                  />
                </label>

                <label className="text-sm">
                  ارز کمیشن

                  <select
                    className="w-full border rounded p-2 mt-1"
                    value={
                      editingTx.commissionCurrency
                    }
                    onChange={(e) =>
                      setEditingTx({
                        ...editingTx,
                        commissionCurrency:
                          e.target
                            .value as Currency,
                      })
                    }
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
                </label>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
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
                ذخیره تغییرات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
