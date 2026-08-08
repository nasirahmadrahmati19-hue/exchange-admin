```tsx
"use client";

import { useState, useMemo, useEffect } from "react";

// ============================================================
// Types
// ============================================================

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
  rateType: "buy" | "sell";
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

type Transaction =
  | ExchangeTransaction
  | TransferTransaction;

interface Customer {
  id: string;
  name: string;
  balances: Record<string, number>;
}

// ============================================================
// واحد پایه داخلی
// ============================================================
//
// AFN = 1 افغانی
// USD = 1 دالر
// EUR = 1 یورو
// IRR = 1000 تومان
// PKR = 1000 کلدار
//
// مهم:
// واحد 1000 فقط برای تومان و کلدار در موتور محاسبه داخلی
// استفاده می‌شود و در منطق نمایش نرخ به کاربر به صورت
// «1000 تومان» و «1000 کلدار» نمایش داده می‌شود.
// ============================================================

const baseUnits: Record<string, number> = {
  AFN: 1,
  USD: 1,
  EUR: 1,
  IRR: 1000,
  PKR: 1000,
};

const currencies = [
  "AFN",
  "USD",
  "EUR",
  "IRR",
  "PKR",
];

const currencyLabels: Record<string, string> = {
  AFN: "افغانی",
  USD: "دالر",
  EUR: "یورو",
  IRR: "تومان",
  PKR: "کلدار",
};

// ============================================================
// ترتیب ارزها
// ============================================================

const currencyOrder = [
  "AFN",
  "USD",
  "EUR",
  "IRR",
  "PKR",
];

// ============================================================
// قالب عدد
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
// تعیین جفت ارز
// ============================================================

function getCanonicalPair(
  currencyA: string,
  currencyB: string
): [string, string] {
  const indexA =
    currencyOrder.indexOf(currencyA);

  const indexB =
    currencyOrder.indexOf(currencyB);

  if (indexA <= indexB) {
    return [currencyA, currencyB];
  }

  return [currencyB, currencyA];
}

// ============================================================
// موتور اصلی تبدیل ارز
// ============================================================
//
// نرخ همیشه بر اساس جفت استاندارد ذخیره می‌شود.
//
// مثال:
//
// دالر:
// 1 USD = 65.90 AFN
//
// USD -> AFN
// 1000 * 65.90 = 65900 AFN
//
// AFN -> USD
// 65900 / 65.90 = 1000 USD
//
// تومان:
// 1000 IRR = 0.350 AFN
//
// IRR -> AFN
// 40,000,000 / 1000 * 0.350
//
// AFN -> IRR
// AFN / 0.350 * 1000
//
// کلدار:
// 1000 PKR = 229 AFN
// ============================================================

function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rate: number
): number {
  if (!Number.isFinite(amount)) return 0;

  if (
    !Number.isFinite(rate) ||
    rate <= 0
  ) {
    return 0;
  }

  if (fromCurrency === toCurrency) {
    return amount;
  }

  const [currency1, currency2] =
    getCanonicalPair(
      fromCurrency,
      toCurrency
    );

  const base1 =
    baseUnits[currency1] || 1;

  const base2 =
    baseUnits[currency2] || 1;

  // ----------------------------------------------------------
  // currency1 -> currency2
  // ----------------------------------------------------------

  if (
    fromCurrency === currency1 &&
    toCurrency === currency2
  ) {
    return (
      (amount / base1) *
      (rate * base2)
    );
  }

  // ----------------------------------------------------------
  // currency2 -> currency1
  // ----------------------------------------------------------

  if (
    fromCurrency === currency2 &&
    toCurrency === currency1
  ) {
    return (
      (amount / base2) *
      (base1 / rate)
    );
  }

  return 0;
}

// ============================================================
// نرخ نمایش
// ============================================================

function formatRateQuote(
  currencyA: string,
  currencyB: string,
  rate: number
): string {
  if (currencyA === currencyB) {
    return `1 ${currencyLabels[currencyA]} = 1 ${currencyLabels[currencyB]}`;
  }

  const [currency1, currency2] =
    getCanonicalPair(
      currencyA,
      currencyB
    );

  const base2 =
    baseUnits[currency2] || 1;

  return `${base2.toLocaleString()} ${
    currencyLabels[currency2]
  } = ${formatNumber(rate)} ${
    currencyLabels[currency1]
  }`;
}

// ============================================================
// نرخ‌های رایج صرافی
// ============================================================
//
// اینجا همان فیلدهای خرید و فروش قرار می‌گیرند.
//
// AFN -> USD
// 1 USD = 65.90 AFN خرید
// 1 USD = 65.95 AFN فروش
//
// AFN -> EUR
// 1 EUR = 74.90 AFN خرید
// 1 EUR = 75.00 AFN فروش
//
// AFN -> PKR
// 1000 PKR = 229 AFN خرید
// 1000 PKR = 229.50 AFN فروش
//
// AFN -> IRR
// 1000 تومان = 0.350 AFN خرید
// 1000 تومان = 0.360 AFN فروش
// ============================================================

interface MarketRate {
  buy: number;
  sell: number;
}

const defaultRates: Record<
  string,
  MarketRate
> = {
  USD_AFN: {
    buy: 65.9,
    sell: 65.95,
  },

  EUR_AFN: {
    buy: 74.9,
    sell: 75.0,
  },

  PKR_AFN: {
    buy: 229.0,
    sell: 229.5,
  },

  IRR_AFN: {
    buy: 0.35,
    sell: 0.36,
  },
};

// ============================================================
// پیدا کردن نرخ جفت ارز
// ============================================================

function getMarketRate(
  currencyA: string,
  currencyB: string,
  rateType: "buy" | "sell"
): number {
  if (currencyA === currencyB) {
    return 1;
  }

  // ----------------------------------------------------------
  // حالت ارز خارجی -> AFN
  // ----------------------------------------------------------

  if (currencyB === "AFN") {
    const key = `${currencyA}_AFN`;

    const market =
      defaultRates[key];

    if (market) {
      return market[rateType];
    }
  }

  // ----------------------------------------------------------
  // حالت AFN -> ارز خارجی
  // ----------------------------------------------------------

  if (currencyA === "AFN") {
    const key = `${currencyB}_AFN`;

    const market =
      defaultRates[key];

    if (market) {
      return market[rateType];
    }
  }

  return 0;
}

// ============================================================
// Initial Customers
// ============================================================

const initialCustomers: Customer[] = [
  {
    id: "c1",
    name: "احمد رحیمی",
    balances: {
      AFN: 500000,
      USD: 10000,
      EUR: 0,
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
      EUR: 0,
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
      EUR: 0,
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
      EUR: 0,
      IRR: 0,
      PKR: 200000,
    },
  },
];

// ============================================================
// شماره داخلی معامله
// ============================================================

const generateDocId = () => {
  const now = new Date();

  return `EX-${now.getFullYear()}${(
    now.getMonth() + 1
  )
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
// محاسبه موجودی
// ============================================================

function computeBalances(
  customers: Customer[],
  transactions: Transaction[]
) {
  const balances: Record<
    string,
    Record<string, number>
  > = {};

  customers.forEach(
    (customer) => {
      balances[customer.id] = {
        ...customer.balances,
      };
    }
  );

  transactions.forEach(
    (tx) => {
      if (
        tx.status === "voided"
      ) {
        return;
      }

      // ------------------------------------------------------
      // صرافی با مشتری
      // ------------------------------------------------------

      if (
        tx.type === "صرافی-مشتری"
      ) {
        const customerBalance =
          balances[tx.customerId];

        if (!customerBalance) {
          return;
        }

        // مشتری ارز پرداختی را می‌دهد
        customerBalance[
          tx.paidCurrency
        ] =
          (
            customerBalance[
              tx.paidCurrency
            ] || 0
          ) - tx.paidAmount;

        // مشتری ارز دریافتی را می‌گیرد
        customerBalance[
          tx.receivedCurrency
        ] =
          (
            customerBalance[
              tx.receivedCurrency
            ] || 0
          ) + tx.receivedAmount;

        return;
      }

      // ------------------------------------------------------
      // انتقال بین مشتریان
      // ------------------------------------------------------

      if (
        tx.type === "بین-مشتریان"
      ) {
        const senderBalance =
          balances[tx.senderId];

        const receiverBalance =
          balances[tx.receiverId];

        if (senderBalance) {
          senderBalance[
            tx.senderCurrency
          ] =
            (
              senderBalance[
                tx.senderCurrency
              ] || 0
            ) - tx.senderAmount;

          if (
            tx.commission > 0 &&
            tx.commissionCurrency
          ) {
            senderBalance[
              tx.commissionCurrency
            ] =
              (
                senderBalance[
                  tx.commissionCurrency
                ] || 0
              ) - tx.commission;
          }
        }

        if (receiverBalance) {
          receiverBalance[
            tx.receiverCurrency
          ] =
            (
              receiverBalance[
                tx.receiverCurrency
              ] || 0
            ) +
            tx.receiverAmount;
        }
      }
    }
  );

  return balances;
}

// ============================================================
// Component
// ============================================================

export default function CurrencyExchangePage() {
  const [customers] =
    useState<Customer[]>(
      initialCustomers
    );

  const [transactions, setTransactions] =
    useState<Transaction[]>([]);

  const [activeTab, setActiveTab] =
    useState<
      "صرافی-مشتری" |
      "بین-مشتریان"
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
  // General form
  // ==========================================================

  const [docId, setDocId] =
    useState(generateDocId());

  const [note, setNote] =
    useState("");

  const [terms, setTerms] =
    useState("نقدی");

  // ==========================================================
  // Exchange
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

  const [exRateType, setExRateType] =
    useState<"buy" | "sell">("buy");

  // ==========================================================
  // Transfer
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
    useState<Transaction | null>(
      null
    );

  const [viewTx, setViewTx] =
    useState<Transaction | null>(
      null
    );

  const [
    operationMenuId,
    setOperationMenuId,
  ] = useState<string | null>(
    null
  );

  // ==========================================================
  // محاسبه نرخ پیش‌فرض
  // ==========================================================

  useEffect(() => {
    if (
      exReceivedCurrency ===
      exPaidCurrency
    ) {
      setExRate("1");
      return;
    }

    // --------------------------------------------------------
    // مشتری ارز خارجی می‌دهد و AFN می‌گیرد
    // صرافی ارز خارجی را می‌خرد
    // --------------------------------------------------------

    if (
      exPaidCurrency !== "AFN" &&
      exReceivedCurrency === "AFN"
    ) {
      const rate =
        getMarketRate(
          exPaidCurrency,
          "AFN",
          "buy"
        );

      if (rate > 0) {
        setExRate(
          rate.toString()
        );
      }

      setExRateType("buy");
      return;
    }

    // --------------------------------------------------------
    // مشتری AFN می‌دهد و ارز خارجی می‌گیرد
    // صرافی ارز خارجی را می‌فروشد
    // --------------------------------------------------------

    if (
      exPaidCurrency === "AFN" &&
      exReceivedCurrency !== "AFN"
    ) {
      const rate =
        getMarketRate(
          exReceivedCurrency,
          "AFN",
          "sell"
        );

      if (rate > 0) {
        setExRate(
          rate.toString()
        );
      }

      setExRateType("sell");
      return;
    }
  }, [
    exReceivedCurrency,
    exPaidCurrency,
  ]);

  // ==========================================================
  // محاسبه مبلغ پرداختی صرافی
  // ==========================================================

  const computeExchangePaid =
    () => {
      if (
        !exRate ||
        !exReceivedAmount
      ) {
        setExPaidAmount("");
        return;
      }

      const received =
        parseFloat(
          exReceivedAmount
        );

      const rate =
        parseFloat(exRate);

      if (
        !Number.isFinite(
          received
        ) ||
        !Number.isFinite(rate) ||
        rate <= 0
      ) {
        setExPaidAmount("");
        return;
      }

      const paid =
        convertAmount(
          received,
          exReceivedCurrency,
          exPaidCurrency,
          rate
        );

      setExPaidAmount(
        formatNumber(paid)
      );
    };

  useEffect(
    () => {
      computeExchangePaid();
    },
    [
      exReceivedAmount,
      exRate,
      exReceivedCurrency,
      exPaidCurrency,
    ]
  );

  // ==========================================================
  // محاسبه انتقال
  // ==========================================================

  const computeTransferReceiver =
    () => {
      if (
        !trRate ||
        !trSenderAmount
      ) {
        setTrReceiverAmount("");
        return;
      }

      const senderAmount =
        parseFloat(
          trSenderAmount
        );

      const rate =
        parseFloat(trRate);

      if (
        !Number.isFinite(
          senderAmount
        ) ||
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
        formatNumber(
          receiverAmount
        )
      );
    };

  useEffect(
    () => {
      computeTransferReceiver();
    },
    [
      trSenderAmount,
      trRate,
      trSenderCurrency,
      trReceiverCurrency,
    ]
  );

  // ==========================================================
  // Reset
  // ==========================================================

  const resetForm = () => {
    setDocId(
      generateDocId()
    );

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

    setTrRate("");
    setTrCommission("0");
    setTrCommissionCurrency(
      "AFN"
    );
  };

  // ==========================================================
  // ثبت معامله صرافی
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
      parseFloat(
        exReceivedAmount
      );

    const paidAmount =
      parseFloat(
        exPaidAmount
      );

    const rate =
      parseFloat(exRate);

    if (
      !Number.isFinite(
        receivedAmount
      ) ||
      !Number.isFinite(
        paidAmount
      ) ||
      !Number.isFinite(rate) ||
      rate <= 0
    ) {
      return;
    }

    const tx: ExchangeTransaction =
      {
        id: docId,

        type: "صرافی-مشتری",

        date:
          new Date().toISOString(),

        customerId:
          exCustomer,

        receivedCurrency:
          exReceivedCurrency,

        receivedAmount,

        paidCurrency:
          exPaidCurrency,

        paidAmount,

        rate,

        rateType: exRateType,

        terms,

        note,

        status: "active",
      };

    setTransactions(
      (prev) => [
        tx,
        ...prev,
      ]
    );

    resetForm();
  };

  // ==========================================================
  // ثبت انتقال
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

    if (
      trSender === trReceiver
    ) {
      alert(
        "فرستنده و گیرنده نمی‌توانند یکسان باشند"
      );
      return;
    }

    const senderAmountNum =
      parseFloat(
        trSenderAmount
      );

    const rateNum =
      parseFloat(trRate);

    const commissionNum =
      parseFloat(
        trCommission
      ) || 0;

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

    const receiverAmountNum =
      convertAmount(
        senderAmountNum,
        trSenderCurrency,
        trReceiverCurrency,
        rateNum
      );

    const tx: TransferTransaction =
      {
        id: docId,

        type: "بین-مشتریان",

        date:
          new Date().toISOString(),

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

        commission:
          commissionNum,

        commissionCurrency:
          trCommissionCurrency,

        note,

        terms,

        status: "active",
      };

    setTransactions(
      (prev) => [
        tx,
        ...prev,
      ]
    );

    resetForm();
  };

  // ==========================================================
  // ابطال
  // ==========================================================

  const voidTransaction = (
    id: string
  ) => {
    setTransactions(
      (prev) =>
        prev.map((tx) =>
          tx.id === id
            ? {
                ...tx,
                status:
                  "voided",
              }
            : tx
        )
    );
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
  };

  const saveEdit = () => {
    if (!editingTx) return;

    setTransactions(
      (prev) =>
        prev.map((tx) =>
          tx.id ===
          editingTx.id
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
  // چاپ
  // ==========================================================

  const printReceipt = (
    tx: Transaction
  ) => {
    const w =
      window.open(
        "",
        "_blank"
      );

    if (!w) return;

    let content = `
      <div style="
        direction:rtl;
        font-family:Tahoma;
        padding:20px;
      ">
    `;

    content += `
      <h2>
        رسید معامله - ${tx.id}
      </h2>
    `;

    content += `
      <p>
        <strong>تاریخ:</strong>
        ${new Date(
          tx.date
        ).toLocaleString(
          "fa-IR"
        )}
      </p>
    `;

    content += `
      <p>
        <strong>نوع:</strong>
        ${tx.type}
      </p>
    `;

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
          ${
            customer?.name ||
            tx.customerId
          }
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

      content += `
        <p>
          <strong>نوع نرخ:</strong>
          ${
            tx.rateType ===
            "buy"
              ? "خرید"
              : "فروش"
          }
        </p>
      `;
    } else {
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
          ${
            sender?.name ||
            tx.senderId
          }
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
          ${
            receiver?.name ||
            tx.receiverId
          }
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

      if (
        tx.commission > 0
      ) {
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

    content += `</div>`;

    w.document.write(
      content
    );

    w.document.close();
    w.print();
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
      className="space-y-6"
      dir="rtl"
    >

      <h1 className="text-2xl font-bold text-gray-800">
        معاملات ارزی
      </h1>

      {/* ====================================================
          نرخ‌های بازار
      ==================================================== */}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">

        <div className="flex items-center justify-between mb-5">

          <div>
            <h2 className="text-lg font-bold text-gray-800">
              پایان معاملات
            </h2>

            <p className="text-xs text-gray-500 mt-1">
              نرخ خرید و فروش ارز
            </p>
          </div>

        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* دالر */}

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">

            <div className="font-bold text-gray-800 mb-3">
              دالر به افغانی
            </div>

            <div className="flex justify-between text-sm">

              <span className="text-green-600">
                خرید
              </span>

              <span className="font-bold">
                65.90
              </span>

            </div>

            <div className="flex justify-between text-sm mt-2">

              <span className="text-red-600">
                فروش
              </span>

              <span className="font-bold">
                65.95
              </span>

            </div>

          </div>

          {/* یورو */}

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">

            <div className="font-bold text-gray-800 mb-3">
              یورو به افغانی
            </div>

            <div className="flex justify-between text-sm">

              <span className="text-green-600">
                خرید
              </span>

              <span className="font-bold">
                74.90
              </span>

            </div>

            <div className="flex justify-between text-sm mt-2">

              <span className="text-red-600">
                فروش
              </span>

              <span className="font-bold">
                75.00
              </span>

            </div>

          </div>

          {/* کلدار */}

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">

            <div className="font-bold text-gray-800 mb-3">
              کلدار به افغانی
            </div>

            <div className="flex justify-between text-sm">

              <span className="text-green-600">
                خرید
              </span>

              <span className="font-bold">
                229.00
              </span>

            </div>

            <div className="flex justify-between text-sm mt-2">

              <span className="text-red-600">
                فروش
              </span>

              <span className="font-bold">
                229.50
              </span>

            </div>

            <div className="text-[10px] text-gray-400 mt-2">
              1000 کلدار
            </div>

          </div>

          {/* تومان */}

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">

            <div className="font-bold text-gray-800 mb-3">
              تومان به افغانی
            </div>

            <div className="flex justify-between text-sm">

              <span className="text-green-600">
                خرید
              </span>

              <span className="font-bold">
                0.350
              </span>

            </div>

            <div className="flex justify-between text-sm mt-2">

              <span className="text-red-600">
                فروش
              </span>

              <span className="font-bold">
                0.360
              </span>

            </div>

            <div className="text-[10px] text-gray-400 mt-2">
              1000 تومان
            </div>

          </div>

        </div>

      </div>

      {/* ====================================================
          Tabs
      ==================================================== */}

      <div className="flex gap-2 border-b pb-2">

        <button
          onClick={() =>
            setActiveTab(
              "صرافی-مشتری"
            )
          }
          className={`px-4 py-2 rounded-t-lg text-sm font-medium ${
            activeTab ===
            "صرافی-مشتری"
              ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          تبادل ارز
          (صرافی با مشتری)
        </button>

        <button
          onClick={() =>
            setActiveTab(
              "بین-مشتریان"
            )
          }
          className={`px-4 py-2 rounded-t-lg text-sm font-medium ${
            activeTab ===
            "بین-مشتریان"
              ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          تبادل بین حساب مشتریان
        </button>

      </div>

      {/* ====================================================
          صرافی با مشتری
      ==================================================== */}

      {activeTab ===
      "صرافی-مشتری" ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">

          <h2 className="text-lg font-semibold text-gray-800 mb-6">
            تبادل ارز
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

            {/* دریافتی */}

            <div className="bg-gray-50 rounded-xl p-5 border">

              <h3 className="text-sm font-bold text-gray-500 mb-4">
                اطلاعات مشتری و دریافتی
              </h3>

              <div className="space-y-4">

                <div>

                  <label className="block text-sm font-bold mb-2">
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
                    className="h-14 rounded-[14px] w-full px-4 border"
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

                  <label className="block text-sm font-bold mb-2">
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
                    className="h-14 rounded-[14px] w-full px-4 border"
                  >

                    {currencies.map(
                      (currency) => (
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

                  <label className="block text-sm font-bold mb-2">
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
                    className="h-14 rounded-[14px] w-full px-4 border"
                  />

                </div>

              </div>

            </div>

            {/* پرداختی */}

            <div className="bg-gray-50 rounded-xl p-5 border">

              <h3 className="text-sm font-bold text-gray-500 mb-4">
                اطلاعات پرداختی
              </h3>

              <div className="space-y-4">

                <div>

                  <label className="block text-sm font-bold mb-2">
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
                    className="h-14 rounded-[14px] w-full px-4 border"
                  >

                    {currencies.map(
                      (currency) => (
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

                  <label className="block text-sm font-bold mb-2">
                    نوع نرخ
                  </label>

                  <select
                    value={
                      exRateType
                    }
                    onChange={(e) =>
                      setExRateType(
                        e.target.value as
                          | "buy"
                          | "sell"
                      )
                    }
                    className="h-14 rounded-[14px] w-full px-4 border"
                  >

                    <option value="buy">
                      خرید
                    </option>

                    <option value="sell">
                      فروش
                    </option>

                  </select>

                </div>

                <div>

                  <label className="block text-sm font-bold mb-2">
                    مبلغ پرداختی
                  </label>

                  <input
                    type="text"
                    value={
                      exPaidAmount
                    }
                    readOnly
                    className="h-14 rounded-[14px] w-full px-4 border bg-gray-100"
                  />

                </div>

              </div>

            </div>

          </div>

          {/* نرخ */}

          <div className="mb-6">

            <label className="block text-sm font-bold mb-2">
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
              className="h-14 rounded-[14px] w-full px-4 border"
            />

            <div className="text-xs text-gray-500 mt-2">

              {exRateType ===
              "buy"
                ? "نرخ خرید"
                : "نرخ فروش"}

              {" — "}

              {formatRateQuote(
                exReceivedCurrency,
                exPaidCurrency,
                parseFloat(
                  exRate
                ) || 0
              )}

            </div>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">

            <div>

              <label className="block text-sm font-bold mb-2">
                مفاد معامله
              </label>

              <input
                value={terms}
                onChange={(e) =>
                  setTerms(
                    e.target.value
                  )
                }
                className="h-14 rounded-[14px] w-full px-4 border"
              />

            </div>

            <div>

              <label className="block text-sm font-bold mb-2">
                یادداشت
              </label>

              <input
                value={note}
                onChange={(e) =>
                  setNote(
                    e.target.value
                  )
                }
                className="h-14 rounded-[14px] w-full px-4 border"
              />

            </div>

          </div>

          <button
            onClick={
              submitExchange
            }
            className="w-full h-14 rounded-2xl bg-[#092F3A] text-white font-medium"
          >
            ثبت معامله
          </button>

        </div>
      ) : (

        /* ==================================================
           بین مشتریان
        ================================================== */

        <div className="bg-white rounded-2xl shadow-sm border p-6">

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

                  <label className="block text-sm font-bold mb-2">
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
                    className="h-14 rounded-[14px] w-full px-4 border"
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

                  <label className="block text-sm font-bold mb-2">
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
                    className="h-14 rounded-[14px] w-full px-4 border"
                  >

                    {currencies.map(
                      (currency) => (
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

                  <label className="block text-sm font-bold mb-2">
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
                    className="h-14 rounded-[14px] w-full px-4 border"
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

                  <label className="block text-sm font-bold mb-2">
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
                    className="h-14 rounded-[14px] w-full px-4 border"
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

                  <label className="block text-sm font-bold mb-2">
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
                    className="h-14 rounded-[14px] w-full px-4 border"
                  >

                    {currencies.map(
                      (currency) => (
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

                  <label className="block text-sm font-bold mb-2">
                    مبلغ گیرنده
                  </label>

                  <input
                    type="text"
                    value={
                      trReceiverAmount
                    }
                    readOnly
                    className="h-14 rounded-[14px] w-full px-4 border bg-gray-100"
                  />

                </div>

              </div>

            </div>

          </div>

          <div className="mb-6">

            <label className="block text-sm font-bold mb-2">
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
              className="h-14 rounded-[14px] w-full px-4 border"
            />

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">

            <div>

              <label className="block text-sm font-bold mb-2">
                کارمزد
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
                className="h-14 rounded-[14px] w-full px-4 border"
              />

            </div>

            <div>

              <label className="block text-sm font-bold mb-2">
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
                className="h-14 rounded-[14px] w-full px-4 border"
              >

                {currencies.map(
                  (currency) => (
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

              <label className="block text-sm font-bold mb-2">
                یادداشت
              </label>

              <input
                value={note}
                onChange={(e) =>
                  setNote(
                    e.target.value
                  )
                }
                className="h-14 rounded-[14px] w-full px-4 border"
              />

            </div>

          </div>

          <button
            onClick={
              submitTransfer
            }
            className="w-full h-14 rounded-2xl bg-[#092F3A] text-white font-medium"
          >
            ثبت معامله
          </button>

        </div>
      )}

      {/* ====================================================
          موجودی مشتریان
      ==================================================== */}

      <div className="bg-white rounded-xl shadow p-5">

        <h2 className="text-lg font-semibold text-gray-700 mb-3">
          موجودی فعلی مشتریان
        </h2>

        <div className="overflow-x-auto">

          <table className="min-w-full text-sm">

            <thead className="bg-gray-50">

              <tr>

                <th className="py-2 px-3 text-right">
                  مشتری
                </th>

                {currencies.map(
                  (currency) => (
                    <th
                      key={
                        currency
                      }
                      className="py-2 px-3 text-right"
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

            <tbody className="divide-y">

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
                    >

                      <td className="py-2 px-3 font-medium">
                        {
                          customer.name
                        }
                      </td>

                      {currencies.map(
                        (currency) => (
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

      {/* ====================================================
          معاملات
      ==================================================== */}

      <div className="bg-white rounded-xl shadow overflow-x-auto">

        <h2 className="text-lg font-semibold text-gray-700 p-5">
          آخرین معاملات
        </h2>

        <table className="min-w-full text-sm">

          <thead className="bg-gray-50">

            <tr>

              <th className="py-3 px-2 text-right">
                شماره
              </th>

              <th className="py-3 px-2 text-right">
                تاریخ
              </th>

              <th className="py-3 px-2 text-right">
                نوع معامله
              </th>

              <th className="py-3 px-2 text-right">
                مشتری/فرستنده
              </th>

              <th className="py-3 px-2 text-right">
                دریافت
              </th>

              <th className="py-3 px-2 text-right">
                پرداخت
              </th>

              <th className="py-3 px-2 text-right">
                نرخ
              </th>

              <th className="py-3 px-2 text-right">
                مفاد
              </th>

              <th className="py-3 px-2 text-right">
                عملیات
              </th>

            </tr>

          </thead>

          <tbody className="divide-y">

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
                    className={
                      isVoided
                        ? "opacity-60 line-through"
                        : ""
                    }
                  >

                    <td className="py-3 px-2 font-bold">
                      {index + 1}
                    </td>

                    <td className="py-3 px-2 text-xs">
                      {new Date(
                        tx.date
                      ).toLocaleString(
                        "fa-IR"
                      )}
                    </td>

                    <td className="py-3 px-2">

                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          tx.type ===
                          "صرافی-مشتری"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {
                          tx.type
                        }
                      </span>

                    </td>

                    <td className="py-3 px-2">

                      {tx.type ===
                      "صرافی-مشتری"
                        ? customerName(
                            tx.customerId
                          )
                        : customerName(
                            tx.senderId
                          )}

                    </td>

                    <td className="py-3 px-2">

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

                    <td className="py-3 px-2">

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

                    <td className="py-3 px-2 text-xs">

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

                    <td className="py-3 px-2 text-xs">
                      {tx.terms}
                    </td>

                    <td className="py-3 px-2">

                      <div className="relative">

                        <button
                          onClick={() =>
                            setOperationMenuId(
                              operationMenuId ===
                                tx.id
                                ? null
                                : tx.id
                            )
                          }
                          className="px-3 py-2 text-xs bg-gray-100 rounded-lg"
                        >
                          عملیات ▼
                        </button>

                        {operationMenuId ===
                          tx.id && (
                          <div className="absolute right-0 top-full mt-1 z-50 w-32 bg-white border rounded-xl shadow-lg overflow-hidden">

                            <button
                              onClick={() => {
                                setViewTx(
                                  tx
                                );
                                setOperationMenuId(
                                  null
                                );
                              }}
                              className="w-full px-3 py-2 text-right text-xs hover:bg-blue-50 text-blue-600"
                            >
                              مشاهده
                            </button>

                            {!isVoided && (
                              <button
                                onClick={() => {
                                  startEdit(
                                    tx
                                  );
                                  setOperationMenuId(
                                    null
                                  );
                                }}
                                className="w-full px-3 py-2 text-right text-xs hover:bg-yellow-50 text-yellow-700"
                              >
                                ویرایش
                              </button>
                            )}

                            <button
                              onClick={() => {
                                printReceipt(
                                  tx
                                );
                                setOperationMenuId(
                                  null
                                );
                              }}
                              className="w-full px-3 py-2 text-right text-xs hover:bg-gray-50"
                            >
                              چاپ
                            </button>

                            {!isVoided && (
                              <button
                                onClick={() => {
                                  voidTransaction(
                                    tx.id
                                  );
                                  setOperationMenuId(
                                    null
                                  );
                                }}
                                className="w-full px-3 py-2 text-right text-xs hover:bg-red-50 text-red-600"
                              >
                                ابطال
                              </button>
                            )}

                          </div>
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

      {/* ====================================================
          View Modal
      ==================================================== */}

      {viewTx && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
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

            <h2 className="text-lg font-semibold mb-4">
              جزئیات معامله
            </h2>

            <div className="space-y-2 text-sm">

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

                  <p>
                    <strong>
                      نوع نرخ:
                    </strong>{" "}
                    {viewTx.rateType ===
                    "buy"
                      ? "خرید"
                      : "فروش"}
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
                {viewTx.note ||
                  "-"}
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
              className="mt-4 px-4 py-2 bg-gray-200 rounded-lg"
            >
              بستن
            </button>

          </div>

        </div>
      )}

      {/* ====================================================
          Edit Modal
      ==================================================== */}

      {editMode &&
        editingTx && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">

            <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">

              <h2 className="text-lg font-semibold mb-4">
                ویرایش معامله
              </h2>

              {editingTx.type ===
                "صرافی-مشتری" && (
                <div className="grid grid-cols-2 gap-4">

                  <div>
                    <label>
                      مشتری
                    </label>

                    <select
                      value={
                        editingTx.customerId
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          customerId:
                            e.target.value,
                        } as ExchangeTransaction)
                      }
                      className="w-full border rounded p-2"
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
                    <label>
                      ارز دریافتی
                    </label>

                    <select
                      value={
                        editingTx.receivedCurrency
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          receivedCurrency:
                            e.target.value,
                        } as ExchangeTransaction)
                      }
                      className="w-full border rounded p-2"
                    >

                      {currencies.map(
                        (currency) => (
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
                    <label>
                      مبلغ دریافتی
                    </label>

                    <input
                      type="number"
                      value={
                        editingTx.receivedAmount
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          receivedAmount:
                            +e.target.value,
                        } as ExchangeTransaction)
                      }
                      className="w-full border rounded p-2"
                    />

                  </div>

                  <div>
                    <label>
                      ارز پرداختی
                    </label>

                    <select
                      value={
                        editingTx.paidCurrency
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          paidCurrency:
                            e.target.value,
                        } as ExchangeTransaction)
                      }
                      className="w-full border rounded p-2"
                    >

                      {currencies.map(
                        (currency) => (
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
                    <label>
                      مبلغ پرداختی
                    </label>

                    <input
                      type="number"
                      value={
                        editingTx.paidAmount
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          paidAmount:
                            +e.target.value,
                        } as ExchangeTransaction)
                      }
                      className="w-full border rounded p-2"
                    />
                  </div>

                  <div>
                    <label>
                      نرخ
                    </label>

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
                            +e.target.value,
                        } as ExchangeTransaction)
                      }
                      className="w-full border rounded p-2"
                    />
                  </div>

                  <div>
                    <label>
                      نوع نرخ
                    </label>

                    <select
                      value={
                        editingTx.rateType
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          rateType:
                            e.target.value as
                              | "buy"
                              | "sell",
                        } as ExchangeTransaction)
                      }
                      className="w-full border rounded p-2"
                    >

                      <option value="buy">
                        خرید
                      </option>

                      <option value="sell">
                        فروش
                      </option>

                    </select>

                  </div>

                  <div>
                    <label>
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
                            e.target.value,
                        })
                      }
                      className="w-full border rounded p-2"
                    />

                  </div>

                  <div className="col-span-2">

                    <label>
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
                            e.target.value,
                        })
                      }
                      className="w-full border rounded p-2"
                    />

                  </div>

                </div>
              )}

              {editingTx.type ===
                "بین-مشتریان" && (
                <div className="grid grid-cols-2 gap-4">

                  <div>

                    <label>
                      فرستنده
                    </label>

                    <select
                      value={
                        editingTx.senderId
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          senderId:
                            e.target.value,
                        } as TransferTransaction)
                      }
                      className="w-full border rounded p-2"
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

                    <label>
                      گیرنده
                    </label>

                    <select
                      value={
                        editingTx.receiverId
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          receiverId:
                            e.target.value,
                        } as TransferTransaction)
                      }
                      className="w-full border rounded p-2"
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

                    <label>
                      ارز فرستنده
                    </label>

                    <select
                      value={
                        editingTx.senderCurrency
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          senderCurrency:
                            e.target.value,
                        } as TransferTransaction)
                      }
                      className="w-full border rounded p-2"
                    >

                      {currencies.map(
                        (currency) => (
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

                    <label>
                      مبلغ فرستنده
                    </label>

                    <input
                      type="number"
                      value={
                        editingTx.senderAmount
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          senderAmount:
                            +e.target.value,
                        } as TransferTransaction)
                      }
                      className="w-full border rounded p-2"
                    />

                  </div>

                  <div>

                    <label>
                      ارز گیرنده
                    </label>

                    <select
                      value={
                        editingTx.receiverCurrency
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          receiverCurrency:
                            e.target.value,
                        } as TransferTransaction)
                      }
                      className="w-full border rounded p-2"
                    >

                      {currencies.map(
                        (currency) => (
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

                    <label>
                      مبلغ گیرنده
                    </label>

                    <input
                      type="number"
                      value={
                        editingTx.receiverAmount
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          receiverAmount:
                            +e.target.value,
                        } as TransferTransaction)
                      }
                      className="w-full border rounded p-2"
                    />

                  </div>

                  <div>

                    <label>
                      نرخ
                    </label>

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
                            +e.target.value,
                        } as TransferTransaction)
                      }
                      className="w-full border rounded p-2"
                    />

                  </div>

                  <div>

                    <label>
                      کارمزد
                    </label>

                    <input
                      type="number"
                      value={
                        editingTx.commission
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          commission:
                            +e.target.value,
                        } as TransferTransaction)
                      }
                      className="w-full border rounded p-2"
                    />

                  </div>

                  <div>

                    <label>
                      ارز کارمزد
                    </label>

                    <select
                      value={
                        editingTx.commissionCurrency
                      }
                      onChange={(e) =>
                        setEditingTx({
                          ...editingTx,
                          commissionCurrency:
                            e.target.value,
                        } as TransferTransaction)
                      }
                      className="w-full border rounded p-2"
                    >

                      {currencies.map(
                        (currency) => (
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

                  <div className="col-span-2">

                    <label>
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
                            e.target.value,
                        })
                      }
                      className="w-full border rounded p-2"
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
                  className="px-4 py-2 bg-gray-200 rounded-lg"
                >
                  انصراف
                </button>

                <button
                  onClick={
                    saveEdit
                  }
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg"
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
