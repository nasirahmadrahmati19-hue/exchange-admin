"use client";

import { useEffect, useState } from "react";

type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";

type RateMode = "same" | "afn" | "direct";

type DealType = "buy" | "sell";

type Customer = {
  id: string;
  name: string;
  balances: Record<Currency, number>;
};

type Transaction = {
  id: string;
  type: "exchange" | "transfer";
  dealType?: DealType;
  date: string;
  customerId?: string;
  senderId?: string;
  receiverId?: string;
  fromCurrency: Currency;
  fromAmount: number;
  toCurrency: Currency;
  toAmount: number;
  rate: number;
  rateLabel: string;
  rateBase?: Currency;
  commission?: number;
  commissionCurrency?: Currency;
  description?: string;
  status: "active" | "voided";
};

type ExchangeFormErrors = {
  dealType?: string;
  customer?: string;
  receivedAmount?: string;
  rate?: string;
  paidAmount?: string;
};

type TransferFormErrors = {
  sender?: string;
  receiver?: string;
  senderAmount?: string;
  transferRate?: string;
  receiverAmount?: string;
};

const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];

const labels: Record<Currency, string> = {
  AFN: "افغانی",
  USD: "دالر",
  EUR: "یورو",
  IRR: "تومان",
  PKR: "کلدار",
};

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

const normalizeDigits = (s: string) =>
  s
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

function toNumericText(v: string) {
  let s = normalizeDigits(String(v || "")).replace(/[^0-9.]/g, "");

  const firstDot = s.indexOf(".");

  if (firstDot !== -1) {
    s =
      s.slice(0, firstDot + 1) +
      s.slice(firstDot + 1).replace(/\./g, "");
  }

  return s;
}

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

function shortId(id: string) {
  return id.slice(-6);
}

function formatDateTime(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function dateLabel(s: string) {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "-" : formatDateTime(d);
}

function dealTypeLabel(d?: DealType) {
  if (d === "buy") return "خرید";
  if (d === "sell") return "فروش";
  return "-";
}

function getRateMode(from: Currency, to: Currency): RateMode {
  if (from === to) return "same";
  if (from === "AFN" || to === "AFN") return "afn";
  return "direct";
}

function getAfnForeign(
  from: Currency,
  to: Currency
): Currency | null {
  if (from === to) return null;
  if (from === "AFN") return to;
  if (to === "AFN") return from;
  return null;
}

function preferredDirectBase(
  a: Currency,
  b: Currency
): Currency {
  const priority: Currency[] = ["USD", "EUR", "PKR", "IRR"];

  for (const c of priority) {
    if (a === c) return c;
    if (b === c) return c;
  }

  return a;
}

function getSafeDirectBase(
  baseState: Currency,
  a: Currency,
  b: Currency
): Currency {
  if (a === baseState || b === baseState) return baseState;
  return preferredDirectBase(a, b);
}

function getDirectCounter(
  base: Currency,
  a: Currency,
  b: Currency
): Currency | null {
  if (a === base) return b;
  if (b === base) return a;
  return null;
}

function convertAfnRate(
  amount: number,
  from: Currency,
  to: Currency,
  rate: number
) {
  if (!Number.isFinite(amount) || amount === 0) return 0;
  if (from === to) return amount;
  if (!Number.isFinite(rate) || rate <= 0) return 0;

  const foreign = getAfnForeign(from, to);
  if (!foreign) return 0;

  const unit = rateUnits[foreign] || 1;

  if (from === "AFN" && to === foreign) {
    return (amount / rate) * unit;
  }

  if (from === foreign && to === "AFN") {
    return (amount / unit) * rate;
  }

  return 0;
}

function convertDirectRate(
  amount: number,
  from: Currency,
  to: Currency,
  base: Currency,
  rate: number
) {
  if (!Number.isFinite(amount) || amount === 0) return 0;
  if (from === to) return amount;
  if (!Number.isFinite(rate) || rate <= 0) return 0;

  const counter = getDirectCounter(base, from, to);
  if (!counter) return 0;

  const unitBase = rateUnits[base] || 1;

  if (from === base) {
    return (amount / unitBase) * rate;
  }

  if (to === base) {
    return (amount / rate) * unitBase;
  }

  return 0;
}

function afnRateLabel(foreign: Currency, rate: number) {
  return `${fmt(rateUnits[foreign])} ${labels[foreign]} = ${fmt(
    rate
  )} ${labels.AFN}`;
}

function directRateLabel(
  base: Currency,
  counter: Currency,
  rate: number
) {
  return `${fmt(rateUnits[base])} ${labels[base]} = ${fmt(
    rate
  )} ${labels[counter]}`;
}

export default function CurrencyExchangePage() {
  const [customers] = useState<Customer[]>(initialCustomers);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [tab, setTab] = useState<"exchange" | "transfer">("exchange");

  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());

    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const currentDateTime = now ? formatDateTime(now) : "";

  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);

  const [editingExchangeId, setEditingExchangeId] = useState<
    string | null
  >(null);

  const [editingTransferId, setEditingTransferId] = useState<
    string | null
  >(null);

  const [search, setSearch] = useState("");

  /* ---------------- Exchange ---------------- */

  const [customer, setCustomer] = useState("");

  const [exchangeDealType, setExchangeDealType] = useState<
    DealType | ""
  >("");

  const [exchangeCommission, setExchangeCommission] = useState("");
  const [exchangeDescription, setExchangeDescription] = useState("");

  const [receivedCurrency, setReceivedCurrency] =
    useState<Currency>("AFN");
  const [receivedAmount, setReceivedAmount] = useState("");

  const [paidCurrency, setPaidCurrency] =
    useState<Currency>("USD");
  const [paidAmount, setPaidAmount] = useState("");

  const [rate, setRate] = useState("");
  const [exchangeDirectBase, setExchangeDirectBase] =
    useState<Currency>("USD");

  const [exchangeErrors, setExchangeErrors] =
    useState<ExchangeFormErrors>({});

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
  const [transferDirectBase, setTransferDirectBase] =
    useState<Currency>("USD");

  const [commission, setCommission] = useState("");
  const [transferDescription, setTransferDescription] = useState("");

  const [transferErrors, setTransferErrors] =
    useState<TransferFormErrors>({});

  /* ---------------- Exchange Mode ---------------- */

  const exchangeMode = getRateMode(
    receivedCurrency,
    paidCurrency
  );

  const exchangeForeign = getAfnForeign(
    receivedCurrency,
    paidCurrency
  );

  const exchangeDirectBaseValue =
    exchangeMode === "direct"
      ? getSafeDirectBase(
          exchangeDirectBase,
          receivedCurrency,
          paidCurrency
        )
      : receivedCurrency;

  const exchangeDirectCounter =
    exchangeMode === "direct"
      ? getDirectCounter(
          exchangeDirectBaseValue,
          receivedCurrency,
          paidCurrency
        )
      : null;

  useEffect(() => {
    if (
      exchangeMode === "direct" &&
      exchangeDirectBase !== exchangeDirectBaseValue
    ) {
      setExchangeDirectBase(exchangeDirectBaseValue);
    }
  }, [
    exchangeMode,
    exchangeDirectBase,
    exchangeDirectBaseValue,
  ]);

  useEffect(() => {
    setRate("");
  }, [
    exchangeMode,
    exchangeForeign,
    exchangeDirectBaseValue,
    exchangeDirectCounter,
  ]);

  /* ---------------- Transfer Mode ---------------- */

  const transferMode = getRateMode(
    senderCurrency,
    receiverCurrency
  );

  const transferForeign = getAfnForeign(
    senderCurrency,
    receiverCurrency
  );

  const transferDirectBaseValue =
    transferMode === "direct"
      ? getSafeDirectBase(
          transferDirectBase,
          senderCurrency,
          receiverCurrency
        )
      : senderCurrency;

  const transferDirectCounter =
    transferMode === "direct"
      ? getDirectCounter(
          transferDirectBaseValue,
          senderCurrency,
          receiverCurrency
        )
      : null;

  useEffect(() => {
    if (
      transferMode === "direct" &&
      transferDirectBase !== transferDirectBaseValue
    ) {
      setTransferDirectBase(transferDirectBaseValue);
    }
  }, [
    transferMode,
    transferDirectBase,
    transferDirectBaseValue,
  ]);

  useEffect(() => {
    setTransferRate("");
  }, [
    transferMode,
    transferForeign,
    transferDirectBaseValue,
    transferDirectCounter,
  ]);

  /* ---------------- Exchange Calculation ---------------- */

  useEffect(() => {
    const amount = parseAmount(receivedAmount);

    if (!amount) {
      setPaidAmount("");
      return;
    }

    if (exchangeMode === "same") {
      setPaidAmount(fmt(amount));
      return;
    }

    const r = parseAmount(rate);

    if (!r) {
      setPaidAmount("");
      return;
    }

    let result = 0;

    if (exchangeMode === "afn") {
      result = convertAfnRate(
        amount,
        receivedCurrency,
        paidCurrency,
        r
      );
    }

    if (
      exchangeMode === "direct" &&
      exchangeDirectCounter
    ) {
      result = convertDirectRate(
        amount,
        receivedCurrency,
        paidCurrency,
        exchangeDirectBaseValue,
        r
      );
    }

    setPaidAmount(result ? fmt(result) : "");
  }, [
    receivedAmount,
    receivedCurrency,
    paidCurrency,
    rate,
    exchangeMode,
    exchangeDirectBaseValue,
    exchangeDirectCounter,
  ]);

  /* ---------------- Transfer Calculation ---------------- */

  useEffect(() => {
    const amount = parseAmount(senderAmount);

    if (!amount) {
      setReceiverAmount("");
      return;
    }

    if (transferMode === "same") {
      setReceiverAmount(fmt(amount));
      return;
    }

    const r = parseAmount(transferRate);

    if (!r) {
      setReceiverAmount("");
      return;
    }

    let result = 0;

    if (transferMode === "afn") {
      result = convertAfnRate(
        amount,
        senderCurrency,
        receiverCurrency,
        r
      );
    }

    if (
      transferMode === "direct" &&
      transferDirectCounter
    ) {
      result = convertDirectRate(
        amount,
        senderCurrency,
        receiverCurrency,
        transferDirectBaseValue,
        r
      );
    }

    setReceiverAmount(result ? fmt(result) : "");
  }, [
    senderAmount,
    senderCurrency,
    receiverCurrency,
    transferRate,
    transferMode,
    transferDirectBaseValue,
    transferDirectCounter,
  ]);

  /* ---------------- Reset Forms ---------------- */

  function resetExchangeForm() {
    setCustomer("");
    setExchangeDealType("");
    setReceivedAmount("");
    setPaidAmount("");
    setRate("");
    setExchangeCommission("");
    setExchangeDescription("");
    setExchangeErrors({});
    setEditingExchangeId(null);
  }

  function resetTransferForm() {
    setSender("");
    setReceiver("");
    setSenderAmount("");
    setReceiverAmount("");
    setTransferRate("");
    setCommission("");
    setTransferDescription("");
    setTransferErrors({});
    setEditingTransferId(null);
  }

  /* ---------------- Exchange Validation ---------------- */

  function validateExchange(): ExchangeFormErrors {
    const errs: ExchangeFormErrors = {};

    if (!exchangeDealType) {
      errs.dealType = "فیلد نوع معامله خالی است.";
    }

    if (!customer) {
      errs.customer = "فیلد مشتری خالی است.";
    }

    const amount = parseAmount(receivedAmount);

    if (!amount) {
      errs.receivedAmount = "مبلغ دریافتی خالی یا صفر است.";
    }

    if (exchangeMode !== "same") {
      const r = parseAmount(rate);

      if (!r) {
        errs.rate =
          exchangeMode === "afn"
            ? "نرخ در برابر افغانی خالی است."
            : "نرخ مستقیم خالی است.";
      }

      if (exchangeMode === "direct" && !exchangeDirectCounter) {
        errs.rate = "مبنای نرخ مستقیم معتبر نیست.";
      }
    }

    if (amount) {
      const paid = parseAmount(paidAmount);

      if (!paid) {
        errs.paidAmount =
          exchangeMode === "same"
            ? "مبلغ پرداختی محاسبه نشد."
            : "مبلغ پرداختی محاسبه نشد؛ لطفاً نرخ را بررسی کنید.";
      }
    }

    return errs;
  }

  /* ---------------- Transfer Validation ---------------- */

  function validateTransfer(): TransferFormErrors {
    const errs: TransferFormErrors = {};

    if (!sender) {
      errs.sender = "فیلد فرستنده خالی است.";
    }

    if (!receiver) {
      errs.receiver = "فیلد گیرنده خالی است.";
    }

    if (sender && receiver && sender === receiver) {
      errs.receiver = "فرستنده و گیرنده نباید یکسان باشند.";
    }

    const amount = parseAmount(senderAmount);

    if (!amount) {
      errs.senderAmount = "مبلغ فرستنده خالی یا صفر است.";
    }

    if (transferMode !== "same") {
      const r = parseAmount(transferRate);

      if (!r) {
        errs.transferRate =
          transferMode === "afn"
            ? "نرخ در برابر افغانی خالی است."
            : "نرخ مستقیم خالی است.";
      }

      if (transferMode === "direct" && !transferDirectCounter) {
        errs.transferRate = "مبنای نرخ مستقیم معتبر نیست.";
      }
    }

    if (amount) {
      const received = parseAmount(receiverAmount);

      if (!received) {
        errs.receiverAmount =
          transferMode === "same"
            ? "مبلغ گیرنده محاسبه نشد."
            : "مبلغ گیرنده محاسبه نشد؛ لطفاً نرخ را بررسی کنید.";
      }
    }

    return errs;
  }

  /* ---------------- Exchange Submit ---------------- */

  const exchangeFromAmount = parseAmount(receivedAmount);
  const exchangeToAmount = parseAmount(paidAmount);
  const exchangeRateValue = parseAmount(rate);
  const exchangeCommissionValue = Math.max(
    0,
    parseAmount(exchangeCommission)
  );

  const exchangeRateBase =
    exchangeMode === "direct"
      ? exchangeDirectBaseValue
      : undefined;

  function submitExchange() {
    const errs = validateExchange();
    setExchangeErrors(errs);

    const hasError = Object.values(errs).some((x) => Boolean(x));
    if (hasError) return;

    const fromAmount = exchangeFromAmount;
    const toAmount = exchangeToAmount;

    const txRate =
      exchangeMode === "same" ? 1 : exchangeRateValue;

    let rateLabel = "";

    if (exchangeMode === "same") {
      rateLabel = "بدون تبدیل";
    }

    if (exchangeMode === "afn" && exchangeForeign) {
      rateLabel = afnRateLabel(exchangeForeign, txRate);
    }

    if (
      exchangeMode === "direct" &&
      exchangeDirectCounter
    ) {
      rateLabel = directRateLabel(
        exchangeDirectBaseValue,
        exchangeDirectCounter,
        txRate
      );
    }

    const description =
      exchangeDescription.trim() || undefined;

    if (editingExchangeId) {
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === editingExchangeId
            ? {
                ...t,
                type: "exchange",
                dealType: exchangeDealType as DealType,
                customerId: customer,
                fromCurrency: receivedCurrency,
                fromAmount,
                toCurrency: paidCurrency,
                toAmount,
                rate: txRate,
                rateLabel,
                rateBase: exchangeRateBase,
                commission: exchangeCommissionValue,
                commissionCurrency: receivedCurrency,
                description,
              }
            : t
        )
      );
    } else {
      const tx: Transaction = {
        id: newId(),
        type: "exchange",
        dealType: exchangeDealType as DealType,
        date: new Date().toISOString(),
        customerId: customer,
        fromCurrency: receivedCurrency,
        fromAmount,
        toCurrency: paidCurrency,
        toAmount,
        rate: txRate,
        rateLabel,
        rateBase: exchangeRateBase,
        commission: exchangeCommissionValue,
        commissionCurrency: receivedCurrency,
        description,
        status: "active",
      };

      setTransactions((x) => [tx, ...x]);
    }

    resetExchangeForm();
  }

  /* ---------------- Transfer Submit ---------------- */

  const transferFromAmount = parseAmount(senderAmount);
  const transferToAmount = parseAmount(receiverAmount);
  const transferRateValue = parseAmount(transferRate);
  const commissionValue = Math.max(0, parseAmount(commission));

  const transferRateBase =
    transferMode === "direct"
      ? transferDirectBaseValue
      : undefined;

  function submitTransfer() {
    const errs = validateTransfer();
    setTransferErrors(errs);

    const hasError = Object.values(errs).some((x) => Boolean(x));
    if (hasError) return;

    const fromAmount = transferFromAmount;
    const toAmount = transferToAmount;

    const txRate =
      transferMode === "same" ? 1 : transferRateValue;

    let rateLabel = "";

    if (transferMode === "same") {
      rateLabel = "بدون تبدیل";
    }

    if (transferMode === "afn" && transferForeign) {
      rateLabel = afnRateLabel(transferForeign, txRate);
    }

    if (
      transferMode === "direct" &&
      transferDirectCounter
    ) {
      rateLabel = directRateLabel(
        transferDirectBaseValue,
        transferDirectCounter,
        txRate
      );
    }

    const description =
      transferDescription.trim() || undefined;

    if (editingTransferId) {
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === editingTransferId
            ? {
                ...t,
                type: "transfer",
                senderId: sender,
                receiverId: receiver,
                fromCurrency: senderCurrency,
                fromAmount,
                toCurrency: receiverCurrency,
                toAmount,
                rate: txRate,
                rateLabel,
                rateBase: transferRateBase,
                commission: commissionValue,
                commissionCurrency: senderCurrency,
                description,
              }
            : t
        )
      );
    } else {
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
        rateLabel,
        rateBase: transferRateBase,
        commission: commissionValue,
        commissionCurrency: senderCurrency,
        description,
        status: "active",
      };

      setTransactions((x) => [tx, ...x]);
    }

    resetTransferForm();
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

        if (tx.commission && tx.commissionCurrency) {
          b[tx.commissionCurrency] =
            (b[tx.commissionCurrency] || 0) - tx.commission;
        }

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

  function transactionCustomerLabel(tx: Transaction) {
    if (tx.type === "exchange") {
      return customerName(tx.customerId);
    }

    return `${customerName(tx.senderId)} - ${customerName(
      tx.receiverId
    )}`;
  }

  function transactionTypeLabel(tx: Transaction) {
    if (tx.type === "exchange") {
      return dealTypeLabel(tx.dealType);
    }

    return "انتقال";
  }

  /* ---------------- Search ---------------- */

  const rawSearch = normalizeDigits(search.trim()).toLowerCase();
  const amountSearch = rawSearch.replace(/[,،]/g, "");
  const isSearching = amountSearch.trim().length > 0;

  function transactionMatchesSearch(tx: Transaction) {
    if (!isSearching) return true;

    const names = [
      customerName(tx.customerId),
      customerName(tx.senderId),
      customerName(tx.receiverId),
      transactionCustomerLabel(tx),
    ];

    const nameMatch = names.some((n) =>
      normalizeDigits(n)
        .toLowerCase()
        .includes(rawSearch)
    );

    if (nameMatch) return true;

    const amounts = [
      tx.fromAmount,
      tx.toAmount,
      tx.commission || 0,
    ];

    const amountMatch = amounts.some((a) => {
      const plain = normalizeDigits(String(a));
      const formatted = normalizeDigits(fmt(a)).replace(/,/g, "");

      return (
        plain.includes(amountSearch) ||
        formatted.includes(amountSearch)
      );
    });

    return amountMatch;
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

  const exchangeErrorList = Object.values(exchangeErrors).filter(
    (msg): msg is string => Boolean(msg)
  );

  const transferErrorList = Object.values(transferErrors).filter(
    (msg): msg is string => Boolean(msg)
  );

  const editingExchangeTransaction = transactions.find(
    (t) => t.id === editingExchangeId
  );

  const editingTransferTransaction = transactions.find(
    (t) => t.id === editingTransferId
  );

  const exchangeDateDisplay = editingExchangeTransaction
    ? dateLabel(editingExchangeTransaction.date)
    : currentDateTime;

  const transferDateDisplay = editingTransferTransaction
    ? dateLabel(editingTransferTransaction.date)
    : currentDateTime;

  /* ---------------- Transactions Actions ---------------- */

  function editTransaction(tx: Transaction) {
    if (tx.status === "voided") return;

    if (tx.type === "exchange") {
      setTab("exchange");
      setEditingTransferId(null);
      setEditingExchangeId(tx.id);

      setCustomer(tx.customerId || "");
      setExchangeDealType(tx.dealType || "");
      setReceivedCurrency(tx.fromCurrency);
      setPaidCurrency(tx.toCurrency);
      setReceivedAmount(String(tx.fromAmount));
      setExchangeCommission(
        tx.commission ? String(tx.commission) : ""
      );
      setExchangeDescription(tx.description || "");
      setRate(String(tx.rate));

      const mode = getRateMode(tx.fromCurrency, tx.toCurrency);

      if (mode === "direct") {
        setExchangeDirectBase(
          tx.rateBase ||
            preferredDirectBase(tx.fromCurrency, tx.toCurrency)
        );
      }

      setExchangeErrors({});
    }

    if (tx.type === "transfer") {
      setTab("transfer");
      setEditingExchangeId(null);
      setEditingTransferId(tx.id);

      setSender(tx.senderId || "");
      setReceiver(tx.receiverId || "");
      setSenderCurrency(tx.fromCurrency);
      setReceiverCurrency(tx.toCurrency);
      setSenderAmount(String(tx.fromAmount));
      setCommission(tx.commission ? String(tx.commission) : "");
      setTransferDescription(tx.description || "");
      setTransferRate(String(tx.rate));

      const mode = getRateMode(tx.fromCurrency, tx.toCurrency);

      if (mode === "direct") {
        setTransferDirectBase(
          tx.rateBase ||
            preferredDirectBase(tx.fromCurrency, tx.toCurrency)
        );
      }

      setTransferErrors({});
    }
  }

  function viewTransaction(tx: Transaction) {
    setSelectedTransaction(tx);
  }

  function voidTransaction(tx: Transaction) {
    if (tx.status === "voided") return;

    const ok = window.confirm(
      "آیا مطمئن هستید که این معامله لغو شود؟"
    );

    if (!ok) return;

    setTransactions((prev) =>
      prev.map((t) =>
        t.id === tx.id ? { ...t, status: "voided" } : t
      )
    );

    if (editingExchangeId === tx.id) {
      setEditingExchangeId(null);
    }

    if (editingTransferId === tx.id) {
      setEditingTransferId(null);
    }
  }

  function printReceipt(tx: Transaction) {
    const win = window.open(
      "",
      "_blank",
      "width=650,height=800"
    );

    if (!win) return;

    const customerLabel = transactionCustomerLabel(tx);

    const commissionLabel = tx.commission
      ? `${fmt(tx.commission)} ${
          tx.commissionCurrency
            ? labels[tx.commissionCurrency]
            : ""
        }`
      : "-";

    const statusLabel =
      tx.status === "voided" ? "لغو شده" : "فعال";

    const descriptionLabel = tx.description || "-";

    const html = `
      <html dir="rtl">
        <head>
          <meta charset="utf-8" />
          <title>رسید معامله</title>
          <style>
            body {
              font-family: Tahoma, Arial, sans-serif;
              padding: 24px;
              direction: rtl;
            }
            h2 {
              margin-bottom: 16px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            td, th {
              border: 1px solid #ccc;
              padding: 8px;
              text-align: right;
            }
          </style>
        </head>
        <body>
          <h2>رسید معامله</h2>
          <table>
            <tr>
              <th>شماره</th>
              <td>${tx.id}</td>
            </tr>
            <tr>
              <th>تاریخ</th>
              <td>${dateLabel(tx.date)}</td>
            </tr>
            <tr>
              <th>نوع معامله</th>
              <td>${transactionTypeLabel(tx)}</td>
            </tr>
            <tr>
              <th>مشتری</th>
              <td>${customerLabel}</td>
            </tr>
            <tr>
              <th>دریافت</th>
              <td>${fmt(tx.fromAmount)} ${labels[tx.fromCurrency]}</td>
            </tr>
            <tr>
              <th>پرداخت</th>
              <td>${fmt(tx.toAmount)} ${labels[tx.toCurrency]}</td>
            </tr>
            <tr>
              <th>نرخ ارز</th>
              <td>${tx.rateLabel}</td>
            </tr>
            <tr>
              <th>کارمزد</th>
              <td>${commissionLabel}</td>
            </tr>
            <tr>
              <th>توضیحات</th>
              <td>${descriptionLabel}</td>
            </tr>
            <tr>
              <th>وضعیت</th>
              <td>${statusLabel}</td>
            </tr>
          </table>
        </body>
      </html>
    `;

    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  const actionButtonClass =
    "w-full rounded-lg px-3 py-2 text-right text-sm bg-gray-50 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed";

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

          {editingExchangeId && (
            <div className="bg-yellow-50 text-yellow-800 rounded-xl p-4 flex items-center justify-between gap-3">

              <span>
                در حال ویرایش معامله{" "}
                {shortId(editingExchangeId)}. تاریخ اصلی حفظ می‌شود.
              </span>

              <button
                onClick={resetExchangeForm}
                className="shrink-0 font-bold"
              >
                انصراف
              </button>

            </div>
          )}

          <div className="grid md:grid-cols-3 gap-4">

            <div className="space-y-2">

              <label className="text-sm font-bold">
                تاریخ و ساعت {editingExchangeId ? "(اصل)" : "(خودکار)"}
              </label>

              <input
                readOnly
                value={exchangeDateDisplay}
                className="h-12 w-full md:w-72 rounded-xl border px-3 bg-gray-100"
              />

            </div>

            <div className="space-y-2">

              <label className="text-sm font-bold">
                نوع معامله
              </label>

              <select
                value={exchangeDealType}
                onChange={(e) => {
                  setExchangeDealType(
                    e.target.value as DealType | ""
                  );

                  setExchangeErrors((prev) => ({
                    ...prev,
                    dealType: undefined,
                  }));
                }}
                className={`h-12 w-full md:w-56 rounded-xl border px-3 ${
                  exchangeErrors.dealType
                    ? "border-red-500"
                    : ""
                }`}
              >
                <option value="">انتخاب نوع معامله</option>
                <option value="buy">خرید</option>
                <option value="sell">فروش</option>
              </select>

            </div>

            <div className="space-y-2">

              <label className="text-sm font-bold">
                جستجو
              </label>

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-12 w-full rounded-xl border px-3"
              />

            </div>

          </div>

          <div className="space-y-2">

            <label className="text-sm font-bold">
              مشتری
            </label>

            <select
              value={customer}
              onChange={(e) => {
                setCustomer(e.target.value);

                setExchangeErrors((prev) => ({
                  ...prev,
                  customer: undefined,
                }));
              }}
              className={`h-12 w-full md:w-56 rounded-xl border px-3 ${
                exchangeErrors.customer
                  ? "border-red-500"
                  : ""
              }`}
            >
              <option value="">انتخاب مشتری</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

          </div>

          <div className="grid md:grid-cols-2 gap-4">

            <div className="space-y-3">

              <b>دریافت از مشتری</b>

              <div className="space-y-2">

                <label className="text-sm font-bold">
                  ارز دریافتی
                </label>

                {currencySelect(
                  receivedCurrency,
                  (v) => {
                    setReceivedCurrency(v);

                    setExchangeErrors((prev) => ({
                      ...prev,
                      rate: undefined,
                      paidAmount: undefined,
                    }));
                  }
                )}

              </div>

              <div className="space-y-2">

                <label className="text-sm font-bold">
                  مبلغ دریافتی
                </label>

                <input
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  value={receivedAmount}
                  onChange={(e) => {
                    setReceivedAmount(
                      toNumericText(e.target.value)
                    );

                    setExchangeErrors((prev) => ({
                      ...prev,
                      receivedAmount: undefined,
                      paidAmount: undefined,
                    }));
                  }}
                  className={`h-12 w-full rounded-xl border px-3 text-left ${
                    exchangeErrors.receivedAmount
                      ? "border-red-500"
                      : ""
                  }`}
                />

              </div>

            </div>

            <div className="space-y-3">

              <b>پرداخت به مشتری</b>

              <div className="space-y-2">

                <label className="text-sm font-bold">
                  ارز پرداختی
                </label>

                {currencySelect(
                  paidCurrency,
                  (v) => {
                    setPaidCurrency(v);

                    setExchangeErrors((prev) => ({
                      ...prev,
                      rate: undefined,
                      paidAmount: undefined,
                    }));
                  }
                )}

              </div>

              <div className="space-y-2">

                <label className="text-sm font-bold">
                  مبلغ پرداختی
                </label>

                <input
                  readOnly
                  value={paidAmount}
                  className={`h-12 w-full rounded-xl border px-3 bg-gray-100 text-left ${
                    exchangeErrors.paidAmount
                      ? "border-red-500"
                      : ""
                  }`}
                />

              </div>

            </div>

          </div>

          {exchangeMode === "same" && (
            <div className="bg-gray-100 text-gray-700 rounded-xl p-4">
              ارز دریافت و پرداخت یکسان است؛ مبلغ پرداختی برابر مبلغ دریافتی خواهد بود.
            </div>
          )}

          {exchangeMode === "afn" && exchangeForeign && (
            <div className="bg-blue-50 rounded-xl p-4 space-y-3">

              <b>نرخ دستی در برابر افغانی</b>

              <div className="space-y-2">

                <label className="text-sm font-bold">
                  نرخ
                </label>

                <div className="flex flex-wrap items-center gap-2">

                  <span className="whitespace-nowrap">
                    {fmt(rateUnits[exchangeForeign])}{" "}
                    {labels[exchangeForeign]} =
                  </span>

                  <input
                    type="text"
                    inputMode="decimal"
                    dir="ltr"
                    value={rate}
                    onChange={(e) => {
                      setRate(toNumericText(e.target.value));

                      setExchangeErrors((prev) => ({
                        ...prev,
                        rate: undefined,
                        paidAmount: undefined,
                      }));
                    }}
                    className={`h-12 w-44 rounded-xl border px-3 text-left ${
                      exchangeErrors.rate
                        ? "border-red-500"
                        : ""
                    }`}
                  />

                  <span>{labels.AFN}</span>

                </div>

              </div>

              {exchangeRateValue > 0 && (
                <div className="font-bold text-blue-700">
                  نرخ ثبت‌شده:{" "}
                  {afnRateLabel(
                    exchangeForeign,
                    exchangeRateValue
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

          {exchangeMode === "direct" && (
            <div className="bg-amber-50 rounded-xl p-4 space-y-3">

              <b>نرخ مستقیم جفت‌ارز</b>

              <div className="grid md:grid-cols-2 gap-4 items-end">

                <div className="space-y-2">

                  <label className="text-sm font-bold">
                    مبنای نرخ
                  </label>

                  <select
                    value={exchangeDirectBaseValue}
                    onChange={(e) => {
                      setExchangeDirectBase(
                        e.target.value as Currency
                      );

                      setExchangeErrors((prev) => ({
                        ...prev,
                        rate: undefined,
                        paidAmount: undefined,
                      }));
                    }}
                    className="h-12 w-full rounded-xl border px-3"
                  >
                    {[receivedCurrency, paidCurrency].map((c) => (
                      <option key={c} value={c}>
                        {labels[c]}
                      </option>
                    ))}
                  </select>

                </div>

                <div className="space-y-2">

                  <label className="text-sm font-bold">
                    نرخ مستقیم
                  </label>

                  <div className="flex flex-wrap items-center gap-2">

                    <span className="whitespace-nowrap">
                      {fmt(rateUnits[exchangeDirectBaseValue])}{" "}
                      {labels[exchangeDirectBaseValue]} =
                    </span>

                    <input
                      type="text"
                      inputMode="decimal"
                      dir="ltr"
                      value={rate}
                      onChange={(e) => {
                        setRate(toNumericText(e.target.value));

                        setExchangeErrors((prev) => ({
                          ...prev,
                          rate: undefined,
                          paidAmount: undefined,
                        }));
                      }}
                      className={`h-12 w-44 rounded-xl border px-3 text-left ${
                        exchangeErrors.rate
                          ? "border-red-500"
                          : ""
                      }`}
                    />

                    <span>
                      {exchangeDirectCounter
                        ? labels[exchangeDirectCounter]
                        : ""}
                    </span>

                  </div>

                </div>

              </div>

              {exchangeRateValue > 0 &&
                exchangeDirectCounter && (
                  <div className="font-bold text-amber-700">
                    نرخ ثبت‌شده:{" "}
                    {directRateLabel(
                      exchangeDirectBaseValue,
                      exchangeDirectCounter,
                      exchangeRateValue
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

          <div className="grid md:grid-cols-2 gap-4">

            <div className="space-y-2">

              <label className="text-sm font-bold">
                کارمزد
              </label>

              <input
                type="text"
                inputMode="decimal"
                dir="ltr"
                value={exchangeCommission}
                onChange={(e) =>
                  setExchangeCommission(
                    toNumericText(e.target.value)
                  )
                }
                className="h-12 w-full md:w-40 rounded-xl border px-3 text-left"
              />

              <div className="text-xs text-gray-600">
                کارمزد از ارز دریافتی ({labels[receivedCurrency]}) کسر می‌شود.
              </div>

            </div>

            <div className="space-y-2">

              <label className="text-sm font-bold">
                توضیحات
              </label>

              <input
                type="text"
                value={exchangeDescription}
                onChange={(e) =>
                  setExchangeDescription(e.target.value)
                }
                className="h-12 w-full rounded-xl border px-3"
              />

            </div>

          </div>

          {exchangeErrorList.length > 0 && (
            <div className="bg-red-50 text-red-700 rounded-xl p-4 space-y-2">

              <b>لطفاً این فیلدها را تکمیل کنید:</b>

              <ul className="list-disc pr-5 space-y-1">
                {exchangeErrorList.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>

            </div>
          )}

          <button
            onClick={submitExchange}
            className="w-full h-12 rounded-xl bg-[#092F3A] text-white"
          >
            {editingExchangeId
              ? "به‌روزرسانی معامله"
              : "ثبت معامله"}
          </button>

        </div>
      )}

      {/* Transfer */}

      {tab === "transfer" && (
        <div className="bg-white rounded-2xl p-5 space-y-5">

          <h2 className="font-bold text-lg">
            تبادل بین حساب مشتریان
          </h2>

          {editingTransferId && (
            <div className="bg-yellow-50 text-yellow-800 rounded-xl p-4 flex items-center justify-between gap-3">

              <span>
                در حال ویرایش انتقال{" "}
                {shortId(editingTransferId)}. تاریخ اصلی حفظ می‌شود.
              </span>

              <button
                onClick={resetTransferForm}
                className="shrink-0 font-bold"
              >
                انصراف
              </button>

            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">

            <div className="space-y-2">

              <label className="text-sm font-bold">
                تاریخ و ساعت {editingTransferId ? "(اصل)" : "(خودکار)"}
              </label>

              <input
                readOnly
                value={transferDateDisplay}
                className="h-12 w-full md:w-72 rounded-xl border px-3 bg-gray-100"
              />

            </div>

            <div className="space-y-2">

              <label className="text-sm font-bold">
                جستجو
              </label>

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-12 w-full rounded-xl border px-3"
              />

            </div>

          </div>

          <div className="grid md:grid-cols-2 gap-4">

            <div className="space-y-3">

              <b>فرستنده</b>

              <div className="space-y-2">

                <label className="text-sm font-bold">
                  مشتری فرستنده
                </label>

                <select
                  value={sender}
                  onChange={(e) => {
                    setSender(e.target.value);

                    setTransferErrors((prev) => ({
                      ...prev,
                      sender: undefined,
                    }));
                  }}
                  className={`h-12 w-full rounded-xl border px-3 ${
                    transferErrors.sender
                      ? "border-red-500"
                      : ""
                  }`}
                >
                  <option value="">انتخاب مشتری</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

              </div>

              <div className="space-y-2">

                <label className="text-sm font-bold">
                  ارز فرستنده
                </label>

                {currencySelect(
                  senderCurrency,
                  (v) => {
                    setSenderCurrency(v);

                    setTransferErrors((prev) => ({
                      ...prev,
                      transferRate: undefined,
                      receiverAmount: undefined,
                    }));
                  }
                )}

              </div>

              <div className="space-y-2">

                <label className="text-sm font-bold">
                  مبلغ فرستنده
                </label>

                <input
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  value={senderAmount}
                  onChange={(e) => {
                    setSenderAmount(
                      toNumericText(e.target.value)
                    );

                    setTransferErrors((prev) => ({
                      ...prev,
                      senderAmount: undefined,
                      receiverAmount: undefined,
                    }));
                  }}
                  className={`h-12 w-full rounded-xl border px-3 text-left ${
                    transferErrors.senderAmount
                      ? "border-red-500"
                      : ""
                  }`}
                />

              </div>

            </div>

            <div className="space-y-3">

              <b>گیرنده</b>

              <div className="space-y-2">

                <label className="text-sm font-bold">
                  مشتری گیرنده
                </label>

                <select
                  value={receiver}
                  onChange={(e) => {
                    setReceiver(e.target.value);

                    setTransferErrors((prev) => ({
                      ...prev,
                      receiver: undefined,
                    }));
                  }}
                  className={`h-12 w-full rounded-xl border px-3 ${
                    transferErrors.receiver
                      ? "border-red-500"
                      : ""
                  }`}
                >
                  <option value="">انتخاب مشتری</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

              </div>

              <div className="space-y-2">

                <label className="text-sm font-bold">
                  ارز گیرنده
                </label>

                {currencySelect(
                  receiverCurrency,
                  (v) => {
                    setReceiverCurrency(v);

                    setTransferErrors((prev) => ({
                      ...prev,
                      transferRate: undefined,
                      receiverAmount: undefined,
                    }));
                  }
                )}

              </div>

              <div className="space-y-2">

                <label className="text-sm font-bold">
                  مبلغ گیرنده
                </label>

                <input
                  readOnly
                  value={receiverAmount}
                  className={`h-12 w-full rounded-xl border px-3 bg-gray-100 text-left ${
                    transferErrors.receiverAmount
                      ? "border-red-500"
                      : ""
                  }`}
                />

              </div>

            </div>

          </div>

          {transferMode === "same" && (
            <div className="bg-gray-100 text-gray-700 rounded-xl p-4">
              ارز فرستنده و گیرنده یکسان است؛ مبلغ گیرنده برابر مبلغ فرستنده خواهد بود.
            </div>
          )}

          {transferMode === "afn" && transferForeign && (
            <div className="bg-purple-50 rounded-xl p-4 space-y-3">

              <b>نرخ دستی در برابر افغانی</b>

              <div className="space-y-2">

                <label className="text-sm font-bold">
                  نرخ
                </label>

                <div className="flex flex-wrap items-center gap-2">

                  <span className="whitespace-nowrap">
                    {fmt(rateUnits[transferForeign])}{" "}
                    {labels[transferForeign]} =
                  </span>

                  <input
                    type="text"
                    inputMode="decimal"
                    dir="ltr"
                    value={transferRate}
                    onChange={(e) => {
                      setTransferRate(
                        toNumericText(e.target.value)
                      );

                      setTransferErrors((prev) => ({
                        ...prev,
                        transferRate: undefined,
                        receiverAmount: undefined,
                      }));
                    }}
                    className={`h-12 w-44 rounded-xl border px-3 text-left ${
                      transferErrors.transferRate
                        ? "border-red-500"
                        : ""
                    }`}
                  />

                  <span>{labels.AFN}</span>

                </div>

              </div>

              {transferRateValue > 0 && (
                <div className="font-bold text-purple-700">
                  نرخ ثبت‌شده:{" "}
                  {afnRateLabel(
                    transferForeign,
                    transferRateValue
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

          {transferMode === "direct" && (
            <div className="bg-fuchsia-50 rounded-xl p-4 space-y-3">

              <b>نرخ مستقیم جفت‌ارز</b>

              <div className="grid md:grid-cols-2 gap-4 items-end">

                <div className="space-y-2">

                  <label className="text-sm font-bold">
                    مبنای نرخ
                  </label>

                  <select
                    value={transferDirectBaseValue}
                    onChange={(e) => {
                      setTransferDirectBase(
                        e.target.value as Currency
                      );

                      setTransferErrors((prev) => ({
                        ...prev,
                        transferRate: undefined,
                        receiverAmount: undefined,
                      }));
                    }}
                    className="h-12 w-full rounded-xl border px-3"
                  >
                    {[senderCurrency, receiverCurrency].map((c) => (
                      <option key={c} value={c}>
                        {labels[c]}
                      </option>
                    ))}
                  </select>

                </div>

                <div className="space-y-2">

                  <label className="text-sm font-bold">
                    نرخ مستقیم
                  </label>

                  <div className="flex flex-wrap items-center gap-2">

                    <span className="whitespace-nowrap">
                      {fmt(rateUnits[transferDirectBaseValue])}{" "}
                      {labels[transferDirectBaseValue]} =
                    </span>

                    <input
                      type="text"
                      inputMode="decimal"
                      dir="ltr"
                      value={transferRate}
                      onChange={(e) => {
                        setTransferRate(
                          toNumericText(e.target.value)
                        );

                        setTransferErrors((prev) => ({
                          ...prev,
                          transferRate: undefined,
                          receiverAmount: undefined,
                        }));
                      }}
                      className={`h-12 w-44 rounded-xl border px-3 text-left ${
                        transferErrors.transferRate
                          ? "border-red-500"
                          : ""
                      }`}
                    />

                    <span>
                      {transferDirectCounter
                        ? labels[transferDirectCounter]
                        : ""}
                    </span>

                  </div>

                </div>

              </div>

              {transferRateValue > 0 &&
                transferDirectCounter && (
                  <div className="font-bold text-fuchsia-700">
                    نرخ ثبت‌شده:{" "}
                    {directRateLabel(
                      transferDirectBaseValue,
                      transferDirectCounter,
                      transferRateValue
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

          <div className="grid md:grid-cols-2 gap-4">

            <div className="space-y-2">

              <label className="text-sm font-bold">
                کارمزد
              </label>

              <input
                type="text"
                inputMode="decimal"
                dir="ltr"
                value={commission}
                onChange={(e) =>
                  setCommission(toNumericText(e.target.value))
                }
                className="h-12 w-full md:w-40 rounded-xl border px-3 text-left"
              />

              <div className="text-xs text-gray-600">
                کارمزد از ارز فرستنده ({labels[senderCurrency]}) کسر می‌شود.
              </div>

            </div>

            <div className="space-y-2">

              <label className="text-sm font-bold">
                توضیحات
              </label>

              <input
                type="text"
                value={transferDescription}
                onChange={(e) =>
                  setTransferDescription(e.target.value)
                }
                className="h-12 w-full rounded-xl border px-3"
              />

            </div>

          </div>

          {transferErrorList.length > 0 && (
            <div className="bg-red-50 text-red-700 rounded-xl p-4 space-y-2">

              <b>لطفاً این فیلدها را تکمیل کنید:</b>

              <ul className="list-disc pr-5 space-y-1">
                {transferErrorList.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>

            </div>
          )}

          <button
            onClick={submitTransfer}
            className="w-full h-12 rounded-xl bg-[#092F3A] text-white"
          >
            {editingTransferId
              ? "به‌روزرسانی انتقال"
              : "ثبت انتقال"}
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

      <div className="bg-white rounded-2xl p-5 overflow-x-auto space-y-4">

        <h2 className="font-bold text-lg">
          آخرین معاملات
        </h2>

        <table className="w-full text-sm">

          <thead>
            <tr className="bg-gray-50">

              <th className="p-3 text-right">
                شماره
              </th>

              <th className="p-3 text-right">
                نام مشتری
              </th>

              <th className="p-3 text-right">
                تاریخ
              </th>

              <th className="p-3 text-right">
                نوع معامله
              </th>

              <th className="p-3 text-right">
                دریافت
              </th>

              <th className="p-3 text-right">
                پرداخت
              </th>

              <th className="p-3 text-right">
                نرخ ارز
              </th>

              <th className="p-3 text-right">
                کارمزد
              </th>

              <th className="p-3 text-right">
                عملیات
              </th>

            </tr>
          </thead>

          <tbody>

            {transactions.map((tx, index) => {
              const matchesSearch =
                transactionMatchesSearch(tx);

              let rowClass = "border-t";

              if (isSearching) {
                if (matchesSearch) {
                  rowClass += " bg-yellow-100";
                } else {
                  rowClass += " opacity-30";
                }

                if (tx.status === "voided") {
                  rowClass += " text-gray-400";
                }
              } else {
                if (tx.status === "voided") {
                  rowClass += " bg-red-50 text-gray-400";
                }
              }

              return (
                <tr
                  key={tx.id}
                  className={rowClass}
                >

                  <td className="p-3">
                    {transactions.length - index}
                  </td>

                  <td className="p-3">
                    {transactionCustomerLabel(tx)}
                  </td>

                  <td className="p-3 whitespace-nowrap">
                    {dateLabel(tx.date)}
                  </td>

                  <td className="p-3">
                    {transactionTypeLabel(tx)}

                    {tx.status === "voided" && (
                      <span className="text-red-500">
                        {" "}
                        (لغو شده)
                      </span>
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

                  <td className="p-3">
                    {tx.commission
                      ? `${fmt(tx.commission)} ${
                          tx.commissionCurrency
                            ? labels[tx.commissionCurrency]
                            : ""
                        }`
                      : "-"}
                  </td>

                  <td className="p-3">

                    <details className="relative">

                      <summary className="cursor-pointer select-none text-sm text-blue-700">
                        عملیات
                      </summary>

                      <ul className="mt-2 min-w-40 space-y-1 rounded-xl border bg-white p-2 shadow-sm">

                        <li>
                          <button
                            onClick={() => editTransaction(tx)}
                            disabled={tx.status === "voided"}
                            className={actionButtonClass}
                          >
                            ویرایش
                          </button>
                        </li>

                        <li>
                          <button
                            onClick={() => printReceipt(tx)}
                            className={actionButtonClass}
                          >
                            چاپ رسید
                          </button>
                        </li>

                        <li>
                          <button
                            onClick={() => viewTransaction(tx)}
                            className={actionButtonClass}
                          >
                            مشاهده
                          </button>
                        </li>

                        <li>
                          <button
                            onClick={() => voidTransaction(tx)}
                            disabled={tx.status === "voided"}
                            className={`${actionButtonClass} text-red-600`}
                          >
                            لغو معامله
                          </button>
                        </li>

                      </ul>

                    </details>

                  </td>

                </tr>
              );
            })}

          </tbody>

        </table>

      </div>

      {/* View Modal */}

      {selectedTransaction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedTransaction(null)}
        >

          <div
            className="w-full max-w-lg rounded-2xl bg-white p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >

            <div className="flex items-center justify-between">

              <b>جزئیات معامله</b>

              <button
                onClick={() => setSelectedTransaction(null)}
                className="text-gray-500"
              >
                ✕
              </button>

            </div>

            <div className="text-sm space-y-2">

              <div className="flex justify-between gap-4">
                <span className="text-gray-500">شماره:</span>
                <span>{selectedTransaction.id}</span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-gray-500">تاریخ:</span>
                <span>{dateLabel(selectedTransaction.date)}</span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-gray-500">نوع معامله:</span>
                <span>
                  {transactionTypeLabel(selectedTransaction)}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-gray-500">نام مشتری:</span>
                <span>
                  {transactionCustomerLabel(selectedTransaction)}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-gray-500">دریافت:</span>
                <span>
                  {fmt(selectedTransaction.fromAmount)}{" "}
                  {labels[selectedTransaction.fromCurrency]}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-gray-500">پرداخت:</span>
                <span>
                  {fmt(selectedTransaction.toAmount)}{" "}
                  {labels[selectedTransaction.toCurrency]}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-gray-500">نرخ ارز:</span>
                <span>{selectedTransaction.rateLabel}</span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-gray-500">کارمزد:</span>
                <span>
                  {selectedTransaction.commission
                    ? `${fmt(selectedTransaction.commission)} ${
                        selectedTransaction.commissionCurrency
                          ? labels[
                              selectedTransaction
                                .commissionCurrency
                            ]
                          : ""
                      }`
                    : "-"}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-gray-500">توضیحات:</span>
                <span>
                  {selectedTransaction.description || "-"}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-gray-500">وضعیت:</span>
                <span>
                  {selectedTransaction.status === "voided"
                    ? "لغو شده"
                    : "فعال"}
                </span>
              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}
