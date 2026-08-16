"use client";
import { useEffect, useState, useMemo, useRef, type ReactNode } from "react";
import { getNextTrackingCode, consumeTrackingCode, initTrackingSystem } from "../../lib/trackingCode";
import { CUSTOMERS_KEY, TRANSACTIONS_KEY, CASH_KEY, HAWALAS_KEY, loadCustomersShared, loadTransactionsShared, loadCashEntriesShared, loadHawalasShared } from "../../lib/defaultData";

type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";
type FeePayer = "sender" | "receiver";
type HawalaStatus = "pending" | "sent" | "paid" | "cancelled";
type Customer = { id: string; name: string; phone?: string; telegram?: string; balances: Record<Currency, number>; };
type Hawala = {
  id: string; number: string; date: string; currencyFrom: Currency; currencyTo: Currency;
  amountFrom: number; finalAmount: number; fee: number; feeCurrency: Currency; feePayer: FeePayer;
  status: HawalaStatus; senderId?: string; senderName: string; receiverId?: string; receiverName: string;
  destinationText?: string; paidAt?: string; customerDeleted?: boolean;
};
type BalanceChange = { customerId?: string; customerName: string; currency: Currency; amount: number; };

const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const labels: Record<Currency, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };
const CASH_BOX_ID = "CASH_BOX";
const CASH_BOX_NAME = "صندوق";
const CASH_BOX_CUSTOMER: Customer = { id: CASH_BOX_ID, name: CASH_BOX_NAME, phone: "", telegram: "", balances: { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 } };

const normalizeDigits = (s: string) => s.replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
const toNumericText = (v: string) => { let s = normalizeDigits(String(v || "")).replace(/[^0-9.]/g, ""); const fd = s.indexOf("."); if (fd !== -1) s = s.slice(0, fd + 1) + s.slice(fd + 1).replace(/\./g, ""); return s; };
const parseAmount = (v: string) => { const n = Number(normalizeDigits(String(v || "")).replace(/,/g, "")); return Number.isFinite(n) && n >= 0 ? n : 0; };
const fmt = (n: number) => Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 0 }) : "0";
const newId = () => { try { return crypto.randomUUID(); } catch { return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 0x3) | 0x8).toString(16); }); } };

function shamsiParts(d: Date) { try { const p = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d); const g = (t: string) => p.find(x => x.type === t)?.value || "0"; return { year: g("year"), month: g("month"), day: g("day") }; } catch { return { year: "0", month: "0", day: "0" }; } }
function formatDateTime(d: Date) { const pad = (n: number) => String(n).padStart(2, "0"); const s = shamsiParts(d); return `${s.year}/${s.month}/${s.day} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function dateLabel(s: string) { try { const d = new Date(s); return Number.isNaN(d.getTime()) ? "-" : formatDateTime(d); } catch { return "-"; } }

function applyBalanceChanges(customers: Customer[], changes: BalanceChange[]): Customer[] {
  return customers.map(c => {
    const cc = changes.filter(ch => ch.customerId === c.id && ch.customerId !== CASH_BOX_ID);
    if (cc.length === 0) return c;
    const nb = { ...c.balances };
    for (const ch of cc) { if (nb[ch.currency] === undefined) nb[ch.currency] = 0; nb[ch.currency] = (nb[ch.currency] || 0) + ch.amount; }
    return { ...c, balances: nb };
  });
}

function getBalanceChangesForHawala(h: Hawala, action: "register" | "reverse"): BalanceChange[] {
  const changes: BalanceChange[] = []; const sign = action === "register" ? 1 : -1;
  if (h.senderId && h.senderId !== CASH_BOX_ID) {
    changes.push({ customerId: h.senderId, customerName: h.senderName, currency: h.currencyFrom, amount: -h.amountFrom * sign });
    if (h.feePayer === "sender" && h.fee > 0) changes.push({ customerId: h.senderId, customerName: h.senderName, currency: h.feeCurrency, amount: -h.fee * sign });
  }
  return changes;
}

function getBalanceChangesForSettlement(h: Hawala, action: "register" | "reverse"): BalanceChange[] {
  const changes: BalanceChange[] = []; const sign = action === "register" ? 1 : -1;
  if (h.receiverId && h.receiverId !== CASH_BOX_ID) {
    changes.push({ customerId: h.receiverId, customerName: h.receiverName, currency: h.currencyTo, amount: h.finalAmount * sign });
    if (h.feePayer === "receiver" && h.fee > 0) changes.push({ customerId: h.receiverId, customerName: h.receiverName, currency: h.feeCurrency, amount: -h.fee * sign });
  }
  return changes;
}

function loadCashEntries(): any[] {
  if (typeof window === "undefined") return [];
  try { const r = localStorage.getItem(CASH_KEY); if (!r) return []; const p = JSON.parse(r); return Array.isArray(p) ? p : []; } catch { return []; }
}
function saveCashEntries(entries: any[]) { if (typeof window === "undefined") return; try { localStorage.setItem(CASH_KEY, JSON.stringify(entries)); } catch {} }

function recomputeCashBalances(entries: any[]): any[] {
  const sorted = [...entries].sort((a, b) => { const t1 = new Date(a.date).getTime(); const t2 = new Date(b.date).getTime(); if (t1 !== t2) return t1 - t2; if (a.direction === "in" && b.direction === "out") return -1; if (a.direction === "out" && b.direction === "in") return 1; return 0; });
  const bals: Record<string, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
  return sorted.map(e => {
    if (e.status === "voided") return { ...e, balanceAfter: bals[e.currency] || 0 };
    if (e.currency && bals[e.currency] !== undefined) bals[e.currency] += e.direction === "in" ? (e.amount || 0) : -(e.amount || 0);
    return { ...e, balanceAfter: bals[e.currency] || 0 };
  });
}

function syncCashForHawala(action: "add" | "remove" | "replace", h: Hawala | null, oldId?: string) {
  let entries = loadCashEntries(); const targetId = oldId || h?.id;
  if (targetId) entries = entries.filter((e: any) => e.linkedHawalaId !== targetId);
  if ((action === "add" || action === "replace") && h) {
    const ne: any[] = []; const ds = h.date || new Date().toISOString();
    const isCash = h.senderId === CASH_BOX_ID || h.senderName === CASH_BOX_NAME;
    ne.push({ id: newId(), trackingCode: `${h.number}-OUT`, date: ds, type: isCash ? "owner_withdraw" : "customer_withdraw",
      currency: h.currencyFrom, amount: h.amountFrom, direction: "out",
      reason: `حواله - برداشت از ${isCash ? "صندوق" : h.senderName}`, balanceAfter: 0,
      customerId: isCash ? undefined : h.senderId, customerName: isCash ? undefined : h.senderName, linkedHawalaId: h.id });
    if (h.feePayer === "sender" && h.fee > 0) {
      ne.push({ id: newId(), trackingCode: `${h.number}-FEE`, date: ds, type: "fee", currency: h.feeCurrency, amount: h.fee, direction: "in",
        reason: `کارمزد حواله ${h.number}`, balanceAfter: 0, linkedHawalaId: h.id });
    }
    entries = [...entries, ...ne];
  }
  entries = recomputeCashBalances(entries); saveCashEntries(entries);
}

function syncCashForSettlement(action: "add" | "remove", h: Hawala | null) {
  let entries = loadCashEntries(); if (h) entries = entries.filter((e: any) => e.linkedHawalaSettleId !== h.id);
  if (action === "add" && h) {
    const ne: any[] = []; const ds = h.paidAt || new Date().toISOString();
    const isCash = h.receiverId === CASH_BOX_ID || h.receiverName === CASH_BOX_NAME;
    ne.push({ id: newId(), trackingCode: `${h.number}-SETTLE`, date: ds, type: isCash ? "owner_deposit" : "customer_deposit",
      currency: h.currencyTo, amount: h.finalAmount, direction: "in",
      reason: `تسویه حواله - پرداخت به ${isCash ? "صندوق" : h.receiverName}`, balanceAfter: 0,
      customerId: isCash ? undefined : h.receiverId, customerName: isCash ? undefined : h.receiverName, linkedHawalaSettleId: h.id });
    if (h.feePayer === "receiver" && h.fee > 0) {
      ne.push({ id: newId(), trackingCode: `${h.number}-FEE-SET`, date: ds, type: "fee", currency: h.feeCurrency, amount: h.fee, direction: "in",
        reason: `کارمزد تسویه حواله ${h.number}`, balanceAfter: 0, linkedHawalaSettleId: h.id });
    }
    entries = [...entries, ...ne];
  }
  entries = recomputeCashBalances(entries); saveCashEntries(entries);
}

const iconPaths: Record<string, string> = {
  send: "M6 12 3.269 3.126A59.768 59.768 0 0 1 21.485 12 59.77 59.77 0 0 1 3.27 20.876L5.999 12Zm0 0h7.5",
  users: "M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z",
  check: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  xCircle: "m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  trash: "M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0",
  chevron: "m19.5 8.25-7.5 7.5-7.5-7.5",
  eye: "M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  more: "M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z",
  doc: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
  inbox: "M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z",
  tag: "M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z",
};
type IconName = keyof typeof iconPaths;
const Ic = ({ n, className = "h-5 w-5" }: { n: IconName; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d={iconPaths[n]} /></svg>
);

export default function HawalaPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [hawalas, setHawalas] = useState<Hawala[]>([]);
  const [tab, setTab] = useState<"register" | "list">("register");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [now, setNow] = useState<Date | null>(null);
  const [toast, setToast] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<Hawala | null>(null);
  const [selectedHawala, setSelectedHawala] = useState<Hawala | null>(null);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<HawalaStatus | "all">("all");

  const [sender, setSender] = useState(""); const [receiver, setReceiver] = useState("");
  const [currencyFrom, setCurrencyFrom] = useState<Currency>("AFN"); const [currencyTo, setCurrencyTo] = useState<Currency>("AFN");
  const [amountFrom, setAmountFrom] = useState(""); const [fee, setFee] = useState("0");
  const [feeCurrency, setFeeCurrency] = useState<Currency>("AFN"); const [feePayer, setFeePayer] = useState<FeePayer>("sender");
  const [destinationText, setDestinationText] = useState(""); const [editingId, setEditingId] = useState<string | null>(null);

  const [showSenderList, setShowSenderList] = useState(false); const [senderFilter, setSenderFilter] = useState("");
  const senderListRef = useRef<HTMLDivElement>(null);
  const [showReceiverList, setShowReceiverList] = useState(false); const [receiverFilter, setReceiverFilter] = useState("");
  const receiverListRef = useRef<HTMLDivElement>(null);

  useEffect(() => { try { const s = window.localStorage.getItem("fx-theme"); if (s === "dark" || s === "light") setTheme(s); } catch {} }, []);
  useEffect(() => { try { window.localStorage.setItem("fx-theme", theme); } catch {} }, [theme]);
  const dk = theme === "dark";

  useEffect(() => { try { setCustomers(loadCustomersShared() as Customer[]); setHawalas(loadHawalasShared() as Hawala[]); initTrackingSystem(); } catch {} }, []);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      try {
        if (e.key === CUSTOMERS_KEY && e.newValue) { const p = JSON.parse(e.newValue); if (Array.isArray(p)) setCustomers(p); }
        if (e.key === HAWALAS_KEY && e.newValue) { const p = JSON.parse(e.newValue); if (Array.isArray(p)) setHawalas(p); }
      } catch {}
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  useEffect(() => {
    const handler = () => { try { setCustomers(loadCustomersShared() as Customer[]); setHawalas(loadHawalasShared() as Hawala[]); } catch {} };
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, []);

  useEffect(() => { try { localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers)); } catch {} }, [customers]);
  useEffect(() => { try { localStorage.setItem(HAWALAS_KEY, JSON.stringify(hawalas)); } catch {} }, [hawalas]);

  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const currentDateTime = now ? formatDateTime(now) : "";

  const filteredSenderList = useMemo(() => {
    if (!senderFilter) return [CASH_BOX_CUSTOMER, ...customers];
    const q = normalizeDigits(senderFilter.trim()).toLowerCase();
    const filtered = customers.filter(c => c.name.toLowerCase().includes(q) || (c.phone && normalizeDigits(c.phone).includes(q)));
    if (CASH_BOX_NAME.includes(q)) return [CASH_BOX_CUSTOMER, ...filtered];
    return filtered;
  }, [customers, senderFilter]);

  const filteredReceiverList = useMemo(() => {
    if (!receiverFilter) return [CASH_BOX_CUSTOMER, ...customers];
    const q = normalizeDigits(receiverFilter.trim()).toLowerCase();
    const filtered = customers.filter(c => c.name.toLowerCase().includes(q) || (c.phone && normalizeDigits(c.phone).includes(q)));
    if (CASH_BOX_NAME.includes(q)) return [CASH_BOX_CUSTOMER, ...filtered];
    return filtered;
  }, [customers, receiverFilter]);

  const amountFromValue = parseAmount(amountFrom);
  const feeValue = Math.max(0, parseAmount(fee));
  const finalAmount = currencyFrom === currencyTo ? amountFromValue - (feePayer === "receiver" ? feeValue : 0) : amountFromValue;

  const resetForm = () => {
    setSender(""); setReceiver(""); setCurrencyFrom("AFN"); setCurrencyTo("AFN");
    setAmountFrom(""); setFee("0"); setFeeCurrency("AFN"); setFeePayer("sender");
    setDestinationText(""); setEditingId(null);
  };

  const validate = () => {
    if (!sender) return "فرستنده ضروری است.";
    if (!receiver) return "گیرنده ضروری است.";
    if (sender === receiver) return "فرستنده و گیرنده نباید یکسان باشند.";
    if (!amountFromValue) return "مبلغ ضروری است.";
    return null;
  };

  const submitForm = () => {
    const err = validate();
    if (err) { setToast(err); return; }
    const isSenderCash = sender.trim() === CASH_BOX_NAME;
    const isReceiverCash = receiver.trim() === CASH_BOX_NAME;
    const selS = isSenderCash ? CASH_BOX_CUSTOMER : customers.find(c => c.name === sender);
    const selR = isReceiverCash ? CASH_BOX_CUSTOMER : customers.find(c => c.name === receiver);

    const newHawala: Hawala = {
      id: editingId || newId(),
      number: editingId ? (hawalas.find(h => h.id === editingId)?.number || getNextTrackingCode()) : getNextTrackingCode(),
      date: editingId ? (hawalas.find(h => h.id === editingId)?.date || new Date().toISOString()) : new Date().toISOString(),
      currencyFrom, currencyTo, amountFrom: amountFromValue, finalAmount,
      fee: feeValue, feeCurrency, feePayer, status: "pending",
      senderId: selS?.id, senderName: sender, receiverId: selR?.id, receiverName: receiver,
      destinationText: destinationText.trim() || undefined,
    };
    setPreviewData(newHawala); setPreviewOpen(true);
  };

  const confirmRegister = () => {
    if (!previewData) return;
    const hawala = { ...previewData, number: editingId ? previewData.number : consumeTrackingCode() };

    if (editingId) {
      const old = hawalas.find(h => h.id === editingId);
      if (old && old.status !== "cancelled" && old.status !== "paid") {
        setCustomers(p => applyBalanceChanges(p, getBalanceChangesForHawala(old, "reverse")));
      }
      syncCashForHawala("replace", hawala, editingId);
      setHawalas(p => p.map(h => h.id === editingId ? { ...hawala, id: editingId, number: h.number, date: h.date } : h));
    } else {
      setHawalas(p => [hawala, ...p]);
      syncCashForHawala("add", hawala);
    }

    setCustomers(p => applyBalanceChanges(p, getBalanceChangesForHawala(hawala, "register")));
    resetForm(); setPreviewOpen(false); setPreviewData(null);
    setToast("حواله با موفقیت ثبت شد");
  };

  const settleHawala = (h: Hawala) => {
    if (!window.confirm("این حواله تسویه شود؟")) return;
    const paid: Hawala = { ...h, status: "paid", paidAt: new Date().toISOString() };
    setHawalas(p => p.map(x => x.id === h.id ? paid : x));
    setCustomers(p => applyBalanceChanges(p, getBalanceChangesForSettlement(paid, "register")));
    syncCashForSettlement("add", paid);
    setOpenActionId(null);
    setToast("حواله تسویه شد");
  };

  const cancelHawala = (h: Hawala) => {
    if (!window.confirm("این حواله ابطال شود؟")) return;
    const cancelled: Hawala = { ...h, status: "cancelled" };
    setHawalas(p => p.map(x => x.id === h.id ? cancelled : x));
    setCustomers(p => applyBalanceChanges(p, getBalanceChangesForHawala(h, "reverse")));
    syncCashForHawala("remove", null, h.id);
    setOpenActionId(null);
    setToast("حواله ابطال شد");
  };

  const deleteHawala = (h: Hawala) => {
    if (!window.confirm(`حذف ${h.number}؟`)) return;
    if (h.status !== "cancelled" && h.status !== "paid") {
      setCustomers(p => applyBalanceChanges(p, getBalanceChangesForHawala(h, "reverse")));
      syncCashForHawala("remove", null, h.id);
    }
    setHawalas(p => p.filter(x => x.id !== h.id));
    setOpenActionId(null);
    setToast("حواله حذف شد");
  };

  const editHawala = (h: Hawala) => {
    if (h.status !== "pending") { setToast("فقط حواله‌های در انتظار قابل ویرایش هستند"); return; }
    setTab("register");
    setSender(h.senderName); setReceiver(h.receiverName);
    setCurrencyFrom(h.currencyFrom); setCurrencyTo(h.currencyTo);
    setAmountFrom(String(h.amountFrom)); setFee(String(h.fee));
    setFeeCurrency(h.feeCurrency); setFeePayer(h.feePayer);
    setDestinationText(h.destinationText || "");
    setEditingId(h.id); setOpenActionId(null);
  };

  const filteredHawalas = useMemo(() => {
    let list = [...hawalas];
    if (statusFilter !== "all") list = list.filter(h => h.status === statusFilter);
    const q = normalizeDigits(search.trim()).toLowerCase();
    if (q) list = list.filter(h => [h.number, h.senderName, h.receiverName, h.destinationText || ""].some(f => normalizeDigits(String(f)).toLowerCase().includes(q)));
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [hawalas, search, statusFilter]);

  const statusLabel = (s: HawalaStatus) => ({ pending: "در انتظار", sent: "ارسال شده", paid: "تسویه شده", cancelled: "ابطال شده" }[s]);
  const statusColor = (s: HawalaStatus) => ({
    pending: dk ? "bg-amber-400/15 text-amber-300" : "bg-amber-100 text-amber-700",
    sent: dk ? "bg-sky-400/15 text-sky-300" : "bg-sky-100 text-sky-700",
    paid: dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-700",
    cancelled: dk ? "bg-rose-400/15 text-rose-300" : "bg-rose-100 text-rose-700",
  }[s]);

  const heading = dk ? "text-white" : "text-slate-900";
  const subText = dk ? "text-slate-500" : "text-slate-400";
  const glassChip = dk ? "border-slate-600/70 bg-slate-800/80" : "border-blue-100 bg-white/85";
  const uiCard = `rounded-2xl border backdrop-blur ${dk ? "border-slate-700 bg-slate-800/90" : "border-blue-100 bg-white/95"}`;
  const inputShell = `rounded-xl border text-sm font-medium shadow-sm outline-none transition-all duration-200 focus:ring-4 ${dk ? "border-slate-600 bg-slate-900 text-slate-100 placeholder:text-slate-500 hover:border-slate-500 focus:border-blue-400 focus:ring-blue-400/10" : "border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 hover:border-blue-400 focus:border-blue-500 focus:ring-blue-500/10"}`;
  const uiInput = `h-12 w-full px-3.5 ${inputShell}`;
  const uiLabel = `mb-1.5 block text-[11px] font-black ${dk ? "text-slate-400" : "text-slate-500"}`;
  const chevPos = `pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${dk ? "text-slate-500" : "text-slate-400"}`;

  const fld = (l: string, n: ReactNode) => (<div><label className={uiLabel}>{l}</label>{n}</div>);
  const currencySelect = (v: Currency, ch: (v: Currency) => void) => (
    <div className="relative">
      <select value={v} onChange={e => ch(e.target.value as Currency)} className={`${uiInput} cursor-pointer appearance-none pl-9`}>
        {currencies.map(c => <option key={c} value={c}>{labels[c]}</option>)}
      </select>
      <span className={chevPos}><Ic n="chevron" className="h-4 w-4" /></span>
    </div>
  );

  useEffect(() => {
    if (!openActionId) return;
    const handler = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest(".action-dropdown")) setOpenActionId(null); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openActionId]);

  return (
    <div dir="rtl" className={dk ? "dark" : ""}>
      <style>{`@import url("https://fonts.googleapis.com/css2?family=Lalezar&family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap");.hw-font{font-family:"Vazirmatn","Segoe UI",Tahoma,sans-serif}.hw-display{font-family:"Lalezar","Vazirmatn",Tahoma,sans-serif}.dark{color-scheme:dark}`}</style>
      <div className={`hw-font relative min-h-screen ${dk ? "bg-[#0f172a] text-slate-100" : "bg-[#eef6fa] text-slate-800"}`}>
        <div className={`fixed inset-x-0 top-0 z-30 h-1 bg-gradient-to-l ${dk ? "from-blue-400 via-cyan-400 to-emerald-400" : "from-blue-500 via-cyan-400 to-emerald-400"}`} />
        <div className="relative z-10 mx-auto w-full max-w-7xl space-y-4 md:space-y-6 px-3 pb-16 pt-5 md:px-8 md:pt-9">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative grid h-11 w-11 md:h-14 md:w-14 place-items-center rounded-xl md:rounded-2xl bg-gradient-to-br from-blue-500 via-cyan-500 to-emerald-400 text-white shadow-lg">
                <Ic n="send" className="h-5 w-5 md:h-6 md:w-6" />
                <span className={`absolute -bottom-1 -left-1 grid h-4 min-w-4 md:h-5 md:min-w-5 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-400 px-1 text-[7px] md:text-[8px] font-black text-white ring-2 ${dk ? "ring-[#0f172a]" : "ring-[#eef6fa]"}`}>HW</span>
              </div>
              <div className="min-w-0">
                <h1 className={`hw-display text-2xl md:text-4xl ${heading}`}>حواله‌جات</h1>
                <p className={`mt-1 text-[10px] md:text-xs font-bold ${subText}`}>مدیریت حواله و انتقال پول</p>
              </div>
            </div>
            <div className={`hidden sm:flex items-center gap-2 rounded-xl border px-3 py-2 shadow-sm backdrop-blur ${glassChip}`}>
              <span dir="ltr" className={`text-xs font-bold tabular-nums ${dk ? "text-slate-100" : "text-slate-700"}`}>{currentDateTime || "--"}</span>
            </div>
          </header>

          <div className={`flex gap-1.5 rounded-xl border p-1.5 ${glassChip}`}>
            <button onClick={() => setTab("register")} className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-black ${tab === "register" ? dk ? "bg-blue-400 text-slate-950" : "bg-blue-500 text-white" : dk ? "text-slate-400" : "text-slate-500"}`}>
              <Ic n="send" className="h-4 w-4" />ثبت حواله جدید
            </button>
            <button onClick={() => setTab("list")} className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-black ${tab === "list" ? dk ? "bg-blue-400 text-slate-950" : "bg-blue-500 text-white" : dk ? "text-slate-400" : "text-slate-500"}`}>
              <Ic n="doc" className="h-4 w-4" />لیست حواله‌ها ({hawalas.length})
            </button>
          </div>

          {tab === "register" && (
            <section className={`space-y-4 p-4 md:p-7 ${uiCard}`}>
              <div className="flex items-center gap-3">
                <span className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${dk ? "from-blue-400/20 text-blue-300 ring-blue-400/25" : "from-blue-400/20 text-blue-600 ring-blue-400/30"}`}><Ic n="send" className="h-5 w-5" /></span>
                <div className="flex-1 min-w-0">
                  <h2 className={`hw-display text-xl md:text-2xl ${heading}`}>{editingId ? "ویرایش حواله" : "ثبت حواله جدید"}</h2>
                  <p className={`mt-1 text-[11px] font-bold ${subText}`}>ارسال پول بین فرستنده و گیرنده</p>
                </div>
                {editingId && <button onClick={resetForm} className="cursor-pointer rounded-lg bg-amber-400/30 px-3 py-1.5 text-xs font-black">انصراف ویرایش</button>}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {fld("تاریخ", <input readOnly dir="ltr" value={currentDateTime} className={`${uiInput} ${dk ? "bg-slate-800/70 text-slate-400" : "bg-slate-100 text-slate-500"} pl-10 text-left tabular-nums`} />)}
                {fld("شماره حواله", <input readOnly dir="ltr" value={editingId ? hawalas.find(h => h.id === editingId)?.number || "-" : getNextTrackingCode()} className={`${uiInput} ${dk ? "bg-slate-800/70 text-slate-400" : "bg-slate-100 text-slate-500"} pl-14 text-left tabular-nums font-black`} />)}
                <div></div><div></div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr]">
                <div className={`space-y-4 rounded-2xl border p-4 ${dk ? "border-orange-400/25 bg-orange-400/[0.07]" : "border-orange-300 bg-orange-50"}`}>
                  <div className="flex items-center gap-2.5">
                    <span className={`grid h-9 w-9 place-items-center rounded-xl ${dk ? "bg-orange-400/15 text-orange-300" : "bg-orange-100 text-orange-600"}`}><Ic n="users" className="h-4 w-4" /></span>
                    <b className={`text-sm font-black ${dk ? "text-orange-300" : "text-orange-700"}`}>فرستنده</b>
                  </div>
                  {fld("فرستنده *", (
                    <div className="relative" ref={senderListRef}>
                      <input value={sender} onChange={e => { setSender(e.target.value); setSenderFilter(e.target.value); if (!showSenderList) setShowSenderList(true); }} placeholder="انتخاب فرستنده..." className={uiInput} autoComplete="off" />
                      <button type="button" onClick={e => { e.stopPropagation(); setShowSenderList(!showSenderList); }} className="absolute left-2 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-lg text-slate-400">
                        <Ic n="chevron" className={`h-4 w-4 transition-transform ${showSenderList ? "rotate-180" : ""}`} />
                      </button>
                      {showSenderList && (
                        <div className="absolute left-0 top-full z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border shadow-xl border-slate-600 bg-slate-800">
                          {filteredSenderList.map(c => (
                            <button key={c.id} type="button" onClick={() => { setSender(c.name); setSenderFilter(""); setShowSenderList(false); }} className={`flex w-full items-center gap-2 px-3 py-2.5 text-right text-xs font-bold transition ${dk ? "text-slate-200 hover:bg-orange-400/15" : "text-slate-700 hover:bg-orange-50"}`}>
                              <span className="flex-1 truncate">{c.name}{c.id === CASH_BOX_ID && " 💰"}</span>
                              {c.phone && <span className={`text-[10px] ${subText}`} dir="ltr">{c.phone}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {fld("ارز فرستنده", currencySelect(currencyFrom, setCurrencyFrom))}
                  {fld("مبلغ *", <input type="text" inputMode="decimal" dir="ltr" value={amountFrom} onChange={e => setAmountFrom(toNumericText(e.target.value))} placeholder="0" className={`${uiInput} text-left tabular-nums`} />)}
                </div>

                <div className="hidden lg:flex items-center justify-center">
                  <span className={`grid h-12 w-12 place-items-center rounded-full border shadow-md ${dk ? "border-slate-600 bg-slate-900 text-blue-300" : "border-slate-200 bg-white text-blue-600"}`}><Ic n="send" className="h-5 w-5" /></span>
                </div>

                <div className={`space-y-4 rounded-2xl border p-4 ${dk ? "border-emerald-400/25 bg-emerald-400/[0.07]" : "border-emerald-300 bg-emerald-50"}`}>
                  <div className="flex items-center gap-2.5">
                    <span className={`grid h-9 w-9 place-items-center rounded-xl ${dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-600"}`}><Ic n="users" className="h-4 w-4" /></span>
                    <b className={`text-sm font-black ${dk ? "text-emerald-300" : "text-emerald-700"}`}>گیرنده</b>
                  </div>
                  {fld("گیرنده *", (
                    <div className="relative" ref={receiverListRef}>
                      <input value={receiver} onChange={e => { setReceiver(e.target.value); setReceiverFilter(e.target.value); if (!showReceiverList) setShowReceiverList(true); }} placeholder="انتخاب گیرنده..." className={uiInput} autoComplete="off" />
                      <button type="button" onClick={e => { e.stopPropagation(); setShowReceiverList(!showReceiverList); }} className="absolute left-2 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-lg text-slate-400">
                        <Ic n="chevron" className={`h-4 w-4 transition-transform ${showReceiverList ? "rotate-180" : ""}`} />
                      </button>
                      {showReceiverList && (
                        <div className="absolute left-0 top-full z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border shadow-xl border-slate-600 bg-slate-800">
                          {filteredReceiverList.map(c => (
                            <button key={c.id} type="button" onClick={() => { setReceiver(c.name); setReceiverFilter(""); setShowReceiverList(false); }} className={`flex w-full items-center gap-2 px-3 py-2.5 text-right text-xs font-bold transition ${dk ? "text-slate-200 hover:bg-emerald-400/15" : "text-slate-700 hover:bg-emerald-50"}`}>
                              <span className="flex-1 truncate">{c.name}{c.id === CASH_BOX_ID && " 💰"}</span>
                              {c.phone && <span className={`text-[10px] ${subText}`} dir="ltr">{c.phone}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {fld("ارز گیرنده", currencySelect(currencyTo, setCurrencyTo))}
                  {fld("مبلغ نهایی", <input readOnly dir="ltr" value={fmt(finalAmount)} className={`${uiInput} ${dk ? "bg-slate-800/70 text-slate-400" : "bg-slate-100 text-slate-500"} text-left tabular-nums`} />)}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className={`rounded-2xl border p-4 ${dk ? "border-amber-400/25 bg-amber-400/[0.07]" : "border-amber-300 bg-amber-50"}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`grid h-8 w-8 place-items-center rounded-lg ${dk ? "bg-amber-400/15 text-amber-300" : "bg-amber-100 text-amber-600"}`}><Ic n="tag" className="h-4 w-4" /></span>
                    <b className={`text-sm font-black ${dk ? "text-amber-300" : "text-amber-700"}`}>کارمزد</b>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {fld("مبلغ کارمزد", <input type="text" inputMode="decimal" dir="ltr" value={fee} onChange={e => setFee(toNumericText(e.target.value))} placeholder="0" className={`${uiInput} text-left tabular-nums`} />)}
                    {fld("ارز کارمزد", currencySelect(feeCurrency, setFeeCurrency))}
                  </div>
                  <div className="mt-3">
                    <label className={uiLabel}>پرداخت‌کننده کارمزد</label>
                    <div className={`flex rounded-xl border p-1 ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-slate-50"}`}>
                      <button onClick={() => setFeePayer("sender")} className={`flex-1 rounded-lg px-3 py-2 text-xs font-black ${feePayer === "sender" ? dk ? "bg-blue-400 text-slate-950" : "bg-blue-500 text-white" : dk ? "text-slate-400" : "text-slate-500"}`}>فرستنده</button>
                      <button onClick={() => setFeePayer("receiver")} className={`flex-1 rounded-lg px-3 py-2 text-xs font-black ${feePayer === "receiver" ? dk ? "bg-blue-400 text-slate-950" : "bg-blue-500 text-white" : dk ? "text-slate-400" : "text-slate-500"}`}>گیرنده</button>
                    </div>
                  </div>
                </div>
                {fld("توضیحات / مقصد", <textarea rows={4} value={destinationText} onChange={e => setDestinationText(e.target.value)} placeholder="اختیاری - مثلاً: کابل، خانواده" className={`${uiInput} h-auto py-3 resize-none`} />)}
              </div>

              <button onClick={submitForm} className={`flex h-[50px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-l text-base font-black shadow-lg ${dk ? "from-blue-400 to-emerald-400 text-slate-950" : "from-blue-500 to-emerald-400 text-white"}`}>
                {editingId ? "به‌روزرسانی حواله" : "ثبت حواله"}<Ic n="send" className="h-5 w-5" />
              </button>
            </section>
          )}

          {tab === "list" && (
            <section className={`overflow-hidden ${uiCard}`}>
              <div className="flex flex-wrap items-center gap-3 p-4 md:p-5">
                <span className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ring-1 ${dk ? "from-blue-400/20 text-blue-300 ring-blue-400/25" : "from-blue-400/20 text-blue-600 ring-blue-400/30"}`}><Ic n="doc" className="h-5 w-5" /></span>
                <div className="flex-1 min-w-0">
                  <h2 className={`hw-display text-xl md:text-2xl ${heading}`}>لیست حواله‌ها</h2>
                  <p className={`mt-1 text-[11px] font-bold ${subText}`}>مدیریت و جستجوی حواله‌ها</p>
                </div>
              </div>
              <div className="px-4 md:px-5 pb-4 space-y-3">
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو: شماره، فرستنده، گیرنده..." className={uiInput} />
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className={`${uiInput} cursor-pointer appearance-none pl-9 w-auto min-w-[150px]`}>
                    <option value="all">همه وضعیت‌ها</option>
                    <option value="pending">در انتظار</option>
                    <option value="sent">ارسال شده</option>
                    <option value="paid">تسویه شده</option>
                    <option value="cancelled">ابطال شده</option>
                  </select>
                </div>
                {filteredHawalas.length === 0 ? (
                  <div className={`flex flex-col items-center gap-3 py-14 ${dk ? "text-slate-500" : "text-slate-400"}`}>
                    <Ic n="inbox" className="h-7 w-7 opacity-70" />
                    <p className="text-sm font-black">حواله‌ای یافت نشد</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1100px] text-sm">
                      <thead><tr className={`border-y ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
                        {["شماره", "تاریخ", "فرستنده", "گیرنده", "مبلغ", "کارمزد", "وضعیت", "عملیات"].map(h => (<th key={h} className="px-4 py-3 text-center text-[11px] font-black text-slate-400">{h}</th>))}
                      </tr></thead>
                      <tbody className={`divide-y ${dk ? "divide-slate-700/60" : "divide-slate-100"}`}>
                        {filteredHawalas.map(h => {
                          const isOpen = openActionId === h.id;
                          return (
                            <tr key={h.id} className={`transition-colors ${dk ? "hover:bg-slate-700/30" : "hover:bg-blue-50/70"}`}>
                              <td className="px-4 py-3.5 text-center"><span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-black ${dk ? "border-blue-400/30 bg-blue-400/10 text-blue-300" : "border-blue-300 bg-blue-50 text-blue-700"}`} dir="ltr"><Ic n="tag" className="h-3 w-3" />{h.number}</span></td>
                              <td className={`px-4 py-3.5 text-center text-[11px] tabular-nums ${dk ? "text-slate-300" : "text-slate-600"}`} dir="ltr">{dateLabel(h.date)}</td>
                              <td className={`px-4 py-3.5 text-center text-[13px] font-bold ${dk ? "text-slate-200" : "text-slate-700"}`}>{h.senderName}{h.senderId === CASH_BOX_ID && " 💰"}</td>
                              <td className={`px-4 py-3.5 text-center text-[13px] font-bold ${dk ? "text-slate-200" : "text-slate-700"}`}>{h.receiverName}{h.receiverId === CASH_BOX_ID && " 💰"}</td>
                              <td className="px-4 py-3.5 text-center"><div className="text-[13px] font-black tabular-nums">{fmt(h.amountFrom)}</div><div className={`text-[10px] ${subText}`}>{labels[h.currencyFrom]}</div></td>
                              <td className="px-4 py-3.5 text-center"><div className="text-[12px] font-black tabular-nums">{fmt(h.fee)}</div><div className={`text-[10px] ${subText}`}>{labels[h.feeCurrency]}</div></td>
                              <td className="px-4 py-3.5 text-center"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${statusColor(h.status)}`}>{statusLabel(h.status)}</span></td>
                              <td className="px-4 py-3.5 text-center">
                                <div className="relative action-dropdown flex justify-center">
                                  <button onClick={e => { e.stopPropagation(); setOpenActionId(isOpen ? null : h.id); }} className={`grid h-8 w-8 place-items-center rounded-lg border transition-all ${dk ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-200 text-slate-500 hover:bg-slate-100"}`}>
                                    <Ic n="more" className="h-4 w-4" />
                                  </button>
                                  {isOpen && (
                                    <div className={`absolute left-1/2 -translate-x-1/2 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-xl border shadow-xl ${dk ? "border-slate-600 bg-slate-800" : "border-slate-200 bg-white"}`}>
                                      <button onClick={() => { setSelectedHawala(h); setOpenActionId(null); }} className={`flex w-full items-center gap-2 px-3 py-2 text-right text-xs font-bold ${dk ? "text-blue-300 hover:bg-blue-400/15" : "text-blue-600 hover:bg-blue-50"}`}><Ic n="eye" className="h-3.5 w-3.5" /> مشاهده</button>
                                      {h.status === "pending" && (<>
                                        <button onClick={() => editHawala(h)} className={`flex w-full items-center gap-2 px-3 py-2 text-right text-xs font-bold ${dk ? "text-sky-300 hover:bg-sky-400/15" : "text-sky-600 hover:bg-sky-50"}`}><Ic n="check" className="h-3.5 w-3.5" /> ویرایش</button>
                                        <button onClick={() => settleHawala(h)} className={`flex w-full items-center gap-2 px-3 py-2 text-right text-xs font-bold ${dk ? "text-emerald-300 hover:bg-emerald-400/15" : "text-emerald-600 hover:bg-emerald-50"}`}><Ic n="check" className="h-3.5 w-3.5" /> تسویه</button>
                                        <button onClick={() => cancelHawala(h)} className={`flex w-full items-center gap-2 px-3 py-2 text-right text-xs font-bold ${dk ? "text-amber-300 hover:bg-amber-400/15" : "text-amber-600 hover:bg-amber-50"}`}><Ic n="xCircle" className="h-3.5 w-3.5" /> ابطال</button>
                                      </>)}
                                      <div className={`my-1 h-px ${dk ? "bg-slate-700" : "bg-slate-100"}`} />
                                      <button onClick={() => deleteHawala(h)} className={`flex w-full items-center gap-2 px-3 py-2 text-right text-xs font-bold ${dk ? "text-rose-300 hover:bg-rose-400/15" : "text-rose-500 hover:bg-rose-50"}`}><Ic n="trash" className="h-3.5 w-3.5" /> حذف</button>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      {previewOpen && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 md:p-4 backdrop-blur-sm" onClick={() => { setPreviewOpen(false); setPreviewData(null); }}>
          <div className={`w-full max-w-2xl overflow-hidden rounded-xl md:rounded-2xl border shadow-2xl ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-white"}`} onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between border-b px-4 md:px-5 py-3 md:py-4 ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
              <b className={`flex items-center gap-2 text-sm ${dk ? "text-slate-100" : "text-slate-800"}`}><span className={`grid h-8 w-8 place-items-center rounded-lg ${dk ? "bg-blue-400/10 text-blue-300" : "bg-blue-100 text-blue-600"}`}><Ic n="doc" className="h-4 w-4" /></span>تأیید ثبت حواله</b>
              <button onClick={() => { setPreviewOpen(false); setPreviewData(null); }} className={`grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-slate-400 hover:rotate-90 transition-transform ${dk ? "hover:bg-slate-700" : "hover:bg-slate-100"}`}><Ic n="xCircle" className="h-4 w-4" /></button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto px-4 md:px-5 py-4 space-y-4">
              <div className={`flex items-center justify-between rounded-xl border p-3 ${dk ? "border-blue-400/30 bg-blue-400/10" : "border-blue-300 bg-blue-50"}`}>
                <div>
                  <div className={`text-[10px] font-bold ${subText}`}>شماره حواله</div>
                  <span className={`inline-flex items-center gap-1.5 text-[14px] font-black tabular-nums ${dk ? "text-blue-300" : "text-blue-700"}`} dir="ltr"><Ic n="tag" className="h-4 w-4" />{previewData.number}</span>
                </div>
                <div className="text-left">
                  <div className={`text-[10px] font-bold ${subText}`}>تاریخ</div>
                  <div className={`text-[13px] font-black tabular-nums ${dk ? "text-slate-200" : "text-slate-700"}`}>{dateLabel(previewData.date)}</div>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className={`rounded-xl border p-4 ${dk ? "border-orange-400/20 bg-orange-400/5" : "border-orange-200 bg-orange-50/50"}`}>
                  <b className={`text-sm font-black ${dk ? "text-orange-300" : "text-orange-700"}`}>فرستنده</b>
                  <p className={`mt-2 text-sm ${dk ? "text-slate-200" : "text-slate-700"}`}>{previewData.senderName}</p>
                  <p className={`text-[12px] font-black mt-1 ${dk ? "text-orange-300" : "text-orange-700"}`}>{fmt(previewData.amountFrom)} {labels[previewData.currencyFrom]}</p>
                </div>
                <div className={`rounded-xl border p-4 ${dk ? "border-emerald-400/20 bg-emerald-400/5" : "border-emerald-200 bg-emerald-50/50"}`}>
                  <b className={`text-sm font-black ${dk ? "text-emerald-300" : "text-emerald-700"}`}>گیرنده</b>
                  <p className={`mt-2 text-sm ${dk ? "text-slate-200" : "text-slate-700"}`}>{previewData.receiverName}</p>
                  <p className={`text-[12px] font-black mt-1 ${dk ? "text-emerald-300" : "text-emerald-700"}`}>{fmt(previewData.finalAmount)} {labels[previewData.currencyTo]}</p>
                </div>
              </div>
              <div className={`rounded-xl border p-4 ${dk ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"}`}>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className={subText}>کارمزد: </span><b>{fmt(previewData.fee)} {labels[previewData.feeCurrency]}</b></div>
                  <div><span className={subText}>پرداخت‌کننده: </span><b>{previewData.feePayer === "sender" ? "فرستنده" : "گیرنده"}</b></div>
                </div>
                {previewData.destinationText && <p className={`mt-3 text-sm ${dk ? "text-slate-300" : "text-slate-600"}`}><b>توضیحات:</b> {previewData.destinationText}</p>}
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <button onClick={confirmRegister} className={`flex h-[48px] flex-1 min-w-[180px] cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-black shadow-lg ${dk ? "bg-blue-400 text-slate-950" : "bg-blue-500 text-white"}`}>ثبت نهایی<Ic n="check" className="h-4 w-4" /></button>
                <button onClick={() => { setPreviewOpen(false); setPreviewData(null); }} className={`flex h-[48px] px-6 cursor-pointer items-center justify-center rounded-xl border text-sm font-bold ${dk ? "border-slate-600 text-slate-300" : "border-slate-200 text-slate-600"}`}>انصراف</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedHawala && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3" onClick={() => setSelectedHawala(null)}>
          <div className={`w-full max-w-lg rounded-xl border shadow-2xl ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-white"}`} onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between border-b px-4 py-3 ${dk ? "border-slate-700" : "border-slate-100"}`}>
              <b className={`text-sm ${dk ? "text-slate-100" : "text-slate-800"}`}>جزئیات حواله</b>
              <button onClick={() => setSelectedHawala(null)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400"><Ic n="xCircle" className="h-4 w-4" /></button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-4 py-2 space-y-2">
              {[
                ["شماره", selectedHawala.number],
                ["تاریخ", dateLabel(selectedHawala.date)],
                ["فرستنده", selectedHawala.senderName],
                ["گیرنده", selectedHawala.receiverName],
                ["مبلغ", `${fmt(selectedHawala.amountFrom)} ${labels[selectedHawala.currencyFrom]}`],
                ["مبلغ نهایی", `${fmt(selectedHawala.finalAmount)} ${labels[selectedHawala.currencyTo]}`],
                ["کارمزد", `${fmt(selectedHawala.fee)} ${labels[selectedHawala.feeCurrency]}`],
                ["پرداخت‌کننده", selectedHawala.feePayer === "sender" ? "فرستنده" : "گیرنده"],
                ["وضعیت", statusLabel(selectedHawala.status)],
                ["توضیحات", selectedHawala.destinationText || "-"],
              ].map(([l, v], i) => (
                <div key={i} className={`flex items-start justify-between gap-4 border-b border-dashed py-3 last:border-0 ${dk ? "border-slate-700" : "border-slate-200"}`}>
                  <span className={`shrink-0 text-[11px] font-black ${dk ? "text-slate-500" : "text-slate-400"}`}>{l}</span>
                  <span className={`text-left text-[13px] font-bold ${dk ? "text-slate-200" : "text-slate-700"}`}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`fixed bottom-6 left-6 z-[99] rounded-xl px-4 py-3 text-sm font-bold shadow-lg ${dk ? "bg-slate-800 text-slate-100 border border-slate-600" : "bg-slate-900 text-white"}`}>{toast}</div>}
    </div>
  );
}
