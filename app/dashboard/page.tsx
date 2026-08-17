"use client";

import { useEffect, useState } from "react";

type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";

const CURRENCIES: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const LABELS: Record<Currency, string> = {
  AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار",
};
const FLAGS: Record<Currency, string> = {
  AFN: "🇦🇫", USD: "🇺🇸", EUR: "🇪🇺", IRR: "🇮🇷", PKR: "🇵🇰",
};

function getJSON(key: string, fallback: any = []) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export default function DashboardPage() {
  const [data, setData] = useState<any>({
    cashBox: {}, customers: {}, transactions: [], hawalas: [], customersList: []
  });

  useEffect(() => {
    const load = () => {
      const cashEntries = getJSON("cash-entries", []);
      const customers = getJSON("fx-customers", []);
      const transactions = getJSON("fx-transactions", []);
      const hawalas = getJSON("hawalas", []);

      // محاسبه موجودی صندوق
      const cashBox: Record<string, number> = {};
      CURRENCIES.forEach(c => cashBox[c] = 0);
      cashEntries.forEach((e: any) => {
        const cur = e.currency;
        if (!cur || !CURRENCIES.includes(cur)) return;
        const amt = Number(e.amount || 0);
        if (["customer_withdraw", "owner_withdraw", "deposit", "fee"].includes(e.type)) {
          cashBox[cur] += amt;
        } else if (["customer_deposit", "owner_deposit", "withdraw"].includes(e.type)) {
          cashBox[cur] -= amt;
        }
      });

      // محاسبه موجودی کل مشتریان
      const custBal: Record<string, number> = {};
      CURRENCIES.forEach(c => custBal[c] = 0);
      customers.forEach((c: any) => {
        CURRENCIES.forEach(cur => {
          custBal[cur] += Number(c.balances?.[cur] || 0);
        });
      });

      setData({ cashBox, customers: custBal, transactions, hawalas, customersList: customers });
    };

    load();
    window.addEventListener("storage", load);
    window.addEventListener("focus", load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener("focus", load);
    };
  }, []);

  const fmt = (n: number) => (n || 0).toLocaleString("fa-IR");

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <h1 className="text-3xl font-black text-gray-900 dark:text-white">
        📊 داشبورد حساب‌ها — صرافی برادران نورزاد
      </h1>

      {/* موجودی صندوق */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-6 shadow-xl text-white">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          🏦 موجودی فیزیکی صندوق
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {CURRENCIES.map(cur => (
            <div key={cur} className="bg-white/10 backdrop-blur rounded-xl p-3">
              <div className="text-2xl">{FLAGS[cur]}</div>
              <div className="text-xs opacity-80">{LABELS[cur]}</div>
              <div className="text-lg font-black">{fmt(data.cashBox[cur])}</div>
            </div>
          ))}
        </div>
      </div>

      {/* موجودی کل مشتریان */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-6 shadow-xl text-white">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          👥 مجموع موجودی مشتریان ({fmt(data.customersList.length)} مشتری)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {CURRENCIES.map(cur => (
            <div key={cur} className="bg-white/10 backdrop-blur rounded-xl p-3">
              <div className="text-2xl">{FLAGS[cur]}</div>
              <div className="text-xs opacity-80">{LABELS[cur]}</div>
              <div className="text-lg font-black">{fmt(data.customers[cur])}</div>
            </div>
          ))}
        </div>
      </div>

      {/* سرمایه خالص */}
      <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-6 shadow-xl text-white">
        <h2 className="text-xl font-bold mb-4">💼 سرمایه خالص مالک</h2>
        <p className="text-sm opacity-80 mb-3">صندوق - مجموع بیلانس مشتریان</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {CURRENCIES.map(cur => {
            const equity = (data.cashBox[cur] || 0) - (data.customers[cur] || 0);
            return (
              <div key={cur} className="bg-white/10 backdrop-blur rounded-xl p-3">
                <div className="text-2xl">{FLAGS[cur]}</div>
                <div className="text-xs opacity-80">{LABELS[cur]}</div>
                <div className={`text-lg font-black ${equity < 0 ? "text-red-200" : ""}`}>
                  {fmt(equity)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* خلاصه معاملات */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white dark:bg-gray-800 border p-5 shadow">
          <h3 className="font-bold mb-2 text-gray-900 dark:text-white">💱 معاملات</h3>
          <p className="text-3xl font-black text-blue-600">
            {fmt(data.transactions.length)}
          </p>
          <p className="text-sm text-gray-500">معامله ثبت‌شده</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-800 border p-5 shadow">
          <h3 className="font-bold mb-2 text-gray-900 dark:text-white">💸 حواله‌جات</h3>
          <p className="text-3xl font-black text-emerald-600">
            {fmt(data.hawalas.length)}
          </p>
          <p className="text-sm text-gray-500">حواله ثبت‌شده</p>
        </div>
      </div>
    </div>
  );
}
