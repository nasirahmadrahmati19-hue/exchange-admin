"use client";

import { useEffect, useState, useMemo } from "react";
import { useSyncedState } from "../lib/useSyncedState";
import { TRANSACTIONS_KEY, CASH_KEY, HAWALAS_KEY } from "../lib/defaultData";

type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";
const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const labels: Record<Currency, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };

const fmt = (n: number) => Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0";

function splitDateTime(s: string): { datePart: string; timePart: string } {
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return { datePart: "-", timePart: "" };
    const pad = (n: number) => String(n).padStart(2, "0");
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
    const g = (t: string) => parts.find(p => p.type === t)?.value || "0";
    return { datePart: `${g("year")}/${g("month")}/${g("day")}`, timePart: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
  } catch { 
    return { datePart: "-", timePart: "" }; 
  }
}

type JournalEntry = {
  id: string;
  date: string;
  type: "exchange" | "transfer" | "convert" | "hawala" | "cash";
  trackingCode: string;
  description: string;
  partyName: string;
  currency: Currency;
  debit: number;
  credit: number;
  sourceId: string;
  raw: any;
};

const Ic = ({ n, className = "h-5 w-5" }: { n: string; className?: string }) => {
  const paths: Record<string, string> = {
    doc: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
    search: "m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 1 10.607 10.607Z",
    x: "M6 18 18 6M6 6l12 12",
    tag: "M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z",
    inbox: "M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z",
    printer: "M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z",
    download: "M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 16.5V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5",
    eye: "M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
    calendar: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d={paths[n] || ""} /></svg>;
};

export default function JournalPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "exchange" | "transfer" | "convert" | "hawala" | "cash">("all");
  const [filterCurrency, setFilterCurrency] = useState<Currency | "all">("all");
  const [dateRange, setDateRange] = useState<"all" | "today" | "week" | "month" | "custom">("all");
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);

  const [transactions] = useSyncedState<any[]>(TRANSACTIONS_KEY, []);
  const [hawalas] = useSyncedState<any[]>(HAWALAS_KEY, []);
  const [cashEntries] = useSyncedState<any[]>(CASH_KEY, []);

  useEffect(() => {
    try {
      const s = window.localStorage.getItem("fx-theme");
      if (s === "dark" || s === "light") setTheme(s);
    } catch {}
  }, []);

  const dk = theme === "dark";

  const unifiedJournal = useMemo(() => {
    const entries: JournalEntry[] = [];

    transactions.forEach((tx: any) => {
      if (tx.status === "voided") return;
      const custName = tx.type === "transfer" ? `${tx.senderName || "—"} به ${tx.receiverName || "—"}` : (tx.customerName || "مشتری");
      entries.push({
        id: `tx-out-${tx.id}`, date: tx.date, type: tx.type, trackingCode: tx.trackingCode,
        description: `تبادل/انتقال/تبدیل (${tx.fromCurrency} به ${tx.toCurrency})`,
        partyName: custName, currency: tx.fromCurrency, debit: tx.fromAmount, credit: 0, sourceId: tx.id, raw: tx
      });
      entries.push({
        id: `tx-in-${tx.id}`, date: tx.date, type: tx.type, trackingCode: tx.trackingCode,
        description: `دریافت ${tx.toCurrency}`,
        partyName: custName, currency: tx.toCurrency, debit: 0, credit: tx.toAmount, sourceId: tx.id, raw: tx
      });
    });

    hawalas.forEach((h: any) => {
      if (h.status === "cancelled") return;
      entries.push({
        id: `h-out-${h.id}`, date: h.date, type: "hawala", trackingCode: h.number,
        description: `حواله ارسالی به ${h.receiverName} (${h.destinationText || ""})`,
        partyName: h.senderName, currency: h.currencyFrom, debit: h.amountFrom, credit: 0, sourceId: h.id, raw: h
      });
      if (h.status === "paid") {
        entries.push({
          id: `h-in-${h.id}`, date: h.paidAt || h.date, type: "hawala", trackingCode: h.number,
          description: `تسویه حواله دریافتی از ${h.senderName}`,
          partyName: h.receiverName, currency: h.currencyTo, debit: 0, credit: h.finalAmount, sourceId: h.id, raw: h
        });
      }
    });

    cashEntries.forEach((ce: any) => {
      if (ce.status === "voided") return;
      if (ce.linkedExchangeId || ce.linkedTransferId || ce.linkedConvertId || ce.linkedHawalaId || ce.linkedHawalaSettleId) return;
      entries.push({
        id: `ce-${ce.id}`, date: ce.date, type: "cash", trackingCode: ce.trackingCode || "بدون کد",
        description: ce.reason || ce.type,
        partyName: ce.customerName || "صندوق", currency: ce.currency, 
        debit: ce.direction === "out" ? ce.amount : 0, 
        credit: ce.direction === "in" ? ce.amount : 0, 
        sourceId: ce.id, raw: ce
      });
    });

    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, hawalas, cashEntries]);

  const filteredJournal = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();
    
    return unifiedJournal.filter((e: any) => {
      if (filterType !== "all" && e.type !== filterType) return false;
      if (filterCurrency !== "all" && e.currency !== filterCurrency) return false;
      
      if (dateRange !== "all") {
        const entryDate = new Date(e.date);
        if (dateRange === "today" && entryDate.toDateString() !== now.toDateString()) return false;
        if (dateRange === "week") {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (entryDate < weekAgo) return false;
        }
        if (dateRange === "month" && entryDate.getMonth() !== now.getMonth()) return false;
      }

      if (!q) return true;
      return e.trackingCode.toLowerCase().includes(q) || e.partyName.toLowerCase().includes(q) || e.description.toLowerCase().includes(q);
    });
  }, [unifiedJournal, search, filterType, filterCurrency, dateRange]);

  const summary = useMemo(() => {
    let totalDebit = 0, totalCredit = 0;
    filteredJournal.forEach((e: any) => {
      totalDebit += e.debit;
      totalCredit += e.credit;
    });
    return { totalDebit, totalCredit, net: totalCredit - totalDebit };
  }, [filteredJournal]);

  const getTypeLabel = (type: string) => {
    const map: Record<string, string> = { exchange: "تبادل ارز", transfer: "انتقال", convert: "تبدیل ارز", hawala: "حواله", cash: "سند صندوق" };
    return map[type] || type;
  };

  const getTypeColor = (type: string) => {
    if (type === "hawala") return dk ? "bg-sky-400/15 text-sky-300" : "bg-sky-100 text-sky-700";
    if (type === "cash") return dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-700";
    return dk ? "bg-violet-400/15 text-violet-300" : "bg-violet-100 text-violet-700";
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ["تاریخ", "ساعت", "کد پیگیری", "نوع", "شرح", "طرف حساب", "ارز", "بدهکار", "بستانکار"];
    const rows = filteredJournal.map((e: any) => {
      const dt = splitDateTime(e.date);
      // ✅ اصلاح خطا: اضافه کردن "as Currency"
      return [dt.datePart, dt.timePart, e.trackingCode, getTypeLabel(e.type), e.description, e.partyName, labels[e.currency as Currency], e.debit, e.credit].join(",");
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
  };

  return (
    <div className={`space-y-6 ${dk ? "text-slate-100" : "text-slate-800"} print:space-y-2`}>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold">روزنامه کل</h1>
          <p className={`mt-1 text-xs font-bold ${dk ? "text-slate-400" : "text-slate-500"}`}>نمای یکپارچه و استاندارد از تمام رویدادهای مالی</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportCSV} className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition-all hover:scale-105 ${dk ? "border-slate-600 bg-slate-800 hover:bg-slate-700" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
            <Ic n="download" className="h-4 w-4" /> خروجی CSV
          </button>
          <button onClick={handlePrint} className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition-all hover:scale-105 ${dk ? "border-slate-600 bg-slate-800 hover:bg-slate-700" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
            <Ic n="printer" className="h-4 w-4" /> چاپ گزارش
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
        <div className={`rounded-2xl border p-4 ${dk ? "border-rose-400/20 bg-rose-400/5" : "border-rose-200 bg-rose-50"}`}>
          <p className={`text-xs font-bold ${dk ? "text-rose-300" : "text-rose-600"}`}>جمع کل بدهکار (پرداخت)</p>
          <p className="text-2xl font-black text-rose-500 mt-1" dir="ltr">{fmt(summary.totalDebit)}</p>
        </div>
        <div className={`rounded-2xl border p-4 ${dk ? "border-emerald-400/20 bg-emerald-400/5" : "border-emerald-200 bg-emerald-50"}`}>
          <p className={`text-xs font-bold ${dk ? "text-emerald-300" : "text-emerald-600"}`}>جمع کل بستانکار (دریافت)</p>
          <p className="text-2xl font-black text-emerald-500 mt-1" dir="ltr">{fmt(summary.totalCredit)}</p>
        </div>
        <div className={`rounded-2xl border p-4 ${dk ? "border-blue-400/20 bg-blue-400/5" : "border-blue-200 bg-blue-50"}`}>
          <p className={`text-xs font-bold ${dk ? "text-blue-300" : "text-blue-600"}`}>مانده خالص دوره</p>
          <p className={`text-2xl font-black mt-1 ${summary.net >= 0 ? "text-emerald-500" : "text-rose-500"}`} dir="ltr">{fmt(Math.abs(summary.net))} {summary.net >= 0 ? "(مثبت)" : "(منفی)"}</p>
        </div>
      </div>

      <div className={`rounded-2xl border p-4 print:hidden ${dk ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-white"}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو بر اساس کد پیگیری، نام یا شرح..." className={`h-11 w-full rounded-xl border px-3.5 pr-10 text-sm outline-none transition-all ${dk ? "border-slate-600 bg-slate-900 text-slate-100 focus:border-emerald-400" : "border-slate-200 bg-slate-50 text-slate-800 focus:border-emerald-500"}`} />
            <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${dk ? "text-slate-500" : "text-slate-400"}`}><Ic n="search" className="h-4 w-4" /></span>
          </div>
          <select value={dateRange} onChange={e => setDateRange(e.target.value as any)} className={`h-11 w-full rounded-xl border px-3.5 text-sm outline-none cursor-pointer ${dk ? "border-slate-600 bg-slate-900 text-slate-100" : "border-slate-200 bg-slate-50 text-slate-800"}`}>
            <option value="all">همه زمان‌ها</option>
            <option value="today">امروز</option>
            <option value="week">این هفته</option>
            <option value="month">این ماه</option>
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value as any)} className={`h-11 w-full rounded-xl border px-3.5 text-sm outline-none cursor-pointer ${dk ? "border-slate-600 bg-slate-900 text-slate-100" : "border-slate-200 bg-slate-50 text-slate-800"}`}>
            <option value="all">همه انواع عملیات</option>
            <option value="exchange">تبادل ارز</option>
            <option value="transfer">انتقال</option>
            <option value="convert">تبدیل ارز</option>
            <option value="hawala">حواله</option>
            <option value="cash">سند صندوق</option>
          </select>
          <select value={filterCurrency} onChange={e => setFilterCurrency(e.target.value as any)} className={`h-11 w-full rounded-xl border px-3.5 text-sm outline-none cursor-pointer ${dk ? "border-slate-600 bg-slate-900 text-slate-100" : "border-slate-200 bg-slate-50 text-slate-800"}`}>
            <option value="all">همه ارزها</option>
            {currencies.map(c => <option key={c} value={c}>{labels[c]}</option>)}
          </select>
        </div>
        {(search || filterType !== "all" || filterCurrency !== "all" || dateRange !== "all") && (
          <button onClick={() => { setSearch(""); setFilterType("all"); setFilterCurrency("all"); setDateRange("all"); }} className={`mt-3 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black transition-all ${dk ? "text-slate-400 hover:bg-slate-700" : "text-slate-500 hover:bg-slate-100"}`}>
            <Ic n="x" className="h-3.5 w-3.5" /> پاک کردن تمام فیلترها
          </button>
        )}
      </div>

      <div className={`overflow-hidden rounded-2xl border ${dk ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-white"} print:border-0 print:shadow-none`}>
        {filteredJournal.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center print:hidden">
            <div className={`mb-4 grid h-16 w-16 place-items-center rounded-2xl border border-dashed ${dk ? "border-slate-600 bg-slate-800" : "border-slate-300 bg-slate-50"}`}>
              <Ic n="inbox" className="h-7 w-7 opacity-70" />
            </div>
            <p className="text-sm font-black">سندی با این مشخصات یافت نشد.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm print:min-w-0 print:text-xs">
              <thead>
                <tr className={`border-y print:border-black ${dk ? "border-slate-700 bg-slate-800" : "border-slate-100 bg-slate-50"}`}>
                  {["ردیف", "تاریخ", "کد پیگیری", "شرح عملیات", "طرف حساب", "ارز", "بدهکار", "بستانکار", "عملیات"].map(h => (
                    <th key={h} className="px-3 py-3.5 text-center text-[11px] font-black text-slate-400 whitespace-nowrap print:text-black">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y print:divide-black ${dk ? "divide-slate-700/60" : "divide-slate-100"}`}>
                {filteredJournal.map((entry: any, idx: number) => {
                  const dt = splitDateTime(entry.date);
                  return (
                    <tr key={entry.id} className={`group transition-colors print:break-inside-avoid ${dk ? "hover:bg-slate-700/40" : "hover:bg-emerald-50/60"}`}>
                      <td className="px-3 py-3 text-center text-xs text-slate-500">{idx + 1}</td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`text-xs font-bold tabular-nums ${dk ? "text-slate-200" : "text-slate-700"}`} dir="ltr">{dt.datePart}</span>
                          <span className={`text-[10px] tabular-nums ${dk ? "text-slate-500" : "text-slate-400"}`} dir="ltr">{dt.timePart}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-black tabular-nums ${dk ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300" : "border-cyan-300 bg-cyan-50 text-cyan-700"}`} dir="ltr">
                          {entry.trackingCode}
                        </span>
                      </td>
                      <td className={`px-3 py-3 text-center text-[12px] font-bold max-w-[250px] truncate ${dk ? "text-slate-300" : "text-slate-600"}`}>
                        {entry.description}
                      </td>
                      <td className={`px-3 py-3 text-center text-[12px] font-bold ${dk ? "text-slate-200" : "text-slate-700"}`}>
                        {entry.partyName}
                      </td>
                      <td className={`px-3 py-3 text-center text-[11px] font-black ${dk ? "text-slate-300" : "text-slate-600"}`}>
                        {labels[entry.currency as Currency]}
                      </td>
                      <td className={`px-3 py-3 text-center text-[13px] font-black tabular-nums ${entry.debit > 0 ? (dk ? "text-rose-300" : "text-rose-600") : "text-transparent"}`}>
                        {entry.debit > 0 ? fmt(entry.debit) : "—"}
                      </td>
                      <td className={`px-3 py-3 text-center text-[13px] font-black tabular-nums ${entry.credit > 0 ? (dk ? "text-emerald-300" : "text-emerald-600") : "text-transparent"}`}>
                        {entry.credit > 0 ? fmt(entry.credit) : "—"}
                      </td>
                      <td className="px-3 py-3 text-center print:hidden">
                        <button onClick={() => setSelectedEntry(entry)} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-black transition-all ${dk ? "bg-slate-700 text-slate-300 hover:bg-slate-600" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                          <Ic n="eye" className="h-3 w-3" /> جزئیات
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm print:hidden" onClick={() => setSelectedEntry(null)}>
          <div className={`w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-white"}`} onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between border-b px-5 py-4 ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
              <div className="flex items-center gap-3">
                <span className={`grid h-10 w-10 place-items-center rounded-xl ${dk ? "bg-blue-400/15 text-blue-300" : "bg-blue-100 text-blue-600"}`}><Ic n="doc" className="h-5 w-5" /></span>
                <div>
                  <h3 className={`text-sm font-black ${dk ? "text-white" : "text-slate-800"}`}>جزئیات سند حسابداری</h3>
                  <p className={`text-[10px] font-bold ${dk ? "text-slate-400" : "text-slate-500"}`}>کد پیگیری: {selectedEntry.trackingCode}</p>
                </div>
              </div>
              <button onClick={() => setSelectedEntry(null)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-700/50"><Ic n="x" className="h-5 w-5" /></button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className={`rounded-xl p-3 ${dk ? "bg-slate-800/50" : "bg-slate-50"}`}>
                  <p className={`text-[10px] font-black ${dk ? "text-slate-400" : "text-slate-500"}`}>نوع عملیات</p>
                  <p className={`text-sm font-bold mt-1 ${dk ? "text-white" : "text-slate-800"}`}>{getTypeLabel(selectedEntry.type)}</p>
                </div>
                <div className={`rounded-xl p-3 ${dk ? "bg-slate-800/50" : "bg-slate-50"}`}>
                  <p className={`text-[10px] font-black ${dk ? "text-slate-400" : "text-slate-500"}`}>تاریخ و ساعت</p>
                  <p className={`text-sm font-bold mt-1 ${dk ? "text-white" : "text-slate-800"}`} dir="ltr">{splitDateTime(selectedEntry.date).datePart} {splitDateTime(selectedEntry.date).timePart}</p>
                </div>
              </div>

              <div className={`rounded-xl p-3 ${dk ? "bg-slate-800/50" : "bg-slate-50"}`}>
                <p className={`text-[10px] font-black ${dk ? "text-slate-400" : "text-slate-500"}`}>شرح عملیات</p>
                <p className={`text-sm font-bold mt-1 leading-6 ${dk ? "text-white" : "text-slate-800"}`}>{selectedEntry.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className={`rounded-xl p-3 border ${selectedEntry.debit > 0 ? (dk ? "border-rose-400/30 bg-rose-400/5" : "border-rose-200 bg-rose-50") : (dk ? "border-slate-700 bg-slate-800/30" : "border-slate-200 bg-slate-50")}`}>
                  <p className={`text-[10px] font-black ${selectedEntry.debit > 0 ? (dk ? "text-rose-300" : "text-rose-600") : (dk ? "text-slate-500" : "text-slate-400")}`}>مبلغ بدهکار (پرداخت)</p>
                  <p className={`text-lg font-black mt-1 tabular-nums ${selectedEntry.debit > 0 ? "text-rose-500" : (dk ? "text-slate-600" : "text-slate-300")}`} dir="ltr">
                    {selectedEntry.debit > 0 ? fmt(selectedEntry.debit) : "۰"} <span className="text-xs">{labels[selectedEntry.currency as Currency]}</span>
                  </p>
                </div>
                <div className={`rounded-xl p-3 border ${selectedEntry.credit > 0 ? (dk ? "border-emerald-400/30 bg-emerald-400/5" : "border-emerald-200 bg-emerald-50") : (dk ? "border-slate-700 bg-slate-800/30" : "border-slate-200 bg-slate-50")}`}>
                  <p className={`text-[10px] font-black ${selectedEntry.credit > 0 ? (dk ? "text-emerald-300" : "text-emerald-600") : (dk ? "text-slate-500" : "text-slate-400")}`}>مبلغ بستانکار (دریافت)</p>
                  <p className={`text-lg font-black mt-1 tabular-nums ${selectedEntry.credit > 0 ? "text-emerald-500" : (dk ? "text-slate-600" : "text-slate-300")}`} dir="ltr">
                    {selectedEntry.credit > 0 ? fmt(selectedEntry.credit) : "۰"} <span className="text-xs">{labels[selectedEntry.currency as Currency]}</span>
                  </p>
                </div>
              </div>

              <div className={`rounded-xl p-3 ${dk ? "bg-slate-800/50" : "bg-slate-50"}`}>
                <p className={`text-[10px] font-black ${dk ? "text-slate-400" : "text-slate-500"}`}>طرف حساب</p>
                <p className={`text-sm font-bold mt-1 ${dk ? "text-white" : "text-slate-800"}`}>{selectedEntry.partyName}</p>
              </div>
            </div>

            <div className={`border-t px-5 py-4 flex justify-end ${dk ? "border-slate-700 bg-slate-800/30" : "border-slate-100 bg-slate-50"}`}>
              <button onClick={() => setSelectedEntry(null)} className={`rounded-xl px-6 py-2.5 text-sm font-black transition-all active:scale-95 ${dk ? "bg-slate-700 text-white hover:bg-slate-600" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}>بستن</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
