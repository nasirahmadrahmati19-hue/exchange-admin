"use client";
import { useEffect, useMemo, useState, useRef, useCallback, type ReactNode } from "react";
import { useSyncedState } from "../../lib/useSyncedState";
import { initTrackingSystem } from "../../lib/trackingCode";
import { CUSTOMERS_KEY, TRANSACTIONS_KEY, HAWALAS_KEY, CASH_KEY } from "../../lib/defaultData";

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
          disabled={!hasBotToken} title={hasBotToken ? "انتخاب از لیست کاربران ربات" : "ابتدا توکن ربات را در تنظیمات وارد کنید"}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M6 12 3.269 3.126A59.768 59.768 0 0 1 21.485 12 59.77 59.77 0 0 1 3.27 20.876L5.999 12Zm0 0h7.5" /></svg>
          لیست
        </button>
      </div>
      {open && (
        <div className={`absolute right-0 left-0 top-full z-50 mt-2 max-h-80 overflow-hidden rounded-xl border shadow-2xl ${dk ? "border-slate-600 bg-slate-800" : "border-slate-200 bg-white"}`}>
          <div className={`flex items-center justify-between border-b px-3 py-2.5 ${dk ? "border-slate-700" : "border-slate-100"}`}>
            <div className="flex items-center gap-2">
              <span className={`grid h-6 w-6 place-items-center rounded-lg ${dk ? "bg-sky-400/15 text-sky-300" : "bg-sky-100 text-sky-600"}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M6 12 3.269 3.126A59.768 59.768 0 0 1 21.485 12 59.77 59.77 0 0 1 3.27 20.876L5.999 12Zm0 0h7.5" /></svg>
              </span>
              <span className={`text-xs font-black ${heading}`}>کاربران ربات ({users.length})</span>
            </div>
            <button type="button" onClick={loadUsers} disabled={loading} className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black transition-all ${dk ? "bg-sky-500/15 text-sky-300 hover:bg-sky-500/25" : "bg-sky-50 text-sky-700 hover:bg-sky-100"} disabled:opacity-50`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}><path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
              {loading ? "..." : "بروز"}
            </button>
          </div>
          <div className={`border-b px-3 py-2 ${dk ? "border-slate-700" : "border-slate-100"}`}>
            <input dir="ltr" className={`h-9 w-full rounded-lg border px-3 text-[11px] font-bold outline-none ${dk ? "border-slate-600 bg-slate-900 text-slate-200 placeholder:text-slate-500" : "border-slate-200 bg-slate-50 text-slate-700 placeholder:text-slate-400"}`} value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو بر اساس نام یا username..." />
          </div>
          <div className="max-h-56 overflow-y-auto cu-scroll">
            {!hasBotToken ? <div className="px-4 py-6 text-center"><div className={`text-[11px] font-bold ${subText}`}>⚠️ تلگرام فعال نیست</div></div>
            : loading && users.length === 0 ? <div className="px-4 py-6 text-center"><div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" /><div className={`mt-2 text-[11px] font-bold ${subText}`}>در حال بارگذاری...</div></div>
            : lastError ? <div className="px-4 py-6 text-center"><div className={`text-[11px] font-bold ${dk ? "text-amber-300" : "text-amber-600"}`}>⚠️ {lastError}</div></div>
            : filteredUsers.length === 0 ? <div className="px-4 py-6 text-center"><div className={`text-[11px] font-bold ${subText}`}>{search ? "کاربری با این مشخصات یافت نشد" : "هنوز کاربری ربات را start نکرده"}</div></div>
            : filteredUsers.map(user => (
                <button key={user.id} type="button" onClick={() => selectUser(user)} className={`flex w-full items-center justify-between gap-2 border-b px-3 py-2.5 text-right transition-all ${dk ? "border-slate-700/50 hover:bg-sky-500/10" : "border-slate-50 hover:bg-sky-50"}`}>
                  <div className="flex-1 min-w-0">
                    <div className={`truncate text-xs font-black ${heading}`}>{user.name}</div>
                    <div className={`mt-0.5 flex items-center gap-2 text-[10px] ${subText}`}><span className="font-bold">{user.username}</span><span className="font-mono" dir="ltr">ID: {user.chat_id}</span></div>
                  </div>
                  <span className={`shrink-0 rounded-lg px-2 py-1 text-[9px] font-black ${dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-700"}`}>انتخاب</span>
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
const currencyColors: Record<Currency, { light: string; dark: string; gradient: string }> = { AFN: { light: "text-emerald-700", dark: "text-emerald-300", gradient: "from-emerald-500 to-teal-400" }, USD: { light: "text-sky-700", dark: "text-sky-300", gradient: "from-sky-500 to-cyan-400" }, EUR: { light: "text-blue-700", dark: "text-blue-300", gradient: "from-blue-600 to-blue-400" }, IRR: { light: "text-amber-700", dark: "text-amber-300", gradient: "from-amber-500 to-orange-400" }, PKR: { light: "text-rose-700", dark: "text-rose-300", gradient: "from-rose-500 to-pink-400" } };
const txLabels: Record<TxType, string> = { exchange: "تبادل ارز", transfer: "انتقال", convert: "تبدیل ارز", hawala: "حواله", deposit: "واریز", withdraw: "برداشت", fee: "کارمزد", correction: "اصلاح" };
const txColors: Record<TxType, { light: string; dark: string }> = { exchange: { light: "bg-sky-100 text-sky-700", dark: "bg-sky-400/15 text-sky-300" }, transfer: { light: "bg-violet-100 text-violet-700", dark: "bg-violet-400/15 text-violet-300" }, convert: { light: "bg-purple-100 text-purple-700", dark: "bg-purple-400/15 text-purple-300" }, hawala: { light: "bg-blue-100 text-blue-700", dark: "bg-blue-400/15 text-blue-300" }, deposit: { light: "bg-emerald-100 text-emerald-700", dark: "bg-emerald-400/15 text-emerald-300" }, withdraw: { light: "bg-rose-100 text-rose-700", dark: "bg-rose-400/15 text-rose-300" }, fee: { light: "bg-amber-100 text-amber-700", dark: "bg-amber-400/15 text-amber-300" }, correction: { light: "bg-orange-100 text-orange-700", dark: "bg-orange-400/15 text-orange-300" } };

const CASH_BOX_ID = "CASH_BOX";
const CASH_BOX_NAME = "صندوق";
const CASH_BOX_CUSTOMER: Customer = { id: CASH_BOX_ID, name: CASH_BOX_NAME, phone: "", tazkira: "", address: "", note: "", telegram: "", registeredAt: "", balances: { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 } };

const EXCHANGE_ACCOUNT_ID = "EXCHANGE_ACCOUNT";
const EXCHANGE_ACCOUNT_NAME = "حساب صرافی";
const EXCHANGE_ACCOUNT_CUSTOMER: Customer = {
  id: EXCHANGE_ACCOUNT_ID,
  name: EXCHANGE_ACCOUNT_NAME,
  phone: "INTERNAL",
  tazkira: "INTERNAL",
  address: "داخلی سیستم",
  note: "حساب داخلی صرافی برای مدیریت قرض و اعتبار",
  telegram: "",
  registeredAt: "",
  balances: { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 }
};

const generateId = (): string => { if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") { try { return crypto.randomUUID(); } catch {} } return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 0x3) | 0x8).toString(16); }); };
const isCurrency = (v: any): v is Currency => typeof v === "string" && (currencies as string[]).includes(v);
const normalizeDigits = (v: string) => { const pd = "۰۱۲۳۴۵۶۷۸۹", ad = "٠١٢٣٤٥٦٧٨٩"; return String(v || "").replace(/[۰-۹]/g, d => String(pd.indexOf(d))).replace(/[٠-٩]/g, d => String(ad.indexOf(d))); };
const fmt = (n: number) => Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0";

function shamsiParts(d: Date) { try { const p = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d); const g = (t: string) => p.find(x => x.type === t)?.value || "0"; return { year: g("year"), month: g("month"), day: g("day") }; } catch { return { year: "0", month: "0", day: "0" }; } }
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

    const counterPartyId = ce.counterPartyId || (
      ce.type === "loan_given" || ce.type === "loan_received" ? EXCHANGE_ACCOUNT_ID : CASH_BOX_ID
    );

    const isIn = ce.type === "customer_deposit" || ce.type === "loan_received";

    entries.push({
      id: `${ce.id}-cash`,
      date: ce.date || new Date().toISOString(),
      customerId: ce.customerId,
      type: isIn ? "deposit" : "withdraw",
      description: ce.reason || entryTypeLabels[ce.type as CashEntryType] || "عملیات",
      currency: cur, amount: amt,
      direction: isIn ? "in" : "out",
      balanceAfter: 0,
      referenceId: ce.id,
      referenceNumber: ce.trackingCode || "",
      counterPartyId
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
    else if (ce.type === "owner_withdraw") txType =
