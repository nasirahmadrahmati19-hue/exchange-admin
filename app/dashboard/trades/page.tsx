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
  exchangeCommission?: string;
};

type TransferFormErrors = {
  sender?: string;
  receiver?: string;
  senderAmount?: string;
  transferRate?: string;
  receiverAmount?: string;
  commission?: string;
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

/* ---------------- تاریخ هجری شمسی ---------------- */

function shamsiParts(d: Date) {
  const parts = new Intl.DateTimeFormat(
    "en-US-u-ca-persian-nu-latn",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(d);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value || "0";

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
  };
}

function formatDateTime(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");

  const s = shamsiParts(d);

  return `${s.year}/${s.month}/${s.day} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
}

const shamsiMonthNames = [
  "حمل",
  "ثور",
  "جوزا",
  "سرطان",
  "اسد",
  "سنبله",
  "میزان",
  "عقرب",
  "قوس",
  "جدی",
  "دلو",
  "حوت",
];

function shamsiMonthLabel(d: Date) {
  const s = shamsiParts(d);
  const m = parseInt(s.month, 10);
  const day = parseInt(s.day, 10);

  if (!Number.isFinite(m) || m < 1 || m > 12) return "";
  if (!Number.isFinite(day)) return "";

  return `${day} ${shamsiMonthNames[m - 1]} ${s.year}`;
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

/* ============================================================
   UI ONLY — آیکون‌ها و اجزای نمایشی
   ============================================================ */

const iconPaths = {
  swap: "M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5",
  users:
    "M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z",
  sun: "M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z",
  moon:
    "M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z",
  clock: "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  search:
    "m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z",
  chevron: "m19.5 8.25-7.5 7.5-7.5-7.5",
  pencil:
    "m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10",
  printer:
    "M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z",
  eye: "M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  x: "M6 18 18 6M6 6l12 12",
  xCircle:
    "m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  check:
    "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  alert:
    "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z",
  doc: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
  inbox:
    "M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z",
  arrowLeft: "M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18",
  down: "M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3",
  up: "M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18",
  rate: "M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941",
  info: "m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z",
};

type IconName = keyof typeof iconPaths;

function Ic({
  n,
  className = "h-5 w-5",
}: {
  n: IconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={iconPaths[n]} />
    </svg>
  );
}

function DetailRow({
  label,
  value,
  valueClass = "",
  dark = false,
}: {
  label: string;
  value: string;
  valueClass?: string;
  dark?: boolean;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 border-b border-dashed py-3 last:border-0 ${
        dark ? "border-slate-700/60" : "border-slate-200"
      }`}
    >
      <span
        className={`shrink-0 text-[11px] font-black ${
          dark ? "text-slate-500" : "text-slate-400"
        }`}
      >
        {label}
      </span>
      <span
        className={`text-left text-[13px] font-bold ${
          dark ? "text-slate-200" : "text-slate-700"
        } ${valueClass}`}
      >
        {value}
      </span>
    </div>
  );
}

export default function CurrencyExchangePage() {
  const [customers] = useState<Customer[]>(initialCustomers);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [tab, setTab] = useState<"exchange" | "transfer">("exchange");

  const [now, setNow] = useState<Date | null>(null);

  /* ---------------- Theme (UI only) ---------------- */

  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("fx-theme");
      if (saved === "dark" || saved === "light") setTheme(saved);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("fx-theme", theme);
    } catch {}
  }, [theme]);

  const dk = theme === "dark";

  /* ---------------- Theme tokens (UI only) ---------------- */

  const heading = dk ? "text-white" : "text-slate-900";
  const subText = dk ? "text-slate-500" : "text-slate-400";
  const iconMuted = dk ? "text-slate-500" : "text-slate-400";

  const glassChip = dk
    ? "border-slate-700/80 bg-[#0e1a28]/85"
    : "border-slate-200/90 bg-white/85";

  const uiCard = `rounded-2xl border backdrop-blur transition-colors duration-300 ${
    dk
      ? "border-slate-800 bg-[#0e1a28]/90 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.75)]"
      : "border-slate-200/90 bg-white/90 shadow-[0_16px_40px_-28px_rgba(9,47,58,0.45)]"
  }`;

  const inputShell = `rounded-xl border text-sm font-medium shadow-sm outline-none transition-all duration-200 focus:ring-4 ${
    dk
      ? "border-slate-700 bg-[#0b1622] text-slate-100 placeholder:text-slate-500 hover:border-slate-500 focus:border-teal-400 focus:ring-teal-400/10"
      : "border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 hover:border-slate-400 focus:border-teal-600 focus:ring-teal-600/10"
  }`;

  const uiInput = `h-12 w-full px-3.5 ${inputShell}`;

  const errInput = dk
    ? "border-rose-500/70 hover:border-rose-400 focus:border-rose-400 focus:ring-rose-500/10"
    : "border-rose-400 hover:border-rose-500 focus:border-rose-500 focus:ring-rose-500/10";

  const roInput = dk
    ? "cursor-default bg-[#0c1826] text-slate-400 hover:border-slate-700 focus:border-slate-700 focus:ring-0"
    : "cursor-default bg-slate-100 text-slate-500 hover:border-slate-300 focus:border-slate-300 focus:ring-0";

  const uiLabel = `mb-1.5 block text-[11px] font-black tracking-wide ${
    dk ? "text-slate-400" : "text-slate-500"
  }`;

  const rateChip = `flex h-12 items-center whitespace-nowrap rounded-xl border px-3.5 text-sm font-bold shadow-sm ${
    dk
      ? "border-slate-700 bg-[#0b1622]/85 text-slate-200"
      : "border-slate-200/80 bg-white/85 text-slate-700"
  }`;

  function typeChipClass(tx: Transaction) {
    if (tx.type === "transfer") {
      return dk
        ? "bg-violet-400/10 text-violet-300 ring-1 ring-violet-400/20"
        : "bg-violet-500/10 text-violet-700 ring-1 ring-violet-500/25";
    }

    if (tx.dealType === "buy") {
      return dk
        ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/20"
        : "bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/25";
    }

    if (tx.dealType === "sell") {
      return dk
        ? "bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/20"
        : "bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/25";
    }

    return dk
      ? "bg-slate-400/10 text-slate-300 ring-1 ring-slate-400/20"
      : "bg-slate-500/10 text-slate-600 ring-1 ring-slate-500/20";
  }

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

    if (exchangeCommission.trim().length === 0) {
      errs.exchangeCommission = "فیلد کارمزد خالی است.";
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

    if (commission.trim().length === 0) {
      errs.commission = "فیلد کارمزد خالی است.";
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

  /* ---------------- Names & Labels ---------------- */

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

  function transactionCommissionLabel(tx: Transaction) {
    if (tx.commission === undefined) return "-";

    return `${fmt(tx.commission)} ${
      tx.commissionCurrency
        ? labels[tx.commissionCurrency]
        : ""
    }`;
  }

  /* ---------------- Search ---------------- */

  const rawSearch = normalizeDigits(search.trim()).toLowerCase();
  const amountSearch = rawSearch.replace(/[,،]/g, "");
  const isSearching = amountSearch.trim().length > 0;

  const activeCount = transactions.filter(
    (t) => t.status === "active"
  ).length;
  const voidedCount = transactions.length - activeCount;

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
      <div className="relative">
        <select
          value={value}
          onChange={(e) =>
            change(e.target.value as Currency)
          }
          className={`${uiInput} cursor-pointer appearance-none pl-9`}
        >
          {currencies.map((c) => (
            <option key={c} value={c}>
              {labels[c]}
            </option>
          ))}
        </select>
        <span className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${iconMuted}`}>
          <Ic n="chevron" className="h-4 w-4" />
        </span>
      </div>
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
        tx.commission ? String(tx.commission) : "0"
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
      setCommission(tx.commission ? String(tx.commission) : "0");
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
    const commissionLabel = transactionCommissionLabel(tx);
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
              <th>تاریخ (هجری شمسی)</th>
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

  const actionButtonClass = `flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-right text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
    dk
      ? "text-slate-300 hover:bg-teal-400/10 hover:text-teal-300"
      : "text-slate-600 hover:bg-teal-500/10 hover:text-teal-700"
  }`;

  const dangerActionButtonClass = `flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-right text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
    dk
      ? "text-rose-400 hover:bg-rose-400/10"
      : "text-rose-600 hover:bg-rose-500/10"
  }`;

  return (
    <div dir="rtl" className={dk ? "dark" : ""}>
      <style>{`
        @import url("https://fonts.googleapis.com/css2?family=Lalezar&family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap");

        .fx-font { font-family: "Vazirmatn", "Segoe UI", Tahoma, sans-serif; }
        .fx-display { font-family: "Lalezar", "Vazirmatn", Tahoma, sans-serif; letter-spacing: 0.01em; }

        .dark { color-scheme: dark; }

        .fx-grid {
          background-image: radial-gradient(circle at 1px 1px, rgba(13,42,58,0.10) 1px, transparent 0);
          background-size: 24px 24px;
          -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(0,0,0,0.25) 60%, transparent);
          mask-image: linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(0,0,0,0.25) 60%, transparent);
        }
        .dark .fx-grid {
          background-image: radial-gradient(circle at 1px 1px, rgba(148,190,210,0.08) 1px, transparent 0);
        }

        @keyframes fxUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fxPop { from { opacity: 0; transform: scale(0.96) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .fx-up { animation: fxUp 0.5s cubic-bezier(0.22, 0.8, 0.35, 1) both; }
        .fx-pop { animation: fxPop 0.28s cubic-bezier(0.22, 0.8, 0.35, 1) both; }

        details > summary { list-style: none; }
        details > summary::-webkit-details-marker { display: none; }

        ::selection { background: rgba(13,148,136,0.25); }
      `}</style>

      <div
        className={`fx-font relative min-h-screen overflow-x-hidden antialiased transition-colors duration-500 ${
          dk ? "bg-[#0a131e] text-slate-100" : "bg-[#eef2f5] text-slate-800"
        }`}
      >
        {/* نوار امضای بالا */}
        <div
          className={`fixed inset-x-0 top-0 z-30 h-1 bg-gradient-to-l ${
            dk
              ? "from-teal-400 via-emerald-400 to-amber-300"
              : "from-teal-700 via-emerald-500 to-amber-400"
          }`}
        />

        {/* پس‌زمینه محیطی */}
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
          <div className="fx-grid absolute inset-0" />
          <div
            className={`absolute -top-36 right-[-12rem] h-[30rem] w-[30rem] rounded-full blur-[110px] ${
              dk ? "bg-teal-400/10" : "bg-teal-500/15"
            }`}
          />
          <div
            className={`absolute left-[-12rem] top-1/4 h-[26rem] w-[26rem] rounded-full blur-[110px] ${
              dk ? "bg-amber-400/[0.07]" : "bg-amber-400/15"
            }`}
          />
          <div
            className={`absolute bottom-[-10rem] right-1/3 h-[24rem] w-[24rem] rounded-full blur-[100px] ${
              dk ? "bg-emerald-400/[0.06]" : "bg-emerald-400/10"
            }`}
          />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-7xl space-y-5 px-4 pb-16 pt-9 md:space-y-6 md:px-8">
          {/* سربرگ */}
          <header className="fx-up flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#092f3a] via-teal-700 to-emerald-500 text-white shadow-lg shadow-teal-800/30 ring-1 ring-white/20">
                <Ic n="swap" className="h-6 w-6" />
                <span
                  className={`absolute -bottom-1.5 -left-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-amber-400 px-1 text-[8px] font-black text-slate-900 ring-2 ${
                    dk ? "ring-[#0a131e]" : "ring-white"
                  }`}
                >
                  AFN
                </span>
              </div>
              <div>
                <h1 className={`fx-display text-3xl leading-none md:text-4xl ${heading}`}>
                  معاملات ارزی
                </h1>
                <p className={`mt-1.5 text-[11px] font-bold md:text-xs ${subText}`}>
                  سامانهٔ تبادل و حوالهٔ صرافی — پنج ارز فعال
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div
                className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 shadow-sm backdrop-blur ${glassChip}`}
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                <span
                  dir="ltr"
                  className={`text-xs font-bold tabular-nums ${
                    dk ? "text-slate-300" : "text-slate-600"
                  }`}
                >
                  {currentDateTime || "--:--:--"}
                </span>
                {now && (
                  <>
                    <span className={`h-4 w-px ${dk ? "bg-slate-700" : "bg-slate-200"}`} />
                    <span
                      className={`whitespace-nowrap text-[10px] font-black ${
                        dk ? "text-teal-300" : "text-teal-700"
                      }`}
                    >
                      {shamsiMonthLabel(now)}
                    </span>
                  </>
                )}
              </div>

              <button
                onClick={() => setTheme(dk ? "light" : "dark")}
                title={dk ? "پوستهٔ روشن" : "پوستهٔ تیره"}
                className={`group grid h-11 w-11 cursor-pointer place-items-center rounded-xl border shadow-sm backdrop-blur transition-all duration-300 active:scale-90 ${
                  dk
                    ? "border-slate-700/80 bg-[#0e1a28]/85 text-amber-300 hover:border-amber-400/50 hover:text-amber-200"
                    : "border-slate-200/90 bg-white/85 text-slate-600 hover:border-teal-500/50 hover:text-teal-600"
                }`}
              >
                {dk ? (
                  <Ic n="sun" className="h-5 w-5 transition-transform duration-500 group-hover:rotate-45" />
                ) : (
                  <Ic n="moon" className="h-5 w-5 transition-transform duration-500 group-hover:-rotate-12" />
                )}
              </button>
            </div>
          </header>

          {/* نوار ارزها و آمار */}
          <div
            className="fx-up flex flex-wrap items-center gap-2"
            style={{ animationDelay: "70ms" }}
          >
            {currencies.map((c) => (
              <span
                key={c}
                className={`flex cursor-default items-center gap-2 rounded-full border py-1.5 pl-3.5 pr-1.5 text-xs font-bold shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${glassChip} ${
                  dk
                    ? "text-slate-300 hover:border-teal-400/40"
                    : "text-slate-600 hover:border-teal-500/40"
                }`}
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-teal-600 to-emerald-500 text-[8px] font-black text-white">
                  {c}
                </span>
                {labels[c]}
              </span>
            ))}

            <div className="mr-auto flex flex-wrap items-center gap-2 text-[11px] font-black">
              <span
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 shadow-sm backdrop-blur ${glassChip} ${
                  dk ? "text-slate-300" : "text-slate-600"
                }`}
              >
                کل معاملات
                <b className={`tabular-nums ${dk ? "text-teal-300" : "text-teal-700"}`}>
                  {transactions.length}
                </b>
              </span>
              <span
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ring-1 ${
                  dk
                    ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20"
                    : "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25"
                }`}
              >
                فعال
                <b className="tabular-nums">{activeCount}</b>
              </span>
              <span
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ring-1 ${
                  dk
                    ? "bg-rose-400/10 text-rose-300 ring-rose-400/20"
                    : "bg-rose-500/10 text-rose-600 ring-rose-500/25"
                }`}
              >
                لغو شده
                <b className="tabular-nums">{voidedCount}</b>
              </span>
            </div>
          </div>

          {/* تب‌ها */}
          <div
            className={`fx-up flex flex-wrap items-center gap-2 rounded-2xl border p-2 shadow-sm backdrop-blur sm:w-fit ${glassChip}`}
            style={{ animationDelay: "140ms" }}
          >
            <button
              onClick={() => setTab("exchange")}
              className={`flex cursor-pointer items-center gap-2 rounded-xl px-5 py-3 text-sm font-black transition-all duration-300 active:scale-[0.97] ${
                tab === "exchange"
                  ? `bg-gradient-to-l shadow-lg ${
                      dk
                        ? "from-teal-500 via-emerald-500 to-emerald-400 text-slate-950 shadow-teal-500/20"
                        : "from-[#0a3540] via-teal-700 to-emerald-600 text-white shadow-teal-800/30"
                    }`
                  : dk
                  ? "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              }`}
            >
              <Ic n="swap" className="h-4 w-4" />
              تبادل ارز
            </button>

            <button
              onClick={() => setTab("transfer")}
              className={`flex cursor-pointer items-center gap-2 rounded-xl px-5 py-3 text-sm font-black transition-all duration-300 active:scale-[0.97] ${
                tab === "transfer"
                  ? `bg-gradient-to-l shadow-lg ${
                      dk
                        ? "from-violet-400 via-fuchsia-400 to-fuchsia-300 text-slate-950 shadow-fuchsia-400/20"
                        : "from-violet-700 via-violet-600 to-fuchsia-600 text-white shadow-violet-700/30"
                    }`
                  : dk
                  ? "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              }`}
            >
              <Ic n="users" className="h-4 w-4" />
              تبادل بین مشتریان
            </button>
          </div>

          {/* ================= Exchange ================= */}

          {tab === "exchange" && (
            <section className={`fx-up space-y-5 p-5 md:p-7 ${uiCard}`}>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${
                    dk
                      ? "from-teal-400/15 to-emerald-400/10 text-teal-300 ring-teal-400/20"
                      : "from-teal-600/15 to-emerald-500/15 text-teal-700 ring-teal-600/20"
                  }`}
                >
                  <Ic n="swap" className="h-5 w-5" />
                </span>
                <div className="flex-1">
                  <h2 className={`fx-display text-2xl leading-none ${heading}`}>
                    تبادل ارز صرافی با مشتری
                  </h2>
                  <p className={`mt-1 text-[11px] font-bold ${subText}`}>
                    دریافت یک ارز از مشتری و پرداخت ارز دیگر
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1.5 text-[10px] font-black ring-1 ${
                    dk
                      ? "bg-teal-400/10 text-teal-300 ring-teal-400/20"
                      : "bg-teal-600/10 text-teal-700 ring-teal-600/20"
                  }`}
                >
                  {editingExchangeId
                    ? `ویرایش ${shortId(editingExchangeId)}`
                    : "معاملهٔ جدید"}
                </span>
              </div>

              {editingExchangeId && (
                <div
                  className={`fx-pop flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-bold ${
                    dk
                      ? "border-amber-400/25 bg-amber-400/10 text-amber-300"
                      : "border-amber-500/35 bg-amber-500/10 text-amber-800"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Ic n="pencil" className="h-4 w-4 shrink-0" />
                    در حال ویرایش معامله {shortId(editingExchangeId)}. تاریخ اصلی حفظ می‌شود.
                  </span>
                  <button
                    onClick={resetExchangeForm}
                    className="cursor-pointer rounded-lg bg-amber-500/20 px-3.5 py-1.5 text-xs font-black transition-all hover:bg-amber-500/30 active:scale-95"
                  >
                    انصراف
                  </button>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className={uiLabel}>
                    تاریخ و ساعت (هجری شمسی) {editingExchangeId ? "(اصل)" : "(خودکار)"}
                  </label>
                  <div className="relative">
                    <input
                      readOnly
                      dir="ltr"
                      value={exchangeDateDisplay}
                      className={`${uiInput} ${roInput} pl-10 text-left tabular-nums`}
                    />
                    <span className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${iconMuted}`}>
                      <Ic n="clock" className="h-4 w-4" />
                    </span>
                  </div>
                </div>

                <div>
                  <label className={uiLabel}>نوع معامله</label>
                  <div className="relative">
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
                      className={`${uiInput} cursor-pointer appearance-none pl-9 ${
                        exchangeErrors.dealType ? errInput : ""
                      }`}
                    >
                      <option value="">انتخاب نوع معامله</option>
                      <option value="buy">خرید</option>
                      <option value="sell">فروش</option>
                    </select>
                    <span className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${iconMuted}`}>
                      <Ic n="chevron" className="h-4 w-4" />
                    </span>
                  </div>
                </div>

                <div>
                  <label className={uiLabel}>مشتری</label>
                  <div className="relative">
                    <select
                      value={customer}
                      onChange={(e) => {
                        setCustomer(e.target.value);

                        setExchangeErrors((prev) => ({
                          ...prev,
                          customer: undefined,
                        }));
                      }}
                      className={`${uiInput} cursor-pointer appearance-none pl-9 ${
                        exchangeErrors.customer ? errInput : ""
                      }`}
                    >
                      <option value="">انتخاب مشتری</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <span className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${iconMuted}`}>
                      <Ic n="chevron" className="h-4 w-4" />
                    </span>
                  </div>
                </div>

                <div>
                  <label className={uiLabel}>جستجو</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="نام مشتری یا مبلغ…"
                      className={`${uiInput} pr-10`}
                    />
                    <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${iconMuted}`}>
                      <Ic n="search" className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </div>

              {/* دریافت / پرداخت */}
              <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
                <div
                  className={`space-y-4 rounded-2xl border p-4 transition-colors ${
                    dk
                      ? "border-emerald-400/15 bg-emerald-400/[0.04]"
                      : "border-emerald-500/25 bg-emerald-500/[0.05]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/15 ${
                        dk ? "text-emerald-300" : "text-emerald-600"
                      }`}
                    >
                      <Ic n="down" className="h-4 w-4" />
                    </span>
                    <b className={`text-sm font-black ${dk ? "text-emerald-300" : "text-emerald-800"}`}>
                      دریافت از مشتری
                    </b>
                  </div>

                  <div>
                    <label className={uiLabel}>ارز دریافتی</label>
                    {currencySelect(receivedCurrency, (v) => {
                      setReceivedCurrency(v);

                      setExchangeErrors((prev) => ({
                        ...prev,
                        rate: undefined,
                        paidAmount: undefined,
                      }));
                    })}
                  </div>

                  <div>
                    <label className={uiLabel}>مبلغ دریافتی</label>
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
                      placeholder="0.00"
                      className={`${uiInput} text-left tabular-nums ${
                        exchangeErrors.receivedAmount ? errInput : ""
                      }`}
                    />
                  </div>
                </div>

                <div className="hidden flex-col items-center justify-center lg:flex">
                  <span
                    className={`grid h-12 w-12 place-items-center rounded-full border shadow-md ${
                      dk
                        ? "border-slate-700 bg-[#0b1622] text-teal-300"
                        : "border-slate-200 bg-white text-teal-600"
                    }`}
                  >
                    <Ic n="swap" className="h-5 w-5" />
                  </span>
                </div>

                <div
                  className={`space-y-4 rounded-2xl border p-4 transition-colors ${
                    dk
                      ? "border-sky-400/15 bg-sky-400/[0.04]"
                      : "border-sky-500/25 bg-sky-500/[0.05]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`grid h-9 w-9 place-items-center rounded-xl bg-sky-500/15 ${
                        dk ? "text-sky-300" : "text-sky-600"
                      }`}
                    >
                      <Ic n="up" className="h-4 w-4" />
                    </span>
                    <b className={`text-sm font-black ${dk ? "text-sky-300" : "text-sky-800"}`}>
                      پرداخت به مشتری
                    </b>
                  </div>

                  <div>
                    <label className={uiLabel}>ارز پرداختی</label>
                    {currencySelect(paidCurrency, (v) => {
                      setPaidCurrency(v);

                      setExchangeErrors((prev) => ({
                        ...prev,
                        rate: undefined,
                        paidAmount: undefined,
                      }));
                    })}
                  </div>

                  <div>
                    <label className={uiLabel}>مبلغ پرداختی</label>
                    <input
                      readOnly
                      dir="ltr"
                      value={paidAmount}
                      className={`${uiInput} ${roInput} text-left tabular-nums ${
                        exchangeErrors.paidAmount ? errInput : ""
                      }`}
                    />
                  </div>
                </div>
              </div>

              {exchangeMode === "same" && (
                <div
                  className={`flex items-center gap-3 rounded-2xl border p-4 text-sm font-bold ${
                    dk
                      ? "border-slate-600/60 bg-slate-400/[0.06] text-slate-300"
                      : "border-slate-300/70 bg-slate-500/[0.06] text-slate-600"
                  }`}
                >
                  <Ic n="info" className="h-5 w-5 shrink-0 opacity-70" />
                  ارز دریافت و پرداخت یکسان است؛ مبلغ پرداختی برابر مبلغ دریافتی خواهد بود.
                </div>
              )}

              {exchangeMode === "afn" && exchangeForeign && (
                <div
                  className={`space-y-4 rounded-2xl border p-4 transition-colors md:p-5 ${
                    dk
                      ? "border-sky-400/20 bg-sky-400/[0.06]"
                      : "border-sky-500/30 bg-sky-500/[0.07]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`grid h-9 w-9 place-items-center rounded-xl bg-sky-500/15 ${
                        dk ? "text-sky-300" : "text-sky-600"
                      }`}
                    >
                      <Ic n="rate" className="h-4 w-4" />
                    </span>
                    <b className={`text-sm font-black ${dk ? "text-sky-300" : "text-sky-800"}`}>
                      نرخ دستی در برابر افغانی
                    </b>
                  </div>

                  <div>
                    <label className={uiLabel}>نرخ</label>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className={rateChip}>
                        {fmt(rateUnits[exchangeForeign])} {labels[exchangeForeign]} =
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
                        placeholder="0"
                        className={`h-12 w-44 px-3 text-left text-sm font-bold tabular-nums ${inputShell} ${
                          exchangeErrors.rate ? errInput : ""
                        }`}
                      />

                      <span className={rateChip}>{labels.AFN}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {exchangeRateValue > 0 && (
                      <span
                        className={`fx-pop inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${
                          dk ? "bg-sky-400/15 text-sky-300" : "bg-sky-500/15 text-sky-700"
                        }`}
                      >
                        <Ic n="check" className="h-3.5 w-3.5" />
                        نرخ ثبت‌شده: {afnRateLabel(exchangeForeign, exchangeRateValue)}
                      </span>
                    )}

                    {paidAmount && (
                      <span
                        className={`fx-pop inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${
                          dk
                            ? "bg-emerald-400/15 text-emerald-300"
                            : "bg-emerald-500/15 text-emerald-700"
                        }`}
                      >
                        نتیجه: {paidAmount} {labels[paidCurrency]}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {exchangeMode === "direct" && (
                <div
                  className={`space-y-4 rounded-2xl border p-4 transition-colors md:p-5 ${
                    dk
                      ? "border-amber-400/20 bg-amber-400/[0.06]"
                      : "border-amber-500/30 bg-amber-500/[0.07]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`grid h-9 w-9 place-items-center rounded-xl bg-amber-500/15 ${
                        dk ? "text-amber-300" : "text-amber-600"
                      }`}
                    >
                      <Ic n="rate" className="h-4 w-4" />
                    </span>
                    <b className={`text-sm font-black ${dk ? "text-amber-300" : "text-amber-800"}`}>
                      نرخ مستقیم جفت‌ارز
                    </b>
                  </div>

                  <div className="grid items-end gap-4 md:grid-cols-2">
                    <div>
                      <label className={uiLabel}>مبنای نرخ</label>
                      <div className="relative">
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
                          className={`${uiInput} cursor-pointer appearance-none pl-9`}
                        >
                          {[receivedCurrency, paidCurrency].map((c) => (
                            <option key={c} value={c}>
                              {labels[c]}
                            </option>
                          ))}
                        </select>
                        <span className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${iconMuted}`}>
                          <Ic n="chevron" className="h-4 w-4" />
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className={uiLabel}>نرخ مستقیم</label>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={rateChip}>
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
                          placeholder="0"
                          className={`h-12 w-40 px-3 text-left text-sm font-bold tabular-nums ${inputShell} ${
                            exchangeErrors.rate ? errInput : ""
                          }`}
                        />

                        <span className={rateChip}>
                          {exchangeDirectCounter
                            ? labels[exchangeDirectCounter]
                            : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {exchangeRateValue > 0 && exchangeDirectCounter && (
                      <span
                        className={`fx-pop inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${
                          dk
                            ? "bg-amber-400/15 text-amber-300"
                            : "bg-amber-500/15 text-amber-700"
                        }`}
                      >
                        <Ic n="check" className="h-3.5 w-3.5" />
                        نرخ ثبت‌شده:{" "}
                        {directRateLabel(
                          exchangeDirectBaseValue,
                          exchangeDirectCounter,
                          exchangeRateValue
                        )}
                      </span>
                    )}

                    {paidAmount && (
                      <span
                        className={`fx-pop inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${
                          dk
                            ? "bg-emerald-400/15 text-emerald-300"
                            : "bg-emerald-500/15 text-emerald-700"
                        }`}
                      >
                        نتیجه: {paidAmount} {labels[paidCurrency]}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={uiLabel}>کارمزد</label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      dir="ltr"
                      value={exchangeCommission}
                      onChange={(e) => {
                        setExchangeCommission(
                          toNumericText(e.target.value)
                        );

                        setExchangeErrors((prev) => ({
                          ...prev,
                          exchangeCommission: undefined,
                        }));
                      }}
                      placeholder="0"
                      className={`${uiInput} pl-24 text-left tabular-nums ${
                        exchangeErrors.exchangeCommission ? errInput : ""
                      }`}
                    />
                    <span
                      className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[10px] font-black ${
                        dk
                          ? "bg-teal-400/10 text-teal-300"
                          : "bg-teal-600/10 text-teal-700"
                      }`}
                    >
                      {labels[receivedCurrency]}
                    </span>
                  </div>
                </div>

                <div>
                  <label className={uiLabel}>توضیحات</label>
                  <input
                    type="text"
                    value={exchangeDescription}
                    onChange={(e) =>
                      setExchangeDescription(e.target.value)
                    }
                    placeholder="توضیحات اختیاری…"
                    className={uiInput}
                  />
                </div>
              </div>

              {exchangeErrorList.length > 0 && (
                <div
                  className={`fx-pop space-y-2 rounded-xl border p-4 ${
                    dk
                      ? "border-rose-400/25 bg-rose-400/10 text-rose-300"
                      : "border-rose-500/30 bg-rose-500/10 text-rose-700"
                  }`}
                >
                  <b className="flex items-center gap-2 text-sm">
                    <Ic n="alert" className="h-5 w-5 shrink-0" />
                    لطفاً این فیلدها را تکمیل کنید:
                  </b>

                  <ul className="list-disc pr-5 text-sm marker:text-rose-400 space-y-1">
                    {exchangeErrorList.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={submitExchange}
                className={`group flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-l text-base font-black shadow-lg transition-all duration-300 hover:shadow-xl hover:brightness-110 active:scale-[0.985] ${
                  dk
                    ? "from-teal-400 via-emerald-400 to-emerald-300 text-[#04211d] shadow-teal-400/20"
                    : "from-[#092f3a] via-teal-700 to-emerald-600 text-white shadow-teal-800/30"
                }`}
              >
                {editingExchangeId
                  ? "به‌روزرسانی معامله"
                  : "ثبت معامله"}
                <Ic n="arrowLeft" className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
              </button>
            </section>
          )}

          {/* ================= Transfer ================= */}

          {tab === "transfer" && (
            <section className={`fx-up space-y-5 p-5 md:p-7 ${uiCard}`}>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${
                    dk
                      ? "from-violet-400/15 to-fuchsia-400/10 text-violet-300 ring-violet-400/20"
                      : "from-violet-600/15 to-fuchsia-500/15 text-violet-700 ring-violet-600/20"
                  }`}
                >
                  <Ic n="users" className="h-5 w-5" />
                </span>
                <div className="flex-1">
                  <h2 className={`fx-display text-2xl leading-none ${heading}`}>
                    تبادل بین حساب مشتریان
                  </h2>
                  <p className={`mt-1 text-[11px] font-bold ${subText}`}>
                    انتقال موجودی از حساب مشتری به مشتری دیگر
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1.5 text-[10px] font-black ring-1 ${
                    dk
                      ? "bg-violet-400/10 text-violet-300 ring-violet-400/20"
                      : "bg-violet-600/10 text-violet-700 ring-violet-600/20"
                  }`}
                >
                  {editingTransferId
                    ? `ویرایش ${shortId(editingTransferId)}`
                    : "انتقال جدید"}
                </span>
              </div>

              {editingTransferId && (
                <div
                  className={`fx-pop flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-bold ${
                    dk
                      ? "border-amber-400/25 bg-amber-400/10 text-amber-300"
                      : "border-amber-500/35 bg-amber-500/10 text-amber-800"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Ic n="pencil" className="h-4 w-4 shrink-0" />
                    در حال ویرایش انتقال {shortId(editingTransferId)}. تاریخ اصلی حفظ می‌شود.
                  </span>
                  <button
                    onClick={resetTransferForm}
                    className="cursor-pointer rounded-lg bg-amber-500/20 px-3.5 py-1.5 text-xs font-black transition-all hover:bg-amber-500/30 active:scale-95"
                  >
                    انصراف
                  </button>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={uiLabel}>
                    تاریخ و ساعت (هجری شمسی) {editingTransferId ? "(اصل)" : "(خودکار)"}
                  </label>
                  <div className="relative">
                    <input
                      readOnly
                      dir="ltr"
                      value={transferDateDisplay}
                      className={`${uiInput} ${roInput} pl-10 text-left tabular-nums`}
                    />
                    <span className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${iconMuted}`}>
                      <Ic n="clock" className="h-4 w-4" />
                    </span>
                  </div>
                </div>

                <div>
                  <label className={uiLabel}>جستجو</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="نام مشتری یا مبلغ…"
                      className={`${uiInput} pr-10`}
                    />
                    <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${iconMuted}`}>
                      <Ic n="search" className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </div>

              {/* فرستنده / گیرنده */}
              <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
                <div
                  className={`space-y-4 rounded-2xl border p-4 transition-colors ${
                    dk
                      ? "border-violet-400/15 bg-violet-400/[0.04]"
                      : "border-violet-500/25 bg-violet-500/[0.05]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`grid h-9 w-9 place-items-center rounded-xl bg-violet-500/15 ${
                        dk ? "text-violet-300" : "text-violet-600"
                      }`}
                    >
                      <Ic n="up" className="h-4 w-4" />
                    </span>
                    <b className={`text-sm font-black ${dk ? "text-violet-300" : "text-violet-800"}`}>
                      فرستنده
                    </b>
                  </div>

                  <div>
                    <label className={uiLabel}>مشتری فرستنده</label>
                    <div className="relative">
                      <select
                        value={sender}
                        onChange={(e) => {
                          setSender(e.target.value);

                          setTransferErrors((prev) => ({
                            ...prev,
                            sender: undefined,
                          }));
                        }}
                        className={`${uiInput} cursor-pointer appearance-none pl-9 ${
                          transferErrors.sender ? errInput : ""
                        }`}
                      >
                        <option value="">انتخاب مشتری</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <span className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${iconMuted}`}>
                        <Ic n="chevron" className="h-4 w-4" />
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className={uiLabel}>ارز فرستنده</label>
                    {currencySelect(senderCurrency, (v) => {
                      setSenderCurrency(v);

                      setTransferErrors((prev) => ({
                        ...prev,
                        transferRate: undefined,
                        receiverAmount: undefined,
                      }));
                    })}
                  </div>

                  <div>
                    <label className={uiLabel}>مبلغ فرستنده</label>
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
                      placeholder="0.00"
                      className={`${uiInput} text-left tabular-nums ${
                        transferErrors.senderAmount ? errInput : ""
                      }`}
                    />
                  </div>
                </div>

                <div className="hidden flex-col items-center justify-center lg:flex">
                  <span
                    className={`grid h-12 w-12 place-items-center rounded-full border shadow-md ${
                      dk
                        ? "border-slate-700 bg-[#0b1622] text-violet-300"
                        : "border-slate-200 bg-white text-violet-600"
                    }`}
                  >
                    <Ic n="arrowLeft" className="h-5 w-5" />
                  </span>
                </div>

                <div
                  className={`space-y-4 rounded-2xl border p-4 transition-colors ${
                    dk
                      ? "border-emerald-400/15 bg-emerald-400/[0.04]"
                      : "border-emerald-500/25 bg-emerald-500/[0.05]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/15 ${
                        dk ? "text-emerald-300" : "text-emerald-600"
                      }`}
                    >
                      <Ic n="down" className="h-4 w-4" />
                    </span>
                    <b className={`text-sm font-black ${dk ? "text-emerald-300" : "text-emerald-800"}`}>
                      گیرنده
                    </b>
                  </div>

                  <div>
                    <label className={uiLabel}>مشتری گیرنده</label>
                    <div className="relative">
                      <select
                        value={receiver}
                        onChange={(e) => {
                          setReceiver(e.target.value);

                          setTransferErrors((prev) => ({
                            ...prev,
                            receiver: undefined,
                          }));
                        }}
                        className={`${uiInput} cursor-pointer appearance-none pl-9 ${
                          transferErrors.receiver ? errInput : ""
                        }`}
                      >
                        <option value="">انتخاب مشتری</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <span className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${iconMuted}`}>
                        <Ic n="chevron" className="h-4 w-4" />
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className={uiLabel}>ارز گیرنده</label>
                    {currencySelect(receiverCurrency, (v) => {
                      setReceiverCurrency(v);

                      setTransferErrors((prev) => ({
                        ...prev,
                        transferRate: undefined,
                        receiverAmount: undefined,
                      }));
                    })}
                  </div>

                  <div>
                    <label className={uiLabel}>مبلغ گیرنده</label>
                    <input
                      readOnly
                      dir="ltr"
                      value={receiverAmount}
                      className={`${uiInput} ${roInput} text-left tabular-nums ${
                        transferErrors.receiverAmount ? errInput : ""
                      }`}
                    />
                  </div>
                </div>
              </div>

              {transferMode === "same" && (
                <div
                  className={`flex items-center gap-3 rounded-2xl border p-4 text-sm font-bold ${
                    dk
                      ? "border-slate-600/60 bg-slate-400/[0.06] text-slate-300"
                      : "border-slate-300/70 bg-slate-500/[0.06] text-slate-600"
                  }`}
                >
                  <Ic n="info" className="h-5 w-5 shrink-0 opacity-70" />
                  ارز فرستنده و گیرنده یکسان است؛ مبلغ گیرنده برابر مبلغ فرستنده خواهد بود.
                </div>
              )}

              {transferMode === "afn" && transferForeign && (
                <div
                  className={`space-y-4 rounded-2xl border p-4 transition-colors md:p-5 ${
                    dk
                      ? "border-violet-400/20 bg-violet-400/[0.06]"
                      : "border-violet-500/30 bg-violet-500/[0.07]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`grid h-9 w-9 place-items-center rounded-xl bg-violet-500/15 ${
                        dk ? "text-violet-300" : "text-violet-600"
                      }`}
                    >
                      <Ic n="rate" className="h-4 w-4" />
                    </span>
                    <b className={`text-sm font-black ${dk ? "text-violet-300" : "text-violet-800"}`}>
                      نرخ دستی در برابر افغانی
                    </b>
                  </div>

                  <div>
                    <label className={uiLabel}>نرخ</label>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className={rateChip}>
                        {fmt(rateUnits[transferForeign])} {labels[transferForeign]} =
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
                        placeholder="0"
                        className={`h-12 w-44 px-3 text-left text-sm font-bold tabular-nums ${inputShell} ${
                          transferErrors.transferRate ? errInput : ""
                        }`}
                      />

                      <span className={rateChip}>{labels.AFN}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {transferRateValue > 0 && (
                      <span
                        className={`fx-pop inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${
                          dk
                            ? "bg-violet-400/15 text-violet-300"
                            : "bg-violet-500/15 text-violet-700"
                        }`}
                      >
                        <Ic n="check" className="h-3.5 w-3.5" />
                        نرخ ثبت‌شده: {afnRateLabel(transferForeign, transferRateValue)}
                      </span>
                    )}

                    {receiverAmount && (
                      <span
                        className={`fx-pop inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${
                          dk
                            ? "bg-emerald-400/15 text-emerald-300"
                            : "bg-emerald-500/15 text-emerald-700"
                        }`}
                      >
                        نتیجه: {receiverAmount} {labels[receiverCurrency]}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {transferMode === "direct" && (
                <div
                  className={`space-y-4 rounded-2xl border p-4 transition-colors md:p-5 ${
                    dk
                      ? "border-fuchsia-400/20 bg-fuchsia-400/[0.06]"
                      : "border-fuchsia-500/30 bg-fuchsia-500/[0.07]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`grid h-9 w-9 place-items-center rounded-xl bg-fuchsia-500/15 ${
                        dk ? "text-fuchsia-300" : "text-fuchsia-600"
                      }`}
                    >
                      <Ic n="rate" className="h-4 w-4" />
                    </span>
                    <b className={`text-sm font-black ${dk ? "text-fuchsia-300" : "text-fuchsia-800"}`}>
                      نرخ مستقیم جفت‌ارز
                    </b>
                  </div>

                  <div className="grid items-end gap-4 md:grid-cols-2">
                    <div>
                      <label className={uiLabel}>مبنای نرخ</label>
                      <div className="relative">
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
                          className={`${uiInput} cursor-pointer appearance-none pl-9`}
                        >
                          {[senderCurrency, receiverCurrency].map((c) => (
                            <option key={c} value={c}>
                              {labels[c]}
                            </option>
                          ))}
                        </select>
                        <span className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${iconMuted}`}>
                          <Ic n="chevron" className="h-4 w-4" />
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className={uiLabel}>نرخ مستقیم</label>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={rateChip}>
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
                          placeholder="0"
                          className={`h-12 w-40 px-3 text-left text-sm font-bold tabular-nums ${inputShell} ${
                            transferErrors.transferRate ? errInput : ""
                          }`}
                        />

                        <span className={rateChip}>
                          {transferDirectCounter
                            ? labels[transferDirectCounter]
                            : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {transferRateValue > 0 && transferDirectCounter && (
                      <span
                        className={`fx-pop inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${
                          dk
                            ? "bg-fuchsia-400/15 text-fuchsia-300"
                            : "bg-fuchsia-500/15 text-fuchsia-700"
                        }`}
                      >
                        <Ic n="check" className="h-3.5 w-3.5" />
                        نرخ ثبت‌شده:{" "}
                        {directRateLabel(
                          transferDirectBaseValue,
                          transferDirectCounter,
                          transferRateValue
                        )}
                      </span>
                    )}

                    {receiverAmount && (
                      <span
                        className={`fx-pop inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${
                          dk
                            ? "bg-emerald-400/15 text-emerald-300"
                            : "bg-emerald-500/15 text-emerald-700"
                        }`}
                      >
                        نتیجه: {receiverAmount} {labels[receiverCurrency]}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={uiLabel}>کارمزد</label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      dir="ltr"
                      value={commission}
                      onChange={(e) => {
                        setCommission(toNumericText(e.target.value));

                        setTransferErrors((prev) => ({
                          ...prev,
                          commission: undefined,
                        }));
                      }}
                      placeholder="0"
                      className={`${uiInput} pl-24 text-left tabular-nums ${
                        transferErrors.commission ? errInput : ""
                      }`}
                    />
                    <span
                      className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[10px] font-black ${
                        dk
                          ? "bg-violet-400/10 text-violet-300"
                          : "bg-violet-600/10 text-violet-700"
                      }`}
                    >
                      {labels[senderCurrency]}
                    </span>
                  </div>
                </div>

                <div>
                  <label className={uiLabel}>توضیحات</label>
                  <input
                    type="text"
                    value={transferDescription}
                    onChange={(e) =>
                      setTransferDescription(e.target.value)
                    }
                    placeholder="توضیحات اختیاری…"
                    className={uiInput}
                  />
                </div>
              </div>

              {transferErrorList.length > 0 && (
                <div
                  className={`fx-pop space-y-2 rounded-xl border p-4 ${
                    dk
                      ? "border-rose-400/25 bg-rose-400/10 text-rose-300"
                      : "border-rose-500/30 bg-rose-500/10 text-rose-700"
                  }`}
                >
                  <b className="flex items-center gap-2 text-sm">
                    <Ic n="alert" className="h-5 w-5 shrink-0" />
                    لطفاً این فیلدها را تکمیل کنید:
                  </b>

                  <ul className="list-disc pr-5 text-sm marker:text-rose-400 space-y-1">
                    {transferErrorList.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={submitTransfer}
                className={`group flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-l text-base font-black shadow-lg transition-all duration-300 hover:shadow-xl hover:brightness-110 active:scale-[0.985] ${
                  dk
                    ? "from-violet-400 via-purple-400 to-fuchsia-300 text-[#1e0b36] shadow-fuchsia-400/20"
                    : "from-violet-700 via-purple-600 to-fuchsia-600 text-white shadow-violet-700/30"
                }`}
              >
                {editingTransferId
                  ? "به‌روزرسانی انتقال"
                  : "ثبت انتقال"}
                <Ic n="arrowLeft" className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
              </button>
            </section>
          )}

          {/* ================= Transactions ================= */}

          <section
            className={`fx-up overflow-hidden ${uiCard}`}
            style={{ animationDelay: "160ms" }}
          >
            <div className="flex flex-wrap items-center gap-3 p-5 pb-4 md:px-7 md:pt-6">
              <span
                className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${
                  dk
                    ? "from-teal-400/15 to-emerald-400/10 text-teal-300 ring-teal-400/20"
                    : "from-teal-600/15 to-emerald-500/15 text-teal-700 ring-teal-600/20"
                }`}
              >
                <Ic n="doc" className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <h2 className={`fx-display text-2xl leading-none ${heading}`}>
                  آخرین معاملات
                </h2>
                <p className={`mt-1 text-[11px] font-bold ${subText}`}>
                  ثبت، ویرایش، چاپ رسید و لغو معاملات
                </p>
              </div>

              {isSearching && (
                <button
                  onClick={() => setSearch("")}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black ring-1 transition ${
                    dk
                      ? "bg-amber-400/10 text-amber-300 ring-amber-400/20 hover:bg-amber-400/20"
                      : "bg-amber-500/10 text-amber-700 ring-amber-500/25 hover:bg-amber-500/20"
                  }`}
                >
                  نتایج جستجو
                  <Ic n="x" className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr
                    className={`border-y ${
                      dk
                        ? "border-slate-800 bg-[#0b1520]/80"
                        : "border-slate-100 bg-slate-50/80"
                    }`}
                  >
                    <th className={`px-4 py-3 text-right text-[11px] font-black md:px-7 ${dk ? "text-slate-400" : "text-slate-500"}`}>شماره</th>
                    <th className={`px-4 py-3 text-right text-[11px] font-black ${dk ? "text-slate-400" : "text-slate-500"}`}>نام مشتری</th>
                    <th className={`px-4 py-3 text-right text-[11px] font-black ${dk ? "text-slate-400" : "text-slate-500"}`}>تاریخ (شمسی)</th>
                    <th className={`px-4 py-3 text-right text-[11px] font-black ${dk ? "text-slate-400" : "text-slate-500"}`}>نوع معامله</th>
                    <th className={`px-4 py-3 text-right text-[11px] font-black ${dk ? "text-slate-400" : "text-slate-500"}`}>دریافت</th>
                    <th className={`px-4 py-3 text-right text-[11px] font-black ${dk ? "text-slate-400" : "text-slate-500"}`}>پرداخت</th>
                    <th className={`px-4 py-3 text-right text-[11px] font-black ${dk ? "text-slate-400" : "text-slate-500"}`}>نرخ ارز</th>
                    <th className={`px-4 py-3 text-right text-[11px] font-black ${dk ? "text-slate-400" : "text-slate-500"}`}>کارمزد</th>
                    <th className={`px-4 py-3 text-right text-[11px] font-black md:px-7 ${dk ? "text-slate-400" : "text-slate-500"}`}>عملیات</th>
                  </tr>
                </thead>

                <tbody className={`divide-y ${dk ? "divide-slate-800/70" : "divide-slate-100"}`}>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={9}>
                        <div className={`flex flex-col items-center gap-3 px-6 py-14 ${dk ? "text-slate-500" : "text-slate-400"}`}>
                          <span
                            className={`grid h-16 w-16 place-items-center rounded-2xl border border-dashed ${
                              dk
                                ? "border-slate-700 bg-slate-800/40"
                                : "border-slate-300 bg-slate-50"
                            }`}
                          >
                            <Ic n="inbox" className="h-7 w-7 opacity-70" />
                          </span>
                          <p className="text-sm font-black">هنوز معامله‌ای ثبت نشده است</p>
                          <p className="text-xs font-medium">
                            اولین معامله را از فرم بالا ثبت کنید؛ جزئیات آن اینجا نمایش داده می‌شود.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx, index) => {
                      const matchesSearch =
                        transactionMatchesSearch(tx);

                      let rowClass = dk
                        ? "transition-colors hover:bg-slate-800/30"
                        : "transition-colors hover:bg-slate-50/80";

                      if (isSearching) {
                        if (matchesSearch) {
                          rowClass += dk
                            ? " bg-amber-400/10 hover:bg-amber-400/15"
                            : " bg-amber-400/20 hover:bg-amber-400/25";
                        } else {
                          rowClass += " opacity-30";
                        }

                        if (tx.status === "voided") {
                          rowClass += dk ? " text-slate-500" : " text-slate-400";
                        }
                      } else {
                        if (tx.status === "voided") {
                          rowClass += dk
                            ? " bg-rose-400/[0.04] text-slate-500"
                            : " bg-rose-500/[0.05] text-slate-400";
                        }
                      }

                      return (
                        <tr key={tx.id} className={rowClass}>
                          <td className="px-4 py-3.5 md:px-7">
                            <span
                              className={`grid h-8 w-8 place-items-center rounded-lg text-[11px] font-black tabular-nums ${
                                dk
                                  ? "bg-slate-800/80 text-slate-400"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {transactions.length - index}
                            </span>
                          </td>

                          <td className={`px-4 py-3.5 text-[13px] font-bold ${dk ? "text-slate-200" : "text-slate-700"}`}>
                            {transactionCustomerLabel(tx)}
                          </td>

                          <td className={`whitespace-nowrap px-4 py-3.5 text-xs tabular-nums ${dk ? "text-slate-400" : "text-slate-500"}`}>
                            <span dir="ltr">{dateLabel(tx.date)}</span>
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${typeChipClass(tx)}`}
                              >
                                {transactionTypeLabel(tx)}
                              </span>

                              {tx.status === "voided" && (
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ${
                                    dk
                                      ? "bg-rose-400/10 text-rose-300 ring-rose-400/20"
                                      : "bg-rose-500/10 text-rose-600 ring-rose-500/25"
                                  }`}
                                >
                                  لغو شده
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="text-[13px] font-black tabular-nums">
                              {fmt(tx.fromAmount)}
                            </div>
                            <div className={`text-[10px] font-bold ${subText}`}>
                              {labels[tx.fromCurrency]}
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="text-[13px] font-black tabular-nums">
                              {fmt(tx.toAmount)}
                            </div>
                            <div className={`text-[10px] font-bold ${subText}`}>
                              {labels[tx.toCurrency]}
                            </div>
                          </td>

                          <td className={`px-4 py-3.5 text-[11px] font-medium ${dk ? "text-slate-400" : "text-slate-500"}`}>
                            {tx.rateLabel}
                          </td>

                          <td className="px-4 py-3.5 text-xs font-bold tabular-nums">
                            {transactionCommissionLabel(tx)}
                          </td>

                          <td className="px-4 py-3.5 md:px-7">
                            <details className="relative">
                              <summary
                                className={`inline-flex cursor-pointer select-none items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-black shadow-sm transition-all ${
                                  dk
                                    ? "border-slate-700 bg-[#0b1622] text-teal-300 hover:border-teal-400/50 hover:bg-teal-400/10"
                                    : "border-slate-200 bg-white text-teal-700 hover:border-teal-500/50 hover:bg-teal-500/10"
                                }`}
                              >
                                عملیات
                                <Ic n="chevron" className="h-3 w-3" />
                              </summary>

                              <ul
                                className={`fx-pop mt-2 w-44 space-y-1 rounded-xl border p-1.5 shadow-xl ${
                                  dk
                                    ? "border-slate-700 bg-[#101d2c] shadow-black/40"
                                    : "border-slate-200 bg-white shadow-slate-900/10"
                                }`}
                              >
                                <li>
                                  <button
                                    onClick={() => editTransaction(tx)}
                                    disabled={tx.status === "voided"}
                                    className={actionButtonClass}
                                  >
                                    <Ic n="pencil" className="h-3.5 w-3.5" />
                                    ویرایش
                                  </button>
                                </li>

                                <li>
                                  <button
                                    onClick={() => printReceipt(tx)}
                                    className={actionButtonClass}
                                  >
                                    <Ic n="printer" className="h-3.5 w-3.5" />
                                    چاپ رسید
                                  </button>
                                </li>

                                <li>
                                  <button
                                    onClick={() => viewTransaction(tx)}
                                    className={actionButtonClass}
                                  >
                                    <Ic n="eye" className="h-3.5 w-3.5" />
                                    مشاهده
                                  </button>
                                </li>

                                <li>
                                  <button
                                    onClick={() => voidTransaction(tx)}
                                    disabled={tx.status === "voided"}
                                    className={dangerActionButtonClass}
                                  >
                                    <Ic n="xCircle" className="h-3.5 w-3.5" />
                                    لغو معامله
                                  </button>
                                </li>
                              </ul>
                            </details>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      {/* ================= View Modal ================= */}

      {selectedTransaction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onClick={() => setSelectedTransaction(null)}
        >
          <div
            className={`fx-pop w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl ${
              dk ? "border-slate-700 bg-[#0e1a28]" : "border-slate-200 bg-white"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`flex items-center justify-between border-b px-5 py-4 ${
                dk
                  ? "border-slate-800 bg-[#0b1520]/80"
                  : "border-slate-100 bg-slate-50/80"
              }`}
            >
              <b className={`flex items-center gap-2 text-sm ${dk ? "text-slate-100" : "text-slate-800"}`}>
                <span
                  className={`grid h-8 w-8 place-items-center rounded-lg ${
                    dk ? "bg-teal-400/10 text-teal-300" : "bg-teal-600/10 text-teal-700"
                  }`}
                >
                  <Ic n="doc" className="h-4 w-4" />
                </span>
                جزئیات معامله
              </b>

              <button
                onClick={() => setSelectedTransaction(null)}
                className={`grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-slate-400 transition-all duration-300 hover:rotate-90 ${
                  dk
                    ? "hover:bg-slate-700 hover:text-white"
                    : "hover:bg-slate-200 hover:text-slate-700"
                }`}
              >
                <Ic n="x" className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-5 py-2">
              <DetailRow dark={dk} label="شماره" value={selectedTransaction.id} />
              <DetailRow
                dark={dk}
                label="تاریخ (هجری شمسی)"
                value={dateLabel(selectedTransaction.date)}
              />
              <DetailRow
                dark={dk}
                label="نوع معامله"
                value={transactionTypeLabel(selectedTransaction)}
              />
              <DetailRow
                dark={dk}
                label="نام مشتری"
                value={transactionCustomerLabel(selectedTransaction)}
              />
              <DetailRow
                dark={dk}
                label="دریافت"
                value={`${fmt(selectedTransaction.fromAmount)} ${
                  labels[selectedTransaction.fromCurrency]
                }`}
              />
              <DetailRow
                dark={dk}
                label="پرداخت"
                value={`${fmt(selectedTransaction.toAmount)} ${
                  labels[selectedTransaction.toCurrency]
                }`}
              />
              <DetailRow dark={dk} label="نرخ ارز" value={selectedTransaction.rateLabel} />
              <DetailRow
                dark={dk}
                label="کارمزد"
                value={transactionCommissionLabel(selectedTransaction)}
              />
              <DetailRow
                dark={dk}
                label="توضیحات"
                value={selectedTransaction.description || "-"}
              />
              <DetailRow
                dark={dk}
                label="وضعیت"
                value={
                  selectedTransaction.status === "voided"
                    ? "لغو شده"
                    : "فعال"
                }
                valueClass={
                  selectedTransaction.status === "voided"
                    ? dk
                      ? "text-rose-400"
                      : "text-rose-600"
                    : dk
                    ? "text-emerald-400"
                    : "text-emerald-600"
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
