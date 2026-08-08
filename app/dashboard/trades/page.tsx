"use client";

import { useEffect, useState } from "react";

type Currency = "AFN" | "USD" | "IRR" | "PKR";

type Customer = {
  id: string;
  name: string;
  balances: Record<string, number>;
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
  commission?: number;
  commissionCurrency?: Currency;
  profit?: number;
  profitCurrency?: Currency;
  status: "active" | "voided";
};

const currencies: Currency[] = ["AFN", "USD", "IRR", "PKR"];

const labels: Record<Currency, string> = {
  AFN: "افغانی",
  USD: "دالر",
  IRR: "تومان",
  PKR: "کلدار",
};

/*
  نرخ همیشه به شکل زیر ثبت می‌شود:

  1 USD = 50 AFN
  1000 IRR = 0.38 AFN
  1 PKR = 0.45 AFN

  یعنی RATE همیشه مقدار ارز مقابل برای یک واحد/واحد استاندارد ارز مبنا است.
*/

const rateUnits: Record<Currency, number> = {
  AFN: 1,
  USD: 1,
  IRR: 1000,
  PKR: 1,
};

const initialCustomers: Customer[] = [
  {
    id: "1",
    name: "احمد رحیمی",
    balances: { AFN: 500000, USD: 10000, IRR: 0, PKR: 0 },
  },
  {
    id: "2",
    name: "محمد ظاهر",
    balances: { AFN: 200000, USD: 5000, IRR: 0, PKR: 0 },
  },
  {
    id: "3",
    name: "فاطمه حسینی",
    balances: { AFN: 0, USD: 0, IRR: 50000000, PKR: 0 },
  },
];

const fmt = (n: number) =>
  Number.isFinite(n)
    ? n.toLocaleString("en-US", { maximumFractionDigits: 8 })
    : "0";

const newId = () =>
  `EX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

/*
  تابع اصلی محاسبه ارز

  مثال:
  AFN -> USD
  50000 AFN / 50 = 1000 USD

  USD -> AFN
  1000 USD * 50 = 50000 AFN

  IRR نیز بر اساس 1000 تومان محاسبه می‌شود.
*/
function convert(
  amount: number,
  from: Currency,
  to: Currency,
  rate: number
) {
  if (!amount || !rate || rate <= 0) return 0;
  if (from === to) return amount;

  const fromUnit = rateUnits[from];
  const toUnit = rateUnits[to];

  /*
    نرخ یعنی:
    fromUnit از ارز مبدا = rate از ارز مقصد

    مثال:
    1 USD = 50 AFN
    1000 IRR = 0.38 AFN
  */

  return (amount / fromUnit) * rate / toUnit;
}

/*
  محاسبه با توجه به جهت واقعی معامله.

  اگر کاربر نرخ را این‌گونه وارد کند:

  USD -> AFN
  1 USD = 50 AFN

  و معامله برعکس باشد:

  AFN -> USD

  سیستم خودکار می‌کند:

  amount / 50
*/
function calculateAmount(
  amount: number,
  from: Currency,
  to: Currency,
  rate: number,
  rateFrom: Currency
) {
  if (!amount || !rate) return 0;

  if (from === rateFrom) {
    return convert(amount, from, to, rate);
  }

  /*
    جهت معامله برعکس است.
    ضریب معکوس فقط داخلی استفاده می‌شود.
    به کاربر 0.02 نمایش داده نمی‌شود.
  */

  const fromUnit = rateUnits[rateFrom];
  const toUnit = rateUnits[to];

  return (amount / toUnit) / rate * fromUnit;
}

function rateDescription(
  rate: number,
  rateFrom: Currency,
  rateTo: Currency
) {
  return `${rateUnits[rateFrom].toLocaleString()} ${labels[rateFrom]} = ${fmt(
    rate
  )} ${labels[rateTo]}`;
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

  /*
    نرخ همیشه دستی وارد می‌شود.
    مثال:
    USD = 50 AFN
  */
  const [rate, setRate] = useState("");

  /*
    ارز مبنای نرخ فقط برای محاسبه داخلی است.
    کاربر دیگر "مبنای نرخ" را انتخاب نمی‌کند.
    سیستم از جهت ارزهای انتخاب‌شده استفاده می‌کند.
  */
  const [rateFrom, setRateFrom] = useState<Currency>("USD");

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
  const [transferRateFrom, setTransferRateFrom] =
    useState<Currency>("AFN");

  const [commission, setCommission] = useState("0");

  /* ---------------- Exchange Calculation ---------------- */

  useEffect(() => {
    const amount = Number(receivedAmount);
    const r = Number(rate);

    if (!amount || !r) {
      setPaidAmount("");
      return;
    }

    const result = calculateAmount(
      amount,
      receivedCurrency,
      paidCurrency,
      r,
      rateFrom
    );

    setPaidAmount(fmt(result));
  }, [
    receivedAmount,
    receivedCurrency,
    paidCurrency,
    rate,
    rateFrom,
  ]);

  /* ---------------- Transfer Calculation ---------------- */

  useEffect(() => {
    const amount = Number(senderAmount);
    const r = Number(transferRate);

    if (!amount || !r) {
      setReceiverAmount("");
      return;
    }

    const result = calculateAmount(
      amount,
      senderCurrency,
      receiverCurrency,
      r,
      transferRateFrom
    );

    setReceiverAmount(fmt(result));
  }, [
    senderAmount,
    senderCurrency,
    receiverCurrency,
    transferRate,
    transferRateFrom,
  ]);

  /* ---------------- Submit Exchange ---------------- */

  function submitExchange() {
    if (!customer || !receivedAmount || !rate) return;

    const tx: Transaction = {
      id: newId(),
      type: "exchange",
      date: new Date().toISOString(),
      customerId: customer,
      fromCurrency: receivedCurrency,
      fromAmount: Number(receivedAmount),
      toCurrency: paidCurrency,
      toAmount: Number(paidAmount),
      rate: Number(rate),
      status: "active",
    };

    setTransactions((x) => [tx, ...x]);

    setCustomer("");
    setReceivedAmount("");
    setPaidAmount("");
    setRate("");
  }

  /* ---------------- Submit Transfer ---------------- */

  function submitTransfer() {
    if (
      !sender ||
      !receiver ||
      sender === receiver ||
      !senderAmount ||
      !transferRate
    )
      return;

    const tx: Transaction = {
      id: newId(),
      type: "transfer",
      date: new Date().toISOString(),
      senderId: sender,
      receiverId: receiver,
      fromCurrency: senderCurrency,
      fromAmount: Number(senderAmount),
      toCurrency: receiverCurrency,
      toAmount: Number(receiverAmount),
      rate: Number(transferRate),
      commission: Number(commission) || 0,
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
    const result: Record<string, Record<string, number>> = {};

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

          <div className="bg-blue-50 rounded-xl p-4 space-y-3">

            <b>نرخ دستی</b>

            <div className="grid md:grid-cols-2 gap-3">

              {currencySelect(
                rateFrom,
                setRateFrom
              )}

              <input
                type="number"
                step="any"
                value={rate}
                onChange={(e) =>
                  setRate(e.target.value)
                }
                placeholder="نرخ"
                className="h-12 rounded-xl border px-3"
              />

            </div>

            {rate && (
              <div className="font-bold text-blue-700">
                نرخ ثبت‌شده:{" "}
                {rateDescription(
                  Number(rate),
                  rateFrom,
                  rateFrom === receivedCurrency
                    ? paidCurrency
                    : receivedCurrency
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

          <button
            onClick={submitExchange}
            className="w-full h-12 rounded-xl bg-[#092F3A] text-white"
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

          <div className="bg-purple-50 rounded-xl p-4 space-y-3">

            <b>نرخ دستی</b>

            <div className="grid md:grid-cols-2 gap-3">

              {currencySelect(
                transferRateFrom,
                setTransferRateFrom
              )}

              <input
                type="number"
                step="any"
                value={transferRate}
                onChange={(e) =>
                  setTransferRate(e.target.value)
                }
                placeholder="نرخ"
                className="h-12 rounded-xl border px-3"
              />

            </div>

            {transferRate && (
              <div className="font-bold text-purple-700">
                نرخ:{" "}
                {rateDescription(
                  Number(transferRate),
                  transferRateFrom,
                  transferRateFrom === senderCurrency
                    ? receiverCurrency
                    : senderCurrency
                )}
              </div>
            )}

          </div>

          <input
            type="number"
            value={commission}
            onChange={(e) =>
              setCommission(e.target.value)
            }
            placeholder="کمیشن"
            className="h-12 w-full rounded-xl border px-3"
          />

          <button
            onClick={submitTransfer}
            className="w-full h-12 rounded-xl bg-[#092F3A] text-white"
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
                  {fmt(tx.rate)}
                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>
  );
}
