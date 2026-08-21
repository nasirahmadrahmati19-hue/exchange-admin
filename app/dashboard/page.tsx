"use client";

import { useEffect, useState, useMemo } from "react";

import {
  CUSTOMERS_KEY,
  TRANSACTIONS_KEY,
  HAWALAS_KEY,
  CASH_KEY,
  loadCustomersShared,
  loadTransactionsShared,
  loadHawalasShared,
  loadCashEntriesShared,
} from "../../lib/defaultData";

// ═══════════ Types ═══════════

type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";

type Customer = {
  id: string;
  name: string;
  balances: Record<Currency, number>;
};

type Transaction = {
  id: string;
  date: string;
  type: "exchange" | "transfer" | "convert";
  currency?: Currency;
  amount?: number;
  commission?: number;
  commissionCurrency?: Currency;
  status: "active" | "voided";
};

type Hawala = {
  id: string;
  date: string;
  amountFrom: number;
  currencyFrom: Currency;
  fee?: number;
  feeCurrency?: Currency;
  status: "pending" | "sent" | "paid" | "cancelled";
};

type CashEntry = {
  id: string;
  date: string;
  type: string;
  currency: Currency;
  amount: number;
  direction: "in" | "out";
  status: "active" | "voided";
};

// ═══════════ Constants ═══════════

const currencies: Currency[] = [
  "AFN",
  "USD",
  "EUR",
  "IRR",
  "PKR",
];

const labels: Record<Currency, string> = {
  AFN: "افغانی",
  USD: "دالر",
  EUR: "یورو",
  IRR: "تومان",
  PKR: "کلدار",
};

const CASH_BOX_ID = "CASH_BOX";
const EXCHANGE_ACCOUNT_ID = "EXCHANGE_ACCOUNT";

// ═══════════ Helpers ═══════════

const fmt = (n: number) =>
  Number.isFinite(n)
    ? n.toLocaleString("en-US", {
        maximumFractionDigits: 2,
      })
    : "0";

const fa = (n: number) =>
  Number.isFinite(n)
    ? n.toLocaleString("fa-IR", {
        maximumFractionDigits: 0,
      })
    : "۰";

function shamsiParts(d: Date) {
  try {
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
  } catch {
    return {
      year: "0",
      month: "0",
      day: "0",
    };
  }
}

function formatShamsiDate(d: Date) {
  const s = shamsiParts(d);

  return `${s.year}/${s.month}/${s.day}`;
}

function isToday(
  dateStr: string | number | undefined | null
): boolean {
  if (!dateStr) return false;

  try {
    const str = String(dateStr);
    const now = new Date();

    if (
      str.startsWith(
        now.toISOString().split("T")[0]
      )
    ) {
      return true;
    }

    if (str.includes(formatShamsiDate(now))) {
      return true;
    }

    const num = Number(dateStr);

    if (!isNaN(num) && num > 1000000000000) {
      return (
        new Date(num).toDateString() ===
        now.toDateString()
      );
    }
  } catch {}

  return false;
}

// ═══════════ Main Component ═══════════

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);

  const [customers, setCustomers] =
    useState<Customer[]>([]);

  const [entries, setEntries] =
    useState<CashEntry[]>([]);

  const [transactions, setTransactions] =
    useState<Transaction[]>([]);

  const [hawalas, setHawalas] =
    useState<Hawala[]>([]);

  const [lastUpdated, setLastUpdated] =
    useState<Date | null>(null);

  // ═══════════ Load Initial Data ═══════════

  useEffect(() => {
    try {
      setCustomers(
        loadCustomersShared() as Customer[]
      );

      setEntries(
        loadCashEntriesShared() as CashEntry[]
      );

      setTransactions(
        loadTransactionsShared() as Transaction[]
      );

      setHawalas(
        loadHawalasShared() as Hawala[]
      );

      setLastUpdated(new Date());
    } catch (err) {
      console.error("Dashboard load error:", err);
    }

    setMounted(true);
  }, []);

  // ═══════════ Shared Sync ═══════════

  useEffect(() => {
    const handleSync = () => {
      try {
        setCustomers(
          loadCustomersShared() as Customer[]
        );

        setEntries(
          loadCashEntriesShared() as CashEntry[]
        );

        setTransactions(
          loadTransactionsShared() as Transaction[]
        );

        setHawalas(
          loadHawalasShared() as Hawala[]
        );

        setLastUpdated(new Date());
      } catch (error) {
        console.error("Dashboard sync error:", error);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (
        [
          CUSTOMERS_KEY,
          TRANSACTIONS_KEY,
          HAWALAS_KEY,
          CASH_KEY,
        ].includes(event.key || "")
      ) {
        handleSync();
      }
    };

    window.addEventListener(
      "storage",
      handleStorage
    );

    window.addEventListener(
      "focus",
      handleSync
    );

    window.addEventListener(
      "db:updated",
      handleSync
    );

    return () => {
      window.removeEventListener(
        "storage",
        handleStorage
      );

      window.removeEventListener(
        "focus",
        handleSync
      );

      window.removeEventListener(
        "db:updated",
        handleSync
      );
    };
  }, []);

  // ═══════════ Live Clock ═══════════

  const [now, setNow] =
    useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());

    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const currentDateTime = now
    ? formatShamsiDate(now)
    : "--";

  // ═══════════ Physical Cash ═══════════

  const physicalCashBalances = useMemo(() => {
    const balances: Record<Currency, number> = {
      AFN: 0,
      USD: 0,
      EUR: 0,
      IRR: 0,
      PKR: 0,
    };

    for (const entry of entries) {
      if (
        entry.status === "voided" ||
        !currencies.includes(
          entry.currency as Currency
        )
      ) {
        continue;
      }

      if (
        [
          "customer_deposit",
          "customer_withdraw",
          "owner_deposit",
          "owner_withdraw",
          "adjustment",
          "fee",
          "commission_withdraw",
        ].includes(entry.type)
      ) {
        const currency =
          entry.currency as Currency;

        balances[currency] +=
          entry.direction === "in"
            ? entry.amount
            : -entry.amount;
      }
    }

    return balances;
  }, [entries]);

  // ═══════════ Customer Deposits ═══════════

  const customerDeposits = useMemo(() => {
    const totals: Record<Currency, number> = {
      AFN: 0,
      USD: 0,
      EUR: 0,
      IRR: 0,
      PKR: 0,
    };

    for (const customer of customers) {
      if (
        customer.id === CASH_BOX_ID ||
        customer.id === EXCHANGE_ACCOUNT_ID
      ) {
        continue;
      }

      for (const currency of currencies) {
        const balance =
          customer.balances?.[currency] || 0;

        if (balance > 0) {
          totals[currency] += balance;
        }
      }
    }

    return totals;
  }, [customers]);

  // ═══════════ Customer Debts ═══════════

  const customerDebts = useMemo(() => {
    const totals: Record<Currency, number> = {
      AFN: 0,
      USD: 0,
      EUR: 0,
      IRR: 0,
      PKR: 0,
    };

    for (const customer of customers) {
      if (
        customer.id === CASH_BOX_ID ||
        customer.id === EXCHANGE_ACCOUNT_ID
      ) {
        continue;
      }

      for (const currency of currencies) {
        const balance =
          customer.balances?.[currency] || 0;

        if (balance < 0) {
          totals[currency] +=
            Math.abs(balance);
        }
      }
    }

    return totals;
  }, [customers]);

  // ═══════════ Exchange Account ═══════════

  const exchangeBalance = useMemo(() => {
    const exchangeAccount = customers.find(
      (customer) =>
        customer.id === EXCHANGE_ACCOUNT_ID
    );

    return exchangeAccount?.balances || {
      AFN: 0,
      USD: 0,
      EUR: 0,
      IRR: 0,
      PKR: 0,
    };
  }, [customers]);

  // ═══════════ Total Commission ═══════════

  const totalCommissionEarned = useMemo(() => {
    const totals: Record<Currency, number> = {
      AFN: 0,
      USD: 0,
      EUR: 0,
      IRR: 0,
      PKR: 0,
    };

    for (const transaction of transactions) {
      if (transaction.status === "voided") {
        continue;
      }

      if (
        transaction.commission &&
        transaction.commission > 0 &&
        transaction.commissionCurrency
      ) {
        totals[
          transaction.commissionCurrency
        ] += transaction.commission;
      }
    }

    for (const hawala of hawalas) {
      if (hawala.status === "cancelled") {
        continue;
      }

      if (
        hawala.fee &&
        hawala.fee > 0 &&
        hawala.feeCurrency
      ) {
        totals[hawala.feeCurrency] += hawala.fee;
      }
    }

    return totals;
  }, [transactions, hawalas]);

  // ═══════════ Commission Withdrawn ═══════════

  const commissionWithdrawn = useMemo(() => {
    const totals: Record<Currency, number> = {
      AFN: 0,
      USD: 0,
      EUR: 0,
      IRR: 0,
      PKR: 0,
    };

    for (const entry of entries) {
      if (
        entry.type === "commission_withdraw" &&
        entry.status === "active" &&
        entry.direction === "out"
      ) {
        totals[entry.currency] += entry.amount;
      }
    }

    return totals;
  }, [entries]);

  // ═══════════ Available Commission ═══════════

  const availableCommission = useMemo(() => {
    const totals: Record<Currency, number> = {
      AFN: 0,
      USD: 0,
      EUR: 0,
      IRR: 0,
      PKR: 0,
    };

    for (const currency of currencies) {
      totals[currency] = Math.max(
        0,
        (totalCommissionEarned[currency] || 0) -
          (commissionWithdrawn[currency] || 0)
      );
    }

    return totals;
  }, [
    totalCommissionEarned,
    commissionWithdrawn,
  ]);

  // ═══════════ Today's Statistics ═══════════

  const todayStats = useMemo(() => {
    let tradeCount = 0;
    let hawalaCount = 0;

    let tradeAmountSum = 0;
    let hawalaAmountSum = 0;

    let tradeCommissionSum = 0;
    let hawalaFeeSum = 0;

    for (const transaction of transactions) {
      if (transaction.status === "voided") {
        continue;
      }

      if (isToday(transaction.date)) {
        tradeCount++;

        tradeAmountSum +=
          transaction.amount || 0;

        if (
          transaction.commission &&
          transaction.commission > 0
        ) {
          tradeCommissionSum +=
            transaction.commission;
        }
      }
    }

    for (const hawala of hawalas) {
      if (hawala.status === "cancelled") {
        continue;
      }

      if (isToday(hawala.date)) {
        hawalaCount++;

        hawalaAmountSum +=
          hawala.amountFrom || 0;

        if (
          hawala.fee &&
          hawala.fee > 0
        ) {
          hawalaFeeSum += hawala.fee;
        }
      }
    }

    return {
      tradeCount,
      hawalaCount,
      tradeAmountSum,
      hawalaAmountSum,
      tradeCommissionSum,
      hawalaFeeSum,
    };
  }, [transactions, hawalas]);

  // ═══════════ Debtors Count ═══════════

  const debtorsCount = useMemo(() => {
    return customers.filter((customer) => {
      if (
        customer.id === CASH_BOX_ID ||
        customer.id === EXCHANGE_ACCOUNT_ID
      ) {
        return false;
      }

      return currencies.some(
        (currency) =>
          (customer.balances?.[currency] || 0) < 0
      );
    }).length;
  }, [customers]);

  // جلوگیری از هشدار TypeScript
  void lastUpdated;
  void debtorsCount;

  // ═══════════ Loading ═══════════

  if (!mounted) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        dir="rtl"
      >
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-emerald-500" />

          <p className="mt-4 text-slate-500">
            در حال بارگذاری...
          </p>
        </div>
      </div>
    );
  }

  // ═══════════ UI Styles ═══════════

  const heading = "text-slate-900";
  const subText = "text-slate-500";
  const glassChip =
    "border-emerald-100 bg-white/85";

  return (
    <div dir="rtl">

      <style>{`
        @import url("https://fonts.googleapis.com/css2?family=Lalezar&family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap");

        .cs-font {
          font-family: "Vazirmatn", "Segoe UI", Tahoma, sans-serif;
        }

        .cs-display {
          font-family: "Lalezar", "Vazirmatn", Tahoma, sans-serif;
          letter-spacing: .01em;
        }

        @keyframes csUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .cs-up {
          animation: csUp .5s cubic-bezier(.22,.8,.35,1) both;
        }

        ::selection {
          background: rgba(16,185,129,.25);
        }
      `}</style>

      <div className="cs-font relative min-h-screen overflow-x-hidden antialiased bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 text-slate-800">

        <div className="fixed inset-x-0 top-0 z-30 h-1 bg-gradient-to-l from-emerald-500 via-teal-500 to-cyan-500" />

        <div className="relative z-10 mx-auto w-full max-w-7xl space-y-4 md:space-y-6 px-3 pb-16 pt-5 md:px-8 md:pt-9">

          {/* Header */}

          <header className="cs-up flex flex-wrap items-center justify-between gap-3">

            <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0">

              <div className="relative grid h-11 w-11 md:h-14 md:w-14 shrink-0 place-items-center rounded-xl md:rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-400 text-white shadow-lg shadow-emerald-500/30 ring-1 ring-white/30">

                <span className="text-2xl md:text-3xl">
                  📊
                </span>

                <span className="absolute -bottom-1 -left-1 md:-bottom-1.5 md:-left-1.5 grid h-4 min-w-4 md:h-5 md:min-w-5 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-400 px-1 text-[7px] md:text-[8px] font-black text-white ring-2 ring-[#ecfdf5]">
                  DB
                </span>

              </div>

              <div className="min-w-0">

                <h1
                  className={`cs-display text-2xl md:text-4xl leading-none ${heading}`}
                >
                  داشبورد حساب‌ها
                </h1>

                <p
                  className={`mt-1 text-[10px] md:text-xs font-bold ${subText}`}
                >
                  صرافی برادران نورزاد — هرات
                </p>

              </div>

            </div>

            <div className="flex items-center gap-1.5 md:gap-2.5">

              <div
                className={`hidden sm:flex items-center gap-2 rounded-xl border px-3 py-2 shadow-sm backdrop-blur ${glassChip}`}
              >

                <span className="relative flex h-2.5 w-2.5">

                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />

                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />

                </span>

                <span
                  dir="ltr"
                  className="text-xs font-bold tabular-nums text-slate-700"
                >
                  {currentDateTime}
                </span>

              </div>

            </div>

          </header>

          {/* Today's Stats */}

          <section
            className="cs-up space-y-4 md:space-y-5"
            style={{ animationDelay: "70ms" }}
          >

            <div className="flex items-center gap-3 mb-1">

              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl shadow-md bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
                <span className="text-xl">
                  🗓️
                </span>
              </div>

              <div>

                <h2
                  className={`cs-display text-xl md:text-2xl leading-none ${heading}`}
                >
                  آمار امروز
                </h2>

                <p
                  className={`mt-1 text-[10px] md:text-xs font-bold ${subText}`}
                >
                  خلاصه فعالیت‌های روزانه
                </p>

              </div>

            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">

              {[
                {
                  label: "مجموع تبادل ارز",
                  value: fmt(
                    todayStats.tradeAmountSum
                  ),
                  sub: `${fa(
                    todayStats.tradeCount
                  )} معامله`,
                  color: "text-blue-700",
                  bg: "from-blue-50 to-white",
                  border: "border-blue-200",
                  icon: "bg-blue-100 text-blue-600",
                },
                {
                  label: "مجموع حواله‌ها",
                  value: fmt(
                    todayStats.hawalaAmountSum
                  ),
                  sub: `${fa(
                    todayStats.hawalaCount
                  )} حواله`,
                  color: "text-purple-700",
                  bg: "from-purple-50 to-white",
                  border: "border-purple-200",
                  icon: "bg-purple-100 text-purple-600",
                },
                {
                  label: "کارمزد تبادل",
                  value: fmt(
                    todayStats.tradeCommissionSum
                  ),
                  sub: "درآمد خالص",
                  color: "text-amber-700",
                  bg: "from-amber-50 to-white",
                  border: "border-amber-200",
                  icon: "bg-amber-100 text-amber-600",
                },
                {
                  label: "کارمزد حواله‌جات",
                  value: fmt(
                    todayStats.hawalaFeeSum
                  ),
                  sub: "درآمد خالص",
                  color: "text-rose-700",
                  bg: "from-rose-50 to-white",
                  border: "border-rose-200",
                  icon: "bg-rose-100 text-rose-600",
                },
              ].map((stat, i) => (
                <div
                  key={i}
                  className={`group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] ${stat.border} bg-gradient-to-br ${stat.bg}`}
                >

                  <div className="relative flex items-center gap-2.5 mb-2">

                    <span
                      className={`grid h-10 w-10 place-items-center rounded-xl shadow-sm ${stat.icon}`}
                    >
                      <span className="text-xl">
                        💰
                      </span>
                    </span>

                    <span
                      className={`text-[11px] md:text-[12px] font-black ${stat.color}`}
                    >
                      {stat.label}
                    </span>

                  </div>

                  <p
                    className={`relative text-2xl md:text-3xl font-black tabular-nums leading-none ${stat.color}`}
                  >
                    {stat.value}
                  </p>

                  <div
                    className={`mt-1.5 text-[9px] font-bold ${stat.color} opacity-70`}
                  >
                    {stat.sub}
                  </div>

                </div>
              ))}

            </div>

          </section>

          {/* Physical Cash & Exchange Account */}

          <section
            className="cs-up space-y-4 md:space-y-5"
            style={{ animationDelay: "140ms" }}
          >

            {/* Physical Cash */}

            <div className="relative overflow-hidden rounded-xl md:rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-3 md:p-4 transition-all duration-300 hover:shadow-xl">

              <div className="relative flex items-center gap-3 mb-3">

                <div className="relative grid h-10 w-10 md:h-12 md:w-12 shrink-0 place-items-center rounded-xl shadow-md bg-gradient-to-br from-emerald-500 to-teal-500 text-white">

                  <span className="text-xl md:text-2xl">
                    🏦
                  </span>

                  <span className="absolute -top-1 -right-1 flex h-3 w-3">

                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />

                    <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />

                  </span>

                </div>

                <div className="flex-1 min-w-0">

                  <b className="block text-sm md:text-base font-black text-emerald-700">
                    💰 موجودی فیزیکی صندوق
                  </b>

                  <span className="block text-[10px] md:text-[11px] font-bold mt-0.5 text-slate-500">
                    مجموع خالص تمام ورودی‌ها و خروجی‌های نقدی
                  </span>

                </div>

              </div>

              <div className="relative grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 md:gap-3">

                {currencies.map((currency) => {
                  const balance =
                    physicalCashBalances[
                      currency
                    ];

                  const isNegative =
                    balance < 0;

                  return (
                    <div
                      key={currency}
                      className="group relative overflow-hidden rounded-xl bg-white/90 ring-1 ring-emerald-100 p-2.5 md:p-3 text-center transition-all duration-300 shadow-sm"
                    >

                      <div className="text-[11px] md:text-[12px] font-black mb-1 text-slate-500">
                        {labels[currency]}
                      </div>

                      <div
                        className={`text-lg md:text-xl font-black tabular-nums leading-tight ${
                          isNegative
                            ? "text-rose-500"
                            : "text-emerald-700"
                        }`}
                      >
                        {fmt(balance)}
                      </div>

                      <div
                        className={`mt-1 text-[8px] md:text-[9px] font-black ${
                          isNegative
                            ? "text-rose-500"
                            : "text-emerald-600/70"
                        }`}
                      >
                        {isNegative
                          ? "⚠️ کسری"
                          : "✅ نقدی"}
                      </div>

                    </div>
                  );
                })}

              </div>

            </div>

            {/* Exchange Account */}

            <div className="relative overflow-hidden rounded-xl md:rounded-2xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-3 md:p-4 transition-all duration-300 hover:shadow-xl">

              <div className="relative flex items-center gap-3 mb-3">

                <div className="relative grid h-10 w-10 md:h-12 md:w-12 shrink-0 place-items-center rounded-xl shadow-md bg-gradient-to-br from-violet-500 to-indigo-500 text-white">

                  <span className="text-xl md:text-2xl">
                    💼
                  </span>

                </div>

                <div className="flex-1 min-w-0">

                  <b className="block text-sm md:text-base font-black text-violet-700">
                    💼 موجودی حساب صرافی
                  </b>

                  <span className="block text-[10px] md:text-[11px] font-bold mt-0.5 text-slate-500">
                    سرمایه صرافی (واریز/برداشت مالک + قرض)
                  </span>

                </div>

              </div>

              <div className="relative grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 md:gap-3">

                {currencies.map((currency) => {
                  const balance =
                    exchangeBalance[
                      currency
                    ];

                  const isNegative =
                    balance < 0;

                  return (
                    <div
                      key={currency}
                      className="group relative overflow-hidden rounded-xl bg-white/90 ring-1 ring-violet-100 p-2.5 md:p-3 text-center transition-all duration-300 shadow-sm"
                    >

                      <div className="text-[11px] md:text-[12px] font-black mb-1 text-slate-500">
                        {labels[currency]}
                      </div>

                      <div
                        className={`text-lg md:text-xl font-black tabular-nums leading-tight ${
                          isNegative
                            ? "text-rose-500"
                            : "text-violet-700"
                        }`}
                      >
                        {fmt(balance)}
                      </div>

                      <div
                        className={`mt-1 text-[8px] md:text-[9px] font-black ${
                          isNegative
                            ? "text-rose-500"
                            : "text-violet-600/70"
                        }`}
                      >
                        {isNegative
                          ? "⚠️ منفی"
                          : "✅ مثبت"}
                      </div>

                    </div>
                  );
                })}

              </div>

            </div>

            {/* Three Cards */}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">

              {[
                {
                  title: "👥 موجودی مشتریان",
                  sub: "مجموع طلب مشتریان از صرافی",
                  data: customerDeposits,
                  border: "border-sky-200",
                  bg: "from-sky-50 to-white",
                  icon: "bg-sky-100 text-sky-600",
                  text: "text-sky-700",
                },
                {
                  title: "📉 بدهی مشتریان",
                  sub: "مجموع قرض‌های داده‌شده به مشتریان",
                  data: customerDebts,
                  border: "border-rose-200",
                  bg: "from-rose-50 to-white",
                  icon: "bg-rose-100 text-rose-600",
                  text: "text-rose-700",
                },
                {
                  title: "💎 کارمزد قابل برداشت",
                  sub: "درآمد خالص صرافی از معاملات",
                  data: availableCommission,
                  border: "border-amber-200",
                  bg: "from-amber-50 to-white",
                  icon: "bg-amber-100 text-amber-600",
                  text: "text-amber-700",
                },
              ].map((card, i) => (
                <div
                  key={i}
                  className={`group relative overflow-hidden rounded-2xl border p-4 md:p-5 transition-all duration-300 hover:shadow-xl hover:scale-[1.01] ${card.border} bg-gradient-to-br ${card.bg}`}
                >

                  <div className="relative flex items-center gap-3 mb-4">

                    <span
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${card.icon}`}
                    >
                      <span className="text-xl">
                        📊
                      </span>
                    </span>

                    <div className="min-w-0">

                      <b
                        className={`block text-[13px] md:text-[14px] font-black leading-tight ${card.text}`}
                      >
                        {card.title}
                      </b>

                      <span
                        className={`block text-[10px] md:text-[11px] font-bold mt-0.5 ${subText}`}
                      >
                        {card.sub}
                      </span>

                    </div>

                  </div>

                  <div className="relative space-y-1.5">

                    {currencies.map((currency) => {
                      const balance =
                        card.data[currency];

                      return (
                        <div
                          key={currency}
                          className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2 transition-colors"
                        >

                          <span
                            className={`text-[12px] font-black ${subText}`}
                          >
                            {labels[currency]}
                          </span>

                          <span
                            className={`text-[15px] md:text-base font-black tabular-nums ${
                              balance > 0
                                ? card.text
                                : subText
                            }`}
                          >
                            {fmt(balance)}
                          </span>

                        </div>
                      );
                    })}

                  </div>

                </div>
              ))}

            </div>

          </section>

          {/* Accounting Formula */}

          <div
            className="cs-up rounded-2xl border-2 border-slate-200 bg-gradient-to-r from-white to-slate-50 px-5 py-4 md:py-5"
            style={{ animationDelay: "280ms" }}
          >

            <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 text-[12px] md:text-[13px] font-black text-slate-600">

              <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-emerald-700 ring-1 ring-emerald-200">
                💰 صندوق
              </span>

              <span className="text-slate-400">
                =
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-xl bg-violet-50 px-3 py-1.5 text-violet-700 ring-1 ring-violet-200">
                💼 حساب صرافی
              </span>

              <span className="text-slate-400">
                +
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-xl bg-sky-50 px-3 py-1.5 text-sky-700 ring-1 ring-sky-200">
                💳 موجودی مشتریان
              </span>

              <span className="text-rose-500 font-black">
                −
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-1.5 text-rose-700 ring-1 ring-rose-200">
                📉 بدهی مشتریان
              </span>

            </div>

          </div>

          {/* System Overview */}

          <section
            className="cs-up rounded-2xl md:rounded-3xl border-2 border-slate-200 bg-white/95 overflow-hidden"
            style={{ animationDelay: "350ms" }}
          >

            <div className="flex items-center gap-3 p-4 md:p-5 pb-3 md:pb-4 md:px-7 md:pt-6">

              <div className="grid h-11 w-11 md:h-12 md:w-12 place-items-center rounded-xl shadow-md bg-gradient-to-br from-cyan-500 to-sky-500 text-white">
                <span className="text-xl">
                  📋
                </span>
              </div>

              <div className="flex-1 min-w-0">

                <h2
                  className={`cs-display text-xl md:text-2xl leading-none ${heading}`}
                >
                  وضعیت کلی سیستم
                </h2>

                <p
                  className={`mt-1 text-[11px] font-bold ${subText}`}
                >
                  خلاصه تمام بخش‌های حساب‌ها به تفکیک ارز
                </p>

              </div>

            </div>

            <div className="overflow-x-auto px-4 md:px-7 pb-4">

              <table className="w-full min-w-[800px] text-sm">

                <thead>

                  <tr className="border-y border-slate-100 bg-slate-50">

                    {[
                      "ارز",
                      "💰 صندوق",
                      "💳 طلب مشتریان",
                      "📉 بدهی مشتریان",
                      "💼 حساب صرافی",
                      "💎 کارمزد",
                    ].map((header) => (
                      <th
                        key={header}
                        className="px-3 py-3 text-center text-[11px] font-black text-slate-400 whitespace-nowrap"
                      >
                        {header}
                      </th>
                    ))}

                  </tr>

                </thead>

                <tbody className="divide-y divide-slate-100">

                  {currencies.map((currency) => {
                    const cash =
                      physicalCashBalances[
                        currency
                      ];

                    const deposits =
                      customerDeposits[
                        currency
                      ];

                    const debts =
                      customerDebts[
                        currency
                      ];

                    const equity =
                      exchangeBalance[
                        currency
                      ];

                    const commission =
                      availableCommission[
                        currency
                      ];

                    return (
                      <tr
                        key={currency}
                        className="transition-colors hover:bg-emerald-50/70"
                      >

                        <td className="px-3 py-3 text-right">
                          <span className="font-bold text-slate-700">
                            {labels[currency]}
                          </span>
                        </td>

                        <td
                          className={`px-3 py-3 text-center text-[13px] font-black tabular-nums ${
                            cash < 0
                              ? "text-rose-500"
                              : "text-emerald-700"
                          }`}
                        >
                          {fmt(cash)}
                        </td>

                        <td
                          className={`px-3 py-3 text-center text-[13px] font-black tabular-nums ${
                            deposits > 0
                              ? "text-sky-700"
                              : "text-slate-500"
                          }`}
                        >
                          {fmt(deposits)}
                        </td>

                        <td
                          className={`px-3 py-3 text-center text-[13px] font-black tabular-nums ${
                            debts > 0
                              ? "text-rose-500"
                              : "text-slate-500"
                          }`}
                        >
                          {fmt(debts)}
                        </td>

                        <td
                          className={`px-3 py-3 text-center text-[13px] font-black tabular-nums ${
                            equity < 0
                              ? "text-rose-500"
                              : "text-violet-700"
                          }`}
                        >
                          {fmt(equity)}
                        </td>

                        <td
                          className={`px-3 py-3 text-center text-[13px] font-black tabular-nums ${
                            commission > 0
                              ? "text-amber-700"
                              : "text-slate-500"
                          }`}
                        >
                          {fmt(commission)}
                        </td>

                      </tr>
                    );
                  })}

                </tbody>

              </table>

            </div>

          </section>

          {/* Footer */}

          <div
            className={`cs-up text-center py-4 text-[11px] font-bold ${subText}`}
            style={{ animationDelay: "420ms" }}
          >
            🏦 صرافی برادران نورزاد — هرات | هر ۱۵ ثانیه به‌روزرسانی می‌شود
          </div>

        </div>

      </div>

    </div>
  );
}
