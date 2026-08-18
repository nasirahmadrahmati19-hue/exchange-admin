"use client";
import { useEffect, useMemo, useState, useRef, useCallback, memo, type ReactNode } from "react";
import { getNextTrackingCode, consumeTrackingCode, initTrackingSystem } from "../lib/trackingCode";
import { CUSTOMERS_KEY, TRANSACTIONS_KEY, HAWALAS_KEY, CASH_KEY, loadCustomersShared, loadTransactionsShared, loadHawalasShared, loadCashEntriesShared } from "../lib/defaultData";

type Currency = "AFN" | "USD" | "EUR" | "IRR" | "PKR";
type Customer = { id: string; name: string; phone?: string; tazkira?: string; address?: string; note?: string; telegram?: string; telegramChatId?: string; registeredAt: string; balances: Record<Currency, number>; };
type CashEntryType = "customer_deposit" | "customer_withdraw" | "owner_deposit" | "owner_withdraw" | "adjustment" | "fee" | "commission_withdraw";
type BalanceChange = { customerId?: string; customerName: string; currency: Currency; amount: number; };
type CashEntry = { id: string; trackingCode: string; date: string; type: CashEntryType; currency: Currency; amount: number; direction: "in" | "out"; reason: string; balanceAfter: number; customerId?: string; customerName?: string; customerPhone?: string; customerTazkira?: string; linkedExchangeId?: string; linkedHawalaId?: string; linkedHawalaSettleId?: string; customerDeleted?: boolean; status: "active" | "voided"; };
type Transaction = { id: string; trackingCode: string; date: string; type: "exchange" | "transfer" | "convert"; fromCurrency: Currency; fromAmount: number; toCurrency: Currency; toAmount: number; rate: number; rateLabel: string; commission?: number; commissionCurrency?: Currency; commissionPayer?: "sender" | "receiver"; status: "active" | "voided"; customerId?: string; customerName?: string; senderId?: string; senderName?: string; receiverId?: string; receiverName?: string; };
type Hawala = { id: string; number: string; date: string; currencyFrom: Currency; currencyTo: Currency; amountFrom: number; finalAmount: number; fee: number; feeCurrency: Currency; feePayer: "sender" | "receiver"; status: "pending" | "sent" | "paid" | "cancelled"; senderId?: string; senderName: string; receiverId?: string; receiverName: string; };
type FormState = { type: CashEntryType | ""; currency: Currency; amount: string; reason: string; customerId: string; customerName: string; };
type FormErrors = Partial<Record<keyof FormState, string>>;

const currencies: Currency[] = ["AFN", "USD", "EUR", "IRR", "PKR"];
const labels: Record<Currency, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };
const entryTypeLabels: Record<CashEntryType, string> = { customer_deposit: "واریز مشتری", customer_withdraw: "برداشت مشتری", owner_deposit: "واریز مالک", owner_withdraw: "برداشت مالک", adjustment: "اصلاح صندوق", fee: "کارمزد", commission_withdraw: "برداشت کارمزد" };
const entryTypeColors: Record<CashEntryType, { light: string; dark: string }> = { customer_deposit: { light: "bg-teal-100 text-teal-700", dark: "bg-teal-400/15 text-teal-300" }, customer_withdraw: { light: "bg-orange-100 text-orange-700", dark: "bg-orange-400/15 text-orange-300" }, owner_deposit: { light: "bg-sky-100 text-sky-700", dark: "bg-sky-400/15 text-sky-300" }, owner_withdraw: { light: "bg-amber-100 text-amber-700", dark: "bg-amber-400/15 text-amber-300" }, adjustment: { light: "bg-violet-100 text-violet-700", dark: "bg-violet-400/15 text-violet-300" }, fee: { light: "bg-emerald-100 text-emerald-700", dark: "bg-emerald-400/15 text-emerald-300" }, commission_withdraw: { light: "bg-purple-100 text-purple-700", dark: "bg-purple-400/15 text-purple-300" } };
const currencyColors: Record<Currency, { light: string; dark: string; gradient: string }> = { AFN: { light: "text-emerald-700", dark: "text-emerald-300", gradient: "from-emerald-500 to-teal-400" }, USD: { light: "text-sky-700", dark: "text-sky-300", gradient: "from-sky-500 to-cyan-400" }, EUR: { light: "text-blue-700", dark: "text-blue-300", gradient: "from-blue-600 to-blue-400" }, IRR: { light: "text-amber-700", dark: "text-amber-300", gradient: "from-amber-500 to-orange-400" }, PKR: { light: "text-rose-700", dark: "text-rose-300", gradient: "from-rose-500 to-pink-400" } };

const CASH_BOX_ID = "CASH_BOX";
const CASH_BOX_NAME = "صندوق";
const CASH_BOX_CUSTOMER: Customer = { id: CASH_BOX_ID, name: CASH_BOX_NAME, phone: "", tazkira: "", address: "", note: "", telegram: "", telegramChatId: "", registeredAt: "", balances: { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 } };

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

function computeCashBalances(entries: CashEntry[]): Record<Currency, number> {
  const balances: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
  const sorted = [...entries].sort((a, b) => { try { return new Date(a.date).getTime() - new Date(b.date).getTime(); } catch (e) { return 0; } });
  for (const e of sorted) { if (!currencies.includes(e.currency)) continue; if (e.status === "voided") continue; balances[e.currency] += e.direction === "in" ? e.amount : -e.amount; }
  return balances;
}

function recomputeCashBalances(entries: CashEntry[]): CashEntry[] {
  const sorted = [...entries].sort((a, b) => { const t1 = new Date(a.date).getTime(); const t2 = new Date(b.date).getTime(); if (t1 !== t2) return t1 - t2; const aIsHawala = a.linkedHawalaId || a.linkedHawalaSettleId; const bIsHawala = b.linkedHawalaId || b.linkedHawalaSettleId; if (aIsHawala && bIsHawala) { if (a.direction === "out" && b.direction === "in") return -1; if (a.direction === "in" && b.direction === "out") return 1; } if (a.direction === "in" && b.direction === "out") return -1; if (a.direction === "out" && b.direction === "in") return 1; return 0; });
  const bals: Record<Currency, number> = { AFN: 0, USD: 0, EUR: 0, IRR: 0, PKR: 0 };
  return sorted.map(e => {
    if (e.status === "voided") return { ...e, balanceAfter: bals[e.currency] || 0 };
    if (e.currency && bals[e.currency] !== undefined) {
      bals[e.currency] += e.direction === "in" ? (e.amount || 0) : -(e.amount || 0);
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
  if (entry.customerId && entry.customerId !== CASH_BOX_ID && (entry.type === "customer_deposit" || entry.type === "customer_withdraw")) {
    const delta = entry.type === "customer_deposit" ? entry.amount : -entry.amount;
    changes.push({ customerId: entry.customerId, customerName: entry.customerName || "", currency: entry.currency, amount: delta * sign });
  }
  return changes;
}

function migrateEntries(entries: any[]): CashEntry[] {
  return entries.map(e => ({ ...e, status: e.status || "active" })) as CashEntry[];
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
    const s = JSON.parse(r); return {
      enabled: s.telegram?.enabled || false,
      botToken: s.telegram?.botToken || "",
      notifyCash: s.telegram?.notifyCash !== false,
    };
  } catch { return { enabled: false, botToken: "", notifyCash: true }; }
}

function getCustomerChatId(customerId: string | undefined, customers: Customer[]): string {
  if (!customerId || customerId === CASH_BOX_ID) return "";
  try {
    const c = customers.find(x => x.id === customerId);
    if (!c) return "";
    return c.telegramChatId || c.telegram || "";
  } catch { return ""; }
}

function buildCashReceiptText(params: { entry: CashEntry; customerName: string; balances: Record<string, number>; date: Date; }): string {
  const { entry, customerName, balances, date } = params;
  const dateStr = formatShamsiDateTime(date);
  const isDeposit = entry.direction === "in";
  const title = isDeposit ? "🟢 سند رسید" : "🔴 سند برد";
  let text = `${title}\n\n🗓 تاریخ: ${dateStr}\n\n🛅 پیگیری: ${entry.trackingCode}\n\n👤 مشتری: ${customerName}\n\n📑 شرح: ${entry.reason}\n\n`;
  if (isDeposit) text += `💵 دریافت: ${fmt(entry.amount)} ${labels[entry.currency]}\n`;
  else text += `💰 پرداخت: ${fmt(entry.amount)} ${labels[entry.currency]}\n`;
  text += `📝 به حروف: ${numberToPersianWords(entry.amount)}\n\n-------------بیلانس فعلی شما--------------\n`;
  const curLabels: Record<string, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };
  for (const [cur, bal] of Object.entries(balances)) {
    const label = curLabels[cur] || cur;
    const status = bal > 0 ? "طلب" : bal < 0 ? "قرض" : "";
    const fb = Math.abs(bal).toLocaleString("en-US");
    text += `${label}: ${fb} ${status}\n`;
  }
  text += `\n🏦 صرافی برادران نورزاد — هرات`;
  return text;
}

function buildCashVoidNoticeText(params: { entry: CashEntry; customerName: string; balances: Record<string, number>; date: Date; }): string {
  const { entry, customerName, balances, date } = params;
  const dateStr = formatShamsiDateTime(date);
  let text = `📬 اطلاعیه لغو سند صندوق\n\n🗓 تاریخ: ${dateStr}\n\n🛅 پیگیری: ${entry.trackingCode}\n\n👤 مشتری: ${customerName}\n\n`;
  if (entry.type === "customer_deposit") {
    text += `📑 شرح: سند لغو شد — مبلغ از حساب شما کسر گردید\n\n💰 مبلغ کسرشده: ${fmt(entry.amount)} ${labels[entry.currency]}\n`;
  } else {
    text += `📑 شرح: سند لغو شد — مبلغ به حساب شما برگشت داده شد\n\n💰 مبلغ برگشتی: ${fmt(entry.amount)} ${labels[entry.currency]}\n`;
  }
  text += `📝 به حروف: ${numberToPersianWords(entry.amount)}\n\n-------------بیلانس فعلی شما--------------\n`;
  const curLabels: Record<string, string> = { AFN: "افغانی", USD: "دالر", EUR: "یورو", IRR: "تومان", PKR: "کلدار" };
  for (const [cur, bal] of Object.entries(balances)) {
    const label = curLabels[cur] || cur;
    const status = bal > 0 ? "طلب" : bal < 0 ? "قرض" : "";
    const fb = Math.abs(bal).toLocaleString("en-US");
    text += `${label}: ${fb} ${status}\n`;
  }
  text += `\n🏦 صرافی برادران نورزاد — هرات`;
  return text;
}

async function sendCashReceipts(params: { entry: CashEntry; action: "register" | "void"; customers: Customer[]; }) {
  const settings = getTelegramSettings();
  if (!settings.enabled || !settings.botToken) return;
  if (!settings.notifyCash) return;
  const { entry, action, customers } = params;
  if (!entry.customerId || entry.customerId === CASH_BOX_ID) return;
  if (entry.type !== "customer_deposit" && entry.type !== "customer_withdraw") return;
  const chatId = getCustomerChatId(entry.customerId, customers);
  if (!chatId) return;
  const getBalances = (customerId: string | undefined): Record<string, number> => {
    const balances: Record<string, number> = {};
    for (const cur of currencies) balances[cur] = 0;
    if (!customerId || customerId === CASH_BOX_ID) return balances;
    const c = customers.find(x => x.id === customerId);
    if (!c) return balances;
    for (const cur of currencies) balances[cur] = c.balances[cur] || 0;
    return balances;
  };
  const now = new Date();
  let text = "";
  if (action === "register") text = buildCashReceiptText({ entry, customerName: entry.customerName || "", balances: getBalances(entry.customerId), date: now });
  else text = buildCashVoidNoticeText({ entry, customerName: entry.customerName || "", balances: getBalances(entry.customerId), date: now });
  await sendTelegramMessage(settings.botToken, chatId, text);
}

const Ic = ({ n, className = "h-5 w-5" }: { n: string; className?: string }) => {
  const paths: Record<string, string> = {
    wallet: "M21 12a2.25 2.
