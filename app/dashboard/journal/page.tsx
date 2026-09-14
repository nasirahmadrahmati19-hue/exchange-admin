"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useSyncedState } from "../lib/useSyncedState";
import { CUSTOMERS_KEY, TRANSACTIONS_KEY, CASH_KEY, HAWALAS_KEY } from "../lib/defaultData";

type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";

const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const labels: Record<Currency, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };

type JournalEntry = {
  id: string;
  date: string;
  type: "exchange" | "transfer" | "convert" | "hawala" | "cash";
  trackingCode: string;
  description: string;
  customerName: string;
  currency: Currency;
  amount: number;
  direction: "in" | "out";
  sourceId: string;
};

const fmt = (n: number) => Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0";

function shamsiParts(d: Date) {
  try {
    const p = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
    const g = (t: string) => p.find(x => x.type === t)?.value || "0";
    return { year: g("year"), month: g("month"), day: g("day") };
  } catch { return { year: "0", month: "0", day: "0" }; }
}

function splitDateTime(s: string): { datePart: string; timePart: string } {
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return { datePart: "-", timePart: "" };
    const pad = (n: number) => String(n).padStart(2, "0");
    const sParts = shamsiParts(d);
    return { datePart: `${sParts.year}/${sParts.month}/${sParts.day}`, timePart: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
  } catch { return { datePart: "-", timePart: "" }; }
}

const Ic = ({ n, className = "h-5 w-5" }: { n: string; className?: string }) => {
  const paths: Record<string, string> = {
    doc: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
    search: "m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 1 10.607 10.607Z",
    x: "M6 18 18 6M6 6l12 12",
    tag: "M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z",
    inbox: "M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z",
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d={paths[n] || ""} /></svg>;
};

export default function JournalPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "exchange" | "transfer" | "convert" | "hawala" | "cash">("all");
  const [filterCurrency, setFilterCurrency] = useState<Currency | "all">("all");

  const [transactions] = useSyncedState<any[]>(TRANSACTIONS_KEY, []);
  const [hawalas] = useSyncedState<any[]>(HAWALAS_KEY, []);
  const [cashEntries] = useSyncedState<any[]>(CASH_KEY, []);
  const [customers] = useSyncedState<any[]>(CUSTOMERS_KEY, []);

  useEffect(() => {
    try {
      const s = window.localStorage.getItem("fx-theme");
      if (s === "dark" || s === "light") setTheme(s);
    } catch {}
  }, []);

  const dk = theme === "dark";

  // ✅ تابع ادغام‌کننده هوشمند تمام اسناد
  const unifiedJournal = useMemo(() => {
    const entries: JournalEntry[] = [];

    // ۱. پردازش معاملات
    transactions.forEach((tx: any) => {
      if (tx.status === "voided") return;
      const custName = tx.type === "transfer" ? `${tx.senderName || "—"} به ${tx.receiverName || "—"}` : (tx.customerName || "مشتری");
      entries.push({
        id: `tx-${tx.id}`, date: tx.date, type: tx.type as any, trackingCode: tx.trackingCode,
        description: `تبادل/انتقال/تبدیل ارز (${tx.fromCurrency} به ${tx.toCurrency})`,
        customerName: custName, currency: tx.fromCurrency, amount: tx.fromAmount, direction: "out", sourceId: tx.id
      });
      entries.push({
        id: `tx-in-${tx.id}`, date: tx.date, type: tx.type as any, trackingCode: tx.trackingCode,
        description: `دریافت ${tx.toCurrency}`,
        customerName: custName, currency: tx.toCurrency, amount: tx.toAmount, direction: "in", sourceId: tx.id
      });
    });

    // ۲. پردازش حواله‌ها
    hawalas.forEach((h: any) => {
      if (h.status === "cancelled") return;
      entries.push({
        id: `h-out-${h.id}`, date: h.date, type: "hawala", trackingCode: h.number,
        description: `حواله ارسالی به ${h.receiverName} (${h.destinationText})`,
        customerName: h.senderName, currency: h.currencyFrom, amount: h.amountFrom, direction: "out", sourceId: h.id
      });
      if (h.status === "paid") {
        entries.push({
          id: `h-in-${h.id}`, date: h.paidAt || h.date, type: "hawala", trackingCode: h.number,
          description: `تسویه حواله دریافتی از ${h.senderName}`,
          customerName: h.receiverName, currency: h.currencyTo, amount: h.finalAmount, direction: "in", sourceId: h.id
        });
      }
    });

    // ۳. پردازش اسناد صندوق
    cashEntries.forEach((ce: any) => {
      if (ce.status === "voided") return;
      if (ce.linkedExchangeId || ce.linkedTransferId || ce.linkedConvertId || ce.linkedHawalaId || ce.linkedHawalaSettleId) return; // جلوگیری از دوبار شماری
      entries.push({
        id: `ce-${ce.id}`, date: ce.date, type: "cash", trackingCode: ce.trackingCode || "بدون کد",
        description: ce.reason || ce.type,
        customerName: ce.customerName || "صندوق", currency: ce.currency, amount: ce.amount, direction: ce.direction, sourceId: ce.id
      });
    });

    // مرتب‌سازی بر اساس تاریخ (جدیدترین اول)
    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, hawalas, cashEntries]);

  // ✅ فیلتر کردن داده‌ها
  const filteredJournal = useMemo(() => {
    const q = search.trim().toLowerCase();
    return unifiedJournal.filter(e => {
      if (filterType !== "all" && e.type !== filterType) return false;
      if (filterCurrency !== "all" && e.currency !== filterCurrency) return false;
      if (!q) return true;
      return e.trackingCode.toLowerCase().includes(q) || e.customerName.toLowerCase().includes(q) || e.description.toLowerCase().includes(q);
    });
  }, [unifiedJournal, search, filterType, filterCurrency]);

  const getTypeLabel = (type: string) => {
    if (type === "exchange") return "تبادل ارز";
    if (type === "transfer") return "انتقال";
    if (type === "convert") return "تبدیل ارز";
    if (type === "hawala") return "حواله";
    return "سند صندوق";
  };

  const getTypeColor = (type: string) => {
    if (type === "hawala") return dk ? "bg-sky-400/15 text-sky-300" : "bg-sky-100 text-sky-700";
    if (type === "cash") return dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-700";
    return dk ? "bg-violet-400/15 text-violet-300" : "bg-violet-100 text-violet-700";
  };

  return (
    <div className={`space-y-6 ${dk ? "text-slate-100" : "text-slate-800"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold">روزنامه کل</h1>
          <p className={`mt-1 text-xs font-bold ${dk ? "text-slate-400" : "text-slate-500"}`}>نمای یکپارچه از تمام رویدادهای مالی (معاملات، حواله‌ها و صندوق)</p>
        </div>
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${dk ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
          <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" /></span>
          تعداد اسناد: {filteredJournal.length}
        </div>
      </div>

      {/* فیلترها */}
      <div className={`rounded-2xl border p-4 ${dk ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-white"}`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو بر اساس کد پیگیری، نام مشتری یا شرح..." className={`h-11 w-full rounded-xl border px-3.5 pr-10 text-sm outline-none transition-all ${dk ? "border-slate-600 bg-slate-900 text-slate-100 focus:border-emerald-400" : "border-slate-200 bg-slate-50 text-slate-800 focus:border-emerald-500"}`} />
            <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${dk ? "text-slate-500" : "text-slate-400"}`}><Ic n="search" className="h-4 w-4" /></span>
          </div>
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
        {search || filterType !== "all" || filterCurrency !== "all" ? (
          <button onClick={() => { setSearch(""); setFilterType("all"); setFilterCurrency("all"); }} className={`mt-3 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black transition-all ${dk ? "text-slate-400 hover:bg-slate-700" : "text-slate-500 hover:bg-slate-100"}`}>
            <Ic n="x" className="h-3.5 w-3.5" /> پاک کردن فیلترها
          </button>
        ) : null}
      </div>

      {/* جدول روزنامه */}
      <div className={`overflow-hidden rounded-2xl border ${dk ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-white"}`}>
        {filteredJournal.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className={`mb-4 grid h-16 w-16 place-items-center rounded-2xl border border-dashed ${dk ? "border-slate-600 bg-slate-800" : "border-slate-300 bg-slate-50"}`}>
              <Ic n="inbox" className="h-7 w-7 opacity-70" />
            </div>
            <p className="text-sm font-black">سندی با این مشخصات یافت نشد.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className={`border-y ${dk ? "border-slate-700 bg-slate-800" : "border-slate-100 bg-slate-50"}`}>
                  {["تاریخ", "کد پیگیری", "نوع عملیات", "شرح", "مشتری", "ارز", "مبلغ", "جهت"].map(h => (
                    <th key={h} className="px-4 py-3.5 text-center text-[11px] font-black text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${dk ? "divide-slate-700/60" : "divide-slate-100"}`}>
                {filteredJournal.map((entry, idx) => {
                  const dt = splitDateTime(entry.date);
                  const isIn = entry.direction === "in";
                  return (
                    <tr key={entry.id} className={`transition-colors ${dk ? "hover:bg-slate-700/40" : "hover:bg-emerald-50/60"}`}>
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`text-xs font-bold tabular-nums ${dk ? "text-slate-200" : "text-slate-700"}`} dir="ltr">{dt.datePart}</span>
                          <span className={`text-[10px] tabular-nums ${dk ? "text-slate-500" : "text-slate-400"}`} dir="ltr">{dt.timePart}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-black tabular-nums ${dk ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300" : "border-cyan-300 bg-cyan-50 text-cyan-700"}`} dir="ltr">
                          <Ic n="tag" className="h-3 w-3" />{entry.trackingCode}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${getTypeColor(entry.type)}`}>
                          {getTypeLabel(entry.type)}
                        </span>
                      </td>
                      <td className={`px-4 py-3.5 text-center text-[12px] font-bold max-w-[200px] truncate ${dk ? "text-slate-300" : "text-slate-600"}`}>
                        {entry.description}
                      </td>
                      <td className={`px-4 py-3.5 text-center text-[12px] font-bold ${dk ? "text-slate-200" : "text-slate-700"}`}>
                        {entry.customerName}
                      </td>
                      <td className={`px-4 py-3.5 text-center text-[11px] font-black ${dk ? "text-slate-300" : "text-slate-600"}`}>
                        {labels[entry.currency]}
                      </td>
                      <td className={`px-4 py-3.5 text-center text-[13px] font-black tabular-nums ${isIn ? (dk ? "text-emerald-300" : "text-emerald-700") : (dk ? "text-rose-300" : "text-rose-700")}`}>
                        {fmt(entry.amount)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black ${isIn ? (dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-700") : (dk ? "bg-rose-400/15 text-rose-300" : "bg-rose-100 text-rose-700")}`}>
                          {isIn ? "➕ دریافت" : "➖ پرداخت"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
