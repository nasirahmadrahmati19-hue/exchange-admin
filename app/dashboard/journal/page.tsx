"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSafeSyncedState } from "../lib/useSafeSyncedState";
import { 
  CUSTOMERS_KEY, 
  TRANSACTIONS_KEY, 
  HAWALAS_KEY, 
  CASH_KEY 
} from "../lib/defaultData";

type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";
const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const currencyLabels: Record<Currency, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };
const currencyIcons: Record<Currency, string> = { AFN: "؋", USD: "$", EUR: "€", IRR: "", PKR: "₨" };
const currencyColors: Record<Currency, { from: string; to: string; text: string; bg: string }> = {
  AFN: { from: "from-emerald-400", to: "to-teal-500", text: "text-emerald-400", bg: "bg-emerald-400/20" },
  USD: { from: "from-blue-400", to: "to-cyan-500", text: "text-blue-400", bg: "bg-blue-400/20" },
  EUR: { from: "from-purple-400", to: "to-pink-500", text: "text-purple-400", bg: "bg-purple-400/20" },
  IRR: { from: "from-amber-400", to: "to-orange-500", text: "text-amber-400", bg: "bg-amber-400/20" },
  PKR: { from: "from-rose-400", to: "to-red-500", text: "text-rose-400", bg: "bg-rose-400/20" }
};

type TxType = "واریز" | "برداشت" | "انتقال" | "تبدیل" | "هزینه" | "حواله" | "سایر";
type SortField = "date" | "amount" | "partyName" | "type" | "trackingCode";
type SortDirection = "asc" | "desc";

interface Customer {
  id: string; 
  name: string; 
  fullName?: string; 
  customerName?: string; 
  title?: string;
  phone?: string; 
  tazkira?: string; 
  address?: string;
  note?: string; 
  telegram?: string; 
  telegramChatId?: string; 
  registeredAt: string;
  balances: Record<Currency, number>;
}

interface Transaction {
  id: string; trackingCode: string; type: string;
  dealType?: "buy" | "sell"; date: string; customerId?: string; customerName?: string;
  senderId?: string; senderName?: string; receiverId?: string; receiverName?: string;
  fromCurrency: Currency; fromAmount: number; toCurrency: Currency; toAmount: number;
  rate: number; rateLabel: string; rateBase?: Currency; commission?: number;
  commissionCurrency?: Currency; commissionPayer?: "sender" | "receiver";
  description?: string; status: "active" | "voided"; profit?: number; profitCurrency?: Currency;
  voidedReason?: string;
  balanceAfter?: number;
  fee?: number;
}

interface Hawala {
  id: string; number: string; date: string; time: string; type: string;
  destinationCountry: string; province: string; district: string; destinationText: string;
  currencyFrom: Currency; currencyTo: Currency; amountFrom: number; rate: number;
  rateLabel: string; rateBase?: Currency; fee: number; feeCurrency: Currency;
  feePayer: "sender" | "receiver"; finalAmount: number; balance: string; note: string;
  profit: number; profitCurrency: Currency; senderId?: string; senderName: string;
  senderPhone: string; senderTelegram: string; receiverId?: string; receiverName: string;
  receiverTazkira: string; receiverPhone: string; receiverAddress: string;
  status: "pending" | "sent" | "paid" | "cancelled"; paidAt?: string; paidBy?: string;
  paidAmount?: number; cancelReason?: string;
  trackingCode?: string;
}

interface CashEntry {
  id: string; trackingCode: string; date: string; type: string; currency: Currency;
  amount: number; direction: "in" | "out"; status: "active" | "voided";
  customerId?: string; 
  customerName?: string; 
  linkedHawalaId?: string;
  linkedExchangeId?: string; linkedTransferId?: string; linkedConvertId?: string; linkedHawalaSettleId?: string;
  reason?: string; balanceAfter?: number; fee?: number; voidedReason?: string;
}

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
  trackingCode: string;
  fee?: number;
}

const fmt = (n: number) => Number.isFinite(n) ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00";
const toPersianDigits = (s: string): string => s.replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[parseInt(d)]);

const getShamsiYear = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "1403";
    const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric" }).formatToParts(d);
    const y = parts.find(p => p.type === "year")?.value || "1403";
    return y.replace(/[۰-۹]/g, c => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)));
  } catch { return "1403"; }
};

const normalizeTrackingCode = (originalCode: string | undefined, source: "transaction" | "hawala" | "cash", date: string, index: number): string => {
  const prefix = { "transaction": "TR", "hawala": "HW", "cash": "CS" }[source];
  const year = getShamsiYear(date);
  if (originalCode && originalCode.trim()) {
    if (/^[A-Z]{2}-\d{4}-\d+$/.test(originalCode)) return originalCode;
    const numberMatch = originalCode.match(/(\d+)$/);
    if (numberMatch) return `${prefix}-${year}-${numberMatch[1].padStart(5, "0")}`;
  }
  return `${prefix}-${year}-${String(index + 1).padStart(5, "0")}`;
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
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedEntry, setSelectedEntry] = useState<UnifiedJournalEntry | null>(null);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOffline(!navigator.onLine);
    }
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    try {
      const saved = window.localStorage.getItem("fx-theme");
      if (saved === "dark" || saved === "light") setTheme(saved);
    } catch {}
    setMounted(true);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // ✅ سازگاری ۱۰۰٪ با هوک جدید useSafeSyncedState (بازگشت ۴ مقداری)
  // [0]: data, [1]: setSafeValue, [2]: isLoading, [3]: actions object
  const txState = useSafeSyncedState<Transaction>(TRANSACTIONS_KEY, []);
  const transactions = txState[0];
  const isTxLoading = txState[2];
  const txActions = txState[3];

  const hwState = useSafeSyncedState<Hawala>(HAWALAS_KEY, []);
  const hawalas = hwState[0];
  const isHawalaLoading = hwState[2];
  const hawalaActions = hwState[3];

  const ceState = useSafeSyncedState<CashEntry>(CASH_KEY, []);
  const cashEntries = ceState[0];
  const isCashLoading = ceState[2];
  const cashActions = ceState[3];

  const custState = useSafeSyncedState<Customer>(CUSTOMERS_KEY, []);
  const customers = custState[0];

  const isLoading = (isTxLoading && transactions.length === 0) || 
                    (isHawalaLoading && hawalas.length === 0) || 
                    (isCashLoading && cashEntries.length === 0);

  const dk = theme === "dark";
  const heading = dk ? "text-white" : "text-slate-900";
  const subText = dk ? "text-slate-400" : "text-slate-500";
  const uiCard = dk
    ? "border-slate-700 bg-slate-800/90 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.6)]"
    : "border-emerald-100 bg-white/95 shadow-[0_16px_40px_-28px_rgba(16,185,129,0.35)]";

  const customerMap = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach((c) => {
      if (c && c.id) {
        const name = c.name || c.fullName || c.customerName || c.title || "";
        if (name && name.trim()) map.set(c.id, name.trim());
      }
    });
    return map;
  }, [customers]);

  const resolveCustomerName = (name?: string, id?: string): string => {
    if (name && name.trim() && name !== "مشتری" && name !== "صندوق" && name !== "—") return name.trim();
    if (id && customerMap.has(id)) return customerMap.get(id)!;
    if (name && name.trim()) return name.trim();
    return "نامشخص";
  };

  const unifiedEntries = useMemo<UnifiedJournalEntry[]>(() => {
    const entries: Omit<UnifiedJournalEntry, "trackingCode">[] = [];
    
    // 1. پردازش تراکنش‌ها با پشتیبان (Fallback) برای جلوگیری از حذف ناخواسته
    transactions.forEach((tx) => {
      if (!tx || !tx.id) return;
      
      const txType = (tx.type || "").toLowerCase();
      const status = tx.status || "active";

      if (txType === "exchange" || txType === "convert") {
        const partyName = resolveCustomerName(tx.customerName, tx.customerId);
        const desc = `معاوضه: ${tx.fromCurrency} به ${tx.toCurrency}`;
        
        entries.push({
          id: `${tx.id}-out`,
          date: tx.date,
          type: "برداشت",
          description: `${desc} (پرداخت)`,
          partyName,
          partyId: tx.customerId,
          currency: tx.fromCurrency,
          amount: tx.fromAmount,
          status,
          voidedReason: tx.voidedReason,
          source: "transaction",
          sourceId: tx.id,
          fee: tx.fee || 0
        });

        entries.push({
          id: `${tx.id}-in`,
          date: tx.date,
          type: "واریز",
          description: `${desc} (دریافت)`,
          partyName,
          partyId: tx.customerId,
          currency: tx.toCurrency,
          amount: tx.toAmount,
          status,
          voidedReason: tx.voidedReason,
          source: "transaction",
          sourceId: tx.id,
          fee: 0
        });
      } else if (txType === "transfer") {
        const sender = resolveCustomerName(tx.senderName, tx.senderId);
        const receiver = resolveCustomerName(tx.receiverName, tx.receiverId);
        entries.push({
          id: tx.id, 
          date: tx.date, 
          type: "انتقال",
          description: `انتقال از ${sender} به ${receiver}`,
          partyName: `${sender} ← ${receiver}`,
          partyId: tx.senderId,
          currency: tx.fromCurrency,
          amount: tx.fromAmount,
          status,
          voidedReason: tx.voidedReason,
          source: "transaction",
          sourceId: tx.id,
          fee: tx.fee || 0
        });
      } else {
        // ✅ پشتیبان: اگر نوع تراکنش ناشناخته بود، آن را به عنوان "سایر" ثبت کن تا گم نشود
        const partyName = resolveCustomerName(tx.customerName, tx.customerId);
        entries.push({
          id: tx.id,
          date: tx.date,
          type: "سایر",
          description: tx.description || `عملیات ${tx.type || "نامشخص"}`,
          partyName,
          partyId: tx.customerId,
          currency: tx.fromCurrency,
          amount: tx.fromAmount,
          status,
          voidedReason: tx.voidedReason,
          source: "transaction",
          sourceId: tx.id,
          fee: tx.fee || 0
        });
      }
    });
    
    // 2. پردازش حواله‌جات
    hawalas.forEach((h) => {
      if (h.status === "cancelled") return;
      const senderName = resolveCustomerName(h.senderName, h.senderId);
      entries.push({
        id: h.id, date: h.date, type: "حواله",
        description: `حواله به ${h.receiverName || "—"} (${h.destinationText || ""})`,
        partyName: senderName, partyId: h.senderId, currency: h.currencyFrom,
        amount: h.amountFrom, status: "active", source: "hawala", sourceId: h.id,
        fee: h.fee || 0
      });
      if (h.status === "paid") {
        const receiverName = resolveCustomerName(h.receiverName, h.receiverId);
        entries.push({
          id: `${h.id}-paid`, date: h.paidAt || h.date, type: "واریز",
          description: `تسویه حواله از ${senderName}`, partyName: receiverName,
          partyId: h.receiverId, currency: h.currencyTo, amount: h.finalAmount,
          status: "active", source: "hawala", sourceId: h.id, fee: 0
        });
      }
    });
    
    // 3. پردازش صندوق
    cashEntries.forEach((ce) => {
      if (!ce || ce.status === "voided") return;
      if (ce.linkedExchangeId || ce.linkedTransferId || ce.linkedConvertId || ce.linkedHawalaId || ce.linkedHawalaSettleId) return;
      
      let type: TxType = "هزینه";
      if (ce.type === "customer_deposit" || ce.type === "owner_deposit") type = "واریز";
      else if (ce.type === "customer_withdraw" || ce.type === "owner_withdraw") type = "برداشت";
      else if (ce.type === "loan_given" || ce.type === "loan_received") type = "انتقال";
      else if (ce.type === "fee" || ce.type === "commission_withdraw") type = "هزینه";
      else if (ce.type === "adjustment") type = "برداشت";
      
      const partyName = ce.customerId ? resolveCustomerName(ce.customerName, ce.customerId) : (ce.customerName && ce.customerName.trim() ? ce.customerName : "صندوق");
      entries.push({
        id: ce.id, date: ce.date || new Date().toISOString(), type,
        description: ce.reason || ce.type || "عملیات صندوق",
        partyName, partyId: ce.customerId, currency: ce.currency,
        amount: Number(ce.amount) || 0, balanceAfter: ce.balanceAfter,
        status: ce.status || "active", source: "cash", sourceId: ce.id,
        fee: ce.fee || 0
      });
    });
    
    entries.sort((a, b) => {
      const timeA = new Date(a.date).getTime() || 0;
      const timeB = new Date(b.date).getTime() || 0;
      return timeA - timeB;
    });
    
    const entriesWithCode: UnifiedJournalEntry[] = entries.map((entry, index) => {
      let rawCode = "";
      if (entry.source === "transaction") {
        const tx = transactions.find(t => t.id === entry.sourceId);
        rawCode = tx?.trackingCode || "";
      } else if (entry.source === "hawala") {
        const h = hawalas.find(h => h.id === entry.sourceId);
        rawCode = h?.trackingCode || h?.number || "";
      } else {
        const c = cashEntries.find(c => c.id === entry.sourceId);
        rawCode = c?.trackingCode || "";
      }

      return {
        ...entry,
        trackingCode: normalizeTrackingCode(rawCode, entry.source, entry.date, index)
      };
    });
    
    return entriesWithCode.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, hawalas, cashEntries, customerMap]);

  // ✅ ایمن‌سازی فیلتر نوع برای جلوگیری از حذف ناخواسته به دلیل مقادیر نامعتبر در URL
  const validTypes: TxType[] = ["واریز", "برداشت", "انتقال", "تبدیل", "هزینه", "حواله", "سایر"];
  const safeTypeFilter = validTypes.includes(typeFilter as TxType) ? typeFilter : "all";

  const filteredEntries = useMemo(() => {
    return unifiedEntries.filter((e) => {
      if (e.status === "voided" && !e.voidedReason) return false;
      if (safeTypeFilter !== "all" && e.type !== safeTypeFilter) return false;
      if (currencyFilter !== "all" && e.currency !== currencyFilter) return false;
      
      if (dateFrom) {
        const dFrom = new Date(dateFrom);
        dFrom.setHours(0, 0, 0, 0);
        const dEntry = new Date(e.date);
        if (isNaN(dEntry.getTime()) || dEntry < dFrom) return false;
      }
      if (dateTo) {
        const dTo = new Date(dateTo);
        dTo.setHours(23, 59, 59, 999);
        const dEntry = new Date(e.date);
        if (isNaN(dEntry.getTime()) || dEntry > dTo) return false;
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          (e.description && e.description.toLowerCase().includes(q)) || 
          (e.partyName && e.partyName.toLowerCase().includes(q)) || 
          e.id.toLowerCase().includes(q) || 
          (e.trackingCode && e.trackingCode.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [unifiedEntries, dateFrom, dateTo, safeTypeFilter, currencyFilter, searchQuery]);

  const sortedEntries = useMemo(() => {
    const sorted = [...filteredEntries];
    sorted.sort((a, b) => {
      let comparison = 0;
      if (sortField === "date") comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      else if (sortField === "amount") comparison = a.amount - b.amount;
      else if (sortField === "partyName") comparison = a.partyName.localeCompare(b.partyName);
      else if (sortField === "type") comparison = a.type.localeCompare(b.type);
      else if (sortField === "trackingCode") comparison = a.trackingCode.localeCompare(b.trackingCode);
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [filteredEntries, sortField, sortDirection]);

  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedEntries.slice(start, start + itemsPerPage);
  }, [sortedEntries, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedEntries.length / itemsPerPage);

  const currentBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    currencies.forEach(curr => { balances[curr] = 0; });
    unifiedEntries.forEach((e) => {
      if (e.status === "voided" || !balances.hasOwnProperty(e.currency)) return;
      if (e.type === "واریز") balances[e.currency] += e.amount;
      else if (e.type === "برداشت" || e.type === "هزینه" || e.type === "حواله") balances[e.currency] -= e.amount;
    });
    return balances;
  }, [unifiedEntries]);

  const profitLoss = useMemo(() => {
    let totalFees = 0;
    let totalExpenses = 0;
    
    transactions.forEach(tx => {
      if (tx.status !== "voided" && tx.fee) totalFees += tx.fee;
    });
    hawalas.forEach(h => {
      if (h.status !== "cancelled" && h.fee) totalFees += h.fee;
    });

    filteredEntries.forEach((e) => {
      if (e.status === "voided") return;
      if (e.type === "هزینه") totalExpenses += e.amount;
    });

    return { 
      totalFees, 
      totalExpenses, 
      netProfit: totalFees - totalExpenses 
    };
  }, [filteredEntries, transactions, hawalas]);

  const summary = useMemo(() => {
    let count = 0;
    filteredEntries.forEach((e) => { if (e.status !== "voided") count++; });
    return { count };
  }, [filteredEntries]);

  const currencyPeriodSummary = useMemo(() => {
    const summary: Record<string, { volume: number; net: number }> = {};
    currencies.forEach(curr => { summary[curr] = { volume: 0, net: 0 }; });
    filteredEntries.forEach((e) => {
      if (e.status === "voided" || !summary[e.currency]) return;
      summary[e.currency].volume += e.amount;
      if (e.type === "واریز") summary[e.currency].net += e.amount;
      else if (e.type === "برداشت" || e.type === "هزینه" || e.type === "حواله") summary[e.currency].net -= e.amount;
    });
    return summary;
  }, [filteredEntries]);

  const handleVoid = async (entry: UnifiedJournalEntry) => {
    const reason = prompt("دلیل ابطال این تراکنش را وارد کنید:");
    if (!reason || !reason.trim()) return;
    
    setVoidingId(entry.id);
    try {
      if (entry.source === "transaction") {
        // ✅ استفاده صحیح از متد updateItem هوک جدید
        await txActions.updateItem(entry.sourceId, { 
          status: "voided", 
          voidedReason: reason 
        });
      } else if (entry.source === "cash") {
        await cashActions.updateItem(entry.sourceId, { 
          status: "voided", 
          voidedReason: reason 
        });
      } else {
        alert("برای ابطال حواله، لطفاً به تب حواله‌جات مراجعه کنید و از آنجا اقدام به لغو نمایید.");
        return;
      }
    } catch (err) {
      console.error("خطا در ابطال:", err);
      alert("خطا در ابطال تراکنش. لطفاً اتصال اینترنت خود را بررسی کنید.");
    } finally { 
      setVoidingId(null); 
    }
  };

  const handleExport = () => {
    const headers = ["ردیف", "کد پیگیری", "تاریخ", "ساعت", "مشتری/طرف حساب", "شرح", "نوع", "ارز", "مبلغ", "تراز بعد"];
    const escapeCsv = (val: any) => `"${String(val ?? "").replace(/"/g, '""')}"`;
    const rows = sortedEntries.map((e, index) => {
      const d = new Date(e.date);
      return [
        toPersianDigits(String(index + 1)), escapeCsv(e.trackingCode),
        escapeCsv(d.toLocaleDateString("fa-IR")), escapeCsv(d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })),
        escapeCsv(e.partyName || "—"), escapeCsv(e.description), escapeCsv(e.type), escapeCsv(currencyLabels[e.currency as Currency]),
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

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDirection("desc"); }
  };

  const getBadgeColor = (type: TxType, isVoided: boolean) => {
    if (isVoided) return "bg-slate-700/50 text-slate-400 line-through";
    const styles: Record<TxType, string> = {
      "واریز": "bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border border-emerald-500/30",
      "برداشت": "bg-gradient-to-r from-rose-500/20 to-pink-500/20 text-rose-300 border border-rose-500/30",
      "انتقال": "bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-300 border border-blue-500/30",
      "تبدیل": "bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/30",
      "هزینه": "bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border border-purple-500/30",
      "حواله": "bg-gradient-to-r from-sky-500/20 to-cyan-500/20 text-sky-300 border border-sky-500/30",
      "سایر": "bg-gradient-to-r from-slate-500/20 to-gray-500/20 text-slate-300 border border-slate-500/30"
    };
    return styles[type] || "bg-slate-600 text-slate-200";
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className="inline-block mr-1 text-[9px] opacity-60">
      {sortField === field ? (sortDirection === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );

  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a]" dir="rtl">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-500" />
          <p className="mt-4 text-slate-400 font-sans">در حال همگام‌سازی هوشمند داده‌ها...</p>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className={dk ? "dark" : ""}>
      <style>{`@import url("https://fonts.googleapis.com/css2?family=Lalezar&family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap");.cs-font{font-family:"Vazirmatn","Segoe UI",Tahoma,sans-serif}.cs-display{font-family:"Lalezar","Vazirmatn",Tahoma,sans-serif;letter-spacing:.01em}.dark{color-scheme:dark}@keyframes csUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}.cs-up{animation:csUp .5s cubic-bezier(.22,.8,.35,1) both}::selection{background:rgba(16,185,129,.25)}@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}.shimmer{background:linear-gradient(90deg,transparent,rgba(255,255,255,.08),transparent);background-size:200% 100%;animation:shimmer 3s infinite}@keyframes pulse-glow{0%,100%{box-shadow:0 0 20px rgba(16,185,129,.3)}50%{box-shadow:0 0 30px rgba(16,185,129,.5)}}.pulse-glow{animation:pulse-glow 2s infinite}`}</style>

      <div className={`cs-font relative min-h-screen overflow-x-hidden antialiased transition-colors duration-500 ${dk ? "bg-[#0f172a] text-slate-100" : "bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 text-slate-800"}`}>
        <div className={`fixed inset-x-0 top-0 z-30 h-1 bg-gradient-to-l ${dk ? "from-emerald-400 via-teal-400 to-cyan-400" : "from-emerald-500 via-teal-500 to-cyan-500"}`} />

        <div className="relative z-10 mx-auto w-full max-w-7xl space-y-4 md:space-y-6 px-3 pb-16 pt-5 md:px-8 md:pt-9">

          {isOffline && (
            <div className="cs-up flex items-center justify-center gap-2 bg-amber-500/20 border border-amber-500/50 text-amber-300 dark:text-amber-400 px-4 py-2.5 rounded-xl text-sm font-bold mb-4 shadow-lg shadow-amber-500/10 backdrop-blur-sm">
              <span className="text-lg animate-pulse">📡</span>
              <span>شما در حالت آفلاین هستید. تغییرات ذخیره شده و به محض اتصال اینترنت به صورت خودکار همگام‌سازی می‌شوند.</span>
            </div>
          )}

          <header className="cs-up flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0">
              <div className="relative grid h-11 w-11 md:h-14 md:w-14 shrink-0 place-items-center rounded-xl md:rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-400 text-white shadow-lg shadow-emerald-500/30 ring-1 ring-white/30">
                <span className="text-2xl md:text-3xl">📋</span>
                <span className={`absolute -bottom-1 -left-1 md:-bottom-1.5 md:-left-1.5 grid h-4 min-w-4 md:h-5 md:min-w-5 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-400 px-1 text-[7px] md:text-[8px] font-black text-white ring-2 ${dk ? "ring-[#0f172a]" : "ring-[#ecfdf5]"}`}>JR</span>
              </div>
              <div className="min-w-0">
                <h1 className={`cs-display text-2xl md:text-4xl leading-none ${heading}`}>روزنامه کل معاملات</h1>
                <p className={`mt-1 text-[10px] md:text-xs font-bold ${subText}`}>
                  نمای یکپارچه و حسابرسی‌پذیر از تمام تب‌های سیستم
                  <span className="mx-2 opacity-50">|</span>
                  {/* ✅ نشانگر عیب‌یابی زنده: اگر این اعداد ۰ باشند، مشکل از نام کالکشن‌ها در Firebase است */}
                  <span className="font-mono text-[9px] md:text-[10px] bg-slate-500/10 px-1.5 py-0.5 rounded">
                    TX: {transactions.length} | HW: {hawalas.length} | CS: {cashEntries.length} | Cust: {customers.length}
                  </span>
                </p>
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

          {/* بخش‌های نمایشی (موجودی، سود/زیان، فیلترها و جدول) دقیقاً مانند قبل حفظ شده‌اند */}
          <section className="cs-up" style={{ animationDelay: "50ms" }}>
            <div className={`relative overflow-hidden rounded-2xl md:rounded-3xl border-2 p-5 md:p-6 transition-all duration-300 ${dk ? "border-emerald-400/30 bg-gradient-to-br from-emerald-900/30 via-slate-900/60 to-teal-900/30" : "border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50"}`}>
              <div className="relative flex items-center gap-3 mb-4">
                <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl shadow-md ${dk ? "bg-gradient-to-br from-emerald-400 to-teal-400 text-slate-950" : "bg-gradient-to-br from-emerald-500 to-teal-500 text-white"}`}>
                  <span className="text-xl">💰</span>
                </div>
                <div>
                  <h2 className={`cs-display text-xl md:text-2xl leading-none ${heading}`}>موجودی لحظه‌ای صندوق</h2>
                  <p className={`mt-0.5 text-[10px] md:text-xs font-bold ${subText}`}>موجودی فعلی هر ارز در سیستم (هماهنگ با صفحه صندوق)</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {currencies.map((curr) => {
                  const balance = currentBalances[curr];
                  const colors = currencyColors[curr];
                  return (
                    <div key={curr} className={`relative overflow-hidden rounded-xl p-4 border transition-all duration-300 hover:scale-[1.03] hover:-translate-y-0.5 ${dk ? "border-slate-700 bg-slate-900/50 hover:border-emerald-400/50" : "border-slate-200 bg-white/80 hover:border-emerald-400"}`}>
                      <div className="relative">
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs font-black ${dk ? "text-slate-300" : "text-slate-600"}`}>{currencyLabels[curr]}</span>
                          <span className={`text-lg font-black bg-gradient-to-br ${colors.from} ${colors.to} bg-clip-text text-transparent`}>{currencyIcons[curr]}</span>
                        </div>
                        <div className={`text-xl md:text-2xl font-black tabular-nums ${balance >= 0 ? (dk ? "text-emerald-300" : "text-emerald-700") : (dk ? "text-rose-400" : "text-rose-600")}`}>
                          {fmt(balance)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className={`cs-up rounded-2xl md:rounded-3xl border-2 overflow-hidden ${uiCard}`} style={{ animationDelay: "250ms" }}>
            <div className="relative overflow-x-auto overflow-y-auto max-h-[600px] px-2 md:px-4 pb-4">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className={`${dk ? "bg-gradient-to-l from-slate-800 via-slate-800/95 to-slate-800 border-b-2 border-slate-600" : "bg-gradient-to-l from-slate-100 via-slate-50 to-slate-100 border-b-2 border-slate-200"}`}>
                    <th className="px-2 py-3 text-center text-[11px] font-black text-slate-400 whitespace-nowrap w-16">شماره</th>
                    <th className="px-2 py-3 text-center text-[11px] font-black text-slate-400 whitespace-nowrap w-32 cursor-pointer hover:text-cyan-400 transition group" onClick={() => handleSort("trackingCode")}>
                      <span className="inline-flex items-center gap-1">کد پیگیری <SortIcon field="trackingCode" /></span>
                    </th>
                    <th className="px-2 py-3 text-center text-[11px] font-black text-slate-400 whitespace-nowrap w-24 cursor-pointer hover:text-cyan-400 transition" onClick={() => handleSort("date")}>
                      <span className="inline-flex items-center gap-1">تاریخ <SortIcon field="date" /></span>
                    </th>
                    <th className="px-2 py-3 text-center text-[11px] font-black text-slate-400 whitespace-nowrap w-16">ساعت</th>
                    <th className="px-2 py-3 text-center text-[11px] font-black text-slate-400 whitespace-nowrap w-36 cursor-pointer hover:text-cyan-400 transition" onClick={() => handleSort("partyName")}>
                      <span className="inline-flex items-center gap-1">مشتری <SortIcon field="partyName" /></span>
                    </th>
                    <th className="px-2 py-3 text-center text-[11px] font-black text-slate-400 whitespace-nowrap w-20 cursor-pointer hover:text-cyan-400 transition" onClick={() => handleSort("type")}>
                      <span className="inline-flex items-center gap-1">نوع <SortIcon field="type" /></span>
                    </th>
                    <th className="px-2 py-3 text-center text-[11px] font-black text-slate-400 whitespace-nowrap w-16">ارز</th>
                    <th className="px-2 py-3 text-center text-[11px] font-black text-slate-400 whitespace-nowrap w-28 cursor-pointer hover:text-cyan-400 transition" onClick={() => handleSort("amount")}>
                      <span className="inline-flex items-center gap-1">مبلغ <SortIcon field="amount" /></span>
                    </th>
                    <th className="px-2 py-3 text-center text-[11px] font-black text-slate-400 whitespace-nowrap w-24">تراز بعد</th>
                    <th className="px-2 py-3 text-center text-[11px] font-black text-slate-400">شرح</th>
                    <th className="px-2 py-3 text-center text-[11px] font-black text-slate-400 whitespace-nowrap w-20">عملیات</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${dk ? "divide-slate-700/40" : "divide-slate-100"}`}>
                  {paginatedEntries.length === 0 ? (
                    <tr>
                      <td colSpan={11} className={`px-4 py-16 text-center ${subText}`}>
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-4xl">📭</span>
                          <span className="font-bold">هیچ تراکنشی با این فیلترها یافت نشد.</span>
                          {transactions.length === 0 && hawalas.length === 0 && cashEntries.length === 0 && (
                            <span className="text-xs text-rose-400 mt-2 font-mono bg-rose-500/10 px-2 py-1 rounded">
                              ⚠️ هشدار: هیچ داده‌ای از Firebase خوانده نشد. لطفاً نام کالکشن‌ها را در defaultData.ts بررسی کنید.
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedEntries.map((entry, index) => {
                      const isVoided = entry.status === "voided";
                      const d = new Date(entry.date);
                      const datePart = d.toLocaleDateString("fa-IR");
                      const timePart = d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
                      const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
                      const currColors = currencyColors[entry.currency as Currency];

                      return (
                        <tr 
                          key={entry.id} 
                          className={`group transition-all duration-200 cursor-pointer ${
                            isVoided 
                              ? (dk ? "opacity-50" : "opacity-60") 
                              : (dk ? "hover:bg-slate-700/30" : "hover:bg-emerald-50/50")
                          } ${dk ? "" : "even:bg-slate-50/30"}`}
                          onClick={() => setSelectedEntry(entry)}
                        >
                          <td className={`px-2 py-2.5 text-center`}>
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black transition-all ${
                              dk ? "bg-slate-700/50 text-slate-300 group-hover:bg-slate-600" : "bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-700"
                            }`}>
                              {toPersianDigits(String(globalIndex))}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <span className={`inline-block px-2 py-1 rounded-md text-[11px] font-bold font-mono tracking-wider whitespace-nowrap transition-all ${
                              isVoided 
                                ? (dk ? "bg-slate-700/30 text-slate-500 line-through" : "bg-slate-100 text-slate-400 line-through")
                                : (dk ? "bg-gradient-to-r from-cyan-500/20 to-sky-500/20 text-cyan-300 border border-cyan-500/30 group-hover:border-cyan-400/60" : "bg-gradient-to-r from-cyan-50 to-sky-50 text-cyan-700 border border-cyan-200 group-hover:border-cyan-400")
                            }`}>
                              {entry.trackingCode}
                            </span>
                          </td>
                          <td className={`px-2 py-2.5 text-center text-xs whitespace-nowrap font-bold ${dk ? "text-slate-300" : "text-slate-700"}`}>{datePart}</td>
                          <td className={`px-2 py-2.5 text-center text-xs whitespace-nowrap ${dk ? "text-slate-400" : "text-slate-500"}`}>{timePart}</td>
                          <td className={`px-2 py-2.5 text-center text-xs font-bold ${isVoided ? (dk ? "text-slate-500 line-through" : "text-slate-400 line-through") : (dk ? "text-amber-300" : "text-amber-700")}`}>
                            <div className="flex items-center gap-1 justify-center">
                              <span className="truncate max-w-[120px]" title={entry.partyName || "—"}>{entry.partyName || "—"}</span>
                            </div>
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black whitespace-nowrap ${getBadgeColor(entry.type, isVoided)}`}>
                              {entry.type}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black whitespace-nowrap ${dk ? currColors.bg : "bg-slate-50"} ${currColors.text}`}>
                              <span className="text-xs">{currencyIcons[entry.currency as Currency]}</span>
                              <span>{currencyLabels[entry.currency as Currency]}</span>
                            </span>
                          </td>
                          <td className={`px-2 py-2.5 text-center font-black tabular-nums text-xs whitespace-nowrap ${isVoided ? (dk ? "text-slate-500 line-through" : "text-slate-400 line-through") : (entry.type === "واریز" ? "text-emerald-500" : "text-rose-500")}`}>
                            <span className={`inline-block px-2 py-0.5 rounded-md ${isVoided ? "" : (entry.type === "واریز" ? (dk ? "bg-emerald-500/10" : "bg-emerald-50") : (dk ? "bg-rose-500/10" : "bg-rose-50"))}`}>
                              {entry.type === "واریز" ? "+" : "-"} {fmt(entry.amount)}
                            </span>
                          </td>
                          <td className={`px-2 py-2.5 text-center tabular-nums text-xs font-mono whitespace-nowrap ${dk ? "text-slate-300" : "text-slate-600"}`}>
                            {entry.balanceAfter ?? "—"}
                          </td>
                          <td className={`px-2 py-2.5 text-center text-xs ${isVoided ? (dk ? "text-slate-500 line-through" : "text-slate-400 line-through") : (dk ? "text-slate-200" : "text-slate-800")}`}>
                            <span className="truncate block max-w-[180px] mx-auto" title={entry.description}>{entry.description}</span>
                          </td>
                          <td className="px-2 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                            {!isVoided ? (
                              <button onClick={() => handleVoid(entry)} disabled={voidingId === entry.id} className={`text-[10px] px-2 py-1 rounded-lg font-black transition disabled:opacity-50 whitespace-nowrap ${dk ? "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20" : "bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200"}`}>
                                {voidingId === entry.id ? "..." : "ابطال"}
                              </button>
                            ) : (
                              <span className={`text-[9px] px-2 py-1 rounded font-black whitespace-nowrap ${dk ? "text-slate-400 bg-slate-700/50" : "text-slate-500 bg-slate-200"}`}>باطل‌شده</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {/* صفحه‌بندی در صورت نیاز */}
            {totalPages > 1 && (
              <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 md:px-7 py-4 border-t ${dk ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50/50"}`}>
                <div className={`text-xs font-bold ${subText}`}>
                  نمایش {toPersianDigits(String((currentPage - 1) * itemsPerPage + 1))} تا {toPersianDigits(String(Math.min(currentPage * itemsPerPage, sortedEntries.length)))} از {toPersianDigits(String(sortedEntries.length))}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className={`px-3 py-1.5 rounded-lg text-xs font-black transition disabled:opacity-30 ${dk ? "bg-slate-700/50 text-slate-300 hover:bg-slate-700" : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"}`}>« اول</button>
                  <button onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1} className={`px-3 py-1.5 rounded-lg text-xs font-black transition disabled:opacity-30 ${dk ? "bg-slate-700/50 text-slate-300 hover:bg-slate-700" : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"}`}>قبلی</button>
                  <div className={`px-4 py-1.5 rounded-lg text-xs font-black ${dk ? "bg-gradient-to-r from-emerald-500/30 to-teal-500/30 text-emerald-300 border border-emerald-400/30" : "bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-700 border border-emerald-300"}`}>
                    {toPersianDigits(String(currentPage))} / {toPersianDigits(String(totalPages))}
                  </div>
                  <button onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages} className={`px-3 py-1.5 rounded-lg text-xs font-black transition disabled:opacity-30 ${dk ? "bg-slate-700/50 text-slate-300 hover:bg-slate-700" : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"}`}>بعدی</button>
                  <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className={`px-3 py-1.5 rounded-lg text-xs font-black transition disabled:opacity-30 ${dk ? "bg-slate-700/50 text-slate-300 hover:bg-slate-700" : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"}`}>آخر »</button>
                </div>
              </div>
            )}
          </section>
        </div>

        {selectedEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedEntry(null)}>
            <div className={`relative w-full max-w-lg rounded-2xl border-2 p-6 shadow-2xl ${dk ? "border-slate-700 bg-slate-800" : "border-emerald-200 bg-white"}`} onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setSelectedEntry(null)} className={`absolute top-4 left-4 w-8 h-8 rounded-full flex items-center justify-center transition ${dk ? "bg-slate-700 hover:bg-slate-600 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-700"}`}>✕</button>
              <div className="flex items-center gap-3 mb-5">
                <div className={`grid h-12 w-12 place-items-center rounded-xl shadow-md ${dk ? "bg-gradient-to-br from-cyan-400 to-sky-500 text-slate-950" : "bg-gradient-to-br from-cyan-500 to-sky-500 text-white"}`}>
                  <span className="text-2xl">📄</span>
                </div>
                <div>
                  <h3 className={`cs-display text-xl leading-none ${heading}`}>جزئیات تراکنش</h3>
                  <p className={`mt-1 text-xs font-bold font-mono ${dk ? "text-cyan-300" : "text-cyan-700"}`}>{selectedEntry.trackingCode}</p>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  ["تاریخ", new Date(selectedEntry.date).toLocaleDateString("fa-IR")],
                  ["ساعت", new Date(selectedEntry.date).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })],
                  ["نوع", selectedEntry.type],
                  ["مشتری", selectedEntry.partyName],
                  ["شرح", selectedEntry.description],
                  ["ارز", currencyLabels[selectedEntry.currency]],
                  ["مبلغ", `${selectedEntry.type === "واریز" ? "+" : "-"} ${fmt(selectedEntry.amount)}`],
                  ["وضعیت", selectedEntry.status === "voided" ? `باطل‌شده (${selectedEntry.voidedReason})` : "فعال"]
                ].map(([label, value], i) => (
                  <div key={i} className={`flex justify-between items-center py-2 border-b ${dk ? "border-slate-700" : "border-slate-100"}`}>
                    <span className={`text-xs font-bold ${subText}`}>{label}</span>
                    <span className={`text-sm font-black ${heading}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
