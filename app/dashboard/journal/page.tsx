"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSyncedState } from "../lib/useSyncedState";
import { TRANSACTIONS_KEY, HAWALAS_KEY, CASH_KEY, CUSTOMERS_KEY } from "../lib/defaultData";

type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";
const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const currencyLabels: Record<Currency, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };

type TxType = "واریز" | "برداشت" | "انتقال" | "تبدیل" | "هزینه" | "حواله";

// ✨ نگاشت نوع تراکنش به مخفف فارسی
const typePrefixMap: Record<TxType, string> = {
  "واریز": "وار",
  "برداشت": "برد",
  "انتقال": "انت",
  "تبدیل": "تبد",
  "هزینه": "هز",
  "حواله": "حو"
};

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
  trackingCode: string; // ✨ کد پیگیری (بدون تاریخ)
}

const fmt = (n: number) => Number.isFinite(n) ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00";

// ✨ تبدیل ارقام انگلیسی به فارسی برای نمایش
const toPersianDigits = (s: string): string => {
  return s.replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[parseInt(d)]);
};

// ✨ تابع تولید کد پیگیری فارسی (بدون تاریخ): وار-A3F2
const generateTrackingCode = (type: TxType, id: string): string => {
  const prefix = typePrefixMap[type] || "سایر";
  const idPart = id.slice(0, 4).toUpperCase();
  return `${prefix}-${idPart}`;
};

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
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  
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

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("fx-theme");
      if (saved === "dark" || saved === "light") setTheme(saved);
    } catch {}
    setMounted(true);
  }, []);

  const dk = theme === "dark";
  const heading = dk ? "text-white" : "text-slate-900";
  const subText = dk ? "text-slate-400" : "text-slate-500";
  const uiCard = dk
    ? "border-slate-700 bg-slate-800/90 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.6)]"
    : "border-emerald-100 bg-white/95 shadow-[0_16px_40px_-28px_rgba(16,185,129,0.35)]";

  // ✅ ۱. ادغام هوشمند تمام داده‌ها
  const unifiedEntries = useMemo<UnifiedJournalEntry[]>(() => {
    const entries: UnifiedJournalEntry[] = [];
    transactions.forEach((tx: any) => {
      if (tx.status === "voided" && !tx.voidedReason) return;
      let type: TxType = "تبدیل";
      if (tx.type === "exchange") type = tx.dealType === "buy" ? "واریز" : "برداشت";
      else if (tx.type === "transfer") type = "انتقال";
      const partyName = tx.type === "transfer" ? `${tx.senderName || "—"} به ${tx.receiverName || "—"}` : (tx.customerName || "مشتری");
      entries.push({
        id: tx.id, date: tx.date, type,
        description: tx.description || `${tx.type} ${tx.fromCurrency} به ${tx.toCurrency}`,
        partyName, partyId: tx.customerId || tx.senderId, currency: tx.fromCurrency,
        amount: tx.fromAmount, balanceAfter: tx.balanceAfter, status: tx.status,
        voidedReason: tx.voidedReason, source: "transaction", sourceId: tx.id,
        trackingCode: generateTrackingCode(type, tx.id)
      });
    });
    hawalas.forEach((h: any) => {
      if (h.status === "cancelled") return;
      entries.push({
        id: h.id, date: h.date, type: "حواله",
        description: `حواله به ${h.receiverName} (${h.destinationText || ""})`,
        partyName: h.senderName, partyId: h.senderId, currency: h.currencyFrom,
        amount: h.amountFrom, status: "active", source: "hawala", sourceId: h.id,
        trackingCode: generateTrackingCode("حواله", h.id)
      });
      if (h.status === "paid") {
        entries.push({
          id: `${h.id}-paid`, date: h.paidAt || h.date, type: "واریز",
          description: `تسویه حواله از ${h.senderName}`, partyName: h.receiverName,
          partyId: h.receiverId, currency: h.currencyTo, amount: h.finalAmount,
          status: "active", source: "hawala", sourceId: h.id,
          trackingCode: generateTrackingCode("واریز", `${h.id}-paid`)
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
        id: ce.id, date: ce.date || new Date().toISOString(), type,
        description: ce.reason || ce.type || "عملیات صندوق", partyName: ce.customerName || "صندوق",
        partyId: ce.customerId, currency: ce.currency, amount: Number(ce.amount) || 0,
        balanceAfter: ce.balanceAfter, status: ce.status || "active", source: "cash", sourceId: ce.id,
        trackingCode: generateTrackingCode(type, ce.id)
      });
    });
    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, hawalas, cashEntries]);

  // ✅ ۲. فیلتر کردن داده‌ها
  const filteredEntries = useMemo(() => {
    return unifiedEntries.filter((e: any) => {
      if (e.status === "voided" && !e.voidedReason) return false;
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (currencyFilter !== "all" && e.currency !== currencyFilter) return false;
      if (dateFrom && new Date(e.date) < new Date(dateFrom)) return false;
      if (dateTo && new Date(e.date) > new Date(dateTo)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return e.description.toLowerCase().includes(q) 
            || e.partyName.toLowerCase().includes(q) 
            || e.id.toLowerCase().includes(q) 
            || (e.trackingCode && e.trackingCode.toLowerCase().includes(q));
      }
      return true;
    });
  }, [unifiedEntries, dateFrom, dateTo, typeFilter, currencyFilter, searchQuery]);

  // ✅ ۳. محاسبه آنی خلاصه کلی
  const summary = useMemo(() => {
    let count = 0;
    filteredEntries.forEach((e: any) => { if (e.status !== "voided") count++; });
    return { count };
  }, [filteredEntries]);

  // ✅ ۴. محاسبه خلاصه ارزها (نمایش اجباری هر ۵ ارز)
  const currencyPeriodSummary = useMemo(() => {
    const summary: Record<string, { volume: number; net: number }> = {};
    currencies.forEach(curr => { summary[curr] = { volume: 0, net: 0 }; });
    filteredEntries.forEach((e: any) => {
      if (e.status === "voided" || !summary[e.currency]) return;
      summary[e.currency].volume += e.amount;
      if (e.type === "واریز") summary[e.currency].net += e.amount;
      else if (e.type === "برداشت" || e.type === "هزینه") summary[e.currency].net -= e.amount;
    });
    return summary;
  }, [filteredEntries]);

  // ✅ ۵. منطق ابطال امن
  const handleVoid = async (entry: UnifiedJournalEntry) => {
    const reason = prompt("دلیل ابطال این تراکنش را وارد کنید:");
    if (!reason) return;
    setVoidingId(entry.id);
    try {
      if (entry.source === "transaction") {
        setTransactions((prev: any) => prev.map((t: any) => (t.id === entry.sourceId ? { ...t, status: "voided", voidedReason: reason } : t)));
      } else if (entry.source === "cash") {
        setCashEntries((prev: any) => prev.map((c: any) => (c.id === entry.sourceId ? { ...c, status: "voided", voidedReason: reason } : c)));
      } else {
        alert("برای ابطال حواله، لطفاً به تب حواله‌جات مراجعه کنید.");
        setVoidingId(null); return;
      }
      alert("تراکنش با موفقیت باطل و موجودی اصلاح شد.");
    } catch (err) {
      alert("خطا در ابطال تراکنش: " + (err as Error).message);
    } finally { setVoidingId(null); }
  };

  // ✅ ۶. خروجی CSV
  const handleExport = () => {
    const headers = ["ردیف", "کد پیگیری", "تاریخ", "ساعت", "شرح", "نوع", "ارز", "مبلغ", "تراز بعد"];
    const escapeCsv = (val: any) => `"${String(val ?? "").replace(/"/g, '""')}"`;
    const rows = filteredEntries.map((e: any, index: number) => {
      const d = new Date(e.date);
      return [
        toPersianDigits(String(index + 1)),
        escapeCsv(e.trackingCode),
        escapeCsv(d.toLocaleDateString("fa-IR")),
        escapeCsv(d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })),
        escapeCsv(e.description), escapeCsv(e.type), escapeCsv(currencyLabels[e.currency as Currency]),
        e.amount, e.balanceAfter ?? ""
      ].join(",");
    });
    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.setAttribute("download", `journal-report-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ✅ ۷. توابع کمکی استایل
  const getBadgeColor = (type: TxType, isVoided: boolean) => {
    if (isVoided) return "bg-slate-700/50 text-slate-400 line-through";
    const styles: Record<TxType, string> = {
      "واریز": "bg-emerald-400/30 text-emerald-300", "برداشت": "bg-rose-400/30 text-rose-300",
      "انتقال": "bg-blue-400/30 text-blue-300", "تبدیل": "bg-amber-400/30 text-amber-300",
      "هزینه": "bg-purple-400/30 text-purple-300", "حواله": "bg-sky-400/30 text-sky-300"
    };
    return styles[type] || "bg-slate-600 text-slate-200";
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a]" dir="rtl">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-500" />
          <p className="mt-4 text-slate-400 font-sans">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className={dk ? "dark" : ""}>
      <style>{`@import url("https://fonts.googleapis.com/css2?family=Lalezar&family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap");.cs-font{font-family:"Vazirmatn","Segoe UI",Tahoma,sans-serif}.cs-display{font-family:"Lalezar","Vazirmatn",Tahoma,sans-serif;letter-spacing:.01em}.dark{color-scheme:dark}@keyframes csUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}.cs-up{animation:csUp .5s cubic-bezier(.22,.8,.35,1) both}::selection{background:rgba(16,185,129,.25)}`}</style>

      <div className={`cs-font relative min-h-screen overflow-x-hidden antialiased transition-colors duration-500 ${dk ? "bg-[#0f172a] text-slate-100" : "bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 text-slate-800"}`}>
        <div className={`fixed inset-x-0 top-0 z-30 h-1 bg-gradient-to-l ${dk ? "from-emerald-400 via-teal-400 to-cyan-400" : "from-emerald-500 via-teal-500 to-cyan-500"}`} />

        <div className="relative z-10 mx-auto w-full max-w-7xl space-y-4 md:space-y-6 px-3 pb-16 pt-5 md:px-8 md:pt-9">

          {/* ═══════════ هدر ═══════════ */}
          <header className="cs-up flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0">
              <div className="relative grid h-11 w-11 md:h-14 md:w-14 shrink-0 place-items-center rounded-xl md:rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-400 text-white shadow-lg shadow-emerald-500/30 ring-1 ring-white/30">
                <span className="text-2xl md:text-3xl">📋</span>
                <span className={`absolute -bottom-1 -left-1 md:-bottom-1.5 md:-left-1.5 grid h-4 min-w-4 md:h-5 md:min-w-5 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-400 px-1 text-[7px] md:text-[8px] font-black text-white ring-2 ${dk ? "ring-[#0f172a]" : "ring-[#ecfdf5]"}`}>JR</span>
              </div>
              <div className="min-w-0">
                <h1 className={`cs-display text-2xl md:text-4xl leading-none ${heading}`}>روزنامه کل معاملات</h1>
                <p className={`mt-1 text-[10px] md:text-xs font-bold ${subText}`}>نمای یکپارچه و حسابرسی‌پذیر از تمام تب‌های سیستم</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2.5">
              <button onClick={() => setTheme(dk ? "light" : "dark")} className={`group grid h-10 w-10 md:h-11 md:w-11 cursor-pointer place-items-center rounded-lg md:rounded-xl border shadow-sm backdrop-blur transition-all duration-300 active:scale-90 ${dk ? "border-slate-600 bg-slate-800/85 text-amber-300 hover:border-amber-300" : "border-slate-200 bg-white/85 text-slate-600 hover:border-emerald-400"}`}>
                <span className="text-lg transition-transform duration-500 group-hover:rotate-12">{dk ? "☀️" : "🌙"}</span>
              </button>
              <button onClick={handleExport} className="flex items-center gap-2 bg-emerald-500 px-4 py-2 rounded-xl hover:bg-emerald-600 transition shadow-lg shadow-emerald-500/20 text-sm font-bold text-white">
                <span>📊</span> <span className="hidden sm:inline">خروجی CSV</span>
              </button>
            </div>
          </header>

          {/* ═══════════ فیلترها ═══════════ */}
          <section className={`cs-up rounded-2xl border p-4 md:p-5 shadow-sm transition-colors duration-300 ${uiCard}`} style={{ animationDelay: "70ms" }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className={`text-xs font-bold mb-1.5 block ${subText}`}>از تاریخ</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`w-full border rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-400 transition ${dk ? "bg-slate-900/50 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-800"}`} />
              </div>
              <div>
                <label className={`text-xs font-bold mb-1.5 block ${subText}`}>تا تاریخ</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`w-full border rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-400 transition ${dk ? "bg-slate-900/50 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-800"}`} />
              </div>
              <div>
                <label className={`text-xs font-bold mb-1.5 block ${subText}`}>نوع ارز</label>
                <select value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value)} className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition ${dk ? "bg-slate-900/50 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-800"}`}>
                  <option value="all">همه ارزها</option>
                  {currencies.map((cur) => <option key={cur} value={cur}>{currencyLabels[cur]}</option>)}
                </select>
              </div>
              <div className="relative">
                <label className={`text-xs font-bold mb-1.5 block ${subText}`}>جستجو</label>
                <input type="text" placeholder="نام، کد پیگیری، یا شرح..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`w-full border rounded-xl px-3 py-2.5 pr-9 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition ${dk ? "bg-slate-900/50 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-800"}`} />
                <svg className={`absolute right-3 top-9 w-4 h-4 ${subText}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
            </div>
          </section>

          {/* ═══════════ خلاصه دوره (گرید یکپارچه ۶ تایی) ═══════════ */}
          <section className="cs-up space-y-4 md:space-y-5" style={{ animationDelay: "140ms" }}>
            <div className={`relative overflow-hidden rounded-2xl md:rounded-3xl border-2 p-5 md:p-6 transition-all duration-300 ${dk ? "border-emerald-400/30 bg-gradient-to-br from-emerald-900/30 via-slate-900/60 to-teal-900/30" : "border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50"}`}>
              <div className={`absolute -top-24 -left-24 h-48 w-48 rounded-full blur-3xl opacity-20 ${dk ? "bg-emerald-400" : "bg-emerald-300"}`} />
              
              <div className="relative flex items-center gap-3 mb-5">
                <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl shadow-md ${dk ? "bg-gradient-to-br from-emerald-400 to-teal-400 text-slate-950" : "bg-gradient-to-br from-emerald-500 to-teal-500 text-white"}`}>
                  <span className="text-xl">📊</span>
                </div>
                <div>
                  <h2 className={`cs-display text-xl md:text-2xl leading-none ${heading}`}>خلاصه دوره انتخاب‌شده</h2>
                  <p className={`mt-0.5 text-[10px] md:text-xs font-bold ${subText}`}>آمار کلی و گردش ارزها در بازه زمانی فیلترشده</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
                
                <div className={`rounded-xl p-3 border text-center transition-all duration-300 hover:scale-[1.02] flex flex-col justify-center ${dk ? "border-slate-700 bg-slate-900/50" : "border-slate-200 bg-white/80"}`}>
                  <div className={`text-[11px] font-black mb-2 ${dk ? "text-slate-300" : "text-slate-600"}`}>تعداد کل</div>
                  <div className="flex-1 flex items-center justify-center">
                    <span className={`text-3xl font-black tabular-nums leading-none ${dk ? "text-emerald-300" : "text-emerald-700"}`}>{toPersianDigits(String(summary.count))}</span>
                  </div>
                </div>

                {currencies.map((curr) => {
                  const data = currencyPeriodSummary[curr];
                  return (
                    <div key={curr} className={`rounded-xl p-3 border text-center transition-all duration-300 hover:scale-[1.02] ${dk ? "border-slate-700 bg-slate-900/50" : "border-slate-200 bg-white/80"}`}>
                      <div className={`text-[11px] font-black mb-2 ${dk ? "text-slate-300" : "text-slate-600"}`}>{currencyLabels[curr]}</div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs px-1">
                          <span className={subText}>حجم کل:</span>
                          <span className={`font-black tabular-nums ${dk ? "text-slate-200" : "text-slate-800"}`}>{fmt(data.volume)}</span>
                        </div>
                        <div className={`flex justify-between text-xs px-1 border-t pt-1.5 ${dk ? "border-slate-700/30" : "border-slate-200"}`}>
                          <span className={subText}>تغییر خالص:</span>
                          <span className={`font-black tabular-nums ${data.net >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                            {data.net >= 0 ? "+" : ""}{fmt(data.net)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ═══════════ جدول تراکنش‌ها ═══════════ */}
          <section className={`cs-up rounded-2xl md:rounded-3xl border-2 overflow-hidden ${uiCard}`} style={{ animationDelay: "210ms" }}>
            <div className="flex items-center gap-3 p-4 md:p-5 pb-3 md:pb-4 md:px-7 md:pt-6">
              <div className={`grid h-11 w-11 md:h-12 md:w-12 place-items-center rounded-xl shadow-md ${dk ? "bg-gradient-to-br from-cyan-400 to-sky-500 text-slate-950" : "bg-gradient-to-br from-cyan-500 to-sky-500 text-white"}`}>
                <span className="text-xl">📋</span>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className={`cs-display text-xl md:text-2xl leading-none ${heading}`}>لیست تراکنش‌ها</h2>
                <p className={`mt-1 text-[11px] font-bold ${subText}`}>جزئیات کامل عملیات ثبت‌شده در سیستم</p>
              </div>
            </div>

            <div className="overflow-x-auto px-4 md:px-7 pb-4">
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className={`border-y ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
                    <th className="px-2 py-3 text-center text-[11px] font-black text-slate-400 whitespace-nowrap w-12">ردیف</th>
                    <th className="px-3 py-3 text-center text-[11px] font-black text-slate-400 whitespace-nowrap">کد پیگیری</th>
                    <th className="px-3 py-3 text-center text-[11px] font-black text-slate-400 whitespace-nowrap">تاریخ</th>
                    <th className="px-3 py-3 text-center text-[11px] font-black text-slate-400 whitespace-nowrap">ساعت</th>
                    <th className="px-3 py-3 text-right text-[11px] font-black text-slate-400 whitespace-nowrap">شرح</th>
                    <th className="px-3 py-3 text-center text-[11px] font-black text-slate-400 whitespace-nowrap">نوع</th>
                    <th className="px-3 py-3 text-center text-[11px] font-black text-slate-400 whitespace-nowrap">ارز</th>
                    <th className="px-3 py-3 text-center text-[11px] font-black text-slate-400 whitespace-nowrap">مبلغ</th>
                    <th className="px-3 py-3 text-center text-[11px] font-black text-slate-400 whitespace-nowrap">تراز بعد</th>
                    <th className="px-3 py-3 text-center text-[11px] font-black text-slate-400 whitespace-nowrap">عملیات</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${dk ? "divide-slate-700/60" : "divide-slate-100"}`}>
                  {filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={10} className={`px-4 py-12 text-center font-bold ${subText}`}>هیچ تراکنشی با این فیلترها یافت نشد.</td>
                    </tr>
                  ) : (
                    filteredEntries.map((entry: any, index: number) => {
                      const isVoided = entry.status === "voided";
                      const d = new Date(entry.date);
                      const datePart = d.toLocaleDateString("fa-IR");
                      const timePart = d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });

                      return (
                        <tr key={entry.id} className={`transition-colors ${dk ? "hover:bg-slate-700/30" : "hover:bg-emerald-50/70"}`}>
                          {/* ستون ردیف با ارقام فارسی */}
                          <td className={`px-2 py-3 text-center tabular-nums font-black text-xs ${dk ? "text-slate-400" : "text-slate-500"}`}>
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${dk ? "bg-slate-700/50 text-slate-200" : "bg-slate-100 text-slate-700"}`}>
                              {toPersianDigits(String(index + 1))}
                            </span>
                          </td>
                          {/* ستون کد پیگیری فارسی (بدون تاریخ) */}
                          <td className={`px-3 py-3 text-center text-[11px] font-bold tracking-wide ${isVoided ? (dk ? "text-slate-500 line-through" : "text-slate-400 line-through") : (dk ? "text-cyan-300" : "text-cyan-700")}`}>
                            <span className={`inline-block px-2 py-1 rounded-md font-mono ${dk ? "bg-slate-700/40" : "bg-cyan-50"} whitespace-nowrap`}>
                              {entry.trackingCode}
                            </span>
                          </td>
                          {/* ستون تاریخ جداگانه */}
                          <td className={`px-3 py-3 text-center text-xs ${dk ? "text-slate-300" : "text-slate-600"}`}>{datePart}</td>
                          <td className={`px-3 py-3 text-center text-xs ${dk ? "text-slate-300" : "text-slate-600"}`}>{timePart}</td>
                          <td className={`px-3 py-3 text-right font-medium text-xs ${isVoided ? (dk ? "text-slate-500 line-through" : "text-slate-400 line-through") : (dk ? "text-slate-200" : "text-slate-800")}`}>{entry.description}</td>
                          <td className="px-3 py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black ${getBadgeColor(entry.type, isVoided)}`}>{entry.type}</span>
                          </td>
                          <td className={`px-3 py-3 text-center text-xs font-bold ${dk ? "text-slate-300" : "text-slate-600"}`}>{currencyLabels[entry.currency as Currency]}</td>
                          <td className={`px-3 py-3 text-center font-black tabular-nums text-xs ${isVoided ? (dk ? "text-slate-500 line-through" : "text-slate-400 line-through") : (entry.type === "واریز" ? "text-emerald-500" : "text-rose-500")}`}>
                            {entry.type === "واریز" ? "+" : "-"} {fmt(entry.amount)}
                          </td>
                          <td className={`px-3 py-3 text-center tabular-nums text-xs font-mono ${dk ? "text-slate-300" : "text-slate-600"}`}>{entry.balanceAfter ?? "—"}</td>
                          <td className="px-3 py-3 text-center">
                            {!isVoided ? (
                              <button onClick={() => handleVoid(entry)} disabled={voidingId === entry.id} className={`text-[10px] px-2.5 py-1 rounded-lg font-black transition disabled:opacity-50 ${dk ? "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20" : "bg-rose-50 text-rose-600 hover:bg-rose-100"}`}>
                                {voidingId === entry.id ? "..." : "ابطال"}
                              </button>
                            ) : (
                              <span className={`text-[9px] px-2 py-1 rounded font-black ${dk ? "text-slate-400 bg-slate-700/50" : "text-slate-500 bg-slate-200"}`}>باطل‌شده</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* ═══════════ راهنما ═══════════ */}
          <section className={`cs-up rounded-2xl border-2 px-5 py-4 md:py-5 ${dk ? "border-slate-700/70 bg-gradient-to-r from-slate-800/60 to-slate-900/60" : "border-slate-200 bg-gradient-to-r from-white to-slate-50"}`} style={{ animationDelay: "280ms" }}>
            <h3 className={`text-sm font-black mb-3 flex items-center ${dk ? "text-slate-200" : "text-slate-700"}`}>
              <span className={`w-2 h-2 rounded-full ml-2 ${dk ? "bg-blue-400" : "bg-blue-600"}`}></span> راهنمای کد پیگیری
            </h3>
            <ul className={`text-xs space-y-2 list-disc pr-4 ${dk ? "text-slate-400" : "text-slate-600"}`}>
              <li>هر تراکنش دارای <b className={dk ? "text-cyan-300" : "text-cyan-700"}>کد پیگیری فارسی</b> منحصربه‌فرد است. نمونه: <span className="font-mono">وار-A3F2</span></li>
              <li>
                <b>مخفف‌های فارسی:</b>{" "}
                <span className="font-mono">وار</span>=واریز،{" "}
                <span className="font-mono">برد</span>=برداشت،{" "}
                <span className="font-mono">انت</span>=انتقال،{" "}
                <span className="font-mono">تبد</span>=تبدیل،{" "}
                <span className="font-mono">هز</span>=هزینه،{" "}
                <span className="font-mono">حو</span>=حواله
              </li>
              <li>بخش دوم کد، ۴ حرف اول شناسه یکتای تراکنش است.</li>
              <li>ستون <b>تاریخ</b> و <b>کد پیگیری</b> کاملاً جدا از هم هستند.</li>
              <li>می‌توانید با کد پیگیری در بخش <b>جستجو</b> تراکنش را پیدا کنید.</li>
              <li>این روزنامه به صورت <b className={dk ? "text-slate-200" : "text-slate-800"}>آفلاین و آنلاین</b> کار می‌کند.</li>
              <li>برای ابطال حواله، به تب <b className={dk ? "text-slate-200" : "text-slate-800"}>حواله‌جات</b> مراجعه کنید.</li>
            </ul>
          </section>

          {/* ═══════════ فوتر ═══════════ */}
          <div className={`cs-up text-center py-4 text-[11px] font-bold ${subText}`} style={{ animationDelay: "350ms" }}>
            🏦 سیستم هماهنگ‌سازی هوشمند فعال است
          </div>
        </div>
      </div>
    </div>
  );
}
