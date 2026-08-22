"use client";
import { useEffect, useState, useMemo, useRef, useCallback, memo, type ReactNode } from "react";
import { getNextTrackingCode, consumeTrackingCode, initTrackingSystem } from "../lib/trackingCode";
import { CUSTOMERS_KEY, TRANSACTIONS_KEY, CASH_KEY, HAWALAS_KEY, loadCustomersShared, loadTransactionsShared, loadCashEntriesShared, loadHawalasShared } from "../lib/defaultData";

type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";
type RateMode = "same" | "afn" | "direct";
type DealType = "buy" | "sell";
type CommissionPayer = "sender" | "receiver";
type Customer = { id: string; name: string; phone?: string; telegram?: string; telegramChatId?: string; balances: Record<Currency, number>; };
type Transaction = {
  id: string; trackingCode: string; type: "exchange" | "transfer" | "convert"; dealType?: DealType; date: string;
  customerId?: string; customerName?: string; senderId?: string; senderName?: string; receiverId?: string; receiverName?: string;
  fromCurrency: Currency; fromAmount: number; toCurrency: Currency; toAmount: number; rate: number; rateLabel: string; rateBase?: Currency;
  commission?: number; commissionCurrency?: Currency; commissionPayer?: CommissionPayer; description?: string; status: "active" | "voided";
  profit?: number; profitCurrency?: Currency; customerPhone?: string; customerTelegram?: string;
};
type ExchangeFormErrors = { dealType?: string; customer?: string; receivedAmount?: string; rate?: string; paidAmount?: string; exchangeCommission?: string };
type TransferFormErrors = { sender?: string; receiver?: string; senderAmount?: string; transferRate?: string; receiverAmount?: string; commission?: string };
type ConvertFormErrors = { customer?: string; amount?: string; rate?: string; convertedAmount?: string; commission?: string };
type BalanceChange = { customerId?: string; customerName: string; currency: Currency; amount: number; };

const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const labels: Record<Currency, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };
const rateUnits: Record<Currency, number> = { AFN: 1, USD: 1, EUR: 1, IRR: 1000, PKR: 1000 };
const CASH_BOX_ID = "CASH_BOX";
const CASH_BOX_NAME = "صندوق";
const EXCHANGE_ACCOUNT_ID = "EXCHANGE_ACCOUNT";
const EXCHANGE_ACCOUNT_NAME = "حساب صرافی";
const EXCHANGE_ACCOUNT_CUSTOMER: Customer = { id: EXCHANGE_ACCOUNT_ID, name: EXCHANGE_ACCOUNT_NAME, phone: "", telegram: "", telegramChatId: "", balances: { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 } };
const CASH_BOX_CUSTOMER: Customer = { id: CASH_BOX_ID, name: CASH_BOX_NAME, phone: "", telegram: "", telegramChatId: "", balances: { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 } };

const hasTelegram = (c: Customer): boolean => Boolean(c.telegramChatId || c.telegram);
const normalizeDigits = (s: string) => s.replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

function toNumericText(v: string) {
  let s = normalizeDigits(String(v || "")).replace(/[^0-9.]/g, "");
  const fd = s.indexOf(".");
  if (fd !== -1) s = s.slice(0, fd + 1) + s.slice(fd + 1).replace(/\./g, "");
  return s;
}

const parseAmount = (v: string) => {
  const n = Number(normalizeDigits(String(v || "")).replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const fmt = (n: number) => Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 0 }) : "0";

const newId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try { return crypto.randomUUID(); } catch {}
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
};

const shortId = (id: string) => id.slice(-6);

function shamsiParts(d: Date) {
  try {
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
    const g = (t: string) => parts.find(p => p.type === t)?.value || "0";
    return { year: g("year"), month: g("month"), day: g("day") };
  } catch { return { year: "0", month: "0", day: "0" }; }
}

function formatDateTime(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const s = shamsiParts(d);
  return `${s.year}/${s.month}/${s.day} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function dateLabel(s: string) {
  try {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? "-" : formatDateTime(d);
  } catch { return "-"; }
}

function splitDateTime(s: string): { datePart: string; timePart: string } {
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return { datePart: "-", timePart: "" };
    const full = formatDateTime(d);
    const parts = full.split(" ");
    return { datePart: parts[0] || "-", timePart: parts[1] || "" };
  } catch { return { datePart: "-", timePart: "" }; }
}

function dealTypeLabel(d?: DealType) { return d === "buy" ? "خرید" : d === "sell" ? "فروش" : "-"; }

function getRateMode(f: Currency, t: Currency): RateMode {
  if (f === t) return "same";
  if (f === "AFN" || t === "AFN") return "afn";
  return "direct";
}

function getAfnForeign(f: Currency, t: Currency): Currency | null {
  if (f === t) return null;
  if (f === "AFN") return t;
  if (t === "AFN") return f;
  return null;
}

function preferredDirectBase(a: Currency, b: Currency): Currency {
  for (const c of ["USD", "EUR", "PKR", "IRR"] as Currency[]) {
    if (a === c) return c;
    if (b === c) return c;
  }
  return a;
}

function getSafeDirectBase(bs: Currency, a: Currency, b: Currency): Currency {
  if (a === bs || b === bs) return bs;
  return preferredDirectBase(a, b);
}

function getDirectCounter(base: Currency, a: Currency, b: Currency): Currency | null {
  if (a === base) return b;
  if (b === base) return a;
  return null;
}

function convertAfnRate(amount: number, from: Currency, to: Currency, rate: number) {
  if (!Number.isFinite(amount) || amount === 0 || from === to || !Number.isFinite(rate) || rate <= 0) return 0;
  const f = getAfnForeign(from, to);
  if (!f) return 0;
  const u = rateUnits[f] || 1;
  if (from === "AFN" && to === f) return (amount / rate) * u;
  if (from === f && to === "AFN") return (amount / u) * rate;
  return 0;
}

function convertDirectRate(amount: number, from: Currency, to: Currency, base: Currency, rate: number) {
  if (!Number.isFinite(amount) || amount === 0 || from === to || !Number.isFinite(rate) || rate <= 0) return 0;
  const c = getDirectCounter(base, from, to);
  if (!c) return 0;
  const ub = rateUnits[base] || 1;
  if (from === base) return (amount / ub) * rate;
  if (to === base) return (amount / rate) * ub;
  return 0;
}

const afnRateLabel = (foreign: Currency, rate: number) => `${fmt(rateUnits[foreign])} ${labels[foreign]} = ${fmt(rate)} ${labels.AFN}`;
const directRateLabel = (base: Currency, counter: Currency, rate: number) => `${fmt(rateUnits[base])} ${labels[base]} = ${fmt(rate)} ${labels[counter]}`;

// ✅ توابع جدید برای ارسال رسید تلگرام
function getTelegramSettings() {
  try {
    const r = localStorage.getItem("fx-settings");
    if (!r) return { enabled: false, botToken: "", chatId: "" };
    const s = JSON.parse(r);
    return {
      enabled: s.telegram?.enabled || false,
      botToken: s.telegram?.botToken || "",
      chatId: s.telegram?.chatId || ""
    };
  } catch {
    return { enabled: false, botToken: "", chatId: "" };
  }
}

async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<boolean> {
  if (!botToken || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: text }),
    });
    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

function getExchangeAccountBalances(entries: any[]): Record<Currency, number> {
  const balances: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
  if (!Array.isArray(entries)) return balances;
  for (const entry of entries) {
    if (!entry || entry.status === "voided") continue;
    const cur = entry.currency as Currency;
    if (!currencies.includes(cur)) continue;
    if (entry.type === "owner_deposit") balances[cur] += Number(entry.amount || 0);
    else if (entry.type === "owner_withdraw") balances[cur] -= Number(entry.amount || 0);
    else if (entry.type === "exchange_account_in") balances[cur] += Number(entry.amount || 0);
    else if (entry.type === "exchange_account_out") balances[cur] -= Number(entry.amount || 0);
    else if (entry.type === "loan_given") balances[cur] -= Number(entry.amount || 0);
    else if (entry.type === "loan_received") balances[cur] += Number(entry.amount || 0);
  }
  return balances;
}

function applyBalanceChanges(customers: Customer[], changes: BalanceChange[]): Customer[] {
  return customers.map(c => {
    if (c.id === CASH_BOX_ID || c.id === EXCHANGE_ACCOUNT_ID) return c;
    const cc = changes.filter(ch => ch.customerId === c.id);
    if (cc.length === 0) return c;
    const nb = { ...c.balances };
    for (const ch of cc) {
      if (nb[ch.currency] === undefined) nb[ch.currency] = 0;
      nb[ch.currency] = (nb[ch.currency] || 0) + ch.amount;
    }
    return { ...c, balances: nb };
  });
}

function getBalanceChangesForTransaction(tx: Transaction, action: "register" | "reverse"): BalanceChange[] {
  const changes: BalanceChange[] = [];
  const sign = action === "register" ? 1 : -1;
  if (tx.type === "exchange" && tx.customerId && tx.customerId !== CASH_BOX_ID && tx.customerId !== EXCHANGE_ACCOUNT_ID) {
    changes.push({ customerId: tx.customerId, customerName: tx.customerName || "", currency: tx.fromCurrency, amount: -tx.fromAmount * sign });
    changes.push({ customerId: tx.customerId, customerName: tx.customerName || "", currency: tx.toCurrency, amount: tx.toAmount * sign });
    if (tx.commission && tx.commission > 0 && tx.commissionCurrency) changes.push({ customerId: tx.customerId, customerName: tx.customerName || "", currency: tx.commissionCurrency, amount: -tx.commission * sign });
  }
  if (tx.type === "transfer") {
    if (tx.senderId && tx.senderId !== CASH_BOX_ID && tx.senderId !== EXCHANGE_ACCOUNT_ID) {
      changes.push({ customerId: tx.senderId, customerName: tx.senderName || "", currency: tx.fromCurrency, amount: -tx.fromAmount * sign });
      if (tx.commissionPayer === "sender" && tx.commission && tx.commission > 0 && tx.commissionCurrency) changes.push({ customerId: tx.senderId, customerName: tx.senderName || "", currency: tx.commissionCurrency, amount: -tx.commission * sign });
    }
    if (tx.receiverId && tx.receiverId !== CASH_BOX_ID && tx.receiverId !== EXCHANGE_ACCOUNT_ID) {
      changes.push({ customerId: tx.receiverId, customerName: tx.receiverName || "", currency: tx.toCurrency, amount: tx.toAmount * sign });
      if (tx.commissionPayer === "receiver" && tx.commission && tx.commission > 0 && tx.commissionCurrency) changes.push({ customerId: tx.receiverId, customerName: tx.receiverName || "", currency: tx.commissionCurrency, amount: -tx.commission * sign });
    }
  }
  if (tx.type === "convert" && tx.customerId && tx.customerId !== CASH_BOX_ID && tx.customerId !== EXCHANGE_ACCOUNT_ID) {
    changes.push({ customerId: tx.customerId, customerName: tx.customerName || "", currency: tx.fromCurrency, amount: -tx.fromAmount * sign });
    changes.push({ customerId: tx.customerId, customerName: tx.customerName || "", currency: tx.toCurrency, amount: tx.toAmount * sign });
    if (tx.commission && tx.commission > 0 && tx.commissionCurrency) changes.push({ customerId: tx.customerId, customerName: tx.customerName || "", currency: tx.commissionCurrency, amount: -tx.commission * sign });
  }
  return changes;
}

function loadCashEntries(): any[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CASH_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveCashEntries(entries: any[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(CASH_KEY, JSON.stringify(entries)); } catch {}
}

function recomputeCashBalances(entries: any[]): any[] {
  const sorted = [...entries].sort((a, b) => {
    const t1 = new Date(a.date).getTime();
    const t2 = new Date(b.date).getTime();
    if (t1 !== t2) return t1 - t2;
    if (a.direction === "in" && b.direction === "out") return -1;
    if (a.direction === "out" && b.direction === "in") return 1;
    return 0;
  });
  const bals: Record<string, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
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

function computeCashBoxBalances(cashEntries: any[]): Record<Currency, number> {
  const balances: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
  if (!Array.isArray(cashEntries)) return balances;
  for (const ce of cashEntries) {
    if (!ce || ce.status === "voided") continue;
    const cur = ce.currency as Currency;
    if (!currencies.includes(cur)) continue;
    const amount = Number(ce.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    balances[cur] += ce.direction === "in" ? amount : -amount;
  }
  return balances;
}

function syncCashEntriesForExchange(action: "add" | "remove" | "replace", tx: Transaction | null, oldTxId?: string) {
  let entries = loadCashEntries();
  const targetId = oldTxId || tx?.id;
  if (targetId) entries = entries.filter((e: any) => e.linkedExchangeId !== targetId);
  if ((action === "add" || action === "replace") && tx) {
    const dateStr = tx.date || new Date().toISOString();
    const newEntries: any[] = [];
    newEntries.push({
      id: newId(), trackingCode: `${tx.trackingCode}-EX-IN`, date: dateStr, type: "exchange_account_in", currency: tx.fromCurrency, amount: tx.fromAmount, direction: "in", reason: "تبادل ارز - دریافت ارز توسط حساب صرافی", balanceAfter: 0, customerId: EXCHANGE_ACCOUNT_ID, customerName: EXCHANGE_ACCOUNT_NAME, linkedExchangeId: tx.id, status: "active"
    });
    newEntries.push({
      id: newId(), trackingCode: `${tx.trackingCode}-EX-OUT`, date: dateStr, type: "exchange_account_out", currency: tx.toCurrency, amount: tx.toAmount, direction: "out", reason: "تبادل ارز - پرداخت ارز توسط حساب صرافی", balanceAfter: 0, customerId: EXCHANGE_ACCOUNT_ID, customerName: EXCHANGE_ACCOUNT_NAME, linkedExchangeId: tx.id, status: "active"
    });
    if (tx.commission && tx.commission > 0 && tx.commissionCurrency) {
      newEntries.push({
        id: newId(), trackingCode: `${tx.trackingCode}-FEE`, date: dateStr, type: "exchange_account_in", currency: tx.commissionCurrency, amount: tx.commission, direction: "in", reason: "تبادل ارز - کارمزد دریافتی صرافی", balanceAfter: 0, customerId: EXCHANGE_ACCOUNT_ID, customerName: EXCHANGE_ACCOUNT_NAME, linkedExchangeId: tx.id, status: "active"
      });
    }
    entries = [...entries, ...newEntries];
  }
  entries = recomputeCashBalances(entries);
  saveCashEntries(entries);
}

function syncCashEntriesForTransfer(action: "add" | "remove" | "replace", tx: Transaction | null, oldTxId?: string) {
  let entries = loadCashEntries();
  const targetId = oldTxId || tx?.id;
  if (targetId) entries = entries.filter((e: any) => e.linkedTransferId !== targetId);
  if ((action === "add" || action === "replace") && tx) {
    const dateStr = tx.date || new Date().toISOString();
    const senderAccount = tx.senderId === EXCHANGE_ACCOUNT_ID;
    const receiverAccount = tx.receiverId === EXCHANGE_ACCOUNT_ID;
    const newEntries: any[] = [];
    if (senderAccount) {
      newEntries.push({ id: newId(), trackingCode: `${tx.trackingCode}-S-OUT`, date: dateStr, type: "owner_withdraw", currency: tx.fromCurrency, amount: tx.fromAmount, direction: "out", reason: `انتقال - برداشت از حساب صرافی به ${tx.receiverName || "مشتری"}`, balanceAfter: 0, customerId: EXCHANGE_ACCOUNT_ID, customerName: EXCHANGE_ACCOUNT_NAME, linkedTransferId: tx.id, status: "active" });
    } else if (receiverAccount) {
      newEntries.push({ id: newId(), trackingCode: `${tx.trackingCode}-R-IN`, date: dateStr, type: "owner_deposit", currency: tx.toCurrency, amount: tx.toAmount, direction: "in", reason: `انتقال - دریافت به حساب صرافی از ${tx.senderName || "مشتری"}`, balanceAfter: 0, customerId: EXCHANGE_ACCOUNT_ID, customerName: EXCHANGE_ACCOUNT_NAME, linkedTransferId: tx.id, status: "active" });
    }
    if (tx.commission && tx.commission > 0 && tx.commissionCurrency) {
      newEntries.push({ id: newId(), trackingCode: `${tx.trackingCode}-FEE`, date: dateStr, type: "exchange_account_in", currency: tx.commissionCurrency, amount: tx.commission, direction: "in", reason: `انتقال - کارمزد صرافی`, balanceAfter: 0, customerId: EXCHANGE_ACCOUNT_ID, customerName: EXCHANGE_ACCOUNT_NAME, linkedTransferId: tx.id, status: "active" });
    }
    entries = [...entries, ...newEntries];
  }
  entries = recomputeCashBalances(entries);
  saveCashEntries(entries);
}

function syncCashEntriesForConvert(action: "add" | "remove" | "replace", tx: Transaction | null, oldTxId?: string) {
  let entries = loadCashEntries();
  const targetId = oldTxId || tx?.id;
  if (targetId) entries = entries.filter((e: any) => e.linkedConvertId !== targetId);
  if ((action === "add" || action === "replace") && tx) {
    const dateStr = tx.date || new Date().toISOString();
    const isAccount = tx.customerId === EXCHANGE_ACCOUNT_ID;
    const newEntries: any[] = [];
    if (isAccount) {
      newEntries.push({ id: newId(), trackingCode: `${tx.trackingCode}-OUT`, date: dateStr, type: "owner_withdraw", currency: tx.fromCurrency, amount: tx.fromAmount, direction: "out", reason: `تبدیل ارز - برداشت از حساب صرافی`, balanceAfter: 0, customerId: EXCHANGE_ACCOUNT_ID, customerName: EXCHANGE_ACCOUNT_NAME, linkedConvertId: tx.id, status: "active" });
      newEntries.push({ id: newId(), trackingCode: `${tx.trackingCode}-IN`, date: dateStr, type: "owner_deposit", currency: tx.toCurrency, amount: tx.toAmount, direction: "in", reason: `تبدیل ارز - واریز به حساب صرافی`, balanceAfter: 0, customerId: EXCHANGE_ACCOUNT_ID, customerName: EXCHANGE_ACCOUNT_NAME, linkedConvertId: tx.id, status: "active" });
    } else {
      newEntries.push({ id: newId(), trackingCode: `${tx.trackingCode}-EX-IN`, date: dateStr, type: "exchange_account_in", currency: tx.fromCurrency, amount: tx.fromAmount, direction: "in", reason: `تبدیل ارز - دریافت ${labels[tx.fromCurrency]} توسط حساب صرافی از مشتری`, balanceAfter: 0, customerId: EXCHANGE_ACCOUNT_ID, customerName: EXCHANGE_ACCOUNT_NAME, linkedConvertId: tx.id, status: "active" });
      newEntries.push({ id: newId(), trackingCode: `${tx.trackingCode}-EX-OUT`, date: dateStr, type: "exchange_account_out", currency: tx.toCurrency, amount: tx.toAmount, direction: "out", reason: `تبدیل ارز - پرداخت ${labels[tx.toCurrency]} از حساب صرافی به مشتری`, balanceAfter: 0, customerId: EXCHANGE_ACCOUNT_ID, customerName: EXCHANGE_ACCOUNT_NAME, linkedConvertId: tx.id, status: "active" });
    }
    if (tx.commission && tx.commission > 0 && tx.commissionCurrency) {
      newEntries.push({ id: newId(), trackingCode: `${tx.trackingCode}-FEE`, date: dateStr, type: "exchange_account_in", currency: tx.commissionCurrency, amount: tx.commission, direction: "in", reason: `تبدیل ارز - کارمزد صرافی`, balanceAfter: 0, customerId: EXCHANGE_ACCOUNT_ID, customerName: EXCHANGE_ACCOUNT_NAME, linkedConvertId: tx.id, status: "active" });
    }
    entries = [...entries, ...newEntries];
  }
  entries = recomputeCashBalances(entries);
  saveCashEntries(entries);
}

const iconPaths = {
  swap: "M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5",
  users: "M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z",
  user: "M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z",
  sun: "M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.375 3.375 0 1 1-7.5 0 3.375 3.375 0 0 1 7.5 0Z",
  moon: "M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z",
  clock: "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  search: "m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 1 10.607 10.607Z",
  chevron: "m19.5 8.25-7.5 7.5-7.5-7.5",
  pencil: "m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10",
  printer: "M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z",
  eye: "M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  x: "M6 18 18 6M6 6l12 12",
  xCircle: "m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  check: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  alert: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z",
  doc: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
  inbox: "M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z",
  arrowLeft: "M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18",
  down: "M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3",
  up: "M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18",
  rate: "M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941",
  info: "m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z",
  trash: "M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0",
  wallet: "M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3",
  tag: "M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z",
  more: "M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z"
};

type IconName = keyof typeof iconPaths;
const Ic = memo(function Ic({ n, className = "h-5 w-5" }: { n: IconName; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d={iconPaths[n]} /></svg>;
});

const DetailRow = memo(function DetailRow({ label, value, valueClass = "", dark = false }: { label: string; value: string; valueClass?: string; dark?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-4 border-b border-dashed py-3 last:border-0 ${dark ? "border-slate-700" : "border-slate-200"}`}>
      <span className={`shrink-0 text-[11px] font-black ${dark ? "text-slate-500" : "text-slate-400"}`}>{label}</span>
      <span className={`text-left text-[13px] font-bold ${dark ? "text-slate-200" : "text-slate-700"} ${valueClass}`}>{value}</span>
    </div>
  );
});

function getStoredCustomers(): Customer[] { return loadCustomersShared() as Customer[]; }

export default function CurrencyExchangePage() {
  const [customers, setCustomers] = useState<Customer[]>(getStoredCustomers);
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    if (typeof window === "undefined") return [];
    try { return loadTransactionsShared(); } catch { return []; }
  });
  const [cashEntries, setCashEntries] = useState<any[]>(() => {
    try { return loadCashEntriesShared(); } catch { return []; }
  });
  const [hawalas, setHawalas] = useState<any[]>(() => {
    try { return loadHawalasShared(); } catch { return []; }
  });

  useEffect(() => { try { localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers)); } catch {} }, [customers]);
  useEffect(() => { try { window.localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions)); } catch {} }, [transactions]);
  useEffect(() => { try { initTrackingSystem(); } catch {} }, []);
  
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      try {
        if (e.key === CUSTOMERS_KEY && e.newValue) { const parsed = JSON.parse(e.newValue); if (Array.isArray(parsed)) setCustomers(parsed); }
        if (e.key === TRANSACTIONS_KEY && e.newValue) { const parsed = JSON.parse(e.newValue); if (Array.isArray(parsed)) setTransactions(parsed); }
        if (e.key === CASH_KEY && e.newValue) { const parsed = JSON.parse(e.newValue); if (Array.isArray(parsed)) setCashEntries(parsed); }
        if (e.key === HAWALAS_KEY && e.newValue) { const parsed = JSON.parse(e.newValue); if (Array.isArray(parsed)) setHawalas(parsed); }
      } catch {}
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      try {
        setCustomers(loadCustomersShared() as Customer[]);
        setTransactions(loadTransactionsShared());
        setCashEntries(loadCashEntriesShared());
        setHawalas(loadHawalasShared());
      } catch {}
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const [tab, setTab] = useState<"exchange" | "transfer" | "convert">("exchange");
  const [now, setNow] = useState<Date | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<Transaction | null>(null);
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [customerFilter, setCustomerFilter] = useState("");
  const customerListRef = useRef<HTMLDivElement>(null);
  const [showSenderList, setShowSenderList] = useState(false);
  const [senderFilter, setSenderFilter] = useState("");
  const senderListRef = useRef<HTMLDivElement>(null);
  const [showReceiverList, setShowReceiverList] = useState(false);
  const [receiverFilter, setReceiverFilter] = useState("");
  const receiverListRef = useRef<HTMLDivElement>(null);
  const [showConvertList, setShowConvertList] = useState(false);
  const [convertFilter, setConvertFilter] = useState("");
  const convertListRef = useRef<HTMLDivElement>(null);
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  useEffect(() => {
    if (!openActionId) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.action-dropdown')) setOpenActionId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openActionId]);

  useEffect(() => { try { const s = window.localStorage.getItem("fx-theme"); if (s === "dark" || s === "light") setTheme(s); } catch {} }, []);
  useEffect(() => { try { window.localStorage.setItem("fx-theme", theme); } catch {} }, [theme]);
  const dk = theme === "dark";

  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const currentDateTime = now ? formatDateTime(now) : "";

  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [editingExchangeId, setEditingExchangeId] = useState<string | null>(null);
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null);
  const [editingConvertId, setEditingConvertId] = useState<string | null>(null);
  
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerTelegram, setCustomerTelegram] = useState("");
  const [exchangeDealType, setExchangeDealType] = useState<DealType | "">("");
  const [exchangeCommission, setExchangeCommission] = useState("");
  const [exchangeCommissionPayer, setExchangeCommissionPayer] = useState<CommissionPayer>("sender");
  const [exchangeCommissionCurrency, setExchangeCommissionCurrency] = useState<Currency>("AFN");
  const [exchangeDescription, setExchangeDescription] = useState("");
  const [receivedCurrency, setReceivedCurrency] = useState<Currency>("AFN");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [paidCurrency, setPaidCurrency] = useState<Currency>("USD");
  const [paidAmount, setPaidAmount] = useState("");
  const [rate, setRate] = useState("");
  const [exchangeDirectBase, setExchangeDirectBase] = useState<Currency>("USD");
  const [exchangeErrors, setExchangeErrors] = useState<ExchangeFormErrors>({});
  
  const [sender, setSender] = useState("");
  const [receiver, setReceiver] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [senderTelegram, setSenderTelegram] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [receiverTelegram, setReceiverTelegram] = useState("");
  const [senderCurrency, setSenderCurrency] = useState<Currency>("AFN");
  const [receiverCurrency, setReceiverCurrency] = useState<Currency>("AFN");
  const [senderAmount, setSenderAmount] = useState("");
  const [receiverAmount, setReceiverAmount] = useState("");
  const [transferRate, setTransferRate] = useState("");
  const [transferDirectBase, setTransferDirectBase] = useState<Currency>("USD");
  const [commission, setCommission] = useState("");
  const [transferCommissionPayer, setTransferCommissionPayer] = useState<CommissionPayer>("sender");
  const [transferCommissionCurrency, setTransferCommissionCurrency] = useState<Currency>("AFN");
  const [transferDescription, setTransferDescription] = useState("");
  const [transferErrors, setTransferErrors] = useState<TransferFormErrors>({});
  
  const [convertCustomer, setConvertCustomer] = useState("");
  const [convertCustomerPhone, setConvertCustomerPhone] = useState("");
  const [convertCustomerTelegram, setConvertCustomerTelegram] = useState("");
  const [convertFromCurrency, setConvertFromCurrency] = useState<Currency>("AFN");
  const [convertToCurrency, setConvertToCurrency] = useState<Currency>("USD");
  const [convertAmount, setConvertAmount] = useState("");
  const [convertRate, setConvertRate] = useState("");
  const [convertDirectBase, setConvertDirectBase] = useState<Currency>("USD");
  const [convertCommission, setConvertCommission] = useState("");
  const [convertCommissionCurrency, setConvertCommissionCurrency] = useState<Currency>("AFN");
  const [convertDescription, setConvertDescription] = useState("");
  const [convertErrors, setConvertErrors] = useState<ConvertFormErrors>({});
  const [convertedAmount, setConvertedAmount] = useState("");

  const cashBoxBalances = useMemo(() => computeCashBoxBalances(cashEntries), [cashEntries]);
  const exchangeAccountBalances = useMemo(() => getExchangeAccountBalances(cashEntries), [cashEntries]);

  const exchangeMode = getRateMode(receivedCurrency, paidCurrency);
  const exchangeForeign = getAfnForeign(receivedCurrency, paidCurrency);
  const exchangeDirectBaseValue = exchangeMode === "direct" ? getSafeDirectBase(exchangeDirectBase, receivedCurrency, paidCurrency) : receivedCurrency;
  const exchangeDirectCounter = exchangeMode === "direct" ? getDirectCounter(exchangeDirectBaseValue, receivedCurrency, paidCurrency) : null;
  useEffect(() => { if (exchangeMode === "direct" && exchangeDirectBase !== exchangeDirectBaseValue) setExchangeDirectBase(exchangeDirectBaseValue); }, [exchangeMode, exchangeDirectBase, exchangeDirectBaseValue]);
  useEffect(() => { setRate(""); }, [exchangeMode, exchangeForeign, exchangeDirectBaseValue, exchangeDirectCounter]);

  const transferMode = getRateMode(senderCurrency, receiverCurrency);
  const transferForeign = getAfnForeign(senderCurrency, receiverCurrency);
  const transferDirectBaseValue = transferMode === "direct" ? getSafeDirectBase(transferDirectBase, senderCurrency, receiverCurrency) : senderCurrency;
  const transferDirectCounter = transferMode === "direct" ? getDirectCounter(transferDirectBaseValue, senderCurrency, receiverCurrency) : null;
  useEffect(() => { if (transferMode === "direct" && transferDirectBase !== transferDirectBaseValue) setTransferDirectBase(transferDirectBaseValue); }, [transferMode, transferDirectBase, transferDirectBaseValue]);
  useEffect(() => { setTransferRate(""); }, [transferMode, transferForeign, transferDirectBaseValue, transferDirectCounter]);

  const convertMode = getRateMode(convertFromCurrency, convertToCurrency);
  const convertForeign = getAfnForeign(convertFromCurrency, convertToCurrency);
  const convertDirectBaseValue = convertMode === "direct" ? getSafeDirectBase(convertDirectBase, convertFromCurrency, convertToCurrency) : convertFromCurrency;
  const convertDirectCounter = convertMode === "direct" ? getDirectCounter(convertDirectBaseValue, convertFromCurrency, convertToCurrency) : null;
  useEffect(() => { if (convertMode === "direct" && convertDirectBase !== convertDirectBaseValue) setConvertDirectBase(convertDirectBaseValue); }, [convertMode, convertDirectBase, convertDirectBaseValue]);
  useEffect(() => { setConvertRate(""); }, [convertMode, convertForeign, convertDirectBaseValue, convertDirectCounter]);

  useEffect(() => {
    const a = parseAmount(receivedAmount);
    if (!a) { setPaidAmount(""); return; }
    if (exchangeMode === "same") { setPaidAmount(fmt(a)); return; }
    const r = parseAmount(rate);
    if (!r) { setPaidAmount(""); return; }
    let res = 0;
    if (exchangeMode === "afn") res = convertAfnRate(a, receivedCurrency, paidCurrency, r);
    if (exchangeMode === "direct" && exchangeDirectCounter) res = convertDirectRate(a, receivedCurrency, paidCurrency, exchangeDirectBaseValue, r);
    setPaidAmount(res ? fmt(res) : "");
  }, [receivedAmount, receivedCurrency, paidCurrency, rate, exchangeMode, exchangeDirectBaseValue, exchangeDirectCounter]);

  useEffect(() => {
    const a = parseAmount(senderAmount);
    if (!a) { setReceiverAmount(""); return; }
    if (transferMode === "same") { setReceiverAmount(fmt(a)); return; }
    const r = parseAmount(transferRate);
    if (!r) { setReceiverAmount(""); return; }
    let res = 0;
    if (transferMode === "afn") res = convertAfnRate(a, senderCurrency, receiverCurrency, r);
    if (transferMode === "direct" && transferDirectCounter) res = convertDirectRate(a, senderCurrency, receiverCurrency, transferDirectBaseValue, r);
    setReceiverAmount(res ? fmt(res) : "");
  }, [senderAmount, senderCurrency, receiverCurrency, transferRate, transferMode, transferDirectBaseValue, transferDirectCounter]);

  useEffect(() => {
    const a = parseAmount(convertAmount);
    if (!a) { setConvertedAmount(""); return; }
    if (convertMode === "same") { setConvertedAmount(fmt(a)); return; }
    const r = parseAmount(convertRate);
    if (!r) { setConvertedAmount(""); return; }
    let res = 0;
    if (convertMode === "afn") res = convertAfnRate(a, convertFromCurrency, convertToCurrency, r);
    if (convertMode === "direct" && convertDirectCounter) res = convertDirectRate(a, convertFromCurrency, convertToCurrency, convertDirectBaseValue, r);
    setConvertedAmount(res ? fmt(res) : "");
  }, [convertAmount, convertFromCurrency, convertToCurrency, convertRate, convertMode, convertDirectBaseValue, convertDirectCounter]);

  const anyDropdownOpen = showCustomerList || showSenderList || showReceiverList || showConvertList;
  useEffect(() => {
    if (!anyDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (showCustomerList && customerListRef.current && !customerListRef.current.contains(t)) setShowCustomerList(false);
      if (showSenderList && senderListRef.current && !senderListRef.current.contains(t)) setShowSenderList(false);
      if (showReceiverList && receiverListRef.current && !receiverListRef.current.contains(t)) setShowReceiverList(false);
      if (showConvertList && convertListRef.current && !convertListRef.current.contains(t)) setShowConvertList(false);
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handler); };
  }, [anyDropdownOpen, showCustomerList, showSenderList, showReceiverList, showConvertList]);

  const filteredCustomerList = useMemo(() => { const q = normalizeDigits(customerFilter.trim()).toLowerCase(); const normal = customers.filter(c => c.id !== CASH_BOX_ID && c.id !== EXCHANGE_ACCOUNT_ID).filter(c => !q || c.name.toLowerCase().includes(q) || (c.phone && normalizeDigits(c.phone).includes(q))); return [EXCHANGE_ACCOUNT_CUSTOMER, ...normal].filter(c => !q || c.name.toLowerCase().includes(q) || (c.phone && normalizeDigits(c.phone).includes(q))); }, [customers, customerFilter]);
  const filteredSenderList = useMemo(() => { const q = normalizeDigits(senderFilter.trim()).toLowerCase(); const normal = customers.filter(c => c.id !== CASH_BOX_ID && c.id !== EXCHANGE_ACCOUNT_ID).filter(c => !q || c.name.toLowerCase().includes(q) || (c.phone && normalizeDigits(c.phone).includes(q))); return [EXCHANGE_ACCOUNT_CUSTOMER, ...normal].filter(c => !q || c.name.toLowerCase().includes(q) || (c.phone && normalizeDigits(c.phone).includes(q))); }, [customers, senderFilter]);
  const filteredReceiverList = useMemo(() => { const q = normalizeDigits(receiverFilter.trim()).toLowerCase(); const normal = customers.filter(c => c.id !== CASH_BOX_ID && c.id !== EXCHANGE_ACCOUNT_ID).filter(c => !q || c.name.toLowerCase().includes(q) || (c.phone && normalizeDigits(c.phone).includes(q))); return [EXCHANGE_ACCOUNT_CUSTOMER, ...normal].filter(c => !q || c.name.toLowerCase().includes(q) || (c.phone && normalizeDigits(c.phone).includes(q))); }, [customers, receiverFilter]);
  const filteredConvertList = useMemo(() => { const q = normalizeDigits(convertFilter.trim()).toLowerCase(); const normal = customers.filter(c => c.id !== CASH_BOX_ID && c.id !== EXCHANGE_ACCOUNT_ID).filter(c => !q || c.name.toLowerCase().includes(q) || (c.phone && normalizeDigits(c.phone).includes(q))); return [EXCHANGE_ACCOUNT_CUSTOMER, ...normal].filter(c => !q || c.name.toLowerCase().includes(q) || (c.phone && normalizeDigits(c.phone).includes(q))); }, [customers, convertFilter]);

  const isCustomerExchangeAccount = customer === EXCHANGE_ACCOUNT_NAME;
  const isSenderExchangeAccount = sender === EXCHANGE_ACCOUNT_NAME;
  const isReceiverExchangeAccount = receiver === EXCHANGE_ACCOUNT_NAME;
  const isConvertCustomerExchangeAccount = convertCustomer === EXCHANGE_ACCOUNT_NAME;

  const selectedCustomer = useMemo(() => {
    if (isCustomerExchangeAccount) return EXCHANGE_ACCOUNT_CUSTOMER;
    return customers.find(c => c.name === customer) || null;
  }, [customers, customer, isCustomerExchangeAccount]);

  const selectedSender = useMemo(() => {
    if (isSenderExchangeAccount) return EXCHANGE_ACCOUNT_CUSTOMER;
    return customers.find(c => c.name === sender) || null;
  }, [customers, sender, isSenderExchangeAccount]);

  const selectedReceiver = useMemo(() => {
    if (isReceiverExchangeAccount) return EXCHANGE_ACCOUNT_CUSTOMER;
    return customers.find(c => c.name === receiver) || null;
  }, [customers, receiver, isReceiverExchangeAccount]);

  const selectedConvertCustomer = useMemo(() => {
    if (isConvertCustomerExchangeAccount) return EXCHANGE_ACCOUNT_CUSTOMER;
    return customers.find(c => c.name === convertCustomer) || null;
  }, [customers, convertCustomer, isConvertCustomerExchangeAccount]);

  const resetExchangeForm = useCallback(() => {
    setCustomer(""); setCustomerPhone(""); setCustomerTelegram(""); setExchangeDealType(""); setReceivedAmount(""); setPaidAmount("");
    setRate(""); setExchangeCommission(""); setExchangeCommissionPayer("sender"); setExchangeCommissionCurrency("AFN");
    setExchangeDescription(""); setExchangeErrors({}); setEditingExchangeId(null);
  }, []);

  const resetTransferForm = useCallback(() => {
    setSender(""); setReceiver(""); setSenderAmount(""); setReceiverAmount(""); setTransferRate(""); setCommission("");
    setTransferCommissionPayer("sender"); setTransferCommissionCurrency("AFN"); setTransferDescription(""); setTransferErrors({}); setEditingTransferId(null);
  }, []);

  const resetConvertForm = useCallback(() => {
    setConvertCustomer(""); setConvertCustomerPhone(""); setConvertCustomerTelegram(""); setConvertFromCurrency("AFN"); setConvertToCurrency("USD");
    setConvertAmount(""); setConvertRate(""); setConvertedAmount(""); setConvertCommission(""); setConvertCommissionCurrency("AFN");
    setConvertDescription(""); setConvertErrors({}); setEditingConvertId(null);
  }, []);

  const validateExchange = useCallback((): ExchangeFormErrors => {
    const e: ExchangeFormErrors = {};
    if (!exchangeDealType) e.dealType = "نوع معامله خالی است.";
    if (!customer) e.customer = "مشتری خالی است.";
    const a = parseAmount(receivedAmount);
    if (!a) e.receivedAmount = "مبلغ خالی یا صفر است.";
    if (exchangeMode !== "same") {
      if (!parseAmount(rate)) e.rate = "نرخ خالی است.";
      if (exchangeMode === "direct" && !exchangeDirectCounter) e.rate = "مبنای نرخ معتبر نیست.";
    }
    if (a && !parseAmount(paidAmount)) e.paidAmount = "مبلغ پرداختی محاسبه نشد.";
    if (!exchangeCommission.trim()) e.exchangeCommission = "کارمزد خالی است.";
    return e;
  }, [exchangeDealType, customer, receivedAmount, exchangeMode, rate, exchangeDirectCounter, paidAmount, exchangeCommission]);

  const validateTransfer = useCallback((): TransferFormErrors => {
    const e: TransferFormErrors = {};
    if (!sender) e.sender = "فرستنده خالی است.";
    if (!receiver) e.receiver = "گیرنده خالی است.";
    if (sender && receiver && sender === receiver) e.receiver = "یکسان هستند.";
    const a = parseAmount(senderAmount);
    if (!a) e.senderAmount = "مبلغ خالی است.";
    if (transferMode !== "same") { if (!parseAmount(transferRate)) e.transferRate = "نرخ خالی است."; }
    if (a && !parseAmount(receiverAmount)) e.receiverAmount = "مبلغ گیرنده محاسبه نشد.";
    if (!commission.trim()) e.commission = "کارمزد خالی است.";
    return e;
  }, [sender, receiver, senderAmount, transferMode, transferRate, transferDirectCounter, receiverAmount, commission]);

  const validateConvert = useCallback((): ConvertFormErrors => {
    const e: ConvertFormErrors = {};
    if (!convertCustomer) e.customer = "مشتری خالی است.";
    const a = parseAmount(convertAmount);
    if (!a) e.amount = "مبلغ خالی است.";
    if (convertMode !== "same") { if (!parseAmount(convertRate)) e.rate = "نرخ خالی است."; }
    if (a && !parseAmount(convertedAmount)) e.convertedAmount = "مبلغ محاسبه نشد.";
    if (!convertCommission.trim()) e.commission = "کارمزد خالی است.";
    return e;
  }, [convertCustomer, convertAmount, convertMode, convertRate, convertDirectCounter, convertedAmount, convertCommission]);

  const exchangeFromAmount = parseAmount(receivedAmount);
  const exchangeToAmount = parseAmount(paidAmount);
  const exchangeRateValue = parseAmount(rate);
  const exchangeCommissionValue = Math.max(0, parseAmount(exchangeCommission));

  const submitExchange = useCallback(() => {
    const errs = validateExchange();
    setExchangeErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    let rl = "";
    const tr = exchangeMode === "same" ? 1 : exchangeRateValue;
    if (exchangeMode === "same") rl = "بدون تبدیل";
    if (exchangeMode === "afn" && exchangeForeign) rl = afnRateLabel(exchangeForeign, tr);
    if (exchangeMode === "direct" && exchangeDirectCounter) rl = directRateLabel(exchangeDirectBaseValue, exchangeDirectCounter, tr);
    const selC = customer === EXCHANGE_ACCOUNT_NAME ? EXCHANGE_ACCOUNT_CUSTOMER : customers.find(c => c.name === customer);
    const tx: Transaction = {
      id: editingExchangeId || newId(),
      trackingCode: editingExchangeId ? (transactions.find(t => t.id === editingExchangeId)?.trackingCode || getNextTrackingCode()) : getNextTrackingCode(),
      type: "exchange", dealType: exchangeDealType as DealType,
      date: editingExchangeId ? (transactions.find(t => t.id === editingExchangeId)?.date || new Date().toISOString()) : new Date().toISOString(),
      customerId: selC?.id, customerName: customer,
      fromCurrency: receivedCurrency, fromAmount: exchangeFromAmount,
      toCurrency: paidCurrency, toAmount: exchangeToAmount, rate: tr, rateLabel: rl,
      rateBase: exchangeMode === "direct" ? exchangeDirectBaseValue : undefined,
      commission: exchangeCommissionValue,
      commissionCurrency: exchangeCommissionCurrency, commissionPayer: exchangeCommissionPayer,
      description: exchangeDescription.trim() || undefined, status: "active",
      profit: exchangeCommissionValue, profitCurrency: exchangeCommissionCurrency,
      customerPhone, customerTelegram
    };
    setPreviewData(tx);
    setPreviewOpen(true);
  }, [validateExchange, exchangeFromAmount, exchangeToAmount, exchangeMode, exchangeRateValue, exchangeForeign, exchangeDirectCounter, exchangeDirectBaseValue, exchangeDescription, exchangeCommissionValue, exchangeCommissionCurrency, editingExchangeId, transactions, exchangeDealType, customer, receivedCurrency, paidCurrency, exchangeCommissionPayer, customerPhone, customerTelegram, customers]);

  const transferFromAmount = parseAmount(senderAmount);
  const transferToAmount = parseAmount(receiverAmount);
  const transferRateValue = parseAmount(transferRate);
  const commissionValue = Math.max(0, parseAmount(commission));

  const submitTransfer = useCallback(() => {
    const errs = validateTransfer();
    setTransferErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    let rl = "";
    const tr = transferMode === "same" ? 1 : transferRateValue;
    if (transferMode === "same") rl = "بدون تبدیل";
    if (transferMode === "afn" && transferForeign) rl = afnRateLabel(transferForeign, tr);
    if (transferMode === "direct" && transferDirectCounter) rl = directRateLabel(transferDirectBaseValue, transferDirectCounter, tr);
    const selS = sender === EXCHANGE_ACCOUNT_NAME ? EXCHANGE_ACCOUNT_CUSTOMER : customers.find(c => c.name === sender);
    const selR = receiver === EXCHANGE_ACCOUNT_NAME ? EXCHANGE_ACCOUNT_CUSTOMER : customers.find(c => c.name === receiver);
    const tx: Transaction = {
      id: editingTransferId || newId(),
      trackingCode: editingTransferId ? (transactions.find(t => t.id === editingTransferId)?.trackingCode || getNextTrackingCode()) : getNextTrackingCode(),
      type: "transfer",
      date: editingTransferId ? (transactions.find(t => t.id === editingTransferId)?.date || new Date().toISOString()) : new Date().toISOString(),
      senderId: selS?.id, senderName: sender,
      receiverId: selR?.id, receiverName: receiver,
      fromCurrency: senderCurrency, fromAmount: transferFromAmount,
      toCurrency: receiverCurrency, toAmount: transferToAmount,
      rate: tr, rateLabel: rl,
      rateBase: transferMode === "direct" ? transferDirectBaseValue : undefined,
      commission: commissionValue,
      commissionCurrency: transferCommissionCurrency, commissionPayer: transferCommissionPayer,
      description: transferDescription.trim() || undefined, status: "active",
      profit: commissionValue, profitCurrency: transferCommissionCurrency
    };
    setPreviewData(tx);
    setPreviewOpen(true);
  }, [validateTransfer, transferFromAmount, transferToAmount, transferMode, transferRateValue, transferForeign, transferDirectCounter, transferDirectBaseValue, transferDescription, commissionValue, transferCommissionCurrency, editingTransferId, transactions, sender, receiver, senderCurrency, receiverCurrency, transferCommissionPayer, customers]);

  const convertFromAmount = parseAmount(convertAmount);
  const convertToAmount = parseAmount(convertedAmount);
  const convertRateValue = parseAmount(convertRate);
  const convertCommissionValue = Math.max(0, parseAmount(convertCommission));

  const submitConvert = useCallback(() => {
    const errs = validateConvert();
    setConvertErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    let rl = "";
    const tr = convertMode === "same" ? 1 : convertRateValue;
    if (convertMode === "same") rl = "بدون تبدیل";
    if (convertMode === "afn" && convertForeign) rl = afnRateLabel(convertForeign, tr);
    if (convertMode === "direct" && convertDirectCounter) rl = directRateLabel(convertDirectBaseValue, convertDirectCounter, tr);
    const selC = convertCustomer === EXCHANGE_ACCOUNT_NAME ? EXCHANGE_ACCOUNT_CUSTOMER : customers.find(c => c.name === convertCustomer);
    const tx: Transaction = {
      id: editingConvertId || newId(),
      trackingCode: editingConvertId ? (transactions.find(t => t.id === editingConvertId)?.trackingCode || getNextTrackingCode()) : getNextTrackingCode(),
      type: "convert",
      date: editingConvertId ? (transactions.find(t => t.id === editingConvertId)?.date || new Date().toISOString()) : new Date().toISOString(),
      customerId: selC?.id, customerName: convertCustomer,
      fromCurrency: convertFromCurrency, fromAmount: convertFromAmount,
      toCurrency: convertToCurrency, toAmount: convertToAmount,
      rate: tr, rateLabel: rl,
      rateBase: convertMode === "direct" ? convertDirectBaseValue : undefined,
      commission: convertCommissionValue,
      commissionCurrency: convertCommissionCurrency, commissionPayer: "sender",
      description: convertDescription.trim() || undefined, status: "active",
      profit: convertCommissionValue, profitCurrency: convertCommissionCurrency
    };
    setPreviewData(tx);
    setPreviewOpen(true);
  }, [validateConvert, convertFromAmount, convertToAmount, convertMode, convertRateValue, convertForeign, convertDirectCounter, convertDirectBaseValue, convertDescription, convertCommissionValue, convertCommissionCurrency, editingConvertId, transactions, convertCustomer, convertFromCurrency, convertToCurrency, customers]);

  // ✅ تابع اصلاح‌شده برای ارسال خودکار رسید
  const confirmRegister = useCallback(async () => {
    if (!previewData) return;
    const tx = { ...previewData, trackingCode: consumeTrackingCode() };

    if (editingExchangeId) {
      const oldTx = transactions.find(t => t.id === editingExchangeId);
      if (oldTx && oldTx.status !== "voided") setCustomers(prev => applyBalanceChanges(prev, getBalanceChangesForTransaction(oldTx, "reverse")));
      syncCashEntriesForExchange("replace", tx, editingExchangeId);
      setTransactions(p => p.map(t => t.id === editingExchangeId ? { ...tx, id: editingExchangeId, trackingCode: t.trackingCode, date: t.date } : t));
    } else if (editingTransferId) {
      const oldTx = transactions.find(t => t.id === editingTransferId);
      if (oldTx && oldTx.status !== "voided") setCustomers(prev => applyBalanceChanges(prev, getBalanceChangesForTransaction(oldTx, "reverse")));
      syncCashEntriesForTransfer("replace", tx, editingTransferId);
      setTransactions(p => p.map(t => t.id === editingTransferId ? { ...tx, id: editingTransferId, trackingCode: t.trackingCode, date: t.date } : t));
    } else if (editingConvertId) {
      const oldTx = transactions.find(t => t.id === editingConvertId);
      if (oldTx && oldTx.status !== "voided") setCustomers(prev => applyBalanceChanges(prev, getBalanceChangesForTransaction(oldTx, "reverse")));
      syncCashEntriesForConvert("replace", tx, editingConvertId);
      setTransactions(p => p.map(t => t.id === editingConvertId ? { ...tx, id: editingConvertId, trackingCode: t.trackingCode, date: t.date } : t));
    } else {
      setTransactions(x => [...x, tx]);
      if (tx.type === "exchange") syncCashEntriesForExchange("add", tx);
      else if (tx.type === "transfer") syncCashEntriesForTransfer("add", tx);
      else if (tx.type === "convert") syncCashEntriesForConvert("add", tx);
    }

    setCustomers(prev => {
      const updated = applyBalanceChanges(prev, getBalanceChangesForTransaction(tx, "register"));

      // ✅ ارسال خودکار سند رسید برای مشتری
      try {
        const settings = getTelegramSettings();
        if (settings.enabled && settings.botToken) {
          let chatId = "";
          let customerName = "";

          if (tx.type === "exchange" || tx.type === "convert") {
            chatId = tx.customerTelegram || "";
            customerName = tx.customerName || "";
          } else if (tx.type === "transfer") {
            const sender = customers.find(c => c.id === tx.senderId);
            chatId = sender?.telegram || "";
            customerName = tx.senderName || "";
          }

          if (chatId) {
            let text = `🟢 سند رسید معامله\n\n`;
            text += `🗓 تاریخ: ${formatDateTime(new Date(tx.date))}\n\n`;
            text += `🛅 کد پیگیری: ${tx.trackingCode}\n\n`;
            text += `👤 مشتری: ${customerName}\n\n`;

            if (tx.type === "exchange") {
              text += `📑 شرح: تبادل ارز (${tx.dealType === "buy" ? "خرید" : "فروش"})\n`;
              text += `💰 دریافت: ${fmt(tx.fromAmount)} ${labels[tx.fromCurrency]}\n`;
              text += `💵 پرداخت: ${fmt(tx.toAmount)} ${labels[tx.toCurrency]}\n`;
            } else if (tx.type === "transfer") {
              text += `📑 شرح: انتقال به ${tx.receiverName}\n`;
              text += `💰 مبلغ انتقال: ${fmt(tx.fromAmount)} ${labels[tx.fromCurrency]}\n`;
            } else if (tx.type === "convert") {
              text += `📑 شرح: تبدیل ارز\n`;
              text += `💰 از: ${fmt(tx.fromAmount)} ${labels[tx.fromCurrency]}\n`;
              text += `💵 به: ${fmt(tx.toAmount)} ${labels[tx.toCurrency]}\n`;
            }

            if (tx.commission && tx.commission > 0 && tx.commissionCurrency) {
              text += `💎 کارمزد: ${fmt(tx.commission)} ${labels[tx.commissionCurrency]}\n`;
            }

            text += `\n🏦 صرافی برادران نورزاد — هرات`;

            sendTelegramMessage(settings.botToken, chatId, text);
          }
        }
      } catch (err) {
        console.error("Error sending receipt:", err);
      }

      return updated;
    });

    resetExchangeForm(); resetTransferForm(); resetConvertForm();
    setPreviewOpen(false); setPreviewData(null);
    setCashEntries(loadCashEntriesShared());
  }, [previewData, editingExchangeId, editingTransferId, editingConvertId, transactions, resetExchangeForm, resetTransferForm, resetConvertForm, customers]);

  const customerName = useCallback((id?: string) => {
    if (id === EXCHANGE_ACCOUNT_ID) return EXCHANGE_ACCOUNT_NAME;
    return customers.find(c => c.id === id)?.name || customers.find(c => c.name === id)?.name || id || "-";
  }, [customers]);

  const transactionCustomerLabel = useCallback((tx: Transaction) => tx.type === "transfer" ? `${customerName(tx.senderId || tx.senderName)} - ${customerName(tx.receiverId || tx.receiverName)}` : customerName(tx.customerId || tx.customerName), [customerName]);
  const transactionTypeLabel = useCallback((tx: Transaction) => tx.type === "exchange" ? dealTypeLabel(tx.dealType) : tx.type === "convert" ? "تبدیل ارز" : "انتقال", []);
  const transactionCommissionLabel = useCallback((tx: Transaction) => tx.commission === undefined ? "-" : `${fmt(tx.commission)} ${tx.commissionCurrency ? labels[tx.commissionCurrency] : ""}`, []);
  const commissionPayerLabel = useCallback((tx: Transaction) => !tx.commissionPayer ? "-" : tx.type === "convert" ? "خود مشتری" : tx.commissionPayer === "sender" ? "فرستنده" : "گیرنده", []);

  const rawSearch = normalizeDigits(search.trim()).toLowerCase();
  const amountSearch = rawSearch.replace(/[,،]/g, "");
  const isSearching = amountSearch.trim().length > 0;
  const activeCount = useMemo(() => transactions.filter(t => t.status === "active").length, [transactions]);
  const voidedCount = transactions.length - activeCount;

  const transactionMatchesSearch = useCallback((tx: Transaction) => {
    if (!isSearching) return true;
    const names = [customerName(tx.customerId || tx.customerName), customerName(tx.senderId || tx.senderName), customerName(tx.receiverId || tx.receiverName), transactionCustomerLabel(tx), tx.trackingCode];
    if (names.some(n => normalizeDigits(n).toLowerCase().includes(rawSearch))) return true;
    return [tx.fromAmount, tx.toAmount, tx.commission || 0].some(a => {
      const p = normalizeDigits(String(a));
      const f = normalizeDigits(fmt(a)).replace(/,/g, "");
      return p.includes(amountSearch) || f.includes(amountSearch);
    });
  }, [isSearching, rawSearch, amountSearch, customerName, transactionCustomerLabel]);

  const exchangeErrorList = useMemo(() => Object.values(exchangeErrors).filter((m): m is string => Boolean(m)), [exchangeErrors]);
  const transferErrorList = useMemo(() => Object.values(transferErrors).filter((m): m is string => Boolean(m)), [transferErrors]);
  const convertErrorList = useMemo(() => Object.values(convertErrors).filter((m): m is string => Boolean(m)), [convertErrors]);

  const editingExchangeTransaction = useMemo(() => transactions.find(t => t.id === editingExchangeId), [transactions, editingExchangeId]);
  const editingTransferTransaction = useMemo(() => transactions.find(t => t.id === editingTransferId), [transactions, editingTransferId]);
  const editingConvertTransaction = useMemo(() => transactions.find(t => t.id === editingConvertId), [transactions, editingConvertId]);

  const exchangeDateDisplay = editingExchangeTransaction ? dateLabel(editingExchangeTransaction.date) : currentDateTime;
  const transferDateDisplay = editingTransferTransaction ? dateLabel(editingTransferTransaction.date) : currentDateTime;
  const convertDateDisplay = editingConvertTransaction ? dateLabel(editingConvertTransaction.date) : currentDateTime;
  const nextTrackingCode = useMemo(() => getNextTrackingCode(), []);

  const editTransaction = useCallback((tx: Transaction) => {
    if (tx.status === "voided") return;
    if (tx.type === "exchange") {
      setTab("exchange"); setEditingTransferId(null); setEditingConvertId(null); setEditingExchangeId(tx.id);
      setCustomer(tx.customerName || tx.customerId || ""); setExchangeDealType(tx.dealType || "");
      setCustomerPhone(tx.customerPhone || ""); setCustomerTelegram(tx.customerTelegram || "");
      setReceivedCurrency(tx.fromCurrency); setPaidCurrency(tx.toCurrency); setReceivedAmount(String(tx.fromAmount));
      setExchangeCommission(tx.commission ? String(tx.commission) : "0"); setExchangeCommissionPayer(tx.commissionPayer || "sender");
      setExchangeCommissionCurrency(tx.commissionCurrency || "AFN"); setExchangeDescription(tx.description || "");
      setRate(String(tx.rate));
      if (getRateMode(tx.fromCurrency, tx.toCurrency) === "direct") setExchangeDirectBase(tx.rateBase || preferredDirectBase(tx.fromCurrency, tx.toCurrency));
      setExchangeErrors({});
    }
    if (tx.type === "transfer") {
      setTab("transfer"); setEditingExchangeId(null); setEditingConvertId(null); setEditingTransferId(tx.id);
      setSender(tx.senderName || tx.senderId || ""); setReceiver(tx.receiverName || tx.receiverId || "");
      setSenderCurrency(tx.fromCurrency); setReceiverCurrency(tx.toCurrency); setSenderAmount(String(tx.fromAmount));
      setCommission(tx.commission ? String(tx.commission) : "0"); setTransferCommissionPayer(tx.commissionPayer || "sender");
      setTransferCommissionCurrency(tx.commissionCurrency || "AFN"); setTransferDescription(tx.description || "");
      setTransferRate(String(tx.rate));
      if (getRateMode(tx.fromCurrency, tx.toCurrency) === "direct") setTransferDirectBase(tx.rateBase || preferredDirectBase(tx.fromCurrency, tx.toCurrency));
      setTransferErrors({});
    }
    if (tx.type === "convert") {
      setTab("convert"); setEditingExchangeId(null); setEditingTransferId(null); setEditingConvertId(tx.id);
      setConvertCustomer(tx.customerName || tx.customerId || ""); setConvertFromCurrency(tx.fromCurrency); setConvertToCurrency(tx.toCurrency);
      setConvertAmount(String(tx.fromAmount)); setConvertCommission(tx.commission ? String(tx.commission) : "0");
      setConvertCommissionCurrency(tx.commissionCurrency || "AFN"); setConvertDescription(tx.description || "");
      setConvertRate(String(tx.rate));
      if (getRateMode(tx.fromCurrency, tx.toCurrency) === "direct") setConvertDirectBase(tx.rateBase || preferredDirectBase(tx.fromCurrency, tx.toCurrency));
      setConvertErrors({});
    }
  }, []);

  const viewTransaction = useCallback((tx: Transaction) => setSelectedTransaction(tx), []);
  
  const voidTransaction = useCallback((tx: Transaction) => {
    if (tx.status === "voided") return;
    if (!window.confirm("لغو شود؟")) return;
    setCustomers(prev => applyBalanceChanges(prev, getBalanceChangesForTransaction(tx, "reverse")));
    setTransactions(p => p.map(t => t.id === tx.id ? { ...t, status: "voided" } : t));
    if (tx.type === "exchange") syncCashEntriesForExchange("remove", null, tx.id);
    else if (tx.type === "transfer") syncCashEntriesForTransfer("remove", null, tx.id);
    else if (tx.type === "convert") syncCashEntriesForConvert("remove", null, tx.id);
    setEditingExchangeId(null); setEditingTransferId(null); setEditingConvertId(null);
    setCashEntries(loadCashEntriesShared());
  }, []);

  const deleteTransaction = useCallback((tx: Transaction) => {
    if (!window.confirm(`حذف ${tx.trackingCode}؟`)) return;
    if (tx.status !== "voided") {
      setCustomers(prev => applyBalanceChanges(prev, getBalanceChangesForTransaction(tx, "reverse")));
      if (tx.type === "exchange") syncCashEntriesForExchange("remove", null, tx.id);
      else if (tx.type === "transfer") syncCashEntriesForTransfer("remove", null, tx.id);
      else if (tx.type === "convert") syncCashEntriesForConvert("remove", null, tx.id);
    }
    setTransactions(p => p.filter(t => t.id !== tx.id));
    setCashEntries(loadCashEntriesShared());
  }, []);

  const printReceipt = useCallback((tx: Transaction) => {
    const w = window.open("", "_blank", "width=650,height=800");
    if (!w) return;
    w.document.write(`<html dir="rtl"><head><meta charset="utf-8"/><title>رسید</title><style>body{font-family:Tahoma;padding:24px;direction:rtl}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:8px;text-align:right}</style></head><body><h2>رسید</h2><table><tr><th>کد</th><td>${tx.trackingCode}</td></tr><tr><th>تاریخ</th><td>${dateLabel(tx.date)}</td></tr><tr><th>مشتری</th><td>${transactionCustomerLabel(tx)}</td></tr><tr><th>دریافت</th><td>${fmt(tx.fromAmount)} ${labels[tx.fromCurrency]}</td></tr><tr><th>پرداخت</th><td>${fmt(tx.toAmount)} ${labels[tx.toCurrency]}</td></tr><tr><th>وضعیت</th><td>${tx.status === "voided" ? "لغو" : "فعال"}</td></tr></table></body></html>`);
    w.document.close(); w.focus(); w.print();
  }, [transactionCustomerLabel]);

  const heading = dk ? "text-white" : "text-slate-900";
  const subText = dk ? "text-slate-500" : "text-slate-400";
  const iconMuted = dk ? "text-slate-500" : "text-slate-400";
  const glassChip = dk ? "border-slate-600/70 bg-slate-800/80" : "border-sky-100 bg-white/85";
  const uiCard = `rounded-2xl border backdrop-blur ${dk ? "border-slate-700 bg-slate-800/90" : "border-sky-100 bg-white/95"}`;
  const inputShell = `rounded-xl border text-sm font-medium shadow-sm outline-none transition-all duration-200 focus:ring-4 ${dk ? "border-slate-600 bg-slate-900 text-slate-100 placeholder:text-slate-500 hover:border-slate-500 focus:border-cyan-400 focus:ring-cyan-400/10" : "border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 hover:border-sky-400 focus:border-sky-500 focus:ring-sky-500/10"}`;
  const uiInput = `h-12 w-full px-3.5 ${inputShell}`;
  const errInput = dk ? "border-rose-500 bg-rose-500/10 ring-rose-500/20" : "border-rose-500 bg-rose-50 ring-rose-500/20";
  const roInput = dk ? "cursor-default bg-slate-800/70 text-slate-400" : "cursor-default bg-slate-100 text-slate-500";
  const uiLabel = `mb-1.5 block text-[11px] font-black ${dk ? "text-slate-400" : "text-slate-500"}`;
  const rateChip = `flex h-12 items-center whitespace-nowrap rounded-xl border px-3.5 text-sm font-bold ${dk ? "border-slate-600 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-700"}`;
  const chevPos = `pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${iconMuted}`;
  const cSky = { wrap: dk ? "border-sky-400/25 bg-sky-400/[0.07]" : "border-sky-300 bg-sky-50", icon: dk ? "bg-sky-400/15 text-sky-300" : "bg-sky-100 text-sky-600", title: dk ? "text-sky-300" : "text-sky-700", badge: dk ? "bg-sky-400/15 text-sky-300" : "bg-sky-100 text-sky-700" };
  const cEmerald = { wrap: dk ? "border-emerald-400/25 bg-emerald-400/[0.07]" : "border-emerald-300 bg-emerald-50", icon: dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-600", title: dk ? "text-emerald-300" : "text-emerald-700", badge: dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-700" };
  const cOrange = { wrap: dk ? "border-orange-400/25 bg-orange-400/[0.07]" : "border-orange-300 bg-orange-50", icon: dk ? "bg-orange-400/15 text-orange-300" : "bg-orange-100 text-orange-600", title: dk ? "text-orange-300" : "text-orange-700", badge: dk ? "bg-orange-400/15 text-orange-300" : "bg-orange-100 text-orange-700" };
  const cAmber = { wrap: dk ? "border-amber-400/25 bg-amber-400/[0.07]" : "border-amber-300 bg-amber-50", icon: dk ? "bg-amber-400/15 text-amber-300" : "bg-amber-100 text-amber-600", title: dk ? "text-amber-300" : "text-amber-700", badge: dk ? "bg-amber-400/15 text-amber-300" : "bg-amber-100 text-amber-700" };
  const cTeal = { wrap: dk ? "border-teal-400/25 bg-teal-400/[0.07]" : "border-teal-300 bg-teal-50", icon: dk ? "bg-teal-400/15 text-teal-300" : "bg-teal-100 text-teal-600", title: dk ? "text-teal-300" : "text-teal-700", badge: dk ? "bg-teal-400/15 text-teal-300" : "bg-teal-100 text-teal-700" };
  const cViolet = { wrap: dk ? "border-violet-400/25 bg-violet-400/[0.07]" : "border-violet-300 bg-violet-50", icon: dk ? "bg-violet-400/15 text-violet-300" : "bg-violet-100 text-violet-600", title: dk ? "text-violet-300" : "text-violet-700", badge: dk ? "bg-violet-400/15 text-violet-300" : "bg-violet-100 text-violet-700" };
  const identExIcon = dk ? "from-cyan-400/20 to-cyan-400/5 text-cyan-300 ring-cyan-400/25" : "from-sky-400/20 to-cyan-400/10 text-sky-600 ring-sky-400/30";
  const identExChip = dk ? "bg-cyan-400/10 text-cyan-300 ring-cyan-400/25" : "bg-sky-100 text-sky-700 ring-sky-300/60";
  const identTrIcon = dk ? "from-orange-400/20 to-orange-400/5 text-orange-300 ring-orange-400/25" : "from-orange-400/20 to-amber-400/10 text-orange-600 ring-orange-400/30";
  const identTrChip = dk ? "bg-orange-400/10 text-orange-300 ring-orange-400/25" : "bg-orange-100 text-orange-700 ring-orange-300/60";
  const identCvIcon = dk ? "from-violet-400/20 to-violet-400/5 text-violet-300 ring-violet-400/25" : "from-violet-400/20 to-purple-400/10 text-violet-600 ring-violet-400/30";
  const identCvChip = dk ? "bg-violet-400/10 text-violet-300 ring-violet-400/25" : "bg-violet-100 text-violet-700 ring-violet-300/60";

  const typeChipClass = useCallback((tx: Transaction) => {
    if (tx.type === "transfer") return dk ? "bg-orange-400/15 text-orange-300" : "bg-orange-100 text-orange-700";
    if (tx.type === "convert") return dk ? "bg-violet-400/15 text-violet-300" : "bg-violet-100 text-violet-700";
    if (tx.dealType === "buy") return dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-700";
    if (tx.dealType === "sell") return dk ? "bg-amber-400/15 text-amber-300" : "bg-amber-100 text-amber-700";
    return dk ? "bg-slate-400/10 text-slate-300" : "bg-slate-100 text-slate-600";
  }, [dk]);

  const fld = (l: string, n: ReactNode) => (<div><label className={uiLabel}>{l}</label>{n}</div>);
  const sel = (v: string, onCh: (v: string) => void, opts: string[][], cls = "") => (
    <div className="relative">
      <select value={v} onChange={e => onCh(e.target.value)} className={`${uiInput} cursor-pointer appearance-none pl-9 ${cls}`}>
        {opts.map(o => <option key={o[0]} value={o[0]}>{o[1]}</option>)}
      </select>
      <span className={chevPos}><Ic n="chevron" className="h-4 w-4" /></span>
    </div>
  );
  const dateField = (v: string) => (
    <div className="relative">
      <input readOnly dir="ltr" value={v} className={`${uiInput} ${roInput} pl-10 text-left tabular-nums`} />
      <span className={chevPos}><Ic n="clock" className="h-4 w-4" /></span>
    </div>
  );
  const rateInput = (val: string, onCh: (s: string) => void, err: boolean, w: string) => (
    <input type="text" inputMode="decimal" dir="ltr" value={val} onChange={e => onCh(toNumericText(e.target.value))} placeholder="0" className={`h-12 ${w} px-3 text-left text-sm font-bold tabular-nums ${inputShell} ${err ? errInput : ""}`} />
  );
  const moneyField = (val: string, onCh: (s: string) => void, err: boolean, suffix: string, suffixCls: string) => (
    <div className="relative">
      <input type="text" inputMode="decimal" dir="ltr" value={val} onChange={e => onCh(toNumericText(e.target.value))} placeholder="0" className={`${uiInput} pl-24 text-left tabular-nums ${err ? errInput : ""}`} />
      <span className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[10px] font-black ${suffixCls}`}>{suffix}</span>
    </div>
  );
  const panel = (c: { wrap: string; icon: string; title: string }, icon: IconName, title: string, ch: ReactNode) => (
    <div className={`space-y-4 rounded-2xl border p-4 ${c.wrap}`}>
      <div className="flex items-center gap-2.5">
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${c.icon}`}><Ic n={icon} className="h-4 w-4" /></span>
        <b className={`text-sm font-black ${c.title}`}>{title}</b>
      </div>
      {ch}
    </div>
  );
  const rateBox = (c: { wrap: string; icon: string; title: string }, title: string, form: ReactNode, badges: ReactNode) => (
    <div className={`space-y-4 rounded-2xl border p-4 md:p-5 ${c.wrap}`}>
      <div className="flex items-center gap-2.5">
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${c.icon}`}><Ic n="rate" className="h-4 w-4" /></span>
        <b className={`text-sm font-black ${c.title}`}>{title}</b>
      </div>
      {form}
      <div className="flex flex-wrap items-center gap-2.5">{badges}</div>
    </div>
  );
  const pill = (cls: string, txt: string, check = false) => !txt ? null : (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${cls}`}>
      {check && <Ic n="check" className="h-3.5 w-3.5" />}
      {txt}
    </span>
  );
  const midBadge = (icon: IconName, cls: string) => (
    <div className="hidden flex-col items-center justify-center lg:flex">
      <span className={`grid h-12 w-12 place-items-center rounded-full border shadow-md ${cls}`}><Ic n={icon} className="h-5 w-5" /></span>
    </div>
  );
  const secHead = (ic: string, icon: IconName, t: string, s: string, cc: string, ct: string) => (
    <div className="flex flex-wrap items-center gap-3">
      <span className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ring-1 ${ic}`}><Ic n={icon} className="h-5 w-5" /></span>
      <div className="flex-1 min-w-0">
        <h2 className={`fx-display text-xl md:text-2xl ${heading}`}>{t}</h2>
        <p className={`mt-1 text-[11px] font-bold ${subText}`}>{s}</p>
      </div>
      <span className={`rounded-full px-3 py-1.5 text-[10px] font-black ring-1 ${cc}`}>{ct}</span>
    </div>
  );
  const editBanner = (txt: ReactNode, cancel: () => void) => (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-bold ${dk ? "border-amber-400/30 bg-amber-400/10 text-amber-300" : "border-amber-300 bg-amber-100/70 text-amber-800"}`}>
      <span className="flex items-center gap-2"><Ic n="pencil" className="h-4 w-4 shrink-0" />{txt}</span>
      <button onClick={cancel} className="cursor-pointer rounded-lg bg-amber-400/30 px-3.5 py-1.5 text-xs font-black">انصراف</button>
    </div>
  );
  const sameBox = (txt: string) => (
    <div className={`flex items-start gap-3 rounded-2xl border p-4 text-sm font-bold ${dk ? "border-slate-600 bg-slate-700/40 text-slate-300" : "border-slate-200 bg-slate-100 text-slate-600"}`}>
      <Ic n="info" className="h-5 w-5 shrink-0 opacity-70 mt-0.5" />
      <span className="leading-6">{txt}</span>
    </div>
  );
  const errBox = (list: string[]) => list.length === 0 ? null : (
    <div className={`space-y-2 rounded-xl border p-4 ${dk ? "border-rose-500/50 bg-rose-500/10 text-rose-300" : "border-rose-500 bg-rose-50 text-rose-600"}`}>
      <b className="flex items-center gap-2 text-sm"><Ic n="alert" className="h-5 w-5 shrink-0" />لطفاً فیلدهای اجباری را تکمیل کنید:</b>
      <ul className="list-disc pr-5 text-sm space-y-1">{list.map((m, i) => <li key={i}>{m}</li>)}</ul>
    </div>
  );
  const commissionFields = (pv: CommissionPayer, op: (v: CommissionPayer) => void, cv: Currency, oc: (v: Currency) => void, sp = true) => (
    <div className="grid gap-3 md:gap-4 sm:grid-cols-2">
      {sp && fld("کارمزد از حساب", (
        <div className={`flex rounded-xl border p-1 ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-slate-50"}`}>
          <button type="button" onClick={() => op("sender")} className={`flex-1 rounded-lg px-3 py-2 text-xs font-black ${pv === "sender" ? dk ? "bg-cyan-400 text-slate-950" : "bg-sky-500 text-white" : dk ? "text-slate-400" : "text-slate-500"}`}>فرستنده</button>
          <button type="button" onClick={() => op("receiver")} className={`flex-1 rounded-lg px-3 py-2 text-xs font-black ${pv === "receiver" ? dk ? "bg-cyan-400 text-slate-950" : "bg-sky-500 text-white" : dk ? "text-slate-400" : "text-slate-500"}`}>گیرنده</button>
        </div>
      ))}
      {fld("ارز کارمزد", (
        <div className="relative">
          <select value={cv} onChange={e => oc(e.target.value as Currency)} className={`${uiInput} cursor-pointer appearance-none pl-9`}>
            {currencies.map(c => <option key={c} value={c}>{labels[c]}</option>)}
          </select>
          <span className={chevPos}><Ic n="chevron" className="h-4 w-4" /></span>
        </div>
      ))}
    </div>
  );
  const currencySelect = (v: Currency, ch: (v: Currency) => void) => (
    <div className="relative">
      <select value={v} onChange={e => ch(e.target.value as Currency)} className={`${uiInput} cursor-pointer appearance-none pl-9`}>
        {currencies.map(c => <option key={c} value={c}>{labels[c]}</option>)}
      </select>
      <span className={chevPos}><Ic n="chevron" className="h-4 w-4" /></span>
    </div>
  );

  const getSharedCustomerBalances = useCallback((customerId: string): Record<Currency, number> => {
    const balances: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
    if (!customerId || customerId === CASH_BOX_ID || customerId === EXCHANGE_ACCOUNT_ID) return balances;
    const add = (currency: Currency, amount: number) => {
      if (!currencies.includes(currency) || !Number.isFinite(amount)) return;
      balances[currency] += amount;
    };
    for (const tx of transactions) {
      if (!tx || tx.status === "voided") continue;
      if (tx.type === "exchange" && tx.customerId === customerId) {
        add(tx.fromCurrency, -Number(tx.fromAmount || 0));
        add(tx.toCurrency, Number(tx.toAmount || 0));
        if (tx.commission && tx.commissionCurrency) add(tx.commissionCurrency, -Number(tx.commission || 0));
      }
      if (tx.type === "transfer") {
        if (tx.senderId === customerId) {
          add(tx.fromCurrency, -Number(tx.fromAmount || 0));
          if (tx.commissionPayer === "sender" && tx.commission && tx.commissionCurrency) add(tx.commissionCurrency, -Number(tx.commission || 0));
        }
        if (tx.receiverId === customerId) {
          add(tx.toCurrency, Number(tx.toAmount || 0));
          if (tx.commissionPayer === "receiver" && tx.commission && tx.commissionCurrency) add(tx.commissionCurrency, -Number(tx.commission || 0));
        }
      }
      if (tx.type === "convert" && tx.customerId === customerId) {
        add(tx.fromCurrency, -Number(tx.fromAmount || 0));
        add(tx.toCurrency, Number(tx.toAmount || 0));
        if (tx.commission && tx.commissionCurrency) add(tx.commissionCurrency, -Number(tx.commission || 0));
      }
    }
    for (const h of hawalas) {
      if (!h || h.status === "cancelled") continue;
      if (h.senderId === customerId) {
        add(h.currencyFrom, -Number(h.amountFrom || 0));
        if (h.feePayer === "sender" && h.fee > 0 && h.feeCurrency) add(h.feeCurrency, -Number(h.fee || 0));
      }
      if (h.receiverId === customerId && h.status === "paid") {
        add(h.currencyTo, Number(h.finalAmount || 0));
        if (h.feePayer === "receiver" && h.fee > 0 && h.feeCurrency) add(h.feeCurrency, -Number(h.fee || 0));
      }
    }
    for (const ce of cashEntries) {
      if (!ce || ce.status === "voided" || ce.customerId !== customerId) continue;
      if (ce.linkedExchangeId || ce.linkedTransferId || ce.linkedConvertId || ce.linkedHawalaId || ce.linkedHawalaSettleId) continue;
      const amount = Number(ce.amount || 0);
      if (!amount || !currencies.includes(ce.currency as Currency)) continue;
      if (ce.type === "customer_deposit" || ce.type === "loan_received") add(ce.currency, amount);
      else if (ce.type === "customer_withdraw" || ce.type === "loan_given") add(ce.currency, -amount);
    }
    return balances;
  }, [transactions, hawalas, cashEntries]);

  const CustomerBalanceCard = memo(({ customer, color, isCashBox }: { customer: Customer | null; color: "cyan" | "orange" | "violet"; isCashBox?: boolean }) => {
    if (!customer) return null;
    const balances = customer.id === EXCHANGE_ACCOUNT_ID ? exchangeAccountBalances : getSharedCustomerBalances(customer.id);
    const title = customer.id === EXCHANGE_ACCOUNT_ID ? "💼 موجودی حساب صرافی" : `موجودی حساب ${customer.name}`;
    const colors = {
      cyan: { border: dk ? "border-cyan-400/30 bg-cyan-400/10" : "border-cyan-200 bg-cyan-50", text: dk ? "text-cyan-300" : "text-cyan-700", icon: dk ? "text-cyan-300" : "text-cyan-600" },
      orange: { border: dk ? "border-orange-400/30 bg-orange-400/10" : "border-orange-200 bg-orange-50", text: dk ? "text-orange-300" : "text-orange-700", icon: dk ? "text-orange-300" : "text-orange-600" },
      violet: { border: dk ? "border-violet-400/30 bg-violet-400/10" : "border-violet-200 bg-violet-50", text: dk ? "text-violet-300" : "text-violet-700", icon: dk ? "text-violet-300" : "text-violet-600" }
    };
    const c = colors[color];
    return (
      <div className={`rounded-xl border p-3 ${c.border}`}>
        <div className="flex items-center gap-2 mb-2">
          <Ic n="wallet" className={`h-4 w-4 ${c.icon}`} />
          <b className={`text-xs font-black ${c.text}`}>{title}</b>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2 text-[10px] font-bold">
          {currencies.map(cur => {
            const bal = balances[cur] || 0;
            const isDebt = bal < 0;
            const isCredit = bal > 0;
            return (
              <div key={cur} className={`rounded-lg px-2 py-1.5 ${dk ? "bg-slate-900/50" : "bg-white"}`}>
                <div className={subText}>{labels[cur]}</div>
                <div className={`font-black tabular-nums ${isDebt ? "text-rose-500" : isCredit ? (dk ? "text-emerald-300" : "text-emerald-600") : dk ? "text-slate-400" : "text-slate-500"}`}>{fmt(bal)}</div>
                <div className="min-h-[12px] mt-0.5">
                  {customer.id === EXCHANGE_ACCOUNT_ID ? (
                    <>
                      {isDebt && <div className="text-[8px] font-black text-rose-500">⚠️ منفی</div>}
                      {isCredit && <div className={`text-[8px] font-black ${dk ? "text-emerald-300" : "text-emerald-600"}`}>✅ مثبت</div>}
                      {bal === 0 && <div className={`text-[8px] font-bold ${subText}`}>⚪ خالی</div>}
                    </>
                  ) : (
                    <>
                      {isDebt && <div className="text-[8px] font-black text-rose-500">قرض از صرافی</div>}
                      {isCredit && <div className={`text-[8px] font-black ${dk ? "text-emerald-300" : "text-emerald-600"}`}>طلب از صرافی</div>}
                      {bal === 0 && <div className={`text-[8px] font-bold ${subText}`}>بدون بدهی</div>}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  });

  const ActionButtons = memo(function ActionButtons({ tx }: { tx: Transaction }) {
    const isVoided = tx.status === "voided";
    const isOpen = openActionId === tx.id;
    const btn = "flex w-full items-center gap-2 px-3 py-2 text-right text-xs font-bold transition";
    const btnBase = dk ? "text-slate-200 hover:bg-slate-700/60" : "text-slate-700 hover:bg-slate-100";
    return (
      <div className="relative action-dropdown flex justify-center">
        <button onClick={(e) => { e.stopPropagation(); setOpenActionId(isOpen ? null : tx.id); }} className={`grid h-8 w-8 place-items-center rounded-lg border transition-all duration-150 active:scale-90 cursor-pointer ${dk ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-200 text-slate-500 hover:bg-slate-100"}`} title="عملیات">
          <Ic n="more" className="h-4 w-4" />
        </button>
        {isOpen && (
          <div className={`absolute left-1/2 -translate-x-1/2 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-xl border shadow-xl ${dk ? "border-slate-600 bg-slate-800" : "border-slate-200 bg-white"}`}>
            <button onClick={() => { viewTransaction(tx); setOpenActionId(null); }} className={`${btn} ${btnBase} ${dk ? "text-cyan-300 hover:bg-cyan-400/15" : "text-cyan-600 hover:bg-cyan-50"}`}>
              <Ic n="eye" className="h-3.5 w-3.5" /> مشاهده
            </button>
            {!isVoided && (
              <>
                <button onClick={() => { editTransaction(tx); setOpenActionId(null); }} className={`${btn} ${btnBase} ${dk ? "text-sky-300 hover:bg-sky-400/15" : "text-sky-600 hover:bg-sky-50"}`}>
                  <Ic n="pencil" className="h-3.5 w-3.5" /> ویرایش
                </button>
                <button onClick={() => { voidTransaction(tx); setOpenActionId(null); }} className={`${btn} ${btnBase} ${dk ? "text-amber-300 hover:bg-amber-400/15" : "text-amber-600 hover:bg-amber-50"}`}>
                  <Ic n="xCircle" className="h-3.5 w-3.5" /> لغو
                </button>
              </>
            )}
            <button onClick={() => { printReceipt(tx); setOpenActionId(null); }} className={`${btn} ${btnBase} ${dk ? "text-emerald-300 hover:bg-emerald-400/15" : "text-emerald-600 hover:bg-emerald-50"}`}>
              <Ic n="printer" className="h-3.5 w-3.5" /> چاپ رسید
            </button>
            <div className={`my-1 h-px ${dk ? "bg-slate-700" : "bg-slate-100"}`} />
            <button onClick={() => { deleteTransaction(tx); setOpenActionId(null); }} className={`${btn} ${dk ? "text-rose-300 hover:bg-rose-400/15" : "text-rose-500 hover:bg-rose-50"}`}>
              <Ic n="trash" className="h-3.5 w-3.5" /> حذف
            </button>
          </div>
        )}
      </div>
    );
  });

  const TransactionRow = memo(({ tx, index, isSearching }: { tx: Transaction; index: number; isSearching: boolean }) => {
    const ms = transactionMatchesSearch(tx);
    let rc = dk ? "hover:bg-slate-700/30" : "hover:bg-sky-50/70";
    if (isSearching) rc += ms ? dk ? " bg-amber-400/10" : " bg-amber-100" : " opacity-30";
    if (tx.status === "voided") rc += dk ? " bg-rose-400/[0.05]" : " bg-rose-50";
    const cellClass = "px-4 py-3.5 text-center";
    const dt = splitDateTime(tx.date);
    return (
      <tr className={rc}>
        <td className={cellClass}><span className={`inline-grid h-7 w-7 place-items-center rounded-lg text-[11px] font-black tabular-nums ${dk ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"}`}>{index + 1}</span></td>
        <td className={cellClass}><span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-black ${dk ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300" : "border-cyan-300 bg-cyan-50 text-cyan-700"}`} dir="ltr"><Ic n="tag" className="h-3 w-3" />{tx.trackingCode}</span></td>
        <td className={`${cellClass} text-[13px] font-bold ${dk ? "text-slate-200" : "text-slate-700"}`}>{transactionCustomerLabel(tx)}</td>
        <td className={cellClass}><div className="flex flex-col items-center gap-0.5"><span dir="ltr" className={`text-xs font-bold tabular-nums ${dk ? "text-slate-200" : "text-slate-700"}`}>{dt.datePart}</span><span dir="ltr" className={`text-[10px] tabular-nums ${subText}`}>{dt.timePart}</span></div></td>
        <td className={cellClass}><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${typeChipClass(tx)}`}>{transactionTypeLabel(tx)}</span></td>
        <td className={cellClass}><div className="text-[13px] font-black tabular-nums">{fmt(tx.fromAmount)}</div><div className={`text-[10px] ${subText}`}>{labels[tx.fromCurrency]}</div></td>
        <td className={cellClass}><div className="text-[13px] font-black tabular-nums">{fmt(tx.toAmount)}</div><div className={`text-[10px] ${subText}`}>{labels[tx.toCurrency]}</div></td>
        <td className={`${cellClass} text-[11px] ${dk ? "text-slate-400" : "text-slate-500"}`}>{tx.rateLabel}</td>
        <td className={`${cellClass} text-xs font-bold tabular-nums`}>{transactionCommissionLabel(tx)}</td>
        <td className={`${cellClass} text-xs ${dk ? "text-slate-300" : "text-slate-600"}`}>{commissionPayerLabel(tx)}</td>
        <td className={cellClass}><ActionButtons tx={tx} /></td>
      </tr>
    );
  });

  const tableMaxHeight = "max-h-[672px]";

  return (
    <div dir="rtl" className={dk ? "dark" : ""}>
      <style>{`@import url("https://fonts.googleapis.com/css2?family=Lalezar&family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap");.fx-font{font-family:"Vazirmatn","Segoe UI",Tahoma,sans-serif}.fx-display{font-family:"Lalezar","Vazirmatn",Tahoma,sans-serif}.dark{color-scheme:dark}`}</style>
      <div className={`fx-font relative min-h-screen ${dk ? "bg-[#0f172a] text-slate-100" : "bg-[#eef6fa] text-slate-800"}`}>
        <div className={`fixed inset-x-0 top-0 z-30 h-1 bg-gradient-to-l ${dk ? "from-cyan-400 via-sky-400 to-emerald-400" : "from-sky-500 via-cyan-400 to-emerald-400"}`} />
        <div className="relative z-10 mx-auto w-full max-w-7xl space-y-4 md:space-y-6 px-3 pb-16 pt-5 md:px-8 md:pt-9">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative grid h-11 w-11 md:h-14 md:w-14 place-items-center rounded-xl md:rounded-2xl bg-gradient-to-br from-sky-500 via-cyan-500 to-emerald-400 text-white shadow-lg">
                <Ic n="swap" className="h-5 w-5 md:h-6 md:w-6" />
                <span className={`absolute -bottom-1 -left-1 md:-bottom-1.5 md:-left-1.5 grid h-4 min-w-4 md:h-5 md:min-w-5 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-400 px-1 text-[7px] md:text-[8px] font-black text-white ring-2 ${dk ? "ring-[#0f172a]" : "ring-[#eef6fa]"}`}>TR</span>
              </div>
              <div className="min-w-0">
                <h1 className={`fx-display text-2xl md:text-4xl ${heading}`}>معاملات ارزی</h1>
                <p className={`mt-1 text-[10px] md:text-xs font-bold ${subText}`}>سامانهٔ تبادل صرافی</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`hidden sm:flex items-center gap-2 rounded-xl border px-3 py-2 ${glassChip}`}><span dir="ltr" className={`text-xs font-bold tabular-nums ${dk ? "text-slate-100" : "text-slate-700"}`}>{currentDateTime || "--"}</span></div>
              <button onClick={() => setTheme(dk ? "light" : "dark")} className={`grid h-10 w-10 cursor-pointer place-items-center rounded-lg border ${dk ? "border-slate-600 bg-slate-800/85 text-amber-300" : "border-slate-200 bg-white/85 text-slate-600"}`}>{dk ? <Ic n="sun" className="h-4 w-4" /> : <Ic n="moon" className="h-4 w-4" />}</button>
            </div>
          </header>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-black">
            <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${glassChip} ${dk ? "text-slate-300" : "text-slate-600"}`}>کل <b className={dk ? "text-cyan-300" : "text-sky-600"}>{transactions.length}</b></span>
            <span className={`rounded-full px-3 py-1.5 ring-1 ${dk ? "bg-emerald-400/15 text-emerald-300 ring-emerald-400/25" : "bg-emerald-400/15 text-emerald-700 ring-emerald-400/40"}`}>فعال {activeCount}</span>
            <span className={`rounded-full px-3 py-1.5 ring-1 ${dk ? "bg-rose-400/15 text-rose-300 ring-rose-400/25" : "bg-rose-400/15 text-rose-600 ring-rose-400/40"}`}>لغو {voidedCount}</span>
          </div>
          <div className={`flex gap-1.5 rounded-xl border p-1.5 ${glassChip}`}>
            <button onClick={() => setTab("exchange")} className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-black ${tab === "exchange" ? dk ? "bg-cyan-400 text-slate-950" : "bg-sky-500 text-white" : dk ? "text-slate-400" : "text-slate-500"}`}><Ic n="swap" className="h-4 w-4" />تبادل ارز</button>
            <button onClick={() => setTab("transfer")} className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-black ${tab === "transfer" ? dk ? "bg-orange-400 text-slate-950" : "bg-orange-500 text-white" : dk ? "text-slate-400" : "text-slate-500"}`}><Ic n="users" className="h-4 w-4" />بین مشتریان</button>
            <button onClick={() => setTab("convert")} className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-black ${tab === "convert" ? dk ? "bg-violet-400 text-slate-950" : "bg-violet-500 text-white" : dk ? "text-slate-400" : "text-slate-500"}`}><Ic n="user" className="h-4 w-4" />تبدیل ارز</button>
          </div>

          {tab === "exchange" && (
            <section className={`space-y-4 p-4 md:p-7 ${uiCard}`}>
              {secHead(identExIcon, "swap", "تبادل ارز", "دریافت و پرداخت ارز", identExChip, editingExchangeId ? `ویرایش ${shortId(editingExchangeId)}` : "جدید")}
              {editingExchangeId && editBanner(<>ویرایش {shortId(editingExchangeId)}</>, resetExchangeForm)}
              <CustomerBalanceCard customer={selectedCustomer} color="cyan" isCashBox={isCustomerExchangeAccount} />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {fld("تاریخ", dateField(exchangeDateDisplay))}
                {fld("نوع معامله *", sel(exchangeDealType, v => { setExchangeDealType(v as DealType | ""); setExchangeErrors(p => ({ ...p, dealType: undefined })); }, [["", "انتخاب"], ["buy", "خرید"], ["sell", "فروش"]], exchangeErrors.dealType ? errInput : ""))}
                {fld("کد پیگیری", (
                  <div className="relative">
                    <input readOnly dir="ltr" value={editingExchangeId ? (editingExchangeTransaction?.trackingCode || "-") : nextTrackingCode} className={`${uiInput} ${roInput} pl-14 text-left tabular-nums font-black`} />
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 rounded-lg bg-gradient-to-r from-sky-500 to-cyan-500 px-2 py-1 text-[9px] font-black text-white">TR</span>
                  </div>
                ))}
                {fld("مشتری *", (
                  <div className="relative" ref={customerListRef}>
                    <input value={customer} onChange={e => {
                      const val = e.target.value; setCustomer(val); setCustomerFilter(val);
                      if (!showCustomerList) setShowCustomerList(true);
                      if (val === EXCHANGE_ACCOUNT_NAME) { setCustomerPhone(""); setCustomerTelegram(""); }
                      else {
                        const c = customers.find(x => x.name === val);
                        if (c) { setCustomerPhone(c.phone || ""); setCustomerTelegram(c.telegram || ""); }
                        else { setCustomerPhone(""); setCustomerTelegram(""); }
                      }
                      setExchangeErrors(p => ({ ...p, customer: undefined }));
                    }} placeholder="انتخاب از لیست یا نوشتن نام جدید…" className={`${uiInput} pl-12 ${exchangeErrors.customer ? errInput : ""}`} autoComplete="off" />
                    <button type="button" onClick={(e) => { e.stopPropagation(); setShowCustomerList(!showCustomerList); }} className={`absolute left-2 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-lg transition ${dk ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}>
                      <Ic n="chevron" className={`h-4 w-4 transition-transform ${showCustomerList ? "rotate-180" : ""}`} />
                    </button>
                    {showCustomerList && (
                      <div className={`hw-menu absolute left-0 top-full z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border shadow-xl ${dk ? "border-slate-600 bg-slate-800" : "border-slate-200 bg-white"}`}>
                        {filteredCustomerList.length === 0 ? (
                          <div className={`px-4 py-3 text-xs text-center ${subText}`}>مشتری‌ای یافت نشد</div>
                        ) : (
                          filteredCustomerList.map((c, idx) => (
                            <button key={c.id} type="button" onClick={() => {
                              setCustomer(c.name); setCustomerPhone(c.phone || ""); setCustomerTelegram(c.telegram || "");
                              setCustomerFilter(""); setShowCustomerList(false); setExchangeErrors(p => ({ ...p, customer: undefined }));
                            }} className={`flex w-full items-center gap-2 px-3 py-2.5 text-right text-xs font-bold transition ${dk ? "text-slate-200 hover:bg-cyan-400/15 hover:text-cyan-300" : "text-slate-700 hover:bg-cyan-50 hover:text-cyan-600"}`}>
                              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-black text-white bg-gradient-to-br from-cyan-500 to-sky-500`}>{idx + 1}</span>
                              <span className="flex-1 truncate">{c.name}{c.id === EXCHANGE_ACCOUNT_ID && " 💼"}</span>
                              {c.phone && <span className={`text-[10px] ${subText}`} dir="ltr">{c.phone}</span>}
                            </button>
                          ))
                        )}
                        <div className={`h-px ${dk ? "bg-slate-700" : "bg-slate-100"}`} />
                        <div className={`px-3 py-2 text-[10px] text-center ${subText}`}>نام جدید در لیست ذخیره نمی‌شود</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr]">
                {panel(cEmerald, "down", "دریافت", (
                  <>
                    {fld("ارز", currencySelect(receivedCurrency, v => { setReceivedCurrency(v); setExchangeErrors(p => ({ ...p, rate: undefined, paidAmount: undefined })); }))}
                    {fld("مبلغ *", (
                      <input type="text" inputMode="decimal" dir="ltr" value={receivedAmount} onChange={e => {
                        setReceivedAmount(toNumericText(e.target.value)); setExchangeErrors(p => ({ ...p, receivedAmount: undefined, paidAmount: undefined }));
                      }} placeholder="0" className={`${uiInput} text-left tabular-nums ${exchangeErrors.receivedAmount ? errInput : ""}`} />
                    ))}
                  </>
                ))}
                {midBadge("swap", dk ? "border-slate-600 bg-slate-900 text-cyan-300" : "border-slate-200 bg-white text-sky-600")}
                {panel(cSky, "up", "پرداخت", (
                  <>
                    {fld("ارز", currencySelect(paidCurrency, v => { setPaidCurrency(v); setExchangeErrors(p => ({ ...p, rate: undefined, paidAmount: undefined })); }))}
                    {fld("مبلغ", (
                      <input readOnly dir="ltr" value={paidAmount} className={`${uiInput} ${roInput} text-left tabular-nums`} />
                    ))}
                  </>
                ))}
              </div>
              {exchangeMode === "same" && sameBox("ارز یکسان است.")}
              {exchangeMode === "afn" && exchangeForeign && rateBox(cSky, "نرخ", (
                <div>
                  <label className={uiLabel}>نرخ</label>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className={rateChip}>{fmt(rateUnits[exchangeForeign])} {labels[exchangeForeign]} =</span>
                    {rateInput(rate, s => { setRate(s); setExchangeErrors(p => ({ ...p, rate: undefined, paidAmount: undefined })); }, !!exchangeErrors.rate, "w-32 md:w-44")}
                    <span className={rateChip}>{labels.AFN}</span>
                  </div>
                </div>
              ), (
                <>
                  {pill(cSky.badge, exchangeRateValue > 0 ? afnRateLabel(exchangeForeign, exchangeRateValue) : "", true)}
                  {pill(cEmerald.badge, paidAmount ? `${paidAmount} ${labels[paidCurrency]}` : "")}
                </>
              ))}
              {exchangeMode === "direct" && rateBox(cAmber, "نرخ مستقیم", (
                <div className="grid items-end gap-3 md:grid-cols-2">
                  {fld("مبنا", sel(exchangeDirectBaseValue, v => { setExchangeDirectBase(v as Currency); }, [[receivedCurrency, labels[receivedCurrency]], [paidCurrency, labels[paidCurrency]]]))}
                  <div>
                    <label className={uiLabel}>نرخ</label>
                    <div className="flex items-center gap-2">
                      <span className={rateChip}>{fmt(rateUnits[exchangeDirectBaseValue])} {labels[exchangeDirectBaseValue]} =</span>
                      {rateInput(rate, s => { setRate(s); setExchangeErrors(p => ({ ...p, rate: undefined })); }, !!exchangeErrors.rate, "w-28")}
                      <span className={rateChip}>{exchangeDirectCounter ? labels[exchangeDirectCounter] : ""}</span>
                    </div>
                  </div>
                </div>
              ), (
                <>
                  {pill(cAmber.badge, exchangeRateValue > 0 && exchangeDirectCounter ? directRateLabel(exchangeDirectBaseValue, exchangeDirectCounter, exchangeRateValue) : "", true)}
                  {pill(cEmerald.badge, paidAmount ? `${paidAmount} ${labels[paidCurrency]}` : "")}
                </>
              ))}
              <div className="grid gap-3 md:grid-cols-2">
                {fld("کارمزد *", moneyField(exchangeCommission, s => { setExchangeCommission(s); setExchangeErrors(p => ({ ...p, exchangeCommission: undefined })); }, !!exchangeErrors.exchangeCommission, labels[exchangeCommissionCurrency], dk ? "bg-cyan-400/15 text-cyan-300" : "bg-sky-100 text-sky-700"))}
                {fld("توضیحات", (
                  <input value={exchangeDescription} onChange={e => setExchangeDescription(e.target.value)} placeholder="اختیاری" className={uiInput} />
                ))}
              </div>
              {commissionFields(exchangeCommissionPayer, setExchangeCommissionPayer, exchangeCommissionCurrency, setExchangeCommissionCurrency)}
              {errBox(exchangeErrorList)}
              <button onClick={submitExchange} className={`flex h-[50px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-l text-base font-black shadow-lg ${dk ? "from-cyan-400 to-emerald-400 text-slate-950" : "from-sky-500 to-emerald-400 text-white"}`}>
                {editingExchangeId ? "به‌روزرسانی" : "ثبت"}
                <Ic n="arrowLeft" className="h-5 w-5" />
              </button>
            </section>
          )}

          {tab === "transfer" && (
            <section className={`space-y-4 p-4 md:p-7 ${uiCard}`}>
              {secHead(identTrIcon, "users", "بین مشتریان", "انتقال بین حساب‌ها", identTrChip, editingTransferId ? `ویرایش ${shortId(editingTransferId)}` : "جدید")}
              {editingTransferId && editBanner(<>ویرایش {shortId(editingTransferId)}</>, resetTransferForm)}
              <div className="grid gap-3 md:grid-cols-2">
                <CustomerBalanceCard customer={selectedSender} color="orange" isCashBox={isSenderExchangeAccount} />
                <CustomerBalanceCard customer={selectedReceiver} color="cyan" isCashBox={isReceiverExchangeAccount} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {fld("تاریخ", dateField(transferDateDisplay))}
                {fld("کد", (
                  <div className="relative">
                    <input readOnly dir="ltr" value={editingTransferId ? (editingTransferTransaction?.trackingCode || "-") : nextTrackingCode} className={`${uiInput} ${roInput} pl-14 text-left tabular-nums font-black`} />
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-2 py-1 text-[9px] font-black text-white">TR</span>
                  </div>
                ))}
                {fld("جستجو", (
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو…" className={uiInput} />
                ))}
                <div></div>
              </div>
              <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr]">
                {panel(cOrange, "up", "فرستنده", (
                  <>
                    {fld("مشتری *", (
                      <div className="relative" ref={senderListRef}>
                        <input value={sender} onChange={e => {
                          const val = e.target.value; setSender(val); setSenderFilter(val);
                          if (!showSenderList) setShowSenderList(true);
                          if (val === EXCHANGE_ACCOUNT_NAME) { setSenderPhone(""); setSenderTelegram(""); }
                          else {
                            const c = customers.find(x => x.name === val);
                            if (c) { setSenderPhone(c.phone || ""); setSenderTelegram(c.telegram || ""); }
                            else { setSenderPhone(""); setSenderTelegram(""); }
                          }
                          setTransferErrors(p => ({ ...p, sender: undefined }));
                        }} placeholder="انتخاب از لیست یا نوشتن نام جدید…" className={`${uiInput} pl-12 ${transferErrors.sender ? errInput : ""}`} autoComplete="off" />
                        <button type="button" onClick={(e) => { e.stopPropagation(); setShowSenderList(!showSenderList); }} className={`absolute left-2 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-lg transition ${dk ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}>
                          <Ic n="chevron" className={`h-4 w-4 transition-transform ${showSenderList ? "rotate-180" : ""}`} />
                        </button>
                        {showSenderList && (
                          <div className={`hw-menu absolute left-0 top-full z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border shadow-xl ${dk ? "border-slate-600 bg-slate-800" : "border-slate-200 bg-white"}`}>
                            {filteredSenderList.length === 0 ? (
                              <div className={`px-4 py-3 text-xs text-center ${subText}`}>مشتری‌ای یافت نشد</div>
                            ) : (
                              filteredSenderList.map((c, idx) => (
                                <button key={c.id} type="button" onClick={() => {
                                  setSender(c.name); setSenderPhone(c.phone || ""); setSenderTelegram(c.telegram || "");
                                  setSenderFilter(""); setShowSenderList(false); setTransferErrors(p => ({ ...p, sender: undefined }));
                                }} className={`flex w-full items-center gap-2 px-3 py-2.5 text-right text-xs font-bold transition ${dk ? "text-slate-200 hover:bg-orange-400/15 hover:text-orange-300" : "text-slate-700 hover:bg-orange-50 hover:text-orange-600"}`}>
                                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-black text-white bg-gradient-to-br from-orange-500 to-amber-500`}>{idx + 1}</span>
                                  <span className="flex-1 truncate">{c.name}{c.id === EXCHANGE_ACCOUNT_ID && " 💼"}</span>
                                  {c.phone && <span className={`text-[10px] ${subText}`} dir="ltr">{c.phone}</span>}
                                </button>
                              ))
                            )}
                            <div className={`h-px ${dk ? "bg-slate-700" : "bg-slate-100"}`} />
                            <div className={`px-3 py-2 text-[10px] text-center ${subText}`}>نام جدید در لیست ذخیره نمی‌شود</div>
                          </div>
                        )}
                      </div>
                    ))}
                    {fld("ارز", currencySelect(senderCurrency, v => { setSenderCurrency(v); setTransferErrors(p => ({ ...p, transferRate: undefined, receiverAmount: undefined })); }))}
                    {fld("مبلغ *", (
                      <input type="text" inputMode="decimal" dir="ltr" value={senderAmount} onChange={e => {
                        setSenderAmount(toNumericText(e.target.value)); setTransferErrors(p => ({ ...p, senderAmount: undefined, receiverAmount: undefined }));
                      }} placeholder="0" className={`${uiInput} text-left tabular-nums ${transferErrors.senderAmount ? errInput : ""}`} />
                    ))}
                  </>
                ))}
                {midBadge("arrowLeft", dk ? "border-slate-600 bg-slate-900 text-orange-300" : "border-slate-200 bg-white text-orange-500")}
                {panel(cEmerald, "down", "گیرنده", (
                  <>
                    {fld("مشتری *", (
                      <div className="relative" ref={receiverListRef}>
                        <input value={receiver} onChange={e => {
                          const val = e.target.value; setReceiver(val); setReceiverFilter(val);
                          if (!showReceiverList) setShowReceiverList(true);
                          if (val === EXCHANGE_ACCOUNT_NAME) { setReceiverPhone(""); setReceiverTelegram(""); }
                          else {
                            const c = customers.find(x => x.name === val);
                            if (c) { setReceiverPhone(c.phone || ""); setReceiverTelegram(c.telegram || ""); }
                            else { setReceiverPhone(""); setReceiverTelegram(""); }
                          }
                          setTransferErrors(p => ({ ...p, receiver: undefined }));
                        }} placeholder="انتخاب از لیست یا نوشتن نام جدید…" className={`${uiInput} pl-12 ${transferErrors.receiver ? errInput : ""}`} autoComplete="off" />
                        <button type="button" onClick={(e) => { e.stopPropagation(); setShowReceiverList(!showReceiverList); }} className={`absolute left-2 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-lg transition ${dk ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}>
                          <Ic n="chevron" className={`h-4 w-4 transition-transform ${showReceiverList ? "rotate-180" : ""}`} />
                        </button>
                        {showReceiverList && (
                          <div className={`hw-menu absolute left-0 top-full z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border shadow-xl ${dk ? "border-slate-600 bg-slate-800" : "border-slate-200 bg-white"}`}>
                            {filteredReceiverList.length === 0 ? (
                              <div className={`px-4 py-3 text-xs text-center ${subText}`}>مشتری‌ای یافت نشد</div>
                            ) : (
                              filteredReceiverList.map((c, idx) => (
                                <button key={c.id} type="button" onClick={() => {
                                  setReceiver(c.name); setReceiverPhone(c.phone || ""); setReceiverTelegram(c.telegram || "");
                                  setReceiverFilter(""); setShowReceiverList(false); setTransferErrors(p => ({ ...p, receiver: undefined }));
                                }} className={`flex w-full items-center gap-2 px-3 py-2.5 text-right text-xs font-bold transition ${dk ? "text-slate-200 hover:bg-emerald-400/15 hover:text-emerald-300" : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-600"}`}>
                                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-black text-white bg-gradient-to-br from-emerald-500 to-teal-500`}>{idx + 1}</span>
                                  <span className="flex-1 truncate">{c.name}{c.id === EXCHANGE_ACCOUNT_ID && " 💼"}</span>
                                  {c.phone && <span className={`text-[10px] ${subText}`} dir="ltr">{c.phone}</span>}
                                </button>
                              ))
                            )}
                            <div className={`h-px ${dk ? "bg-slate-700" : "bg-slate-100"}`} />
                            <div className={`px-3 py-2 text-[10px] text-center ${subText}`}>نام جدید در لیست ذخیره نمی‌شود</div>
                          </div>
                        )}
                      </div>
                    ))}
                    {fld("ارز", currencySelect(receiverCurrency, v => { setReceiverCurrency(v); setTransferErrors(p => ({ ...p, transferRate: undefined, receiverAmount: undefined })); }))}
                    {fld("مبلغ", (
                      <input readOnly dir="ltr" value={receiverAmount} className={`${uiInput} ${roInput} text-left tabular-nums`} />
                    ))}
                  </>
                ))}
              </div>
              {transferMode === "same" && sameBox("ارز یکسان است.")}
              {transferMode === "afn" && transferForeign && rateBox(cTeal, "نرخ", (
                <div>
                  <label className={uiLabel}>نرخ</label>
                  <div className="flex items-center gap-2.5">
                    <span className={rateChip}>{fmt(rateUnits[transferForeign])} {labels[transferForeign]} =</span>
                    {rateInput(transferRate, s => { setTransferRate(s); setTransferErrors(p => ({ ...p, transferRate: undefined, receiverAmount: undefined })); }, !!transferErrors.transferRate, "w-32")}
                    <span className={rateChip}>{labels.AFN}</span>
                  </div>
                </div>
              ), (
                <>
                  {pill(cTeal.badge, transferRateValue > 0 ? afnRateLabel(transferForeign, transferRateValue) : "", true)}
                  {pill(cEmerald.badge, receiverAmount ? `${receiverAmount} ${labels[receiverCurrency]}` : "")}
                </>
              ))}
              {transferMode === "direct" && rateBox(cOrange, "نرخ مستقیم", (
                <div className="grid items-end gap-3 md:grid-cols-2">
                  {fld("مبنا", sel(transferDirectBaseValue, v => setTransferDirectBase(v as Currency), [[senderCurrency, labels[senderCurrency]], [receiverCurrency, labels[receiverCurrency]]]))}
                  <div>
                    <label className={uiLabel}>نرخ</label>
                    <div className="flex items-center gap-2">
                      <span className={rateChip}>{fmt(rateUnits[transferDirectBaseValue])} {labels[transferDirectBaseValue]} =</span>
                      {rateInput(transferRate, s => { setTransferRate(s); setTransferErrors(p => ({ ...p, transferRate: undefined })); }, !!transferErrors.transferRate, "w-28")}
                      <span className={rateChip}>{transferDirectCounter ? labels[transferDirectCounter] : ""}</span>
                    </div>
                  </div>
                </div>
              ), (
                <>
                  {pill(cOrange.badge, transferRateValue > 0 && transferDirectCounter ? directRateLabel(transferDirectBaseValue, transferDirectCounter, transferRateValue) : "", true)}
                  {pill(cEmerald.badge, receiverAmount ? `${receiverAmount} ${labels[receiverCurrency]}` : "")}
                </>
              ))}
              <div className="grid gap-3 md:grid-cols-2">
                {fld("کارمزد *", moneyField(commission, s => { setCommission(s); setTransferErrors(p => ({ ...p, commission: undefined })); }, !!transferErrors.commission, labels[transferCommissionCurrency], dk ? "bg-orange-400/15 text-orange-300" : "bg-orange-100 text-orange-700"))}
                {fld("توضیحات", (
                  <input value={transferDescription} onChange={e => setTransferDescription(e.target.value)} placeholder="اختیاری" className={uiInput} />
                ))}
              </div>
              {commissionFields(transferCommissionPayer, setTransferCommissionPayer, transferCommissionCurrency, setTransferCommissionCurrency)}
              {errBox(transferErrorList)}
              <button onClick={submitTransfer} className={`flex h-[50px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-l text-base font-black shadow-lg ${dk ? "from-orange-400 to-amber-300 text-slate-950" : "from-orange-500 to-amber-400 text-white"}`}>
                {editingTransferId ? "به‌روزرسانی" : "ثبت"}
                <Ic n="arrowLeft" className="h-5 w-5" />
              </button>
            </section>
          )}

          {tab === "convert" && (
            <section className={`space-y-4 p-4 md:p-7 ${uiCard}`}>
              {secHead(identCvIcon, "user", "تبدیل ارز", "تبدیل در حساب مشتری", identCvChip, editingConvertId ? `ویرایش ${shortId(editingConvertId)}` : "جدید")}
              {editingConvertId && editBanner(<>ویرایش {shortId(editingConvertId)}</>, resetConvertForm)}
              <CustomerBalanceCard customer={selectedConvertCustomer} color="violet" isCashBox={isConvertCustomerExchangeAccount} />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {fld("تاریخ", dateField(convertDateDisplay))}
                {fld("کد", (
                  <div className="relative">
                    <input readOnly dir="ltr" value={editingConvertId ? (editingConvertTransaction?.trackingCode || "-") : nextTrackingCode} className={`${uiInput} ${roInput} pl-14 text-left tabular-nums font-black`} />
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 px-2 py-1 text-[9px] font-black text-white">TR</span>
                  </div>
                ))}
                {fld("مشتری *", (
                  <div className="relative" ref={convertListRef}>
                    <input value={convertCustomer} onChange={e => {
                      const val = e.target.value; setConvertCustomer(val); setConvertFilter(val);
                      if (!showConvertList) setShowConvertList(true);
                      if (val === EXCHANGE_ACCOUNT_NAME) { setConvertCustomerPhone(""); setConvertCustomerTelegram(""); }
                      else {
                        const c = customers.find(x => x.name === val);
                        if (c) { setConvertCustomerPhone(c.phone || ""); setConvertCustomerTelegram(c.telegram || ""); }
                        else { setConvertCustomerPhone(""); setConvertCustomerTelegram(""); }
                      }
                      setConvertErrors(p => ({ ...p, customer: undefined }));
                    }} placeholder="انتخاب از لیست یا نوشتن نام جدید…" className={`${uiInput} pl-12 ${convertErrors.customer ? errInput : ""}`} autoComplete="off" />
                    <button type="button" onClick={(e) => { e.stopPropagation(); setShowConvertList(!showConvertList); }} className={`absolute left-2 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-lg transition ${dk ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}>
                      <Ic n="chevron" className={`h-4 w-4 transition-transform ${showConvertList ? "rotate-180" : ""}`} />
                    </button>
                    {showConvertList && (
                      <div className={`hw-menu absolute left-0 top-full z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border shadow-xl ${dk ? "border-slate-600 bg-slate-800" : "border-slate-200 bg-white"}`}>
                        {filteredConvertList.length === 0 ? (
                          <div className={`px-4 py-3 text-xs text-center ${subText}`}>مشتری‌ای یافت نشد</div>
                        ) : (
                          filteredConvertList.map((c, idx) => (
                            <button key={c.id} type="button" onClick={() => {
                              setConvertCustomer(c.name); setConvertCustomerPhone(c.phone || ""); setConvertCustomerTelegram(c.telegram || "");
                              setConvertFilter(""); setShowConvertList(false); setConvertErrors(p => ({ ...p, customer: undefined }));
                            }} className={`flex w-full items-center gap-2 px-3 py-2.5 text-right text-xs font-bold transition ${dk ? "text-slate-200 hover:bg-violet-400/15 hover:text-violet-300" : "text-slate-700 hover:bg-violet-50 hover:text-violet-600"}`}>
                              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-black text-white bg-gradient-to-br from-violet-500 to-purple-500`}>{idx + 1}</span>
                              <span className="flex-1 truncate">{c.name}{c.id === EXCHANGE_ACCOUNT_ID && " 💼"}</span>
                              {c.phone && <span className={`text-[10px] ${subText}`} dir="ltr">{c.phone}</span>}
                            </button>
                          ))
                        )}
                        <div className={`h-px ${dk ? "bg-slate-700" : "bg-slate-100"}`} />
                        <div className={`px-3 py-2 text-[10px] text-center ${subText}`}>نام جدید در لیست ذخیره نمی‌شود</div>
                      </div>
                    )}
                  </div>
                ))}
                <div></div>
              </div>
              <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr]">
                {panel(cViolet, "down", "از حساب", (
                  <>
                    {fld("ارز", currencySelect(convertFromCurrency, v => { setConvertFromCurrency(v); setConvertErrors(p => ({ ...p, rate: undefined, convertedAmount: undefined })); }))}
                    {fld("مبلغ *", (
                      <input type="text" inputMode="decimal" dir="ltr" value={convertAmount} onChange={e => {
                        setConvertAmount(toNumericText(e.target.value)); setConvertErrors(p => ({ ...p, amount: undefined, convertedAmount: undefined }));
                      }} placeholder="0" className={`${uiInput} text-left tabular-nums ${convertErrors.amount ? errInput : ""}`} />
                    ))}
                  </>
                ))}
                {midBadge("swap", dk ? "border-slate-600 bg-slate-900 text-violet-300" : "border-slate-200 bg-white text-violet-600")}
                {panel(cEmerald, "up", "به حساب", (
                  <>
                    {fld("ارز", currencySelect(convertToCurrency, v => { setConvertToCurrency(v); setConvertErrors(p => ({ ...p, rate: undefined, convertedAmount: undefined })); }))}
                    {fld("مبلغ", (
                      <input readOnly dir="ltr" value={convertedAmount} className={`${uiInput} ${roInput} text-left tabular-nums`} />
                    ))}
                  </>
                ))}
              </div>
              {convertMode === "same" && sameBox("ارز یکسان است.")}
              {convertMode === "afn" && convertForeign && rateBox(cSky, "نرخ", (
                <div>
                  <label className={uiLabel}>نرخ</label>
                  <div className="flex items-center gap-2.5">
                    <span className={rateChip}>{fmt(rateUnits[convertForeign])} {labels[convertForeign]} =</span>
                    {rateInput(convertRate, s => { setConvertRate(s); setConvertErrors(p => ({ ...p, rate: undefined, convertedAmount: undefined })); }, !!convertErrors.rate, "w-32")}
                    <span className={rateChip}>{labels.AFN}</span>
                  </div>
                </div>
              ), (
                <>
                  {pill(cSky.badge, convertRateValue > 0 ? afnRateLabel(convertForeign, convertRateValue) : "", true)}
                  {pill(cEmerald.badge, convertedAmount ? `${convertedAmount} ${labels[convertToCurrency]}` : "")}
                </>
              ))}
              {convertMode === "direct" && rateBox(cAmber, "نرخ مستقیم", (
                <div className="grid items-end gap-3 md:grid-cols-2">
                  {fld("مبنا", sel(convertDirectBaseValue, v => setConvertDirectBase(v as Currency), [[convertFromCurrency, labels[convertFromCurrency]], [convertToCurrency, labels[convertToCurrency]]]))}
                  <div>
                    <label className={uiLabel}>نرخ</label>
                    <div className="flex items-center gap-2">
                      <span className={rateChip}>{fmt(rateUnits[convertDirectBaseValue])} {labels[convertDirectBaseValue]} =</span>
                      {rateInput(convertRate, s => { setConvertRate(s); setConvertErrors(p => ({ ...p, rate: undefined })); }, !!convertErrors.rate, "w-28")}
                      <span className={rateChip}>{convertDirectCounter ? labels[convertDirectCounter] : ""}</span>
                    </div>
                  </div>
                </div>
              ), (
                <>
                  {pill(cAmber.badge, convertRateValue > 0 && convertDirectCounter ? directRateLabel(convertDirectBaseValue, convertDirectCounter, convertRateValue) : "", true)}
                  {pill(cEmerald.badge, convertedAmount ? `${convertedAmount} ${labels[convertToCurrency]}` : "")}
                </>
              ))}
              <div className="grid gap-3 md:grid-cols-2">
                {fld("کارمزد *", moneyField(convertCommission, s => { setConvertCommission(s); setConvertErrors(p => ({ ...p, commission: undefined })); }, !!convertErrors.commission, labels[convertCommissionCurrency], dk ? "bg-violet-400/15 text-violet-300" : "bg-violet-100 text-violet-700"))}
                {fld("توضیحات", (
                  <input value={convertDescription} onChange={e => setConvertDescription(e.target.value)} placeholder="اختیاری" className={uiInput} />
                ))}
              </div>
              {commissionFields("sender", () => { }, convertCommissionCurrency, setConvertCommissionCurrency, false)}
              {errBox(convertErrorList)}
              <button onClick={submitConvert} className={`flex h-[50px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-l text-base font-black shadow-lg ${dk ? "from-violet-400 to-purple-400 text-slate-950" : "from-violet-500 to-fuchsia-400 text-white"}`}>
                {editingConvertId ? "به‌روزرسانی" : "ثبت"}
                <Ic n="arrowLeft" className="h-5 w-5" />
              </button>
            </section>
          )}

          <section className={`overflow-hidden ${uiCard}`}>
            <div className="flex flex-wrap items-center gap-3 p-4 md:p-5">
              <span className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ring-1 ${identExIcon}`}><Ic n="doc" className="h-5 w-5" /></span>
              <div className="flex-1 min-w-0"><h2 className={`fx-display text-xl md:text-2xl ${heading}`}>آخرین معاملات</h2></div>
              {isSearching && <button onClick={() => setSearch("")} className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-[10px] font-black ${dk ? "bg-amber-400/10 text-amber-300" : "bg-amber-100 text-amber-700"}`}>پاک کردن<Ic n="x" className="h-3 w-3" /></button>}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <div className={`${tableMaxHeight} overflow-y-auto`}>
                <table className="w-full min-w-[1200px] text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className={`border-y ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
                      {["شماره", "کد", "مشتری", "تاریخ", "نوع", "دریافت", "پرداخت", "نرخ", "کارمزد", "پرداخت‌کننده", "عملیات"].map(h => (
                        <th key={h} className="px-4 py-3 text-center text-[11px] font-black text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${dk ? "divide-slate-700/60" : "divide-slate-100"}`}>
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={11}>
                          <div className={`flex flex-col items-center gap-3 py-14 ${dk ? "text-slate-500" : "text-slate-400"}`}>
                            <Ic n="inbox" className="h-7 w-7 opacity-70" />
                            <p className="text-sm font-black">معامله‌ای ثبت نشده</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      transactions.map((tx, index) => <TransactionRow key={tx.id} tx={tx} index={index} isSearching={isSearching} />)
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>

      {selectedTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3" onClick={() => setSelectedTransaction(null)}>
          <div className={`w-full max-w-lg rounded-xl border shadow-2xl ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-white"}`} onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between border-b px-4 py-3 ${dk ? "border-slate-700" : "border-slate-100"}`}>
              <b className={`text-sm ${dk ? "text-slate-100" : "text-slate-800"}`}>جزئیات معامله</b>
              <button onClick={() => setSelectedTransaction(null)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400"><Ic n="x" className="h-4 w-4" /></button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-4 py-2">
              <DetailRow dark={dk} label="کد" value={selectedTransaction.trackingCode} />
              <DetailRow dark={dk} label="تاریخ" value={dateLabel(selectedTransaction.date)} />
              <DetailRow dark={dk} label="نوع" value={transactionTypeLabel(selectedTransaction)} />
              <DetailRow dark={dk} label="مشتری" value={transactionCustomerLabel(selectedTransaction)} />
              <DetailRow dark={dk} label="دریافت" value={`${fmt(selectedTransaction.fromAmount)} ${labels[selectedTransaction.fromCurrency]}`} />
              <DetailRow dark={dk} label="پرداخت" value={`${fmt(selectedTransaction.toAmount)} ${labels[selectedTransaction.toCurrency]}`} />
              <DetailRow dark={dk} label="نرخ" value={selectedTransaction.rateLabel} />
              <DetailRow dark={dk} label="کارمزد" value={transactionCommissionLabel(selectedTransaction)} />
              <DetailRow dark={dk} label="وضعیت" value={selectedTransaction.status === "voided" ? "لغو شده" : "فعال"} />
              {selectedTransaction.description && <DetailRow dark={dk} label="توضیحات" value={selectedTransaction.description} />}
            </div>
          </div>
        </div>
      )}

      {previewOpen && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 md:p-4 backdrop-blur-sm" onClick={() => { setPreviewOpen(false); setPreviewData(null); }}>
          <div className={`w-full max-w-2xl overflow-hidden rounded-xl md:rounded-2xl border shadow-2xl ${dk ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-white"}`} onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between border-b px-4 md:px-5 py-3 md:py-4 ${dk ? "border-slate-700 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
              <b className={`flex items-center gap-2 text-sm ${dk ? "text-slate-100" : "text-slate-800"}`}>
                <span className={`grid h-8 w-8 place-items-center rounded-lg ${dk ? "bg-blue-400/10 text-blue-300" : "bg-blue-100 text-blue-600"}`}><Ic n="doc" className="h-4 w-4" /></span>
                جزئیات معامله قبل از ثبت
              </b>
              <button onClick={() => { setPreviewOpen(false); setPreviewData(null); }} className={`grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-slate-400 transition-all duration-300 hover:rotate-90 ${dk ? "hover:bg-slate-700 hover:text-white" : "hover:bg-slate-100 hover:text-slate-700"}`}>
                <Ic n="x" className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto px-4 md:px-5 py-4 space-y-4">
              <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${dk ? "border-cyan-400/30 bg-cyan-400/10" : "border-cyan-300 bg-cyan-50"}`}>
                <div>
                  <div className={`text-[10px] font-bold ${subText}`}>کد پیگیری</div>
                  <span className={`inline-flex items-center gap-1.5 text-[14px] font-black tabular-nums ${dk ? "text-cyan-300" : "text-cyan-700"}`} dir="ltr">
                    <Ic n="tag" className="h-4 w-4" />{previewData.trackingCode}
                  </span>
                </div>
                <div className="text-left">
                  <div className={`text-[10px] font-bold ${subText}`}>تاریخ ثبت</div>
                  <div className={`text-[13px] font-black tabular-nums ${dk ? "text-slate-200" : "text-slate-700"}`}>{dateLabel(previewData.date)}</div>
                </div>
              </div>
              {previewData.type === "exchange" && (
                <div className={`rounded-xl border p-4 ${dk ? "border-cyan-400/20 bg-cyan-400/5" : "border-cyan-200 bg-cyan-50/50"}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Ic n="user" className={`h-4 w-4 ${dk ? "text-cyan-300" : "text-cyan-600"}`} />
                    <b className={`text-sm font-black ${dk ? "text-cyan-300" : "text-cyan-700"}`}>مشخصات مشتری</b>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className={subText}>نام: </span>
                      <b className={dk ? "text-slate-100" : "text-slate-800"}>{previewData.customerName}</b>
                      {previewData.customerId === EXCHANGE_ACCOUNT_ID && <span className={`mr-2 text-[10px] font-black ${dk ? "text-sky-300" : "text-sky-600"}`}>💰 حساب صرافی</span>}
                      {previewData.customerId && previewData.customerId !== CASH_BOX_ID && <span className={`mr-2 text-[10px] font-black ${dk ? "text-emerald-300" : "text-emerald-600"}`}>✅ مشتری ثبت‌شده</span>}
                      {!previewData.customerId && <span className={`mr-2 text-[10px] font-black ${dk ? "text-amber-300" : "text-amber-600"}`}>⚠️ غیر مشتری (نقدی)</span>}
                    </div>
                    {previewData.customerPhone && <div><span className={subText}>تلفن: </span><b dir="ltr" className={dk ? "text-slate-100" : "text-slate-800"}>{previewData.customerPhone}</b></div>}
                    {previewData.customerTelegram && <div><span className={subText}>تلگرام: </span><b dir="ltr" className={dk ? "text-slate-100" : "text-slate-800"}>{previewData.customerTelegram}</b></div>}
                  </div>
                </div>
              )}
              {previewData.type === "transfer" && (
                <>
                  <div className={`rounded-xl border p-4 ${dk ? "border-orange-400/20 bg-orange-400/5" : "border-orange-200 bg-orange-50/50"}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <Ic n="arrowLeft" className={`h-4 w-4 ${dk ? "text-orange-300" : "text-orange-600"}`} />
                      <b className={`text-sm font-black ${dk ? "text-orange-300" : "text-orange-700"}`}>فرستنده</b>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className={subText}>نام: </span>
                        <b>{previewData.senderName}</b>
                        {previewData.senderId === EXCHANGE_ACCOUNT_ID && <span className={`mr-2 text-[10px] font-black ${dk ? "text-sky-300" : "text-sky-600"}`}>💰 حساب صرافی</span>}
                        {previewData.senderId && previewData.senderId !== CASH_BOX_ID && <span className={`mr-2 text-[10px] font-black ${dk ? "text-emerald-300" : "text-emerald-600"}`}>✅ مشتری ثبت‌شده</span>}
                        {!previewData.senderId && <span className={`mr-2 text-[10px] font-black ${dk ? "text-amber-300" : "text-amber-600"}`}>⚠️ غیر مشتری (نقدی)</span>}
                      </div>
                    </div>
                  </div>
                  <div className={`rounded-xl border p-4 ${dk ? "border-emerald-400/20 bg-emerald-400/5" : "border-emerald-200 bg-emerald-50/50"}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <Ic n="user" className={`h-4 w-4 ${dk ? "text-emerald-300" : "text-emerald-600"}`} />
                      <b className={`text-sm font-black ${dk ? "text-emerald-300" : "text-emerald-700"}`}>گیرنده</b>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className={subText}>نام: </span>
                        <b>{previewData.receiverName}</b>
                        {previewData.receiverId === EXCHANGE_ACCOUNT_ID && <span className={`mr-2 text-[10px] font-black ${dk ? "text-sky-300" : "text-sky-600"}`}>💰 حساب صرافی</span>}
                        {previewData.receiverId && previewData.receiverId !== CASH_BOX_ID && <span className={`mr-2 text-[10px] font-black ${dk ? "text-emerald-300" : "text-emerald-600"}`}>✅ مشتری ثبت‌شده</span>}
                        {!previewData.receiverId && <span className={`mr-2 text-[10px] font-black ${dk ? "text-amber-300" : "text-amber-600"}`}>⚠️ غیر مشتری (نقدی)</span>}
                      </div>
                    </div>
                  </div>
                </>
              )}
              {previewData.type === "convert" && (
                <div className={`rounded-xl border p-4 ${dk ? "border-violet-400/20 bg-violet-400/5" : "border-violet-200 bg-violet-50/50"}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Ic n="user" className={`h-4 w-4 ${dk ? "text-violet-300" : "text-violet-600"}`} />
                    <b className={`text-sm font-black ${dk ? "text-violet-300" : "text-violet-700"}`}>مشخصات مشتری</b>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className={subText}>نام: </span>
                      <b className={dk ? "text-slate-100" : "text-slate-800"}>{previewData.customerName}</b>
                      {previewData.customerId === EXCHANGE_ACCOUNT_ID && <span className={`mr-2 text-[10px] font-black ${dk ? "text-sky-300" : "text-sky-600"}`}>💰 حساب صرافی</span>}
                      {previewData.customerId && previewData.customerId !== CASH_BOX_ID && <span className={`mr-2 text-[10px] font-black ${dk ? "text-emerald-300" : "text-emerald-600"}`}>✅ مشتری ثبت‌شده</span>}
                      {!previewData.customerId && <span className={`mr-2 text-[10px] font-black ${dk ? "text-amber-300" : "text-amber-600"}`}>⚠️ غیر مشتری (نقدی)</span>}
                    </div>
                  </div>
                </div>
              )}
              <div className={`rounded-xl border p-4 ${dk ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Ic n="swap" className={`h-4 w-4 ${dk ? "text-emerald-300" : "text-emerald-600"}`} />
                  <b className={`text-sm font-black ${dk ? "text-emerald-300" : "text-emerald-700"}`}>جزئیات معامله و مبلغ</b>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div><span className={subText}>نوع: </span><b>{transactionTypeLabel(previewData)}</b></div>
                  <div><span className={subText}>دریافت: </span><b>{fmt(previewData.fromAmount)} {labels[previewData.fromCurrency]}</b></div>
                  <div><span className={subText}>پرداخت: </span><b>{fmt(previewData.toAmount)} {labels[previewData.toCurrency]}</b></div>
                  <div><span className={subText}>نرخ: </span><b dir="ltr">{previewData.rateLabel}</b></div>
                  <div><span className={subText}>کارمزد: </span><b>{transactionCommissionLabel(previewData)}</b></div>
                  <div><span className={subText}>پرداخت‌کننده: </span><b>{commissionPayerLabel(previewData)}</b></div>
                </div>
              </div>
              {previewData.description && (
                <div className={`rounded-xl border p-4 ${dk ? "border-slate-700 bg-slate-800/30" : "border-slate-200 bg-slate-50"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Ic n="info" className={`h-4 w-4 ${dk ? "text-slate-400" : "text-slate-500"}`} />
                    <b className={`text-sm font-black ${dk ? "text-slate-300" : "text-slate-600"}`}>توضیحات</b>
                  </div>
                  <p className={`text-sm ${dk ? "text-slate-300" : "text-slate-600"}`}>{previewData.description}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-3 pt-2">
                <button onClick={confirmRegister} className={`flex h-[48px] flex-1 min-w-[180px] cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-black shadow-lg ${dk ? "bg-emerald-400 text-slate-950" : "bg-emerald-500 text-white"}`}>
                  ثبت نهایی
                  <Ic n="check" className="h-4 w-4" />
                </button>
                <button onClick={() => { setPreviewOpen(false); setPreviewData(null); }} className={`flex h-[48px] px-6 cursor-pointer items-center justify-center rounded-xl border text-sm font-bold ${dk ? "border-slate-600 text-slate-300" : "border-slate-200 text-slate-600"}`}>انصراف</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
