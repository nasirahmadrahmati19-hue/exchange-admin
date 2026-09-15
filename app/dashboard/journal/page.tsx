"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSyncedState } from "../lib/useSyncedState";
import { TRANSACTIONS_KEY, HAWALAS_KEY, CASH_KEY, CUSTOMERS_KEY } from "../lib/defaultData";

// ============================================================
// ✅ تعریف توابع کمکی به صورت محلی برای جلوگیری از خطای Import
// ============================================================
type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";
const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const currencyLabels: Record<Currency, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };
const currencyFlags: Record<Currency, string> = { AFN: "🇦🇫", USD: "🇺🇸", EUR: "🇪🇺", IRR: "🇮🇷", PKR: "🇵🇰" };

const CASH_BOX_ID = "CASH_BOX";
const EXCHANGE_ACCOUNT_ID = "EXCHANGE_ACCOUNT";

type BalanceChange = { customerId?: string; customerName: string; currency: Currency; amount: number; };

function applyBalanceChanges(customers: any[], changes: BalanceChange[]): any[] {
  return customers.map(c => {
    if (c.id === CASH_BOX_ID || c.id === EXCHANGE_ACCOUNT_ID) return c;
    const cc = changes.filter(ch => ch.customerId === c.id);
    if (cc.length === 0) return c;
    const nb = { ...c.balances };
    for (const ch of cc) {
      if (nb[ch.currency] === undefined) nb[ch.currency] = 0;
      nb[ch.currency] = (nb[ch.currency] || 0) + ch.amount;
    }
    return { ...c, balances: nb };
  });
}

function getBalanceChangesForTransaction(tx: any, action: "register" | "reverse"): BalanceChange[] {
  const changes: BalanceChange[] = [];
  const sign = action === "register" ? 1 : -1;
  
  if (tx.type === "exchange" && tx.customerId && tx.customerId !== CASH_BOX_ID && tx.customerId !== EXCHANGE_ACCOUNT_ID) {
    if (tx.dealType === "sell") {
      changes.push({ customerId: tx.customerId, customerName: tx.customerName || "", currency: tx.fromCurrency, amount: -tx.fromAmount * sign });
    } else if (tx.dealType === "buy") {
      changes.push({ customerId: tx.customerId, customerName: tx.customerName || "", currency: tx.toCurrency, amount: tx.toAmount * sign });
    } else {
      changes.push({ customerId: tx.customerId, customerName: tx.customerName || "", currency: tx.fromCurrency, amount: -tx.fromAmount * sign });
      changes.push({ customerId: tx.customerId, customerName: tx.customerName || "", currency: tx.toCurrency, amount: tx.toAmount * sign });
    }
    if (tx.commission && tx.commission > 0 && tx.commissionCurrency) {
      changes.push({ customerId: tx.customerId, customerName: tx.customerName || "", currency: tx.commissionCurrency, amount: -tx.commission * sign });
    }
  }
  
  if (tx.type === "transfer") {
    if (tx.senderId && tx.senderId !== CASH_BOX_ID && tx.senderId !== EXCHANGE_ACCOUNT_ID) {
      changes.push({ customerId: tx.senderId, customerName: tx.senderName || "", currency: tx.fromCurrency, amount: -tx.fromAmount * sign });
      if (tx.commissionPayer === "sender" && tx.commission && tx.commission > 0 && tx.commissionCurrency) {
        changes.push({ customerId: tx.senderId, customerName: tx.senderName || "", currency: tx.commissionCurrency, amount: -tx.commission * sign });
      }
    }
    if (tx.receiverId && tx.receiverId !== CASH_BOX_ID && tx.receiverId !== EXCHANGE_ACCOUNT_ID) {
      changes.push({ customerId: tx.receiverId, customerName: tx.receiverName || "", currency: tx.toCurrency, amount: tx.toAmount * sign });
      if (tx.commissionPayer === "receiver" && tx.commission && tx.commission > 0 && tx.commissionCurrency) {
        changes.push({ customerId: tx.receiverId, customerName: tx.receiverName || "", currency: tx.commissionCurrency, amount: -tx.commission * sign });
      }
    }
  }
  
  if (tx.type === "convert" && tx.customerId && tx.customerId !== CASH_BOX_ID && tx.customerId !== EXCHANGE_ACCOUNT_ID) {
    changes.push({ customerId: tx.customerId, customerName: tx.customerName || "", currency: tx.fromCurrency, amount: -tx.fromAmount * sign });
    changes.push({ customerId: tx.customerId, customerName: tx.customerName || "", currency: tx.toCurrency, amount: tx.toAmount * sign });
    if (tx.commission && tx.commission > 0 && tx.commissionCurrency) {
      changes.push({ customerId: tx.customerId, customerName: tx.customerName || "", currency: tx.commissionCurrency, amount: -tx.commission * sign });
    }
  }
  return changes;
}
// ============================================================

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
  const [dateRange, setDateRange] = useUrlState("date", "all");
  const [typeFilter, setTypeFilter] = useUrlState("type", "all");
  const [currencyFilter, setCurrencyFilter] = useUrlState("currency", "all");
  const [searchQuery, setSearchQuery] = useUrlState("search", "");

  // ✅ استفاده از useSyncedState برای ارتباط ۱۰۰٪ با سایر تب‌ها
  const [transactions, setTransactions] = useSyncedState<any[]>(TRANSACTIONS_KEY, []);
  const [hawalas, setHawalas] = useSyncedState<any[]>(HAWALAS_KEY, []);
  const [cashEntries, setCashEntries] = useSyncedState<any[]>(CASH_KEY, []);
  const [customers, setCustomers] = useSyncedState<any[]>(CUSTOMERS_KEY, []);

  const [voidingId, setVoidingId] = useState<string | null>(null);

  // ✅ ادغام هوشمند تمام داده‌ها در یک آرایه واحد و مرتب‌سازی بر اساس تاریخ
  const unifiedEntries = useMemo<UnifiedJournalEntry[]>(() => {
    const entries: UnifiedJournalEntry[] = [];

    transactions.forEach((tx: any) => {
      if (tx.status === "voided" && !tx.voidedReason) return;
      let type: TxType = "تبدیل";
      if (tx.type === "exchange") type = tx.dealType === "buy" ? "واریز" : "برداشت";
      else if (tx.type === "transfer") type = "انتقال";
      
      const partyName = tx.type === "transfer" ? `${tx.senderName || "—"} به ${tx.receiverName || "—"}` : (tx.customerName || "مشتری");
      
      entries.push({
        id: tx.id, date: tx.date, type, description: tx.description || `${tx.type} ${tx.fromCurrency} به ${tx.toCurrency}`,
        partyName, partyId: tx.customerId || tx.senderId, currency: tx.fromCurrency, amount: tx.fromAmount,
        balanceAfter: tx.balanceAfter, status: tx.status, voidedReason: tx.voidedReason, source: "transaction", sourceId: tx.id
      });
    });

    hawalas.forEach((h: any) => {
      if (h.status === "cancelled") return;
      entries.push({
        id: h.id, date: h.date, type: "حواله", description: `حواله به ${h.receiverName} (${h.destinationText || ""})`,
        partyName: h.senderName, partyId: h.senderId, currency: h.currencyFrom, amount: h.amountFrom,
        status: h.status === "paid" ? "active" : "active", source: "hawala", sourceId: h.id
      });
      if (h.status === "paid") {
        entries.push({
          id: `${h.id}-paid`, date: h.paidAt || h.date, type: "واریز", description: `تسویه حواله از ${h.senderName}`,
          partyName: h.receiverName, partyId: h.receiverId, currency: h.currencyTo, amount: h.finalAmount,
          status: "active", source: "hawala", sourceId: h.id
        });
      }
    });

    cashEntries.forEach((ce: any) => {
      if (!ce) return;
      if (ce.status === "voided") return;
      // جلوگیری از شمارش دوباره اسنادی که توسط معاملات یا حواله‌ها ساخته شده‌اند
      if (ce.linkedExchangeId || ce.linkedTransferId || ce.linkedConvertId || ce.linkedHawalaId || ce.linkedHawalaSettleId) return;
      
      let type: TxType = "هزینه";
      if (ce.type === "customer_deposit" || ce.type === "owner_deposit") type = "واریز";
      else if (ce.type === "customer_withdraw" || ce.type === "owner_withdraw") type = "برداشت";
      else if (ce.type === "loan_given" || ce.type === "loan_received") type = "انتقال";
      else if (ce.type === "fee" || ce.type === "commission_withdraw") type = "هزینه";
      else if (ce.type === "adjustment") type = "برداشت";

      entries.push({
        id: ce.id, date: ce.date || new Date().toISOString(), type, description: ce.reason || ce.type || "عملیات صندوق",
        partyName: ce.customerName || "صندوق", partyId: ce.customerId, currency: ce.currency, amount: Number(ce.amount) || 0,
        balanceAfter: ce.balanceAfter, status: ce.status || "active", source: "cash", sourceId: ce.id
      });
    });

    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, hawalas, cashEntries]);

  // ✅ فیلتر کردن پیشرفته سمت کلاینت
  const filteredEntries = useMemo(() => {
    return unifiedEntries.filter((e: any) => {
      if (e.status === "voided" && !e.voidedReason) return false;
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (currencyFilter !== "all" && e.currency !== currencyFilter) return false;
      
      if (dateRange !== "all") {
        const entryDate = new Date(e.date);
        const now = new Date();
        if (dateRange === "today" && entryDate.toDateString() !== now.toDateString()) return false;
        if (dateRange === "week") {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (entryDate < weekAgo) return false;
        }
        if (dateRange === "month" && entryDate.getMonth() !== now.getMonth()) return false;
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return e.description.toLowerCase().includes(q) || 
               e.partyName.toLowerCase().includes(q) || 
               e.id.toLowerCase().includes(q);
      }
      return true;
    });
  }, [unifiedEntries, dateRange, typeFilter, currencyFilter, searchQuery]);

  // ✅ محاسبه آنی و سبک مجموع‌ها
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

  // ✅ منطق ابطال امن و یکپارچه
  const handleVoid = async (entry: UnifiedJournalEntry) => {
    const reason = prompt("دلیل ابطال این تراکنش را وارد کنید:");
    if (!reason) return;
    
    setVoidingId(entry.id);
    try {
      if (entry.source === "transaction") {
        const tx = transactions.find((t: any) => t.id === entry.sourceId);
        if (tx) {
          setCustomers((prev: any) => applyBalanceChanges(prev, getBalanceChangesForTransaction(tx, "reverse")));
          setTransactions((prev: any) => prev.map((t: any) => t.id === entry.sourceId ? { ...t, status: "voided", voidedReason: reason } : t));
        }
      } else if (entry.source === "cash") {
        const ce = cashEntries.find((c: any) => c.id === entry.sourceId);
        if (ce) {
          setCashEntries((prev: any) => prev.map((c: any) => c.id === entry.sourceId ? { ...c, status: "voided", voidedReason: reason } : c));
        }
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

  // ✅ اصلاح خطای TypeScript: اضافه کردن `as Currency`
  const handleExport = () => {
    const headers = ["شماره سند", "تاریخ/ساعت", "شرح معامله", "مشتری", "ارز", "مبلغ", "نوع", "وضعیت"];
    const escapeCsv = (val: any) => `"${String(val ?? "").replace(/"/g, '""')}"`;
    const rows = filteredEntries.map((e: any) => [
      escapeCsv(e.id.slice(0, 8)),
      escapeCsv(new Date(e.date).toLocaleString("fa-IR")),
      escapeCsv(e.description),
      escapeCsv(e.partyName),
      escapeCsv(currencyLabels[e.currency as Currency]), // ✅ FIX: Added `as Currency`
      e.amount,
      escapeCsv(e.type),
      escapeCsv(e.status === "voided" ? `باطل شده (${e.voidedReason})` : "فعال")
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
      "واریز": "bg-emerald-100 text-emerald-800", "برداشت": "bg-rose-100 text-rose-800",
      "انتقال": "bg-blue-100 text-blue-800", "تبدیل": "bg-amber-100 text-amber-800",
      "هزینه": "bg-purple-100 text-purple-800", "حواله": "bg-sky-100 text-sky-800"
    };
    return styles[type] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6 p-4 md:p-8 bg-slate-50 min-h-screen font-sans" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">روزنامه کل معاملات</h1>
          <p className="text-slate-500 text-sm mt-1">نمای یکپارچه و حسابرسی‌پذیر از تمام تب‌های سیستم</p>
        </div>
        <button onClick={handleExport} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition shadow-sm text-sm font-bold">
          <span>📊</span> خروجی CSV
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
        <select value={dateRange} onChange={e => setDateRange(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
          <option value="all">همه زمان‌ها</option><option value="today">امروز</option><option value="week">این هفته</option><option value="month">این ماه</option>
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
          <option value="all">همه انواع</option><option value="واریز">واریز</option><option value="برداشت">برداشت</option>
          <option value="انتقال">انتقال</option><option value="تبدیل">تبدیل ارز</option><option value="حواله">حواله</option><option value="هزینه">هزینه/کارمزد</option>
        </select>
        <select value={currencyFilter} onChange={e => setCurrencyFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
          <option value="all">همه ارزها</option>
          {currencies.map(c => <option key={c} value={c}>{currencyLabels[c]}</option>)}
        </select>
        <div className="relative">
          <input type="text" placeholder="جستجو در شرح، نام یا کد..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full border rounded-lg px-3 py-2 pr-9 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          <svg className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b">
              <tr>
                <th className="px-4 py-3">تاریخ/ساعت</th><th className="px-4 py-3">نوع</th><th className="px-4 py-3">شرح معامله</th>
                <th className="px-4 py-3">طرف حساب</th><th className="px-4 py-3 text-center">ارز</th><th className="px-4 py-3 text-center">مبلغ</th>
                <th className="px-4 py-3 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEntries.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">هیچ تراکنشی با این فیلترها یافت نشد.</td></tr>
              ) : (
                filteredEntries.map((entry: any, idx: number) => {
                  const isVoided = entry.status === "voided";
                  return (
                    <tr key={entry.id} className={`hover:bg-slate-50 transition ${isVoided ? "bg-slate-100/50" : ""}`}>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                        {new Date(entry.date).toLocaleString("fa-IR")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${getTypeBadgeStyle(entry.type, isVoided)}`}>
                          {entry.type}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-medium ${isVoided ? "text-slate-400 line-through" : "text-slate-800"}`}>
                        {entry.description}
                        {isVoided && <div className="text-[10px] text-rose-500 mt-1">دلیل: {entry.voidedReason}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{entry.partyName}</td>
                      <td className="px-4 py-3 text-center text-slate-600 whitespace-nowrap">
                        {/* ✅ اصلاح خطای TypeScript: اضافه کردن `as Currency` */}
                        <span className="ml-1">{currencyFlags[entry.currency as Currency]}</span>{currencyLabels[entry.currency as Currency]}
                      </td>
                      <td className={`px-4 py-3 text-center font-bold tabular-nums ${isVoided ? "text-slate-400 line-through" : (entry.type === "واریز" ? "text-emerald-600" : "text-rose-600")}`}>
                        {entry.type === "واریز" ? "+" : "-"} {fmt(entry.amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {!isVoided && entry.source !== "hawala" && (
                          <button onClick={() => handleVoid(entry)} disabled={voidingId === entry.id} className="text-xs bg-rose-50 text-rose-600 hover:bg-rose-100 px-3 py-1.5 rounded-lg font-bold transition disabled:opacity-50">
                            {voidingId === entry.id ? "در حال ابطال..." : "ابطال"}
                          </button>
                        )}
                        {isVoided && <span className="text-[10px] text-slate-400 bg-slate-200 px-2 py-1 rounded">باطل‌شده</span>}
                        {entry.source === "hawala" && <span className="text-[10px] text-blue-500 bg-blue-50 px-2 py-1 rounded">مدیریت در تب حواله</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center"><span className="w-2 h-2 bg-emerald-500 rounded-full ml-2"></span>خلاصه دوره انتخاب‌شده (بر اساس فیلتر)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-center">
              <div className="text-xs text-slate-500 mb-1">تعداد کل</div>
              <div className="text-xl font-bold text-slate-800 tabular-nums">{summary.count}</div>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100 text-center">
              <div className="text-xs text-emerald-600 mb-1">مجموع واریز</div>
              <div className="text-xl font-bold text-emerald-700 tabular-nums">{fmt(summary.deposits)}</div>
            </div>
            <div className="bg-rose-50 rounded-lg p-3 border border-rose-100 text-center">
              <div className="text-xs text-rose-600 mb-1">مجموع برداشت/هزینه</div>
              <div className="text-xl font-bold text-rose-700 tabular-nums">{fmt(summary.withdrawals)}</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 text-center">
              <div className="text-xs text-blue-600 mb-1">مجموع انتقال/حواله</div>
              <div className="text-xl font-bold text-blue-700 tabular-nums">{fmt(summary.transfers)}</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center"><span className="w-2 h-2 bg-blue-500 rounded-full ml-2"></span>راهنما</h3>
          <ul className="text-sm text-slate-600 space-y-2 list-disc pr-4">
            <li>این جدول به صورت <b>آنلاین و لحظه‌ای</b> با تب‌های معاملات، حواله و صندوق همگام است.</li>
            <li>برای ابطال حواله، باید به تب "حواله‌جات" مراجعه کنید تا زنجیره اسناد به درستی معکوس شود.</li>
            <li>خروجی CSV دقیقاً مطابق با فیلترهای اعمال‌شده در همین صفحه تولید می‌شود.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
