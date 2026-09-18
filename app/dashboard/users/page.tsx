"use client";
import { useEffect, useMemo, useState, useRef, useCallback, type ReactNode } from "react";
import { useSyncedState } from "../lib/useSyncedState";
import { initTrackingSystem } from "../lib/trackingCode";
import { CUSTOMERS_KEY, TRANSACTIONS_KEY, HAWALAS_KEY, CASH_KEY } from "../lib/defaultData";

type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";
type Customer = { id: string; name: string; phone?: string; tazkira?: string; address?: string; note?: string; telegram?: string; registeredAt: string; balances: Record<Currency, number>; };
type TxType = "exchange" | "transfer" | "convert" | "hawala" | "deposit" | "withdraw" | "fee" | "correction";
type CashEntryType = "customer_deposit" | "customer_withdraw" | "owner_deposit" | "owner_withdraw" | "adjustment" | "fee" | "commission_withdraw" | "loan_given" | "loan_received";
type LedgerEntry = { id: string; date: string; customerId: string; type: TxType; description: string; currency: Currency; amount: number; direction: "in" | "out"; balanceAfter: number; referenceId?: string; referenceNumber?: string; counterPartyId?: string; };
type FormState = { name: string; tazkira: string; phone: string; address: string; note: string; telegram: string; };
type FormErrors = Partial<Record<keyof FormState, string>>;

type TelegramUser = { id: number; name: string; username: string; chat_id: number };
type TelegramSettings = { enabled: boolean; botToken: string; chatId: string; notifyNewHawala: boolean; notifySettlement: boolean; notifyVoid: boolean; notifyExchange: boolean; };
type Settings = { email: string; supportEmail: string; language: "dari" | "pashto" | "english"; teamName: string; teamAddress: string; teamPhone: string; telegram: TelegramSettings; };

const defaultSettings: Settings = {
  email: "", supportEmail: "", language: "dari",
  teamName: "صرافی برادران نورزاد", teamAddress: "هرات، افغانستان", teamPhone: "",
  telegram: { enabled: false, botToken: "", chatId: "", notifyNewHawala: true, notifySettlement: true, notifyVoid: true, notifyExchange: true },
};

const getTelegramSettings = (): TelegramSettings => {
  if (typeof window === "undefined") return defaultSettings.telegram;
  try {
    const raw = localStorage.getItem("fx-settings");
    if (!raw) return defaultSettings.telegram;
    const parsed = JSON.parse(raw);
    return { ...defaultSettings.telegram, ...(parsed.telegram || {}) };
  } catch { return defaultSettings.telegram; }
};

async function fetchTelegramUsers(botToken: string): Promise<TelegramUser[]> {
  if (!botToken.trim()) return [];
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken.trim()}/getUpdates`);
    const data = await res.json();
    if (!data.ok || !data.result) return [];
    const usersMap = new Map<number, TelegramUser>();
    data.result.forEach((update: any) => {
      const from = update.message?.from || update.callback_query?.message?.from;
      const chat = update.message?.chat || update.callback_query?.message?.chat;
      if (from && chat) {
        usersMap.set(from.id, { id: from.id, name: `${from.first_name || ""} ${from.last_name || ""}`.trim() || "بدون نام", username: from.username ? `@${from.username}` : "—", chat_id: chat.id });
      }
    });
    return Array.from(usersMap.values());
  } catch (err) { console.error("خطا در دریافت کاربران تلگرام:", err); return []; }
}

function TelegramChatIdSelector({ value, onChange, uiInput, dk }: { value: string; onChange: (v: string) => void; uiInput: string; dk: boolean; }) {
  const [users, setUsers] = useState<TelegramUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [lastError, setLastError] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const settings = getTelegramSettings();
  const hasBotToken = settings.enabled && settings.botToken.trim().length > 0;

  const loadUsers = useCallback(async () => {
    if (!hasBotToken) return;
    setLoading(true); setLastError("");
    const list = await fetchTelegramUsers(settings.botToken);
    setUsers(list); setLoading(false);
    if (list.length === 0) setLastError("هیچ کاربری یافت نشد. ابتدا به ربات /start بفرستید.");
  }, [hasBotToken, settings.botToken]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => { if (open && users.length === 0 && hasBotToken && !loading) loadUsers(); }, [open, users.length, hasBotToken, loading, loadUsers]);

  const filteredUsers = useMemo(() => {
    const q = normalizeDigits(search.trim()).toLowerCase();
    if (!q) return users;
    return users.filter(u => [u.name, u.username, String(u.chat_id)].some(f => normalizeDigits(String(f)).toLowerCase().includes(q)));
  }, [users, search]);

  const selectUser = (user: TelegramUser) => { onChange(String(user.chat_id)); setOpen(false); setSearch(""); };
  const subText = dk ? "text-slate-500" : "text-slate-400";
  const heading = dk ? "text-white" : "text-slate-900";

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex gap-2">
        <input dir="ltr" className={`${uiInput} flex-1 text-left font-mono text-xs`} value={value} onChange={e => onChange(e.target.value)} placeholder="chat_id را وارد کنید یا از لیست انتخاب کنید" />
        <button type="button" onClick={() => { if (!hasBotToken) { alert("ابتدا در تنظیمات، تلگرام را فعال کنید و توکن ربات را وارد کنید."); return; } setOpen(!open); }}
          className={`flex h-12 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-black transition-all ${hasBotToken ? dk ? "border-sky-600 bg-sky-500/15 text-sky-300 hover:bg-sky-500/25" : "border-sky-400 bg-sky-50 text-sky-700 hover:bg-sky-100" : dk ? "border-slate-600 bg-slate-700/50 text-slate-500 cursor-not-allowed" : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"}`}
          disabled={!hasBotToken}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M6 12 3.269 3.126A59.768 59.768 0 0 1 21.485 12 59.77 59.77 0 0 1 3.27 20.876L5.999 12Zm0 0h7.5" /></svg>
          لیست
        </button>
      </div>
      {open && (
        <div className={`absolute right-0 left-0 top-full z-50 mt-2 max-h-80 overflow-hidden rounded-xl border shadow-2xl ${dk ? "border-slate-600 bg-slate-800" : "border-slate-200 bg-white"}`}>
          <div className={`flex items-center justify-between border-b px-3 py-2.5 ${dk ? "border-slate-700" : "border-slate-100"}`}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black">کاربران ربات ({users.length})</span>
            </div>
            <button type="button" onClick={loadUsers} disabled={loading} className="text-xs font-black">
              {loading ? "..." : "بروزرسانی"}
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto cu-scroll">
            {filteredUsers.map(user => (
              <button key={user.id} type="button" onClick={() => selectUser(user)} className="flex w-full items-center justify-between gap-2 border-b px-3 py-2.5 text-right transition-all">
                <div className="flex-1 min-w-0">
                  <div className="truncate text-xs font-black">{user.name}</div>
                  <div className="text-[10px]"><span>{user.username}</span> <span dir="ltr">ID: {user.chat_id}</span></div>
                </div>
                <span className="text-[9px] font-black">انتخاب</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const labels: Record<Currency, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };
const entryTypeLabels: Record<CashEntryType, string> = {
  customer_deposit: "واریز مشتری", customer_withdraw: "برداشت مشتری",
  owner_deposit: "واریز مالک", owner_withdraw: "برداشت مالک",
  adjustment: "اصلاح صندوق", fee: "کارمزد", commission_withdraw: "برداشت کارمزد",
  loan_given: "قرض داده‌شده", loan_received: "دریافت قرض"
};
const currencyColors: Record<Currency, { light: string; dark: string; gradient: string }> = {
  AFN: { light: "text-emerald-700 bg-emerald-50", dark: "text-emerald-300 bg-emerald-900/20", gradient: "from-emerald-500 to-teal-400" },
  USD: { light: "text-sky-700 bg-sky-50", dark: "text-sky-300 bg-sky-900/20", gradient: "from-sky-500 to-cyan-400" },
  EUR: { light: "text-blue-700 bg-blue-50", dark: "text-blue-300 bg-blue-900/20", gradient: "from-blue-600 to-blue-400" },
  IRR: { light: "text-amber-700 bg-amber-50", dark: "text-amber-300 bg-amber-900/20", gradient: "from-amber-500 to-orange-400" },
  PKR: { light: "text-rose-700 bg-rose-50", dark: "text-rose-300 bg-rose-900/20", gradient: "from-rose-500 to-pink-400" }
};
const txLabels: Record<TxType, string> = { exchange: "تبادل ارز", transfer: "انتقال", convert: "تبدیل ارز", hawala: "حواله", deposit: "واریز", withdraw: "برداشت", fee: "کارمزد", correction: "اصلاح" };
const txColors: Record<TxType, { light: string; dark: string }> = { exchange: { light: "bg-sky-100 text-sky-700", dark: "bg-sky-400/15 text-sky-300" }, transfer: { light: "bg-violet-100 text-violet-700", dark: "bg-violet-400/15 text-violet-300" }, convert: { light: "bg-purple-100 text-purple-700", dark: "bg-purple-400/15 text-purple-300" }, hawala: { light: "bg-blue-100 text-blue-700", dark: "bg-blue-400/15 text-blue-300" }, deposit: { light: "bg-emerald-100 text-emerald-700", dark: "bg-emerald-400/15 text-emerald-300" }, withdraw: { light: "bg-rose-100 text-rose-700", dark: "bg-rose-400/15 text-rose-300" }, fee: { light: "bg-amber-100 text-amber-700", dark: "bg-amber-400/15 text-amber-300" }, correction: { light: "bg-orange-100 text-orange-700", dark: "bg-orange-400/15 text-orange-300" } };

const CASH_BOX_ID = "CASH_BOX";
const CASH_BOX_NAME = "صندوق";
const CASH_BOX_CUSTOMER: Customer = { id: CASH_BOX_ID, name: CASH_BOX_NAME, phone: "", tazkira: "", address: "", note: "", telegram: "", registeredAt: "", balances: { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 } };

const EXCHANGE_ACCOUNT_ID = "EXCHANGE_ACCOUNT";
const EXCHANGE_ACCOUNT_NAME = "حساب صرافی";
const EXCHANGE_ACCOUNT_CUSTOMER: Customer = {
  id: EXCHANGE_ACCOUNT_ID, name: EXCHANGE_ACCOUNT_NAME, phone: "INTERNAL", tazkira: "INTERNAL",
  address: "داخلی سیستم", note: "حساب داخلی صرافی برای مدیریت قرض و اعتبار",
  telegram: "", registeredAt: "", balances: { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 }
};

const generateId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try { return crypto.randomUUID(); } catch {}
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
};
const isCurrency = (v: any): v is Currency => typeof v === "string" && (currencies as string[]).includes(v);
const normalizeDigits = (v: string) => { const pd = "۰۱۲۳۴۵۶۷۸۹", ad = "٠١٢٣٤٥٦٧٨٩"; return String(v || "").replace(/[۰-۹]/g, d => String(pd.indexOf(d))).replace(/[٠-٩]/g, d => String(ad.indexOf(d))); };
const fmt = (n: number) => Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0";

function shamsiParts(d: Date) {
  try {
    const p = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
    const g = (t: string) => p.find(x => x.type === t)?.value || "0";
    return { year: g("year"), month: g("month"), day: g("day") };
  } catch { return { year: "0", month: "0", day: "0" }; }
}
function formatDateTime(d: Date) { const pad = (n: number) => String(n).padStart(2, "0"); const s = shamsiParts(d); return `${s.year}/${s.month}/${s.day} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function formatShamsiDate(d: Date) { const s = shamsiParts(d); return `${s.year}/${s.month}/${s.day}`; }
function dateLabel(s: string) { try { const d = new Date(s); return Number.isNaN(d.getTime()) ? "-" : formatDateTime(d); } catch { return "-"; } }
function shortDateLabel(s: string) { try { const d = new Date(s); return Number.isNaN(d.getTime()) ? "-" : formatShamsiDate(d); } catch { return "-"; } }
function timeLabel(s: string) { try { const d = new Date(s); if (Number.isNaN(d.getTime())) return "-"; const p = (n: number) => String(n).padStart(2, "0"); return `${p(d.getHours())}:${p(d.getMinutes())}`; } catch { return "-"; } }

const emptyForm: FormState = { name: "", tazkira: "", phone: "", address: "", note: "", telegram: "" };

function getLedgerBalance(customerId: string, currency: Currency, cashEntries: any[], ledger: LedgerEntry[]): number {
  let balance = 0;
  if (customerId === CASH_BOX_ID) {
    for (const e of cashEntries) {
      if (e.status === "voided" || e.currency !== currency) continue;
      balance += e.direction === "in" ? e.amount : -e.amount;
    }
  } else if (customerId === EXCHANGE_ACCOUNT_ID) {
    for (const e of cashEntries) {
      if (e.status === "voided" || e.currency !== currency) continue;
      if (e.customerId === EXCHANGE_ACCOUNT_ID) {
        balance += e.direction === "in" ? e.amount : -e.amount;
      }
    }
  } else {
    for (const e of ledger) {
      if (e.customerId === customerId && e.currency === currency) {
        balance += e.direction === "in" ? e.amount : -e.amount;
      }
    }
  }
  return balance;
}

function buildLedger(customers: Customer[], transactions: any[], hawalas: any[], cashEntries: any[]): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  if (!Array.isArray(customers) || !Array.isArray(transactions) || !Array.isArray(hawalas) || !Array.isArray(cashEntries)) return entries;

  for (const tx of transactions) {
    if (!tx || typeof tx !== "object") continue;
    if (tx.status === "voided" || tx.status === "cancelled") continue;
    const date = tx.date || new Date().toISOString();
    const refNum = tx.trackingCode || (tx.id ? String(tx.id).slice(-6) : "");
    const fromCur = tx.fromCurrency as Currency, toCur = tx.toCurrency as Currency;
    const commCur = tx.commissionCurrency as Currency | undefined;
    const fromAmt = Number(tx.fromAmount || 0) || 0, toAmt = Number(tx.toAmount || 0) || 0, commAmt = Number(tx.commission || 0) || 0;

    if (tx.type === "exchange") {
      const cid = tx.customerId || customers.find(c => c.name === (tx.customerName || tx.customerId))?.id;
      if (cid && isCurrency(fromCur) && isCurrency(toCur)) {
        entries.push({ id: `${tx.id}-out`, date, customerId: cid, type: "exchange", description: `فروش ${labels[fromCur]} - ${tx.rateLabel || ""}`, currency: fromCur, amount: fromAmt, direction: "out", balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum, counterPartyId: CASH_BOX_ID });
        entries.push({ id: `${tx.id}-in`, date, customerId: cid, type: "exchange", description: `خرید ${labels[toCur]} - ${tx.rateLabel || ""}`, currency: toCur, amount: toAmt, direction: "in", balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum, counterPartyId: CASH_BOX_ID });
        if (commAmt > 0 && isCurrency(commCur)) entries.push({ id: `${tx.id}-fee`, date, customerId: cid, type: "fee", description: "کارمزد معامله", currency: commCur, amount: commAmt, direction: "out", balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum });
      }
    }
    if (tx.type === "transfer") {
      const sId = tx.senderId || customers.find(c => c.name === (tx.senderName || tx.senderId))?.id;
      const rId = tx.receiverId || customers.find(c => c.name === (tx.receiverName || tx.receiverId))?.id;
      if (sId && isCurrency(fromCur)) {
        entries.push({ id: `${tx.id}-s-out`, date, customerId: sId, type: "transfer", description: `انتقال ${labels[fromCur]} به ${customers.find(c => c.id === rId)?.name || tx.receiverName || "—"}`, currency: fromCur, amount: fromAmt, direction: "out", balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum, counterPartyId: rId });
        if (tx.commissionPayer === "sender" && commAmt > 0 && isCurrency(commCur)) entries.push({ id: `${tx.id}-s-fee`, date, customerId: sId, type: "fee", description: "کارمزد انتقال", currency: commCur, amount: commAmt, direction: "out", balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum });
      }
      if (rId && isCurrency(toCur)) {
        entries.push({ id: `${tx.id}-r-in`, date, customerId: rId, type: "transfer", description: `دریافت ${labels[toCur]} از ${customers.find(c => c.id === sId)?.name || tx.senderName || "—"}`, currency: toCur, amount: toAmt, direction: "in", balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum, counterPartyId: sId });
        if (tx.commissionPayer === "receiver" && commAmt > 0 && isCurrency(commCur)) entries.push({ id: `${tx.id}-r-fee`, date, customerId: rId, type: "fee", description: "کارمزد انتقال", currency: commCur, amount: commAmt, direction: "out", balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum });
      }
    }
    if (tx.type === "convert") {
      const cid = tx.customerId || customers.find(c => c.name === (tx.customerName || tx.customerId))?.id;
      if (cid && isCurrency(fromCur) && isCurrency(toCur)) {
        entries.push({ id: `${tx.id}-c-out`, date, customerId: cid, type: "convert", description: `تبدیل از ${labels[fromCur]}`, currency: fromCur, amount: fromAmt, direction: "out", balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum });
        entries.push({ id: `${tx.id}-c-in`, date, customerId: cid, type: "convert", description: `تبدیل به ${labels[toCur]}`, currency: toCur, amount: toAmt, direction: "in", balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum });
        if (commAmt > 0 && isCurrency(commCur)) entries.push({ id: `${tx.id}-c-fee`, date, customerId: cid, type: "fee", description: "کارمزد تبدیل", currency: commCur, amount: commAmt, direction: "out", balanceAfter: 0, referenceId: tx.id, referenceNumber: refNum });
      }
    }
  }

  for (const h of hawalas) {
    if (!h || typeof h !== "object") continue;
    if (h.status === "cancelled") continue;
    const date = h.date || new Date().toISOString(), refNum = h.number || "";
    const sender = customers.find(c => c.id === h.senderId) || customers.find(c => c.name === h.senderName);
    const receiver = customers.find(c => c.id === h.receiverId) || customers.find(c => c.name === h.receiverName);
    const hFromCur = h.currencyFrom as Currency, hToCur = h.currencyTo as Currency, hFeeCur = h.feeCurrency as Currency;
    const hAmt = Number(h.amountFrom || 0) || 0, hFinal = Number(h.finalAmount || 0) || 0, hFee = Number(h.fee || 0) || 0;

    if (sender && isCurrency(hFromCur)) {
      entries.push({ id: `${h.id}-hs-out`, date, customerId: sender.id, type: "hawala", description: `حواله ارسالی به ${h.receiverName || "—"} (${h.destinationText || ""})`, currency: hFromCur, amount: hAmt, direction: "out", balanceAfter: 0, referenceId: h.id, referenceNumber: refNum, counterPartyId: receiver?.id });
      if (h.feePayer === "sender" && hFee > 0 && isCurrency(hFeeCur)) entries.push({ id: `${h.id}-hs-fee`, date, customerId: sender.id, type: "fee", description: "کارمزد حواله", currency: hFeeCur, amount: hFee, direction: "out", balanceAfter: 0, referenceId: h.id, referenceNumber: refNum });
    }
    if (receiver && h.status === "paid" && isCurrency(hToCur)) {
      entries.push({ id: `${h.id}-hr-in`, date: h.paidAt || h.date || date, customerId: receiver.id, type: "hawala", description: `دریافت حواله از ${h.senderName || "—"}`, currency: hToCur, amount: hFinal, direction: "in", balanceAfter: 0, referenceId: h.id, referenceNumber: refNum, counterPartyId: sender?.id });
      if (h.feePayer === "receiver" && hFee > 0 && isCurrency(hFeeCur)) entries.push({ id: `${h.id}-hr-fee`, date: h.paidAt || h.date || date, customerId: receiver.id, type: "fee", description: "کارمزد حواله", currency: hFeeCur, amount: hFee, direction: "out", balanceAfter: 0, referenceId: h.id, referenceNumber: refNum });
    }
  }

  for (const ce of cashEntries) {
    if (!ce || typeof ce !== "object") continue;
    if (ce.linkedHawalaId || ce.linkedHawalaSettleId || ce.linkedExchangeId || ce.linkedTransferId || ce.linkedConvertId) continue;
    if (ce.type !== "customer_deposit" && ce.type !== "customer_withdraw" && ce.type !== "loan_given" && ce.type !== "loan_received") continue;
    if (!ce.customerId) continue;
    if (!customers.find(c => c.id === ce.customerId) && ce.customerId !== EXCHANGE_ACCOUNT_ID) continue;

    const cur = ce.currency as Currency; if (!isCurrency(cur)) continue;
    const amt = Number(ce.amount || 0) || 0; if (amt <= 0) continue;

    const counterPartyId = ce.counterPartyId || (ce.type === "loan_given" || ce.type === "loan_received" ? EXCHANGE_ACCOUNT_ID : CASH_BOX_ID);
    const isIn = ce.type === "customer_deposit" || ce.type === "loan_received";

    entries.push({
      id: `${ce.id}-cash`, date: ce.date || new Date().toISOString(), customerId: ce.customerId,
      type: isIn ? "deposit" : "withdraw", description: ce.reason || entryTypeLabels[ce.type as CashEntryType] || "عملیات",
      currency: cur, amount: amt, direction: isIn ? "in" : "out", balanceAfter: 0,
      referenceId: ce.id, referenceNumber: ce.trackingCode || "", counterPartyId
    });
  }

  entries.sort((a, b) => { try { return new Date(a.date).getTime() - new Date(b.date).getTime(); } catch { return 0; } });

  const rb: Record<string, Record<Currency, number>> = {};
  for (const c of customers) rb[c.id] = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
  rb[EXCHANGE_ACCOUNT_ID] = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
  for (const e of entries) {
    if (!rb[e.customerId]) rb[e.customerId] = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    if (!isCurrency(e.currency)) continue;
    rb[e.customerId][e.currency] += e.direction === "in" ? e.amount : -e.amount;
    e.balanceAfter = rb[e.customerId][e.currency];
  }
  return entries;
}

function buildCashBoxLedger(cashEntries: any[]): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  if (!Array.isArray(cashEntries)) return entries;
  const sorted = [...cashEntries].sort((a, b) => { try { return new Date(a.date).getTime() - new Date(b.date).getTime(); } catch { return 0; } });
  const bals: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
  for (const ce of sorted) {
    if (ce.status === "voided") continue;
    if (ce.type === "customer_deposit" || ce.type === "customer_withdraw" || ce.type === "loan_given" || ce.type === "loan_received") continue;
    if (ce.linkedExchangeId || ce.linkedTransferId || ce.linkedConvertId || ce.linkedHawalaId || ce.linkedHawalaSettleId) continue;
    const cur = ce.currency as Currency; if (!isCurrency(cur)) continue;
    const amt = Number(ce.amount || 0) || 0; if (amt <= 0) continue;
    const isIn = ce.direction === "in";
    bals[cur] += isIn ? amt : -amt;
    let txType: TxType = "correction";
    if (ce.type === "owner_deposit") txType = "deposit";
    else if (ce.type === "owner_withdraw") txType = "withdraw";
    else if (ce.type === "fee") txType = "fee";
    else if (ce.type === "adjustment") txType = "correction";
    else if (ce.type === "commission_withdraw") txType = "withdraw";
    entries.push({ id: ce.id, date: ce.date || new Date().toISOString(), customerId: CASH_BOX_ID, type: txType, description: ce.reason || entryTypeLabels[ce.type as CashEntryType] || "عملیات صندوق", currency: cur, amount: amt, direction: isIn ? "in" : "out", balanceAfter: bals[cur], referenceId: ce.id, referenceNumber: ce.trackingCode || "" });
  }
  return entries;
}

export default function CustomersPage() {
  const [mounted, setMounted] = useState(false);
  const [customers, setCustomers, isLoadingCustomers] = useSyncedState<Customer[]>(CUSTOMERS_KEY, []);
  const [transactions, setTransactions] = useSyncedState<any[]>(TRANSACTIONS_KEY, []);
  const [hawalas, setHawalas] = useSyncedState<any[]>(HAWALAS_KEY, []);
  const [cashEntries, setCashEntries] = useSyncedState<any[]>(CASH_KEY, []);

  const [activeTab, setActiveTab] = useState<"list" | "new" | "profile">("list");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState<"info" | "balances" | "ledger" | "statement">("info");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [toast, setToast] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [search, setSearch] = useState("");
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<TxType | "all">("all");
  const [ledgerCurrencyFilter, setLedgerCurrencyFilter] = useState<Currency | "all">("all");
  const [ledgerDirFilter, setLedgerDirFilter] = useState<"all" | "in" | "out">("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [loanModalType, setLoanModalType] = useState<"give" | "receive">("give");
  const [loanAmount, setLoanAmount] = useState("");
  const [loanCurrency, setLoanCurrency] = useState<Currency>("AFN");
  const [loanReason, setLoanReason] = useState("");

  const [cwModalOpen, setCwModalOpen] = useState(false);
  const [cwType, setCwType] = useState<"deposit" | "withdraw">("deposit");
  const [cwAmount, setCwAmount] = useState("");
  const [cwCurrency, setCwCurrency] = useState<Currency>("AFN");
  const [cwReason, setCwReason] = useState("");

  useEffect(() => { try { const s = window.localStorage.getItem("fx-theme"); if (s === "dark" || s === "light") setTheme(s); } catch {} }, []);
  useEffect(() => { try { window.localStorage.setItem("fx-theme", theme); } catch {} }, [theme]);
  const dk = theme === "dark";

  useEffect(() => {
    try { initTrackingSystem(); } catch (err) { console.error(err); }
    setMounted(true);
  }, []);

  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const currentDateTime = now ? formatDateTime(now) : "";

  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e: MouseEvent) => { const target = e.target as HTMLElement; if (target.closest("[data-menu-toggle]")) return; if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null); };
    const timer = setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handler); };
  }, [openMenuId]);

  const ledger = useMemo(() => { try { return buildLedger(customers, transactions, hawalas, cashEntries); } catch { return []; } }, [customers, transactions, hawalas, cashEntries]);
  const cashBoxLedger = useMemo(() => { try { return buildCashBoxLedger(cashEntries); } catch { return []; } }, [cashEntries]);

  const allBalances = useMemo(() => {
    const map: Record<string, Record<Currency, number>> = {};
    customers.forEach(c => { if (c.id !== CASH_BOX_ID && c.id !== EXCHANGE_ACCOUNT_ID) { map[c.id] = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 }; } });
    map[CASH_BOX_ID] = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    map[EXCHANGE_ACCOUNT_ID] = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };

    for (const c of customers) {
      if (c.id !== CASH_BOX_ID && c.id !== EXCHANGE_ACCOUNT_ID) {
        for (const cur of currencies) { map[c.id][cur] = getLedgerBalance(c.id, cur, cashEntries, ledger); }
      }
    }
    map[EXCHANGE_ACCOUNT_ID] = {
      AFN: getLedgerBalance(EXCHANGE_ACCOUNT_ID, "AFN", cashEntries, ledger),
      USD: getLedgerBalance(EXCHANGE_ACCOUNT_ID, "USD", cashEntries, ledger),
      EUR: getLedgerBalance(EXCHANGE_ACCOUNT_ID, "EUR", cashEntries, ledger),
      IRR: getLedgerBalance(EXCHANGE_ACCOUNT_ID, "IRR", cashEntries, ledger),
      PKR: getLedgerBalance(EXCHANGE_ACCOUNT_ID, "PKR", cashEntries, ledger),
    };
    for (const cur of currencies) {
      let cashBoxTotal = 0;
      for (const c of customers) { if (c.id !== CASH_BOX_ID && c.id !== EXCHANGE_ACCOUNT_ID) { cashBoxTotal += map[c.id][cur]; } }
      cashBoxTotal += map[EXCHANGE_ACCOUNT_ID][cur];
      map[CASH_BOX_ID][cur] = cashBoxTotal;
    }
    return map;
  }, [customers, cashEntries, ledger]);

  const filteredCustomers = useMemo(() => {
    const cashBoxOption = CASH_BOX_CUSTOMER;
    const exchangeOption = EXCHANGE_ACCOUNT_CUSTOMER;
    const q = normalizeDigits(search.trim()).toLowerCase();

    const filtered = customers.filter(c => {
      if (c.id === EXCHANGE_ACCOUNT_ID) return false;
      if (!q) return true;
      return [c.name, c.phone || "", c.tazkira || "", c.telegram || "", c.id].some(f => normalizeDigits(String(f)).toLowerCase().includes(q));
    });

    const result: Customer[] = [];
    if (!q || CASH_BOX_NAME.includes(q)) result.push(cashBoxOption);
    if (!q || EXCHANGE_ACCOUNT_NAME.includes(q)) result.push(exchangeOption);
    result.push(...filtered);
    return result;
  }, [customers, search]);

  const selectedCustomer = useMemo(() => {
    if (selectedCustomerId === CASH_BOX_ID || selectedCustomerId === CASH_BOX_NAME) return CASH_BOX_CUSTOMER;
    if (selectedCustomerId === EXCHANGE_ACCOUNT_ID) return EXCHANGE_ACCOUNT_CUSTOMER;
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  const isCashBox = selectedCustomer?.id === CASH_BOX_ID;
  const isExchangeAccount = selectedCustomer?.id === EXCHANGE_ACCOUNT_ID;

  const customerBalances = useMemo(() => {
    if (!selectedCustomer) return null;
    return allBalances[selectedCustomer.id];
  }, [selectedCustomer, allBalances]);

  const customerLedger = useMemo(() => {
    if (selectedCustomerId === CASH_BOX_ID || selectedCustomerId === CASH_BOX_NAME) return cashBoxLedger;
    if (selectedCustomerId === EXCHANGE_ACCOUNT_ID) return ledger.filter(e => e.customerId === EXCHANGE_ACCOUNT_ID);
    return ledger.filter(e => e.customerId === selectedCustomerId);
  }, [ledger, cashBoxLedger, selectedCustomerId]);

  const filteredLedger = useMemo(() => {
    const q = normalizeDigits(ledgerSearch.trim()).replace(/[,،\s]/g, "").toLowerCase();
    return customerLedger.filter(e => {
      if (ledgerTypeFilter !== "all" && e.type !== ledgerTypeFilter) return false;
      if (ledgerCurrencyFilter !== "all" && e.currency !== ledgerCurrencyFilter) return false;
      if (ledgerDirFilter !== "all" && e.direction !== ledgerDirFilter) return false;
      if (!q) return true;
      const rawAmount = String(e.amount).replace(/[,،\s]/g, "");
      return [e.description, e.referenceNumber || "", labels[e.currency], rawAmount].some(f =>
        normalizeDigits(String(f)).replace(/[,،\s]/g, "").toLowerCase().includes(q)
      );
    }).reverse();
  }, [customerLedger, ledgerSearch, ledgerTypeFilter, ledgerCurrencyFilter, ledgerDirFilter]);

  const withBalanceCount = customers.filter(c => c.id !== EXCHANGE_ACCOUNT_ID && currencies.some(cur => allBalances[c.id][cur] !== 0)).length;
  const withoutBalanceCount = customers.filter(c => c.id !== EXCHANGE_ACCOUNT_ID && currencies.every(cur => allBalances[c.id][cur] === 0)).length;

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(""), 3500); };
  const openProfile = (id: string) => { setSelectedCustomerId(id); setProfileTab("info"); setActiveTab("profile"); setOpenMenuId(null); };
  const backToList = () => { setActiveTab("list"); setSelectedCustomerId(null); };

  const processCashOperation = () => {
    if (!selectedCustomer || selectedCustomer.id === CASH_BOX_ID || selectedCustomer.id === EXCHANGE_ACCOUNT_ID) {
      showToast("این عملیات فقط برای مشتریان عادی امکان‌پذیر است.");
      return;
    }
    const amt = Number(normalizeDigits(cwAmount).replace(/,/g, ""));
    if (!Number.isFinite(amt) || amt <= 0) { showToast("مبلغ معتبر وارد کنید."); return; }
    if (!isCurrency(cwCurrency)) return;

    const now = new Date().toISOString();
    const reason = cwReason.trim() || (cwType === "deposit" ? "واریز به حساب مشتری" : "برداشت از حساب مشتری");
    const trackingCode = `CW-${Date.now().toString(36).toUpperCase()}`;
    const newEntries: any[] = [];

    if (cwType === "deposit") {
      newEntries.push({ id: generateId(), trackingCode: `${trackingCode}-CUST`, date: now, type: "customer_deposit", currency: cwCurrency, amount: amt, direction: "in", reason: `واریز از صندوق - ${reason}`, balanceAfter: 0, customerId: selectedCustomer.id, customerName: selectedCustomer.name, counterPartyId: CASH_BOX_ID, status: "active" });
      newEntries.push({ id: generateId(), trackingCode: `${trackingCode}-CASH`, date: now, type: "customer_withdraw", currency: cwCurrency, amount: amt, direction: "out", reason: `واریز به ${selectedCustomer.name} - ${reason}`, balanceAfter: 0, customerId: CASH_BOX_ID, customerName: CASH_BOX_NAME, counterPartyId: selectedCustomer.id, status: "active" });
    } else {
      newEntries.push({ id: generateId(), trackingCode: `${trackingCode}-CUST`, date: now, type: "customer_withdraw", currency: cwCurrency, amount: amt, direction: "out", reason: `برداشت به صندوق - ${reason}`, balanceAfter: 0, customerId: selectedCustomer.id, customerName: selectedCustomer.name, counterPartyId: CASH_BOX_ID, status: "active" });
      newEntries.push({ id: generateId(), trackingCode: `${trackingCode}-CASH`, date: now, type: "customer_deposit", currency: cwCurrency, amount: amt, direction: "in", reason: `برداشت از ${selectedCustomer.name} - ${reason}`, balanceAfter: 0, customerId: CASH_BOX_ID, customerName: CASH_BOX_NAME, counterPartyId: selectedCustomer.id, status: "active" });
    }

    setCashEntries(prev => [...prev, ...newEntries]);
    setCwModalOpen(false);
    showToast(cwType === "deposit" ? `✅ ${fmt(amt)} ${labels[cwCurrency]} به "${selectedCustomer.name}" واریز شد.` : `✅ ${fmt(amt)} ${labels[cwCurrency]} از "${selectedCustomer.name}" برداشت شد.`);
  };

  const processLoan = () => {
    if (!selectedCustomer || selectedCustomer.id === CASH_BOX_ID || selectedCustomer.id === EXCHANGE_ACCOUNT_ID) {
      showToast("فقط برای مشتریان واقعی قابل انجام است."); return;
    }
    const amt = Number(normalizeDigits(loanAmount).replace(/,/g, ""));
    if (!Number.isFinite(amt) || amt <= 0) { showToast("مبلغ معتبر وارد کنید."); return; }
    if (!isCurrency(loanCurrency)) return;

    const now = new Date().toISOString();
    const reason = loanReason.trim() || (loanModalType === "give" ? "قرض به مشتری" : "بازپرداخت قرض توسط مشتری");
    const trackingCode = `LN-${Date.now().toString(36).toUpperCase()}`;
    const newEntries: any[] = [];

    if (loanModalType === "give") {
      newEntries.push({ id: generateId(), trackingCode: `${trackingCode}-CUST`, date: now, type: "loan_given", currency: loanCurrency, amount: amt, direction: "in", reason: `قرض داده‌شده - ${reason}`, balanceAfter: 0, customerId: selectedCustomer.id, customerName: selectedCustomer.name, counterPartyId: EXCHANGE_ACCOUNT_ID, status: "active" });
      newEntries.push({ id: generateId(), trackingCode: `${trackingCode}-EXCH`, date: now, type: "loan_given", currency: loanCurrency, amount: amt, direction: "out", reason: `قرض به ${selectedCustomer.name} - ${reason}`, balanceAfter: 0, customerId: EXCHANGE_ACCOUNT_ID, customerName: EXCHANGE_ACCOUNT_NAME, counterPartyId: selectedCustomer.id, status: "active" });
    } else {
      newEntries.push({ id: generateId(), trackingCode: `${trackingCode}-CUST`, date: now, type: "loan_received", currency: loanCurrency, amount: amt, direction: "out", reason: `بازپرداخت قرض - ${reason}`, balanceAfter: 0, customerId: selectedCustomer.id, customerName: selectedCustomer.name, counterPartyId: EXCHANGE_ACCOUNT_ID, status: "active" });
      newEntries.push({ id: generateId(), trackingCode: `${trackingCode}-EXCH`, date: now, type: "loan_received", currency: loanCurrency, amount: amt, direction: "in", reason: `دریافت قرض از ${selectedCustomer.name} - ${reason}`, balanceAfter: 0, customerId: EXCHANGE_ACCOUNT_ID, customerName: EXCHANGE_ACCOUNT_NAME, counterPartyId: selectedCustomer.id, status: "active" });
    }
    setCashEntries(prev => [...prev, ...newEntries]);
    setLoanModalOpen(false);
    showToast(loanModalType === "give" ? `✅ ${fmt(amt)} ${labels[loanCurrency]} به "${selectedCustomer.name}" قرض داده شد.` : `✅ ${fmt(amt)} ${labels[loanCurrency]} از "${selectedCustomer.name}" دریافت شد.`);
  };

  const deleteCustomer = (id: string) => {
    if (id === CASH_BOX_ID || id === EXCHANGE_ACCOUNT_ID) return;
    setOpenMenuId(null);
    const c = customers.find(x => x.id === id);
    if (!c) return;

    const confirmName = prompt(`برای تأیید حذف، نام مشتری "${c.name}" را دقیقاً تایپ کنید:`);
    if (confirmName !== c.name) { showToast("❌ نام وارد شده مطابقت ندارد. عملیات لغو شد."); return; }

    const hasBal = currencies.some(cur => allBalances[id][cur] !== 0);
    if (hasBal) { alert("⚠️ هشدار: این مشتری دارای موجودی است! لطفاً قبل از حذف، موجودی را صفر کنید."); return; }

    setTransactions(prev => prev.map((t: any) => { if (t.customerId === id || t.customerName === c.name || t.senderId === id || t.senderName === c.name || t.receiverId === id || t.receiverName === c.name) return { ...t, customerDeleted: true }; return t; }));
    setHawalas(prev => prev.map((h: any) => { if (h.senderId === id || h.senderName === c.name || h.receiverId === id || h.receiverName === c.name) return { ...h, customerDeleted: true }; return h; }));
    setCashEntries(prev => prev.map((ce: any) => { if (ce.customerId === id || ce.customerName === c.name) return { ...ce, customerDeleted: true }; return ce; }));
    setCustomers(p => p.filter(x => x.id !== id));

    if (selectedCustomerId === id) { setSelectedCustomerId(null); setActiveTab("list"); }
    showToast(`"${c.name}" حذف شد.`);
  };

  const validateForm = () => {
    const errs: FormErrors = {};
    if (!form.name.trim()) errs.name = "نام ضروری است.";
    if (!form.phone.trim()) errs.phone = "تماس ضروری است.";
    const currentId = selectedCustomer?.id;
    if (customers.find(c => c.phone === form.phone.trim() && c.id !== EXCHANGE_ACCOUNT_ID && c.id !== currentId)) errs.phone = "تکراری است.";
    if (form.tazkira.trim() && customers.find(c => c.tazkira === form.tazkira.trim() && c.id !== EXCHANGE_ACCOUNT_ID && c.id !== currentId)) errs.tazkira = "تکراری است.";
    return errs;
  };

  const submitNew = () => {
    const errs = validateForm(); setErrors(errs);
    if (Object.keys(errs).length > 0) { showToast("فیلدها را تکمیل کنید."); return; }
    if (customers.length === 0 && !window.confirm("آیا مطمئن هستید؟ این اولین مشتری ثبت‌شده است.")) return;

    const nc: Customer = { id: generateId(), name: form.name.trim(), phone: form.phone.trim(), tazkira: form.tazkira.trim(), address: form.address.trim(), note: form.note.trim(), telegram: form.telegram.trim(), registeredAt: new Date().toISOString(), balances: { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 } };
    setCustomers(p => [...p, nc]); setForm(emptyForm); setErrors({}); setActiveTab("list");
    showToast(`"${nc.name}" ثبت شد.`);
  };

  const updateCustomer = () => {
    if (!selectedCustomer || isCashBox || isExchangeAccount) return;
    const oldName = selectedCustomer.name;
    const newName = form.name.trim();
    setCustomers(p => p.map(c => c.id === selectedCustomer.id ? { ...c, name: newName, phone: form.phone.trim(), tazkira: form.tazkira.trim(), address: form.address.trim(), note: form.note.trim(), telegram: form.telegram.trim() } : c));
    if (oldName !== newName) {
      setTransactions(prev => prev.map((t: any) => { const u = { ...t }; if (t.customerName === oldName) u.customerName = newName; if (t.senderName === oldName) u.senderName = newName; if (t.receiverName === oldName) u.receiverName = newName; return u; }));
      setHawalas(prev => prev.map((h: any) => { const u = { ...h }; if (h.senderName === oldName) u.senderName = newName; if (h.receiverName === oldName) u.receiverName = newName; return u; }));
      setCashEntries(prev => prev.map((ce: any) => { const u = { ...ce }; if (ce.customerName === oldName) u.customerName = newName; return u; }));
    }
    showToast("به‌روز شد.");
  };

  useEffect(() => { if (profileTab === "info" && selectedCustomer && selectedCustomer.id !== CASH_BOX_ID && selectedCustomer.id !== EXCHANGE_ACCOUNT_ID) { setForm({ name: selectedCustomer.name, phone: selectedCustomer.phone || "", tazkira: selectedCustomer.tazkira || "", address: selectedCustomer.address || "", note: selectedCustomer.note || "", telegram: selectedCustomer.telegram || "" }); } }, [profileTab, selectedCustomer]);

  const printStatement = () => {
    if (!selectedCustomer || !customerBalances) return;
    try {
      const win = window.open("", "_blank", "width=1000,height=700"); if (!win) return;
      const title = isCashBox ? "صورت‌حساب صندوق صرافی" : isExchangeAccount ? "صورت‌حساب حساب صرافی" : `صورت‌حساب ${selectedCustomer.name}`;
      const customerInfo = isCashBox ? "موجودی فیزیکی صندوق صرافی" : isExchangeAccount ? "موجودی حساب داخلی صرافی" : `تلفن: ${selectedCustomer.phone || "-"} | تذکره: ${selectedCustomer.tazkira || "-"}`;
      win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1><p>${customerInfo}</p><p>تعداد گردش‌ها: ${customerLedger.length}</p></body></html>`);
      win.document.close(); win.focus();
    } catch { showToast("خطا در چاپ"); }
  };

  if (!mounted || isLoadingCustomers) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-emerald-500" />
          <p className="mt-4 text-slate-500 font-bold">در حال بارگذاری اطلاعات مشتریان...</p>
        </div>
      </div>
    );
  }

  const headingText = dk ? "text-white" : "text-slate-900";
  const subTextVar = dk ? "text-slate-500" : "text-slate-400";
  const uiCard = `rounded-2xl border backdrop-blur transition-colors duration-300 ${dk ? "border-slate-700 bg-slate-800/90 shadow-lg" : "border-emerald-100 bg-white/95 shadow-lg"}`;
  const glassCard = `rounded-2xl border backdrop-blur transition-all duration-300 ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-white/80"}`;
  const inputShell = `rounded-xl border text-sm font-medium shadow-sm outline-none transition-all duration-200 focus:ring-4 ${dk ? "border-slate-600 bg-slate-900 text-slate-100 focus:border-emerald-400" : "border-slate-200 bg-white text-slate-800 focus:border-emerald-500"}`;
  const uiInput = `h-12 w-full px-3.5 ${inputShell}`;
  const glassChip = dk ? "border-slate-600/70 bg-slate-800/80" : "border-emerald-100 bg-white/85";

  return (
    <div dir="rtl" className={dk ? "dark" : ""}>
      <style>{`@import url("https://fonts.googleapis.com/css2?family=Lalezar&family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap");.cu-font{font-family:"Vazirmatn","Segoe UI",Tahoma,sans-serif}.cu-display{font-family:"Lalezar","Vazirmatn",Tahoma,sans-serif}.dark{color-scheme:dark}@keyframes cuUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}.cu-up{animation:cuUp .5s cubic-bezier(.22,.8,.35,1) both}.cu-scroll::-webkit-scrollbar{height:6px;width:6px}.cu-scroll::-webkit-scrollbar-thumb{background:rgba(16,185,129,.3);border-radius:3px}.cu-scroll{scrollbar-width:thin}`}</style>
      <div className={`cu-font relative min-h-screen overflow-x-hidden antialiased transition-colors duration-500 ${dk ? "bg-[#0f172a] text-slate-100" : "bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 text-slate-800"}`}>
        <div className="relative z-10 mx-auto w-full max-w-7xl space-y-4 md:space-y-6 px-3 pb-16 pt-5 md:px-8 md:pt-9">
          <header className="cu-up flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0">
              <div className="relative grid h-11 w-11 md:h-14 md:w-14 shrink-0 place-items-center rounded-xl md:rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-400 text-white shadow-lg">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 md:h-6 md:w-6"><path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>
              </div>
              <div className="min-w-0">
                <h1 className={`cu-display text-2xl md:text-4xl leading-none ${headingText}`}>مدیریت مشتریان</h1>
                <p className={`mt-1 text-[10px] md:text-xs font-bold ${subTextVar}`}>پروندهٔ کامل، گردش حساب و سوابق مالی</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2.5">
              <div className={`hidden sm:flex items-center gap-2 rounded-xl border px-3 py-2 shadow-sm ${glassChip}`}>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                <span dir="ltr" className={`text-xs font-bold tabular-nums ${dk ? "text-slate-100" : "text-slate-700"}`}>{currentDateTime || "--:--"}</span>
              </div>
              <button onClick={() => setTheme(dk ? "light" : "dark")} className={`grid h-10 w-10 md:h-11 md:w-11 cursor-pointer place-items-center rounded-lg border shadow-sm transition-all active:scale-90 ${dk ? "border-slate-600 bg-slate-800/85 text-amber-300" : "border-slate-200 bg-white/85 text-slate-600"}`}>
                {dk ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.375 3.375 0 1 1-7.5 0 3.375 3.375 0 0 1 7.5 0Z" /></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" /></svg>}
              </button>
            </div>
          </header>

          <div className="cu-up grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "کل مشتریان", value: customers.filter(c => c.id !== EXCHANGE_ACCOUNT_ID).length, color: "from-emerald-500 to-teal-500", text: dk ? "text-emerald-300" : "text-emerald-600" },
              { label: "رویدادهای مالی", value: ledger.length + cashBoxLedger.length, color: "from-amber-500 to-orange-500", text: dk ? "text-amber-300" : "text-amber-600" },
              { label: "با موجودی", value: withBalanceCount, color: "from-sky-500 to-cyan-500", text: dk ? "text-sky-300" : "text-sky-600" },
              { label: "بدون موجودی", value: withoutBalanceCount, color: "from-rose-500 to-pink-500", text: dk ? "text-rose-300" : "text-rose-600" },
              { label: "💰 موجودی صندوق", value: fmt((Object.values(allBalances[CASH_BOX_ID] || {}) as number[]).reduce((a, b) => a + Math.abs(b), 0)), color: "from-violet-500 to-purple-500", text: dk ? "text-violet-300" : "text-violet-600" },
            ].map((s, i) => (
              <div key={i} className={`group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${glassCard}`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${s.color} opacity-0 transition-opacity group-hover:opacity-10`} />
                <div className="relative">
                  <div className={`text-[10px] font-black ${subTextVar}`}>{s.label}</div>
                  <div className={`text-lg md:text-2xl font-black tabular-nums mt-1 ${s.text}`}>{s.value}</div>
                </div>
              </div>
            ))}
          </div>

          <div className={`cu-up flex gap-1.5 md:gap-2 rounded-xl md:rounded-2xl border p-1.5 md:p-2 shadow-sm backdrop-blur ${glassChip}`}>
            {[
              { id: "list" as const, label: "فهرست مشتریان" },
              { id: "new" as const, label: "ثبت مشتری جدید" }
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg md:rounded-xl px-3 md:px-5 py-2.5 md:py-3 text-xs md:text-sm font-black transition-all active:scale-[0.97] ${activeTab === tab.id ? `bg-gradient-to-l shadow-lg ${dk ? "from-emerald-400 to-teal-400 text-slate-950" : "from-emerald-500 to-teal-500 text-white"}` : dk ? "text-slate-400 hover:bg-slate-700/60" : "text-slate-500 hover:bg-emerald-50"}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "list" && (
            <section className={`cu-up space-y-4 md:space-y-5 p-4 md:p-6 ${uiCard}`}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className={`cu-display text-xl md:text-2xl leading-none ${headingText}`}>فهرست مشتریان</h2>
                  <p className={`mt-1 text-[11px] font-bold ${subTextVar}`}>{customers.length} مشتری ثبت‌شده</p>
                </div>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو..." className={`${uiInput} w-auto md:w-64`} />
              </div>

              <div className="md:hidden space-y-3">
                {filteredCustomers.map(c => {
                  const isCashBoxRow = c.id === CASH_BOX_ID;
                  const isExchRow = c.id === EXCHANGE_ACCOUNT_ID;

                  return (
                    <div key={c.id} className={`rounded-2xl border p-4 ${glassCard} ${isCashBoxRow ? (dk ? "border-emerald-400/30" : "border-emerald-200") : ""} ${isExchRow ? (dk ? "border-violet-400/30" : "border-violet-200") : ""}`}>
                      <div className="flex items-start gap-3">
                        <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${isCashBoxRow ? "from-emerald-500 to-teal-500" : isExchRow ? "from-violet-500 to-purple-500" : "from-emerald-500 to-teal-500"} text-white font-black text-lg shadow-lg`}>
                          {isCashBoxRow ? "💰" : isExchRow ? "🏦" : c.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <b className={`text-sm font-black ${dk ? "text-slate-100" : "text-slate-800"}`}>{c.name}</b>
                          {isCashBoxRow && <span className={`mr-2 text-[9px] font-black ${dk ? "text-emerald-300" : "text-emerald-600"}`}>صندوق</span>}
                          {isExchRow && <span className={`mr-2 text-[9px] font-black ${dk ? "text-violet-300" : "text-violet-600"}`}>حساب صرافی</span>}
                          {!isCashBoxRow && !isExchRow && (
                            <div className={`text-[11px] ${subTextVar} mt-1 space-y-0.5`}>
                              <div>📱 <span dir="ltr">{c.phone || "-"}</span></div>
                              <div>🆔 <span dir="ltr">{c.tazkira || "-"}</span></div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-dashed border-slate-200 dark:border-slate-700">
                        <div className="text-[10px] font-black text-slate-400 mb-2 text-center">موجودی حساب:</div>
                        <div className="flex flex-wrap gap-2 justify-center">
                          {currencies.map(cur => {
                            const balance = allBalances[c.id][cur];
                            const isPositive = balance >= 0;
                            const colorClass = isPositive ? currencyColors[cur][dk ? "dark" : "light"] : "text-rose-500 bg-rose-50 dark:bg-rose-900/20";
                            return (
                              <span key={cur} className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg font-bold border ${colorClass} ${dk ? "border-slate-700" : "border-slate-200"}`}>
                                <span className="opacity-70">{labels[cur]}</span>
                                <span>{fmt(balance)}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 mt-3">
                        <button onClick={() => openProfile(c.id)} className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-bold cursor-pointer ${dk ? "border-emerald-400/30 text-emerald-300" : "border-emerald-300 text-emerald-600"}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                          مشاهده پرونده
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden md:block overflow-x-auto cu-scroll">
                <table className="w-full text-sm text-right">
                  <thead className={`text-xs uppercase ${dk ? "text-slate-400 bg-slate-800/50" : "text-slate-500 bg-slate-50"}`}>
                    <tr>
                      <th className="px-4 py-3 rounded-r-lg w-1/4">نام مشتری</th>
                      <th className="px-4 py-3 w-1/6">تماس / تذکره</th>
                      <th className="px-4 py-3 w-2/4 text-center">موجودی‌ها (یکجا)</th>
                      <th className="px-4 py-3 rounded-l-lg text-center w-1/6">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredCustomers.map(c => (
                      <tr key={c.id} className={`transition-colors hover:${dk ? "bg-slate-800/50" : "bg-slate-50"}`}>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-800 dark:text-slate-100">{c.name}</div>
                          {c.id === CASH_BOX_ID && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">صندوق</span>}
                          {c.id === EXCHANGE_ACCOUNT_ID && <span className="text-[10px] text-violet-600 dark:text-violet-400 font-bold">حساب صرافی</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          <div dir="ltr" className="text-xs font-mono">{c.phone || "-"}</div>
                          <div dir="ltr" className="text-xs font-mono text-slate-400">{c.tazkira || "-"}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-wrap gap-2 justify-center items-center">
                            {currencies.map(cur => {
                              const balance = allBalances[c.id][cur];
                              const isPositive = balance >= 0;
                              const colorClass = isPositive ? currencyColors[cur][dk ? "dark" : "light"] : "text-rose-500 bg-rose-50 dark:bg-rose-900/20";
                              return (
                                <span key={cur} className={`inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg font-bold border shadow-sm ${colorClass} ${dk ? "border-slate-700" : "border-slate-200"}`}>
                                  <span className="opacity-70 text-[10px]">{labels[cur]}</span>
                                  <span className="tabular-nums">{fmt(balance)}</span>
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => openProfile(c.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 dark:bg-sky-900/20 px-3 py-1.5 text-xs font-bold text-sky-600 dark:text-sky-400 transition-colors hover:bg-sky-100 dark:hover:bg-sky-900/40">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                            پرونده
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === "new" && (
            <section className={`cu-up space-y-4 p-4 md:p-6 ${uiCard}`}>
              <h2 className={`cu-display text-xl md:text-2xl leading-none ${headingText}`}>ثبت مشتری جدید</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-1">نام *</label>
                  <input className={uiInput} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="نام کامل مشتری" />
                  {errors.name && <span className="text-xs text-rose-500">{errors.name}</span>}
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">شماره تماس *</label>
                  <input className={uiInput} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="0799123456" />
                  {errors.phone && <span className="text-xs text-rose-500">{errors.phone}</span>}
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">شماره تذکره</label>
                  <input className={uiInput} value={form.tazkira} onChange={e => setForm({ ...form, tazkira: e.target.value })} placeholder="شماره تذکره" />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">تلگرام</label>
                  <input className={uiInput} value={form.telegram} onChange={e => setForm({ ...form, telegram: e.target.value })} placeholder="@username" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold mb-1">آدرس</label>
                  <input className={uiInput} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="آدرس کامل" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold mb-1">یادداشت</label>
                  <textarea className={`${inputShell} h-24 w-full px-3.5 py-3`} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="توضیحات اضافی..." />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={submitNew} className="flex-1 rounded-xl bg-gradient-to-l from-emerald-500 to-teal-500 px-6 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl transition-all active:scale-[0.97]">
                  ثبت مشتری
                </button>
                <button onClick={() => setActiveTab("list")} className="px-6 py-3 rounded-xl border text-sm font-bold">انصراف</button>
              </div>
            </section>
          )}

          {/* ✅ بخش اصلاح‌شده: نمایش صورت حساب در نمای پرونده */}
          {activeTab === "profile" && selectedCustomer && (
            <section className={`cu-up space-y-4 p-4 md:p-6 ${uiCard}`}>
              <div className="flex items-center justify-between">
                <button onClick={backToList} className="text-sm font-bold text-sky-600 dark:text-sky-400">← بازگشت به فهرست</button>
                <h2 className={`cu-display text-xl md:text-2xl leading-none ${headingText}`}>{selectedCustomer.name}</h2>
                {!isCashBox && !isExchangeAccount && (
                  <div className="flex gap-2">
                    <button onClick={() => setCwModalOpen(true)} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">واریز/برداشت</button>
                    <button onClick={() => deleteCustomer(selectedCustomer.id)} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">حذف</button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-5 gap-2">
                {currencies.map(cur => {
                  const balance = customerBalances?.[cur] || 0;
                  const colorClass = balance >= 0 ? currencyColors[cur][dk ? "dark" : "light"] : "text-rose-500 bg-rose-50";
                  return (
                    <div key={cur} className={`rounded-xl p-3 border ${dk ? "border-slate-700 bg-slate-900/50" : "border-slate-200 bg-white"}`}>
                      <div className="text-[10px] font-bold text-center text-slate-400">{labels[cur]}</div>
                      <div className={`text-sm font-black text-center mt-1 ${colorClass.split(" ")[0]}`}>{fmt(balance)}</div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-3">
                <div>
                  <span className="text-xs font-bold text-slate-500">📱 تماس:</span>
                  <span className="mr-2 text-sm font-bold" dir="ltr">{selectedCustomer.phone || "-"}</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-500">🆔 تذکره:</span>
                  <span className="mr-2 text-sm font-bold" dir="ltr">{selectedCustomer.tazkira || "-"}</span>
                </div>
                {selectedCustomer.address && (
                  <div>
                    <span className="text-xs font-bold text-slate-500">📍 آدرس:</span>
                    <span className="mr-2 text-sm font-bold">{selectedCustomer.address}</span>
                  </div>
                )}
              </div>

              {/* ✅ اضافه شده: جدول صورت حساب و گردش مالی مشتری */}
              <div className="mt-6 pt-6 border-t border-dashed border-slate-200 dark:border-slate-700">
                <h3 className={`text-lg font-black mb-4 flex items-center gap-2 ${headingText}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-sky-500"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                  صورت حساب و گردش مالی
                </h3>
                
                {customerLedger.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm font-bold bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                    هنوز هیچ گردش مالی برای این مشتری ثبت نشده است.
                  </div>
                ) : (
                  <div className="overflow-x-auto cu-scroll rounded-xl border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-sm text-right">
                      <thead className={`text-xs uppercase ${dk ? "bg-slate-800 text-slate-400" : "bg-slate-50 text-slate-500"}`}>
                        <tr>
                          <th className="px-3 py-3 rounded-r-lg">تاریخ</th>
                          <th className="px-3 py-3">شرح</th>
                          <th className="px-3 py-3">نوع</th>
                          <th className="px-3 py-3">ارز</th>
                          <th className="px-3 py-3 text-left">واریز</th>
                          <th className="px-3 py-3 text-left">برداشت</th>
                          <th className="px-3 py-3 rounded-l-lg text-left">مانده</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {customerLedger.slice().reverse().map((e) => (
                          <tr key={e.id} className={`transition-colors ${dk ? "hover:bg-slate-800/50" : "hover:bg-slate-50"}`}>
                            <td className="px-3 py-3 text-xs font-mono whitespace-nowrap">
                              <div>{shortDateLabel(e.date)}</div>
                              <div className="text-slate-400">{timeLabel(e.date)}</div>
                            </td>
                            <td className="px-3 py-3 font-bold text-slate-700 dark:text-slate-200 max-w-[200px] truncate" title={e.description}>
                              {e.description}
                            </td>
                            <td className="px-3 py-3">
                              <span className={`text-[10px] px-2 py-1 rounded-md font-bold ${txColors[e.type] ? (dk ? txColors[e.type].dark : txColors[e.type].light) : "bg-slate-100 text-slate-600"}`}>
                                {txLabels[e.type] || e.type}
                              </span>
                            </td>
                            <td className="px-3 py-3 font-bold">{labels[e.currency]}</td>
                            <td className="px-3 py-3 text-left font-mono text-emerald-600 dark:text-emerald-400">
                              {e.direction === "in" ? fmt(e.amount) : "-"}
                            </td>
                            <td className="px-3 py-3 text-left font-mono text-rose-600 dark:text-rose-400">
                              {e.direction === "out" ? fmt(e.amount) : "-"}
                            </td>
                            <td className="px-3 py-3 text-left font-black font-mono text-slate-800 dark:text-slate-100">
                              {fmt(e.balanceAfter)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Modal واریز/برداشت */}
          {cwModalOpen && selectedCustomer && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className={`w-full max-w-md rounded-2xl p-6 ${dk ? "bg-slate-800" : "bg-white"} shadow-2xl`}>
                <h3 className="text-lg font-bold mb-4">عملیات مالی برای {selectedCustomer.name}</h3>
                <div className="flex gap-2 mb-4">
                  <button onClick={() => setCwType("deposit")} className={`flex-1 py-2 rounded-lg font-bold text-sm ${cwType === "deposit" ? "bg-emerald-500 text-white" : "bg-slate-100 dark:bg-slate-700"}`}>واریز</button>
                  <button onClick={() => setCwType("withdraw")} className={`flex-1 py-2 rounded-lg font-bold text-sm ${cwType === "withdraw" ? "bg-rose-500 text-white" : "bg-slate-100 dark:bg-slate-700"}`}>برداشت</button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold">مبلغ</label>
                    <input className={uiInput} value={cwAmount} onChange={e => setCwAmount(e.target.value)} placeholder="0" />
                  </div>
                  <div>
                    <label className="text-xs font-bold">ارز</label>
                    <select className={uiInput} value={cwCurrency} onChange={e => setCwCurrency(e.target.value as Currency)}>
                      {currencies.map(c => <option key={c} value={c}>{c} - {labels[c]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold">دلیل</label>
                    <input className={uiInput} value={cwReason} onChange={e => setCwReason(e.target.value)} placeholder="دلیل عملیات" />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={processCashOperation} className="flex-1 py-3 rounded-xl bg-gradient-to-l from-emerald-500 to-teal-500 text-white font-bold">انجام</button>
                  <button onClick={() => setCwModalOpen(false)} className="px-6 py-3 rounded-xl border font-bold">لغو</button>
                </div>
              </div>
            </div>
          )}

          {/* Modal قرض */}
          {loanModalOpen && selectedCustomer && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className={`w-full max-w-md rounded-2xl p-6 ${dk ? "bg-slate-800" : "bg-white"} shadow-2xl`}>
                <h3 className="text-lg font-bold mb-4">قرض برای {selectedCustomer.name}</h3>
                <div className="flex gap-2 mb-4">
                  <button onClick={() => setLoanModalType("give")} className={`flex-1 py-2 rounded-lg font-bold text-sm ${loanModalType === "give" ? "bg-emerald-500 text-white" : "bg-slate-100 dark:bg-slate-700"}`}>قرض دادن</button>
                  <button onClick={() => setLoanModalType("receive")} className={`flex-1 py-2 rounded-lg font-bold text-sm ${loanModalType === "receive" ? "bg-rose-500 text-white" : "bg-slate-100 dark:bg-slate-700"}`}>بازپرداخت</button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold">مبلغ</label>
                    <input className={uiInput} value={loanAmount} onChange={e => setLoanAmount(e.target.value)} placeholder="0" />
                  </div>
                  <div>
                    <label className="text-xs font-bold">ارز</label>
                    <select className={uiInput} value={loanCurrency} onChange={e => setLoanCurrency(e.target.value as Currency)}>
                      {currencies.map(c => <option key={c} value={c}>{c} - {labels[c]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold">دلیل</label>
                    <input className={uiInput} value={loanReason} onChange={e => setLoanReason(e.target.value)} placeholder="دلیل قرض" />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={processLoan} className="flex-1 py-3 rounded-xl bg-gradient-to-l from-emerald-500 to-teal-500 text-white font-bold">انجام</button>
                  <button onClick={() => setLoanModalOpen(false)} className="px-6 py-3 rounded-xl border font-bold">لغو</button>
                </div>
              </div>
            </div>
          )}

          {/* Toast Notification */}
          {toast && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
              <div className={`px-6 py-3 rounded-xl shadow-2xl text-sm font-bold text-white ${toast.includes("❌") ? "bg-rose-600" : "bg-emerald-600"}`}>
                {toast}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
