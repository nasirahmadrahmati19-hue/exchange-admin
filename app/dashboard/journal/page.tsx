"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSyncedState } from "../lib/useSyncedState";
import { TRANSACTIONS_KEY, HAWALAS_KEY, CASH_KEY, CUSTOMERS_KEY } from "../lib/defaultData";

type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";
const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const currencyLabels: Record<Currency, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };

type TxType = "واریز" | "برداشت" | "انتقال" | "تبدیل" | "هزینه" | "حواله";

interface UnifiedJournalEntry {
  id: string;
  date: string;
  type: TxType;
  description: string;
  partyName: string;
  partyId?: string;
  currency: Currency;
  amount: number;
  balanceAfter?: number;
  status: "active" | "voided";
  voidedReason?: string;
  source: "transaction" | "hawala" | "cash";
  sourceId: string;
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

export default function JournalPage() {
  // ✅ ۱. مدیریت تم روز و شب
  const [isDark, setIsDark] = useState(true); 
  
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [currencyFilter, setCurrencyFilter] = useUrlState("currency", "all");
  const [typeFilter, setTypeFilter] = useUrlState("type", "all");
  const [searchQuery, setSearchQuery] = useUrlState("search", "");

  const [transactions, setTransactions] = useSyncedState<any[]>(TRANSACTIONS_KEY, []);
  const [hawalas, setHawalas] = useSyncedState<any[]>(HAWALAS_KEY, []);
  const [cashEntries, setCashEntries] = useSyncedState<any[]>(CASH_KEY, []);
  const [customers] = useSyncedState<any[]>(CUSTOMERS_KEY, []);
  const [voidingId, setVoidingId] = useState<string | null>(null);

  // ✅ ۲. ادغام هوشمند تمام داده‌ها
  const unifiedEntries = useMemo<UnifiedJournalEntry[]>(() => {
    const entries: UnifiedJournalEntry[] = [];

    transactions.forEach((tx: any) => {
      if (tx.status === "voided" && !tx.voidedReason) return;
      let type: TxType = "تبدیل";
      if (tx.type === "exchange") type = tx.dealType === "buy" ? "واریز" : "برداشت";
      else if (tx.type === "transfer") type = "انتقال";

      const partyName = tx.type === "transfer" ? `${tx.senderName || "—"} به ${tx.receiverName || "—"}` : (tx.customerName || "مشتری");

      entries.push({
        id: tx.id,
        date: tx.date,
        type,
        description: tx.description || `${tx.type} ${tx.fromCurrency} به ${tx.toCurrency}`,
        partyName,
        partyId: tx.customerId || tx.senderId,
        currency: tx.fromCurrency,
        amount: tx.fromAmount,
        balanceAfter: tx.balanceAfter,
        status: tx.status,
        voidedReason: tx.voidedReason,
        source: "transaction",
        sourceId: tx.id
      });
    });

    hawalas.forEach((h: any) => {
      if (h.status === "cancelled") return;
      entries.push({
        id: h.id,
        date: h.date,
        type: "حواله",
        description: `حواله به ${h.receiverName} (${h.destinationText || ""})`,
        partyName: h.senderName,
        partyId: h.senderId,
        currency: h.currencyFrom,
        amount: h.amountFrom,
        status: h.status === "paid" ? "active" : "active",
        source: "hawala",
        sourceId: h.id
      });
      if (h.status === "paid") {
        entries.push({
          id: `${h.id}-paid`,
          date: h.paidAt || h.date,
          type: "واریز",
          description: `تسویه حواله از ${h.senderName}`,
          partyName: h.receiverName,
          partyId: h.receiverId,
          currency: h.currencyTo,
          amount: h.finalAmount,
          status: "active",
          source: "hawala",
          sourceId: h.id
        });
      }
    });

    cashEntries.forEach((ce: any) => {
      if (!ce || ce.status === "voided") return;
      if (ce.linkedExchangeId || ce.linkedTransferId || ce.linkedConvertId || ce.linkedHawalaId || ce.linkedHawalaSettleId) return;

      let type: TxType = "هزینه";
      if (ce.type === "customer_deposit" || ce.type === "owner_deposit") type = "واریز";
      else if (ce.type === "customer_withdraw" || ce.type === "owner_withdraw") type = "برداشت";
      else if (ce.type === "loan_given" || ce.type === "loan_received") type = "انتقال";
      else if (ce.type === "fee" || ce.type === "commission_withdraw") type = "هزینه";
      else if (ce.type === "adjustment") type = "برداشت";

      entries.push({
        id: ce.id,
        date: ce.date || new Date().toISOString(),
        type,
        description: ce.reason || ce.type || "عملیات صندوق",
        partyName: ce.customerName || "صندوق",
        partyId: ce.customerId,
        currency: ce.currency,
        amount: Number(ce.amount) || 0,
        balanceAfter: ce.balanceAfter,
        status: ce.status || "active",
        source: "cash",
        sourceId: ce.id
      });
    });

    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, hawalas, cashEntries]);

  // ✅ ۳. فیلتر کردن داده‌ها
  const filteredEntries = useMemo(() => {
    return unifiedEntries.filter((e: any) => {
      if (e.status === "voided" && !e.voidedReason) return false;
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (currencyFilter !== "all" && e.currency !== currencyFilter) return false;

      if (dateFrom) {
        const entryDate = new Date(e.date);
        const from = new Date(dateFrom);
        if (entryDate < from) return false;
      }

      if (dateTo) {
        const entryDate = new Date(e.date);
        const to = new Date(dateTo);
        if (entryDate > to) return false;
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return e.description.toLowerCase().includes(q) || e.partyName.toLowerCase().includes(q) || e.id.toLowerCase().includes(q);
      }

      return true;
    });
  }, [unifiedEntries, dateFrom, dateTo, typeFilter, currencyFilter, searchQuery]);

  // ✅ ۴. محاسبه آنی خلاصه کلی
  const summary = useMemo(() => {
    let deposits = 0, withdrawals = 0, transfers = 0, count = 0;
    filteredEntries.forEach((e: any) => {
      if (e.status === "voided") return;
      count++;
      if (e.type === "واریز") deposits += e.amount;
      else if (e.type === "برداشت" || e.type === "هزینه") withdrawals += e.amount;
      else if (e.type === "انتقال" || e.type === "حواله" || e.type === "تبدیل") transfers += e.amount;
    });
    return { count, deposits, withdrawals, transfers };
  }, [filteredEntries]);

  // ✅ ۵. محاسبه خلاصه ارزها (نمایش اجباری هر ۵ ارز)
  const currencyPeriodSummary = useMemo(() => {
    const summary: Record<string, { volume: number; net: number }> = {};
    
    // مقداردهی اولیه هر ۵ ارز با صفر
    currencies.forEach(curr => {
      summary[curr] = { volume: 0, net: 0 };
    });

    // جمع‌بندی بر اساس داده‌های فیلترشده
    filteredEntries.forEach((e: any) => {
      if (e.status === "voided") return;
      if (!summary[e.currency]) return;

      summary[e.currency].volume += e.amount;
      
      if (e.type === "واریز") {
        summary[e.currency].net += e.amount;
      } else if (e.type === "برداشت" || e.type === "هزینه") {
        summary[e.currency].net -= e.amount;
      }
    });
    
    return summary;
  }, [filteredEntries]);

  // ✅ ۶. منطق ابطال امن
  const handleVoid = async (entry: UnifiedJournalEntry) => {
    const reason = prompt("دلیل ابطال این تراکنش را وارد کنید:");
    if (!reason) return;
    setVoidingId(entry.id);
    try {
      if (entry.source === "transaction") {
        setTransactions((prev: any) =>
          prev.map((t: any) => (t.id === entry.sourceId ? { ...t, status: "voided", voidedReason: reason } : t))
        );
      } else if (entry.source === "cash") {
        setCashEntries((prev: any) =>
          prev.map((c: any) => (c.id === entry.sourceId ? { ...c, status: "voided", voidedReason: reason } : c))
        );
      } else if (entry.source === "hawala") {
        alert("برای ابطال حواله، لطفاً به تب حواله‌جات مراجعه کنید.");
        setVoidingId(null);
        return;
      }
      alert("تراکنش با موفقیت باطل و موجودی اصلاح شد.");
    } catch (err) {
      alert("خطا در ابطال تراکنش: " + (err as Error).message);
    } finally {
      setVoidingId(null);
    }
  };

  // ✅ ۷. خروجی CSV
  const handleExport = () => {
    const headers = ["شماره سند", "تاریخ", "ساعت", "شرح", "نوع", "ارز", "مبلغ", "تراز بعد"];
    const escapeCsv = (val: any) => `"${String(val ?? "").replace(/"/g, '""')}"`;
    const rows = filteredEntries.map((e: any) => {
      const d = new Date(e.date);
      const datePart = d.toLocaleDateString("fa-IR");
      const timePart = d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
      return [
        escapeCsv(e.id.slice(0, 8)),
        escapeCsv(datePart),
        escapeCsv(timePart),
        escapeCsv(e.description),
        escapeCsv(e.type),
        escapeCsv(currencyLabels[e.currency as Currency]),
        e.amount,
        e.balanceAfter ?? "",
      ].join(",");
    });

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

  // ✅ ۸. توابع کمکی استایل
  const getBadgeColor = (type: TxType, isVoided: boolean) => {
    if (isVoided) return "bg-slate-700/50 text-slate-400 line-through";
    const styles: Record<TxType, string> = {
      "واریز": "bg-emerald-400/30 text-emerald-300",
      "برداشت": "bg-rose-400/30 text-rose-300",
      "انتقال": "bg-blue-400/30 text-blue-300",
      "تبدیل": "bg-amber-400/30 text-amber-300",
      "هزینه": "bg-purple-400/30 text-purple-300",
      "حواله": "bg-sky-400/30 text-sky-300"
    };
    return styles[type] || "bg-slate-600 text-slate-200";
  };

  return (
    <div className={`space-y-6 p-4 md:p-8 min-h-screen font-sans transition-colors duration-300 ${isDark ? "bg-slate-900 text-slate-200" : "bg-gray-50 text-gray-800"}`} dir="rtl">
      
      {/* ۱. هدر صفحه + دکمه تغییر تم */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">روزنامه کل معاملات</h1>
          <p className={`text-sm mt-1 ${isDark ? "text-slate-400" : "text-gray-500"}`}>نمای یکپارچه و حسابرسی‌پذیر از تمام تب‌های سیستم</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsDark(!isDark)} 
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition shadow-sm text-sm font-bold ${isDark ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"}`}
          >
            {isDark ? "☀️ حالت روز" : "🌙 حالت شب"}
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 bg-emerald-500 px-4 py-2 rounded-lg hover:bg-emerald-600 transition shadow-sm text-sm font-bold text-white">
            <span>📊</span> خروجی CSV
          </button>
        </div>
      </div>

      {/* ۲. فیلترها */}
      <div className={`p-4 rounded-xl border shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 ${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200"}`}>
        <div className="relative">
          <label className={`text-xs mb-1 block ${isDark ? "text-slate-400" : "text-gray-500"}`}>از تاریخ</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={`w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400 ${isDark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-gray-300 text-gray-800"}`}
          />
        </div>
        <div className="relative">
          <label className={`text-xs mb-1 block ${isDark ? "text-slate-400" : "text-gray-500"}`}>تا تاریخ</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={`w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400 ${isDark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-gray-300 text-gray-800"}`}
          />
        </div>
        <div>
          <label className={`text-xs mb-1 block ${isDark ? "text-slate-400" : "text-gray-500"}`}>نوع ارز</label>
          <select
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
            className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-gray-300 text-gray-800"}`}
          >
            <option value="all">همه ارزها</option>
            {currencies.map((cur) => (
              <option key={cur} value={cur}>{currencyLabels[cur]}</option>
            ))}
          </select>
        </div>

        <div className="relative">
          <label className={`text-xs mb-1 block ${isDark ? "text-slate-400" : "text-gray-500"}`}>جستجو</label>
          <input
            type="text"
            placeholder="نام، کد، یا شرح..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full border rounded-lg px-3 py-2 pr-9 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-gray-300 text-gray-800"}`}
          />
          <svg className={`absolute right-3 top-8 w-4 h-4 ${isDark ? "text-slate-400" : "text-gray-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* ۳. خلاصه دوره */}
      <div className={`rounded-xl border p-5 shadow-sm ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-white border-gray-200"}`}>
        <h3 className="text-base font-bold mb-4 flex items-center">
          <span className="w-2 h-2 bg-emerald-400 rounded-full ml-2"></span> خلاصه دوره انتخاب‌شده
        </h3>
        
        {/* کارت‌های خلاصه کلی */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className={`rounded-lg p-3 border text-center ${isDark ? "border-slate-700" : "border-gray-200"}`}>
            <div className={`text-xs mb-1 ${isDark ? "text-slate-400" : "text-gray-500"}`}>تعداد کل</div>
            <div className={`text-xl font-bold tabular-nums ${isDark ? "text-slate-200" : "text-gray-800"}`}>{summary.count}</div>
          </div>
          <div className={`rounded-lg p-3 border text-center ${isDark ? "border-emerald-400/30 bg-emerald-400/5" : "border-emerald-200 bg-emerald-50"}`}>
            <div className={`text-xs mb-1 ${isDark ? "text-emerald-400" : "text-emerald-700"}`}>واریز</div>
            <div className={`text-xl font-bold tabular-nums ${isDark ? "text-emerald-300" : "text-emerald-600"}`}>{fmt(summary.deposits)}</div>
          </div>
          <div className={`rounded-lg p-3 border text-center ${isDark ? "border-rose-400/30 bg-rose-400/5" : "border-rose-200 bg-rose-50"}`}>
            <div className={`text-xs mb-1 ${isDark ? "text-rose-400" : "text-rose-700"}`}>برداشت/هزینه</div>
            <div className={`text-xl font-bold tabular-nums ${isDark ? "text-rose-300" : "text-rose-600"}`}>{fmt(summary.withdrawals)}</div>
          </div>
          <div className={`rounded-lg p-3 border text-center ${isDark ? "border-blue-400/30 bg-blue-400/5" : "border-blue-200 bg-blue-50"}`}>
            <div className={`text-xs mb-1 ${isDark ? "text-blue-400" : "text-blue-700"}`}>انتقال/حواله/تبدیل</div>
            <div className={`text-xl font-bold tabular-nums ${isDark ? "text-blue-300" : "text-blue-600"}`}>{fmt(summary.transfers)}</div>
          </div>
        </div>

        {/* 🆕 کارت‌های جدید: نمایش اجباری هر ۵ ارز */}
        <h4 className={`text-sm font-bold mb-3 flex items-center border-t pt-4 ${isDark ? "text-slate-300 border-slate-700/50" : "text-gray-700 border-gray-200"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ml-2 ${isDark ? "bg-blue-400" : "bg-blue-600"}`}></span> گردش و تغییر خالص ارزها در این دوره
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {currencies.map((curr) => {
            const data = currencyPeriodSummary[curr];
            return (
              <div key={curr} className={`rounded-lg p-3 border text-center transition hover:scale-[1.02] ${isDark ? "border-slate-700 bg-slate-900/50" : "border-gray-200 bg-gray-50"}`}>
                <div className={`text-xs font-bold mb-2 ${isDark ? "text-slate-300" : "text-gray-600"}`}>
                  {currencyLabels[curr]}
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs px-1">
                    <span className={isDark ? "text-slate-400" : "text-gray-500"}>حجم کل:</span>
                    <span className={`font-bold tabular-nums ${isDark ? "text-slate-200" : "text-gray-800"}`}>{fmt(data.volume)}</span>
                  </div>
                  <div className={`flex justify-between text-xs px-1 border-t pt-1.5 ${isDark ? "border-slate-700/30" : "border-gray-200"}`}>
                    <span className={isDark ? "text-slate-400" : "text-gray-500"}>تغییر خالص:</span>
                    <span className={`font-bold tabular-nums ${data.net >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                      {data.net >= 0 ? "+" : ""}{fmt(data.net)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ۴. جدول تراکنش‌ها */}
      <div className={`rounded-xl border shadow-sm overflow-hidden ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-white border-gray-200"}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className={`font-bold border-b ${isDark ? "bg-slate-800/80 text-slate-300 border-slate-700" : "bg-gray-100 text-gray-700 border-gray-200"}`}>
              <tr>
                <th className="px-4 py-3 text-center">شماره سند</th>
                <th className="px-4 py-3 text-center">تاریخ</th>
                <th className="px-4 py-3 text-center">ساعت</th>
                <th className="px-4 py-3 text-center">شرح</th>
                <th className="px-4 py-3 text-center">نوع</th>
                <th className="px-4 py-3 text-center">ارز</th>
                <th className="px-4 py-3 text-center">مبلغ</th>
                <th className="px-4 py-3 text-center">تراز بعد</th>
                <th className="px-4 py-3 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? "divide-slate-700" : "divide-gray-100"}`}>
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={9} className={`px-4 py-12 text-center ${isDark ? "text-slate-500" : "text-gray-500"}`}>هیچ تراکنشی با این فیلترها یافت نشد.</td>
                </tr>
              ) : (
                filteredEntries.map((entry: any) => {
                  const isVoided = entry.status === "voided";
                  const d = new Date(entry.date);
                  const datePart = d.toLocaleDateString("fa-IR");
                  const timePart = d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });

                  return (
                    <tr key={entry.id} className={`transition ${isDark ? "hover:bg-slate-700/30" : "hover:bg-gray-50"}`}>
                      <td className={`px-4 py-3 text-center tabular-nums ${isDark ? "text-slate-300" : "text-gray-700"}`}>{entry.id.slice(0, 8)}</td>
                      <td className={`px-4 py-3 text-center ${isDark ? "text-slate-300" : "text-gray-700"}`}>{datePart}</td>
                      <td className={`px-4 py-3 text-center ${isDark ? "text-slate-300" : "text-gray-700"}`}>{timePart}</td>
                      <td className={`px-4 py-3 font-medium ${isVoided ? (isDark ? "text-slate-500 line-through" : "text-gray-400 line-through") : (isDark ? "text-slate-200" : "text-gray-800")}`}>{entry.description}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${getBadgeColor(entry.type, isVoided)}`}>
                          {entry.type}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-center ${isDark ? "text-slate-300" : "text-gray-700"}`}>{currencyLabels[entry.currency as Currency]}</td>
                      <td className={`px-4 py-3 text-center font-bold tabular-nums ${isVoided ? (isDark ? "text-slate-500 line-through" : "text-gray-400 line-through") : (entry.type === "واریز" ? "text-emerald-500" : "text-rose-500")}`}>
                        {entry.type === "واریز" ? "+" : "-"} {fmt(entry.amount)}
                      </td>
                      <td className={`px-4 py-3 text-center tabular-nums ${isDark ? "text-slate-300" : "text-gray-700"}`}>{entry.balanceAfter ?? "—"}</td>
                      <td className="px-4 py-3 text-center">
                        {!isVoided && (
                          <button
                            onClick={() => handleVoid(entry)}
                            disabled={voidingId === entry.id}
                            className={`text-xs px-3 py-1.5 rounded-lg font-bold transition disabled:opacity-50 ${isDark ? "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20" : "bg-rose-50 text-rose-600 hover:bg-rose-100"}`}
                          >
                            {voidingId === entry.id ? "در حال ابطال..." : "ابطال"}
                          </button>
                        )}
                        {isVoided && <span className={`text-[10px] px-2 py-1 rounded ${isDark ? "text-slate-400 bg-slate-700/50" : "text-gray-500 bg-gray-200"}`}>باطل‌شده</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ۵. راهنما */}
      <div className={`rounded-xl border p-5 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-white border-gray-200"}`}>
        <h3 className="text-base font-bold mb-4 flex items-center">
          <span className={`w-2 h-2 rounded-full ml-2 ${isDark ? "bg-blue-400" : "bg-blue-600"}`}></span> راهنمای سیستم
        </h3>
        <ul className={`text-sm space-y-2 list-disc pr-4 ${isDark ? "text-slate-400" : "text-gray-600"}`}>
          <li>این روزنامه به صورت <b className={isDark ? "text-slate-300" : "text-gray-800"}>آفلاین و آنلاین</b> کار می‌کند.</li>
          <li>در صورت ابطال، داده‌ها بازنویسی می‌شوند و در صورت اتصال دوباره به اینترنت، همگام می‌شوند.</li>
          <li>برای ابطال حواله، به تب <b className={isDark ? "text-slate-300" : "text-gray-800"}>حواله‌جات</b> مراجعه کنید.</li>
          <li>خروجی CSV شامل تمام تراکنش‌های فیلترشده است.</li>
        </ul>
      </div>
    </div>
  );
}
