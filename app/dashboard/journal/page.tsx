"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { collection, query, where, getFirestore, getDocs, doc, updateDoc, runTransaction, limit, startAfter, QueryDocumentSnapshot, Query } from "firebase/firestore";
import { getFirestore as useFirebase } from "@/lib/firebase"; // مسیر Firebase خود را تنظیم کنید
import { useRouter } from "next/navigation";

// تعریف ارزها
type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";
const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const currencyLabels: Record<Currency, string> = { AFN: "افغانی", USD: "دالر آمریکا", EUR: "یورو", IRR: "تومان", PKR: "کلدار پاکستان" };
const currencyFlags: Record<Currency, string> = { AFN: "🇦🇫", USD: "🇺🇸", EUR: "🇪🇺", IRR: "🇮🇷", PKR: "🇵🇰" };

// انواع تراکنش
type TxType = "واریز" | "برداشت" | "انتقال" | "تبدیل" | "هزینه" | "حواله";

// فرم جدول تراکنش
interface JournalEntry {
  id: string;
  timestamp: Date;
  type: TxType;
  description: string;
  currency: Currency;
  amount: number;
  balanceAfter: number;
  partyId?: string;
  partyName?: string;
  status: "active" | "voided";
  voidedReason?: string;
}

// تعریف یک تراکنش در فایرستور
interface FirestoreTransaction {
  id: string;
  timestamp: Date;
  type: "exchange" | "transfer" | "convert" | "hawala";
  fromCurrency: Currency;
  toCurrency: Currency;
  fromAmount: number;
  toAmount: number;
  commission?: number;
  commissionCurrency?: Currency;
  dealType?: "buy" | "sell";
  senderId?: string;
  senderName?: string;
  receiverId?: string;
  receiverName?: string;
  description?: string;
  status: "active" | "voided";
  voidedReason?: string;
  customerId?: string;
  customerName?: string;
}

export default function JournalPage() {
  const router = useRouter();
  const db = getFirestore(useFirebase());

  // ✅ ۱. stateهای اصلی
  const [transactions, setTransactions] = useState<JournalEntry[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setToDate] = useState<string>("");
  const [currencyFilter, setCurrencyFilter] = useState<Currency | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [exchangeRates, setExchangeRates] = useState<Record<Currency, number>>({
    AFN: 1,
    EUR: 0.85,
    IRR: 42000,
    PKR: 160,
    USD: 1,
  });

  const [cashBalances, setCashBalances] = useState<Record<Currency, number>>({
    AFN: 0,
    USD: 0,
    EUR: 0,
    IRR: 0,
    PKR: 0,
  });

  const [todaySummary, setTodaySummary] = useState({
    count: 0,
    deposits: 0,
    withdrawals: 0,
    transfers: 0,
  });

  const [searching, setSearching] = useState(false);

  // ✅ ۲. بارگذاری نرخ ارزها
  useEffect(() => {
    const fetchExchangeRates = async () => {
      const docRef = doc(db, "appData", "exchangeRates");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const rates: Record<Currency, number> = {
          AFN: data.AFN || 1,
          USD: data.USD || 1,
          EUR: data.EUR || 0.85,
          IRR: data.IRR || 42000,
          PKR: data.PKR || 160,
        };
        setExchangeRates(rates);
      }
    };

    fetchExchangeRates();
  }, []);

  // ✅ ۳. بارگذاری تراکنش‌ها (با صفحه‌بندی)
  const loadTransactions = useCallback(async (reset = false) => {
    setLoading(true);
    const q: Query = query(collection(db, "transactions"));

    if (dateFrom) {
      q.where("timestamp", ">=", new Date(dateFrom));
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59);
      q.where("timestamp", "<=", to);
    }

    if (currencyFilter !== "all") {
      q.where("currency", "==", currencyFilter);
    }

    if (!reset) {
      q.limit(20);
      if (lastDoc) q.startAfter(lastDoc);
    }

    const snapshot = await getDocs(q);
    const newEntries: JournalEntry[] = [];
    const newLastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

    snapshot.forEach(doc => {
      const data = doc.data() as FirestoreTransaction;
      const entry: JournalEntry = {
        id: data.id,
        timestamp: data.timestamp.toDate(),
        type: (() => {
          if (data.type === "exchange") return data.dealType === "buy" ? "واریز" : "برداشت";
          if (data.type === "transfer") return "انتقال";
          if (data.type === "hawala") return "حواله";
          return "تبدیل";
        })(),
        description: data.description || "توضیحی وجود ندارد",
        currency: data.fromCurrency,
        amount: data.fromAmount,
        balanceAfter: data.balanceAfter || 0,
        partyId: data.customerId || data.senderId,
        partyName: data.customerName || data.senderName || "صندوق",
        status: data.status || "active",
        voidedReason: data.voidedReason,
      };
      newEntries.push(entry);
    });

    if (reset) {
      setTransactions(newEntries);
      setLastDoc(newLastDoc);
    } else {
      setTransactions(prev => [...prev, ...newEntries]);
      setLastDoc(newLastDoc);
    }

    setHasMore(snapshot.docs.length > 0);
    setLoading(false);
  }, [db, dateFrom, dateTo, currencyFilter]);

  // ✅ ۴. بارگذاری موجودی کل صندوق
  useEffect(() => {
    const fetchCashBalances = async () => {
      const snapshot = await getDocs(collection(db, "cashEntries"));
      const balances: Record<Currency, number> = {
        AFN: 0,
        USD: 0,
        EUR: 0,
        IRR: 0,
        PKR: 0,
      };

      snapshot.forEach(doc => {
        const data = doc.data();
        const c = data.currency as Currency;
        if (c && data.status !== "voided") {
          balances[c] += data.amount || 0;
        }
      });

      setCashBalances(balances);
    };

    fetchCashBalances();
  }, [db]);

  // ✅ ۵. محاسبه‌ی خلاصه امروز
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const summary = transactions.reduce(
      (acc, tx) => {
        const txDate = new Date(tx.timestamp);
        if (txDate < today) return acc;

        if (tx.type === "واریز") acc.deposits += tx.amount;
        else if (tx.type === "برداشت" || tx.type === "هزینه") acc.withdrawals += tx.amount;
        else if (tx.type === "انتقال" || tx.type === "حواله") acc.transfers += tx.amount;
        acc.count++;
        return acc;
      },
      { count: 0, deposits: 0, withdrawals: 0, transfers: 0 }
    );

    setTodaySummary(summary);
  }, [transactions]);

  // ✅ ۶. فیلترهای جستجو و تاریخ
  const filteredEntries = useMemo(() => {
    return transactions.filter(tx => {
      if (tx.status === "voided") return false;
      if (currencyFilter !== "all" && tx.currency !== currencyFilter) return false;
      if (searchQuery && !tx.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [transactions, currencyFilter, searchQuery]);

  // ✅ ۷. ابطال تراکنش
  const handleVoid = async (tx: JournalEntry) => {
    const reason = prompt("دلیل ابطال این تراکنش را وارد کنید:");
    if (!reason) return;

    const txRef = doc(db, "transactions", tx.id);
    try {
      await updateDoc(txRef, { status: "voided", voidedReason: reason });
      alert("تراکنش با موفقیت باطل شد.");
    } catch (e) {
      alert("خطا در ابطال تراکنش: " + (e as Error).message);
    }
  };

  // ✅ ۸. صفحه‌بندی
  const loadMore = () => {
    if (hasMore && !loading) {
      loadTransactions();
    }
  };

  // ✅ ۹. خروجی CSV
  const handleExport = () => {
    const headers = ["شماره", "تاریخ", "ساعت", "شرح", "ارز", "مبلغ", "نوع", "تراز بعد", "وضعیت"];
    const escapeCsv = (val: any) => `"${String(val ?? "").replace(/"/g, '""')}"`;
    const rows = filteredEntries.map(tx => [
      escapeCsv(tx.id.slice(0, 8)),
      escapeCsv(tx.timestamp.toLocaleDateString("fa-IR")),
      escapeCsv(tx.timestamp.toLocaleTimeString("fa-IR")),
      escapeCsv(tx.description),
      escapeCsv(tx.currency),
      escapeCsv(tx.amount),
      escapeCsv(tx.type),
      escapeCsv(tx.balanceAfter),
      escapeCsv(tx.status === "voided" ? `باطل شده (${tx.voidedReason})` : "فعال"),
    ].join(","));

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `journal-report-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ✅ ۱۰. تابع کمکی برای رنگ‌بندی نوع تراکنش
  const getBadgeClass = (type: TxType) => {
    switch (type) {
      case "واریز": return "bg-emerald-400/20 text-emerald-300 px-2 py-0.5 rounded-full text-xs font-bold";
      case "برداشت": return "bg-rose-400/20 text-rose-300 px-2 py-0.5 rounded-full text-xs font-bold";
      case "انتقال": return "bg-blue-400/20 text-blue-300 px-2 py-0.5 rounded-full text-xs font-bold";
      case "تبدیل": return "bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full text-xs font-bold";
      case "هزینه": return "bg-purple-400/20 text-purple-300 px-2 py-0.5 rounded-full text-xs font-bold";
      case "حواله": return "bg-sky-400/20 text-sky-300 px-2 py-0.5 rounded-full text-xs font-bold";
      default: return "bg-slate-400/20 text-slate-300 px-2 py-0.5 rounded-full text-xs font-bold";
    }
  };

  return (
    <div dir="rtl" className="space-y-6 p-4 md:p-8 bg-slate-900 min-h-screen font-sans text-slate-200">
      {/* ۱. هدر بالایی - نرخ‌های زنده */}
      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm flex justify-between overflow-x-auto">
        {currencies.map(c => (
          <div key={c} className="flex flex-col items-center min-w-[120px]">
            <span className="text-slate-400">{currencyLabels[c]}</span>
            <span className="text-slate-200 font-bold tabular-nums">{exchangeRates[c].toLocaleString("en-US")}</span>
          </div>
        ))}
      </div>

      {/* ۲. نوار فیلتر */}
      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="relative">
          <label className="text-xs text-slate-400 mb-1 block">از تاریخ</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="w-full border bg-slate-900 border-slate-700 text-slate-200 rounded-lg px-3 py-2 outline-none [color-scheme:dark]"
          />
        </div>
        <div className="relative">
          <label className="text-xs text-slate-400 mb-1 block">تا تاریخ</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setToDate(e.target.value)}
            className="w-full border bg-slate-900 border-slate-700 text-slate-200 rounded-lg px-3 py-2 outline-none [color-scheme:dark]"
          />
        </div>
        <select
          value={currencyFilter}
          onChange={e => setCurrencyFilter(e.target.value as Currency | "all")}
          className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 outline-none"
        >
          <option value="all">همه ارزها</option>
          {currencies.map(c => (
            <option key={c} value={c}>{currencyLabels[c]}</option>
          ))}
        </select>
        <div className="relative">
          <label className="text-xs text-slate-400 mb-1 block">جستجو</label>
          <input
            type="text"
            placeholder="جستجو در شرح، شماره یا مشتری..."
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setSearching(!!e.target.value);
            }}
            className="w-full border bg-slate-900 border-slate-700 text-slate-200 rounded-lg px-3 py-2 pr-9 text-sm outline-none"
          />
          <svg className="absolute right-3 top-8 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* ۳. جدول تراکنش‌ها */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-800/50 text-slate-300 font-bold border-b border-slate-700">
              <tr>
                <th className="px-4 py-3 text-center">شماره</th>
                <th className="px-4 py-3 text-center">تاریخ/ساعت</th>
                <th className="px-4 py-3">شرح</th>
                <th className="px-4 py-3 text-center">ارز</th>
                <th className="px-4 py-3 text-center">مبلغ</th>
                <th className="px-4 py-3 text-center">نوع</th>
                <th className="px-4 py-3 text-center">تراز بعد</th>
                <th className="px-4 py-3 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">هیچ تراکنشی یافت نشد.</td>
                </tr>
              ) : (
                filteredEntries.map((tx, idx) => {
                  const isVoided = tx.status === "voided";
                  return (
                    <tr key={tx.id} className={`hover:bg-slate-700/30 transition ${isVoided ? "bg-slate-700/10" : ""}`}>
                      <td className="px-4 py-3 text-center text-slate-300 tabular-nums">{tx.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-center text-slate-300">
                        {tx.timestamp.toLocaleDateString("fa-IR")}<br />
                        <span className="text-[10px] text-slate-400">{tx.timestamp.toLocaleTimeString("fa-IR")}</span>
                      </td>
                      <td className={`px-4 py-3 font-medium ${isVoided ? "text-slate-400 line-through" : "text-slate-200"}`}>
                        {tx.description}
                        {isVoided && <div className="text-[10px] text-rose-400 mt-1">دلیل: {tx.voidedReason}</div>}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-300">
                        {currencyFlags[tx.currency]} {tx.currency}
                      </td>
                      <td className={`px-4 py-3 text-center font-bold tabular-nums ${isVoided ? "text-slate-400 line-through" : tx.type === "واریز" ? "text-emerald-400" : "text-rose-400"}`}>
                        {tx.type === "واریز" ? "+" : "-"} {tx.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={getBadgeClass(tx.type)}>{tx.type}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-300 tabular-nums">{tx.balanceAfter.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-center">
                        {!isVoided && (
                          <button
                            onClick={() => handleVoid(tx)}
                            disabled={false}
                            className="text-xs bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 px-3 py-1.5 rounded-lg font-bold transition"
                          >
                            ابطال
                          </button>
                        )}
                        {isVoided && <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded">باطل‌شده</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {hasMore && (
          <div className="text-center p-3">
            <button onClick={loadMore} disabled={loading} className="text-sm text-slate-300 underline">
              {loading ? "در حال بارگذاری..." : "نمایش بیشتر"}
            </button>
          </div>
        )}
      </div>

      {/* ۴. موجودی کل صندوق */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        {currencies.map(c => (
          <div key={c} className="bg-slate-800/50 rounded-xl border border-slate-700 p-3 text-center">
            <div className="text-xs text-slate-400 mb-1">{currencyLabels[c]}</div>
            <div className="text-xl font-bold tabular-nums text-slate-200">{cashBalances[c].toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
          </div>
        ))}
      </div>

      {/* ۵. خلاصه امروز */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-3 text-center">
          <div className="text-xs text-slate-400 mb-1">تعداد کل</div>
          <div className="text-xl font-bold tabular-nums text-slate-200">{todaySummary.count}</div>
        </div>
        <div className="bg-emerald-400/10 rounded-xl border border-emerald-400/20 p-3 text-center">
          <div className="text-xs text-emerald-400 mb-1">واریز</div>
          <div className="text-xl font-bold tabular-nums text-emerald-300">{todaySummary.deposits.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="bg-rose-400/10 rounded-xl border border-rose-400/20 p-3 text-center">
          <div className="text-xs text-rose-400 mb-1">برداشت</div>
          <div className="text-xl font-bold tabular-nums text-rose-300">{todaySummary.withdrawals.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="bg-blue-400/10 rounded-xl border border-blue-400/20 p-3 text-center">
          <div className="text-xs text-blue-400 mb-1">انتقال</div>
          <div className="text-xl font-bold tabular-nums text-blue-300">{todaySummary.transfers.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      {/* ۶. دکمه خروجی CSV */}
      <div className="flex justify-end">
        <button onClick={handleExport} className="flex items-center gap-2 bg-emerald-500 text-slate-900 px-4 py-2 rounded-lg hover:bg-emerald-600 transition text-sm font-bold">
          <span>📊</span> خروجی CSV
        </button>
      </div>
    </div>
  );
}
