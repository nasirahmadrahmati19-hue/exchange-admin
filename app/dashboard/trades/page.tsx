"use client";

import { useEffect, useState } from "react";

type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";

type Customer = {
  id: string;
  name: string;
  balances: Record<Currency, number>;
};

type Transaction = {
  id: string;
  type: "exchange" | "transfer";
  date: string;
  customerId?: string;
  senderId?: string;
  receiverId?: string;
  fromCurrency: Currency;
  fromAmount: number;
  toCurrency: Currency;
  toAmount: number;
  rate: number;
  rateCurrency?: Currency;
  commission?: number;
  commissionCurrency?: Currency;
  status: "active" | "voided";
};

const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];

const labels: Record<Currency, string> = {
  AFN: "افغانی",
  USD: "دالر",
  EUR: "یورو",
  IRR: "تومان",
  PKR: "کلدار",
};

/*
  منطق نرخ:

  1 USD = 50 AFN
  1 EUR = 50 AFN یا هر نرخ مشابه
  1000 IRR = 0.38 AFN
  1000 PKR = 250 AFN

  بنابراین واحد نرخ برای تومان و کلدار 1000 است.
*/
const rateUnits: Record<Currency, number> = {
  AFN: 1,
  USD: 1,
  EUR: 1,
  IRR: 1000,
  PKR: 1000,
};

const initialCustomers: Customer[] = [
  {
    id: "1",
    name: "احمد رحیمی",
    balances: { AFN: 500000, USD: 10000, EUR: 0, IRR: 0, PKR: 0 },
  },
  {
    id: "2",
    name: "محمد ظاهر",
    balances: { AFN: 200000, USD: 5000, EUR: 0, IRR: 0, PKR: 0 },
  },
  {
    id: "3",
    name: "فاطمه حسینی",
    balances: { AFN: 0, USD: 0, EUR: 0, IRR: 50000000, PKR: 0 },
  },
];

const fmt = (n: number) =>
  Number.isFinite(n)
    ? n.toLocaleString("en-US", { maximumFractionDigits: 8 })
    : "0";

const parseAmount = (v: string) => {
  const n = Number(String(v || "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const newId = () =>
  `EX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

/*
  اگر یکی از دو ارز AFN باشد، ارز دیگر ارز نرخ است.
  مثال:
  AFN -> USD => نرخ USD
  USD -> AFN => نرخ USD
  IRR -> AFN => نرخ IRR
  AFN -> IRR => نرخ IRR
*/
function getRateCurrency(
  from: Currency,
  to: Currency
): Currency | null {
  if (from === to) return null;
  if (from === "AFN") return to;
  if (to === "AFN") return from;
  return null;
}

function rateDescription(rate: number, rateCurrency: Currency) {
  return `${fmt(rateUnits[rateCurrency])} ${labels[rateCurrency]} = ${fmt(
    rate
  )} ${labels.AFN}`;
}

/*
  تبدیل فقط بر اساس نرخ نسبت به افغانی.

  اگر از AFN به ارز خارجی:
  amount / rate * unit

  اگر از ارز خارجی به AFN:
  amount / unit * rate

  مثال‌ها:
  50000 AFN -> USD با نرخ 50
  50000 / 50 * 1 = 1000 USD

  1000000 IRR -> AFN با نرخ 0.38
  1000000 / 1000 * 0.38 = 380 AFN

  5000 PKR -> AFN با نرخ 250
  5000 / 1000 * 250 = 1250 AFN
*/
function convertByAfnRate(
  amount: number,
  from: Currency,
  to: Currency,
  rate: number
) {
  if (!Number.isFinite(amount) || amount === 0) return 0;
  if (from === to) return amount;
  if (!Number.isFinite(rate) || rate <= 0) return 0;

  const rateCurrency = getRateCurrency(from, to);
  if (!rateCurrency) return 0;

  const unit = rateUnits[rateCurrency] || 1;

  if (from === "AFN" && to === rateCurrency) {
    return (amount / rate) * unit;
  }

  if (from === rateCurrency && to === "AFN") {
    return (amount / unit) * rate;
  }

  return 0;
}

export default function CurrencyExchangePage() {
  const [customers] = useState<Customer[]>(initialCustomers);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [tab, setTab] = useState<"exchange" | "transfer">("exchange");

  /* ---------------- Exchange ---------------- */

  const [customer, setCustomer] = useState("");

  const [receivedCurrency, setReceivedCurrency] =
    useState<Currency>("AFN");
  const [receivedAmount, setReceivedAmount] = useState("");

  const [paidCurrency, setPaidCurrency] =
    useState<Currency>("USD");
  const [paidAmount, setPaidAmount] = useState("");

  const [rate, setRate] = useState("");

  /* ---------------- Transfer ---------------- */

  const [sender, setSender] = useState("");
  const [receiver, setReceiver] = useState("");

  const [senderCurrency, setSenderCurrency] =
    useState<Currency>("AFN");
  const [receiverCurrency, setReceiverCurrency] =
    useState<Currency>("AFN");

  const [senderAmount, setSenderAmount] = useState("");
  const [receiverAmount, setReceiverAmount] = useState("");

  const [transferRate, setTransferRate] = useState("");
  const [commission, setCommission] = useState("0");

  /* ---------------- Exchange Calculation ---------------- */

  const exchangeRateCurrency = getRateCurrency(
    receivedCurrency,
    paidCurrency
  );

  const exchangeUnsupported =
    receivedCurrency !== paidCurrency && !exchangeRateCurrency;

  useEffect(() => {
    const amount = parseAmount(receivedAmount);

    if (!amount) {
      setPaidAmount("");
      return;
    }

    if (receivedCurrency === paidCurrency) {
      setPaidAmount(fmt(amount));
      return;
    }

    if (!exchangeRateCurrency) {
      setPaidAmount("");
      return;
    }

    const r = parseAmount(rate);

    if (!r) {
      setPaidAmount("");
      return;
    }

    const result = convertByAfnRate(
      amount,
      receivedCurrency,
      paidCurrency,
      r
    );

    setPaidAmount(result ? fmt(result) : "");
  }, [
    receivedAmount,
    receivedCurrency,
    paidCurrency,
    rate,
    exchangeRateCurrency,
  ]);

  /* ---------------- Transfer Calculation ---------------- */

  const transferRateCurrency = getRateCurrency(
    senderCurrency,
    receiverCurrency
  );

  const transferUnsupported =
    senderCurrency !== receiverCurrency && !transferRateCurrency;

  useEffect(() => {
    const amount = parseAmount(senderAmount);

    if (!amount) {
      setReceiverAmount("");
      return;
    }

    if (senderCurrency === receiverCurrency) {
      setReceiverAmount(fmt(amount));
      return;
    }

    if (!transferRateCurrency) {
      setReceiverAmount("");
      return;
    }

    const r = parseAmount(transferRate);

    if (!r) {
      setReceiverAmount("");
      return;
    }

    const result = convertByAfnRate(
      amount,
      senderCurrency,
      receiverCurrency,
      r
    );

    setReceiverAmount(result ? fmt(result) : "");
  }, [
    senderAmount,
    senderCurrency,
    receiverCurrency,
    transferRate,
    transferRateCurrency,
  ]);

  /* ---------------- Submit Exchange ---------------- */

  const exchangeFromAmount = parseAmount(receivedAmount);
  const exchangeToAmount = parseAmount(paidAmount);
  const exchangeRateValue = parseAmount(rate);

  const canSubmitExchange =
    !!customer &&
    exchangeFromAmount > 0 &&
    !exchangeUnsupported &&
    (receivedCurrency === paidCurrency ||
      (exchangeRateValue > 0 && exchangeToAmount > 0));

  function submitExchange() {
    if (!canSubmitExchange) return;

    const fromAmount = parseAmount(receivedAmount);

    const toAmount =
      receivedCurrency === paidCurrency
        ? fromAmount
        : parseAmount(paidAmount);

    const txRate =
      receivedCurrency === paidCurrency
        ? 1
        : parseAmount(rate);

    const tx: Transaction = {
      id: newId(),
      type: "exchange",
      date: new Date().toISOString(),
      customerId: customer,
      fromCurrency: receivedCurrency,
      fromAmount,
      toCurrency: paidCurrency,
      toAmount,
      rate: txRate,
      rateCurrency: exchangeRateCurrency ?? undefined,
      status: "active",
    };

    setTransactions((x) => [tx, ...x]);

    setCustomer("");
    setReceivedAmount("");
    setPaidAmount("");
    setRate("");
  }

  /* ---------------- Submit Transfer ---------------- */

  const transferFromAmount = parseAmount(senderAmount);
  const transferToAmount = parseAmount(receiverAmount);
  const transferRateValue = parseAmount(transferRate);
  const commissionValue = Math.max(0, parseAmount(commission));

  const canSubmitTransfer =
    !!sender &&
    !!receiver &&
    sender !== receiver &&
    transferFromAmount > 0 &&
    !transferUnsupported &&
    (senderCurrency === receiverCurrency ||
      (transferRateValue > 0 && transferToAmount > 0));

  function submitTransfer() {
    if (!canSubmitTransfer) return;

    const fromAmount = parseAmount(senderAmount);

    const toAmount =
      senderCurrency === receiverCurrency
        ? fromAmount
        : parseAmount(receiverAmount);

    const txRate =
      senderCurrency === receiverCurrency
        ? 1
        : parseAmount(transferRate);

    const tx: Transaction = {
      id: newId(),
      type: "transfer",
      date: new Date().toISOString(),
      senderId: sender,
      receiverId: receiver,
      fromCurrency: senderCurrency,
      fromAmount,
      toCurrency: receiverCurrency,
      toAmount,
      rate: txRate,
      rateCurrency: transferRateCurrency ?? undefined,
      commission: commissionValue,
      commissionCurrency: senderCurrency,
      status: "active",
    };

    setTransactions((x) => [tx, ...x]);

    setSender("");
    setReceiver("");
    setSenderAmount("");
    setReceiverAmount("");
    setTransferRate("");
    setCommission("0");
  }

  /* ---------------- Balance ---------------- */

  function balances() {
    const result: Record<string, Record<Currency, number>> =
      {} as Record<string, Record<Currency, number>>;

    customers.forEach((c) => {
      result[c.id] = { ...c.balances };
    });

    transactions.forEach((tx) => {
      if (tx.status === "voided") return;

      if (tx.type === "exchange" && tx.customerId) {
        const b = result[tx.customerId];
        if (!b) return;

        b[tx.fromCurrency] =
          (b[tx.fromCurrency] || 0) - tx.fromAmount;

        b[tx.toCurrency] =
          (b[tx.toCurrency] || 0) + tx.toAmount;
      }

      if (
        tx.type === "transfer" &&
        tx.senderId &&
        tx.receiverId
      ) {
        const s = result[tx.senderId];
        const r = result[tx.receiverId];

        if (s) {
          s[tx.fromCurrency] =
            (s[tx.fromCurrency] || 0) - tx.fromAmount;

          if (tx.commission) {
            s[tx.fromCurrency] =
              (s[tx.fromCurrency] || 0) - tx.commission;
          }
        }

        if (r) {
          r[tx.toCurrency] =
            (r[tx.toCurrency] || 0) + tx.toAmount;
        }
      }
    });

    return result;
  }

  const currentBalances = balances();

  function customerName(id?: string) {
    return customers.find((c) => c.id === id)?.name || "-";
  }

  function currencySelect(
    value: Currency,
    change: (v: Currency) => void
  ) {
    return (
      <select
        value={value}
        onChange={(e) =>
          change(e.target.value as Currency)
        }
        className="h-12 w-full rounded-xl border px-3"
      >
        {currencies.map((c) => (
          <option key={c} value={c}>
            {labels[c]}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div dir="rtl" className="p-5 space-y-5 bg-gray-50 min-h-screen">

      <h1 className="text-2xl font-bold">
        معاملات ارزی
      </h1>

      {/* Tabs */}

      <div className="flex gap-2">
        <button
          onClick={() => setTab("exchange")}
          className={`px-5 py-3 rounded-xl ${
            tab === "exchange"
              ? "bg-cyan-600 text-white"
              : "bg-white"
          }`}
        >
          تبادل ارز
        </button>

        <button
          onClick={() => setTab("transfer")}
          className={`px-5 py-3 rounded-xl ${
            tab === "transfer"
              ? "bg-purple-600 text-white"
              : "bg-white"
          }`}
        >
          تبادل بین مشتریان
        </button>
      </div>

      {/* Exchange */}

      {tab === "exchange" && (
        <div className="bg-white rounded-2xl p-5 space-y-5">

          <h2 className="font-bold text-lg">
            تبادل ارز صرافی با مشتری
          </h2>

          <select
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            className="h-12 w-full rounded-xl border px-3"
          >
            <option value="">انتخاب مشتری</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <div className="grid md:grid-cols-2 gap-4">

            <div className="space-y-3">
              <b>دریافت از مشتری</b>

              {currencySelect(
                receivedCurrency,
                setReceivedCurrency
              )}

              <input
                type="number"
                step="any"
                value={receivedAmount}
                onChange={(e) =>
                  setReceivedAmount(e.target.value)
                }
                placeholder="مبلغ دریافتی"
                className="h-12 w-full rounded-xl border px-3"
              />
            </div>

            <div className="space-y-3">
              <b>پرداخت به مشتری</b>

              {currencySelect(
                paidCurrency,
                setPaidCurrency
              )}

              <input
                readOnly
                value={paidAmount}
                placeholder="مبلغ پرداختی"
                className="h-12 w-full rounded-xl border px-3 bg-gray-100"
              />
            </div>

          </div>

          {receivedCurrency === paidCurrency && (
            <div className="bg-gray-100 text-gray-700 rounded-xl p-4">
              ارز دریافت و پرداخت یکسان است؛ مبلغ پرداختی برابر مبلغ دریافتی خواهد بود.
            </div>
          )}

          {exchangeUnsupported && (
            <div className="bg-red-50 text-red-700 rounded-xl p-4">
              برای تبدیل مستقیم بین دو ارز غیر افغانی، لطفاً یکی از ارزها را افغانی انتخاب کنید یا نسخه‌ای با چند نرخ همزمان استفاده کنید.
            </div>
          )}

          {!exchangeUnsupported && exchangeRateCurrency && (
            <div className="bg-blue-50 rounded-xl p-4 space-y-3">

              <b>نرخ دستی در برابر افغانی</b>

              <div className="flex flex-wrap items-center gap-2">

                <span className="whitespace-nowrap">
                  {fmt(rateUnits[exchangeRateCurrency])}{" "}
                  {labels[exchangeRateCurrency]} =
                </span>

                <input
                  type="number"
                  step="any"
                  value={rate}
                  onChange={(e) =>
                    setRate(e.target.value)
                  }
                  placeholder="نرخ"
                  className="h-12 w-40 rounded-xl border px-3"
                />

                <span>{labels.AFN}</span>

              </div>

              <div className="text-xs text-gray-600">
                مثال: 1 دلار = 50 افغانی، 1000 تومان = 0.38 افغانی، 1000 کلدار = 250 افغانی
              </div>

              {exchangeRateValue > 0 && (
                <div className="font-bold text-blue-700">
                  نرخ ثبت‌شده:{" "}
                  {rateDescription(
                    exchangeRateValue,
                    exchangeRateCurrency
                  )}
                </div>
              )}

              {paidAmount && (
                <div className="text-green-700 font-bold">
                  نتیجه: {paidAmount}{" "}
                  {labels[paidCurrency]}
                </div>
              )}

            </div>
          )}

          <button
            onClick={submitExchange}
            disabled={!canSubmitExchange}
            className="w-full h-12 rounded-xl bg-[#092F3A] text-white disabled:opacity-50"
          >
            ثبت معامله
          </button>

        </div>
      )}

      {/* Transfer */}

      {tab === "transfer" && (
        <div className="bg-white rounded-2xl p-5 space-y-5">

          <h2 className="font-bold text-lg">
            تبادل بین حساب مشتریان
          </h2>

          <div className="grid md:grid-cols-2 gap-4">

            <div className="space-y-3">
              <b>فرستنده</b>

              <select
                value={sender}
                onChange={(e) =>
                  setSender(e.target.value)
                }
                className="h-12 w-full rounded-xl border px-3"
              >
                <option value="">انتخاب مشتری</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {currencySelect(
                senderCurrency,
                setSenderCurrency
              )}

              <input
                type="number"
                step="any"
                value={senderAmount}
                onChange={(e) =>
                  setSenderAmount(e.target.value)
                }
                placeholder="مبلغ فرستنده"
                className="h-12 w-full rounded-xl border px-3"
              />
            </div>

            <div className="space-y-3">
              <b>گیرنده</b>

              <select
                value={receiver}
                onChange={(e) =>
                  setReceiver(e.target.value)
                }
                className="h-12 w-full rounded-xl border px-3"
              >
                <option value="">انتخاب مشتری</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {currencySelect(
                receiverCurrency,
                setReceiverCurrency
              )}

              <input
                readOnly
                value={receiverAmount}
                placeholder="مبلغ گیرنده"
                className="h-12 w-full rounded-xl border px-3 bg-gray-100"
              />
            </div>

          </div>

          {senderCurrency === receiverCurrency && (
            <div className="bg-gray-100 text-gray-700 rounded-xl p-4">
              ارز فرستنده و گیرنده یکسان است؛ مبلغ گیرنده برابر مبلغ فرستنده خواهد بود.
            </div>
          )}

          {transferUnsupported && (
            <div className="bg-red-50 text-red-700 rounded-xl p-4">
              برای تبدیل مستقیم بین دو ارز غیر افغانی، لطفاً یکی از ارزها را افغانی انتخاب کنید یا نسخه‌ای با چند نرخ همزمان استفاده کنید.
            </div>
          )}

          {!transferUnsupported && transferRateCurrency && (
            <div className="bg-purple-50 rounded-xl p-4 space-y-3">

              <b>نرخ دستی در برابر افغانی</b>

              <div className="flex flex-wrap items-center gap-2">

                <span className="whitespace-nowrap">
                  {fmt(rateUnits[transferRateCurrency])}{" "}
                  {labels[transferRateCurrency]} =
                </span>

                <input
                  type="number"
                  step="any"
                  value={transferRate}
                  onChange={(e) =>
                    setTransferRate(e.target.value)
                  }
                  placeholder="نرخ"
                  className="h-12 w-40 rounded-xl border px-3"
                />

                <span>{labels.AFN}</span>

              </div>

              <div className="text-xs text-gray-600">
                مثال: 1 دلار = 50 افغانی، 1000 تومان = 0.38 افغانی، 1000 کلدار = 250 افغانی
              </div>

              {transferRateValue > 0 && (
                <div className="font-bold text-purple-700">
                  نرخ ثبت‌شده:{" "}
                  {rateDescription(
                    transferRateValue,
                    transferRateCurrency
                  )}
                </div>
              )}

              {receiverAmount && (
                <div className="text-green-700 font-bold">
                  نتیجه: {receiverAmount}{" "}
                  {labels[receiverCurrency]}
                </div>
              )}

            </div>
          )}

          <input
            type="number"
            step="any"
            value={commission}
            onChange={(e) =>
              setCommission(e.target.value)
            }
            placeholder="کمیشن"
            className="h-12 w-full rounded-xl border px-3"
          />

          <button
            onClick={submitTransfer}
            disabled={!canSubmitTransfer}
            className="w-full h-12 rounded-xl bg-[#092F3A] text-white disabled:opacity-50"
          >
            ثبت انتقال
          </button>

        </div>
      )}

      {/* Balances */}

      <div className="bg-white rounded-2xl p-5 overflow-x-auto">

        <h2 className="font-bold text-lg mb-4">
          موجودی مشتریان
        </h2>

        <table className="w-full text-sm">

          <thead>
            <tr className="bg-gray-50">
              <th className="p-3 text-right">
                مشتری
              </th>

              {currencies.map((c) => (
                <th key={c} className="p-3 text-right">
                  {labels[c]}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>

            {customers.map((c) => {
              const b =
                currentBalances[c.id] || c.balances;

              return (
                <tr key={c.id} className="border-t">

                  <td className="p-3">
                    {c.name}
                  </td>

                  {currencies.map((cur) => (
                    <td key={cur} className="p-3">
                      {fmt(b[cur] || 0)}
                    </td>
                  ))}

                </tr>
              );
            })}

          </tbody>

        </table>

      </div>

      {/* Transactions */}

      <div className="bg-white rounded-2xl p-5 overflow-x-auto">

        <h2 className="font-bold text-lg mb-4">
          آخرین معاملات
        </h2>

        <table className="w-full text-sm">

          <thead>
            <tr className="bg-gray-50">

              <th className="p-3 text-right">
                سند
              </th>

              <th className="p-3 text-right">
                نوع
              </th>

              <th className="p-3 text-right">
                مشتری
              </th>

              <th className="p-3 text-right">
                دریافت / ارسال
              </th>

              <th className="p-3 text-right">
                پرداخت / دریافت
              </th>

              <th className="p-3 text-right">
                نرخ
              </th>

            </tr>
          </thead>

          <tbody>

            {transactions.map((tx) => (

              <tr
                key={tx.id}
                className="border-t"
              >

                <td className="p-3">
                  {tx.id}
                </td>

                <td className="p-3">
                  {tx.type === "exchange"
                    ? "صرافی با مشتری"
                    : "بین مشتریان"}
                </td>

                <td className="p-3">
                  {customerName(
                    tx.customerId || tx.senderId
                  )}
                </td>

                <td className="p-3">
                  {fmt(tx.fromAmount)}{" "}
                  {labels[tx.fromCurrency]}
                </td>

                <td className="p-3">
                  {fmt(tx.toAmount)}{" "}
                  {labels[tx.toCurrency]}
                </td>

                <td className="p-3">
                  {tx.rateCurrency
                    ? rateDescription(tx.rate, tx.rateCurrency)
                    : fmt(tx.rate)}
                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>
  );
}
