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
  rateLabel: string;
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
  واحد هر ارز:

  1 دلار = 1 واحد
  1 یورو = 1 واحد
  1000 تومان = 1 واحد
  1000 کلدار = 1 واحد

  نرخ‌ها همیشه در برابر افغانی تعریف می‌شوند:

  1 USD = 50 AFN
  1 EUR = 50 AFN
  1000 IRR = 0.38 AFN
  1000 PKR = 250 AFN
*/

const rateUnits: Record<Currency, number> = {
  AFN: 1,
  USD: 1,
  EUR: 1,
  IRR: 1000,
  PKR: 1000,
};

const defaultRates: Record<Currency, string> = {
  AFN: "1",
  USD: "50",
  EUR: "50",
  IRR: "0.38",
  PKR: "250",
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

const normalizeDigits = (s: string) =>
  s
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

const parseAmount = (v: string) => {
  const s = normalizeDigits(String(v || "")).replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const fmt = (n: number) =>
  Number.isFinite(n)
    ? n.toLocaleString("en-US", { maximumFractionDigits: 8 })
    : "0";

const newId = () =>
  `EX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

function getNumericRates(
  rates: Record<Currency, string>
): Record<Currency, number> {
  return {
    AFN: 1,
    USD: parseAmount(rates.USD),
    EUR: parseAmount(rates.EUR),
    IRR: parseAmount(rates.IRR),
    PKR: parseAmount(rates.PKR),
  };
}

/*
  تبدیل ارز به افغانی

  مثال:
  1000 USD -> AFN
  1000 / 1 * 50 = 50000 AFN

  1000000 IRR -> AFN
  1000000 / 1000 * 0.38 = 380 AFN
*/
function toAfn(
  amount: number,
  currency: Currency,
  rates: Record<Currency, number>
) {
  if (!Number.isFinite(amount) || amount === 0) return 0;
  if (currency === "AFN") return amount;

  const unit = rateUnits[currency] || 1;
  const rate = rates[currency];

  if (!Number.isFinite(rate) || rate <= 0) return 0;

  return (amount / unit) * rate;
}

/*
  تبدیل افغانی به ارز مقصد

  مثال:
  50000 AFN -> USD
  50000 / 50 * 1 = 1000 USD

  380 AFN -> IRR
  380 / 0.38 * 1000 = 1000000 IRR
*/
function fromAfn(
  amountAfn: number,
  currency: Currency,
  rates: Record<Currency, number>
) {
  if (!Number.isFinite(amountAfn) || amountAfn === 0) return 0;
  if (currency === "AFN") return amountAfn;

  const unit = rateUnits[currency] || 1;
  const rate = rates[currency];

  if (!Number.isFinite(rate) || rate <= 0) return 0;

  return (amountAfn / rate) * unit;
}

/*
  تبدیل کامل بین دو ارز

  مرحله اول:
  FROM -> AFN

  مرحله دوم:
  AFN -> TO

  مثال:
  EUR -> USD
  EUR -> AFN -> USD

  PKR -> IRR
  PKR -> AFN -> IRR
*/
function convertCurrency(
  amount: number,
  from: Currency,
  to: Currency,
  rates: Record<Currency, number>
) {
  if (!Number.isFinite(amount) || amount === 0) return 0;
  if (from === to) return amount;

  const afn = toAfn(amount, from, rates);
  if (!afn) return 0;

  return fromAfn(afn, to, rates);
}

function missingRates(
  from: Currency,
  to: Currency,
  rates: Record<Currency, number>
): Currency[] {
  if (from === to) return [];

  return [from, to].filter(
    (c) => c !== "AFN" && (!rates[c] || rates[c] <= 0)
  );
}

function formatRate(rate: number) {
  return rate > 0 ? fmt(rate) : "نامشخص";
}

function usedRatesLabel(
  from: Currency,
  to: Currency,
  rates: Record<Currency, number>
) {
  if (from === to) {
    return `بدون تبدیل (${labels[from]})`;
  }

  const parts: string[] = [];

  if (from !== "AFN") {
    parts.push(
      `${fmt(rateUnits[from])} ${labels[from]} = ${formatRate(
        rates[from]
      )} ${labels.AFN}`
    );
  }

  if (to !== "AFN") {
    parts.push(
      `${fmt(rateUnits[to])} ${labels[to]} = ${formatRate(
        rates[to]
      )} ${labels.AFN}`
    );
  }

  return parts.length ? parts.join(" | ") : "AFN = AFN";
}

function crossRatePreview(
  from: Currency,
  to: Currency,
  rates: Record<Currency, number>
) {
  if (from === to) return "";

  const unit = rateUnits[from] || 1;
  const result = convertCurrency(unit, from, to, rates);

  if (!result) return "";

  return `${fmt(unit)} ${labels[from]} ≈ ${fmt(result)} ${labels[to]}`;
}

export default function CurrencyExchangePage() {
  const [customers] = useState<Customer[]>(initialCustomers);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [tab, setTab] = useState<"exchange" | "transfer">("exchange");

  const [rates, setRates] =
    useState<Record<Currency, string>>(defaultRates);

  /* ---------------- Exchange ---------------- */

  const [customer, setCustomer] = useState("");

  const [receivedCurrency, setReceivedCurrency] =
    useState<Currency>("AFN");
  const [receivedAmount, setReceivedAmount] = useState("");

  const [paidCurrency, setPaidCurrency] =
    useState<Currency>("USD");
  const [paidAmount, setPaidAmount] = useState("");

  /* ---------------- Transfer ---------------- */

  const [sender, setSender] = useState("");
  const [receiver, setReceiver] = useState("");

  const [senderCurrency, setSenderCurrency] =
    useState<Currency>("AFN");
  const [receiverCurrency, setReceiverCurrency] =
    useState<Currency>("AFN");

  const [senderAmount, setSenderAmount] = useState("");
  const [receiverAmount, setReceiverAmount] = useState("");

  const [commission, setCommission] = useState("0");

  const numericRates = getNumericRates(rates);

  function setRate(currency: Currency, value: string) {
    setRates((prev) => ({
      ...prev,
      [currency]: value,
    }));
  }

  /* ---------------- Exchange Calculation ---------------- */

  useEffect(() => {
    const amount = parseAmount(receivedAmount);

    if (!amount) {
      setPaidAmount("");
      return;
    }

    const nr = getNumericRates(rates);
    const result = convertCurrency(
      amount,
      receivedCurrency,
      paidCurrency,
      nr
    );

    setPaidAmount(result ? fmt(result) : "");
  }, [receivedAmount, receivedCurrency, paidCurrency, rates]);

  /* ---------------- Transfer Calculation ---------------- */

  useEffect(() => {
    const amount = parseAmount(senderAmount);

    if (!amount) {
      setReceiverAmount("");
      return;
    }

    const nr = getNumericRates(rates);
    const result = convertCurrency(
      amount,
      senderCurrency,
      receiverCurrency,
      nr
    );

    setReceiverAmount(result ? fmt(result) : "");
  }, [senderAmount, senderCurrency, receiverCurrency, rates]);

  /* ---------------- Exchange Submit ---------------- */

  const exchangeFromAmount = parseAmount(receivedAmount);
  const exchangeToAmount = parseAmount(paidAmount);
  const exchangeMissing = missingRates(
    receivedCurrency,
    paidCurrency,
    numericRates
  );

  const exchangeCrossPreview = crossRatePreview(
    receivedCurrency,
    paidCurrency,
    numericRates
  );

  const canSubmitExchange =
    !!customer &&
    exchangeFromAmount > 0 &&
    exchangeToAmount > 0 &&
    exchangeMissing.length === 0;

  function submitExchange() {
    if (!canSubmitExchange) return;

    const fromAmount = exchangeFromAmount;
    const toAmount = exchangeToAmount;

    const tx: Transaction = {
      id: newId(),
      type: "exchange",
      date: new Date().toISOString(),
      customerId: customer,
      fromCurrency: receivedCurrency,
      fromAmount,
      toCurrency: paidCurrency,
      toAmount,
      rateLabel: usedRatesLabel(
        receivedCurrency,
        paidCurrency,
        numericRates
      ),
      status: "active",
    };

    setTransactions((x) => [tx, ...x]);

    setCustomer("");
    setReceivedAmount("");
    setPaidAmount("");
  }

  /* ---------------- Transfer Submit ---------------- */

  const transferFromAmount = parseAmount(senderAmount);
  const transferToAmount = parseAmount(receiverAmount);
  const commissionValue = Math.max(0, parseAmount(commission));

  const transferMissing = missingRates(
    senderCurrency,
    receiverCurrency,
    numericRates
  );

  const transferCrossPreview = crossRatePreview(
    senderCurrency,
    receiverCurrency,
    numericRates
  );

  const canSubmitTransfer =
    !!sender &&
    !!receiver &&
    sender !== receiver &&
    transferFromAmount > 0 &&
    transferToAmount > 0 &&
    transferMissing.length === 0;

  function submitTransfer() {
    if (!canSubmitTransfer) return;

    const fromAmount = transferFromAmount;
    const toAmount = transferToAmount;

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
      rateLabel: usedRatesLabel(
        senderCurrency,
        receiverCurrency,
        numericRates
      ),
      commission: commissionValue,
      commissionCurrency: senderCurrency,
      status: "active",
    };

    setTransactions((x) => [tx, ...x]);

    setSender("");
    setReceiver("");
    setSenderAmount("");
    setReceiverAmount("");
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

      {/* Rates */}

      <div className="bg-white rounded-2xl p-5 space-y-4">

        <h2 className="font-bold text-lg">
          نرخ‌های پایه در برابر افغانی
        </h2>

        <div className="text-sm text-gray-600">
          فرمول تبدیل: ارز مبدا → افغانی → ارز مقصد. با این روش می‌توانید هر ارز را به هر ارز دیگر تبدیل کنید.
        </div>

        <div className="grid md:grid-cols-4 gap-4">

          {currencies
            .filter((c) => c !== "AFN")
            .map((c) => (
              <div key={c} className="space-y-2">

                <label className="text-sm font-bold">
                  {fmt(rateUnits[c])} {labels[c]} =
                </label>

                <div className="flex items-center gap-2">

                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={rates[c]}
                    onChange={(e) =>
                      setRate(c, e.target.value)
                    }
                    className="h-12 w-full rounded-xl border px-3"
                  />

                  <span className="whitespace-nowrap">
                    {labels.AFN}
                  </span>

                </div>

              </div>
            ))}

        </div>

      </div>

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
                min="0"
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

            <b>خلاصه تبدیل</b>

            <div className="text-sm text-blue-800">
              {usedRatesLabel(
                receivedCurrency,
                paidCurrency,
                numericRates
              )}
            </div>

            {exchangeCrossPreview && (
              <div className="text-sm text-blue-700">
                نرخ تقریبی: {exchangeCrossPreview}
              </div>
            )}

            {exchangeMissing.length > 0 && (
              <div className="text-red-600 text-sm">
                نرخ‌های واردنشده:{" "}
                {exchangeMissing
                  .map((c) => labels[c])
                  .join("، ")}
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
                min="0"
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

            <b>خلاصه تبدیل</b>

            <div className="text-sm text-purple-800">
              {usedRatesLabel(
                senderCurrency,
                receiverCurrency,
                numericRates
              )}
            </div>

            {transferCrossPreview && (
              <div className="text-sm text-purple-700">
                نرخ تقریبی: {transferCrossPreview}
              </div>
            )}

            {transferMissing.length > 0 && (
              <div className="text-red-600 text-sm">
                نرخ‌های واردنشده:{" "}
                {transferMissing
                  .map((c) => labels[c])
                  .join("، ")}
              </div>
            )}

            {receiverAmount && (
              <div className="text-green-700 font-bold">
                نتیجه: {receiverAmount}{" "}
                {labels[receiverCurrency]}
              </div>
            )}

          </div>

          <input
            type="number"
            step="any"
            min="0"
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
                نرخ‌های استفاده‌شده
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

                <td className="p-3 text-xs">
                  {tx.rateLabel}
                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>
  );
}
