"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  CUSTOMERS_KEY,
  TRANSACTIONS_KEY,
  CASH_KEY,
  loadCustomersShared,
  loadTransactionsShared,
  loadCashEntriesShared,
} from "../lib/defaultData";

// ============================================================
// Types
// ============================================================
type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";

interface Customer {
  id: string;
  name: string;
  phone?: string;
  telegram?: string;
  telegramChatId?: string;
  tazkira?: string;
  balances: Record<Currency, number>;
}

interface Transaction {
  id: string;
  trackingCode: string;
  type: "exchange" | "transfer" | "convert";
  dealType?: "buy" | "sell";
  date: string;
  customerId?: string;
  customerName?: string;
  senderId?: string;
  senderName?: string;
  receiverId?: string;
  receiverName?: string;
  fromCurrency: Currency;
  fromAmount: number;
  toCurrency: Currency;
  toAmount: number;
  rate: number;
  rateLabel: string;
  commission?: number;
  commissionCurrency?: Currency;
  description?: string;
  status: "active" | "voided";
}

interface CashEntry {
  id: string;
  trackingCode: string;
  date: string;
  type: string;
  currency: Currency;
  amount: number;
  direction: "in" | "out";
  reason?: string;
  status: "active" | "voided";
  customerName?: string;
}

// ============================================================
// Helpers
// ============================================================
const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const labels: Record<Currency, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };

const fmt = (n: number) => Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0";
const fa = (n: number) => Number.isFinite(n) ? n.toLocaleString("fa-IR", { maximumFractionDigits: 0 }) : "۰";

function normalizeDigits(s: string) {
  return String(s || "")
    .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

function shamsiParts(d: Date) {
  try {
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
      year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(d);
    const g = (t: string) => parts.find(p => p.type === t)?.value || "0";
    return { year: g("year"), month: g("month"), day: g("day") };
  } catch {
    return { year: "0", month: "0", day: "0" };
  }
}

function formatShamsiDate(d: Date) {
  const s = shamsiParts(d);
  return `${s.year}/${s.month}/${s.day}`;
}

function getDateKey(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return formatShamsiDate(d);
  } catch {
    return "نامشخص";
  }
}

function transactionTypeLabel(tx: Transaction): string {
  if (tx.type === "exchange") return tx.dealType === "buy" ? "خرید ارز" : "فروش ارز";
  if (tx.type === "transfer") return "انتقال";
  return "تبدیل ارز";
}

function transactionCustomerLabel(tx: Transaction, customers: Customer[]): string {
  const findName = (id?: string, name?: string) => {
    if (!id) return name || "-";
    if (id === "CASH_BOX") return "صندوق";
    return customers.find(c => c.id === id)?.name || name || "-";
  };
  if (tx.type === "transfer") {
    return `${findName(tx.senderId, tx.senderName)} ← ${findName(tx.receiverId, tx.receiverName)}`;
  }
  return findName(tx.customerId, tx.customerName);
}

// ============================================================
// Main Component
// ============================================================
export default function ReportsPage() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Daily journal
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  // Share modal
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareCustomer, setShareCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("fx-theme");
      if (saved === "dark" || saved === "light") setTheme(saved);
    } catch {}
    try {
      setCustomers(loadCustomersShared() as Customer[]);
      setTransactions(loadTransactionsShared() as Transaction[]);
      setCashEntries(loadCashEntriesShared() as CashEntry[]);
    } catch (err) {
      console.error("Load error:", err);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      try {
        setCustomers(loadCustomersShared() as Customer[]);
        setTransactions(loadTransactionsShared() as Transaction[]);
        setCashEntries(loadCashEntriesShared() as CashEntry[]);
      } catch {}
    };
    window.addEventListener("focus", handleFocus);
    const interval = setInterval(handleFocus, 15000);
    return () => {
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
    };
  }, []);

  const dk = theme === "dark";
  const heading = dk ? "text-white" : "text-slate-900";
  const subText = dk ? "text-slate-500" : "text-slate-400";

  // ── Search Results ──
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = normalizeDigits(searchQuery.trim()).toLowerCase();
    return customers.filter(c => {
      const name = normalizeDigits(c.name).toLowerCase();
      const phone = normalizeDigits(c.phone || "");
      const tazkira = normalizeDigits(c.tazkira || "");
      return name.includes(q) || phone.includes(q) || tazkira.includes(q);
    });
  }, [customers, searchQuery]);

  // ── Debtor Customers ──
  const debtorCustomers = useMemo(() => {
    return customers.filter(c => {
      return currencies.some(cur => (c.balances?.[cur] || 0) < 0);
    });
  }, [customers]);

  // ── Customer Transactions ──
  const getCustomerTransactions = useCallback((customerId: string) => {
    return transactions.filter(tx => {
      if (tx.status === "voided") return false;
      return tx.customerId === customerId || tx.senderId === customerId || tx.receiverId === customerId;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions]);

  // ── Daily Journal ──
  const dailyJournal = useMemo(() => {
    const days: Record<string, { transactions: Transaction[]; cashEntries: CashEntry[]; date: Date }> = {};

    // Group transactions
    for (const tx of transactions) {
      const key = getDateKey(tx.date);
      if (!days[key]) {
        days[key] = { transactions: [], cashEntries: [], date: new Date(tx.date) };
      }
      days[key].transactions.push(tx);
    }

    // Group cash entries
    for (const ce of cashEntries) {
      const key = getDateKey(ce.date);
      if (!days[key]) {
        days[key] = { transactions: [], cashEntries: [], date: new Date(ce.date) };
      }
      days[key].cashEntries.push(ce);
    }

    // Sort by date descending
    return Object.entries(days).sort(([, a], [, b]) => b.date.getTime() - a.date.getTime());
  }, [transactions, cashEntries]);

  // ── Share Functions ──
  const generateCustomerReport = useCallback((customer: Customer): string => {
    const txs = getCustomerTransactions(customer.id);
    let report = `📊 گزارش معاملات مشتری\n\n`;
    report += `👤 نام: ${customer.name}\n`;
    if (customer.phone) report += `📞 تلفن: ${customer.phone}\n`;
    if (customer.tazkira) report += `🆔 تذکره: ${customer.tazkira}\n`;
    report += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    report += `💼 موجودی حساب:\n`;
    for (const cur of currencies) {
      const bal = customer.balances?.[cur] || 0;
      if (bal !== 0) {
        const status = bal > 0 ? "طلب" : "قرض";
        report += `  • ${labels[cur]}: ${fmt(Math.abs(bal))} (${status})\n`;
      }
    }
    report += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    report += `📋 تاریخچه معاملات (${txs.length} معامله):\n\n`;
    txs.slice(0, 20).forEach((tx, i) => {
      report += `${i + 1}. ${transactionTypeLabel(tx)}\n`;
      report += `   📅 ${formatShamsiDate(new Date(tx.date))}\n`;
      report += `   💱 ${fmt(tx.fromAmount)} ${labels[tx.fromCurrency]} → ${fmt(tx.toAmount)} ${labels[tx.toCurrency]}\n`;
      if (tx.commission && tx.commission > 0) {
        report += `   💰 کارمزد: ${fmt(tx.commission)} ${labels[tx.commissionCurrency || "AFN"]}\n`;
      }
      report += `\n`;
    });
    if (txs.length > 20) {
      report += `... و ${txs.length - 20} معامله دیگر\n`;
    }
    report += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    report += `🏦 صرافی برادران نورزاد — هرات`;
    return report;
  }, [getCustomerTransactions]);

  const shareViaTelegram = useCallback((customer: Customer) => {
    const text = generateCustomerReport(customer);
    const url = `https://t.me/share/url?url=${encodeURIComponent(" ")}&text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  }, [generateCustomerReport]);

  const shareViaWhatsApp = useCallback((customer: Customer) => {
    const text = generateCustomerReport(customer);
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  }, [generateCustomerReport]);

  const shareViaImo = useCallback(async (customer: Customer) => {
    const text = generateCustomerReport(customer);
    try {
      await navigator.clipboard.writeText(text);
      alert("گزارش کپی شد! حالا می‌توانید در ایمو paste کنید.");
    } catch {
      alert("خطا در کپی گزارش");
    }
  }, [generateCustomerReport]);

  const toggleDay = useCallback((day: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-emerald-500" />
          <p className="mt-4 text-slate-500">در حال بارگذاری...</p>
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

          {/* Header */}
          <header className="cs-up flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0">
              <div className="relative grid h-11 w-11 md:h-14 md:w-14 shrink-0 place-items-center rounded-xl md:rounded-2xl bg-gradient-to-br from-blue-500 via-sky-500 to-cyan-400 text-white shadow-lg shadow-blue-500/30 ring-1 ring-white/30">
                <span className="text-2xl md:text-3xl">📊</span>
                <span className={`absolute -bottom-1 -left-1 md:-bottom-1.5 md:-left-1.5 grid h-4 min-w-4 md:h-5 md:min-w-5 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-400 px-1 text-[7px] md:text-[8px] font-black text-white ring-2 ${dk ? "ring-[#0f172a]" : "ring-[#ecfdf5]"}`}>
                  RP
                </span>
              </div>
              <div className="min-w-0">
                <h1 className={`cs-display text-2xl md:text-4xl leading-none ${heading}`}>گزارشات</h1>
                <p className={`mt-1 text-[10px] md:text-xs font-bold ${subText}`}>صرافی برادران نورزاد — هرات</p>
              </div>
            </div>
            <button
              onClick={() => setTheme(dk ? "light" : "dark")}
              className={`group grid h-10 w-10 md:h-11 md:w-11 cursor-pointer place-items-center rounded-lg md:rounded-xl border shadow-sm backdrop-blur transition-all duration-300 active:scale-90 ${dk ? "border-slate-600 bg-slate-800/85 text-amber-300 hover:border-amber-300" : "border-slate-200 bg-white/85 text-slate-600 hover:border-emerald-400"}`}
            >
              <span className="text-lg transition-transform duration-500 group-hover:rotate-12">{dk ? "☀️" : "🌙"}</span>
            </button>
          </header>

          {/* Search Section */}
          <section className={`cs-up rounded-2xl border-2 p-5 md:p-7 ${dk ? "border-blue-400/30 bg-gradient-to-br from-blue-900/40 to-slate-900/60" : "border-blue-200 bg-gradient-to-br from-blue-50 to-white"}`}>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🔍</span>
              <div>
                <h2 className={`cs-display text-xl md:text-2xl ${heading}`}>جستجوی مشتری</h2>
                <p className={`text-[10px] md:text-xs font-bold ${subText}`}>بر اساس نام، تلفن یا شماره تذکره</p>
              </div>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="نام، تلفن یا شماره تذکره را وارد کنید..."
              className={`w-full h-14 px-5 rounded-xl border text-sm font-medium shadow-sm outline-none transition-all ${dk ? "border-slate-600 bg-slate-800 text-white placeholder:text-slate-500 focus:border-blue-400" : "border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-blue-500"}`}
            />

            {searchQuery && (
              <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
                {searchResults.length === 0 ? (
                  <div className={`text-center py-8 ${subText}`}>
                    <span className="text-4xl mb-2 block">🔍</span>
                    <p>مشتری‌ای یافت نشد</p>
                  </div>
                ) : (
                  searchResults.map(c => (
                    <div key={c.id} className={`flex items-center justify-between p-4 rounded-xl border ${dk ? "border-slate-700 bg-slate-800/50 hover:bg-slate-800" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                      <div className="flex-1 min-w-0">
                        <b className={`block text-sm font-black ${dk ? "text-white" : "text-slate-900"}`}>{c.name}</b>
                        <div className={`flex flex-wrap gap-3 mt-1 text-[11px] ${subText}`}>
                          {c.phone && <span>📞 {c.phone}</span>}
                          {c.tazkira && <span>🆔 {c.tazkira}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setSelectedCustomer(c)} className={`px-4 py-2 rounded-lg text-xs font-black ${dk ? "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30" : "bg-blue-100 text-blue-700 hover:bg-blue-200"}`}>
                          مشاهده
                        </button>
                        <button onClick={() => { setShareCustomer(c); setShareModalOpen(true); }} className={`px-4 py-2 rounded-lg text-xs font-black ${dk ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"}`}>
                          اشتراک
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>

          {/* Debtor Customers */}
          <section className={`cs-up rounded-2xl border-2 p-5 md:p-7 ${dk ? "border-rose-400/30 bg-gradient-to-br from-rose-900/40 to-slate-900/60" : "border-rose-200 bg-gradient-to-br from-rose-50 to-white"}`}>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">💰</span>
              <div>
                <h2 className={`cs-display text-xl md:text-2xl ${heading}`}>مشتریان بدهکار</h2>
                <p className={`text-[10px] md:text-xs font-bold ${subText}`}>{fa(debtorCustomers.length)} مشتری دارای بدهی</p>
              </div>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {debtorCustomers.length === 0 ? (
                <div className={`text-center py-8 ${subText}`}>
                  <span className="text-4xl mb-2 block">✅</span>
                  <p>هیچ مشتری بدهکاری وجود ندارد</p>
                </div>
              ) : (
                debtorCustomers.map(c => {
                  const debts = currencies.filter(cur => (c.balances?.[cur] || 0) < 0);
                  const totalDebtAFN = debts.reduce((sum, cur) => {
                    const bal = Math.abs(c.balances?.[cur] || 0);
                    return sum + (cur === "AFN" ? bal : 0);
                  }, 0);

                  return (
                    <div key={c.id} className={`p-4 rounded-xl border ${dk ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-white"}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <b className={`block text-sm font-black ${dk ? "text-white" : "text-slate-900"}`}>{c.name}</b>
                          <div className={`flex flex-wrap gap-3 mt-1 text-[11px] ${subText}`}>
                            {c.phone && <span>📞 {c.phone}</span>}
                            {c.tazkira && <span>🆔 {c.tazkira}</span>}
                          </div>
                          <div className="mt-3 space-y-1">
                            {debts.map(cur => (
                              <div key={cur} className="flex items-center justify-between text-xs">
                                <span className={subText}>{labels[cur]}</span>
                                <span className={`font-black tabular-nums text-rose-500`}>{fmt(Math.abs(c.balances?.[cur] || 0))}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <button onClick={() => { setShareCustomer(c); setShareModalOpen(true); }} className={`shrink-0 px-4 py-2 rounded-lg text-xs font-black ${dk ? "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30" : "bg-rose-100 text-rose-700 hover:bg-rose-200"}`}>
                          ارسال گزارش
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Daily Journal */}
          <section className={`cs-up rounded-2xl border-2 p-5 md:p-7 ${dk ? "border-emerald-400/30 bg-gradient-to-br from-emerald-900/40 to-slate-900/60" : "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white"}`}>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">📅</span>
              <div>
                <h2 className={`cs-display text-xl md:text-2xl ${heading}`}>روزنامچه عمومی</h2>
                <p className={`text-[10px] md:text-xs font-bold ${subText}`}>{fa(dailyJournal.length)} روز ثبت‌شده</p>
              </div>
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {dailyJournal.map(([day, data]) => {
                const isExpanded = expandedDays.has(day);
                const txCount = data.transactions.length;
                const cashCount = data.cashEntries.length;
                const totalCommission = data.transactions.reduce((sum, tx) => sum + (tx.commission || 0), 0);

                return (
                  <div key={day} className={`rounded-xl border overflow-hidden ${dk ? "border-slate-700" : "border-slate-200"}`}>
                    <button onClick={() => toggleDay(day)} className={`w-full flex items-center justify-between p-4 transition-colors ${dk ? "bg-slate-800/50 hover:bg-slate-800" : "bg-white hover:bg-slate-50"}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-xl">📆</span>
                        <div className="text-right">
                          <b className={`block text-sm font-black ${dk ? "text-white" : "text-slate-900"}`}>{day}</b>
                          <div className={`flex gap-3 mt-1 text-[10px] ${subText}`}>
                            <span>{fa(txCount)} معامله</span>
                            <span>{fa(cashCount)} سند صندوق</span>
                            {totalCommission > 0 && <span className={dk ? "text-amber-300" : "text-amber-600"}>💰 {fmt(totalCommission)}</span>}
                          </div>
                        </div>
                      </div>
                      <span className={`text-xl transition-transform ${isExpanded ? "rotate-180" : ""}`}>⌄</span>
                    </button>

                    {isExpanded && (
                      <div className={`p-4 space-y-3 border-t ${dk ? "border-slate-700 bg-slate-900/50" : "border-slate-200 bg-slate-50"}`}>
                        {data.transactions.length > 0 && (
                          <div>
                            <b className={`block text-xs font-black mb-2 ${dk ? "text-blue-300" : "text-blue-600"}`}>معاملات:</b>
                            <div className="space-y-1">
                              {data.transactions.map(tx => (
                                <div key={tx.id} className={`flex items-center justify-between p-2 rounded-lg text-xs ${dk ? "bg-slate-800/50" : "bg-white"}`}>
                                  <span>{transactionTypeLabel(tx)}</span>
                                  <span className={subText}>{transactionCustomerLabel(tx, customers)}</span>
                                  <span className="font-black tabular-nums">{fmt(tx.fromAmount)} {labels[tx.fromCurrency]}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {data.cashEntries.length > 0 && (
                          <div>
                            <b className={`block text-xs font-black mb-2 ${dk ? "text-emerald-300" : "text-emerald-600"}`}>اسناد صندوق:</b>
                            <div className="space-y-1">
                              {data.cashEntries.map(ce => (
                                <div key={ce.id} className={`flex items-center justify-between p-2 rounded-lg text-xs ${dk ? "bg-slate-800/50" : "bg-white"}`}>
                                  <span>{ce.reason || ce.type}</span>
                                  <span className={`font-black tabular-nums ${ce.direction === "in" ? "text-emerald-500" : "text-rose-500"}`}>
                                    {ce.direction === "in" ? "+" : "-"} {fmt(ce.amount)} {labels[ce.currency]}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

        </div>
      </div>

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3" onClick={() => setSelectedCustomer(null)}>
          <div className={`w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border shadow-2xl ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-white"}`} onClick={e => e.stopPropagation()}>
            <div className={`sticky top-0 flex items-center justify-between border-b px-4 py-3 ${dk ? "border-slate-700 bg-slate-900" : "border-slate-100 bg-white"}`}>
              <b className={`text-sm ${dk ? "text-slate-100" : "text-slate-800"}`}>جزئیات مشتری</b>
              <button onClick={() => setSelectedCustomer(null)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400">✕</button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <b className={`block text-lg font-black ${dk ? "text-white" : "text-slate-900"}`}>{selectedCustomer.name}</b>
                <div className={`flex flex-wrap gap-3 mt-2 text-xs ${subText}`}>
                  {selectedCustomer.phone && <span>📞 {selectedCustomer.phone}</span>}
                  {selectedCustomer.tazkira && <span>🆔 {selectedCustomer.tazkira}</span>}
                  {selectedCustomer.telegram && <span>📱 {selectedCustomer.telegram}</span>}
                </div>
              </div>

              <div>
                <b className={`block text-sm font-black mb-2 ${dk ? "text-emerald-300" : "text-emerald-600"}`}>موجودی حساب:</b>
                <div className="grid grid-cols-2 gap-2">
                  {currencies.map(cur => {
                    const bal = selectedCustomer.balances?.[cur] || 0;
                    return (
                      <div key={cur} className={`p-3 rounded-lg ${dk ? "bg-slate-800/50" : "bg-slate-100"}`}>
                        <div className={`text-[10px] ${subText}`}>{labels[cur]}</div>
                        <div className={`text-sm font-black tabular-nums ${bal > 0 ? "text-emerald-500" : bal < 0 ? "text-rose-500" : subText}`}>
                          {fmt(bal)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <b className={`block text-sm font-black mb-2 ${dk ? "text-blue-300" : "text-blue-600"}`}>تاریخچه معاملات:</b>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {getCustomerTransactions(selectedCustomer.id).map(tx => (
                    <div key={tx.id} className={`p-3 rounded-lg text-xs ${dk ? "bg-slate-800/50" : "bg-slate-100"}`}>
                      <div className="flex items-center justify-between mb-1">
                        <b>{transactionTypeLabel(tx)}</b>
                        <span className={subText}>{formatShamsiDate(new Date(tx.date))}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{fmt(tx.fromAmount)} {labels[tx.fromCurrency]}</span>
                        <span>→</span>
                        <span>{fmt(tx.toAmount)} {labels[tx.toCurrency]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={() => { setShareCustomer(selectedCustomer); setShareModalOpen(true); }} className={`w-full py-3 rounded-xl text-sm font-black ${dk ? "bg-emerald-500 text-white hover:bg-emerald-600" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}>
                اشتراک‌گذاری گزارش
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareModalOpen && shareCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3" onClick={() => setShareModalOpen(false)}>
          <div className={`w-full max-w-md rounded-xl border shadow-2xl ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-white"}`} onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between border-b px-4 py-3 ${dk ? "border-slate-700" : "border-slate-100"}`}>
              <b className={`text-sm ${dk ? "text-slate-100" : "text-slate-800"}`}>اشتراک‌گذاری گزارش</b>
              <button onClick={() => setShareModalOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <p className={`text-xs ${subText}`}>گزارش معاملات {shareCustomer.name} را از طریق کدام پلتفرم ارسال کنید؟</p>
              <button onClick={() => { shareViaTelegram(shareCustomer); setShareModalOpen(false); }} className={`w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 ${dk ? "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30" : "bg-blue-100 text-blue-700 hover:bg-blue-200"}`}>
                <span className="text-xl">📱</span> تلگرام
              </button>
              <button onClick={() => { shareViaWhatsApp(shareCustomer); setShareModalOpen(false); }} className={`w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 ${dk ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"}`}>
                <span className="text-xl">💬</span> واتساپ
              </button>
              <button onClick={() => { shareViaImo(shareCustomer); setShareModalOpen(false); }} className={`w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 ${dk ? "bg-violet-500/20 text-violet-300 hover:bg-violet-500/30" : "bg-violet-100 text-violet-700 hover:bg-violet-200"}`}>
                <span className="text-xl">📨</span> ایمو (کپی در کلیپ‌بورد)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
