"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSyncedState } from "../lib/useSyncedState";
import { TRANSACTIONS_KEY, HAWALAS_KEY, CASH_KEY, CUSTOMERS_KEY } from "../lib/defaultData";

type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";
const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const currencyLabels: Record<Currency, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };
const currencyFlags: Record<Currency, string> = { AFN: "🇦🇫", USD: "🇺🇸", EUR: "🇪🇺", IRR: "🇮🇷", PKR: "🇵🇰" };

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
  const dk = true; // ✅ تم تیره فعال است
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setToDate] = useState<string>("");
  const [currencyFilter, setCurrencyFilter] = useUrlState("currency", "all");
  const [typeFilter, setTypeFilter] = useUrlState("type", "all");
  const [searchQuery, setSearchQuery] = useUrlState("search", "");

  // ✅ استفاده از useSyncedState برای ارتباط با سایر تب‌ها
  const [transactions, setTransactions] = useSyncedState<any[]>(TRANSACTIONS_KEY, []);
  const [hawalas, setHawalas] = useSyncedState<any[]>(HAWALAS_KEY, []);
  const [cashEntries, setCashEntries] = useSyncedState<any[]>(CASH_KEY, []);
  const [customers] = useSyncedState<any[]>(CUSTOMERS_KEY, []);
  const [voidingId, setVoidingId] = useState<string | null>(null);

  // ✅ ادغام تمام داده‌ها در یک لیست واحد
  const unifiedEntries = useMemo<UnifiedJournalEntry[]>(() => {
    const entries: UnifiedJournalEntry[] = [];

    // ۱. معاملات
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

    // ۲. حواله‌ها
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

    // ۳. اسناد صندوق
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

  // ✅ فیلتر کردن داده‌ها بر اساس تاریخ، نوع، ارز و جستجو
  const filteredEntries = useMemo(() => {
    return unifiedEntries.filter((e: any) => {
      if (e.status === "voided" && !e.voidedReason) return false;
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (currencyFilter !== "all" && e.currency !== currencyFilter) return false;

      // ✅ فیلتر بر اساس تاریخ
      if (dateFrom) {
        const entryDate = new Date(e.date);
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        if (entryDate < from) return false;
      }

      if (dateTo) {
        const entryDate = new Date(e.date);
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (entryDate > to) return false;
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return e.description.toLowerCase().includes(q) || e.partyName.toLowerCase().includes(q) || e.id.toLowerCase().includes(q);
      }

      return true;
    });
  }, [unifiedEntries, dateFrom, dateTo, typeFilter, currencyFilter, searchQuery]);

  // ✅ محاسبه‌ی خلاصه
  const summary = useMemo(() => {
    let deposits = 0, withdrawals = 0, transfers = 0, count = 0;
    filteredEntries.forEach((e: any) => {
      if (e.status === "voided") return;
      count++;
      if (e.type === "واریز") deposits += e.amount;
      else if (e.type === "برداشت" || e.type === "هزینه") withdrawals += e.amount;
      else if (e.type === "انتقال" || e.type === "حواله") transfers += e.amount;
    });
    return { count, deposits, withdrawals, transfers };
  }, [filteredEntries]);

  // ✅ منطق ابطال امن
  const handleVoid = async (entry: UnifiedJournalEntry) => {
    const reason = prompt("دلیل ابطال این تراکنش را وارد کنید:");
    if (!reason) return;
    setVoidingId(entry.id);
    try {
      if (entry.source === "transaction") {
        setTransactions((prev: any[]) =>
          prev.map((t: any) => t.id === entry.sourceId ? { ...t, status: "voided", voidedReason: reason } : t)
        );
      } else if (entry.source === "cash") {
        setCashEntries((prev: any[]) =>
          prev.map((c: any) => c.id === entry.sourceId ? { ...c, status: "voided", voidedReason: reason } : c)
        );
      } else if (entry.source === "hawala") {
        alert("لطفاً به تب حواله بروید و از آنجا این تراکنش را باطل کنید.");
        setVoidingId(null);
        return;
      }
      alert("تراکنش با موفقیت باطل شد و موجودی به‌روز شد.");
    } catch (err) {
      alert("خطا در ابطال تراکنش: " + (err as Error).message);
    } finally {
      setVoidingId(null);
    }
  };

  // ✅ خروجی CSV
  const handleExport = () => {
    const headers = ["شماره سند", "تاریخ", "ساعت", "شرح", "نوع", "ارز", "مبلغ", "تراز بعد", "وضعیت"];
    const escapeCsv = (val: any) => `"${String(val ?? "").replace(/"/g, '""')}"`;
    const rows = filteredEntries.map((e: any) => {
      const dt = new Date(e.date);
      const datePart = dt.toLocaleDateString("fa-IR");
      const timePart = dt.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
      return [
        escapeCsv(e.id.slice(0, 8)),
        escapeCsv(datePart),
        escapeCsv(timePart),
        escapeCsv(e.description),
        escapeCsv(e.type),
        escapeCsv(currencyLabels[e.currency as Currency]),
        escapeCsv(e.amount),
        escapeCsv(e.balanceAfter),
        escapeCsv(e.status === "voided" ? `باطل شده (${e.voidedReason})` : "فعال"),
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(",")].concat(rows).join("\n");
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

  // ✅ رنگ‌بندی نوع تراکنش
  const getTypeBadgeStyle = (type: TxType, isVoided: boolean) => {
    if (isVoided) return "bg-slate-700/50 text-slate-400 line-through";
    const styles: Record<TxType, string> = {
      "واریز": "bg-emerald-400/20 text-emerald-300",
      "برداشت": "bg-rose-400/20 text-rose-300",
      "انتقال": "bg-blue-400/20 text-blue-300",
      "تبدیل": "bg-amber-400/20 text-amber-300",
      "هزینه": "bg-purple-400/20 text-purple-300",
      "حواله": "bg-sky-400/20 text-sky-300"
    };
    return styles[type] || "bg-slate-400/20 text-slate-300";
  };

  // ✅ تابع تقسیم تاریخ و زمان
  const splitDateTime = (iso: string) => {
    const d = new Date(iso);
    const datePart = d.toLocaleDateString("fa-IR");
    const timePart = d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
    return { datePart, timePart };
  };

  return (
    <div className="space-y-6 p-4 md:p-8 bg-slate-800 min-h-screen font-sans text-slate-200" dir="rtl">
      {/* ۱. هدر صفحه */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100">روزنامه کل معاملات</h1>
          <p className="text-slate-400 text-sm mt-1">نمای یکپارچه و حسابرسی‌پذیر از تمام تب‌های سیستم</p>
        </div>
        <button onClick={handleExport} className="flex items-center gap-2 bg-emerald-500 px-4 py-2 rounded-lg hover:bg-emerald-600 transition shadow-sm text-sm font-bold text-slate-900">
          <span>📊</span> خروجی CSV
        </button>
      </div>

      {/* ۲. فیلترها */}
      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="relative">
          <label className="text-xs text-slate-400 mb-1 block">از تاریخ</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full border bg-slate-900 border-slate-700 text-slate-200 rounded-lg px-3 py-2 outline-none [color-scheme:dark]"
          />
        </div>
        <div className="relative">
          <label className="text-xs text-slate-400 mb-1 block">تا تاریخ</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full border bg-slate-900 border-slate-700 text-slate-200 rounded-lg px-3 py-2 outline-none [color-scheme:dark]"
          />
        </div>
        <select
          value={currencyFilter}
          onChange={(e) => setCurrencyFilter(e.target.value)}
          className="border bg-slate-900 border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
        >
          <option value="all">همه ارزها</option>
          {currencies.map((cur) => (
            <option key={cur} value={cur}>
              {currencyLabels[cur]}
            </option>
          ))}
        </select>
        <div className="relative">
          <label className="text-xs text-slate-400 mb-1 block">جستجو</label>
          <input
            type="text"
            placeholder="نام، کد یا شرح..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border bg-slate-900 border-slate-700 text-slate-200 rounded-lg px-3 py-2 pr-9 text-sm outline-none"
          />
          <svg className="absolute right-3 top-8 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* ۳. خلاصه دوره */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5 shadow-sm">
        <h3 className="text-base font-bold text-slate-100 mb-4 flex items-center">
          <span className="w-2 h-2 bg-emerald-400 rounded-full ml-2"></span> خلاصه دوره انتخاب‌شده
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-700 text-center">
            <div className="text-xs text-slate-400 mb-1">تعداد کل</div>
            <div className="text-xl font-bold tabular-nums text-slate-200">{summary.count}</div>
          </div>
          <div className="bg-emerald-400/10 rounded-lg p-3 border border-emerald-400/20 text-center">
            <div className="text-xs text-emerald-400 mb-1">واریز</div>
            <div className="text-xl font-bold tabular-nums text-emerald-300">{fmt(summary.deposits)}</div>
          </div>
          <div className="bg-rose-400/10 rounded-lg p-3 border border-rose-400/20 text-center">
            <div className="text-xs text-rose-400 mb-1">برداشت/هزینه</div>
            <div className="text-xl font-bold tabular-nums text-rose-300">{fmt(summary.withdrawals)}</div>
          </div>
          <div className="bg-blue-400/10 rounded-lg p-3 border border-blue-400/20 text-center">
            <div className="text-xs text-blue-400 mb-1">انتقال/حواله</div>
            <div className="text-xl font-bold tabular-nums text-blue-300">{fmt(summary.transfers)}</div>
          </div>
        </div>
      </div>

      {/* ۴. جدول تراکنش‌ها */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-800/50 text-slate-300 font-bold border-b border-slate-700">
              <tr>
                <th className="px-4 py-3 text-center">شماره سند</th>
                <th className="px-4 py-3 text-center">تاریخ</th>
                <th className="px-4 py-3 text-center">ساعت</th>
                <th className="px-4 py-3">شرح</th>
                <th className="px-4 py-3 text-center">نوع</th>
                <th className="px-4 py-3 text-center">ارز</th>
                <th className="px-4 py-3 text-center">مبلغ</th>
                <th className="px-4 py-3 text-center">تراز بعد</th>
                <th className="px-4 py-3 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500">هیچ تراکنشی با این فیلترها یافت نشد.</td>
                </tr>
              ) : (
                filteredEntries.map((entry: any) => {
                  const isVoided = entry.status === "voided";
                  const badgeStyle = getTypeBadgeStyle(entry.type, isVoided);
                  const dt = splitDateTime(entry.date);

                  return (
                    <tr key={entry.id} className="hover:bg-slate-700/30 transition">
                      <td className="px-4 py-3 text-center text-slate-300 tabular-nums">{entry.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-center text-slate-300">{dt.datePart}</td>
                      <td className="px-4 py-3 text-center text-slate-300">{dt.timePart}</td>
                      <td className={`px-4 py-3 font-medium ${isVoided ? "text-slate-400 line-through" : "text-slate-200"}`}>
                        {entry.description}
                        {isVoided && entry.voidedReason && (
                          <div className="text-[10px] text-rose-500 mt-1">دلیل: {entry.voidedReason}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${badgeStyle}`}>
                          {entry.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-300 whitespace-nowrap">
                        {currencyFlags[entry.currency as Currency]} {currencyLabels[entry.currency as Currency]}
                      </td>
                      <td className={`px-4 py-3 text-center font-bold tabular-nums ${isVoided ? "text-slate-400 line-through" : entry.type === "واریز" ? "text-emerald-400" : "text-rose-400"}`}>
                        {entry.type === "واریز" ? "+" : "-"} {fmt(entry.amount)}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-300 tabular-nums">{entry.balanceAfter}</td>
                      <td className="px-4 py-3 text-center">
                        {!isVoided && entry.source !== "hawala" && (
                          <button
                            onClick={() => handleVoid(entry)}
                            disabled={voidingId === entry.id}
                            className={`text-xs ${isVoided ? "bg-slate-700 text-slate-400" : "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"} px-3 py-1.5 rounded-lg font-bold transition disabled:opacity-50`}
                          >
                            {voidingId === entry.id ? "در حال ابطال..." : "ابطال"}
                          </button>
                        )}
                        {isVoided && (
                          <span className="text-[10px] text-slate-400 bg-slate-700 px-2 py-1 rounded">باطل‌شده</span>
                        )}
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
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
        <h3 className="text-base font-bold text-slate-100 mb-4 flex items-center">
          <span className="w-2 h-2 bg-blue-400 rounded-full ml-2"></span> راهنمای سیستم
        </h3>
        <ul className="text-sm text-slate-400 space-y-2 list-disc pr-4">
          <li>این روزنامه به صورت <b className="text-slate-300">آفلاین و آنلاین</b> کار می‌کند — بدون اینترنت هم می‌توانید داده ثبت کنید و ببینید.</li>
          <li>داده‌های ثبت‌شده در حافظه محلی ذخیره می‌شوند و با اینترنت دوباره با سرور همگام می‌شوند.</li>
          <li>برای ابطال حواله، به تب <b className="text-slate-300">حواله‌جات</b> مراجعه کنید.</li>
          <li>خروجی CSV شامل تمام تراکنش‌های فیلترشده است.</li>
        </ul>
      </div>
    </div>
  );
}
