"use client";
import { useEffect, useMemo, useState, useRef, useCallback, type ReactNode } from "react";
import { getNextTrackingCode, consumeTrackingCode, initTrackingSystem } from "../lib/trackingCode";
import { CUSTOMERS_KEY, TRANSACTIONS_KEY, HAWALAS_KEY, CASH_KEY } from "../lib/defaultData";
import { useSyncedState } from "../lib/useSyncedState";

type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";
type Customer = { id: string; name: string; phone?: string; tazkira?: string; address?: string; note?: string; telegram?: string; telegramChatId?: string; registeredAt: string; balances: Record<Currency, number>; };
type CashEntryType = "customer_deposit" | "customer_withdraw" | "owner_deposit" | "owner_withdraw" | "adjustment" | "fee" | "commission_withdraw" | "loan_given" | "loan_received" | "exchange_account_in" | "exchange_account_out";
type BalanceChange = { customerId?: string; customerName: string; currency: Currency; amount: number; };
type CashEntry = { id: string; trackingCode: string; date: string; type: CashEntryType; currency: Currency; amount: number; direction: "in" | "out"; reason: string; balanceAfter: number; customerId?: string; customerName?: string; customerPhone?: string; customerTazkira?: string; linkedExchangeId?: string; linkedHawalaId?: string; linkedHawalaSettleId?: string; customerDeleted?: boolean; status: "active" | "voided"; };
type Transaction = { id: string; trackingCode: string; date: string; type: "exchange" | "transfer" | "convert"; fromCurrency: Currency; fromAmount: number; toCurrency: Currency; toAmount: number; rate: number; rateLabel: string; commission?: number; commissionCurrency?: Currency; commissionPayer?: "sender" | "receiver"; status: "active" | "voided"; customerId?: string; customerName?: string; senderId?: string; senderName?: string; receiverId?: string; receiverName?: string; };
type Hawala = { id: string; number: string; date: string; currencyFrom: Currency; currencyTo: Currency; amountFrom: number; finalAmount: number; fee: number; feeCurrency: Currency; feePayer: "sender" | "receiver"; status: "pending" | "sent" | "paid" | "cancelled"; senderId?: string; senderName: string; receiverId?: string; receiverName: string; };
type FormState = { type: CashEntryType | ""; currency: Currency; amount: string; reason: string; customerId: string; customerName: string; };
type FormErrors = Partial<Record<keyof FormState, string>>;

const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const labels: Record<Currency, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };
const entryTypeLabels: Record<CashEntryType, string> = { 
  customer_deposit: "واریز مشتری", customer_withdraw: "برداشت مشتری", owner_deposit: "واریز مالک به صرافی", 
  owner_withdraw: "برداشت مالک از صرافی", adjustment: "اصلاح صندوق", fee: "کارمزد", commission_withdraw: "برداشت کارمزد",
  loan_given: "پرداخت قرض", loan_received: "دریافت قرض", exchange_account_in: "ورودی حساب صرافی", exchange_account_out: "خروجی حساب صرافی"
};
const entryTypeColors: Record<CashEntryType, { light: string; dark: string }> = { 
  customer_deposit: { light: "bg-teal-100 text-teal-700", dark: "bg-teal-400/15 text-teal-300" }, 
  customer_withdraw: { light: "bg-orange-100 text-orange-700", dark: "bg-orange-400/15 text-orange-300" }, 
  owner_deposit: { light: "bg-sky-100 text-sky-700", dark: "bg-sky-400/15 text-sky-300" }, 
  owner_withdraw: { light: "bg-amber-100 text-amber-700", dark: "bg-amber-400/15 text-amber-300" }, 
  adjustment: { light: "bg-violet-100 text-violet-700", dark: "bg-violet-400/15 text-violet-300" }, 
  fee: { light: "bg-emerald-100 text-emerald-700", dark: "bg-emerald-400/15 text-emerald-300" }, 
  commission_withdraw: { light: "bg-purple-100 text-purple-700", dark: "bg-purple-400/15 text-purple-300" }, 
  loan_given: { light: "bg-rose-100 text-rose-700", dark: "bg-rose-400/15 text-rose-300" }, 
  loan_received: { light: "bg-indigo-100 text-indigo-700", dark: "bg-indigo-400/15 text-indigo-300" }, 
  exchange_account_in: { light: "bg-violet-100 text-violet-700", dark: "bg-violet-400/15 text-violet-300" }, 
  exchange_account_out: { light: "bg-fuchsia-100 text-fuchsia-700", dark: "bg-fuchsia-400/15 text-fuchsia-300" } 
};
const currencyColors: Record<Currency, { light: string; dark: string; gradient: string }> = { 
  AFN: { light: "text-emerald-700", dark: "text-emerald-300", gradient: "from-emerald-500 to-teal-400" }, 
  USD: { light: "text-sky-700", dark: "text-sky-300", gradient: "from-sky-500 to-cyan-400" }, 
  EUR: { light: "text-blue-700", dark: "text-blue-300", gradient: "from-blue-600 to-blue-400" }, 
  IRR: { light: "text-amber-700", dark: "text-amber-300", gradient: "from-amber-500 to-orange-400" }, 
  PKR: { light: "text-rose-700", dark: "text-rose-300", gradient: "from-rose-500 to-pink-400" } 
};

const CASH_BOX_ID = "CASH_BOX";
const CASH_BOX_NAME = "صندوق";
const EXCHANGE_ACCOUNT_ID = "EXCHANGE_ACCOUNT";
const EXCHANGE_ACCOUNT_NAME = "حساب صرافی";
const EXCHANGE_ACCOUNT_CUSTOMER: Customer = { id: EXCHANGE_ACCOUNT_ID, name: EXCHANGE_ACCOUNT_NAME, phone: "", tazkira: "", address: "", note: "حساب داخلی صرافی", telegram: "", telegramChatId: "", registeredAt: "", balances: { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 } };

const hasTelegram = (c: Customer): boolean => Boolean(c.telegramChatId || c.telegram);
const generateId = (): string => { if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") { try { return crypto.randomUUID(); } catch (e) { /* ignore */ } } return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; const v = c === "x" ? r : (r & 0x3) | 0x8; return v.toString(16); }); };
const normalizeDigits = (value: string) => { const pd = "۰۱۲۳۴۵۶۷۸۹", ad = "٠١٢٣٤٥٦٧٨٩"; return String(value || "").replace(/[۰-۹]/g, d => String(pd.indexOf(d))).replace(/[٠-٩]/g, d => String(ad.indexOf(d))); };
const toNumericText = (v: string) => { let s = normalizeDigits(String(v || "")).replace(/[^0-9.]/g, ""); const fd = s.indexOf("."); if (fd !== -1) s = s.slice(0, fd + 1) + s.slice(fd + 1).replace(/\./g, ""); return s; };
const parseAmount = (v: string) => { const n = Number(normalizeDigits(String(v || "")).replace(/,/g, "")); return Number.isFinite(n) && n >= 0 ? n : 0; };
const fmt = (n: number) => (Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0");

function shamsiParts(d: Date) { try { const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d); const get = (type: string) => parts.find((p) => p.type === type)?.value || "0"; return { year: get("year"), month: get("month"), day: get("day") }; } catch (e) { return { year: "0", month: "0", day: "0" }; } }
function formatDateTime(d: Date) { const pad = (n: number) => String(n).padStart(2, "0"); const s = shamsiParts(d); return `${s.year}/${s.month}/${s.day} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function formatShamsiDate(d: Date) { const s = shamsiParts(d); return `${s.year}/${s.month}/${s.day}`; }
function shortDateLabel(s: string) { try { const d = new Date(s); return Number.isNaN(d.getTime()) ? "-" : formatShamsiDate(d); } catch (e) { return "-"; } }
function timeLabel(s: string) { try { const d = new Date(s); if (Number.isNaN(d.getTime())) return "-"; const pad = (n: number) => String(n).padStart(2, "0"); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; } catch (e) { return "-"; } }

function getLedgerBalance(customerId: string, currency: Currency, entries: CashEntry[], transactions: Transaction[] = []): number {
  let balance = 0;
  for (const entry of entries) {
    if (entry.status === "voided" || entry.currency !== currency) continue;
    if (customerId === CASH_BOX_ID) {
      if (entry.type === "exchange_account_in" || entry.type === "exchange_account_out") continue;
      if (entry.type === "loan_given") balance -= entry.amount;
      else if (entry.type === "loan_received") balance += entry.amount;
      else { const physicalMultiplier = entry.direction === "in" ? 1 : -1; balance += entry.amount * physicalMultiplier; }
    } else if (customerId === EXCHANGE_ACCOUNT_ID) {
      if (entry.type === "owner_deposit") balance += entry.amount;
      else if (entry.type === "owner_withdraw") balance -= entry.amount;
      else if (entry.type === "exchange_account_in") balance += entry.amount;
      else if (entry.type === "exchange_account_out") balance -= entry.amount;
      else if (entry.type === "loan_given") balance -= entry.amount;
      else if (entry.type === "loan_received") balance += entry.amount;
    } else {
      if (entry.customerId === customerId) {
        if (entry.type === "customer_deposit") balance += entry.amount;
        else if (entry.type === "customer_withdraw") balance -= entry.amount;
        else if (entry.type === "loan_given") balance -= entry.amount;
        else if (entry.type === "loan_received") balance += entry.amount;
      }
    }
  }
  
  if (customerId !== CASH_BOX_ID && customerId !== EXCHANGE_ACCOUNT_ID) {
    for (const tx of transactions) {
      if (tx.status === "voided") continue;
      if (tx.type === "exchange" && tx.customerId === customerId) {
        if (tx.fromCurrency === currency) balance -= tx.fromAmount;
        if (tx.toCurrency === currency) balance += tx.toAmount;
        if (tx.commission && tx.commissionCurrency === currency) balance -= tx.commission;
      }
      if (tx.type === "transfer") {
        if (tx.senderId === customerId) {
          if (tx.fromCurrency === currency) balance -= tx.fromAmount;
          if (tx.commissionPayer === "sender" && tx.commission && tx.commissionCurrency === currency) balance -= tx.commission;
        }
        if (tx.receiverId === customerId) {
          if (tx.toCurrency === currency) balance += tx.toAmount;
          if (tx.commissionPayer === "receiver" && tx.commission && tx.commissionCurrency === currency) balance -= tx.commission;
        }
      }
      if (tx.type === "convert" && tx.customerId === customerId) {
        if (tx.fromCurrency === currency) balance -= tx.fromAmount;
        if (tx.toCurrency === currency) balance += tx.toAmount;
        if (tx.commission && tx.commissionCurrency === currency) balance -= tx.commission;
      }
    }
  }
  return balance;
}

function recomputeCashBalances(entries: CashEntry[]): CashEntry[] {
  const sorted = [...entries].sort((a, b) => {
    const t1 = new Date(a.date).getTime(); const t2 = new Date(b.date).getTime();
    if (t1 !== t2) return t1 - t2;
    if (a.direction === "in" && b.direction === "out") return -1;
    if (a.direction === "out" && b.direction === "in") return 1;
    return 0;
  });
  const bals: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
  return sorted.map(e => {
    if (e.status === "voided") return { ...e, balanceAfter: bals[e.currency] || 0 };
    if (e.currency && bals[e.currency] !== undefined) {
      if (e.type !== "exchange_account_in" && e.type !== "exchange_account_out") {
        bals[e.currency] += e.direction === "in" ? (e.amount || 0) : -(e.amount || 0);
      }
    }
    return { ...e, balanceAfter: bals[e.currency] || 0 };
  });
}

function applyBalanceChanges(customers: Customer[], changes: BalanceChange[]): Customer[] {
  return customers.map(c => {
    const cc = changes.filter(ch => ch.customerId === c.id && ch.customerId !== CASH_BOX_ID);
    if (cc.length === 0) return c;
    const nb = { ...c.balances };
    for (const ch of cc) { if (nb[ch.currency] === undefined) nb[ch.currency] = 0; nb[ch.currency] = (nb[ch.currency] || 0) + ch.amount; }
    return { ...c, balances: nb };
  });
}

function getBalanceChangesForCashEntry(entry: CashEntry, action: "register" | "reverse"): BalanceChange[] {
  const changes: BalanceChange[] = [];
  const sign = action === "register" ? 1 : -1;
  if (entry.type === "customer_deposit" || entry.type === "customer_withdraw") {
    if (entry.customerId && entry.customerId !== CASH_BOX_ID && entry.customerId !== EXCHANGE_ACCOUNT_ID) {
      const delta = entry.type === "customer_deposit" ? entry.amount : -entry.amount;
      changes.push({ customerId: entry.customerId, customerName: entry.customerName || "", currency: entry.currency, amount: delta * sign });
    }
  }
  if (entry.type === "owner_deposit" || entry.type === "owner_withdraw" || entry.type === "loan_given" || entry.type === "loan_received") {
    let exchangeDelta = 0;
    if (entry.type === "owner_deposit") exchangeDelta = entry.amount;
    else if (entry.type === "owner_withdraw") exchangeDelta = -entry.amount;
    else if (entry.type === "loan_given") exchangeDelta = -entry.amount;
    else if (entry.type === "loan_received") exchangeDelta = entry.amount;
    changes.push({ customerId: EXCHANGE_ACCOUNT_ID, customerName: EXCHANGE_ACCOUNT_NAME, currency: entry.currency, amount: exchangeDelta * sign });
  }
  return changes;
}

const emptyForm: FormState = { type: "", currency: "AFN", amount: "", reason: "", customerId: "", customerName: "" };

function formatShamsiDateTime(date: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const g = (t: string) => parts.find(p => p.type === t)?.value || "0";
    const y = g("year"), m = g("month"), d = g("day");
    const h = date.getHours(), min = String(date.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM"; const h12 = h % 12 || 12;
    return `${y}/${m}/${d} ${h12}:${min} ${ampm}`;
  } catch { return "-"; }
}

function numberToPersianWords(num: number): string {
  if (!Number.isFinite(num) || num === 0) return "صفر";
  const ones = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
  const teens = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
  const tens = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
  const hundreds = ["", "یکصد", "دوصد", "سیصد", "چهارصد", "پنجصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
  const scales = ["", "هزار", "میلیون", "میلیارد", "تریلیون"];
  function threeDigits(n: number): string {
    if (n === 0) return "";
    const h = Math.floor(n / 100); const rem = n % 100;
    const t = Math.floor(rem / 10); const o = rem % 10;
    let r = hundreds[h];
    if (rem >= 10 && rem <= 19) { if (r) r += " و "; r += teens[rem - 10]; }
    else { if (t > 0) { if (r) r += " و "; r += tens[t]; } if (o > 0) { if (r) r += " و "; r += ones[o]; } }
    return r;
  }
  const parts: string[] = []; let si = 0; let n = Math.floor(Math.abs(num));
  while (n > 0 && si < scales.length) {
    const chunk = n % 1000;
    if (chunk > 0) { const cw = threeDigits(chunk); if (si > 0) parts.unshift(`${cw} ${scales[si]}`); else parts.unshift(cw); }
    n = Math.floor(n / 1000); si++;
  }
  return parts.join(" و ");
}

async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<boolean> {
  if (!botToken || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: text }),
    });
    const data = await res.json(); return data.ok === true;
  } catch { return false; }
}

function getTelegramSettings() {
  try { const r = localStorage.getItem("fx-settings"); if (!r) return { enabled: false, botToken: "", notifyCash: true };
    const s = JSON.parse(r); return { enabled: s.telegram?.enabled || false, botToken: s.telegram?.botToken || "", notifyCash: s.telegram?.notifyCash !== false };
  } catch { return { enabled: false, botToken: "", notifyCash: true }; }
}

function getCustomerChatId(customerId: string | undefined, customers: Customer[]): string {
  if (!customerId || customerId === CASH_BOX_ID || customerId === EXCHANGE_ACCOUNT_ID) return "";
  try { const c = customers.find(x => x.id === customerId); return c ? (c.telegramChatId || c.telegram || "") : ""; } catch { return ""; }
}

function buildCashReceiptText(params: { entry: CashEntry; customerName: string; balances: Record<string, number>; date: Date; }): string {
  const { entry, customerName, balances, date } = params;
  const dateStr = formatShamsiDateTime(date);
  const isDeposit = entry.direction === "in";
  const title = isDeposit ? "🟢 سند رسید" : "🔴 سند برد";
  let text = `${title}\n\n🗓 تاریخ: ${dateStr}\n\n🛅 کد پیگیری: ${entry.trackingCode}\n\n👤 مشتری: ${customerName}\n\n📑 شرح: ${entry.reason}\n\n`;
  if (isDeposit) text += `💵 دریافت: ${fmt(entry.amount)} ${labels[entry.currency]}\n`;
  else text += `💰 پرداخت: ${fmt(entry.amount)} ${labels[entry.currency]}\n`;
  text += `📝 به حروف: ${numberToPersianWords(entry.amount)}\n\n-------------بیلانس فعلی شما--------------\n`;
  const curLabels: Record<string, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };
  for (const [cur, bal] of Object.entries(balances)) {
    const label = curLabels[cur] || cur;
    const status = bal > 0 ? "طلب" : bal < 0 ? "قرض" : "";
    text += `${label}: ${Math.abs(bal).toLocaleString("en-US")} ${status}\n`;
  }
  text += `\n🏦 صرافی برادران نورزاد — هرات`;
  return text;
}

function buildCashVoidNoticeText(params: { entry: CashEntry; customerName: string; balances: Record<string, number>; date: Date; }): string {
  const { entry, customerName, balances, date } = params;
  const dateStr = formatShamsiDateTime(date);
  let text = `📬 اطلاعیه لغو سند صندوق\n\n🗓 تاریخ: ${dateStr}\n\n🛅 کد پیگیری: ${entry.trackingCode}\n\n👤 مشتری: ${customerName}\n\n`;
  if (entry.type === "customer_deposit") text += `📑 شرح: سند لغو شد — مبلغ از حساب شما کسر گردید\n\n💰 مبلغ کسرشده: ${fmt(entry.amount)} ${labels[entry.currency]}\n`;
  else text += `📑 شرح: سند لغو شد — مبلغ به حساب شما برگشت داده شد\n\n💰 مبلغ برگشتی: ${fmt(entry.amount)} ${labels[entry.currency]}\n`;
  text += `📝 به حروف: ${numberToPersianWords(entry.amount)}\n\n-------------بیلانس فعلی شما--------------\n`;
  const curLabels: Record<string, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };
  for (const [cur, bal] of Object.entries(balances)) {
    const label = curLabels[cur] || cur;
    const status = bal > 0 ? "طلب" : bal < 0 ? "قرض" : "";
    text += `${label}: ${Math.abs(bal).toLocaleString("en-US")} ${status}\n`;
  }
  text += `\n🏦 صرافی برادران نورزاد — هرات`;
  return text;
}

async function sendCashReceipts(params: { entry: CashEntry; action: "register" | "void"; customers: Customer[]; }) {
  const settings = getTelegramSettings();
  if (!settings.enabled || !settings.botToken || !settings.notifyCash) return;
  const { entry, action, customers } = params;
  if (!entry.customerId || entry.customerId === CASH_BOX_ID || entry.customerId === EXCHANGE_ACCOUNT_ID) return;
  if (entry.type !== "customer_deposit" && entry.type !== "customer_withdraw") return;
  const chatId = getCustomerChatId(entry.customerId, customers);
  if (!chatId) return;
  const getBalances = (): Record<string, number> => {
    const customer = customers.find(c => c.id === entry.customerId);
    return customer ? customer.balances : {};
  };
  const now = new Date();
  const text = action === "register" 
    ? buildCashReceiptText({ entry, customerName: entry.customerName || "", balances: getBalances(), date: now })
    : buildCashVoidNoticeText({ entry, customerName: entry.customerName || "", balances: getBalances(), date: now });
  await sendTelegramMessage(settings.botToken, chatId, text);
}

const Ic = ({ n, className = "h-5 w-5" }: { n: string; className?: string }) => {
  const paths: Record<string, string> = {
    wallet: "M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3",
    plus: "M12 4.5v15m7.5-7.5h-15", arrowDown: "M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3", arrowUp: "M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18",
    user: "M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z",
    doc: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
    search: "m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 1 10.607 10.607Z",
    chevron: "m19.5 8.25-7.5 7.5-7.5-7.5", x: "M6 18 18 6M6 6l12 12", check: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    alert: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z",
    inbox: "M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z",
    sun: "M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.375 3.375 0 1 1-7.5 0 3.375 3.375 0 0 1 7.5 0Z",
    moon: "M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z",
    history: "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z", pencil: "m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10",
    more: "M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z",
    eye: "M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
    xCircle: "m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z", gem: "M12 2 2 7l10 15L22 7l-10-5Z", crown: "M2 18h20l-2-9-4 4-4-7-4 7-4-4-2 9Z", tag: "M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z",
    trash: "M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d={paths[n] || ""} /></svg>;
};

export default function CashPage() {
  const [mounted, setMounted] = useState(false);
  
  const [entries, setEntries] = useSyncedState<CashEntry[]>(CASH_KEY, []);
  const [customers, setCustomers] = useSyncedState<Customer[]>(CUSTOMERS_KEY, []);
  const [transactions, setTransactions] = useSyncedState<Transaction[]>(TRANSACTIONS_KEY, []);
  const [hawalas, setHawalas] = useSyncedState<Hawala[]>(HAWALAS_KEY, []);
  
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [activeTab, setActiveTab] = useState<"register" | "ledger">("register");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [toast, setToast] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<CashEntry | null>(null);
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [customerFilter, setCustomerFilter] = useState("");
  const customerListRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<CashEntryType | "all">("all");
  const [filterCurrency, setFilterCurrency] = useState<Currency | "all">("all");
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<CashEntry | null>(null);

  useEffect(() => { try { const saved = window.localStorage.getItem("fx-theme"); if (saved === "dark" || saved === "light") setTheme(saved); } catch (e) { /* ignore */ } }, []);
  useEffect(() => { try { window.localStorage.setItem("fx-theme", theme); } catch (e) { /* ignore */ } }, [theme]);
  const dk = theme === "dark";

  useEffect(() => {
    try { initTrackingSystem(); } catch (err) { console.error("Load error:", err); }
    setMounted(true);
  }, []);

  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  const currentDateTime = now ? formatDateTime(now) : "";

  useEffect(() => {
    if (!showCustomerList) return;
    const handler = (e: MouseEvent) => { if (customerListRef.current && !customerListRef.current.contains(e.target as Node)) setShowCustomerList(false); };
    const timer = setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handler); };
  }, [showCustomerList]);

  useEffect(() => {
    if (!openActionId) return;
    const handler = (e: MouseEvent) => { const target = e.target as HTMLElement; if (!target.closest('.action-dropdown')) setOpenActionId(null); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openActionId]);

  // ✅ اصلاح شده: ترتیب محاسبات دقیقاً مطابق داشبورد برای تضمین یکسانی اعداد
  
  // ۱. مجموع طلب مشتریان (فقط مقادیر مثبت)
  const customerDeposits = useMemo(() => {
    const totals: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    for (const c of customers) {
      if (c.id === CASH_BOX_ID || c.id === EXCHANGE_ACCOUNT_ID) continue;
      for (const cur of currencies) {
        const bal = getLedgerBalance(c.id, cur, entries, transactions);
        if (bal > 0) totals[cur] += bal;
      }
    }
    return totals;
  }, [customers, entries, transactions]);

  // ۲. مجموع بدهی مشتریان (فقط مقادیر منفی)
  const customerDebts = useMemo(() => {
    const totals: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    for (const c of customers) {
      if (c.id === CASH_BOX_ID || c.id === EXCHANGE_ACCOUNT_ID) continue;
      for (const cur of currencies) {
        const bal = getLedgerBalance(c.id, cur, entries, transactions);
        if (bal < 0) totals[cur] += Math.abs(bal);
      }
    }
    return totals;
  }, [customers, entries, transactions]);

  // ۳. موجودی حساب صرافی (واریز/برداشت مالک - بدهی مشتریان)
  const exchangeBalance = useMemo(() => {
    const bal: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    for (const cur of currencies) {
      let ownerBalance = 0;
      for (const entry of entries) {
        if (entry.status === "voided" || entry.currency !== cur) continue;
        if (entry.type === "owner_deposit") ownerBalance += entry.amount;
        else if (entry.type === "owner_withdraw") ownerBalance -= entry.amount;
      }
      bal[cur] = ownerBalance - (customerDebts[cur] || 0);
    }
    return bal;
  }, [entries, customerDebts]);

  // ✅ ۴. موجودی فیزیکی صندوق = حساب صرافی + طلب مشتریان (دقیقاً مطابق فرمول داشبورد)
  const physicalCashBalances = useMemo(() => {
    const balances: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    for (const cur of currencies) {
      balances[cur] = customerDeposits[cur] + exchangeBalance[cur];
    }
    return balances;
  }, [customerDeposits, exchangeBalance]);

  const totalCommissionEarned = useMemo(() => {
    const totals: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    for (const tx of transactions) { if (tx.commission && tx.commission > 0 && tx.commissionCurrency) totals[tx.commissionCurrency] += tx.commission; }
    for (const h of hawalas) { if (h.fee && h.fee > 0 && h.feeCurrency && h.status !== "cancelled") totals[h.feeCurrency] += h.fee; }
    return totals;
  }, [transactions, hawalas]);

  const commissionWithdrawn = useMemo(() => {
    const totals: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    for (const e of entries) { if (e.type === "commission_withdraw" && e.status === "active" && e.direction === "out") totals[e.currency] += e.amount; }
    return totals;
  }, [entries]);

  const availableCommission = useMemo(() => {
    const totals: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    for (const cur of currencies) totals[cur] = Math.max(0, (totalCommissionEarned[cur] || 0) - (commissionWithdrawn[cur] || 0));
    return totals;
  }, [totalCommissionEarned, commissionWithdrawn]);

  const filteredCustomerList = useMemo(() => {
    const q = normalizeDigits(customerFilter.trim()).toLowerCase();
    const virtualAccounts = [EXCHANGE_ACCOUNT_CUSTOMER].filter(acc => !q || acc.name.includes(q));
    const normalCustomers = customers.filter(c => c.id !== CASH_BOX_ID && c.id !== EXCHANGE_ACCOUNT_ID)
      .filter(c => !q || c.name.toLowerCase().includes(q) || (c.phone && normalizeDigits(c.phone).includes(q)) || (c.tazkira && normalizeDigits(c.tazkira).includes(q)));
    return [...virtualAccounts, ...normalCustomers];
  }, [customers, customerFilter]);

  const filteredEntries = useMemo(() => {
    let result = [...entries];
    if (filterType !== "all") result = result.filter(e => e.type === filterType);
    if (filterCurrency !== "all") result = result.filter(e => e.currency === filterCurrency);
    const q = normalizeDigits(search.trim()).toLowerCase();
    if (q) result = result.filter(e => {
      const fields = [e.trackingCode, e.reason, entryTypeLabels[e.type], e.customerName || "", e.customerPhone || "", e.customerTazkira || ""].map(f => normalizeDigits(String(f)).toLowerCase());
      return fields.some(f => f.includes(q));
    });
    return result.sort((a, b) => { try { return new Date(b.date).getTime() - new Date(a.date).getTime(); } catch (e) { return 0; } });
  }, [entries, search, filterType, filterCurrency]);

  const activeCount = useMemo(() => entries.filter(e => e.status === "active").length, [entries]);
  const voidedCount = entries.length - activeCount;

  const hasType = form.type !== "";
  const isInType = form.type === "customer_deposit" || form.type === "owner_deposit" || form.type === "adjustment" || form.type === "fee" || form.type === "loan_received";
  const isCustomerType = form.type === "customer_deposit" || form.type === "customer_withdraw";
  const isCommissionType = form.type === "commission_withdraw";
  const selectedCustomer = useMemo(() => customers.find(c => c.id === form.customerId) || null, [customers, form.customerId]);
  const editingEntry = useMemo(() => entries.find(e => e.id === editingEntryId) || null, [entries, editingEntryId]);

  const showToast = useCallback((message: string) => { setToast(message); setTimeout(() => setToast(""), 3500); }, []);
  const setField = useCallback((field: keyof FormState, value: string) => { setForm(prev => ({ ...prev, [field]: value })); setErrors(prev => ({ ...prev, [field]: undefined })); }, []);

  const validateForm = useCallback(() => {
    const errs: FormErrors = {};
    if (!form.type) errs.type = "نوع عملیات را انتخاب کنید.";
    const amount = parseAmount(form.amount);
    if (!amount) errs.amount = "مبلغ خالی یا صفر است.";
    if (!form.reason.trim()) errs.reason = "دلیل / شرح ضروری است.";
    if (isCustomerType && !form.customerName.trim()) errs.customerName = "انتخاب مشتری ضروری است.";
    if (form.type === "commission_withdraw") {
      const avail = availableCommission[form.currency] || 0;
      if (amount > avail) errs.amount = `کارمزد کافی نیست. قابل برداشت: ${fmt(avail)} ${labels[form.currency]}`;
    }
    return errs;
  }, [form, isCustomerType, availableCommission]);

  const cancelEdit = useCallback(() => { setEditingEntryId(null); setForm(emptyForm); setErrors({}); }, []);

  const editEntry = useCallback((entry: CashEntry) => {
    if (entry.status === "voided") return;
    setEditingEntryId(entry.id);
    setForm({ type: entry.type, currency: entry.currency, amount: String(entry.amount), reason: entry.reason, customerId: entry.customerId || "", customerName: entry.customerName || "" });
    setErrors({});
    setActiveTab("register");
  }, []);

  const voidEntry = useCallback(async (entry: CashEntry) => {
    if (entry.status === "voided") return;
    if (!window.confirm(`آیا از ابطال سند ${entry.trackingCode} مطمئن هستید؟`)) return;
    const updatedCustomers = applyBalanceChanges(customers, getBalanceChangesForCashEntry(entry, "reverse"));
    setCustomers(updatedCustomers);
    const newEntries = recomputeCashBalances(entries.map((e) => (e.id === entry.id ? { ...e, status: "voided" as const } : e)));
    setEntries(newEntries);
    showToast(`سند ${entry.trackingCode} ابطال شد.`);
  }, [showToast, customers, entries]);

  const deleteEntry = useCallback((entry: CashEntry) => {
    if (!window.confirm(`آیا از حذف سند ${entry.trackingCode} مطمئن هستید؟`)) return;
    if (entry.status !== "voided") {
      const updatedCust = applyBalanceChanges(customers, getBalanceChangesForCashEntry(entry, "reverse"));
      setCustomers(updatedCust);
    }
    const newEntries = recomputeCashBalances(entries.filter((e) => e.id !== entry.id));
    setEntries(newEntries);
    showToast(`سند ${entry.trackingCode} حذف شد.`);
  }, [showToast, customers, entries]);

  const handleSubmitClick = useCallback(() => {
    const errs = validateForm(); setErrors(errs);
    if (Object.keys(errs).length > 0) { showToast("لطفاً فیلدهای ضروری را تکمیل کنید."); return; }
    const amount = parseAmount(form.amount);
    const direction: "in" | "out" = isInType ? "in" : "out";
    let entry: CashEntry;
    if (editingEntryId) {
      const old = entries.find(e => e.id === editingEntryId);
      entry = { id: editingEntryId, trackingCode: old?.trackingCode || getNextTrackingCode(), date: old?.date || new Date().toISOString(), type: form.type as CashEntryType, currency: form.currency, amount, direction, reason: form.reason.trim(), balanceAfter: 0, customerId: isCustomerType ? form.customerId : undefined, customerName: isCustomerType ? form.customerName : undefined, status: "active" };
    } else {
      const currentBal = physicalCashBalances[form.currency] || 0;
      const newBal = isInType ? currentBal + amount : currentBal - amount;
      entry = { id: generateId(), trackingCode: getNextTrackingCode(), date: new Date().toISOString(), type: form.type as CashEntryType, currency: form.currency, amount, direction, reason: form.reason.trim(), balanceAfter: newBal, customerId: isCustomerType ? form.customerId : undefined, customerName: isCustomerType ? form.customerName : undefined, status: "active" };
    }
    setPreviewData(entry); setPreviewOpen(true);
  }, [validateForm, form, physicalCashBalances, isInType, isCustomerType, showToast, editingEntryId, entries]);

  const confirmRegister = useCallback(async () => {
    if (!previewData) return;
    const wasEditing = !!editingEntryId;
    let updatedCustomers = customers;
    let finalEntry = previewData;
    if (wasEditing) {
      const oldEntry = entries.find(e => e.id === editingEntryId);
      if (oldEntry) updatedCustomers = applyBalanceChanges(updatedCustomers, getBalanceChangesForCashEntry(oldEntry, "reverse"));
      const updated: CashEntry = { ...previewData, id: editingEntryId!, trackingCode: oldEntry?.trackingCode || previewData.trackingCode, date: oldEntry?.date || previewData.date, status: "active" };
      if (updated.customerId && updated.customerId !== CASH_BOX_ID) { const cust = customers.find(c => c.id === updated.customerId); if (cust) { updated.customerPhone = cust.phone || ""; updated.customerTazkira = cust.tazkira || ""; } }
      updatedCustomers = applyBalanceChanges(updatedCustomers, getBalanceChangesForCashEntry(updated, "register"));
      
      const updatedEntriesForEdit = recomputeCashBalances(entries.map(e => e.id === editingEntryId ? updated : e));
      setEntries(updatedEntriesForEdit);
      finalEntry = updated;
} else {
  // ✅ اضافه شدن await برای دریافت کد پیگیری از سرور فایربیس
  const newTrackingCode = await consumeTrackingCode();
  
  const entry = { ...previewData, trackingCode: newTrackingCode, status: "active" as const };
  if (entry.customerId && entry.customerId !== CASH_BOX_ID) { const cust = customers.find(c => c.id === entry.customerId); if (cust) { entry.customerPhone = cust.phone || ""; entry.customerTazkira = cust.tazkira || ""; } }
  updatedCustomers = applyBalanceChanges(updatedCustomers, getBalanceChangesForCashEntry(entry, "register"));
  
  const updatedEntriesForNew = recomputeCashBalances([...entries, entry]);
  setEntries(updatedEntriesForNew);
  finalEntry = entry;
}
    setCustomers(updatedCustomers);
    setForm(emptyForm); setErrors({}); setEditingEntryId(null); setPreviewOpen(false); setPreviewData(null);
    await sendCashReceipts({ entry: finalEntry, action: "register", customers: updatedCustomers });
    showToast(wasEditing ? "سند با موفقیت ویرایش شد." : isCommissionType ? "کارمزد با موفقیت برداشت شد." : "عملیات صندوق با موفقیت ثبت شد.");
  }, [previewData, editingEntryId, entries, customers, showToast, isCommissionType]);

  if (!mounted) return (<div className="min-h-screen flex items-center justify-center"><div className="text-center"><div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-emerald-500" /><p className="mt-4 text-slate-500">در حال بارگذاری...</p></div></div>);

  const heading = dk ? "text-white" : "text-slate-900";
  const subText = dk ? "text-slate-500" : "text-slate-400";
  const glassChip = dk ? "border-slate-600/70 bg-slate-800/80" : "border-emerald-100 bg-white/85";
  const uiCard = `rounded-2xl border backdrop-blur transition-colors duration-300 ${dk ? "border-slate-700 bg-slate-800/90 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.6)]" : "border-emerald-100 bg-white/95 shadow-[0_16px_40px_-28px_rgba(16,185,129,0.35)]"}`;
  const inputShell = `rounded-xl border text-sm font-medium shadow-sm outline-none transition-all duration-200 focus:ring-4 ${dk ? "border-slate-600 bg-slate-900 text-slate-100 placeholder:text-slate-500 hover:border-slate-500 focus:border-emerald-400 focus:ring-emerald-400/10" : "border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 hover:border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500/10"}`;
  const uiInput = `h-12 w-full px-3.5 ${inputShell}`;
  const errInput = dk ? "border-rose-500 bg-rose-500/10 ring-rose-500/20" : "border-rose-500 bg-rose-50 ring-rose-500/20";
  const roInput = dk ? "cursor-default bg-slate-800/70 text-slate-400" : "cursor-default bg-slate-100 text-slate-500";
  const uiLabel = `mb-1.5 block text-[11px] font-black tracking-wide ${dk ? "text-slate-400" : "text-slate-500"}`;
  const chevPos = `pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${dk ? "text-slate-500" : "text-slate-400"}`;
  const identIcon = dk ? "from-emerald-400/20 to-teal-400/5 text-emerald-300 ring-emerald-400/25" : "from-emerald-400/20 to-teal-400/10 text-emerald-600 ring-emerald-400/30";
  const fld = (label: string, node: ReactNode, cls = "") => (<div className={cls}><label className={uiLabel}>{label}</label>{node}</div>);
  const errorList = Object.values(errors).filter((msg): msg is string => Boolean(msg));

  const entryTypeOptions: [string, string][] = [
    ["", "— انتخاب کنید —"], ["customer_deposit", "واریز مشتری به حساب"], ["customer_withdraw", "برداشت مشتری از حساب"],
    ["owner_deposit", "واریز مالک به صرافی"], ["owner_withdraw", "برداشت مالک از صرافی"], ["commission_withdraw", "💎 برداشت کارمزد صرافی"],
  ];

  return (
    <div dir="rtl" className={dk ? "dark" : ""}>
      <style>{`@import url("https://fonts.googleapis.com/css2?family=Lalezar&family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap");.cs-font{font-family:"Vazirmatn","Segoe UI",Tahoma,sans-serif}.cs-display{font-family:"Lalezar","Vazirmatn",Tahoma,sans-serif;letter-spacing:.01em}.dark{color-scheme:dark}@keyframes csUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}.cs-up{animation:csUp .5s cubic-bezier(.22,.8,.35,1) both}.cs-scroll::-webkit-scrollbar{height:6px;width:6px}.cs-scroll::-webkit-scrollbar-thumb{background:rgba(16,185,129,.3);border-radius:3px}.cs-scroll{scrollbar-width:thin}::selection{background:rgba(16,185,129,.25)}`}</style>
      <div className={`cs-font relative min-h-screen overflow-x-hidden antialiased transition-colors duration-500 ${dk ? "bg-[#0f172a] text-slate-100" : "bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 text-slate-800"}`}>
        <div className={`fixed inset-x-0 top-0 z-30 h-1 bg-gradient-to-l ${dk ? "from-emerald-400 via-teal-400 to-cyan-400" : "from-emerald-500 via-teal-500 to-cyan-500"}`} />
        <div className="relative z-10 mx-auto w-full max-w-7xl space-y-4 md:space-y-6 px-3 pb-16 pt-5 md:px-8 md:pt-9">
          <header className="cs-up flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0">
              <div className="relative grid h-11 w-11 md:h-14 md:w-14 shrink-0 place-items-center rounded-xl md:rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-400 text-white shadow-lg shadow-emerald-500/30 ring-1 ring-white/30"><Ic n="wallet" className="h-5 w-5 md:h-6 md:w-6" /><span className={`absolute -bottom-1 -left-1 md:-bottom-1.5 md:-left-1.5 grid h-4 min-w-4 md:h-5 md:min-w-5 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-400 px-1 text-[7px] md:text-[8px] font-black text-white ring-2 ${dk ? "ring-[#0f172a]" : "ring-[#ecfdf5]"}`}>CS</span></div>
              <div className="min-w-0"><h1 className={`cs-display text-2xl md:text-4xl leading-none ${heading}`}>صندوق</h1><p className={`mt-1 text-[10px] md:text-xs font-bold ${subText}`}>مدیریت واریز، برداشت و موجودی نقدی</p></div>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2.5">
              <div className={`hidden sm:flex items-center gap-2 rounded-xl border px-3 py-2 shadow-sm backdrop-blur ${glassChip}`}><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" /></span><span dir="ltr" className={`text-xs font-bold tabular-nums ${dk ? "text-slate-100" : "text-slate-700"}`}>{currentDateTime || "--:--"}</span></div>
              <button onClick={() => setTheme(dk ? "light" : "dark")} className={`group grid h-10 w-10 md:h-11 md:w-11 cursor-pointer place-items-center rounded-lg md:rounded-xl border shadow-sm backdrop-blur transition-all duration-300 active:scale-90 ${dk ? "border-slate-600 bg-slate-800/85 text-amber-300 hover:border-amber-300" : "border-slate-200 bg-white/85 text-slate-600 hover:border-emerald-400"}`}>{dk ? <Ic n="sun" className="h-4 w-4 transition-transform duration-500 group-hover:rotate-45" /> : <Ic n="moon" className="h-4 w-4 transition-transform duration-500 group-hover:-rotate-12" />}</button>
            </div>
          </header>

          <div className="cs-up space-y-4 md:space-y-5" style={{ animationDelay: "70ms" }}>
            <div className={`relative overflow-hidden rounded-xl md:rounded-2xl border-2 p-3 md:p-4 transition-all duration-300 hover:shadow-xl ${dk ? "border-emerald-400/40 bg-gradient-to-br from-emerald-900/40 via-slate-900/60 to-teal-900/40 shadow-[0_10px_30px_-10px_rgba(16,185,129,0.3)]" : "border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-teal-50 shadow-[0_10px_30px_-10px_rgba(16,185,129,0.25)]"}`}>
              <div className="relative flex items-center gap-3 mb-3">
                <div className={`relative grid h-10 w-10 md:h-12 md:w-12 shrink-0 place-items-center rounded-xl shadow-md ${dk ? "bg-gradient-to-br from-emerald-400 to-teal-400 text-slate-950" : "bg-gradient-to-br from-emerald-500 to-teal-500 text-white"}`}>
                  <Ic n="wallet" className="h-5 w-5 md:h-6 md:w-6" />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" /></span>
                </div>
                <div className="flex-1 min-w-0">
                  <b className={`block text-sm md:text-base font-black ${dk ? "text-emerald-300" : "text-emerald-700"}`}>💰 موجودی فیزیکی صندوق</b>
                  <span className={`block text-[10px] md:text-[11px] font-bold mt-0.5 ${dk ? "text-slate-400" : "text-slate-500"}`}>حساب صرافی + طلب مشتریان</span>
                </div>
              </div>
              <div className="relative grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 md:gap-3">
                {currencies.map(cur => {
                  const bal = physicalCashBalances[cur];
                  const isNeg = bal < 0;
                  return (
                    <div key={cur} className={`group relative overflow-hidden rounded-xl p-2.5 md:p-3 text-center transition-all duration-300 ${dk ? "bg-slate-950/60 ring-1 ring-slate-700/50" : "bg-white/90 ring-1 ring-emerald-100 shadow-sm"}`}>
                      <div className={`text-[11px] md:text-[12px] font-black mb-1 ${dk ? "text-slate-400" : "text-slate-500"}`}>{labels[cur]}</div>
                      <div className={`text-lg md:text-xl font-black tabular-nums leading-tight ${isNeg ? "text-rose-500" : dk ? "text-emerald-300" : "text-emerald-700"}`}>{fmt(bal)}</div>
                      <div className={`mt-1 text-[8px] md:text-[9px] font-black ${isNeg ? "text-rose-500" : dk ? "text-emerald-400/70" : "text-emerald-600/70"}`}>{isNeg ? "⚠️ کسری" : "✅ نقدی"}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`relative overflow-hidden rounded-xl md:rounded-2xl border-2 p-3 md:p-4 transition-all duration-300 hover:shadow-xl ${dk ? "border-violet-400/40 bg-gradient-to-br from-violet-900/40 via-slate-900/60 to-indigo-900/40" : "border-violet-300 bg-gradient-to-br from-violet-50 via-white to-indigo-50"}`}>
              <div className="relative flex items-center gap-3 mb-3">
                <div className={`relative grid h-10 w-10 md:h-12 md:w-12 shrink-0 place-items-center rounded-xl shadow-md ${dk ? "bg-gradient-to-br from-violet-400 to-indigo-400 text-slate-950" : "bg-gradient-to-br from-violet-500 to-indigo-500 text-white"}`}>
                  <Ic n="crown" className="h-5 w-5 md:h-6 md:w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <b className={`block text-sm md:text-base font-black ${dk ? "text-violet-300" : "text-violet-700"}`}>💼 موجودی حساب صرافی</b>
                  <span className={`block text-[10px] md:text-[11px] font-bold mt-0.5 ${dk ? "text-slate-400" : "text-slate-500"}`}>سرمایه صرافی (واریز/برداشت مالک + قرض)</span>
                </div>
              </div>
              <div className="relative grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 md:gap-3">
                {currencies.map(cur => {
                  const bal = exchangeBalance[cur];
                  const isNeg = bal < 0;
                  return (
                    <div key={cur} className={`group relative overflow-hidden rounded-xl p-2.5 md:p-3 text-center transition-all duration-300 ${dk ? "bg-slate-950/60 ring-1 ring-slate-700/50" : "bg-white/90 ring-1 ring-violet-100 shadow-sm"}`}>
                      <div className={`text-[11px] md:text-[12px] font-black mb-1 ${dk ? "text-slate-400" : "text-slate-500"}`}>{labels[cur]}</div>
                      <div className={`text-lg md:text-xl font-black tabular-nums leading-tight ${isNeg ? "text-rose-500" : dk ? "text-violet-300" : "text-violet-700"}`}>{fmt(bal)}</div>
                      <div className={`mt-1 text-[8px] md:text-[9px] font-black ${isNeg ? "text-rose-500" : dk ? "text-violet-400/70" : "text-violet-600/70"}`}>{isNeg ? "⚠️ منفی" : "✅ مثبت"}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
              <div className={`group relative overflow-hidden rounded-2xl border p-4 md:p-5 transition-all duration-300 hover:shadow-xl hover:scale-[1.01] ${dk ? "border-sky-400/25 bg-gradient-to-br from-sky-900/30 to-slate-900/50" : "border-sky-200 bg-gradient-to-br from-sky-50 to-white"}`}>
                <div className="relative flex items-center gap-3 mb-4">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${dk ? "bg-sky-400/15 text-sky-300" : "bg-sky-100 text-sky-600"}`}><Ic n="user" className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <b className={`block text-[13px] md:text-[14px] font-black leading-tight ${dk ? "text-sky-300" : "text-sky-700"}`}>👥 موجودی مشتریان</b>
                    <span className={`block text-[10px] md:text-[11px] font-bold mt-0.5 ${subText}`}>مجموع طلب مشتریان از صرافی</span>
                  </div>
                </div>
                <div className="relative space-y-1.5">
                  {currencies.map(cur => {
                    const bal = customerDeposits[cur];
                    return (
                      <div key={cur} className={`flex items-center justify-between rounded-xl px-3 py-2 transition-colors ${dk ? "bg-slate-900/50" : "bg-white/80"}`}>
                        <span className={`text-[12px] font-black ${dk ? "text-slate-400" : "text-slate-500"}`}>{labels[cur]}</span>
                        <span className={`text-[15px] md:text-base font-black tabular-nums ${bal > 0 ? (dk ? "text-sky-300" : "text-sky-700") : subText}`}>{fmt(bal)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={`group relative overflow-hidden rounded-2xl border p-4 md:p-5 transition-all duration-300 hover:shadow-xl hover:scale-[1.01] ${dk ? "border-rose-400/25 bg-gradient-to-br from-rose-900/30 to-slate-900/50" : "border-rose-200 bg-gradient-to-br from-rose-50 to-white"}`}>
                <div className="relative flex items-center gap-3 mb-4">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${dk ? "bg-rose-400/15 text-rose-300" : "bg-rose-100 text-rose-600"}`}><Ic n="alert" className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <b className={`block text-[13px] md:text-[14px] font-black leading-tight ${dk ? "text-rose-300" : "text-rose-700"}`}>📉 بدهی مشتریان</b>
                    <span className={`block text-[10px] md:text-[11px] font-bold mt-0.5 ${subText}`}>مجموع قرض‌های داده‌شده به مشتریان</span>
                  </div>
                </div>
                <div className="relative space-y-1.5">
                  {currencies.map(cur => {
                    const bal = customerDebts[cur];
                    return (
                      <div key={cur} className={`flex items-center justify-between rounded-xl px-3 py-2 transition-colors ${dk ? "bg-slate-900/50" : "bg-white/80"}`}>
                        <span className={`text-[12px] font-black ${dk ? "text-slate-400" : "text-slate-500"}`}>{labels[cur]}</span>
                        <span className={`text-[15px] md:text-base font-black tabular-nums ${bal > 0 ? "text-rose-500" : subText}`}>{fmt(bal)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={`group relative overflow-hidden rounded-2xl border p-4 md:p-5 transition-all duration-300 hover:shadow-xl hover:scale-[1.01] ${dk ? "border-amber-400/25 bg-gradient-to-br from-amber-900/30 to-slate-900/50" : "border-amber-200 bg-gradient-to-br from-amber-50 to-white"}`}>
                <div className="relative flex items-center gap-3 mb-4">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${dk ? "bg-amber-400/15 text-amber-300" : "bg-amber-100 text-amber-600"}`}><Ic n="gem" className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <b className={`block text-[13px] md:text-[14px] font-black leading-tight ${dk ? "text-amber-300" : "text-amber-700"}`}>💎 کارمزد قابل برداشت</b>
                    <span className={`block text-[10px] md:text-[11px] font-bold mt-0.5 ${subText}`}>درآمد خالص صرافی از معاملات</span>
                  </div>
                </div>
                <div className="relative space-y-1.5">
                  {currencies.map(cur => {
                    const bal = availableCommission[cur];
                    return (
                      <div key={cur} className={`flex items-center justify-between rounded-xl px-3 py-2 transition-colors ${dk ? "bg-slate-900/50" : "bg-white/80"}`}>
                        <span className={`text-[12px] font-black ${dk ? "text-slate-400" : "text-slate-500"}`}>{labels[cur]}</span>
                        <span className={`text-[15px] md:text-base font-black tabular-nums ${bal > 0 ? (dk ? "text-amber-300" : "text-amber-700") : subText}`}>{fmt(bal)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className={`cs-up flex gap-1.5 md:gap-2 rounded-xl md:rounded-2xl border p-1.5 md:p-2 shadow-sm backdrop-blur ${glassChip}`} style={{ animationDelay: "140ms" }}>
            {[{ id: "register" as const, label: "ثبت عملیات", icon: "plus" }, { id: "ledger" as const, label: "روزنامچه صندوق", icon: "history", count: entries.length }].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 md:gap-2 rounded-lg md:rounded-xl px-3 md:px-5 py-2.5 md:py-3 text-xs md:text-sm font-black transition-all duration-300 active:scale-[0.97] ${activeTab === tab.id ? `bg-gradient-to-l shadow-lg ${dk ? "from-emerald-400 to-teal-400 text-slate-950" : "from-emerald-500 via-teal-500 to-cyan-500 text-white"}` : dk ? "text-slate-400 hover:bg-slate-700/60 hover:text-slate-100" : "text-slate-500 hover:bg-emerald-50 hover:text-slate-800"}`}>
                {tab.icon === "plus" && <Ic n="plus" className="h-4 w-4" />}
                {tab.icon === "history" && <Ic n="history" className="h-4 w-4" />}
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${activeTab === tab.id ? dk ? "bg-slate-950/20 text-slate-950" : "bg-white/30 text-white" : dk ? "bg-slate-700 text-slate-300" : "bg-emerald-100 text-emerald-700"}`}>{tab.count}</span>}
              </button>
            ))}
          </div>

          {activeTab === "register" && (
            <section className={`cs-up space-y-4 md:space-y-5 p-4 md:p-7 ${uiCard}`} style={{ animationDelay: "160ms" }}>
              <div className="flex flex-wrap items-center gap-3"><span className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${identIcon}`}><Ic n="plus" className="h-5 w-5" /></span><div className="flex-1 min-w-0"><h2 className={`cs-display text-xl md:text-2xl leading-none ${heading}`}>ثبت عملیات صندوق</h2><p className={`mt-1 text-[11px] font-bold ${subText}`}>واریز و برداشت مشتری یا مالک</p></div></div>
              {editingEntryId && editingEntry && (
                <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-bold ${dk ? "border-amber-400/30 bg-amber-400/10 text-amber-300" : "border-amber-300 bg-amber-100/70 text-amber-800"}`}>
                  <span className="flex items-center gap-2"><Ic n="pencil" className="h-4 w-4 shrink-0" />ویرایش سند <b dir="ltr">{editingEntry.trackingCode}</b></span>
                  <button onClick={cancelEdit} className="cursor-pointer rounded-lg bg-amber-400/30 px-3.5 py-1.5 text-xs font-black transition hover:bg-amber-400/50">انصراف</button>
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {fld("نوع عملیات *", (<div className="relative"><select value={form.type} onChange={e => { setField("type", e.target.value); if (e.target.value !== "customer_deposit" && e.target.value !== "customer_withdraw") { setField("customerId", ""); setField("customerName", ""); } }} className={`${uiInput} cursor-pointer appearance-none pl-9 ${!form.type ? (dk ? "text-slate-500" : "text-slate-400") : ""} ${errors.type ? errInput : ""}`}>{entryTypeOptions.map(o => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select><span className={chevPos}><Ic n="chevron" className="h-4 w-4" /></span></div>))}
                {fld("نوع ارز *", (<div className="relative"><select value={form.currency} onChange={e => setField("currency", e.target.value)} className={`${uiInput} cursor-pointer appearance-none pl-9`}>{currencies.map(c => <option key={c} value={c}>{labels[c]}</option>)}</select><span className={chevPos}><Ic n="chevron" className="h-4 w-4" /></span></div>))}
                {fld("مبلغ *", (<input type="text" inputMode="decimal" dir="ltr" value={form.amount} onChange={e => setField("amount", toNumericText(e.target.value))} placeholder="0" className={`${uiInput} text-left tabular-nums ${errors.amount ? errInput : ""}`} />))}
                {fld("کد پیگیری", (<div className="relative"><input readOnly dir="ltr" value={editingEntryId ? editingEntry?.trackingCode : getNextTrackingCode()} className={`${uiInput} ${roInput} pl-14 text-left tabular-nums font-black`} /><span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-2 py-1 text-[9px] font-black text-white">TR</span></div>))}
              </div>

              {isCustomerType && (
                <div className={`rounded-xl border p-4 ${dk ? "border-teal-400/25 bg-teal-400/[0.07]" : "border-teal-200 bg-teal-50"}`}>
                  <div className="flex items-center gap-2 mb-3"><span className={`grid h-8 w-8 place-items-center rounded-lg ${dk ? "bg-teal-400/15 text-teal-300" : "bg-teal-100 text-teal-600"}`}><Ic n="user" className="h-4 w-4" /></span><b className={`text-xs font-black ${dk ? "text-teal-300" : "text-teal-700"}`}>مشتری {form.type === "customer_deposit" ? "واریزکننده" : "برداشت‌کننده"}</b></div>
                  {fld("انتخاب مشتری *", (
                    <div className="relative" ref={customerListRef}>
                      <input value={form.customerName} onChange={e => { const val = e.target.value; setField("customerName", val); setCustomerFilter(val); if (!showCustomerList) setShowCustomerList(true); const c = filteredCustomerList.find(x => x.name === val); if (c) setField("customerId", c.id); else setField("customerId", ""); }} placeholder="نام مشتری را بنویسید یا انتخاب کنید…" className={`${uiInput} pl-12 ${errors.customerName ? errInput : ""}`} autoComplete="off" />
                      <button type="button" onClick={(e) => { e.stopPropagation(); setShowCustomerList(!showCustomerList); }} className={`absolute left-2 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-lg transition ${dk ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}><Ic n="chevron" className={`h-4 w-4 transition-transform ${showCustomerList ? "rotate-180" : ""}`} /></button>
                      {showCustomerList && (
                        <div className={`absolute left-0 top-full z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border shadow-xl ${dk ? "border-slate-600 bg-slate-800" : "border-slate-200 bg-white"}`}>
                          {filteredCustomerList.length === 0 ? (<div className={`px-4 py-3 text-xs text-center ${subText}`}>مشتری‌ای یافت نشد</div>) : (
                            filteredCustomerList.map((c) => {
                              const liveBal = getLedgerBalance(c.id, form.currency, entries, transactions);
                              return (
                                <button key={c.id} type="button" onClick={() => { setField("customerId", c.id); setField("customerName", c.name); setCustomerFilter(""); setShowCustomerList(false); }} className={`flex w-full items-center gap-2 px-3 py-2.5 text-right text-xs font-bold transition ${dk ? "text-slate-200 hover:bg-teal-400/15 hover:text-teal-300" : "text-slate-700 hover:bg-teal-50 hover:text-teal-600"}`}>
                                  <span className="flex-1 truncate flex items-center gap-1.5">
                                    {c.name}
                                    {c.id === EXCHANGE_ACCOUNT_ID && " 💼"}
                                    {hasTelegram(c) && c.id !== EXCHANGE_ACCOUNT_ID && <span title="دارای چت آیدی تلگرام">📱</span>}
                                  </span>
                                  <span className={`text-[10px] tabular-nums font-bold ${currencyColors[form.currency][dk ? "dark" : "light"]}`}>{fmt(liveBal)} {labels[form.currency]}</span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {selectedCustomer && selectedCustomer.id !== CASH_BOX_ID && (
                    <div className={`mt-4 rounded-xl border p-4 ${dk ? "border-slate-600 bg-slate-800/60" : "border-slate-200 bg-white"}`}>
                      <div className={`flex items-center gap-2 mb-3 pb-3 border-b border-dashed ${dk ? 'border-slate-700' : 'border-slate-200'}`}>
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${dk ? "bg-teal-400/15 text-teal-300" : "bg-teal-100 text-teal-600"}`}><Ic n="wallet" className="h-4 w-4" /></span>
                        <div className="flex-1 min-w-0"><b className={`block text-sm font-black ${dk ? "text-teal-300" : "text-teal-700"}`}>💼 موجودی کامل {selectedCustomer.name}</b><span className={`text-[10px] font-bold ${subText}`}>تمام ارزهای نزد صرافی (محاسبه‌شده از دفتر کل)</span></div>
                        {selectedCustomer.phone && <span className={`text-[10px] font-bold tabular-nums ${subText}`} dir="ltr">📞 {selectedCustomer.phone}</span>}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                        {currencies.map(cur => {
                          const bal = getLedgerBalance(selectedCustomer.id, cur, entries, transactions);
                          const isDebt = bal < 0; const isCredit = bal > 0; const isSel = form.currency === cur;
                          return (
                            <div key={cur} className={`relative rounded-xl px-3 py-2.5 text-center transition-all ${isSel ? dk ? "bg-teal-400/15 ring-2 ring-teal-400/40" : "bg-teal-50 ring-2 ring-teal-400/40" : dk ? "bg-slate-900/40" : "bg-slate-50"}`}>
                              {isSel && <span className={`absolute -top-1.5 -left-1.5 grid h-5 w-5 place-items-center rounded-full text-[9px] ${dk ? "bg-teal-400 text-slate-950" : "bg-teal-500 text-white"}`}>✓</span>}
                              <div className={`text-[10px] font-bold mb-1 ${subText}`}>{labels[cur]}</div>
                              <div className={`text-sm font-black tabular-nums ${isDebt ? "text-rose-500" : isCredit ? currencyColors[cur][dk ? "dark" : "light"] : subText}`}>{fmt(bal)}</div>
                              <div className="min-h-[14px] mt-1">
                                {isDebt && <span className="text-[8px] font-black text-rose-500">🔴 قرض</span>}
                                {isCredit && <span className={`text-[8px] font-black ${dk ? "text-emerald-300" : "text-emerald-600"}`}>🟢 طلب</span>}
                                {bal === 0 && <span className={`text-[8px] font-bold ${subText}`}>⚪ صفر</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isCommissionType && (
                <div className={`rounded-xl border p-4 ${dk ? "border-purple-400/25 bg-purple-400/[0.07]" : "border-purple-200 bg-purple-50"}`}>
                  <div className="flex items-center gap-2 mb-3"><span className={`grid h-8 w-8 place-items-center rounded-lg ${dk ? "bg-purple-400/15 text-purple-300" : "bg-purple-100 text-purple-600"}`}><Ic n="gem" className="h-4 w-4" /></span><b className={`text-xs font-black ${dk ? "text-purple-300" : "text-purple-700"}`}>💎 برداشت کارمزد صرافی</b></div>
                  <p className={`text-[11px] font-bold mb-3 ${subText}`}>با این عملیات، کارمزد جمع‌آوری‌شده از صندوق خارج شده و به مالک پرداخت می‌شود.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    {currencies.map(cur => {
                      const avail = availableCommission[cur] || 0; const isSel = form.currency === cur;
                      return (
                        <div key={cur} className={`rounded-xl px-3 py-2.5 text-center ${isSel ? dk ? "bg-purple-400/15 ring-2 ring-purple-400/40" : "bg-purple-100 ring-2 ring-purple-400/40" : dk ? "bg-slate-900/40" : "bg-white/70"}`}>
                          <div className={`text-[10px] font-bold mb-1 ${subText}`}>{labels[cur]}</div>
                          <div className={`text-sm font-black tabular-nums ${avail > 0 ? (dk ? "text-purple-300" : "text-purple-700") : subText}`}>{fmt(avail)}</div>
                          <div className="min-h-[14px] mt-1"><span className={`text-[8px] font-bold ${avail > 0 ? (dk ? "text-emerald-300" : "text-emerald-600") : subText}`}>{avail > 0 ? "✅ قابل برداشت" : "⚪ موجود نیست"}</span></div>
                        </div>
                      );
                    })}
                  </div>
                  <div className={`mt-3 flex items-center justify-between rounded-lg px-3 py-2 ${dk ? "bg-slate-900/50" : "bg-white"}`}>
                    <span className={`text-xs font-bold ${subText}`}>🎯 قابل برداشت ({labels[form.currency]}):</span>
                    <b className={`text-sm font-black tabular-nums ${(availableCommission[form.currency] || 0) > 0 ? (dk ? "text-purple-300" : "text-purple-700") : "text-rose-500"}`}>{fmt(availableCommission[form.currency] || 0)} {labels[form.currency]}</b>
                  </div>
                </div>
              )}

              {fld("دلیل / شرح عملیات *", (<textarea rows={3} value={form.reason} onChange={e => setField("reason", e.target.value)} placeholder={form.type === "customer_deposit" ? "مثلاً: واریز نقدی مشتری به حساب…" : form.type === "customer_withdraw" ? "مثلاً: برداشت نقدی مشتری از حساب…" : form.type === "owner_deposit" ? "مثلاً: واریز سرمایه مالک به صرافی…" : form.type === "owner_withdraw" ? "مثلاً: برداشت مالک برای مصارف شخصی…" : form.type === "commission_withdraw" ? "مثلاً: برداشت کارمزد هفتگی…" : "مثلاً: اصلاح موجودی…"} className={`${uiInput} h-auto py-3 resize-none ${errors.reason ? errInput : ""}`} />))}

              {hasType && (
                <div className={`flex items-center gap-3 rounded-xl border p-4 ${isInType ? dk ? "border-emerald-400/25 bg-emerald-400/[0.07]" : "border-emerald-200 bg-emerald-50" : dk ? "border-rose-400/25 bg-rose-400/[0.07]" : "border-rose-200 bg-rose-50"}`}>
                  <span className={`grid h-10 w-10 place-items-center rounded-xl ${isInType ? dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-600" : dk ? "bg-rose-400/15 text-rose-300" : "bg-rose-100 text-rose-600"}`}><Ic n={isInType ? "arrowDown" : "arrowUp"} className="h-5 w-5" /></span>
                  <div>
                    <b className={`text-sm font-black ${isInType ? dk ? "text-emerald-300" : "text-emerald-700" : dk ? "text-rose-300" : "text-rose-700"}`}>{isInType ? "افزایش موجودی صندوق" : "کاهش موجودی صندوق"}</b>
                    <p className={`text-[11px] ${subText}`}>{isInType ? "مبلغ به موجودی" : "مبلغ از موجودی"} {labels[form.currency]} {isInType ? "اضافه" : "کم"} می‌شود.{isCustomerType && form.customerId && form.customerId !== CASH_BOX_ID && form.customerId !== EXCHANGE_ACCOUNT_ID && (form.type === "customer_deposit" ? " موجودی حساب مشتری هم افزایش می‌یابد." : " موجودی حساب مشتری هم کاهش می‌یابد.")}{isCommissionType && " این مبلغ از کارمزد قابل برداشت کسر می‌شود."}</p>
                  </div>
                </div>
              )}

              {errorList.length > 0 && (<div className={`space-y-2 rounded-xl border p-4 ${dk ? "border-rose-500/50 bg-rose-500/10 text-rose-300" : "border-rose-500 bg-rose-50 text-rose-600"}`}><b className="flex items-center gap-2 text-sm"><Ic n="alert" className="h-5 w-5 shrink-0" />لطفاً فیلدهای اجباری را تکمیل کنید:</b><ul className="list-disc pr-5 text-sm space-y-1">{errorList.map((msg, i) => (<li key={i}>{msg}</li>))}</ul></div>)}
              <button onClick={handleSubmitClick} className={`group flex h-[50px] md:h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-l text-base font-black shadow-lg transition-all duration-300 hover:shadow-xl hover:brightness-110 active:scale-[0.985] ${dk ? "from-emerald-400 to-teal-400 text-slate-950" : "from-emerald-500 via-teal-500 to-cyan-500 text-white"}`}>{editingEntryId ? "به‌روزرسانی" : "ثبت عملیات"}<Ic n="check" className="h-5 w-5" /></button>
            </section>
          )}

          {activeTab === "ledger" && (
            <section className={`cs-up overflow-hidden ${uiCard}`} style={{ animationDelay: "180ms" }}>
              <div className="flex flex-wrap items-center gap-3 p-4 md:p-5 pb-3 md:pb-4 md:px-7 md:pt-6">
                <span className={`grid h-10 w-10 md:h-11 md:w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${identIcon}`}><Ic n="history" className="h-5 w-5" /></span>
                <div className="flex-1 min-w-0"><h2 className={`cs-display text-xl md:text-2xl leading-none ${heading}`}>روزنامچه صندوق</h2><p className={`mt-1 text-[11px] font-bold ${subText}`}>تمام دریافتی‌ها و پرداختی‌ها با جزئیات کامل</p></div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1.5 text-[10px] font-black ${dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-700"}`}>فعال {activeCount}</span>
                  <span className={`rounded-full px-3 py-1.5 text-[10px] font-black ${dk ? "bg-rose-400/15 text-rose-300" : "bg-rose-100 text-rose-600"}`}>باطل {voidedCount}</span>
                </div>
              </div>
              <div className="px-4 md:px-7 pb-4 space-y-4">
                <div className="flex flex-wrap gap-3">
                  <div className="relative flex-1 min-w-[250px]"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو: نام مشتری، کد پیگیری، شرح…" className={`${uiInput} pr-10`} /><span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${dk ? "text-slate-500" : "text-slate-400"}`}><Ic n="search" className="h-4 w-4" /></span></div>
                  <select value={filterType} onChange={e => setFilterType(e.target.value as any)} className={`${uiInput} w-auto min-w-[170px] cursor-pointer appearance-none pl-9`}>
                    <option value="all">همه انواع</option><option value="customer_deposit">واریز مشتری</option><option value="customer_withdraw">برداشت مشتری</option>
                    <option value="owner_deposit">واریز مالک</option><option value="owner_withdraw">برداشت مالک</option><option value="adjustment">اصلاح صندوق</option>
                    <option value="fee">کارمزد</option><option value="commission_withdraw">برداشت کارمزد</option>
                  </select>
                  <select value={filterCurrency} onChange={e => setFilterCurrency(e.target.value as any)} className={`${uiInput} w-auto min-w-[130px] cursor-pointer appearance-none pl-9`}><option value="all">همه ارزها</option>{currencies.map(c => <option key={c} value={c}>{labels[c]}</option>)}</select>
                  {(search || filterType !== "all" || filterCurrency !== "all") && (<button onClick={() => { setSearch(""); setFilterType("all"); setFilterCurrency("all"); }} className={`flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-black transition-all active:scale-95 cursor-pointer ${dk ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}><Ic n="x" className="h-3.5 w-3.5" />پاک کردن</button>)}
                </div>
                {filteredEntries.length === 0 ? (
                  <div className={`flex flex-col items-center gap-3 px-6 py-16 ${dk ? "text-slate-500" : "text-slate-400"}`}><span className={`grid h-16 w-16 place-items-center rounded-2xl border border-dashed ${dk ? "border-slate-600 bg-slate-800/40" : "border-slate-300 bg-slate-50"}`}><Ic n="inbox" className="h-7 w-7 opacity-70" /></span><p className="text-sm font-black text-center">{entries.length === 0 ? "هنوز عملیاتی در صندوق ثبت نشده است." : "هیچ عملیاتی با این فیلتر یافت نشد."}</p></div>
                ) : (
                  <div className="overflow-x-auto cs-scroll">
                    <table className="w-full min-w-[1200px] text-sm">
                      <thead><tr className={`border-y ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>{["شماره", "کد پیگیری", "تاریخ", "نوع عملیات", "مشتری", "شرح", "ارز", "دریافت", "پرداخت", "مانده", "عملیات"].map(h => (<th key={h} className="px-3 py-3 text-center text-[10px] font-black text-slate-400 whitespace-nowrap">{h}</th>))}</tr></thead>
                      <tbody className={`divide-y ${dk ? "divide-slate-700/60" : "divide-slate-100"}`}>
                        {filteredEntries.map((e, idx) => {
                          const isIn = e.direction === "in"; const isOwner = e.type === "owner_deposit" || e.type === "owner_withdraw";
                          const isAdjust = e.type === "adjustment"; const isFee = e.type === "fee"; const isCommW = e.type === "commission_withdraw";
                          const isVoided = e.status === "voided"; const isDeleted = e.customerDeleted === true; const isOpen = openActionId === e.id;
                          let rowClass = `transition-colors ${dk ? "hover:bg-slate-700/30" : "hover:bg-emerald-50/70"}`;
                          if (isVoided) rowClass += dk ? " bg-rose-400/[0.05]" : " bg-rose-50";
                          const voidStrike = isVoided ? "line-through opacity-50" : "";
                          return (
                            <tr key={e.id} className={rowClass}>
                              <td className="px-3 py-3 text-center"><span className={`inline-grid h-7 w-7 place-items-center rounded-lg text-[10px] font-black tabular-nums ${dk ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"}`}>{idx + 1}</span></td>
                              <td className="px-3 py-3 text-center">
                                <div className="flex flex-col items-center gap-1">
                                  <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-black tabular-nums ${dk ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300" : "border-sky-300 bg-sky-50 text-sky-700"} ${voidStrike}`} dir="ltr"><Ic n="tag" className="h-2.5 w-2.5" />{e.trackingCode}</span>
                                  {isVoided && <span className={`inline-flex rounded-full px-2 py-0.5 text-[8px] font-black ${dk ? "bg-rose-400/15 text-rose-300" : "bg-rose-100 text-rose-600"}`}>باطل شده</span>}
                                  {isDeleted && <span className={`inline-flex rounded-full px-2 py-0.5 text-[8px] font-black ${dk ? "bg-slate-500/15 text-slate-400" : "bg-slate-100 text-slate-500"}`}>مشتری حذف‌شده</span>}
                                </div>
                              </td>
                              <td className={`whitespace-nowrap px-3 py-3 text-center text-[11px] tabular-nums ${dk ? "text-slate-400" : "text-slate-500"} ${voidStrike}`}><div dir="ltr">{shortDateLabel(e.date)}</div><div dir="ltr" className={`text-[9px] ${subText}`}>{timeLabel(e.date)}</div></td>
                              <td className="px-3 py-3 text-center"><span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-black whitespace-nowrap ${entryTypeColors[e.type][dk ? "dark" : "light"]} ${voidStrike}`}>{entryTypeLabels[e.type]}</span></td>
                              <td className={`px-3 py-3 text-center text-[12px] font-bold whitespace-nowrap ${dk ? "text-slate-200" : "text-slate-700"} ${voidStrike}`}>{isOwner ? <span className={dk ? "text-amber-300" : "text-amber-700"}>👤 مالک</span> : isAdjust ? <span className={subText}>سیستم</span> : isFee ? <span className={subText}>سیستم</span> : isCommW ? <span className={dk ? "text-purple-300" : "text-purple-700"}>💎 کارمزد</span> : (e.customerName || "—")}</td>
                              <td className={`px-3 py-3 text-center text-[11px] max-w-[180px] truncate ${dk ? "text-slate-300" : "text-slate-600"} ${voidStrike}`}>{e.reason || "—"}</td>
                              <td className={`px-3 py-3 text-center text-[11px] font-black whitespace-nowrap ${currencyColors[e.currency][dk ? "dark" : "light"]} ${voidStrike}`}>{labels[e.currency]}</td>
                              <td className={`px-3 py-3 text-center text-[12px] font-black tabular-nums whitespace-nowrap ${isIn ? "text-emerald-500" : ""} ${voidStrike}`}>{isIn ? fmt(e.amount) : ""}</td>
                              <td className={`px-3 py-3 text-center text-[12px] font-black tabular-nums whitespace-nowrap ${!isIn ? "text-rose-500" : ""} ${voidStrike}`}>{!isIn ? fmt(e.amount) : ""}</td>
                              <td className={`px-3 py-3 text-center text-[12px] font-black tabular-nums whitespace-nowrap ${currencyColors[e.currency][dk ? "dark" : "light"]} ${voidStrike}`}>{fmt(e.balanceAfter)}</td>
                              <td className="px-3 py-3 text-center">
                                <div className="relative action-dropdown flex justify-center">
                                  <button onClick={(ev) => { ev.stopPropagation(); setOpenActionId(isOpen ? null : e.id); }} className={`grid h-8 w-8 place-items-center rounded-lg border transition-all duration-150 active:scale-90 cursor-pointer ${dk ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-200 text-slate-500 hover:bg-slate-100"}`} title="عملیات"><Ic n="more" className="h-4 w-4" /></button>
                                  {isOpen && (
                                    <div className={`absolute left-1/2 -translate-x-1/2 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-xl border shadow-xl ${dk ? "border-slate-600 bg-slate-800" : "border-slate-200 bg-white"}`}>
                                      <button onClick={() => { setSelectedEntry(e); setOpenActionId(null); }} className={`flex w-full items-center gap-2 px-3 py-2 text-right text-xs font-bold transition ${dk ? "text-cyan-300 hover:bg-cyan-400/15" : "text-cyan-600 hover:bg-cyan-50"}`}><Ic n="eye" className="h-3.5 w-3.5" /> مشاهده</button>
                                      {!isVoided && (<><button onClick={() => { editEntry(e); setOpenActionId(null); }} className={`flex w-full items-center gap-2 px-3 py-2 text-right text-xs font-bold transition ${dk ? "text-sky-300 hover:bg-sky-400/15" : "text-sky-600 hover:bg-sky-50"}`}><Ic n="pencil" className="h-3.5 w-3.5" /> ویرایش</button><button onClick={() => { voidEntry(e); setOpenActionId(null); }} className={`flex w-full items-center gap-2 px-3 py-2 text-right text-xs font-bold transition ${dk ? "text-amber-300 hover:bg-amber-400/15" : "text-amber-600 hover:bg-amber-50"}`}><Ic n="xCircle" className="h-3.5 w-3.5" /> ابطال</button></>)}
                                      <div className={`my-1 h-px ${dk ? "bg-slate-700" : "bg-slate-100"}`} />
                                      <button onClick={() => { deleteEntry(e); setOpenActionId(null); }} className={`flex w-full items-center gap-2 px-3 py-2 text-right text-xs font-bold transition ${dk ? "text-rose-300 hover:bg-rose-400/15" : "text-rose-500 hover:bg-rose-50"}`}><Ic n="trash" className="h-3.5 w-3.5" /> حذف</button>
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

      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3" onClick={() => setSelectedEntry(null)}>
          <div className={`w-full max-w-lg rounded-xl border shadow-2xl ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-white"}`} onClick={ev => ev.stopPropagation()}>
            <div className={`flex items-center justify-between border-b px-4 py-3 ${dk ? "border-slate-700" : "border-slate-100"}`}>
              <b className={`text-sm ${dk ? "text-slate-100" : "text-slate-800"}`}>جزئیات سند صندوق</b>
              <button onClick={() => setSelectedEntry(null)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 cursor-pointer"><Ic n="x" className="h-4 w-4" /></button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-4 py-2">
              {[["کد پیگیری", selectedEntry.trackingCode], ["تاریخ", `${shortDateLabel(selectedEntry.date)} - ${timeLabel(selectedEntry.date)}`], ["نوع عملیات", entryTypeLabels[selectedEntry.type]], ["مشتری", selectedEntry.customerName || (selectedEntry.type.includes("owner") ? "مالک" : selectedEntry.type === "commission_withdraw" ? "💎 برداشت کارمزد" : "سیستم")], ["ارز", labels[selectedEntry.currency]], ["مبلغ", fmt(selectedEntry.amount)], ["جهت", selectedEntry.direction === "in" ? "دریافت ➕" : "پرداخت ➖"], ["شرح", selectedEntry.reason || "-"], ["مانده بعد", fmt(selectedEntry.balanceAfter)], ["وضعیت", selectedEntry.status === "voided" ? "❌ باطل شده" : "✅ فعال"]].map(([l, v], i) => (
                <div key={i} className={`flex items-start justify-between gap-4 border-b border-dashed py-3 last:border-0 ${dk ? "border-slate-700" : "border-slate-200"}`}>
                  <span className={`shrink-0 text-[11px] font-black ${dk ? "text-slate-500" : "text-slate-400"}`}>{l}</span>
                  <span className={`text-left text-[13px] font-bold ${dk ? "text-slate-200" : "text-slate-700"} ${l === "وضعیت" && selectedEntry.status === "voided" ? "text-rose-500" : ""}`}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {previewOpen && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 md:p-4 backdrop-blur-sm" onClick={() => { setPreviewOpen(false); setPreviewData(null); }}>
          <div className={`cs-up w-full max-w-lg overflow-hidden rounded-xl md:rounded-2xl border shadow-2xl ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-white"}`} onClick={(e) => e.stopPropagation()}>
            <div className={`flex items-center justify-between border-b px-4 md:px-5 py-3 md:py-4 ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
              <b className={`flex items-center gap-2 text-sm ${dk ? "text-slate-100" : "text-slate-800"}`}><span className={`grid h-8 w-8 place-items-center rounded-lg ${dk ? "bg-emerald-400/10 text-emerald-300" : "bg-emerald-100 text-emerald-600"}`}><Ic n="doc" className="h-4 w-4" /></span>{editingEntryId ? "تأیید ویرایش سند" : isCommissionType ? "تأیید برداشت کارمزد" : "تأیید عملیات صندوق"}</b>
              <button onClick={() => { setPreviewOpen(false); setPreviewData(null); }} className={`grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-slate-400 transition-all duration-300 hover:rotate-90 ${dk ? "hover:bg-slate-700 hover:text-white" : "hover:bg-slate-100 hover:text-slate-700"}`}><Ic n="x" className="h-4 w-4" /></button>
            </div>
            <div className="px-4 md:px-5 py-4 space-y-4">
              <div className={`flex items-center justify-between rounded-xl border p-3 ${dk ? "border-cyan-400/30 bg-cyan-400/10" : "border-sky-300 bg-sky-50"}`}>
                <b className={`text-xs font-black ${dk ? "text-cyan-300" : "text-sky-700"}`}>کد پیگیری</b>
                <span className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-black tabular-nums ${dk ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300" : "border-sky-300 bg-sky-50 text-sky-700"}`} dir="ltr"><Ic n="tag" className="h-3.5 w-3.5" />{previewData.trackingCode}</span>
              </div>
              <div className={`rounded-xl border p-4 ${dk ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"}`}>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className={subText}>نوع: </span><b>{entryTypeLabels[previewData.type]}</b></div>
                  <div><span className={subText}>ارز: </span><b>{labels[previewData.currency]}</b></div>
                  <div><span className={subText}>مبلغ: </span><b className={`tabular-nums ${previewData.direction === "in" ? dk ? "text-emerald-300" : "text-emerald-700" : "text-rose-500"}`}>{fmt(previewData.amount)}</b></div>
                  <div><span className={subText}>جهت: </span><b>{previewData.direction === "in" ? "دریافت ➕" : "پرداخت ➖"}</b></div>
                  {previewData.customerName && (<div className="col-span-2"><span className={subText}>مشتری: </span><b>{previewData.customerName}</b></div>)}
                  <div className="col-span-2"><span className={subText}>شرح: </span><b>{previewData.reason}</b></div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <button onClick={confirmRegister} className={`flex h-[48px] flex-1 min-w-[180px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-l text-sm font-black shadow-lg transition-all hover:brightness-110 active:scale-[0.98] ${dk ? "from-emerald-400 to-teal-400 text-slate-950" : "from-emerald-500 to-teal-500 text-white"}`}>{editingEntryId ? "ذخیره تغییرات" : "ثبت نهایی"}<Ic n="check" className="h-4 w-4" /></button>
                <button onClick={() => { setPreviewOpen(false); setPreviewData(null); }} className={`flex h-[48px] px-6 cursor-pointer items-center justify-center rounded-xl border text-sm font-bold transition-all active:scale-95 ${dk ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>انصراف</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (<div className={`fixed bottom-6 left-6 z-[99] rounded-xl px-4 py-3 text-sm font-bold shadow-lg ${dk ? "bg-slate-800 text-slate-100 border border-slate-600" : "bg-slate-900 text-white"}`}>{toast}</div>)}
    </div>
  );
}
