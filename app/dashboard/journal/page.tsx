"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  collection, query, where, orderBy, limit, startAfter, 
  getDocs, Timestamp, onSnapshot 
} from "firebase/firestore";
import { db } from "../lib/firebase"; // مسیر کانفیگ شما
// ✅ اتصال به توابع مشترک (همان توابعی که در فایل قبل ساختیم)
import { voidTransaction, fetchCustomerName } from "../lib/firestoreActions";
import * as XLSX from "xlsx";

// --- Types ---
type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";
const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const currencyLabels: Record<Currency, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };
const currencyFlags: Record<Currency, string> = { AFN: "🇦🇫", USD: "🇺🇸", EUR: "🇪🇺", IRR: "🇮🇷", PKR: "🇵🇰" };

type TxType = "واریز" | "برداشت" | "انتقال" | "تبدیل" | "هزینه";
const typeLabels: Record<string, TxType> = {
  deposit: "واریز", withdrawal: "برداشت", hawala_in: "انتقال", hawala_out: "انتقال",
  buy_currency: "تبدیل", sell_currency: "تبدیل", commission: "هزینه", reversal: "ابطال"
};

interface Transaction {
  id: string;
  timestamp: Timestamp;
  type: TxType;
  description: string;
  currency: Currency;
  amount: number;
  balanceAfter: number;
  partyId: string;
  status: "active" | "voided";
  voidedReason?: string;
}

const fmt = (n: number) => Number.isFinite(n) ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00";

// --- Helper: URL State Management ---
function useUrlState(key: string, defaultValue: string) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const value = searchParams.get(key) || defaultValue;
  const setValue = (newValue: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newValue && newValue !== defaultValue) params.set(key, newValue);
    else params.delete(key);
    router.push(`?${params.toString()}`, { scroll: false });
  };
  return [value, setValue] as const;
}

export default function JournalPage() {
  const searchParams = useSearchParams();

  // State for Filters
  const [dateRange, setDateRange] = useUrlState("date", "all");
  const [typeFilter, setTypeFilter] = useUrlState("type", "all");
  const [currencyFilter, setCurrencyFilter] = useUrlState("currency", "all");
  const [searchQuery, setSearchQuery] = useUrlState("search", "");

  // State for Data
  const [entries, setEntries] = useState<Transaction[]>([]);
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({});
  const [exchangeRates, setExchangeRates] = useState<Record<string, { rate: number }>>({});
  const [loading, setLoading] = useState(true);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [voidingId, setVoidingId] = useState<string | null>(null);

  // --- ۱. بارگذاری نرخ ارزها (Live) ---
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "appData", "exchangeRates", "rates"), (snapshot) => {
      const rates: Record<string, { rate: number }> = {};
      snapshot.forEach(doc => { rates[doc.id] = doc.data() as { rate: number }; });
      setExchangeRates(rates);
    });
    return () => unsubscribe();
  }, []);

  // --- ۲. دریافت داده از Firestore با فیلترهای بهینه ---
  const fetchEntries = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      let q = query(collection(db, "transactions"), orderBy("timestamp", "desc"), limit(50));
      
      // فیلترهای Firestore (سمت سرور)
      if (typeFilter !== "all") {
        // نگاشت نوع فیلتر URL به نوع دیتابیس
        const dbType = typeFilter === "hawala_in" || typeFilter === "hawala_out" ? "انتقال" : 
                       typeFilter === "buy_currency" || typeFilter === "sell_currency" ? "تبدیل" :
                       typeFilter === "commission" ? "هزینه" : typeLabels[typeFilter] || typeFilter;
        q = query(q, where("type", "==", dbType));
      }
      if (currencyFilter !== "all") q = query(q, where("currency", "==", currencyFilter));
      q = query(q, where("status", "==", "active")); // فقط تراکنش‌های فعال در لیست اصلی

      // محاسبه بازه زمانی برای فیلتر سروری (جلوگیری از شکستگی Pagination)
      if (dateRange !== "all") {
        const now = new Date();
        let startDate = new Date();
        if (dateRange === "today") startDate.setHours(0, 0, 0, 0);
        else if (dateRange === "week") startDate.setDate(now.getDate() - 7);
        else if (dateRange === "month") startDate.setDate(1); // اول ماه جاری
        
        q = query(q, where("timestamp", ">=", Timestamp.fromDate(startDate)));
      }

      if (!reset && lastVisible) {
        q = query(q, startAfter(lastVisible));
      }

      const snapshot = await getDocs(q);
      let newEntries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      
      // فیلتر جستجو در کلاینت (چون Firestore جستجوی متن کامل ندارد)
      if (searchQuery) {
        const lowerSearch = searchQuery.toLowerCase();
        newEntries = newEntries.filter(e => 
          e.description.toLowerCase().includes(lowerSearch)
        );
      }

      setEntries(prev => reset ? newEntries : [...prev, ...newEntries]);
      setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === 50);

      // بارگذاری نام مشتریان به صورت غیرمسدودکننده
      newEntries.forEach(async (tx) => {
        if (tx.partyId && !customerNames[tx.partyId]) {
          const name = await fetchCustomerName(tx.partyId);
          setCustomerNames(prev => ({ ...prev, [tx.partyId]: name }));
        }
      });

    } catch (error) {
      console.error("Error fetching journal:", error);
    } finally {
      setLoading(false);
    }
  }, [dateRange, typeFilter, currencyFilter, searchQuery, lastVisible, customerNames]);

  useEffect(() => { fetchEntries(true); }, [dateRange, typeFilter, currencyFilter, searchQuery]);

  // --- ۳. محاسبه جمع کل موجودی صندوق (Real-time از کل دیتابیس) ---
  const [totals, setTotals] = useState<Record<string, number>>({});
  useEffect(() => {
    const q = query(collection(db, "transactions"), where("status", "==", "active"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const totalsByCurrency: Record<string, number> = {};
      snapshot.forEach(doc => {
        const tx = doc.data() as Transaction;
        if (!totalsByCurrency[tx.currency]) totalsByCurrency[tx.currency] = 0;
        
        if (tx.type === "واریز" || tx.type === "انتقال") totalsByCurrency[tx.currency] += tx.amount;
        else if (tx.type === "برداشت" || tx.type === "هزینه") totalsByCurrency[tx.currency] -= tx.amount;
      });
      setTotals(totalsByCurrency);
    });
    return () => unsubscribe();
  }, []);

  // --- ۴. خلاصه دوره فیلترشده (تبدیل شده به دلار) ---
  const summary = useMemo(() => {
    let deposits = 0, withdrawals = 0, transfers = 0, count = 0;
    entries.forEach(e => {
      count++;
      const rate = exchangeRates[e.currency]?.rate || 1;
      const usdAmount = e.amount / rate;
      if (e.type === "واریز") deposits += usdAmount;
      else if (e.type === "برداشت") withdrawals += usdAmount;
      else if (e.type === "انتقال") transfers += usdAmount;
    });
    return { count, deposits, withdrawals, transfers };
  }, [entries, exchangeRates]);

  // --- ۵. ابطال اتمیک تراکنش (متصل به تابع مشترک) ---
  const handleVoid = async (entry: Transaction) => {
    const reason = prompt("دلیل ابطال این تراکنش را وارد کنید:");
    if (!reason) return;
    
    setVoidingId(entry.id);
    try {
      // ✅ استفاده از تابع مشترک به جای حذف یا آپدیت دستی
      await voidTransaction(entry.id); 
      alert("تراکنش با موفقیت باطل و موجودی به‌صورت اتمیک اصلاح شد.");
      fetchEntries(true);
    } catch (err) {
      alert("خطا در ابطال تراکنش: " + (err as Error).message);
    } finally {
      setVoidingId(null);
    }
  };

  // --- ۶. خروجی Excel ---
  const handleExport = () => {
    const dataToExport = entries.map(e => ({
      "شماره سند": e.id.slice(0, 8),
      "تاریخ/ساعت": e.timestamp?.toDate ? e.timestamp.toDate().toLocaleString("fa-IR") : "-",
      "شرح معامله": e.description,
      "مشتری": customerNames[e.partyId] || e.partyId,
      "ارز": currencyLabels[e.currency],
      "مبلغ": e.amount,
      "نوع": e.type,
      "تراز پس از معامله": e.balanceAfter,
      "وضعیت": e.status === "voided" ? "باطل شده" : "فعال"
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Journal");
    XLSX.writeFile(wb, `Journal_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // --- Helper: استایل بج نوع تراکنش ---
  const getTypeBadgeStyle = (type: TxType, isVoided: boolean) => {
    if (isVoided) return "bg-gray-200 text-gray-500 line-through";
    const styles: Record<TxType, string> = {
      "واریز": "bg-green-100 text-green-800",
      "برداشت": "bg-red-100 text-red-800",
      "انتقال": "bg-blue-100 text-blue-800",
      "تبدیل": "bg-yellow-100 text-yellow-800",
      "هزینه": "bg-purple-100 text-purple-800"
    };
    return styles[type] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6 p-4 md:p-8 bg-slate-50 min-h-screen font-sans" dir="rtl">
      
      {/* ۱. هدر بالای صفحه — نرخ ارزهای زنده */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {currencies.map(cur => (
          <div key={cur} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
            <div>
              <div className="text-xs text-slate-500 font-medium">{currencyFlags[cur]} {currencyLabels[cur]}</div>
              <div className="text-lg font-bold text-slate-800 mt-1">
                {exchangeRates[cur]?.rate ? fmt(exchangeRates[cur].rate) : "—"}
              </div>
            </div>
            <div className="text-[10px] text-slate-400 bg-slate-50 px-2 py-1 rounded">نسبت به USD</div>
          </div>
        ))}
      </div>

      {/* هدر صفحه و دکمه اکسل */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">روزنامه کل معاملات</h1>
          <p className="text-slate-500 text-sm mt-1">سابقه کامل و حسابرسی‌پذیر تمام رویدادهای مالی</p>
        </div>
        <button onClick={handleExport} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition shadow-sm text-sm font-bold">
          <span>📊</span> خروجی Excel
        </button>
      </div>

      {/* ۲. نوار فیلتر */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
        <select value={dateRange} onChange={e => setDateRange(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
          <option value="all">همه زمان‌ها</option>
          <option value="today">امروز</option>
          <option value="week">این هفته</option>
          <option value="month">این ماه</option>
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
          <option value="all">همه انواع تراکنش</option>
          <option value="deposit">واریز</option>
          <option value="withdrawal">برداشت</option>
          <option value="hawala_in">حواله ورودی</option>
          <option value="hawala_out">حواله خروجی</option>
          <option value="buy_currency">خرید ارز (تبدیل)</option>
          <option value="sell_currency">فروش ارز (تبدیل)</option>
          <option value="commission">کمیسیون (هزینه)</option>
        </select>
        <select value={currencyFilter} onChange={e => setCurrencyFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
          <option value="all">همه ارزها</option>
          {currencies.map(c => <option key={c} value={c}>{currencyLabels[c]}</option>)}
        </select>
        <div className="relative">
          <input 
            type="text" 
            placeholder="جستجو در شرح معامله..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 pr-9 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <svg className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
      </div>

      {/* ۳. جدول اصلی روزنامچه */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b">
              <tr>
                <th className="px-4 py-3">شماره سند</th>
                <th className="px-4 py-3">تاریخ/ساعت</th>
                <th className="px-4 py-3">شرح معامله</th>
                <th className="px-4 py-3">مشتری</th>
                <th className="px-4 py-3 text-center">ارز</th>
                <th className="px-4 py-3 text-center">مبلغ</th>
                <th className="px-4 py-3 text-center">نوع</th>
                <th className="px-4 py-3 text-center">تراز حساب</th>
                <th className="px-4 py-3 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && entries.length === 0 && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={9} className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-full"></div></td>
                </tr>
              ))}

              {entries.map((entry) => {
                const isVoided = entry.status === "voided";
                return (
                  <tr key={entry.id} className={`hover:bg-slate-50 transition ${isVoided ? "bg-slate-100/50" : ""}`}>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs whitespace-nowrap">{entry.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                      {entry.timestamp?.toDate ? entry.timestamp.toDate().toLocaleString("fa-IR") : "-"}
                    </td>
                    <td className={`px-4 py-3 font-medium ${isVoided ? "text-slate-400 line-through" : "text-slate-800"}`}>
                      {entry.description}
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {customerNames[entry.partyId] || <span className="animate-pulse text-slate-400 text-xs">...</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600 whitespace-nowrap">
                      <span className="ml-1">{currencyFlags[entry.currency]}</span>
                      {currencyLabels[entry.currency]}
                    </td>
                    <td className={`px-4 py-3 text-center font-bold tabular-nums ${isVoided ? "text-slate-400 line-through" : "text-slate-800"}`}>
                      {fmt(entry.amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${getTypeBadgeStyle(entry.type, isVoided)}`}>
                        {entry.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-700 font-mono text-xs whitespace-nowrap">
                      {fmt(entry.balanceAfter)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {!isVoided && (
                        <button 
                          onClick={() => handleVoid(entry)}
                          disabled={voidingId === entry.id}
                          className="text-xs bg-rose-50 text-rose-600 hover:bg-rose-100 px-3 py-1.5 rounded-lg font-bold transition disabled:opacity-50"
                        >
                          {voidingId === entry.id ? "در حال ابطال..." : "ابطال"}
                        </button>
                      )}
                      {isVoided && <span className="text-[10px] text-slate-400 bg-slate-200 px-2 py-1 rounded">باطل‌شده</span>}
                    </td>
                  </tr>
                );
              })}
              
              {!loading && entries.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500">هیچ تراکنشی با این فیلترها یافت نشد.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Control */}
        {hasMore && !loading && entries.length > 0 && (
          <div className="p-4 border-t text-center bg-slate-50">
            <button onClick={() => fetchEntries(false)} className="text-blue-600 hover:text-blue-800 font-bold text-sm bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm hover:shadow transition">
              بارگذاری ۵۰ تراکنش قبلی...
            </button>
          </div>
        )}
      </div>

      {/* ۴ و ۵. بخش پایینی: جمع کل موجودی و خلاصه دوره */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* جمع کل موجودی هر ارز (پایین سمت راست) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center">
            <span className="w-2 h-2 bg-emerald-500 rounded-full ml-2"></span>
            جمع کل موجودی صندوق (Real-time)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {currencies.map(cur => {
              const amount = totals[cur] || 0;
              if (amount === 0 && Object.keys(totals).length > 0) return null; // مخفی کردن ارزهای صفر
              return (
                <div key={cur} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="text-xs text-slate-500 mb-1 flex items-center">
                    <span className="ml-1">{currencyFlags[cur]}</span> {currencyLabels[cur]}
                  </div>
                  <div className="text-lg font-bold text-slate-800 tabular-nums">{fmt(amount)}</div>
                </div>
              );
            })}
            {Object.keys(totals).length === 0 && <p className="text-slate-400 col-span-5 text-sm text-center py-4">داده‌ای موجود نیست</p>}
          </div>
        </div>

        {/* خلاصه دوره فیلترشده (پایین سمت چپ) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center">
            <span className="w-2 h-2 bg-blue-500 rounded-full ml-2"></span>
            خلاصه دوره انتخاب‌شده
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-100">
              <span className="text-sm text-blue-700 font-medium">تعداد کل معاملات</span>
              <span className="text-lg font-bold text-blue-900 tabular-nums">{summary.count}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg border border-emerald-100">
              <span className="text-sm text-emerald-700 font-medium">مجموع دریافت (معادل USD)</span>
              <span className="text-lg font-bold text-emerald-900 tabular-nums">${fmt(summary.deposits)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-rose-50 rounded-lg border border-rose-100">
              <span className="text-sm text-rose-700 font-medium">مجموع برداشت (معادل USD)</span>
              <span className="text-lg font-bold text-rose-900 tabular-nums">${fmt(summary.withdrawals)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg border border-purple-100">
              <span className="text-sm text-purple-700 font-medium">مجموع حواله (معادل USD)</span>
              <span className="text-lg font-bold text-purple-900 tabular-nums">${fmt(summary.transfers)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
