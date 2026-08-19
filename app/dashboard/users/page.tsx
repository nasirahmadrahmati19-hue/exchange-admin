"use client";
import { useEffect, useMemo, useState, useRef, useCallback, type ReactNode } from "react";
import { initTrackingSystem } from "../lib/trackingCode";
import { CUSTOMERS_KEY, TRANSACTIONS_KEY, HAWALAS_KEY, CASH_KEY, loadCustomersShared, loadTransactionsShared, loadHawalasShared, loadCashEntriesShared } from "../lib/defaultData";

type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";
type Customer = { id: string; name: string; phone?: string; tazkira?: string; address?: string; note?: string; telegram?: string; registeredAt: string; balances: Record<Currency, number>; };
type TxType = "exchange" | "transfer" | "convert" | "hawala" | "deposit" | "withdraw" | "fee" | "correction";
type CashEntryType = 
  | "customer_deposit" | "customer_withdraw" 
  | "owner_deposit" | "owner_withdraw" 
  | "adjustment" | "fee" | "commission_withdraw"
  | "loan_given" | "loan_received";
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
  } 
  else if (customerId === EXCHANGE_ACCOUNT_ID) {
    for (const e of cashEntries) {
      if (e.status === "voided" || e.currency !== currency) continue;
      if (e.type === "owner_deposit" || e.type === "loan_received") balance += e.amount;
      else if (e.type === "owner_withdraw" || e.type === "loan_given") balance -= e.amount;
    }
  } 
  else {
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

    const isIn = ce.type === "customer_deposit" || (ce.type === "loan_given" && ce.customerId !== EXCHANGE_ACCOUNT_ID) || (ce.type === "loan_received" && ce.customerId === EXCHANGE_ACCOUNT_ID);

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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [hawalas, setHawalas] = useState<any[]>([]);
  const [cashEntries, setCashEntries] = useState<any[]>([]);
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

  useEffect(() => { try { const s = window.localStorage.getItem("fx-theme"); if (s === "dark" || s === "light") setTheme(s); } catch {} }, []);
  useEffect(() => { try { window.localStorage.setItem("fx-theme", theme); } catch {} }, [theme]);
  const dk = theme === "dark";

  useEffect(() => {
    try {
      let custs = loadCustomersShared() as Customer[];
      if (!custs.find(c => c.id === EXCHANGE_ACCOUNT_ID)) {
        custs = [EXCHANGE_ACCOUNT_CUSTOMER, ...custs];
      }
      setCustomers(custs);
      setTransactions(loadTransactionsShared());
      setHawalas(loadHawalasShared());
      setCashEntries(loadCashEntriesShared());
      initTrackingSystem();
    } catch (err) { console.error(err); }
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      try {
        if (e.key === CUSTOMERS_KEY && e.newValue) {
          const p = JSON.parse(e.newValue);
          if (Array.isArray(p)) {
            if (!p.find((c: any) => c.id === EXCHANGE_ACCOUNT_ID)) {
              p.unshift(EXCHANGE_ACCOUNT_CUSTOMER);
            }
            setCustomers(p);
          }
        }
        if (e.key === TRANSACTIONS_KEY && e.newValue) { const p = JSON.parse(e.newValue); if (Array.isArray(p)) setTransactions(p); }
        if (e.key === HAWALAS_KEY && e.newValue) { const p = JSON.parse(e.newValue); if (Array.isArray(p)) setHawalas(p); }
        if (e.key === CASH_KEY && e.newValue) { const p = JSON.parse(e.newValue); if (Array.isArray(p)) setCashEntries(p); }
      } catch {}
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      try {
        let custs = loadCustomersShared() as Customer[];
        if (!custs.find(c => c.id === EXCHANGE_ACCOUNT_ID)) {
          custs = [EXCHANGE_ACCOUNT_CUSTOMER, ...custs];
        }
        setCustomers(custs);
        setTransactions(loadTransactionsShared());
        setHawalas(loadHawalasShared());
        setCashEntries(loadCashEntriesShared());
      } catch {}
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const currentDateTime = now ? formatDateTime(now) : "";

  useEffect(() => { if (!mounted) return; try { localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers)); window.dispatchEvent(new Event("db:updated")); } catch {} }, [customers, mounted]);

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
    customers.forEach(c => { map[c.id] = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 }; });
    map[CASH_BOX_ID] = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    map[EXCHANGE_ACCOUNT_ID] = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };

    for (const c of customers) {
      for (const cur of currencies) {
        map[c.id][cur] = getLedgerBalance(c.id, cur, cashEntries, ledger);
      }
    }
    map[CASH_BOX_ID] = {
      AFN: getLedgerBalance(CASH_BOX_ID, "AFN", cashEntries, ledger),
      USD: getLedgerBalance(CASH_BOX_ID, "USD", cashEntries, ledger),
      EUR: getLedgerBalance(CASH_BOX_ID, "EUR", cashEntries, ledger),
      IRR: getLedgerBalance(CASH_BOX_ID, "IRR", cashEntries, ledger),
      PKR: getLedgerBalance(CASH_BOX_ID, "PKR", cashEntries, ledger),
    };
    map[EXCHANGE_ACCOUNT_ID] = {
      AFN: getLedgerBalance(EXCHANGE_ACCOUNT_ID, "AFN", cashEntries, ledger),
      USD: getLedgerBalance(EXCHANGE_ACCOUNT_ID, "USD", cashEntries, ledger),
      EUR: getLedgerBalance(EXCHANGE_ACCOUNT_ID, "EUR", cashEntries, ledger),
      IRR: getLedgerBalance(EXCHANGE_ACCOUNT_ID, "IRR", cashEntries, ledger),
      PKR: getLedgerBalance(EXCHANGE_ACCOUNT_ID, "PKR", cashEntries, ledger),
    };
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
  const setField = (f: keyof FormState, v: string) => { setForm(p => ({ ...p, [f]: v })); setErrors(p => ({ ...p, [f]: undefined })); };
  const openProfile = (id: string) => { setSelectedCustomerId(id); setProfileTab("info"); setActiveTab("profile"); setOpenMenuId(null); };
  const openEdit = (id: string) => { setSelectedCustomerId(id); setProfileTab("info"); setActiveTab("profile"); setOpenMenuId(null); };
  const backToList = () => { setActiveTab("list"); setSelectedCustomerId(null); };

  const openLoanModal = (type: "give" | "receive") => {
    setLoanModalType(type);
    setLoanAmount("");
    setLoanCurrency("AFN");
    setLoanReason("");
    setLoanModalOpen(true);
  };

  const processLoan = () => {
    if (!selectedCustomer || selectedCustomer.id === CASH_BOX_ID || selectedCustomer.id === EXCHANGE_ACCOUNT_ID) {
      showToast("فقط برای مشتریان واقعی قابل انجام است.");
      return;
    }
    const amt = Number(normalizeDigits(loanAmount).replace(/,/g, ""));
    if (!Number.isFinite(amt) || amt <= 0) {
      showToast("مبلغ معتبر وارد کنید.");
      return;
    }
    if (!isCurrency(loanCurrency)) return;

    const now = new Date().toISOString();
    const reason = loanReason.trim() || (loanModalType === "give" ? "قرض به مشتری" : "بازپرداخت قرض توسط مشتری");
    const trackingCode = `LN-${Date.now().toString(36).toUpperCase()}`;

    const newEntries: any[] = [];

    if (loanModalType === "give") {
      newEntries.push({
        id: generateId(),
        trackingCode: `${trackingCode}-CUST`,
        date: now,
        type: "loan_given",
        currency: loanCurrency,
        amount: amt,
        direction: "in",
        reason: `قرض داده‌شده - ${reason}`,
        balanceAfter: 0,
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        counterPartyId: EXCHANGE_ACCOUNT_ID,
        status: "active"
      });
      newEntries.push({
        id: generateId(),
        trackingCode: `${trackingCode}-EXCH`,
        date: now,
        type: "loan_given",
        currency: loanCurrency,
        amount: amt,
        direction: "out",
        reason: `قرض به ${selectedCustomer.name} - ${reason}`,
        balanceAfter: 0,
        customerId: EXCHANGE_ACCOUNT_ID,
        customerName: EXCHANGE_ACCOUNT_NAME,
        counterPartyId: selectedCustomer.id,
        status: "active"
      });
    } else {
      newEntries.push({
        id: generateId(),
        trackingCode: `${trackingCode}-CUST`,
        date: now,
        type: "loan_received",
        currency: loanCurrency,
        amount: amt,
        direction: "out",
        reason: `بازپرداخت قرض - ${reason}`,
        balanceAfter: 0,
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        counterPartyId: EXCHANGE_ACCOUNT_ID,
        status: "active"
      });
      newEntries.push({
        id: generateId(),
        trackingCode: `${trackingCode}-EXCH`,
        date: now,
        type: "loan_received",
        currency: loanCurrency,
        amount: amt,
        direction: "in",
        reason: `دریافت قرض از ${selectedCustomer.name} - ${reason}`,
        balanceAfter: 0,
        customerId: EXCHANGE_ACCOUNT_ID,
        customerName: EXCHANGE_ACCOUNT_NAME,
        counterPartyId: selectedCustomer.id,
        status: "active"
      });
    }

    setCashEntries(prev => {
      const nextEntries = [...prev, ...newEntries];
      try {
        localStorage.setItem(CASH_KEY, JSON.stringify(nextEntries));
        window.dispatchEvent(new Event("db:updated"));
      } catch {}
      return nextEntries;
    });

    setLoanModalOpen(false);
    showToast(loanModalType === "give"
      ? `✅ ${fmt(amt)} ${labels[loanCurrency]} به "${selectedCustomer.name}" قرض داده شد.`
      : `✅ ${fmt(amt)} ${labels[loanCurrency]} از "${selectedCustomer.name}" دریافت شد.`);
  };

  const deleteCustomer = (id: string) => {
    if (id === CASH_BOX_ID || id === EXCHANGE_ACCOUNT_ID) return;
    setOpenMenuId(null);
    const c = customers.find(x => x.id === id);
    if (!c) return;
    const hasBal = currencies.some(cur => allBalances[id][cur] !== 0);
    const cnt = ledger.filter(e => e.customerId === id).length;
    let msg = `آیا از حذف "${c.name}" مطمئن هستید؟`;
    if (cnt > 0) msg += `\n⚠️ ${cnt} رویداد مالی دارد.`;
    if (hasBal) msg += `\n⚠️ موجودی غیر صفر دارد!`;
    if (!window.confirm(msg)) return;
    setTransactions(prev => prev.map((t: any) => { if (t.customerId === id || t.customerName === c.name || t.senderId === id || t.senderName === c.name || t.receiverId === id || t.receiverName === c.name) return { ...t, customerDeleted: true }; return t; }));
    setHawalas(prev => prev.map((h: any) => { if (h.senderId === id || h.senderName === c.name || h.receiverId === id || h.receiverName === c.name) return { ...h, customerDeleted: true }; return h; }));
    setCashEntries(prev => prev.map((ce: any) => { if (ce.customerId === id || ce.customerName === c.name) return { ...ce, customerDeleted: true }; return ce; }));
    setCustomers(p => p.filter(x => x.id !== id));
    if (selectedCustomerId === id) { setSelectedCustomerId(null); setActiveTab("list"); }
    window.dispatchEvent(new Event("db:updated"));
    showToast(`"${c.name}" حذف شد.`);
  };

  const validateForm = () => {
    const errs: FormErrors = {};
    if (!form.name.trim()) errs.name = "نام ضروری است.";
    if (!form.phone.trim()) errs.phone = "تماس ضروری است.";
    
    const currentId = selectedCustomer?.id;
    if (customers.find(c => c.phone === form.phone.trim() && c.id !== EXCHANGE_ACCOUNT_ID && c.id !== currentId)) {
      errs.phone = "تکراری است.";
    }
    if (form.tazkira.trim() && customers.find(c => c.tazkira === form.tazkira.trim() && c.id !== EXCHANGE_ACCOUNT_ID && c.id !== currentId)) {
      errs.tazkira = "تکراری است.";
    }
    return errs;
  };

  const submitNew = () => {
    const errs = validateForm(); setErrors(errs);
    if (Object.keys(errs).length > 0) { showToast("فیلدها را تکمیل کنید."); return; }
    const nc: Customer = { id: generateId(), name: form.name.trim(), phone: form.phone.trim(), tazkira: form.tazkira.trim(), address: form.address.trim(), note: form.note.trim(), telegram: form.telegram.trim(), registeredAt: new Date().toISOString(), balances: { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 } };
    setCustomers(p => [...p, nc]); setForm(emptyForm); setErrors({}); setActiveTab("list");
    window.dispatchEvent(new Event("db:updated"));
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
    window.dispatchEvent(new Event("db:updated"));
    showToast("به‌روز شد.");
  };

  useEffect(() => { if (profileTab === "info" && selectedCustomer && selectedCustomer.id !== CASH_BOX_ID && selectedCustomer.id !== EXCHANGE_ACCOUNT_ID) { setForm({ name: selectedCustomer.name, phone: selectedCustomer.phone || "", tazkira: selectedCustomer.tazkira || "", address: selectedCustomer.address || "", note: selectedCustomer.note || "", telegram: selectedCustomer.telegram || "" }); } }, [profileTab, selectedCustomer]);

  const printStatement = () => {
    if (!selectedCustomer || !customerBalances) return;
    try {
      const win = window.open("", "_blank", "width=1000,height=700"); if (!win) return;
      const title = isCashBox ? "صورت‌حساب صندوق صرافی" : isExchangeAccount ? "صورت‌حساب حساب صرافی" : `صورت‌حساب ${selectedCustomer.name}`;
      const customerInfo = isCashBox ? "موجودی فیزیکی صندوق صرافی" : isExchangeAccount ? "موجودی حساب داخلی صرافی" : `تلفن: ${selectedCustomer.phone || "-"} | تذکره: ${selectedCustomer.tazkira || "-"} | تلگرام: ${selectedCustomer.telegram || "-"}`;
      win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Tahoma;padding:24px;direction:rtl}h1{color:#0369a1}table{width:100%;border-collapse:collapse;font-size:12px;margin:12px 0}th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:right}th{background:#f0f9ff}.in{color:#059669;font-weight:bold}.out{color:#dc2626;font-weight:bold}.box{display:inline-block;padding:8px 14px;border:2px solid #0ea5e9;border-radius:8px;margin:4px;font-weight:bold}</style></head><body><h1>${title}</h1><p>${customerInfo}</p><h3>مانده</h3><div>${currencies.map(c => `<span class="box">${labels[c]}: ${fmt(customerBalances[c])}</span>`).join("")}</div><h3>گردش (${customerLedger.length})</h3><table><tr><th>شماره</th><th>تاریخ</th><th>ساعت</th><th>سند</th><th>نوع</th><th>شرح</th><th>ارز</th><th>دریافت</th><th>پرداخت</th><th>مانده</th></tr>${customerLedger.map((e, i) => `<tr><td>${i + 1}</td><td>${shortDateLabel(e.date)}</td><td>${timeLabel(e.date)}</td><td>${e.referenceNumber || "-"}</td><td>${txLabels[e.type]}</td><td>${e.description}</td><td>${labels[e.currency]}</td><td class="in">${e.direction === "in" ? fmt(e.amount) : ""}</td><td class="out">${e.direction === "out" ? fmt(e.amount) : ""}</td><td>${fmt(e.balanceAfter)}</td></tr>`).join("")}</table><script>window.print()</script></body></html>`);
      win.document.close(); win.focus();
    } catch { showToast("خطا در چاپ"); }
  };

  if (!mounted) return (<div className="min-h-screen flex items-center justify-center"><div className="text-center"><div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-emerald-500" /><p className="mt-4 text-slate-500">در حال بارگذاری...</p></div></div>);

  // ✅ رفع خطا: تعریف متغیرهای heading و subText که در JSX استفاده می‌شدند
  const heading = dk ? "text-white" : "text-slate-900";
  const subText = dk ? "text-slate-500" : "text-slate-400";
  
  const uiCard = `rounded-2xl border backdrop-blur transition-colors duration-300 ${dk ? "border-slate-700 bg-slate-800/90 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.6)]" : "border-emerald-100 bg-white/95 shadow-[0_16px_40px_-28px_rgba(16,185,129,0.35)]"}`;
  const glassCard = `rounded-2xl border backdrop-blur transition-all duration-300 ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-white/80"}`;
  const inputShell = `rounded-xl border text-sm font-medium shadow-sm outline-none transition-all duration-200 focus:ring-4 ${dk ? "border-slate-600 bg-slate-900 text-slate-100 placeholder:text-slate-500 hover:border-slate-500 focus:border-emerald-400 focus:ring-emerald-400/10" : "border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 hover:border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500/10"}`;
  const uiInput = `h-12 w-full px-3.5 ${inputShell}`;
  const errInput = dk ? "border-rose-500 bg-rose-500/10 ring-rose-500/20" : "border-rose-500 bg-rose-50 ring-rose-500/20";
  const uiLabel = `mb-1.5 block text-[11px] font-black tracking-wide ${dk ? "text-slate-400" : "text-slate-500"}`;
  const identIcon = dk ? "from-emerald-400/20 to-teal-400/5 text-emerald-300 ring-emerald-400/25" : "from-emerald-400/20 to-teal-400/10 text-emerald-600 ring-emerald-400/30";
  const fld = (label: string, node: ReactNode) => (<div><label className={uiLabel}>{label}</label>{node}</div>);
  const errBox = (list: string[]) => list.length === 0 ? null : (<div className={`space-y-2 rounded-xl border p-4 ${dk ? "border-rose-500/50 bg-rose-500/10 text-rose-300" : "border-rose-500 bg-rose-50 text-rose-600"}`}><b className="flex items-center gap-2 text-sm"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0"><path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>لطفاً فیلدهای اجباری را تکمیل کنید:</b><ul className="list-disc pr-5 text-sm space-y-1">{list.map((m, i) => <li key={i}>{m}</li>)}</ul></div>);
  const errorList = Object.values(errors).filter((m): m is string => Boolean(m));
  const glassChip = dk ? "border-slate-600/70 bg-slate-800/80" : "border-emerald-100 bg-white/85";

  return (
    <div dir="rtl" className={dk ? "dark" : ""}>
      <style>{`@import url("https://fonts.googleapis.com/css2?family=Lalezar&family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap");.cu-font{font-family:"Vazirmatn","Segoe UI",Tahoma,sans-serif}.cu-display{font-family:"Lalezar","Vazirmatn",Tahoma,sans-serif}.dark{color-scheme:dark}@keyframes cuUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}.cu-up{animation:cuUp .5s cubic-bezier(.22,.8,.35,1) both}.cu-scroll::-webkit-scrollbar{height:6px;width:6px}.cu-scroll::-webkit-scrollbar-thumb{background:rgba(16,185,129,.3);border-radius:3px}.cu-scroll{scrollbar-width:thin}@keyframes menuIn{from{opacity:0;transform:scale(.95) translateY(-4px)}to{opacity:1;transform:scale(1) translateY(0)}}.cu-menu{animation:menuIn .15s ease-out}`}</style>
      <div className={`cu-font relative min-h-screen overflow-x-hidden antialiased transition-colors duration-500 ${dk ? "bg-[#0f172a] text-slate-100" : "bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 text-slate-800"}`}>
        <div className={`fixed inset-x-0 top-0 z-30 h-1 bg-gradient-to-l ${dk ? "from-emerald-400 via-teal-400 to-cyan-400" : "from-emerald-500 via-teal-500 to-cyan-500"}`} />
        <div className="relative z-10 mx-auto w-full max-w-7xl space-y-4 md:space-y-6 px-3 pb-16 pt-5 md:px-8 md:pt-9">
          <header className="cu-up flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0">
              <div className="relative grid h-11 w-11 md:h-14 md:w-14 shrink-0 place-items-center rounded-xl md:rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-400 text-white shadow-lg shadow-emerald-500/30 ring-1 ring-white/30">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 md:h-6 md:w-6"><path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>
                <span className={`absolute -bottom-1 -left-1 grid h-4 min-w-4 md:h-5 md:min-w-5 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-400 px-1 text-[7px] md:text-[8px] font-black text-white ring-2 ${dk ? "ring-[#0f172a]" : "ring-[#ecfdf5]"}`}>CU</span>
              </div>
              <div className="min-w-0"><h1 className={`cu-display text-2xl md:text-4xl leading-none ${heading}`}>مدیریت مشتریان</h1><p className={`mt-1 text-[10px] md:text-xs font-bold ${subText}`}>پروندهٔ کامل، گردش حساب و سوابق مالی</p></div>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2.5">
              <div className={`hidden sm:flex items-center gap-2 rounded-xl border px-3 py-2 shadow-sm backdrop-blur ${glassChip}`}><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" /></span><span dir="ltr" className={`text-xs font-bold tabular-nums ${dk ? "text-slate-100" : "text-slate-700"}`}>{currentDateTime || "--:--"}</span></div>
              <button onClick={() => setTheme(dk ? "light" : "dark")} className={`group grid h-10 w-10 md:h-11 md:w-11 cursor-pointer place-items-center rounded-lg md:rounded-xl border shadow-sm backdrop-blur transition-all duration-300 active:scale-90 ${dk ? "border-slate-600 bg-slate-800/85 text-amber-300 hover:border-amber-300" : "border-slate-200 bg-white/85 text-slate-600 hover:border-emerald-400"}`}>{dk ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 group-hover:rotate-45 transition-transform duration-500"><path d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.375 3.375 0 1 1-7.5 0 3.375 3.375 0 0 1 7.5 0Z" /></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 group-hover:-rotate-12 transition-transform duration-500"><path d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" /></svg>}</button>
            </div>
          </header>

          <div className="cu-up grid grid-cols-2 md:grid-cols-5 gap-3" style={{ animationDelay: "70ms" }}>
            {[
              { label: "کل مشتریان", value: customers.filter(c => c.id !== EXCHANGE_ACCOUNT_ID).length, icon: "users", color: "from-emerald-500 to-teal-500", text: dk ? "text-emerald-300" : "text-emerald-600" },
              { label: "رویدادهای مالی", value: ledger.length + cashBoxLedger.length, icon: "history", color: "from-amber-500 to-orange-500", text: dk ? "text-amber-300" : "text-amber-600" },
              { label: "با موجودی", value: withBalanceCount, icon: "wallet", color: "from-sky-500 to-cyan-500", text: dk ? "text-sky-300" : "text-sky-600" },
              { label: "بدون موجودی", value: withoutBalanceCount, icon: "x", color: "from-rose-500 to-pink-500", text: dk ? "text-rose-300" : "text-rose-600" },
              { label: "💰 موجودی فیزیکی صندوق", value: fmt(Object.values(allBalances[CASH_BOX_ID]).reduce((a, b) => a + Math.abs(b), 0)), icon: "cash", color: "from-violet-500 to-purple-500", text: dk ? "text-violet-300" : "text-violet-600" },
            ].map((s, i) => (
              <div key={i} className={`group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${glassCard}`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${s.color} opacity-0 transition-opacity group-hover:opacity-10`} />
                <div className="relative flex items-center justify-between">
                  <div><div className={`text-[10px] font-black ${subText}`}>{s.label}</div><div className={`text-lg md:text-2xl font-black tabular-nums mt-1 ${s.text}`}>{s.value}</div></div>
                  <div className={`grid h-10 w-10 md:h-12 md:w-12 place-items-center rounded-xl bg-gradient-to-br ${s.color} text-white shadow-lg`}>
                    {s.icon === "users" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 md:h-6 md:w-6"><path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>}
                    {s.icon === "history" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 md:h-6 md:w-6"><path d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>}
                    {s.icon === "wallet" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 md:h-6 md:w-6"><path d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" /></svg>}
                    {s.icon === "x" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 md:h-6 md:w-6"><path d="M6 18 18 6M6 6l12 12" /></svg>}
                    {s.icon === "cash" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 md:h-6 md:w-6"><path d="M2.25 18.75a48.622 48.622 0 0 0 19.5 0v-13.5a48.622 48.622 0 0 0-19.5 0v13.5Zm10.5-4.5v-4.5M10.5 16.5h4.5" /></svg>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className={`cu-up flex gap-1.5 md:gap-2 rounded-xl md:rounded-2xl border p-1.5 md:p-2 shadow-sm backdrop-blur ${glassChip}`} style={{ animationDelay: "140ms" }}>
            {[{ id: "list" as const, label: "فهرست مشتریان", icon: "users", count: customers.length }, { id: "new" as const, label: "ثبت مشتری جدید", icon: "plus", count: null }].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 md:gap-2 rounded-lg md:rounded-xl px-3 md:px-5 py-2.5 md:py-3 text-xs md:text-sm font-black transition-all duration-300 active:scale-[0.97] ${activeTab === tab.id ? `bg-gradient-to-l shadow-lg ${dk ? "from-emerald-400 to-teal-400 text-slate-950" : "from-emerald-500 to-teal-500 text-white"}` : dk ? "text-slate-400 hover:bg-slate-700/60 hover:text-slate-100" : "text-slate-500 hover:bg-emerald-50 hover:text-slate-800"}`}>
                {tab.icon === "users" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>}
                {tab.icon === "plus" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M12 4.5v15m7.5-7.5h-15" /></svg>}
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "list" && (
            <section className={`cu-up space-y-4 md:space-y-5 p-4 md:p-6 ${uiCard}`} style={{ animationDelay: "210ms" }}>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${identIcon}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>
                </span>
                <div className="flex-1 min-w-0">
                  <h2 className={`cu-display text-xl md:text-2xl leading-none ${heading}`}>فهرست مشتریان</h2>
                  <p className={`mt-1 text-[11px] font-bold ${subText}`}>{customers.length} مشتری ثبت‌شده + صندوق + حساب صرافی</p>
                </div>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو..." className={`${uiInput} w-auto md:w-64`} />
              </div>

              <div className="md:hidden space-y-2">
                {filteredCustomers.map(c => {
                  const isCashBoxRow = c.id === CASH_BOX_ID;
                  const isExchRow = c.id === EXCHANGE_ACCOUNT_ID;
                  const balSource = allBalances[c.id];
                  return (
                    <div key={c.id} className={`rounded-2xl border p-4 ${glassCard} ${isCashBoxRow ? (dk ? "border-emerald-400/30" : "border-emerald-200") : ""} ${isExchRow ? (dk ? "border-violet-400/30" : "border-violet-200") : ""}`}>
                      <div className="flex items-start gap-3">
                        <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${isCashBoxRow ? "from-emerald-500 to-teal-500" : isExchRow ? "from-violet-500 to-purple-500" : "from-emerald-500 to-teal-500"} text-white font-black text-lg shadow-lg`}>
                          {isCashBoxRow ? "💰" : isExchRow ? "🏦" : c.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <b className={`text-sm font-black ${dk ? "text-slate-100" : "text-slate-800"}`}>{c.name}</b>
                          {isCashBoxRow && <span className={`mr-2 text-[9px] font-black ${dk ? "text-emerald-300" : "text-emerald-600"}`}>موجودی فیزیکی صندوق</span>}
                          {isExchRow && <span className={`mr-2 text-[9px] font-black ${dk ? "text-violet-300" : "text-violet-600"}`}>حساب داخلی صرافی</span>}
                          {!isCashBoxRow && !isExchRow && (
                            <div className={`text-[11px] ${subText} mt-1 space-y-0.5`}>
                              <div>📱 <span dir="ltr">{c.phone || "-"}</span></div>
                              <div>🆔 <span dir="ltr">{c.tazkira || "-"}</span></div>
                              {c.address && <div>📍 {c.address}</div>}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-5 gap-1 mt-3">
                        {currencies.map(cur => (
                          <div key={cur} className={`rounded-lg px-1.5 py-1.5 text-center ${dk ? "bg-slate-900/50" : "bg-slate-50"}`}>
                            <div className={`text-[8px] font-black ${subText}`}>{cur}</div>
                            <div className={`text-[10px] font-black tabular-nums ${balSource[cur] >= 0 ? currencyColors[cur][dk ? "dark" : "light"] : "text-rose-500"}`}>{fmt(balSource[cur])}</div>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-col gap-1.5 mt-3">
                        <button onClick={() => openProfile(c.id)} className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-bold cursor-pointer ${dk ? "border-emerald-400/30 text-emerald-300" : "border-emerald-300 text-emerald-600"}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                          مشاهده
                        </button>
                        {!isCashBoxRow && !isExchRow && (
                          <>
                            <button onClick={() => openEdit(c.id)} className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-bold cursor-pointer ${dk ? "border-sky-400/30 text-sky-300" : "border-sky-300 text-sky-600"}`}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg>
                              ویرایش
                            </button>
                            <button onClick={() => deleteCustomer(c.id)} className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-bold cursor-pointer ${dk ? "border-rose-400/30 text-rose-300" : "border-rose-300 text-rose-600"}`}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                              حذف
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden md:block overflow-x-auto cu-scroll">
                <table className="w-full min-w-[900px] text-sm">
                  <thead><tr className={`border-y ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>{["شماره", "مشتری", "تماس", "هویت", "موجودی", "عملیات"].map(h => (<th key={h} className="px-4 py-3 text-center text-[11px] font-black text-slate-400">{h}</th>))}</tr></thead>
                  <tbody className={`divide-y ${dk ? "divide-slate-700/60" : "divide-slate-100"}`}>
                    {filteredCustomers.map((c, idx) => {
                      const isCashBoxRow = c.id === CASH_BOX_ID;
                      const isExchRow = c.id === EXCHANGE_ACCOUNT_ID;
                      const balSource = allBalances[c.id];
                      const hasBal = currencies.some(cur => balSource[cur] !== 0);
                      const isOpen = openMenuId === c.id;
                      return (
                        <tr key={c.id} className={`transition-colors ${dk ? "hover:bg-slate-700/30" : "hover:bg-emerald-50/70"} ${isCashBoxRow ? (dk ? "bg-emerald-400/[0.03]" : "bg-emerald-50/30") : ""} ${isExchRow ? (dk ? "bg-violet-400/[0.03]" : "bg-violet-50/30") : ""}`}>
                          <td className="px-4 py-3.5 text-center align-middle"><span className={`inline-grid h-8 w-8 place-items-center rounded-lg text-[11px] font-black tabular-nums ${dk ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"}`}>{idx + 1}</span></td>
                          <td className="px-4 py-3.5 text-center align-middle">
                            <div className={`text-[13px] font-black ${dk ? "text-slate-100" : "text-slate-800"}`}>
                              {isCashBoxRow && <span className="ml-1">💰</span>}
                              {isExchRow && <span className="ml-1">🏦</span>}
                              {c.name}
                              {isCashBoxRow && <span className={`mr-2 text-[9px] font-black ${dk ? "text-emerald-300" : "text-emerald-600"}`}>موجودی فیزیکی صندوق</span>}
                              {isExchRow && <span className={`mr-2 text-[9px] font-black ${dk ? "text-violet-300" : "text-violet-600"}`}>حساب داخلی صرافی</span>}
                            </div>
                            {!isCashBoxRow && !isExchRow && c.address && <div className={`text-[10px] mt-1 ${subText}`}>📍 {c.address}</div>}
                          </td>
                          <td className="px-4 py-3.5 text-center align-middle">
                            {!isCashBoxRow && !isExchRow ? (<><div className={`text-[12px] font-bold tabular-nums ${dk ? "text-slate-200" : "text-slate-700"}`} dir="ltr">📱 {c.phone || "-"}</div><div className={`text-[10px] tabular-nums mt-1 ${subText}`} dir="ltr">🆔 {c.tazkira || "-"}</div></>) : (<div className={`text-[10px] ${subText}`}>—</div>)}
                          </td>
                          <td className="px-4 py-3.5 text-center align-middle">
                            {!isCashBoxRow && !isExchRow ? (<><div className={`text-[11px] tabular-nums ${dk ? "text-slate-300" : "text-slate-600"}`}>{c.registeredAt ? shortDateLabel(c.registeredAt) : "-"}</div><div className={`text-[10px] mt-1 ${subText}`}>{ledger.filter(e => e.customerId === c.id).length} رویداد</div></>) : (<>
                              <div className={`text-[11px] tabular-nums ${dk ? "text-slate-300" : "text-slate-600"}`}>—</div>
                              <div className={`text-[10px] mt-1 ${subText}`}>
                                {isCashBoxRow ? `${cashBoxLedger.length} رویداد` : `${ledger.filter(e => e.customerId === EXCHANGE_ACCOUNT_ID).length} رویداد`}
                              </div>
                            </>)}
                          </td>
                          <td className="px-4 py-3.5 text-center align-middle">
                            {hasBal ? (<div className="flex flex-col items-center gap-0.5">{currencies.map(cur => balSource[cur] !== 0 && (<div key={cur} className="flex items-center gap-1"><span className={`text-[11px] font-black tabular-nums ${balSource[cur] < 0 ? "text-rose-500" : currencyColors[cur][dk ? "dark" : "light"]}`}>{fmt(balSource[cur])}</span><span className={`text-[9px] ${subText}`}>{labels[cur]}</span></div>))}</div>) : <span className={`text-[10px] ${subText}`}>بدون موجودی</span>}
                          </td>
                          <td className="px-4 py-3.5 text-center align-middle">
                            <div className="relative inline-block" ref={isOpen ? menuRef : null}>
                              <button data-menu-toggle onClick={(e) => { e.stopPropagation(); setOpenMenuId(isOpen ? null : c.id); }} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-black transition-all ${isOpen ? dk ? "border-emerald-400/50 bg-emerald-400/20 text-emerald-300" : "border-emerald-400 bg-emerald-50 text-emerald-600" : dk ? "border-slate-600 bg-slate-900 text-emerald-300 hover:border-emerald-400/50" : "border-slate-200 bg-white text-emerald-600 hover:border-emerald-300"}`}>عملیات<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`}><path d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg></button>
                              {isOpen && (
                                <ul className={`cu-menu absolute left-1/2 -translate-x-1/2 top-full z-20 mt-1.5 w-36 space-y-1 rounded-xl border p-1.5 shadow-xl ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-white"}`}>
                                  <li><button onClick={() => openProfile(c.id)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-xs font-bold cursor-pointer ${dk ? "text-slate-300 hover:bg-emerald-400/10" : "text-slate-600 hover:bg-emerald-50"}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>مشاهده</button></li>
                                  {!isCashBoxRow && !isExchRow && (<>
                                    <li><button onClick={() => openEdit(c.id)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-xs font-bold cursor-pointer ${dk ? "text-sky-300 hover:bg-sky-400/10" : "text-sky-600 hover:bg-sky-50"}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg>ویرایش</button></li>
                                    <li className={`h-px ${dk ? "bg-slate-700" : "bg-slate-100"}`} />
                                    <li><button onClick={() => deleteCustomer(c.id)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-xs font-bold cursor-pointer ${dk ? "text-rose-300 hover:bg-rose-400/10" : "text-rose-500 hover:bg-rose-50"}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>حذف</button></li>
                                  </>)}
                                </ul>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === "new" && (
            <section className={`cu-up space-y-4 md:space-y-5 p-4 md:p-7 ${uiCard}`}>
              <div className="flex flex-wrap items-center gap-3"><span className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${identIcon}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M12 4.5v15m7.5-7.5h-15" /></svg></span><div className="flex-1 min-w-0"><h2 className={`cu-display text-xl md:text-2xl leading-none ${heading}`}>ثبت مشتری جدید</h2><p className={`mt-1 text-[11px] font-bold ${subText}`}>ایجاد پروندهٔ جدید</p></div></div>
              <div className="grid gap-4 md:grid-cols-2">
                {fld("نام و نام خانوادگی *", (<input className={`${uiInput} ${errors.name ? errInput : ""}`} value={form.name} onChange={e => setField("name", e.target.value)} placeholder="مثلاً علی احمدی" />))}
                {fld("شماره تماس *", (<input className={`${uiInput} ${errors.phone ? errInput : ""}`} value={form.phone} onChange={e => setField("phone", e.target.value)} placeholder="07xxxxxxxx" />))}
                {fld("شماره تذکره", (<input className={`${uiInput} ${errors.tazkira ? errInput : ""}`} value={form.tazkira} onChange={e => setField("tazkira", e.target.value)} placeholder="1400-001-001" />))}
                {fld("چت آی‌دی تلگرام", (<TelegramChatIdSelector value={form.telegram} onChange={v => setField("telegram", v)} uiInput={uiInput} dk={dk} />))}
                <div className="md:col-span-2">{fld("آدرس", (<input className={uiInput} value={form.address} onChange={e => setField("address", e.target.value)} placeholder="ولایت، ولسوالی" />))}</div>
                <div className="md:col-span-2">{fld("توضیحات", (<textarea rows={3} className={`${uiInput} h-auto py-3 resize-none`} value={form.note} onChange={e => setField("note", e.target.value)} />))}</div>
              </div>
              {errBox(errorList)}
              <div className="flex flex-wrap gap-3">
                <button onClick={submitNew} className={`flex h-[50px] flex-1 min-w-[200px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-l text-base font-black shadow-lg transition-all hover:brightness-110 ${dk ? "from-emerald-400 to-teal-400 text-slate-950" : "from-emerald-500 via-teal-500 to-cyan-500 text-white"}`}>ثبت مشتری<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg></button>
                <button onClick={() => { setForm(emptyForm); setErrors({}); setActiveTab("list"); }} className={`flex h-[50px] px-6 cursor-pointer items-center justify-center rounded-xl border text-sm font-bold ${dk ? "border-slate-600 text-slate-300" : "border-slate-200 text-slate-600"}`}>انصراف</button>
              </div>
            </section>
          )}

          {activeTab === "profile" && selectedCustomer && customerBalances && (
            <section className="cu-up space-y-4 md:space-y-5">
              <div className={`relative overflow-hidden rounded-2xl border p-5 md:p-7 ${uiCard}`}>
                <div className="relative">
                  <button onClick={backToList} className={`mb-4 flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold ${dk ? "border-slate-600 text-slate-300" : "border-slate-200 text-slate-600"}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 rotate-90"><path d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>بازگشت</button>
                  <div className="flex flex-wrap items-start gap-4 md:gap-6">
                    <div className={`grid h-20 w-20 md:h-24 md:w-24 shrink-0 place-items-center rounded-2xl ${isCashBox ? "bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500" : isExchangeAccount ? "bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500" : "bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500"} text-white font-black text-3xl md:text-4xl shadow-2xl ring-4 ${dk ? "ring-slate-800" : "ring-white"}`}>{isCashBox ? "💰" : isExchangeAccount ? "🏦" : selectedCustomer.name.charAt(0)}</div>
                    <div className="flex-1 min-w-0">
                      <h2 className={`cu-display text-2xl md:text-3xl leading-none ${heading}`}>
                        {selectedCustomer.name}
                        {isCashBox && <span className={`mr-2 text-sm font-black ${dk ? "text-emerald-300" : "text-emerald-600"}`}>(موجودی فیزیکی صندوق)</span>}
                        {isExchangeAccount && <span className={`mr-2 text-sm font-black ${dk ? "text-violet-300" : "text-violet-600"}`}>(حساب داخلی صرافی)</span>}
                      </h2>
                      <div className={`grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs mt-2 ${subText}`}>
                        <div><b>کد:</b> <span dir="ltr" className="font-black tabular-nums">{isCashBox ? "CASH_BOX" : isExchangeAccount ? "EXCHANGE_ACCOUNT" : selectedCustomer.id.slice(-6)}</span></div>
                        {!isCashBox && !isExchangeAccount && (<><div><b>تلفن:</b> <span dir="ltr" className="font-black tabular-nums">{selectedCustomer.phone || "-"}</span></div><div><b>تذکره:</b> <span dir="ltr" className="font-black tabular-nums">{selectedCustomer.tazkira || "-"}</span></div><div><b>ثبت:</b> <span dir="ltr" className="font-black tabular-nums">{selectedCustomer.registeredAt ? shortDateLabel(selectedCustomer.registeredAt) : "-"}</span></div>{selectedCustomer.telegram && <div className="md:col-span-2"><b>تلگرام:</b> <span dir="ltr" className="font-black tabular-nums">{selectedCustomer.telegram}</span></div>}{selectedCustomer.address && <div className="md:col-span-2"><b>آدرس:</b> <span className="font-black">{selectedCustomer.address}</span></div>}{selectedCustomer.note && <div className="md:col-span-4"><b>یادداشت:</b> <span className="font-black">{selectedCustomer.note}</span></div>}</>)}
                        {isCashBox && <div className="md:col-span-3"><b>توضیحات:</b> <span className="font-black">موجودی فیزیکی صندوق صرافی - مجموع دارایی‌های نقدی</span></div>}
                        {isExchangeAccount && <div className="md:col-span-3"><b>توضیحات:</b> <span className="font-black">حساب داخلی صرافی برای مدیریت قرض و اعتبار مشتریان</span></div>}
                      </div>
                    </div>
                    {!isCashBox && !isExchangeAccount && (
                      <div className="flex gap-2">
                        <button onClick={() => openLoanModal("give")} className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-bold ${dk ? "border-sky-400/30 text-sky-300 hover:bg-sky-400/10" : "border-sky-300 text-sky-600 hover:bg-sky-50"}`}>
                          <span className="flex items-center gap-1.5">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M12 21v-8.25M15.75 21V12.5m-7.5 8.5v-8.25m12-4.5L12 2.25 3.75 7.75" /></svg>
                            قرض دادن
                          </span>
                        </button>
                        <button onClick={() => openLoanModal("receive")} className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-bold ${dk ? "border-emerald-400/30 text-emerald-300 hover:bg-emerald-400/10" : "border-emerald-300 text-emerald-600 hover:bg-emerald-50"}`}>
                          <span className="flex items-center gap-1.5">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                            پرداخت قرض
                          </span>
                        </button>
                        <button onClick={() => deleteCustomer(selectedCustomer.id)} className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-bold ${dk ? "border-rose-400/30 text-rose-300" : "border-rose-300 text-rose-600"}`}>
                          <span className="flex items-center gap-1.5">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                            حذف
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className={`rounded-2xl border p-4 md:p-5 ${uiCard}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`grid h-8 w-8 place-items-center rounded-lg ${dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-600"}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" /></svg></span>
                  <b className={`text-sm font-black ${heading}`}>
                    {isCashBox ? "💰 موجودی فیزیکی صندوق" : isExchangeAccount ? "🏦 موجودی حساب صرافی" : "موجودی فعلی"}
                  </b>
                  <span className={`ml-auto text-[10px] font-bold ${subText}`}>
                    {isCashBox ? "فرمول: مجموع ورودی‌ها - خروجی‌ها" : isExchangeAccount ? "از تراکنش‌های مالک و قرض" : "محاسبه‌شده از دفتر کل (Ledger)"}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {currencies.map(cur => {
                    const bal = customerBalances[cur]; const colors = currencyColors[cur];
                    return (
                      <div key={cur} className={`rounded-xl border p-3 text-center ${dk ? "border-slate-700 bg-slate-900/50" : "border-slate-200 bg-slate-50"}`}>
                        <div className={`text-[10px] font-black ${subText} mb-1`}>{labels[cur]}</div>
                        <div className={`text-lg font-black tabular-nums ${bal < 0 ? "text-rose-500" : colors[dk ? "dark" : "light"]}`}>{fmt(bal)}</div>
                        <div className="min-h-[14px] mt-1">
                          {isCashBox ? (<>{bal < 0 && <span className="text-[8px] font-black text-rose-500">⚠️ کسری صندوق</span>}{bal > 0 && <span className={`text-[8px] font-black ${dk ? "text-emerald-300" : "text-emerald-600"}`}>✅ موجودی نقدی</span>}{bal === 0 && <span className={`text-[8px] font-bold ${subText}`}>⚪ خالی</span>}</>)
                            : isExchangeAccount ? (<>{bal < 0 && <span className="text-[8px] font-black text-rose-500">🔴 قرض‌های داده‌شده</span>}{bal > 0 && <span className={`text-[8px] font-black ${dk ? "text-emerald-300" : "text-emerald-600"}`}>🟢 موجودی داخلی</span>}{bal === 0 && <span className={`text-[8px] font-bold ${subText}`}>⚪ خنثی</span>}</>)
                            : (<>{bal < 0 && <span className="text-[8px] font-black text-rose-500">🔴 قرض</span>}{bal > 0 && <span className={`text-[8px] font-black ${dk ? "text-emerald-300" : "text-emerald-600"}`}>🟢 طلب</span>}{bal === 0 && <span className={`text-[8px] font-bold ${subText}`}>⚪ صفر</span>}</>)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={`flex flex-wrap gap-1.5 rounded-xl border p-1.5 ${glassChip}`}>
                {([{ id: "info" as const, l: "اطلاعات", i: "user" }, { id: "balances" as const, l: "موجودی", i: "wallet" }, { id: "ledger" as const, l: "روزنامچه", i: "history" }, { id: "statement" as const, l: "صورت‌حساب", i: "doc" }]).map(pt => (
                  <button key={pt.id} onClick={() => setProfileTab(pt.id)} className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black transition-all ${profileTab === pt.id ? dk ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30" : "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300" : dk ? "text-slate-400 hover:bg-slate-700/60" : "text-slate-500 hover:bg-slate-50"}`}>
                    {pt.i === "user" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>}
                    {pt.i === "wallet" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" /></svg>}
                    {pt.i === "history" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>}
                    {pt.i === "doc" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>}
                    {pt.l}
                  </button>
                ))}
              </div>

              {profileTab === "info" && (
                <div className={`rounded-2xl border p-4 md:p-6 ${uiCard}`}>
                  <div className="flex items-center gap-2 mb-4"><span className={`grid h-8 w-8 place-items-center rounded-lg ${dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-600"}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg></span><b className={`text-sm font-black ${heading}`}>{isCashBox ? "اطلاعات صندوق" : isExchangeAccount ? "اطلاعات حساب صرافی" : "ویرایش اطلاعات"}</b></div>
                  {isCashBox ? (
                    <div className={`rounded-xl border p-4 ${dk ? "border-emerald-400/25 bg-emerald-400/[0.07]" : "border-emerald-200 bg-emerald-50"}`}>
                      <div className="flex items-center gap-3 mb-3">
                        <span className={`grid h-10 w-10 place-items-center rounded-xl ${dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-600"}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" /></svg></span>
                        <div><b className={`block text-sm font-black ${dk ? "text-emerald-300" : "text-emerald-700"}`}>💰 موجودی فیزیکی صندوق</b><span className={`text-[10px] font-bold ${subText}`}>این بخش قابل ویرایش نیست</span></div>
                      </div>
                      <p className={`text-sm leading-6 ${dk ? "text-slate-300" : "text-slate-600"}`}>موجودی فیزیکی صندوق به صورت خودکار از مجموع موجودی تمام مشتریان و حساب صرافی محاسبه می‌شود. این عدد نشان‌دهنده دارایی نقدی واقعی صرافی است.</p>
                    </div>
                  ) : isExchangeAccount ? (
                    <div className={`rounded-xl border p-4 ${dk ? "border-violet-400/25 bg-violet-400/[0.07]" : "border-violet-200 bg-violet-50"}`}>
                      <div className="flex items-center gap-3 mb-3">
                        <span className={`grid h-10 w-10 place-items-center rounded-xl ${dk ? "bg-violet-400/15 text-violet-300" : "bg-violet-100 text-violet-600"}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 21h.008v.008H6.75V21Zm0 0V7.5M6.75 21h.008v.008H6.75V21Zm0 0V7.5M6.75 21h.008v.008H6.75V21Z" /></svg></span>
                        <div><b className={`block text-sm font-black ${dk ? "text-violet-300" : "text-violet-700"}`}>🏦 حساب داخلی صرافی</b><span className={`text-[10px] font-bold ${subText}`}>مدیریت قرض و اعتبار</span></div>
                      </div>
                      <p className={`text-sm leading-6 ${dk ? "text-slate-300" : "text-slate-600"}`}>این حساب به عنوان واسطه بین صرافی و مشتریان برای عملیات قرض عمل می‌کند. وقتی به مشتری قرض می‌دهید، این حساب بدهکار می‌شود و وقتی مشتری قرض را پس می‌دهد، این حساب بستانکار می‌شود.</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-4 md:grid-cols-2">
                        {fld("نام", (<input className={uiInput} value={form.name} onChange={e => setField("name", e.target.value)} />))}
                        {fld("تلفن", (<input className={uiInput} value={form.phone} onChange={e => setField("phone", e.target.value)} />))}
                        {fld("تذکره", (<input className={uiInput} value={form.tazkira} onChange={e => setField("tazkira", e.target.value)} />))}
                        {fld("تلگرام", (<TelegramChatIdSelector value={form.telegram} onChange={v => setField("telegram", v)} uiInput={uiInput} dk={dk} />))}
                        <div className="md:col-span-2">{fld("آدرس", (<input className={uiInput} value={form.address} onChange={e => setField("address", e.target.value)} />))}</div>
                        <div className="md:col-span-2">{fld("توضیحات", (<textarea rows={3} className={`${uiInput} h-auto py-3 resize-none`} value={form.note} onChange={e => setField("note", e.target.value)} />))}</div>
                      </div>
                      <button onClick={updateCustomer} className={`mt-4 flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-l px-5 py-2.5 text-sm font-black shadow-lg ${dk ? "from-emerald-400 to-teal-400 text-slate-950" : "from-emerald-500 to-teal-500 text-white"}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>ذخیره</button>
                    </>
                  )}
                </div>
              )}

              {profileTab === "balances" && (
                <div className={`rounded-2xl border p-4 md:p-6 ${uiCard}`}>
                  <div className="space-y-2">
                    {currencies.map(cur => {
                      const bal = customerBalances[cur];
                      const cnt = customerLedger.filter(e => e.currency === cur).length;
                      const tIn = customerLedger.filter(e => e.currency === cur && e.direction === "in").reduce((s, e) => s + e.amount, 0);
                      const tOut = customerLedger.filter(e => e.currency === cur && e.direction === "out").reduce((s, e) => s + e.amount, 0);
                      const colors = currencyColors[cur];
                      return (
                        <div key={cur} className={`rounded-xl border p-4 ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-white"}`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2"><span className={`grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br ${colors.gradient} text-white font-black shadow-md`}>{cur}</span><div><b className={`text-sm font-black ${heading}`}>{labels[cur]}</b><div className={`text-[10px] ${subText}`}>{cnt} رویداد</div></div></div>
                            <div className={`text-2xl font-black tabular-nums ${bal >= 0 ? colors[dk ? "dark" : "light"] : "text-rose-500"}`}>{fmt(bal)}</div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-dashed border-slate-300/30">
                            <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${dk ? "bg-emerald-400/10" : "bg-emerald-50"}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 ${dk ? "text-emerald-300" : "text-emerald-600"}`}><path d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" /></svg><div><div className={`text-[10px] ${subText}`}>دریافت</div><div className={`text-sm font-black tabular-nums ${dk ? "text-emerald-300" : "text-emerald-700"}`}>{fmt(tIn)}</div></div></div>
                            <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${dk ? "bg-rose-400/10" : "bg-rose-50"}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 ${dk ? "text-rose-300" : "text-rose-600"}`}><path d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" /></svg><div><div className={`text-[10px] ${subText}`}>پرداخت</div><div className={`text-sm font-black tabular-nums ${dk ? "text-rose-300" : "text-rose-700"}`}>{fmt(tOut)}</div></div></div>
                          </div>
                          <div className={`mt-2 text-center text-[10px] font-black ${bal < 0 ? "text-rose-500" : bal > 0 ? (dk ? "text-emerald-300" : "text-emerald-600") : subText}`}>
                            {isCashBox ? (bal < 0 ? "⚠️ کسری صندوق" : bal > 0 ? "✅ موجودی نقدی در صندوق" : "⚪ صندوق خالی")
                              : isExchangeAccount ? (bal < 0 ? "🔴 مجموع قرض‌های داده‌شده به مشتریان" : bal > 0 ? "🟢 موجودی اعتباری" : "⚪ خنثی")
                              : (bal < 0 ? "🔴 قرض از صرافی" : bal > 0 ? "🟢 طلب از صرافی" : "⚪ بدون بدهی")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {profileTab === "ledger" && (
                <div className={`rounded-2xl border p-4 md:p-6 ${uiCard}`}>
                  <div className="flex items-center gap-2 mb-4"><span className={`grid h-8 w-8 place-items-center rounded-lg ${dk ? "bg-amber-400/15 text-amber-300" : "bg-amber-100 text-amber-600"}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg></span><b className={`text-sm font-black ${heading}`}>{isCashBox ? "روزنامچه صندوق" : isExchangeAccount ? "روزنامچه حساب صرافی" : "روزنامچه"}</b><span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${dk ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"}`}>{filteredLedger.length}</span></div>
                  <div className="grid gap-2 mb-4 md:grid-cols-[1fr_auto_auto_auto]">
                    <div className="relative"><input value={ledgerSearch} onChange={e => setLedgerSearch(e.target.value)} placeholder="جستجو…" className={`${uiInput} pr-10`} /><span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${dk ? "text-slate-500" : "text-slate-400"}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 1 10.607 10.607Z" /></svg></span></div>
                    <select value={ledgerTypeFilter} onChange={e => setLedgerTypeFilter(e.target.value as any)} className={`${uiInput} cursor-pointer appearance-none pl-9 w-auto min-w-[130px]`}><option value="all">همه</option>{(Object.keys(txLabels) as TxType[]).map(t => <option key={t} value={t}>{txLabels[t]}</option>)}</select>
                    <select value={ledgerCurrencyFilter} onChange={e => setLedgerCurrencyFilter(e.target.value as any)} className={`${uiInput} cursor-pointer appearance-none pl-9 w-auto min-w-[120px]`}><option value="all">همه ارزها</option>{currencies.map(c => <option key={c} value={c}>{labels[c]}</option>)}</select>
                    <select value={ledgerDirFilter} onChange={e => setLedgerDirFilter(e.target.value as any)} className={`${uiInput} cursor-pointer appearance-none pl-9 w-auto min-w-[110px]`}><option value="all">همه</option><option value="in">دریافت</option><option value="out">پرداخت</option></select>
                  </div>
                  {filteredLedger.length === 0 ? (
                    <div className={`flex flex-col items-center gap-3 py-12 ${dk ? "text-slate-500" : "text-slate-400"}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 opacity-70"><path d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z" /></svg><p className="text-sm font-black">رویدادی یافت نشد.</p></div>
                  ) : (
                    <div className="overflow-x-auto cu-scroll">
                      <table className="w-full min-w-[950px] text-sm">
                        <thead><tr className={`border-y ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>{["شماره", "تاریخ", "ساعت", "سند", "نوع", "شرح", "ارز", "دریافت", "پرداخت", "مانده"].map(h => <th key={h} className="px-3 py-2.5 text-center text-[10px] font-black text-slate-400">{h}</th>)}</tr></thead>
                        <tbody className={`divide-y ${dk ? "divide-slate-700/60" : "divide-slate-100"}`}>
                          {filteredLedger.map((e, i) => (
                            <tr key={e.id} className={`transition-colors ${dk ? "hover:bg-slate-700/30" : "hover:bg-emerald-50/50"}`}>
                              <td className="px-3 py-2.5 text-center text-[11px] font-black tabular-nums">{filteredLedger.length - i}</td>
                              <td className={`px-3 py-2.5 text-center text-[11px] tabular-nums ${dk ? "text-slate-300" : "text-slate-600"}`} dir="ltr">{shortDateLabel(e.date)}</td>
                              <td className={`px-3 py-2.5 text-center text-[11px] tabular-nums ${dk ? "text-slate-300" : "text-slate-600"}`} dir="ltr">{timeLabel(e.date)}</td>
                              <td className="px-3 py-2.5 text-center"><span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-black tabular-nums ${dk ? "border-slate-600 text-slate-300" : "border-slate-200 text-slate-600"}`} dir="ltr">{e.referenceNumber || "-"}</span></td>
                              <td className="px-3 py-2.5 text-center"><span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-black ${txColors[e.type][dk ? "dark" : "light"]}`}>{txLabels[e.type]}</span></td>
                              <td className={`px-3 py-2.5 text-center text-[11px] max-w-[200px] truncate ${dk ? "text-slate-200" : "text-slate-700"}`}>{e.description}</td>
                              <td className={`px-3 py-2.5 text-center text-[11px] font-black ${currencyColors[e.currency][dk ? "dark" : "light"]}`}>{labels[e.currency]}</td>
                              <td className={`px-3 py-2.5 text-center text-[11px] font-black tabular-nums ${e.direction === "in" ? "text-emerald-500" : ""}`}>{e.direction === "in" ? fmt(e.amount) : ""}</td>
                              <td className={`px-3 py-2.5 text-center text-[11px] font-black tabular-nums ${e.direction === "out" ? "text-rose-500" : ""}`}>{e.direction === "out" ? fmt(e.amount) : ""}</td>
                              <td className={`px-3 py-2.5 text-center text-[11px] font-black tabular-nums ${currencyColors[e.currency][dk ? "dark" : "light"]}`}>{fmt(e.balanceAfter)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {profileTab === "statement" && (
                <div className={`rounded-2xl border p-4 md:p-6 ${uiCard}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2"><span className={`grid h-8 w-8 place-items-center rounded-lg ${dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-600"}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg></span><b className={`text-sm font-black ${heading}`}>{isCashBox ? "صورت‌حساب صندوق" : isExchangeAccount ? "صورت‌حساب حساب صرافی" : "صورت‌حساب کامل"}</b></div>
                    <button onClick={printStatement} className={`flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-l px-4 py-2 text-sm font-black shadow-lg ${dk ? "from-emerald-400 to-teal-400 text-slate-950" : "from-emerald-500 to-teal-500 text-white"}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" /></svg>چاپ</button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 mb-4">
                    <div className={`rounded-xl border p-4 ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-white"}`}>
                      <b className={`text-xs font-black ${heading}`}>مشخصات</b>
                      <div className={`space-y-1 text-xs mt-2 ${dk ? "text-slate-300" : "text-slate-600"}`}>
                        <div><b>نام:</b> {selectedCustomer.name}</div>
                        <div><b>کد:</b> <span dir="ltr">{isCashBox ? "CASH_BOX" : isExchangeAccount ? "EXCHANGE_ACCOUNT" : selectedCustomer.id.slice(-6)}</span></div>
                        {!isCashBox && !isExchangeAccount && (<><div><b>تلفن:</b> <span dir="ltr">{selectedCustomer.phone || "-"}</span></div><div><b>تذکره:</b> <span dir="ltr">{selectedCustomer.tazkira || "-"}</span></div><div><b>تلگرام:</b> <span dir="ltr">{selectedCustomer.telegram || "-"}</span></div>{selectedCustomer.address && <div><b>آدرس:</b> {selectedCustomer.address}</div>}{selectedCustomer.note && <div><b>یادداشت:</b> {selectedCustomer.note}</div>}</>)}
                        {isCashBox && <div><b>توضیحات:</b> موجودی فیزیکی صندوق صرافی</div>}
                        {isExchangeAccount && <div><b>توضیحات:</b> حساب داخلی صرافی</div>}
                      </div>
                    </div>
                    <div className={`rounded-xl border p-4 ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-white"}`}>
                      <b className={`text-xs font-black ${heading}`}>آمار</b>
                      <div className={`space-y-1 text-xs mt-2 ${dk ? "text-slate-300" : "text-slate-600"}`}>
                        <div><b>رویدادها:</b> {customerLedger.length}</div>
                        <div><b>اولین:</b> {customerLedger.length > 0 ? shortDateLabel(customerLedger[0].date) : "-"}</div>
                        <div><b>آخرین:</b> {customerLedger.length > 0 ? shortDateLabel(customerLedger[customerLedger.length - 1].date) : "-"}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {loanModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm" onClick={() => setLoanModalOpen(false)}>
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${dk ? "border-slate-600 bg-slate-800" : "border-slate-200 bg-white"}`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`grid h-12 w-12 place-items-center rounded-xl ${loanModalType === "give" ? "bg-gradient-to-br from-sky-500 to-cyan-500" : "bg-gradient-to-br from-emerald-500 to-teal-500"} text-white shadow-lg`}>
                {loanModalType === "give"
                  ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M12 21v-8.25M15.75 21V12.5m-7.5 8.5v-8.25m12-4.5L12 2.25 3.75 7.75" /></svg>
                  : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>}
              </div>
              <div>
                <h3 className={`cu-display text-xl ${heading}`}>{loanModalType === "give" ? "قرض دادن به مشتری" : "دریافت قرض از مشتری"}</h3>
                <p className={`text-[11px] font-bold ${subText}`}>{selectedCustomer?.name}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className={uiLabel}>مبلغ *</label>
                <input type="text" inputMode="decimal" dir="ltr" value={loanAmount} onChange={e => setLoanAmount(normalizeDigits(e.target.value).replace(/[^0-9.]/g, ""))} placeholder="0" className={uiInput} autoFocus />
              </div>
              <div>
                <label className={uiLabel}>ارز</label>
                <select value={loanCurrency} onChange={e => setLoanCurrency(e.target.value as Currency)} className={`${uiInput} cursor-pointer appearance-none`}>
                  {currencies.map(c => <option key={c} value={c}>{labels[c]}</option>)}
                </select>
              </div>
              <div>
                <label className={uiLabel}>توضیحات (اختیاری)</label>
                <input value={loanReason} onChange={e => setLoanReason(e.target.value)} placeholder={`مثلاً: ${loanModalType === "give" ? "قرض برای خرید کالا" : "بازپرداخت اقساط"}`} className={uiInput} />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={processLoan} className={`flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl font-black shadow-lg ${loanModalType === "give" ? "bg-gradient-to-l from-sky-500 to-cyan-500 text-white" : "bg-gradient-to-l from-emerald-500 to-teal-500 text-white"}`}>
                {loanModalType === "give" ? "ثبت قرض" : "ثبت بازپرداخت"}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
              </button>
              <button onClick={() => setLoanModalOpen(false)} className={`flex h-12 px-6 cursor-pointer items-center justify-center rounded-xl border font-bold ${dk ? "border-slate-600 text-slate-300" : "border-slate-200 text-slate-600"}`}>انصراف</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`fixed bottom-6 left-6 z-[99] rounded-xl px-4 py-3 text-sm font-bold shadow-lg ${dk ? "bg-slate-800 text-slate-100 border border-slate-600" : "bg-slate-900 text-white"}`}>{toast}</div>}
    </div>
  );
}
