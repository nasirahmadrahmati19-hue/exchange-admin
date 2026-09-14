"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, query, where, orderBy, limit, startAfter, getDocs, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase"; // مسیر را تنظیم کنید
import { JournalEntry, voidJournalEntry } from "../lib/journalService";
import * as XLSX from "xlsx";

// --- Types & Constants ---
type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";
const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const labels: Record<Currency, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };
const typeLabels: Record<string, string> = {
  deposit: "واریز", withdrawal: "برداشت", hawala_in: "حواله ورودی", hawala_out: "حواله خروجی",
  buy_currency: "خرید ارز", sell_currency: "فروش ارز", commission: "کمیسیون", reversal: "تراکنش معکوس (ابطال)"
};

const fmt = (n: number) => Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0";

// --- Helper: URL State Management (Requirement 4) ---
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
  const router = useRouter();
  const searchParams = useSearchParams();

  // State for Filters (Synced with URL)
  const [dateRange, setDateRange] = useUrlState("date", "all"); // all, today, week, month
  const [typeFilter, setTypeFilter] = useUrlState("type", "all");
  const [currencyFilter, setCurrencyFilter] = useUrlState("currency", "all");
  const [searchParty, setSearchParty] = useUrlState("search", "");

  // State for Data & Pagination (Requirement 5)
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [voidingId, setVoidingId] = useState<string | null>(null);

  // --- ۵. صفحه‌بندی و دریافت داده از Firestore ---
  const fetchEntries = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      let q = query(collection(db, "journal_entries"), orderBy("timestamp", "desc"), limit(30));
      
      // اعمال فیلترها (توجه: فیلترهای ترکیبی در Firestore نیاز به Composite Index دارد)
      if (typeFilter !== "all") q = query(q, where("type", "==", typeFilter));
      if (currencyFilter !== "all") q = query(q, where("currency", "==", currencyFilter));
      // برای جستجوی نام، در مقیاس بزرگ بهتر است از Algolia یا Typesense استفاده شود، اما برای سادگی اینجا کلاینت‌ساید یا فیلتر دقیق انجام می‌شود.
      
      if (!reset && lastVisible) {
        q = query(q, startAfter(lastVisible));
      }

      const snapshot = await getDocs(q);
      const newEntries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalEntry));
      
      // فیلتر جستجوی نام در کلاینت (برای سادگی و عدم نیاز به ایندکس پیچیده)
      let filtered = newEntries;
      if (searchParty) {
        const lowerSearch = searchParty.toLowerCase();
        filtered = newEntries.filter(e => e.partyName.toLowerCase().includes(lowerSearch) || e.note?.toLowerCase().includes(lowerSearch));
      }

      // فیلتر تاریخ در کلاینت (برای انعطاف‌پذیری بیشتر نسبت به فیلترهای سخت Firestore)
      if (dateRange !== "all") {
        const now = new Date();
        filtered = filtered.filter(e => {
          const d = e.timestamp?.toDate ? e.timestamp.toDate() : new Date(e.timestamp);
          if (dateRange === "today") return d.toDateString() === now.toDateString();
          if (dateRange === "week") return (now.getTime() - d.getTime()) < 7 * 24 * 60 * 60 * 1000;
          if (dateRange === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          return true;
        });
      }

      setEntries(prev => reset ? filtered : [...prev, ...filtered]);
      setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === 30);
    } catch (error) {
      console.error("Error fetching journal:", error);
    } finally {
      setLoading(false);
    }
  }, [dateRange, typeFilter, currencyFilter, searchParty, lastVisible]);

  useEffect(() => { fetchEntries(true); }, [dateRange, typeFilter, currencyFilter, searchParty]);

  // --- ۶. خلاصه‌ی بالای صفحه (Summary Card) ---
  const summary = useMemo(() => {
    const totals: Record<string, { in: number; out: number; count: number }> = {};
    currencies.forEach(c => totals[c] = { in: 0, out: 0, count: 0 });

    entries.forEach(e => {
      if (e.status === "voided") return;
      if (!totals[e.currency]) totals[e.currency] = { in: 0, out: 0, count: 0 };
      
      const isIn = e.type === "deposit" || e.type === "hawala_in" || e.type === "buy_currency";
      if (isIn) totals[e.currency].in += e.amount;
      else totals[e.currency].out += e.amount;
      
      totals[e.currency].count += 1;
    });
    return totals;
  }, [entries]);

  // --- ۲. اصل عدم حذف واقعی (Void Action) ---
  const handleVoid = async (entry: JournalEntry) => {
    const reason = prompt("دلیل ابطال این تراکنش را وارد کنید:");
    if (!reason) return;
    
    setVoidingId(entry.id);
    try {
      await voidJournalEntry(entry.id, reason, "AdminUser"); // نام کاربر فعلی را جایگزین کنید
      alert("تراکنش با موفقیت باطل و رکورد معکوس ثبت شد.");
      fetchEntries(true); // رفرش لیست
    } catch (err) {
      alert("خطا در ابطال تراکنش: " + (err as Error).message);
    } finally {
      setVoidingId(null);
    }
  };

  // --- ۷. خروجی Excel ---
  const handleExport = () => {
    const dataToExport = entries.map(e => ({
      "تاریخ": e.timestamp?.toDate ? e.timestamp.toDate().toLocaleDateString("fa-IR") : "-",
      "نوع": typeLabels[e.type] || e.type,
      "طرف حساب": e.partyName,
      "ارز": labels[e.currency as Currency] || e.currency,
      "مبلغ": e.amount,
      "موجودی قبل": e.balanceBefore,
      "موجودی بعد": e.balanceAfter,
      "وضعیت": e.status === "voided" ? "باطل شده" : "فعال",
      "توضیحات": e.note || "-"
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Journal");
    XLSX.writeFile(wb, `Journal_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div className="space-y-6 p-4 md:p-8 bg-slate-50 min-h-screen" dir="rtl">
      {/* Header & Export */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">روزنامه کل معاملات</h1>
          <p className="text-slate-500 text-sm mt-1">سابقه کامل و حسابرسی‌پذیر تمام رویدادهای مالی</p>
        </div>
        <button onClick={handleExport} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition shadow-sm">
          <span>📊</span> خروجی Excel
        </button>
      </div>

      {/* ۶. Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {currencies.map(cur => {
          const s = summary[cur];
          if (s.count === 0) return null;
          return (
            <div key={cur} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-slate-700">{labels[cur]}</span>
                <span className="text-xs bg-slate-100 px-2 py-1 rounded-full text-slate-600">{s.count} تراکنش</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>ورودی:</span> <span>{fmt(s.in)}</span>
                </div>
                <div className="flex justify-between text-rose-600 font-bold">
                  <span>خروجی:</span> <span>{fmt(s.out)}</span>
                </div>
                <div className="flex justify-between text-slate-800 font-extrabold border-t pt-1 mt-1">
                  <span>خالص:</span> <span>{fmt(s.in - s.out)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ۴. فیلتر، جستجو و مرتب‌سازی */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
        <select value={dateRange} onChange={e => setDateRange(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="all">همه زمان‌ها</option>
          <option value="today">امروز</option>
          <option value="week">این هفته</option>
          <option value="month">این ماه</option>
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="all">همه انواع تراکنش</option>
          {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={currencyFilter} onChange={e => setCurrencyFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="all">همه ارزها</option>
          {currencies.map(c => <option key={c} value={c}>{labels[c]}</option>)}
        </select>
        <input 
          type="text" 
          placeholder="جستجوی نام مشتری یا توضیحات..." 
          value={searchParty} 
          onChange={e => setSearchParty(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b">
              <tr>
                <th className="px-4 py-3">تاریخ</th>
                <th className="px-4 py-3">نوع</th>
                <th className="px-4 py-3">طرف حساب</th>
                <th className="px-4 py-3 text-center">ارز</th>
                <th className="px-4 py-3 text-center">مبلغ</th>
                <th className="px-4 py-3 text-center">موجودی بعد</th>
                <th className="px-4 py-3">توضیحات</th>
                <th className="px-4 py-3 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* ۸. Loading Skeleton */}
              {loading && entries.length === 0 && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={8} className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-full"></div></td>
                </tr>
              ))}

              {entries.map((entry) => {
                const isVoided = entry.status === "voided";
                const isPositive = entry.type === "deposit" || entry.type === "hawala_in" || entry.type === "buy_currency" || entry.type === "reversal";
                
                return (
                  <tr key={entry.id} className={`hover:bg-slate-50 transition ${isVoided ? "bg-slate-100/50" : ""}`}>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {entry.timestamp?.toDate ? entry.timestamp.toDate().toLocaleString("fa-IR") : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${
                        isVoided ? "bg-slate-200 text-slate-500" : 
                        isPositive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      }`}>
                        {isVoided ? "باطل" : (isPositive ? "+" : "-")} {typeLabels[entry.type]}
                      </span>
                    </td>
                    <td className={`px-4 py-3 font-medium ${isVoided ? "text-slate-400 line-through" : "text-slate-800"}`}>
                      {entry.partyName}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">{labels[entry.currency as Currency] || entry.currency}</td>
                    <td className={`px-4 py-3 text-center font-bold tabular-nums ${isVoided ? "text-slate-400 line-through" : (isPositive ? "text-emerald-600" : "text-rose-600")}`}>
                      {isPositive ? "+" : "-"} {fmt(entry.amount)}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600 tabular-nums">{fmt(entry.balanceAfter)}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate" title={entry.note}>
                      {entry.note || "-"}
                      {isVoided && <div className="text-xs text-rose-500 mt-1">دلیل ابطال: {entry.voidedReason}</div>}
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
                    </td>
                  </tr>
                );
              })}
              
              {!loading && entries.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">هیچ تراکنشی با این فیلترها یافت نشد.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Control */}
        {hasMore && !loading && (
          <div className="p-4 border-t text-center">
            <button onClick={() => fetchEntries(false)} className="text-blue-600 hover:text-blue-800 font-bold text-sm">
              بارگذاری موارد بیشتر...
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
