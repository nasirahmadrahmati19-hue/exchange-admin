export interface Rates { usd: string; eur: string; toman: string; }
export const defaultRates: Rates = { usd: "70.5", eur: "76", toman: "0.64" };
export const CURRENCIES = ["افغانی", "تومان", "دلار", "یورو"];
export const CITIES = ["هرات", "کابل", "اسلام‌قلعه", "مشهد", "تهران", "دوغارون"];

/* ---------- حساب‌ها ---------- */
export type CurKey = "AFN" | "USD" | "IRR";
export interface Balances { AFN: number; USD: number; IRR: number; }
export interface AccountUser { id: number; name: string; phone: string; telegram?: string; balances: Balances; status: string; }
export interface Tx {
  id: number; receiptNo: string; typeLabel: string; customer: string; receiver: string;
  currency: string; amount: number; afnValue: string; status: string; date: string; time: string;
  balancesAfter: Balances; phone: string;
}

export const CURRENCY_META: Record<CurKey, { label: string; flag: string; code: string }> = {
  AFN: { label: "افغانی", flag: "🇦🇫", code: "AFN" },
  USD: { label: "دالر", flag: "🇺🇸", code: "USD" },
  IRR: { label: "تومان", flag: "🇮🇷", code: "IRR" },
};

export function emptyBalances(): Balances { return { AFN: 0, USD: 0, IRR: 0 }; }

/* ---------- ذخیره ---------- */
export function loadJSON<T>(key: string, fallback: T): T {
  try { const s = localStorage.getItem(key); if (s) return JSON.parse(s) as T; } catch {}
  return fallback;
}
export function loadRates(): Rates { return { ...defaultRates, ...loadJSON<Partial<Rates>>("db_rates", {}) }; }
export function loadCommission(): string { const s = loadJSON<any>("db_settings", {}); return s && s.commission ? String(s.commission) : "0.5"; }
export function loadSiteName(): string { const s = loadJSON<any>("db_settings", {}); return s && s.siteName ? s.siteName : "برادران نورزاد"; }

/* ---------- تبدیل ارز ---------- */
export function toAFN(amount: number, cur: string, rates: Rates): number {
  if (cur === "تومان") return (amount / 1000) * Number(rates.toman);
  if (cur === "دلار" || cur === "دالر") return amount * Number(rates.usd);
  if (cur === "یورو") return amount * Number(rates.eur);
  return amount;
}
export function fromAFN(afn: number, cur: string, rates: Rates): number {
  if (cur === "تومان") return (afn / Number(rates.toman)) * 1000;
  if (cur === "دلار" || cur === "دالر") return afn / Number(rates.usd);
  if (cur === "یورو") return afn / Number(rates.eur);
  return afn;
}
export function toAFNk(amt: number, k: CurKey, r: Rates): number {
  return k === "AFN" ? amt : k === "USD" ? amt * Number(r.usd) : (amt / 1000) * Number(r.toman);
}
export function fromAFNk(afn: number, k: CurKey, r: Rates): number {
  return k === "AFN" ? afn : k === "USD" ? afn / Number(r.usd) : (afn / Number(r.toman)) * 1000;
}

/* ---------- قالب ---------- */
export function fa(n: number): string { return n.toLocaleString("fa-IR", { maximumFractionDigits: 0 }); }
export function todayFa(): string { return new Date().toLocaleDateString("fa-IR"); }
export function nowTime(): string { return new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }); }

/* ---------- اعتبارسنجی ---------- */
export function checkRequired(form: Record<string, string>, required: { key: string; label: string }[]): string[] {
  const missing: string[] = [];
  required.forEach(r => { if (!(form[r.key] || "").trim()) missing.push(r.label); });
  return missing;
}
export function requiredMessage(missing: string[]): string { return "لطفاً این فیلدها را پر کنید: " + missing.join("، "); }

export function statusChipClass(s: string): string {
  if (s === "در انتظار" || s === "باز") return "bg-amber-50 text-amber-700 border-amber-200";
  if (s === "ارسال شده") return "bg-blue-50 text-blue-700 border-blue-200";
  if (s === "تحویل شده" || s === "بسته" || s === "تأیید شده" || s === "فعال" || s === "موفق") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "رد شده" || s === "مسدود") return "bg-red-50 text-red-700 border-red-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

/* ---------- موتور حسابداری ---------- */
export function nextReceiptNo(): string {
  let n = 1024;
  try { const s = localStorage.getItem("db_receipt_counter"); if (s) n = Number(s); } catch {}
  n += 1;
  try { localStorage.setItem("db_receipt_counter", String(n)); } catch {}
  return "#TR-" + n;
}

export function applyTransfer(user: AccountUser, cur: CurKey, amount: number): AccountUser {
  const balances = { ...user.balances, [cur]: (user.balances[cur] || 0) - amount };
  return { ...user, balances };
}

export function applyExchange(user: AccountUser, fromCur: CurKey, toCur: CurKey, fromAmount: number, toAmount: number): AccountUser {
  const balances = {
    ...user.balances,
    [fromCur]: (user.balances[fromCur] || 0) - fromAmount,
    [toCur]: (user.balances[toCur] || 0) + toAmount,
  };
  return { ...user, balances };
}

/* ---------- ساخت رسید رسمی ---------- */
export function buildReceipt(o: {
  receiptNo: string; customer: string; typeLabel: string; amountLabel: string;
  receiver: string; balances: Balances; date: string; time: string; siteName: string;
}): string {
  const M = CURRENCY_META;
  const LINE = "━━━━━━━━━━━━━━━━━━";
  
  // خواندن اطلاعات پشتیبانی از تنظیمات
  const settings = loadJSON<any>("db_settings", {});
  const phone = settings.phone || "+93 700 000 000";
  const address = settings.address || "هرات، افغانستان";
  const siteName = o.siteName || "صرافی نورزاد";

  return [
    `🏦 ${siteName}`,
    `🧾 رسید رسمی معامله`,
    ``,
    LINE,
    `🔖 شماره رسید: ${o.receiptNo}`,
    `📅 تاریخ: ${o.date}`,
    `🕐 ساعت: ${o.time}`,
    LINE,
    ``,
    `👤 اطلاعات مشتری`,
    ``,
    `نام مشتری: ${o.customer}`,
    ``,
    LINE,
    `💱 جزئیات معامله`,
    ``,
    `نوع معامله: ${o.typeLabel}`,
    `مبلغ انتقال: ${o.amountLabel}`,
    `گیرنده: ${o.receiver}`,
    `وضعیت: 🟢 موفق`,
    ``,
    LINE,
    `💰 مانده حساب شما پس از معامله`,
    ``,
    `${M.AFN.flag} افغانی: ${fa(o.balances.AFN)} AFN`,
    `${M.USD.flag} دالر: ${fa(o.balances.USD)} USD`,
    `${M.IRR.flag} تومان: ${fa(o.balances.IRR)} IRR`,
    ``,
    LINE,
    ``,
    `✅ معامله با موفقیت ثبت و نهایی شد.`,
    ``,
    `از اعتماد شما سپاسگزاریم 🌹`,
    ``,
    `🏦 ${siteName}`,
    `📞 پشتیبانی: ${phone}`,
    `📍 آدرس: ${address}`,
    ``,
    `🔐 این رسید به‌صورت خودکار توسط سیستم صادر شده است.`,
  ].join("\n");
}

/* ---------- اشتراک ---------- */
export function shareLinks(text: string, phone?: string) {
  const enc = encodeURIComponent(text);
  const cleanPhone = (phone || "").replace(/\D/g, "");
  return {
    whatsapp: `https://wa.me/${cleanPhone}?text=${enc}`,
    telegram: `https://t.me/share/url?url=&text=${enc}`,
    email: `mailto:?subject=${encodeURIComponent("صرافی برادران نورزاد")}&body=${enc}`,
    sms: `sms:${cleanPhone}?body=${enc}`,
  };
}

export function openPDF(title: string, rows: { label: string; value: string }[]) {
  const w = window.open("", "_blank", "width=800,height=600");
  if (!w) return;
  const body = rows.map(r => `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;width:35%;">${r.label}</td><td style="padding:8px;border:1px solid #ddd;">${r.value}</td></tr>`).join("");
  w.document.write(`<html dir="rtl"><head><meta charset="utf-8"/><title>${title}</title><style>body{font-family:Tahoma,sans-serif;padding:24px;}h1{font-size:18px;}p{color:#666;font-size:12px;}table{width:100%;border-collapse:collapse;margin-top:16px;}</style></head><body><h1>${title}</h1><p>صرافی برادران نورزاد — هرات</p><table>${body}</table><script>window.onload=function(){setTimeout(function(){window.print();},300);}</script></body></html>`);
  w.document.close();
}
