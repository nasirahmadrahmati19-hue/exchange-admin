"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  collection, query, where, orderBy, limit, startAfter, 
  getDocs, getDoc, doc, runTransaction, serverTimestamp,
  Timestamp, onSnapshot 
} from "firebase/firestore";

import { db } from "../lib/firebase"; 

// --- Types & Constants ---
type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";
const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const currencyLabels: Record<Currency, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };
const currencyFlags: Record<Currency, string> = { AFN: "🇦🇫", USD: "🇺🇸", EUR: "🇪🇺", IRR: "🇮🇷", PKR: "🇵🇰" };
type TxType = "واریز" | "برداشت" | "انتقال" | "تبدیل" | "هزینه";

const typeMap: Record<string, TxType> = {
  deposit: "واریز", withdrawal: "برداشت", hawala_in: "انتقال", hawala_out: "انتقال",
  transfer: "انتقال", buy_currency: "تبدیل", sell_currency: "تبدیل", exchange: "تبدیل",
  commission: "هزینه", fee: "هزینه", reversal: "واریز",
  "واریز": "واریز", "برداشت": "برداشت", "انتقال": "انتقال", "تبدیل": "تبدیل", "هزینه": "هزینه"
};

interface RawTransaction {
  id: string;
  timestamp: Timestamp;
  type: string;
  description?: string;
  note?: string;
  currency: Currency;
  amount: number;
  balanceAfter: number;
  partyId?: string;
  partyName?: string;
  status: "active" | "voided";
  voidedReason?: string;
  toCurrency?: Currency;
  toAmount?: number;
}

function normalizeTransaction(raw: RawTransaction): RawTransaction {
  return {
    ...raw,
    type: typeMap[raw.type] || "واریز",
    description: raw.description || raw.note || "بدون توضیح",
  };
}

const fmt = (n: number) => Number.isFinite(n) ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00";

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

const customerCache: Record<string, string> = {};

async function fetchCustomerName(partyId: string) {
  if (!partyId) return 'نامشخص';
  if (customerCache[partyId]) return customerCache[partyId];
  try {
    const customerSnap = await getDoc(doc(db, 'customers', partyId));
    if (customerSnap.exists()) {
      const name = customerSnap.data().name || 'بدون نام';
      customerCache[partyId] = name;
      return name;
    }
    return 'حذف شده';
  } catch {
    return 'خطا در خواندن';
  }
}

async function voidTransactionAtomic(transactionId: string, collectionName: string) {
  return runTransaction(db, async (transaction) => {
    const txRef = doc(db, collectionName, transactionId);
    const txSnap = await transaction.get(txRef);
    if (!txSnap.exists()) throw new Error('تراکنش یافت نشد');
    
    const txData = txSnap.data() as RawTransaction;
    if (txData.status === 'voided') throw new Error('این تراکنش قبلاً باطل شده است');
    
    if (txData.partyId) {
      const customerRef = doc(db, 'customers', txData.partyId);
      const customerSnap = await transaction.get(customerRef);
      const currentBalance = customerSnap.data()?.balances?.[txData.currency] || 0;
      
      let newBalance = currentBalance;
      const normalizedType = typeMap[txData.type] || "واریز";
      
      if (normalizedType === 'واریز' || normalizedType === 'انتقال') newBalance -= txData.amount;
      else if (normalizedType === 'برداشت' || normalizedType === 'هزینه') newBalance += txData.amount;
      else if (normalizedType === 'تبدیل' && txData.toCurrency && txData.toAmount) {
        const fromBal = customerSnap.data()?.balances?.[txData.currency] || 0;
        const toBal = customerSnap.data()?.balances?.[txData.toCurrency] || 0;
        transaction.update(customerRef, {
          [`balances.${txData.currency}`]: fromBal + txData.amount,
          [`balances.${txData.toCurrency}`]: toBal - txData.toAmount,
          updatedAt: serverTimestamp()
        });
      }
      
      if (normalizedType !== 'تبدیل') {
        transaction.update(customerRef, { [`balances.${txData.currency}`]: newBalance, updatedAt: serverTimestamp() });
      }
    }
    
    transaction.update(txRef, { status: 'voided', voidedAt: serverTimestamp() });
  });
}

export default function JournalPage() {
  const searchParams = useSearchParams();

  const [dateRange, setDateRange] = useUrlState("date", "all");
  const [typeFilter, setTypeFilter] = useUrlState("type", "all");
  const [currencyFilter, setCurrencyFilter] = useUrlState("currency", "all");
  const [searchQuery, setSearchQuery] = useUrlState("search", "");

  const [entries, setEntries] = useState<RawTransaction[]>([]);
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({});
  const [exchangeRates, setExchangeRates] = useState<Record<string, { rate: number }>>({});
  const [loading, setLoading] = useState(true);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [sourceCollection, setSourceCollection] = useState<string>("transactions");

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "appData", "exchangeRates", "rates"), (snapshot) => {
      const rates: Record<string, { rate: number }> = {};
      snapshot.forEach(doc => { rates[doc.id] = doc.data() as { rate: number }; });
      setExchangeRates(rates);
    });
    return () => unsubscribe();
  }, []);

  const fetchFromCollection = useCallback(async (collectionName: string, reset: boolean) => {
    let q = query(collection(db, collectionName), orderBy("timestamp", "desc"), limit(50));
    
    if (typeFilter !== "all") {
      const englishTypes = Object.entries(typeMap).filter(([_, fa]) => fa === typeFilter).map(([en]) => en);
      if (englishTypes.length > 0) {
        q = query(q, where("type", "in", [...englishTypes, typeFilter]));
      } else {
        q = query(q, where("type", "==", typeFilter));
      }
    }
    if (currencyFilter !== "all") q = query(q, where("currency", "==", currencyFilter));
    q = query(q, where("status", "==", "active"));

    if (dateRange !== "all") {
      const now = new Date();
      let startDate = new Date();
      if (dateRange === "today") startDate.setHours(0, 0, 0, 0);
      else if (dateRange === "week") startDate.setDate(now.getDate() - 7);
      else if (dateRange === "month") startDate.setDate(1);
      q = query(q, where("timestamp", ">=", Timestamp.fromDate(startDate)));
    }

    if (!reset && lastVisible) q = query(q, startAfter(lastVisible));

    const snapshot = await getDocs(q);
    let newEntries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RawTransaction));
    newEntries = newEntries.map(normalizeTransaction);
    
    if (searchQuery) {
      const lowerSearch = searchQuery.toLowerCase();
      newEntries = newEntries.filter(e => 
        (e.description || "").toLowerCase().includes(lowerSearch) ||
        (e.partyName || "").toLowerCase().includes(lowerSearch)
      );
    }

    return { entries: newEntries, lastDoc: snapshot.docs[snapshot.docs.length - 1], hasMore: snapshot.docs.length === 50 };
  }, [dateRange, typeFilter, currencyFilter, searchQuery, lastVisible]);

  const fetchEntries = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      let result = await fetchFromCollection("transactions", reset);
      let usedCollection = "transactions";
      
      if (result.entries.length === 0 && reset) {
        result = await fetchFromCollection("journal_entries", reset);
        usedCollection = "journal_entries";
      }
      
      setSourceCollection(usedCollection);
      setEntries(prev => reset ? result.entries : [...prev, ...result.entries]);
      setLastVisible(result.lastDoc);
      setHasMore(result.hasMore);

      // ✅ رفع خطای TypeScript: استفاده از متغیر محلی برای کلید شیء
      result.entries.forEach(async (tx) => {
        if (tx.partyId && !tx.partyName && !customerNames[tx.partyId]) {
          const pid = tx.partyId; // ✅ این خط خطای TypeScript را برطرف می‌کند
          const name = await fetchCustomerName(pid);
          setCustomerNames(prev => ({ ...prev, [pid]: name }));
        }
      });
    } catch (error) {
      console.error("Error fetching journal:", error);
    } finally {
      setLoading(false);
    }
  }, [fetchFromCollection]);

  useEffect(() => { fetchEntries(true); }, [dateRange, typeFilter, currencyFilter, searchQuery]);

  const [totals, setTotals] = useState<Record<string, number>>({});
  useEffect(() => {
    const fetchTotals = async () => {
      const totalsByCurrency: Record<string, number> = {};
      
      const q1 = query(collection(db, "transactions"), where("status", "==", "active"));
      const snap1 = await getDocs(q1);
      snap1.forEach(doc => {
        const tx = normalizeTransaction(doc.data() as RawTransaction);
        if (!totalsByCurrency[tx.currency]) totalsByCurrency[tx.currency] = 0;
        if (tx.type === "واریز" || tx.type === "انتقال") totalsByCurrency[tx.currency] += tx.amount;
        else if (tx.type === "برداشت" || tx.type === "هزینه") totalsByCurrency[tx.currency] -= tx.amount;
      });
      
      const q2 = query(collection(db, "journal_entries"), where("status", "==", "active"));
      const snap2 = await getDocs(q2);
      snap2.forEach(doc => {
        const tx = normalizeTransaction(doc.data() as RawTransaction);
        if (!totalsByCurrency[tx.currency]) totalsByCurrency[tx.currency] = 0;
        if (tx.type === "واریز" || tx.type === "انتقال") totalsByCurrency[tx.currency] += tx.amount;
        else if (tx.type === "برداشت" || tx.type === "هزینه") totalsByCurrency[tx.currency] -= tx.amount;
      });
      
      setTotals(totalsByCurrency);
    };
    
    fetchTotals();
    const unsub1 = onSnapshot(query(collection(db, "transactions"), where("status", "==", "active")), fetchTotals);
    const unsub2 = onSnapshot(query(collection(db, "journal_entries"), where("status", "==", "active")), fetchTotals);
    return () => { unsub1(); unsub2(); };
  }, []);

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

  const handleVoid = async (entry: RawTransaction) => {
    const reason = prompt("دلیل ابطال این تراکنش را وارد کنید:");
    if (!reason) return;
    setVoidingId(entry.id);
    try {
      await voidTransactionAtomic(entry.id, sourceCollection); 
      alert("تراکنش با موفقیت باطل و موجودی به‌صورت اتمیک اصلاح شد.");
      fetchEntries(true);
    } catch (err) {
      alert("خطا در ابطال تراکنش: " + (err as Error).message);
    } finally {
      setVoidingId(null);
    }
  };

  const handleExport = () => {
    const headers = ["شماره سند", "تاریخ/ساعت", "شرح معامله", "مشتری", "ارز", "مبلغ", "نوع", "تراز پس از معامله", "وضعیت"];
    const escapeCsv = (val: any) => `"${String(val ?? "").replace(/"/g, '""')}"`;
    const rows = entries.map(e => [
      escapeCsv(e.id.slice(0, 8)),
      escapeCsv(e.timestamp?.toDate ? e.timestamp.toDate().toLocaleString("fa-IR") : "-"),
      escapeCsv(e.description),
      escapeCsv(e.partyName || customerNames[e.partyId || ""] || e.partyId || "-"),
      escapeCsv(currencyLabels[e.currency] || e.currency),
      e.amount,
      escapeCsv(e.type),
      e.balanceAfter,
      escapeCsv(e.status === "voided" ? "باطل شده" : "فعال")
    ].join(","));

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Journal_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getTypeBadgeStyle = (type: TxType, isVoided: boolean) => {
    if (isVoided) return "bg-gray-200 text-gray-500 line-through";
    const styles: Record<TxType, string> = {
      "واریز": "bg-green-100 text-green-800", "برداشت": "bg-red-100 text-red-800",
      "انتقال": "bg-blue-100 text-blue-800", "تبدیل": "bg-yellow-100 text-yellow-800",
      "هزینه": "bg-purple-100 text-purple-800"
    };
    return styles[type] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6 p-4 md:p-8 bg-slate-50 min-h-screen font-sans" dir="rtl">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {currencies.map(cur => (
          <div key={cur} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
            <div>
              <div className="text-xs text-slate-500 font-medium">{currencyFlags[cur]} {currencyLabels[cur]}</div>
              <div className="text-lg font-bold text-slate-800 mt-1">{exchangeRates[cur]?.rate ? fmt(exchangeRates[cur].rate) : "—"}</div>
            </div>
            <div className="text-[10px] text-slate-400 bg-slate-50 px-2 py-1 rounded">نسبت به USD</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">روزنامه کل معاملات</h1>
          <p className="text-slate-500 text-sm mt-1">سابقه کامل و حسابرسی‌پذیر تمام رویدادهای مالی از همه تب‌ها</p>
        </div>
        <button onClick={handleExport} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition shadow-sm text-sm font-bold">
          <span>📊</span> خروجی CSV (سازگار با Excel)
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
        <select value={dateRange} onChange={e => setDateRange(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
          <option value="all">همه زمان‌ها</option><option value="today">امروز</option><option value="week">این هفته</option><option value="month">این ماه</option>
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
          <option value="all">همه انواع تراکنش</option><option value="واریز">واریز</option><option value="برداشت">برداشت</option>
          <option value="انتقال">حواله / انتقال</option><option value="تبدیل">تبدیل ارز</option><option value="هزینه">کمیسیون / هزینه</option>
        </select>
        <select value={currencyFilter} onChange={e => setCurrencyFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
          <option value="all">همه ارزها</option>
          {currencies.map(c => <option key={c} value={c}>{currencyLabels[c]}</option>)}
        </select>
        <div className="relative">
          <input type="text" placeholder="جستجو در شرح یا نام مشتری..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full border rounded-lg px-3 py-2 pr-9 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          <svg className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b">
              <tr>
                <th className="px-4 py-3">شماره سند</th><th className="px-4 py-3">تاریخ/ساعت</th><th className="px-4 py-3">شرح معامله</th>
                <th className="px-4 py-3">مشتری</th><th className="px-4 py-3 text-center">ارز</th><th className="px-4 py-3 text-center">مبلغ</th>
                <th className="px-4 py-3 text-center">نوع</th><th className="px-4 py-3 text-center">تراز حساب</th><th className="px-4 py-3 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && entries.length === 0 && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse"><td colSpan={9} className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-full"></div></td></tr>
              ))}
              {entries.map((entry) => {
                const isVoided = entry.status === "voided";
                const customerName = entry.partyName || customerNames[entry.partyId || ""] || entry.partyId || "-";
                return (
                  <tr key={entry.id} className={`hover:bg-slate-50 transition ${isVoided ? "bg-slate-100/50" : ""}`}>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs whitespace-nowrap">{entry.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">{entry.timestamp?.toDate ? entry.timestamp.toDate().toLocaleString("fa-IR") : "-"}</td>
                    <td className={`px-4 py-3 font-medium ${isVoided ? "text-slate-400 line-through" : "text-slate-800"}`}>{entry.description}</td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{customerName}</td>
                    <td className="px-4 py-3 text-center text-slate-600 whitespace-nowrap"><span className="ml-1">{currencyFlags[entry.currency]}</span>{currencyLabels[entry.currency]}</td>
                    <td className={`px-4 py-3 text-center font-bold tabular-nums ${isVoided ? "text-slate-400 line-through" : "text-slate-800"}`}>{fmt(entry.amount)}</td>
                    <td className="px-4 py-3 text-center"><span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${getTypeBadgeStyle(entry.type, isVoided)}`}>{entry.type}</span></td>
                    <td className="px-4 py-3 text-center text-slate-700 font-mono text-xs whitespace-nowrap">{fmt(entry.balanceAfter)}</td>
                    <td className="px-4 py-3 text-center">
                      {!isVoided && (
                        <button onClick={() => handleVoid(entry)} disabled={voidingId === entry.id} className="text-xs bg-rose-50 text-rose-600 hover:bg-rose-100 px-3 py-1.5 rounded-lg font-bold transition disabled:opacity-50">
                          {voidingId === entry.id ? "در حال ابطال..." : "ابطال"}
                        </button>
                      )}
                      {isVoided && <span className="text-[10px] text-slate-400 bg-slate-200 px-2 py-1 rounded">باطل‌شده</span>}
                    </td>
                  </tr>
                );
              })}
              {!loading && entries.length === 0 && <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">هیچ تراکنشی با این فیلترها یافت نشد.</td></tr>}
            </tbody>
          </table>
        </div>
        {hasMore && !loading && entries.length > 0 && (
          <div className="p-4 border-t text-center bg-slate-50">
            <button onClick={() => fetchEntries(false)} className="text-blue-600 hover:text-blue-800 font-bold text-sm bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm hover:shadow transition">بارگذاری ۵۰ تراکنش قبلی...</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center"><span className="w-2 h-2 bg-emerald-500 rounded-full ml-2"></span>جمع کل موجودی صندوق (Real-time)</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {currencies.map(cur => {
              const amount = totals[cur] || 0;
              if (amount === 0 && Object.keys(totals).length > 0) return null;
              return (
                <div key={cur} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="text-xs text-slate-500 mb-1 flex items-center"><span className="ml-1">{currencyFlags[cur]}</span> {currencyLabels[cur]}</div>
                  <div className="text-lg font-bold text-slate-800 tabular-nums">{fmt(amount)}</div>
                </div>
              );
            })}
            {Object.keys(totals).length === 0 && <p className="text-slate-400 col-span-5 text-sm text-center py-4">داده‌ای موجود نیست</p>}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center"><span className="w-2 h-2 bg-blue-500 rounded-full ml-2"></span>خلاصه دوره انتخاب‌شده</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-100"><span className="text-sm text-blue-700 font-medium">تعداد کل معاملات</span><span className="text-lg font-bold text-blue-900 tabular-nums">{summary.count}</span></div>
            <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg border border-emerald-100"><span className="text-sm text-emerald-700 font-medium">مجموع دریافت (معادل USD)</span><span className="text-lg font-bold text-emerald-900 tabular-nums">${fmt(summary.deposits)}</span></div>
            <div className="flex justify-between items-center p-3 bg-rose-50 rounded-lg border border-rose-100"><span className="text-sm text-rose-700 font-medium">مجموع برداشت (معادل USD)</span><span className="text-lg font-bold text-rose-900 tabular-nums">${fmt(summary.withdrawals)}</span></div>
            <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg border border-purple-100"><span className="text-sm text-purple-700 font-medium">مجموع حواله (معادل USD)</span><span className="text-lg font-bold text-purple-900 tabular-nums">${fmt(summary.transfers)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
